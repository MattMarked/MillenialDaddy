import { NextRequest, NextResponse } from 'next/server';
import { PublicationScheduler } from '@/lib/scheduler';
import { validateAdmin } from '@/lib/auth';

/**
 * POST /api/publication/schedule
 * Manually trigger publication or get publication stats
 */
export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail || !(await validateAdmin(adminEmail))) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const action = body.action;

    if (action === 'trigger') {
      // Manually trigger publication
      const result = await PublicationScheduler.manualPublish();
      
      return NextResponse.json({
        success: result.success,
        message: result.message,
        error: result.error
      });
    } else if (action === 'execute') {
      // Execute scheduled publication check
      const result = await PublicationScheduler.executeScheduledPublication();
      
      return NextResponse.json({
        success: result.success,
        message: result.message,
        published: result.published,
        error: result.error
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "trigger" or "execute"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in publication schedule endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process publication request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/publication/schedule
 * Get publication statistics and schedule information
 */
export async function GET(request: NextRequest) {
  try {
    // Validate admin authentication
    const adminEmail = request.headers.get('x-admin-email');
    if (!adminEmail || !(await validateAdmin(adminEmail))) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    const stats = await PublicationScheduler.getPublicationStats();

    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching publication stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch publication statistics' },
      { status: 500 }
    );
  }
}