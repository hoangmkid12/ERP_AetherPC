 import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { User, CreditCard, MapPin, Lock, Bell, Shield, FileText, Edit3 } from 'lucide-react';

export default function AccountSidebar({ activeTab, setActiveTab }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const menuItems = [
    { key: 'profile', icon: <User size={18} />, label: 'Hồ Sơ' },
    { key: 'bank', icon: <CreditCard size={18} />, label: 'Ngân Hàng' },
    { key: 'address', icon: <MapPin size={18} />, label: 'Địa Chỉ' },
    { key: 'password', icon: <Lock size={18} />, label: 'Đổi Mật Khẩu' },
    { key: 'notification', icon: <Bell size={18} />, label: 'Cài Đặt Thông Báo' },
    { key: 'privacy', icon: <Shield size={18} />, label: 'Những Thiết Lập Riêng Tư' },
  ];

  return (
    <div style={{ width: '250px', flexShrink: 0 }}>
      {/* User brief */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', marginBottom: '1.5rem' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 700 }}>
          {user.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user.username || user.email?.split('@')[0]}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <Edit3 size={12} /> Sửa Hồ Sơ
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div 
          onClick={() => { if(setActiveTab) setActiveTab('profile'); navigate('/account'); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', padding: '0.5rem 0', cursor: 'pointer' }}
        >
          <User size={20} color={activeTab !== 'orders' ? 'var(--primary)' : 'var(--text-secondary)'} />
          <span style={{ color: activeTab !== 'orders' ? 'var(--primary)' : 'var(--text-primary)' }}>Tài Khoản Của Tôi</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '2.25rem', gap: '0.5rem' }}>
          {menuItems.map(item => (
            <div 
              key={item.key}
              onClick={() => {
                if (setActiveTab) setActiveTab(item.key);
                navigate('/account');
              }}
              style={{
                color: activeTab === item.key ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.95rem',
                transition: 'color 0.2s',
                fontWeight: activeTab === item.key ? 600 : 400
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
              onMouseLeave={e => { if(activeTab !== item.key) e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              {item.label}
            </div>
          ))}
        </div>

        <Link to="/my-orders" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 700, color: activeTab === 'orders' ? 'var(--primary)' : 'var(--text-primary)', padding: '0.5rem 0', textDecoration: 'none', marginTop: '0.5rem' }}>
          <FileText size={20} color={activeTab === 'orders' ? 'var(--primary)' : 'var(--secondary)'} />
          Đơn Mua
        </Link>
      </div>
    </div>
  );
}
