require('dotenv').config();
const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new IORedis(redisUrl);

/**
 * Enqueue an order into a simple Redis list queue with dedupe marker.
 * Uses a marker key to avoid enqueueing duplicates within a TTL window.
 */
async function enqueueOrder(order) {
  const orderId = order.orderId || order.id || order.order_id;
  if (!orderId) throw new Error('order must include orderId');
  const jobId = `order:${orderId}`;
  const markerKey = `jobs:marker:${jobId}`;

  // Try to create marker key atomically; if it exists, skip enqueue
  const setResult = await connection.set(markerKey, '1', 'NX', 'EX', 60 * 60); // 1 hour TTL
  if (!setResult) {
    console.log('Job already queued or processed recently, skipping:', jobId);
    return null;
  }

  const payload = JSON.stringify({ jobId, order });
  await connection.lpush('orders:queue', payload);
  return { jobId };
}

module.exports = { enqueueOrder, redis: connection };

