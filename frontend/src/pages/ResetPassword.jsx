import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, KeyRound, LogIn, ShieldCheck, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { AuthTopBar, PasswordInput, PasswordStrength } from '../components/Auth/AuthParts';

// Trang mở từ nút "Xác Nhận Đổi Mật Khẩu" trong email: /reset-password?token=...
export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [status, setStatus] = useState(token ? 'checking' : 'invalid'); // checking | ready | invalid | done
  const [account, setAccount] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(token ? null : 'Liên kết đặt lại mật khẩu không hợp lệ.');
  const [fieldErr, setFieldErr] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    api.get(`/auth/reset-password/verify?token=${encodeURIComponent(token)}`)
      .then(res => { if (active) { setAccount(res); setStatus('ready'); } })
      .catch(err => { if (active) { setError(err.message || 'Liên kết đặt lại mật khẩu không hợp lệ.'); setStatus('invalid'); } });
    return () => { active = false; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const errs = {};
    if (password.length < 6) errs.password = 'Mật khẩu cần ít nhất 6 ký tự.';
    if (!confirm) errs.confirm = 'Vui lòng nhập lại mật khẩu.';
    else if (confirm !== password) errs.confirm = 'Mật khẩu nhập lại không khớp.';
    setFieldErr(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setStatus('done');
    } catch (err) {
      setError(err.message || 'Không đặt lại được mật khẩu. Vui lòng thử lại.');
      if (err.status === 400 && !/ký tự/.test(err.message || '')) setStatus('invalid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sf-auth">
      <AuthTopBar />
      <div className="sf-auth-wrap">
        <div className="sf-auth-card sf-auth-card-single">
          <div className="sf-auth-form">
            {status === 'checking' && (
              <div className="sf-auth-sent">
                <span className="sf-auth-icon"><Loader2 size={26} className="sf-spin" /></span>
                <h1>Đang kiểm tra liên kết…</h1>
                <p className="sub">Vui lòng chờ trong giây lát.</p>
              </div>
            )}

            {status === 'invalid' && (
              <div className="sf-auth-sent">
                <span className="sf-auth-icon is-bad"><AlertTriangle size={26} /></span>
                <h1>Liên kết không còn hiệu lực</h1>
                <p className="sub">{error}</p>
                <Link to="/login?mode=forgot" className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block sf-btn-solid">
                  <KeyRound size={17} /> Gửi lại yêu cầu đặt lại mật khẩu
                </Link>
                <div className="sf-auth-switch"><Link to="/login" className="sf-link">Quay lại đăng nhập</Link></div>
              </div>
            )}

            {status === 'ready' && (
              <>
                <span className="sf-auth-icon"><ShieldCheck size={26} /></span>
                <h1>Đặt lại mật khẩu</h1>
                <p className="sub">
                  Tạo mật khẩu mới cho tài khoản <b>{account?.email}</b>. Nên dùng ít nhất 10 ký tự, kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt.
                </p>
                {error && (
                  <div className="sf-auth-error" role="alert"><AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} /><span>{error}</span></div>
                )}
                <form onSubmit={handleSubmit} noValidate>
                  <div className="sf-field">
                    <label htmlFor="newPassword">Mật khẩu mới</label>
                    <PasswordInput id="newPassword" value={password} invalid={!!fieldErr.password}
                      onChange={e => { setPassword(e.target.value); setFieldErr(f => ({ ...f, password: undefined })); }} />
                    {fieldErr.password && <div className="sf-field-err">{fieldErr.password}</div>}
                    <PasswordStrength value={password} />
                  </div>
                  <div className="sf-field">
                    <label htmlFor="confirmPassword">Nhập lại mật khẩu mới</label>
                    <PasswordInput id="confirmPassword" value={confirm} invalid={!!fieldErr.confirm}
                      onChange={e => { setConfirm(e.target.value); setFieldErr(f => ({ ...f, confirm: undefined })); }} />
                    {fieldErr.confirm && <div className="sf-field-err">{fieldErr.confirm}</div>}
                  </div>
                  <button type="submit" className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block sf-btn-solid" disabled={loading}>
                    <KeyRound size={17} /> {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                  </button>
                </form>
              </>
            )}

            {status === 'done' && (
              <div className="sf-auth-sent">
                <span className="sf-auth-icon is-ok"><CheckCircle2 size={28} /></span>
                <h1>Đổi mật khẩu thành công</h1>
                <p className="sub">Mật khẩu của bạn đã được cập nhật. Hãy đăng nhập lại bằng mật khẩu mới.</p>
                <button type="button" className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block sf-btn-solid"
                  onClick={() => navigate('/login', { replace: true, state: { notice: 'Mật khẩu đã được đặt lại. Vui lòng đăng nhập bằng mật khẩu mới.' } })}>
                  <LogIn size={17} /> Đăng nhập ngay
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
