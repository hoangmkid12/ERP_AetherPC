const prisma = require('../config/database');

const VALID_TYPES = ['INCOME', 'EXPENSE', 'EXPENSE_PROJECTED', 'SHIPPING', 'REFUND'];

// GET /api/v1/ledger
const getLedger = async (req, res, next) => {
  try {
    const entries = await prisma.ledgerEntry.findMany({ orderBy: { date: 'desc' } });
    res.json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/ledger
const createLedgerEntry = async (req, res, next) => {
  try {
    const { type, amount, description, referenceId, date } = req.body;
    const entryType = String(type || '').toUpperCase();

    if (!VALID_TYPES.includes(entryType)) {
      const error = new Error(`Loại bút toán không hợp lệ: ${type}. Phải là một trong: ${VALID_TYPES.join(', ')}`);
      error.statusCode = 400;
      throw error;
    }
    const parsedAmount = parseFloat(amount);
    if (!(parsedAmount > 0)) {
      const error = new Error('Số tiền bút toán phải lớn hơn 0.');
      error.statusCode = 400;
      throw error;
    }
    if (!description || !String(description).trim()) {
      const error = new Error('Vui lòng nhập diễn giải cho bút toán.');
      error.statusCode = 400;
      throw error;
    }

    const entry = await prisma.ledgerEntry.create({
      data: {
        type: entryType,
        amount: parsedAmount,
        description: String(description).trim(),
        referenceId: referenceId || null,
        date: date ? new Date(date) : new Date()
      }
    });
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/ledger/:id
const updateLedgerEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, amount, description, referenceId, date } = req.body;

    const existing = await prisma.ledgerEntry.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Không tìm thấy bút toán: ${id}`);
      error.statusCode = 404;
      throw error;
    }

    if (type && !VALID_TYPES.includes(String(type).toUpperCase())) {
      const error = new Error(`Loại bút toán không hợp lệ: ${type}.`);
      error.statusCode = 400;
      throw error;
    }
    if (amount !== undefined && !(parseFloat(amount) > 0)) {
      const error = new Error('Số tiền bút toán phải lớn hơn 0.');
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.ledgerEntry.update({
      where: { id },
      data: {
        ...(type ? { type: String(type).toUpperCase() } : {}),
        ...(amount !== undefined ? { amount: parseFloat(amount) } : {}),
        ...(description !== undefined ? { description: String(description).trim() } : {}),
        ...(referenceId !== undefined ? { referenceId } : {}),
        ...(date ? { date: new Date(date) } : {})
      }
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/ledger/:id
const deleteLedgerEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.ledgerEntry.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Không tìm thấy bút toán: ${id}`);
      error.statusCode = 404;
      throw error;
    }
    await prisma.ledgerEntry.delete({ where: { id } });
    res.json({ success: true, message: 'Đã xóa bút toán.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLedger, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry };
