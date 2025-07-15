import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database';
import { getRedisClient } from '@/lib/redis-queue';

export async function GET(request: NextRequest) {
  try {
    const redis = await getRedisClient();

    // Get queue counts from Redis
    const inputQueueCount = await redis.lLen('input_queue');
    const readyToPublishQueueCount = await redis.lLen('ready_to_publish_queue');
    const failedQueueCount = await redis.lLen('failed_queue');

    // Get processing statistics from database
    const processingStats = await database.query(`
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        COUNT(CASE WHEN published_at IS NOT NULL THEN 1 END) as published_count
      FROM queue_items
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    // Get recent activity
    const recentActivity = await database.query(`
      SELECT 
        id,
        url,
        platform,
        status,
        created_at,
        processed_at,
        published_at
      FROM queue_items
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const status = {
      queues: {
        input: inputQueueCount,
        readyToPublish: readyToPublishQueueCount,
        failed: failedQueueCount
      },
      statistics: {
        last24Hours: processingStats.rows[0] || {
          total_items: 0,
          pending_count: 0,
          processing_count: 0,
          completed_count: 0,
          failed_count: 0,
          published_count: 0
        }
      },
      recentActivity: recentActivity.rows || [],
      timestamp: new Date().toISOString(),
      systemHealth: {
        database: 'healthy',
        redis: 'healthy',
        instagram: 'unknown' // Will be updated by health checks
      }
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error fetching monitoring status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch monitoring status',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}