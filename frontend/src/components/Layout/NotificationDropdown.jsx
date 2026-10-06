import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export const NotificationDropdown = React.memo(({
  notifications = [],
  unreadCount = 0,
  onMarkAsRead,
  onRemove,
  onMarkAllAsRead,
  onClearAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleNotificationClick = useCallback((notification) => {
    onMarkAsRead?.(notification.id);
    if (notification.link) {
      navigate(notification.link);
      handleClose();
    }
  }, [onMarkAsRead, navigate, handleClose]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, handleClose]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-10 h-10 rounded-md bg-slate-100 border border-slate-300 text-slate-600 hover:border-blue-500 hover:text-slate-900 transition-all"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900">Thông báo</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-semibold">
                  {unreadCount} mới
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => onMarkAllAsRead?.()}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Đánh dấu tất cả
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => onClearAll?.()}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                >
                  Xóa tất cả
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                <Bell size={28} className="mx-auto mb-2 text-slate-300" />
                Không có thông báo nào
              </div>
            ) : (
              notifications.map((note) => (
                <div
                  key={note.id}
                  onClick={() => handleNotificationClick(note)}
                  className={`px-4 py-3 border-b border-slate-100 cursor-pointer transition-colors flex gap-3 ${
                    note.read ? 'bg-white hover:bg-slate-50' : 'bg-blue-50 hover:bg-blue-100'
                  }`}
                >
                  <div className="flex-shrink-0 mt-1">
                    {note.type === 'success' && <CheckCircle size={16} className="text-green-600" />}
                    {note.type === 'error' && <AlertCircle size={16} className="text-red-600" />}
                    {note.type === 'info' && <Info size={16} className="text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className={`text-sm break-words ${note.read ? 'text-slate-600' : 'text-slate-900 font-medium'}`}>
                        {note.message}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove?.(note.id);
                        }}
                        className="text-slate-400 hover:text-red-500 flex-shrink-0 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(note.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});

NotificationDropdown.displayName = 'NotificationDropdown';

