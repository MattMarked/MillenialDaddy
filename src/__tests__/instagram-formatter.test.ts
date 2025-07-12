// Unit tests for Instagram content formatting

import { InstagramFormatter, formatForInstagram, validateInstagramPost } from '../lib/instagram-formatter';
import { ProcessedContent } from '../types';

describe('InstagramFormatter', () => {
  let mockProcessedContent: ProcessedContent;

  beforeEach(() => {
    mockProcessedContent = {
      id: 'test-content-id',
      originalUrl: 'https://youtube.com/watch?v=test',
      platform: 'youtube',
      title: 'Amazing Test Video',
      description: 'This is a comprehensive test video that demonstrates various features and capabilities.',
      tags: ['test', 'video', 'amazing content', 'tutorial', 'demo'],
      citation: 'Source: YouTube - Test Channel (@testchannel)',
      thumbnailUrl: 'https://example.com/thumbnail.jpg',
      processedAt: new Date(),
    };
  });

  describe('formatForInstagram', () => {
    it('should format content with default options', () => {
      const result = formatForInstagram(mockProcessedContent);

      expect(result.content).toBe(mockProcessedContent);
      expect(result.caption).toContain(mockProcessedContent.description);
      expect(result.caption).toContain(mockProcessedContent.citation);
      expect(result.hashtags).toEqual(['#test', '#video', '#amazingcontent', '#tutorial', '#demo']);
      expect(result.storyContent).toContain(mockProcessedContent.title);
      expect(result.postContent).toBe(result.caption);
    });

    it('should format content with custom options', () => {
      const options = {
        maxHashtags: 3,
        includeSourceCitation: false,
        maxCaptionLength: 100,
      };

      const result = formatForInstagram(mockProcessedContent, options);

      expect(result.hashtags).toHaveLength(3);
      expect(result.caption).not.toContain(mockProcessedContent.citation);
      expect(result.caption.length).toBeLessThanOrEqual(100);
    });

    it('should handle content without title', () => {
      const contentWithoutTitle = {
        ...mockProcessedContent,
        title: '',
      };

      const result = formatForInstagram(contentWithoutTitle);

      expect(result.storyContent).toContain(mockProcessedContent.description);
    });

    it('should handle content without description', () => {
      const contentWithoutDescription = {
        ...mockProcessedContent,
        description: '',
      };

      const result = formatForInstagram(contentWithoutDescription);

      expect(result.caption).toContain(mockProcessedContent.citation);
      expect(result.caption).not.toContain('This is a comprehensive');
    });
  });

  describe('formatHashtags', () => {
    it('should format hashtags correctly', () => {
      const tags = ['test', 'video content', 'amazing!', 'tutorial123', 'demo_test'];
      const result = InstagramFormatter['formatHashtags'](tags, 10);

      expect(result).toEqual(['#test', '#videocontent', '#amazing', '#tutorial123', '#demo_test']);
    });

    it('should limit hashtags to max count', () => {
      const tags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
      const result = InstagramFormatter['formatHashtags'](tags, 3);

      expect(result).toHaveLength(3);
      expect(result).toEqual(['#tag1', '#tag2', '#tag3']);
    });

    it('should filter out invalid hashtags', () => {
      const tags = ['', 'a', 'valid_tag', '123', 'another-tag'];
      const result = InstagramFormatter['formatHashtags'](tags, 10);

      expect(result).toEqual(['#valid_tag', '#123', '#anothertag']);
    });
  });

  describe('validateInstagramPost', () => {
    it('should validate a correct Instagram post', () => {
      const post = formatForInstagram(mockProcessedContent);
      const result = validateInstagramPost(post);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect caption too long', () => {
      const longContent = {
        ...mockProcessedContent,
        description: 'a'.repeat(2300),
      };
      // Format with no truncation to test validation
      const post = formatForInstagram(longContent, { maxCaptionLength: 3000 });
      const result = validateInstagramPost(post);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Caption exceeds Instagram limit of 2200 characters');
    });

    it('should detect too many hashtags', () => {
      const manyTags = Array.from({ length: 35 }, (_, i) => `tag${i}`);
      const contentWithManyTags = {
        ...mockProcessedContent,
        tags: manyTags,
      };
      // Format with no hashtag limit to test validation
      const post = formatForInstagram(contentWithManyTags, { maxHashtags: 35 });
      const result = validateInstagramPost(post);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Too many hashtags (Instagram limit is 30)');
    });

    it('should detect missing content', () => {
      const emptyContent = {
        ...mockProcessedContent,
        title: '',
        description: '',
      };
      const post = formatForInstagram(emptyContent);
      const result = validateInstagramPost(post);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Post must have either a title or description');
    });

    it('should detect invalid hashtag format', () => {
      const post = formatForInstagram(mockProcessedContent);
      post.hashtags = ['#valid', 'invalid', '#', '#123valid'];
      const result = validateInstagramPost(post);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid hashtag format');
    });
  });

  describe('formatStoryWithOverlay', () => {
    it('should format story with overlay', () => {
      const result = InstagramFormatter.formatStoryWithOverlay(mockProcessedContent, 'bottom');

      expect(result.text).toContain(mockProcessedContent.title);
      expect(result.position).toBe('bottom');
      expect(result.backgroundColor).toBe('rgba(0, 0, 0, 0.5)');
      expect(result.textColor).toBe('#FFFFFF');
    });

    it('should handle different overlay positions', () => {
      const positions: Array<'top' | 'middle' | 'bottom'> = ['top', 'middle', 'bottom'];

      positions.forEach(position => {
        const result = InstagramFormatter.formatStoryWithOverlay(mockProcessedContent, position);
        expect(result.position).toBe(position);
      });
    });
  });

  describe('createPostVariations', () => {
    it('should create multiple post variations', () => {
      const variations = InstagramFormatter.createPostVariations(mockProcessedContent, 3);

      expect(variations).toHaveLength(3);
      expect(variations[0].hashtags.length).not.toBe(variations[1].hashtags.length);
    });

    it('should create default number of variations', () => {
      const variations = InstagramFormatter.createPostVariations(mockProcessedContent);

      expect(variations).toHaveLength(2);
    });
  });

  describe('formatByPostType', () => {
    it('should format for feed post', () => {
      const result = InstagramFormatter.formatByPostType(mockProcessedContent, 'feed');

      expect(result.caption).toContain(mockProcessedContent.description);
      expect(result.caption).toContain(mockProcessedContent.citation);
    });

    it('should format for story post', () => {
      const result = InstagramFormatter.formatByPostType(mockProcessedContent, 'story');

      expect(result.caption).toBe(result.storyContent);
      expect(result.postContent).toBe(result.storyContent);
    });

    it('should format for reel post', () => {
      const result = InstagramFormatter.formatByPostType(mockProcessedContent, 'reel');

      expect(result.caption.length).toBeLessThan(200); // Shorter for reels
      expect(result.hashtags.length).toBeLessThanOrEqual(10);
    });

    it('should handle long description for reel', () => {
      const longContent = {
        ...mockProcessedContent,
        description: 'This is a very long description that should be truncated for reel posts because reels work better with shorter, punchier captions that grab attention quickly.',
      };

      const result = InstagramFormatter.formatByPostType(longContent, 'reel');

      expect(result.caption).toContain('...');
      expect(result.caption.split('\n')[0].length).toBeLessThanOrEqual(100);
    });
  });

  describe('extractAndFormatMentions', () => {
    it('should extract mentions from text', () => {
      const text = 'Check out @testuser and @another_user for great content!';
      const result = InstagramFormatter.extractAndFormatMentions(text);

      expect(result.mentions).toEqual(['testuser', 'another_user']);
      expect(result.text).toBe('Check out @testuser and @another_user for great content!');
    });

    it('should handle text without mentions', () => {
      const text = 'This is just regular text without any mentions.';
      const result = InstagramFormatter.extractAndFormatMentions(text);

      expect(result.mentions).toEqual([]);
      expect(result.text).toBe(text);
    });

    it('should remove duplicate mentions', () => {
      const text = 'Thanks @testuser and @testuser again!';
      const result = InstagramFormatter.extractAndFormatMentions(text);

      expect(result.mentions).toEqual(['testuser']);
    });
  });

  describe('optimizeHashtags', () => {
    it('should combine content and trending hashtags', () => {
      const trendingHashtags = ['trending1', 'trending2', '#trending3'];
      const result = InstagramFormatter.optimizeHashtags(mockProcessedContent, trendingHashtags);

      expect(result).toContain('#test');
      expect(result).toContain('#trending1');
      expect(result).toContain('#trending2');
      expect(result).toContain('#trending3');
    });

    it('should limit to 30 hashtags', () => {
      const manyTrending = Array.from({ length: 40 }, (_, i) => `trending${i}`);
      const result = InstagramFormatter.optimizeHashtags(mockProcessedContent, manyTrending);

      expect(result.length).toBeLessThanOrEqual(30);
    });

    it('should remove duplicates', () => {
      const trendingHashtags = ['test', 'video', 'unique1', 'unique2'];
      const result = InstagramFormatter.optimizeHashtags(mockProcessedContent, trendingHashtags);

      const testCount = result.filter(tag => tag === '#test').length;
      const videoCount = result.filter(tag => tag === '#video').length;

      expect(testCount).toBe(1);
      expect(videoCount).toBe(1);
    });

    it('should handle empty trending hashtags', () => {
      const result = InstagramFormatter.optimizeHashtags(mockProcessedContent, []);

      expect(result).toEqual(['#test', '#video', '#amazingcontent', '#tutorial', '#demo']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty tags array', () => {
      const contentWithoutTags = {
        ...mockProcessedContent,
        tags: [],
      };

      const result = formatForInstagram(contentWithoutTags);

      expect(result.hashtags).toEqual([]);
      expect(result.caption).not.toContain('#');
    });

    it('should handle very long caption gracefully', () => {
      const veryLongContent = {
        ...mockProcessedContent,
        description: 'a'.repeat(3000),
        citation: 'b'.repeat(500),
      };

      const result = formatForInstagram(veryLongContent);

      expect(result.caption.length).toBeLessThanOrEqual(2200);
      expect(result.caption).toContain('...');
    });

    it('should handle special characters in tags', () => {
      const contentWithSpecialTags = {
        ...mockProcessedContent,
        tags: ['test@#$%', 'video!', 'content&more', 'normal_tag'],
      };

      const result = formatForInstagram(contentWithSpecialTags);

      expect(result.hashtags).toEqual(['#test', '#video', '#contentmore', '#normal_tag']);
    });

    it('should handle missing citation', () => {
      const contentWithoutCitation = {
        ...mockProcessedContent,
        citation: '',
      };

      const result = formatForInstagram(contentWithoutCitation);

      expect(result.caption).not.toContain('📎');
      expect(result.caption).toContain(mockProcessedContent.description);
    });
  });
});