// AI-powered content analysis using OpenAI API
import OpenAI from 'openai';
import { config } from './config';
import { VideoMetadata } from './content-extractors';
import { ProcessedContent } from '@/types';

export interface ContentAnalysisResult {
  description: string;
  hashtags: string[];
  citation: string;
  enhancedTitle?: string;
}

export interface AIAnalysisConfig {
  maxDescriptionLength: number;
  minDescriptionLength: number;
  maxHashtags: number;
  minHashtags: number;
  temperature: number;
  maxTokens: number;
}

export class AIContentAnalyzer {
  private openai: OpenAI;
  private config: AIAnalysisConfig;

  constructor(analysisConfig?: Partial<AIAnalysisConfig>) {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });

    this.config = {
      maxDescriptionLength: 150,
      minDescriptionLength: 50,
      maxHashtags: 5,
      minHashtags: 2,
      temperature: 0.7,
      maxTokens: 300,
      ...analysisConfig,
    };
  }

  async analyzeContent(metadata: VideoMetadata): Promise<ContentAnalysisResult> {
    try {
      const prompt = this.buildAnalysisPrompt(metadata);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI API');
      }

      return this.parseAIResponse(response, metadata);
    } catch (error) {
      console.error('AI content analysis failed:', error);
      // Fallback to basic analysis
      return this.generateFallbackAnalysis(metadata);
    }
  }

  private getSystemPrompt(): string {
    return `You are a social media content curator specializing in creating engaging descriptions and hashtags for video content. Your task is to analyze video metadata and create:

1. A concise, engaging description (${this.config.minDescriptionLength}-${this.config.maxDescriptionLength} characters)
2. ${this.config.minHashtags}-${this.config.maxHashtags} relevant hashtags
3. A proper citation for the original source

Guidelines:
- Keep descriptions punchy and engaging
- Use hashtags that are popular but not overly generic
- Include platform-specific hashtags when relevant
- Maintain a positive, enthusiastic tone
- Focus on the content's value or entertainment factor

Format your response as JSON:
{
  "description": "Your engaging description here",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "citation": "Credit: @username on Platform"
}`;
  }

  private buildAnalysisPrompt(metadata: VideoMetadata): string {
    const platformInfo = this.getPlatformContext(metadata.platform);
    
    return `Analyze this ${metadata.platform} video and create engaging social media content:

Title: ${metadata.title}
Description: ${metadata.description || 'No description available'}
Author: ${metadata.author || 'Unknown'}
Platform: ${metadata.platform}
Duration: ${metadata.duration ? `${metadata.duration} seconds` : 'Unknown'}
Views: ${metadata.viewCount || 'Unknown'}

${platformInfo}

Create content that would work well for Instagram posts and stories. Focus on what makes this video interesting or valuable to viewers.`;
  }

  private getPlatformContext(platform: string): string {
    const contexts = {
      youtube: 'This is YouTube content, often educational or entertainment-focused with longer form content.',
      instagram: 'This is Instagram content, typically visual and lifestyle-oriented.',
      tiktok: 'This is TikTok content, usually short-form, trendy, and highly engaging.',
    };

    return contexts[platform as keyof typeof contexts] || '';
  }

  private parseAIResponse(response: string, metadata: VideoMetadata): ContentAnalysisResult {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);
      
      return {
        description: this.validateDescription(parsed.description),
        hashtags: this.validateHashtags(parsed.hashtags),
        citation: this.validateCitation(parsed.citation, metadata),
      };
    } catch (error) {
      // If JSON parsing fails, try to extract information manually
      return this.extractFromText(response, metadata);
    }
  }

  private extractFromText(text: string, metadata: VideoMetadata): ContentAnalysisResult {
    // Extract description (first line or paragraph)
    const lines = text.split('\n').filter(line => line.trim());
    let description = lines[0] || metadata.title.substring(0, this.config.maxDescriptionLength);
    
    // Extract hashtags (look for #tags)
    const hashtagMatches = text.match(/#\w+/g) || [];
    let hashtags = hashtagMatches.slice(0, this.config.maxHashtags);
    
    // If no hashtags found, generate basic ones
    if (hashtags.length === 0) {
      hashtags = this.generateBasicHashtags(metadata);
    }

    return {
      description: this.validateDescription(description),
      hashtags: this.validateHashtags(hashtags),
      citation: this.generateCitation(metadata),
    };
  }

  private validateDescription(description: string): string {
    if (!description || description.length < this.config.minDescriptionLength) {
      return 'Check out this amazing video content!';
    }
    
    if (description.length > this.config.maxDescriptionLength) {
      return description.substring(0, this.config.maxDescriptionLength - 3) + '...';
    }
    
    return description;
  }

  private validateHashtags(hashtags: string[]): string[] {
    if (!Array.isArray(hashtags)) {
      return ['#video', '#content'];
    }

    // Clean and validate hashtags
    const cleanHashtags = hashtags
      .map(tag => {
        // Remove # if present, clean the tag
        const cleanTag = tag.replace(/^#/, '').replace(/[^a-zA-Z0-9_]/g, '');
        return cleanTag ? `#${cleanTag}` : null;
      })
      .filter(Boolean)
      .filter(tag => /^#[a-zA-Z0-9_]+$/.test(tag))
      .slice(0, this.config.maxHashtags);

    // Ensure minimum number of hashtags
    while (cleanHashtags.length < this.config.minHashtags) {
      const defaultTags = ['#video', '#content', '#viral', '#trending', '#amazing'];
      const missingTag = defaultTags.find(tag => !cleanHashtags.includes(tag));
      if (missingTag) {
        cleanHashtags.push(missingTag);
      } else {
        break;
      }
    }

    return cleanHashtags;
  }

  private validateCitation(citation: string, metadata: VideoMetadata): string {
    if (citation && citation.length > 10) {
      return citation;
    }
    
    return this.generateCitation(metadata);
  }

  private generateCitation(metadata: VideoMetadata): string {
    const author = metadata.author || 'Unknown Creator';
    const platformNames = {
      youtube: 'YouTube',
      instagram: 'Instagram',
      tiktok: 'TikTok',
    };
    const platform = platformNames[metadata.platform] || metadata.platform.charAt(0).toUpperCase() + metadata.platform.slice(1);
    
    return `Credit: ${author} on ${platform}`;
  }

  private generateBasicHashtags(metadata: VideoMetadata): string[] {
    const platformTags = {
      youtube: ['#YouTube', '#video'],
      instagram: ['#Instagram', '#Reel'],
      tiktok: ['#TikTok', '#viral'],
    };

    const baseTags = platformTags[metadata.platform] || ['#video'];
    const additionalTags = ['#content', '#trending'];

    return [...baseTags, ...additionalTags].slice(0, this.config.maxHashtags);
  }

  private generateFallbackAnalysis(metadata: VideoMetadata): ContentAnalysisResult {
    // Use the original description if available and within limits
    let description = metadata.description;
    if (!description || description.length < this.config.minDescriptionLength) {
      description = `Check out this amazing video content!`;
    } else if (description.length > this.config.maxDescriptionLength) {
      description = description.substring(0, this.config.maxDescriptionLength - 3) + '...';
    }

    return {
      description,
      hashtags: this.generateBasicHashtags(metadata),
      citation: this.generateCitation(metadata),
    };
  }

  // Content validation and sanitization
  sanitizeContent(content: string): string {
    // Remove potentially harmful content
    const sanitized = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[^\w\s#@.,!?-]/g, '') // Keep only safe characters
      .trim();

    return sanitized;
  }

  // Enhanced content processing
  async processVideoContent(metadata: VideoMetadata): Promise<ProcessedContent> {
    const analysis = await this.analyzeContent(metadata);
    
    return {
      id: crypto.randomUUID(),
      originalUrl: metadata.videoId, // This should be the full URL in practice
      platform: metadata.platform,
      title: metadata.title,
      description: this.sanitizeContent(analysis.description),
      tags: analysis.hashtags,
      citation: this.sanitizeContent(analysis.citation),
      thumbnailUrl: metadata.thumbnailUrl,
      processedAt: new Date(),
    };
  }
}

// Content analysis utilities
export class ContentAnalysisUtils {
  static isValidHashtag(hashtag: string): boolean {
    return /^#[a-zA-Z0-9_]+$/.test(hashtag);
  }

  static formatHashtags(hashtags: string[]): string {
    return hashtags
      .filter(ContentAnalysisUtils.isValidHashtag)
      .join(' ');
  }

  static truncateDescription(description: string, maxLength: number): string {
    if (description.length <= maxLength) {
      return description;
    }
    
    const truncated = description.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return (lastSpace > maxLength * 0.8 ? truncated.substring(0, lastSpace) : truncated) + '...';
  }

  static extractKeywords(text: string, maxKeywords = 5): string[] {
    // Simple keyword extraction (in production, you might use more sophisticated NLP)
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Count word frequency
    const wordCount = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Return most frequent words
    return Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxKeywords)
      .map(([word]) => word);
  }
}

// Export default analyzer instance
export const aiContentAnalyzer = new AIContentAnalyzer();