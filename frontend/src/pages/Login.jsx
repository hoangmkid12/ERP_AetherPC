import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notify } from '../context/NotificationContext';
import { api } from '../services/api';
import {
  LogIn, User as UserIcon, AlertTriangle, UserPlus, ArrowLeft, Mail, Phone,
  PackageSearch, ShieldCheck, Award, Truck, Contact, CheckCircle2, Send, MailCheck, KeyRound, Lock, Headphones
} from 'lucide-react';
import {
  AuthTopBar, PasswordInput, PasswordStrength, GoogleSignInButton, AuthDivider
} from '../components/Auth/AuthParts';
import { SHOP } from '../components/Storefront/catalog';

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
  PURCHASING: '/admin/purchasing', QC: '/admin/quality-control', QA: '/admin/quality-control',
  QUALITY_CONTROL: '/admin/quality-control', ADMIN: '/admin/system', CSKH: '/admin/cskh', DELIVERY: '/admin/delivery',
  EMPLOYEE: '/admin/me', SUPPLIER: '/supplier/portal',
};

// Chỉ ghi nhớ tên đăng nhập trên máy (mật khẩu do trình duyệt tự lưu qua autocomplete),
// còn phiên dài 30 ngày do cookie HTTP-Only phía máy chủ đảm nhận.
const REMEMBER_KEY = 'aether_remember_login';
const readRemembered = () => {
  try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; }
};
const writeRemembered = (identifier) => {
  try {
    if (identifier) localStorage.setItem(REMEMBER_KEY, identifier);
    else localStorage.removeItem(REMEMBER_KEY);
  } catch { /* trình duyệt chặn lưu trữ — bỏ qua */ }
};

// Credential Management API (Chrome/Edge): báo trình duyệt lưu mật khẩu vào trình quản lý
// mật khẩu của nó và lấy lại để tự điền. Đăng nhập kiểu SPA (fetch, không tải lại trang)
// khiến Chrome thường không tự nhận ra để lưu, nên phải gọi chủ động.
const canUseCredentials = () => typeof window !== 'undefined' && 'PasswordCredential' in window && !!navigator.credentials;
const storeBrowserCredential = async (id, password, name) => {
  if (!canUseCredentials()) return;
  try { await navigator.credentials.store(new window.PasswordCredential({ id, password, name: name || id })); } catch { /* người dùng từ chối lưu */ }
};

const EMAIL_RE =/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^0[35789]\d{8}$/;
const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const RESEND_SECONDS = 60;

const SIDE_TEXT = {
  login: { h: 'Chào mừng quay lại', p: 'Đăng nhập để theo dõi đơn hàng, quản lý bảo hành và nhận ưu đãi dành riêng cho thành viên.' },
  register: { h: 'Đăng ký nhận ưu đãi', p: 'Tạo tài khoản miễn phí để mua sắm linh kiện, tự build PC và nhận chính sách bảo hành chính hãng.' },
  forgot: { h: 'Khôi phục tài khoản', p: 'Chúng tôi sẽ gửi liên kết xác nhận tới email của bạn để tạo mật khẩu mới một cách an toàn.' },
};

function FieldError({ msg }) {
  return msg ? <div className="sf-field-err">{msg}</div> : null;
}

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, login, loginWithGoogle, register } = useAuth();

  const initialMode = new URLSearchParams(location.search).get('mode');
  const [mode, setMode] = useState(['register', 'forgot'].includes(initialMode) ? initialMode : 'login');

  // Đăng nhập
  const [username, setUsername] = useState(readRemembered);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => !!readRemembered());

  // Đăng ký
  const [reg, setReg] = useState({ name: '', username: '', email: '', phone: '', password: '', confirm: '' });
  const [agree, setAgree] = useState(false);
  const [regErrors, setRegErrors] = useState({});

  // Quên mật khẩu
  const [forgotEmail, setForgotEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const [error, setError] = useState(null);
  const [info, setInfo] = useState(location.state?.notice || null);
  const [loading, setLoading] = useState(false);

  // Đang còn phiên (đã "Ghi nhớ đăng nhập") thì không bắt đăng nhập lại.
  const [redirected, setRedirected] = useState(false);
  useEffect(() => {
    if (!authLoading && user && !redirected) {
      setRedirected(true);
      navigate(EMPLOYEE_HOME[user.role] || '/', { replace: true });
    }
  }, [authLoading, user, redirected, navigate]);

  // Đã ghi nhớ trên máy này → lấy tài khoản/mật khẩu đã lưu trong trình duyệt để điền sẵn.
  // Chỉ điền, không tự bấm đăng nhập; 'optional' để Chrome hiện bảng chọn tài khoản nếu có nhiều.
  useEffect(() => {
    if (!readRemembered() || !canUseCredentials()) return undefined;
    let active = true;
    navigator.credentials.get({ password: true, mediation: 'optional' })
      .then(cred => {
        if (active && cred?.type === 'password' && cred.password) {
          setUsername(cred.id);
          setPassword(cred.password);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setRegErrors({});
    if (next === 'forgot' && !forgotEmail && username.includes('@')) setForgotEmail(username.trim());
  };

  const setRegField = (key) => (e) => {
    const value = e.target.value;
    setReg(r => ({ ...r, [key]: value }));
    if (regErrors[key]) setRegErrors(errs => ({ ...errs, [key]: undefined }));
  };

  const goHome = (u) => navigate(EMPLOYEE_HOME[u.role] || '/');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Vui lòng nhập tên đăng nhập/email và mật khẩu.');
      return;
    }
    setLoading(true);
    try {
      const loggedUser = await login(username, password, { remember });
      writeRemembered(remember ? username.trim() : '');
      if (remember) await storeBrowserCredential(username.trim(), password, loggedUser.name);
      setRedirected(true);
      goHome(loggedUser);
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  const validateRegister = () => {
    const errs = {};
    const u = reg.username.trim().toLowerCase();
    if (!reg.name.trim()) errs.name = 'Vui lòng nhập họ và tên.';
    if (!u) errs.username = 'Vui lòng nhập tên đăng nhập.';
    else if (!USERNAME_RE.test(u)) errs.username = 'Từ 3–30 ký tự, chỉ gồm chữ thường, số và dấu gạch dưới.';
    if (!reg.email.trim()) errs.email = 'Vui lòng nhập email.';
    else if (!EMAIL_RE.test(reg.email.trim())) errs.email = 'Email không đúng định dạng.';
    if (!reg.phone.trim()) errs.phone = 'Vui lòng nhập số điện thoại.';
    else if (!PHONE_RE.test(reg.phone.trim())) errs.phone = 'Số điện thoại Việt Nam gồm 10 chữ số.';
    if (!reg.password) errs.password = 'Vui lòng nhập mật khẩu.';
    else if (reg.password.length < 6) errs.password = 'Mật khẩu cần ít nhất 6 ký tự.';
    if (!reg.confirm) errs.confirm = 'Vui lòng nhập lại mật khẩu.';
    else if (reg.confirm !== reg.password) errs.confirm = 'Mật khẩu nhập lại không khớp.';
    if (!agree) errs.agree = 'Bạn cần đồng ý với điều khoản để tiếp tục.';
    return errs;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    const errs = validateRegister();
    setRegErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      await register({
        username: reg.username.trim().toLowerCase(),
        email: reg.email.trim(),
        password: reg.password,
        name: reg.name.trim(),
        phone: reg.phone.trim(),
      });
      notify('Đăng ký tài khoản thành công! Chào mừng bạn đến với AetherPC.', 'success');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  const sendResetMail = async (email) => {
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSentTo(email);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err.message || 'Không gửi được yêu cầu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = (e) => {
    e.preventDefault();
    const email = forgotEmail.trim();
    if (!EMAIL_RE.test(email)) {
      setError('Vui lòng nhập địa chỉ email hợp lệ đã đăng ký tài khoản.');
      return;
    }
    sendResetMail(email);
  };

  const handleGoogle = async (credential) => {
    setError(null);
    setLoading(true);
    try {
      const u = await loginWithGoogle(credential, { remember: mode === 'login' ? remember : true });
      notify(u.isNew ? 'Tạo tài khoản bằng Google thành công! Chào mừng bạn.' : `Xin chào ${u.name || ''}!`, 'success');
      goHome(u);
    } catch (err) {
      setError(err.message || 'Đăng nhập Google thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const side = SIDE_TEXT[mode];
  const isForgot = mode === 'forgot';

  return (
    <div className="sf-auth">
      <AuthTopBar />

      <div className="sf-auth-wrap">
        <div className="sf-auth-card">
          <aside className="sf-auth-side">
            <span className="sf-auth-badge">Thành viên AetherPC</span>
            <h2>{side.h}</h2>
            <p>{side.p}</p>
            <div className="sf-auth-perks">
              {PERKS.map(pk => (
                <div key={pk.title} className="sf-auth-perk">
                  <span className="ic"><pk.icon size={20} /></span>
                  <div><b>{pk.title}</b><span>{pk.desc}</span></div>
                </div>
              ))}
            </div>
            <div className="sf-auth-side-foot">
              <div className="line" />
              <div className="row"><Lock size={15} /> Thông tin tài khoản được mã hóa và bảo mật tuyệt đối</div>
              <div className="row"><Headphones size={15} /> Cần hỗ trợ? Gọi <b>{SHOP.hotline}</b></div>
            </div>
          </aside>

          <div className="sf-auth-form">
            {!isForgot && (
              <div className="sf-auth-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-on' : ''} onClick={() => switchMode('login')}>Đăng nhập</button>
                <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'is-on' : ''} onClick={() => switchMode('register')}>Đăng ký</button>
              </div>
            )}

            {isForgot && (
              <button type="button" className="sf-auth-back" onClick={() => { switchMode('login'); setSentTo(''); }}>
                <ArrowLeft size={16} /> Quay lại đăng nhập
              </button>
            )}

            {mode === 'login' && <>
              <h1>Đăng nhập</h1>
              <p className="sub">Dùng tên đăng nhập hoặc email đã đăng ký.</p>
            </>}
            {mode === 'register' && <>
              <h1>Tạo tài khoản</h1>
              <p className="sub">Đăng ký miễn phí, chỉ mất 1 phút.</p>
            </>}
            {isForgot && !sentTo && <>
              <span className="sf-auth-icon"><KeyRound size={26} /></span>
              <h1>Quên mật khẩu?</h1>
              <p className="sub">Nhập email đã đăng ký tài khoản. Chúng tôi sẽ gửi cho bạn email xác nhận kèm liên kết đặt lại mật khẩu.</p>
            </>}

            {info && (
              <div className="sf-auth-info" role="status"><CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: 1 }} /><span>{info}</span></div>
            )}
            {error && (
              <div className="sf-auth-error" role="alert"><AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} /><span>{error}</span></div>
            )}

            {mode === 'login' && (
              <form onSubmit={handleLogin} noValidate>
                <div className="sf-field">
                  <label htmlFor="username">Tên đăng nhập hoặc email</label>
                  <div className="sf-input">
                    <UserIcon size={17} className="ic" />
                    <input id="username" name="username" type="text" value={username} onChange={e => setUsername(e.target.value)}
                      placeholder="Nhập tên đăng nhập hoặc email" autoComplete="username" />
                  </div>
                </div>
                <div className="sf-field">
                  <label htmlFor="password">Mật khẩu</label>
                  <PasswordInput id="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu" autoComplete="current-password" />
                </div>

                <div className="sf-auth-row">
                  <label className="sf-check">
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                    <span>Ghi nhớ đăng nhập</span>
                  </label>
                  <button type="button" className="sf-link" onClick={() => switchMode('forgot')}>Quên mật khẩu?</button>
                </div>

                <button type="submit" className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block sf-btn-solid" disabled={loading}>
                  <LogIn size={18} /> {loading ? 'Đang xác thực...' : 'Đăng nhập'}
                </button>

                <AuthDivider>hoặc đăng nhập với</AuthDivider>
                <GoogleSignInButton onCredential={handleGoogle} onError={setError} disabled={loading} />

                <div className="sf-auth-switch">Chưa có tài khoản? <button type="button" onClick={() => switchMode('register')}>Đăng ký ngay</button></div>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} noValidate>
                <GoogleSignInButton text="signup_with" onCredential={handleGoogle} onError={setError} disabled={loading} />
                <AuthDivider>hoặc đăng ký bằng email</AuthDivider>

                <div className="sf-field-grid">
                  <div className="sf-field">
                    <label htmlFor="regName">Họ và tên</label>
                    <div className={`sf-input${regErrors.name ? ' is-invalid' : ''}`}>
                      <Contact size={17} className="ic" />
                      <input id="regName" type="text" value={reg.name} onChange={setRegField('name')} autoComplete="name" aria-invalid={!!regErrors.name || undefined} />
                    </div>
                    <FieldError msg={regErrors.name} />
                  </div>
                  <div className="sf-field">
                    <label htmlFor="regUsername">Tên đăng nhập</label>
                    <div className={`sf-input${regErrors.username ? ' is-invalid' : ''}`}>
                      <UserIcon size={17} className="ic" />
                      <input id="regUsername" type="text" value={reg.username} onChange={setRegField('username')} autoComplete="username" aria-invalid={!!regErrors.username || undefined} />
                    </div>
                    <FieldError msg={regErrors.username} />
                  </div>
                </div>
                <div className="sf-field-grid">
                  <div className="sf-field">
                    <label htmlFor="regEmail">Email</label>
                    <div className={`sf-input${regErrors.email ? ' is-invalid' : ''}`}>
                      <Mail size={17} className="ic" />
                      <input id="regEmail" type="email" value={reg.email} onChange={setRegField('email')} autoComplete="email" aria-invalid={!!regErrors.email || undefined} />
                    </div>
                    <FieldError msg={regErrors.email} />
                  </div>
                  <div className="sf-field">
                    <label htmlFor="regPhone">Số điện thoại</label>
                    <div className={`sf-input${regErrors.phone ? ' is-invalid' : ''}`}>
                      <Phone size={17} className="ic" />
                      <input id="regPhone" type="tel" inputMode="numeric" maxLength={10} value={reg.phone} onChange={setRegField('phone')} autoComplete="tel" aria-invalid={!!regErrors.phone || undefined} />
                    </div>
                    <FieldError msg={regErrors.phone} />
                  </div>
                </div>
                <div className="sf-field-grid">
                  <div className="sf-field">
                    <label htmlFor="regPassword">Mật khẩu</label>
                    <PasswordInput id="regPassword" value={reg.password} onChange={setRegField('password')} invalid={!!regErrors.password} />
                    <FieldError msg={regErrors.password} />
                  </div>
                  <div className="sf-field">
                    <label htmlFor="regConfirm">Nhập lại mật khẩu</label>
                    <PasswordInput id="regConfirm" value={reg.confirm} onChange={setRegField('confirm')} invalid={!!regErrors.confirm} />
                    <FieldError msg={regErrors.confirm} />
                  </div>
                </div>
                <PasswordStrength value={reg.password} />

                <label className="sf-check sf-check-terms">
                  <input type="checkbox" checked={agree} onChange={e => { setAgree(e.target.checked); setRegErrors(x => ({ ...x, agree: undefined })); }} />
                  <span>Tôi đồng ý với <a href="/about" target="_blank" rel="noreferrer">Điều khoản</a> &amp; <a href="/about" target="_blank" rel="noreferrer">Chính sách bảo mật</a></span>
                </label>
                <FieldError msg={regErrors.agree} />

                <button type="submit" className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block sf-btn-solid" disabled={loading}>
                  <UserPlus size={18} /> {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
                </button>
                <div className="sf-auth-switch">Đã có tài khoản? <button type="button" onClick={() => switchMode('login')}>Đăng nhập</button></div>
              </form>
            )}

            {isForgot && !sentTo && (
              <form onSubmit={handleForgot} noValidate>
                <div className="sf-field">
                  <label htmlFor="forgotEmail">Email tài khoản</label>
                  <div className="sf-input">
                    <Mail size={17} className="ic" />
                    <input id="forgotEmail" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      placeholder="Nhập email đã đăng ký" autoComplete="email" autoFocus />
                  </div>
                </div>
                <button type="submit" className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block sf-btn-solid" disabled={loading}>
                  <Send size={17} /> {loading ? 'Đang gửi...' : 'Gửi email xác nhận'}
                </button>
              </form>
            )}

            {isForgot && sentTo && (
              <div className="sf-auth-sent">
                <span className="sf-auth-icon is-ok"><MailCheck size={28} /></span>
                <h1>Kiểm tra hộp thư của bạn</h1>
                <p className="sub">
                  Nếu <b>{sentTo}</b> đã đăng ký tài khoản, chúng tôi vừa gửi một email xác nhận.
                  Nhấn nút <b>“Xác Nhận Đổi Mật Khẩu”</b> trong email để đặt mật khẩu mới. Liên kết có hiệu lực trong 30 phút.
                </p>
                <ul className="sf-auth-tips">
                  <li>Không thấy email? Hãy kiểm tra mục <b>Spam</b> hoặc <b>Quảng cáo</b>.</li>
                  <li>Liên kết chỉ dùng được một lần — đổi mật khẩu xong, các liên kết cũ sẽ tự hết hiệu lực.</li>
                </ul>
                <button type="button" className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block" disabled={loading || cooldown > 0} onClick={() => sendResetMail(sentTo)}>
                  <Send size={17} /> {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : (loading ? 'Đang gửi...' : 'Gửi lại email')}
                </button>
                <div className="sf-auth-switch">Nhập sai email? <button type="button" onClick={() => { setSentTo(''); setError(null); }}>Dùng email khác</button></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
