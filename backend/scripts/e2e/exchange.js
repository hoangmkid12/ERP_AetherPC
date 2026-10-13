// RMA exchange 1-1: delivered keyboard → defective → vendor shelf → replacement order ships with real stock-out.
const { as } = require('./api');
const step = (k, r, expectOk = true) => {
  const ok = expectOk ? r.status < 400 : r.status >= 400;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${k} [${r.status}] ${r.message || ''}`);
  if (!ok && expectOk) { console.log(String(r.stack || JSON.stringify(r)).slice(0, 500)); throw new Error('stop'); }
  return r.data;
};
(async () => {
  const CUS = as('customer', { customer: true }), SM = as('sales_manager'), W = as('warehouse'), SHIP = as('delivery'), CSKH = as('cskh'), QC = as('qc');
  const PID = '1069079528'; // AKKO TAC75
  const o = step('Customer orders keyboard (COD)', await CUS.post('/orders', { items: [{ productId: PID, quantity: 1 }], paymentMethod: 'COD', shippingAddress: '88 Võ Văn Tần, Phường Võ Thị Sáu, TP. Hồ Chí Minh' }));
  step('Sales confirms', await SM.patch(`/orders/${o.orderId}/status`, { status: 'CONFIRMED' }));
  step('Warehouse assigns shipper', await W.patch(`/orders/${o.orderId}/status`, { status: 'READY_TO_SHIP', assignedShipperId: 18 }));
  step('Shipper picks up', await SHIP.patch(`/orders/${o.orderId}/status`, { status: 'SHIPPED' }));
  step('Delivered, cash', await SHIP.patch(`/orders/${o.orderId}/status`, { status: 'DELIVERED', cashAmount: Number(o.totalAmount) }));
  const ret = step('Customer requests 1-1 exchange', await CUS.post(`/orders/${o.orderId}/return`, { type: 'EXCHANGE', reason: 'Phím Space bị kẹt, không nhận phím' }));
  step('CSKH approves', await CSKH.patch(`/orders/returns/${ret.id}/review`, { decision: 'APPROVE' }));
  step('Shipper picks up', await SHIP.patch(`/orders/returns/${ret.id}/pickup`, {}));
  step('Shipper hands to warehouse', await SHIP.patch(`/orders/returns/${ret.id}/deliver-warehouse`, {}));
  step('QC approves exchange', await QC.patch(`/orders/returns/${ret.id}/qc-inspect`, { qcDecision: 'EXCHANGE_NEW', qcDefectType: 'DOA_FACTORY_DEFECT', qcNotes: 'Switch phím Space lỗi NSX' }));
  const r = await W.patch(`/orders/returns/${o.orderId}/restock`, { shelfLocation: 'SHELF_C2_VENDOR', note: 'Gửi hãng AKKO bảo hành' });
  step('Warehouse shelves defective + creates replacement', r);
  const exc = `ORD-EXC-${o.orderId.replace('ORD-', '')}`;
  step('Replacement ships: assign shipper', await W.patch(`/orders/${exc}/status`, { status: 'READY_TO_SHIP', assignedShipperId: 18 }));
  step('Replacement picked up', await SHIP.patch(`/orders/${exc}/status`, { status: 'SHIPPED' }));
  step('Replacement delivered', await SHIP.patch(`/orders/${exc}/status`, { status: 'DELIVERED' }));
  console.log('ORIGINAL', o.orderId, 'REPLACEMENT', exc);
})().catch(e => { if (e.message !== 'stop') console.error(e); });
