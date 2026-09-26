import React, { useState } from 'react';
import {
  Bell, X, CheckCheck, AlertTriangle, Clock, RotateCcw,
  Package, Wallet, Building, ChevronRight, Sparkles, Filter, BellOff
} from 'lucide-react';

export default function DeliveryNotificationSheet({
  isOpen,
  onClose,
  notifications = [],
  unreadCount = 0,
  onMarkAllAsRead,
  onNotificationClick
}) {
  const [activeTab, setActiveTab] = useState('ALL'); // ALL | UNREAD | URGENT | NEW

  if (!isOpen) return null;

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
        return <AlertTriangle size={18} color="#ef4444" />;
      case 'UPCOMING_APPOINTMENT':
        return <Clock size={18} color="#f59e0b" />;
      case 'RESCHEDULED_TODAY':
        return <RotateCcw size={18} color="#3b82f6" />;
      case 'NEW_ORDER':
        return <Package size={18} color="#10b981" />;
      case 'COD_THRESHOLD':
        return <Wallet size={18} color="#8b5cf6" />;
      case 'RETURNING_REMINDER':
        return <Building size={18} color="#f97316" />;
      default:
        return <Bell size={18} color="var(--primary)" />;
    }
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'LATE_WARNING':
        return { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', label: 'CẢNH BÁO TRỄ HẸN' };
      case 'UPCOMING_APPOINTMENT':
        return { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706', label: 'SẮP TỚI GIỜ HẸN' };
      case 'RESCHEDULED_TODAY':
        return { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb', label: 'HẸN GIAO LẠI' };
      case 'NEW_ORDER':
        return { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', label: 'ĐƠN MỚI TẠI KHO' };
      case 'COD_THRESHOLD':
        return { bg: 'rgba(139, 92, 246, 0.12)', text: '#7c3aed', label: 'NHẮC TIỀN MẶT COD' };
      case 'RETURNING_REMINDER':
        return { bg: 'rgba(249, 115, 22, 0.12)', text: '#ea580c', label: 'HOÀN KHO' };
      default:
        return { bg: 'rgba(100, 116, 139, 0.12)', text: 'var(--text-muted)', label: 'THÔNG BÁO' };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          margin: '0 auto',
          backgroundColor: 'var(--bg-primary, #ffffff)',
          borderTopLeftRadius: '22px',
          borderTopRightRadius: '22px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px', paddingBottom: '4px' }}>
          <div style={{ width: '44px', height: '5px', borderRadius: '999px', backgroundColor: 'var(--border-glass, #cbd5e1)' }} />
        </div>

        {/* Header */}
        <div style={{
          padding: '0.85rem 1.1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-glass, #e2e8f0)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 3px 10px rgba(37, 99, 235, 0.3)'
            }}>
              <Bell size={18} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary, #0f172a)' }}>
                  Thông Báo Giao Hàng
                </strong>
                {unreadCount > 0 && (
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 800, color: '#fff',
                    backgroundColor: 'var(--danger, #ef4444)',
                    padding: '0.15rem 0.45rem', borderRadius: '999px'
                  }}>
                    {unreadCount} mới
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>
                Nhắc giờ hẹn, cảnh báo trễ & phân công chuyến đi
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.4rem 0.65rem', borderRadius: '8px',
                  border: '1px solid var(--border-glass, #cbd5e1)',
                  backgroundColor: 'var(--bg-secondary, #f8fafc)',
                  color: 'var(--primary, #2563eb)',
                  fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer'
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
                width: '32px', height: '32px', borderRadius: '50%',
                border: 'none', backgroundColor: 'var(--bg-secondary, #f1f5f9)',
                color: 'var(--text-muted, #64748b)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div style={{
          display: 'flex', gap: '0.4rem', padding: '0.6rem 1.1rem',
          backgroundColor: 'var(--bg-secondary, #f8fafc)',
          borderBottom: '1px solid var(--border-glass, #e2e8f0)',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch'
        }}>
          {[
            { id: 'ALL', label: 'Tất Cả', count: notifications.length },
            { id: 'UNREAD', label: 'Chưa Đọc', count: unreadCount },
            { id: 'URGENT', label: '⏰ Khẩn Cấp / Hẹn Giờ', count: urgentCount },
            { id: 'NEW', label: '📦 Đơn Mới', count: newCount }
          ].map(tab => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  border: isSelected ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-glass, #cbd5e1)',
                  backgroundColor: isSelected ? 'var(--primary, #2563eb)' : 'var(--bg-primary, #ffffff)',
                  color: isSelected ? '#ffffff' : 'var(--text-primary, #334155)',
                  fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span style={{
                    padding: '0.05rem 0.35rem', borderRadius: '999px',
                    fontSize: '0.65rem',
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

        {/* Notification List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.85rem 1.1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.7rem'
        }}>
          {filteredNotifications.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '3.5rem 1.5rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem'
            }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                backgroundColor: 'rgba(100, 116, 139, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <BellOff size={28} color="var(--text-muted, #94a3b8)" />
              </div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary, #0f172a)' }}>
                Không có thông báo nào
              </strong>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', maxWidth: '280px' }}>
                {activeTab === 'UNREAD'
                  ? 'Bạn đã đọc hết tất cả thông báo rồi. Tuyệt vời!'
                  : activeTab === 'URGENT'
                  ? 'Hiện không có đơn hàng nào bị trễ hẹn hoặc sắp đến giờ cần chú ý.'
                  : 'Hệ thống sẽ tự động nhắc nhở khi có đơn hẹn giờ hoặc đơn mới tại kho.'}
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
                    padding: '0.85rem 0.95rem',
                    borderRadius: '14px',
                    border: '1px solid',
                    borderColor: !notif.isRead
                      ? (isUrgent ? 'rgba(239, 68, 68, 0.35)' : 'rgba(37, 99, 235, 0.3)')
                      : 'var(--border-glass, #e2e8f0)',
                    backgroundColor: !notif.isRead
                      ? (isUrgent ? 'rgba(254, 242, 242, 0.7)' : 'rgba(240, 249, 255, 0.7)')
                      : 'var(--bg-primary, #ffffff)',
                    boxShadow: !notif.isRead ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '0.75rem',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Unread blue dot */}
                  {!notif.isRead && (
                    <span style={{
                      position: 'absolute', top: '10px', right: '10px',
                      width: '8px', height: '8px', borderRadius: '50%',
                      backgroundColor: isUrgent ? '#ef4444' : '#2563eb'
                    }} />
                  )}

                  {/* Left Icon */}
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    backgroundColor: badge.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {getIconForType(notif.type)}
                  </div>

                  {/* Body Content */}
                  <div style={{ flex: 1, minWidth: 0, paddingRight: notif.isRead ? 0 : '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
                      <span style={{
                        fontSize: '0.64rem', fontWeight: 800,
                        padding: '0.12rem 0.4rem', borderRadius: '4px',
                        backgroundColor: badge.bg, color: badge.text,
                        letterSpacing: '0.02em'
                      }}>
                        {badge.label}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>
                        {notif.timeLabel || 'Vừa xong'}
                      </span>
                    </div>

                    <strong style={{
                      display: 'block', fontSize: '0.85rem',
                      color: isUrgent && !notif.isRead ? '#b91c1c' : 'var(--text-primary, #0f172a)',
                      marginBottom: '0.2rem', lineHeight: 1.3
                    }}>
                      {notif.title}
                    </strong>

                    <p style={{
                      margin: 0, fontSize: '0.77rem',
                      color: 'var(--text-secondary, #475569)',
                      lineHeight: 1.45
                    }}>
                      {notif.message}
                    </p>

                    {/* Action link */}
                    <div style={{
                      marginTop: '0.45rem',
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      fontSize: '0.74rem', fontWeight: 700,
                      color: isUrgent ? '#dc2626' : 'var(--primary, #2563eb)'
                    }}>
                      <span>{notif.actionText || 'Xem chi tiết đơn hàng'}</span>
                      <ChevronRight size={13} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div style={{
          padding: '0.65rem 1.1rem',
          backgroundColor: 'var(--bg-secondary, #f8fafc)',
          borderTop: '1px solid var(--border-glass, #e2e8f0)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '0.72rem', color: 'var(--text-muted, #64748b)'
        }}>
          <span>Cập nhật theo thời gian thực (VRPTW)</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem 0.85rem', borderRadius: '8px',
              border: 'none', backgroundColor: 'var(--primary, #2563eb)',
              color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
