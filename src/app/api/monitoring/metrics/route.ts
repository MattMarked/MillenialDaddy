import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('range') || '24h';
    const operation = searchParams.get('operation');

    const db = await getDatabase();

    // Calculate time range
    let timeClause = '';
    switch (timeRange) {
      case '1h':
        timeClause = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)';
        break;
      case '24h':
        timeClause = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
        break;
      case '7d':
        timeClause = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case '30d':
        timeClause = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
      default:
        timeClause = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
    }

    // Add operation filter if specified
    if (operation) {
      timeClause += timeClause.includes('WHERE') ? ' AND' : ' WHERE';
      timeClause += ` operation = '${operation}'`;
    }

    // Get performance metrics
    const [performanceMetrics] = await db.execute(`
      SELECT 
        operation,
        COUNT(*) as count,
        AVG(duration_ms) as avg_duration,
        MIN(duration_ms) as min_duration,
        MAX(duration_ms) as max_duration,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as median_duration,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration
      FROM performance_metrics
      ${timeClause}
      GROUP BY operation
      ORDER BY count DESC
    `);

    // Get error rates from logs
    const [errorMetrics] = await db.execute(`
      SELECT 
        source,
        level,
        COUNT(*) as count
      FROM system_logs
      ${timeClause.replace('performance_metrics', 'system_logs')}
      WHERE level IN ('error', 'critical')
      GROUP BY source, level
      ORDER BY count DESC
    `);

    // Get queue processing metrics
    const [queueMetrics] = await db.execute(`
      SELECT 
        platform,
        status,
        COUNT(*) as count,
        AVG(TIMESTAMPDIFF(SECOND, created_at, COALESCE(processed_at, published_at, NOW()))) as avg_processing_time
      FROM queue_items
      ${timeClause.replace('performance_metrics', 'queue_items')}
      GROUP BY platform, status
      ORDER BY count DESC
    `);

    // Get hourly activity for charts
    const [hourlyActivity] = await db.execute(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour,
        COUNT(*) as items_processed,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM queue_items
      ${timeClause.replace('performance_metrics', 'queue_items')}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')
      ORDER BY hour DESC
      LIMIT 24
    `);

    const metrics = {
      timeRange,
      performance: performanceMetrics || [],
      errors: errorMetrics || [],
      queues: queueMetrics || [],
      activity: hourlyActivity || [],
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch metrics',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { operation, duration, context } = await request.json();

    if (!operation || typeof duration !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: operation, duration' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    await db.execute(`
      INSERT INTO performance_metrics (operation, duration_ms, context, created_at)
      VALUES (?, ?, ?, ?)
    `, [
      operation,
      duration,
      JSON.stringify(context || {}),
      new Date()
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording metric:', error);
    return NextResponse.json(
      { error: 'Failed to record metric' },
      { status: 500 }
    );
  }
}