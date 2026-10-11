import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Key, Eye, EyeOff, Phone, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api';
import { SHOP } from '../Storefront/catalog';

// Thanh đầu trang dùng chung cho trang Đăng nhập / Đặt lại mật khẩu
export function AuthTopBar() {
  return (
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
  );
}

export function PasswordInput({ id, name, value, onChange, placeholder, autoComplete = 'new-password', invalid }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`sf-input${invalid ? ' is-invalid' : ''}`}>
      <Key size={17} className="ic" />
      <input id={id} name={name || id} type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder}
        autoComplete={autoComplete} aria-invalid={invalid || undefined} />
      <button type="button" className="eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

// 0..4 — độ dài, chữ hoa/thường, số, ký tự đặc biệt
export const passwordScore = (pw) => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  else if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 0.5;
  return Math.min(4, Math.floor(score));
};

const STRENGTH = [
  { label: 'Quá ngắn', color: '#dc2626' },
  { label: 'Yếu', color: '#ea580c' },
  { label: 'Trung bình', color: '#ca8a04' },
  { label: 'Mạnh', color: '#16a34a' },
  { label: 'Rất mạnh', color: '#15803d' },
];

export function PasswordStrength({ value }) {
  if (!value) return null;
  const score = value.length < 6 ? 0 : Math.max(1, passwordScore(value));
  const { label, color } = STRENGTH[score];
  return (
    <div className="sf-pw-strength" aria-live="polite">
      <div className="bars">
        {[1, 2, 3, 4].map(i => <span key={i} style={{ background: i <= score ? color : undefined }} />)}
      </div>
      <span className="lbl" style={{ color }}>Độ mạnh: {label}</span>
    </div>
  );
}

// ---------- Đăng nhập với Google (Google Identity Services) ----------
const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiPromise = null;
const loadGsi = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = GSI_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => { gsiPromise = null; reject(new Error('Không tải được dịch vụ đăng nhập Google.')); };
      document.head.appendChild(s);
    });
  }
  return gsiPromise;
};

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/**
 * Nút Google chính thức do GIS vẽ. Khi máy chủ chưa cấu hình GOOGLE_CLIENT_ID (hoặc không tải được
 * script) thì hiện nút thay thế cùng giao diện, bấm vào báo lỗi rõ ràng thay vì im lặng.
 */
export function GoogleSignInButton({ onCredential, onError, text = 'signin_with', disabled }) {
  const wrapRef = useRef(null);
  const hostRef = useRef(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;
  const [state, setState] = useState('loading'); // loading | ready | unavailable
  const [reason, setReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await api.get('/auth/google/config');
        if (!cfg?.clientId) throw new Error('Đăng nhập Google chưa được cấu hình (thiếu GOOGLE_CLIENT_ID trên máy chủ).');
        await loadGsi();
        if (cancelled || !hostRef.current) return;
        window.google.accounts.id.initialize({
          client_id: cfg.clientId,
          callback: (resp) => resp?.credential && callbackRef.current?.(resp.credential),
          ux_mode: 'popup',
          context: text === 'signup_with' ? 'signup' : 'signin',
        });
        const width = Math.min(400, Math.max(240, Math.round(wrapRef.current?.getBoundingClientRect().width || 360)));
        hostRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(hostRef.current, {
          type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular',
          text, logo_alignment: 'center', locale: 'vi', width,
        });
        setState('ready');
      } catch (err) {
        if (!cancelled) { setState('unavailable'); setReason(err.message || 'Đăng nhập Google tạm thời không khả dụng.'); }
      }
    })();
    return () => { cancelled = true; };
  }, [text]);

  return (
    <div ref={wrapRef} className={`sf-google${disabled ? ' is-disabled' : ''}`}>
      <div ref={hostRef} className="sf-google-host" style={{ display: state === 'ready' ? 'flex' : 'none' }} />
      {state !== 'ready' && (
        <button type="button" className="sf-btn-google" disabled={state === 'loading'}
          onClick={() => onError?.(reason)}>
          <GoogleLogo /> {text === 'signup_with' ? 'Đăng ký với Google' : 'Đăng nhập với Google'}
        </button>
      )}
    </div>
  );
}

export function AuthDivider({ children = 'hoặc' }) {
  return <div className="sf-auth-divider"><span>{children}</span></div>;
}
