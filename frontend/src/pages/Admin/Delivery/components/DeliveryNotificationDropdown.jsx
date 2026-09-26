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
      case 'COD_SETTLED':
        return <CheckCheck size={16} color="#16a34a" />;
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
      case 'COD_SETTLED':
        return { bg: 'rgba(22, 163, 74, 0.12)', text: '#15803d', label: 'ĐÃ DUYỆT NỘP' };
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
        .delivery-notif-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }
        .delivery-notif-tabs::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: '10px',
          width: 'min(420px, calc(100% - 20px))',
          maxHeight: 'min(540px, calc(100vh - 85px))',
          zIndex: 9999,
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 18px 45px rgba(0, 0, 0, 0.22), 0 4px 14px rgba(0, 0, 0, 0.08)',
          border: '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transformOrigin: 'top right',
          animation: 'dropdownDrop 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Caret pointing directly up at Bell icon (82px from topbar right edge, dropdown is 10px from edge -> 72px center -> caret right: 66px) */}
        <div style={{
          position: 'absolute',
          top: '-6px',
          right: '66px',
          width: '12px',
          height: '12px',
          backgroundColor: '#ffffff',
          borderLeft: '1px solid #cbd5e1',
          borderTop: '1px solid #cbd5e1',
          transform: 'rotate(45deg)',
          zIndex: 12
        }} />

        {/* Header */}
        <div style={{
          padding: '0.8rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          position: 'relative',
          zIndex: 11
        }}>
          {/* Left Title + Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
              flexShrink: 0
            }}>
              <Bell size={16} color="#fff" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                Thông Báo
              </span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: '0.68rem', fontWeight: 800, color: '#ffffff',
                  backgroundColor: '#ef4444',
                  padding: '0.12rem 0.45rem', borderRadius: '999px',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                  flexShrink: 0
                }}>
                  {unreadCount} mới
                </span>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.35rem 0.65rem', borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#2563eb',
                  fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap', lineHeight: 1,
                  transition: 'background-color 0.15s'
                }}
                title="Đánh dấu tất cả đã đọc"
              >
                <CheckCheck size={14} />
                <span>Đã đọc hết</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '28px', height: '28px', borderRadius: '50%',
                border: 'none', backgroundColor: '#f1f5f9',
                color: '#64748b', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'background-color 0.15s'
              }}
              title="Đóng"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div
          className="delivery-notif-tabs"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 0.85rem',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
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
                  height: '28px',
                  padding: '0 0.7rem',
                  borderRadius: '999px',
                  border: isSelected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: isSelected ? '#2563eb' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#334155',
                  fontSize: '0.74rem',
                  fontWeight: isSelected ? 800 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  flexShrink: 0,
                  lineHeight: 1,
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 4px',
                    borderRadius: '999px',
                    fontSize: '0.64rem',
                    fontWeight: 800,
                    lineHeight: 1,
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.28)' : 'rgba(100, 116, 139, 0.15)',
                    color: isSelected ? '#ffffff' : '#64748b'
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
          padding: '0.75rem 0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
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
                <BellOff size={22} color="#94a3b8" />
              </div>
              <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
                Không có thông báo nào
              </strong>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b', maxWidth: '240px', lineHeight: 1.4 }}>
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
                  className="delivery-notif-card"
                  onClick={() => onNotificationClick && onNotificationClick(notif)}
                  style={{
                    padding: '0.75rem 0.85rem',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: !notif.isRead
                      ? (isUrgent ? 'rgba(239, 68, 68, 0.4)' : 'rgba(37, 99, 235, 0.35)')
                      : '#e2e8f0',
                    backgroundColor: !notif.isRead
                      ? (isUrgent ? 'rgba(254, 242, 242, 0.85)' : 'rgba(240, 249, 255, 0.85)')
                      : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '0.7rem',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Dot unread */}
                  {!notif.isRead && (
                    <span style={{
                      position: 'absolute', top: '9px', right: '9px',
                      width: '8px', height: '8px', borderRadius: '50%',
                      backgroundColor: isUrgent ? '#ef4444' : '#2563eb',
                      boxShadow: isUrgent ? '0 0 6px rgba(239, 68, 68, 0.6)' : 'none'
                    }} />
                  )}

                  {/* Left Icon */}
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '9px',
                    backgroundColor: badge.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {getIconForType(notif.type)}
                  </div>

                  {/* Body Content */}
                  <div style={{ flex: 1, minWidth: 0, paddingRight: notif.isRead ? 0 : '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      <span style={{
                        fontSize: '0.64rem', fontWeight: 800,
                        padding: '0.1rem 0.4rem', borderRadius: '4px',
                        backgroundColor: badge.bg, color: badge.text,
                        lineHeight: 1.2
                      }}>
                        {badge.label}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                        {notif.timeLabel || 'Hôm nay'}
                      </span>
                    </div>

                    <strong style={{
                      display: 'block', fontSize: '0.82rem',
                      color: isUrgent && !notif.isRead ? '#b91c1c' : '#0f172a',
                      marginBottom: '0.2rem', lineHeight: 1.3
                    }}>
                      {notif.title}
                    </strong>

                    <p style={{
                      margin: 0, fontSize: '0.75rem',
                      color: '#475569',
                      lineHeight: 1.45
                    }}>
                      {notif.message}
                    </p>

                    <div style={{
                      marginTop: '0.4rem',
                      display: 'flex', alignItems: 'center', gap: '0.2rem',
                      fontSize: '0.74rem', fontWeight: 700,
                      color: isUrgent ? '#dc2626' : '#2563eb'
                    }}>
                      <span>{notif.actionText || 'Xem đơn hàng'}</span>
                      <ChevronRight size={13} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.65rem 0.95rem',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '0.72rem', color: '#64748b'
        }}>
          <span>Nhắc giờ hẹn & phân công</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem 0.85rem', borderRadius: '7px',
              border: 'none', backgroundColor: '#2563eb',
              color: '#ffffff', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
              lineHeight: 1,
              transition: 'background-color 0.15s'
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </>
  );
}
