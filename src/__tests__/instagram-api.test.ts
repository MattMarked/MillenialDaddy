// Unit tests for Instagram API integration

import { InstagramAPI, InstagramAPIError } from '../lib/instagram-api';
import { ProcessedContent, InstagramPost } from '../types';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock config
jest.mock('../lib/config', () => ({
  config: {
    instagram: {
      accessToken: 'test_access_token',
      accountId: 'test_account_id',
    },
  },
}));

describe('InstagramAPI', () => {
  let instagramAPI: InstagramAPI;
  let mockProcessedContent: ProcessedContent;
  let mockInstagramPost: InstagramPost;

  beforeEach(() => {
    instagramAPI = new InstagramAPI();
    mockFetch.mockClear();

    mockProcessedContent = {
      id: 'test-content-id',
      originalUrl: 'https://youtube.com/watch?v=test',
      platform: 'youtube',
      title: 'Test Video',
      description: 'This is a test video description',
      tags: ['test', 'video', 'content'],
      citation: 'Source: YouTube - Test Channel',
      thumbnailUrl: 'https://example.com/thumbnail.jpg',
      processedAt: new Date(),
    };

    mockInstagramPost = {
      content: mockProcessedContent,
      caption: 'This is a test video description\n\n📎 Source: YouTube - Test Channel\n\n#test #video #content',
      hashtags: ['#test', '#video', '#content'],
      storyContent: 'Test Video\n\n#test #video #content',
      postContent: 'This is a test video description\n\n📎 Source: YouTube - Test Channel\n\n#test #video #content',
    };
  });

  describe('constructor', () => {
    it('should initialize with valid credentials', () => {
      expect(instagramAPI).toBeInstanceOf(InstagramAPI);
    });

    it('should throw error with missing credentials', () => {
      // Mock empty credentials
      jest.doMock('../lib/config', () => ({
        config: {
          instagram: {
            accessToken: '',
            accountId: '',
          },
        },
      }));

      // Clear module cache and reimport
      jest.resetModules();
      const { InstagramAPI } = require('../lib/instagram-api');

      expect(() => {
        new InstagramAPI();
      }).toThrow('Instagram API credentials not configured');
    });
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      const mockTokenInfo = {
        app_id: 'test_app_id',
        type: 'USER',
        application: 'Test App',
        data_access_expires_at: Date.now() + 86400000,
        expires_at: Date.now() + 86400000,
        is_valid: true,
        scopes: ['instagram_basic', 'instagram_content_publish'],
        user_id: 'test_user_id',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockTokenInfo }),
      } as Response);

      const result = await instagramAPI.validateToken();
      expect(result).toEqual(mockTokenInfo);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('debug_token')
      );
    });

    it('should handle token validation error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: {
            message: 'Invalid token',
            code: 190,
            error_subcode: 463,
          },
        }),
      } as Response);

      await expect(instagramAPI.validateToken()).rejects.toThrow(InstagramAPIError);
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(instagramAPI.validateToken()).rejects.toThrow(InstagramAPIError);
    });
  });

  describe('postToFeed', () => {
    it('should post to Instagram feed successfully', async () => {
      // Mock media container creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test_creation_id' }),
      } as Response);

      // Mock media publishing
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test_post_id', permalink: 'https://instagram.com/p/test' }),
      } as Response);

      const result = await instagramAPI.postToFeed(mockInstagramPost);

      expect(result).toEqual({
        id: 'test_post_id',
        permalink: 'https://instagram.com/p/test',
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle media container creation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      await expect(instagramAPI.postToFeed(mockInstagramPost)).rejects.toThrow(InstagramAPIError);
    });

    it('should handle media publishing failure', async () => {
      // Mock successful media container creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test_creation_id' }),
      } as Response);

      // Mock failed media publishing
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      await expect(instagramAPI.postToFeed(mockInstagramPost)).rejects.toThrow(InstagramAPIError);
    });
  });

  describe('postToStory', () => {
    it('should post to Instagram story successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test_story_id' }),
      } as Response);

      const result = await instagramAPI.postToStory(mockInstagramPost);

      expect(result).toEqual({ id: 'test_story_id' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/media'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle story creation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      await expect(instagramAPI.postToStory(mockInstagramPost)).rejects.toThrow(InstagramAPIError);
    });

    it('should throw error for missing media URL', async () => {
      const postWithoutMedia = {
        ...mockInstagramPost,
        content: {
          ...mockInstagramPost.content,
          thumbnailUrl: undefined,
        },
      };

      await expect(instagramAPI.postToStory(postWithoutMedia)).rejects.toThrow(
        'Story posting requires media URL or image generation'
      );
    });
  });

  describe('getAccountInfo', () => {
    it('should get account info successfully', async () => {
      const mockAccountInfo = {
        id: 'test_account_id',
        username: 'test_username',
        account_type: 'BUSINESS',
        media_count: 42,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountInfo,
      } as Response);

      const result = await instagramAPI.getAccountInfo();
      expect(result).toEqual(mockAccountInfo);
    });

    it('should handle account info error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      } as Response);

      await expect(instagramAPI.getAccountInfo()).rejects.toThrow(InstagramAPIError);
    });
  });

  describe('checkRateLimit', () => {
    it('should check rate limit successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['x-app-usage', '{"call_count":50,"total_cputime":10,"total_time":5}']]),
        json: async () => ({ id: 'test_account_id' }),
      } as any);

      const result = await instagramAPI.checkRateLimit();

      expect(result).toEqual({
        callsRemaining: 150, // 200 - 50
        timeWindow: 3600,
      });
    });

    it('should handle missing rate limit headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ id: 'test_account_id' }),
      } as any);

      const result = await instagramAPI.checkRateLimit();

      expect(result).toEqual({
        callsRemaining: 200,
        timeWindow: 3600,
      });
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await instagramAPI.withRetry(mockOperation, 3, 'test operation');

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on rate limit error', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new InstagramAPIError('Rate limited', 429))
        .mockResolvedValueOnce('success');

      // Mock setTimeout to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      const result = await instagramAPI.withRetry(mockOperation, 3, 'test operation');

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });

    it('should not retry on authentication error', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue(new InstagramAPIError('Unauthorized', 401));

      await expect(
        instagramAPI.withRetry(mockOperation, 3, 'test operation')
      ).rejects.toThrow('Unauthorized');

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue(new InstagramAPIError('Server error', 500));

      // Mock setTimeout to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      await expect(
        instagramAPI.withRetry(mockOperation, 2, 'test operation')
      ).rejects.toThrow('test operation failed after 3 attempts');

      expect(mockOperation).toHaveBeenCalledTimes(3);

      jest.restoreAllMocks();
    });
  });

  describe('InstagramAPIError', () => {
    it('should create error with all properties', () => {
      const error = new InstagramAPIError('Test error', 400, 'test_code', 123);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('test_code');
      expect(error.errorSubcode).toBe(123);
      expect(error.name).toBe('InstagramAPIError');
    });

    it('should create error with minimal properties', () => {
      const error = new InstagramAPIError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBeUndefined();
      expect(error.errorCode).toBeUndefined();
      expect(error.errorSubcode).toBeUndefined();
    });
  });
});