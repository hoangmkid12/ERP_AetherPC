import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Zap, ArrowRight, Flame, Sparkles, Wrench, Clock, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api, normalizeProduct } from '../../services/api';
import BrandLogo from '../../components/BrandLogo';
import CategoryMenu from '../../components/Storefront/CategoryMenu';
import ProductCard, { ProductCarousel } from '../../components/Storefront/ProductCard';
import useCatalog from '../../components/Storefront/useCatalog';
import { SF_CATEGORIES, discountOf, isInStock } from '../../components/Storefront/catalog';

const NEWS_PREVIEW = [
  { id: 1, category: 'Review', title: 'Đánh Giá RTX 4070 Super: Lựa Chọn Hoàn Hảo Tầm Giá 20 Triệu?', excerpt: 'Card đồ họa RTX 4070 Super mang lại hiệu năng vượt trội so với thế hệ trước với mức giá hợp lý hơn.', image: '/news_1.png', date: '18/06/2026', readTime: '5 phút' },
  { id: 2, category: 'Hướng dẫn', title: 'Hướng Dẫn Tự Lắp PC Gaming Từ A-Z Cho Người Mới Bắt Đầu', excerpt: 'Bài viết chi tiết từng bước lắp ráp máy tính, từ chọn linh kiện đến cài đặt hệ điều hành.', image: '/news_2.png', date: '15/06/2026', readTime: '12 phút' },
  { id: 3, category: 'Tin tức', title: 'Intel Core i9-15900K vs AMD Ryzen 9 9900X: Ai Thắng Cuộc?', excerpt: 'Cuộc so sánh nảy lửa giữa hai ông lớn CPU thế hệ mới nhất năm 2026.', image: '/news_3.png', date: '12/06/2026', readTime: '8 phút' },
];

const BRANDS = ['Intel', 'AMD', 'ASUS', 'MSI', 'Gigabyte', 'Corsair', 'Kingston', 'Samsung', 'NZXT', 'Deepcool'];

// Các khối sản phẩm theo danh mục trên trang chủ
const CATEGORY_SECTIONS = [
  { key: 'VGA', title: 'Card màn hình', sub: 'RTX, Radeon chính hãng cho gaming và đồ họa' },
  { key: 'CPU', title: 'CPU - Bộ vi xử lý', sub: 'Intel Core, AMD Ryzen các thế hệ mới' },
  { key: 'MONITOR', title: 'Màn hình', sub: 'Tần số quét cao, tấm nền IPS/OLED' },
  { key: 'MAINBOARD', title: 'Bo mạch chủ', sub: 'Đủ chipset cho mọi cấu hình' },
  { key: 'MOUSE', title: 'Chuột gaming', sub: 'Cảm biến chính xác, thiết kế công thái học' },
];

// Đếm ngược đến cuối ngày cho khối Flash Sale
function useEndOfDayCountdown() {
  const calc = () => {
    const now = new Date();
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    const d = Math.max(0, end - now);
    return { h: Math.floor(d / 3600000), m: Math.floor(d / 60000) % 60, s: Math.floor(d / 1000) % 60 };
  };
  const [t, setT] = useState(calc);
  useEffect(() => { const id = setInterval(() => setT(calc()), 1000); return () => clearInterval(id); }, []);
  return t;
}

// Sản phẩm nổi bật của một danh mục: còn hàng trước, giảm giá sâu trước
function topOf(products, cat, n = 10) {
  return products
    .filter(p => p.category === cat && p.price > 0)
    .sort((a, b) => (isInStock(b) - isInStock(a)) || (discountOf(b) - discountOf(a)))
    .slice(0, n);
}

function HeroSlider({ slides }) {
  const [cur, setCur] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCur(c => (c + 1) % slides.length), 5500);
    return () => clearInterval(id);
  }, [slides.length]);
  const go = (d) => setCur(c => (c + d + slides.length) % slides.length);
  return (
    <div className="sf-hero-main">
      {slides.map((s, i) => (
        <div key={s.key} className={`sf-slide${i === cur ? ' is-on' : ''}`} aria-hidden={i !== cur}>
          <div className="sf-slide-bg" style={{ backgroundImage: `url(${s.image})` }} />
          <div className="sf-slide-body">
            <span className="sf-slide-kicker">{s.kicker}</span>
            <h2>{s.title}<br /><em>{s.highlight}</em></h2>
            <p>{s.desc}</p>
            <div className="sf-slide-actions">
              <Link to={s.cta.to} className="sf-btn sf-btn-primary sf-btn-lg">{s.cta.label} <ArrowRight size={16} /></Link>
              {s.cta2 && <Link to={s.cta2.to} className="sf-btn sf-btn-lg" style={{ background: 'rgba(255,255,255,.14)', color: '#fff' }}>{s.cta2.label}</Link>}
            </div>
          </div>
          {s.products?.length > 0 && (
            <div className="sf-slide-products">
              {s.products.map(p => (
                <Link key={p.id} to={`/product/${p.id}`} title={p.name}><img src={p.image} alt={p.name} /></Link>
              ))}
            </div>
          )}
        </div>
      ))}
      <button type="button" className="sf-hero-arrow prev" onClick={() => go(-1)} aria-label="Banner trước"><ChevronLeft size={20} /></button>
      <button type="button" className="sf-hero-arrow next" onClick={() => go(1)} aria-label="Banner sau"><ChevronRight size={20} /></button>
      <div className="sf-dots">
        {slides.map((s, i) => <button key={s.key} type="button" className={i === cur ? 'is-on' : ''} onClick={() => setCur(i)} aria-label={`Banner ${i + 1}`} />)}
      </div>
    </div>
  );
}

function PromoTile({ to, tone, kicker, title, cta, product }) {
  return (
    <Link to={to} className={`sf-promo sf-promo-${tone}`}>
      {product?.image && <img className="p" src={product.image} alt="" />}
      <span className="k">{kicker}</span>
      <span className="t">{title}</span>
      <span className="c">{cta} <ArrowRight size={13} /></span>
    </Link>
  );
}

function SectionHead({ title, accent, sub, links, viewAll, icon }) {
  return (
    <div className="sf-section-head">
      <div>
        <h2 className="sf-section-title">{icon}{title} {accent && <span className="accent">{accent}</span>}</h2>
        {sub && <p className="sf-section-sub">{sub}</p>}
      </div>
      {links && <div className="sf-section-links">{links}</div>}
      {viewAll && <Link to={viewAll} className="sf-viewall">Xem tất cả <ChevronRight size={15} /></Link>}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth() || {};
  const location = useLocation();
  const { products } = useCatalog();
  const [bestSellers, setBestSellers] = useState([]);
  const [personalized, setPersonalized] = useState({ list: [], on: false });
  const { h, m, s } = useEndOfDayCountdown();

  useEffect(() => {
    api.get('/products/best-sellers?limit=10')
      .then(res => { const l = res?.data || res; if (Array.isArray(l)) setBestSellers(l.map(normalizeProduct)); })
      .catch(() => {});
    api.get('/products/personalized?limit=10')
      .then(res => { const l = res?.data || res; if (Array.isArray(l)) setPersonalized({ list: l.map(normalizeProduct), on: Boolean(res?.personalized) }); })
      .catch(() => {});
  }, [user?.id]);

  const flash = useMemo(() => products
    .filter(p => isInStock(p) && discountOf(p) >= 15 && p.price > 0)
    .sort((a, b) => discountOf(b) - discountOf(a))
    .slice(0, 12), [products]);

  const byCat = useMemo(() => {
    const o = {};
    for (const c of SF_CATEGORIES) o[c.key] = topOf(products, c.key, 10);
    return o;
  }, [products]);

  const maxOff = (cat) => Math.max(0, ...products.filter(p => !cat || p.category === cat).map(discountOf));
  const brandsOf = (cat) => {
    const cnt = {};
    products.forEach(p => { if (p.category === cat && p.brand && p.brand !== 'Khác') cnt[p.brand] = (cnt[p.brand] || 0) + 1; });
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([b]) => b);
  };
  const first = (cat, i = 0) => byCat[cat]?.[i];

  const slides = [
    {
      key: 'sale', image: '/hero_banner.png', kicker: 'Flash sale hôm nay',
      title: 'Linh kiện PC chính hãng', highlight: `Giảm đến ${maxOff() || 30}%`,
      desc: 'CPU, VGA, mainboard, RAM, SSD bảo hành 24–36 tháng. Số lượng có hạn mỗi ngày.',
      cta: { label: 'Săn deal ngay', to: '/flash-sale' }, cta2: { label: 'Xem khuyến mãi', to: '/promotions' },
      products: flash.slice(0, 3),
    },
    {
      key: 'build', image: '/promo_banner.png', kicker: 'Build PC theo ý bạn',
      title: 'Tự chọn cấu hình,', highlight: 'kiểm tra tương thích tự động',
      desc: 'Hệ thống tự kiểm tra socket, chuẩn RAM, công suất nguồn. Kỹ thuật viên lắp ráp và test trước khi giao.',
      cta: { label: 'Bắt đầu build PC', to: '/pc-builder' }, cta2: { label: 'Xem CPU & VGA', to: '/products?category=VGA' },
      products: [first('CPU'), first('VGA'), first('MAINBOARD')].filter(Boolean),
    },
    {
      key: 'monitor', image: '/news_3.png', kicker: 'Góc gaming',
      title: 'Màn hình tần số quét cao', highlight: `Ưu đãi đến ${maxOff('MONITOR') || 20}%`,
      desc: 'Màn hình 144Hz – 240Hz, tấm nền IPS và OLED cho trải nghiệm chơi game mượt mà.',
      cta: { label: 'Chọn màn hình', to: '/products?category=MONITOR&sort=discount' }, cta2: { label: 'Chuột gaming', to: '/products?category=MOUSE' },
      products: (byCat.MONITOR || []).slice(0, 3),
    },
  ];

  // Liên kết cũ dạng /?cat=CPU hoặc /?scroll=products → trang danh sách mới
  const legacy = new URLSearchParams(location.search);
  if (legacy.get('cat')) return <Navigate to={`/products?category=${legacy.get('cat').toUpperCase()}`} replace />;
  if (legacy.get('scroll') === 'products') return <Navigate to="/products" replace />;

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="sf-container">
      {/* ── Banner: menu danh mục | slider | 2 banner phụ ── */}
      <div className="sf-hero">
        <CategoryMenu inline />
        <HeroSlider slides={slides} />
        <div className="sf-hero-side">
          <PromoTile to="/products?category=VGA&sort=discount" tone="red" kicker="Card màn hình" title={`Giảm đến ${maxOff('VGA')}%`} cta="Mua ngay" product={first('VGA', 1)} />
          <PromoTile to="/pc-builder" tone="dark" kicker="Dịch vụ" title="Lắp ráp & test PC miễn phí" cta="Build ngay" product={first('CASE')} />
        </div>
      </div>
      <div className="sf-strip">
        <PromoTile to="/products?category=CPU&sort=discount" tone="blue" kicker="CPU Intel · AMD" title={`Giảm đến ${maxOff('CPU')}%`} cta="Xem ngay" product={first('CPU', 1)} />
        <PromoTile to="/products?category=MONITOR" tone="violet" kicker="Màn hình gaming" title="144Hz – 240Hz" cta="Khám phá" product={first('MONITOR', 1)} />
        <PromoTile to="/products?category=COOLER" tone="green" kicker="Tản nhiệt" title="Mát mẻ, êm ái" cta="Xem ngay" product={first('COOLER')} />
        <PromoTile to="/products?category=PSU" tone="amber" kicker="Nguồn máy tính" title="Ổn định, bền bỉ" cta="Xem ngay" product={first('PSU')} />
      </div>

      {/* ── Flash sale ── */}
      {flash.length > 0 && (
        <section className="sf-section sf-flash">
          <div className="sf-flash-head">
            <h2 className="sf-flash-title"><Zap size={26} /> Flash Sale</h2>
            <div className="sf-countdown">
              <span>Kết thúc sau</span><b>{pad(h)}</b>:<b>{pad(m)}</b>:<b>{pad(s)}</b>
            </div>
            <Link to="/flash-sale" className="sf-viewall">Xem tất cả <ChevronRight size={15} /></Link>
          </div>
          <ProductCarousel products={flash} render={p => <ProductCard key={p.id} product={p} showSpecs={false} stockBar />} />
        </section>
      )}

      {/* ── Danh mục nổi bật ── */}
      <section className="sf-section sf-section-box">
        <SectionHead title="Danh mục" accent="nổi bật" />
        <div className="sf-catgrid">
          {SF_CATEGORIES.map(c => {
            const p = first(c.key);
            const Icon = c.icon;
            return (
              <Link key={c.key} to={`/products?category=${c.key}`}>
                {p?.image ? <img src={p.image} alt="" /> : <span className="ic" style={{ background: c.tint, color: c.color }}><Icon size={26} /></span>}
                <span>{c.label}</span>
              </Link>
            );
          })}
          <Link to="/pc-builder">
            <span className="ic" style={{ background: '#fee2e2', color: '#d70018' }}><Wrench size={26} /></span>
            <span>Build PC</span>
          </Link>
        </div>
      </section>

      {/* ── Bán chạy (số liệu bán thật) ── */}
      {bestSellers.length > 0 && (
        <section className="sf-section sf-section-box">
          <SectionHead icon={<Flame size={22} color="#d70018" />} title="Sản phẩm" accent="bán chạy" sub="Xếp hạng theo số lượng bán thực tế tại AetherPC" viewAll="/products?sort=popular" />
          <ProductCarousel products={bestSellers} render={(p, i) => <ProductCard key={p.id} product={p} badge={`Top ${i + 1}`} />} />
        </section>
      )}

      {/* ── Gợi ý theo lịch sử mua hàng ── */}
      {personalized.on && personalized.list.length > 0 && (
        <section className="sf-section sf-section-box">
          <SectionHead icon={<Sparkles size={22} color="#d70018" />} title="Gợi ý" accent="dành cho bạn" sub="Dựa trên các sản phẩm bạn đã mua" />
          <ProductCarousel products={personalized.list} />
        </section>
      )}

      {/* ── Khối theo danh mục ── */}
      {CATEGORY_SECTIONS.map((sec, idx) => (byCat[sec.key]?.length > 0) && (
        <React.Fragment key={sec.key}>
          {idx === 2 && (
            <section className="sf-section">
              <div className="sf-wide-banner">
                <div>
                  <h3>Chưa biết chọn cấu hình nào?</h3>
                  <p>Dùng công cụ Build PC để chọn từng linh kiện, hệ thống tự cảnh báo khi không tương thích. Kỹ thuật viên AetherPC lắp ráp, kiểm tra và giao tận nơi.</p>
                  <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Link to="/pc-builder" className="sf-btn sf-btn-primary sf-btn-lg"><Wrench size={16} /> Build PC ngay</Link>
                    <Link to="/promotions" className="sf-btn sf-btn-lg" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>Ưu đãi lắp ráp</Link>
                  </div>
                </div>
                <div className="imgs">
                  {['CPU', 'VGA', 'MAINBOARD', 'RAM'].map(k => first(k) && <span key={k}><img src={first(k).image} alt="" /></span>)}
                </div>
              </div>
            </section>
          )}
          <section className="sf-section sf-section-box">
            <SectionHead title={sec.title} sub={sec.sub} viewAll={`/products?category=${sec.key}`}
              links={brandsOf(sec.key).map(b => (
                <Link key={b} className="sf-chip" to={`/products?category=${sec.key}&brand=${encodeURIComponent(b)}`}>{b}</Link>
              ))} />
            <ProductCarousel products={byCat[sec.key]} />
          </section>
        </React.Fragment>
      ))}

      {/* ── Thương hiệu ── */}
      <section className="sf-section sf-section-box">
        <SectionHead title="Thương hiệu" accent="chính hãng" />
        <div className="sf-brands">
          {BRANDS.slice(0, 8).map(b => (
            <Link key={b} to={`/products?brand=${encodeURIComponent(b)}`} title={`Sản phẩm ${b}`} style={{ color: '#374151' }}>
              <BrandLogo name={b} height={22} />
            </Link>
          ))}
        </div>
      </section>

      {/* ── Tin tức ── */}
      <section className="sf-section sf-section-box">
        <SectionHead title="Tin tức" accent="công nghệ" sub="Đánh giá, hướng dẫn build PC và tin tức phần cứng" viewAll="/news" />
        <div className="sf-news-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {NEWS_PREVIEW.map(n => (
            <Link key={n.id} to={`/news/${n.id}`} className="sf-news-card">
              <div className="img"><img src={n.image} alt={n.title} loading="lazy" /></div>
              <div className="body">
                <span className="cat">{n.category}</span>
                <h3>{n.title}</h3>
                <p>{n.excerpt}</p>
                <div className="meta"><span><Calendar size={12} /> {n.date}</span><span><Clock size={12} /> {n.readTime} đọc</span></div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
