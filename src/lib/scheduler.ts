import { PublicationConfigManager } from './publication-config';
import { QueueManager } from './queue';
import { InstagramAPI } from './instagram-api';
import { InstagramFormatter } from './instagram-formatter';
import { QueueItem, ProcessedContent } from '@/types';

export class PublicationScheduler {
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAY_MS = 5000; // 5 seconds

  /**
   * Execute scheduled publication job
   * This should be called by a cron job or scheduled function
   */
  static async executeScheduledPublication(): Promise<{
    success: boolean;
    message: string;
    published?: boolean;
    error?: string;
  }> {
    try {
      console.log('Starting scheduled publication check...');

      // Check if it's time to publish
      const shouldPublish = await PublicationConfigManager.shouldPublishNow();
      
      if (!shouldPublish) {
        console.log('Not time to publish yet');
        return {
          success: true,
          message: 'Not time to publish yet',
          published: false
        };
      }

      console.log('Publication time reached, checking queue...');

      // Get the oldest item from ready-to-publish queue
      const queueItem = await QueueManager.getOldestReadyToPublish();
      
      if (!queueItem) {
        console.log('No items in ready-to-publish queue');
        return {
          success: true,
          message: 'No items available for publication',
          published: false
        };
      }

      console.log(`Publishing item: ${queueItem.id}`);

      // Attempt to publish the content
      const publishResult = await this.publishContent(queueItem);

      if (publishResult.success) {
        // Remove from queue after successful publication
        await QueueManager.removeFromQueue(queueItem.id, 'ready_to_publish');
        
        // Update item status in database
        await QueueManager.updateItemStatus(queueItem.id, 'completed', null, new Date());

        console.log(`Successfully published item: ${queueItem.id}`);
        return {
          success: true,
          message: 'Content published successfully',
          published: true
        };
      } else {
        // Handle publication failure
        await this.handlePublicationFailure(queueItem, publishResult.error || 'Unknown error');
        
        return {
          success: false,
          message: 'Publication failed',
          published: false,
          error: publishResult.error
        };
      }
    } catch (error) {
      console.error('Error in scheduled publication:', error);
      return {
        success: false,
        message: 'Scheduled publication failed',
        published: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Publish content to Instagram
   */
  private static async publishContent(queueItem: QueueItem): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!queueItem.content) {
        throw new Error('No processed content available for publication');
      }

      // Format content for Instagram
      const instagramPost = InstagramFormatter.formatForInstagram(queueItem.content);

      // Get Instagram API instance
      const { getInstagramAPI } = await import('./instagram-api');
      const instagramAPI = getInstagramAPI();

      // Publish to Instagram feed
      const feedResult = await instagramAPI.postToFeed(instagramPost);
      console.log(`Successfully posted to feed: ${feedResult.id}`);

      // Publish to Instagram story
      try {
        const storyResult = await instagramAPI.postToStory(instagramPost);
        console.log(`Successfully posted to story: ${storyResult.id}`);
      } catch (storyError) {
        console.warn(`Story post failed: ${storyError.message}`);
        // Don't fail the entire publication if only story fails
      }

      return { success: true };
    } catch (error) {
      console.error('Error publishing content:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown publication error'
      };
    }
  }

  /**
   * Handle publication failure with retry logic
   */
  private static async handlePublicationFailure(
    queueItem: QueueItem,
    error: string
  ): Promise<void> {
    try {
      const currentRetryCount = queueItem.retryCount || 0;
      
      if (currentRetryCount < this.MAX_RETRY_ATTEMPTS) {
        // Increment retry count and schedule for retry
        const newRetryCount = currentRetryCount + 1;
        
        console.log(`Scheduling retry ${newRetryCount}/${this.MAX_RETRY_ATTEMPTS} for item: ${queueItem.id}`);
        
        // Update retry count in database
        await QueueManager.updateItemRetryCount(queueItem.id, newRetryCount, error);
        
        // Keep item in ready-to-publish queue for next attempt
        // The next scheduled run will try again
      } else {
        // Max retries reached, mark as failed
        console.error(`Max retries reached for item: ${queueItem.id}. Moving to failed status.`);
        
        // Remove from ready-to-publish queue
        await QueueManager.removeFromQueue(queueItem.id, 'ready_to_publish');
        
        // Update status to failed
        await QueueManager.updateItemStatus(queueItem.id, 'failed', error);
      }
    } catch (retryError) {
      console.error('Error handling publication failure:', retryError);
    }
  }

  /**
   * Get publication statistics
   */
  static async getPublicationStats(): Promise<{
    nextPublicationTime: Date | null;
    readyToPublishCount: number;
    lastPublicationTime: Date | null;
    failedPublications: number;
  }> {
    try {
      const [nextTime, queueStats, lastPublication, failedCount] = await Promise.all([
        PublicationConfigManager.getNextPublicationTime(),
        QueueManager.getQueueStats(),
        this.getLastPublicationTime(),
        this.getFailedPublicationCount()
      ]);

      return {
        nextPublicationTime: nextTime,
        readyToPublishCount: queueStats.ready_to_publish,
        lastPublicationTime: lastPublication,
        failedPublications: failedCount
      };
    } catch (error) {
      console.error('Error getting publication stats:', error);
      return {
        nextPublicationTime: null,
        readyToPublishCount: 0,
        lastPublicationTime: null,
        failedPublications: 0
      };
    }
  }

  /**
   * Get the last publication time
   */
  private static async getLastPublicationTime(): Promise<Date | null> {
    try {
      const lastPublished = await QueueManager.getLastPublishedItem();
      return lastPublished?.publishedAt || null;
    } catch (error) {
      console.error('Error getting last publication time:', error);
      return null;
    }
  }

  /**
   * Get count of failed publications
   */
  private static async getFailedPublicationCount(): Promise<number> {
    try {
      const stats = await QueueManager.getQueueStats();
      return stats.failed;
    } catch (error) {
      console.error('Error getting failed publication count:', error);
      return 0;
    }
  }

  /**
   * Manually trigger publication (for testing or manual override)
   */
  static async manualPublish(): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      console.log('Manual publication triggered...');

      const queueItem = await QueueManager.getOldestReadyToPublish();
      
      if (!queueItem) {
        return {
          success: false,
          message: 'No items available for publication'
        };
      }

      const publishResult = await this.publishContent(queueItem);

      if (publishResult.success) {
        await QueueManager.removeFromQueue(queueItem.id, 'ready_to_publish');
        await QueueManager.updateItemStatus(queueItem.id, 'completed', null, new Date());

        return {
          success: true,
          message: 'Content published successfully'
        };
      } else {
        await this.handlePublicationFailure(queueItem, publishResult.error || 'Unknown error');
        
        return {
          success: false,
          message: 'Publication failed',
          error: publishResult.error
        };
      }
    } catch (error) {
      console.error('Error in manual publication:', error);
      return {
        success: false,
        message: 'Manual publication failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}