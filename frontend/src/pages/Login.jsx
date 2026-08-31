import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  const [email, setEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegister) {
        // 1. Email format validation
        const emailTrim = email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTrim)) {
          setError('Email không đúng định dạng. Vui lòng nhập dạng name@example.com');
          return;
        }

        // 2. Password length validation
        if (registerPassword.length < 6) {
          setError('Mật khẩu phải chứa ít nhất 6 ký tự');
          return;
        }

        // 3. Vietnamese Phone number validation (10 digits starting with 0)
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
          email: emailTrim,
          password: registerPassword,
          name: name.trim(),
          phone: phoneTrim
        });
        alert('Đăng ký tài khoản khách hàng thành công!');
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
      backgroundColor: '#f8fafc',
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
      <div style={{ width: '100%', maxWidth: '980px', zIndex: 1 }}>
        
        {/* Clean Outer Card */}
        <div style={{ 
          backgroundColor: '#ffffff', 
          border: '1px solid #cbd5e1', 
          borderRadius: '24px', 
          overflow: 'hidden',
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.1)' 
        }}>
          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
            
            {/* ── LEFT COLUMN: Form ── */}
            <div style={{ flex: '1 1 420px', padding: '2.5rem', minWidth: '300px' }}>
              
              {/* Brand Center */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)' }}>
                    <ShieldAlert size={18} color="#fff" />
                  </div>
                  <span style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-title)', letterSpacing: '-0.02em' }}>AETHER PC ERP</span>
                </div>

                <h2 style={{
                  fontSize: '1.625rem',
                  fontFamily: 'var(--font-title)',
                  color: '#0f172a',
                  fontWeight: 800,
                  margin: '0.25rem 0'
                }}>
                  {isRegister ? 'Đăng Ký Khách Hàng' : 'Đăng Nhập Hệ Thống'}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                  Hệ thống ERP & Lắp ráp PC Thông minh
                </p>
              </div>

              {/* Tabs Switcher */}
              <div style={{ 
                display: 'flex', 
                borderRadius: '10px', 
                backgroundColor: '#f1f5f9', 
                border: '1px solid #cbd5e1',
                padding: '4px',
                marginBottom: '1.5rem'
              }}>
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setError(null); }}
                  style={{
                    flex: 1,
                    padding: '0.55rem',
                    backgroundColor: !isRegister ? '#2563eb' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: !isRegister ? '#ffffff' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: !isRegister ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
                    fontFamily: 'var(--font-sans)'
                  }}
                >
                  Đăng Nhập
                </button>
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setError(null); }}
                  style={{
                    flex: 1,
                    padding: '0.55rem',
                    backgroundColor: isRegister ? '#2563eb' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: isRegister ? '#ffffff' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: isRegister ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
                    fontFamily: 'var(--font-sans)'
                  }}
                >
                  Đăng Ký Khách Hàng
                </button>
              </div>

              {error && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: '#ffe4e6',
                  border: '1px solid #fecdd3',
                  borderRadius: '10px',
                  padding: '0.625rem 0.875rem',
                  color: '#be123c',
                  fontSize: '0.85rem',
                  marginBottom: '1.25rem',
                  fontWeight: 600
                }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {!isRegister ? (
                  /* LOGIN FORM */
                  <>
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                      <label className="form-label" htmlFor="username" style={{ color: '#334155', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.35rem', display: 'block' }}>
                        Email hoặc Tên đăng nhập
                      </label>
                      <div style={{ position: 'relative' }}>
                        <UserIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                          id="username"
                          type="text"
                          className="input-field"
                          placeholder="Nhập tên đăng nhập..."
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          style={{ paddingLeft: '2.4rem', height: '42px', fontSize: '0.875rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '10px' }}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.75rem' }}>
                      <label className="form-label" htmlFor="password" style={{ color: '#334155', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.35rem', display: 'block' }}>
                        Mật khẩu
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                          id="password"
                          type="password"
                          className="input-field"
                          placeholder="Nhập mật khẩu..."
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          style={{ paddingLeft: '2.4rem', height: '42px', fontSize: '0.875rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '10px' }}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ 
                        width: '100%', 
                        padding: '0.625rem', 
                        gap: '0.5rem', 
                        fontSize: '0.95rem', 
                        fontWeight: 700, 
                        height: '44px',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        borderRadius: '10px',
                        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                        border: 'none'
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '0.875rem' }}>
                      <div className="form-group">
                        <label className="form-label" htmlFor="regName" style={{ color: '#334155', fontWeight: 700, fontSize: '0.85rem' }}>Họ và Tên *</label>
                        <input
                          id="regName"
                          type="text"
                          className="input-field"
                          placeholder="Nguyễn Văn A..."
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          style={{ height: '40px', fontSize: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '10px' }}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="regEmail" style={{ color: '#334155', fontWeight: 700, fontSize: '0.85rem' }}>Email *</label>
                        <input
                          id="regEmail"
                          type="email"
                          className="input-field"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          style={{ height: '40px', fontSize: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '10px' }}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '1.5rem' }}>
                      <div className="form-group">
                        <label className="form-label" htmlFor="regPassword" style={{ color: '#334155', fontWeight: 700, fontSize: '0.85rem' }}>Mật khẩu *</label>
                        <input
                          id="regPassword"
                          type="password"
                          className="input-field"
                          placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)..."
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          style={{ height: '40px', fontSize: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '10px' }}
                          minLength={6}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="regPhone" style={{ color: '#334155', fontWeight: 700, fontSize: '0.85rem' }}>Số điện thoại *</label>
                        <input
                          id="regPhone"
                          type="tel"
                          className="input-field"
                          placeholder="09xxxxxxxx"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          style={{ height: '40px', fontSize: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '10px' }}
                          pattern="^0[3|5|7|8|9]\d{8}$"
                          title="Vui lòng nhập 10 chữ số bắt đầu bằng số 0 (Ví dụ: 0912345678)"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ 
                        width: '100%', 
                        padding: '0.625rem', 
                        gap: '0.5rem', 
                        fontSize: '0.95rem', 
                        fontWeight: 700, 
                        height: '44px',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        borderRadius: '10px',
                        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                        border: 'none'
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

            {/* ── RIGHT COLUMN: Consistent 2-Column Side Panel ── */}
            {isRegister ? (
              /* Register Mode: Customer Member Benefits Panel */
              <div style={{ 
                flex: '1 1 440px', 
                padding: '2.5rem', 
                backgroundColor: '#eff6ff', 
                borderLeft: '1px solid #bfdbfe',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '1.5rem'
              }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                    Quyền Lợi Thành Viên AETHER PC
                  </h3>
                  <p style={{ fontSize: '0.825rem', color: '#475569', marginTop: '0.35rem', margin: 0, lineHeight: 1.45 }}>
                    Đăng ký tài khoản để trải nghiệm dịch vụ lắp ráp PC và theo dõi đơn hàng tức thì.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{ padding: '0.5rem', backgroundColor: '#ffffff', borderRadius: '10px', color: '#2563eb', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <LogIn size={18} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.875rem', color: '#0f172a', display: 'block', marginBottom: '2px', fontWeight: 700 }}>Theo Dõi Đơn Hàng Realtime</strong>
                      <span style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.4, display: 'block' }}>Theo dõi sát sao lộ trình từ lúc duyệt linh kiện đến khi đóng gói xuất xưởng.</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{ padding: '0.5rem', backgroundColor: '#ffffff', borderRadius: '10px', color: '#16a34a', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <ShieldAlert size={18} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.875rem', color: '#0f172a', display: 'block', marginBottom: '2px', fontWeight: 700 }}>Bảo Hành Định Danh S/N</strong>
                      <span style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.4, display: 'block' }}>100% linh kiện máy tính được quản lý và bảo hành theo mã Serial Number chính hãng.</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{ padding: '0.5rem', backgroundColor: '#ffffff', borderRadius: '10px', color: '#d97706', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <UserPlus size={18} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.875rem', color: '#0f172a', display: 'block', marginBottom: '2px', fontWeight: 700 }}>Tích Điểm VIP & Ưu Đãi</strong>
                      <span style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.4, display: 'block' }}>Tự động tích lũy điểm thưởng giao dịch và nhận voucher bảo trì vệ sinh PC định kỳ.</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Login Mode: Demo Roles Panel */
              <div style={{ 
                flex: '1 1 440px', 
                padding: '2.5rem', 
                backgroundColor: '#f8fafc', 
                borderLeft: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                {import.meta.env.DEV ? (
                  <>
                    <div style={{ marginBottom: '1.25rem' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                        Tài Khoản Demo Hệ Thống
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem', marginBottom: 0 }}>
                        Chọn vai trò để đăng nhập nhanh (Mật khẩu: <code style={{ color: '#2563eb', fontWeight: 700, backgroundColor: '#eff6ff', padding: '1px 6px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>123456</code>)
                      </p>
                    </div>

                    <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '4px 4px 4px 2px' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: '0.55rem',
                      padding: '0'
                    }}>
                      {DEMO_ACCOUNTS.map(demo => (
                        <button
                          key={demo.role}
                          onClick={() => fillCredentials(demo.role)}
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '10px',
                            padding: '0.65rem 0.85rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.15rem',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = '#eff6ff';
                            e.currentTarget.style.borderColor = '#2563eb';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = '#ffffff';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.transform = 'none';
                          }}
                        >
                          <strong style={{ fontSize: '0.85rem', color: '#0f172a', fontFamily: 'monospace', fontWeight: 700 }}>
                            {demo.role}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>
                            {demo.label}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #cbd5e1' }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Tài Khoản Nhà Cung Cấp</h4>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0.7rem' }}>
                        Mỗi tài khoản chỉ quản lý đơn hàng được gán cho đúng nhà cung cấp.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.55rem' }}>
                        {SUPPLIER_LOGIN_ACCOUNTS.map(demo => (
                          <button
                            key={demo.role}
                            onClick={() => fillCredentials(demo.role)}
                            style={{
                              backgroundColor: '#f8fafc',
                              border: '1px solid #bfdbfe',
                              borderRadius: '10px',
                              padding: '0.65rem 0.85rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.15rem',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = '#eff6ff';
                              e.currentTarget.style.borderColor = '#2563eb';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = '#f8fafc';
                              e.currentTarget.style.borderColor = '#bfdbfe';
                              e.currentTarget.style.transform = 'none';
                            }}
                          >
                            <strong style={{ fontSize: '0.85rem', color: '#0f172a', fontFamily: 'monospace', fontWeight: 700 }}>{demo.role}</strong>
                            <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>{demo.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                      Chào mừng trở lại
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.5rem' }}>
                      Vui lòng liên hệ quản trị viên nếu bạn cần được cấp tài khoản truy cập hệ thống.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
