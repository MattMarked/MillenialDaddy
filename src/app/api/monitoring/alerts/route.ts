import { NextRequest, NextResponse } from 'next/server';
import { alerting } from '@/lib/alerting';
import { validateAdminAuth, AuthenticationError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    await validateAdminAuth(request);
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'active' | 'history' | null;
    const limit = parseInt(searchParams.get('limit') || '50');

    let alerts;
    if (type === 'history') {
      alerts = await alerting.getAlertHistory(limit);
    } else {
      alerts = await alerting.getActiveAlerts(limit);
    }

    return NextResponse.json({
      success: true,
      alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 }
      );
    }

    await logger.logError(
      error instanceof Error ? error : new Error('Unknown error'),
      'Error fetching alerts',
      {},
      'alerts-api'
    );

    return NextResponse.json(
      { success: false, message: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await validateAdminAuth(request);
    const { action, alertId } = await request.json();

    if (action === 'acknowledge' && alertId) {
      const success = await alerting.acknowledgeAlert(alertId, auth.email);
      
      if (success) {
        return NextResponse.json({
          success: true,
          message: 'Alert acknowledged successfully'
        });
      } else {
        return NextResponse.json(
          { success: false, message: 'Alert not found or already acknowledged' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { success: false, message: 'Invalid action or missing parameters' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 }
      );
    }

    await logger.logError(
      error instanceof Error ? error : new Error('Unknown error'),
      'Error managing alert',
      {},
      'alerts-api'
    );

    return NextResponse.json(
      { success: false, message: 'Failed to manage alert' },
      { status: 500 }
    );
  }
}