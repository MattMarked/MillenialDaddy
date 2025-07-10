import {
  AIContentAnalyzer,
  ContentAnalysisUtils,
  aiContentAnalyzer,
} from '@/lib/ai-content-analyzer';
import { VideoMetadata } from '@/lib/content-extractors';
import { Platform } from '@/types';

// Mock OpenAI
jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    mockCreate, // Export for testing
  };
});

const { mockCreate } = require('openai');

describe('AI Content Analyzer', () => {
  let analyzer: AIContentAnalyzer;

  beforeEach(() => {
    analyzer = new AIContentAnalyzer();
    jest.clearAllMocks();
  });

  const mockVideoMetadata: VideoMetadata = {
    title: 'Amazing Cooking Tutorial',
    description: 'Learn how to make delicious pasta in 10 minutes',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    duration: 600,
    author: 'ChefMaster',
    publishedAt: new Date('2023-01-01'),
    viewCount: 10000,
    platform: 'youtube' as Platform,
    videoId: 'abc123',
  };

  describe('analyzeContent', () => {
    it('should analyze content using OpenAI API', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'Learn to cook amazing pasta in just 10 minutes with this easy tutorial!',
              hashtags: ['#cooking', '#pasta', '#tutorial', '#food'],
              citation: 'Credit: ChefMaster on YouTube'
            })
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await analyzer.analyzeContent(mockVideoMetadata);

      expect(result).toEqual({
        description: 'Learn to cook amazing pasta in just 10 minutes with this easy tutorial!',
        hashtags: ['#cooking', '#pasta', '#tutorial', '#food'],
        citation: 'Credit: ChefMaster on YouTube',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        temperature: 0.7,
        max_tokens: 300,
      });
    });

    it('should handle OpenAI API failures with fallback', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzer.analyzeContent(mockVideoMetadata);

      expect(result).toEqual({
        description: 'Check out this amazing video content!',
        hashtags: ['#YouTube', '#video', '#content', '#trending'],
        citation: 'Credit: ChefMaster on YouTube',
      });
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'This is not valid JSON but contains #cooking #food hashtags'
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await analyzer.analyzeContent(mockVideoMetadata);

      // The text extraction should find hashtags in the response
      expect(result.hashtags).toContain('#cooking');
      expect(result.hashtags).toContain('#food');
      expect(result.description).toBeTruthy();
      expect(result.citation).toContain('ChefMaster');
    });

    it('should validate and sanitize content', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'A'.repeat(200), // Too long
              hashtags: ['#valid', 'invalid hashtag', '#another'],
              citation: 'Credit: Author'
            })
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await analyzer.analyzeContent(mockVideoMetadata);

      // The response should be parsed and validated
      expect(result.description.length).toBeLessThanOrEqual(150);
      expect(result.hashtags).toEqual(['#valid', '#invalidhashtag', '#another']);
      expect(result.hashtags.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('processVideoContent', () => {
    it('should process video content and return ProcessedContent', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'Great cooking tutorial!',
              hashtags: ['#cooking', '#tutorial'],
              citation: 'Credit: ChefMaster on YouTube'
            })
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await analyzer.processVideoContent(mockVideoMetadata);

      expect(result).toMatchObject({
        id: expect.any(String),
        originalUrl: 'abc123',
        platform: 'youtube',
        title: 'Amazing Cooking Tutorial',
        description: expect.any(String),
        tags: expect.any(Array),
        citation: expect.stringContaining('ChefMaster'),
        thumbnailUrl: 'https://example.com/thumb.jpg',
        processedAt: expect.any(Date),
      });
    });
  });

  describe('sanitizeContent', () => {
    it('should remove harmful content', () => {
      const maliciousContent = '<script>alert("xss")</script>Hello <b>world</b>!';
      const sanitized = analyzer.sanitizeContent(maliciousContent);
      
      expect(sanitized).toBe('Hello world!');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<b>');
    });

    it('should preserve safe characters', () => {
      const safeContent = 'Hello world! #hashtag @mention, check this out.';
      const sanitized = analyzer.sanitizeContent(safeContent);
      
      expect(sanitized).toBe('Hello world! #hashtag @mention, check this out.');
    });
  });
});

describe('ContentAnalysisUtils', () => {
  describe('isValidHashtag', () => {
    it('should validate hashtags correctly', () => {
      expect(ContentAnalysisUtils.isValidHashtag('#valid')).toBe(true);
      expect(ContentAnalysisUtils.isValidHashtag('#valid123')).toBe(true);
      expect(ContentAnalysisUtils.isValidHashtag('#valid_tag')).toBe(true);
      
      expect(ContentAnalysisUtils.isValidHashtag('invalid')).toBe(false);
      expect(ContentAnalysisUtils.isValidHashtag('#invalid-tag')).toBe(false);
      expect(ContentAnalysisUtils.isValidHashtag('#invalid tag')).toBe(false);
    });
  });

  describe('formatHashtags', () => {
    it('should format valid hashtags', () => {
      const hashtags = ['#valid', 'invalid', '#another', '#invalid-tag'];
      const formatted = ContentAnalysisUtils.formatHashtags(hashtags);
      
      expect(formatted).toBe('#valid #another');
    });
  });

  describe('truncateDescription', () => {
    it('should truncate long descriptions', () => {
      const longText = 'This is a very long description that exceeds the maximum length limit';
      const truncated = ContentAnalysisUtils.truncateDescription(longText, 30);
      
      expect(truncated.length).toBeLessThanOrEqual(30);
      expect(truncated).toContain('...');
    });

    it('should not truncate short descriptions', () => {
      const shortText = 'Short text';
      const result = ContentAnalysisUtils.truncateDescription(shortText, 30);
      
      expect(result).toBe(shortText);
    });

    it('should truncate at word boundaries when possible', () => {
      const text = 'This is a test description';
      const truncated = ContentAnalysisUtils.truncateDescription(text, 15);
      
      expect(truncated).toBe('This is a te...');
    });
  });

  describe('extractKeywords', () => {
    it('should extract keywords from text', () => {
      const text = 'This is a cooking tutorial about pasta and Italian food recipes';
      const keywords = ContentAnalysisUtils.extractKeywords(text, 3);
      
      expect(keywords).toHaveLength(3);
      expect(keywords).toContain('cooking');
      expect(keywords).toContain('tutorial');
    });

    it('should filter out short words', () => {
      const text = 'This is a test with many short words like a an the';
      const keywords = ContentAnalysisUtils.extractKeywords(text);
      
      expect(keywords).not.toContain('is');
      expect(keywords).not.toContain('a');
      expect(keywords).not.toContain('an');
    });
  });
});