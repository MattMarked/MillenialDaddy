// Platform-specific content extractors for video metadata
import { config } from './config';
import { Platform } from '@/types';

export interface VideoMetadata {
  title: string;
  description: string;
  thumbnailUrl?: string;
  duration?: number;
  author?: string;
  publishedAt?: Date;
  viewCount?: number;
  platform: Platform;
  videoId: string;
}

export interface ContentExtractor {
  extractMetadata(url: string): Promise<VideoMetadata>;
  validateUrl(url: string): boolean;
  extractVideoId(url: string): string | null;
}

// Base extractor with common functionality
abstract class BaseExtractor implements ContentExtractor {
  protected maxRetries = 3;
  protected retryDelay = 1000; // 1 second

  abstract extractMetadata(url: string): Promise<VideoMetadata>;
  abstract validateUrl(url: string): boolean;
  abstract extractVideoId(url: string): string | null;

  protected async retryOperation<T>(
    operation: () => Promise<T>,
    retries = this.maxRetries
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0) {
        await this.delay(this.retryDelay);
        return this.retryOperation(operation, retries - 1);
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Instagram Reel extractor
export class InstagramExtractor extends BaseExtractor {
  private readonly accessToken: string;

  constructor() {
    super();
    this.accessToken = config.instagram.accessToken;
  }

  validateUrl(url: string): boolean {
    const instagramReelPattern = /^https?:\/\/(www\.)?instagram\.com\/(reel|p)\/([A-Za-z0-9_-]+)/;
    return instagramReelPattern.test(url);
  }

  extractVideoId(url: string): string | null {
    const match = url.match(/\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  }

  async extractMetadata(url: string): Promise<VideoMetadata> {
    if (!this.validateUrl(url)) {
      throw new Error('Invalid Instagram URL');
    }

    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Could not extract video ID from Instagram URL');
    }

    return this.retryOperation(async () => {
      // Note: Instagram Basic Display API has limitations for public content
      // This is a simplified implementation that would need proper Instagram Graph API setup
      const response = await fetch(
        `https://graph.instagram.com/${videoId}?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,username&access_token=${this.accessToken}`
      );

      if (!response.ok) {
        throw new Error(`Instagram API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        title: data.caption?.substring(0, 100) || 'Instagram Reel',
        description: data.caption || '',
        thumbnailUrl: data.thumbnail_url || data.media_url,
        author: data.username,
        publishedAt: data.timestamp ? new Date(data.timestamp) : undefined,
        platform: 'instagram' as Platform,
        videoId: data.id,
      };
    });
  }
}

// YouTube video extractor
export class YouTubeExtractor extends BaseExtractor {
  private readonly apiKey: string;

  constructor() {
    super();
    this.apiKey = config.youtube.apiKey;
  }

  validateUrl(url: string): boolean {
    const youtubePattern = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;
    return youtubePattern.test(url);
  }

  extractVideoId(url: string): string | null {
    // Handle both youtube.com/watch?v= and youtu.be/ formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/,
      /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async extractMetadata(url: string): Promise<VideoMetadata> {
    if (!this.validateUrl(url)) {
      throw new Error('Invalid YouTube URL');
    }

    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Could not extract video ID from YouTube URL');
    }

    return this.retryOperation(async () => {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics,contentDetails&key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        throw new Error('Video not found or not accessible');
      }

      const video = data.items[0];
      const snippet = video.snippet;
      const statistics = video.statistics;
      const contentDetails = video.contentDetails;

      // Parse ISO 8601 duration (PT4M13S -> 253 seconds)
      const duration = this.parseDuration(contentDetails.duration);

      return {
        title: snippet.title,
        description: snippet.description,
        thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
        duration,
        author: snippet.channelTitle,
        publishedAt: new Date(snippet.publishedAt),
        viewCount: parseInt(statistics.viewCount || '0'),
        platform: 'youtube' as Platform,
        videoId,
      };
    });
  }

  private parseDuration(duration: string): number {
    // Parse ISO 8601 duration format (PT4M13S)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }
}

// TikTok video extractor
export class TikTokExtractor extends BaseExtractor {
  private readonly clientKey: string;
  private readonly clientSecret: string;

  constructor() {
    super();
    this.clientKey = config.tiktok.clientKey;
    this.clientSecret = config.tiktok.clientSecret;
  }

  validateUrl(url: string): boolean {
    const tiktokPattern = /^https?:\/\/(www\.)?(tiktok\.com\/@[^\/]+\/video\/\d+|vm\.tiktok\.com\/[A-Za-z0-9]+)/;
    return tiktokPattern.test(url);
  }

  extractVideoId(url: string): string | null {
    // Handle both full URLs and short URLs
    const patterns = [
      /tiktok\.com\/@[^\/]+\/video\/(\d+)/,
      /vm\.tiktok\.com\/([A-Za-z0-9]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async extractMetadata(url: string): Promise<VideoMetadata> {
    if (!this.validateUrl(url)) {
      throw new Error('Invalid TikTok URL');
    }

    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Could not extract video ID from TikTok URL');
    }

    return this.retryOperation(async () => {
      // Note: TikTok API requires OAuth and has strict rate limits
      // This is a simplified implementation that would need proper TikTok API setup
      // For now, we'll extract basic information from the URL structure
      
      // In a real implementation, you would:
      // 1. Get an access token using client credentials
      // 2. Use the TikTok Research API or Display API
      // 3. Handle rate limiting and authentication properly

      // Fallback implementation using URL parsing and basic metadata
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VideoLinkQueue/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch TikTok content: ${response.status}`);
      }

      const html = await response.text();
      
      // Extract basic metadata from HTML meta tags
      const title = this.extractFromMeta(html, 'og:title') || 'TikTok Video';
      const description = this.extractFromMeta(html, 'og:description') || '';
      const thumbnailUrl = this.extractFromMeta(html, 'og:image');
      const author = this.extractFromMeta(html, 'og:site_name');

      return {
        title: title.substring(0, 100),
        description,
        thumbnailUrl,
        author,
        platform: 'tiktok' as Platform,
        videoId,
      };
    });
  }

  private extractFromMeta(html: string, property: string): string | undefined {
    const regex = new RegExp(`<meta[^>]*(?:property|name)="${property}"[^>]*content="([^"]*)"`, 'i');
    const match = html.match(regex);
    return match ? match[1] : undefined;
  }
}

// Content extractor factory
export class ContentExtractorFactory {
  private static extractors: Map<Platform, ContentExtractor> = new Map([
    ['instagram', new InstagramExtractor()],
    ['youtube', new YouTubeExtractor()],
    ['tiktok', new TikTokExtractor()],
  ]);

  static getExtractor(platform: Platform): ContentExtractor {
    const extractor = this.extractors.get(platform);
    if (!extractor) {
      throw new Error(`No extractor available for platform: ${platform}`);
    }
    return extractor;
  }

  static async extractMetadata(url: string, platform: Platform): Promise<VideoMetadata> {
    const extractor = this.getExtractor(platform);
    return extractor.extractMetadata(url);
  }

  static validateUrl(url: string, platform: Platform): boolean {
    const extractor = this.getExtractor(platform);
    return extractor.validateUrl(url);
  }

  static extractVideoId(url: string, platform: Platform): string | null {
    const extractor = this.getExtractor(platform);
    return extractor.extractVideoId(url);
  }

  static detectPlatform(url: string): Platform | null {
    for (const [platform, extractor] of this.extractors) {
      if (extractor.validateUrl(url)) {
        return platform;
      }
    }
    return null;
  }
}

// Error classes for better error handling
export class ContentExtractionError extends Error {
  constructor(
    message: string,
    public platform: Platform,
    public url: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ContentExtractionError';
  }
}

export class UnsupportedPlatformError extends Error {
  constructor(url: string) {
    super(`Unsupported platform for URL: ${url}`);
    this.name = 'UnsupportedPlatformError';
  }
}

export class InvalidUrlError extends Error {
  constructor(url: string, platform: Platform) {
    super(`Invalid ${platform} URL: ${url}`);
    this.name = 'InvalidUrlError';
  }
}