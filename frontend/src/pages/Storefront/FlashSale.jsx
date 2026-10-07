import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Percent, Package, TrendingDown, ShieldCheck, Truck } from 'lucide-react';
import ProductCard from '../../components/Storefront/ProductCard';
import useCatalog from '../../components/Storefront/useCatalog';
import { SF_CATEGORIES, discountOf, isInStock } from '../../components/Storefront/catalog';

const STEP = 20;
const SORTS = [
  { key: 'discount', label: 'Giảm nhiều nhất' },
  { key: 'saving', label: 'Tiết kiệm nhiều nhất' },
  { key: 'price_asc', label: 'Giá tăng dần' },
  { key: 'price_desc', label: 'Giá giảm dần' },
];

// Đếm ngược tới hết ngày: mỗi ngày một đợt Flash Sale
function useEndOfDay() {
  const calc = () => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const d = Math.max(0, end - Date.now());
    return [Math.floor(d / 3600000), Math.floor(d / 60000) % 60, Math.floor(d / 1000) % 60];
  };
  const [t, setT] = useState(calc);
  useEffect(() => { const id = setInterval(() => setT(calc()), 1000); return () => clearInterval(id); }, []);
  return t;
}

export default function FlashSale() {
  const { products, loading } = useCatalog();
  const [cat, setCat] = useState('ALL');
  const [sort, setSort] = useState('discount');
  const [shown, setShown] = useState(STEP);
  const [h, m, s] = useEndOfDay();
  const pad = (n) => String(n).padStart(2, '0');

  // Chỉ sản phẩm đang giảm giá và còn hàng
  const deals = useMemo(() => products.filter(p => p.price > 0 && isInStock(p) && discountOf(p) >= 10), [products]);
  const counts = useMemo(() => {
    const c = {};
    deals.forEach(p => { c[p.category] = (c[p.category] || 0) + 1; });
    return c;
  }, [deals]);
  const list = useMemo(() => {
    const arr = deals.filter(p => cat === 'ALL' || p.category === cat);
    const saving = (p) => (p.originalPrice || p.price) - p.price;
    return arr.sort((a, b) => {
      if (sort === 'price_asc') return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      if (sort === 'saving') return saving(b) - saving(a);
      return discountOf(b) - discountOf(a);
    });
  }, [deals, cat, sort]);
  useEffect(() => setShown(STEP), [cat, sort]);

  const avgOff = deals.length ? Math.round(deals.reduce((t, p) => t + discountOf(p), 0) / deals.length) : 0;
  const maxOff = deals.reduce((mx, p) => Math.max(mx, discountOf(p)), 0);

  return (
    <div className="sf-container">
      <nav className="sf-breadcrumb"><Link to="/">Trang chủ</Link><span>/</span><span className="cur">Flash Sale</span></nav>

      <section className="sf-flash" style={{ padding: '26px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 className="sf-flash-title" style={{ fontSize: 34 }}><Zap size={34} /> Flash Sale mỗi ngày</h1>
            <p style={{ margin: '8px 0 14px', fontSize: 15, opacity: .92 }}>
              Giá sốc trên linh kiện có sẵn tại kho — giảm đến <b>{maxOff}%</b>, số lượng có hạn. Giá được cập nhật theo tồn kho thực tế.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[[Package, `${deals.length} sản phẩm đang sale`], [Percent, `Giảm trung bình ${avgOff}%`], [TrendingDown, `Giảm tối đa ${maxOff}%`]].map(([Icon, t]) => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,.18)', padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                  <Icon size={14} /> {t}
                </span>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Kết thúc sau</div>
            <div className="sf-countdown" style={{ gap: 8 }}>
              {[[h, 'Giờ'], [m, 'Phút'], [s, 'Giây']].map(([v, l], i) => (
                <React.Fragment key={l}>
                  {i > 0 && <span style={{ fontSize: 22, fontWeight: 800 }}>:</span>}
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <b style={{ minWidth: 56, height: 52, fontSize: 26, background: '#fff', color: 'var(--sf-primary)' }}>{pad(v)}</b>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{l}</span>
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="sf-section-box" style={{ marginTop: 12 }}>
        <div className="sf-section-links" style={{ marginBottom: 10 }}>
          <button type="button" className={`sf-chip${cat === 'ALL' ? ' is-active' : ''}`} onClick={() => setCat('ALL')}>Tất cả ({deals.length})</button>
          {SF_CATEGORIES.filter(c => counts[c.key]).map(c => (
            <button key={c.key} type="button" className={`sf-chip${cat === c.key ? ' is-active' : ''}`} onClick={() => setCat(c.key)}>
              <c.icon size={14} /> {c.short} ({counts[c.key]})
            </button>
          ))}
        </div>
        <div className="sf-sortbar" style={{ marginTop: 0 }}>
          <span>Sắp xếp:</span>
          {SORTS.map(o => <button key={o.key} type="button" className={`sf-chip${sort === o.key ? ' is-active' : ''}`} onClick={() => setSort(o.key)}>{o.label}</button>)}
        </div>
      </div>

      <section className="sf-section">
        {list.length === 0 ? (
          <div className="sf-empty"><h3>{loading ? 'Đang tải ưu đãi...' : 'Chưa có sản phẩm giảm giá trong danh mục này'}</h3></div>
        ) : (
          <div className="sf-grid">{list.slice(0, shown).map(p => <ProductCard key={p.id} product={p} stockBar />)}</div>
        )}
        {shown < list.length && (
          <div style={{ textAlign: 'center', marginTop: 18 }}>
            <button type="button" className="sf-btn sf-btn-outline sf-btn-lg" onClick={() => setShown(n => n + STEP)}>
              Xem thêm {Math.min(STEP, list.length - shown)} sản phẩm (còn {list.length - shown})
            </button>
          </div>
        )}
      </section>

      <section className="sf-section sf-usp">
        <div className="sf-usp-item"><span className="sf-usp-ic"><Zap size={20} /></span><div><b>Giá áp dụng trong ngày</b><span>Không cộng dồn khuyến mãi khác</span></div></div>
        <div className="sf-usp-item"><span className="sf-usp-ic"><ShieldCheck size={20} /></span><div><b>Bảo hành chính hãng</b><span>Như sản phẩm giá gốc</span></div></div>
        <div className="sf-usp-item"><span className="sf-usp-ic"><Truck size={20} /></span><div><b>Miễn phí giao hàng</b><span>Toàn quốc, mọi đơn hàng</span></div></div>
        <div className="sf-usp-item"><span className="sf-usp-ic"><Package size={20} /></span><div><b>Có sẵn tại kho</b><span>Theo dõi đơn hàng trực tuyến</span></div></div>
      </section>
    </div>
  );
}
