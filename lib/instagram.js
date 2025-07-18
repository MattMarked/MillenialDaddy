/**
 * Instagram API integration utilities for MillenialDaddy
 * 
 * This module handles all interactions with the Instagram Graph API,
 * including webhook handling, DM processing, and content posting.
 */

import axios from 'axios';

const INSTAGRAM_API_VERSION = 'v17.0';
const BASE_URL = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`;

/**
 * Verify webhook request from Instagram
 * @param {Object} query - Query parameters from webhook request
 * @returns {boolean} - True if verification is successful
 */
export function verifyWebhook(query) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return challenge;
  }
  
  throw new Error('Invalid webhook verification token');
}

/**
 * Process incoming DM webhook event
 * @param {Object} event - Webhook event data
 * @returns {Promise<Object>} - Processed message data
 */
export async function processDMWebhook(event) {
  try {
    const { sender, message } = event.messaging[0];
    
    // Extract reel URL from message
    const reelUrl = extractReelUrl(message.text);
    if (!reelUrl) {
      throw new Error('No reel URL found in message');
    }

    return {
      senderId: sender.id,
      username: await getInstagramUsername(sender.id),
      reelUrl,
      timestamp: event.time
    };
  } catch (error) {
    console.error('Error processing DM webhook:', error);
    throw error;
  }
}

/**
 * Extract reel URL from message text
 * @param {string} text - Message text
 * @returns {string|null} - Extracted reel URL or null
 */
function extractReelUrl(text) {
  const urlRegex = /(https:\/\/(?:www\.)?instagram\.com\/reel\/[A-Za-z0-9_-]+\/?)/i;
  const match = text.match(urlRegex);
  return match ? match[1] : null;
}

/**
 * Get Instagram username from user ID
 * @param {string} userId - Instagram user ID
 * @returns {Promise<string>} - Instagram username
 */
async function getInstagramUsername(userId) {
  try {
    const response = await axios.get(`${BASE_URL}/${userId}`, {
      params: {
        fields: 'username',
        access_token: process.env.INSTAGRAM_ACCESS_TOKEN
      }
    });
    return response.data.username;
  } catch (error) {
    console.error('Error getting Instagram username:', error);
    throw error;
  }
}

/**
 * Post content to Instagram
 * @param {Object} content - Content to post
 * @param {string} content.reelUrl - URL of the reel to share
 * @param {string} content.description - Caption for the post
 * @returns {Promise<Object>} - Post response data
 */
export async function postToInstagram(content) {
  try {
    // First, create a container for the reel
    const containerResponse = await axios.post(`${BASE_URL}/me/media`, {
      video_url: content.reelUrl,
      caption: content.description,
      access_token: process.env.INSTAGRAM_ACCESS_TOKEN
    });

    const containerId = containerResponse.data.id;

    // Then publish the container
    const publishResponse = await axios.post(`${BASE_URL}/me/media_publish`, {
      creation_id: containerId,
      access_token: process.env.INSTAGRAM_ACCESS_TOKEN
    });

    return publishResponse.data;
  } catch (error) {
    console.error('Error posting to Instagram:', error);
    throw error;
  }
}

/**
 * Validate Instagram API configuration
 * @returns {Promise<boolean>} - True if configuration is valid
 */
export async function validateInstagramConfig() {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) return false;

  try {
    const response = await axios.get(`${BASE_URL}/me`, {
      params: {
        fields: 'id,username',
        access_token: process.env.INSTAGRAM_ACCESS_TOKEN
      }
    });
    return !!response.data.id;
  } catch (error) {
    console.error('Instagram validation error:', error);
    return false;
  }
}

/**
 * Subscribe to webhook notifications
 * @returns {Promise<boolean>} - True if subscription is successful
 */
export async function subscribeToWebhooks() {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/${INSTAGRAM_API_VERSION}/${process.env.INSTAGRAM_APP_ID}/subscriptions`,
      {
        object: 'instagram',
        callback_url: `${process.env.VERCEL_URL}/api/webhook/instagram`,
        fields: ['messages'],
        verify_token: process.env.WEBHOOK_VERIFY_TOKEN,
        access_token: `${process.env.INSTAGRAM_APP_ID}|${process.env.INSTAGRAM_APP_SECRET}`
      }
    );
    return response.data.success === true;
  } catch (error) {
    console.error('Error subscribing to webhooks:', error);
    return false;
  }
}
