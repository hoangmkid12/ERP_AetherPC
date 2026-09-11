import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSalesStore } from '../../stores';
import { Home, Package, Truck, Undo2, History, Bell, LogOut } from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Tổng Quan', icon: Home },
  { id: 'pending', label: 'Chờ Nhận', icon: Package },
  { id: 'active', label: 'Đang Giao', icon: Truck },
  { id: 'returns', label: 'Trả Hàng', icon: Undo2 },
  { id: 'history', label: 'Lịch Sử', icon: History }
];

// Quản lý trạng thái Bật / Tắt nhận đơn của Shipper — same localStorage
// contract as the old Delivery.jsx page so a shipper's status persists
// across the layout rewrite.
const getInitialShipperStatus = (user) => {
  try {
    const statuses = JSON.parse(localStorage.getItem('erp_shipper_statuses') || '{}');
    const uKey = user?.id || user?.username || 'shipper';
    if (statuses[uKey] !== undefined) return statuses[uKey];
    if (user?.fullname && statuses[user.fullname] !== undefined) return statuses[user.fullname];
  } catch (e) {}
  return { isOnline: true, reason: '' };
};

export default function DeliveryAppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'active';

  const orders = useSalesStore(state => state.orders) || [];

  const [shipperStatus, setShipperStatus] = useState(() => getInitialShipperStatus(user));

  const toggleShipperStatus = () => {
    const online = !shipperStatus.isOnline;
    const newStatus = { isOnline: online, reason: '', updatedAt: new Date().toISOString() };
    setShipperStatus(newStatus);
    try {
      const statuses = JSON.parse(localStorage.getItem('erp_shipper_statuses') || '{}');
      const uKey = user?.id || user?.username || 'shipper';
      statuses[uKey] = newStatus;
      if (user?.fullname) statuses[user.fullname] = newStatus;
      if (user?.username) statuses[user.username] = newStatus;
      localStorage.setItem('erp_shipper_statuses', JSON.stringify(statuses));
    } catch (e) {}
  };

  // Badge count — exact same computation as ActorNotificationBar's
  // `role === 'DELIVERY'` branch (my SHIPPED orders + READY_TO_SHIP at warehouse).
  const uName = String(user?.fullname || user?.name || '').toLowerCase();
  const uUser = String(user?.username || '').toLowerCase();
  const uPhone = String(user?.phone || '').replace(/\D/g, '');

  const myAssignedOrders = (orders || []).filter(o => {
    if (!o || o.status !== 'SHIPPED') return false;
    const s = String(o.assignedShipper || '').toLowerCase();
    return (uName && s.includes(uName)) || (uUser && s.includes(uUser)) || (uPhone && s.includes(uPhone)) || String(o.assignedShipperId) === String(user?.id);
  });
  const readyAtWarehouse = (orders || []).filter(o => o && o.status === 'READY_TO_SHIP');
  const totalDeliveryTasks = myAssignedOrders.length + readyAtWarehouse.length;

  // Per-tab badge counts for the bottom nav — splits the same aggregate the
  // Bell icon already shows into where each order actually lives, so a
  // Shipper sees at a glance whether new work is waiting to be claimed
  // ("Chờ Nhận") or already in hand and needs delivering ("Đang Giao").
  const tabBadgeCounts = {
    pending: readyAtWarehouse.length,
    active: myAssignedOrders.length
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.fullname || 'Nhân Viên Giao Hàng';

  const goToTab = (tabId) => {
    navigate(`/admin/delivery?tab=${tabId}`);
  };

  return (
    <div className="delivery-app-shell">
      <div className="delivery-app-inner">
        {/* Top Bar */}
        <div className="delivery-topbar">
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName}
            </strong>
            <button
              type="button"
              onClick={toggleShipperStatus}
              style={{
                marginTop: '0.2rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                border: 'none',
                borderRadius: '999px',
                padding: '0.15rem 0.55rem',
                fontSize: '0.68rem',
                fontWeight: 800,
                cursor: 'pointer',
                width: 'fit-content',
                backgroundColor: shipperStatus.isOnline ? 'rgba(22,163,74,0.12)' : 'rgba(100,116,139,0.14)',
                color: shipperStatus.isOnline ? 'var(--success)' : 'var(--text-muted)'
              }}
              title={shipperStatus.isOnline ? 'Bấm để tạm dừng nhận đơn' : 'Bấm để bật nhận đơn'}
            >
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                backgroundColor: shipperStatus.isOnline ? 'var(--success)' : 'var(--text-muted)'
              }} />
              {shipperStatus.isOnline ? 'Sẵn sàng nhận đơn' : 'Tạm dừng'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => navigate('/admin/delivery?tab=pending')}
              className="delivery-icon-btn"
              title="Thông báo"
              style={{ position: 'relative' }}
            >
              <Bell size={19} />
              {totalDeliveryTasks > 0 && (
                <span style={{
                  position: 'absolute', top: '2px', right: '2px',
                  minWidth: '15px', height: '15px', borderRadius: '999px',
                  backgroundColor: 'var(--danger)', color: '#fff',
                  fontSize: '0.6rem', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px', lineHeight: 1
                }}>
                  {totalDeliveryTasks > 99 ? '99+' : totalDeliveryTasks}
                </span>
              )}
            </button>
            <button type="button" onClick={handleLogout} className="delivery-icon-btn" title="Đăng xuất">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="delivery-content">
          {children}
        </div>

        {/* Bottom Tab Bar */}
        <div className="delivery-bottom-nav">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badgeCount = tabBadgeCounts[tab.id] || 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => goToTab(tab.id)}
                className={`delivery-bottom-nav-item${isActive ? ' active' : ''}`}
              >
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <Icon size={20} />
                  {badgeCount > 0 && (
                    <span style={{
                      position: 'absolute', top: '-6px', right: '-9px',
                      minWidth: '15px', height: '15px', borderRadius: '999px',
                      backgroundColor: 'var(--danger)', color: '#fff',
                      fontSize: '0.6rem', fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 3px', lineHeight: 1, border: '1.5px solid var(--bg-primary)'
                    }}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
