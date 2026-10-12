/**
 * Dọn dữ liệu giao hàng bị lỗi.
 *
 *   node prisma/fix-delivery-data.js           # chạy thử: chỉ in ra những gì sẽ sửa
 *   node prisma/fix-delivery-data.js --apply   # sửa thật (sao lưu trước vào backend/logs/)
 *
 * 1. Lịch sử "Đã giao" bị ghi lặp (shipper trượt xác nhận bắn nhiều request
 *    cùng lúc): giữ dòng đầu tiên, xoá các dòng lặp trong vòng 10 phút.
 * 2. OrderPayment bị nhân bản cùng lúc đó: giữ dòng đầu tiên; nếu dòng thừa đã
 *    được Kế toán đối soát thì trừ phần tiền thừa khỏi bút toán thu COD
 *    (COD-SETTLE) tương ứng trong Sổ Cái.
 * 3. Đơn kẹt ở trạng thái giao hàng từ trước hôm nay mà KHÔNG có shipper (không
 *    ai thấy/được phép xử lý): huỷ đơn theo đúng luồng huỷ chuẩn (hoàn kho, trả
 *    serial, xoá giá vốn, trừ điểm thành viên).
 * 4. Đơn giao thất bại quá hạn (chờ gọi lại > 24h, hẹn lại > 3 ngày): chuyển
 *    hoàn kho — cùng hàm với job định kỳ trong orderScheduler.
 */
const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/database');
const {
  cancelSingleOrderInternal,
  autoReturnOverdueFailedDeliveries,
  IN_TRANSIT_STATUSES,
  startOfTodayVN
} = require('../src/controllers/order.controller');

const APPLY = process.argv.includes('--apply');
const DUP_WINDOW_MS = 10 * 60 * 1000;
const fmt = n => Number(n).toLocaleString('vi-VN') + 'đ';

// Dòng nằm trong vòng DUP_WINDOW_MS kể từ dòng được giữ trước đó của cùng nhóm = bản lặp
function splitDuplicates(rows, groupKey, timeOf) {
  const keep = [];
  const drop = [];
  const lastKept = new Map();
  for (const r of [...rows].sort((a, b) => timeOf(a) - timeOf(b) || a.id - b.id)) {
    const key = groupKey(r);
    const prev = lastKept.get(key);
    if (prev && timeOf(r) - timeOf(prev) <= DUP_WINDOW_MS) {
      drop.push(r);
    } else {
      keep.push(r);
      lastKept.set(key, r);
    }
  }
  return { keep, drop };
}

async function main() {
  console.log(APPLY ? '=== CHẾ ĐỘ SỬA THẬT ===' : '=== CHẠY THỬ (thêm --apply để sửa thật) ===');
  const backup = { createdAt: new Date().toISOString() };

  // ---- 1. Lịch sử "Đã giao" lặp ----------------------------------------
  const deliveredHist = await prisma.orderStatusHistory.findMany({ where: { status: 'DELIVERED' } });
  const hist = splitDuplicates(deliveredHist, r => r.orderId, r => new Date(r.timestamp).getTime());
  const histOrders = new Set(hist.drop.map(r => r.orderId));
  console.log(`\n[1] Lịch sử "Đã giao" lặp: ${hist.drop.length} dòng thừa ở ${histOrders.size} đơn`);
  backup.historyDeleted = hist.drop;

  // ---- 2. Thanh toán nhân bản ------------------------------------------
  const payments = await prisma.orderPayment.findMany({
    where: { status: 'SUCCESS' },
    select: { id: true, orderId: true, method: true, amount: true, transactionId: true, createdAt: true, settledAt: true, settledBy: true, remittedAt: true }
  });
  const pay = splitDuplicates(payments, r => `${r.orderId}|${r.method}|${r.amount}`, r => new Date(r.createdAt).getTime());
  console.log(`\n[2] Thanh toán nhân bản: ${pay.drop.length} dòng thừa`);
  for (const p of pay.drop) {
    console.log(`    ${p.orderId} ${p.method} ${fmt(p.amount)} ${p.settledAt ? '(đã đối soát ' + new Date(p.settledAt).toISOString() + ')' : '(chưa đối soát)'}`);
  }
  backup.paymentsDeleted = pay.drop;

  // Bút toán COD-SETTLE cần trừ: mỗi lần chốt ghi 1 bút toán có date = settledAt của các dòng được chốt
  const ledgerAdjust = new Map(); // ledgerId -> { entry, minus, orders }
  for (const p of pay.drop.filter(d => d.method === 'CASH' && d.settledAt)) {
    const entry = await prisma.ledgerEntry.findFirst({
      where: { referenceId: { startsWith: 'COD-SETTLE-' }, date: p.settledAt },
      select: { id: true, amount: true, description: true, referenceId: true, date: true }
    });
    if (!entry) {
      console.log(`    ! Không tìm thấy bút toán COD-SETTLE cho dòng thừa đã đối soát của ${p.orderId} — cần Kế toán kiểm tra tay`);
      continue;
    }
    const cur = ledgerAdjust.get(entry.id) || { entry, minus: 0, orders: [] };
    cur.minus += Number(p.amount);
    cur.orders.push(p.orderId);
    ledgerAdjust.set(entry.id, cur);
  }
  for (const { entry, minus } of ledgerAdjust.values()) {
    console.log(`    Sổ Cái ${entry.referenceId}: ${fmt(entry.amount)} → ${fmt(Number(entry.amount) - minus)} (trừ ${fmt(minus)} thu trùng)`);
  }
  backup.ledgerBefore = [...ledgerAdjust.values()].map(v => v.entry);

  // ---- 3. Đơn kẹt không có shipper --------------------------------------
  const todayStart = startOfTodayVN();
  const stuck = await prisma.order.findMany({
    where: { status: { in: IN_TRANSIT_STATUSES }, assignedShipperId: null },
    select: { orderId: true, status: true, totalAmount: true, shippedAt: true, createdAt: true }
  });
  const stuckOld = stuck.filter(o => new Date(o.shippedAt || o.createdAt) < todayStart);
  console.log(`\n[3] Đơn kẹt giao hàng không có shipper → huỷ + hoàn kho: ${stuckOld.length} đơn`);
  const byStatus = stuckOld.reduce((m, o) => ({ ...m, [o.status]: (m[o.status] || 0) + 1 }), {});
  console.log('    ', byStatus);
  backup.stuckCancelled = stuckOld;

  // ---- 4. Giao thất bại quá hạn (có shipper) ---------------------------
  console.log('\n[4] Giao thất bại quá hạn → hoàn kho: thực hiện bởi autoReturnOverdueFailedDeliveries' + (APPLY ? '' : ' (bỏ qua khi chạy thử)'));

  if (!APPLY) {
    console.log('\nChạy thử xong — chưa sửa gì.');
    return;
  }

  const backupDir = path.join(__dirname, '..', 'logs');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `fix-delivery-data-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`\nĐã sao lưu dữ liệu trước khi sửa: ${backupFile}`);

  await prisma.$transaction(async (tx) => {
    if (hist.drop.length) {
      await tx.orderStatusHistory.deleteMany({ where: { id: { in: hist.drop.map(r => r.id) } } });
    }
    if (pay.drop.length) {
      await tx.orderPayment.deleteMany({ where: { id: { in: pay.drop.map(r => r.id) } } });
    }
    for (const { entry, minus, orders } of ledgerAdjust.values()) {
      const remaining = Number(entry.amount) - minus;
      if (remaining <= 0) {
        await tx.ledgerEntry.delete({ where: { id: entry.id } });
      } else {
        await tx.ledgerEntry.update({
          where: { id: entry.id },
          data: {
            amount: remaining,
            description: `${entry.description} [Điều chỉnh: trừ ${fmt(minus)} thu COD bị ghi trùng — đơn ${[...new Set(orders)].join(', ')}]`
          }
        });
      }
    }
  }, { timeout: 60000 });
  console.log(`[1][2] Đã xoá ${hist.drop.length} dòng lịch sử, ${pay.drop.length} dòng thanh toán, điều chỉnh ${ledgerAdjust.size} bút toán.`);

  let cancelled = 0;
  for (const o of stuckOld) {
    try {
      await cancelSingleOrderInternal(
        o.orderId,
        'Dọn dữ liệu: đơn kẹt ở trạng thái giao hàng từ ngày trước mà không có shipper phụ trách — huỷ và hoàn kho.',
        'Hệ Thống (dọn dữ liệu)'
      );
      cancelled++;
    } catch (err) {
      console.warn(`    ! Không huỷ được ${o.orderId}: ${err.message}`);
    }
  }
  console.log(`[3] Đã huỷ + hoàn kho ${cancelled}/${stuckOld.length} đơn.`);

  const returned = await autoReturnOverdueFailedDeliveries();
  console.log(`[4] Đã chuyển hoàn kho ${returned.length} đơn giao thất bại quá hạn:`, returned.map(r => r.orderId).join(', ') || '(không có)');
}

main()
  .catch(err => { console.error('LỖI:', err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
