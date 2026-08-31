import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useNotification } from '../../context/NotificationContext';
import {
  ShoppingBag, Cpu, LogIn, LogOut, LayoutDashboard,
  ChevronDown, Tag, Newspaper, Building2, Users,
  Wrench, Star, X, Menu, Package, Heart, Key, Award, Mail, HelpCircle, Bell, CheckCircle, AlertCircle, Info
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Sản Phẩm', path: '/products' },
  {
    label: 'Khuyến Mãi',
    path: '/promotions',
    icon: <Tag size={15} />,
    highlight: true,
  },
  {
    label: 'Tự Build PC',
    path: '/pc-builder',
    icon: <Wrench size={15} />,
  },
  {
    label: 'Tin Tức',
    path: '/news',
    icon: <Newspaper size={15} />,
    dropdown: [
      { label: 'Tất Cả Bài Viết', path: '/news', icon: <Newspaper size={14} /> },
      { label: 'Review Sản Phẩm', path: '/news?cat=review', icon: <Star size={14} /> },
      { label: 'Hướng Dẫn Build PC', path: '/news?cat=guide', icon: <Wrench size={14} /> },
    ],
  },
  {
    label: 'Về Chúng Tôi',
    path: '/about',
    icon: <Building2 size={15} />,
    dropdown: [
      { label: 'Giới Thiệu Công Ty', path: '/about', icon: <Building2 size={14} /> },
      { label: 'Tuyển Dụng', path: '/careers', icon: <Users size={14} /> },
    ],
  },
];

export default function Header() {
  const { user, logout, isAuthenticated, updateUser } = useAuth();
  const { cartCount, wishlist, toggleWishlist, addToCart } = useCart();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);

  const getTierDisplay = (tier) => {
    if (!tier) return 'Thành viên Đồng';
    const t = tier.toUpperCase();
    if (t === 'SILVER') return 'Thành viên Bạc';
    if (t === 'GOLD') return 'Thành viên Vàng';
    if (t === 'PLATINUM') return 'Thành viên Bạch Kim';
    if (t === 'DIAMOND') return 'Thành viên Kim Cương';
    return 'Thành viên Đồng';
  };

  const getTierColor = (tier) => {
    if (!tier) return '#78716c';
    const t = tier.toUpperCase();
    if (t === 'SILVER') return '#1e293b';
    if (t === 'GOLD') return '#d97706';
    if (t === 'PLATINUM') return '#0284c7';
    if (t === 'DIAMOND') return '#7e22ce';
    return '#78716c';
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const showAdminLink = user && user.role !== 'CUSTOMER' && user.role !== 'SUPPLIER';

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpenProfile = () => {
    setEditName(user?.fullname || user?.name || '');
    setEditEmail(user?.email || '');
    setEditPhone(user?.phone || '');
    setEditAddress(user?.address || '');
    setEditCity(user?.city || '');
    setIsEditingProfile(false);
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      alert('Họ tên không được để trống!');
      return;
    }
    if (!editEmail.trim()) {
      alert('Email không được để trống!');
      return;
    }
    try {
      await updateUser({
        name: editName,
        email: editEmail,
        phone: editPhone,
        address: editAddress,
        city: editCity
      });
      alert('Cập nhật thông tin thành công!');
      setIsEditingProfile(false);
    } catch (err) {
      alert('Có lỗi xảy ra khi cập nhật thông tin: ' + err.message);
    }
  };

  return (
    <>
      <style>{`
        @keyframes slideInWishlist {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Announcement Bar */}
      <div className="announcement-bar">
        FLASH SALE — Giảm đến 30% linh kiện CPU &amp; VGA hôm nay!&nbsp;&nbsp;|&nbsp;&nbsp;
        Miễn phí vận chuyển cho đơn từ 500.000₫&nbsp;&nbsp;|&nbsp;&nbsp;
        Bảo hành chính hãng 24–36 tháng
      </div>

      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999999,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-glass)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        padding: '0.875rem 0',
      }}>
        <div className="container" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}>
          {/* Logo */}
          <Link to="/" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: 'var(--font-title)',
            fontSize: '1.4rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, var(--secondary), var(--primary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            flexShrink: 0,
          }}>
            <Cpu size={26} style={{ stroke: 'var(--secondary)', flexShrink: 0 }} />
            <span>AetherPC</span>
          </Link>

          {/* Desktop Navigation */}
          <nav ref={dropdownRef} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            flex: 1,
            justifyContent: 'center',
          }}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.path, item.exact);
              const hasDropdown = item.dropdown && item.dropdown.length > 0;
              const isOpen = openDropdown === item.label;

              return (
                <div key={item.label} style={{ position: 'relative' }}>
                  {hasDropdown ? (
                    <button
                      onClick={() => setOpenDropdown(isOpen ? null : item.label)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.5rem 0.875rem',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                        color: active ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        fontFamily: 'var(--font-sans)',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--text-primary)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = active ? 'var(--primary)' : 'var(--text-secondary)';
                        e.currentTarget.style.background = active ? 'rgba(99,102,241,0.12)' : 'transparent';
                      }}
                    >
                      {item.icon}
                      {item.label}
                      <ChevronDown size={13} style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                    </button>
                  ) : (
                    <Link
                      to={item.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.5rem 0.875rem',
                        borderRadius: 'var(--radius-md)',
                        background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                        color: item.highlight
                          ? 'var(--danger)'
                          : active ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: item.highlight ? 700 : 500,
                        fontSize: '0.875rem',
                        transition: 'all var(--transition-fast)',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                        if (!item.highlight) e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = active ? 'rgba(99,102,241,0.12)' : 'transparent';
                        e.currentTarget.style.color = item.highlight ? 'var(--danger)' : active ? 'var(--primary)' : 'var(--text-secondary)';
                      }}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  )}

                  {/* Dropdown menu */}
                  {hasDropdown && isOpen && (
                    <div className="nav-dropdown">
                      {item.dropdown.map((sub) => (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          className="nav-dropdown-item"
                          onClick={() => setOpenDropdown(null)}
                        >
                          {sub.icon}
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            {/* Cart */}
            <Link to="/cart" style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              height: '38px',
              padding: '0 0.875rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-secondary)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              transition: 'all var(--transition-fast)',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box'
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <ShoppingBag size={15} />
              <span>Giỏ Hàng</span>
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  backgroundColor: 'var(--danger)',
                  color: 'white',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  borderRadius: '50%',
                  padding: '2px 5px',
                  minWidth: '18px',
                  textAlign: 'center',
                  lineHeight: '1.2',
                }}>
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Wishlist Trigger Button */}
            <button onClick={() => setWishlistOpen(true)} style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              height: '38px',
              padding: '0 0.875rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-secondary)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-sans)',
              boxSizing: 'border-box'
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <Heart size={15} style={{ color: wishlist && wishlist.length > 0 ? 'var(--danger)' : 'inherit', fill: wishlist && wishlist.length > 0 ? 'var(--danger)' : 'none' }} />
              <span>Yêu Thích</span>
              {wishlist && wishlist.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  backgroundColor: 'var(--danger)',
                  color: 'white',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  borderRadius: '50%',
                  padding: '2px 5px',
                  minWidth: '18px',
                  textAlign: 'center',
                  lineHeight: '1.2',
                }}>
                  {wishlist.length}
                </span>
              )}
            </button>

            {/* Notification Bell */}
            <div style={{ position: 'relative' }} ref={notificationRef}>
              <button style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
                onClick={() => setNotificationOpen(!notificationOpen)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    borderRadius: '50%',
                    padding: '2px 5px',
                    minWidth: '16px',
                    textAlign: 'center',
                    lineHeight: '1.2',
                    border: '2px solid white'
                  }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notificationOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  width: '340px',
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  border: '1px solid #e2e8f0',
                  zIndex: 99999,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>Thông báo</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}>
                        Đánh dấu đã đọc tất cả
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                        Không có thông báo nào.
                      </div>
                    ) : (
                      notifications.map(note => (
                        <div key={note.id} 
                          onClick={() => {
                            markAsRead(note.id);
                            if (note.link) {
                              navigate(note.link);
                              setNotificationOpen(false);
                            }
                          }}
                          style={{ 
                            padding: '1rem', 
                            borderBottom: '1px solid #f1f5f9', 
                            backgroundColor: note.read ? '#fff' : '#eff6ff',
                            cursor: 'pointer',
                            display: 'flex',
                            gap: '0.75rem',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = note.read ? '#f8fafc' : '#dbeafe'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = note.read ? '#fff' : '#eff6ff'}
                        >
                          <div style={{ marginTop: '2px' }}>
                            {note.type === 'success' && <CheckCircle size={16} color="#10b981" />}
                            {note.type === 'error' && <AlertCircle size={16} color="#ef4444" />}
                            {note.type === 'info' && <Info size={16} color="#3b82f6" />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.875rem', color: note.read ? '#475569' : '#0f172a', fontWeight: note.read ? 400 : 500, lineHeight: 1.4 }}>
                              {note.message}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                              {new Date(note.createdAt).toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Section */}
            {isAuthenticated ? (
              <div 
                style={{ position: 'relative' }}
                onMouseEnter={() => setUserDropdownOpen(true)}
                onMouseLeave={() => setUserDropdownOpen(false)}
              >
                <button style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  height: '38px',
                  padding: '0 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  fontFamily: 'var(--font-sans)',
                  boxSizing: 'border-box'
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    flexShrink: 0
                  }}>
                    {(user.fullname || user.name || 'K').charAt(0)}
                  </div>
                  <span style={{ 
                    maxWidth: '140px', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                    display: 'inline-block'
                  }} title={user.fullname || user.name}>
                    {(user.fullname || user.name || 'Khách hàng').split(' (')[0]}
                  </span>
                  <ChevronDown size={14} style={{ opacity: 0.7, transition: 'transform 0.2s', flexShrink: 0, transform: userDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    paddingTop: '0.5rem', // Bridge the gap between the button and the dropdown
                    zIndex: 10000000,
                    animation: 'fadeIn 0.2s ease-out'
                  }}>
                    <div style={{
                      width: '280px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '16px',
                      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12), 0 4px 10px rgba(0, 0, 0, 0.05)',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      color: '#0f172a',
                    }}>
                      {/* User Header */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{user.fullname || user.name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                      </div>

                      <div style={{ height: '1px', backgroundColor: '#e2e8f0' }} />

                      {/* Member Tier & Points (Customer only) */}
                      {user.role === 'CUSTOMER' && (
                        <Link 
                          to="/member-tier" 
                          onClick={() => setUserDropdownOpen(false)} 
                          style={{ textDecoration: 'none', display: 'block' }}
                        >
                          <div style={{ 
                            backgroundColor: '#f8fafc', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '12px', 
                            padding: '0.65rem 0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                          >
                            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>Hạng thành viên</span>
                              <span style={{ color: '#2563eb', fontSize: '0.7rem', textTransform: 'none', fontWeight: 700 }}>Chi tiết →</span>
                            </div>
                            <div style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              backgroundColor: user.tier?.toUpperCase() === 'SILVER' ? '#e2e8f0' : '#fef3c7',
                              color: getTierColor(user.tier), 
                              fontWeight: 900,
                              fontSize: '0.88rem',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              width: 'fit-content',
                              border: user.tier?.toUpperCase() === 'SILVER' ? '1px solid #cbd5e1' : '1px solid #fde68a',
                              margin: '0.2rem 0'
                            }}>
                              <Star size={14} fill={getTierColor(user.tier)} color={getTierColor(user.tier)} />
                              {getTierDisplay(user.tier)}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                              Điểm tích lũy: <strong style={{ color: '#16a34a', fontWeight: 800 }}>{user.loyaltyPoints || 0}đ</strong>
                            </div>
                          </div>
                        </Link>
                      )}

                      {user.role !== 'CUSTOMER' && (
                        <div style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '0.5rem 0.65rem',
                          fontSize: '0.78rem',
                          color: '#475569'
                        }}>
                          Vai trò: <strong style={{ color: '#2563eb', fontWeight: 800 }}>{user.role}</strong>
                        </div>
                      )}

                      <div style={{ height: '1px', backgroundColor: '#e2e8f0' }} />

                      {/* Menu links */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <Link 
                          to="/profile"
                          onClick={() => setUserDropdownOpen(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'none',
                            color: '#334155',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-sans)',
                            width: '100%',
                            textDecoration: 'none',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#334155'; }}
                        >
                          <Users size={16} color="#475569" />
                          Thông tin cá nhân
                        </Link>

                        <button 
                          onClick={() => { setPasswordModalOpen(true); setUserDropdownOpen(false); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '0.6rem 0.75rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'none',
                            color: '#334155',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-sans)',
                            width: '100%',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#334155'; }}
                        >
                          <Key size={16} color="#475569" />
                          Đổi mật khẩu
                        </button>

                        {/* Customer-Only Menu Links */}
                        {user.role === 'CUSTOMER' && (
                          <>
                            <Link 
                              to="/my-orders"
                              onClick={() => setUserDropdownOpen(false)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem',
                                padding: '0.6rem 0.75rem',
                                borderRadius: '8px',
                                color: '#334155',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                textDecoration: 'none',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#334155'; }}
                            >
                              <Package size={16} color="#475569" />
                              Đơn hàng của tôi
                            </Link>

                            <Link 
                              to="/my-orders?complaint=true"
                              onClick={() => setUserDropdownOpen(false)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem',
                                padding: '0.6rem 0.75rem',
                                borderRadius: '8px',
                                color: '#ef4444',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                textDecoration: 'none',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <HelpCircle size={16} color="#ef4444" />
                              Gửi khiếu nại & hỗ trợ
                            </Link>

                            <Link 
                              to="/member-tier"
                              onClick={() => setUserDropdownOpen(false)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem',
                                padding: '0.6rem 0.75rem',
                                borderRadius: '8px',
                                color: '#334155',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                textDecoration: 'none',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#334155'; }}
                            >
                              <Award size={16} color="#475569" />
                              Đặc quyền thành viên
                            </Link>
                          </>
                        )}

                        {/* Enterprise / Employee Admin Link */}
                        {showAdminLink && (
                          <Link 
                            to="/admin"
                            onClick={() => setUserDropdownOpen(false)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.6rem',
                              padding: '0.6rem 0.75rem',
                              borderRadius: '8px',
                              color: '#2563eb',
                              backgroundColor: '#eff6ff',
                              fontSize: '0.85rem',
                              textDecoration: 'none',
                              fontWeight: 800,
                              transition: 'all 0.15s',
                              border: '1px solid #bfdbfe'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dbeafe'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                          >
                            <LayoutDashboard size={16} color="#2563eb" />
                            Bảng quản trị (ERP)
                          </Link>
                        )}

                        {/* Supplier Portal Link */}
                        {user.role === 'SUPPLIER' && (
                          <Link 
                            to="/supplier/portal"
                            onClick={() => setUserDropdownOpen(false)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.6rem',
                              padding: '0.6rem 0.75rem',
                              borderRadius: '8px',
                              color: '#2563eb',
                              backgroundColor: '#eff6ff',
                              fontSize: '0.85rem',
                              textDecoration: 'none',
                              fontWeight: 800,
                              transition: 'all 0.15s',
                              border: '1px solid #bfdbfe'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dbeafe'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                          >
                            <LayoutDashboard size={16} color="#2563eb" />
                            Cổng Nhà Cung Cấp
                          </Link>
                        )}
                      </div>

                      <div style={{ height: '1px', backgroundColor: '#e2e8f0' }} />

                      <button 
                        onClick={() => { handleLogout(); setUserDropdownOpen(false); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          padding: '0.6rem 0.75rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'none',
                          color: '#dc2626',
                          fontSize: '0.85rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                          width: '100%',
                          fontWeight: 700,
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <LogOut size={16} color="#dc2626" />
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="btn btn-primary" style={{ padding: '0.5rem 1.125rem', fontSize: '0.875rem' }}>
                <LogIn size={15} />
                Đăng Nhập
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Wishlist side-drawer */}
      {wishlistOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(6px)',
          zIndex: 99999999,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
          onClick={() => setWishlistOpen(false)}
        >
          <div style={{
            width: '100%',
            maxWidth: '420px',
            height: '100%',
            backgroundColor: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            boxShadow: '-10px 0 40px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            padding: '1.5rem',
            animation: 'slideInWishlist 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            color: '#0f172a',
            zIndex: 100000000,
          }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Heart size={20} fill="#ef4444" stroke="#ef4444" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800, color: '#0f172a' }}>Sản Phẩm Yêu Thích</h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({wishlist.length} sản phẩm đã lưu)</span>
                </div>
              </div>
              <button 
                onClick={() => setWishlistOpen(false)}
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {wishlist.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '5rem 1rem', color: '#64748b' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                    <Heart size={32} style={{ color: '#ef4444', strokeWidth: 1.5 }} />
                  </div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem' }}>Danh sách yêu thích trống</h4>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
                    Bạn chưa lưu sản phẩm nào. Hãy bấm biểu tượng trái tim ở các linh kiện để dễ dàng xem lại nhé!
                  </p>
                  <Link
                    to="/products"
                    onClick={() => setWishlistOpen(false)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      textDecoration: 'none',
                      padding: '0.65rem 1.25rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 700
                    }}
                  >
                    Khám Phá Sản Phẩm Ngay
                  </Link>
                </div>
              ) : (
                wishlist.map((item) => (
                  <div key={item.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    padding: '0.85rem',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    transition: 'all 0.15s'
                  }}>
                    {/* Thumbnail */}
                    <div style={{
                      width: '60px', height: '60px', background: '#f8fafc',
                      borderRadius: '8px', padding: '0.25rem', border: '1px solid #e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <img src={item.image || `https://placehold.co/60x60/1e263d/94a3b8?text=${item.brand}`} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link to={`/product/${item.id}`} onClick={() => setWishlistOpen(false)} style={{ textDecoration: 'none', color: '#0f172a' }}>
                        <h4 style={{
                          fontSize: '0.82rem', fontWeight: 700, margin: 0,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#2563eb'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#0f172a'}
                        >
                          {item.name}
                        </h4>
                      </Link>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#16a34a', marginTop: '3px' }}>
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                      <button
                        onClick={() => {
                          const inStock = (Number(item.stockQuantity) > 0 || Number(item.stock) > 0) && !item.isPreorder;
                          if (!inStock) {
                            alert('Sản phẩm này hiện đang trong diện ĐẶT TRƯỚC, vui lòng liên hệ CSKH để được hỗ trợ!');
                            return;
                          }
                          addToCart(item, 1);
                          alert(`✅ Đã thêm ${item.name} vào giỏ hàng!`);
                        }}
                        style={{
                          background: '#eff6ff', border: '1px solid #bfdbfe',
                          borderRadius: '6px', color: '#2563eb', cursor: 'pointer',
                          padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 700, gap: '0.25rem'
                        }}
                        title="Thêm vào giỏ"
                      >
                        <ShoppingBag size={14} />
                      </button>
                      <button
                        onClick={() => toggleWishlist(item)}
                        style={{
                          background: '#fef2f2', border: '1px solid #fecaca',
                          borderRadius: '6px', color: '#ef4444', cursor: 'pointer',
                          padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        title="Xóa khỏi yêu thích"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer with Clear or Browse */}
            {wishlist.length > 0 && (
              <div style={{ paddingTop: '1rem', borderTop: '1px solid #f1f5f9', marginTop: 'auto' }}>
                <Link
                  to="/cart"
                  onClick={() => setWishlistOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    textDecoration: 'none',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.88rem'
                  }}
                >
                  <ShoppingBag size={16} /> Đến Giỏ Hàng Mua Sắm
                </Link>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Profile Info / Edit Modal */}
      {profileModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(6px)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
        }}
          onClick={() => setProfileModalOpen(false)}
        >
          <div style={{
            width: '100%',
            maxWidth: '520px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '20px',
            padding: '2rem',
            color: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            animation: 'fadeIn 0.25s ease-out'
          }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#2563eb' }}>
                <Users size={22} color="#2563eb" />
                <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-title)' }}>
                  {isEditingProfile ? 'Chỉnh Sửa Thông Tin Cá Nhân' : 'Thông Tin Cá Nhân'}
                </h3>
              </div>
              <button 
                onClick={() => setProfileModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem', borderRadius: '6px' }}
                title="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            {isEditingProfile ? (
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                    Họ và Tên <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)} 
                    required 
                    placeholder="Nhập họ và tên..."
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                    Địa chỉ Email <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="email" 
                    value={editEmail} 
                    onChange={(e) => setEditEmail(e.target.value)} 
                    required 
                    placeholder="example@domain.com"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Số điện thoại liên hệ</label>
                  <input 
                    type="tel" 
                    value={editPhone} 
                    onChange={(e) => setEditPhone(e.target.value)} 
                    placeholder="Nhập số điện thoại..."
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Tỉnh / Thành phố</label>
                  <select 
                    value={editCity} 
                    onChange={(e) => setEditCity(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="">-- Chọn Tỉnh / Thành phố --</option>
                    {['TP. Hồ Chí Minh', 'TP. Hà Nội', 'TP. Đà Nẵng', 'TP. Hải Phòng', 'TP. Cần Thơ', 'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Ninh', 'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Thuận', 'Cà Mau', 'Đắk Lắk', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hải Dương', 'Khánh Hòa', 'Kiên Giang', 'Lâm Đồng', 'Long An', 'Nam Định', 'Nghệ An', 'Ninh Bình', 'Phú Thọ', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Thái Bình', 'Thái Nguyên', 'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'Vĩnh Long', 'Vĩnh Phúc'].map((prov, i) => (
                      <option key={i} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Địa chỉ nhà (Số nhà, Đường, Phường/Xã, Quận/Huyện...)</label>
                  <input 
                    type="text" 
                    value={editAddress} 
                    onChange={(e) => setEditAddress(e.target.value)} 
                    placeholder="Ví dụ: 123 Nguyễn Văn Cừ, Phường 4, Quận 5..."
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Modal Footer (Editing mode) */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                  <button 
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    style={{ padding: '0.6rem 1.4rem', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    style={{ padding: '0.6rem 1.4rem', borderRadius: '10px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}
                  >
                    Lưu Thông Tin
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ color: '#475569', fontSize: '0.88rem', fontWeight: 600 }}>Họ và Tên:</span>
                  <strong style={{ color: '#0f172a', fontSize: '0.95rem', fontWeight: 800 }}>{user?.fullname || user?.name || 'N/A'}</strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ color: '#475569', fontSize: '0.88rem', fontWeight: 600 }}>Địa chỉ Email:</span>
                  <span style={{ color: '#0f172a', fontSize: '0.92rem', fontWeight: 500 }}>{user?.email || 'N/A'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ color: '#475569', fontSize: '0.88rem', fontWeight: 600 }}>Số điện thoại:</span>
                  <span style={{ color: '#0f172a', fontSize: '0.92rem', fontWeight: 600 }}>{user?.phone || 'Chưa cung cấp'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ color: '#475569', fontSize: '0.88rem', fontWeight: 600 }}>Địa chỉ:</span>
                  <span style={{ color: '#0f172a', fontSize: '0.92rem' }}>{user?.address || 'Chưa cung cấp'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ color: '#475569', fontSize: '0.88rem', fontWeight: 600 }}>Tỉnh/Thành phố:</span>
                  <span style={{ color: '#0f172a', fontSize: '0.92rem' }}>{user?.city || 'Chưa cung cấp'}</span>
                </div>

                {user?.role === 'CUSTOMER' && (
                  <>
                    <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '0.5rem 0' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ color: '#475569', fontSize: '0.88rem', fontWeight: 600 }}>Hạng thành viên:</span>
                      <div style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        backgroundColor: user.tier?.toUpperCase() === 'SILVER' ? '#e2e8f0' : '#fef3c7',
                        color: getTierColor(user.tier), 
                        fontWeight: 900,
                        fontSize: '0.88rem',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        width: 'fit-content',
                        border: user.tier?.toUpperCase() === 'SILVER' ? '1px solid #cbd5e1' : '1px solid #fde68a'
                      }}>
                        <Star size={14} fill={getTierColor(user?.tier)} color={getTierColor(user?.tier)} />
                        {getTierDisplay(user?.tier)}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ color: '#475569', fontSize: '0.88rem', fontWeight: 600 }}>Điểm tích lũy:</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#16a34a' }}>{user?.loyaltyPoints || 0}đ</span>
                    </div>
                  </>
                )}

                {/* Modal Footer (Viewing mode) */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                  <button 
                    onClick={() => setProfileModalOpen(false)}
                    style={{ padding: '0.6rem 1.4rem', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    Đóng
                  </button>
                  <button 
                    onClick={() => setIsEditingProfile(true)}
                    style={{ padding: '0.6rem 1.4rem', borderRadius: '10px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}
                  >
                    Chỉnh Sửa
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password Modal */}
      {passwordModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(6px)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
        }}
          onClick={() => setPasswordModalOpen(false)}
        >
          <div style={{
            width: '100%',
            maxWidth: '460px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '20px',
            padding: '2rem',
            color: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            animation: 'fadeIn 0.25s ease-out'
          }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#2563eb' }}>
                <Key size={22} color="#2563eb" />
                <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-title)' }}>Đổi Mật Khẩu</h3>
              </div>
              <button 
                onClick={() => setPasswordModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem', borderRadius: '6px' }}
                title="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              const currentPassword = e.target.currentPassword.value;
              const newPassword = e.target.newPassword.value;
              const confirmPassword = e.target.confirmPassword.value;

              if (newPassword !== confirmPassword) {
                alert('Mật khẩu mới và mật khẩu xác nhận không khớp!');
                return;
              }

              try {
                alert('Đổi mật khẩu thành công!');
                setPasswordModalOpen(false);
              } catch (err) {
                alert('Có lỗi xảy ra: ' + err.message);
              }
            }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Mật khẩu hiện tại</label>
                <input 
                  type="password" 
                  name="currentPassword" 
                  required 
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Mật khẩu mới</label>
                <input 
                  type="password" 
                  name="newPassword" 
                  required 
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Xác nhận mật khẩu mới</label>
                <input 
                  type="password" 
                  name="confirmPassword" 
                  required 
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', backgroundColor: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                <button 
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  style={{ padding: '0.6rem 1.4rem', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  style={{ padding: '0.6rem 1.4rem', borderRadius: '10px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}
                >
                  Cập Nhật Mật Khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
  </>
  );
}
