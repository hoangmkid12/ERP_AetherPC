import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useNotification, notify } from '../../context/NotificationContext';
import { api } from '../../services/api';
import { getRoleName } from '../../utils/rbacEngine';
import {
  ShoppingBag, Cpu, LogIn, LogOut, LayoutDashboard,
  ChevronDown, Tag, Newspaper, Building2, Users,
  Wrench, Star, X, Menu, Package, Heart, Key, Award, Mail, HelpCircle, Bell, CheckCircle, AlertCircle, Info,
  Search, Phone, Zap, LayoutGrid, Truck, ShieldCheck, Gift, ClipboardList, User as UserIcon
} from 'lucide-react';
import CategoryMenu from '../Storefront/CategoryMenu';
import useCatalog from '../Storefront/useCatalog';
import { fmtVnd, PLACEHOLDER_IMG, SHOP } from '../Storefront/catalog';

// Thanh điều hướng phụ dưới header (cũng dùng cho menu di động)
const NAV_ITEMS = [
  { label: 'Khuyến Mãi', path: '/promotions', icon: <Tag size={15} />, highlight: true },
  { label: 'Flash Sale', path: '/flash-sale', icon: <Zap size={15} />, highlight: true },
  { label: 'Tất Cả Sản Phẩm', path: '/products', icon: <LayoutGrid size={15} /> },
  { label: 'Tự Build PC', path: '/pc-builder', icon: <Wrench size={15} /> },
  { label: 'Tin Công Nghệ', path: '/news', icon: <Newspaper size={15} /> },
  { label: 'Hạng Thành Viên', path: '/member-tier', icon: <Award size={15} /> },
  { label: 'Giới Thiệu', path: '/about', icon: <Building2 size={15} /> },
  { label: 'Tuyển Dụng', path: '/careers', icon: <Users size={15} /> },
];

// Ô tìm kiếm có gợi ý sản phẩm tức thì
function normalizeText(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

function HeaderSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { products } = useCatalog();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const boxRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQ(location.pathname === '/products' ? (params.get('q') || '') : '');
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const suggestions = React.useMemo(() => {
    const words = normalizeText(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const out = [];
    for (const p of products) {
      const hay = normalizeText(`${p.name} ${p.brand} ${p.sku}`);
      if (words.every(w => hay.includes(w))) out.push(p);
      if (out.length >= 6) break;
    }
    return out;
  }, [q, products]);

  const submit = (e) => {
    e.preventDefault();
    if (hi >= 0 && suggestions[hi]) {
      navigate(`/product/${suggestions[hi].id}`);
    } else {
      navigate(q.trim() ? `/products?q=${encodeURIComponent(q.trim())}` : '/products');
    }
    setOpen(false);
  };

  return (
    <div className="sf-search" ref={boxRef}>
      <form onSubmit={submit} role="search">
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); setHi(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, suggestions.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, -1)); }
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Bạn cần tìm gì? VGA, CPU, màn hình..."
          aria-label="Tìm kiếm sản phẩm"
        />
        <button type="submit" aria-label="Tìm kiếm"><Search size={20} /></button>
      </form>
      {open && q.trim() && (
        <div className="sf-suggest">
          {suggestions.length === 0 ? (
            <div style={{ padding: '14px', fontSize: 13, color: '#6b7280' }}>Không tìm thấy sản phẩm phù hợp với "{q}"</div>
          ) : suggestions.map((p, i) => (
            <div key={p.id} className={`sf-suggest-item${i === hi ? ' is-active' : ''}`}
              onMouseDown={e => { e.preventDefault(); navigate(`/product/${p.id}`); setOpen(false); }}>
              <img src={p.image || PLACEHOLDER_IMG} alt="" />
              <div style={{ minWidth: 0 }}>
                <div className="n">{p.name}</div>
                <div className="p">{fmtVnd(p.price)}</div>
              </div>
            </div>
          ))}
          <Link className="sf-suggest-all" to={`/products?q=${encodeURIComponent(q.trim())}`} onClick={() => setOpen(false)}>
            Xem tất cả kết quả cho "{q.trim()}"
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const { cartCount, wishlist, toggleWishlist, addToCart } = useCart();
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAllNotifications } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [catOpen, setCatOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
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
  useEffect(() => { setCatOpen(false); }, [location.pathname, location.search]);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setCatOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
      {/* Thanh khuyến mãi */}
      <div className="sf-topbar">
        <div className="sf-container sf-topbar-inner">
          <span><Zap size={14} /> <b>FLASH SALE</b> mỗi ngày — giá sốc linh kiện PC chính hãng</span>
          <span><Truck size={14} /> <b>Miễn phí giao hàng</b> toàn quốc mọi đơn</span>
          <span><ShieldCheck size={14} /> Bảo hành chính hãng 24–36 tháng</span>
          <span><Phone size={14} /> Hotline <b>{SHOP.hotline}</b></span>
        </div>
      </div>

      <header className="sf-header">
        <div className="sf-container sf-header-inner" style={{ position: 'relative' }} ref={dropdownRef}>
          <Link to="/" className="sf-logo" aria-label="AetherPC - Trang chủ">
            <span className="sf-logo-mark"><Cpu size={22} /></span>
            <span className="t">AetherPC<small>PC &amp; GAMING GEAR</small></span>
          </Link>

          <button type="button" className={`sf-cat-btn${catOpen ? ' is-open' : ''}`} onClick={() => setCatOpen(o => !o)} aria-expanded={catOpen}>
            <Menu size={20} /><span>Danh mục</span>
          </button>
          {catOpen && (
            <div className="sf-catmenu-pop">
              <CategoryMenu onNavigate={() => setCatOpen(false)} />
            </div>
          )}

          <HeaderSearch />

          {/* Actions */}
          <div className="sf-hactions">
            <a href={`tel:${SHOP.hotline.replace(/\s/g, '')}`} className="sf-hitem sf-hitem-opt">
              <Phone size={22} />
              <span className="sf-htext sf-htext-opt">Hotline<b>{SHOP.hotline}</b></span>
            </a>
            <Link to={isAuthenticated && user?.role === 'CUSTOMER' ? '/my-orders' : '/login'} className="sf-hitem sf-hitem-opt">
              <ClipboardList size={22} />
              <span className="sf-htext">Tra cứu<b>đơn hàng</b></span>
            </Link>
            {/* Cart */}
            <Link to="/cart" className="sf-hitem">
              <ShoppingBag size={22} />
              {cartCount > 0 && <span className="sf-badge-count">{cartCount > 99 ? '99+' : cartCount}</span>}
              <span className="sf-htext">Giỏ<b>hàng</b></span>
            </Link>

            {/* Wishlist Trigger Button */}
            <button type="button" className="sf-hitem sf-hitem-opt" onClick={() => setWishlistOpen(true)} title="Sản phẩm yêu thích">
              <Heart size={22} />
              {wishlist && wishlist.length > 0 && <span className="sf-badge-count">{wishlist.length}</span>}
            </button>

            {/* Notification Bell — Chỉ hiển thị khi đã đăng nhập */}
            {isAuthenticated && (
              <div style={{ position: 'relative' }} ref={notificationRef}>
                <button type="button" className="sf-hitem" title="Thông báo"
                  onClick={() => setNotificationOpen(!notificationOpen)}
                >
                  <Bell size={22} />
                  {unreadCount > 0 && (
                    <span className="sf-badge-count" style={{
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
                    <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>Thông báo</h3>
                        {unreadCount > 0 && (
                          <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 600 }}>
                            {unreadCount} mới
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                        {unreadCount > 0 && (
                          <button onClick={markAllAsRead} style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500 }}>
                            Đánh dấu đã đọc
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button 
                            onClick={clearAllNotifications} 
                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500 }}
                            title="Xóa tất cả thông báo"
                          >
                            Xóa tất cả
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                          <Bell size={28} color="#cbd5e1" style={{ margin: '0 auto 0.5rem auto', display: 'block' }} />
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
                              padding: '0.875rem 1rem', 
                              borderBottom: '1px solid #f1f5f9', 
                              backgroundColor: note.read ? '#fff' : '#eff6ff',
                              cursor: 'pointer',
                              display: 'flex',
                              gap: '0.75rem',
                              position: 'relative',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = note.read ? '#f8fafc' : '#dbeafe'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = note.read ? '#fff' : '#eff6ff'}
                          >
                            <div style={{ marginTop: '2px', flexShrink: 0 }}>
                              {note.type === 'success' && <CheckCircle size={16} color="#10b981" />}
                              {note.type === 'error' && <AlertCircle size={16} color="#ef4444" />}
                              {note.type === 'info' && <Info size={16} color="#3b82f6" />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <div style={{ fontSize: '0.85rem', color: note.read ? '#475569' : '#0f172a', fontWeight: note.read ? 400 : 500, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                  {note.message}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeNotification(note.id);
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    color: '#94a3b8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    flexShrink: 0,
                                    opacity: 0.7
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.opacity = '1'; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.opacity = '0.7'; }}
                                  title="Xóa thông báo"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.35rem' }}>
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
            )}

            {/* User Section */}
            {isAuthenticated ? (
              <div 
                style={{ position: 'relative' }}
                onMouseEnter={() => setUserDropdownOpen(true)}
                onMouseLeave={() => setUserDropdownOpen(false)}
              >
                <button type="button" className="sf-hitem">
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    color: 'var(--sf-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    flexShrink: 0
                  }}>
                    {(user.fullname || user.name || 'K').charAt(0)}
                  </div>
                  <span className="header-user-name-span sf-htext" style={{ fontWeight: 700, fontSize: '13px', maxWidth: '110px', 
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
                  <div className="header-user-dropdown" style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    paddingTop: '0.5rem',
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
                          Vai trò: <strong style={{ color: '#2563eb', fontWeight: 800 }}>{getRoleName(user.role)}</strong>
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
              <Link to="/login" className="sf-hitem sf-hitem-login">
                <UserIcon size={22} />
                <span className="sf-htext">Đăng nhập<b>Đăng ký</b></span>
              </Link>
            )}

            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              type="button"
              className="sf-hitem sf-burger"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Mở Menu Điều Hướng"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      <nav className="sf-subnav" aria-label="Điều hướng nhanh">
        <div className="sf-container sf-subnav-inner">
          {NAV_ITEMS.map(item => (
            <Link key={item.path} to={item.path}
              className={`${isActive(item.path) ? 'is-active' : ''}${item.highlight ? ' is-hot' : ''}`}>
              {item.icon}{item.label}
            </Link>
          ))}
          <span className="sf-subnav-note"><Gift size={14} /> Tích điểm mọi đơn hàng</span>
        </div>
      </nav>

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
                            notify('Sản phẩm này hiện đang trong diện ĐẶT TRƯỚC, vui lòng liên hệ CSKH để được hỗ trợ!', 'error');
                            return;
                          }
                          addToCart(item, 1);
                          notify(`Đã thêm ${item.name} vào giỏ hàng.`, 'success');
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
                notify('Mật khẩu mới và mật khẩu xác nhận không khớp!', 'error');
                return;
              }

              try {
                await api.put('/auth/change-password', { currentPassword, newPassword });
                notify('Đổi mật khẩu thành công!', 'success');
                setPasswordModalOpen(false);
                e.target.reset();
              } catch (err) {
                notify('Có lỗi xảy ra: ' + err.message, 'error');
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

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999999 }}>
          {/* Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.5)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />

          {/* Drawer Panel */}
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '300px',
            maxWidth: '85vw',
            background: '#ffffff',
            boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100000000,
          }}>
            {/* Drawer Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem 1rem',
              borderBottom: '1px solid #e2e8f0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary)' }}>
                <Cpu size={22} color="var(--primary)" />
                <span>AetherPC</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              {/* User Section or Login */}
              {isAuthenticated ? (
                <div style={{
                  padding: '0.85rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '1rem',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{user.fullname || user.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                  {showAdminLink && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      <LayoutDashboard size={15} />
                      Vào Trang Quản Trị ERP
                    </Link>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: '1rem' }}>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <LogIn size={16} />
                    Đăng Nhập / Đăng Ký
                  </Link>
                </div>
              )}

              {/* Navigation Links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    padding: '0.75rem 0.85rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    textDecoration: 'none',
                  }}
                >
                  Trang Chủ
                </Link>

                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      padding: '0.75rem 0.85rem',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      color: item.highlight ? 'var(--danger)' : '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      textDecoration: 'none',
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}

                <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '0.5rem 0' }} />

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setWishlistOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.75rem 0.85rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'none',
                    color: '#1e293b',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <Heart size={16} style={{ color: wishlist?.length > 0 ? 'var(--danger)' : '#64748b' }} />
                  Danh Sách Yêu Thích ({wishlist?.length || 0})
                </button>

                {isAuthenticated && user.role === 'CUSTOMER' && (
                  <Link
                    to="/my-orders"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.75rem 0.85rem',
                      borderRadius: '8px',
                      color: '#1e293b',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <Package size={16} color="#64748b" />
                    Đơn hàng của tôi
                  </Link>
                )}

                {isAuthenticated && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.75rem 0.85rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'none',
                      color: '#dc2626',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      marginTop: '0.5rem',
                    }}
                  >
                    <LogOut size={16} color="#dc2626" />
                    Đăng Xuất
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
  </>
  );
}
