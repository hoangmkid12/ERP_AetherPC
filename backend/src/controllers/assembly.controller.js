const prisma = require('../config/database');
const { sendOrderStatusUpdateEmail } = require('../services/emailService');

const REQUIRED_CHECKLIST_KEYS = ['biosPost', 'osInstall', 'stressTest', 'qcSeal'];

// Job responses expose `id` as an alias of `jobCode`, and `date` as a
// Vietnamese-locale string derived from `createdAt` — the frontend was
// written against a client-generated `job.id`/`job.date` shape, so mirroring
// both here avoids rewiring every existing `.id`/`.date` display site.
const serializeJob = (job) => ({
  ...job,
  id: job.jobCode,
  customer: job.customerName,
  date: new Date(job.createdAt).toLocaleDateString('vi-VN')
});

// GET /api/v1/assembly-jobs
const getAssemblyJobs = async (req, res, next) => {
  try {
    const jobs = await prisma.assemblyJob.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: jobs.map(serializeJob) });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/assembly-jobs
const createAssemblyJob = async (req, res, next) => {
  try {
    const { orderId, customer, customerName, components, checklist, componentSerials, status } = req.body;
    const custName = customerName || customer;

    if (!custName || !String(custName).trim()) {
      const error = new Error('Vui lòng nhập tên khách hàng hoặc mục đích lệnh lắp ráp.');
      error.statusCode = 400;
      throw error;
    }
    const validComponents = Array.isArray(components) ? components.filter(c => c && c.name && String(c.name).trim()) : [];
    if (validComponents.length === 0) {
      const error = new Error('Vui lòng điền ít nhất 1 linh kiện cần lắp ráp.');
      error.statusCode = 400;
      throw error;
    }

    if (orderId) {
      const existing = await prisma.assemblyJob.findFirst({ where: { orderId } });
      if (existing) {
        const error = new Error(`Đơn hàng ${orderId} đã có lệnh lắp ráp ${existing.jobCode}.`);
        error.statusCode = 409;
        throw error;
      }
    }

    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const jobCode = `ASM-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    const job = await prisma.assemblyJob.create({
      data: {
        jobCode,
        orderId: orderId || null,
        customerName: custName,
        components: validComponents,
        checklist: checklist || { biosPost: false, osInstall: false, stressTest: false, qcSeal: false },
        componentSerials: componentSerials || {},
        status: status || 'PENDING',
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
    if (job.status === 'CANCELLED') {
      const error = new Error('Lệnh lắp ráp này đã bị hủy, không thể thao tác.');
      error.statusCode = 409;
      throw error;
    }

    const nextChecklist = checklist ?? job.checklist;
    const nextSerials = componentSerials ?? job.componentSerials;
    const nextStatus = status || job.status;
    const isNewlyCompleted = nextStatus === 'COMPLETED' && job.status !== 'COMPLETED';

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
      const components = Array.isArray(job.components) ? job.components : [];
      const allSerialed = components.every(c => !!nextSerials?.[c.category]);
      if (!allSerialed) {
        const error = new Error('Thiếu mã Serial Number — cần gán đủ S/N cho mọi linh kiện trước khi nghiệm thu.');
        error.statusCode = 400;
        throw error;
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

      // Hoàn tất lắp ráp bàn giao đơn cho kho xuất hàng — chỉ đẩy Order thật
      // sang READY_TO_SHIP nếu nó đang ở trạng thái tự nhiên trước lắp ráp,
      // để không ghi đè 1 đơn đã tiến xa hơn vì lý do khác.
      let readyToShipOrderId = null;
      if (isNewlyCompleted && job.orderId) {
        const order = await tx.order.findUnique({ where: { orderId: job.orderId } });
        if (order && ['CONFIRMED', 'PROCESSING'].includes(order.status)) {
          await tx.order.update({ where: { orderId: job.orderId }, data: { status: 'READY_TO_SHIP' } });
          await tx.orderStatusHistory.create({
            data: {
              orderId: job.orderId,
              status: 'READY_TO_SHIP',
              note: `Hoàn tất lắp ráp (lệnh ${job.jobCode}) — sẵn sàng bàn giao kho xuất hàng.`,
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
      if (readyOrder?.customer?.email) {
        sendOrderStatusUpdateEmail({
          toEmail: readyOrder.customer.email,
          customerName: readyOrder.customer.name,
          orderId: readyOrder.orderId,
          status: 'READY_TO_SHIP',
          items: readyOrder.items,
          subtotal: readyOrder.subtotal,
          discount: readyOrder.discount,
          shippingFee: readyOrder.shippingFee,
          totalAmount: readyOrder.totalAmount
        }).catch(err => console.warn('[Email] Lỗi gửi email sẵn sàng giao hàng:', err.message));
      }
    }

    res.json({ success: true, data: serializeJob(updated.savedJob) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/assembly-jobs/:jobId
const deleteAssemblyJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await prisma.assemblyJob.findUnique({ where: { jobCode: jobId } });
    if (!job) {
      const error = new Error(`Không tìm thấy lệnh lắp ráp: ${jobId}`);
      error.statusCode = 404;
      throw error;
    }
    await prisma.assemblyJob.delete({ where: { jobCode: jobId } });
    res.json({ success: true, message: 'Đã xóa lệnh lắp ráp.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAssemblyJobs, createAssemblyJob, updateAssemblyJob, deleteAssemblyJob };
