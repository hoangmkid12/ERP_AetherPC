// Failed delivery → return to warehouse → QC close; customer RMA refund; POS sale; ledger guard; bundle price.
const { as } = require('./api');
let fail = 0;
const step = (k, r, expectOk = true) => {
  const ok = expectOk ? r.status < 400 : r.status >= 400;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${k} [${r.status}] ${r.message || ''}`);
  if (!ok) { fail++; console.log('   ', String(r.stack || JSON.stringify(r)).split('\n').filter(l => !l.trim().startsWith('at ')).slice(-8).join('\n')); if (expectOk) throw new Error('stop'); }
  return r.data;
};
const which = process.argv[2] || 'all';
(async () => {
  const CUS = as('customer', { customer: true }), SM = as('sales_manager'), W = as('warehouse'), SHIP = as('delivery'),
    CSKH = as('cskh'), ACC = as('accounting'), QC = as('qc'), SALES = as('sales');
  const ADDR = '12 Lê Lợi, Phường Bến Nghé, TP. Hồ Chí Minh';

  if (which === 'all' || which === 'failed') {
    console.log('\n--- GIAO THẤT BẠI → HOÀN KHO ---');
    const o = step('Customer orders SSD (COD)', await CUS.post('/orders', { items: [{ productId: '1049768859', quantity: 1 }], paymentMethod: 'COD', shippingAddress: ADDR, shippingCity: 'Hồ Chí Minh' }));
    step('Sales confirms', await SM.patch(`/orders/${o.orderId}/status`, { status: 'CONFIRMED' }));
    step('Warehouse assigns shipper', await W.patch(`/orders/${o.orderId}/status`, { status: 'READY_TO_SHIP', assignedShipperId: 18, deliveryRegion: 'HCM_KV1' }));
    step('Shipper picks up', await SHIP.patch(`/orders/${o.orderId}/status`, { status: 'SHIPPED' }));
    step('Shipper: không liên lạc được', await SHIP.patch(`/orders/${o.orderId}/status`, { status: 'SHIPPING_FAILED', failReason: 'Không liên lạc được khách', isAwaitingCallback: true }));
    step('Cannot cancel while parcel is with shipper', await SM.patch(`/orders/${o.orderId}/status`, { status: 'CANCELLED' }), false);
    step('Shipper returns parcel to warehouse', await SHIP.patch(`/orders/${o.orderId}/status`, { status: 'RETURNING_TO_WAREHOUSE', returnReason: 'Khách không nghe máy 3 lần' }));
    step('Sales cannot close returned parcel', await SM.patch(`/orders/${o.orderId}/status`, { status: 'CANCELLED' }), false);
    step('QC closes order, seal intact → restock', await QC.patch(`/orders/${o.orderId}/status`, { status: 'CANCELLED', note: 'Tem seal nguyên vẹn', restockCondition: 'PERFECT_SEAL' }));
    console.log('   FAILED-ORDER', o.orderId);
  }

  if (which === 'all' || which === 'rma') {
    console.log('\n--- ĐỔI TRẢ HOÀN TIỀN ---');
    const o = step('Customer orders mouse (COD)', await CUS.post('/orders', { items: [{ productId: '1053063967', quantity: 1 }], paymentMethod: 'COD', shippingAddress: ADDR, shippingCity: 'Hồ Chí Minh' }));
    step('Sales confirms', await SM.patch(`/orders/${o.orderId}/status`, { status: 'CONFIRMED' }));
    step('Warehouse assigns shipper', await W.patch(`/orders/${o.orderId}/status`, { status: 'READY_TO_SHIP', assignedShipperId: 18 }));
    step('Shipper picks up', await SHIP.patch(`/orders/${o.orderId}/status`, { status: 'SHIPPED' }));
    step('Delivered, cash', await SHIP.patch(`/orders/${o.orderId}/status`, { status: 'DELIVERED', cashAmount: Number(o.totalAmount), receivedByType: 'DIRECT_CUSTOMER' }));
    const ret = step('Customer requests refund (lỗi double-click)', await CUS.post(`/orders/${o.orderId}/return`, { type: 'REFUND', reason: 'Chuột bị double-click sau 2 ngày sử dụng', bankName: 'Vietcombank', bankAccountNo: '0071000123456', bankAccountName: 'KHACH HANG DEMO' }));
    step('QC cannot inspect before parcel arrives', await QC.patch(`/orders/returns/${ret.id}/qc-inspect`, { qcDecision: 'APPROVE_REFUND' }), false);
    step('CSKH approves', await CSKH.patch(`/orders/returns/${ret.id}/review`, { decision: 'APPROVE', note: 'Lỗi phần cứng trong 7 ngày đầu' }));
    step('Shipper picks up from customer', await SHIP.patch(`/orders/returns/${ret.id}/pickup`, { note: 'Đã thu hồi đủ hộp, phụ kiện' }));
    step('Shipper hands to warehouse', await SHIP.patch(`/orders/returns/${ret.id}/deliver-warehouse`, {}));
    step('QC passes (DOA)', await QC.patch(`/orders/returns/${ret.id}/qc-inspect`, { qcDecision: 'APPROVE_REFUND', qcDefectType: 'DOA_FACTORY_DEFECT', qcNotes: 'Switch chuột trái lỗi double-click, lỗi NSX' }));
    step('Accountant cannot refund before warehouse shelving', await ACC.patch(`/orders/returns/${o.orderId}/refund`, { refundTxnCode: 'FT-TEST' }), false);
    step('Warehouse shelves to vendor-warranty (defective)', await W.patch(`/orders/returns/${o.orderId}/restock`, { shelfLocation: 'SHELF_C2_VENDOR', note: 'Gửi ASUS bảo hành' }));
    step('Warehouse cannot shelve twice', await W.patch(`/orders/returns/${o.orderId}/restock`, { shelfLocation: 'SHELF_A1_RESTOCK' }), false);
    step('Accountant refunds', await ACC.patch(`/orders/returns/${o.orderId}/refund`, { refundMethod: 'BANK_TRANSFER', refundTxnCode: 'FT26286' + Date.now().toString().slice(-6) }));
    step('No double refund', await ACC.patch(`/orders/returns/${o.orderId}/refund`, { refundTxnCode: 'X' }));
    console.log('   RMA-ORDER', o.orderId);
  }

  if (which === 'all' || which === 'pos') {
    console.log('\n--- BÁN TẠI QUẦY (POS) ---');
    const p1 = step('POS cash sale, known phone', await SALES.post('/orders/pos', {
      customerName: 'Trần Quốc Bảo', phone: '0938123456', items: [{ productId: '1069079528', quantity: 1 }, { productId: '1053063967', quantity: 1 }],
      paymentMethod: 'COD', posPaymentMethod: 'CASH', type: 'POS', couponDiscount: 0
    }));
    console.log('   ', p1.orderId, p1.status, p1.paymentMethod, p1.paymentStatus, p1.customerId, p1.totalAmount);
    const p2 = step('POS QR bank transfer, walk-in', await SALES.post('/orders/pos', {
      customerName: '', phone: '', items: [{ productId: '1047255693', quantity: 1 }], posPaymentMethod: 'BANK', type: 'POS', bankRefCode: 'FT26286POS01'
    }));
    console.log('   ', p2.orderId, p2.status, p2.paymentMethod, p2.paymentStatus, p2.customerId, p2.totalAmount);
    step('POS discount >10% needs approval (sales)', await SALES.post('/orders/pos', {
      items: [{ productId: '1047255693', quantity: 1 }], posPaymentMethod: 'CASH', type: 'POS', couponDiscount: 300000
    }), false);
  }

  if (which === 'all' || which === 'ledger') {
    console.log('\n--- KHOÁ BÚT TOÁN HỆ THỐNG ---');
    const ledger = (await ACC.get('/ledger')).data;
    const cogs = ledger.find(l => (l.referenceId || '').startsWith('COGS-'));
    step('Cannot delete COGS entry', await ACC.del(`/ledger/${cogs.id}`), false);
    step('Cannot edit COGS entry', await ACC.put(`/ledger/${cogs.id}`, { amount: 1 }), false);
    step('Cannot spoof system ref on manual entry', await ACC.post('/ledger', { type: 'INCOME', amount: 1000, description: 'x', referenceId: 'POS-FAKE' }), false);
  }

  if (which === 'all' || which === 'bundle') {
    console.log('\n--- GIÁ MUA KÈM ---');
    const o = step('CPU + cooler bundle', await CUS.post('/orders', {
      items: [{ productId: '1054221353', quantity: 1 }, { productId: '1047255693', quantity: 1, bundleWith: '1054221353' }],
      paymentMethod: 'COD', shippingAddress: ADDR
    }));
    const cooler = o.items.find(i => i.productId === '1047255693');
    console.log(Number(cooler.price) < 1090000 ? 'PASS' : 'FAIL', 'cooler bundle price', cooler.price, '(niêm yết 1.090.000, -10% → 981.000)');
    step('Customer cancels pending order', await CUS.post(`/orders/${o.orderId}/cancel`, { reason: 'Đặt nhầm, sẽ đặt lại' }));
  }
  console.log(`\nfailures=${fail}`);
})().catch(e => { if (e.message !== 'stop') console.error(e); console.log(`\nfailures=${fail}`); });
