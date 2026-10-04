import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useNotification } from '../../context/NotificationContext';
import { Menu, X } from 'lucide-react';

import { HeaderLogo } from './HeaderLogo';
import { HeaderNav } from './HeaderNav';
import { HeaderActions } from './HeaderActions';
import { NotificationDropdown } from './NotificationDropdown';
import { UserDropdown } from './UserDropdown';

export default function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const { cartCount, wishlist } = useCart();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    removeNotification, 
    clearAllNotifications 
  } = useNotification();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Announcement Bar */}
      <div className="bg-blue-900 text-white text-xs font-medium text-center py-2 px-4">
        FLASH SALE — Giảm đến 30% linh kiện CPU &amp; VGA hôm nay! | Miễn phí vận chuyển từ 500.000₫ | Bảo hành 24–36 tháng
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 py-3">
        <div className="container mx-auto px-4 flex justify-between items-center gap-4">
          {/* Logo */}
          <HeaderLogo />

          {/* Desktop Navigation */}
          <HeaderNav />

          {/* Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Cart & Wishlist */}
            <HeaderActions 
              cartCount={cartCount} 
              wishlistCount={wishlist?.length || 0}
              onWishlistClick={() => setWishlistOpen(true)}
            />

            {/* Notifications */}
            {isAuthenticated && (
              <NotificationDropdown
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                onRemove={removeNotification}
                onMarkAllAsRead={markAllAsRead}
                onClearAll={clearAllNotifications}
              />
            )}

            {/* User Menu */}
            {isAuthenticated ? (
              <UserDropdown user={user} onLogout={handleLogout} />
            ) : (
              <a
                href="/login"
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Đăng Nhập
              </a>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-md transition-colors"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 mt-3 pt-3 px-4">
            <nav className="space-y-2">
              <a href="/products" className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md">Sản Phẩm</a>
              <a href="/promotions" className="block px-3 py-2 text-sm text-red-600 font-bold hover:bg-slate-100 rounded-md">Khuyến Mãi</a>
              <a href="/pc-builder" className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md">Tự Build PC</a>
              <a href="/news" className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md">Tin Tức</a>
              <a href="/about" className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md">Về Chúng Tôi</a>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}

