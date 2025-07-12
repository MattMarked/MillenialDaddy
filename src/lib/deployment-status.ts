/**
 * Deployment Status Utilities
 * Provides information about the current deployment environment and status
 */

export interface DeploymentInfo {
  environment: 'development' | 'production' | 'preview';
  platform: 'vercel' | 'aws' | 'local' | 'unknown';
  version: string;
  buildTime: string;
  region?: string;
  commitSha?: string;
}

export interface SystemStatus {
  deployment: DeploymentInfo;
  services: {
    database: boolean;
    redis: boolean;
    instagram: boolean;
    openai: boolean;
  };
  queues: {
    input: number;
    readyToPublish: number;
    failed: number;
  };
}

/**
 * Get deployment information
 */
export function getDeploymentInfo(): DeploymentInfo {
  const environment = process.env.NODE_ENV === 'production' ? 'production' : 
                     process.env.VERCEL_ENV === 'preview' ? 'preview' : 'development';
  
  // Detect platform
  let platform: DeploymentInfo['platform'] = 'unknown';
  if (process.env.VERCEL) {
    platform = 'vercel';
  } else if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    platform = 'aws';
  } else if (environment === 'development') {
    platform = 'local';
  }

  return {
    environment,
    platform,
    version: process.env.npm_package_version || '0.1.0',
    buildTime: process.env.VERCEL_BUILD_TIME || new Date().toISOString(),
    region: process.env.VERCEL_REGION || process.env.AWS_REGION,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA
  };
}

/**
 * Check if required environment variables are configured
 */
export function checkEnvironmentConfiguration(): Record<string, boolean> {
  const requiredVars = {
    POSTGRES_URL: !!process.env.POSTGRES_URL,
    REDIS_URL: !!process.env.REDIS_URL,
    INSTAGRAM_ACCESS_TOKEN: !!process.env.INSTAGRAM_ACCESS_TOKEN,
    INSTAGRAM_ACCOUNT_ID: !!process.env.INSTAGRAM_ACCOUNT_ID,
    YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    ADMIN_EMAILS: !!process.env.ADMIN_EMAILS
  };

  return requiredVars;
}

/**
 * Get deployment readiness status
 */
export function getDeploymentReadiness(): {
  ready: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  
  const envConfig = checkEnvironmentConfiguration();
  
  // Check critical environment variables
  if (!envConfig.POSTGRES_URL) issues.push('Database connection not configured');
  if (!envConfig.REDIS_URL) issues.push('Redis connection not configured');
  if (!envConfig.NEXTAUTH_SECRET) issues.push('Authentication secret not configured');
  if (!envConfig.ADMIN_EMAILS) issues.push('Admin emails not configured');
  
  // Check optional but important variables
  if (!envConfig.INSTAGRAM_ACCESS_TOKEN) warnings.push('Instagram API not configured');
  if (!envConfig.YOUTUBE_API_KEY) warnings.push('YouTube API not configured');
  if (!envConfig.OPENAI_API_KEY) warnings.push('OpenAI API not configured');
  
  // Check Vercel-specific configuration
  const deploymentInfo = getDeploymentInfo();
  if (deploymentInfo.platform === 'vercel' && deploymentInfo.environment === 'production') {
    if (!process.env.VERCEL_URL) warnings.push('Vercel URL not available');
  }

  return {
    ready: issues.length === 0,
    issues,
    warnings
  };
}

/**
 * Generate deployment report for admin dashboard
 */
export function generateDeploymentReport(): {
  deployment: DeploymentInfo;
  configuration: Record<string, boolean>;
  readiness: ReturnType<typeof getDeploymentReadiness>;
  recommendations: string[];
} {
  const deployment = getDeploymentInfo();
  const configuration = checkEnvironmentConfiguration();
  const readiness = getDeploymentReadiness();
  
  const recommendations: string[] = [];
  
  // Generate recommendations based on current state
  if (deployment.platform === 'vercel' && deployment.environment === 'production') {
    recommendations.push('Monitor Vercel function execution times to stay within limits');
    recommendations.push('Set up Vercel Analytics for performance monitoring');
  }
  
  if (!configuration.INSTAGRAM_ACCESS_TOKEN) {
    recommendations.push('Configure Instagram API for automated publishing');
  }
  
  if (!configuration.OPENAI_API_KEY) {
    recommendations.push('Configure OpenAI API for content analysis');
  }
  
  if (readiness.warnings.length > 0) {
    recommendations.push('Address configuration warnings for full functionality');
  }

  return {
    deployment,
    configuration,
    readiness,
    recommendations
  };
}