import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { notify } from '../../context/NotificationContext';
import { ArrowRight, Clock, Zap, Tag, Copy, CheckCircle, Gift, PackageX } from 'lucide-react';

// ─── Data ─────────────────────────────────────────────────────────────────────
const PROMOTIONS = [
  {
    id: 1,
    type: 'flash',
    title: 'Flash Sale CPU Intel',
    description: 'Giảm sốc 20–25% toàn bộ dòng Intel Core Gen 13/14. Số lượng có giới hạn!',
    discount: '25%',
    endHours: 8,
    tag: 'Flash Sale',
    color: '#ef4444',
    items: [
      { name: 'Intel Core i5-13400F', original: 6200000, sale: 4890000, image: 'https://product.hstatic.net/200000722513/product/13400f_4988446fd3b649d48605ab2a6586b28b_477f77739aa94fee90c99c709e47fcf4.png' },
      { name: 'Intel Core i7-14700K', original: 13500000, sale: 10990000, image: 'https://product.hstatic.net/200000722513/product/i7k_a1416a616a0a45358557b5348014b46b.png' },
      { name: 'Intel Core i9-14900K', original: 19800000, sale: 15900000, image: 'https://product.hstatic.net/200000722513/product/i9k_379efd950af74727a83b02c13817a3a7.png' },
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
      { name: 'RTX 4070 Super MSI Ventus 2X OC + Corsair Vengeance RGB 32GB DDR5', original: 25240000, sale: 22700000, image: 'https://product.hstatic.net/200000722513/product/1024_9f2367d9d41d4fa7870140e7a9f0c85e.png' },
      { name: 'RTX 4060 MSI Ventus 2X OC + Kingston Fury 8GB DDR4', original: 9440000, sale: 8490000, image: 'https://product.hstatic.net/200000722513/product/rtx_4060_ventus_2x_black_8g_oc_c34ea8c824fb4afb9f1241cec761e799.png' },
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
      { name: 'Samsung 990 PRO 2TB NVMe', original: 3500000, sale: 2990000, image: 'https://product.hstatic.net/200000722513/product/-am_001_front_black-gallery-1600x1200_d5430da92de74a7c9d7b35a7ae9b3587_b2e724a266834268bead0b9ab068d99c.png' },
      { name: 'WD Blue 2TB HDD 7200RPM', original: 2200000, sale: 1890000, image: 'https://product.hstatic.net/200000722513/product/gearvn-hdd-wd-blue-2tb-7200rpm-1_fa7b6220ded04738a7fca1ff18185232_25ae485065a74e5f9b86cdf04470409a.png' },
      { name: 'Seagate Barracuda 2TB HDD', original: 1500000, sale: 1290000, image: 'https://product.hstatic.net/200000722513/product/hdd_seagate_baracuda_2tb_gearvn00_28582504c8d24597908c3a73effefa7a_e147c85ec46148acbdc7c7f8a729b68c.jpg' },
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
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, expired: false });
  useEffect(() => {
    const tick = () => {
      const diff = endTime - Date.now();
      if (diff <= 0) { setTimeLeft({ h: 0, m: 0, s: 0, expired: true }); return; }
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff / 60000) % 60),
        s: Math.floor((diff / 1000) % 60),
        expired: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return timeLeft;
}

// Was always rendering the ticking clock, even once it hit 00:00:00 — a promo that
// had actually ended kept showing an active-looking countdown forever, which reads
// as misleading rather than friendly. Now it swaps to a plain "Đã kết thúc" state.
function CountdownDisplay({ hours }) {
  const { h, m, s, expired } = useCountdown(hours);
  const pad = (n) => String(n).padStart(2, '0');
  if (expired) {
    return (
      <span style={{
        fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)',
        background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)',
        padding: '0.3rem 0.75rem', borderRadius: '99px',
      }}>Đã kết thúc</span>
    );
  }
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
    navigator.clipboard.writeText(coupon.code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => notify('Không thể sao chép mã — trình duyệt đã chặn quyền truy cập clipboard.', 'error'));
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
      {/* Page Hero — real AetherPC build photo (hero_banner.png, same asset Home.jsx
          uses) instead of a flat color gradient, with a dark overlay for text contrast. */}
      <div style={{
        backgroundImage: 'linear-gradient(120deg, rgba(9,12,20,0.88) 0%, rgba(9,12,20,0.55) 55%, rgba(9,12,20,0.75) 100%), url(/hero_banner.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
        padding: '4.5rem 0 3.5rem',
        textAlign: 'center',
        position: 'relative',
        marginBottom: '3rem',
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <span className="promo-badge" style={{ marginBottom: '1.5rem', display: 'inline-flex', fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
            <Zap size={14} /> Flash Sale & Ưu Đãi
          </span>
          <h1 style={{ fontSize: '2.75rem', fontFamily: 'var(--font-title)', fontWeight: 800, color: '#ffffff', marginBottom: '1rem' }}>
            Khuyến Mãi <span style={{ color: '#f87171' }}>Đang Diễn Ra</span>
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.85)', maxWidth: '560px', margin: '0 auto' }}>
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
        {filteredPromos.length === 0 ? (
          <div className="card-glass" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Gift size={36} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Hiện chưa có ưu đãi nào ở mục này
            </p>
            <p style={{ fontSize: '0.85rem' }}>Quay lại sau hoặc xem các ưu đãi khác đang diễn ra nhé.</p>
          </div>
        ) : (
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                    {promo.items.map((item) => {
                      const pct = Math.round((1 - item.sale / item.original) * 100);
                      return (
                        <div key={item.name} style={{
                          display: 'flex', flexDirection: 'column',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)',
                          overflow: 'hidden',
                        }}>
                          {item.image && (
                            <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderBottom: '1px solid var(--border-glass)' }}>
                              <img src={item.image} alt={item.name} style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }} />
                            </div>
                          )}
                          <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem', lineHeight: 1.4 }}>{item.name}</div>
                            <div style={{ marginTop: 'auto' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  {formatPrice(item.original)}
                                </span>
                                <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>-{pct}%</span>
                              </div>
                              <div style={{ fontWeight: 800, color: 'var(--danger)', fontSize: '1.05rem', marginBottom: '0.75rem' }}>{formatPrice(item.sale)}</div>
                              <Link to="/" className="btn btn-primary" style={{ width: '100%', padding: '0.5rem 1rem', fontSize: '0.8rem', justifyContent: 'center' }}>
                                Mua Ngay
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Was a stock neon-cyberpunk banner image (promo_banner.png) that clashed
                    with the site's clean look everywhere else — swapped for the same
                    in-house gradient + icon treatment FlashSale.jsx already uses, so a
                    Flash Sale promo here actually looks like it belongs to this site. */}
                {promo.type === 'flash' && (
                  <div style={{
                    marginTop: '1.25rem', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                    padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem',
                    background: `linear-gradient(135deg, ${promo.color} 0%, #f97316 100%)`,
                  }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Zap size={26} fill="#ffffff" color="#ffffff" />
                    </div>
                    <div>
                      <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        Nhanh tay — số lượng có hạn
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.82rem' }}>
                        Giá Flash Sale chỉ áp dụng trong thời gian đếm ngược, không cộng dồn khuyến mãi khác.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
