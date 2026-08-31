import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Zap, Tag, Copy, CheckCircle } from 'lucide-react';

// ─── Data ─────────────────────────────────────────────────────────────────────
const PROMOTIONS = [
  {
    id: 1,
    type: 'flash',
    title: 'Flash Sale CPU Intel',
    description: 'Giảm sốc 20–25% toàn bộ dòng Intel Core Gen 13/14. Số lượng có giới hạn!',
    discount: '25%',
    endHours: 8,
    image: '/promo_banner.png',
    tag: 'Flash Sale',
    color: '#ef4444',
    items: [
      { name: 'Intel Core i5-13400F', original: 6200000, sale: 4890000 },
      { name: 'Intel Core i7-14700K', original: 13500000, sale: 10990000 },
      { name: 'Intel Core i9-13900K', original: 19800000, sale: 15900000 },
    ],
  },
  {
    id: 2,
    type: 'bundle',
    title: 'Combo VGA Mùa Hè',
    description: 'Mua card đồ họa RTX 40xx giảm thêm 10% khi kết hợp với RAM Corsair hoặc Kingston.',
    discount: '10%',
    endHours: 72,
    tag: 'Combo Deal',
    color: '#6366f1',
    items: [
      { name: 'RTX 4070 Super + Corsair 32GB DDR5', original: 25240000, sale: 22700000 },
      { name: 'RTX 4060 + Kingston 16GB DDR4', original: 9440000, sale: 8490000 },
    ],
  },
  {
    id: 3,
    type: 'category',
    title: 'Tuần Lễ SSD & Storage',
    description: 'Giảm giá toàn bộ ổ cứng SSD NVMe và SATA. Nâng cấp tốc độ máy tính ngay!',
    discount: '15%',
    endHours: 120,
    tag: 'Deal Tuần',
    color: '#10b981',
    items: [
      { name: 'Samsung 990 PRO 1TB NVMe', original: 3500000, sale: 2990000 },
      { name: 'WD Blue SN580 1TB', original: 2200000, sale: 1890000 },
      { name: 'Seagate Barracuda 2TB HDD', original: 1500000, sale: 1290000 },
    ],
  },
  {
    id: 4,
    type: 'coupon',
    title: 'Mã Giảm Giá Đơn Đặt Hàng Online',
    description: 'Dùng mã giảm giá bên dưới khi thanh toán để nhận ưu đãi độc quyền.',
    discount: 'Đa dạng',
    endHours: 168,
    tag: 'Coupon',
    color: '#f59e0b',
    coupons: [
      { code: 'AETHER10', desc: 'Giảm 10% cho đơn từ 2 triệu', value: '10%' },
      { code: 'NEWPC200K', desc: 'Giảm 200.000₫ cho đơn từ 5 triệu', value: '200K₫' },
      { code: 'FREESHIP', desc: 'Miễn phí vận chuyển toàn quốc', value: 'Ship' },
    ],
  },
];

function formatPrice(p) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);
}

function useCountdown(hours) {
  const [endTime] = useState(() => Date.now() + hours * 3600000);
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = endTime - Date.now();
      if (diff <= 0) { setTimeLeft({ h: 0, m: 0, s: 0 }); return; }
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff / 60000) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return timeLeft;
}

function CountdownDisplay({ hours }) {
  const { h, m, s } = useCountdown(hours);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <Clock size={14} style={{ color: 'var(--danger)' }} />
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Còn lại:</span>
      {[{ v: pad(h), l: 'g' }, { v: pad(m), l: 'm' }, { v: pad(s), l: 's' }].map((u, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>:</span>}
          <span style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--danger)', fontFamily: 'var(--font-title)', fontWeight: 700,
            fontSize: '0.875rem', padding: '2px 6px', borderRadius: '4px',
          }}>{u.v}{u.l}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function CouponCard({ coupon }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{
      border: '2px dashed rgba(245,158,11,0.4)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.125rem 1.25rem',
      background: 'rgba(245,158,11,0.05)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '1rem',
      flexWrap: 'wrap',
    }}>
      <div>
        <div style={{
          fontFamily: 'var(--font-title)', fontSize: '1.35rem', fontWeight: 800,
          color: '#f59e0b', letterSpacing: '0.1em', marginBottom: '0.25rem',
        }}>{coupon.code}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{coupon.desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span className="badge badge-warning" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}>
          Giảm {coupon.value}
        </span>
        <button onClick={handleCopy} className="btn btn-secondary" style={{ gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.8125rem' }}>
          {copied ? <><CheckCircle size={14} style={{ color: 'var(--success)' }} /> Đã sao chép!</> : <><Copy size={14} /> Sao chép</>}
        </button>
      </div>
    </div>
  );
}

export default function Promotions() {
  const [activeTab, setActiveTab] = useState('all');

  const filteredPromos = activeTab === 'all'
    ? PROMOTIONS
    : PROMOTIONS.filter(p => p.type === activeTab);

  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* Page Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(11,15,25,0) 60%)',
        borderBottom: '1px solid var(--border-glass)',
        padding: '4rem 0 3rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '3rem',
      }}>
        <div style={{
          position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)',
          width: '600px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(239,68,68,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <span className="promo-badge" style={{ marginBottom: '1.5rem', display: 'inline-flex', fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
            <Zap size={14} /> Flash Sale & Ưu Đãi
          </span>
          <h1 className="section-title" style={{ fontSize: '2.75rem', marginBottom: '1rem' }}>
            Khuyến Mãi <span style={{ color: 'var(--danger)' }}>Đang Diễn Ra</span>
          </h1>
          <p className="section-subtitle" style={{ maxWidth: '560px', margin: '0 auto' }}>
            Hàng trăm ưu đãi hấp dẫn mỗi tuần — Flash Sale, Combo Deal, Coupon giảm giá và nhiều hơn nữa.
          </p>
        </div>
      </div>

      <div className="container">
        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'Tất Cả' },
            { key: 'flash', label: 'Flash Sale' },
            { key: 'bundle', label: 'Combo Deal' },
            { key: 'category', label: 'Deal Danh Mục' },
            { key: 'coupon', label: 'Mã Giảm Giá' },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              border: '1px solid var(--border-glass)', fontWeight: 600, fontSize: '0.875rem',
              fontFamily: 'var(--font-sans)',
              background: activeTab === tab.key ? 'var(--danger)' : 'rgba(255,255,255,0.02)',
              color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
              transition: 'all var(--transition-fast)',
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Promo Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {filteredPromos.map((promo) => (
            <div key={promo.id} className="card-glass" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Promo Header */}
              <div style={{
                background: `linear-gradient(135deg, ${promo.color}22 0%, transparent 100%)`,
                borderBottom: '1px solid var(--border-glass)',
                padding: '1.5rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{
                      background: `${promo.color}22`, color: promo.color,
                      fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.625rem',
                      borderRadius: '99px', border: `1px solid ${promo.color}44`,
                    }}>{promo.tag}</span>
                    <span style={{
                      background: 'rgba(239,68,68,0.1)', color: 'var(--danger)',
                      fontSize: '0.875rem', fontWeight: 800, padding: '0.25rem 0.75rem',
                      borderRadius: '99px', border: '1px solid rgba(239,68,68,0.3)',
                    }}>Giảm {promo.discount}</span>
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.375rem' }}>{promo.title}</h2>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '540px' }}>{promo.description}</p>
                </div>
                <CountdownDisplay hours={promo.endHours} />
              </div>

              {/* Promo Body */}
              <div style={{ padding: '1.5rem 2rem' }}>
                {promo.coupons ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    {promo.coupons.map((c) => <CouponCard key={c.code} coupon={c} />)}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {promo.items.map((item) => {
                      const pct = Math.round((1 - item.sale / item.original) * 100);
                      return (
                        <div key={item.name} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)',
                          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)',
                          gap: '1rem', flexWrap: 'wrap',
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.375rem' }}>{item.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                {formatPrice(item.original)}
                              </span>
                              <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>-{pct}%</span>
                            </div>
                            <div style={{ fontWeight: 800, color: 'var(--danger)', fontSize: '1.05rem' }}>{formatPrice(item.sale)}</div>
                          </div>
                          <Link to="/" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                            Mua Ngay
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}

                {promo.image && (
                  <div style={{ marginTop: '1.25rem', borderRadius: 'var(--radius-lg)', overflow: 'hidden', maxHeight: '200px' }}>
                    <img src={promo.image} alt={promo.title} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
