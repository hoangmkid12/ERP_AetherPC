const prisma = require('../config/database');
const { sendOrderStatusUpdateEmail } = require('../services/emailService');
const { groupOfSlug } = require('../services/bundleDeals');

const REQUIRED_CHECKLIST_KEYS = ['biosPost', 'osInstall', 'stressTest', 'qcSeal'];
// Đơn đã xuất kho (đã trừ tồn + gán serial) và chưa rời kho — chỉ lúc này mới lắp ráp được
const ASSEMBLABLE_ORDER_STATUSES = ['CONFIRMED', 'PROCESSING', 'PACKED'];

// Job responses expose `id` as an alias of `jobCode`, and `date` as a
// Vietnamese-locale string derived from `createdAt` — the frontend was
// written against a client-generated `job.id`/`job.date` shape, so mirroring
// both here avoids rewiring every existing `.id`/`.date` display site.
const serializeJob = (job, extra = {}) => ({
  ...job,
  id: job.jobCode,
  customer: job.customerName,
  date: new Date(job.createdAt).toLocaleDateString('vi-VN'),
  ...extra
});

// Mỗi linh kiện trên phiếu một khóa duy nhất (2 ổ cứng → STORAGE, STORAGE #2) vì serial
// được gán theo khóa này (componentSerials[category]).
const uniqueCategories = (components) => {
  const seen = {};
  return components.map(c => {
    const base = String(c.category || 'OTHER').toUpperCase();
    seen[base] = (seen[base] || 0) + 1;
    return { ...c, category: seen[base] > 1 ? `${base} #${seen[base]}` : base };
  });
};

// Serial thật đã gán cho đơn lúc xuất kho, gom theo sản phẩm: { productId: [serial...] }
const orderSerialMap = async (client, orderIds) => {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const rows = await client.serialNumber.findMany({
    where: { orderId: { in: ids } },
    select: { orderId: true, productId: true, serial: true },
    orderBy: { id: 'asc' }
  });
  const map = {};
  for (const r of rows) {
    map[r.orderId] = map[r.orderId] || {};
    (map[r.orderId][r.productId] = map[r.orderId][r.productId] || []).push(r.serial);
  }
  return map;
};

// Gán serial của đơn cho từng linh kiện trên phiếu (theo productId), số lượng > 1 thì nối chuỗi
const serialsForComponents = (components, serialsByProduct) => {
  const out = {};
  const used = {};
  for (const c of components) {
    if (!c.productId) continue;
    const pool = serialsByProduct?.[c.productId] || [];
    const start = used[c.productId] || 0;
    const qty = Math.max(1, parseInt(c.quantity, 10) || 1);
    const picked = pool.slice(start, start + qty);
    used[c.productId] = start + qty;
    if (picked.length) out[c.category] = picked.join(', ');
  }
  return out;
};

// GET /api/v1/assembly-jobs
const getAssemblyJobs = async (req, res, next) => {
  try {
    const jobs = await prisma.assemblyJob.findMany({ orderBy: { createdAt: 'desc' } });
    const serialMap = await orderSerialMap(prisma, jobs.map(j => j.orderId));
    const orders = await prisma.order.findMany({
      where: { orderId: { in: jobs.map(j => j.orderId).filter(Boolean) } },
      select: { orderId: true, status: true }
    });
    const orderStatus = new Map(orders.map(o => [o.orderId, o.status]));
    res.json({
      success: true,
      data: jobs.map(j => serializeJob(j, {
        orderStatus: j.orderId ? orderStatus.get(j.orderId) || null : null,
        orderSerials: j.orderId ? serialMap[j.orderId] || {} : {}
      }))
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/assembly-jobs
const createAssemblyJob = async (req, res, next) => {
  try {
    const { orderId, customer, customerName, components, checklist, componentSerials } = req.body;
    let custName = customerName || customer;
    let validComponents = Array.isArray(components) ? components.filter(c => c && c.name && String(c.name).trim()) : [];

    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { orderId },
        include: { customer: { select: { name: true } }, items: { include: { product: { select: { category: { select: { slug: true } } } } } } }
      });
      if (!order) {
        const error = new Error(`Không tìm thấy đơn hàng ${orderId}.`);
        error.statusCode = 404;
        throw error;
      }
      if (['CANCELLED', 'REFUNDED', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status)) {
        const error = new Error(`Đơn hàng ${orderId} đang ở trạng thái không thể lắp ráp (${order.status}).`);
        error.statusCode = 409;
        throw error;
      }
      const existing = await prisma.assemblyJob.findFirst({ where: { orderId, status: { not: 'CANCELLED' } } });
      if (existing) {
        const error = new Error(`Đơn hàng ${orderId} đã có lệnh lắp ráp ${existing.jobCode}.`);
        error.statusCode = 409;
        throw error;
      }
      custName = custName || order.customer?.name;
      // Linh kiện lấy từ chính đơn hàng (đúng sản phẩm, đúng số lượng khách đã mua) thay
      // vì gõ tay tự do — lắp ráp & serial phải khớp với hàng đã xuất kho cho đơn.
      if (validComponents.length === 0) {
        validComponents = order.items.map(it => ({
          productId: it.productId,
          category: groupOfSlug(it.product?.category?.slug) || 'OTHER',
          name: it.name,
          quantity: it.quantity
        }));
      }
    }

    if (!custName || !String(custName).trim()) {
      const error = new Error('Vui lòng nhập tên khách hàng hoặc mục đích lệnh lắp ráp.');
      error.statusCode = 400;
      throw error;
    }
    if (validComponents.length === 0) {
      const error = new Error('Vui lòng điền ít nhất 1 linh kiện cần lắp ráp.');
      error.statusCode = 400;
      throw error;
    }

    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const jobCode = `ASM-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    const job = await prisma.assemblyJob.create({
      data: {
        jobCode,
        orderId: orderId || null,
        customerName: custName,
        components: uniqueCategories(validComponents),
        checklist: checklist || { biosPost: false, osInstall: false, stressTest: false, qcSeal: false },
        componentSerials: componentSerials || {},
        status: 'PENDING',
        createdBy: req.user?.email || req.user?.code || null
      }
    });

    res.status(201).json({ success: true, data: serializeJob(job) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/assembly-jobs/:jobId
const updateAssemblyJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { status, checklist, componentSerials } = req.body;

    const job = await prisma.assemblyJob.findUnique({ where: { jobCode: jobId } });
    if (!job) {
      const error = new Error(`Không tìm thấy lệnh lắp ráp: ${jobId}`);
      error.statusCode = 404;
      throw error;
    }
    if (['CANCELLED', 'COMPLETED'].includes(job.status) && status !== job.status) {
      const error = new Error(job.status === 'CANCELLED' ? 'Lệnh lắp ráp này đã bị hủy, không thể thao tác.' : 'Lệnh lắp ráp đã nghiệm thu xuất xưởng, không thể thay đổi.');
      error.statusCode = 409;
      throw error;
    }

    const order = job.orderId ? await prisma.order.findUnique({ where: { orderId: job.orderId } }) : null;
    const components = Array.isArray(job.components) ? job.components : [];
    const nextStatus = status || job.status;
    const isStarting = nextStatus === 'ASSEMBLING' && job.status === 'PENDING';
    const isNewlyCompleted = nextStatus === 'COMPLETED' && job.status !== 'COMPLETED';

    if (order && (isStarting || isNewlyCompleted) && !ASSEMBLABLE_ORDER_STATUSES.includes(order.status)) {
      const error = new Error(order.status === 'CANCELLED'
        ? `Đơn hàng ${order.orderId} đã bị hủy — không thể lắp ráp.`
        : `Đơn hàng ${order.orderId} chưa được xác nhận & xuất kho linh kiện (trạng thái hiện tại: ${order.status}). Chờ bộ phận bán hàng/kho duyệt đơn trước khi lắp ráp.`);
      error.statusCode = 409;
      throw error;
    }

    const nextChecklist = checklist ?? job.checklist;
    let nextSerials = componentSerials ?? job.componentSerials;

    // Bắt đầu lắp ráp đơn hàng: gán sẵn serial THẬT đã cấp cho đơn lúc xuất kho (trước đây
    // màn hình tự sinh serial tạm "SN-CPU-2026-001" không hề tồn tại trong kho).
    let serialsByProduct = null;
    if (order) {
      serialsByProduct = (await orderSerialMap(prisma, [order.orderId]))[order.orderId] || {};
      if (isStarting) {
        nextSerials = { ...serialsForComponents(components, serialsByProduct), ...(componentSerials || {}) };
      }
    }

    // Nghiệm thu xuất xưởng bắt buộc phải qua đủ 4 đầu mục QA + gán đủ S/N —
    // trước đây chỉ validate ở frontend (localStorage), ai gọi thẳng API đều
    // bỏ qua được. Validate lại ở đây để không thể lách qua đường vòng.
    if (isNewlyCompleted) {
      const allChecked = REQUIRED_CHECKLIST_KEYS.every(k => !!nextChecklist?.[k]);
      if (!allChecked) {
        const error = new Error('Thiếu mục kiểm thử QA — cần tích đủ 4 đầu mục (BIOS/POST, cài HĐH, stress test, niêm phong QC) trước khi nghiệm thu.');
        error.statusCode = 400;
        throw error;
      }
      const allSerialed = components.every(c => !!String(nextSerials?.[c.category] || '').trim());
      if (!allSerialed) {
        const error = new Error('Thiếu mã Serial Number — cần gán đủ S/N cho mọi linh kiện trước khi nghiệm thu.');
        error.statusCode = 400;
        throw error;
      }
      // Serial trên phiếu lắp ráp đơn hàng phải là serial đã xuất kho cho chính đơn đó
      if (order) {
        const owned = new Set(Object.values(serialsByProduct || {}).flat());
        const foreign = components
          .filter(c => c.productId)
          .flatMap(c => String(nextSerials[c.category]).split(',').map(s => s.trim()).filter(Boolean))
          .filter(s => !owned.has(s));
        if (foreign.length) {
          const error = new Error(`Serial không thuộc hàng đã xuất kho cho đơn ${order.orderId}: ${foreign.join(', ')}.`);
          error.statusCode = 400;
          throw error;
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const savedJob = await tx.assemblyJob.update({
        where: { jobCode: jobId },
        data: {
          status: nextStatus,
          checklist: nextChecklist,
          componentSerials: nextSerials,
          ...(isNewlyCompleted ? {
            completedAt: new Date(),
            completedBy: req.user?.email || req.user?.code || null
          } : {})
        }
      });

      // Bắt đầu lắp ráp → đơn chuyển "Đang xử lý" để khách & các bộ phận thấy tiến độ thật
      if (isStarting && order && order.status === 'CONFIRMED') {
        await tx.order.update({ where: { orderId: order.orderId }, data: { status: 'PROCESSING' } });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.orderId,
            status: 'PROCESSING',
            note: `Kỹ thuật viên bắt đầu lắp ráp (lệnh ${job.jobCode}).`,
            changedBy: req.user?.email || req.user?.code || 'Lắp ráp'
          }
        });
      }

      // Hoàn tất lắp ráp bàn giao đơn cho kho xuất hàng — chỉ đẩy Order thật
      // sang READY_TO_SHIP nếu nó đang ở trạng thái tự nhiên trước lắp ráp,
      // để không ghi đè 1 đơn đã tiến xa hơn vì lý do khác.
      let readyToShipOrderId = null;
      if (isNewlyCompleted && job.orderId) {
        const fresh = await tx.order.findUnique({ where: { orderId: job.orderId } });
        if (fresh && ASSEMBLABLE_ORDER_STATUSES.includes(fresh.status)) {
          await tx.order.update({ where: { orderId: job.orderId }, data: { status: 'READY_TO_SHIP' } });
          await tx.orderStatusHistory.create({
            data: {
              orderId: job.orderId,
              status: 'READY_TO_SHIP',
              note: `Hoàn tất lắp ráp & kiểm thử (lệnh ${job.jobCode}) — sẵn sàng bàn giao kho xuất hàng.`,
              changedBy: req.user?.email || req.user?.code || 'Lắp ráp'
            }
          });
          readyToShipOrderId = job.orderId;
        }
      }

      return { savedJob, readyToShipOrderId };
    });

    // Gửi email báo khách hàng đơn đã sẵn sàng giao — ngoài transaction để lỗi mail
    // (nếu có) không làm rollback việc lắp ráp đã hoàn tất.
    if (updated.readyToShipOrderId) {
      const readyOrder = await prisma.order.findUnique({
        where: { orderId: updated.readyToShipOrderId },
        include: { customer: true, items: { include: { product: true } } }
      });
      if (readyOrder?.customer?.email && !readyOrder.customer.email.endsWith('@aetherpc.local')) {
        sendOrderStatusUpdateEmail({
          toEmail: readyOrder.customer.email,
          customerName: readyOrder.customer.name,
          orderId: readyOrder.orderId,
          status: 'READY_TO_SHIP',
          items: readyOrder.items,
          subtotal: readyOrder.subtotal,
          discount: readyOrder.discount,
          shippingFee: readyOrder.shippingFee,
          vatAmount: readyOrder.vatAmount,
          totalAmount: readyOrder.totalAmount
        }).catch(err => console.warn('[Email] Lỗi gửi email sẵn sàng giao hàng:', err.message));
      }
    }

    res.json({ success: true, data: serializeJob(updated.savedJob, { orderSerials: serialsByProduct || {} }) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/assembly-jobs/:jobId — lệnh gắn đơn hàng đã/đang lắp thì chỉ được huỷ
// (giữ lịch sử, thưởng lắp ráp tính theo lệnh đã nghiệm thu), không xoá hẳn.
const deleteAssemblyJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await prisma.assemblyJob.findUnique({ where: { jobCode: jobId } });
    if (!job) {
      const error = new Error(`Không tìm thấy lệnh lắp ráp: ${jobId}`);
      error.statusCode = 404;
      throw error;
    }
    if (job.status === 'COMPLETED') {
      const error = new Error('Lệnh lắp ráp đã nghiệm thu xuất xưởng — không thể xoá.');
      error.statusCode = 409;
      throw error;
    }
    if (job.orderId) {
      await prisma.assemblyJob.update({ where: { jobCode: jobId }, data: { status: 'CANCELLED' } });
      return res.json({ success: true, message: 'Đã huỷ lệnh lắp ráp.' });
    }
    await prisma.assemblyJob.delete({ where: { jobCode: jobId } });
    res.json({ success: true, message: 'Đã xóa lệnh lắp ráp.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAssemblyJobs, createAssemblyJob, updateAssemblyJob, deleteAssemblyJob };
