import {
  QueueItemFactoryImpl,
  QueueStatsCalculator,
  QueueOperations,
  QueueItemUtils,
  queueItemFactory,
  QueueStatusSchema,
  QueueTypeSchema,
  PlatformSchema,
} from '@/lib/queue';
import { QueueItem, QueueStats } from '@/types';

describe('Queue Data Models and Utilities', () => {
  describe('QueueItemFactoryImpl', () => {
    const factory = new QueueItemFactoryImpl();

    it('should create a valid queue item with default values', () => {
      const data = {
        url: 'https://www.instagram.com/reel/ABC123/',
        platform: 'instagram' as const,
        submittedBy: 'admin@example.com',
      };

      const item = factory.createQueueItem(data);

      expect(item.id).toBeDefined();
      expect(item.url).toBe(data.url);
      expect(item.platform).toBe(data.platform);
      expect(item.submittedBy).toBe(data.submittedBy);
      expect(item.status).toBe('pending');
      expect(item.queueType).toBe('input');
      expect(item.content).toBeNull();
      expect(item.processedAt).toBeNull();
      expect(item.publishedAt).toBeNull();
      expect(item.timestamp).toBeInstanceOf(Date);
    });

    it('should create a queue item with custom status and queue type', () => {
      const data = {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        platform: 'youtube' as const,
        submittedBy: 'admin@example.com',
        status: 'processing' as const,
        queueType: 'ready_to_publish' as const,
      };

      const item = factory.createQueueItem(data);

      expect(item.status).toBe('processing');
      expect(item.queueType).toBe('ready_to_publish');
    });

    it('should validate input data', () => {
      const invalidData = {
        url: 'invalid-url',
        platform: 'invalid-platform',
        submittedBy: 'invalid-email',
      };

      expect(() => factory.createQueueItem(invalidData as any)).toThrow();
    });
  });

  describe('QueueStatsCalculator', () => {
    it('should calculate correct statistics for empty queue', () => {
      const stats = QueueStatsCalculator.calculateStats([]);

      expect(stats).toEqual({
        input: 0,
        ready_to_publish: 0,
        failed: 0,
        processing: 0,
        total: 0,
      });
    });

    it('should calculate correct statistics for mixed queue items', () => {
      const items: QueueItem[] = [
        {
          id: '1',
          url: 'https://example.com/1',
          platform: 'instagram',
          submittedBy: 'admin@example.com',
          timestamp: new Date(),
          status: 'pending',
          queueType: 'input',
        },
        {
          id: '2',
          url: 'https://example.com/2',
          platform: 'youtube',
          submittedBy: 'admin@example.com',
          timestamp: new Date(),
          status: 'processing',
          queueType: 'input',
        },
        {
          id: '3',
          url: 'https://example.com/3',
          platform: 'tiktok',
          submittedBy: 'admin@example.com',
          timestamp: new Date(),
          status: 'failed',
          queueType: 'input',
        },
        {
          id: '4',
          url: 'https://example.com/4',
          platform: 'instagram',
          submittedBy: 'admin@example.com',
          timestamp: new Date(),
          status: 'pending',
          queueType: 'ready_to_publish',
        },
      ];

      const stats = QueueStatsCalculator.calculateStats(items);

      expect(stats).toEqual({
        input: 3,
        ready_to_publish: 1,
        failed: 1,
        processing: 1,
        total: 4,
      });
    });
  });

  describe('QueueOperations', () => {
    it('should create success result', () => {
      const result = QueueOperations.createSuccessResult('Operation successful', { id: '123' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Operation successful');
      expect(result.data).toEqual({ id: '123' });
    });

    it('should create error result', () => {
      const result = QueueOperations.createErrorResult('Operation failed', { error: 'details' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Operation failed');
      expect(result.data).toEqual({ error: 'details' });
    });

    it('should validate queue status', () => {
      expect(QueueOperations.isValidStatus('pending')).toBe(true);
      expect(QueueOperations.isValidStatus('processing')).toBe(true);
      expect(QueueOperations.isValidStatus('completed')).toBe(true);
      expect(QueueOperations.isValidStatus('failed')).toBe(true);
      expect(QueueOperations.isValidStatus('invalid')).toBe(false);
    });

    it('should validate queue type', () => {
      expect(QueueOperations.isValidQueueType('input')).toBe(true);
      expect(QueueOperations.isValidQueueType('ready_to_publish')).toBe(true);
      expect(QueueOperations.isValidQueueType('invalid')).toBe(false);
    });

    it('should validate platform', () => {
      expect(QueueOperations.isValidPlatform('instagram')).toBe(true);
      expect(QueueOperations.isValidPlatform('youtube')).toBe(true);
      expect(QueueOperations.isValidPlatform('tiktok')).toBe(true);
      expect(QueueOperations.isValidPlatform('invalid')).toBe(false);
    });
  });

  describe('QueueItemUtils', () => {
    describe('canTransition', () => {
      it('should allow valid status transitions', () => {
        expect(QueueItemUtils.canTransition('pending', 'processing')).toBe(true);
        expect(QueueItemUtils.canTransition('pending', 'failed')).toBe(true);
        expect(QueueItemUtils.canTransition('processing', 'completed')).toBe(true);
        expect(QueueItemUtils.canTransition('processing', 'failed')).toBe(true);
        expect(QueueItemUtils.canTransition('failed', 'pending')).toBe(true);
      });

      it('should reject invalid status transitions', () => {
        expect(QueueItemUtils.canTransition('completed', 'pending')).toBe(false);
        expect(QueueItemUtils.canTransition('completed', 'processing')).toBe(false);
        expect(QueueItemUtils.canTransition('pending', 'completed')).toBe(false);
      });
    });

    describe('getNextValidStatuses', () => {
      it('should return correct next statuses', () => {
        expect(QueueItemUtils.getNextValidStatuses('pending')).toEqual(['processing', 'failed']);
        expect(QueueItemUtils.getNextValidStatuses('processing')).toEqual(['completed', 'failed']);
        expect(QueueItemUtils.getNextValidStatuses('completed')).toEqual([]);
        expect(QueueItemUtils.getNextValidStatuses('failed')).toEqual(['pending']);
      });
    });

    describe('status checks', () => {
      it('should identify terminal status', () => {
        expect(QueueItemUtils.isTerminalStatus('completed')).toBe(true);
        expect(QueueItemUtils.isTerminalStatus('pending')).toBe(false);
        expect(QueueItemUtils.isTerminalStatus('processing')).toBe(false);
        expect(QueueItemUtils.isTerminalStatus('failed')).toBe(false);
      });

      it('should identify retryable status', () => {
        expect(QueueItemUtils.canRetry('failed')).toBe(true);
        expect(QueueItemUtils.canRetry('completed')).toBe(false);
        expect(QueueItemUtils.canRetry('pending')).toBe(false);
        expect(QueueItemUtils.canRetry('processing')).toBe(false);
      });
    });

    describe('processing checks', () => {
      it('should identify items that should be processed', () => {
        const item: QueueItem = {
          id: '1',
          url: 'https://example.com',
          platform: 'instagram',
          submittedBy: 'admin@example.com',
          timestamp: new Date(),
          status: 'pending',
          queueType: 'input',
        };

        expect(QueueItemUtils.shouldProcess(item)).toBe(true);

        item.status = 'processing';
        expect(QueueItemUtils.shouldProcess(item)).toBe(false);

        item.status = 'pending';
        item.queueType = 'ready_to_publish';
        expect(QueueItemUtils.shouldProcess(item)).toBe(false);
      });

      it('should identify items that should be published', () => {
        const item: QueueItem = {
          id: '1',
          url: 'https://example.com',
          platform: 'instagram',
          submittedBy: 'admin@example.com',
          timestamp: new Date(),
          status: 'pending',
          queueType: 'ready_to_publish',
        };

        expect(QueueItemUtils.shouldPublish(item)).toBe(true);

        item.status = 'processing';
        expect(QueueItemUtils.shouldPublish(item)).toBe(false);

        item.status = 'pending';
        item.queueType = 'input';
        expect(QueueItemUtils.shouldPublish(item)).toBe(false);
      });
    });

    describe('getProcessingPriority', () => {
      it('should calculate priority based on platform and age', () => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        const instagramItem: QueueItem = {
          id: '1',
          url: 'https://example.com',
          platform: 'instagram',
          submittedBy: 'admin@example.com',
          timestamp: oneHourAgo,
          status: 'pending',
          queueType: 'input',
        };

        const youtubeItem: QueueItem = {
          id: '2',
          url: 'https://example.com',
          platform: 'youtube',
          submittedBy: 'admin@example.com',
          timestamp: oneHourAgo,
          status: 'pending',
          queueType: 'input',
        };

        const olderInstagramItem: QueueItem = {
          id: '3',
          url: 'https://example.com',
          platform: 'instagram',
          submittedBy: 'admin@example.com',
          timestamp: twoHoursAgo,
          status: 'pending',
          queueType: 'input',
        };

        const instagramPriority = QueueItemUtils.getProcessingPriority(instagramItem);
        const youtubePriority = QueueItemUtils.getProcessingPriority(youtubeItem);
        const olderInstagramPriority = QueueItemUtils.getProcessingPriority(olderInstagramItem);

        // Instagram should have higher priority than YouTube
        expect(instagramPriority).toBeGreaterThan(youtubePriority);
        
        // Older items should have higher priority
        expect(olderInstagramPriority).toBeGreaterThan(instagramPriority);
      });
    });
  });

  describe('Schema validation', () => {
    it('should validate queue status schema', () => {
      expect(QueueStatusSchema.safeParse('pending').success).toBe(true);
      expect(QueueStatusSchema.safeParse('processing').success).toBe(true);
      expect(QueueStatusSchema.safeParse('completed').success).toBe(true);
      expect(QueueStatusSchema.safeParse('failed').success).toBe(true);
      expect(QueueStatusSchema.safeParse('invalid').success).toBe(false);
    });

    it('should validate queue type schema', () => {
      expect(QueueTypeSchema.safeParse('input').success).toBe(true);
      expect(QueueTypeSchema.safeParse('ready_to_publish').success).toBe(true);
      expect(QueueTypeSchema.safeParse('invalid').success).toBe(false);
    });

    it('should validate platform schema', () => {
      expect(PlatformSchema.safeParse('instagram').success).toBe(true);
      expect(PlatformSchema.safeParse('youtube').success).toBe(true);
      expect(PlatformSchema.safeParse('tiktok').success).toBe(true);
      expect(PlatformSchema.safeParse('invalid').success).toBe(false);
    });
  });

  describe('Factory instance', () => {
    it('should export a working factory instance', () => {
      const item = queueItemFactory.createQueueItem({
        url: 'https://www.instagram.com/reel/ABC123/',
        platform: 'instagram',
        submittedBy: 'admin@example.com',
      });

      expect(item.id).toBeDefined();
      expect(item.platform).toBe('instagram');
    });
  });
});