import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSalesStore } from '../../stores';
import { api } from '../../services/api';
import useSafeViewportHeight from '../../hooks/useSafeViewportHeight';
import { detectDeliveryRegion, DELIVERY_REGIONS } from '../../utils/deliveryRegions';
import { Home, Package, Truck, Undo2, History, Bell, LogOut, MessageCircle, X, Send } from 'lucide-react';

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
  // +24px buffer: visualViewport.height reads slightly conservative on the
  // user's real iPhone, leaving a visible gap between the bottom tab bar
  // and Safari's own toolbar below it — nudge the shell a little taller so
  // the tab bar sits closer to the true bottom of the visible screen.
  const safeVh = useSafeViewportHeight() + 24;

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

  // Badge count — must match the same shipper/region matching Delivery/index.jsx
  // uses for its "Chờ Nhận"/"Đang Giao" lists (isShipperMatched), otherwise the
  // bottom-nav badge shows a system-wide count while the tab's real list is
  // scoped to this shipper's region and comes up empty.
  const uName = String(user?.fullname || user?.name || '').toLowerCase();
  const uUser = String(user?.username || '').toLowerCase();
  const uPhone = String(user?.phone || '').replace(/\D/g, '');
  const userIdStr = String(user?.id || user?.username || '').toLowerCase();
  const shipperRegion = user?.deliveryRegion || 'HCM_KV1';

  const REJECTED_ASSIGNMENTS_KEY = `aether_rejected_assignments_${userIdStr}`;
  const getRejectedAssignmentIds = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem(REJECTED_ASSIGNMENTS_KEY) || '[]'));
    } catch (_) { return new Set(); }
  };

  const isShipperMatched = (o) => {
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

    const orderIdStr = String(o.orderId || o.id || '');
    if (orderIdStr && getRejectedAssignmentIds().has(orderIdStr)) return false;

    if (shipperRegion === 'ALL') return true;
    const orderRegion = o.deliveryRegion || detectDeliveryRegion(o.shippingAddress || o.address || '');
    return orderRegion === shipperRegion;
  };

  const myAssignedOrders = (orders || []).filter(o =>
    o && ['SHIPPED', 'SHIPPING_FAILED', 'RETURNING_TO_WAREHOUSE', 'CANCELLED'].includes(o.status) && isShipperMatched(o)
  );
  const readyAtWarehouse = (orders || []).filter(o => o && o.status === 'READY_TO_SHIP' && isShipperMatched(o));
  const totalDeliveryTasks = myAssignedOrders.length + readyAtWarehouse.length;

  // Per-tab badge counts for the bottom nav — splits the same aggregate the
  // Bell icon already shows into where each order actually lives, so a
  // Shipper sees at a glance whether new work is waiting to be claimed
  // ("Chờ Nhận") or already in hand and needs delivering ("Đang Giao").
  const tabBadgeCounts = {
    pending: readyAtWarehouse.length,
    active: myAssignedOrders.length
  };

  const displayName = user?.fullname || 'Nhân Viên Giao Hàng';

  // ── Chat trực tiếp với CSKH (xử lý đơn có vấn đề) — dùng chung hạ tầng
  // /ws/cskh + REST fallback /chat/cskh/send mà widget CSKH của khách hàng
  // (Chatbot.jsx) và nút "Báo CSKH" trong Delivery/index.jsx đã dùng. sessionId
  // riêng theo shipper để không trộn lẫn với phiên chat của khách hàng, và
  // customerName gắn rõ "Shipper" + khu vực để CSKH nhận ra ngay trong danh
  // sách phiên của họ.
  const regionShortName = DELIVERY_REGIONS.find(r => r.code === shipperRegion)?.shortName || shipperRegion;
  const cskhSessionId = `session_shipper_${userIdStr || 'unknown'}`;
  const cskhCustomerName = `🚚 Shipper ${displayName} (${regionShortName})`;
  const cskhGreeting = () => ({
    sender: 'cskh',
    text: 'Xin chào! Đây là kênh chat trực tiếp với CSKH dành cho Shipper — hãy nhắn nếu đơn hàng đang giao gặp vấn đề (khách từ chối nhận, sai địa chỉ, không liên lạc được...), CSKH sẽ hỗ trợ ngay.',
    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  });

  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState(() => [cskhGreeting()]);
  const [chatInput, setChatInput] = useState('');
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const chatWsRef = useRef(null);
  const chatMessagesEndRef = useRef(null);

  useEffect(() => {
    let reconnectTimeout = null;

    const connectChatWS = () => {
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/cskh`);
        chatWsRef.current = ws;

        ws.onopen = () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'CLIENT_IDENTIFY',
              payload: { sessionId: cskhSessionId, customerName: cskhCustomerName }
            }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'UPDATE_SESSIONS' && data.newMsg?.sessionId === cskhSessionId) {
              if (data.newMsg.sender === 'staff') {
                setChatMessages(prev => [...prev, { sender: 'cskh', text: data.newMsg.text, time: data.newMsg.time }]);
                setShowChatModal(current => {
                  if (!current) setHasUnreadChat(true);
                  return current;
                });
              }
            }
          } catch (_) {}
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectChatWS, 3000);
        };
      } catch (_) {
        reconnectTimeout = setTimeout(connectChatWS, 3000);
      }
    };

    connectChatWS();

    return () => {
      if (chatWsRef.current) chatWsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cskhSessionId]);

  useEffect(() => {
    if (showChatModal) chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, showChatModal]);

  const openChatModal = () => {
    setShowChatModal(true);
    setHasUnreadChat(false);
  };

  const handleSendChat = async (textToSend) => {
    const text = (textToSend || chatInput).trim();
    if (!text) return;

    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [...prev, { sender: 'user', text, time }]);
    setChatInput('');

    const payload = { sessionId: cskhSessionId, sender: 'customer', text, time, customerName: cskhCustomerName };

    if (chatWsRef.current && chatWsRef.current.readyState === WebSocket.OPEN) {
      chatWsRef.current.send(JSON.stringify({ type: 'CUSTOMER_SEND_MSG', payload }));
    } else {
      try {
        await api.post('/chat/cskh/send', payload);
      } catch (err) {
        console.warn('Failed to send shipper CSKH message', err);
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const goToTab = (tabId) => {
    navigate(`/admin/delivery?tab=${tabId}`);
  };

  const initials = displayName.trim().split(/\s+/).slice(-1)[0]?.[0]?.toUpperCase() || 'S';

  return (
    <div className="delivery-app-shell">
      <div className="delivery-app-inner" style={{ height: `${safeVh}px` }}>
        {/* Top Bar */}
        <div className="delivery-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.9rem', fontWeight: 800
            }}>
              {initials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </strong>
              {/* Switch bật/tắt nhận đơn — dạng thanh trượt rõ ràng hơn chấm tròn+chữ trước đây */}
              <button
                type="button"
                onClick={toggleShipperStatus}
                className="delivery-pressable"
                style={{
                  marginTop: '0.2rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  width: 'fit-content'
                }}
                title={shipperStatus.isOnline ? 'Bấm để tạm dừng nhận đơn' : 'Bấm để bật nhận đơn'}
              >
                <span style={{
                  position: 'relative', width: '28px', height: '16px', borderRadius: '999px', flexShrink: 0,
                  backgroundColor: shipperStatus.isOnline ? 'var(--success)' : 'var(--border-glass)',
                  transition: 'background-color var(--transition-fast)'
                }}>
                  <span style={{
                    position: 'absolute', top: '2px', left: shipperStatus.isOnline ? '14px' : '2px',
                    width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#fff',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.3)', transition: 'left var(--transition-fast)'
                  }} />
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: shipperStatus.isOnline ? 'var(--success)' : 'var(--text-muted)' }}>
                  {shipperStatus.isOnline ? 'Sẵn sàng nhận đơn' : 'Tạm dừng'}
                </span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button type="button" onClick={openChatModal} className="delivery-icon-btn" title="Chat với CSKH" style={{ position: 'relative' }}>
              <MessageCircle size={18} />
              {hasUnreadChat && (
                <span style={{
                  position: 'absolute', top: '2px', right: '2px',
                  width: '9px', height: '9px', borderRadius: '999px',
                  backgroundColor: 'var(--danger)', border: '1.5px solid var(--bg-primary)'
                }} />
              )}
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

      {showChatModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)', zIndex: 100000001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setShowChatModal(false)}
        >
          <div
            style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '420px', height: '75vh', maxHeight: '560px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MessageCircle size={17} style={{ color: '#2563eb' }} />
                Chat Với CSKH
              </h3>
              <button onClick={() => setShowChatModal(false)} style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: '#f8fafc' }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    padding: '0.65rem 0.9rem',
                    borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: msg.sender === 'user' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#ffffff',
                    border: msg.sender === 'user' ? 'none' : '1.5px solid #e2e8f0',
                    color: msg.sender === 'user' ? '#ffffff' : '#0f172a',
                    fontSize: '0.83rem',
                    lineHeight: '1.5'
                  }}>
                    {msg.text}
                  </div>
                  <span style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.2rem', fontWeight: 600 }}>{msg.time}</span>
                </div>
              ))}
              <div ref={chatMessagesEndRef} />
            </div>

            <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#ffffff', display: 'flex', gap: '0.4rem', overflowX: 'auto', flexShrink: 0 }}>
              {[
                'Khách từ chối nhận hàng',
                'Không liên lạc được khách',
                'Địa chỉ giao hàng sai/không tìm thấy'
              ].map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendChat(label)}
                  style={{ padding: '0.35rem 0.7rem', fontSize: '0.72rem', borderRadius: '20px', border: '1.5px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  {label}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); handleSendChat(); }}
              style={{ padding: '0.75rem', borderTop: '1px solid #cbd5e1', display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: '#ffffff', flexShrink: 0 }}
            >
              <input
                type="text"
                placeholder="Nhắn tin với CSKH về đơn hàng gặp vấn đề..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                style={{ flex: 1, padding: '0.55rem 0.85rem', backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '12px', color: '#0f172a', fontSize: '0.85rem', outline: 'none' }}
              />
              <button
                type="submit"
                style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#2563eb', border: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
