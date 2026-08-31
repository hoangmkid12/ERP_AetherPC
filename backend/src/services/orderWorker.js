require('dotenv').config();
const IORedis = require('ioredis');
const { PrismaClient } = require('@prisma/client');

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
    // idempotent DB checks
    const dbOrder = await prisma.order.findUnique({ where: { orderId } });
    if (!dbOrder) {
      console.warn('Order not found in DB, skipping processing:', orderId);
      return;
    }

    const alreadyProcessed = (dbOrder.paymentStatus === 'PAID' || (dbOrder.status && dbOrder.status !== 'PENDING'));
    if (alreadyProcessed) {
      console.log('Order already processed, skipping:', orderId);
      return;
    }

    // Simulate processing
    await new Promise((r) => setTimeout(r, 1000));

    const updated = await prisma.order.updateMany({
      where: { orderId, OR: [{ paymentStatus: null }, { paymentStatus: 'PENDING' }, { paymentStatus: '' }] },
      data: { paymentStatus: 'PAID', status: 'CONFIRMED', confirmedAt: new Date() },
    });

    if (updated.count === 0) {
      console.log('No update performed (order may have changed), orderId=', orderId);
    } else {
      console.log('Order processed and updated in DB:', orderId);
    }

    // Write history
    try {
      await prisma.orderStatusHistory.create({ data: { orderId, status: 'CONFIRMED', note: 'Processed by simplified queue worker' } });
    } catch (e) {
      console.warn('Failed to write status history', e.message);
    }

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

