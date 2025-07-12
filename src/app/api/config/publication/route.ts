import { NextRequest, NextResponse } from 'next/server';
import { PublicationConfigManager } from '@/lib/publication-config';
import { validateAdmin } from '@/lib/auth';
import { PublicationConfig } from '@/types';

/**
 * GET /api/config/publication
 * Get current publication configuration
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

    const config = await PublicationConfigManager.getConfig();
    const nextPublicationTime = await PublicationConfigManager.getNextPublicationTime();

    return NextResponse.json({
      success: true,
      config,
      nextPublicationTime: nextPublicationTime?.toISOString() || null
    });
  } catch (error) {
    console.error('Error fetching publication config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch publication configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/config/publication
 * Update publication configuration
 */
export async function PUT(request: NextRequest) {
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
    const config: PublicationConfig = {
      frequency: body.frequency,
      times: body.times,
      interval: body.interval,
      timezone: body.timezone
    };

    const result = await PublicationConfigManager.updateConfig(config);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update configuration' },
        { status: 400 }
      );
    }

    // Get updated config and next publication time
    const updatedConfig = await PublicationConfigManager.getConfig();
    const nextPublicationTime = await PublicationConfigManager.getNextPublicationTime();

    return NextResponse.json({
      success: true,
      message: 'Publication configuration updated successfully',
      config: updatedConfig,
      nextPublicationTime: nextPublicationTime?.toISOString() || null
    });
  } catch (error) {
    console.error('Error updating publication config:', error);
    return NextResponse.json(
      { error: 'Failed to update publication configuration' },
      { status: 500 }
    );
  }
}