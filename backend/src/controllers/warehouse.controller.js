const prisma = require('../config/database');
const { computeBlendedAverageCost } = require('../utils/inventoryCosting');
const { logAudit } = require('../utils/auditLog');

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
//
// ⚠️ DUPLICATED LOGIC: purchase.controller.js's validateReceipt (same name,
// POST /api/v1/purchasing/receipts/:receiptId/validate) reimplements this
// exact same transaction. See the matching warning there — keep both in
// sync until they're deliberately consolidated.
const validateReceipt = async (req, res, next) => {
  try {
    const { id } = req.params;
    // { [productId]: string[] } — one Serial Number per unit being received for
    // that line. Required for every category (see utils/serialAllocation.js).
    const serials = req.body?.serials || {};
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

        // Serial Number bắt buộc cho mọi linh kiện nhập kho.
        const itemSerials = Array.isArray(serials[item.productId]) ? serials[item.productId].map(s => String(s).trim()).filter(Boolean) : [];
        if (itemSerials.length !== intakeQty) {
          const error = new Error(`Sản phẩm ${item.productId}: cần quét đủ ${intakeQty} Serial Number, hiện có ${itemSerials.length}.`);
          error.statusCode = 400;
          throw error;
        }
        if (new Set(itemSerials).size !== itemSerials.length) {
          const error = new Error(`Sản phẩm ${item.productId}: danh sách Serial Number có mã bị trùng lặp.`);
          error.statusCode = 400;
          throw error;
        }

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

        // Blend this intake's real PO unit cost into the product's running
        // weighted-average cost (VAS "bình quân gia quyền") before applying the
        // increment — this is what lets a sale later record real COGS instead of
        // total NCC purchase spend being mistaken for cost of goods sold.
        const currentProduct = await tx.product.findUnique({
          where: { productId: item.productId },
          select: { stockQuantity: true, averageCost: true }
        });
        const newAverageCost = computeBlendedAverageCost(
          currentProduct?.stockQuantity || 0,
          Number(currentProduct?.averageCost || 0),
          intakeQty,
          Number(item.unitCost) || 0
        );

        await tx.product.update({
          where: { productId: item.productId },
          data: { stockQuantity: { increment: intakeQty }, averageCost: newAverageCost }
        });

        try {
          await tx.serialNumber.createMany({
            data: itemSerials.map(serial => ({ serial, productId: item.productId, status: 'AVAILABLE' }))
          });
        } catch (e) {
          const error = new Error(`Sản phẩm ${item.productId}: một trong các Serial Number đã tồn tại trong hệ thống (trùng với lô hàng khác).`);
          error.statusCode = 409;
          throw error;
        }
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
    const [inventoryData, supplierLinks] = await Promise.all([
      prisma.inventory.findMany({
        include: {
          product: {
            select: {
              productId: true,
              name: true,
              sku: true,
              price: true,
              stockQuantity: true,
              primaryImage: true,
              descriptionText: true,
              images: { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true } },
              available: true,
              status: true,
              // The Kho product-list filter buckets by category (CPU/VGA/RAM/...) —
              // without this the frontend had no category to filter on and fell
              // back to a single hardcoded bucket, silently breaking every
              // category filter except "Tất cả".
              category: { select: { name: true, slug: true } },
              // Preferred/default distributor for this SKU (see Product.defaultSupplierCode) —
              // derived at seed time from suppliers.json's real supplied_brands list. Used as
              // the fallback below when the product has no actual completed-PO history yet.
              defaultSupplier: { select: { name: true } }
            }
          },
          warehouse: { select: { id: true, name: true } },
          location: true
        },
        orderBy: { updatedAt: 'desc' }
      }),
      // Real observed purchase history takes priority over the catalog default below —
      // the most recent fulfilled PO for a product is a stronger signal than its
      // brand's generic default distributor.
      prisma.purchaseOrderItem.findMany({
        where: { po: { status: { in: ['RECEIVED', 'DONE', 'COMPLETED'] } } },
        select: { productId: true, po: { select: { updatedAt: true, supplier: { select: { name: true } } } } }
      })
    ]);

    const supplierByProduct = new Map();
    for (const link of [...supplierLinks].sort((a, b) => new Date(b.po.updatedAt) - new Date(a.po.updatedAt))) {
      if (!supplierByProduct.has(link.productId)) {
        supplierByProduct.set(link.productId, link.po.supplier.name);
      }
    }

    // There are 2 real warehouses (Kho Tổng TP.HCM + Kho Chi Nhánh Hà Nội), so every
    // product has 2 separate Inventory rows. The Kho product-list is a catalog view —
    // one row per SKU with its company-wide total — not a per-warehouse ledger, so
    // returning inventoryData as-is silently duplicated every product with only a
    // fractional stock count in each row. Aggregate to one row per product instead.
    const byProduct = new Map();
    for (const row of inventoryData) {
      let agg = byProduct.get(row.productId);
      if (!agg) {
        agg = {
          id: row.productId,
          productId: row.productId,
          product: row.product,
          quantityOnHand: 0,
          reorderPoint: row.reorderPoint,
          locations: [],
          updatedAt: row.updatedAt
        };
        byProduct.set(row.productId, agg);
      }
      agg.quantityOnHand += row.quantityOnHand;
      if (row.location) {
        agg.locations.push({
          warehouseId: row.warehouseId,
          warehouseName: row.warehouse?.name || null,
          zone: row.location.zone,
          shelf: row.location.shelf,
          bin: row.location.bin
        });
      }
      if (row.updatedAt > agg.updatedAt) agg.updatedAt = row.updatedAt;
    }

    const data = [...byProduct.values()].map(agg => ({
      ...agg,
      supplierName: supplierByProduct.get(agg.productId) || agg.product?.defaultSupplier?.name || null
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/warehouse/inventory/adjust
// Nhập kho trực tiếp / kiểm kê bổ sung — không qua đơn mua PO. Trước đây tab
// này ở frontend chỉ ghi localStorage, không có route nào chạm tới CSDL thật.
const adjustInventory = async (req, res, next) => {
  try {
    const { productId, quantity, warehouseId, location, reason, note, refCode, serials } = req.body;
    const qty = parseInt(quantity, 10);
    const whId = parseInt(warehouseId, 10) || 1;
    const actor = req.user?.fullname || req.user?.email || req.user?.code || 'Thủ Kho';

    if (!productId || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Cần chọn sản phẩm và số lượng nhập là số nguyên dương.' });
    }

    // Serial Number bắt buộc cho mọi lượt nhập kho, kể cả nhập trực tiếp/kiểm kê
    // ngoài PO — nếu không, số serial khả dụng sẽ lệch dần khỏi stockQuantity thật.
    const itemSerials = Array.isArray(serials) ? serials.map(s => String(s).trim()).filter(Boolean) : [];
    if (itemSerials.length !== qty) {
      return res.status(400).json({ success: false, message: `Cần quét đủ ${qty} Serial Number, hiện có ${itemSerials.length}.` });
    }
    if (new Set(itemSerials).size !== itemSerials.length) {
      return res.status(400).json({ success: false, message: 'Danh sách Serial Number có mã bị trùng lặp.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { productId: String(productId) } });
      if (!product) {
        const err = new Error(`Không tìm thấy sản phẩm với mã: ${productId}`);
        err.statusCode = 404;
        throw err;
      }

      try {
        await tx.serialNumber.createMany({
          data: itemSerials.map(serial => ({ serial, productId: product.productId, status: 'AVAILABLE' }))
        });
      } catch (e) {
        const err = new Error('Một trong các Serial Number đã tồn tại trong hệ thống.');
        err.statusCode = 409;
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

// POST /api/v1/warehouse/inventory/audit-adjust
// Kiểm kê phát hiện thiếu hụt/hư hỏng thực tế so với hệ thống — GIẢM tồn kho,
// ngược chiều với adjustInventory (chỉ tăng). Chỉ Quản Lý Kho được duyệt việc
// này (warehouse_audit_adjust) — khác adjustInventory dùng chung cho cả 2 vai
// trò vì đó là thao tác nhập hàng hàng ngày.
const auditDecreaseInventory = async (req, res, next) => {
  try {
    const { productId, quantity, warehouseId, reason, note, serials } = req.body;
    const qty = parseInt(quantity, 10);
    const whId = parseInt(warehouseId, 10) || 1;
    const actor = req.user?.fullname || req.user?.email || req.user?.code || 'Quản Lý Kho';

    if (!productId || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Cần chọn sản phẩm và số lượng điều chỉnh giảm là số nguyên dương.' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'Cần nhập lý do kiểm kê (thất lạc, hư hỏng, sai lệch...).' });
    }

    // Serial bị loại phải là serial CÓ THẬT và đang AVAILABLE — không thể "kiểm
    // kê mất" 1 serial đã bán cho khách hoặc đã dùng ở đơn khác.
    const itemSerials = Array.isArray(serials) ? serials.map(s => String(s).trim()).filter(Boolean) : [];
    if (itemSerials.length !== qty) {
      return res.status(400).json({ success: false, message: `Cần chọn đủ ${qty} Serial Number đang tồn kho để điều chỉnh giảm, hiện chọn ${itemSerials.length}.` });
    }
    if (new Set(itemSerials).size !== itemSerials.length) {
      return res.status(400).json({ success: false, message: 'Danh sách Serial Number có mã bị trùng lặp.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { productId: String(productId) } });
      if (!product) {
        const err = new Error(`Không tìm thấy sản phẩm với mã: ${productId}`);
        err.statusCode = 404;
        throw err;
      }

      const validSerials = await tx.serialNumber.findMany({
        where: { serial: { in: itemSerials }, productId: product.productId, status: 'AVAILABLE' }
      });
      if (validSerials.length !== itemSerials.length) {
        const err = new Error('Một hoặc nhiều Serial Number không tồn tại, không thuộc sản phẩm này, hoặc đã được bán/sử dụng — không thể điều chỉnh giảm.');
        err.statusCode = 409;
        throw err;
      }

      const inventory = await tx.inventory.findFirst({ where: { productId: product.productId, warehouseId: whId } });
      if (!inventory || inventory.quantityOnHand < qty) {
        const err = new Error(`Tồn kho thực tế tại kho chỉ còn ${inventory?.quantityOnHand || 0}, không đủ ${qty} để điều chỉnh giảm.`);
        err.statusCode = 409;
        throw err;
      }
      if (product.stockQuantity < qty) {
        const err = new Error(`Tổng tồn kho sản phẩm chỉ còn ${product.stockQuantity}, không đủ ${qty} để điều chỉnh giảm.`);
        err.statusCode = 409;
        throw err;
      }

      await tx.serialNumber.updateMany({
        where: { serial: { in: itemSerials } },
        data: { status: 'DEFECTIVE' }
      });

      const updatedProduct = await tx.product.update({
        where: { productId: product.productId },
        data: { stockQuantity: { decrement: qty } }
      });

      const updatedInventory = await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantityOnHand: { decrement: qty } }
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: product.productId,
          fromWarehouseId: whId,
          type: 'OUT',
          quantity: qty,
          referenceId: `AUDIT-${Date.now().toString().slice(-8)}`,
          note: `Kiểm kê điều chỉnh giảm (${reason})${note ? ` — ${note}` : ''}. Serial: ${itemSerials.join(', ')}`,
          createdBy: actor
        }
      });

      return { product: updatedProduct, inventory: updatedInventory, movement };
    });

    logAudit({ req, action: 'AUDIT_ADJUST_INVENTORY', module: 'Kho Hàng', targetId: productId, note: `-${qty} (${reason})` });
    res.json({ success: true, message: 'Đã ghi nhận điều chỉnh giảm tồn kho.', data: result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ─── Phiếu Yêu Cầu Mua Hàng nội bộ (PurchaseRequest) ───────────────────────

// GET /api/v1/warehouse/purchase-requests
const listPurchaseRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = status && status !== 'ALL' ? { status } : {};
    const requests = await prisma.purchaseRequest.findMany({
      where,
      include: { product: { select: { name: true, sku: true, stockQuantity: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: requests });
  } catch (err) { next(err); }
};

// POST /api/v1/warehouse/purchase-requests — Thủ Kho lập đề xuất (warehouse_create_pr)
const createPurchaseRequest = async (req, res, next) => {
  try {
    const { productId, quantity, reason } = req.body;
    const qty = parseInt(quantity, 10);
    if (!productId || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Cần chọn sản phẩm và số lượng đề xuất là số nguyên dương.' });
    }
    const product = await prisma.product.findUnique({ where: { productId: String(productId) } });
    if (!product) {
      return res.status(404).json({ success: false, message: `Không tìm thấy sản phẩm với mã: ${productId}` });
    }

    const prCode = `PR-${Date.now().toString().slice(-8)}`;
    const request = await prisma.purchaseRequest.create({
      data: {
        prCode,
        productId: product.productId,
        quantity: qty,
        reason: reason || null,
        status: 'PENDING',
        requestedBy: req.user?.fullname || req.user?.email || req.user?.code || 'Thủ Kho'
      },
      include: { product: { select: { name: true, sku: true } } }
    });

    logAudit({ req, action: 'CREATE_PURCHASE_REQUEST', module: 'Kho Hàng', targetId: request.id, note: `${request.prCode} — ${product.name} x${qty}` });
    res.status(201).json({ success: true, data: request });
  } catch (err) { next(err); }
};

// PATCH /api/v1/warehouse/purchase-requests/:id/approve — Quản Lý Kho ký duyệt (warehouse_approve_pr)
const approvePurchaseRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.purchaseRequest.findUnique({ where: { id: parseInt(id, 10) } });
    if (!existing) return res.status(404).json({ success: false, message: `Không tìm thấy đề xuất: ${id}` });
    if (existing.status !== 'PENDING') {
      return res.status(409).json({ success: false, message: `Đề xuất này đã được xử lý (${existing.status}).` });
    }

    const request = await prisma.purchaseRequest.update({
      where: { id: existing.id },
      data: {
        status: 'APPROVED',
        approvedBy: req.user?.fullname || req.user?.email || req.user?.code || 'Quản Lý Kho',
        approvedAt: new Date()
      },
      include: { product: { select: { name: true, sku: true } } }
    });

    logAudit({ req, action: 'APPROVE_PURCHASE_REQUEST', module: 'Kho Hàng', targetId: request.id, note: request.prCode });
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
};

// PATCH /api/v1/warehouse/purchase-requests/:id/reject
const rejectPurchaseRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const existing = await prisma.purchaseRequest.findUnique({ where: { id: parseInt(id, 10) } });
    if (!existing) return res.status(404).json({ success: false, message: `Không tìm thấy đề xuất: ${id}` });
    if (existing.status !== 'PENDING') {
      return res.status(409).json({ success: false, message: `Đề xuất này đã được xử lý (${existing.status}).` });
    }

    const request = await prisma.purchaseRequest.update({
      where: { id: existing.id },
      data: {
        status: 'REJECTED',
        approvedBy: req.user?.fullname || req.user?.email || req.user?.code || 'Quản Lý Kho',
        approvedAt: new Date(),
        reason: reason ? `${existing.reason || ''} [Từ chối: ${reason}]`.trim() : existing.reason
      }
    });

    logAudit({ req, action: 'REJECT_PURCHASE_REQUEST', module: 'Kho Hàng', targetId: request.id, note: request.prCode });
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
};

// ─── Vị Trí Kệ Kho (WarehouseLocation) ──────────────────────────────────────

// GET /api/v1/warehouse/locations
const listWarehouseLocations = async (req, res, next) => {
  try {
    const locations = await prisma.warehouseLocation.findMany({
      include: {
        warehouse: { select: { name: true } },
        _count: { select: { inventories: true } }
      },
      orderBy: [{ warehouseId: 'asc' }, { zone: 'asc' }, { shelf: 'asc' }, { bin: 'asc' }]
    });
    res.json({
      success: true,
      data: locations.map(l => ({ ...l, assignedCount: l._count.inventories, _count: undefined }))
    });
  } catch (err) { next(err); }
};

// POST /api/v1/warehouse/locations — Quản Lý Kho tạo vị trí kệ mới (warehouse_manage_locations)
const createWarehouseLocation = async (req, res, next) => {
  try {
    const { warehouseId, zone, shelf, bin, capacity } = req.body;
    const whId = parseInt(warehouseId, 10);
    if (!Number.isInteger(whId) || !zone || !shelf || !bin) {
      return res.status(400).json({ success: false, message: 'Cần chọn kho và nhập đủ Zone / Shelf / Bin.' });
    }

    const existing = await prisma.warehouseLocation.findFirst({ where: { warehouseId: whId, zone, shelf, bin } });
    if (existing) {
      return res.status(400).json({ success: false, message: `Vị trí ${zone}-${shelf}-${bin} đã tồn tại tại kho này.` });
    }

    const location = await prisma.warehouseLocation.create({
      data: { warehouseId: whId, zone: String(zone).trim(), shelf: String(shelf).trim(), bin: String(bin).trim(), capacity: parseInt(capacity, 10) || 100 }
    });
    logAudit({ req, action: 'CREATE_WAREHOUSE_LOCATION', module: 'Kho Hàng', targetId: location.id, note: `${zone}-${shelf}-${bin}` });
    res.status(201).json({ success: true, data: location });
  } catch (err) { next(err); }
};

// PUT /api/v1/warehouse/locations/:id
const updateWarehouseLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { capacity, zone, shelf, bin } = req.body;
    const existing = await prisma.warehouseLocation.findUnique({ where: { id: parseInt(id, 10) } });
    if (!existing) return res.status(404).json({ success: false, message: `Không tìm thấy vị trí: ${id}` });

    const location = await prisma.warehouseLocation.update({
      where: { id: existing.id },
      data: {
        ...(capacity !== undefined ? { capacity: parseInt(capacity, 10) || existing.capacity } : {}),
        ...(zone !== undefined ? { zone: String(zone).trim() } : {}),
        ...(shelf !== undefined ? { shelf: String(shelf).trim() } : {}),
        ...(bin !== undefined ? { bin: String(bin).trim() } : {})
      }
    });
    logAudit({ req, action: 'UPDATE_WAREHOUSE_LOCATION', module: 'Kho Hàng', targetId: location.id, note: `${location.zone}-${location.shelf}-${location.bin}` });
    res.json({ success: true, data: location });
  } catch (err) { next(err); }
};

// DELETE /api/v1/warehouse/locations/:id — chỉ xóa được khi chưa gán hàng nào
const deleteWarehouseLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.warehouseLocation.findUnique({
      where: { id: parseInt(id, 10) },
      include: { _count: { select: { inventories: true } } }
    });
    if (!existing) return res.status(404).json({ success: false, message: `Không tìm thấy vị trí: ${id}` });
    if (existing._count.inventories > 0) {
      return res.status(400).json({ success: false, message: `Vị trí này đang chứa ${existing._count.inventories} mã hàng — hãy chuyển hàng đi trước khi xóa.` });
    }

    await prisma.warehouseLocation.delete({ where: { id: existing.id } });
    logAudit({ req, action: 'DELETE_WAREHOUSE_LOCATION', module: 'Kho Hàng', targetId: existing.id, note: `${existing.zone}-${existing.shelf}-${existing.bin}` });
    res.json({ success: true, message: 'Đã xóa vị trí kệ.' });
  } catch (err) { next(err); }
};

// PATCH /api/v1/warehouse/inventory/:id/location — gán 1 dòng tồn kho vào vị trí
// kệ cụ thể (thao tác vận hành hàng ngày, không cần Quản Lý Kho duyệt riêng).
const assignInventoryLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { locationId } = req.body;
    const inventory = await prisma.inventory.findUnique({ where: { id: parseInt(id, 10) } });
    if (!inventory) return res.status(404).json({ success: false, message: `Không tìm thấy dòng tồn kho: ${id}` });

    let targetLocationId = null;
    if (locationId !== null && locationId !== undefined && locationId !== '') {
      const location = await prisma.warehouseLocation.findUnique({ where: { id: parseInt(locationId, 10) } });
      if (!location) return res.status(404).json({ success: false, message: `Không tìm thấy vị trí kệ: ${locationId}` });
      if (location.warehouseId !== inventory.warehouseId) {
        return res.status(400).json({ success: false, message: 'Vị trí kệ này không thuộc cùng kho với dòng tồn kho.' });
      }
      targetLocationId = location.id;
    }

    const updated = await prisma.inventory.update({ where: { id: inventory.id }, data: { locationId: targetLocationId } });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// GET /api/v1/warehouse/locations/:id/products — xem danh sách sản phẩm trong kệ
const getLocationProducts = async (req, res, next) => {
  try {
    const locId = parseInt(req.params.id, 10);
    if (!Number.isInteger(locId)) {
      return res.status(400).json({ success: false, message: 'ID vị trí không hợp lệ.' });
    }
    const location = await prisma.warehouseLocation.findUnique({
      where: { id: locId },
      include: { warehouse: { select: { id: true, name: true } } }
    });
    if (!location) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vị trí kệ này.' });
    }

    const inventories = await prisma.inventory.findMany({
      where: { locationId: locId },
      include: {
        product: {
          select: {
            productId: true,
            productName: true,
            sku: true,
            sellingPrice: true,
            costPrice: true,
            imageUrl: true,
            category: { select: { name: true, slug: true } }
          }
        }
      },
      orderBy: { product: { productName: 'asc' } }
    });

    res.json({
      success: true,
      data: {
        location: {
          ...location,
          code: `${location.zone}-${location.shelf}-${location.bin}`,
          warehouseName: location.warehouse?.name
        },
        items: inventories.map(inv => ({
          productId: inv.productId,
          productName: inv.product?.productName || 'Linh Kiện',
          sku: inv.product?.sku || inv.productId,
          category: inv.product?.category?.name || '',
          price: Number(inv.product?.sellingPrice) || Number(inv.product?.costPrice) || 0,
          quantityOnHand: inv.quantityOnHand,
          quantityReserved: inv.quantityReserved,
          availableQuantity: Math.max(0, inv.quantityOnHand - inv.quantityReserved),
          imageUrl: inv.product?.imageUrl || null
        }))
      }
    });
  } catch (err) { next(err); }
};

module.exports = {
  getReceipts,
  getReceiptById,
  validateReceipt,
  getStockMovements,
  getInventory,
  adjustInventory,
  auditDecreaseInventory,
  listPurchaseRequests,
  createPurchaseRequest,
  approvePurchaseRequest,
  rejectPurchaseRequest,
  listWarehouseLocations,
  getLocationProducts,
  createWarehouseLocation,
  updateWarehouseLocation,
  deleteWarehouseLocation,
  assignInventoryLocation
};
