import React, { useState } from 'react';
import {
  Bell, X, CheckCheck, AlertTriangle, Clock, RotateCcw,
  Package, Wallet, Building, ChevronRight, BellOff
} from 'lucide-react';

export default function DeliveryNotificationDropdown({
  onClose,
  notifications = [],
  unreadCount = 0,
  onMarkAllAsRead,
  onNotificationClick
}) {
  const [activeTab, setActiveTab] = useState('ALL'); // ALL | UNREAD | URGENT | NEW

  const urgentCount = notifications.filter(n => n.category === 'urgent').length;
  const newCount = notifications.filter(n => n.category === 'new').length;

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'UNREAD') return !n.isRead;
    if (activeTab === 'URGENT') return n.category === 'urgent';
    if (activeTab === 'NEW') return n.category === 'new';
    return true;
  });

  const getIconForType = (type) => {
    switch (type) {
      case 'LATE_WARNING':
        return <AlertTriangle size={16} color="#ef4444" />;
      case 'UPCOMING_APPOINTMENT':
        return <Clock size={16} color="#f59e0b" />;
      case 'RESCHEDULED_TODAY':
        return <RotateCcw size={16} color="#3b82f6" />;
      case 'NEW_ORDER':
        return <Package size={16} color="#10b981" />;
      case 'COD_THRESHOLD':
        return <Wallet size={16} color="#8b5cf6" />;
      case 'RETURNING_REMINDER':
        return <Building size={16} color="#f97316" />;
      default:
        return <Bell size={16} color="var(--primary, #2563eb)" />;
    }
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'LATE_WARNING':
        return { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', label: 'TRỄ HẸN' };
      case 'UPCOMING_APPOINTMENT':
        return { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706', label: 'SẮP ĐẾN HẸN' };
      case 'RESCHEDULED_TODAY':
        return { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb', label: 'GIAO LẠI' };
      case 'NEW_ORDER':
        return { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', label: 'ĐƠN MỚI' };
      case 'COD_THRESHOLD':
        return { bg: 'rgba(139, 92, 246, 0.12)', text: '#7c3aed', label: 'TIỀN COD' };
      case 'RETURNING_REMINDER':
        return { bg: 'rgba(249, 115, 22, 0.12)', text: '#ea580c', label: 'HOÀN KHO' };
      default:
        return { bg: 'rgba(100, 116, 139, 0.12)', text: 'var(--text-muted)', label: 'THÔNG BÁO' };
    }
  };

  return (
    <>
      <style>{`
        @keyframes dropdownDrop {
          0% {
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: '-6px',
          width: 'min(380px, calc(100vw - 20px))',
          maxHeight: 'min(520px, calc(100vh - 90px))',
          zIndex: 9999,
          backgroundColor: 'var(--bg-primary, #ffffff)',
          borderRadius: '16px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.08)',
          border: '1px solid var(--border-glass, #cbd5e1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transformOrigin: 'top right',
          animation: 'dropdownDrop 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Caret pointing up at Bell icon */}
        <div style={{
          position: 'absolute',
          top: '-6px',
          right: '20px',
          width: '12px',
          height: '12px',
          backgroundColor: 'var(--bg-primary, #ffffff)',
          borderLeft: '1px solid var(--border-glass, #cbd5e1)',
          borderTop: '1px solid var(--border-glass, #cbd5e1)',
          transform: 'rotate(45deg)',
          zIndex: 10
        }} />

      {/* Header */}
      <div style={{
        padding: '0.75rem 0.95rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-glass, #e2e8f0)',
        backgroundColor: 'var(--bg-primary, #ffffff)',
        position: 'relative',
        zIndex: 11
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
          }}>
            <Bell size={15} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary, #0f172a)' }}>
                Thông Báo Giao Hàng
              </strong>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: '0.64rem', fontWeight: 800, color: '#fff',
                  backgroundColor: 'var(--danger, #ef4444)',
                  padding: '0.1rem 0.4rem', borderRadius: '999px'
                }}>
                  {unreadCount} mới
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.3rem 0.55rem', borderRadius: '6px',
                border: '1px solid var(--border-glass, #cbd5e1)',
                backgroundColor: 'var(--bg-secondary, #f8fafc)',
                color: 'var(--primary, #2563eb)',
                fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer'
              }}
              title="Đánh dấu tất cả đã đọc"
            >
              <CheckCheck size={13} />
              <span>Đã đọc hết</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '26px', height: '26px', borderRadius: '50%',
              border: 'none', backgroundColor: 'var(--bg-secondary, #f1f5f9)',
              color: 'var(--text-muted, #64748b)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex', gap: '0.35rem', padding: '0.5rem 0.85rem',
        backgroundColor: 'var(--bg-secondary, #f8fafc)',
        borderBottom: '1px solid var(--border-glass, #e2e8f0)',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch'
      }}>
        {[
          { id: 'ALL', label: 'Tất Cả', count: notifications.length },
          { id: 'UNREAD', label: 'Chưa Đọc', count: unreadCount },
          { id: 'URGENT', label: '⏰ Hẹn Giờ', count: urgentCount },
          { id: 'NEW', label: '📦 Đơn Mới', count: newCount }
        ].map(tab => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.25rem 0.6rem',
                borderRadius: '999px',
                border: isSelected ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-glass, #cbd5e1)',
                backgroundColor: isSelected ? 'var(--primary, #2563eb)' : 'var(--bg-primary, #ffffff)',
                color: isSelected ? '#ffffff' : 'var(--text-primary, #334155)',
                fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span style={{
                  padding: '0.02rem 0.3rem', borderRadius: '999px',
                  fontSize: '0.62rem',
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(100,116,139,0.15)',
                  color: isSelected ? '#fff' : 'var(--text-muted, #64748b)'
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notification Scrollable List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.65rem 0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem'
      }}>
        {filteredNotifications.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '2.5rem 1rem',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.55rem'
          }}>
            <div style={{
              width: '46px', height: '46px', borderRadius: '50%',
              backgroundColor: 'rgba(100, 116, 139, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <BellOff size={22} color="var(--text-muted, #94a3b8)" />
            </div>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary, #0f172a)' }}>
              Không có thông báo nào
            </strong>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted, #64748b)', maxWidth: '240px' }}>
              {activeTab === 'UNREAD'
                ? 'Bạn đã đọc hết tất cả thông báo rồi!'
                : 'Hệ thống sẽ tự động nhắc khi có đơn hẹn hoặc đơn mới.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const badge = getBadgeStyle(notif.type);
            const isUrgent = notif.category === 'urgent';
            return (
              <div
                key={notif.id}
                onClick={() => onNotificationClick && onNotificationClick(notif)}
                style={{
                  padding: '0.7rem 0.8rem',
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: !notif.isRead
                    ? (isUrgent ? 'rgba(239, 68, 68, 0.35)' : 'rgba(37, 99, 235, 0.3)')
                    : 'var(--border-glass, #e2e8f0)',
                  backgroundColor: !notif.isRead
                    ? (isUrgent ? 'rgba(254, 242, 242, 0.75)' : 'rgba(240, 249, 255, 0.75)')
                    : 'var(--bg-primary, #ffffff)',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '0.65rem',
                  position: 'relative',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Dot unread */}
                {!notif.isRead && (
                  <span style={{
                    position: 'absolute', top: '8px', right: '8px',
                    width: '7px', height: '7px', borderRadius: '50%',
                    backgroundColor: isUrgent ? '#ef4444' : '#2563eb'
                  }} />
                )}

                {/* Left Icon */}
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  backgroundColor: badge.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {getIconForType(notif.type)}
                </div>

                {/* Body Content */}
                <div style={{ flex: 1, minWidth: 0, paddingRight: notif.isRead ? 0 : '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem' }}>
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 800,
                      padding: '0.1rem 0.35rem', borderRadius: '4px',
                      backgroundColor: badge.bg, color: badge.text
                    }}>
                      {badge.label}
                    </span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-muted, #94a3b8)' }}>
                      {notif.timeLabel || 'Hôm nay'}
                    </span>
                  </div>

                  <strong style={{
                    display: 'block', fontSize: '0.8rem',
                    color: isUrgent && !notif.isRead ? '#b91c1c' : 'var(--text-primary, #0f172a)',
                    marginBottom: '0.15rem', lineHeight: 1.25
                  }}>
                    {notif.title}
                  </strong>

                  <p style={{
                    margin: 0, fontSize: '0.74rem',
                    color: 'var(--text-secondary, #475569)',
                    lineHeight: 1.4
                  }}>
                    {notif.message}
                  </p>

                  <div style={{
                    marginTop: '0.35rem',
                    display: 'flex', alignItems: 'center', gap: '0.2rem',
                    fontSize: '0.72rem', fontWeight: 700,
                    color: isUrgent ? '#dc2626' : 'var(--primary, #2563eb)'
                  }}>
                    <span>{notif.actionText || 'Xem đơn hàng'}</span>
                    <ChevronRight size={12} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.5rem 0.85rem',
        backgroundColor: 'var(--bg-secondary, #f8fafc)',
        borderTop: '1px solid var(--border-glass, #e2e8f0)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: '0.68rem', color: 'var(--text-muted, #64748b)'
      }}>
        <span>Nhắc giờ hẹn & phân công</span>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '0.25rem 0.7rem', borderRadius: '6px',
            border: 'none', backgroundColor: 'var(--primary, #2563eb)',
            color: '#fff', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer'
          }}
        >
          Đóng
        </button>
      </div>
    </div>
  </>
);
}
