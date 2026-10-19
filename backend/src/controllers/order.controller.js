const prisma = require('../config/database');
const { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } = require('../services/emailService');
const { hasOperationalPermission } = require('../middlewares/rbac.middleware');
const { ORDER_STATUS_VI, labelOf } = require('../constants/statusLabels');
const { bundlePercent, bundlePrice, groupOfSlug } = require('../services/bundleDeals');
const { resolvePromotion } = require('../services/promotion');
const {
  LOYALTY_VND_PER_POINT,
  adjustLoyaltyForOrder,
  isStockOut,
  deductOrderStock,
  returnOrderStock
} = require('../services/orderFulfillment');

const VAT_RATE = 0.1; // Thuế GTGT — giá niêm yết đã gồm thuế, chỉ tách ra để ghi nhận

// Nhóm linh kiện trên phiếu lắp ráp (CPU/MAINBOARD/RAM/VGA/...) — cùng bảng nhóm với ưu đãi mua kèm
const assemblyCategoryOf = (slug) => groupOfSlug(slug) || 'OTHER';


/**
 * 1. KHÁCH HÀNG TẠO ĐƠN HÀNG MỚI (Storefront Checkout - M_KHDH)
 */
// Mã đơn ORD-YYMMDD-XXXX chỉ có 9.000 giá trị mỗi ngày nên có thể trùng (bài toán ngày sinh: ~100 đơn/ngày
// đã có xác suất trùng ~40%). Khi trùng khóa chính order_id, chạy lại cả giao dịch để sinh mã mới thay vì báo lỗi.
async function withOrderIdRetry(run, fixedId, attempts = 6) {
  for (let i = 1; ; i++) {
    try {
      return await run();
    } catch (err) {
      const dupOrderId = err && err.code === 'P2002' && String(err.meta?.target || '').includes('order_id');
      if (!dupOrderId || fixedId || i >= attempts) throw err;
    }
  }
}

const createOrder = async (req, res, next) => {
  try {
    const customerId = req.user.id; // Lấy từ authMiddleware JWT
    // Gắn bởi createPosOrder trước khi nó ghi đè req.user thành khách
    // WALK-IN — cho biết nhân viên Sales nào đã đứng quầy bán đơn này, dùng
    // để tính hoa hồng doanh số thật trong bảng lương. null cho đơn khách tự
    // đặt ở storefront.
    const soldById = Number.isInteger(req.posEmployeeId) ? req.posEmployeeId : null;
    const posEmployeeRole = req.posEmployeeRole || null;
    const { items, shippingAddress, shippingCity, notes } = req.body;
    const isPos = !!posEmployeeRole;
    // Bán tại quầy: khách nhận hàng và trả tiền ngay tại cửa hàng (tiền mặt / chuyển khoản
    // QR nhân viên đã thấy tiền về / quẹt thẻ) — đơn hoàn tất ngay, không qua kho xuất &
    // giao hàng. Trước đây frontend gửi mọi phương thức POS lên là "COD", đơn nằm ở
    // CONFIRMED và hiện nhầm trong hàng chờ xuất kho/giao hàng như một đơn online.
    const POS_METHODS = { CASH: 'CASH', COD: 'CASH', BANK: 'BANK_TRANSFER', BANK_TRANSFER: 'BANK_TRANSFER', CARD: 'CARD' };
    const paymentMethod = isPos
      ? (POS_METHODS[String(req.body.posPaymentMethod || req.body.paymentMethod || 'CASH').toUpperCase()] || 'CASH')
      : (['COD', 'BANK_TRANSFER'].includes(req.body.paymentMethod) ? req.body.paymentMethod : 'COD');
    // Khách tự đặt ở storefront không được tự khai "đã chuyển khoản" — đơn chuyển khoản chỉ được
    // xác nhận thanh toán khi webhook SePay báo tiền đã vào tài khoản (payment.controller.js).
    const isPaidAtCounter = isPos;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Giỏ hàng không được để trống' });
    }

    // POS: gắn đơn vào hồ sơ khách theo số điện thoại (tạo mới nếu chưa có) để có lịch sử
    // mua, tích điểm và tra cứu bảo hành — trước đây tên/SĐT nhập ở quầy bị bỏ, mọi đơn
    // POS dồn vào khách chung "WALK-IN".
    let effectiveCustomerId = customerId;
    if (isPos) {
      const phone = String(req.body.phone || '').replace(/\D/g, '');
      if (/^0\d{9,10}$/.test(phone)) {
        const name = String(req.body.customerName || '').trim() || 'Khách mua tại quầy';
        const found = await prisma.customer.findUnique({ where: { phone } })
          || await prisma.customer.create({
            data: { customerId: `CUS-POS-${phone}`, email: `pos-${phone}@aetherpc.local`, name, phone, customerType: 'B2C', tier: 'BRONZE' }
          }).catch(() => prisma.customer.findUnique({ where: { phone } }));
        if (found?.customerId) effectiveCustomerId = found.customerId;
      }
    }

    // Thực hiện giao dịch cơ sở dữ liệu (Database Transaction)
    const order = await withOrderIdRetry(() => prisma.$transaction(async (tx) => {
      const customerId = effectiveCustomerId;
      let subtotal = 0;
      let discount = 0;
      const orderItemsData = [];
      const bundleNotes = [];
      let hasShortage = false;
      const shortageItems = [];

      // "Mua kèm giá sốc": dòng có bundleWith là linh kiện mua kèm sản phẩm chính cùng đơn.
      // Chỉ áp giá mua kèm khi sản phẩm chính có trong đơn (dòng mua thường), cặp danh mục có
      // ưu đãi, và số lượng mua kèm không vượt quá số lượng sản phẩm chính.
      const productCache = new Map();
      const loadProduct = async (pid) => {
        const key = String(pid);
        if (!productCache.has(key)) {
          productCache.set(key, await tx.product.findUnique({
            where: { productId: key },
            include: { category: { select: { slug: true } } }
          }));
        }
        return productCache.get(key);
      };
      const mainQty = {};
      for (const it of items) {
        if (it && !it.bundleWith) {
          const k = String(it.productId);
          mainQty[k] = (mainQty[k] || 0) + (parseInt(it.quantity) || 0);
        }
      }

      for (const cartItem of items) {
        const targetProdId = String(cartItem.productId);
        const prod = await loadProduct(targetProdId);

        if (!prod) {
          throw new Error(`Không tìm thấy sản phẩm với mã: ${cartItem.productId}`);
        }

        const qty = parseInt(cartItem.quantity);
        if (!Number.isInteger(qty) || qty <= 0 || qty > 10000) {
          const error = new Error('Số lượng sản phẩm không hợp lệ');
          error.statusCode = 400;
          throw error;
        }
        let itemPrice = parseFloat(prod.price);
        const itemOrigPrice = parseFloat(prod.originalPrice || prod.price);
        let bundleNote = null;
        if (cartItem.bundleWith && String(cartItem.bundleWith) !== targetProdId) {
          const mainId = String(cartItem.bundleWith);
          const main = mainQty[mainId] ? await loadProduct(mainId) : null;
          const pct = main ? bundlePercent(groupOfSlug(main.category?.slug), groupOfSlug(prod.category?.slug)) : 0;
          if (pct > 0 && qty <= mainQty[mainId]) {
            itemPrice = bundlePrice(itemPrice, pct);
            bundleNote = `Mua kèm giá sốc -${pct}% cùng ${main.name}`;
          }
        }

        const itemSubtotal = itemPrice * qty;
        const itemDiscount = (itemOrigPrice - itemPrice) * qty;

        subtotal += itemSubtotal;
        discount += itemDiscount > 0 ? itemDiscount : 0;

        // Kiểm tra tồn kho sản phẩm
        if (prod.stockQuantity < qty) {
          hasShortage = true;
          shortageItems.push(prod.name);
        }

        const randSuffix = Math.floor(Math.random() * 1000);
        if (bundleNote) bundleNotes.push(`${prod.name}: ${bundleNote}`);
        orderItemsData.push({
          orderItemId: `ORI-${Date.now()}-${orderItemsData.length}-${randSuffix}`,
          productId: prod.productId,
          sku: prod.sku,
          name: prod.name,
          quantity: qty,
          price: itemPrice,
          originalPrice: itemOrigPrice,
          totalPrice: itemSubtotal
        });
      }

      // Tính toán chiết khấu hạng thành viên
      const customer = await tx.customer.findUnique({
        where: { customerId }
      });

      let tierDiscountPercent = 0;
      if (customer && customer.tier) {
        const tier = customer.tier.toUpperCase();
        if (tier === 'SILVER') tierDiscountPercent = 0.02;
        else if (tier === 'GOLD') tierDiscountPercent = 0.05;
        else if (tier === 'PLATINUM') tierDiscountPercent = 0.10;
      }

      // Tính toán chiết khấu hạng thành viên & voucher
      const memberDiscount = Math.round(subtotal * tierDiscountPercent);
      // Chiết khấu bổ sung:
      //  - Đơn tại quầy (POS): nhân viên nhập số tiền chiết khấu; vượt 10% cần quyền duyệt chiết khấu.
      //  - Đơn khách tự đặt: CHỈ nhận mã khuyến mãi, máy chủ tự tính tiền giảm từ bảng promotions.
      //    Không tin số tiền giảm do trình duyệt gửi lên (trước đây khách sửa được giá đơn về 1.000đ).
      let couponDiscount = 0;
      let appliedPromotionCode = null;
      if (posEmployeeRole) {
        couponDiscount = Math.min(subtotal, Math.max(0, parseFloat(req.body.couponDiscount || req.body.discountAmount || 0) || 0));
        if (couponDiscount > subtotal * 0.10) {
          const allowed = await hasOperationalPermission(posEmployeeRole, 'sales_approve_discount');
          if (!allowed) {
            const error = new Error('Mức chiết khấu vượt quá 10% cần được Quản Lý Bán Hàng hoặc CEO duyệt (quyền "Duyệt chiết khấu bán lẻ vượt hạn mức" trong Ma Trận Phân Quyền).');
            error.statusCode = 403;
            throw error;
          }
        }
      } else if (req.body.couponCode) {
        const { promotion, discount: promoDiscount } = await resolvePromotion(tx, req.body.couponCode, subtotal);
        couponDiscount = promoDiscount;
        appliedPromotionCode = promotion?.code || null;
      }
      const promoNote = appliedPromotionCode ? `Mã khuyến mãi ${appliedPromotionCode}: -${couponDiscount.toLocaleString('vi-VN')}đ` : null;

      const orderDiscount = memberDiscount + couponDiscount;
      const discountedSubtotal = Math.max(0, subtotal - orderDiscount);

      // Phí vận chuyển: Miễn phí vận chuyển 100% toàn quốc cho toàn bộ đơn hàng
      const shippingFee = 0;
      // Giá niêm yết bán lẻ ĐÃ GỒM thuế GTGT 10% — khách trả đúng giá hiển thị. vatAmount chỉ ghi lại
      // phần thuế nằm trong tổng tiền (phục vụ hoá đơn GTGT và báo cáo thuế), không cộng thêm.
      const totalAmount = discountedSubtotal + shippingFee;
      const vatAmount = totalAmount - Math.round(totalAmount / (1 + VAT_RATE));

      // Mã đơn luôn do máy chủ sinh — không nhận mã từ trình duyệt (khách có thể tự đặt
      // mã trùng/giả mạo dạng ORD-EXC-..., và POS từng gửi mã tạm POS-xxxxxx).
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randCode = Math.floor(1000 + Math.random() * 9000);
      const ordCode = `ORD-${dateStr}-${randCode}`;

      // Xác định trạng thái ban đầu dựa vào kênh bán, phương thức thanh toán & tồn kho
      let initialStatus;
      if (isPos) {
        // Không giao được hàng không có trên kệ — POS phải đủ tồn ngay lúc bán.
        if (hasShortage) {
          const error = new Error(`Không đủ tồn kho để bán tại quầy: ${shortageItems.join(', ')}.`);
          error.statusCode = 409;
          throw error;
        }
        initialStatus = 'COMPLETED';
      } else if (paymentMethod === 'BANK_TRANSFER') {
        initialStatus = 'WAITING_PAYMENT';
      } else if (hasShortage) {
        initialStatus = 'AWAITING_STOCK';
      } else {
        initialStatus = 'PENDING';
      }

      // COD đặt online chỉ thực sự được thanh toán khi Shipper giao thành công
      // (updateOrderStatus → DELIVERED); chuyển khoản online chờ webhook SePay.
      // Bán tại quầy thì tiền đã thu ngay.
      const initialPaymentStatus = isPaidAtCounter ? 'PAID' : 'PENDING';

      // Đơn Build PC (giỏ hàng gắn cờ pc_build_bundle từ công cụ Build PC) cần Kỹ thuật lắp
      // ráp & test trước khi giao — ghi nhận ngay vào ghi chú đơn để mọi bộ phận đều thấy.
      const buildItems = isPos ? [] : orderItemsData.filter((oi, idx) => {
        const src = items[idx] || {};
        return src.selectedSpec?.pc_build_bundle || src.pcBuild === true || src.assemble === true;
      });
      const needsAssembly = buildItems.length >= 2;

      const newOrder = await tx.order.create({
        data: {
          orderId: ordCode,
          customerId,
          subtotal,
          discount: orderDiscount,
          shippingFee,
          vatAmount,
          totalAmount,
          paymentMethod,
          paymentStatus: initialPaymentStatus,
          shippingAddress: isPos ? 'Nhận tại cửa hàng (POS)' : (shippingAddress || 'Chưa cung cấp'),
          shippingCity: shippingCity || 'TP. Hồ Chí Minh',
          notes: [
            needsAssembly ? '[LẮP RÁP PC] Đơn Build PC — kỹ thuật lắp ráp & test trước khi giao' : null,
            notes,
            bundleNotes.length ? `Ưu đãi mua kèm: ${bundleNotes.join('; ')}` : null,
            promoNote
          ].filter(Boolean).join(' | ') || null,
          status: initialStatus,
          soldById,
          ...(initialStatus === 'COMPLETED' ? { confirmedAt: new Date(), deliveredAt: new Date(), actualPaymentMethod: paymentMethod, receivedByType: 'DIRECT_CUSTOMER' } : {}),
          items: { create: orderItemsData }
        },
        include: { items: { include: { product: true } } }
      });

      // Bán tại quầy: xuất kho ngay + ghi nhận phiếu thu (OrderPayment đã đối soát và bút
      // toán thu tiền trên Sổ Cái) — trước đây đơn POS PAID nhưng không có bất kỳ chứng từ
      // thu tiền nào, tiền mặt trong két không hề lên sổ.
      if (initialStatus === 'COMPLETED') {
        await deductOrderStock(tx, newOrder, { note: `Xuất kho bán tại quầy — Đơn ${ordCode}` });
        const cashier = req.posEmployeeName || 'Thu ngân';
        const payRef = `POS-${ordCode}`;
        await tx.orderPayment.create({
          data: { orderId: ordCode, method: paymentMethod, amount: totalAmount, transactionId: req.body.bankRefCode || payRef, status: 'SUCCESS', settledAt: new Date(), settledBy: cashier }
        });
        if (totalAmount > 0) {
          await tx.ledgerEntry.create({
            data: {
              type: 'INCOME',
              amount: totalAmount,
              channel: paymentMethod === 'CASH' ? 'CASH' : 'BANK',
              description: `Thu tiền bán lẻ tại quầy — Đơn ${ordCode} (${paymentMethod === 'CASH' ? 'Tiền mặt' : paymentMethod === 'CARD' ? 'Thẻ' : 'Chuyển khoản'}, thu ngân ${cashier})`,
              referenceId: payRef
            }
          });
        }
        await adjustLoyaltyForOrder(tx, customerId, totalAmount, 'add');
      }

      if (needsAssembly) {
        await tx.assemblyJob.create({
          data: {
            jobCode: `ASM-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`,
            orderId: ordCode,
            customerName: req.body.customerName || 'Khách hàng',
            components: (() => {
              const seen = {};
              return buildItems.map(oi => {
                const base = assemblyCategoryOf(productCache.get(String(oi.productId))?.category?.slug);
                seen[base] = (seen[base] || 0) + 1;
                return { productId: oi.productId, category: seen[base] > 1 ? `${base} #${seen[base]}` : base, name: oi.name, quantity: oi.quantity };
              });
            })(),
            status: 'PENDING',
            createdBy: 'Hệ thống (đơn Build PC)'
          }
        });
      }

      const pointsEarned = initialStatus === 'COMPLETED' ? Math.floor(parseFloat(totalAmount) / LOYALTY_VND_PER_POINT) : 0;
      let historyNote;
      if (initialStatus === 'COMPLETED') {
        historyNote = `Bán tại quầy: đã thu ${Number(totalAmount).toLocaleString('vi-VN')}đ, xuất kho & giao hàng tận tay khách. Tích lũy +${pointsEarned} điểm thành viên.`;
      } else if (initialStatus === 'WAITING_PAYMENT') {
        historyNote = 'Đơn hàng vừa được khởi tạo, đang chờ khách hàng hoàn tất thanh toán chuyển khoản.';
      } else if (initialStatus === 'AWAITING_STOCK') {
        historyNote = `Hệ thống tạm giữ đơn hàng (Chờ nhập hàng: Thiếu tồn kho cho sản phẩm: ${shortageItems.join(', ')}).`;
      } else {
        historyNote = 'Đơn hàng khởi tạo thành công, chờ bộ phận bán hàng xác nhận.';
      }
      if (needsAssembly) historyNote += ' Đã tạo lệnh lắp ráp PC cho đơn.';

      await tx.orderStatusHistory.create({
        data: { orderId: ordCode, status: initialStatus, note: historyNote, changedBy: isPos ? (req.posEmployeeName || 'Thu ngân') : 'Hệ thống' }
      });

      return newOrder;
    }, { maxWait: 10000, timeout: 30000 }));

    // Gửi email xác nhận đơn hàng cho khách hàng (đơn thanh toán online chỉ gửi khi thanh toán thành công)
    const customer = await prisma.customer.findUnique({ where: { customerId: order.customerId } });
    if (customer?.email && !customer.email.endsWith('@aetherpc.local') && order.status !== 'WAITING_PAYMENT') {
      sendOrderConfirmationEmail({
        toEmail: customer.email,
        customerName: customer.name,
        orderId: order.orderId,
        items: order.items,
        subtotal: order.subtotal,
        discount: order.discount,
        shippingFee: order.shippingFee,
        vatAmount: order.vatAmount,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        shippingAddress: order.shippingAddress
      }).catch(err => console.warn('[Email] Lỗi gửi email xác nhận:', err.message));
    }

    const pad = (n) => String(n).padStart(2, '0');
    const createdDate = order.createdAt ? new Date(order.createdAt) : new Date();
    const dateFormatted = `${pad(createdDate.getHours())}:${pad(createdDate.getMinutes())} ${pad(createdDate.getDate())}/${pad(createdDate.getMonth() + 1)}/${createdDate.getFullYear()}`;

    res.status(201).json({
      success: true,
      message: 'Đặt hàng thành công!',
      data: {
        ...order,
        date: dateFormatted
      }
    });
  } catch (err) {
    next(err);
  }
};

// POS orders are created by authenticated employees and use a shared
// walk-in customer while preserving the same stock transaction.
const createPosOrder = async (req, res, next) => {
  try {
    await prisma.customer.upsert({
      where: { customerId: 'WALK-IN' },
      update: {},
      create: { customerId: 'WALK-IN', email: 'walk-in@aetherpc.local', name: 'Khách mua tại quầy', customerType: 'B2C', tier: 'BRONZE', passwordHash: null }
    });
    const employeeId = parseInt(req.user?.id, 10);
    req.posEmployeeId = Number.isInteger(employeeId) ? employeeId : null;
    // Vai trò thật của nhân viên đứng quầy, giữ lại trước khi ghi đè req.user
    // — dùng để kiểm tra quyền sales_approve_discount ở createOrder bên dưới
    // (không thể dùng req.user.role sau dòng kế tiếp vì lúc đó đã là CUSTOMER).
    req.posEmployeeRole = req.user?.role || null;
    req.posEmployeeName = req.user?.name || req.user?.fullname || req.user?.email || null;
    req.user = { ...req.user, id: 'WALK-IN', role: 'CUSTOMER' };
    return createOrder(req, res, next);
  } catch (err) {
    return next(err);
  }
};

const autoCompleteDeliveredOrders = async () => {
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        deliveredAt: {
          lte: fortyEightHoursAgo
        }
      },
      select: { orderId: true }
    });

    if (expiredOrders && expiredOrders.length > 0) {
      const orderIds = expiredOrders.map(o => o.orderId);
      await prisma.order.updateMany({
        where: { orderId: { in: orderIds } },
        data: { status: 'COMPLETED' }
      });

      for (const oid of orderIds) {
        await prisma.orderStatusHistory.create({
          data: {
            orderId: oid,
            status: 'COMPLETED',
            note: 'Hệ thống tự động chuyển Hoàn tất (sau 48 giờ kể từ khi giao hàng khách không khiếu nại).',
            changedBy: 'Hệ Thống Tự Động'
          }
        }).catch(() => {});
      }
    }
  } catch (e) {
    // quiet catch
  }
};

// Đơn đã nhận tiền chuyển khoản qua SePay mà bị hủy → tạo khoản "Chờ hoàn tiền" cho Kế toán
// (danh sách Hoàn tiền chuyển khoản). Mã giao dịch hậu tố -HUY để không trùng giao dịch gốc.
async function queueSepayRefundsOnCancel(tx, orderId) {
  const paid = await tx.orderPayment.findMany({
    where: { orderId, method: 'BANK_TRANSFER', status: 'SUCCESS', transactionId: { startsWith: 'SEPAY-' } }
  });
  let total = 0;
  for (const pay of paid) {
    const refundTx = `${pay.transactionId.replace(/-(DU|HUY)$/, '')}-HUY`;
    const exists = await tx.orderPayment.findFirst({ where: { transactionId: refundTx } });
    if (exists) continue;
    await tx.orderPayment.create({
      data: { orderId, method: 'BANK_TRANSFER', amount: pay.amount, transactionId: refundTx, status: 'REFUND_PENDING' }
    });
    total += Number(pay.amount);
  }
  return total;
}

// Trạng thái nhân viên còn được hủy đơn (hàng chưa giao cho shipper)
const STAFF_CANCELLABLE = ['PENDING', 'WAITING_PAYMENT', 'AWAITING_STOCK', 'CONFIRMED', 'PROCESSING', 'PACKED', 'READY_TO_SHIP'];

const cancelSingleOrderInternal = async (orderId, reason = 'Khách hàng yêu cầu hủy đơn', changedBy = 'Khách hàng') => {
  return await prisma.$transaction(async (tx) => {
    // Cùng khóa với webhook SePay (payment.controller.js): hủy đơn và tiền về không chạy chồng lên nhau
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'sepay:' + orderId}))::text`;
    const existingOrder = await tx.order.findUnique({
      where: { orderId },
      include: { items: true }
    });

    if (!existingOrder) {
      throw new Error(`Không tìm thấy đơn hàng ${orderId} trong hệ thống`);
    }

    if (existingOrder.status === 'CANCELLED') {
      return existingOrder;
    }

    // Hoàn kho nếu đơn đã từng xuất kho (idempotent — xem services/orderFulfillment.js)
    if (await returnOrderStock(tx, existingOrder, { note: `Hoàn kho tự động cho Đơn Hàng ${orderId} (Đã Hủy)` })) {
      await adjustLoyaltyForOrder(tx, existingOrder.customerId, existingOrder.totalAmount, 'subtract');
    }
    await tx.assemblyJob.updateMany({
      where: { orderId, status: { in: ['PENDING', 'ASSEMBLING'] } },
      data: { status: 'CANCELLED' }
    });

    const updated = await tx.order.update({
      where: { orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        notes: existingOrder.notes ? `${existingOrder.notes} | Lý do hủy: ${reason}` : `Lý do hủy: ${reason}`
      }
    });

    const refundTotal = await queueSepayRefundsOnCancel(tx, orderId);
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: 'CANCELLED',
        note: refundTotal > 0 ? `${reason} — đã chuyển ${refundTotal.toLocaleString('vi-VN')}đ khách đã thanh toán sang Kế toán để hoàn tiền.` : reason,
        changedBy
      }
    });

    return updated;
  }, { maxWait: 10000, timeout: 30000 });
};

const autoCancelUnpaidOrders = async () => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const expiredUnpaidOrders = await prisma.order.findMany({
      where: {
        status: 'WAITING_PAYMENT',
        paymentStatus: { not: 'PAID' },
        createdAt: {
          lte: thirtyMinutesAgo
        }
      },
      select: { orderId: true }
    });

    if (expiredUnpaidOrders && expiredUnpaidOrders.length > 0) {
      for (const ord of expiredUnpaidOrders) {
        try {
          await cancelSingleOrderInternal(
            ord.orderId,
            'Hệ thống tự động hủy do quá 30 phút chưa hoàn tất thanh toán chuyển khoản.',
            'Hệ Thống Tự Động'
          );
        } catch (err) {
          console.warn(`[AutoCancel] Không thể tự động hủy đơn ${ord.orderId}:`, err.message);
        }
      }
    }
  } catch (e) {
    // quiet catch
  }
};

const customerCancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const existingOrder = await prisma.order.findUnique({
      where: { orderId: id },
      include: { customer: true }
    });

    if (!existingOrder) {
      return res.status(404).json({ success: false, message: `Không tìm thấy đơn hàng ${id}` });
    }

    const isStaff = ['SALES', 'SALES_MANAGER', 'CEO', 'ADMIN', 'CSKH'].includes(req.user?.role);
    if (isStaff) {
      // Nhân viên hủy đơn phải có quyền "hủy đơn" trong Ma Trận Phân Quyền (giống màn hình quản lý đơn),
      // và chỉ hủy được đơn chưa rời kho.
      const allowed = await hasOperationalPermission(req.user.role, 'sales_cancel_order');
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Tài khoản của bạn không có quyền hủy đơn hàng (Ma Trận Phân Quyền).' });
      }
      if (!STAFF_CANCELLABLE.includes(existingOrder.status)) {
        return res.status(400).json({ success: false, message: `Đơn đang ở trạng thái "${labelOf(ORDER_STATUS_VI, existingOrder.status)}" — không thể hủy.` });
      }
    }
    if (!isStaff) {
      const isOwner = (existingOrder.customerId === req.user.id) ||
                      (existingOrder.customer?.phone && req.user.phone && existingOrder.customer.phone === req.user.phone) ||
                      (existingOrder.customer?.email && req.user.email && existingOrder.customer.email === req.user.email);
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền hủy đơn hàng này.' });
      }
    }

    // Kiểm tra sau bước phân quyền: không trả dữ liệu đơn cho người không phải chủ đơn
    if (existingOrder.status === 'CANCELLED') {
      return res.json({ success: true, message: `Đơn hàng #${id} đã được hủy trước đó.` });
    }

    const CANCELLABLE_STATUSES = ['PENDING', 'WAITING_PAYMENT', 'AWAITING_STOCK'];
    if (!CANCELLABLE_STATUSES.includes(existingOrder.status) && !isStaff) {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng đang ở trạng thái "${existingOrder.status}", đã được tiếp nhận xử lý nên không thể tự hủy. Vui lòng liên hệ CSKH AetherPC!`
      });
    }

    const cancelReason = reason ? String(reason).trim() : 'Khách hàng yêu cầu hủy đơn';
    const changedBy = req.user?.name || req.user?.fullname || req.user?.email || 'Khách hàng';

    const updated = await cancelSingleOrderInternal(id, cancelReason, changedBy);

    res.json({
      success: true,
      message: `Đơn hàng #${id} đã được hủy thành công!`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

const confirmReceivedOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const order = await prisma.order.findUnique({
      where: { orderId: id }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    if (req.user?.role === 'CUSTOMER' && order.customerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xác nhận đơn hàng này.' });
    }

    if (!['SHIPPED', 'DELIVERED'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể xác nhận đã nhận hàng khi đơn đang giao hoặc đã giao.'
      });
    }
    // Đơn COD còn đang giao: tiền chưa được shipper thu/ghi nhận (OrderPayment tạo ở bước
    // shipper xác nhận "Đã giao"). Nếu cho khách tự đóng đơn ở đây thì đơn thành PAID mà
    // không có khoản thu nào → tiền COD không bao giờ được đối soát với shipper.
    if (order.status === 'SHIPPED' && order.paymentStatus !== 'PAID') {
      return res.status(409).json({
        success: false,
        message: 'Đơn thanh toán khi nhận hàng — vui lòng chờ nhân viên giao hàng xác nhận đã giao và thu tiền.'
      });
    }

    const updated = await prisma.order.update({
      where: { orderId: id },
      data: {
        status: 'COMPLETED',
        deliveredAt: order.deliveredAt || new Date()
      }
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        status: 'COMPLETED',
        note: note || 'Khách hàng xác nhận đã nhận được hàng thành công.',
        changedBy: req.user?.fullname || req.user?.name || req.user?.email || 'Khách hàng'
      }
    });

    res.json({
      success: true,
      message: 'Xác nhận nhận hàng thành công! Cảm ơn bạn đã mua sắm tại AetherPC.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

const getCustomerOrders = async (req, res, next) => {
  try {
    // Tự động kiểm tra và chuyển các đơn đã giao quá 48h sang COMPLETED
    await autoCompleteDeliveredOrders();
    // Tự động hủy các đơn WAITING_PAYMENT quá 30 phút chưa thanh toán
    await autoCancelUnpaidOrders();

    const role = (req.user?.role || '').toUpperCase();
    const isCustomer = role === 'CUSTOMER';
    const isDelivery = role === 'DELIVERY';

    let whereClause = {};

    if (isCustomer) {
      whereClause = { customerId: req.user.id };
    } else if (isDelivery) {
      // Shipper xem các đơn từ trạng thái đóng gói sẵn sàng trở đi
      whereClause = {
        status: {
          in: ['CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'SHIPPING_FAILED', 'RETURNING_TO_WAREHOUSE', 'CANCELLED']
        }
      };
    }

    // Pagination is opt-in: pass ?page=&limit= to get a page back. Omit both
    // and the endpoint keeps returning the full list, unchanged, since most
    // admin pages currently expect the entire dataset for client-side
    // filtering — forcing a default page size here would silently truncate
    // their data.
    const pageNum = req.query.page ? Math.max(1, parseInt(req.query.page, 10) || 1) : null;
    const limitNum = req.query.limit ? Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 50)) : null;
    const isPaginated = Boolean(pageNum && limitNum);

    const totalCount = isPaginated ? await prisma.order.count({ where: whereClause }) : null;

    const orders = await prisma.order.findMany({
      where: whereClause,
      ...(isPaginated ? { skip: (pageNum - 1) * limitNum, take: limitNum } : {}),
      include: {
        customer: {
          select: {
            customerId: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                productId: true,
                name: true,
                price: true,
                primaryImage: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true
                  }
                }
              }
            }
          }
        },
        statusHistory: {
          take: 1,
          orderBy: { timestamp: 'desc' }
        },
        payments: {
          select: {
            id: true,
            method: true,
            amount: true,
            status: true,
            settledAt: true,
            settledBy: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Đơn đang có lệnh lắp ráp CHƯA xong (PENDING/ASSEMBLING) là việc của Lắp Ráp — Kho chưa
    // được đóng gói/xuất. Kho không đọc được /assembly-jobs nên gắn sẵn trạng thái lên từng đơn.
    const openJobs = isCustomer ? [] : await prisma.assemblyJob.findMany({
      where: { orderId: { in: orders.map(o => o.orderId) }, status: { in: ['PENDING', 'ASSEMBLING'] } },
      select: { orderId: true, jobCode: true, status: true }
    });
    const openJobByOrder = new Map(openJobs.map(j => [j.orderId, j]));

    // Format dữ liệu đồng bộ với frontend
    const pad = (n) => String(n).padStart(2, '0');
    const formattedOrders = orders.map(ord => {
      const createdDate = ord.createdAt ? new Date(ord.createdAt) : null;
      const dateFormatted = createdDate && !isNaN(createdDate.getTime())
        ? `${pad(createdDate.getHours())}:${pad(createdDate.getMinutes())} ${pad(createdDate.getDate())}/${pad(createdDate.getMonth() + 1)}/${createdDate.getFullYear()}`
        : '';

      return {
        ...ord,
        id: ord.orderId,
        customerName: ord.customer?.name || 'Khách Hàng',
        phone: ord.customer?.phone || '',
        email: ord.customer?.email || '',
        address: ord.shippingAddress,
        total: parseFloat(ord.totalAmount),
        date: dateFormatted,
        items: (ord.items || []).map(it => ({
          ...it,
          image: it.product?.primaryImage || it.image || null,
          primaryImage: it.product?.primaryImage || it.primaryImage || null,
          category: it.product?.category?.name || it.category || null
        })),
        ...(openJobByOrder.has(ord.orderId) ? {
          assemblyPending: true,
          assemblyJobCode: openJobByOrder.get(ord.orderId).jobCode,
          assemblyJobStatus: openJobByOrder.get(ord.orderId).status
        } : {})
      };
    });

    res.json({
      success: true,
      data: formattedOrders,
      ...(isPaginated ? { pagination: { page: pageNum, limit: limitNum, total: totalCount, totalPages: Math.ceil(totalCount / limitNum) } } : {})
    });
  } catch (err) {
    next(err);
  }
};

// Máy trạng thái đơn bán hàng: trạng thái hiện tại → các trạng thái được phép chuyển tới qua
// PATCH /orders/:id/status. Hoàn tiền và các bước đổi trả đi qua API đổi trả riêng.
const ORDER_TRANSITIONS = {
  WAITING_PAYMENT: ['PENDING', 'CONFIRMED', 'CANCELLED'],
  PENDING: ['CONFIRMED', 'PROCESSING', 'AWAITING_STOCK', 'CANCELLED'],
  AWAITING_STOCK: ['PENDING', 'CONFIRMED', 'PROCESSING', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'PACKED', 'READY_TO_SHIP', 'CANCELLED'],
  PROCESSING: ['CONFIRMED', 'PACKED', 'READY_TO_SHIP', 'CANCELLED'],
  PACKED: ['PROCESSING', 'READY_TO_SHIP', 'CANCELLED'],
  READY_TO_SHIP: ['PACKED', 'SHIPPED', 'CANCELLED'],
  // Giao thất bại: kiện hàng vẫn đang ở chỗ shipper — chỉ được giao lại hoặc chuyển hoàn
  // về kho; đơn chỉ được đóng (CANCELLED, hoàn tồn) khi QC/Kho đã nhận lại kiện hàng.
  SHIPPED: ['DELIVERED', 'SHIPPING_FAILED', 'FAILED_DELIVERY', 'RETURNING_TO_WAREHOUSE'],
  SHIPPING_FAILED: ['SHIPPED', 'FAILED_DELIVERY', 'RETURNING_TO_WAREHOUSE'],
  FAILED_DELIVERY: ['SHIPPED', 'RETURNING_TO_WAREHOUSE'],
  RETURNING_TO_WAREHOUSE: ['CANCELLED'],
  // Khách trả hàng sau khi đã nhận đi qua luồng đổi trả (POST /orders/:id/return), không
  // đổi thẳng trạng thái ở đây.
  DELIVERED: ['COMPLETED'],
};
// Đóng đơn kiện hoàn về kho là quyết định của QC/Kho (đã kiểm kiện), không phải "huỷ đơn" bán hàng
const RETURN_RECEIVER_ROLES = ['QC', 'QA', 'QUALITY_CONTROL', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'CEO', 'ADMIN'];
const SHIPPER_TARGETS = ['SHIPPED', 'DELIVERED', 'SHIPPING_FAILED', 'FAILED_DELIVERY', 'RETURNING_TO_WAREHOUSE', 'READY_TO_SHIP'];

// Trả về thông báo lỗi nếu vai trò không được chuyển đơn sang trạng thái đích, ngược lại null.
function orderTransitionError(order, target, user, isUnassign) {
  const role = user?.role;
  const from = order.status;
  if (role === 'DELIVERY') {
    if (order.assignedShipperId && Number(order.assignedShipperId) !== Number(user.id)) return 'Đơn này không được phân công cho bạn.';
    if (!order.assignedShipperId) return 'Đơn chưa được phân công cho nhân viên giao hàng.';
    if (!SHIPPER_TARGETS.includes(target)) return 'Nhân viên giao hàng không được đặt trạng thái này.';
  }
  if (['QC', 'QA', 'QUALITY_CONTROL'].includes(role) && !(from === 'RETURNING_TO_WAREHOUSE' && target === 'CANCELLED')) {
    return 'QC chỉ được xác nhận kiện hàng hoàn về kho.';
  }
  if (target === from) return null; // gửi lại cùng trạng thái (phân công lại, cập nhật ảnh…)
  if (isUnassign) return null;
  if (['DELIVERED'].includes(target) && !['DELIVERY', 'CEO', 'ADMIN'].includes(role)) return 'Chỉ nhân viên giao hàng xác nhận được "Đã giao".';
  if (target === 'CANCELLED' && from === 'RETURNING_TO_WAREHOUSE' && !RETURN_RECEIVER_ROLES.includes(role)) return 'Chỉ QC/Kho xác nhận kiện hoàn về kho mới được đóng đơn.';
  if (target === 'COMPLETED' && !['CSKH', 'SALES_MANAGER', 'CEO', 'ADMIN'].includes(role)) return 'Vai trò của bạn không được đóng đơn "Hoàn tất".';
  const allowed = ORDER_TRANSITIONS[from] || [];
  if (!allowed.includes(target)) {
    return `Không thể chuyển đơn từ "${labelOf(ORDER_STATUS_VI, from)}" sang "${labelOf(ORDER_STATUS_VI, target)}".`;
  }
  return null;
}

/**
 * 3. CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG (Dành cho Nhân viên Sale / Kho / Delivery / Admin)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const changedBy = req.user?.email || req.user?.name || req.user?.code || 'Nhân viên';

    const VALID_STATUSES = [
      'WAITING_PAYMENT',
      'PENDING',
      'CONFIRMED',
      'PACKED',
      'PROCESSING',
      'AWAITING_STOCK',
      'READY_TO_SHIP',
      'SHIPPED',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
      'FAILED_DELIVERY',
      'SHIPPING_FAILED',
      'RETURNING_TO_WAREHOUSE',
      'RETURN_REQUESTED',
      'RETURN_APPROVED',
      'RETURNING',
      'RETURNED',
      'REFUNDED'
    ];

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Trạng thái đơn hàng không hợp lệ: ${status}` });
    }

    // Đặt bên ngoài transaction để còn đọc được sau khi transaction đóng (email
    // gửi ở ngoài, dưới khối này) — true khi thao tác không có gì đáng để báo
    // cho khách (VD shipper từ chối nhận đơn: trạng thái đơn với khách hàng
    // không hề đổi, chỉ là nội bộ đổi người giao).
    let skipCustomerEmail = false;

    // true khi request chỉ là gửi lặp "Đã giao" cho đơn đã giao — trả về đơn
    // hiện tại, không ghi thêm lịch sử/thanh toán, không gửi lại email.
    let isDuplicateDelivered = false;

    const order = await prisma.$transaction(async (tx) => {
      // Khoá theo từng đơn cho MỌI lần đổi trạng thái (cùng khoá với webhook
      // SePay): trước đây chỉ khoá khi huỷ đơn, nên shipper trượt xác nhận bắn
      // nhiều request cùng lúc thì các transaction đều đọc thấy đơn chưa giao
      // và cùng ghi — 1 đơn có hàng chục dòng lịch sử "Đã giao" và nhiều dòng
      // OrderPayment CASH (tiền COD bị nhân lên khi đối soát).
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'sepay:' + id}))::text`;
      const existingOrder = await tx.order.findUnique({
        where: { orderId: id },
        include: { items: true, customer: true }
      });

      if (!existingOrder) {
        throw new Error('Không tìm thấy đơn hàng trong hệ thống');
      }

      if (status === 'DELIVERED' && existingOrder.status === 'DELIVERED') {
        isDuplicateDelivered = true;
        skipCustomerEmail = true;
        return existingOrder;
      }

      // Giữ nguyên trạng thái, chỉ đổi shipper phụ trách (Kho gán lại đơn tồn)
      // — với khách không có gì thay đổi, không gửi lại email trạng thái.
      if (status === existingOrder.status && req.body.assignedShipperId !== undefined) {
        skipCustomerEmail = true;
      }

      const transitionError = orderTransitionError(existingOrder, status, req.user, req.body.unassignShipper === true);
      if (transitionError) {
        const error = new Error(transitionError);
        error.statusCode = existingOrder.status === status || req.user?.role === 'DELIVERY' ? 403 : 409;
        throw error;
      }

      // This route carries every order status transition (confirm, pack, ship,
      // deliver...), so the operational permission check can't sit at the
      // router level — only the actual cancel action is gated by the
      // admin-configurable RBAC matrix. Skip on a no-op resubmit of an
      // already-cancelled order (frontend double-submit race).
      if (status === 'CANCELLED' && existingOrder.status !== 'CANCELLED' && existingOrder.status !== 'RETURNING_TO_WAREHOUSE') {
        const allowed = await hasOperationalPermission(req.user?.role, 'sales_cancel_order');
        if (!allowed) {
          const error = new Error('Tài khoản của bạn không có quyền hủy đơn hàng (đã bị quản trị viên tắt trong Ma Trận Phân Quyền).');
          error.statusCode = 403;
          throw error;
        }
      }

      // Đơn đang có yêu cầu đổi trả của khách (RMA) đi theo luồng đổi trả riêng (QC thẩm
      // định → Kho nhập kệ → Kế toán hoàn tiền). Màn QC "hàng hoàn kho" từng liệt kê chung
      // mọi đơn RETURNING_TO_WAREHOUSE nên có thể huỷ nhầm đơn RMA → hoàn kho + hoàn tiền
      // lần hai khi Kho nhập kệ theo RMA.
      if (status === 'CANCELLED' && existingOrder.status === 'RETURNING_TO_WAREHOUSE') {
        const activeRma = await tx.returnRequest.findFirst({
          where: { orderId: id, status: { notIn: ['REJECTED', 'QC_REJECTED', 'RETURNED_TO_CUSTOMER'] } },
          select: { rmaCode: true }
        });
        if (activeRma) {
          const error = new Error(`Đơn đang xử lý theo phiếu đổi trả ${activeRma.rmaCode || ''} — hãy thẩm định & nhập kho theo luồng Đổi Trả, không huỷ đơn.`.replace('  ', ' '));
          error.statusCode = 409;
          throw error;
        }
      }

      // Đơn Build PC còn lệnh lắp ráp chưa nghiệm thu thì Kho chưa được đóng gói/xuất giao
      if (['READY_TO_SHIP', 'SHIPPED'].includes(status) && status !== existingOrder.status) {
        const openJob = await tx.assemblyJob.findFirst({
          where: { orderId: id, status: { in: ['PENDING', 'ASSEMBLING'] } },
          select: { jobCode: true }
        });
        if (openJob) {
          const error = new Error(`Đơn đang chờ lắp ráp (lệnh ${openJob.jobCode}) — chỉ xuất kho sau khi kỹ thuật nghiệm thu.`);
          error.statusCode = 409;
          throw error;
        }
      }

      // Duyệt đơn lần đầu (từ trạng thái chờ sang đã duyệt): trừ tồn kho, gán serial,
      // chụp giá vốn, ghi COGS và tích điểm thành viên.
      const isApprovedStatus = ['CONFIRMED', 'PACKED', 'PROCESSING', 'READY_TO_SHIP'].includes(status);
      const isPriorPending = ['PENDING', 'AWAITING_STOCK', 'WAITING_PAYMENT'].includes(existingOrder.status);
      if (isApprovedStatus && isPriorPending && !(await isStockOut(tx, id))) {
        await adjustLoyaltyForOrder(tx, existingOrder.customerId, existingOrder.totalAmount, 'add');
        await deductOrderStock(tx, existingOrder, { note: `Xuất kho khi duyệt Đơn Hàng ${id}` });
      }

      // Hoàn kho CHỈ khi đơn bị huỷ — lúc đó hàng đã thật sự về kho (huỷ trước khi giao,
      // hoặc QC/Kho xác nhận kiện hoàn về). Trước đây "Giao thất bại" (FAILED_DELIVERY)
      // cũng hoàn kho ngay dù kiện hàng vẫn đang trên xe shipper, và khi giao lại
      // (FAILED_DELIVERY → SHIPPED) không trừ kho lần nữa → tồn kho bị cộng khống.
      if (status === 'CANCELLED') {
        // QC phân loại kiện hoàn về: hư hỏng do vận chuyển thì không nhập tồn bán, serial
        // chuyển DEFECTIVE, giá vốn giữ lại như một khoản tổn thất chờ bồi thường.
        const damaged = req.body.restockCondition === 'DAMAGED_CARRIER';
        const restocked = await returnOrderStock(tx, existingOrder, {
          sellable: !damaged,
          note: damaged
            ? `Kiện hoàn của Đơn ${id} hư hỏng do vận chuyển — chuyển kho chờ xử lý bồi thường`
            : `Hoàn kho cho Đơn Hàng ${id} (Đã Hủy)`
        });
        if (restocked) {
          await adjustLoyaltyForOrder(tx, existingOrder.customerId, existingOrder.totalAmount, 'subtract');
        }
        await tx.assemblyJob.updateMany({
          where: { orderId: id, status: { in: ['PENDING', 'ASSEMBLING'] } },
          data: { status: 'CANCELLED' }
        });
      }

      // Cập nhật trạng thái đơn hàng & thông tin POD giao vận
      // UI gửi actualPaymentMethod (CASH | BANK_TRANSFER | PREPAID); cashAmount/bankAmount
      // chỉ còn để nhận diện phương thức từ client cũ.
      const cashAmount  = parseFloat(req.body.cashAmount  ?? 0) || 0;
      const bankAmount  = parseFloat(req.body.bankAmount   ?? 0) || 0;

      // Xác định actualPaymentMethod đồng nhất để ghi lên Order.actualPaymentMethod
      // Đơn đã từng giao xong rồi quay lại DELIVERED (vd. CSKH từ chối đổi trả):
      // giữ nguyên thông tin giao hàng & thanh toán gốc, không ghi đè ngày giao,
      // phương thức thu, mã giao dịch, ảnh biên lai bằng giá trị mặc định.
      const isRestoreDelivered = status === 'DELIVERED' && Boolean(existingOrder.deliveredAt);

      // Chỉ chấp nhận 1 phương thức thu tiền khi giao: tiền mặt HOẶC chuyển khoản.
      // Thanh toán kết hợp (SPLIT) đã bỏ — chặn ở đây để client cũ không gửi lên được.
      if (status === 'DELIVERED' && !isRestoreDelivered && ((cashAmount > 0 && bankAmount > 0) || req.body.actualPaymentMethod === 'SPLIT')) {
        const error = new Error('Chỉ hỗ trợ thu bằng tiền mặt hoặc chuyển khoản, không hỗ trợ thanh toán kết hợp.');
        error.statusCode = 400;
        throw error;
      }
      let actualPayMethod;
      if (cashAmount > 0) {
        actualPayMethod = 'CASH';
      } else if (bankAmount > 0) {
        actualPayMethod = 'BANK_TRANSFER';
      } else {
        // fallback: nếu UI không gửi cashAmount/bankAmount, dùng trường cũ
        actualPayMethod = req.body.actualPaymentMethod || (existingOrder.paymentMethod === 'COD' ? 'CASH' : 'PREPAID');
      }

      const receivedType = req.body.receivedByType || 'DIRECT_CUSTOMER';
      const receiverName = req.body.receiverNameActual || (receivedType === 'DIRECT_CUSTOMER' ? (existingOrder.customer?.name || 'Khách hàng') : 'Người nhận thay');

      // Đơn chọn chuyển khoản/cổng online lúc đặt nhưng chưa có xác nhận tiền về
      // (nhân viên chuyển tay khỏi "Chờ thanh toán") — không được ghi nhận "đã trả
      // trước" khi giao, nếu không đơn bị đóng PAID mà công ty chưa nhận đồng nào.
      if (status === 'DELIVERED' && !isRestoreDelivered && actualPayMethod === 'PREPAID'
          && existingOrder.paymentStatus !== 'PAID' && parseFloat(existingOrder.totalAmount) > 0) {
        const error = new Error('Đơn chưa nhận được tiền thanh toán trước — cần thu tiền mặt hoặc chuyển khoản khi giao.');
        error.statusCode = 400;
        throw error;
      }

      // Validate: chuyển khoản phải có mã giao dịch
      if (status === 'DELIVERED' && !isRestoreDelivered && actualPayMethod === 'BANK_TRANSFER' && !req.body.bankRefCode) {
        const error = new Error('Cần nhập Mã Giao Dịch Ngân Hàng trước khi xác nhận đã nhận chuyển khoản.');
        error.statusCode = 400;
        throw error;
      }

      // Kho "Xác Nhận Xuất Kho" gửi kèm assignedShipperId/deliveryRegion khi
      // chuyển SHIPPED (Warehouse.jsx -> salesStore.updateOrderStatus), nhưng
      // route này trước đây bỏ qua hoàn toàn 2 field đó — Order.assignedShipperId
      // không bao giờ được ghi thật, nên Delivery.jsx (lọc đơn theo shipper) và
      // tính năng Đối Soát COD (lọc theo assignedShipperId) không hoạt động.
      // Chỉ nhận khi là ID nhân viên nội bộ hợp lệ (số nguyên) — shipper ngoài
      // hệ thống (chọn tự do bằng tên) không có Employee thật để gắn FK vào.
      const shipperIdRaw = req.body.assignedShipperId;
      let assignedShipperIdInt = /^\d+$/.test(String(shipperIdRaw ?? '')) ? parseInt(shipperIdRaw, 10) : null;

      // Hỗ trợ trường hợp UI gửi employeeCode/username của shipper thay vì ID số
      if (assignedShipperIdInt === null && (req.body.assignedShipperUsername || typeof shipperIdRaw === 'string')) {
        const empCode = req.body.assignedShipperUsername || shipperIdRaw;
        const matchedEmp = await tx.employee.findFirst({
          where: {
            OR: [
              { employeeCode: String(empCode) },
              { email: String(empCode) }
            ],
            role: 'DELIVERY'
          },
          select: { id: true, role: true }
        });
        if (matchedEmp) {
          assignedShipperIdInt = matchedEmp.id;
        }
      }

      // Chỉ chấp nhận gán cho nhân viên nội bộ thật có role DELIVERY
      if (assignedShipperIdInt !== null) {
        const shipperEmployee = await tx.employee.findUnique({
          where: { id: assignedShipperIdInt },
          select: { role: true }
        });
        if (!shipperEmployee || shipperEmployee.role !== 'DELIVERY') {
          const error = new Error('assignedShipperId không hợp lệ: phải là nhân viên nội bộ có vai trò DELIVERY.');
          error.statusCode = 400;
          throw error;
        }
      }

      // Shipper tự từ chối 1 đơn đang chờ nhận (nút "Từ Chối" ở tab Chờ Nhận
      // của Delivery/index.jsx) — gỡ gán shipper để đơn quay lại hàng chờ cho
      // Kho phân công người khác, KHÔNG đổi trạng thái đơn (vẫn READY_TO_SHIP).
      // Trước đây không có đường nào để null hoá assignedShipperId, nên đơn bị
      // gán sai/quá tải chỉ có Kho tự vào đổi lại được, shipper không tự xử
      // lý được và Kho cũng không biết shipper đã từ chối.
      const isRejectingAssignment = req.body.unassignShipper === true;
      if (isRejectingAssignment) {
        if (existingOrder.status !== 'READY_TO_SHIP') {
          const error = new Error('Chỉ có thể từ chối đơn khi đơn còn đang chờ nhận (READY_TO_SHIP).');
          error.statusCode = 400;
          throw error;
        }
        if (req.user?.role === 'DELIVERY' && existingOrder.assignedShipperId && Number(existingOrder.assignedShipperId) !== Number(req.user?.id)) {
          const error = new Error('Bạn không phải là shipper được phân công cho đơn này.');
          error.statusCode = 403;
          throw error;
        }
        skipCustomerEmail = true;
      }

      const updatedOrder = await tx.order.update({
        where: { orderId: id },
        data: {
          status,
          // Ghi assignedShipperId/deliveryRegion bất kể trạng thái đích —
          // trước đây 2 field này chỉ được ghi khi status==='SHIPPED', nhưng
          // giờ Kho phân công shipper trong khi đơn CÒN Ở READY_TO_SHIP (đơn
          // phải nằm bên "Chờ Nhận" của đúng shipper đó, chờ họ tự bấm "Nhận
          // Chuyến" mới chuyển sang SHIPPED) — nếu vẫn chỉ ghi lúc SHIPPED,
          // việc phân công sẽ bị lặng lẽ mất, đơn không lọc đúng theo shipper
          // ở tab Chờ Nhận nữa.
          ...(isRejectingAssignment ? { assignedShipperId: null } : (assignedShipperIdInt !== null ? { assignedShipperId: assignedShipperIdInt } : {})),
          ...(req.body.deliveryRegion !== undefined ? { deliveryRegion: req.body.deliveryRegion } : {}),
          ...(status === 'DELIVERED' && !isRestoreDelivered ? {
            deliveredAt: new Date(),
            paymentStatus: 'PAID',
            proofPhoto: req.body.proofPhoto !== undefined ? req.body.proofPhoto : existingOrder.proofPhoto,
            receiverNote: req.body.receiverNote !== undefined ? req.body.receiverNote : existingOrder.receiverNote,
            actualPaymentMethod: actualPayMethod,
            bankRefCode: req.body.bankRefCode || null,
            paymentProofPhoto: req.body.paymentProofPhoto || null,
            receivedByType: receivedType,
            receiverNameActual: receiverName
          } : {}),
          ...(status === 'SHIPPED' ? {
            shippedAt: req.body.shippedAt ? new Date(req.body.shippedAt) : (existingOrder.shippedAt || new Date()),
            failReason: null,
            failNote: req.body.failNote !== undefined ? req.body.failNote : null,
            ...(req.body.notes !== undefined ? { notes: req.body.notes } : {}),
            ...(!isNaN(parseFloat(req.body.lat)) && !isNaN(parseFloat(req.body.lng)) ? {
              lastLat: parseFloat(req.body.lat),
              lastLng: parseFloat(req.body.lng),
              locationUpdatedAt: new Date()
            } : {})
          } : {}),
          ...(status === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
          ...(status === 'CANCELLED' ? {
            cancelledAt: new Date(),
            failReason: req.body.failReason !== undefined ? req.body.failReason : existingOrder.failReason,
            failNote: req.body.failNote !== undefined ? req.body.failNote : existingOrder.failNote
          } : {}),
          ...(status === 'SHIPPING_FAILED' ? {
            failReason: req.body.failReason !== undefined ? req.body.failReason : (req.body.isAwaitingCallback ? 'Không liên lạc được (Chờ gọi lại 24h)' : existingOrder.failReason),
            failNote: req.body.failNote !== undefined ? req.body.failNote : existingOrder.failNote
          } : {}),
          // Ảnh minh chứng kiện hàng hoàn kho (chụp bởi Shipper) & ghi chú kèm theo.
          ...(status === 'RETURNING_TO_WAREHOUSE' ? {
            failReason: req.body.failReason !== undefined ? req.body.failReason : (req.body.returnReason || existingOrder.failReason),
            failNote: req.body.failNote !== undefined ? req.body.failNote : existingOrder.failNote,
            returnProofPhoto: req.body.returnProofPhoto !== undefined ? req.body.returnProofPhoto : existingOrder.returnProofPhoto,
            returnNote: req.body.returnNote !== undefined ? req.body.returnNote : existingOrder.returnNote
          } : {})
        }
      });

      if (status === 'CANCELLED' && existingOrder.status !== 'CANCELLED') {
        await queueSepayRefundsOnCancel(tx, id);
      }

      // Nếu đơn giao thành công, ghi nhận giao dịch thanh toán OrderPayment
      if (status === 'DELIVERED' && existingOrder.paymentStatus !== 'PAID') {
        const paymentRows = [];

        if (actualPayMethod === 'CASH') {
          // COD tiền mặt: Shipper đang giữ, Kế Toán đối soát sau
          paymentRows.push({
            orderId: id,
            method: 'CASH',
            amount: existingOrder.totalAmount,
            transactionId: `CASH-${id}-${Date.now().toString().slice(-4)}`,
            status: 'SUCCESS'
            // settledAt null → chờ Kế Toán đối soát
          });
        } else if (actualPayMethod === 'BANK_TRANSFER') {
          paymentRows.push({
            orderId: id,
            method: 'BANK_TRANSFER',
            amount: existingOrder.totalAmount,
            transactionId: req.body.bankRefCode || `BANK-${id}-${Date.now().toString().slice(-4)}`,
            status: 'SUCCESS',
            settledAt: new Date(),
            settledBy: changedBy
          });
        } else {
          // PREPAID: đã thu tiền trước (online/chuyển khoản khi đặt hàng)
          paymentRows.push({
            orderId: id,
            method: 'PREPAID',
            amount: existingOrder.totalAmount,
            transactionId: `PREPAID-${id}`,
            status: 'SUCCESS',
            settledAt: new Date(),
            settledBy: changedBy
          });
        }

        for (const row of paymentRows) {
          await tx.orderPayment.create({ data: row })
            .catch(e => console.warn('[OrderPayment] Ghi nhận thanh toán:', e.message));
        }
      }

      // Ghi nhật ký lịch sử trạng thái
      let historyLogNote = note;
      // Trước đây shipper ghi "ghi chú ký nhận" thì dòng lịch sử chỉ còn ghi chú đó,
      // mất thông tin người nhận & phương thức thu tiền dùng để đối soát.
      if (status === 'DELIVERED' && !isRestoreDelivered) historyLogNote = null;
      if (!historyLogNote) {
        if (status === 'DELIVERED') {
          let payLabel;
          if (actualPayMethod === 'BANK_TRANSFER') {
            payLabel = `Chuyển khoản VietQR (Mã GD: ${req.body.bankRefCode || 'Napas247'})`;
          } else if (actualPayMethod === 'CASH') {
            payLabel = 'Tiền mặt (COD - Shipper thu)';
          } else {
            payLabel = 'Đã thanh toán trước';
          }
          historyLogNote = `Giao hàng thành công (Người nhận: ${receiverName} - ${receivedType === 'DIRECT_CUSTOMER' ? 'Chính chủ' : 'Nhận thay'}, Thanh toán: ${payLabel}) bởi Shipper ${changedBy}${note ? ` — Ghi chú: ${note}` : ''}`;
        } else if (status === 'SHIPPING_FAILED') {

          historyLogNote = `Giao thất bại: ${req.body.failReason || 'Không liên lạc được'} (${req.body.isAwaitingCallback ? 'Chờ gọi lại 24h' : 'Hẹn lại'}) bởi ${changedBy}`;
        } else if (status === 'RETURNING_TO_WAREHOUSE') {
          const returnPhotoNote = req.body.returnProofPhoto ? ', đã chụp ảnh minh chứng kiện hàng' : '';
          historyLogNote = `Đơn hàng chuyển hoàn về kho (Lý do: ${req.body.returnReason || req.body.failReason || 'Khách không nhận'}${returnPhotoNote}) bởi ${changedBy}`;
        } else {
          historyLogNote = `Cập nhật trạng thái sang ${status} bởi ${changedBy}`;
        }
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status,
          note: historyLogNote,
          changedBy
        }
      });

      return updatedOrder;
    }, { maxWait: 10000, timeout: 30000 });

    // Gửi email cập nhật trạng thái cho khách hàng
    const updatedOrderFull = await prisma.order.findUnique({
      where: { orderId: id },
      include: { customer: true, items: { include: { product: true } } }
    });
    if (!skipCustomerEmail && updatedOrderFull?.customer?.email) {
      sendOrderStatusUpdateEmail({
        toEmail: updatedOrderFull.customer.email,
        customerName: updatedOrderFull.customer.name,
        orderId: id,
        status,
        note: note || req.body.receiverNote || req.body.failReason || null,
        items: updatedOrderFull.items,
        subtotal: updatedOrderFull.subtotal,
        discount: updatedOrderFull.discount,
        shippingFee: updatedOrderFull.shippingFee,
        vatAmount: updatedOrderFull.vatAmount,
        totalAmount: updatedOrderFull.totalAmount,
        proofPhoto: req.body.proofPhoto || req.body.proofUrl || updatedOrderFull.proofPhoto || null,
        receiverNote: req.body.receiverNote || updatedOrderFull.receiverNote || null,
        deliveredTime: updatedOrderFull.deliveredAt || new Date()
      }).catch(err => console.warn('[Email] Lỗi gửi email cập nhật trạng thái:', err.message));
    }

    res.json({
      success: true,
      message: isDuplicateDelivered
        ? 'Đơn hàng đã được xác nhận giao thành công trước đó.'
        : `Cập nhật trạng thái đơn hàng thành "${labelOf(ORDER_STATUS_VI, status)}" thành công`,
      duplicate: isDuplicateDelivered || undefined,
      data: order
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. KHÁCH HÀNG / CSKH TẠO YÊU CẦU ĐỔI TRẢ & HOÀN TIỀN (M_DHBH)
 */
const createReturnRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customerId = req.user?.id;
    const {
      reason,
      returnType = 'REFUND',
      type,
      refundAmount,
      bankName,
      bankAccountNo,
      bankAccountName,
      address,
      phone,
      customerName,
      note,
      evidenceUrl,
      image,
      evidence
    } = req.body;

    const finalEvidenceUrl = evidenceUrl || image || evidence || '';
    const actualType = type || returnType || 'REFUND';
    const isExchange = actualType === 'EXCHANGE';

    const order = await prisma.order.findFirst({
      where: {
        orderId: id,
        ...(req.user?.role === 'CUSTOMER' ? { customerId } : {})
      },
      include: { customer: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    if (!['DELIVERED', 'COMPLETED'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Chỉ được tạo yêu cầu đổi trả cho đơn hàng đã nhận/giao thành công' });
    }

    // Mỗi đơn chỉ có một yêu cầu đổi trả đang xử lý; yêu cầu bị từ chối thì được gửi lại.
    const activeReturn = await prisma.returnRequest.findFirst({
      where: { orderId: order.orderId, status: { notIn: ['REJECTED', 'QC_REJECTED'] } }
    });
    if (activeReturn) {
      return res.status(409).json({ success: false, message: `Đơn #${order.orderId} đã có yêu cầu đổi trả ${activeReturn.rmaCode || ''} đang được xử lý.`.replace('  ', ' ') });
    }
    const requestedRefund = refundAmount !== undefined && refundAmount !== null && refundAmount !== '' ? parseFloat(refundAmount) : Number(order.totalAmount);
    if (!(requestedRefund > 0) || requestedRefund > Number(order.totalAmount) + 1) {
      return res.status(400).json({ success: false, message: `Số tiền yêu cầu hoàn không hợp lệ (tối đa ${Number(order.totalAmount).toLocaleString('vi-VN')}đ).` });
    }

    // Kiểm tra cấu hình Auto-Approve từ companySettings (mặc định false = cần CSKH duyệt thủ công)
    let isAutoApprove = false;
    try {
      const settings = await prisma.companySettings.findUnique({ where: { id: 1 } });
      isAutoApprove = Boolean(settings?.autoApproveReturns);
    } catch (_) {}

    const initialStatus = isAutoApprove ? 'RETURN_APPROVED' : 'PENDING';

    // Mã RMA ngắn hiển thị cho CSKH/Kho/khách hàng (vd "RMA-260917-4821") — cùng
    // quy ước dateStr+randCode với PO-.../PR-... ở các module khác, thay cho
    // việc hiển thị thẳng UUID `id` (rất dài, không phù hợp hiển thị).
    const rmaDateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const rmaRandCode = Math.floor(1000 + Math.random() * 9000);
    const rmaCode = `RMA-${rmaDateStr}-${rmaRandCode}`;

    // 1. Tạo bản ghi ReturnRequest chi tiết
    const returnReq = await prisma.returnRequest.create({
      data: {
        rmaCode,
        orderId: order.orderId,
        customerId: order.customerId,
        customerName: customerName || order.customer?.name,
        phone: phone || order.customer?.phone,
        address: address || order.shippingAddress,
        type: actualType,
        reason: reason || 'Khách hàng yêu cầu hoàn trả',
        note: note || '',
        evidenceUrl: finalEvidenceUrl,
        refundAmount: isExchange ? 0 : requestedRefund,
        bankName: isExchange ? '' : (bankName || ''),
        bankAccountNo: isExchange ? '' : (bankAccountNo || ''),
        bankAccountName: isExchange ? '' : (bankAccountName || ''),
        status: initialStatus
      }
    });

    // 2. Cập nhật trạng thái đơn: nếu auto duyệt thì chuyển sang RETURNING_TO_WAREHOUSE
    if (isAutoApprove) {
      await prisma.order.update({
        where: { orderId: id },
        data: { status: 'RETURNING_TO_WAREHOUSE' }
      });
    }

    const loaiYeuCauText = isExchange ? 'Đổi mới 1-1' : 'Trả hàng Hoàn tiền 100%';

    await prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        status: isAutoApprove ? 'RETURNING_TO_WAREHOUSE' : order.status,
        note: isAutoApprove
          ? `Khách hàng tạo yêu cầu ${loaiYeuCauText} (Hệ thống tự động duyệt đổi trả). Lý do: ${reason || 'Không ghi'}. ${!isExchange && bankAccountNo ? `Số TK hoàn: ${bankAccountNo} (${bankName || 'N/A'})` : ''}`
          : `Khách hàng gửi yêu cầu ${loaiYeuCauText} (Chờ CSKH thẩm định & phê duyệt). Lý do: ${reason || 'Không ghi'}.`,
        changedBy: req.user?.fullname || req.user?.name || 'Khách hàng'
      }
    });

    res.json({
      success: true,
      message: isAutoApprove
        ? `Yêu cầu ${loaiYeuCauText} đã được tự động duyệt. Shipper sẽ liên hệ thu hồi hàng.`
        : `Yêu cầu ${loaiYeuCauText} đã được tiếp nhận thành công. Nhân viên CSKH sẽ thẩm định và phản hồi sớm nhất!`,
      data: {
        ...returnReq,
        image: returnReq.evidenceUrl || finalEvidenceUrl || '',
        evidenceUrl: returnReq.evidenceUrl || finalEvidenceUrl || ''
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4.1 CSKH THẨM ĐỊNH & DUYỆT / TỪ CHỐI YÊU CẦU ĐỔI TRẢ (TỰ DUYỆT)
 */
const reviewReturnRequest = async (req, res, next) => {
  try {
    const { id } = req.params; // id có thể là returnRequest.id hoặc orderId
    const { decision, note, rejectReason } = req.body;
    const reviewerName = req.user?.fullname || req.user?.name || req.user?.username || 'CSKH';

    const returnReq = await prisma.returnRequest.findFirst({
      where: {
        OR: [
          { id: id },
          { orderId: id }
        ]
      }
    });

    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu đổi trả' });
    }

    const isApprove = decision === 'APPROVE' || decision === 'RETURN_APPROVED';
    const isReject = decision === 'REJECT' || decision === 'REJECTED';

    if (!isApprove && !isReject) {
      return res.status(400).json({ success: false, message: 'Hành động thẩm định không hợp lệ. Chỉ chấp nhận APPROVE hoặc REJECT.' });
    }

    const newStatus = isApprove ? 'RETURN_APPROVED' : 'REJECTED';
    const reasonText = rejectReason || note || (isReject ? 'Không đủ điều kiện đổi trả theo quy định' : 'CSKH đã thẩm định hợp lệ');

    // Cập nhật ReturnRequest
    const updatedReturn = await prisma.returnRequest.update({
      where: { id: returnReq.id },
      data: {
        status: newStatus,
        note: returnReq.note ? `${returnReq.note} | [CSKH: ${reasonText}]` : `[CSKH: ${reasonText}]`
      }
    });

    // Cập nhật Order status tương ứng
    if (isApprove) {
      await prisma.order.update({
        where: { orderId: returnReq.orderId },
        data: { status: 'RETURNING_TO_WAREHOUSE' }
      });
    }

    await prisma.orderStatusHistory.create({
      data: {
        orderId: returnReq.orderId,
        status: isApprove ? 'RETURNING_TO_WAREHOUSE' : 'DELIVERED',
        note: isApprove
          ? `CSKH ${reviewerName} đã thẩm định & duyệt yêu cầu đổi trả. Chuyển Shipper thu hồi kiện hàng.`
          : `CSKH ${reviewerName} từ chối yêu cầu đổi trả. Lý do: ${reasonText}`,
        changedBy: reviewerName
      }
    });

    res.json({
      success: true,
      message: isApprove
        ? `Đã duyệt yêu cầu đổi trả #${returnReq.id}! Đơn đã chuyển sang danh sách thu hồi của Shipper.`
        : `Đã từ chối yêu cầu đổi trả #${returnReq.id}.`,
      data: updatedReturn
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4.2 CSKH DUYỆT TỰ ĐỘNG TẤT CẢ CÁC YÊU CẦU ĐỔI TRẢ ĐANG CHỜ (AUTO DUYỆT HÀNG LOẠT)
 */
const batchApproveReturns = async (req, res, next) => {
  try {
    const reviewerName = req.user?.fullname || req.user?.name || req.user?.username || 'CSKH';

    const pendingReturns = await prisma.returnRequest.findMany({
      where: { status: 'PENDING' }
    });

    if (pendingReturns.length === 0) {
      return res.json({ success: true, message: 'Không có yêu cầu đổi trả nào đang chờ duyệt', count: 0 });
    }

    const updatedIds = [];
    for (const ret of pendingReturns) {
      await prisma.returnRequest.update({
        where: { id: ret.id },
        data: {
          status: 'RETURN_APPROVED',
          note: ret.note ? `${ret.note} | [CSKH duyệt tự động hàng loạt]` : '[CSKH duyệt tự động hàng loạt]'
        }
      });

      await prisma.order.update({
        where: { orderId: ret.orderId },
        data: { status: 'RETURNING_TO_WAREHOUSE' }
      });

      await prisma.orderStatusHistory.create({
        data: {
          orderId: ret.orderId,
          status: 'RETURNING_TO_WAREHOUSE',
          note: `CSKH ${reviewerName} duyệt nhanh (Auto Approve All). Chuyển Shipper thu hồi kiện hàng.`,
          changedBy: reviewerName
        }
      });

      updatedIds.push(ret.id);
    }

    res.json({
      success: true,
      message: `Đã duyệt thành công ${updatedIds.length} yêu cầu đổi trả sang trạng thái Thu Hồi!`,
      count: updatedIds.length,
      ids: updatedIds
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 4.3 LẤY VÀ CẬP NHẬT CẤU HÌNH TỰ ĐỘNG DUYỆT ĐỔI TRẢ
 */
const getReturnSettings = async (req, res, next) => {
  try {
    const settings = await prisma.companySettings.findUnique({ where: { id: 1 } });
    res.json({
      success: true,
      data: {
        autoApproveReturns: Boolean(settings?.autoApproveReturns)
      }
    });
  } catch (err) {
    next(err);
  }
};

const updateReturnSettings = async (req, res, next) => {
  try {
    const { autoApproveReturns } = req.body;
    const settings = await prisma.companySettings.upsert({
      where: { id: 1 },
      update: { autoApproveReturns: Boolean(autoApproveReturns) },
      create: { id: 1, autoApproveReturns: Boolean(autoApproveReturns) }
    });
    res.json({
      success: true,
      message: `Đã ${autoApproveReturns ? 'BẬT' : 'TẮT'} chế độ Tự Động Duyệt (Auto-Approve) đổi trả!`,
      data: {
        autoApproveReturns: Boolean(settings.autoApproveReturns)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. SHIPPER XÁC NHẬN THU HỒI HÀNG TẠI NHÀ KHÁCH
 */
const shipperPickupReturn = async (req, res, next) => {
  try {
    const { id } = req.params; // orderId hoặc returnRequestId
    const { pickupProofPhoto, note } = req.body;
    const shipperName = req.user?.fullname || req.user?.name || req.user?.username || 'Shipper';
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const returnReq = await prisma.returnRequest.findFirst({
      where: { OR: [{ id: id }, { orderId: id }] },
      orderBy: { createdAt: 'desc' },
      include: { order: true }
    });

    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu đổi trả' });
    }

    if (returnReq.status !== 'RETURN_APPROVED') {
      return res.status(409).json({ success: false, message: 'Chỉ thu hồi được kiện hàng của yêu cầu đổi trả đã được CSKH duyệt.' });
    }

    // Kiểm tra quyền: Nếu là Shipper (DELIVERY), chỉ nhân viên đã trực tiếp giao đơn này mới có quyền thu hồi
    if (userRole === 'DELIVERY' && returnReq.order) {
      const assignedShipperId = returnReq.order.assignedShipperId;
      if (assignedShipperId && userId && Number(assignedShipperId) !== Number(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Chỉ nhân viên giao hàng đã trực tiếp giao đơn này mới có quyền thu hồi kiện hàng của khách.'
        });
      }
    }

    await prisma.returnRequest.update({
      where: { id: returnReq.id },
      data: {
        status: 'RETURNING_TO_WAREHOUSE',
        pickupShipperId: String(req.user?.id || req.user?.username || ''),
        pickupProofPhoto: pickupProofPhoto || '',
        pickedUpAt: new Date()
      }
    });

    await prisma.order.update({
      where: { orderId: returnReq.orderId },
      data: { status: 'RETURNING_TO_WAREHOUSE' }
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: returnReq.orderId,
        status: 'RETURNING_TO_WAREHOUSE',
        note: note || `Shipper ${shipperName} đã thu hồi hàng thành công tại nhà khách. Đang vận chuyển về kho để QC kiểm định.`,
        changedBy: shipperName
      }
    });

    res.json({
      success: true,
      message: 'Đã xác nhận thu hồi kiện hàng từ khách. Đang vận chuyển về kho.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 6. SHIPPER BÀN GIAO KIỆN HÀNG THU HỒI VỀ KHO CHO QC
 */
const shipperDeliverWarehouseReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const shipperName = req.user?.fullname || req.user?.name || req.user?.username || 'Shipper';

    const returnReq = await prisma.returnRequest.findFirst({
      where: { OR: [{ id: id }, { orderId: id }] },
      orderBy: { createdAt: 'desc' }
    });

    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu đổi trả.' });
    }
    if (returnReq.status !== 'RETURNING_TO_WAREHOUSE') {
      return res.status(409).json({ success: false, message: 'Kiện hàng đổi trả này chưa được shipper thu hồi hoặc đã bàn giao kho trước đó.' });
    }
    // Chỉ shipper đã thu hồi kiện mới được xác nhận bàn giao (trước đây shipper
    // bất kỳ cũng bấm được cho kiện của người khác)
    if (req.user?.role === 'DELIVERY' && returnReq.pickupShipperId
        && ![String(req.user.id), String(req.user.username || '')].includes(String(returnReq.pickupShipperId))) {
      return res.status(403).json({ success: false, message: 'Kiện hàng này do shipper khác thu hồi.' });
    }
    {
      await prisma.returnRequest.update({
        where: { id: returnReq.id },
        data: {
          status: 'DELIVERED_TO_WAREHOUSE',
          deliveredWarehouseAt: new Date()
        }
      });

      await prisma.order.update({
        where: { orderId: returnReq.orderId },
        data: { status: 'DELIVERED_TO_WAREHOUSE' }
      });

      await prisma.orderStatusHistory.create({
        data: {
          orderId: returnReq.orderId,
          status: 'DELIVERED_TO_WAREHOUSE',
          note: `Shipper ${shipperName} đã bàn giao kiện hàng về kho. Chờ Kỹ thuật viên QC thẩm định.`,
          changedBy: shipperName
        }
      });
    }

    res.json({
      success: true,
      message: 'Đã bàn giao kiện hàng về kho thành công cho QC.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 7. QC THẨM ĐỊNH KỸ THUẬT SẢN PHẨM HOÀN TRẢ (CÓ ẢNH MINH CHỨNG)
 */
const qcInspectReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { qcDecision, qcDefectType, qcNotes, qcProofPhoto, note, actualSerial } = req.body;
    const inspectorName = req.user?.fullname || req.user?.name || req.body.qcInspector || 'Kỹ thuật viên QC';

    const returnReq = await prisma.returnRequest.findFirst({
      where: { OR: [{ id: id }, { orderId: id }] },
      orderBy: { createdAt: 'desc' }
    });

    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu đổi trả' });
    }

    if (returnReq.status !== 'DELIVERED_TO_WAREHOUSE') {
      return res.status(409).json({ success: false, message: 'Chỉ thẩm định được kiện hàng đổi trả đã được bàn giao về kho.' });
    }

    const isApproved = ['APPROVE_REFUND', 'APPROVE_EXCHANGE', 'EXCHANGE_NEW', 'RESTOCK_WAREHOUSE', 'PASSED'].includes(qcDecision);
    const newStatus = isApproved ? 'QC_PASSED' : 'REJECTED';

    const serialPrefix = actualSerial ? `[Mã Serial đối soát: ${actualSerial}] ` : '';
    const finalQcNotes = serialPrefix + (qcNotes || '');

    await prisma.returnRequest.update({
      where: { id: returnReq.id },
      data: {
        status: newStatus,
        qcDecision: qcDecision || (returnReq.type === 'EXCHANGE' ? 'EXCHANGE_NEW' : 'RESTOCK_WAREHOUSE'),
        qcDefectType: qcDefectType || 'DOA_FACTORY_DEFECT',
        qcNotes: finalQcNotes,
        qcProofPhoto: qcProofPhoto || null,
        qcInspectorId: req.user?.id && !isNaN(Number(req.user.id)) ? Number(req.user.id) : null,
        qcInspectedAt: new Date()
      }
    });

    await prisma.order.update({
      where: { orderId: returnReq.orderId },
      data: { status: isApproved ? 'QC_PASSED' : 'DELIVERED' }
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: returnReq.orderId,
        status: isApproved ? 'QC_PASSED' : 'REJECTED',
        note: note || (isApproved
          ? `QC Thẩm định: ĐẠT ĐIỀU KIỆN (${qcDefectType || 'Lỗi phần cứng'}). Xác nhận sản phẩm nguyên vẹn có ảnh minh chứng. (Giám định bởi ${inspectorName})`
          : `QC Thẩm định: TỪ CHỐI ĐỔI TRẢ (${qcDefectType || 'Vi phạm điều kiện'}). Chờ Shipper nhận hàng tại kho để giao trả lại cho khách. (Giám định bởi ${inspectorName})`),
        changedBy: inspectorName
      }
    });

    res.json({
      success: true,
      message: isApproved ? 'QC thẩm định đạt chuẩn! Đã lưu ảnh minh chứng và chuyển Thủ kho nhập kệ.' : 'QC đã từ chối yêu cầu đổi trả. Kiện hàng chuyển sang chờ Shipper giao trả lại khách.',
      data: returnReq
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 7b. SHIPPER GIAO TRẢ LẠI HÀNG BỊ QC TỪ CHỐI CHO KHÁCH
 */
const shipperRedeliverReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const shipperName = req.user?.fullname || req.user?.name || req.user?.username || 'Shipper';

    const returnReq = await prisma.returnRequest.findFirst({
      where: { OR: [{ id: id }, { orderId: id }] },
      orderBy: { createdAt: 'desc' },
      include: { order: true }
    });

    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu đổi trả' });
    }

    const targetStatus = status === 'RETURNED_TO_CUSTOMER' ? 'RETURNED_TO_CUSTOMER' : 'RETURNING_TO_CUSTOMER';
    const isCompleted = targetStatus === 'RETURNED_TO_CUSTOMER';

    // Chỉ kiện ĐÃ về kho và bị QC từ chối mới giao trả khách; "đã trả khách" chỉ
    // sau bước "đang giao trả". Trước đây không kiểm tra gì — 1 phiếu vừa tạo
    // (hàng còn ở nhà khách) cũng nhảy thẳng được sang "Đã trả lại khách".
    const qcRejectedAtWarehouse = ['REJECTED', 'QC_REJECTED'].includes(returnReq.status) && Boolean(returnReq.deliveredWarehouseAt);
    const allowed = isCompleted ? returnReq.status === 'RETURNING_TO_CUSTOMER' || qcRejectedAtWarehouse : qcRejectedAtWarehouse;
    if (!allowed) {
      return res.status(409).json({
        success: false,
        message: isCompleted
          ? 'Chỉ xác nhận "đã trả khách" cho kiện đang được giao trả.'
          : 'Chỉ giao trả khách các kiện đã về kho và bị QC từ chối đổi trả.'
      });
    }

    await prisma.returnRequest.update({
      where: { id: returnReq.id },
      data: {
        status: targetStatus
      }
    });

    const statusNote = note || (isCompleted
      ? `Shipper ${shipperName} đã hoàn trả kiện hàng không đủ điều kiện đổi trả tận tay khách hàng.`
      : `Shipper ${shipperName} đã nhận kiện hàng bị QC từ chối từ kho và đang trên đường giao trả lại cho khách.`);

    await prisma.orderStatusHistory.create({
      data: {
        orderId: returnReq.orderId,
        status: targetStatus,
        note: statusNote,
        changedBy: shipperName
      }
    });

    if (isCompleted) {
      await prisma.order.update({
        where: { orderId: returnReq.orderId },
        data: { status: 'DELIVERED' }
      });
    }

    res.json({
      success: true,
      message: isCompleted ? 'Đã hoàn tất giao trả lại kiện hàng cho khách.' : 'Đã nhận kiện hàng từ kho, đang giao trả lại cho khách.',
      data: returnReq
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 8. THỦ KHO XÁC NHẬN NHẬP LẠI KHO (RESTOCK / EXCHANGE REPLACEMENT)
 */
const confirmReturnWarehouse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { shelfLocation, shelfNote, note } = req.body;
    const changedBy = req.user?.fullname || req.user?.name || 'Thủ kho';
    const SHELVES = ['SHELF_A1_RESTOCK', 'SHELF_B3_OUTLET', 'SHELF_C2_VENDOR', 'SHELF_D_SCRAP'];
    const shelf = SHELVES.includes(shelfLocation) ? shelfLocation : 'SHELF_A1_RESTOCK';

    const order = await prisma.$transaction(async (tx) => {
      const returnReq = await tx.returnRequest.findFirst({
        where: { OR: [{ id }, { orderId: id }, { rmaCode: id }] },
        orderBy: { createdAt: 'desc' }
      });
      if (!returnReq) {
        const error = new Error('Không tìm thấy phiếu đổi trả của đơn hàng này.');
        error.statusCode = 404;
        throw error;
      }
      // Chỉ nhập kho kiện hàng đã được QC thẩm định đạt — claim có điều kiện để 2 lần bấm
      // (hoặc 2 thủ kho) không cộng tồn 2 lần. Trước đây hàm này không kiểm tra trạng thái
      // nào, gọi lại là cộng tồn thêm một lần.
      const claim = await tx.returnRequest.updateMany({
        where: { id: returnReq.id, status: 'QC_PASSED' },
        data: { status: 'RESTOCKING' }
      });
      if (claim.count !== 1) {
        const error = new Error(`Phiếu đổi trả ${returnReq.rmaCode || returnReq.id} chưa đạt thẩm định QC hoặc đã được nhập kho trước đó.`);
        error.statusCode = 409;
        throw error;
      }

      const existingOrder = await tx.order.findUnique({
        where: { orderId: returnReq.orderId },
        include: { items: true, customer: true }
      });
      const isExchange = returnReq.type === 'EXCHANGE';
      const isSellableShelf = ['SHELF_A1_RESTOCK', 'SHELF_B3_OUTLET'].includes(shelf);

      // Hàng trả về kệ bán: cộng tồn, serial về AVAILABLE, đảo giá vốn của đơn gốc (hàng
      // chưa bị tiêu thụ). Kệ gửi hãng/phế phẩm: không cộng tồn bán, serial đánh dấu,
      // giá vốn giữ lại như tổn thất.
      await returnOrderStock(tx, existingOrder, {
        sellable: isSellableShelf,
        lostSerialStatus: shelf === 'SHELF_C2_VENDOR' ? 'WARRANTY' : 'DEFECTIVE',
        note: isSellableShelf
          ? `Nhập lại kho từ Đơn Hoàn Trả #${existingOrder.orderId} vào ${shelf}`
          : `Kiện hoàn trả #${existingOrder.orderId} xếp ${shelf} — không nhập tồn bán`
      });

      // Đổi mới 1-1: tạo đơn thay thế 0đ và XUẤT KHO THẬT sản phẩm mới (trước đây đơn đổi
      // mới tạo thẳng ở CONFIRMED nên hàng rời kho mà không hề trừ tồn/serial).
      let replacementOrderId = null;
      if (isExchange) {
        replacementOrderId = `ORD-EXC-${existingOrder.orderId.replace('ORD-', '')}`;
        const existingExcOrder = await tx.order.findUnique({ where: { orderId: replacementOrderId } });
        if (!existingExcOrder) {
          const replacement = await tx.order.create({
            data: {
              orderId: replacementOrderId,
              customerId: existingOrder.customerId,
              subtotal: 0,
              discount: 0,
              shippingFee: 0,
              vatAmount: 0,
              totalAmount: 0,
              paymentMethod: existingOrder.paymentMethod || 'COD',
              paymentStatus: 'PAID',
              status: 'CONFIRMED',
              confirmedAt: new Date(),
              shippingAddress: existingOrder.shippingAddress,
              shippingCity: existingOrder.shippingCity || 'Hồ Chí Minh',
              notes: `[ĐỔI MỚI 1-1] Xuất kho sản phẩm mới thay thế cho đơn lỗi #${existingOrder.orderId}`,
              items: {
                create: existingOrder.items.map((it, idx) => ({
                  orderItemId: `EXC-ITM-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
                  productId: it.productId,
                  sku: it.sku,
                  name: it.name,
                  quantity: it.quantity,
                  price: 0,
                  originalPrice: it.originalPrice,
                  totalPrice: 0
                }))
              },
              statusHistory: {
                create: {
                  status: 'CONFIRMED',
                  note: `Tự động tạo đơn đổi mới 1-1 (0đ) từ phiếu ${returnReq.rmaCode || returnReq.id}. Đã xuất kho sản phẩm thay thế, chờ kho bàn giao vận chuyển.`,
                  changedBy
                }
              }
            },
            include: { items: true }
          });
          await deductOrderStock(tx, replacement, { note: `Xuất kho sản phẩm đổi mới 1-1 cho đơn #${existingOrder.orderId}` });
        }
      }

      const targetStatus = shelf === 'SHELF_D_SCRAP'
        ? 'INSPECTED_SCRAP'
        : shelf === 'SHELF_C2_VENDOR'
          ? 'VENDOR_WARRANTY'
          : isExchange ? 'EXCHANGED' : 'RESTOCKED';

      await tx.returnRequest.update({
        where: { id: returnReq.id },
        data: {
          status: targetStatus,
          shelfLocation: shelf,
          shelfNote: shelfNote || note || 'Đã phân luồng vị trí kệ kho',
          replacementOrderId: replacementOrderId || undefined,
          restockedAt: new Date(),
          restockedById: req.user?.id && !isNaN(Number(req.user.id)) ? Number(req.user.id) : null
        }
      });

      const updatedOrder = await tx.order.update({
        where: { orderId: existingOrder.orderId },
        data: { status: targetStatus }
      });

      const historyNote = note || (
        targetStatus === 'INSPECTED_SCRAP'
          ? `Kho đã xếp kiện hàng vào khu phế phẩm (${shelf}). Không nhập lại tồn kho bán.`
          : targetStatus === 'VENDOR_WARRANTY'
            ? `Kho đã xếp kiện hàng vào khu chờ gửi hãng bảo hành (${shelf}). Không nhập lại tồn kho bán.`
            : isExchange
              ? `Kho đã nhận kiện hàng cũ (${shelf}). Đã tạo Đơn Đổi Mới #${replacementOrderId} và xuất kho sản phẩm thay thế.`
              : `Kho đã nhập kiện hàng vào ${shelf}. Chuyển Kế toán giải ngân hoàn tiền.`
      );
      await tx.orderStatusHistory.create({
        data: { orderId: existingOrder.orderId, status: targetStatus, note: historyNote, changedBy }
      });

      return { ...updatedOrder, replacementOrderId };
    }, { timeout: 20000 });

    const resultMessage = order.replacementOrderId
      ? `Đã nhập kho kiện hàng cũ và tự động khởi tạo Đơn Đổi Mới #${order.replacementOrderId}.`
      : order.status === 'INSPECTED_SCRAP'
        ? 'Đã ghi nhận kiện hàng vào khu phế phẩm. Không cộng vào tồn kho bán.'
        : order.status === 'VENDOR_WARRANTY'
          ? 'Đã ghi nhận kiện hàng chuyển gửi hãng bảo hành. Không cộng vào tồn kho bán.'
          : 'Kho đã xác nhận nhập lại kho thành công. Đã chuyển Phiếu Đề Nghị Chi sang Kế toán giải ngân.';

    res.json({ success: true, message: resultMessage, data: order });
  } catch (err) {
    next(err);
  }
};

/**
 * 9. KẾ TOÁN XỬ LÝ HOÀN TIỀN / GHI SỔ CÁI (M_DHBH)
 */
const processRefund = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { refundMethod = 'BANK_TRANSFER', refundAmount, refundTxnCode, refundProofPhoto, note } = req.body;
    const changedBy = req.user?.fullname || req.user?.name || 'Kế toán viên';

    let order = await prisma.order.findFirst({
      where: { orderId: id },
      include: { customer: true }
    });

    if (!order) {
      // ReturnRequest has no `rmaNumber` column (never did) — this used to
      // query it anyway and crash with a PrismaClientValidationError any
      // time execution reached this fallback (i.e. whenever the caller
      // passed the return's own id instead of a real orderId, which is
      // exactly what Accountant.jsx's refund flow does when a return has no
      // linked orderId). Only `id` is a real, matchable field here.
      const retReq = await prisma.returnRequest.findFirst({
        where: {
          OR: [
            { id },
            { rmaCode: id }
          ]
        },
        include: { order: { include: { customer: true } } }
      });
      if (retReq && retReq.order) {
        order = retReq.order;
      }
    }

    if (!order) {
      // Nếu là orderId lưu dạng ORD-...
      const cleanId = String(id).replace('RET-', '').replace('RMA-', '');
      order = await prisma.order.findFirst({
        where: {
          OR: [
            { orderId: cleanId },
            { orderId: `ORD-${cleanId}` }
          ]
        },
        include: { customer: true }
      });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng tương ứng với mã yêu cầu hoàn tiền' });
    }

    if (order.paymentStatus === 'REFUNDED') {
      // Đơn hàng đã được hoàn tiền trong hệ thống — cập nhật đồng bộ các ReturnRequest nếu còn sót
      await prisma.returnRequest.updateMany({
        where: { orderId: order.orderId },
        data: {
          status: 'REFUNDED',
          refundTxnCode: refundTxnCode || undefined,
          refundProofPhoto: refundProofPhoto || undefined,
          refundedAt: new Date(),
          refundedById: req.user?.id && !isNaN(Number(req.user.id)) ? Number(req.user.id) : null
        }
      });

      return res.json({
        success: true,
        message: `Đơn hàng #${order.orderId} đã được hoàn tất chuyển tiền trước đó. Hệ thống đã đồng bộ trạng thái thành công.`,
        data: order
      });
    }

    // Chỉ hoàn tiền khi đơn có yêu cầu trả hàng hoàn tiền đã ĐẠT thẩm định, và không vượt
    // số tiền khách yêu cầu / giá trị đơn. Trước đây kế toán hoàn được số tiền bất kỳ cho mọi đơn.
    // Hoàn tiền sau khi Kho đã nhận & phân luồng kiện hàng (nếu hoàn trước, Kho không còn nhập được kiện vào kệ).
    const REFUNDABLE = ['RESTOCKED', 'VENDOR_WARRANTY', 'INSPECTED_SCRAP'];
    const eligible = await prisma.returnRequest.findFirst({
      where: { orderId: order.orderId, status: { in: REFUNDABLE }, type: { not: 'EXCHANGE' } },
      orderBy: { createdAt: 'desc' }
    });
    if (!eligible) {
      return res.status(400).json({ success: false, message: `Đơn #${order.orderId} chưa có yêu cầu trả hàng hoàn tiền đã đạt thẩm định — không thể hoàn tiền.` });
    }
    const maxAmount = Math.min(Number(order.totalAmount || 0), Number(eligible.refundAmount || order.totalAmount || 0));
    const finalAmount = refundAmount !== undefined && refundAmount !== null && refundAmount !== '' ? parseFloat(refundAmount) : maxAmount;
    if (!(finalAmount > 0) || finalAmount > maxAmount + 1) {
      return res.status(400).json({ success: false, message: `Số tiền hoàn không hợp lệ: tối đa ${maxAmount.toLocaleString('vi-VN')}đ cho đơn #${order.orderId}.` });
    }

    // Cập nhật đơn + phiếu đổi trả + ghi Sổ Cái trong cùng một giao dịch, có claim theo
    // paymentStatus để 2 lần bấm không ghi 2 khoản chi.
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: { orderId: order.orderId, paymentStatus: { not: 'REFUNDED' } },
        data: { status: 'REFUNDED', paymentStatus: 'REFUNDED' }
      });
      if (claim.count !== 1) {
        const error = new Error(`Đơn #${order.orderId} vừa được hoàn tiền ở nơi khác.`);
        error.statusCode = 409;
        throw error;
      }
      await tx.returnRequest.updateMany({
        where: { id: eligible.id },
        data: {
          status: 'REFUNDED',
          refundTxnCode: refundTxnCode || '',
          refundProofPhoto: refundProofPhoto || '',
          refundedAt: new Date(),
          refundedById: req.user?.id && !isNaN(Number(req.user.id)) ? Number(req.user.id) : null
        }
      });
      await tx.ledgerEntry.create({
        data: {
          type: 'REFUND',
          amount: finalAmount,
          channel: refundMethod === 'CASH' ? 'CASH' : 'BANK',
          description: `Chi hoàn tiền đơn hàng #${order.orderId} - Khách: ${order.customer?.name || 'Khách hàng'} (${refundTxnCode ? `Mã GD: ${refundTxnCode}` : 'Chuyển khoản'})`,
          referenceId: order.orderId,
          date: new Date()
        }
      });
      // Đơn bị trả hàng hoàn tiền: thu hồi điểm thành viên đã tích từ đơn này
      await adjustLoyaltyForOrder(tx, order.customerId, order.totalAmount, 'subtract');
      return tx.order.findUnique({ where: { orderId: order.orderId } });
    });

    const amountFormatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(finalAmount);

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.orderId,
        status: 'REFUNDED',
        note: note || `Kế toán đã hoàn tất giải ngân (${amountFormatted}) cho khách qua ${refundMethod}. Mã GD: ${refundTxnCode || 'N/A'}. (Xử lý bởi ${changedBy})`,
        changedBy
      }
    });

    res.json({
      success: true,
      message: `Đã hoàn tất hoàn tiền ${amountFormatted} cho khách hàng và ghi sổ cái kế toán thành công!`,
      data: updatedOrder
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 10. LẤY TOÀN BỘ DANH SÁCH YÊU CẦU ĐỔI TRẢ (Dành cho Shipper / QC / Kho / Kế toán)
 */
const getReturnRequests = async (req, res, next) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let whereClause = {};

    // Khách hàng chỉ xem yêu cầu đổi trả của chính mình (để theo dõi trạng thái trên trang Đơn hàng của tôi)
    if (userRole === 'CUSTOMER') {
      if (!userId) return res.json({ success: true, data: [] });
      whereClause = { OR: [{ customerId: String(userId) }, { order: { customerId: String(userId) } }] };
    }

    // Nếu là nhân viên giao hàng (DELIVERY), chỉ lấy các yêu cầu RMA thuộc đơn mà shipper này đã giao
    if (userRole === 'DELIVERY' && userId && !isNaN(Number(userId))) {
      whereClause = {
        order: {
          assignedShipperId: Number(userId)
        }
      };
    }

    const returnRequests = await prisma.returnRequest.findMany({
      where: whereClause,
      include: {
        order: {
          include: {
            items: true,
            statusHistory: { orderBy: { timestamp: 'desc' } },
            // Serial thật đã xuất cho đơn — QC đối soát serial hàng khách trả về
            serialNumbers: { select: { serial: true, productId: true, status: true } }
          }
        },
        customer: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const sanitizedReturns = returnRequests.map(r => {
      let code = r.rmaCode;
      if (!code) {
        const dStr = new Date(r.createdAt || Date.now()).toISOString().slice(2, 10).replace(/-/g, '');
        const idPart = String(r.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '1001';
        code = `RMA-${dStr}-${idPart}`;
      }
      return {
        ...r,
        rmaCode: code,
        image: r.evidenceUrl || '',
        evidenceUrl: r.evidenceUrl || ''
      };
    });

    res.json({
      success: true,
      data: sanitizedReturns
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 11. KHÁCH HÀNG CẬP NHẬT THÔNG TIN ĐƠN HÀNG KHI ĐANG PENDING (M_DHBH)
 */
const updateOrderDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customerId = req.user?.id;
    const { customerName, phone, shippingAddress, notes } = req.body;

    const order = await prisma.order.findUnique({
      where: { orderId: id },
      include: { customer: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    if (customerId && order.customerId !== customerId && req.user?.role === 'CUSTOMER') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa đơn hàng này' });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể chỉnh sửa thông tin khi đơn hàng đang ở trạng thái Chờ xác nhận (PENDING)' });
    }

    // Update Customer profile if name or phone changed
    if ((customerName && customerName !== order.customer?.name) || (phone && phone !== order.customer?.phone)) {
      if (customerId) {
        await prisma.customer.update({
          where: { customerId },
          data: {
            name: customerName || order.customer?.name,
            phone: phone || order.customer?.phone
          }
        });
      }
    }

    // Update Order details
    const updatedOrder = await prisma.order.update({
      where: { orderId: id },
      data: {
        shippingAddress: shippingAddress || order.shippingAddress,
        notes: notes !== undefined ? notes : order.notes
      },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              select: {
                productId: true,
                name: true,
                price: true,
                primaryImage: true,
                category: { select: { id: true, name: true, slug: true } }
              }
            }
          }
        },
        statusHistory: { orderBy: { timestamp: 'desc' } }
      }
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        status: order.status,
        note: 'Khách hàng tự cập nhật thông tin giao hàng (SĐT/Địa chỉ/Ghi chú)',
        changedBy: 'Khách hàng'
      }
    });

    res.json({
      success: true,
      message: 'Cập nhật thông tin giao hàng thành công',
      data: updatedOrder
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/orders/:orderId/location — REST fallback cho Shipper cập nhật
// vị trí GPS khi kết nối WebSocket bị rớt mạng giữa chừng (đường truyền di
// động không ổn định). Dùng chung 1 hàm persist+broadcast với WebSocket
// (websocketService.updateDeliveryLocation) để 2 đường không lệch nhau.
const updateDeliveryLocationHttp = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    let { lat, lng, speed, heading } = req.body || {};
    lat = parseFloat(lat);
    lng = parseFloat(lng);
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, message: 'Thiếu tọa độ lat/lng hợp lệ.' });
    }

    const order = await prisma.order.findUnique({
      where: { orderId: String(orderId) },
      select: { assignedShipperId: true }
    });
    if (!order) {
      return res.status(404).json({ success: false, message: `Không tìm thấy đơn hàng: ${orderId}` });
    }
    const userRole = req.user?.role;
    const userId = req.user?.id;
    if (userRole === 'DELIVERY' && Number(order.assignedShipperId) !== Number(userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không phải Shipper được giao đơn này.' });
    }

    const { updateDeliveryLocation } = require('../services/websocketService');
    await updateDeliveryLocation(String(orderId), {
      lat, lng, speed, heading,
      shipperName: req.user?.fullname || req.user?.name || null
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/orders/:orderId/tracking — thông tin tĩnh cho bản đồ theo dõi
// (Kho xuất phát, khu vực giao hàng, thông tin Shipper) + vị trí GPS gần
// nhất đã biết. Không geocode địa chỉ khách thành toạ độ chính xác (hệ
// thống chưa tích hợp dịch vụ geocode nào) — dùng deliveryRegion đã có sẵn
// trên đơn hàng để định vị gần đúng khu vực giao, khớp với cách
// deliveryRegions.js/OrderCard đã dùng ở nơi khác trong dự án.
// Quyền xem lộ trình giao hàng của một đơn: chủ đơn (khách) hoặc nhân viên nội bộ.
function trackingAccessError(req, order) {
  if (!order) return { status: 404, message: 'Không tìm thấy đơn hàng.' };
  const role = req.user?.role;
  if (!role) return { status: 401, message: 'Vui lòng đăng nhập để theo dõi đơn hàng.' };
  if (role === 'SUPPLIER') return { status: 403, message: 'Bạn không có quyền xem đơn hàng này.' };
  if (role === 'CUSTOMER' && order.customerId !== req.user.id) return { status: 404, message: 'Không tìm thấy đơn hàng.' };
  return null;
}

const getDeliveryTracking = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await prisma.order.findUnique({
      where: { orderId: String(orderId) },
      select: {
        customerId: true,
        status: true,
        shippingAddress: true,
        shippingCity: true,
        deliveryRegion: true,
        lastLat: true,
        lastLng: true,
        locationUpdatedAt: true,
        createdAt: true,
        confirmedAt: true,
        shippedAt: true,
        deliveredAt: true,
        cancelledAt: true,
        assignedShipper: { select: { fullName: true, phone: true } }
      }
    });
    // Lộ trình chứa địa chỉ khách, số điện thoại shipper và GPS: chỉ chủ đơn hoặc nhân viên được xem
    // (trước đây ai có mã đơn — vốn dễ đoán — cũng xem được).
    const denied = trackingAccessError(req, order);
    if (denied) return res.status(denied.status).json({ success: false, message: denied.message });

    // 2 kho thật trong hệ thống — Hà Nội phục vụ khu vực miền Bắc, còn lại
    // xuất từ Kho Tổng TP.HCM (xem prisma/seed.js).
    const warehouseId = order.deliveryRegion === 'HN_NORTH' ? 2 : 1;
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { name: true, address: true, lat: true, lng: true }
    });

    const { getActiveDelivery } = require('../services/websocketService');
    const live = typeof getActiveDelivery === 'function' ? getActiveDelivery(String(orderId)) : null;
    const originType = live?.originType || (order.lastLat != null ? 'gps' : 'warehouse');
    const originCoord = live?.originCoord || null;

    res.json({
      success: true,
      data: {
        status: order.status,
        warehouse,
        originType,
        originCoord,
        deliveryRegion: order.deliveryRegion,
        shippingAddress: order.shippingAddress,
        shippingCity: order.shippingCity,
        shipper: order.assignedShipper ? { name: order.assignedShipper.fullName, phone: order.assignedShipper.phone } : null,
        lastLocation: (order.lastLat != null && order.lastLng != null)
          ? { lat: order.lastLat, lng: order.lastLng, updatedAt: order.locationUpdatedAt }
          : null,
        timeline: {
          createdAt: order.createdAt,
          confirmedAt: order.confirmedAt,
          shippedAt: order.shippedAt,
          deliveredAt: order.deliveredAt,
          cancelledAt: order.cancelledAt
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/orders/:orderId/tracking/history — vệt di chuyển đầy đủ của
// Shipper cho đơn này (khác lastLocation ở trên chỉ có điểm cuối), dùng cho
// việc xem lại lộ trình đã đi (khiếu nại/đối soát) — cùng mức công khai với
// route tracking chính (tra cứu bằng mã đơn hàng, không cần đăng nhập).
const getDeliveryLocationHistory = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await prisma.order.findUnique({ where: { orderId: String(orderId) }, select: { orderId: true, customerId: true } });
    const denied = trackingAccessError(req, order);
    if (denied) return res.status(denied.status).json({ success: false, message: denied.message });
    const history = await prisma.locationHistory.findMany({
      where: { orderId: String(orderId) },
      orderBy: { createdAt: 'asc' },
      select: { lat: true, lng: true, speed: true, heading: true, createdAt: true }
    });
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// ĐƠN GIAO HÀNG TỒN QUA NGÀY
// ============================================================================

// Trạng thái còn nằm "ngoài đường" (shipper đang giữ hàng hoặc đơn chưa chốt
// xong) — đơn ở các trạng thái này mà bắt đầu từ trước hôm nay là đơn tồn.
const IN_TRANSIT_STATUSES = ['SHIPPED', 'SHIPPING_FAILED', 'FAILED_DELIVERY', 'RETURNING_TO_WAREHOUSE'];

// Hạn tự hoàn kho cho đơn giao thất bại (mục "Chờ gọi lại 24h" trước đây chỉ
// là lời hứa trên giao diện — không job nào thực hiện, đơn treo mãi).
const AWAITING_CALLBACK_LIMIT_MS = 24 * 60 * 60 * 1000;
const FAILED_DELIVERY_LIMIT_MS = 3 * 24 * 60 * 60 * 1000;

// Cùng bộ từ khoá với getDeliveryIncidentStatus (frontend deliveryHelpers.js)
const isAwaitingCallbackFail = (order) => {
  const s = `${order.failReason || ''} ${order.failNote || ''}`.toLowerCase();
  return s.includes('không liên lạc') || s.includes('không nghe máy') || s.includes('thuê bao') || s.includes('gọi lại');
};

// 0h hôm nay theo giờ Việt Nam (server có thể chạy UTC)
const startOfTodayVN = () => {
  const vn = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 60 * 60 * 1000);
};

// Thời điểm đơn bước vào trạng thái hiện tại: dòng lịch sử mới nhất cùng trạng
// thái, nếu không có thì ngày xuất kho / ngày tạo đơn.
const getStatusSinceMap = async (client, orders) => {
  const ids = orders.map(o => o.orderId);
  if (ids.length === 0) return new Map();
  const rows = await client.orderStatusHistory.groupBy({
    by: ['orderId', 'status'],
    where: { orderId: { in: ids } },
    _max: { timestamp: true }
  });
  const latest = new Map(rows.map(r => [`${r.orderId}|${r.status}`, r._max.timestamp]));
  return new Map(orders.map(o => [
    o.orderId,
    latest.get(`${o.orderId}|${o.status}`) || o.shippedAt || o.createdAt
  ]));
};

// Job định kỳ: đơn SHIPPING_FAILED quá hạn → tự chuyển RETURNING_TO_WAREHOUSE
// để shipper mang hàng về kho thay vì giữ vô thời hạn.
const autoReturnOverdueFailedDeliveries = async () => {
  const failed = await prisma.order.findMany({
    where: { status: 'SHIPPING_FAILED' },
    select: { orderId: true, status: true, failReason: true, failNote: true, shippedAt: true, createdAt: true }
  });
  if (failed.length === 0) return [];

  const sinceMap = await getStatusSinceMap(prisma, failed);
  const now = Date.now();
  const returned = [];

  for (const ord of failed) {
    const awaiting = isAwaitingCallbackFail(ord);
    const limit = awaiting ? AWAITING_CALLBACK_LIMIT_MS : FAILED_DELIVERY_LIMIT_MS;
    const since = new Date(sinceMap.get(ord.orderId)).getTime();
    if (!(now - since > limit)) continue;

    const reason = awaiting
      ? 'Quá 24h khách không gọi lại'
      : 'Quá 3 ngày giao thất bại / hẹn lại chưa giao được';
    try {
      const done = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'sepay:' + ord.orderId}))::text`;
        const current = await tx.order.findUnique({ where: { orderId: ord.orderId }, select: { status: true } });
        if (current?.status !== 'SHIPPING_FAILED') return false; // shipper vừa tự xử lý
        await tx.order.update({
          where: { orderId: ord.orderId },
          data: {
            status: 'RETURNING_TO_WAREHOUSE',
            returnNote: `Hệ thống tự chuyển hoàn kho: ${reason}.`
          }
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: ord.orderId,
            status: 'RETURNING_TO_WAREHOUSE',
            note: `Tự động chuyển hoàn kho — ${reason}. Shipper mang hàng về kho.`,
            changedBy: 'Hệ Thống Tự Động'
          }
        });
        return true;
      });
      if (done) returned.push({ orderId: ord.orderId, reason });
    } catch (err) {
      console.warn(`[AutoReturn] Không thể tự hoàn kho đơn ${ord.orderId}:`, err.message);
    }
  }
  return returned;
};

// GET /api/v1/orders/stale-deliveries — đơn còn ngoài đường từ trước hôm nay
// và đơn đang giao mà không có shipper (không ai thấy để xử lý), nhóm theo
// shipper kèm tiền mặt COD shipper đó đang giữ chưa đối soát.
const getStaleDeliveries = async (req, res, next) => {
  try {
    const todayStart = startOfTodayVN();
    const candidates = await prisma.order.findMany({
      where: { status: { in: IN_TRANSIT_STATUSES } },
      select: {
        orderId: true, status: true, totalAmount: true, shippingAddress: true,
        failReason: true, failNote: true, shippedAt: true, createdAt: true,
        assignedShipperId: true,
        assignedShipper: { select: { id: true, fullName: true, employeeCode: true, phone: true } },
        customer: { select: { name: true, phone: true } }
      }
    });

    const sinceMap = await getStatusSinceMap(prisma, candidates);
    const stale = candidates
      .map(o => ({ ...o, since: sinceMap.get(o.orderId) }))
      .filter(o => !o.assignedShipperId || new Date(o.since) < todayStart);

    const shipperIds = [...new Set(stale.map(o => o.assignedShipperId).filter(Boolean))];
    const codRows = shipperIds.length === 0 ? [] : await prisma.orderPayment.findMany({
      where: { method: 'CASH', status: 'SUCCESS', settledAt: null, order: { assignedShipperId: { in: shipperIds } } },
      select: { amount: true, order: { select: { assignedShipperId: true } } }
    });
    const codByShipper = {};
    for (const p of codRows) {
      const sid = p.order.assignedShipperId;
      codByShipper[sid] = (codByShipper[sid] || 0) + Number(p.amount);
    }

    const groups = {};
    for (const o of stale) {
      const key = o.assignedShipperId || 'UNASSIGNED';
      if (!groups[key]) {
        groups[key] = {
          shipperId: o.assignedShipperId || null,
          shipperName: o.assignedShipper?.fullName || null,
          shipperCode: o.assignedShipper?.employeeCode || null,
          shipperPhone: o.assignedShipper?.phone || null,
          codHolding: o.assignedShipperId ? (codByShipper[o.assignedShipperId] || 0) : 0,
          orders: []
        };
      }
      groups[key].orders.push({
        orderId: o.orderId,
        status: o.status,
        totalAmount: Number(o.totalAmount),
        customerName: o.customer?.name,
        customerPhone: o.customer?.phone,
        shippingAddress: o.shippingAddress,
        failReason: o.failReason,
        since: o.since,
        daysStale: Math.max(0, Math.floor((todayStart - new Date(o.since)) / 86400000) + 1)
      });
    }

    const data = Object.values(groups)
      .map(g => ({ ...g, orders: g.orders.sort((a, b) => new Date(a.since) - new Date(b.since)) }))
      .sort((a, b) => (a.shipperId === null) - (b.shipperId === null) || b.orders.length - a.orders.length);

    res.json({ success: true, data, total: stale.length });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/orders/awaiting-stock/allocate — Quản lý rà lại toàn bộ đơn "Chờ hàng" (đơn cũ
// nhất trước): đơn nào nay đã đủ tồn thì duyệt & xuất kho ngay. Dùng sau kiểm kê/điều chỉnh tồn
// hoặc khi đơn bị kẹt ở Chờ hàng dù kho đã có hàng.
const allocateAwaitingStock = async (req, res, next) => {
  try {
    const { allocateAwaitingOrders } = require('../services/orderApprovalService');
    const before = await prisma.order.count({ where: { status: 'AWAITING_STOCK' } });
    const approved = await allocateAwaitingOrders(prisma, null, { limit: 50 });
    res.json({
      success: true,
      message: approved.length
        ? `Đã phân bổ hàng & duyệt ${approved.length}/${before} đơn chờ hàng.`
        : `Chưa đơn nào trong ${before} đơn chờ hàng đủ tồn kho để phân bổ.`,
      data: { approved, remaining: before - approved.length }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  allocateAwaitingStock,
  createOrder,
  createPosOrder,
  getCustomerOrders,
  updateOrderStatus,
  createReturnRequest,
  shipperPickupReturn,
  shipperDeliverWarehouseReturn,
  qcInspectReturn,
  shipperRedeliverReturn,
  confirmReturnWarehouse,
  processRefund,
  getReturnRequests,
  updateOrderDetails,
  adjustLoyaltyForOrder,
  reviewReturnRequest,
  batchApproveReturns,
  getReturnSettings,
  updateReturnSettings,
  updateDeliveryLocationHttp,
  getDeliveryTracking,
  getDeliveryLocationHistory,
  confirmReceivedOrder,
  customerCancelOrder,
  cancelSingleOrderInternal,
  autoCancelUnpaidOrders,
  autoReturnOverdueFailedDeliveries,
  getStaleDeliveries,
  IN_TRANSIT_STATUSES,
  startOfTodayVN
};
