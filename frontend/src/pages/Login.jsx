import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notify } from '../context/NotificationContext';
import { 
  LogIn, Key, User as UserIcon, AlertTriangle, UserPlus, 
  ArrowLeft, ShieldAlert
} from 'lucide-react';
import { SUPPLIER_DEMO_ACCOUNTS } from '../config/supplierDemoAccounts';

const DEMO_ACCOUNTS = [
  { role: 'ceo', label: 'Ban Giám Đốc (CEO)' },
  { role: 'admin', label: 'Quản Trị Hệ Thống' },
  { role: 'sales_manager', label: 'Quản Lý Bán Hàng' },
  { role: 'sales', label: 'Nhân Viên Bán Hàng' },
  { role: 'warehouse_manager', label: 'Quản Lý Kho Vận' },
  { role: 'warehouse', label: 'Thủ Kho (Vận Hành)' },
  { role: 'purchasing', label: 'Phòng Mua Hàng' },
  { role: 'qc', label: 'Kiểm Định QA/QC' },
  { role: 'assembly', label: 'Kỹ Thuật Lắp Ráp' },
  { role: 'hr', label: 'Quản Trị Nhân Sự' },
  { role: 'accounting', label: 'Kế Toán Tài Chính' },
  { role: 'cskh', label: 'Chăm Sóc Khách Hàng' },
  { role: 'delivery', label: 'Giao Vận (Shipper)' },
  { role: 'customer', label: 'Khách Hàng Website' }
];

const SUPPLIER_LOGIN_ACCOUNTS = [
  { role: 'supplier', label: 'Nhà Cung Cấp ABC' },
  ...SUPPLIER_DEMO_ACCOUNTS
];

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  
  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [name, setName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [email, setEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegister) {
        // 1. Username validation (lowercase letters, digits, underscore)
        const usernameTrim = regUsername.trim().toLowerCase();
        const usernameRegex = /^[a-z0-9_]{3,30}$/;
        if (!usernameRegex.test(usernameTrim)) {
          setError('Tên đăng nhập phải từ 3-30 ký tự, chỉ gồm chữ thường, số và dấu gạch dưới');
          return;
        }

        // 2. Email format validation
        const emailTrim = email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTrim)) {
          setError('Email không đúng định dạng. Vui lòng nhập dạng name@example.com');
          return;
        }

        // 3. Password length validation
        if (registerPassword.length < 6) {
          setError('Mật khẩu phải chứa ít nhất 6 ký tự');
          return;
        }

        // 4. Vietnamese Phone number validation (10 digits starting with 0)
        const phoneTrim = phone.trim();
        const phoneRegex = /^0[3|5|7|8|9]\d{8}$/;
        if (!phoneTrim) {
          setError('Vui lòng nhập Số điện thoại liên hệ');
          return;
        }
        if (!phoneRegex.test(phoneTrim)) {
          setError('Số điện thoại không hợp lệ. Phải bao gồm 10 chữ số đầu số Việt Nam (VD: 0912345678)');
          return;
        }

        setLoading(true);
        // Customer Registration
        await register({
          username: usernameTrim,
          email: emailTrim,
          password: registerPassword,
          name: name.trim(),
          phone: phoneTrim
        });
        notify('Đăng ký tài khoản khách hàng thành công!', 'success');
        navigate('/');
      } else {
        setLoading(true);
        // Sign In (Customer or Employee)
        const loggedUser = await login(username, password);
        if (['CEO', 'SALES', 'SALES_MANAGER', 'WAREHOUSE', 'WAREHOUSE_MANAGER', 'PURCHASING', 'ASSEMBLY', 'HR', 'ACCOUNTANT', 'ADMIN', 'SUPPLIER', 'CSKH', 'DELIVERY', 'QC', 'QA'].includes(loggedUser.role)) {
          // Redirect employee to admin panel based on role
          if (loggedUser.role === 'CEO') navigate('/admin/dashboard');
          else if (loggedUser.role === 'SALES' || loggedUser.role === 'SALES_MANAGER') navigate('/admin/sales');
          else if (loggedUser.role === 'WAREHOUSE' || loggedUser.role === 'WAREHOUSE_MANAGER') navigate('/admin/warehouse');
          else if (loggedUser.role === 'ASSEMBLY') navigate('/admin/assembly');
          else if (loggedUser.role === 'HR') navigate('/admin/hr');
          else if (loggedUser.role === 'ACCOUNTANT') navigate('/admin/accounting');
          else if (loggedUser.role === 'PURCHASING') navigate('/admin/purchasing');
          else if (loggedUser.role === 'QC' || loggedUser.role === 'QA') navigate('/admin/quality-control');
          else if (loggedUser.role === 'ADMIN') navigate('/admin/system');
          else if (loggedUser.role === 'CSKH') navigate('/admin/cskh');
          else if (loggedUser.role === 'DELIVERY') navigate('/admin/delivery');
          else if (loggedUser.role === 'SUPPLIER') navigate('/supplier/portal');
          else navigate('/admin/assembly');
        } else {
          // Customer goes to storefront home
          navigate('/');
        }
      }
    } catch (err) {
      setError(err.message || 'Thao tác thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (userRole) => {
    setUsername(userRole);
    setPassword('123456');
    setIsRegister(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2.5rem 1.5rem',
      backgroundColor: '#f1f5f9',
      backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      position: 'relative'
    }}>
      {/* Back to Home Button */}
      <button
        onClick={() => navigate('/')}
        style={{
          position: 'absolute',
          top: '2rem',
          left: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '12px',
          padding: '0.55rem 1.25rem',
          color: '#334155',
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          cursor: 'pointer',
          zIndex: 10,
          transition: 'all 0.2s',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.875rem',
          fontWeight: 600
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#f1f5f9';
          e.currentTarget.style.color = '#0f172a';
          e.currentTarget.style.borderColor = '#94a3b8';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#ffffff';
          e.currentTarget.style.color = '#334155';
          e.currentTarget.style.borderColor = '#cbd5e1';
        }}
      >
        <ArrowLeft size={16} />
        Trở về trang chủ
      </button>

      {/* Main Container */}
      <div style={{ width: '100%', maxWidth: isRegister ? '900px' : '460px', zIndex: 1 }}>
        
        {/* Card */}
        <div style={{ 
          backgroundColor: '#ffffff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '24px', 
          overflow: 'hidden',
          boxShadow: '0 24px 60px -10px rgba(15, 23, 42, 0.13)' 
        }}>
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            
            {/* ── LEFT COLUMN: Form ── */}
            <div style={{ flex: '1 1 420px', padding: '2.5rem', minWidth: '300px' }}>
              
              {/* Brand */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' }}>
                    <ShieldAlert size={20} color="#fff" />
                  </div>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-title)', letterSpacing: '-0.02em' }}>AETHER PC</span>
                </div>
                <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-title)', color: '#0f172a', fontWeight: 800, margin: '0 0 0.3rem' }}>
                  {isRegister ? 'Đăng Ký Khách Hàng' : 'Đăng Nhập'}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
                  {isRegister ? 'Tạo tài khoản để trải nghiệm dịch vụ lắp ráp PC' : 'Chào mừng quay lại! Vui lòng đăng nhập để tiếp tục.'}
                </p>
              </div>

              {/* Tabs Switcher */}
              <div style={{ 
                display: 'flex', 
                borderRadius: '12px', 
                backgroundColor: '#f1f5f9', 
                border: '1px solid #e2e8f0',
                padding: '4px',
                marginBottom: '1.75rem'
              }}>
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setError(null); }}
                  style={{
                    flex: 1, padding: '0.6rem',
                    backgroundColor: !isRegister ? '#2563eb' : 'transparent',
                    border: 'none', borderRadius: '9px',
                    color: !isRegister ? '#ffffff' : '#64748b',
                    fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: !isRegister ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none',
                    fontFamily: 'var(--font-sans)'
                  }}
                >
                  Đăng Nhập
                </button>
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setError(null); }}
                  style={{
                    flex: 1, padding: '0.6rem',
                    backgroundColor: isRegister ? '#2563eb' : 'transparent',
                    border: 'none', borderRadius: '9px',
                    color: isRegister ? '#ffffff' : '#64748b',
                    fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: isRegister ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none',
                    fontFamily: 'var(--font-sans)'
                  }}
                >
                  Đăng Ký Khách Hàng
                </button>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  backgroundColor: '#fff1f2', border: '1px solid #fecdd3',
                  borderRadius: '10px', padding: '0.75rem 1rem',
                  color: '#be123c', fontSize: '0.85rem', marginBottom: '1.25rem', fontWeight: 600
                }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {!isRegister ? (
                  /* LOGIN FORM */
                  <>
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label htmlFor="username" style={{ color: '#374151', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem', display: 'block' }}>
                        Email hoặc Tên đăng nhập
                      </label>
                      <div style={{ position: 'relative' }}>
                        <UserIcon size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          id="username" type="text" className="input-field"
                          placeholder="Nhập tên đăng nhập..."
                          value={username} onChange={(e) => setUsername(e.target.value)}
                          style={{ paddingLeft: '2.5rem', height: '46px', fontSize: '0.9rem', backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#0f172a', borderRadius: '12px', width: '100%', boxSizing: 'border-box' }}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.75rem' }}>
                      <label htmlFor="password" style={{ color: '#374151', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem', display: 'block' }}>
                        Mật khẩu
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Key size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          id="password" type="password" className="input-field"
                          placeholder="Nhập mật khẩu..."
                          value={password} onChange={(e) => setPassword(e.target.value)}
                          style={{ paddingLeft: '2.5rem', height: '46px', fontSize: '0.9rem', backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#0f172a', borderRadius: '12px', width: '100%', boxSizing: 'border-box' }}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      style={{ 
                        width: '100%', padding: '0.75rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        fontSize: '0.95rem', fontWeight: 700, height: '48px',
                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        color: '#ffffff', borderRadius: '12px',
                        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.35)',
                        border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-sans)'
                      }}
                      disabled={loading}
                    >
                      <LogIn size={18} />
                      {loading ? 'Đang xác thực...' : 'Đăng Nhập'}
                    </button>
                  </>
                ) : (
                  /* REGISTER FORM */
                  <>
                    <div style={{ marginBottom: '1rem' }}>
                      <label htmlFor="regUsername" style={{ color: '#374151', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem', display: 'block' }}>Tên đăng nhập *</label>
                      <input
                        id="regUsername" type="text" className="input-field"
                        placeholder="vd: nguyenvana (viết liền không dấu)"
                        value={regUsername} onChange={(e) => setRegUsername(e.target.value)}
                        style={{ height: '42px', fontSize: '0.875rem', backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#0f172a', borderRadius: '12px', width: '100%', boxSizing: 'border-box' }}
                        pattern="^[a-zA-Z0-9_]{3,30}$"
                        title="3-30 ký tự, chỉ gồm chữ, số và dấu gạch dưới"
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label htmlFor="regName" style={{ color: '#374151', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem', display: 'block' }}>Họ và Tên *</label>
                        <input
                          id="regName" type="text" className="input-field"
                          placeholder="Nguyễn Văn A..."
                          value={name} onChange={(e) => setName(e.target.value)}
                          style={{ height: '42px', fontSize: '0.875rem', backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#0f172a', borderRadius: '12px', width: '100%', boxSizing: 'border-box' }}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="regEmail" style={{ color: '#374151', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem', display: 'block' }}>Email *</label>
                        <input
                          id="regEmail" type="email" className="input-field"
                          placeholder="name@example.com"
                          value={email} onChange={(e) => setEmail(e.target.value)}
                          style={{ height: '42px', fontSize: '0.875rem', backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#0f172a', borderRadius: '12px', width: '100%', boxSizing: 'border-box' }}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <label htmlFor="regPassword" style={{ color: '#374151', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem', display: 'block' }}>Mật khẩu *</label>
                        <input
                          id="regPassword" type="password" className="input-field"
                          placeholder="Tối thiểu 6 ký tự"
                          value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)}
                          style={{ height: '42px', fontSize: '0.875rem', backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#0f172a', borderRadius: '12px', width: '100%', boxSizing: 'border-box' }}
                          minLength={6} required
                        />
                      </div>
                      <div>
                        <label htmlFor="regPhone" style={{ color: '#374151', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem', display: 'block' }}>Số điện thoại *</label>
                        <input
                          id="regPhone" type="tel" className="input-field"
                          placeholder="09xxxxxxxx"
                          value={phone} onChange={(e) => setPhone(e.target.value)}
                          style={{ height: '42px', fontSize: '0.875rem', backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#0f172a', borderRadius: '12px', width: '100%', boxSizing: 'border-box' }}
                          pattern="^0[3|5|7|8|9]\d{8}$"
                          title="Vui lòng nhập 10 chữ số bắt đầu bằng số 0 (Ví dụ: 0912345678)"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      style={{ 
                        width: '100%', padding: '0.75rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        fontSize: '0.95rem', fontWeight: 700, height: '48px',
                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        color: '#ffffff', borderRadius: '12px',
                        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.35)',
                        border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-sans)'
                      }}
                      disabled={loading}
                    >
                      <UserPlus size={18} />
                      {loading ? 'Đang khởi tạo...' : 'Đăng Ký Khách Hàng'}
                    </button>
                  </>
                )}
              </form>
            </div>

            {/* ── RIGHT COLUMN: Chỉ hiện ở Register mode ── */}
            {isRegister && (
              <div style={{ 
                flex: '0 0 340px',
                background: 'linear-gradient(160deg, #eff6ff 0%, #dbeafe 100%)',
                borderLeft: '1px solid #bfdbfe',
                padding: '3rem 2.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '2rem',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Decorative circles */}
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '220px', height: '220px', borderRadius: '50%', backgroundColor: 'rgba(37,99,235,0.06)' }} />
                <div style={{ position: 'absolute', bottom: '-70px', left: '-40px', width: '260px', height: '260px', borderRadius: '50%', backgroundColor: 'rgba(37,99,235,0.04)' }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e3a8a', margin: '0 0 0.6rem', letterSpacing: '-0.02em', fontFamily: 'var(--font-title)' }}>
                    Quyền Lợi Thành Viên
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#475569', margin: 0, lineHeight: 1.6 }}>
                    Đăng ký tài khoản để trải nghiệm dịch vụ lắp ráp PC chuyên nghiệp và theo dõi đơn hàng tức thì.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
                  {[
                    {
                      icon: <LogIn size={20} />,
                      bg: '#dbeafe',
                      color: '#2563eb',
                      title: 'Theo Dõi Đơn Hàng Realtime',
                      desc: 'Theo dõi sát sao lộ trình từ lúc duyệt linh kiện đến khi đóng gói xuất xưởng.'
                    },
                    {
                      icon: <ShieldAlert size={20} />,
                      bg: '#dcfce7',
                      color: '#16a34a',
                      title: 'Bảo Hành Định Danh S/N',
                      desc: '100% linh kiện máy tính được quản lý và bảo hành theo mã Serial Number chính hãng.'
                    },
                    {
                      icon: <UserPlus size={20} />,
                      bg: '#fef3c7',
                      color: '#d97706',
                      title: 'Tích Điểm VIP & Ưu Đãi',
                      desc: 'Tự động tích lũy điểm thưởng giao dịch và nhận voucher bảo trì vệ sinh PC định kỳ.'
                    }
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <div style={{ padding: '0.6rem', backgroundColor: item.bg, borderRadius: '12px', color: item.color, display: 'flex', alignItems: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
                        {item.icon}
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: '#0f172a', display: 'block', marginBottom: '4px', fontWeight: 700 }}>{item.title}</strong>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5, display: 'block' }}>{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
