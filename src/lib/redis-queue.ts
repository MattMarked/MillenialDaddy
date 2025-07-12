import { createClient, RedisClientType } from 'redis';
import { config } from './config';
import { 
  QueueItem, 
  QueueMessage, 
  QueueOperationResult, 
  QueueStats, 
  RedisQueueConfig 
} from '@/types';
import { QueueOperations, QueueStatsCalculator } from './queue';
import { logger } from './logger';
import { startTimer } from './performance-monitor';

export class RedisQueueError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'RedisQueueError';
  }
}

export class RedisQueueManager {
  private client: RedisClientType;
  private isConnected: boolean = false;
  private readonly config: RedisQueueConfig;

  // Queue names
  private readonly QUEUES = {
    INPUT: 'queue:input',
    READY_TO_PUBLISH: 'queue:ready_to_publish',
    PROCESSING: 'queue:processing',
    FAILED: 'queue:failed',
    DEAD_LETTER: 'queue:dead_letter',
  } as const;

  // Key prefixes
  private readonly KEYS = {
    ITEM: 'item:',
    LOCK: 'lock:',
    STATS: 'stats:',
    CONFIG: 'config:',
  } as const;

  constructor(redisConfig?: Partial<RedisQueueConfig>) {
    this.config = {
      url: config.redis.url,
      maxRetries: 3,
      retryDelay: 5000, // 5 seconds
      defaultTTL: 86400, // 24 hours
      ...redisConfig,
    };

    this.client = createClient({
      url: this.config.url,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('error', (error) => {
      console.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('Redis client disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.client.connect();
      }
    } catch (error) {
      throw new RedisQueueError(
        'Failed to connect to Redis',
        error instanceof Error ? error : undefined
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
      }
    } catch (error) {
      throw new RedisQueueError(
        'Failed to disconnect from Redis',
        error instanceof Error ? error : undefined
      );
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Queue operations
  async addToInputQueue(item: QueueItem): Promise<QueueOperationResult> {
    const timer = startTimer('redis.addToInputQueue', { platform: item.platform });
    
    try {
      await this.connect();
      
      const itemKey = `${this.KEYS.ITEM}${item.id}`;
      const message: QueueMessage = {
        id: item.id,
        type: 'process',
        data: item,
        timestamp: new Date(),
        retryCount: 0,
      };

      // Store item data
      await this.client.setEx(itemKey, this.config.defaultTTL, JSON.stringify(item));
      
      // Add to input queue
      await this.client.lPush(this.QUEUES.INPUT, JSON.stringify(message));

      const queuePosition = await this.getQueueLength('input');
      
      await timer.end({ success: true, queuePosition });
      await logger.logQueueOperation('add-to-input', 'input', item.id, {
        platform: item.platform,
        queuePosition,
        url: item.url
      });

      return QueueOperations.createSuccessResult(
        'Item added to input queue successfully',
        { itemId: item.id, queuePosition }
      );
    } catch (error) {
      await timer.end({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      await logger.logError(
        error instanceof Error ? error : new Error('Unknown error'),
        'Failed to add item to input queue',
        { itemId: item.id, platform: item.platform },
        'redis-queue'
      );
      
      return QueueOperations.createErrorResult(
        'Failed to add item to input queue',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async addToReadyToPublishQueue(item: QueueItem): Promise<QueueOperationResult> {
    try {
      await this.connect();
      
      const itemKey = `${this.KEYS.ITEM}${item.id}`;
      const message: QueueMessage = {
        id: item.id,
        type: 'publish',
        data: item,
        timestamp: new Date(),
        retryCount: 0,
      };

      // Update item data
      await this.client.setEx(itemKey, this.config.defaultTTL, JSON.stringify(item));
      
      // Add to ready-to-publish queue
      await this.client.lPush(this.QUEUES.READY_TO_PUBLISH, JSON.stringify(message));

      return QueueOperations.createSuccessResult(
        'Item added to ready-to-publish queue successfully',
        { itemId: item.id, queuePosition: await this.getQueueLength('ready_to_publish') }
      );
    } catch (error) {
      return QueueOperations.createErrorResult(
        'Failed to add item to ready-to-publish queue',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async moveItemBetweenQueues(
    itemId: string, 
    fromQueue: 'input' | 'ready_to_publish' | 'processing' | 'failed',
    toQueue: 'input' | 'ready_to_publish' | 'processing' | 'failed'
  ): Promise<QueueOperationResult> {
    try {
      await this.connect();
      
      const fromQueueKey = this.getQueueKey(fromQueue);
      const toQueueKey = this.getQueueKey(toQueue);
      
      // Find and remove item from source queue
      const queueLength = await this.client.lLen(fromQueueKey);
      let foundMessage: QueueMessage | null = null;
      
      for (let i = 0; i < queueLength; i++) {
        const messageStr = await this.client.lIndex(fromQueueKey, i);
        if (messageStr) {
          const message: QueueMessage = JSON.parse(messageStr);
          if (message.id === itemId) {
            foundMessage = message;
            await this.client.lRem(fromQueueKey, 1, messageStr);
            break;
          }
        }
      }

      if (!foundMessage) {
        return QueueOperations.createErrorResult(
          `Item ${itemId} not found in ${fromQueue} queue`
        );
      }

      // Update message type based on destination queue
      foundMessage.type = toQueue === 'ready_to_publish' ? 'publish' : 'process';
      foundMessage.timestamp = new Date();

      // Add to destination queue
      await this.client.lPush(toQueueKey, JSON.stringify(foundMessage));

      return QueueOperations.createSuccessResult(
        `Item moved from ${fromQueue} to ${toQueue} queue successfully`,
        { itemId, fromQueue, toQueue }
      );
    } catch (error) {
      return QueueOperations.createErrorResult(
        'Failed to move item between queues',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async getNextItemFromQueue(queueType: 'input' | 'ready_to_publish'): Promise<QueueMessage | null> {
    try {
      await this.connect();
      
      const queueKey = this.getQueueKey(queueType);
      const messageStr = await this.client.rPop(queueKey);
      
      if (!messageStr) {
        return null;
      }

      const message: QueueMessage = JSON.parse(messageStr);
      
      // Move to processing queue
      await this.client.lPush(this.QUEUES.PROCESSING, JSON.stringify({
        ...message,
        timestamp: new Date(),
      }));

      return message;
    } catch (error) {
      throw new RedisQueueError(
        `Failed to get next item from ${queueType} queue`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async markItemCompleted(itemId: string): Promise<QueueOperationResult> {
    try {
      await this.connect();
      
      // Remove from processing queue
      const processingLength = await this.client.lLen(this.QUEUES.PROCESSING);
      
      for (let i = 0; i < processingLength; i++) {
        const messageStr = await this.client.lIndex(this.QUEUES.PROCESSING, i);
        if (messageStr) {
          const message: QueueMessage = JSON.parse(messageStr);
          if (message.id === itemId) {
            await this.client.lRem(this.QUEUES.PROCESSING, 1, messageStr);
            break;
          }
        }
      }

      // Update item status in storage
      const itemKey = `${this.KEYS.ITEM}${itemId}`;
      const itemStr = await this.client.get(itemKey);
      
      if (itemStr) {
        const item: QueueItem = JSON.parse(itemStr);
        item.status = 'completed';
        item.publishedAt = new Date();
        await this.client.setEx(itemKey, this.config.defaultTTL, JSON.stringify(item));
      }

      return QueueOperations.createSuccessResult(
        'Item marked as completed successfully',
        { itemId }
      );
    } catch (error) {
      return QueueOperations.createErrorResult(
        'Failed to mark item as completed',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async markItemFailed(itemId: string, error?: string): Promise<QueueOperationResult> {
    try {
      await this.connect();
      
      // Find item in processing queue
      const processingLength = await this.client.lLen(this.QUEUES.PROCESSING);
      let foundMessage: QueueMessage | null = null;
      
      for (let i = 0; i < processingLength; i++) {
        const messageStr = await this.client.lIndex(this.QUEUES.PROCESSING, i);
        if (messageStr) {
          const message: QueueMessage = JSON.parse(messageStr);
          if (message.id === itemId) {
            foundMessage = message;
            await this.client.lRem(this.QUEUES.PROCESSING, 1, messageStr);
            break;
          }
        }
      }

      if (!foundMessage) {
        return QueueOperations.createErrorResult(
          `Item ${itemId} not found in processing queue`
        );
      }

      // Check if we should retry or move to dead letter queue
      if (foundMessage.retryCount < this.config.maxRetries) {
        foundMessage.retryCount++;
        foundMessage.timestamp = new Date();
        foundMessage.type = 'retry';
        
        // Add back to failed queue for retry
        await this.client.lPush(this.QUEUES.FAILED, JSON.stringify(foundMessage));
      } else {
        // Move to dead letter queue
        await this.client.lPush(this.QUEUES.DEAD_LETTER, JSON.stringify(foundMessage));
      }

      // Update item status in storage
      const itemKey = `${this.KEYS.ITEM}${itemId}`;
      const itemStr = await this.client.get(itemKey);
      
      if (itemStr) {
        const item: QueueItem = JSON.parse(itemStr);
        item.status = 'failed';
        await this.client.setEx(itemKey, this.config.defaultTTL, JSON.stringify(item));
      }

      return QueueOperations.createSuccessResult(
        'Item marked as failed successfully',
        { itemId, retryCount: foundMessage.retryCount, error }
      );
    } catch (error) {
      return QueueOperations.createErrorResult(
        'Failed to mark item as failed',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async getQueueStats(): Promise<QueueStats> {
    try {
      await this.connect();
      
      const [inputLength, readyLength, processingLength, failedLength, deadLetterLength] = await Promise.all([
        this.client.lLen(this.QUEUES.INPUT),
        this.client.lLen(this.QUEUES.READY_TO_PUBLISH),
        this.client.lLen(this.QUEUES.PROCESSING),
        this.client.lLen(this.QUEUES.FAILED),
        this.client.lLen(this.QUEUES.DEAD_LETTER),
      ]);

      return {
        input: inputLength,
        ready_to_publish: readyLength,
        processing: processingLength,
        failed: failedLength + deadLetterLength,
        total: inputLength + readyLength + processingLength + failedLength + deadLetterLength,
      };
    } catch (error) {
      throw new RedisQueueError(
        'Failed to get queue statistics',
        error instanceof Error ? error : undefined
      );
    }
  }

  async getQueueLength(queueType: 'input' | 'ready_to_publish' | 'processing' | 'failed'): Promise<number> {
    try {
      await this.connect();
      const queueKey = this.getQueueKey(queueType);
      return await this.client.lLen(queueKey);
    } catch (error) {
      throw new RedisQueueError(
        `Failed to get ${queueType} queue length`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async clearQueue(queueType: 'input' | 'ready_to_publish' | 'processing' | 'failed'): Promise<QueueOperationResult> {
    try {
      await this.connect();
      const queueKey = this.getQueueKey(queueType);
      await this.client.del(queueKey);
      
      return QueueOperations.createSuccessResult(
        `${queueType} queue cleared successfully`
      );
    } catch (error) {
      return QueueOperations.createErrorResult(
        `Failed to clear ${queueType} queue`,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async retryFailedItems(): Promise<QueueOperationResult> {
    try {
      await this.connect();
      
      const failedLength = await this.client.lLen(this.QUEUES.FAILED);
      let retriedCount = 0;
      
      for (let i = 0; i < failedLength; i++) {
        const messageStr = await this.client.rPop(this.QUEUES.FAILED);
        if (messageStr) {
          const message: QueueMessage = JSON.parse(messageStr);
          
          // Reset retry count and add back to appropriate queue
          message.retryCount = 0;
          message.timestamp = new Date();
          
          const targetQueue = message.type === 'publish' ? this.QUEUES.READY_TO_PUBLISH : this.QUEUES.INPUT;
          await this.client.lPush(targetQueue, JSON.stringify(message));
          retriedCount++;
        }
      }

      return QueueOperations.createSuccessResult(
        `Retried ${retriedCount} failed items successfully`,
        { retriedCount }
      );
    } catch (error) {
      return QueueOperations.createErrorResult(
        'Failed to retry failed items',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  private getQueueKey(queueType: 'input' | 'ready_to_publish' | 'processing' | 'failed'): string {
    const queueMap = {
      input: this.QUEUES.INPUT,
      ready_to_publish: this.QUEUES.READY_TO_PUBLISH,
      processing: this.QUEUES.PROCESSING,
      failed: this.QUEUES.FAILED,
    };
    
    return queueMap[queueType];
  }
}

// Export singleton instance
export const redisQueueManager = new RedisQueueManager();

// Export function to get Redis client for monitoring
export async function getRedisClient(): Promise<RedisClientType> {
  await redisQueueManager.connect();
  return (redisQueueManager as any).client;
}