import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Award, Star, Gift, ShieldCheck, TrendingUp, LogIn, UserPlus, Info, Search, HelpCircle, ArrowLeft } from 'lucide-react';

// Khớp quy tắc ở máy chủ (order.controller.js): 10.000đ = 1 điểm; hạng theo tổng điểm
// (Bạc 1.000, Vàng 5.000, Bạch Kim 10.000); chiết khấu hạng trừ trực tiếp vào mỗi đơn.
const TIER_CONFIGS = {
  BRONZE: {
    label: 'Hạng Đồng (Bronze)',
    color: '#b45309',
    bgColor: 'rgba(180, 83, 9, 0.15)',
    glow: 'rgba(180, 83, 9, 0.3)',
    pointsRequired: 0,
    nextTier: 'SILVER',
    nextPoints: 1000,
    discount: 0,
    perks: ['Tích 1 điểm cho mỗi 10.000đ thanh toán', 'Nhận tin khuyến mãi sớm nhất']
  },
  SILVER: {
    label: 'Hạng Bạc (Silver)',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.15)',
    glow: 'rgba(148, 163, 184, 0.3)',
    pointsRequired: 1000,
    nextTier: 'GOLD',
    nextPoints: 5000,
    discount: 2,
    perks: ['Giảm 2% mọi đơn hàng', 'Tích 1 điểm cho mỗi 10.000đ thanh toán']
  },
  GOLD: {
    label: 'Hạng Vàng (Gold)',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    glow: 'rgba(245, 158, 11, 0.35)',
    pointsRequired: 5000,
    nextTier: 'PLATINUM',
    nextPoints: 10000,
    discount: 5,
    perks: ['Giảm 5% mọi đơn hàng', 'Tích 1 điểm cho mỗi 10.000đ thanh toán']
  },
  PLATINUM: {
    label: 'Hạng Bạch Kim (Platinum)',
    color: '#d946ef',
    bgColor: 'rgba(217, 70, 239, 0.15)',
    glow: 'rgba(217, 70, 239, 0.4)',
    pointsRequired: 10000,
    nextTier: null,
    nextPoints: null,
    discount: 10,
    perks: ['Giảm 10% mọi đơn hàng', 'Tích 1 điểm cho mỗi 10.000đ thanh toán']
  }
};

const formatNumber = (num) => new Intl.NumberFormat('vi-VN').format(num);

export default function MemberTier() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Search by phone mock tool (for non-logged in or testing)
  const [phoneSearch, setPhoneSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');

  // Interactive calculator fields
  const [calcAmount, setCalcAmount] = useState('');
  const [calcPoints, setCalcPoints] = useState(0);

  // Chỉ tra cứu được tài khoản đang đăng nhập — tra hạng/điểm của người khác bằng số điện thoại
  // sẽ làm lộ thông tin khách hàng. Số liệu lấy mới từ máy chủ.
  const handlePhoneSearch = async (e) => {
    e.preventDefault();
    setSearchError('');
    setSearchResult(null);

    const cleanSearch = phoneSearch.trim();
    if (!cleanSearch) {
      setSearchError('Vui lòng nhập số điện thoại hoặc email cần tra cứu.');
      return;
    }
    if (!user || user.role !== 'CUSTOMER') {
      setSearchError('Vui lòng đăng nhập tài khoản khách hàng để xem hạng thành viên và điểm tích lũy của bạn.');
      return;
    }
    const digits = (v) => String(v || '').replace(/[^0-9]/g, '');
    const isMine = (user.email && user.email.toLowerCase() === cleanSearch.toLowerCase()) ||
      (user.phone && digits(user.phone) === digits(cleanSearch));
    if (!isMine) {
      setSearchError('Vì bảo mật thông tin, bạn chỉ tra cứu được số điện thoại/email của tài khoản đang đăng nhập.');
      return;
    }
    let me = user;
    try {
      const res = await api.get('/auth/me');
      me = res?.user || res?.data || user;
    } catch (_) { /* dùng dữ liệu phiên hiện tại */ }
    setSearchResult({
      name: me.fullname || me.name || 'Khách hàng',
      phone: me.phone || cleanSearch,
      tier: (me.tier || 'BRONZE').toUpperCase(),
      loyaltyPoints: me.loyaltyPoints || 0
    });
  };

  const handleCalcChange = (val) => {
    setCalcAmount(val);
    const amount = parseFloat(val) || 0;
    // 10,000 VND spent = 1 point
    const points = Math.floor(amount / 10000);
    setCalcPoints(points);
  };

  // Determine user data or fallbacks
  const isCustomer = user && user.role === 'CUSTOMER';
  const currentTierKey = (isCustomer && user.tier ? user.tier.toUpperCase() : 'BRONZE');
  const currentPoints = (isCustomer ? user.loyaltyPoints || 0 : 0);
  const currentTierConfig = TIER_CONFIGS[currentTierKey] || TIER_CONFIGS.BRONZE;

  // Next tier progress computation
  const nextTierKey = currentTierConfig.nextTier;
  const nextTierConfig = nextTierKey ? TIER_CONFIGS[nextTierKey] : null;
  const pointsRequiredForNext = nextTierConfig ? nextTierConfig.pointsRequired : 0;
  const pointsRemaining = nextTierConfig ? Math.max(0, pointsRequiredForNext - currentPoints) : 0;
  const progressPercent = nextTierConfig 
    ? Math.min(100, Math.round((currentPoints / pointsRequiredForNext) * 100)) 
    : 100;

  return (
    <div style={{ paddingBottom: '5rem', paddingTop: '1.5rem' }}>
      <div className="container">
        
        {/* Back Link */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
            <ArrowLeft size={16} /> Quay lại trang chủ
          </Link>
        </div>

        {/* Page Title */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            background: 'rgba(37,99,235,0.1)',
            color: 'var(--accent)',
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '0.375rem 0.875rem',
            borderRadius: '99px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.875rem',
            border: '1px solid rgba(37,99,235,0.2)'
          }}>
            <Award size={14} /> Hệ thống khách hàng thân thiết
          </span>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
            Đặc Quyền Hạng <span className="gradient-text">Thành Viên</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '600px', margin: '0 auto' }}>
            Mua sắm tích lũy điểm để thăng hạng — hạng càng cao, mức giảm giá trừ trực tiếp vào mỗi đơn hàng càng lớn.
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION 1: USER STATUS (LOGGED IN vs GUEST)
        ════════════════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginBottom: '3.5rem', alignItems: 'stretch' }}>
          
          {/* Card Left: Current loyalty card or guest banner */}
          {isCustomer ? (
            <div className="card-glass" style={{
              position: 'relative',
              overflow: 'hidden',
              padding: '2.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: `1px solid ${currentTierConfig.color}44`,
              boxShadow: `0 10px 30px -10px ${currentTierConfig.color}15`,
            }}>
              {/* Radial gradient background based on tier */}
              <div style={{
                position: 'absolute',
                top: '-30%',
                right: '-20%',
                width: '60%',
                height: '70%',
                background: `radial-gradient(circle, ${currentTierConfig.color}1c 0%, transparent 70%)`,
                zIndex: 0,
                pointerEvents: 'none'
              }} />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                  <div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thẻ thành viên AetherPC</span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>{user.name}</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.1rem', fontFamily: 'monospace' }}>{user.email}</p>
                  </div>
                  <div style={{
                    background: currentTierConfig.bgColor,
                    border: `1px solid ${currentTierConfig.color}35`,
                    borderRadius: 'var(--radius-md)',
                    padding: '0.5rem 1rem',
                    color: currentTierConfig.color,
                    fontWeight: 800,
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    boxShadow: `0 0 15px ${currentTierConfig.color}22`
                  }}>
                    <Star size={14} fill={currentTierConfig.color} />
                    {currentTierConfig.label.split(' (')[0].toUpperCase()}
                  </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Số điểm tích lũy hiện tại:</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--success)', lineHeight: 1 }}>
                      {formatNumber(currentPoints)}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Điểm (VND)</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Quy đổi: 1 điểm tích lũy tương đương 1đ giảm trừ hóa đơn tiếp theo)</span>
                </div>
              </div>

              {/* Progress to next tier */}
              <div style={{ position: 'relative', zIndex: 1, borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem' }}>
                {nextTierConfig ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Tiến trình thăng hạng:</span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        <strong>{formatNumber(currentPoints)}</strong> / {formatNumber(pointsRequiredForNext)}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.75rem', border: '1px solid var(--border-glass)' }}>
                      <div style={{
                        width: `${progressPercent}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${currentTierConfig.color}, ${nextTierConfig.color})`,
                        borderRadius: '99px',
                        boxShadow: `0 0 10px ${currentTierConfig.color}44`,
                        transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                      }} />
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <TrendingUp size={14} style={{ color: 'var(--warning)' }} />
                      Cần thêm <strong style={{ color: 'var(--text-primary)' }}>{formatNumber(pointsRemaining)} điểm</strong> để thăng lên hạng <strong style={{ color: nextTierConfig.color }}>{nextTierConfig.label.split(' (')[0]}</strong>.
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.875rem', color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={18} /> Bạn đã đạt hạng cao nhất (Bạch Kim)! Xin cảm ơn sự ủng hộ nhiệt tình của bạn.
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="card-glass" style={{
              padding: '2.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              borderStyle: 'dashed',
              borderWidth: '2px',
              borderColor: 'rgba(99, 102, 241, 0.25)'
            }}>
              <Star size={44} style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Kiểm tra đặc quyền của bạn</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, maxWidth: '340px', marginBottom: '2rem' }}>
                Đăng nhập tài khoản khách hàng để xem số điểm tích lũy và kiểm tra hạng thành viên của mình.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '300px', justifyContent: 'center' }}>
                <button 
                  className="btn btn-primary" 
                  style={{ 
                    flex: 1, 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.45rem',
                    padding: '0.7rem 1rem',
                    whiteSpace: 'nowrap',
                    fontWeight: 700
                  }} 
                  onClick={() => navigate('/login')}
                >
                  <LogIn size={16} /> <span>Đăng nhập</span>
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ 
                    flex: 1, 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.45rem',
                    padding: '0.7rem 1rem',
                    whiteSpace: 'nowrap',
                    fontWeight: 700
                  }} 
                  onClick={() => navigate('/login?register=true')}
                >
                  <UserPlus size={16} /> <span>Đăng ký</span>
                </button>
              </div>
            </div>
          )}

          {/* Card Right: Lookup tool by phone/email */}
          <div className="card-glass" style={{ padding: '2.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Search size={18} style={{ color: 'var(--primary)' }} /> Tra Cứu Nhanh Thành Viên
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Đăng nhập rồi nhập số điện thoại hoặc email của tài khoản để xem điểm tích lũy và thứ hạng hiện tại.
              </p>

              <form onSubmit={handlePhoneSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Nhập số điện thoại hoặc email..."
                  className="form-input"
                  value={phoneSearch}
                  onChange={(e) => setPhoneSearch(e.target.value)}
                  style={{ fontSize: '0.875rem', flex: 1 }}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ 
                    padding: '0.625rem 1.4rem', 
                    whiteSpace: 'nowrap', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontWeight: 700
                  }}
                >
                  Tra cứu
                </button>
              </form>

              {searchError && (
                <div style={{ color: 'var(--danger)', fontSize: '0.8125rem', background: 'rgba(239,68,68,0.08)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {searchError}
                </div>
              )}
            </div>

            {/* Results display */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1rem' }}>
              {searchResult ? (
                <div style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{searchResult.name}</span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: TIER_CONFIGS[searchResult.tier]?.color || '#fff',
                      background: TIER_CONFIGS[searchResult.tier]?.bgColor || 'rgba(255,255,255,0.05)',
                      padding: '0.25rem 0.625rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${TIER_CONFIGS[searchResult.tier]?.color}22`
                    }}>
                      {TIER_CONFIGS[searchResult.tier]?.label || searchResult.tier}
                    </span>
                  </div>
                  <div style={{ height: '1px', backgroundColor: 'var(--border-glass)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Số điện thoại:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{searchResult.phone}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Điểm tích lũy:</span>
                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>{formatNumber(searchResult.loyaltyPoints)} điểm</span>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem 0' }}>
                  <Info size={20} style={{ display: 'block', margin: '0 auto 0.5rem', opacity: 0.5 }} />
                  Kết quả tra cứu sẽ hiển thị tại đây.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECTION 2: MEMBERSHIP COMPARISON MATRIX
        ════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: '3.5rem' }}>
          <div style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Gift size={20} style={{ color: 'var(--warning)' }} /> Bảng Đặc Quyền Từng Hạng Thành Viên
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Tích lũy càng nhiều điểm, hạng càng cao và mức giảm giá áp dụng trực tiếp cho mỗi đơn hàng càng lớn.
            </p>
          </div>

          <div className="table-container">
            <table className="erp-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Tiêu chí / Đặc quyền</th>
                  {Object.entries(TIER_CONFIGS).map(([key, config]) => {
                    const isActive = key === currentTierKey;
                    return (
                      <th key={key} style={{ 
                        textAlign: 'center', 
                        color: config.color,
                        background: isActive ? 'rgba(255,255,255,0.03)' : 'none',
                        borderLeft: isActive ? `1px dashed ${config.color}55` : 'none',
                        borderRight: isActive ? `1px dashed ${config.color}55` : 'none',
                        padding: '1rem 0.5rem',
                        verticalAlign: 'middle'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.375rem',
                          width: '100%'
                        }}>
                          <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {config.label.split(' (')[0]}
                          </div>
                          {isActive && (
                            <div style={{ 
                              fontSize: '0.625rem', 
                              background: config.color, 
                              color: '#fff', 
                              borderRadius: '99px', 
                              padding: '2px 8px', 
                              display: 'inline-block', 
                              fontWeight: 800,
                              letterSpacing: '0.05em',
                              whiteSpace: 'nowrap'
                            }}>
                              CỦA BẠN
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Mốc điểm yêu cầu</strong></td>
                  {Object.entries(TIER_CONFIGS).map(([key, config]) => (
                    <td key={key} style={{ textAlign: 'center', fontWeight: 700, background: key === currentTierKey ? 'rgba(255,255,255,0.02)' : 'none' }}>
                      {formatNumber(config.pointsRequired)} điểm
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Giảm giá mỗi đơn hàng</strong></td>
                  {Object.entries(TIER_CONFIGS).map(([key, config]) => (
                    <td key={key} style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 700, background: key === currentTierKey ? 'rgba(255,255,255,0.02)' : 'none' }}>
                      {config.discount ? `${config.discount}%` : '-'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Tích điểm</strong></td>
                  {Object.entries(TIER_CONFIGS).map(([key]) => (
                    <td key={key} style={{ textAlign: 'center', fontSize: '0.8125rem', background: key === currentTierKey ? 'rgba(255,255,255,0.02)' : 'none' }}>
                      10.000đ = 1 điểm
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Phí vận chuyển</strong></td>
                  {Object.entries(TIER_CONFIGS).map(([key]) => (
                    <td key={key} style={{ textAlign: 'center', fontSize: '0.8125rem', background: key === currentTierKey ? 'rgba(255,255,255,0.02)' : 'none' }}>
                      Miễn phí toàn quốc
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            SECTION 3: POINTS CALCULATOR & FAQ
        ════════════════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem' }}>
          
          {/* Box left: Points Calculator */}
          <div className="card-glass" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} style={{ color: 'var(--success)' }} /> Công Cụ Ước Tính Tích Lũy
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Nhập giá trị hóa đơn mua hàng dự kiến tại AetherPC để ước lượng số điểm tích lũy bạn sẽ nhận được.
            </p>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Giá trị đơn hàng dự tính (VND)</label>
              <input
                type="number"
                placeholder="Ví dụ: 25000000..."
                className="form-input"
                value={calcAmount}
                onChange={(e) => handleCalcChange(e.target.value)}
              />
            </div>

            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Điểm dự kiến nhận được:</span>
                <strong style={{ color: 'var(--success)', fontSize: '1rem' }}>+{formatNumber(calcPoints)} điểm</strong>
              </div>
              <div style={{ height: '1px', backgroundColor: 'var(--border-glass)' }} />
              {Object.entries(TIER_CONFIGS).map(([key, config]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  <span>Giảm giá hạng {config.label.replace(/^Hạng /, '').replace(/ \(.*\)$/, '')} ({config.discount}%):</span>
                  <span>-{formatNumber(Math.round((parseFloat(calcAmount) || 0) * config.discount / 100))}đ</span>
                </div>
              ))}
            </div>
          </div>

          {/* Box right: FAQ */}
          <div className="card-glass" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HelpCircle size={18} style={{ color: 'var(--accent)' }} /> Câu Hỏi Thường Gặp
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  1. Điểm tích lũy được tính như thế nào?
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                  Điểm tích lũy được tính dựa trên giá trị thanh toán thực tế của hóa đơn. Cứ mỗi 10.000đ thanh toán, bạn nhận được 1 điểm, áp dụng như nhau cho mọi hạng. Điểm được cộng khi đơn hàng được xác nhận.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  2. Điểm tích lũy dùng để làm gì?
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                  Điểm dùng để xét hạng thành viên. Đạt 1.000 điểm lên hạng Bạc (giảm 2%), 5.000 điểm lên Vàng (giảm 5%), 10.000 điểm lên Bạch Kim (giảm 10%). Mức giảm của hạng được trừ tự động vào mỗi đơn hàng.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  3. Thứ hạng thành viên có bị giảm hạng không?
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                  Có thể. Khi đơn hàng đã tích điểm bị hủy hoặc hoàn trả, số điểm của đơn đó bị trừ lại và hạng được tính lại theo tổng điểm còn lại.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
