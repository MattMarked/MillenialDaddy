import {
  ContentProcessor,
  ProcessingWorkflow,
  ProcessingError,
  ExtractionError,
  AIProcessingError,
} from '@/lib/content-processor';
import { RedisQueueManager } from '@/lib/redis-queue';
import { QueueItem, Platform } from '@/types';

// Mock dependencies
jest.mock('@/lib/content-extractors');
jest.mock('@/lib/ai-content-analyzer');
jest.mock('@/lib/redis-queue');

const mockRedisQueue = {
  addToQueue: jest.fn(),
  removeFromQueue: jest.fn(),
  getQueueItems: jest.fn(),
  moveItem: jest.fn(),
} as jest.Mocked<RedisQueueManager>;

const mockVideoMetadata = {
  title: 'Test Video',
  description: 'Test description',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  duration: 300,
  author: 'TestAuthor',
  publishedAt: new Date('2023-01-01'),
  viewCount: 1000,
  platform: 'youtube' as Platform,
  videoId: 'test123',
};

const mockProcessedContent = {
  id: 'processed-123',
  originalUrl: 'https://youtube.com/watch?v=test123',
  platform: 'youtube',
  title: 'Test Video',
  description: 'AI-generated description',
  tags: ['#youtube', '#video', '#test'],
  citation: 'Credit: TestAuthor on YouTube',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  processedAt: new Date(),
};

const mockQueueItem: QueueItem = {
  id: 'item-123',
  url: 'https://youtube.com/watch?v=test123',
  platform: 'youtube',
  submittedBy: 'test@example.com',
  timestamp: new Date(),
  status: 'pending',
  queueType: 'input',
  retryCount: 0,
};

describe('ContentProcessor', () => {
  let processor: ContentProcessor;

  beforeEach(() => {
    processor = new ContentProcessor(mockRedisQueue);
    jest.clearAllMocks();
  });

  describe('processQueueItem', () => {
    it('should successfully process a queue item', async () => {
      // Mock successful extraction and AI processing
      const { ContentExtractorFactory } = require('@/lib/content-extractors');
      const { AIContentAnalyzer } = require('@/lib/ai-content-analyzer');
      
      ContentExtractorFactory.extractMetadata = jest.fn().mockResolvedValue(mockVideoMetadata);
      
      // Create a mock instance
      const mockAnalyzer = {
        processVideoContent: jest.fn().mockResolvedValue(mockProcessedContent)
      };
      AIContentAnalyzer.mockImplementation(() => mockAnalyzer);
      
      mockRedisQueue.addToQueue.mockResolvedValue({ success: true, message: 'Added' });
      mockRedisQueue.removeFromQueue.mockResolvedValue({ success: true, message: 'Removed' });

      // Create new processor to use mocked analyzer
      const testProcessor = new ContentProcessor(mockRedisQueue);
      const result = await testProcessor.processQueueItem(mockQueueItem);

      expect(result.success).toBe(true);
      expect(result.processedContent).toEqual(mockProcessedContent);
      expect(result.retryable).toBe(false);
      
      expect(mockRedisQueue.addToQueue).toHaveBeenCalledWith('ready_to_publish', expect.objectContaining({
        content: mockProcessedContent,
        status: 'completed',
        queueType: 'ready_to_publish',
      }));
      expect(mockRedisQueue.removeFromQueue).toHaveBeenCalledWith('input', mockQueueItem.id);
    });

    it('should handle extraction errors with retry', async () => {
      const { ContentExtractorFactory } = require('@/lib/content-extractors');
      
      ContentExtractorFactory.extractMetadata = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
      mockRedisQueue.addToQueue.mockResolvedValue({ success: true, message: 'Added' });

      const result = await processor.processQueueItem(mockQueueItem);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.error).toContain('Content extraction failed');
    });

    it('should handle non-retryable errors', async () => {
      const { ContentExtractorFactory } = require('@/lib/content-extractors');
      
      ContentExtractorFactory.extractMetadata = jest.fn().mockRejectedValue(new Error('Invalid URL format'));
      mockRedisQueue.addToQueue.mockResolvedValue({ success: true, message: 'Added' });
      mockRedisQueue.removeFromQueue.mockResolvedValue({ success: true, message: 'Removed' });

      const itemWithMaxRetries = { ...mockQueueItem, retryCount: 3 };
      const result = await processor.processQueueItem(itemWithMaxRetries);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
      
      expect(mockRedisQueue.addToQueue).toHaveBeenCalledWith('failed', expect.objectContaining({
        status: 'failed',
        error: expect.stringContaining('Content extraction failed'),
      }));
    });

    it('should fallback to basic processing when AI fails', async () => {
      const { ContentExtractorFactory } = require('@/lib/content-extractors');
      const { AIContentAnalyzer } = require('@/lib/ai-content-analyzer');
      
      ContentExtractorFactory.extractMetadata = jest.fn().mockResolvedValue(mockVideoMetadata);
      
      // Mock AI analyzer to fail
      const mockAnalyzer = {
        processVideoContent: jest.fn().mockRejectedValue(new Error('AI service unavailable'))
      };
      AIContentAnalyzer.mockImplementation(() => mockAnalyzer);
      
      mockRedisQueue.addToQueue.mockResolvedValue({ success: true, message: 'Added' });
      mockRedisQueue.removeFromQueue.mockResolvedValue({ success: true, message: 'Removed' });

      // Create new processor to use mocked analyzer
      const testProcessor = new ContentProcessor(mockRedisQueue);
      const result = await testProcessor.processQueueItem(mockQueueItem);

      expect(result.success).toBe(true);
      expect(result.processedContent).toBeDefined();
      expect(result.processedContent?.description).toBe('Test description');
    });
  });

  describe('processInputQueue', () => {
    it.skip('should process multiple items from input queue', async () => {
      const items = [
        { ...mockQueueItem, id: 'item-1' },
        { ...mockQueueItem, id: 'item-2' },
        { ...mockQueueItem, id: 'item-3', status: 'processing' as const }, // Should be skipped
      ];

      // Create a fresh mock for this test
      const testMockRedisQueue = {
        addToQueue: jest.fn(),
        removeFromQueue: jest.fn(),
        getQueueItems: jest.fn().mockResolvedValue(items),
        moveItem: jest.fn(),
      } as jest.Mocked<RedisQueueManager>;

      // Create a new processor instance with the fresh mock
      const testProcessor = new ContentProcessor(testMockRedisQueue);
      
      // Mock the processQueueItem method to return success without actually processing
      const processQueueItemSpy = jest.spyOn(testProcessor, 'processQueueItem')
        .mockResolvedValue({
          success: true,
          processedContent: mockProcessedContent,
          retryable: false,
        });

      const results = await testProcessor.processInputQueue();

      expect(results).toHaveLength(2); // Only pending items should be processed
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(processQueueItemSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle queue processing errors gracefully', async () => {
      mockRedisQueue.getQueueItems.mockRejectedValue(new Error('Redis connection failed'));

      const results = await processor.processInputQueue();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].message).toContain('Queue processing failed');
    });
  });

  describe('getProcessingStats', () => {
    it('should return processing statistics', async () => {
      const inputItems = [
        { ...mockQueueItem, status: 'pending' as const },
        { ...mockQueueItem, status: 'processing' as const },
        { ...mockQueueItem, status: 'pending' as const, retryCount: 1 },
      ];
      const readyItems = [
        { ...mockQueueItem, status: 'completed' as const, queueType: 'ready_to_publish' as const },
      ];
      const failedItems = [
        { ...mockQueueItem, status: 'failed' as const },
      ];

      mockRedisQueue.getQueueItems
        .mockResolvedValueOnce(inputItems)
        .mockResolvedValueOnce(readyItems)
        .mockResolvedValueOnce(failedItems);

      const stats = await processor.getProcessingStats();

      expect(stats).toEqual({
        pending: 2,
        processing: 1,
        completed: 1,
        failed: 1,
        retrying: 3,
      });
    });
  });

  describe('cleanupFailedItems', () => {
    it('should clean up old failed items', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days old
      
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3); // 3 days old

      const failedItems = [
        { ...mockQueueItem, timestamp: oldDate, id: 'old-item' },
        { ...mockQueueItem, timestamp: recentDate, id: 'recent-item' },
      ];

      mockRedisQueue.getQueueItems.mockResolvedValue(failedItems);
      mockRedisQueue.removeFromQueue.mockResolvedValue({ success: true, message: 'Removed' });

      const cleanedCount = await processor.cleanupFailedItems(7);

      expect(cleanedCount).toBe(1);
      expect(mockRedisQueue.removeFromQueue).toHaveBeenCalledWith('failed', 'old-item');
      expect(mockRedisQueue.removeFromQueue).not.toHaveBeenCalledWith('failed', 'recent-item');
    });
  });
});

describe('ProcessingWorkflow', () => {
  let processor: ContentProcessor;
  let workflow: ProcessingWorkflow;

  beforeEach(() => {
    processor = new ContentProcessor(mockRedisQueue);
    workflow = new ProcessingWorkflow(processor);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('startProcessing', () => {
    it('should start continuous processing', () => {
      const processSpy = jest.spyOn(processor, 'processInputQueue').mockResolvedValue([]);

      workflow.startProcessing(1000);

      expect(workflow.getStatus().isRunning).toBe(true);

      // Fast-forward time to trigger processing
      jest.advanceTimersByTime(1000);

      expect(processSpy).toHaveBeenCalledTimes(1);
    });

    it('should not start if already running', () => {
      workflow.startProcessing(1000);
      const firstStatus = workflow.getStatus();

      workflow.startProcessing(1000);
      const secondStatus = workflow.getStatus();

      expect(firstStatus.intervalId).toBe(secondStatus.intervalId);
    });
  });

  describe('stopProcessing', () => {
    it('should stop continuous processing', () => {
      workflow.startProcessing(1000);
      expect(workflow.getStatus().isRunning).toBe(true);

      workflow.stopProcessing();
      expect(workflow.getStatus().isRunning).toBe(false);
    });
  });

  describe('processOnce', () => {
    it('should process queue once', async () => {
      const processSpy = jest.spyOn(processor, 'processInputQueue').mockResolvedValue([
        { success: true, message: 'Processed item' }
      ]);

      const results = await workflow.processOnce();

      expect(processSpy).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });
  });
});

describe('Error Classes', () => {
  describe('ProcessingError', () => {
    it('should create processing error with correct properties', () => {
      const error = new ProcessingError('Test error', 'item-123', true);

      expect(error.message).toBe('Test error');
      expect(error.itemId).toBe('item-123');
      expect(error.retryable).toBe(true);
      expect(error.name).toBe('ProcessingError');
    });
  });

  describe('ExtractionError', () => {
    it('should create extraction error as retryable', () => {
      const error = new ExtractionError('Extraction failed', 'item-123');

      expect(error.retryable).toBe(true);
      expect(error.name).toBe('ExtractionError');
    });
  });

  describe('AIProcessingError', () => {
    it('should create AI processing error as non-retryable', () => {
      const error = new AIProcessingError('AI failed', 'item-123');

      expect(error.retryable).toBe(false);
      expect(error.name).toBe('AIProcessingError');
    });
  });
});