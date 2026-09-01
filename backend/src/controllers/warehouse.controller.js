const prisma = require('../config/database');

// GET /api/v1/warehouse/receipts
// Lấy danh sách phiếu nhận hàng (GoodsReceipt) kèm thông tin PO, items, product
const getReceipts = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const receipts = await prisma.goodsReceipt.findMany({
      where,
      include: {
        po: {
          include: {
            supplier: true,
            items: {
              include: {
                product: {
                  select: {
                    productId: true,
                    name: true,
                    sku: true,
                    price: true,
                    stockQuantity: true,
                    primaryImage: true
                  }
                }
              }
            }
          }
        },
        warehouse: true,
        qcInspections: {
          include: {
            inspector: { select: { id: true, fullName: true, employeeCode: true } }
          },
          orderBy: { id: 'desc' }
        }
      },
      orderBy: { id: 'desc' }
    });

    res.json({ success: true, data: receipts });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/warehouse/receipts/:id
const getReceiptById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id: parseInt(id) },
      include: {
        po: {
          include: {
            supplier: true,
            items: {
              include: {
                product: {
                  select: {
                    productId: true,
                    name: true,
                    sku: true,
                    price: true,
                    stockQuantity: true,
                    primaryImage: true
                  }
                }
              }
            }
          }
        },
        warehouse: true,
        qcInspections: {
          include: {
            inspector: { select: { id: true, fullName: true, employeeCode: true } }
          },
          orderBy: { id: 'desc' }
        }
      }
    });

    if (!receipt) {
      return res.status(404).json({ success: false, message: `Receipt not found: ${id}` });
    }

    res.json({ success: true, data: receipt });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/warehouse/receipts/:id/validate
// Xác nhận nhập kho - cập nhật Inventory, StockMovement, Product.stockQuantity
const validateReceipt = async (req, res, next) => {
  try {
    const { id } = req.params;
    const receivedBy = req.user ? req.user.email || req.user.code || 'Warehouse Staff' : 'Warehouse Staff';

    const updatedReceipt = await prisma.$transaction(async (tx) => {
      // Atomically claim this receipt first: the conditional updateMany
      // takes a row lock, so a concurrent duplicate request (double-click,
      // or the sibling /purchasing/receipts/:id/validate route hitting the
      // same receipt) can never both pass this gate and double-count stock.
      const claim = await tx.goodsReceipt.updateMany({
        where: { id: parseInt(id), status: { not: 'DONE' } },
        data: { status: 'DONE', receivedBy, receivedDate: new Date() }
      });
      if (claim.count !== 1) {
        const error = new Error('Phiếu nhập kho không tồn tại hoặc đã được xác nhận trước đó.');
        error.statusCode = 409;
        throw error;
      }

      const receipt = await tx.goodsReceipt.findUnique({
        where: { id: parseInt(id) },
        include: { po: { include: { items: true, supplier: true } } }
      });
      if (!receipt) throw new Error(`Receipt not found: ${id}`);

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

      // Increment inventory for each item in PO (scaled down for a partial QC acceptance)
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

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            toWarehouseId: receipt.receivedWarehouseId,
            type: 'IN',
            quantity: intakeQty,
            referenceId: receipt.receiptNumber || receipt.id.toString(),
            note: `Nhập kho từ Phiếu Nhận Hàng ${receipt.receiptNumber} (PO: ${po.poNumber}${po.status === 'QA_PARTIAL' ? ', nghiệm thu một phần' : ''})`,
            createdBy: receivedBy
          }
        });

        // Update product stock quantity
        await tx.product.update({
          where: { productId: item.productId },
          data: { stockQuantity: { increment: intakeQty } }
        });
      }

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: 'RECEIVED' }
      });

      // Check if all receipts and bills for this PO are completed → update PO status to DONE
      const allReceipts = await tx.goodsReceipt.findMany({ where: { poId: po.id } });
      const allBills = await tx.vendorBill.findMany({ where: { poId: po.id } });

      const receiptsDone = allReceipts.length > 0 && allReceipts.every(r => r.status === 'DONE');
      const billsPaid = allBills.length > 0 && allBills.every(b => b.status === 'PAID');

      if (receiptsDone && billsPaid) {
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: 'DONE' }
        });
      }

      return tx.goodsReceipt.findUnique({
        where: { id: receipt.id },
        include: {
          po: {
            include: {
              supplier: true,
              items: { include: { product: true } }
            }
          },
          warehouse: true
        }
      });
    });

    res.json({
      success: true,
      message: 'Xác nhận nhập kho thành công!',
      data: updatedReceipt
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/warehouse/stock-movements
const getStockMovements = async (req, res, next) => {
  try {
    const { limit = 50, type } = req.query;
    const where = {};
    if (type && type !== 'ALL') {
      where.type = type;
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: {
          select: {
            productId: true,
            name: true,
            sku: true
          }
        },
        toWarehouse: { select: { id: true, name: true } },
        fromWarehouse: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    res.json({ success: true, data: movements });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/warehouse/inventory
const getInventory = async (req, res, next) => {
  try {
    const inventoryData = await prisma.inventory.findMany({
      include: {
        product: {
          select: {
            productId: true,
            name: true,
            sku: true,
            price: true,
            stockQuantity: true,
            primaryImage: true
          }
        },
        warehouse: { select: { id: true, name: true } },
        location: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({ success: true, data: inventoryData });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/warehouse/inventory/adjust
// Nhập kho trực tiếp / kiểm kê bổ sung — không qua đơn mua PO. Trước đây tab
// này ở frontend chỉ ghi localStorage, không có route nào chạm tới CSDL thật.
const adjustInventory = async (req, res, next) => {
  try {
    const { productId, quantity, warehouseId, location, reason, note, refCode } = req.body;
    const qty = parseInt(quantity, 10);
    const whId = parseInt(warehouseId, 10) || 1;
    const actor = req.user?.fullname || req.user?.email || req.user?.code || 'Thủ Kho';

    if (!productId || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Cần chọn sản phẩm và số lượng nhập là số nguyên dương.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { productId: String(productId) } });
      if (!product) {
        const err = new Error(`Không tìm thấy sản phẩm với mã: ${productId}`);
        err.statusCode = 404;
        throw err;
      }

      const updatedProduct = await tx.product.update({
        where: { productId: product.productId },
        data: { stockQuantity: { increment: qty } }
      });

      const existingInventory = await tx.inventory.findFirst({
        where: { productId: product.productId, warehouseId: whId }
      });

      const inventoryRow = existingInventory
        ? await tx.inventory.update({
            where: { id: existingInventory.id },
            data: { quantityOnHand: { increment: qty } }
          })
        : await tx.inventory.create({
            data: { productId: product.productId, warehouseId: whId, quantityOnHand: qty }
          });

      const movement = await tx.stockMovement.create({
        data: {
          productId: product.productId,
          toWarehouseId: whId,
          type: 'IN',
          quantity: qty,
          referenceId: refCode || `DIR-${Date.now().toString().slice(-8)}`,
          note: `Nhập trực tiếp / Kiểm kê (${reason || 'DIRECT_PURCHASE'})${location ? ` — Vị trí: ${location}` : ''}. ${note || ''}`.trim(),
          createdBy: actor
        }
      });

      return { product: updatedProduct, inventory: inventoryRow, movement };
    });

    res.json({ success: true, message: 'Đã ghi nhận nhập kho trực tiếp thành công.', data: result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = {
  getReceipts,
  getReceiptById,
  validateReceipt,
  getStockMovements,
  getInventory,
  adjustInventory
};
