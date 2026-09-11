import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSalesStore, useHRStore } from '../../stores';
import { notify } from '../../context/NotificationContext';
import { LEAVE_STATUS, getStatusInfo, getStatusLabel } from '../../utils/statusLabels';
import { Home, Package, Truck, Undo2, History, Bell, LogOut, CalendarCheck, X, Send, Wallet } from 'lucide-react';

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

  // Shipper tự xin nghỉ phép của chính mình — cùng API self-service /hr/leaves
  // đã dùng ở Sidebar.jsx cho các actor khác, vì DeliveryAppShell là shell
  // riêng (không dùng Sidebar) nên phải khai báo lại ở đây.
  const createMyLeaveRequest = useHRStore(state => state.createMyLeaveRequest);
  const getMyLeaveRequests = useHRStore(state => state.getMyLeaveRequests);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [myLeaves, setMyLeaves] = useState([]);
  const [loadingMyLeaves, setLoadingMyLeaves] = useState(false);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: 'Phép Năm', startDate: '', endDate: '', reason: '' });

  const openLeaveModal = async () => {
    setShowLeaveModal(true);
    if (typeof getMyLeaveRequests !== 'function') return;
    setLoadingMyLeaves(true);
    try {
      const data = await getMyLeaveRequests();
      setMyLeaves(Array.isArray(data) ? data : []);
    } catch (err) {
      notify(err.message || 'Không thể tải đơn nghỉ phép của bạn.', 'error');
    } finally {
      setLoadingMyLeaves(false);
    }
  };

  const handleSubmitLeaveRequest = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate) {
      notify('Vui lòng chọn ngày bắt đầu và kết thúc.', 'error');
      return;
    }
    if (typeof createMyLeaveRequest !== 'function') return;
    setSubmittingLeave(true);
    try {
      const created = await createMyLeaveRequest(leaveForm);
      setMyLeaves(prev => [created, ...prev]);
      setLeaveForm({ type: 'Phép Năm', startDate: '', endDate: '', reason: '' });
      notify('Đã gửi đơn xin nghỉ phép, chờ HR/CEO phê duyệt.', 'success');
    } catch (err) {
      notify(err.message || 'Không thể gửi đơn xin nghỉ phép.', 'error');
    } finally {
      setSubmittingLeave(false);
    }
  };

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
              onClick={openLeaveModal}
              className="delivery-icon-btn"
              title="Nghỉ phép của tôi"
            >
              <CalendarCheck size={18} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/my-payroll')}
              className="delivery-icon-btn"
              title="Phiếu lương của tôi"
            >
              <Wallet size={18} />
            </button>
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
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => goToTab(tab.id)}
                className={`delivery-bottom-nav-item${isActive ? ' active' : ''}`}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {showLeaveModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', zIndex: 100000001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setShowLeaveModal(false)}
        >
          <div
            style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '420px', padding: '1.25rem', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CalendarCheck size={17} style={{ color: '#7c3aed' }} />
                Nghỉ Phép Của Tôi
              </h3>
              <button onClick={() => setShowLeaveModal(false)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <select
                value={leaveForm.type}
                onChange={e => setLeaveForm(p => ({ ...p, type: e.target.value }))}
                style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.8rem' }}
              >
                <option value="Phép Năm">Phép Năm</option>
                <option value="Nghỉ Ốm">Nghỉ Ốm</option>
                <option value="Việc Riêng">Việc Riêng</option>
                <option value="Không Lương">Không Lương</option>
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(p => ({ ...p, startDate: e.target.value }))} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.8rem' }} />
                <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm(p => ({ ...p, endDate: e.target.value }))} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.8rem' }} />
              </div>
              <input type="text" placeholder="Lý do xin nghỉ" value={leaveForm.reason} onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))} style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.8rem' }} />
              <button
                onClick={handleSubmitLeaveRequest}
                disabled={submittingLeave}
                style={{ backgroundColor: submittingLeave ? '#9ca3af' : '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem', fontWeight: 800, cursor: submittingLeave ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
              >
                <Send size={14} /> {submittingLeave ? 'Đang gửi...' : 'Gửi Đơn Xin Nghỉ'}
              </button>
            </div>

            {loadingMyLeaves ? (
              <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Đang tải...</p>
            ) : myLeaves.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Bạn chưa gửi đơn xin nghỉ phép nào.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {myLeaves.map((lv, idx) => (
                  <div key={lv.id || idx} style={{ padding: '0.55rem 0.7rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '0.76rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#0f172a' }}>{lv.type || 'Phép Năm'}</strong>
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '0.66rem', fontWeight: 800,
                        backgroundColor: getStatusInfo(LEAVE_STATUS, ['APPROVED', 'REJECTED'].includes(lv.status) ? lv.status : 'PENDING').bg,
                        color: getStatusInfo(LEAVE_STATUS, ['APPROVED', 'REJECTED'].includes(lv.status) ? lv.status : 'PENDING').color
                      }}>
                        {getStatusLabel(LEAVE_STATUS, ['APPROVED', 'REJECTED'].includes(lv.status) ? lv.status : 'PENDING')}
                      </span>
                    </div>
                    <span style={{ color: '#64748b' }}>
                      {lv.startDate ? new Date(lv.startDate).toLocaleDateString('vi-VN') : '---'} → {lv.endDate ? new Date(lv.endDate).toLocaleDateString('vi-VN') : '---'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
