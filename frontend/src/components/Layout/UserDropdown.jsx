import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Key, Award, Mail, HelpCircle, ChevronDown } from 'lucide-react';

export const UserDropdown = React.memo(({
  user,
  onLogout,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const getTierDisplay = useCallback((tier) => {
    const tierMap = {
      'SILVER': 'Thành viên Bạc',
      'GOLD': 'Thành viên Vàng',
      'PLATINUM': 'Thành viên Bạch Kim',
      'DIAMOND': 'Thành viên Kim Cương',
    };
    return tierMap[tier?.toUpperCase()] || 'Thành viên Đồng';
  }, []);

  const getTierColor = useCallback((tier) => {
    const colorMap = {
      'SILVER': '#1e293b',
      'GOLD': '#d97706',
      'PLATINUM': '#0284c7',
      'DIAMOND': '#7e22ce',
    };
    return colorMap[tier?.toUpperCase()] || '#78716c';
  }, []);

  const handleLogout = useCallback(() => {
    onLogout?.();
    setIsOpen(false);
  }, [onLogout]);

  const handleNavigate = useCallback((path) => {
    navigate(path);
    setIsOpen(false);
  }, [navigate]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-10 px-3 rounded-md bg-slate-100 border border-slate-300 text-slate-600 text-sm font-medium hover:border-blue-500 hover:text-slate-900 transition-all"
      >
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: getTierColor(user.tier) }}>
          {user.name?.charAt(0).toUpperCase()}
        </span>
        <span className="hidden sm:inline">{user.name}</span>
        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* User Info */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200">
            <p className="font-semibold text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-600">{user.email}</p>
            <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: getTierColor(user.tier) }}>
              <Award size={12} />
              {getTierDisplay(user.tier)}
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {user.role !== 'CUSTOMER' && user.role !== 'SUPPLIER' && (
              <button
                onClick={() => handleNavigate('/admin')}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-3"
              >
                <LayoutDashboard size={16} />
                Quản lý hệ thống
              </button>
            )}
            <button
              onClick={() => handleNavigate('/account')}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-3"
            >
              <Mail size={16} />
              Tài khoản
            </button>
            <button
              onClick={() => handleNavigate('/orders')}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-3"
            >
              <Award size={16} />
              Đơn hàng
            </button>
            <button
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-3"
            >
              <Key size={16} />
              Đổi mật khẩu
            </button>
            <button
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-3"
            >
              <HelpCircle size={16} />
              Trợ giúp & hỗ trợ
            </button>
          </div>

          {/* Divider & Logout */}
          <div className="border-t border-slate-200">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3 font-medium"
            >
              <LogOut size={16} />
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

UserDropdown.displayName = 'UserDropdown';

