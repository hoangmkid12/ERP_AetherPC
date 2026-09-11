import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

// Module-level refs so `notify`/`confirm` can be called from ANYWHERE —
// including Zustand store actions, which run outside React and can't use
// the useNotification() hook. NotificationProvider keeps these pointed at
// its live addNotification/confirm implementations on every render. This
// mirrors how real toast libraries (react-hot-toast, sonner) expose a
// plain `toast()` function alongside their hook.
let notifyRef = (msg) => console.warn('[Notify] NotificationProvider chưa sẵn sàng:', msg);
let confirmRef = (msg) => Promise.resolve(window.confirm(msg));
let promptRef = (msg, def) => Promise.resolve(window.prompt(msg, def));

export const notify = (messageOrObj, type, link) => notifyRef(messageOrObj, type, link);
export const confirm = (message, options) => confirmRef(message, options);
export const promptText = (message, defaultValue = '') => promptRef(message, defaultValue);

// One shared "aether_notifications" localStorage key meant every account
// that ever logged in on a given browser read and wrote the same history —
// a customer logging in after someone else on a shared/public machine saw
// that other person's order confirmations, and a staff account saw whatever
// a customer had triggered earlier. Key the list to the logged-in identity
// instead so each account only ever sees its own notifications.
const storageKeyFor = (user) => `aether_notifications_${user?.id ?? 'guest'}`;

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const activeStorageKey = useRef(storageKeyFor(user));

  // Reload the notification history whenever the logged-in identity changes
  // (login, logout, or switching accounts in the same tab) instead of only
  // once on mount, so a fresh login never inherits the previous account's list.
  useEffect(() => {
    const key = storageKeyFor(user);
    activeStorageKey.current = key;
    try {
      const saved = localStorage.getItem(key);
      setNotifications(saved ? JSON.parse(saved) : []);
    } catch (e) {
      setNotifications([]);
    }
  }, [user?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(activeStorageKey.current, JSON.stringify(notifications));
    } catch (e) {}
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

  // Promise-based confirm()/promptText() dialog, replacing window.confirm()
  // and window.prompt() with the app's own styled modal (ConfirmDialog.jsx
  // renders either a yes/no dialog or one with a text input based on
  // options.showInput).
  const [confirmState, setConfirmState] = useState(null);

  const confirmFn = (message, options = {}) => {
    return new Promise((resolve) => {
      setConfirmState({ message, options, resolve });
    });
  };

  const promptFn = (message, defaultValue = '') => {
    return new Promise((resolve) => {
      setConfirmState({ message, options: { showInput: true, inputDefaultValue: defaultValue }, resolve });
    });
  };

  const resolveConfirm = (result) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  // Keep the module-level refs pointed at this provider instance's live
  // implementations so notify()/confirm()/promptText() work from anywhere.
  notifyRef = addNotification;
  confirmRef = confirmFn;
  promptRef = promptFn;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount: notifications.filter(n => !n.read).length,
      addNotification,
      confirm: confirmFn,
      promptText: promptFn,
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

      <ConfirmDialog
        open={!!confirmState}
        message={confirmState?.message}
        confirmLabel={confirmState?.options?.confirmLabel}
        cancelLabel={confirmState?.options?.cancelLabel}
        danger={confirmState?.options?.danger}
        showInput={confirmState?.options?.showInput}
        inputDefaultValue={confirmState?.options?.inputDefaultValue}
        inputPlaceholder={confirmState?.options?.inputPlaceholder}
        onConfirm={(inputValue) => resolveConfirm(confirmState?.options?.showInput ? inputValue : true)}
        onCancel={() => resolveConfirm(confirmState?.options?.showInput ? null : false)}
      />
    </NotificationContext.Provider>
  );
};
