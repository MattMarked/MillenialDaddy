/**
 * Instagram webhook endpoint for MillenialDaddy
 * 
 * This endpoint handles:
 * 1. Webhook verification from Instagram
 * 2. Processing incoming DM notifications
 * 3. Adding valid reel submissions to the queue
 */

import { verifyWebhook, processDMWebhook } from '../../../lib/instagram';
import { isAdmin } from '../../../lib/admin';
import { addToQueue } from '../../../lib/queue';

export default async function handler(req, res) {
  // Handle webhook verification
  if (req.method === 'GET') {
    try {
      const challenge = verifyWebhook(req.query);
      return res.status(200).send(challenge);
    } catch (error) {
      console.error('Webhook verification failed:', error);
      return res.status(403).json({ error: 'Invalid verification token' });
    }
  }

  // Handle webhook events
  if (req.method === 'POST') {
    try {
      // Process the webhook event
      const messageData = await processDMWebhook(req.body);
      
      // Validate admin permissions
      if (!isAdmin(messageData.username)) {
        console.log(`Unauthorized submission attempt from ${messageData.username}`);
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Add content to queue
      const queueId = await addToQueue({
        reelUrl: messageData.reelUrl,
        submittedBy: messageData.username,
        submittedAt: messageData.timestamp
      });

      console.log(`Added reel to queue with ID: ${queueId}`);
      return res.status(200).json({ success: true, queueId });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Handle unsupported methods
  return res.status(405).json({ error: 'Method not allowed' });
}

// Configure larger payload size for video content
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};
