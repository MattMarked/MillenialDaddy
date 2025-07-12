// Content processing workflow that combines extraction and AI analysis
import { QueueItem, ProcessedContent, QueueOperationResult } from '@/types';
import { ContentExtractorFactory, VideoMetadata } from './content-extractors';
import { AIContentAnalyzer } from './ai-content-analyzer';
import { RedisQueueManager } from './redis-queue';

export interface ProcessingResult {
  success: boolean;
  processedContent?: ProcessedContent;
  error?: string;
  retryable: boolean;
}

export interface ProcessingConfig {
  maxRetries: number;
  retryDelay: number;
  timeoutMs: number;
  enableAI: boolean;
}

export class ContentProcessor {
  private aiAnalyzer: AIContentAnalyzer;
  private redisQueue: RedisQueueManager;
  private config: ProcessingConfig;

  constructor(
    redisQueue: RedisQueueManager,
    config?: Partial<ProcessingConfig>
  ) {
    this.redisQueue = redisQueue;
    this.aiAnalyzer = new AIContentAnalyzer();
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      timeoutMs: 30000,
      enableAI: true,
      ...config,
    };
  }

  async processQueueItem(item: QueueItem): Promise<ProcessingResult> {
    try {
      console.log(`Processing queue item: ${item.id} - ${item.url}`);
      
      // Update item status to processing
      await this.updateItemStatus(item, 'processing');

      // Extract metadata from the video platform
      const metadata = await this.extractVideoMetadata(item);
      
      // Generate AI-powered content analysis
      const processedContent = await this.generateProcessedContent(metadata, item);
      
      // Move to ready-to-publish queue
      await this.moveToReadyQueue(item, processedContent);
      
      console.log(`Successfully processed item: ${item.id}`);
      
      return {
        success: true,
        processedContent,
        retryable: false,
      };
    } catch (error) {
      console.error(`Error processing item ${item.id}:`, error);
      
      const isRetryable = this.isRetryableError(error);
      
      if (isRetryable && (item.retryCount || 0) < this.config.maxRetries) {
        await this.scheduleRetry(item);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        };
      } else {
        await this.moveToFailedQueue(item, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          retryable: false,
        };
      }
    }
  }

  private async extractVideoMetadata(item: QueueItem): Promise<VideoMetadata> {
    try {
      const metadata = await ContentExtractorFactory.extractMetadata(item.url, item.platform);
      return metadata;
    } catch (error) {
      console.error(`Failed to extract metadata for ${item.url}:`, error);
      throw new Error(`Content extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateProcessedContent(
    metadata: VideoMetadata,
    item: QueueItem
  ): Promise<ProcessedContent> {
    try {
      if (this.config.enableAI) {
        return await this.aiAnalyzer.processVideoContent(metadata);
      } else {
        // Fallback to basic processing without AI
        return this.createBasicProcessedContent(metadata, item);
      }
    } catch (error) {
      console.error(`AI processing failed for ${item.id}, using fallback:`, error);
      return this.createBasicProcessedContent(metadata, item);
    }
  }

  private createBasicProcessedContent(
    metadata: VideoMetadata,
    item: QueueItem
  ): ProcessedContent {
    return {
      id: crypto.randomUUID(),
      originalUrl: item.url,
      platform: metadata.platform,
      title: metadata.title,
      description: metadata.description || `Check out this ${metadata.platform} video!`,
      tags: [`#${metadata.platform}`, '#video', '#content'],
      citation: `Credit: ${metadata.author || 'Unknown'} on ${metadata.platform}`,
      thumbnailUrl: metadata.thumbnailUrl,
      processedAt: new Date(),
    };
  }

  private async updateItemStatus(item: QueueItem, status: QueueItem['status']): Promise<void> {
    try {
      item.status = status;
      if (status === 'processing') {
        item.processedAt = new Date();
      }
      // In a real implementation, you would update the database here
      console.log(`Updated item ${item.id} status to: ${status}`);
    } catch (error) {
      console.error(`Failed to update item status:`, error);
      // Don't throw here as this is not critical for processing
    }
  }

  private async moveToReadyQueue(
    item: QueueItem,
    processedContent: ProcessedContent
  ): Promise<void> {
    try {
      // Update the item with processed content
      item.content = processedContent;
      item.status = 'completed';
      item.queueType = 'ready_to_publish';
      
      // Add to ready-to-publish queue
      await this.redisQueue.addToReadyToPublishQueue({
        ...item,
        content: processedContent,
      });
      
      // Move from input queue (this will handle removal)
      await this.redisQueue.moveItemBetweenQueues(item.id, 'input', 'ready_to_publish');
      
      console.log(`Moved item ${item.id} to ready-to-publish queue`);
    } catch (error) {
      console.error(`Failed to move item to ready queue:`, error);
      throw error;
    }
  }

  private async scheduleRetry(item: QueueItem): Promise<void> {
    try {
      item.retryCount = (item.retryCount || 0) + 1;
      item.status = 'pending';
      
      // Add back to input queue with delay
      setTimeout(async () => {
        await this.redisQueue.addToInputQueue(item);
        console.log(`Scheduled retry ${item.retryCount} for item ${item.id}`);
      }, this.config.retryDelay * (item.retryCount || 1));
      
    } catch (error) {
      console.error(`Failed to schedule retry:`, error);
      throw error;
    }
  }

  private async moveToFailedQueue(item: QueueItem, error: unknown): Promise<void> {
    try {
      item.status = 'failed';
      item.error = error instanceof Error ? error.message : 'Unknown error';
      
      await this.redisQueue.markItemFailed(item.id, item.error);
      await this.redisQueue.moveItemBetweenQueues(item.id, 'input', 'failed');
      
      console.log(`Moved item ${item.id} to failed queue: ${item.error}`);
    } catch (err) {
      console.error(`Failed to move item to failed queue:`, err);
      // Don't throw here to avoid infinite loops
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'Rate limit',
      'Service unavailable',
      'Internal server error',
    ];
    
    return retryableErrors.some(retryableError => 
      error.message.toLowerCase().includes(retryableError.toLowerCase())
    );
  }

  // Process items from input queue
  async processInputQueue(): Promise<QueueOperationResult[]> {
    try {
      const items = await this.redisQueue.getQueueItems('input');
      const results: QueueOperationResult[] = [];
      
      for (const item of items) {
        if (item.status === 'pending') {
          const result = await this.processQueueItem(item);
          results.push({
            success: result.success,
            message: result.success 
              ? `Successfully processed ${item.id}` 
              : `Failed to process ${item.id}: ${result.error}`,
            data: { itemId: item.id, result },
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error processing input queue:', error);
      return [{
        success: false,
        message: `Queue processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }];
    }
  }

  // Get processing statistics
  async getProcessingStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    retrying: number;
  }> {
    try {
      const inputItems = await this.redisQueue.getQueueItems('input');
      const readyItems = await this.redisQueue.getQueueItems('ready_to_publish');
      const failedItems = await this.redisQueue.getQueueItems('failed');
      
      const stats = {
        pending: inputItems.filter(item => item.status === 'pending').length,
        processing: inputItems.filter(item => item.status === 'processing').length,
        completed: readyItems.length,
        failed: failedItems.length,
        retrying: inputItems.filter(item => (item.retryCount || 0) > 0).length,
      };
      
      return stats;
    } catch (error) {
      console.error('Error getting processing stats:', error);
      return {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        retrying: 0,
      };
    }
  }

  // Clean up old failed items
  async cleanupFailedItems(olderThanDays = 7): Promise<number> {
    try {
      const failedItems = await this.redisQueue.getQueueItems('failed');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      let cleanedCount = 0;
      
      for (const item of failedItems) {
        if (item.timestamp < cutoffDate) {
          await this.redisQueue.removeFromQueue('failed', item.id);
          cleanedCount++;
        }
      }
      
      console.log(`Cleaned up ${cleanedCount} old failed items`);
      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up failed items:', error);
      return 0;
    }
  }
}

// Processing workflow utilities
export class ProcessingWorkflow {
  private processor: ContentProcessor;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor(processor: ContentProcessor) {
    this.processor = processor;
  }

  // Start continuous processing
  startProcessing(intervalMs = 30000): void {
    if (this.isRunning) {
      console.log('Processing workflow is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting processing workflow with ${intervalMs}ms interval`);

    this.intervalId = setInterval(async () => {
      try {
        await this.processor.processInputQueue();
      } catch (error) {
        console.error('Error in processing workflow:', error);
      }
    }, intervalMs);
  }

  // Stop continuous processing
  stopProcessing(): void {
    if (!this.isRunning) {
      console.log('Processing workflow is not running');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    console.log('Stopped processing workflow');
  }

  // Process queue once
  async processOnce(): Promise<QueueOperationResult[]> {
    return this.processor.processInputQueue();
  }

  // Get current status
  getStatus(): { isRunning: boolean; intervalId?: NodeJS.Timeout } {
    return {
      isRunning: this.isRunning,
      intervalId: this.intervalId,
    };
  }
}

// Error types for better error handling
export class ProcessingError extends Error {
  constructor(
    message: string,
    public itemId: string,
    public retryable: boolean = false,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ProcessingError';
  }
}

export class ExtractionError extends ProcessingError {
  constructor(message: string, itemId: string, cause?: Error) {
    super(message, itemId, true, cause);
    this.name = 'ExtractionError';
  }
}

export class AIProcessingError extends ProcessingError {
  constructor(message: string, itemId: string, cause?: Error) {
    super(message, itemId, false, cause); // AI errors are not retryable
    this.name = 'AIProcessingError';
  }
}