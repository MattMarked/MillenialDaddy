import { NextRequest, NextResponse } from 'next/server';
import { QueueItemRepository, DatabaseError } from '@/lib/database';
import { linkSubmissionSchema, parseVideoUrl, validateVideoUrl } from '@/utils/validation';
import { validateAdminAuth, AuthenticationError, AuthorizationError } from '@/lib/auth';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication
    const auth = await validateAdminAuth(request);
    
    const body = await request.json();
    
    // Validate request body
    const validatedData = linkSubmissionSchema.parse({
      ...body,
      submittedBy: auth.email, // Use authenticated admin email
    });
    
    // Validate and parse the URL
    const urlValidation = validateVideoUrl(validatedData.url);
    if (!urlValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: urlValidation.error || 'Invalid video URL',
        },
        { status: 400 }
      );
    }
    
    const parsedUrl = parseVideoUrl(validatedData.url);
    if (!parsedUrl || !parsedUrl.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unable to parse video URL',
        },
        { status: 400 }
      );
    }
    
    // Check if URL already exists in queue
    const existingItems = await QueueItemRepository.findByQueueType('input');
    const urlExists = existingItems.some(item => item.url === validatedData.url);
    
    if (urlExists) {
      return NextResponse.json(
        {
          success: false,
          message: 'This video URL has already been submitted',
        },
        { status: 409 }
      );
    }
    
    // Create queue item
    const queueItem = await QueueItemRepository.create({
      url: validatedData.url,
      platform: parsedUrl.platform,
      submitted_by: validatedData.submittedBy,
      status: 'pending',
      queue_type: 'input',
      content: null,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Video link submitted successfully',
      queueId: queueItem.id,
      data: {
        id: queueItem.id,
        url: queueItem.url,
        platform: queueItem.platform,
        status: queueItem.status,
        submittedBy: queueItem.submitted_by,
        submittedAt: queueItem.created_at,
        videoId: parsedUrl.videoId,
        username: parsedUrl.username,
      },
    });
    
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 401 }
      );
    }
    
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 403 }
      );
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validation error',
          errors: error.errors,
        },
        { status: 400 }
      );
    }
    
    if (error instanceof DatabaseError) {
      console.error('Database error submitting link:', error);
      return NextResponse.json(
        {
          success: false,
          message: 'Database error occurred',
        },
        { status: 500 }
      );
    }
    
    console.error('Unexpected error submitting link:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Validate admin authentication
    await validateAdminAuth(request);
    
    // Get queue counts for monitoring
    const counts = await QueueItemRepository.getQueueCounts();
    
    // Get recent submissions (last 10)
    const recentItems = await QueueItemRepository.findByQueueType('input');
    const recentSubmissions = recentItems.slice(0, 10).map(item => ({
      id: item.id,
      url: item.url,
      platform: item.platform,
      status: item.status,
      submittedBy: item.submitted_by,
      submittedAt: item.created_at,
    }));
    
    return NextResponse.json({
      success: true,
      data: {
        queueCounts: counts,
        recentSubmissions,
      },
    });
    
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 401 }
      );
    }
    
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 403 }
      );
    }
    
    if (error instanceof DatabaseError) {
      console.error('Database error fetching queue status:', error);
      return NextResponse.json(
        {
          success: false,
          message: 'Database error occurred',
        },
        { status: 500 }
      );
    }
    
    console.error('Unexpected error fetching queue status:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      },
      { status: 500 }
    );
  }
}