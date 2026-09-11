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
