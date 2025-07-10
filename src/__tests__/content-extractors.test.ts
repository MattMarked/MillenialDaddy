import {
  ContentExtractorFactory,
  InstagramExtractor,
  YouTubeExtractor,
  TikTokExtractor,
  ContentExtractionError,
  UnsupportedPlatformError,
  InvalidUrlError,
} from '@/lib/content-extractors';
import { Platform } from '@/types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Content Extractors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('InstagramExtractor', () => {
    const extractor = new InstagramExtractor();

    describe('validateUrl', () => {
      it('should validate Instagram reel URLs', () => {
        const validUrls = [
          'https://www.instagram.com/reel/ABC123/',
          'https://instagram.com/reel/XYZ789/',
          'https://www.instagram.com/p/DEF456/',
          'http://instagram.com/reel/GHI012/',
        ];

        validUrls.forEach(url => {
          expect(extractor.validateUrl(url)).toBe(true);
        });
      });

      it('should reject invalid Instagram URLs', () => {
        const invalidUrls = [
          'https://youtube.com/watch?v=123',
          'https://instagram.com/user/',
          'https://instagram.com/',
          'not-a-url',
        ];

        invalidUrls.forEach(url => {
          expect(extractor.validateUrl(url)).toBe(false);
        });
      });
    });

    describe('extractVideoId', () => {
      it('should extract video ID from Instagram URLs', () => {
        expect(extractor.extractVideoId('https://www.instagram.com/reel/ABC123/')).toBe('ABC123');
        expect(extractor.extractVideoId('https://instagram.com/p/XYZ789/')).toBe('XYZ789');
      });

      it('should return null for invalid URLs', () => {
        expect(extractor.extractVideoId('https://youtube.com/watch?v=123')).toBeNull();
      });
    });

    describe('extractMetadata', () => {
      it('should extract metadata from Instagram API response', async () => {
        const mockResponse = {
          id: 'ABC123',
          caption: 'Test caption for Instagram reel',
          media_type: 'VIDEO',
          media_url: 'https://example.com/video.mp4',
          thumbnail_url: 'https://example.com/thumb.jpg',
          timestamp: '2023-01-01T12:00:00Z',
          username: 'testuser',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response);

        const metadata = await extractor.extractMetadata('https://www.instagram.com/reel/ABC123/');

        expect(metadata).toEqual({
          title: 'Test caption for Instagram reel',
          description: 'Test caption for Instagram reel',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          author: 'testuser',
          publishedAt: new Date('2023-01-01T12:00:00Z'),
          platform: 'instagram',
          videoId: 'ABC123',
        });
      });

      it('should handle API errors', async () => {
        // Mock all retry attempts to return the same error response
        const errorResponse = {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: jest.fn(),
        };
        
        mockFetch.mockResolvedValue(errorResponse);

        await expect(
          extractor.extractMetadata('https://www.instagram.com/reel/ABC123/')
        ).rejects.toThrow('Instagram API error: 404 Not Found');
      });
    });
  });

  describe('YouTubeExtractor', () => {
    const extractor = new YouTubeExtractor();

    describe('validateUrl', () => {
      it('should validate YouTube URLs', () => {
        const validUrls = [
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          'https://youtube.com/watch?v=dQw4w9WgXcQ',
          'https://youtu.be/dQw4w9WgXcQ',
          'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
        ];

        validUrls.forEach(url => {
          expect(extractor.validateUrl(url)).toBe(true);
        });
      });

      it('should reject invalid YouTube URLs', () => {
        const invalidUrls = [
          'https://instagram.com/reel/123',
          'https://youtube.com/channel/123',
          'https://youtube.com/',
          'not-a-url',
        ];

        invalidUrls.forEach(url => {
          expect(extractor.validateUrl(url)).toBe(false);
        });
      });
    });

    describe('extractVideoId', () => {
      it('should extract video ID from YouTube URLs', () => {
        expect(extractor.extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
        expect(extractor.extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      });

      it('should return null for invalid URLs', () => {
        expect(extractor.extractVideoId('https://instagram.com/reel/123')).toBeNull();
      });
    });

    describe('extractMetadata', () => {
      it('should extract metadata from YouTube API response', async () => {
        const mockResponse = {
          items: [{
            snippet: {
              title: 'Test YouTube Video',
              description: 'Test description',
              channelTitle: 'Test Channel',
              publishedAt: '2023-01-01T12:00:00Z',
              thumbnails: {
                high: { url: 'https://example.com/thumb.jpg' }
              }
            },
            statistics: {
              viewCount: '1000'
            },
            contentDetails: {
              duration: 'PT4M13S'
            }
          }]
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response);

        const metadata = await extractor.extractMetadata('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

        expect(metadata).toEqual({
          title: 'Test YouTube Video',
          description: 'Test description',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          duration: 253, // 4 minutes 13 seconds
          author: 'Test Channel',
          publishedAt: new Date('2023-01-01T12:00:00Z'),
          viewCount: 1000,
          platform: 'youtube',
          videoId: 'dQw4w9WgXcQ',
        });
      });
    });
  });

  describe('TikTokExtractor', () => {
    const extractor = new TikTokExtractor();

    describe('validateUrl', () => {
      it('should validate TikTok URLs', () => {
        const validUrls = [
          'https://www.tiktok.com/@user/video/1234567890',
          'https://tiktok.com/@user/video/1234567890',
          'https://vm.tiktok.com/ABC123',
          'http://www.tiktok.com/@user/video/1234567890',
        ];

        validUrls.forEach(url => {
          expect(extractor.validateUrl(url)).toBe(true);
        });
      });

      it('should reject invalid TikTok URLs', () => {
        const invalidUrls = [
          'https://youtube.com/watch?v=123',
          'https://tiktok.com/@user/',
          'https://tiktok.com/',
          'not-a-url',
        ];

        invalidUrls.forEach(url => {
          expect(extractor.validateUrl(url)).toBe(false);
        });
      });
    });

    describe('extractVideoId', () => {
      it('should extract video ID from TikTok URLs', () => {
        expect(extractor.extractVideoId('https://www.tiktok.com/@user/video/1234567890')).toBe('1234567890');
        expect(extractor.extractVideoId('https://vm.tiktok.com/ABC123')).toBe('ABC123');
      });

      it('should return null for invalid URLs', () => {
        expect(extractor.extractVideoId('https://youtube.com/watch?v=123')).toBeNull();
      });
    });
  });

  describe('ContentExtractorFactory', () => {
    describe('detectPlatform', () => {
      it('should detect platform from URL', () => {
        expect(ContentExtractorFactory.detectPlatform('https://www.instagram.com/reel/ABC123/')).toBe('instagram');
        expect(ContentExtractorFactory.detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube');
        expect(ContentExtractorFactory.detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
        expect(ContentExtractorFactory.detectPlatform('https://example.com/video')).toBeNull();
      });
    });

    describe('getExtractor', () => {
      it('should return correct extractor for platform', () => {
        expect(ContentExtractorFactory.getExtractor('instagram')).toBeInstanceOf(InstagramExtractor);
        expect(ContentExtractorFactory.getExtractor('youtube')).toBeInstanceOf(YouTubeExtractor);
        expect(ContentExtractorFactory.getExtractor('tiktok')).toBeInstanceOf(TikTokExtractor);
      });
    });

    describe('validateUrl', () => {
      it('should validate URLs for specific platforms', () => {
        expect(ContentExtractorFactory.validateUrl('https://www.instagram.com/reel/ABC123/', 'instagram')).toBe(true);
        expect(ContentExtractorFactory.validateUrl('https://www.youtube.com/watch?v=123', 'instagram')).toBe(false);
      });
    });
  });
});