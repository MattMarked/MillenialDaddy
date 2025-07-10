// Core types for the Video Link Queue Service

export interface Admin {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  lastActive?: Date;
}

export interface QueueItem {
  id: string;
  url: string;
  platform: 'instagram' | 'youtube' | 'tiktok';
  submittedBy: string;
  timestamp: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  queueType: 'input' | 'ready_to_publish';
  content?: ProcessedContent | null;
  processedAt?: Date | null;
  publishedAt?: Date | null;
}

export interface ProcessedContent {
  id: string;
  originalUrl: string;
  platform: string;
  title: string;
  description: string;
  tags: string[];
  citation: string;
  thumbnailUrl?: string;
  processedAt: Date;
}

export interface PublicationConfig {
  frequency: 'daily' | 'multiple-daily' | 'every-x-days';
  times: string[]; // HH:MM format
  interval?: number; // for every-x-days
  timezone: string;
}

export interface SystemConfig {
  publication: PublicationConfig;
  instagram: {
    accessToken: string;
    accountId: string;
  };
  processing: {
    maxRetries: number;
    timeoutMs: number;
  };
}

export interface LinkSubmissionRequest {
  url: string;
  submittedBy: string;
  timestamp: Date;
}

export interface LinkSubmissionResponse {
  success: boolean;
  queueId: string;
  message: string;
}

export interface InstagramPost {
  content: ProcessedContent;
  caption: string;
  hashtags: string[];
  storyContent: string;
  postContent: string;
}

// Queue-related enums and types
export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type QueueType = 'input' | 'ready_to_publish';
export type Platform = 'instagram' | 'youtube' | 'tiktok';

// Queue operation interfaces
export interface QueueOperationResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface QueueStats {
  input: number;
  ready_to_publish: number;
  failed: number;
  processing: number;
  total: number;
}

export interface QueueItemFactory {
  createQueueItem(data: {
    url: string;
    platform: Platform;
    submittedBy: string;
    queueType?: QueueType;
    status?: QueueStatus;
  }): QueueItem;
}

// Redis queue interfaces
export interface RedisQueueConfig {
  url: string;
  maxRetries: number;
  retryDelay: number;
  defaultTTL: number;
}

export interface QueueMessage {
  id: string;
  type: 'process' | 'publish' | 'retry';
  data: QueueItem;
  timestamp: Date;
  retryCount: number;
}