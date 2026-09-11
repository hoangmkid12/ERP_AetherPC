const prisma = require('../config/database');
const { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } = require('../services/emailService');
const { claimAvailableSerials } = require('../utils/serialAllocation');
const { hasOperationalPermission } = require('../middlewares/rbac.middleware');

const LOYALTY_VND_PER_POINT = 10000; // 10.000 VNĐ = 1 điểm

const tierForPoints = (points) => {
  if (points >= 10000) return 'PLATINUM';
  if (points >= 5000) return 'GOLD';
  if (points >= 1000) return 'SILVER';
  return 'BRONZE';
};

/**
 * Cộng ('add') hoặc trừ ('subtract') điểm thành viên tương ứng với giá trị
 * đơn hàng, và tự động điều chỉnh hạng thành viên theo tổng điểm mới. Dùng
 * chung cho mọi nơi đơn hàng thực sự được xác nhận (CONFIRMED) hoặc bị huỷ
 * sau khi đã xác nhận, để điểm/tier luôn khớp với trạng thái đơn hàng thật.
 */
const adjustLoyaltyForOrder = async (tx, customerId, totalAmount, direction) => {
  if (!customerId || customerId === 'WALK-IN') return;
  const points = Math.floor(parseFloat(totalAmount || 0) / LOYALTY_VND_PER_POINT);
  if (points === 0) return;
  const delta = direction === 'add' ? points : -points;

  let updatedCustomer = await tx.customer.update({
    where: { customerId },
    data: { loyaltyPoints: { increment: delta } }
  });

  if (updatedCustomer.loyaltyPoints < 0) {
    updatedCustomer = await tx.customer.update({
      where: { customerId },
      data: { loyaltyPoints: 0 }
    });
  }

  const nextTier = tierForPoints(updatedCustomer.loyaltyPoints);
  if (nextTier !== updatedCustomer.tier) {
    await tx.customer.update({ where: { customerId }, data: { tier: nextTier } });
  }
};

/**
 * 1. KHÁCH HÀNG TẠO ĐƠN HÀNG MỚI (Storefront Checkout - M_KHDH)
 */
const createOrder = async (req, res, next) => {
  try {
    const customerId = req.user.id; // Lấy từ authMiddleware JWT
    const { items, paymentMethod, shippingAddress, shippingCity, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Giỏ hàng không được để trống' });
    }

    // Thực hiện giao dịch cơ sở dữ liệu (Database Transaction)
    const order = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      let discount = 0;
      const orderItemsData = [];
      let hasShortage = false;
      const shortageItems = [];

      for (const cartItem of items) {
        const targetProdId = String(cartItem.productId);
        const prod = await tx.product.findUnique({
          where: { productId: targetProdId }
        });

        if (!prod) {
          throw new Error(`Không tìm thấy sản phẩm với mã: ${cartItem.productId}`);
        }

        const qty = parseInt(cartItem.quantity);
        if (!Number.isInteger(qty) || qty <= 0 || qty > 10000) {
          const error = new Error('Số lượng sản phẩm không hợp lệ');
          error.statusCode = 400;
          throw error;
        }
        const itemPrice = parseFloat(prod.price);
        const itemOrigPrice = parseFloat(prod.originalPrice || prod.price);

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
        orderItemsData.push({
          orderItemId: `ORI-${Date.now()}-${randSuffix}`,
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
      const couponDiscount = Math.max(0, parseFloat(req.body.couponDiscount || req.body.discountAmount || 0));
      const orderDiscount = memberDiscount + couponDiscount;
      const discountedSubtotal = Math.max(0, subtotal - orderDiscount);

      // Phí vận chuyển: Đồng bộ chính xác với chính sách Storefront
      // Miễn phí khi:
      // 1. Địa chỉ nhận hàng tại Hà Nội hoặc TP. Hồ Chí Minh
      // 2. Hoặc giá trị đơn hàng sau chiết khấu >= 5.000.000 VNĐ
      // 3. Hoặc có mã FREESHIP / frontend truyền shippingFee = 0
      const fullAddressStr = `${shippingAddress || ''} ${shippingCity || ''}`.toLowerCase();
      const isFreeShipRegion = fullAddressStr.includes('hà nội') || fullAddressStr.includes('ha noi') ||
                               fullAddressStr.includes('hồ chí minh') || fullAddressStr.includes('ho chi minh') ||
                               fullAddressStr.includes('tphcm') || fullAddressStr.includes('tp hcm');

      let shippingFee = 30000;
      if (req.body.shippingFee !== undefined && req.body.shippingFee !== null) {
        shippingFee = Math.max(0, parseInt(req.body.shippingFee) || 0);
      } else if (discountedSubtotal >= 5000000 || isFreeShipRegion || req.body.couponCode === 'FREESHIP') {
        shippingFee = 0;
      }
      const totalAmount = discountedSubtotal + shippingFee;

      // Sinh mã đơn hàng dạng ORD-YYMMDD-XXXX
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randCode = Math.floor(1000 + Math.random() * 9000);
      const ordCode = req.body.orderId || `ORD-${dateStr}-${randCode}`;

      // Xác định trạng thái ban đầu dựa vào phương thức thanh toán & tồn kho
      let initialStatus = 'PENDING';
      if (['BANK_TRANSFER', 'ONLINE_GATEWAY'].includes(paymentMethod) && req.body.isPaid !== true) {
        initialStatus = 'WAITING_PAYMENT';
      } else if (hasShortage) {
        initialStatus = 'AWAITING_STOCK';
      } else {
        initialStatus = 'CONFIRMED';
      }

      // Tạo đơn hàng trên DB
      const newOrder = await tx.order.create({
        data: {
          orderId: ordCode,
          customerId,
          subtotal,
          discount: orderDiscount,
          shippingFee,
          totalAmount,
          paymentMethod,
          paymentStatus: initialStatus === 'WAITING_PAYMENT' ? 'PENDING' : 'PAID',
          shippingAddress: shippingAddress || 'Chưa cung cấp',
          shippingCity: shippingCity || 'TP. Hồ Chí Minh',
          notes,
          status: initialStatus,
          items: {
            create: orderItemsData
          }
        },
        include: {
          items: { include: { product: true } }
        }
      });

      // Nếu đơn đủ hàng & được tự động duyệt CONFIRMED -> Trừ tồn kho & ghi log xuất kho
      if (initialStatus === 'CONFIRMED') {
        let totalCogs = 0;
        for (const cartItem of items) {
          const itemProdId = String(cartItem.productId);
          const qty = parseInt(cartItem.quantity);

          const productBeforeUpdate = await tx.product.findUnique({
            where: { productId: itemProdId },
            select: { averageCost: true }
          });

          // 1. Trừ số lượng sản phẩm (Product stockQuantity)
          // Atomic conditional decrement prevents two concurrent checkouts
          // from selling the same stock.
          const productUpdate = await tx.product.updateMany({
            where: { productId: itemProdId, available: true, stockQuantity: { gte: qty } },
            data: { stockQuantity: { decrement: qty } }
          });
          if (productUpdate.count !== 1) {
            const error = new Error(`Tồn kho vừa thay đổi cho sản phẩm ${itemProdId}`);
            error.statusCode = 409;
            throw error;
          }

          // 1b. Bắt buộc gán Serial Number cho từng đơn vị xuất kho.
          await claimAvailableSerials(tx, itemProdId, qty, ordCode);

          totalCogs += Number(productBeforeUpdate?.averageCost || 0) * qty;

          // 2. Trừ tồn kho vật lý tại kho chính (Warehouse 1)
          const inventory = await tx.inventory.findFirst({
            where: {
              productId: itemProdId,
              warehouseId: 1
            }
          });

          if (!inventory || inventory.quantityOnHand < qty) {
            const error = new Error(`Kho vật lý không đủ tồn cho sản phẩm ${itemProdId}`);
            error.statusCode = 409;
            throw error;
          }
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantityOnHand: { decrement: qty } }
          });

          // 3. Ghi nhật ký biến động kho (StockMovement OUT)
          await tx.stockMovement.create({
            data: {
              productId: itemProdId,
              fromWarehouseId: 1,
              type: 'OUT',
              quantity: qty,
              referenceId: ordCode,
              note: `Xuất kho tự động cho Đơn Hàng ${ordCode}`
            }
          });
        }

        // Giá vốn hàng bán (COGS) thực tế theo giá bình quân gia quyền — ghi Sổ
        // Cái để P&L đối chiếu đúng doanh thu với giá vốn thật của đơn này.
        if (totalCogs > 0) {
          await tx.ledgerEntry.create({
            data: {
              type: 'EXPENSE',
              amount: totalCogs,
              description: `Giá vốn hàng bán (COGS) — Đơn Hàng ${ordCode}`,
              referenceId: `COGS-${ordCode}`
            }
          });
        }
      }

      // Tích lũy điểm thành viên (10.000 VNĐ = 1 điểm) — chỉ khi đơn được
      // xác nhận ngay lúc tạo; đơn PENDING/AWAITING_STOCK sẽ được cộng điểm
      // sau, khi thực sự chuyển sang CONFIRMED (xem updateOrderStatus).
      const pointsEarned = initialStatus === 'CONFIRMED'
        ? Math.floor(parseFloat(totalAmount) / LOYALTY_VND_PER_POINT)
        : 0;
      if (initialStatus === 'CONFIRMED') {
        await adjustLoyaltyForOrder(tx, customerId, totalAmount, 'add');
      }

      // Ghi nhật ký lịch sử trạng thái đơn hàng (OrderStatusHistory) bằng Tiếng Việt
      let historyNote = '';
      if (initialStatus === 'WAITING_PAYMENT') {
        historyNote = 'Đơn hàng vừa được khởi tạo, đang chờ khách hàng hoàn tất thanh toán chuyển khoản/online.';
      } else if (initialStatus === 'AWAITING_STOCK') {
        historyNote = `Hệ thống tạm giữ đơn hàng (Chờ nhập hàng: Thiếu tồn kho cho sản phẩm: ${shortageItems.join(', ')}).`;
      } else if (initialStatus === 'CONFIRMED') {
        historyNote = `Tự động duyệt thành công (Đủ tồn kho). Trừ kho tự động & tích lũy +${pointsEarned} điểm thành viên.`;
      } else {
        historyNote = `Đơn hàng khởi tạo thành công ở trạng thái PENDING. Tích lũy +${pointsEarned} điểm thành viên.`;
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: ordCode,
          status: initialStatus,
          note: historyNote,
          changedBy: 'Hệ thống'
        }
      });

      return newOrder;
    });

    // Gửi email xác nhận đơn hàng cho khách hàng
    const customer = await prisma.customer.findUnique({ where: { customerId: req.user.id } });
    if (customer?.email) {
      sendOrderConfirmationEmail({
        toEmail: customer.email,
        customerName: customer.name,
        orderId: order.orderId,
        items: order.items,
        subtotal: order.subtotal,
        discount: order.discount,
        shippingFee: order.shippingFee,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        shippingAddress: order.shippingAddress
      }).catch(err => console.warn('[Email] Lỗi gửi email xác nhận:', err.message));
    }

    res.status(201).json({
      success: true,
      message: 'Đặt hàng thành công!',
      data: order
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
    req.user = { ...req.user, id: 'WALK-IN', role: 'CUSTOMER' };
    return createOrder(req, res, next);
  } catch (err) {
    return next(err);
  }
};

const getCustomerOrders = async (req, res, next) => {
  try {
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
          in: ['CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'SHIPPING_FAILED']
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
                images: true,
                price: true
              }
            }
          }
        },
        statusHistory: {
          orderBy: { timestamp: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format dữ liệu đồng bộ với frontend
    const formattedOrders = orders.map(ord => ({
      ...ord,
      id: ord.orderId,
      customerName: ord.customer?.name || 'Khách Hàng',
      phone: ord.customer?.phone || '',
      email: ord.customer?.email || '',
      address: ord.shippingAddress,
      total: parseFloat(ord.totalAmount)
    }));

    res.json({
      success: true,
      data: formattedOrders,
      ...(isPaginated ? { pagination: { page: pageNum, limit: limitNum, total: totalCount, totalPages: Math.ceil(totalCount / limitNum) } } : {})
    });
  } catch (err) {
    next(err);
  }
};

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

    const order = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUnique({
        where: { orderId: id },
        include: { items: true, customer: true }
      });

      if (!existingOrder) {
        throw new Error('Không tìm thấy đơn hàng trong hệ thống');
      }

      // This route carries every order status transition (confirm, pack, ship,
      // deliver...), so the operational permission check can't sit at the
      // router level — only the actual cancel action is gated by the
      // admin-configurable RBAC matrix. Skip on a no-op resubmit of an
      // already-cancelled order (frontend double-submit race).
      if (status === 'CANCELLED' && existingOrder.status !== 'CANCELLED') {
        const allowed = await hasOperationalPermission(req.user?.role, 'sales_cancel_order');
        if (!allowed) {
          const error = new Error('Tài khoản của bạn không có quyền hủy đơn hàng (đã bị quản trị viên tắt trong Ma Trận Phân Quyền).');
          error.statusCode = 403;
          throw error;
        }
      }

      // Xử lý trừ kho khi chuyển sang trạng thái đã duyệt (CONFIRMED / PACKED / PROCESSING / READY_TO_SHIP)
      const isApprovedStatus = ['CONFIRMED', 'PACKED', 'PROCESSING', 'READY_TO_SHIP'].includes(status);
      const isPriorPending = ['PENDING', 'AWAITING_STOCK', 'WAITING_PAYMENT'].includes(existingOrder.status);

      if (isApprovedStatus && isPriorPending) {
        const existingMovement = await tx.stockMovement.findFirst({
          where: {
            referenceId: id,
            type: 'OUT'
          }
        });

        if (!existingMovement) {
          // Đơn chuyển từ trạng thái chờ sang đã duyệt lần đầu tiên — đây là
          // lúc đơn thực sự được "xác nhận", nên tích điểm thành viên ở đây
          // (đơn tạo sẵn ở CONFIRMED đã được tích lúc tạo, xem createOrder).
          await adjustLoyaltyForOrder(tx, existingOrder.customerId, existingOrder.totalAmount, 'add');

          let totalCogs = 0;
          for (const item of existingOrder.items) {
            const productBeforeUpdate = await tx.product.findUnique({
              where: { productId: item.productId },
              select: { averageCost: true }
            });

            // Trừ số lượng tồn sản phẩm
            const productUpdate = await tx.product.updateMany({
              where: { productId: item.productId, available: true, stockQuantity: { gte: item.quantity } },
              data: { stockQuantity: { decrement: item.quantity } }
            });
            if (productUpdate.count !== 1) {
              const error = new Error(`Tồn kho không đủ cho sản phẩm ${item.productId}`);
              error.statusCode = 409;
              throw error;
            }

            // Bắt buộc gán Serial Number cho từng đơn vị xuất kho.
            await claimAvailableSerials(tx, item.productId, item.quantity, id);

            totalCogs += Number(productBeforeUpdate?.averageCost || 0) * item.quantity;

            // Trừ tồn kho vật lý tại kho chính (Warehouse 1)
            const inventory = await tx.inventory.findFirst({
              where: {
                productId: item.productId,
                warehouseId: 1
              }
            });

            if (!inventory || inventory.quantityOnHand < item.quantity) {
              const error = new Error(`Kho vật lý không đủ tồn cho sản phẩm ${item.productId}`);
              error.statusCode = 409;
              throw error;
            }
            await tx.inventory.update({
              where: { id: inventory.id },
              data: { quantityOnHand: { decrement: item.quantity } }
            });

            // Ghi log xuất kho
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                fromWarehouseId: 1,
                type: 'OUT',
                quantity: item.quantity,
                referenceId: id,
                note: `Xuất kho khi duyệt Đơn Hàng ${id}`
              }
            });
          }

          if (totalCogs > 0) {
            await tx.ledgerEntry.create({
              data: {
                type: 'EXPENSE',
                amount: totalCogs,
                description: `Giá vốn hàng bán (COGS) — Đơn Hàng ${id}`,
                referenceId: `COGS-${id}`
              }
            });
          }
        }
      }

      // Xử lý hoàn kho khi đơn bị HỦY (CANCELLED) hoặc GIAO THẤT BẠI (FAILED_DELIVERY)
      if (['CANCELLED', 'FAILED_DELIVERY'].includes(status)) {
        const existingOutMovement = await tx.stockMovement.findFirst({
          where: {
            referenceId: id,
            type: 'OUT'
          }
        });

        const existingInMovement = await tx.stockMovement.findFirst({
          where: {
            referenceId: id,
            type: 'IN',
            note: {
              contains: 'Hoàn kho'
            }
          }
        });

        if (existingOutMovement && !existingInMovement) {
          // Đơn từng được duyệt (đã trừ kho -> đã tích điểm) và giờ bị huỷ
          // hẳn -> trừ lại điểm đã tích. Giao thất bại (FAILED_DELIVERY)
          // không phải huỷ đơn (có thể giao lại), nên không trừ điểm ở đây.
          if (status === 'CANCELLED') {
            await adjustLoyaltyForOrder(tx, existingOrder.customerId, existingOrder.totalAmount, 'subtract');
          }

          for (const item of existingOrder.items) {
            // Cộng trả số lượng tồn sản phẩm
            await tx.product.update({
              where: { productId: item.productId },
              data: {
                stockQuantity: {
                  increment: item.quantity
                }
              }
            });

            // Cộng trả tồn kho vật lý tại Kho 1
            const inventory = await tx.inventory.findFirst({
              where: {
                productId: item.productId,
                warehouseId: 1
              }
            });

            if (inventory) {
              await tx.inventory.update({
                where: { id: inventory.id },
                data: {
                  quantityOnHand: {
                    increment: item.quantity
                  }
                }
              });
            }

            // Ghi nhật ký nhập hoàn kho
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                toWarehouseId: 1,
                type: 'IN',
                quantity: item.quantity,
                referenceId: id,
                note: `Hoàn kho tự động cho Đơn Hàng ${id} (${status === 'CANCELLED' ? 'Đã Hủy' : 'Giao Thất Bại'})`
              }
            });
          }

          // Trả lại các Serial Number đã gán cho đơn này về trạng thái khả dụng —
          // nếu không, serial sẽ mắc kẹt ở USED mãi mãi dù hàng đã quay lại kho,
          // khiến số serial khả dụng lệch dần so với Product.stockQuantity thật.
          await tx.serialNumber.updateMany({
            where: { orderId: id, status: 'USED' },
            data: { status: 'AVAILABLE', orderId: null }
          });

          // Xóa bút toán COGS gắn với đơn này — doanh thu của đơn CANCELLED/
          // FAILED_DELIVERY đã bị loại khỏi P&L (Accountant.jsx lọc theo
          // Order.status), nên giá vốn tương ứng cũng phải bị loại theo để
          // không còn khoản chi mồ côi không có doanh thu đối ứng.
          await tx.ledgerEntry.deleteMany({ where: { referenceId: `COGS-${id}` } });
        }
      }

      // Cập nhật trạng thái đơn hàng & thông tin POD giao vận
      const actualPayMethod = req.body.actualPaymentMethod || (existingOrder.paymentMethod === 'COD' ? 'CASH' : 'PREPAID');
      const receivedType = req.body.receivedByType || 'DIRECT_CUSTOMER';
      const receiverName = req.body.receiverNameActual || (receivedType === 'DIRECT_CUSTOMER' ? (existingOrder.customer?.name || 'Khách hàng') : 'Người nhận thay');

      const updatedOrder = await tx.order.update({
        where: { orderId: id },
        data: {
          status,
          ...(status === 'DELIVERED' ? {
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
          ...(status === 'SHIPPED' ? { shippedAt: new Date() } : {}),
          ...(status === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
          ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {})
        }
      });

      // Nếu đơn giao thành công và là đơn COD, ghi nhận giao dịch thanh toán OrderPayment
      if (status === 'DELIVERED' && existingOrder.paymentStatus !== 'PAID') {
        await tx.orderPayment.create({
          data: {
            orderId: id,
            method: actualPayMethod,
            amount: existingOrder.totalAmount,
            transactionId: req.body.bankRefCode || `CASH-${id}-${Date.now().toString().slice(-4)}`,
            status: 'SUCCESS'
          }
        }).catch(e => console.warn('[OrderPayment] Ghi nhận thanh toán:', e.message));
      }

      // Ghi nhật ký lịch sử trạng thái
      let historyLogNote = note;
      if (!historyLogNote) {
        if (status === 'DELIVERED') {
          const payLabel = actualPayMethod === 'BANK_TRANSFER' ? `Chuyển khoản VietQR (Mã GD: ${req.body.bankRefCode || 'Napas247'})` : (actualPayMethod === 'CASH' ? 'Tiền mặt' : 'Đã thanh toán trước');
          historyLogNote = `Giao hàng thành công (Người nhận: ${receiverName} - ${receivedType === 'DIRECT_CUSTOMER' ? 'Chính chủ' : 'Nhận thay'}, Thanh toán: ${payLabel}) bởi Shipper ${changedBy}`;
        } else if (status === 'SHIPPING_FAILED') {
          historyLogNote = `Giao thất bại: ${req.body.failReason || 'Không liên lạc được'} (${req.body.isAwaitingCallback ? 'Chờ gọi lại 24h' : 'Hẹn lại'}) bởi ${changedBy}`;
        } else if (status === 'RETURNING_TO_WAREHOUSE') {
          historyLogNote = `Đơn hàng chuyển hoàn về kho (Lý do: ${req.body.returnReason || req.body.failReason || 'Khách không nhận'}) bởi ${changedBy}`;
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
    });

    // Gửi email cập nhật trạng thái cho khách hàng
    const updatedOrderFull = await prisma.order.findUnique({
      where: { orderId: id },
      include: { customer: true, items: { include: { product: true } } }
    });
    if (updatedOrderFull?.customer?.email) {
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
        totalAmount: updatedOrderFull.totalAmount,
        proofPhoto: req.body.proofPhoto || req.body.proofUrl || null,
        receiverNote: req.body.receiverNote || null
      }).catch(err => console.warn('[Email] Lỗi gửi email cập nhật trạng thái:', err.message));
    }

    res.json({
      success: true,
      message: `Cập nhật trạng thái đơn hàng thành ${status} thành công`,
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
      evidenceUrl
    } = req.body;

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

    if (!['DELIVERED', 'COMPLETED', 'SHIPPED'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Chỉ được tạo yêu cầu đổi trả cho đơn hàng đã nhận/giao thành công' });
    }

    // 1. Tạo bản ghi ReturnRequest chi tiết
    const returnReq = await prisma.returnRequest.create({
      data: {
        orderId: order.orderId,
        customerId: order.customerId,
        customerName: customerName || order.customer?.name,
        phone: phone || order.customer?.phone,
        address: address || order.shippingAddress,
        type: actualType,
        reason: reason || 'Khách hàng yêu cầu hoàn trả',
        note: note || '',
        evidenceUrl: evidenceUrl || '',
        refundAmount: isExchange ? 0 : (refundAmount || order.totalAmount),
        bankName: isExchange ? '' : (bankName || ''),
        bankAccountNo: isExchange ? '' : (bankAccountNo || ''),
        bankAccountName: isExchange ? '' : (bankAccountName || ''),
        status: 'RETURN_APPROVED' // Tự động duyệt để chuyển Shipper thu hồi
      }
    });

    // 2. Cập nhật trạng thái đơn sang RETURNING_TO_WAREHOUSE
    await prisma.order.update({
      where: { orderId: id },
      data: { status: 'RETURNING_TO_WAREHOUSE' }
    });

    const loaiYeuCauText = isExchange ? 'Đổi mới 1-1' : 'Trả hàng Hoàn tiền 100%';

    await prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        status: 'RETURNING_TO_WAREHOUSE',
        note: `Khách hàng tạo yêu cầu ${loaiYeuCauText}. Lý do: ${reason || 'Không ghi'}. ${!isExchange && bankAccountNo ? `Số TK hoàn: ${bankAccountNo} (${bankName || 'N/A'})` : ''}`,
        changedBy: req.user?.fullname || req.user?.name || 'Khách hàng'
      }
    });

    res.json({
      success: true,
      message: `Yêu cầu ${loaiYeuCauText} đã được tiếp nhận thành công. Shipper sẽ liên hệ thu hồi hàng.`,
      data: returnReq
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
      include: { order: true }
    });

    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu đổi trả' });
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
      where: { OR: [{ id: id }, { orderId: id }] }
    });

    if (returnReq) {
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
    const { qcDecision, qcDefectType, qcNotes, qcProofPhoto, note } = req.body;
    const inspectorName = req.user?.fullname || req.user?.name || req.body.qcInspector || 'Kỹ thuật viên QC';

    const returnReq = await prisma.returnRequest.findFirst({
      where: { OR: [{ id: id }, { orderId: id }] }
    });

    if (!returnReq) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu đổi trả' });
    }

    const isApproved = ['APPROVE_REFUND', 'APPROVE_EXCHANGE', 'EXCHANGE_NEW', 'RESTOCK_WAREHOUSE', 'PASSED'].includes(qcDecision);
    const newStatus = isApproved ? 'QC_PASSED' : 'REJECTED';

    await prisma.returnRequest.update({
      where: { id: returnReq.id },
      data: {
        status: newStatus,
        qcDecision: qcDecision || (returnReq.type === 'EXCHANGE' ? 'EXCHANGE_NEW' : 'RESTOCK_WAREHOUSE'),
        qcDefectType: qcDefectType || 'DOA_FACTORY_DEFECT',
        qcNotes: qcNotes || '',
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
        status: isApproved ? 'QC_PASSED' : 'DELIVERED',
        note: note || (isApproved
          ? `QC Thẩm định: ĐẠT ĐIỀU KIỆN (${qcDefectType || 'Lỗi phần cứng'}). Xác nhận sản phẩm nguyên vẹn có ảnh minh chứng. (Giám định bởi ${inspectorName})`
          : `QC Thẩm định: TỪ CHỐI ĐỔI TRẢ (${qcDefectType || 'Vi phạm điều kiện'}). Trả về trạng thái đã giao. (Giám định bởi ${inspectorName})`),
        changedBy: inspectorName
      }
    });

    res.json({
      success: true,
      message: isApproved ? 'QC thẩm định đạt chuẩn! Đã lưu ảnh minh chứng và chuyển Thủ kho nhập kệ.' : 'QC đã từ chối yêu cầu đổi trả.',
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
    const { shelfLocation, shelfNote, note, type } = req.body;
    const changedBy = req.user?.fullname || req.user?.name || 'Thủ kho';

    const order = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findFirst({
        where: { orderId: id },
        include: { items: true, customer: true }
      });

      if (!existingOrder) {
        throw new Error('Không tìm thấy đơn hàng');
      }

      const returnReq = await tx.returnRequest.findFirst({
        where: { orderId: existingOrder.orderId }
      });

      const effectiveType = type || returnReq?.type || 'REFUND';
      const isExchange = effectiveType === 'EXCHANGE';

      // 1. Chỉ tăng tồn kho khi hàng thật sự vào kệ bán được (Kệ A1/B3) —
      // trước đây `isSellable` mặc định `true` nên hàng gửi hãng bảo hành
      // (SHELF_C2_VENDOR) hoặc phế phẩm (SHELF_D_SCRAP) vẫn vô tình được
      // cộng vào tồn kho bán, dù chưa hề rời khỏi kho về mặt vật lý để bán.
      const isSellableShelf = ['SHELF_A1_RESTOCK', 'SHELF_B3_OUTLET'].includes(shelfLocation);
      if (isSellableShelf) {
        for (const item of existingOrder.items) {
          await tx.product.update({
            where: { productId: item.productId },
            data: { stockQuantity: { increment: item.quantity } }
          });

          const inventory = await tx.inventory.findFirst({
            where: { productId: item.productId, warehouseId: 1 }
          });

          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: { quantityOnHand: { increment: item.quantity } }
            });
          }

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              toWarehouseId: 1,
              type: 'IN',
              quantity: item.quantity,
              referenceId: existingOrder.orderId,
              note: `Nhập lại kho từ Đơn Hoàn Trả #${existingOrder.orderId} vào ${shelfLocation || 'Kệ kho'}`
            }
          });
        }
      }

      let replacementOrderId = null;

      // 2. Nếu là EXCHANGE (Đổi mới 1-1): Tự động tạo Đơn Đổi Mới ORD-EXC-...
      if (isExchange) {
        replacementOrderId = `ORD-EXC-${existingOrder.orderId.replace('ORD-', '')}`;
        
        // Kiểm tra xem đơn đổi mới đã tồn tại chưa
        const existingExcOrder = await tx.order.findUnique({
          where: { orderId: replacementOrderId }
        });

        if (!existingExcOrder) {
          await tx.order.create({
            data: {
              orderId: replacementOrderId,
              customerId: existingOrder.customerId,
              subtotal: 0,
              discount: 0,
              shippingFee: 0,
              totalAmount: 0,
              paymentMethod: existingOrder.paymentMethod || 'EXCHANGE_1TO1',
              paymentStatus: 'PAID',
              status: 'CONFIRMED', // Sẵn sàng để Kho đóng gói & bàn giao Shipper
              shippingAddress: existingOrder.shippingAddress,
              shippingCity: existingOrder.shippingCity || 'Hồ Chí Minh',
              notes: `[ĐỔI MỚI 1-1] Xuất kho sản phẩm mới thay thế cho đơn lỗi #${existingOrder.orderId}`,
              items: {
                create: existingOrder.items.map(it => ({
                  orderItemId: `EXC-ITM-${Date.now()}-${Math.floor(Math.random()*1000)}`,
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
                  note: `Tự động tạo đơn đổi mới 1-1 (0đ) từ yêu cầu RMA #${returnReq?.id || existingOrder.orderId}. Chờ kho đóng gói.`,
                  changedBy
                }
              }
            }
          });
        }
      }

      // Trước đây hàm này chỉ tính được 2 kết quả (EXCHANGED/RESTOCKED) dù
      // Kho thực tế có 4 lựa chọn kệ (bán mới, outlet, gửi hãng, phế phẩm) —
      // 2 lựa chọn còn lại rơi vào 'RESTOCKED' sai nghĩa dù hàng không hề
      // được nhập lại kho bán.
      const targetStatus = shelfLocation === 'SHELF_D_SCRAP'
        ? 'INSPECTED_SCRAP'
        : shelfLocation === 'SHELF_C2_VENDOR'
          ? 'VENDOR_WARRANTY'
          : isExchange
            ? 'EXCHANGED'
            : 'RESTOCKED';

      // 3. Cập nhật ReturnRequest
      if (returnReq) {
        await tx.returnRequest.update({
          where: { id: returnReq.id },
          data: {
            status: targetStatus,
            shelfLocation: shelfLocation || 'SHELF_A1_RESTOCK',
            shelfNote: shelfNote || note || 'Đã phân luồng vị trí kệ kho',
            replacementOrderId: replacementOrderId || undefined,
            restockedAt: new Date(),
            restockedById: req.user?.id && !isNaN(Number(req.user.id)) ? Number(req.user.id) : null
          }
        });
      }

      // 4. Cập nhật Order gốc
      const updatedOrder = await tx.order.update({
        where: { orderId: existingOrder.orderId },
        data: { status: targetStatus }
      });

      const historyNote = note || (
        targetStatus === 'INSPECTED_SCRAP'
          ? `Kho đã xếp kiện hàng vào khu phế phẩm (${shelfLocation}). Không nhập lại tồn kho bán.`
          : targetStatus === 'VENDOR_WARRANTY'
            ? `Kho đã xếp kiện hàng vào khu chờ gửi hãng bảo hành (${shelfLocation}). Không nhập lại tồn kho bán.`
            : isExchange
              ? `Kho đã nhập kiện hàng cũ vào ${shelfLocation || 'kệ kho'}. Đã tự động tạo Đơn Đổi Mới #${replacementOrderId} chuyển Kho xuất hàng cho khách.`
              : `Kho đã nhập kiện hàng vào ${shelfLocation || 'kệ kho'}. Đã lập Phiếu đề nghị chuyển Kế toán giải ngân hoàn tiền Napas247.`
      );

      await tx.orderStatusHistory.create({
        data: {
          orderId: existingOrder.orderId,
          status: targetStatus,
          note: historyNote,
          changedBy
        }
      });

      return { ...updatedOrder, replacementOrderId };
    });

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
        where: { id },
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
      return res.status(400).json({ success: false, message: 'Đơn hàng này đã được hoàn tiền trước đó' });
    }

    const finalAmount = parseFloat(refundAmount || order.totalAmount || 0);

    // 1. Cập nhật Order sang REFUNDED
    const updatedOrder = await prisma.order.update({
      where: { orderId: order.orderId },
      data: {
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED'
      }
    });

    // 2. Cập nhật ReturnRequest sang REFUNDED
    await prisma.returnRequest.updateMany({
      where: { orderId: order.orderId },
      data: {
        status: 'REFUNDED',
        refundTxnCode: refundTxnCode || '',
        refundProofPhoto: refundProofPhoto || '',
        refundedAt: new Date(),
        refundedById: req.user?.id ? Number(req.user.id) : null
      }
    });

    // 3. Ghi Sổ cái kế toán (LedgerEntry: REFUND)
    try {
      await prisma.ledgerEntry.create({
        data: {
          type: 'REFUND',
          amount: finalAmount,
          description: `Chi hoàn tiền đơn hàng #${order.orderId} - Khách: ${order.customer?.name || 'Khách hàng'} (${refundTxnCode ? `Mã GD: ${refundTxnCode}` : 'Chuyển khoản'})`,
          referenceId: order.orderId,
          date: new Date()
        }
      });
    } catch (lErr) {
      console.warn('Ghi log sổ cái thất bại (không chặn luồng):', lErr);
    }

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
            statusHistory: { orderBy: { timestamp: 'desc' } }
          }
        },
        customer: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: returnRequests
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
      include: { customer: true, items: true, statusHistory: { orderBy: { timestamp: 'desc' } } }
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

module.exports = {
  createOrder,
  createPosOrder,
  getCustomerOrders,
  updateOrderStatus,
  createReturnRequest,
  shipperPickupReturn,
  shipperDeliverWarehouseReturn,
  qcInspectReturn,
  confirmReturnWarehouse,
  processRefund,
  getReturnRequests,
  updateOrderDetails,
  adjustLoyaltyForOrder
};
