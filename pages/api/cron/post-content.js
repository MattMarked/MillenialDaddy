/**
 * Scheduled content posting endpoint for MillenialDaddy
 * 
 * This endpoint is triggered by Vercel Cron every 30 minutes to:
 * 1. Check the content queue for pending items
 * 2. Generate AI descriptions for content
 * 3. Post content to Instagram
 * 4. Update queue status
 */

import { getNextItem, markAsProcessing, markAsPosted, markAsFailed } from '../../../lib/queue';
import { generateDescription } from '../../../lib/openai';
import { postToInstagram } from '../../../lib/instagram';

// Only allow this endpoint to be triggered by Vercel Cron
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req, res) {
  // Verify request is from Vercel Cron
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Check if auto-posting is enabled
    if (process.env.ENABLE_AUTO_POSTING !== 'true') {
      console.log('Auto-posting is disabled');
      return res.status(200).json({ status: 'disabled' });
    }

    // Get next item from queue
    const item = await getNextItem();
    if (!item) {
      console.log('No items in queue');
      return res.status(200).json({ status: 'empty' });
    }

    // Mark item as processing
    await markAsProcessing(item.queueId);
    console.log(`Processing queue item: ${item.queueId}`);

    // Generate description using OpenAI
    const description = await generateDescription({
      reelUrl: item.reelUrl,
      context: `This reel was submitted by ${item.submittedBy}`
    });

    // Post content to Instagram
    const postResult = await postToInstagram({
      reelUrl: item.reelUrl,
      description
    });

    // Mark item as posted
    await markAsPosted(item.queueId);

    console.log(`Successfully posted content: ${postResult.id}`);
    return res.status(200).json({
      status: 'success',
      queueId: item.queueId,
      postId: postResult.id
    });

  } catch (error) {
    console.error('Error in content posting cron:', error);

    // If we have a queue item, mark it as failed
    if (error.queueId) {
      await markAsFailed(error.queueId, error);
    }

    // Don't expose internal errors to response
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process content'
    });
  }
}

// Increase timeout for content processing
export const config = {
  maxDuration: 300 // 5 minutes
};
