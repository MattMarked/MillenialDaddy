// Environment configuration and validation

export const config = {
  // Database
  database: {
    url: process.env.POSTGRES_URL || '',
    prismaUrl: process.env.POSTGRES_PRISMA_URL || '',
    nonPoolingUrl: process.env.POSTGRES_URL_NON_POOLING || '',
  },
  
  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  // Instagram API
  instagram: {
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
    accountId: process.env.INSTAGRAM_ACCOUNT_ID || '',
  },
  
  // YouTube API
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
  },
  
  // TikTok API
  tiktok: {
    clientKey: process.env.TIKTOK_CLIENT_KEY || '',
    clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
  },
  
  // OpenAI API
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  
  // Application
  app: {
    nextAuthSecret: process.env.NEXTAUTH_SECRET || '',
    nextAuthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    adminEmails: process.env.ADMIN_EMAILS?.split(',') || [],
  },
} as const;

// Validate required environment variables
export function validateConfig() {
  const requiredVars = [
    'POSTGRES_URL',
    'REDIS_URL',
    'INSTAGRAM_ACCESS_TOKEN',
    'INSTAGRAM_ACCOUNT_ID',
    'OPENAI_API_KEY',
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}