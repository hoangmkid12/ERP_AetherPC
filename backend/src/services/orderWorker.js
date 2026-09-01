require('dotenv').config();
const IORedis = require('ioredis');
const { PrismaClient } = require('@prisma/client');
const { approveOrderIfReady } = require('./orderApprovalService');

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new IORedis(redisUrl);

// Lightweight lock implementation using SET NX PX + safe-release Lua script
async function acquireLock(key, ttlMs) {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ok = await connection.set(key, token, 'NX', 'PX', ttlMs);
  return ok ? token : null;
}

async function releaseLock(key, token) {
  const lua = `if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end`;
  try {
    await connection.eval(lua, 1, key, token);
  } catch (e) {
    // ignore
  }
}

async function handlePayload(payload) {
  const jobId = payload.jobId;
  const order = payload.order;
  const orderId = order.orderId || order.id || order.order_id;
  if (!orderId) {
    console.warn('Missing orderId in payload, skipping', jobId);
    return;
  }

  const lockKey = `locks:order:${orderId}`;
  const ttl = 30_000;
  const token = await acquireLock(lockKey, ttl);
  if (!token) {
    console.log('Could not acquire lock for', orderId, '- requeueing');
    await connection.rpush('orders:queue', JSON.stringify(payload));
    return;
  }

  try {
    const dbOrder = await prisma.order.findUnique({ where: { orderId } });
    if (!dbOrder) {
      console.warn('Order not found in DB, skipping processing:', orderId);
      return;
    }
    if (dbOrder.status !== 'PENDING') {
      console.log('Order already processed, skipping:', orderId);
      return;
    }

    // Real approval logic (stock check, atomic decrement, StockMovement, loyalty
    // points) shared with orderScheduler.js — this used to be a fake sleep() that
    // blindly marked the order CONFIRMED (and paymentStatus PAID) with no stock
    // check at all, so a real order with insufficient stock would have been
    // wrongly confirmed and oversold instead of falling back to AWAITING_STOCK.
    const result = await prisma.$transaction((tx) => approveOrderIfReady(tx, orderId, { noteSuffix: ' (hàng đợi Redis)' }));
    console.log(result ? `Order ${orderId} processed to status ${result.status}` : `Order ${orderId} no longer PENDING, skipped`);
  } finally {
    await releaseLock(lockKey, token).catch(() => {});
  }
}

async function runLoop() {
  console.log('Starting simplified Redis queue worker (orders:queue)');
  while (true) {
    try {
      const res = await connection.brpop('orders:queue', 5); // 5s timeout
      if (!res) continue; // timeout, loop
      const [, item] = res;
      let payload;
      try { payload = JSON.parse(item); } catch (e) { console.error('Invalid payload', e.message); continue; }
      await handlePayload(payload);
    } catch (e) {
      console.error('Worker loop error', e && e.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

runLoop().catch((e) => {
  console.error('Worker crashed', e && e.message);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  try { await connection.quit(); } catch (e) {}
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = { runLoop };

