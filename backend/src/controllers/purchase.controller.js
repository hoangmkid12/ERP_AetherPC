const prisma = require('../config/database');

// GET /api/v1/purchasing/suppliers
const getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: suppliers });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/purchasing/products
const getPurchasingProducts = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        productId: true,
        name: true,
        sku: true,
        price: true
      },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/purchasing/orders
const getPurchaseOrders = async (req, res, next) => {
  try {
    const where = req.user?.role === 'SUPPLIER'
      ? { supplierCode: req.user.code }
      : {};
    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        },
        receipts: {
          include: {
            qcInspections: {
              include: {
                inspector: { select: { id: true, fullName: true, employeeCode: true } }
              },
              orderBy: { id: 'desc' }
            }
          }
        },
        bills: {
          include: {
            payments: true
          }
        },
        statusHistory: {
          orderBy: { timestamp: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/purchasing/orders
const createPurchaseOrder = async (req, res, next) => {
  try {
    const { supplierCode, expectedDeliveryDate, items } = req.body;
    const createdBy = req.user ? req.user.email || req.user.code || 'Staff' : 'Staff';

    if (!supplierCode || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Supplier and items are required' });
    }

    const newPO = await prisma.$transaction(async (tx) => {
      // 1. Check if supplier exists
      const supplier = await tx.supplier.findUnique({
        where: { code: supplierCode }
      });
      if (!supplier) {
        throw new Error(`Supplier not found: ${supplierCode}`);
      }

      // 2. Generate poNumber (PO-YYYYMMDD-XXXX)
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randCode = Math.floor(1000 + Math.random() * 9000);
      const poNumber = `PO-${dateStr}-${randCode}`;

      // 3. Process items and calculate total amount
      let totalAmount = 0;
      const itemsData = [];

      for (const item of items) {
        const targetProdId = String(item.productId || '');
        let prod = await tx.product.findUnique({
          where: { productId: targetProdId }
        });
        if (!prod) {
          // Product's primary key is `productId` (String) — there is no numeric `id` field,
          // so the fallback lookup can only retry by SKU.
          prod = await tx.product.findFirst({
            where: {
              OR: [
                { productId: targetProdId },
                { sku: targetProdId }
              ]
            }
          });
        }
        if (!prod) {
          throw new Error(`Không tìm thấy sản phẩm trong CSDL với mã: ${item.productId}`);
        }

        const quantity = parseInt(item.quantity);
        const unitCost = item.unitCost ? parseFloat(item.unitCost) : 0; // RFQ: NCC sẽ nhập giá sau
        const totalCost = unitCost * quantity;

        totalAmount += totalCost;

        itemsData.push({
          productId: prod.productId,
          quantity,
          unitCost,
          totalCost
        });
      }

      // 4. Create the purchase order (Standard Odoo starts with RFQ)
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierCode,
          status: 'RFQ',
          totalAmount,
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
          createdBy,
          items: {
            create: itemsData
          }
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      await tx.purchaseOrderStatusHistory.create({
        data: {
          poId: po.id,
          status: 'RFQ',
          note: 'Khởi tạo Yêu Cầu Báo Giá (RFQ)',
          changedBy: req.user?.email || req.user?.code || req.user?.name || null,
          changedByRole: req.user?.role || null
        }
      });

      return po;
    });

    res.status(201).json({
      success: true,
      message: 'Purchase Order created successfully (RFQ)',
      data: newPO
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/purchasing/orders/:id/status
const updatePurchaseOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, itemPrices, reason, expectedDeliveryDate, supplierNote, passedQty, failedQty, sampleRate, qcNotes } = req.body;

    const validStatuses = ['RFQ', 'RFQ_SENT', 'SENT', 'QUOTED', 'PO', 'APPROVED', 'CONFIRMED_BY_SUPPLIER', 'PENDING_QA', 'QA_PASSED', 'QA_PARTIAL', 'QA_REJECTED', 'RECEIVED', 'DONE', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}` });
    }

    const updatedPO = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: Number.isInteger(Number(id)) ? { id: Number(id) } : { poNumber: id },
        include: { items: true }
      });

      if (!po) {
        throw new Error(`Purchase Order not found: ${id}`);
      }

      const userRole = req.user?.role;
      const isAdmin = ['ADMIN', 'CEO'].includes(userRole);
      // Several frontend screens fire an optimistic store update *and* a dedicated API
      // call for the same status change (to keep the local Zustand cache in sync). The
      // two requests race, so the one that lands second must not be rejected as an
      // "invalid transition" just because the first one already applied it — it's simply
      // re-affirming the current status (and may still carry extra fields, e.g. itemPrices
      // or QC quantities, that need to be applied).
      const isNoOpResubmit = status === po.status;

      if (userRole === 'CEO' && !isNoOpResubmit && status !== 'CANCELLED' && !(po.status === 'QUOTED' && status === 'PO')) {
        const error = new Error('CEO chỉ phê duyệt báo giá để phát hành PO hoặc hủy đơn trong trường hợp ngoại lệ.');
        error.statusCode = 403;
        throw error;
      }
      if (userRole === 'SUPPLIER') {
        if (po.supplierCode !== req.user?.code) {
          const error = new Error('Nhà cung cấp chỉ được thao tác trên đơn hàng của mình.');
          error.statusCode = 403;
          throw error;
        }
        const allowedTransitions = {
          RFQ: ['QUOTED', 'CANCELLED'],
          RFQ_SENT: ['QUOTED', 'CANCELLED'],
          SENT: ['QUOTED', 'CANCELLED'],
          PO: ['CONFIRMED_BY_SUPPLIER'],
          APPROVED: ['CONFIRMED_BY_SUPPLIER']
        };
        if (!isNoOpResubmit && !allowedTransitions[po.status]?.includes(status)) {
          const error = new Error('Nhà cung cấp không thể chuyển đơn hàng sang trạng thái này.');
          error.statusCode = 403;
          throw error;
        }
      }

      // Enforce the purchasing workflow for all operational roles. Admin and CEO
      // retain an override only for exceptional cancellation/approval handling.
      if (!isAdmin && userRole !== 'SUPPLIER' && !isNoOpResubmit) {
        const allowedTransitionsByRole = {
          PURCHASING: {
            RFQ: ['RFQ_SENT', 'CANCELLED'],
            RFQ_SENT: ['CANCELLED'],
            QUOTED: ['CANCELLED']
          },
          QC: { CONFIRMED_BY_SUPPLIER: ['QA_PASSED', 'QA_PARTIAL', 'QA_REJECTED'] },
          QA: { CONFIRMED_BY_SUPPLIER: ['QA_PASSED', 'QA_PARTIAL', 'QA_REJECTED'] }
        };
        const permitted = allowedTransitionsByRole[userRole];
        if (!permitted || !permitted[po.status]?.includes(status)) {
          const error = new Error('Trạng thái đơn hàng không hợp lệ cho vai trò hiện tại.');
          error.statusCode = 403;
          throw error;
        }
      }

      // Check restriction: ONLY CEO (or ADMIN) can approve QUOTED -> PO
      if (status === 'PO' && po.status === 'QUOTED') {
        if (userRole !== 'CEO' && userRole !== 'ADMIN') {
          throw new Error('Chỉ CEO (Ban Giám Đốc) mới có quyền duyệt báo giá mua hàng.');
        }
      }

      // If supplier is quoting prices (RFQ_SENT → QUOTED) or confirming (→ PO / CONFIRMED_BY_SUPPLIER), update item prices first
      if (['QUOTED', 'PO', 'CONFIRMED_BY_SUPPLIER'].includes(status) && itemPrices && itemPrices.length > 0) {
        let newTotal = 0;
        for (const priceInfo of itemPrices) {
          const item = po.items.find(i => String(i.id) === String(priceInfo.itemId));
          if (item && priceInfo.unitCost > 0) {
            const totalCost = parseFloat(priceInfo.unitCost) * item.quantity;
            await tx.purchaseOrderItem.update({
              where: { id: item.id },
              data: {
                unitCost: parseFloat(priceInfo.unitCost),
                totalCost: totalCost
              }
            });
            newTotal += totalCost;
          }
        }

        // Update total amount on the PO
        if (newTotal > 0) {
          await tx.purchaseOrder.update({
            where: { id: po.id },
            data: { totalAmount: newTotal }
          });
        }
      }

      const updateData = { status };
      if (expectedDeliveryDate) {
        updateData.expectedDeliveryDate = new Date(expectedDeliveryDate);
      }
      if (reason || supplierNote || status === 'CANCELLED') {
        updateData.cancelReason = reason || supplierNote || null;
      }

      const updated = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: updateData,
        include: {
          supplier: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // Record this transition for the approval-history timeline. Skipped on a no-op
      // resubmit (see isNoOpResubmit above) so a racing duplicate request from the
      // frontend doesn't log the same decision twice.
      if (!isNoOpResubmit) {
        await tx.purchaseOrderStatusHistory.create({
          data: {
            poId: updated.id,
            status,
            note: reason || supplierNote || qcNotes || null,
            changedBy: req.user?.email || req.user?.code || req.user?.name || null,
            changedByRole: userRole || null
          }
        });
      }

      // Automatically generate a GoodsReceipt in READY state when Supplier Confirms delivery (CONFIRMED_BY_SUPPLIER)
      if (status === 'CONFIRMED_BY_SUPPLIER' && po.status !== 'CONFIRMED_BY_SUPPLIER') {
        const existingReceipt = await tx.goodsReceipt.findFirst({ where: { poId: updated.id } });
        if (!existingReceipt) {
          const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
          const randCode = Math.floor(100 + Math.random() * 900);
          const receiptNumber = `WH/IN/${dateStr}/${randCode}`;

          await tx.goodsReceipt.create({
            data: {
              receiptNumber,
              poId: updated.id,
              receivedWarehouseId: 1, // Default warehouse
              status: 'READY',
              note: `Tự động tạo từ Đơn Mua Hàng ${updated.poNumber} (NCC đã xác nhận & hẹn giao)`
            }
          });
        }
      }

      // A rejected QA result voids the pending receipt; its stock can never be
      // received until Purchasing creates a replacement order.
      if (status === 'QA_REJECTED') {
        await tx.goodsReceipt.updateMany({
          where: { poId: updated.id, status: 'READY' },
          data: { status: 'CANCELLED', note: `QA/QC từ chối lô hàng: ${supplierNote || reason || 'Không đạt chất lượng'}` }
        });
      }

      // Persist the QC/QA inspection outcome so `validateReceipt` knows exactly how many
      // units actually passed (needed for QA_PARTIAL, where only part of the shipment
      // may enter stock) instead of guessing from the full PO item quantity. Skip this on
      // a no-op resubmit (see isNoOpResubmit above) so a racing duplicate request doesn't
      // create a second inspection record for the same decision.
      if (!isNoOpResubmit && ['QA_PASSED', 'QA_PARTIAL', 'QA_REJECTED'].includes(status)) {
        const receipt = await tx.goodsReceipt.findFirst({
          where: { poId: updated.id },
          orderBy: { id: 'desc' }
        });

        if (receipt) {
          const totalQty = po.items.reduce((sum, i) => sum + i.quantity, 0);
          const parsedPassed = parseInt(passedQty);
          const parsedFailed = parseInt(failedQty);
          const passedQuantity = Number.isFinite(parsedPassed)
            ? parsedPassed
            : (status === 'QA_PASSED' ? totalQty : 0);
          const defectiveQuantity = Number.isFinite(parsedFailed)
            ? parsedFailed
            : Math.max(totalQty - passedQuantity, 0);
          const inspectorId = Number.isInteger(Number(req.user?.id)) ? Number(req.user.id) : null;
          const parsedSampleRate = parseInt(sampleRate);

          await tx.qcInspection.create({
            data: {
              receiptId: receipt.id,
              inspectorId,
              sampleRate: Number.isFinite(parsedSampleRate) ? parsedSampleRate : 100,
              passedQuantity,
              defectiveQuantity,
              status: status === 'QA_PASSED' ? 'PASSED' : status === 'QA_REJECTED' ? 'FAILED' : 'CONDITIONAL',
              notes: qcNotes || supplierNote || reason || null
            }
          });
        }
      }

      return updated;
    });

    res.json({
      success: true,
      message: `Status updated to ${status} successfully`,
      data: updatedPO
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/purchasing/orders/:id/bills
const createVendorBill = async (req, res, next) => {
  try {
    const { id } = req.params; // poId

    const bill = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: parseInt(id) },
        include: { supplier: true }
      });
      if (!po) throw new Error(`Purchase Order not found: ${id}`);
      if (!['RECEIVED', 'DONE', 'COMPLETED'].includes(po.status)) {
        const error = new Error('Chỉ có thể ghi nhận hóa đơn NCC sau khi kho đã hoàn tất nhập hàng.');
        error.statusCode = 409;
        throw error;
      }

      // Generate billNumber
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const billNumber = `BILL/${dateStr}/${Math.floor(1000 + Math.random() * 9000)}`;

      const newBill = await tx.vendorBill.create({
        data: {
          poId: po.id,
          supplierCode: po.supplierCode,
          billNumber,
          status: 'POSTED',
          amountTotal: po.totalAmount,
          amountDue: po.totalAmount,
          amountPaid: 0,
          billDate: new Date(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        }
      });
      return newBill;
    });

    res.status(201).json({ success: true, message: 'Vendor Bill created successfully', data: bill });
  } catch (err) {
    next(err);
  }
};

// Helper function to check if PO is fully completed (all receipts DONE and all bills PAID)
const checkAndUpdatePoCompletion = async (tx, poId) => {
  const allReceipts = await tx.goodsReceipt.findMany({ where: { poId } });
  const allBills = await tx.vendorBill.findMany({ where: { poId } });

  const receiptsDone = allReceipts.length > 0 && allReceipts.every(r => r.status === 'DONE');
  const billsPaid = allBills.length > 0 && allBills.every(b => b.status === 'PAID');

  if (receiptsDone && billsPaid) {
    await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'DONE' }
    });
    return true;
  }
  return false;
};

// POST /api/v1/purchasing/bills/:billId/payments
const registerPayment = async (req, res, next) => {
  try {
    const { billId } = req.params;
    const { paymentMethod, amount } = req.body;

    const payment = await prisma.$transaction(async (tx) => {
      const bill = await tx.vendorBill.findUnique({
        where: { id: parseInt(billId) }
      });
      if (!bill) throw new Error(`Vendor Bill not found: ${billId}`);
      if (bill.status === 'PAID') throw new Error('Bill is already fully paid.');

      const payAmount = amount ? parseFloat(amount) : parseFloat(bill.amountDue);
      if (!(payAmount > 0)) {
        const error = new Error('Số tiền thanh toán phải lớn hơn 0.');
        error.statusCode = 400;
        throw error;
      }
      if (payAmount > parseFloat(bill.amountDue)) {
        const error = new Error(`Số tiền thanh toán (${payAmount}) vượt quá công nợ còn lại (${bill.amountDue}).`);
        error.statusCode = 400;
        throw error;
      }

      const newPayment = await tx.vendorPayment.create({
        data: {
          billId: bill.id,
          amount: payAmount,
          paymentMethod: paymentMethod || 'Bank Transfer',
        }
      });

      const newAmountPaid = parseFloat(bill.amountPaid) + payAmount;
      const newAmountDue = parseFloat(bill.amountTotal) - newAmountPaid;

      await tx.vendorBill.update({
        where: { id: bill.id },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newAmountDue <= 0 ? 'PAID' : 'POSTED'
        }
      });

      // Check if PO is completed
      await checkAndUpdatePoCompletion(tx, bill.poId);

      return newPayment;
    });

    res.status(201).json({ success: true, message: 'Payment registered successfully', data: payment });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/purchasing/receipts/:receiptId/validate
const validateReceipt = async (req, res, next) => {
  try {
    const { receiptId } = req.params;
    const receivedBy = req.user ? req.user.email || req.user.code || 'Warehouse Staff' : 'Warehouse Staff';

    const updatedReceipt = await prisma.$transaction(async (tx) => {
      // Atomically claim this receipt first: the conditional updateMany
      // takes a row lock, so a concurrent duplicate request (double-click,
      // or the sibling /warehouse/receipts/:id/validate route hitting the
      // same receipt) can never both pass this gate and double-count stock.
      const claim = await tx.goodsReceipt.updateMany({
        where: { id: parseInt(receiptId), status: { not: 'DONE' } },
        data: { status: 'DONE', receivedBy, receivedDate: new Date() }
      });
      if (claim.count !== 1) {
        const error = new Error('Phiếu nhập kho không tồn tại hoặc đã được xác nhận trước đó.');
        error.statusCode = 409;
        throw error;
      }

      const receipt = await tx.goodsReceipt.findUnique({
        where: { id: parseInt(receiptId) },
        include: { po: { include: { items: true } } }
      });
      if (!receipt) throw new Error(`Receipt not found: ${receiptId}`);

      const po = receipt.po;
      if (!['QA_PASSED', 'QA_PARTIAL'].includes(po.status)) {
        const error = new Error('Lô hàng phải được QA/QC xác nhận đạt chất lượng (toàn phần hoặc một phần) trước khi nhập kho.');
        error.statusCode = 409;
        throw error;
      }

      // For a partial QC acceptance, only the quantity QC actually passed may enter stock —
      // scale each item's quantity by the ratio recorded on the receipt's QcInspection.
      let passRatio = 1;
      if (po.status === 'QA_PARTIAL') {
        const inspection = await tx.qcInspection.findFirst({
          where: { receiptId: receipt.id },
          orderBy: { id: 'desc' }
        });
        const totalQty = po.items.reduce((sum, i) => sum + i.quantity, 0);
        passRatio = (inspection && totalQty > 0)
          ? Math.max(0, Math.min(1, inspection.passedQuantity / totalQty))
          : 0; // No inspection record on file — don't guess, receive nothing until QC data exists.
      }

      // Increment inventory (scaled down for a partial QC acceptance)
      for (const item of po.items) {
        const intakeQty = po.status === 'QA_PARTIAL' ? Math.round(item.quantity * passRatio) : item.quantity;
        if (intakeQty <= 0) continue;

        const inventory = await tx.inventory.findFirst({
          where: { productId: item.productId, warehouseId: receipt.receivedWarehouseId }
        });

        if (inventory) {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantityOnHand: { increment: intakeQty } }
          });
        } else {
          await tx.inventory.create({
            data: {
              productId: item.productId,
              warehouseId: receipt.receivedWarehouseId,
              // locationId is optional — leave unassigned rather than
              // hardcoding a WarehouseLocation id that may not exist.
              quantityOnHand: intakeQty,
              quantityReserved: 0,
              reorderPoint: 5
            }
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            toWarehouseId: receipt.receivedWarehouseId,
            type: 'IN',
            quantity: intakeQty,
            referenceId: receipt.receiptNumber || receipt.id.toString(),
            note: `Nhập kho từ Phiếu Nhận Hàng ${receipt.receiptNumber}${po.status === 'QA_PARTIAL' ? ' (nghiệm thu một phần)' : ''}`
          }
        });

        await tx.product.update({
          where: { productId: item.productId },
          data: { stockQuantity: { increment: intakeQty } }
        });
      }

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: 'RECEIVED' }
      });

      // Check if PO is completed
      await checkAndUpdatePoCompletion(tx, po.id);

      return tx.goodsReceipt.findUnique({ where: { id: receipt.id } });
    });

    res.json({ success: true, message: 'Goods receipt validated successfully', data: updatedReceipt });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSuppliers,
  getPurchasingProducts,
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  createVendorBill,
  registerPayment,
  validateReceipt
};
