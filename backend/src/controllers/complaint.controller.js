const prisma = require('../config/database');

// Frontend was always written against `.title`, never `.subject` — alias it
// in responses so CustomerService.jsx/MyOrders.jsx need no rewiring.
const serializeComplaint = (c) => ({ ...c, title: c.subject });

// GET /api/v1/complaints
const getComplaints = async (req, res, next) => {
  try {
    const where = req.user?.role === 'CUSTOMER' ? { customerId: req.user.id } : {};
    const complaints = await prisma.complaint.findMany({
      where,
      include: { assignedTo: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: complaints.map(serializeComplaint) });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/complaints
const createComplaint = async (req, res, next) => {
  try {
    const { customerName, phone, email, orderId, title, subject, description, priority, evidenceUrl } = req.body;
    const finalSubject = subject || title;

    if (!customerName || !String(customerName).trim()) {
      const error = new Error('Vui lòng nhập tên khách hàng.');
      error.statusCode = 400;
      throw error;
    }
    if (!finalSubject || !String(finalSubject).trim()) {
      const error = new Error('Vui lòng nhập tiêu đề khiếu nại.');
      error.statusCode = 400;
      throw error;
    }
    if (!description || !String(description).trim()) {
      const error = new Error('Vui lòng nhập nội dung khiếu nại.');
      error.statusCode = 400;
      throw error;
    }

    const complaint = await prisma.complaint.create({
      data: {
        customerId: req.user?.role === 'CUSTOMER' ? req.user.id : null,
        orderId: orderId || null,
        customerName: String(customerName).trim(),
        phone: phone || null,
        email: email || null,
        subject: String(finalSubject).trim(),
        description,
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(String(priority).toUpperCase()) ? String(priority).toUpperCase() : 'MEDIUM',
        status: 'OPEN',
        resolutionNote: evidenceUrl ? `Minh chứng: ${evidenceUrl}` : null
      }
    });
    res.status(201).json({ success: true, data: serializeComplaint(complaint) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/complaints/:id
const updateComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, assignedTo, assignedToId, resolution, resolutionNote, priority } = req.body;

    const existing = await prisma.complaint.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Không tìm thấy khiếu nại: ${id}`);
      error.statusCode = 404;
      throw error;
    }

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (status && !validStatuses.includes(status)) {
      const error = new Error(`Trạng thái không hợp lệ: ${status}.`);
      error.statusCode = 400;
      throw error;
    }

    const finalAssignedToId = Number.isInteger(Number(assignedToId ?? assignedTo)) ? Number(assignedToId ?? assignedTo) : undefined;

    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(finalAssignedToId !== undefined ? { assignedToId: finalAssignedToId } : {}),
        ...(resolution !== undefined || resolutionNote !== undefined ? { resolutionNote: resolutionNote ?? resolution } : {}),
        ...(priority ? { priority: String(priority).toUpperCase() } : {})
      },
      include: { assignedTo: { select: { id: true, fullName: true } } }
    });
    res.json({ success: true, data: serializeComplaint(updated) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/complaints/:id
const deleteComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.complaint.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Không tìm thấy khiếu nại: ${id}`);
      error.statusCode = 404;
      throw error;
    }
    await prisma.complaint.delete({ where: { id } });
    res.json({ success: true, message: 'Đã xóa khiếu nại.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getComplaints, createComplaint, updateComplaint, deleteComplaint };
