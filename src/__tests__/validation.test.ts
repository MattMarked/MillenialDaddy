import {
  detectPlatform,
  videoUrlSchema,
  extractInstagramVideoId,
  extractYouTubeVideoId,
  extractTikTokVideoId,
  extractVideoId,
  parseVideoUrl,
  validateVideoUrl,
} from '@/utils/validation';

describe('URL Validation and Parsing', () => {
  describe('detectPlatform', () => {
    it('should detect Instagram Reel URLs', () => {
      expect(detectPlatform('https://www.instagram.com/reel/ABC123/')).toBe('instagram');
      expect(detectPlatform('https://instagram.com/reel/ABC123')).toBe('instagram');
      expect(detectPlatform('https://www.instagram.com/reel/ABC123/?utm_source=ig_web_copy_link')).toBe('instagram');
    });

    it('should detect YouTube video URLs', () => {
      expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube');
      expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
      expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube');
      expect(detectPlatform('https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s')).toBe('youtube');
    });

    it('should detect TikTok video URLs', () => {
      expect(detectPlatform('https://www.tiktok.com/@username/video/1234567890')).toBe('tiktok');
      expect(detectPlatform('https://tiktok.com/@user.name/video/1234567890')).toBe('tiktok');
      expect(detectPlatform('https://vm.tiktok.com/ZMeABC123/')).toBe('tiktok');
    });

    it('should return null for invalid URLs', () => {
      expect(detectPlatform('https://example.com/invalid')).toBeNull();
      expect(detectPlatform('https://facebook.com/video/123')).toBeNull();
      expect(detectPlatform('not-a-url')).toBeNull();
    });
  });

  describe('extractInstagramVideoId', () => {
    it('should extract video ID from Instagram Reel URLs', () => {
      expect(extractInstagramVideoId('https://www.instagram.com/reel/ABC123/')).toBe('ABC123');
      expect(extractInstagramVideoId('https://instagram.com/reel/XYZ789')).toBe('XYZ789');
      expect(extractInstagramVideoId('https://www.instagram.com/reel/ABC123/?utm_source=ig_web_copy_link')).toBe('ABC123');
    });

    it('should extract video ID from Instagram Post URLs', () => {
      expect(extractInstagramVideoId('https://www.instagram.com/p/ABC123/')).toBe('ABC123');
      expect(extractInstagramVideoId('https://instagram.com/p/XYZ789')).toBe('XYZ789');
    });

    it('should return null for invalid Instagram URLs', () => {
      expect(extractInstagramVideoId('https://www.instagram.com/user/')).toBeNull();
      expect(extractInstagramVideoId('https://example.com/reel/ABC123')).toBeNull();
    });
  });

  describe('extractYouTubeVideoId', () => {
    it('should extract video ID from YouTube watch URLs', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s')).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from YouTube short URLs', () => {
      expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=30s')).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from YouTube Shorts URLs', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ?feature=share')).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid YouTube URLs', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/channel/UC123')).toBeNull();
      expect(extractYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    });
  });

  describe('extractTikTokVideoId', () => {
    it('should extract video ID and username from TikTok video URLs', () => {
      const result = extractTikTokVideoId('https://www.tiktok.com/@username/video/1234567890');
      expect(result).toEqual({
        videoId: '1234567890',
        username: 'username',
      });
    });

    it('should extract video ID from TikTok vm URLs', () => {
      const result = extractTikTokVideoId('https://vm.tiktok.com/ZMeABC123/');
      expect(result).toEqual({
        videoId: 'ZMeABC123',
      });
    });

    it('should handle usernames with dots and underscores', () => {
      const result = extractTikTokVideoId('https://www.tiktok.com/@user.name_123/video/9876543210');
      expect(result).toEqual({
        videoId: '9876543210',
        username: 'user.name_123',
      });
    });

    it('should return null for invalid TikTok URLs', () => {
      expect(extractTikTokVideoId('https://www.tiktok.com/@username')).toBeNull();
      expect(extractTikTokVideoId('https://example.com/@username/video/123')).toBeNull();
    });
  });

  describe('extractVideoId', () => {
    it('should extract video IDs from all supported platforms', () => {
      expect(extractVideoId('https://www.instagram.com/reel/ABC123/')).toBe('ABC123');
      expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractVideoId('https://www.tiktok.com/@username/video/1234567890')).toBe('1234567890');
    });

    it('should return null for invalid URLs', () => {
      expect(extractVideoId('https://example.com/invalid')).toBeNull();
      expect(extractVideoId('not-a-url')).toBeNull();
    });
  });

  describe('parseVideoUrl', () => {
    it('should parse Instagram URLs correctly', () => {
      const result = parseVideoUrl('https://www.instagram.com/reel/ABC123/');
      expect(result).toEqual({
        platform: 'instagram',
        videoId: 'ABC123',
        originalUrl: 'https://www.instagram.com/reel/ABC123/',
        isValid: true,
      });
    });

    it('should parse YouTube URLs correctly', () => {
      const result = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).toEqual({
        platform: 'youtube',
        videoId: 'dQw4w9WgXcQ',
        originalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        isValid: true,
      });
    });

    it('should parse TikTok URLs correctly', () => {
      const result = parseVideoUrl('https://www.tiktok.com/@username/video/1234567890');
      expect(result).toEqual({
        platform: 'tiktok',
        videoId: '1234567890',
        originalUrl: 'https://www.tiktok.com/@username/video/1234567890',
        isValid: true,
        username: 'username',
      });
    });

    it('should handle invalid URLs', () => {
      const result = parseVideoUrl('https://example.com/invalid');
      expect(result).toEqual({
        platform: 'instagram',
        videoId: '',
        originalUrl: 'https://example.com/invalid',
        isValid: false,
      });
    });
  });

  describe('validateVideoUrl', () => {
    it('should validate correct URLs', () => {
      expect(validateVideoUrl('https://www.instagram.com/reel/ABC123/')).toEqual({
        isValid: true,
        platform: 'instagram',
      });

      expect(validateVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
        isValid: true,
        platform: 'youtube',
      });

      expect(validateVideoUrl('https://www.tiktok.com/@username/video/1234567890')).toEqual({
        isValid: true,
        platform: 'tiktok',
      });
    });

    it('should reject invalid URLs with error messages', () => {
      const result = validateVideoUrl('https://example.com/invalid');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.platform).toBeUndefined();
    });

    it('should handle malformed URLs gracefully', () => {
      const result = validateVideoUrl('not-a-url');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('videoUrlSchema', () => {
    it('should validate all supported URL formats', () => {
      const validUrls = [
        'https://www.instagram.com/reel/ABC123/',
        'https://instagram.com/reel/ABC123',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://www.youtube.com/shorts/dQw4w9WgXcQ',
        'https://www.tiktok.com/@username/video/1234567890',
        'https://vm.tiktok.com/ZMeABC123/',
      ];

      validUrls.forEach(url => {
        expect(videoUrlSchema.safeParse(url).success).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'https://example.com/invalid',
        'https://facebook.com/video/123',
        'not-a-url',
        'https://www.instagram.com/user/',
        'https://www.youtube.com/channel/UC123',
      ];

      invalidUrls.forEach(url => {
        expect(videoUrlSchema.safeParse(url).success).toBe(false);
      });
    });
  });
});