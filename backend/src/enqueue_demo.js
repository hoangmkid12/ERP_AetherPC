require('dotenv').config();
const { enqueueOrder } = require('./services/orderQueue');

async function demo() {
  const sample = {
    orderId: `ORD-${Date.now()}`,
    customerId: 'CUST-DEMO',
    totalAmount: '123.45',
    paymentMethod: 'CASH',
    shippingAddress: 'Demo address',
    shippingCity: 'DemoCity'
  };

  try {
    const job = await enqueueOrder(sample);
    console.log('Enqueued job id:', job.id || (job && job.jobId));
  } catch (e) {
    console.error('Failed to enqueue demo order', e && e.message);
  } finally {
    process.exit(0);
  }
}

demo();
