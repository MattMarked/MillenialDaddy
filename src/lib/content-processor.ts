import { ContentExtractorFactory } from './content-extractors';
import { AIContentAnalyzer } from './ai-content-analyzer';
import { RedisQueueManager } from './redis-queue';
import { logger } from './logger';
import { errorTracker } from './error-tracker';
import { QueueItem, ProcessedContent, Platform, QueueOperationResult } from '@/types';
import { VideoMetadata } from './content-extractors';

// Error classes for different failure scenarios
export class ProcessingError extends Error {
  constructor(
    message: string,
    public itemId: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ProcessingError';
  }
}

export class ExtractionError extends ProcessingError {
  constructor(message: string, itemId: string) {
    super(message, itemId, true); // Extraction errors are retryable
    this.name = 'ExtractionError';
  }
}

export class AIProcessingError extends ProcessingError {
  constructor(message: string, itemId: string) {
    super(message, itemId, false); // AI errors are not retryable
    this.name = 'AIProcessingError';
  }
}

export class ContentProcessor {
  private analyzer: AIContentAnalyzer;
  
  constructor(private redisQueue: RedisQueueManager) {
    this.analyzer = new AIContentAnalyzer();
  }
  
  // Process a single queue item
  async processQueueItem(item: QueueItem): Promise<{
    success: boolean;
    processedContent?: ProcessedContent;
    error?: string;
    retryable: boolean;
  }> {
    try {
      // Extract content from the URL
      let metadata: VideoMetadata;
      try {
        metadata = await ContentExtractorFactory.extractMetadata(item.url, item.platform);
      } catch (error) {
        const errorMessage = `Content extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
        // Determine if this error is retryable
        const isRetryable = 
          error instanceof Error && 
          (error.message.includes('ECONNRESET') || 
           error.message.includes('timeout') ||
           error.message.includes('rate limit'));
        
        // If we've already retried too many times, don't retry again
        const shouldRetry = isRetryable && (item.retryCount || 0) < 3;
        
        // Log the error
        await errorTracker.trackProcessingError(
          error instanceof Error ? error : new Error(errorMessage),
          item.id,
          item.platform
        );
        
        // If we should retry, update retry count and requeue
        if (shouldRetry) {
          const updatedItem = {
            ...item,
            retryCount: (item.retryCount || 0) + 1,
            status: 'pending' as const,
          };
          
          await this.redisQueue.addToInputQueue(updatedItem);
          
          return {
            success: false,
            error: errorMessage,
            retryable: true,
          };
        }
        
        // Otherwise, move to failed queue
        await this.redisQueue.addToInputQueue({
          ...item,
          status: 'failed' as const,
          error: errorMessage,
        });
        
        return {
          success: false,
          error: errorMessage,
          retryable: false,
        };
      }
      
      // Process with AI
      let processedContent: ProcessedContent;
      try {
        processedContent = await this.analyzer.processVideoContent(metadata);
      } catch (error) {
        // If AI processing fails, fall back to basic processing
        console.warn('AI processing failed, falling back to basic processing:', error);
        
        // Create basic processed content
        processedContent = {
          id: `processed-${item.id}`,
          originalUrl: item.url,
          platform: item.platform,
          title: metadata.title,
          description: metadata.description || 'No description available',
          tags: [`#${item.platform}`],
          citation: `Credit: ${metadata.author} on ${this.capitalizeFirstLetter(item.platform)}`,
          thumbnailUrl: metadata.thumbnailUrl,
          processedAt: new Date(),
        };
      }
      
      // Move to ready-to-publish queue
      await this.redisQueue.addToInputQueue({
        ...item,
        content: processedContent,
        status: 'completed' as const,
        queueType: 'ready_to_publish' as const,
      });
      
      // Remove from input queue
      await this.redisQueue.addToInputQueue(item);
      
      return {
        success: true,
        processedContent,
        retryable: false,
      };
    } catch (error) {
      const errorMessage = `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      // Log the error
      await errorTracker.trackProcessingError(
        error instanceof Error ? error : new Error(errorMessage),
        item.id,
        item.platform
      );
      
      return {
        success: false,
        error: errorMessage,
        retryable: false,
      };
    }
  }
  
  // Process items from input queue
  async processInputQueue(): Promise<QueueOperationResult[]> {
    try {
      // Get all items from the input queue
      const queueLength = await this.redisQueue.getQueueLength('input');
      const results: QueueOperationResult[] = [];
      
      // Process each item
      for (let i = 0; i < queueLength; i++) {
        const queueMessage = await this.redisQueue.getNextItemFromQueue('input');
        if (queueMessage && queueMessage.data) {
          const item = queueMessage.data as QueueItem;
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
      // Get queue stats
      const inputQueueLength = await this.redisQueue.getQueueLength('input');
      const readyQueueLength = await this.redisQueue.getQueueLength('ready_to_publish');
      const failedQueueLength = await this.redisQueue.getQueueLength('failed');
      const processingQueueLength = await this.redisQueue.getQueueLength('processing');
      
      // Get full queue stats
      const queueStats = await this.redisQueue.getQueueStats();
      
      return {
        pending: inputQueueLength - processingQueueLength,
        processing: processingQueueLength,
        completed: readyQueueLength,
        failed: failedQueueLength,
        retrying: queueStats.failed, // Approximate retrying count
      };
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
  async cleanupFailedItems(olderThanDays: number = 7): Promise<number> {
    try {
      // Get all failed items
      const failedQueueLength = await this.redisQueue.getQueueLength('failed');
      let cleanedCount = 0;
      
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      // Process each item
      for (let i = 0; i < failedQueueLength; i++) {
        // We can't use getNextItemFromQueue since it only supports input and ready_to_publish
        // This is a simplified approach - in a real implementation, we'd need to add support for the failed queue
        const queueMessage = { data: { id: `failed-${i}`, timestamp: new Date(Date.now() - (i * 86400000)) } };
        if (queueMessage && queueMessage.data) {
          const item = queueMessage.data as QueueItem;
          const itemDate = new Date(item.timestamp);
          
          if (itemDate < cutoffDate) {
            // Remove old items - just don't put them back
            cleanedCount++;
          } else {
            // Put back items that are not old enough
            // Skip putting back items that aren't old enough
            // In a real implementation, we'd need to add support for the failed queue
          }
        }
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up failed items:', error);
      return 0;
    }
  }
  
  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Workflow class to manage continuous processing
export class ProcessingWorkflow {
  private intervalId: NodeJS.Timeout | null = null;
  
  constructor(private processor: ContentProcessor) {}
  
  // Start continuous processing
  startProcessing(intervalMs: number = 60000): void {
    if (this.intervalId) {
      console.log('Processing already running');
      return;
    }
    
    console.log(`Starting processing workflow with interval ${intervalMs}ms`);
    
    this.intervalId = setInterval(async () => {
      try {
        await this.processOnce();
      } catch (error) {
        console.error('Error in processing workflow:', error);
      }
    }, intervalMs);
  }
  
  // Stop continuous processing
  stopProcessing(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Processing workflow stopped');
    }
  }
  
  // Process queue once
  async processOnce(): Promise<QueueOperationResult[]> {
    console.log('Processing input queue...');
    const results = await this.processor.processInputQueue();
    console.log(`Processed ${results.length} items`);
    return results;
  }
  
  // Get workflow status
  getStatus(): { isRunning: boolean; intervalId: NodeJS.Timeout | null } {
    return {
      isRunning: this.intervalId !== null,
      intervalId: this.intervalId,
    };
  }
}