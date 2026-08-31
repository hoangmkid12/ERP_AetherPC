import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Award, Star, Gift, ShieldCheck, TrendingUp, LogIn, UserPlus, Info, Search, HelpCircle, ArrowLeft } from 'lucide-react';

const TIER_CONFIGS = {
  BRONZE: {
    label: 'Hạng Đồng (Bronze)',
    color: '#b45309',
    bgColor: 'rgba(180, 83, 9, 0.15)',
    glow: 'rgba(180, 83, 9, 0.3)',
    pointsRequired: 0,
    nextTier: 'SILVER',
    nextPoints: 1000,
    perks: ['Tích lũy 1% giá trị đơn hàng', 'Được nhận tin khuyến mãi sớm nhất']
  },
  SILVER: {
    label: 'Hạng Bạc (Silver)',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.15)',
    glow: 'rgba(148, 163, 184, 0.3)',
    pointsRequired: 1000,
    nextTier: 'GOLD',
    nextPoints: 5000,
    perks: ['Tích lũy 2% giá trị đơn hàng', 'Miễn phí vận chuyển đơn hàng từ 1 triệu', 'Quà tặng thăng hạng']
  },
  GOLD: {
    label: 'Hạng Vàng (Gold)',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    glow: 'rgba(245, 158, 11, 0.35)',
    pointsRequired: 5000,
    nextTier: 'PLATINUM',
    nextPoints: 15000,
    perks: ['Tích lũy 3% giá trị đơn hàng', 'Miễn phí vận chuyển mọi đơn hàng', 'Quà tặng sinh nhật đặc biệt', 'Giảm 10% phí lắp ráp PC theo yêu cầu']
  },
  PLATINUM: {
    label: 'Hạng Bạch Kim (Platinum)',
    color: '#06b6d4',
    bgColor: 'rgba(6, 182, 212, 0.15)',
    glow: 'rgba(6, 182, 212, 0.35)',
    pointsRequired: 15000,
    nextTier: 'DIAMOND',
    nextPoints: 30000,
    perks: ['Tích lũy 5% giá trị đơn hàng', 'Miễn phí vận chuyển mọi đơn hàng', 'Quà tặng sinh nhật & dịp lễ lớn', 'Đường dây hỗ trợ kỹ thuật ưu tiên 24/7', 'Được đặt trước linh kiện HOT độc quyền']
  },
  DIAMOND: {
    label: 'Hạng Kim Cương (Diamond)',
    color: '#d946ef',
    bgColor: 'rgba(217, 70, 239, 0.15)',
    glow: 'rgba(217, 70, 239, 0.4)',
    pointsRequired: 30000,
    nextTier: null,
    nextPoints: null,
    perks: ['Tích lũy 7% giá trị đơn hàng', 'Miễn phí vận chuyển & giao hàng hỏa tốc', 'Hỗ trợ lắp đặt & modding phần cứng miễn phí tại nhà', 'Chuyên viên kỹ thuật riêng hỗ trợ trọn đời', 'Trải nghiệm phòng chờ VIP & sự kiện công nghệ của AetherPC']
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

  const handlePhoneSearch = (e) => {
    e.preventDefault();
    setSearchError('');
    setSearchResult(null);

    const cleanSearch = phoneSearch.trim();

    if (!cleanSearch) {
      setSearchError('Vui lòng nhập số điện thoại hoặc email cần tra cứu.');
      return;
    }

    // 1. Check currently logged-in user
    if (user && (user.phone === cleanSearch || user.email === cleanSearch)) {
      setSearchResult({
        name: user.fullname || user.name || 'Khách hàng',
        phone: user.phone || '',
        tier: user.tier || 'BRONZE',
        loyaltyPoints: user.loyaltyPoints || 0
      });
      return;
    }

    // 2. Search erp_orders to see if they bought items using this phone number/email
    {
      const storedOrders = JSON.parse(localStorage.getItem('erp_orders') || '[]');
      const cleanPhone = cleanSearch.replace(/[^0-9]/g, '');
      const matchedOrders = storedOrders.filter(ord =>
        ord.status !== 'CANCELLED' &&
        ((ord.phone && ord.phone.replace(/[^0-9]/g, '') === cleanPhone) || ord.email === cleanSearch)
      );

      if (matchedOrders.length > 0) {
        // Calculate points
        let totalPoints = 0;
        matchedOrders.forEach(ord => {
          totalPoints += Math.floor(parseFloat(ord.totalAmount) / 10000);
        });

        // Determine tier
        let calculatedTier = 'BRONZE';
        if (totalPoints >= 30000) calculatedTier = 'DIAMOND';
        else if (totalPoints >= 15000) calculatedTier = 'PLATINUM';
        else if (totalPoints >= 5000) calculatedTier = 'GOLD';
        else if (totalPoints >= 1000) calculatedTier = 'SILVER';

        const customerNameFromOrder = matchedOrders[0].customerName || 'Khách hàng';

        setSearchResult({
          name: customerNameFromOrder,
          phone: cleanSearch,
          tier: calculatedTier,
          loyaltyPoints: totalPoints
        });
      } else {
        // 4. Create a deterministic mock result for presentation if not found in orders
        if (/^[0-9]{10}$/.test(cleanSearch)) {
          const fakePoints = 50 + (parseInt(cleanSearch.slice(-4)) % 18000);
          let fakeTier = 'BRONZE';
          if (fakePoints >= 30000) fakeTier = 'DIAMOND';
          else if (fakePoints >= 15000) fakeTier = 'PLATINUM';
          else if (fakePoints >= 5000) fakeTier = 'GOLD';
          else if (fakePoints >= 1000) fakeTier = 'SILVER';

          setSearchResult({
            name: 'Khách hàng ẩn danh',
            phone: cleanSearch,
            tier: fakeTier,
            loyaltyPoints: fakePoints
          });
        } else {
          setSearchError('Không tìm thấy thông tin thành viên khớp với thông tin nhập.');
        }
      }
    }
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
            Mua sắm tích lũy điểm thăng hạng nhận ngàn ưu đãi chiết khấu trực tiếp và dịch vụ hỗ trợ VIP độc quyền.
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
                    <ShieldCheck size={18} /> Bạn đã đạt hạng thăng tối đa (Kim Cương)! Xin cảm ơn sự ủng hộ nhiệt tình của bạn.
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
              <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '280px' }}>
                <button className="btn btn-primary" style={{ flex: 1, gap: '0.375rem' }} onClick={() => navigate('/login')}>
                  <LogIn size={15} /> Đăng nhập
                </button>
                <button className="btn btn-secondary" style={{ flex: 1, gap: '0.375rem' }} onClick={() => navigate('/login?register=true')}>
                  <UserPlus size={15} /> Đăng ký
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
                Nhập số điện thoại hoặc địa chỉ email để kiểm tra nhanh điểm tích lũy và thứ hạng mà không cần đăng nhập.
              </p>

              <form onSubmit={handlePhoneSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Nhập số điện thoại hoặc email..."
                  className="form-input"
                  value={phoneSearch}
                  onChange={(e) => setPhoneSearch(e.target.value)}
                  style={{ fontSize: '0.875rem' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.625rem 1.25rem' }}>
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
                      color: TIER_CONFIGS[searchResult.tier.toUpperCase()]?.color || '#fff',
                      background: TIER_CONFIGS[searchResult.tier.toUpperCase()]?.bgColor || 'rgba(255,255,255,0.05)',
                      padding: '0.25rem 0.625rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${TIER_CONFIGS[searchResult.tier.toUpperCase()]?.color}22`
                    }}>
                      {searchResult.tier.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ height: '1px', backgroundColor: 'var(--border-glass)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Số điện thoại:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{searchResult.phone}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Điểm tích lũy:</span>
                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>{formatNumber(searchResult.loyaltyPoints)}đ</span>
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
              Tích lũy càng nhiều điểm thăng hạng, bạn càng được hưởng mức chiết khấu tích lũy đơn hàng lớn và ưu tiên phục vụ.
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
                      {formatNumber(config.pointsRequired)}đ
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>% Tích điểm đơn hàng</strong></td>
                  {Object.entries(TIER_CONFIGS).map(([key, config]) => (
                    <td key={key} style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 700, background: key === currentTierKey ? 'rgba(255,255,255,0.02)' : 'none' }}>
                      {key === 'BRONZE' ? '1%' : key === 'SILVER' ? '2%' : key === 'GOLD' ? '3%' : key === 'PLATINUM' ? '5%' : '7%'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Phí vận chuyển</strong></td>
                  {Object.entries(TIER_CONFIGS).map(([key, config]) => (
                    <td key={key} style={{ textAlign: 'center', fontSize: '0.8125rem', background: key === currentTierKey ? 'rgba(255,255,255,0.02)' : 'none' }}>
                      {key === 'BRONZE' ? 'Mặc định' : key === 'SILVER' ? 'Free đơn từ 1M' : 'Miễn phí 100%'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Dịch vụ hỗ trợ & VIP</strong></td>
                  {Object.entries(TIER_CONFIGS).map(([key, config]) => (
                    <td key={key} style={{ textAlign: 'center', fontSize: '0.8125rem', background: key === currentTierKey ? 'rgba(255,255,255,0.02)' : 'none' }}>
                      {key === 'BRONZE' ? 'Cơ bản' : key === 'SILVER' ? 'Cơ bản' : key === 'GOLD' ? 'Ưu tiên hỗ trợ' : key === 'PLATINUM' ? 'Đường dây nóng VIP 24/7' : 'Kỹ thuật viên hỗ trợ tại nhà'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Đặc quyền đặt trước</strong></td>
                  {Object.entries(TIER_CONFIGS).map(([key, config]) => (
                    <td key={key} style={{ textAlign: 'center', fontSize: '0.8125rem', background: key === currentTierKey ? 'rgba(255,255,255,0.02)' : 'none' }}>
                      {key === 'PLATINUM' || key === 'DIAMOND' ? '✓ Đặt trước đồ HOT' : '-'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Dành cho Build PC</strong></td>
                  {Object.entries(TIER_CONFIGS).map(([key, config]) => (
                    <td key={key} style={{ textAlign: 'center', fontSize: '0.8125rem', background: key === currentTierKey ? 'rgba(255,255,255,0.02)' : 'none' }}>
                      {key === 'GOLD' ? 'Giảm 10% phí dịch vụ' : key === 'PLATINUM' ? 'Giảm 20% phí dịch vụ' : key === 'DIAMOND' ? 'Miễn phí trọn đời' : '-'}
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
                <strong style={{ color: 'var(--success)', fontSize: '1rem' }}>+{formatNumber(calcPoints)}đ</strong>
              </div>
              <div style={{ height: '1px', backgroundColor: 'var(--border-glass)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <span>Đồng (1%):</span>
                <span>+{formatNumber(calcPoints)}đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <span>Bạc (2%):</span>
                <span>+{formatNumber(calcPoints * 2)}đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <span>Vàng (3%):</span>
                <span>+{formatNumber(calcPoints * 3)}đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <span>Bạch Kim (5%):</span>
                <span>+{formatNumber(calcPoints * 5)}đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <span>Kim Cương (7%):</span>
                <span>+{formatNumber(calcPoints * 7)}đ</span>
              </div>
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
                  Điểm tích lũy được tính dựa trên giá trị thanh toán thực tế của hóa đơn. Cứ mỗi 10,000đ thanh toán, bạn sẽ nhận được 1 điểm cơ bản. Số điểm này được nhân thêm hệ số tương ứng với thứ hạng thành viên hiện tại của bạn tại thời điểm xuất hóa đơn.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  2. Điểm tích lũy dùng để làm gì?
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                  Bạn có thể dùng điểm tích lũy để trừ tiền trực tiếp khi mua sắm đơn hàng tiếp theo tại cửa hàng hoặc thanh toán online. Tỷ lệ quy đổi là 1 điểm = 1đ giảm trừ hóa đơn.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  3. Thứ hạng thành viên có bị giảm hạng không?
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                  Có. Thứ hạng thành viên sẽ được xét lại định kỳ vào ngày 01/01 hàng năm dựa trên tổng số điểm tích lũy thực tế mà bạn mua sắm trong 12 tháng trước đó. Nếu không tích lũy đủ điểm tối thiểu của thứ hạng hiện tại, hệ thống sẽ tự động hạ hạng tương ứng.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
