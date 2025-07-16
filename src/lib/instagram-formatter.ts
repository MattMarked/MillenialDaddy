// Content formatting utilities for Instagram posts and stories

import { ProcessedContent, InstagramPost } from '../types';

export interface InstagramFormattingOptions {
  maxCaptionLength?: number;
  maxHashtags?: number;
  includeSourceCitation?: boolean;
  storyTextMaxLength?: number;
}

export class InstagramFormatter {
  private static readonly DEFAULT_OPTIONS: Required<InstagramFormattingOptions> = {
    maxCaptionLength: 2200, // Instagram's caption limit
    maxHashtags: 30, // Instagram's hashtag limit
    includeSourceCitation: true,
    storyTextMaxLength: 150, // Reasonable limit for story text overlay
  };

  /**
   * Format processed content for Instagram posting
   */
  static formatForInstagram(
    content: ProcessedContent,
    options: InstagramFormattingOptions = {}
  ): InstagramPost {
    const opts = { ...InstagramFormatter.DEFAULT_OPTIONS, ...options };

    const hashtags = InstagramFormatter.formatHashtags(content.tags, opts.maxHashtags);
    const caption = InstagramFormatter.formatCaption(content, hashtags, opts);
    const storyContent = InstagramFormatter.formatStoryContent(content, opts);
    const postContent = InstagramFormatter.formatPostContent(content, hashtags, opts);

    return {
      content,
      caption,
      hashtags,
      storyContent,
      postContent,
    };
  }

  /**
   * Format hashtags with proper Instagram formatting
   */
  private static formatHashtags(tags: string[], maxHashtags: number): string[] {
    return tags
      .slice(0, maxHashtags)
      .map(tag => {
        // Remove spaces and special characters, keep only alphanumeric and underscores
        const cleanTag = tag.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        return cleanTag.length > 1 ? `#${cleanTag}` : null;
      })
      .filter((tag): tag is string => tag !== null);
  }

  /**
   * Format the main caption for Instagram posts
   */
  private static formatCaption(
    content: ProcessedContent,
    hashtags: string[],
    options: Required<InstagramFormattingOptions>
  ): string {
    let caption = '';

    // Add description
    if (content.description) {
      caption += content.description;
    }

    // Add source citation if enabled
    if (options.includeSourceCitation && content.citation) {
      caption += caption ? '\n\n' : '';
      caption += `📎 ${content.citation}`;
    }

    // Add hashtags
    if (hashtags.length > 0) {
      caption += caption ? '\n\n' : '';
      caption += hashtags.join(' ');
    }

    // Truncate if too long
    if (caption.length > options.maxCaptionLength) {
      const truncateAt = options.maxCaptionLength - 3; // Leave room for "..."
      caption = caption.substring(0, truncateAt).trim() + '...';
    }

    return caption;
  }

  /**
   * Format content specifically for Instagram stories
   */
  private static formatStoryContent(
    content: ProcessedContent,
    options: Required<InstagramFormattingOptions>
  ): string {
    let storyText = '';

    // Use title if available, otherwise use description
    if (content.title) {
      storyText = content.title;
    } else if (content.description) {
      storyText = content.description;
    }

    // Truncate for story display
    if (storyText.length > options.storyTextMaxLength) {
      const truncateAt = options.storyTextMaxLength - 3;
      storyText = storyText.substring(0, truncateAt).trim() + '...';
    }

    // Add a few relevant hashtags for stories
    const topHashtags = content.tags.slice(0, 3).map(tag => 
      `#${tag.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()}`
    ).filter(tag => tag.length > 1);

    if (topHashtags.length > 0) {
      storyText += storyText ? '\n\n' : '';
      storyText += topHashtags.join(' ');
    }

    return storyText;
  }

  /**
   * Format content specifically for Instagram feed posts
   */
  private static formatPostContent(
    content: ProcessedContent,
    hashtags: string[],
    options: Required<InstagramFormattingOptions>
  ): string {
    // For feed posts, use the full caption
    return InstagramFormatter.formatCaption(content, hashtags, options);
  }

  /**
   * Validate Instagram post content
   */
  static validateInstagramPost(post: InstagramPost): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check caption length
    if (post.caption.length > 2200) {
      errors.push('Caption exceeds Instagram limit of 2200 characters');
    }

    // Check hashtag count
    if (post.hashtags.length > 30) {
      errors.push('Too many hashtags (Instagram limit is 30)');
    }

    // Check for required content
    if (!post.content.description && !post.content.title) {
      errors.push('Post must have either a title or description');
    }

    // Validate hashtags format
    const invalidHashtags = post.hashtags.filter(tag => 
      !tag.startsWith('#') || tag.length < 2 || !/^#[a-zA-Z0-9_]+$/.test(tag)
    );
    if (invalidHashtags.length > 0) {
      errors.push(`Invalid hashtag format: ${invalidHashtags.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate story-specific formatting with text overlay positioning
   */
  static formatStoryWithOverlay(
    content: ProcessedContent,
    overlayPosition: 'top' | 'middle' | 'bottom' = 'bottom'
  ): {
    text: string;
    position: string;
    backgroundColor?: string;
    textColor?: string;
  } {
    const storyText = InstagramFormatter.formatStoryContent(content, InstagramFormatter.DEFAULT_OPTIONS);

    return {
      text: storyText,
      position: overlayPosition,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent black background
      textColor: '#FFFFFF', // White text
    };
  }

  /**
   * Create multiple post variations for A/B testing
   */
  static createPostVariations(
    content: ProcessedContent,
    variationCount: number = 2
  ): InstagramPost[] {
    const variations: InstagramPost[] = [];

    for (let i = 0; i < variationCount; i++) {
      const options: InstagramFormattingOptions = {
        maxHashtags: i === 0 ? 3 : 5, // Vary hashtag count
        includeSourceCitation: i % 2 === 0, // Alternate citation inclusion
      };

      variations.push(InstagramFormatter.formatForInstagram(content, options));
    }

    return variations;
  }

  /**
   * Format content for different Instagram post types
   */
  static formatByPostType(
    content: ProcessedContent,
    postType: 'feed' | 'story' | 'reel'
  ): InstagramPost {
    const basePost = InstagramFormatter.formatForInstagram(content);

    switch (postType) {
      case 'story':
        return {
          ...basePost,
          caption: basePost.storyContent,
          postContent: basePost.storyContent,
        };

      case 'reel':
        // Reels often benefit from shorter, punchier captions
        const shortCaption = content.description.length > 100 
          ? content.description.substring(0, 97) + '...'
          : content.description;
        
        return {
          ...basePost,
          caption: shortCaption + '\n\n' + basePost.hashtags.slice(0, 10).join(' '),
          postContent: shortCaption + '\n\n' + basePost.hashtags.slice(0, 10).join(' '),
        };

      case 'feed':
      default:
        return basePost;
    }
  }

  /**
   * Extract mentions from content and format them properly
   */
  static extractAndFormatMentions(text: string): {
    text: string;
    mentions: string[];
  } {
    const mentionRegex = /@([a-zA-Z0-9_.]+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    // Ensure mentions are properly formatted
    const formattedText = text.replace(mentionRegex, '@$1');

    return {
      text: formattedText,
      mentions: Array.from(new Set(mentions)), // Remove duplicates
    };
  }

  /**
   * Optimize hashtags based on content analysis
   */
  static optimizeHashtags(
    content: ProcessedContent,
    trendingHashtags: string[] = []
  ): string[] {
    const contentHashtags = InstagramFormatter.formatHashtags(content.tags, 20);
    const trending = trendingHashtags.slice(0, 10).map(tag => 
      tag.startsWith('#') ? tag : `#${tag}`
    );

    // Combine content-specific and trending hashtags
    const combined = [...contentHashtags, ...trending];
    
    // Remove duplicates and limit to 30
    const unique = Array.from(new Set(combined));
    return unique.slice(0, 30);
  }
}

// Export convenience functions
export const formatForInstagram = InstagramFormatter.formatForInstagram;
export const validateInstagramPost = InstagramFormatter.validateInstagramPost;
export const formatStoryWithOverlay = InstagramFormatter.formatStoryWithOverlay;