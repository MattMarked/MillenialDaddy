import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const db = await getDatabase();

    // Build query based on log level filter
    let whereClause = '';
    const params: any[] = [];

    if (level !== 'all') {
      whereClause = 'WHERE level = ?';
      params.push(level);
    }

    const [logs] = await db.execute(`
      SELECT 
        id,
        level,
        message,
        context,
        created_at
      FROM system_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    // Get total count for pagination
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM system_logs
      ${whereClause}
    `, params);

    const total = countResult[0]?.total || 0;

    return NextResponse.json({
      logs: logs || [],
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch logs',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}