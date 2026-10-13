const { as } = require('./api');
const fs = require('fs');
const log = (k, r) => { console.log(`\n== ${k} [${r.status}] ${r.message || ''}`); if (r.status >= 400) { console.log(JSON.stringify(r).slice(0, 600)); process.exit(1); } return r.data; };
(async () => {
  const [PID, QTY, UNIT] = [process.argv[2], parseInt(process.argv[3]), parseInt(process.argv[4])];
  const QC_MODE = process.argv[5] || 'PASS'; // PASS | PARTIAL:<passed>
  const W = as('warehouse'), WM = as('warehouse_manager'), PU = as('purchasing'), SUP = as(process.env.SUPC || 'SUP-ASUS-VN'), CEO = as('ceo'), QC = as('qc'), ACC = as('accounting');
  const pr = log('PR create', await W.post('/warehouse/purchase-requests', { productId: PID, quantity: QTY, reason: 'Tồn kho dưới mức tối thiểu, bổ sung hàng bán tháng 10/2026' }));
  log('PR approve', await WM.patch(`/warehouse/purchase-requests/${pr.id}/approve`));
  const rfq = log('RFQ create', await PU.post('/purchasing/orders', { supplierCode: process.env.SUPC || 'SUP-ASUS-VN', purchaseRequestId: pr.id, expectedDeliveryDate: '2026-10-20', items: [{ productId: PID, quantity: QTY }] }));
  console.log('RFQ', rfq.poNumber, rfq.status, rfq.totalAmount);
  log('RFQ send', await PU.patch(`/purchasing/orders/${rfq.id}/status`, { status: 'RFQ_SENT' }));
  log('Supplier quote', await SUP.patch(`/purchasing/orders/${rfq.id}/status`, { status: 'QUOTED', itemPrices: rfq.items.map(i => ({ itemId: i.id, unitCost: UNIT })), supplierNote: 'Đơn giá chưa VAT, giao trong 5 ngày làm việc' }));
  log('Approve quote', await PU.patch(`/purchasing/orders/${rfq.id}/status`, { status: 'PENDING_PO_DRAFT' }));
  const po = log('Issue PO', await PU.post(`/purchasing/orders/${rfq.id}/issue-po`, { expectedDeliveryDate: '2026-10-20', notes: 'Thanh toán chuyển khoản 7 ngày sau nhận hàng' }));
  console.log('PO', po.poNumber, po.status, po.totalAmount);
  log('CEO approve', await CEO.patch(`/purchasing/orders/${po.id}/status`, { status: 'PO' }));
  log('Supplier confirm', await SUP.patch(`/purchasing/orders/${po.id}/status`, { status: 'CONFIRMED_BY_SUPPLIER', expectedDeliveryDate: '2026-10-18' }));
  let passed = QTY, status = 'QA_PASSED';
  if (QC_MODE.startsWith('PARTIAL')) { passed = parseInt(QC_MODE.split(':')[1]); status = 'QA_PARTIAL'; }
  log('QC', await QC.patch(`/purchasing/orders/${po.id}/status`, { status, passedQty: passed, failedQty: QTY - passed, sampleRate: 100, qcNotes: passed === QTY ? 'Kiểm 100%: tem bảo hành, ngoại quan, test khởi động đạt' : `${QTY - passed} sản phẩm lỗi ngoại quan, trả NCC` }));
  const rec = (await W.get('/warehouse/receipts')).data.find(r => r.poId === po.id);
  console.log('Receipt', rec?.receiptNumber, rec?.status);
  const serials = { [PID]: Array.from({ length: passed }, (_, i) => `${(process.env.SUPC || 'SUP-ASUS-VN').split('-')[1]}-${PID.slice(-4)}-${Date.now().toString().slice(-6)}-${i + 1}`) };
  const vr = await W.post(`/warehouse/receipts/${rec.id}/validate`, { serials }); log('Validate receipt', vr); global.__alloc = vr.allocatedOrders;
  const bill = log('Vendor bill', await ACC.post(`/purchasing/orders/${po.id}/bills`));
  console.log('Bill', bill.billNumber, bill.amountTotal);
  console.log('allocated', JSON.stringify(global.__alloc||[]));log('Pay bill', await ACC.post(`/purchasing/bills/${bill.id}/payments`, { paymentMethod: 'Bank Transfer', amount: bill.amountTotal }));
  const fin = (await PU.get('/purchasing/orders')).data.find(o => o.id === po.id);
  console.log('\nFINAL PO', fin.poNumber, fin.status, 'bills', fin.bills.map(b => b.status + ':' + b.amountTotal));
  fs.writeFileSync(require('os').tmpdir() + '/' + `/p2p_${po.poNumber}.json`, JSON.stringify({ pr, rfq, po, bill, serials }));
})();
