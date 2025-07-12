import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { getRedisClient } from '@/lib/redis-queue';
import { logger } from '@/lib/logger';

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  error?: string;
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const db = await getDatabase();
    await db.execute('SELECT 1');
    return {
      service: 'database',
      status: 'healthy',
      responseTime: Date.now() - start
    };
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const redis = await getRedisClient();
    await redis.ping();
    return {
      service: 'redis',
      status: 'healthy',
      responseTime: Date.now() - start
    };
  } catch (error) {
    return {
      service: 'redis',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkInstagramAPI(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Simple check - verify we have the required environment variables
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
    
    if (!accessToken || !accountId) {
      return {
        service: 'instagram',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: 'Missing Instagram API credentials'
      };
    }

    // For now, just check credentials exist
    // In production, you might want to make a lightweight API call
    return {
      service: 'instagram',
      status: 'healthy',
      responseTime: Date.now() - start
    };
  } catch (error) {
    return {
      service: 'instagram',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function persistHealthCheck(result: HealthCheckResult): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execute(`
      INSERT INTO health_checks (service, status, response_time_ms, error_message, checked_at)
      VALUES (?, ?, ?, ?, ?)
    `, [
      result.service,
      result.status,
      result.responseTime,
      result.error || null,
      new Date()
    ]);
  } catch (error) {
    // Don't fail health check if we can't persist it
    console.error('Failed to persist health check:', error);
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Run all health checks in parallel
    const [databaseHealth, redisHealth, instagramHealth] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkInstagramAPI()
    ]);

    const healthChecks = [databaseHealth, redisHealth, instagramHealth];
    
    // Persist health check results
    await Promise.all(healthChecks.map(persistHealthCheck));

    // Determine overall system status
    const hasUnhealthy = healthChecks.some(check => check.status === 'unhealthy');
    const hasDegraded = healthChecks.some(check => check.status === 'degraded');
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      services: healthChecks.reduce((acc, check) => {
        acc[check.service] = {
          status: check.status,
          responseTime: check.responseTime,
          error: check.error
        };
        return acc;
      }, {} as Record<string, any>)
    };

    // Log health check results
    await logger.info('Health check completed', {
      overallStatus,
      responseTime: response.responseTime,
      services: response.services
    }, 'health-check');

    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    return NextResponse.json(response, { status: statusCode });
    
  } catch (error) {
    await logger.logError(
      error instanceof Error ? error : new Error('Unknown health check error'),
      'Health check failed',
      {},
      'health-check'
    );

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: 'Health check system failure'
      },
      { status: 500 }
    );
  }
}