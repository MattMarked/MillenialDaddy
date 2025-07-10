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

// Export factory instance
export const queueItemFactory = new QueueItemFactoryImpl();