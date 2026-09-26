// Builds the payload for a "delivery failed" status update — shared by
// FailModal (full reason picker) and QuickFailSheet (1-tap common reasons)
// so the attempt-count / 24h-callback-deadline logic lives in one place.
export const buildFailPayload = (order, failReason, failNote = '', extraData = {}) => {
  const attemptCount = (order.deliveryAttempts || 0) + 1;
  const reasonLower = failReason.toLowerCase();
  const isNoContact = reasonLower.includes('không liên lạc') || reasonLower.includes('không nghe máy') || reasonLower.includes('thuê bao');
  const now = new Date();
  const deadline24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  return {
    failReason,
    failNote,
    failedAt: now.toISOString(),
    callbackDeadline: isNoContact ? deadline24h : null,
    isAwaitingCallback: isNoContact,
    deliveryAttempts: attemptCount,
    ...extraData
  };
};

/**
 * Extract appointment date and time window from an Order
 * Returns: { hasAppointment, date, timeWindow, startMinutes, endMinutes, label, isToday, isLate, isUpcoming }
 */
export const getAppointmentInfo = (ord) => {
  if (!ord) return { hasAppointment: false };

  let date = ord.appointmentDate || null;
  let timeWindow = ord.appointmentTimeWindow || ord.appointmentTime || null;

  const searchStr = `${ord.failNote || ''} ${ord.notes || ''} ${ord.failReason || ''} ${ord.receiverNote || ''}`;

  if (!date || !timeWindow) {
    const matchTag = searchStr.match(/\[HEN:([^\]]+)\]/i) || searchStr.match(/\[HEN_GIAO:([^\]]+)\]/i);
    if (matchTag && matchTag[1]) {
      const parts = matchTag[1].trim().split('_');
      if (parts.length >= 2) {
        if (!date) date = parts[0];
        if (!timeWindow) timeWindow = parts[1];
      } else {
        if (!timeWindow) timeWindow = parts[0];
      }
    }
  }

  if (!timeWindow) {
    const rangeMatch = searchStr.match(/(\d{1,2}[:h]\d{0,2})\s*[-–]\s*(\d{1,2}[:h]\d{0,2})/i);
    if (rangeMatch) {
      timeWindow = `${rangeMatch[1]} - ${rangeMatch[2]}`.replace(/h/g, ':00').replace(/:(\s|$)/g, ':00$1');
    } else {
      const exactMatch = searchStr.match(/(\d{1,2}[:h]\d{2})/i) || searchStr.match(/(?:hẹn|lúc)\s+(\d{1,2}h)/i);
      if (exactMatch) {
        timeWindow = exactMatch[1].replace('h', ':');
      }
    }
  }

  if (!timeWindow && !date) {
    return { hasAppointment: false };
  }

  let startMinutes = null;
  let endMinutes = null;

  if (timeWindow && timeWindow !== 'Cả ngày') {
    const timeParts = timeWindow.split(/[-–]/).map(s => s.trim());
    const parseTimeToMinutes = (tStr) => {
      if (!tStr) return null;
      const clean = tStr.replace('h', ':');
      const [h, m] = clean.split(':').map(Number);
      if (isNaN(h)) return null;
      return h * 60 + (isNaN(m) ? 0 : m);
    };

    if (timeParts.length === 2) {
      startMinutes = parseTimeToMinutes(timeParts[0]);
      endMinutes = parseTimeToMinutes(timeParts[1]);
    } else if (timeParts.length === 1) {
      const exact = parseTimeToMinutes(timeParts[0]);
      if (exact !== null) {
        startMinutes = Math.max(0, exact - 30);
        endMinutes = Math.min(24 * 60, exact + 30);
      }
    }
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isToday = !date || date === todayStr;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let isLate = false;
  let isUpcoming = false;

  if (isToday && endMinutes !== null) {
    if (currentMinutes > endMinutes) {
      isLate = true;
    } else if (startMinutes !== null && currentMinutes >= startMinutes - 45 && currentMinutes <= endMinutes) {
      isUpcoming = true;
    }
  }

  return {
    hasAppointment: true,
    date: date || todayStr,
    timeWindow: timeWindow || 'Cả ngày',
    startMinutes,
    endMinutes,
    isToday,
    isLate,
    isUpcoming,
    label: timeWindow ? `${timeWindow}${date && date !== todayStr ? ` (${date})` : ''}` : date
  };
};

/**
 * Delivery Incident and Status Classification Helper
 * Single source of truth for delivery tabs, cards, and filters.
 */
export const getDeliveryIncidentStatus = (ord) => {
  if (!ord) {
    return {
      isDelivered: false,
      isAwaiting: false,
      isRescheduled: false,
      isRejected: false,
      isReturning: false,
      isShipping: false,
      isPending: false,
      badgeText: 'KHÔNG XÁC ĐỊNH',
      badgeBg: 'rgba(100,116,139,0.12)',
      badgeColor: 'var(--text-muted)'
    };
  }

  const status = ord.status;

  if (status === 'DELIVERED') {
    return {
      isDelivered: true,
      isAwaiting: false,
      isRescheduled: false,
      isRejected: false,
      isReturning: false,
      isShipping: false,
      isPending: false,
      badgeText: 'ĐÃ GIAO XONG (POD)',
      badgeBg: 'rgba(22,163,74,0.12)',
      badgeColor: 'var(--success)'
    };
  }

  if (status === 'RETURNING_TO_WAREHOUSE') {
    return {
      isDelivered: false,
      isAwaiting: false,
      isRescheduled: false,
      isRejected: false,
      isReturning: true,
      isShipping: false,
      isPending: false,
      badgeText: 'ĐANG HOÀN KHO',
      badgeBg: 'rgba(100,116,139,0.12)',
      badgeColor: 'var(--text-muted)'
    };
  }

  if (status === 'READY_TO_SHIP' || status === 'CONFIRMED' || status === 'PROCESSING') {
    return {
      isDelivered: false,
      isAwaiting: false,
      isRescheduled: false,
      isRejected: false,
      isReturning: false,
      isShipping: false,
      isPending: true,
      badgeText: 'SẴN SÀNG TẠI KHO',
      badgeBg: 'rgba(217,119,6,0.12)',
      badgeColor: 'var(--warning)'
    };
  }

  if (status === 'CANCELLED') {
    return {
      isDelivered: false,
      isAwaiting: false,
      isRescheduled: false,
      isRejected: true,
      isReturning: false,
      isShipping: false,
      isPending: false,
      badgeText: 'ĐÃ HỦY ĐƠN',
      badgeBg: 'rgba(220,38,38,0.12)',
      badgeColor: 'var(--danger)'
    };
  }

  const isFailedOrder = status === 'SHIPPING_FAILED';
  if (isFailedOrder) {
    const failStr = `${ord.failReason || ''} ${ord.failNote || ''}`.toLowerCase();

    // 1. Chờ gọi lại 24h: Không liên lạc được, gọi không nghe, thuê bao, chờ gọi lại
    const isAwaiting = Boolean(ord.isAwaitingCallback) ||
      failStr.includes('không liên lạc') ||
      failStr.includes('không nghe máy') ||
      failStr.includes('thuê bao') ||
      failStr.includes('gọi lại');

    if (isAwaiting) {
      return {
        isDelivered: false,
        isAwaiting: true,
        isRescheduled: false,
        isRejected: false,
        isReturning: false,
        isShipping: false,
        isPending: false,
        badgeText: 'CHỜ GỌI LẠI (24H)',
        badgeBg: 'rgba(217,119,6,0.12)',
        badgeColor: 'var(--warning)'
      };
    }

    // 2. Khách hẹn lại: Hẹn giao lại, bận việc, đi vắng
    const isRescheduled = failStr.includes('hẹn') ||
      failStr.includes('bận') ||
      failStr.includes('đi vắng') ||
      failStr.includes('mai giao');

    if (isRescheduled) {
      return {
        isDelivered: false,
        isAwaiting: false,
        isRescheduled: true,
        isRejected: false,
        isReturning: false,
        isShipping: false,
        isPending: false,
        badgeText: 'KHÁCH HẸN LẠI',
        badgeBg: 'rgba(124,58,237,0.12)',
        badgeColor: '#7c3aed'
      };
    }

    // 3. Từ chối / Hủy / Sự cố không thể giao (bom hàng, từ chối nhận, sai địa chỉ, hỏng hóc...)
    return {
      isDelivered: false,
      isAwaiting: false,
      isRescheduled: false,
      isRejected: true,
      isReturning: false,
      isShipping: false,
      isPending: false,
      badgeText: 'KHÁCH TỪ CHỐI',
      badgeBg: 'rgba(220,38,38,0.12)',
      badgeColor: 'var(--danger)'
    };
  }

  // Regular SHIPPED
  return {
    isDelivered: false,
    isAwaiting: false,
    isRescheduled: false,
    isRejected: false,
    isReturning: false,
    isShipping: true,
    isPending: false,
    badgeText: 'ĐANG GIAO',
    badgeBg: 'rgba(37,99,235,0.12)',
    badgeColor: 'var(--primary)'
  };
};

/**
 * Check if an order is in a re-delivery / resumed delivery cycle
 */
export const isOrderRedelivery = (ord) => {
  if (!ord) return false;
  if (ord.isRedelivery) return true;
  if (ord.resumedAt) return true;
  if (typeof ord.notes === 'string' && ord.notes.includes('GIAO_LAI')) return true;
  if (typeof ord.failNote === 'string' && ord.failNote.includes('GIAO_LAI')) return true;
  if (typeof ord.failReason === 'string' && ord.failReason.includes('GIAO_LAI')) return true;
  return false;
};

/**
 * Extract the most relevant Date object from an Order
 */
export const getOrderDateTime = (ord) => {
  if (!ord) return null;
  const isRedeliv = isOrderRedelivery(ord);
  // For redelivered orders, prioritize resumedAt or shippedAt to place it in today's active shift
  const dateVal = (isRedeliv && ord.resumedAt)
    ? ord.resumedAt
    : (ord.deliveredAt || ord.shippedAt || ord.confirmedAt || ord.updatedAt || ord.createdAt || ord.packedAt || ord.date);
  if (!dateVal) return null;
  if (typeof dateVal === 'string' && dateVal.includes('/')) {
    const parts = dateVal.split(/[\/\s:]+/);
    if (parts.length >= 3) {
      const d = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const y = Number(parts[2]);
      const hr = parts[3] ? Number(parts[3]) : 0;
      const min = parts[4] ? Number(parts[4]) : 0;
      const parsed = new Date(y, m, d, hr, min);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Extract the most relevant Date object from a Return Request (RMA)
 */
export const getReturnDateTime = (ret) => {
  if (!ret) return null;
  const dateVal = ret.createdAt || ret.pickedUpAt || ret.deliveredWarehouseAt || ret.updatedAt || ret.date;
  if (!dateVal) return null;
  if (typeof dateVal === 'string' && dateVal.includes('/')) {
    const parts = dateVal.split(/[\/\s:]+/);
    if (parts.length >= 3) {
      const d = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const y = Number(parts[2]);
      const hr = parts[3] ? Number(parts[3]) : 0;
      const min = parts[4] ? Number(parts[4]) : 0;
      const parsed = new Date(y, m, d, hr, min);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Standard default date filter configuration (Defaults to Realtime TODAY)
 */
export const getDefaultDateFilter = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return {
    period: 'TODAY',
    selectedDate: `${y}-${m}-${d}`,
    selectedMonth: `${y}-${m}`,
    selectedYear: `${y}`,
    customStartDate: '',
    customEndDate: ''
  };
};

/**
 * Universal date matching against filter configuration
 */
export const matchesDateFilter = (dateVal, filterConfig) => {
  if (!filterConfig || filterConfig.period === 'ALL') return true;
  if (!dateVal) return false;

  let d = dateVal instanceof Date ? dateVal : null;
  if (!d) {
    if (typeof dateVal === 'string' && dateVal.includes('/')) {
      const parts = dateVal.split(/[\/\s:]+/);
      if (parts.length >= 3) {
        const day = Number(parts[0]);
        const mon = Number(parts[1]) - 1;
        const yr = Number(parts[2]);
        const hr = parts[3] ? Number(parts[3]) : 0;
        const min = parts[4] ? Number(parts[4]) : 0;
        d = new Date(yr, mon, day, hr, min);
      }
    }
    if (!d || isNaN(d.getTime())) {
      d = new Date(dateVal);
    }
  }
  if (!d || isNaN(d.getTime())) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const { period, selectedDate, selectedMonth, selectedYear, customStartDate, customEndDate } = filterConfig;

  switch (period) {
    case 'TODAY':
      return d >= startOfToday && d <= endOfToday;

    case 'YESTERDAY': {
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      const endOfYesterday = new Date(endOfToday);
      endOfYesterday.setDate(endOfYesterday.getDate() - 1);
      return d >= startOfYesterday && d <= endOfYesterday;
    }

    case 'THIS_WEEK': {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
      return d >= startOfWeek && d <= endOfToday;
    }

    case 'THIS_MONTH': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return d >= startOfMonth && d <= endOfMonth;
    }

    case 'THIS_YEAR': {
      const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return d >= startOfYear && d <= endOfYear;
    }

    case 'SPECIFIC_DATE': {
      if (!selectedDate) return true;
      const [y, m, dayNum] = selectedDate.split('-').map(Number);
      if (!y || !m || !dayNum) return true;
      const s = new Date(y, m - 1, dayNum, 0, 0, 0, 0);
      const e = new Date(y, m - 1, dayNum, 23, 59, 59, 999);
      return d >= s && d <= e;
    }

    case 'SPECIFIC_MONTH': {
      if (!selectedMonth) return true;
      const [y, m] = selectedMonth.split('-').map(Number);
      if (!y || !m) return true;
      const s = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const e = new Date(y, m, 0, 23, 59, 59, 999);
      return d >= s && d <= e;
    }

    case 'SPECIFIC_YEAR': {
      if (!selectedYear) return true;
      const y = Number(selectedYear);
      if (!y) return true;
      const s = new Date(y, 0, 1, 0, 0, 0, 0);
      const e = new Date(y, 11, 31, 23, 59, 59, 999);
      return d >= s && d <= e;
    }

    case 'CUSTOM': {
      let startStr = customStartDate;
      let endStr = customEndDate;
      if (startStr && endStr && startStr > endStr) {
        const tmp = startStr;
        startStr = endStr;
        endStr = tmp;
      }
      if (startStr) {
        const s = new Date(startStr + 'T00:00:00');
        if (!isNaN(s.getTime()) && d < s) return false;
      }
      if (endStr) {
        const e = new Date(endStr + 'T23:59:59.999');
        if (!isNaN(e.getTime()) && d > e) return false;
      }
      return true;
    }

    default:
      return true;
  }
};

/**
 * Format user-friendly date label for UI headers and badges
 */
export const getDateFilterLabel = (filterConfig) => {
  if (!filterConfig || filterConfig.period === 'ALL') return 'Tất Cả';
  const now = new Date();
  switch (filterConfig.period) {
    case 'TODAY':
      return `Hôm Nay (${now.toLocaleDateString('vi-VN')})`;
    case 'YESTERDAY': {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return `Hôm Qua (${y.toLocaleDateString('vi-VN')})`;
    }
    case 'THIS_WEEK':
      return 'Tuần Này';
    case 'THIS_MONTH':
      return `Tháng Này (${now.getMonth() + 1}/${now.getFullYear()})`;
    case 'THIS_YEAR':
      return `Năm Nay (${now.getFullYear()})`;
    case 'SPECIFIC_DATE': {
      if (!filterConfig.selectedDate) return 'Theo Ngày';
      const [y, m, d] = filterConfig.selectedDate.split('-');
      return `Ngày ${d}/${m}/${y}`;
    }
    case 'SPECIFIC_MONTH': {
      if (!filterConfig.selectedMonth) return 'Theo Tháng';
      const [y, m] = filterConfig.selectedMonth.split('-');
      return `Tháng ${m}/${y}`;
    }
    case 'SPECIFIC_YEAR':
      return `Năm ${filterConfig.selectedYear}`;
    case 'CUSTOM': {
      const formatDate = (isoStr) => {
        if (!isoStr) return '';
        const parts = isoStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return isoStr;
      };
      if (filterConfig.customStartDate && filterConfig.customEndDate) {
        if (filterConfig.customStartDate === filterConfig.customEndDate) {
          return `Ngày ${formatDate(filterConfig.customStartDate)}`;
        }
        return `${formatDate(filterConfig.customStartDate)} → ${formatDate(filterConfig.customEndDate)}`;
      }
      if (filterConfig.customStartDate) return `Từ ${formatDate(filterConfig.customStartDate)}`;
      if (filterConfig.customEndDate) return `Đến ${formatDate(filterConfig.customEndDate)}`;
      return 'Tất Cả';
    }
    default:
      return 'Tất Cả';
  }
};

/**
 * Generate intelligent, actionable notifications for the Shipper notification bell
 * Scans orders for:
 *  1. Late appointment warnings (High priority)
 *  2. Upcoming appointment reminders
 *  3. Rescheduled orders for today's shift
 *  4. New ready orders at warehouse
 *  5. Cash COD collection threshold alerts
 *  6. Returning orders that need handover
 */
export const generateShipperNotifications = (
  orders = [],
  user = null,
  readNotificationIds = new Set()
) => {
  const notifs = [];
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const uName = String(user?.fullname || user?.name || '').toLowerCase();
  const uUser = String(user?.username || '').toLowerCase();
  const uPhone = String(user?.phone || '').replace(/\D/g, '');
  const userIdStr = String(user?.id || user?.username || '').toLowerCase();
  const shipperRegion = user?.deliveryRegion || 'HCM_KV1';

  const isShipperMatched = (o) => {
    if (!o) return false;
    const shipperStr = String(o.assignedShipper || o.assignedShipperName || '').toLowerCase();
    const assignedIdStr = String(o.assignedShipperId || o.assignedShipperUsername || '').toLowerCase();

    const isDirectlyAssigned = (assignedIdStr && (
        assignedIdStr === userIdStr ||
        assignedIdStr === uUser ||
        (user?.id && assignedIdStr === String(user.id).toLowerCase())
      )) ||
      (uName && shipperStr && shipperStr.includes(uName)) ||
      (uUser && shipperStr && shipperStr.includes(uUser)) ||
      (uPhone && shipperStr && shipperStr.includes(uPhone));

    if (isDirectlyAssigned) return true;
    if (o.assignedShipperId || o.assignedShipper || o.assignedShipperUsername) return false;

    if (shipperRegion === 'ALL') return true;
    const orderRegion = o.deliveryRegion || detectDeliveryRegion(o.shippingAddress || o.address || '');
    return orderRegion === shipperRegion;
  };

  const assignedActiveOrders = orders.filter(o =>
    o && ['SHIPPED', 'SHIPPING_FAILED', 'RETURNING_TO_WAREHOUSE'].includes(o.status) && isShipperMatched(o)
  );

  const readyOrders = orders.filter(o =>
    o && o.status === 'READY_TO_SHIP' && isShipperMatched(o)
  );

  // 1. Cảnh báo trễ hẹn (Late Warnings)
  assignedActiveOrders.forEach(ord => {
    if (ord.status === 'SHIPPED') {
      const apt = getAppointmentInfo(ord);
      if (apt.hasAppointment && apt.isToday && apt.isLate) {
        const id = `notif-late-${ord.orderId || ord.id}`;
        const minLate = apt.endMinutes ? Math.max(1, currentMinutes - apt.endMinutes) : 0;
        notifs.push({
          id,
          type: 'LATE_WARNING',
          category: 'urgent',
          title: `⚠️ Cảnh Báo Trễ Giờ Hẹn (${apt.timeWindow})`,
          message: `Đơn #${ord.orderId || ord.id} của khách ${ord.customer?.name || ord.customerName || 'khách'} đã quá hạn ~${minLate} phút. Hãy ưu tiên ghé giao ngay để tránh khách khiếu nại!`,
          orderId: ord.orderId || ord.id,
          targetTab: 'active',
          actionText: 'Xem đơn & Đi giao ngay',
          timeLabel: `Trễ ~${minLate}p`,
          isRead: readNotificationIds.has(id),
          createdAt: now
        });
      }
    }
  });

  // 2. Nhắc sắp tới giờ hẹn (Upcoming Appointments)
  assignedActiveOrders.forEach(ord => {
    if (ord.status === 'SHIPPED') {
      const apt = getAppointmentInfo(ord);
      if (apt.hasAppointment && apt.isToday && !apt.isLate) {
        const isApproaching = apt.startMinutes != null && (
          (currentMinutes >= apt.startMinutes - 60 && currentMinutes <= apt.endMinutes) ||
          apt.isUpcoming
        );
        if (isApproaching) {
          const id = `notif-upcoming-${ord.orderId || ord.id}`;
          const minLeft = apt.startMinutes > currentMinutes ? (apt.startMinutes - currentMinutes) : 0;
          notifs.push({
            id,
            type: 'UPCOMING_APPOINTMENT',
            category: 'urgent',
            title: `⏰ Sắp Đến Khung Giờ Hẹn (${apt.timeWindow})`,
            message: `Đơn #${ord.orderId || ord.id} (${ord.customer?.name || ord.customerName || 'khách'}) hẹn giao ${apt.timeWindow} chiều nay${minLeft > 0 ? ` (còn ~${minLeft}p)` : ''}. Hãy sắp xếp tuyến đường để tới đúng giờ!`,
            orderId: ord.orderId || ord.id,
            targetTab: 'active',
            actionText: 'Kiểm tra tuyến đường & ETA',
            timeLabel: `Khung ${apt.timeWindow}`,
            isRead: readNotificationIds.has(id),
            createdAt: now
          });
        }
      }
    }
  });

  // 3. Đơn giao lại có lịch hẹn hôm nay (Rescheduled for today)
  assignedActiveOrders.forEach(ord => {
    if (ord.status === 'SHIPPING_FAILED') {
      const apt = getAppointmentInfo(ord);
      if (apt.isToday || (ord.notes?.includes('GIAO_LAI') || ord.failNote?.includes('GIAO_LAI'))) {
        const id = `notif-rescheduled-${ord.orderId || ord.id}`;
        notifs.push({
          id,
          type: 'RESCHEDULED_TODAY',
          category: 'urgent',
          title: `🔄 Khách Hẹn Giao Lại Hôm Nay${apt.hasAppointment ? ` (${apt.timeWindow})` : ''}`,
          message: `Đơn #${ord.orderId || ord.id} (${ord.customer?.name || ord.customerName || 'khách'}) có hẹn giao lại trong ca hôm nay. Bấm nút "Giao Tiếp Theo Hẹn" để bắt đầu chuyến!`,
          orderId: ord.orderId || ord.id,
          targetTab: 'active',
          actionText: 'Bấm giao tiếp theo hẹn',
          timeLabel: apt.hasAppointment ? apt.timeWindow : 'Ca hôm nay',
          isRead: readNotificationIds.has(id),
          createdAt: now
        });
      }
    }
  });

  // 4. Đơn hàng mới sẵn sàng tại kho (New Warehouse Orders)
  if (readyOrders.length > 0) {
    const id = `notif-ready-warehouse-${readyOrders.length}-${now.toDateString()}`;
    notifs.push({
      id,
      type: 'NEW_ORDER',
      category: 'new',
      title: `📦 ${readyOrders.length} Đơn Hàng Mới Sẵn Sàng Tại Kho`,
      message: `Kho AetherPC vừa xuất ${readyOrders.length} kiện hàng mới cho khu vực của bạn. Hãy kiểm tra và bấm "Nhận Chuyến" để bắt đầu giao!`,
      targetTab: 'pending',
      actionText: 'Xem danh sách Chờ Nhận',
      timeLabel: 'Mới xuất kho',
      isRead: readNotificationIds.has(id),
      createdAt: now
    });
  }

  // 5. Cảnh báo hạn mức tiền mặt COD đang giữ & đối soát nộp tiền
  const deliveredToday = orders.filter(o => {
    if (!o || o.status !== 'DELIVERED' || !isShipperMatched(o)) return false;
    const isCod = o.paymentMethod === 'COD' || o.actualPaymentMethod === 'COD' || o.actualPaymentMethod === 'CASH' || (!o.paymentMethod && !o.actualPaymentMethod);
    if (!isCod) return false;
    const d = getOrderDateTime(o);
    return matchesDateFilter(d, { period: 'TODAY' });
  });

  const isOrderSettled = (o) => {
    if (Array.isArray(o.payments) && o.payments.length > 0) {
      const cashPayments = o.payments.filter(p => p.method === 'CASH');
      if (cashPayments.length > 0) {
        return cashPayments.every(p => p.settledAt !== null);
      }
    }
    return Boolean(o.codSettled || o.settledAt);
  };

  const settledToday = deliveredToday.filter(isOrderSettled);
  const pendingToday = deliveredToday.filter(o => !isOrderSettled(o));

  const totalCodToday = deliveredToday.reduce((sum, o) => sum + parseFloat(o.totalAmount || o.total || 0), 0);
  const settledCodToday = settledToday.reduce((sum, o) => sum + parseFloat(o.totalAmount || o.total || 0), 0);
  const pendingCodToday = pendingToday.reduce((sum, o) => sum + parseFloat(o.totalAmount || o.total || 0), 0);

  // 5a. Cảnh báo nếu tiền mặt COD đang giữ vượt ngưỡng an toàn
  if (pendingCodToday >= 3000000) {
    const id = `notif-cod-limit-${Math.floor(pendingCodToday / 1000000)}m-${now.toDateString()}`;
    notifs.push({
      id,
      type: 'COD_THRESHOLD',
      category: 'system',
      title: `💵 Nhắc Nhở Hạn Mức Tiền Mặt COD Đang Giữ`,
      message: `Bạn đang giữ tổng cộng ${pendingCodToday.toLocaleString('vi-VN')}đ tiền mặt COD trong ca hôm nay (${pendingToday.length} đơn). Hãy chú ý an toàn và nộp về thu ngân / kế toán khi hết ca.`,
      targetTab: 'overview',
      actionText: 'Xem bảng đối soát ca',
      timeLabel: 'Hôm nay',
      isRead: readNotificationIds.has(id),
      createdAt: now
    });
  }

  // 5b. Thông báo Kế toán đã duyệt nộp tiền COD
  if (settledCodToday > 0) {
    const lastSettledDate = settledToday[0]?.payments?.find(p => p.settledAt)?.settledAt || now;
    const timeKey = new Date(lastSettledDate).getHours();
    const id = `notif-cod-settled-${settledToday.length}-${timeKey}-${now.toDateString()}`;
    notifs.push({
      id,
      type: 'COD_SETTLED',
      category: 'system',
      title: `✅ Kế Toán Đã Duyệt Nộp Tiền COD`,
      message: `Kế toán đã xác nhận nhận đủ ${settledCodToday.toLocaleString('vi-VN')}đ tiền mặt COD (${settledToday.length} đơn). Quỹ ca của bạn đã được đối soát an toàn.`,
      targetTab: 'overview',
      actionText: 'Xem biên bản bàn giao ca',
      timeLabel: 'Hôm nay',
      isRead: readNotificationIds.has(id),
      createdAt: now
    });
  }

  // 6. Nhắc nhở hoàn kho (Returning Orders)
  const returningOrders = assignedActiveOrders.filter(o => o.status === 'RETURNING_TO_WAREHOUSE');
  if (returningOrders.length > 0) {
    const id = `notif-returning-${returningOrders.length}-${now.toDateString()}`;
    notifs.push({
      id,
      type: 'RETURNING_REMINDER',
      category: 'system',
      title: `🏢 ${returningOrders.length} Kiện Hàng Cần Bàn Giao Hoàn Kho`,
      message: `Bạn có ${returningOrders.length} đơn hàng giao thất bại cần chuyển hoàn về kho và chụp ảnh minh chứng bàn giao cho thủ kho.`,
      targetTab: 'active',
      actionText: 'Xem danh sách hoàn kho',
      timeLabel: 'Trong ca',
      isRead: readNotificationIds.has(id),
      createdAt: now
    });
  }

  return notifs;
};

