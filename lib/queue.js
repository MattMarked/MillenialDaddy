/**
 * Queue management utilities for MillenialDaddy
 * 
 * This module handles the content queue operations using Vercel KV.
 * It maintains a FIFO queue for processing and posting content.
 */

import { kv } from '@vercel/kv';

// Queue key prefixes
const QUEUE_PREFIX = 'content:queue:';
const PROCESSING_PREFIX = 'content:processing:';

/**
 * Add a new reel to the content queue
 * @param {Object} content - Content object to queue
 * @param {string} content.reelUrl - URL of the Instagram reel
 * @param {string} content.submittedBy - Instagram username of admin who submitted
 * @returns {Promise<string>} - Queue ID of the added content
 */
export async function addToQueue(content) {
  const timestamp = Date.now();
  const queueId = `${timestamp}-${Math.random().toString(36).substring(2, 15)}`;
  
  const queueItem = {
    ...content,
    queueId,
    status: 'pending',
    addedAt: timestamp,
    description: null,
    processedAt: null,
    postedAt: null,
    error: null
  };

  // Add to queue with timestamp as score for FIFO ordering
  await kv.zadd(QUEUE_PREFIX + 'items', {
    score: timestamp,
    member: queueId
  });

  // Store item data
  await kv.set(QUEUE_PREFIX + queueId, JSON.stringify(queueItem));

  return queueId;
}

/**
 * Get the next item from the queue
 * @returns {Promise<Object|null>} - Next queue item or null if queue is empty
 */
export async function getNextItem() {
  // Get oldest item by score
  const [queueId] = await kv.zrange(QUEUE_PREFIX + 'items', 0, 0);
  
  if (!queueId) return null;

  const item = await kv.get(QUEUE_PREFIX + queueId);
  return item ? JSON.parse(item) : null;
}

/**
 * Update an item in the queue
 * @param {string} queueId - ID of the queue item
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated queue item
 */
export async function updateQueueItem(queueId, updates) {
  const item = await kv.get(QUEUE_PREFIX + queueId);
  if (!item) throw new Error('Queue item not found');

  const updatedItem = {
    ...JSON.parse(item),
    ...updates,
    updatedAt: Date.now()
  };

  await kv.set(QUEUE_PREFIX + queueId, JSON.stringify(updatedItem));
  return updatedItem;
}

/**
 * Remove an item from the queue
 * @param {string} queueId - ID of the queue item to remove
 */
export async function removeFromQueue(queueId) {
  await kv.zrem(QUEUE_PREFIX + 'items', queueId);
  await kv.del(QUEUE_PREFIX + queueId);
}

/**
 * Mark an item as processing
 * @param {string} queueId - ID of the queue item
 */
export async function markAsProcessing(queueId) {
  await updateQueueItem(queueId, {
    status: 'processing',
    processedAt: Date.now()
  });
}

/**
 * Mark an item as posted
 * @param {string} queueId - ID of the queue item
 */
export async function markAsPosted(queueId) {
  await updateQueueItem(queueId, {
    status: 'posted',
    postedAt: Date.now()
  });
  await removeFromQueue(queueId);
}

/**
 * Mark an item as failed
 * @param {string} queueId - ID of the queue item
 * @param {Error} error - Error that occurred
 */
export async function markAsFailed(queueId, error) {
  await updateQueueItem(queueId, {
    status: 'failed',
    error: error.message
  });
}

/**
 * Get queue statistics
 * @returns {Promise<Object>} - Queue statistics
 */
export async function getQueueStats() {
  const queueSize = await kv.zcard(QUEUE_PREFIX + 'items');
  const items = await kv.zrange(QUEUE_PREFIX + 'items', 0, -1);
  
  const stats = {
    totalItems: queueSize,
    pendingItems: 0,
    processingItems: 0,
    failedItems: 0
  };

  for (const queueId of items) {
    const item = await kv.get(QUEUE_PREFIX + queueId);
    if (item) {
      const { status } = JSON.parse(item);
      stats[status + 'Items']++;
    }
  }

  return stats;
}
