/**
 * Kiểm thử cô lập cache theo người dùng (chạy offline, Prisma giả).
 *
 *   node src/services/ai/benchmark/cache_isolation_test.js
 *
 * Hai shipper hỏi cùng một câu; câu trả lời (đã cache) của shipper A không được
 * trả cho shipper B. Lỗi này từng tồn tại: khoá cache chỉ tách theo người dùng khi
 * câu hỏi có cụm "của tôi", nên shipper B nhận nguyên danh sách đơn (kèm địa chỉ
 * khách) của shipper A.
 */
process.env.GEMINI_API_KEY = '';
const { executeActorIntent } = require('../actors');

// Prisma giả: danh sách đơn trả về phụ thuộc shipper trong điều kiện where
const ordersOf = (args) => {
  const sid = JSON.stringify(args || {}).match(/"assignedShipperId":(\d+)/)?.[1];
  return sid ? [{
    orderId: `ORD-CUA-SHIPPER-${sid}`, status: 'SHIPPED', totalAmount: 1000000,
    shippingAddress: `Nhà khách của shipper ${sid}`, customer: { name: `Khách ${sid}`, phone: '0900000000' },
    paymentMethod: 'COD', createdAt: new Date()
  }] : [];
};
const emptyResult = (m) => (/^(findUnique|findFirst)/.test(m) ? null : /count/i.test(m) ? 0 : /aggregate/.test(m) ? { _sum: {}, _count: 0 } : []);
const prisma = new Proxy({}, {
  get: (_, model) => {
    if (typeof model !== 'string') return undefined;
    if (model.startsWith('$')) return async () => [];
    return new Proxy({}, { get: (__, m) => async (args) => (model === 'order' && m === 'findMany' ? ordersOf(args) : emptyResult(String(m))) });
  }
});

const PROMPTS = ['hôm nay tôi phải giao mấy đơn', 'đơn nào tôi cần thu tiền mặt'];

(async () => {
  const log = console.log;
  console.log = () => {}; console.warn = () => {};
  let failed = 0;
  for (const q of PROMPTS) {
    const a = await executeActorIntent(q, 'DELIVERY', prisma, { id: 101, role: 'DELIVERY' }, { sessionId: 'A' });
    const b = await executeActorIntent(q, 'DELIVERY', prisma, { id: 202, role: 'DELIVERY' }, { sessionId: 'B' });
    const leak = /SHIPPER-101/.test(b?.text || '');
    if (leak) failed++;
    log(`${leak ? '❌ RÒ RỈ' : '✅ OK'} "${q}" | A thấy: ${(a?.text || '').match(/ORD-CUA-SHIPPER-\d+/)?.[0] || '-'} | B thấy: ${(b?.text || '').match(/ORD-CUA-SHIPPER-\d+/)?.[0] || '-'} (fromCache=${Boolean(b?.fromCache)})`);
  }
  log(failed ? `\n${failed} câu bị rò rỉ dữ liệu giữa người dùng` : '\nKhông rò rỉ dữ liệu giữa người dùng');
  process.exit(failed ? 1 : 0);
})();
