import { 
  QueueItem, 
  QueueItemFactory, 
  QueueOperationResult, 
  QueueStats, 
  QueueStatus, 
  QueueType, 
  Platform 
} from '@/types';
import { z } from 'zod';
import { logger } from './logger';
import { startTimer } from './performance-monitor';

// Queue status validation
export const QueueStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export const QueueTypeSchema = z.enum(['input', 'ready_to_publish']);
export const PlatformSchema = z.enum(['instagram', 'youtube', 'tiktok']);

// Queue item validation schema
export const QueueItemValidationSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  platform: PlatformSchema,
  submittedBy: z.string().email(),
  timestamp: z.date(),
  status: QueueStatusSchema,
  queueType: QueueTypeSchema,
  content: z.any().nullable().optional(),
  processedAt: z.date().nullable().optional(),
  publishedAt: z.date().nullable().optional(),
});

// Queue item creation schema
export const CreateQueueItemValidationSchema = z.object({
  url: z.string().url(),
  platform: PlatformSchema,
  submittedBy: z.string().email(),
  queueType: QueueTypeSchema.default('input'),
  status: QueueStatusSchema.default('pending'),
});

// Queue item factory implementation
export class QueueItemFactoryImpl implements QueueItemFactory {
  createQueueItem(data: {
    url: string;
    platform: Platform;
    submittedBy: string;
    queueType?: QueueType;
    status?: QueueStatus;
  }): QueueItem {
    const validated = CreateQueueItemValidationSchema.parse(data);
    
    return {
      id: crypto.randomUUID(),
      url: validated.url,
      platform: validated.platform,
      submittedBy: validated.submittedBy,
      timestamp: new Date(),
      status: validated.status,
      queueType: validated.queueType,
      content: null,
      processedAt: null,
      publishedAt: null,
    };
  }
}

// Queue statistics calculator
export class QueueStatsCalculator {
  static calculateStats(items: QueueItem[]): QueueStats {
    const stats: QueueStats = {
      input: 0,
      ready_to_publish: 0,
      failed: 0,
      processing: 0,
      total: items.length,
    };

    items.forEach(item => {
      // Count by queue type
      if (item.queueType === 'input') {
        stats.input++;
      } else if (item.queueType === 'ready_to_publish') {
        stats.ready_to_publish++;
      }

      // Count by status
      if (item.status === 'failed') {
        stats.failed++;
      } else if (item.status === 'processing') {
        stats.processing++;
      }
    });

    return stats;
  }
}

// Queue operation utilities
export class QueueOperations {
  static createSuccessResult(message: string, data?: any): QueueOperationResult {
    return {
      success: true,
      message,
      data,
    };
  }

  static createErrorResult(message: string, data?: any): QueueOperationResult {
    return {
      success: false,
      message,
      data,
    };
  }

  static validateQueueItem(item: any): QueueItem {
    return QueueItemValidationSchema.parse(item);
  }

  static isValidStatus(status: string): status is QueueStatus {
    return QueueStatusSchema.safeParse(status).success;
  }

  static isValidQueueType(queueType: string): queueType is QueueType {
    return QueueTypeSchema.safeParse(queueType).success;
  }

  static isValidPlatform(platform: string): platform is Platform {
    return PlatformSchema.safeParse(platform).success;
  }
}

// Queue item utilities
export class QueueItemUtils {
  static canTransition(from: QueueStatus, to: QueueStatus): boolean {
    const validTransitions: Record<QueueStatus, QueueStatus[]> = {
      pending: ['processing', 'failed'],
      processing: ['completed', 'failed'],
      completed: [], // Terminal state
      failed: ['pending'], // Can retry
    };

    return validTransitions[from].includes(to);
  }

  static getNextValidStatuses(current: QueueStatus): QueueStatus[] {
    const validTransitions: Record<QueueStatus, QueueStatus[]> = {
      pending: ['processing', 'failed'],
      processing: ['completed', 'failed'],
      completed: [],
      failed: ['pending'],
    };

    return validTransitions[current];
  }

  static isTerminalStatus(status: QueueStatus): boolean {
    return status === 'completed';
  }

  static canRetry(status: QueueStatus): boolean {
    return status === 'failed';
  }

  static shouldProcess(item: QueueItem): boolean {
    return item.status === 'pending' && item.queueType === 'input';
  }

  static shouldPublish(item: QueueItem): boolean {
    return item.status === 'pending' && item.queueType === 'ready_to_publish';
  }

  static getProcessingPriority(item: QueueItem): number {
    // Higher number = higher priority
    const platformPriority = {
      instagram: 3,
      youtube: 2,
      tiktok: 1,
    };

    const agePriority = Math.floor(
      (Date.now() - item.timestamp.getTime()) / (1000 * 60 * 60) // Hours
    );

    return platformPriority[item.platform] + agePriority;
  }
}

// Queue Manager class for high-level queue operations
export class QueueManager {
  /**
   * Get the oldest item from ready-to-publish queue
   */
  static async getOldestReadyToPublish(): Promise<QueueItem | null> {
    const timer = startTimer('queue.getOldestReadyToPublish');
    
    try {
      const { QueueItemRepository } = await import('./database');
      const items = await QueueItemRepository.findByQueueType('ready_to_publish');
      
      // Filter for pending items and sort by timestamp
      const pendingItems = items
        .filter(item => item.status === 'pending')
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
      
      const result = pendingItems.length > 0 ? this.convertDbItemToQueueItem(pendingItems[0]) : null;
      
      await timer.end({ 
        success: true, 
        itemsFound: pendingItems.length,
        hasResult: !!result 
      });
      
      await logger.logQueueOperation(
        'get-oldest-ready-to-publish', 
        'ready_to_publish', 
        result?.id,
        { itemsFound: pendingItems.length }
      );
      
      return result;
    } catch (error) {
      await timer.end({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      await logger.logError(
        error instanceof Error ? error : new Error('Unknown error'),
        'Error getting oldest ready-to-publish item',
        {},
        'queue-manager'
      );
      return null;
    }
  }

  /**
   * Remove item from queue
   */
  static async removeFromQueue(id: string, queueType: QueueType): Promise<boolean> {
    const timer = startTimer('queue.removeFromQueue', { queueType });
    
    try {
      const { QueueItemRepository } = await import('./database');
      const result = await QueueItemRepository.delete(id);
      
      await timer.end({ success: result });
      await logger.logQueueOperation('remove-item', queueType, id, { success: result });
      
      return result;
    } catch (error) {
      await timer.end({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      await logger.logError(
        error instanceof Error ? error : new Error('Unknown error'),
        'Error removing item from queue',
        { id, queueType },
        'queue-manager'
      );
      return false;
    }
  }

  /**
   * Update item status
   */
  static async updateItemStatus(
    id: string, 
    status: QueueStatus, 
    error?: string | null, 
    publishedAt?: Date
  ): Promise<boolean> {
    const timer = startTimer('queue.updateItemStatus', { status });
    
    try {
      const { QueueItemRepository } = await import('./database');
      
      let result: boolean;
      if (status === 'completed' && publishedAt) {
        result = await QueueItemRepository.markPublished(id);
      } else {
        result = await QueueItemRepository.updateStatus(id, status);
      }
      
      await timer.end({ success: result });
      await logger.logQueueOperation(
        'update-status', 
        'unknown', // We don't have queue type here
        id, 
        { status, success: result, error, publishedAt: !!publishedAt }
      );
      
      return result;
    } catch (err) {
      await timer.end({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
      await logger.logError(
        err instanceof Error ? err : new Error('Unknown error'),
        'Error updating item status',
        { id, status, error, publishedAt },
        'queue-manager'
      );
      return false;
    }
  }

  /**
   * Update item retry count
   */
  static async updateItemRetryCount(
    id: string, 
    retryCount: number, 
    error: string
  ): Promise<boolean> {
    try {
      // Note: The current database schema doesn't have retry_count and error fields
      // For now, we'll just update the status. In a production system, you'd want to
      // add these fields to the database schema
      const { QueueItemRepository } = await import('./database');
      return await QueueItemRepository.updateStatus(id, 'pending');
    } catch (err) {
      console.error('Error updating item retry count:', err);
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats(): Promise<QueueStats> {
    try {
      const { QueueItemRepository } = await import('./database');
      const counts = await QueueItemRepository.getQueueCounts();
      
      return {
        input: counts.input,
        ready_to_publish: counts.ready_to_publish,
        failed: counts.failed,
        processing: 0, // Would need to be calculated from status
        total: counts.input + counts.ready_to_publish + counts.failed
      };
    } catch (error) {
      console.error('Error getting queue stats:', error);
      return {
        input: 0,
        ready_to_publish: 0,
        failed: 0,
        processing: 0,
        total: 0
      };
    }
  }

  /**
   * Get the last published item
   */
  static async getLastPublishedItem(): Promise<QueueItem | null> {
    try {
      const { executeQuery } = await import('./database');
      const result = await executeQuery<any>(
        'SELECT * FROM queue_items WHERE status = $1 AND published_at IS NOT NULL ORDER BY published_at DESC LIMIT 1',
        ['completed']
      );
      
      if (result.length === 0) {
        return null;
      }
      
      return this.convertDbItemToQueueItem(result[0]);
    } catch (error) {
      console.error('Error getting last published item:', error);
      return null;
    }
  }

  /**
   * Convert database queue item to application queue item format
   */
  private static convertDbItemToQueueItem(dbItem: any): QueueItem {
    return {
      id: dbItem.id,
      url: dbItem.url,
      platform: dbItem.platform as Platform,
      submittedBy: dbItem.submitted_by,
      timestamp: new Date(dbItem.created_at),
      status: dbItem.status as QueueStatus,
      queueType: dbItem.queue_type as QueueType,
      content: dbItem.content ? JSON.parse(dbItem.content) : null,
      processedAt: dbItem.processed_at ? new Date(dbItem.processed_at) : null,
      publishedAt: dbItem.published_at ? new Date(dbItem.published_at) : null,
      retryCount: dbItem.retry_count || 0,
      error: dbItem.error || undefined
    };
  }
}

// Export factory instance
export const queueItemFactory = new QueueItemFactoryImpl();