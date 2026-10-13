// End-to-end Order-to-Cash: storefront Build PC (COD) → sales confirm → assembly → warehouse →
// shipper → delivered (cash) → CSKH complete → accountant COD settlement. Asserts each guard.
const { as } = require('./api');
const fs = require('fs');
let fail = 0;
const step = (k, r, expectOk = true) => {
  const ok = expectOk ? r.status < 400 : r.status >= 400;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${k} [${r.status}] ${r.message || ''}`);
  if (!ok) { fail++; console.log('   ', String(r.stack || JSON.stringify(r)).split('\n').filter(l => !l.trim().startsWith('at ')).slice(-12).join('\n')); if (expectOk) { process.exitCode = 1; throw new Error('stop'); } }
  return r.data;
};
(async () => {
  const CUS = as('customer', { customer: true }), SM = as('sales_manager'), ASM = as('assembly'), W = as('warehouse'),
    SHIP = as('delivery'), CSKH = as('cskh'), ACC = as('accounting');
  const build = [
    ['1054221353', 1], // i3-12100F
    ['1047242269', 1], // MSI PRO H610M-E DDR4
    ['1047263104', 2], // RAM 8GB x2
    ['1049768859', 1], // SSD 960GB
    ['1056573165', 1], // RX 6500 XT
    ['1047268598', 1], // PSU 550W
    ['1069666233', 1], // Case Jonsbo D32
    ['1047255693', 1]  // Hyper 212
  ];
  const order = step('Customer places Build PC COD order', await CUS.post('/orders', {
    items: build.map(([productId, quantity]) => ({ productId, quantity, selectedSpec: { pc_build_bundle: 'custom_pc' }, pcBuild: true })),
    paymentMethod: 'COD',
    shippingAddress: '25 Nguyễn Văn Bảo, Phường Hạnh Thông, TP. Hồ Chí Minh',
    shippingCity: 'Hồ Chí Minh',
    customerName: 'Khách Hàng Demo',
    notes: 'Gọi trước khi giao 30 phút'
  }));
  const id = order.orderId;
  console.log('   order', id, order.status, 'total', order.totalAmount, 'vat', order.vatAmount);

  let jobs = (await ASM.get('/assembly-jobs')).data.filter(j => j.orderId === id);
  console.log(jobs.length === 1 ? 'PASS' : 'FAIL', 'assembly job auto-created', jobs[0]?.jobCode, jobs[0]?.components?.map(c => c.category).join(','));
  const job = jobs[0];

  step('Assembly cannot start before order confirmed', await ASM.put(`/assembly-jobs/${job.jobCode}`, { status: 'ASSEMBLING' }), false);
  step('Sales manager confirms order (stock out)', await SM.patch(`/orders/${id}/status`, { status: 'CONFIRMED', note: 'Đã gọi xác nhận khách, đủ hàng' }));
  step('Warehouse cannot ship before assembly', await W.patch(`/orders/${id}/status`, { status: 'READY_TO_SHIP' }), false);
  const started = step('Assembly starts (serials auto from order)', await ASM.put(`/assembly-jobs/${job.jobCode}`, { status: 'ASSEMBLING' }));
  console.log('   serials', JSON.stringify(started.componentSerials));
  step('Assembly cannot complete with foreign serial', await ASM.put(`/assembly-jobs/${job.jobCode}`, {
    status: 'COMPLETED', checklist: { biosPost: true, osInstall: true, stressTest: true, qcSeal: true }, componentSerials: { ...started.componentSerials, CPU: 'FAKE-SN-001' }
  }), false);
  step('Assembly completes QA & handover', await ASM.put(`/assembly-jobs/${job.jobCode}`, {
    status: 'COMPLETED', checklist: { biosPost: true, osInstall: true, stressTest: true, qcSeal: true }, componentSerials: started.componentSerials
  }));
  const shipper = (await W.get('/employees')).data?.find?.(e => e.employeeCode === 'delivery') || { id: 18 };
  step('Warehouse assigns shipper (Xác nhận xuất kho)', await W.patch(`/orders/${id}/status`, { status: 'READY_TO_SHIP', assignedShipperId: shipper.id, deliveryRegion: 'HCM_KV1' }));
  step('Shipper picks up (Nhận chuyến)', await SHIP.patch(`/orders/${id}/status`, { status: 'SHIPPED' }));
  step('Customer cannot self-complete unpaid COD in transit', await CUS.post(`/orders/${id}/confirm-received`, { note: 'đã nhận' }), false);
  step('Shipper delivered, collected cash', await SHIP.patch(`/orders/${id}/status`, {
    status: 'DELIVERED', cashAmount: Number(order.totalAmount), receivedByType: 'DIRECT_CUSTOMER', receiverNote: 'Khách kiểm tra máy lên hình, đã nhận đủ',
    proofPhoto: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  }));
  step('Customer confirms received', await CUS.post(`/orders/${id}/confirm-received`, { note: 'Máy chạy tốt' }));
  const cod = await ACC.get('/ledger/cod-settlement');
  const mine = cod.data.find(g => g.orders.some(o => o.orderId === id));
  const pay = mine?.orders.find(o => o.orderId === id);
  console.log(pay ? 'PASS' : 'FAIL', 'COD payment pending settlement', pay?.amount);
  step('Shipper declares remittance', await SHIP.post('/ledger/cod/my/remit', { paymentIds: [pay.paymentId], note: 'Nộp tiền mặt cuối ca' }));
  step('Accountant settles COD', await ACC.post(`/ledger/cod-settlement/${mine.shipperId}/settle`, { paymentIds: [pay.paymentId] }));
  fs.writeFileSync(require('os').tmpdir() + '/' + `/o2c_${id}.json`, JSON.stringify({ id, job: job.jobCode }));
  console.log(`\nDONE ${id} failures=${fail}`);
})().catch(e => { if (e.message !== 'stop') console.error(e); });
