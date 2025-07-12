// Instagram Graph API integration for publishing posts and stories

import { config } from './config';
import { ProcessedContent, InstagramPost } from '../types';

export interface InstagramMediaResponse {
  id: string;
}

export interface InstagramPublishResponse {
  id: string;
  permalink?: string;
}

export interface InstagramStoryResponse {
  id: string;
}

export interface InstagramTokenInfo {
  app_id: string;
  type: string;
  application: string;
  data_access_expires_at: number;
  expires_at: number;
  is_valid: boolean;
  scopes: string[];
  user_id: string;
}

export class InstagramAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string,
    public errorSubcode?: number
  ) {
    super(message);
    this.name = 'InstagramAPIError';
  }
}

export class InstagramAPI {
  private accessToken: string;
  private accountId: string;
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor() {
    this.accessToken = config.instagram.accessToken;
    this.accountId = config.instagram.accountId;
    
    if (!this.accessToken || !this.accountId) {
      throw new Error('Instagram API credentials not configured');
    }
  }

  /**
   * Validate the Instagram access token
   */
  async validateToken(): Promise<InstagramTokenInfo> {
    try {
      const response = await fetch(
        `${this.baseUrl}/debug_token?input_token=${this.accessToken}&access_token=${this.accessToken}`
      );

      if (!response.ok) {
        throw new InstagramAPIError(
          `Token validation failed: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      if (data.error) {
        throw new InstagramAPIError(
          data.error.message,
          data.error.code,
          data.error.error_subcode
        );
      }

      return data.data;
    } catch (error) {
      if (error instanceof InstagramAPIError) {
        throw error;
      }
      throw new InstagramAPIError(`Token validation error: ${error.message}`);
    }
  }

  /**
   * Create a media container for Instagram post
   */
  private async createMediaContainer(
    caption: string,
    mediaUrl?: string,
    mediaType: 'IMAGE' | 'VIDEO' = 'IMAGE'
  ): Promise<string> {
    try {
      const params = new URLSearchParams({
        access_token: this.accessToken,
        caption: caption,
      });

      if (mediaUrl) {
        if (mediaType === 'IMAGE') {
          params.append('image_url', mediaUrl);
        } else {
          params.append('video_url', mediaUrl);
        }
      }

      const response = await fetch(
        `${this.baseUrl}/${this.accountId}/media`,
        {
          method: 'POST',
          body: params,
        }
      );

      if (!response.ok) {
        throw new InstagramAPIError(
          `Failed to create media container: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      if (data.error) {
        throw new InstagramAPIError(
          data.error.message,
          data.error.code,
          data.error.error_subcode
        );
      }

      return data.id;
    } catch (error) {
      if (error instanceof InstagramAPIError) {
        throw error;
      }
      throw new InstagramAPIError(`Media container creation error: ${error.message}`);
    }
  }

  /**
   * Publish a media container to Instagram feed
   */
  private async publishMedia(creationId: string): Promise<InstagramPublishResponse> {
    try {
      const params = new URLSearchParams({
        access_token: this.accessToken,
        creation_id: creationId,
      });

      const response = await fetch(
        `${this.baseUrl}/${this.accountId}/media_publish`,
        {
          method: 'POST',
          body: params,
        }
      );

      if (!response.ok) {
        throw new InstagramAPIError(
          `Failed to publish media: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      if (data.error) {
        throw new InstagramAPIError(
          data.error.message,
          data.error.code,
          data.error.error_subcode
        );
      }

      return data;
    } catch (error) {
      if (error instanceof InstagramAPIError) {
        throw error;
      }
      throw new InstagramAPIError(`Media publishing error: ${error.message}`);
    }
  }

  /**
   * Post content to Instagram feed
   */
  async postToFeed(instagramPost: InstagramPost): Promise<InstagramPublishResponse> {
    try {
      // Create media container with caption
      const creationId = await this.createMediaContainer(
        instagramPost.postContent,
        instagramPost.content.thumbnailUrl
      );

      // Wait a moment for media processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Publish the media
      const result = await this.publishMedia(creationId);
      
      console.log(`Successfully posted to Instagram feed: ${result.id}`);
      return result;
    } catch (error) {
      console.error('Failed to post to Instagram feed:', error);
      throw error;
    }
  }

  /**
   * Post content to Instagram story
   */
  async postToStory(instagramPost: InstagramPost): Promise<InstagramStoryResponse> {
    try {
      const params = new URLSearchParams({
        access_token: this.accessToken,
        media_type: 'STORIES',
      });

      // Add story content as text overlay if no media URL
      if (!instagramPost.content.thumbnailUrl) {
        // For text-only stories, we need to create a simple image with text
        // This is a simplified approach - in production, you might want to generate an image
        throw new InstagramAPIError('Story posting requires media URL or image generation');
      }

      params.append('image_url', instagramPost.content.thumbnailUrl);
      
      const response = await fetch(
        `${this.baseUrl}/${this.accountId}/media`,
        {
          method: 'POST',
          body: params,
        }
      );

      if (!response.ok) {
        throw new InstagramAPIError(
          `Failed to create story: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      if (data.error) {
        throw new InstagramAPIError(
          data.error.message,
          data.error.code,
          data.error.error_subcode
        );
      }

      console.log(`Successfully posted to Instagram story: ${data.id}`);
      return { id: data.id };
    } catch (error) {
      console.error('Failed to post to Instagram story:', error);
      throw error;
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.accountId}?fields=id,username,account_type,media_count&access_token=${this.accessToken}`
      );

      if (!response.ok) {
        throw new InstagramAPIError(
          `Failed to get account info: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      
      if (data.error) {
        throw new InstagramAPIError(
          data.error.message,
          data.error.code,
          data.error.error_subcode
        );
      }

      return data;
    } catch (error) {
      if (error instanceof InstagramAPIError) {
        throw error;
      }
      throw new InstagramAPIError(`Account info error: ${error.message}`);
    }
  }

  /**
   * Check rate limit status
   */
  async checkRateLimit(): Promise<{ callsRemaining: number; timeWindow: number }> {
    try {
      // Instagram Graph API rate limits are typically 200 calls per hour per user
      // This is a simplified implementation - in production you'd track actual usage
      const response = await fetch(
        `${this.baseUrl}/${this.accountId}?fields=id&access_token=${this.accessToken}`
      );

      const rateLimitRemaining = response.headers.get('x-app-usage') || 
                                response.headers.get('x-ad-account-usage') ||
                                '{"call_count":0,"total_cputime":0,"total_time":0}';

      // Parse rate limit info if available
      try {
        const usage = JSON.parse(rateLimitRemaining);
        return {
          callsRemaining: Math.max(0, 200 - (usage.call_count || 0)),
          timeWindow: 3600 // 1 hour in seconds
        };
      } catch {
        // Fallback if rate limit headers aren't available
        return {
          callsRemaining: 200,
          timeWindow: 3600
        };
      }
    } catch (error) {
      console.warn('Could not check rate limit:', error);
      return {
        callsRemaining: 200,
        timeWindow: 3600
      };
    }
  }

  /**
   * Implement exponential backoff for rate limiting
   */
  private async waitForRateLimit(attempt: number): Promise<void> {
    const baseDelay = 1000; // 1 second
    const maxDelay = 60000; // 1 minute
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    
    console.log(`Rate limited, waiting ${delay}ms before retry...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Retry wrapper with exponential backoff
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    operationName: string = 'Instagram API operation'
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (error instanceof InstagramAPIError) {
          // Don't retry on authentication errors
          if (error.statusCode === 401 || error.statusCode === 403) {
            throw error;
          }
          
          // Retry on rate limit errors
          if (error.statusCode === 429) {
            if (attempt < maxRetries) {
              await this.waitForRateLimit(attempt);
              continue;
            }
          }
          
          // Retry on server errors
          if (error.statusCode >= 500 && attempt < maxRetries) {
            await this.waitForRateLimit(attempt);
            continue;
          }
        }
        
        // Don't retry on final attempt
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retry
        await this.waitForRateLimit(attempt);
      }
    }

    throw new InstagramAPIError(
      `${operationName} failed after ${maxRetries + 1} attempts: ${lastError.message}`
    );
  }
}

// Export singleton instance factory
export const createInstagramAPI = () => new InstagramAPI();

// Export default instance (will throw if credentials not configured)
let instagramAPI: InstagramAPI | null = null;
export const getInstagramAPI = (): InstagramAPI => {
  if (!instagramAPI) {
    instagramAPI = new InstagramAPI();
  }
  return instagramAPI;
};