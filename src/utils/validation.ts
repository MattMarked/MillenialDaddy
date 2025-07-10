import { z } from 'zod';

// Platform type
export type Platform = 'instagram' | 'youtube' | 'tiktok';

// URL validation regex patterns
export const URL_PATTERNS = {
  instagram: {
    reel: /^https:\/\/(www\.)?instagram\.com\/reel\/([A-Za-z0-9_-]+)\/?(\?.*)?$/,
    post: /^https:\/\/(www\.)?instagram\.com\/p\/([A-Za-z0-9_-]+)\/?(\?.*)?$/,
  },
  youtube: {
    watch: /^https:\/\/(www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})(&.*)?$/,
    short: /^https:\/\/youtu\.be\/([A-Za-z0-9_-]{11})(\?.*)?$/,
    shorts: /^https:\/\/(www\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{11})(\?.*)?$/,
  },
  tiktok: {
    video: /^https:\/\/(www\.)?tiktok\.com\/@([A-Za-z0-9_.]+)\/video\/(\d+)(\?.*)?$/,
    vm: /^https:\/\/vm\.tiktok\.com\/([A-Za-z0-9]+)\/?(\?.*)?$/,
  },
} as const;

// URL validation schemas
export const instagramReelSchema = z.string().regex(
  URL_PATTERNS.instagram.reel,
  'Invalid Instagram Reel URL'
);

export const youtubeVideoSchema = z.string().refine(
  (url) => {
    return (
      URL_PATTERNS.youtube.watch.test(url) ||
      URL_PATTERNS.youtube.short.test(url) ||
      URL_PATTERNS.youtube.shorts.test(url)
    );
  },
  { message: 'Invalid YouTube video URL' }
);

export const tiktokVideoSchema = z.string().refine(
  (url) => {
    return (
      URL_PATTERNS.tiktok.video.test(url) ||
      URL_PATTERNS.tiktok.vm.test(url)
    );
  },
  { message: 'Invalid TikTok video URL' }
);

// Combined video URL schema
export const videoUrlSchema = z.string().refine(
  (url) => {
    return (
      instagramReelSchema.safeParse(url).success ||
      youtubeVideoSchema.safeParse(url).success ||
      tiktokVideoSchema.safeParse(url).success
    );
  },
  {
    message: 'URL must be a valid Instagram Reel, YouTube video, or TikTok video',
  }
);

// Admin validation schema
export const adminSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  isActive: z.boolean().default(true),
});

// Link submission validation schema
export const linkSubmissionSchema = z.object({
  url: videoUrlSchema,
  submittedBy: z.string().email('Invalid admin email'),
});

// Publication config validation schema
export const publicationConfigSchema = z.object({
  frequency: z.enum(['daily', 'multiple-daily', 'every-x-days']),
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')),
  interval: z.number().min(1).optional(),
  timezone: z.string().min(1, 'Timezone is required'),
});

// URL parsing result interface
export interface ParsedUrl {
  platform: Platform;
  videoId: string;
  originalUrl: string;
  isValid: boolean;
  username?: string; // For TikTok
}

// Utility functions for URL parsing and validation
export function detectPlatform(url: string): Platform | null {
  if (instagramReelSchema.safeParse(url).success) return 'instagram';
  if (youtubeVideoSchema.safeParse(url).success) return 'youtube';
  if (tiktokVideoSchema.safeParse(url).success) return 'tiktok';
  return null;
}

export function extractInstagramVideoId(url: string): string | null {
  const reelMatch = url.match(URL_PATTERNS.instagram.reel);
  if (reelMatch) return reelMatch[2];
  
  const postMatch = url.match(URL_PATTERNS.instagram.post);
  if (postMatch) return postMatch[2];
  
  return null;
}

export function extractYouTubeVideoId(url: string): string | null {
  const watchMatch = url.match(URL_PATTERNS.youtube.watch);
  if (watchMatch) return watchMatch[2];
  
  const shortMatch = url.match(URL_PATTERNS.youtube.short);
  if (shortMatch) return shortMatch[1];
  
  const shortsMatch = url.match(URL_PATTERNS.youtube.shorts);
  if (shortsMatch) return shortsMatch[2];
  
  return null;
}

export function extractTikTokVideoId(url: string): { videoId: string; username?: string } | null {
  const videoMatch = url.match(URL_PATTERNS.tiktok.video);
  if (videoMatch) {
    return {
      videoId: videoMatch[3],
      username: videoMatch[2],
    };
  }
  
  const vmMatch = url.match(URL_PATTERNS.tiktok.vm);
  if (vmMatch) {
    return {
      videoId: vmMatch[1],
    };
  }
  
  return null;
}

export function extractVideoId(url: string): string | null {
  const platform = detectPlatform(url);
  
  switch (platform) {
    case 'instagram':
      return extractInstagramVideoId(url);
    case 'youtube':
      return extractYouTubeVideoId(url);
    case 'tiktok':
      const tiktokData = extractTikTokVideoId(url);
      return tiktokData?.videoId || null;
    default:
      return null;
  }
}

export function parseVideoUrl(url: string): ParsedUrl | null {
  const platform = detectPlatform(url);
  
  if (!platform) {
    return {
      platform: 'instagram', // fallback
      videoId: '',
      originalUrl: url,
      isValid: false,
    };
  }
  
  let videoId: string | null = null;
  let username: string | undefined;
  
  switch (platform) {
    case 'instagram':
      videoId = extractInstagramVideoId(url);
      break;
    case 'youtube':
      videoId = extractYouTubeVideoId(url);
      break;
    case 'tiktok':
      const tiktokData = extractTikTokVideoId(url);
      videoId = tiktokData?.videoId || null;
      username = tiktokData?.username;
      break;
  }
  
  return {
    platform,
    videoId: videoId || '',
    originalUrl: url,
    isValid: videoId !== null,
    username,
  };
}

export function validateVideoUrl(url: string): { isValid: boolean; error?: string; platform?: Platform } {
  try {
    const result = videoUrlSchema.safeParse(url);
    
    if (!result.success) {
      return {
        isValid: false,
        error: result.error.errors[0]?.message || 'Invalid URL format',
      };
    }
    
    const platform = detectPlatform(url);
    const videoId = extractVideoId(url);
    
    if (!platform || !videoId) {
      return {
        isValid: false,
        error: 'Unable to extract video ID from URL',
      };
    }
    
    return {
      isValid: true,
      platform,
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'URL validation failed',
    };
  }
}