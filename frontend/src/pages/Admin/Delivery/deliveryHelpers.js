// Builds the payload for a "delivery failed" status update — shared by
// FailModal (full reason picker) and QuickFailSheet (1-tap common reasons)
// so the attempt-count / 24h-callback-deadline logic lives in one place.
export const buildFailPayload = (order, failReason, failNote = '') => {
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
    deliveryAttempts: attemptCount
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
 * Extract the most relevant Date object from an Order
 */
export const getOrderDateTime = (ord) => {
  if (!ord) return null;
  const dateVal = ord.deliveredAt || ord.shippedAt || ord.confirmedAt || ord.updatedAt || ord.createdAt || ord.packedAt || ord.date;
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
      if (customStartDate) {
        const s = new Date(customStartDate + 'T00:00:00');
        if (!isNaN(s.getTime()) && d < s) return false;
      }
      if (customEndDate) {
        const e = new Date(customEndDate + 'T23:59:59.999');
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
    case 'CUSTOM':
      return `${filterConfig.customStartDate || '...'} → ${filterConfig.customEndDate || '...'}`;
    default:
      return 'Tất Cả';
  }
};
