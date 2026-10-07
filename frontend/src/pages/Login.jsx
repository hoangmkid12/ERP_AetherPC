import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notify } from '../context/NotificationContext';
import {
  LogIn, Key, User as UserIcon, AlertTriangle, UserPlus, ArrowLeft, Mail, Phone,
  Eye, EyeOff, PackageSearch, ShieldCheck, Award, Truck, Contact
} from 'lucide-react';
import useCatalog from '../components/Storefront/useCatalog';
import { SHOP, isInStock, discountOf } from '../components/Storefront/catalog';

// Quyền lợi mô tả đúng chức năng hệ thống đang có
const PERKS = [
  { icon: PackageSearch, title: 'Theo dõi đơn hàng trực tuyến', desc: 'Xem trạng thái đơn và vị trí người giao hàng ngay trên website.' },
  { icon: ShieldCheck, title: 'Bảo hành theo số Serial', desc: 'Mỗi linh kiện được ghi nhận Serial khi xuất kho để tra cứu bảo hành.' },
  { icon: Award, title: 'Tích điểm hạng thành viên', desc: 'Điểm cộng sau mỗi đơn, lên hạng để được giảm thêm khi thanh toán.' },
  { icon: Truck, title: 'Miễn phí giao hàng toàn quốc', desc: 'Áp dụng cho mọi đơn hàng, thanh toán khi nhận hoặc VietQR.' },
];

// Trang đích sau khi đăng nhập theo vai trò (khách hàng về trang chủ)
const EMPLOYEE_HOME = {
  CEO: '/admin/dashboard', SALES: '/admin/sales', SALES_MANAGER: '/admin/sales', WAREHOUSE: '/admin/warehouse',
  WAREHOUSE_MANAGER: '/admin/warehouse', ASSEMBLY: '/admin/assembly', HR: '/admin/hr', ACCOUNTANT: '/admin/accounting',
  PURCHASING: '/admin/purchasing', QC: '/admin/quality-control', QA: '/admin/quality-control', ADMIN: '/admin/system',
  CSKH: '/admin/cskh', DELIVERY: '/admin/delivery', SUPPLIER: '/supplier/portal',
};

function PasswordInput({ id, value, onChange, placeholder, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <div className="sf-input">
      <Key size={17} className="ic" />
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder}
        minLength={minLength} required autoComplete={id === 'password' ? 'current-password' : 'new-password'} />
      <button type="button" className="eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);

  // Đăng nhập
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Đăng ký
  const [name, setName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [email, setEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [phone, setPhone] = useState('');

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { products } = useCatalog();

  // Ảnh sản phẩm thật đang bán (không dùng ảnh minh họa)
  const showcase = useMemo(() => products
    .filter(p => p.image && isInStock(p) && p.price > 5000000)
    .sort((a, b) => discountOf(b) - discountOf(a))
    .slice(0, 4), [products]);

  const switchMode = (reg) => { setIsRegister(reg); setError(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegister) {
        const usernameTrim = regUsername.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,30}$/.test(usernameTrim)) {
          setError('Tên đăng nhập phải từ 3-30 ký tự, chỉ gồm chữ thường, số và dấu gạch dưới');
          return;
        }
        const emailTrim = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
          setError('Email không đúng định dạng. Vui lòng nhập dạng name@example.com');
          return;
        }
        if (registerPassword.length < 6) {
          setError('Mật khẩu phải chứa ít nhất 6 ký tự');
          return;
        }
        const phoneTrim = phone.trim();
        if (!phoneTrim) {
          setError('Vui lòng nhập Số điện thoại liên hệ');
          return;
        }
        if (!/^0[3|5|7|8|9]\d{8}$/.test(phoneTrim)) {
          setError('Số điện thoại không hợp lệ. Phải bao gồm 10 chữ số đầu số Việt Nam (VD: 0912345678)');
          return;
        }
        setLoading(true);
        await register({ username: usernameTrim, email: emailTrim, password: registerPassword, name: name.trim(), phone: phoneTrim });
        notify('Đăng ký tài khoản khách hàng thành công!', 'success');
        navigate('/');
      } else {
        setLoading(true);
        const loggedUser = await login(username, password);
        navigate(EMPLOYEE_HOME[loggedUser.role] || '/');
      }
    } catch (err) {
      setError(err.message || 'Thao tác thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sf-auth">
      <div className="sf-auth-bar">
        <div className="sf-container">
          <Link to="/" className="sf-logo" aria-label="AetherPC - Trang chủ">
            <img src="/favicon.svg?v=red" alt="" width="38" height="38" style={{ borderRadius: 10, boxShadow: '0 0 0 2px rgba(255,255,255,.85)' }} />
            <span className="t">AetherPC<small>PC &amp; GAMING GEAR</small></span>
          </Link>
          <span className="hotline"><Phone size={15} /> Hỗ trợ: <b>{SHOP.hotline}</b></span>
          <Link to="/" className="back"><ArrowLeft size={16} /> Tiếp tục mua sắm</Link>
        </div>
      </div>

      <div className="sf-auth-wrap">
        <div className="sf-auth-card">
          <aside className="sf-auth-side">
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#ffe08a' }}>Thành viên AetherPC</span>
            <h2>{isRegister ? 'Tạo tài khoản, nhận ưu đãi thành viên' : 'Chào mừng bạn quay lại'}</h2>
            <p>Một tài khoản để mua linh kiện, build PC, theo dõi đơn hàng và gửi yêu cầu đổi trả.</p>
            <div className="sf-auth-perks">
              {PERKS.map(pk => (
                <div key={pk.title} className="sf-auth-perk">
                  <span className="ic"><pk.icon size={19} /></span>
                  <div><b>{pk.title}</b><span>{pk.desc}</span></div>
                </div>
              ))}
            </div>
            {showcase.length > 0 && (
              <div className="sf-auth-imgs">
                {showcase.map(p => <span key={p.id} title={p.name}><img src={p.image} alt="" /></span>)}
              </div>
            )}
          </aside>

          <div className="sf-auth-form">
            <div className="sf-auth-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={!isRegister} className={!isRegister ? 'is-on' : ''} onClick={() => switchMode(false)}>Đăng nhập</button>
              <button type="button" role="tab" aria-selected={isRegister} className={isRegister ? 'is-on' : ''} onClick={() => switchMode(true)}>Đăng ký</button>
            </div>

            <h1>{isRegister ? 'Đăng ký tài khoản' : 'Đăng nhập'}</h1>
            <p className="sub">{isRegister ? 'Điền thông tin bên dưới để tạo tài khoản khách hàng.' : 'Dùng tên đăng nhập hoặc email đã đăng ký.'}</p>

            {error && (
              <div className="sf-auth-error" role="alert"><AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} /><span>{error}</span></div>
            )}

            <form onSubmit={handleSubmit} noValidate={isRegister}>
              {!isRegister ? (
                <>
                  <div className="sf-field">
                    <label htmlFor="username">Tên đăng nhập hoặc email</label>
                    <div className="sf-input">
                      <UserIcon size={17} className="ic" />
                      <input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)}
                        placeholder="Nhập tên đăng nhập hoặc email" autoComplete="username" required />
                    </div>
                  </div>
                  <div className="sf-field">
                    <label htmlFor="password">Mật khẩu</label>
                    <PasswordInput id="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nhập mật khẩu" />
                  </div>
                  <button type="submit" className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block" disabled={loading} style={{ marginTop: 6 }}>
                    <LogIn size={18} /> {loading ? 'Đang xác thực...' : 'Đăng nhập'}
                  </button>
                  <div className="sf-auth-switch">Chưa có tài khoản? <button type="button" onClick={() => switchMode(true)}>Đăng ký ngay</button></div>
                </>
              ) : (
                <>
                  <div className="sf-field-grid">
                    <div className="sf-field">
                      <label htmlFor="regName">Họ và tên</label>
                      <div className="sf-input">
                        <Contact size={17} className="ic" />
                        <input id="regName" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" required />
                      </div>
                    </div>
                    <div className="sf-field">
                      <label htmlFor="regUsername">Tên đăng nhập</label>
                      <div className="sf-input">
                        <UserIcon size={17} className="ic" />
                        <input id="regUsername" type="text" value={regUsername} onChange={e => setRegUsername(e.target.value)} placeholder="vd: nguyenvana" autoComplete="username" required />
                      </div>
                    </div>
                  </div>
                  <div className="sf-field-grid">
                    <div className="sf-field">
                      <label htmlFor="regEmail">Email</label>
                      <div className="sf-input">
                        <Mail size={17} className="ic" />
                        <input id="regEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" required />
                      </div>
                    </div>
                    <div className="sf-field">
                      <label htmlFor="regPhone">Số điện thoại</label>
                      <div className="sf-input">
                        <Phone size={17} className="ic" />
                        <input id="regPhone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xxxxxxxx" autoComplete="tel" required />
                      </div>
                    </div>
                  </div>
                  <div className="sf-field">
                    <label htmlFor="regPassword">Mật khẩu</label>
                    <PasswordInput id="regPassword" value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" minLength={6} />
                  </div>
                  <button type="submit" className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block" disabled={loading} style={{ marginTop: 6 }}>
                    <UserPlus size={18} /> {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
                  </button>
                  <div className="sf-auth-switch">Đã có tài khoản? <button type="button" onClick={() => switchMode(false)}>Đăng nhập</button></div>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
