import React, { createContext, useContext, useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('aether_notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    localStorage.setItem('aether_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (messageOrObj, type = 'success', link = null) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    let textMessage = messageOrObj;
    let notifType = type;
    let notifLink = link;

    if (typeof messageOrObj === 'object' && messageOrObj !== null) {
      textMessage = messageOrObj.message || messageOrObj.title || messageOrObj.text || JSON.stringify(messageOrObj);
      notifType = messageOrObj.type || type || 'success';
      notifLink = messageOrObj.link || link || null;
    }

    // Add to history (bell dropdown)
    const newNotification = {
      id,
      message: String(textMessage || ''),
      type: notifType,
      link: notifLink,
      read: false,
      createdAt: new Date().toISOString()
    };
    
    setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // Keep max 50

    // Add to active toasts
    setToasts(prev => [...prev, newNotification]);

    // Auto-remove toast after 3.5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount: notifications.filter(n => !n.read).length,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearAllNotifications
    }}>
      {children}
      
      {/* Toast Container */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none'
      }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            borderLeft: `4px solid ${toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#3b82f6'}`,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '320px',
            pointerEvents: 'auto',
            animation: 'slideIn 0.3s ease-out forwards'
          }}>
            <div style={{ flexShrink: 0 }}>
              {toast.type === 'success' && <CheckCircle size={20} color="#10b981" />}
              {toast.type === 'error' && <AlertCircle size={20} color="#ef4444" />}
              {toast.type === 'info' && <Info size={20} color="#3b82f6" />}
            </div>
            <div style={{ flex: 1, fontSize: '0.875rem', color: '#1e293b', fontWeight: 500, lineHeight: 1.4 }}>
              {typeof toast.message === 'object' ? (toast.message?.message || toast.message?.title || JSON.stringify(toast.message)) : String(toast.message || '')}
            </div>
            <button 
              onClick={() => removeToast(toast.id)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: '#94a3b8' }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </NotificationContext.Provider>
  );
};
