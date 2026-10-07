import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Copy, Check, Ticket, BadgePercent } from 'lucide-react';
import { notify } from '../../context/NotificationContext';
import ProductCard, { ProductCarousel } from '../../components/Storefront/ProductCard';
import useCatalog from '../../components/Storefront/useCatalog';
import { SF_CATEGORIES, discountOf, isInStock } from '../../components/Storefront/catalog';

// Mã giảm giá đang được giỏ hàng chấp nhận (xem handleApplyCoupon trong Cart.jsx)
const COUPONS = [
  { code: 'AETHER10', value: '10%', unit: 'GIẢM', title: 'Giảm 10% tổng đơn hàng', cond: 'Áp dụng cho đơn từ 2.000.000₫' },
  { code: 'NEWPC200K', value: '200K', unit: 'GIẢM', title: 'Giảm 200.000₫ cho đơn hàng lớn', cond: 'Áp dụng cho đơn từ 5.000.000₫' },
];

function Coupon({ c }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(c.code)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => notify(`Mã giảm giá: ${c.code}`, 'info'));
  };
  return (
    <div className="sf-coupon">
      <div className="sf-coupon-l"><span>{c.unit}</span><b>{c.value}</b></div>
      <div className="sf-coupon-r">
        <span className="t">{c.title}</span>
        <span className="d">{c.cond}. Nhập mã ở bước thanh toán trong giỏ hàng.</span>
        <div className="sf-coupon-code">
          <code>{c.code}</code>
          <button type="button" className="sf-btn sf-btn-outline" style={{ height: 30, padding: '0 10px', fontSize: 12.5 }} onClick={copy}>
            {copied ? <><Check size={14} /> Đã chép</> : <><Copy size={14} /> Sao chép</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Promotions() {
  const { products } = useCatalog();
  const [cat, setCat] = useState('ALL');

  const deals = useMemo(() => products.filter(p => p.price > 0 && isInStock(p) && discountOf(p) > 0), [products]);
  const topByCat = useMemo(() => {
    const o = {};
    SF_CATEGORIES.forEach(c => {
      o[c.key] = deals.filter(p => p.category === c.key).sort((a, b) => discountOf(b) - discountOf(a)).slice(0, 10);
    });
    return o;
  }, [deals]);
  const maxOff = (k) => (topByCat[k]?.[0] ? discountOf(topByCat[k][0]) : 0);
  const img = (k, i = 0) => topByCat[k]?.[i];
  const gridList = cat === 'ALL'
    ? [...deals].sort((a, b) => discountOf(b) - discountOf(a)).slice(0, 20)
    : (topByCat[cat] || []);

  const programs = [
    { to: '/flash-sale', tone: 'red', k: 'Mỗi ngày', t: 'Flash Sale giá sốc', c: 'Săn deal', p: img('MOUSE') },
    { to: '/products?category=VGA&sort=discount', tone: 'dark', k: 'Card màn hình', t: `Giảm đến ${maxOff('VGA')}%`, c: 'Xem ngay', p: img('VGA') },
    { to: '/pc-builder', tone: 'blue', k: 'Build PC', t: 'Lắp ráp & kiểm tra miễn phí', c: 'Build ngay', p: img('CASE') },
    { to: '/member-tier', tone: 'violet', k: 'Thành viên', t: 'Tích điểm, giảm thêm theo hạng', c: 'Xem quyền lợi', p: img('MONITOR') },
  ];

  return (
    <div className="sf-container">
      <nav className="sf-breadcrumb"><Link to="/">Trang chủ</Link><span>/</span><span className="cur">Khuyến mãi</span></nav>

      <section className="sf-page-hero" style={{ marginTop: 0 }}>
        <span className="kicker">Ưu đãi đang diễn ra</span>
        <h1>Khuyến mãi tại AetherPC</h1>
        <p>{deals.length.toLocaleString('vi-VN')} sản phẩm đang giảm giá, mã giảm thêm cho đơn hàng và miễn phí giao hàng toàn quốc. Giá hiển thị là giá bán thực tế đã áp dụng giảm.</p>
      </section>

      <section className="sf-section">
        <div className="sf-section-head"><h2 className="sf-section-title"><Ticket size={22} color="#d70018" /> Mã giảm giá</h2></div>
        <div className="sf-coupons">{COUPONS.map(c => <Coupon key={c.code} c={c} />)}</div>
      </section>

      <section className="sf-section">
        <div className="sf-section-head"><h2 className="sf-section-title">Chương trình <span className="accent">nổi bật</span></h2></div>
        <div className="sf-program">
          {programs.map(x => (
            <Link key={x.to} to={x.to} className={`sf-promo sf-promo-${x.tone}`}>
              {x.p?.image && <img className="p" src={x.p.image} alt="" />}
              <span className="k">{x.k}</span><span className="t">{x.t}</span><span className="c">{x.c} <ChevronRight size={13} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="sf-section sf-section-box">
        <div className="sf-section-head">
          <div>
            <h2 className="sf-section-title"><BadgePercent size={22} color="#d70018" /> Giảm sâu nhất <span className="accent">theo danh mục</span></h2>
            <p className="sf-section-sub">Sản phẩm còn hàng có mức giảm cao nhất trong từng danh mục</p>
          </div>
          <Link to="/products?sale=1&sort=discount" className="sf-viewall">Tất cả sản phẩm giảm giá <ChevronRight size={15} /></Link>
        </div>
        <div className="sf-section-links" style={{ marginBottom: 14 }}>
          <button type="button" className={`sf-chip${cat === 'ALL' ? ' is-active' : ''}`} onClick={() => setCat('ALL')}>Tất cả</button>
          {SF_CATEGORIES.filter(c => topByCat[c.key]?.length).map(c => (
            <button key={c.key} type="button" className={`sf-chip${cat === c.key ? ' is-active' : ''}`} onClick={() => setCat(c.key)}>
              {c.short} <span style={{ color: 'var(--sf-primary)', fontWeight: 700 }}>-{maxOff(c.key)}%</span>
            </button>
          ))}
        </div>
        <div className="sf-grid">{gridList.map(p => <ProductCard key={p.id} product={p} />)}</div>
      </section>

      {['VGA', 'CPU', 'MONITOR'].filter(k => topByCat[k]?.length >= 5).map(k => {
        const c = SF_CATEGORIES.find(x => x.key === k);
        return (
          <section key={k} className="sf-section sf-section-box">
            <div className="sf-section-head">
              <h2 className="sf-section-title">{c.label} <span className="accent">giảm đến {maxOff(k)}%</span></h2>
              <Link to={`/products?category=${k}&sale=1&sort=discount`} className="sf-viewall">Xem tất cả <ChevronRight size={15} /></Link>
            </div>
            <ProductCarousel products={topByCat[k]} />
          </section>
        );
      })}

      <section className="sf-section sf-section-box" style={{ fontSize: 13.5, color: 'var(--sf-text-2)', lineHeight: 1.7 }}>
        <h2 className="sf-section-title" style={{ fontSize: 16, marginBottom: 8 }}>Điều kiện áp dụng</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Mỗi đơn hàng áp dụng một mã giảm giá; mã được kiểm tra theo giá trị đơn tại bước thanh toán.</li>
          <li>Giảm giá theo hạng thành viên được cộng thêm sau khi áp dụng mã (xem trang Hạng thành viên).</li>
          <li>Ưu đãi áp dụng cho sản phẩm còn hàng; số lượng có hạn và có thể kết thúc sớm khi hết hàng.</li>
        </ul>
      </section>
    </div>
  );
}
