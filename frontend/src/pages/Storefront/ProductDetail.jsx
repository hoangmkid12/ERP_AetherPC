import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { api } from '../../services/api';
import {
  ShoppingCart, Star, Shield, Truck, RotateCcw,
  ChevronRight, ChevronLeft, ThumbsUp, Send, Check,
  Minus, Plus, Heart, Package, Zap, ArrowLeft,
  Settings, FileText, MessageSquare, Calendar, Clock, Sparkles
} from 'lucide-react';

// ─── Fallback products ────────────────────────────────────────────────────────
const FALLBACK_PRODUCTS = [
  { id: 1, sku: 'CPU-INT-I5-13400F', name: 'Intel Core i5-13400F', category: 'CPU', price: 4890000, brand: 'Intel', specs: { socket: 'LGA1700', cores: 10, threads: 16, tdp: 65 } },
  { id: 2, sku: 'CPU-INT-I7-14700K', name: 'Intel Core i7-14700K', category: 'CPU', price: 10990000, brand: 'Intel', specs: { socket: 'LGA1700', cores: 20, threads: 28, tdp: 125 } },
  { id: 3, sku: 'MBD-ASU-B760F-STRIX', name: 'ASUS ROG STRIX B760-F Gaming WiFi', category: 'MAINBOARD', price: 5490000, brand: 'ASUS', specs: { socket: 'LGA1700', ram_slot: 4, ram_type: 'DDR5', size_format: 'ATX' } },
  { id: 4, sku: 'MBD-MSI-H610ME-PRO', name: 'MSI PRO H610M-E DDR4', category: 'MAINBOARD', price: 1850000, brand: 'MSI', specs: { socket: 'LGA1700', ram_slot: 2, ram_type: 'DDR4', size_format: 'Micro-ATX' } },
  { id: 5, sku: 'RAM-COR-VEN-32G-6000', name: 'Corsair Vengeance RGB 32GB DDR5 6000MHz', category: 'RAM', price: 3250000, brand: 'Corsair', specs: { ram_type: 'DDR5', capacity: '32GB', speed: '6000MHz' } },
  { id: 6, sku: 'RAM-KIN-FUR-16G-3200', name: 'Kingston Fury Beast 16GB DDR4 3200MHz', category: 'RAM', price: 1050000, brand: 'Kingston', specs: { ram_type: 'DDR4', capacity: '16GB', speed: '3200MHz' } },
  { id: 7, sku: 'VGA-ASU-4070S-STRIX', name: 'ASUS ROG Strix RTX 4070 Super 12GB OC', category: 'VGA', price: 21990000, brand: 'ASUS', specs: { chipset: 'RTX 4070 Super', vram: '12GB', tdp: 220 } },
  { id: 8, sku: 'VGA-MSI-4060-VENTUS', name: 'MSI GeForce RTX 4060 Ventus 2X 8GB OC', category: 'VGA', price: 8390000, brand: 'MSI', specs: { chipset: 'RTX 4060', vram: '8GB', tdp: 115 } },
  { id: 9, sku: 'PSU-COR-RM750E-GOLD', name: 'Corsair RM750e 750W 80 Plus Gold', category: 'PSU', price: 2890000, brand: 'Corsair', specs: { wattage: 750, rating: '80 Plus Gold', modular: 'Full' } },
  { id: 10, sku: 'PSU-MSI-A650BN-BRONZE', name: 'MSI MAG A650BN 650W 80 Plus Bronze', category: 'PSU', price: 1390000, brand: 'MSI', specs: { wattage: 650, rating: '80 Plus Bronze', modular: 'No' } },
  { id: 11, sku: 'SSD-SAM-990PRO-1TB', name: 'Samsung 990 PRO 1TB PCIe 4.0 NVMe', category: 'STORAGE', price: 2990000, brand: 'Samsung', specs: { type: 'SSD NVMe', size: 'M.2 2280', speed_read: '7450MB/s' } },
  { id: 12, sku: 'CAS-NZX-H5-FLOW', name: 'NZXT H5 Flow Black', category: 'CASE', price: 2390000, brand: 'NZXT', specs: { size_format: 'ATX', max_vga_length: 365 } },
  { id: 13, sku: 'COL-DEE-AK400-DIG', name: 'Deepcool AK400 Digital', category: 'COOLER', price: 850000, brand: 'Deepcool', specs: { type: 'Air Cooling', max_tdp: 220 } },
];

// ─── Reviews ──────────────────────────────────────────────────────────────────
const REVIEW_TEMPLATES = [
  { user: 'Nguyễn Văn A.', stars: 5, title: 'Sản phẩm tuyệt vời!', body: 'Mua về dùng rất ổn, hiệu năng vượt mong đợi. Đóng gói cẩn thận, giao hàng nhanh. Sẽ ủng hộ AetherPC lần sau.', helpful: 24, date: '15/06/2026' },
  { user: 'Trần Thị B.', stars: 5, title: 'Chính hãng, giá tốt', body: 'Hàng chính hãng 100%, box nguyên seal. Giá tại AetherPC cạnh tranh hơn nhiều nơi khác. Kỹ thuật viên tư vấn rất nhiệt tình.', helpful: 18, date: '10/06/2026' },
  { user: 'Lê Minh C.', stars: 4, title: 'Hàng tốt, ship hơi chậm', body: 'Sản phẩm đúng mô tả, chất lượng ổn định. Chỉ hơi chậm 1 ngày so với dự kiến giao hàng. Nhìn chung vẫn hài lòng.', helpful: 9, date: '05/06/2026' },
  { user: 'Phạm Quốc D.', stars: 5, title: 'Đỉnh của đỉnh!', body: 'Đây là lần thứ 3 mình mua linh kiện tại AetherPC. Luôn tin tưởng ở đây vì hàng chính hãng và được bảo hành đầy đủ.', helpful: 31, date: '28/05/2026' },
  { user: 'Hoàng Thu E.', stars: 4, title: 'Mua để nâng cấp PC', body: 'Mua để lên đời cụm build cũ, chạy ngon lắm. Cài đặt dễ, driver đầy đủ. Chỉ tiếc là không có quà tặng kèm như đợt flash sale.', helpful: 7, date: '20/05/2026' },
  { user: 'Võ Thanh F.', stars: 5, title: 'Giao hàng siêu nhanh', body: 'Đặt lúc 9h sáng, 2h chiều đã nhận được hàng! Đóng gói rất kỹ lưỡng, có xốp chèn đầy đủ. Linh kiện hoạt động tốt ngay lần đầu cắm vào.', helpful: 15, date: '18/05/2026' },
];

function generateReviews(id) {
  return REVIEW_TEMPLATES.slice(0, 3 + (id % 4));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

const SPEC_LABEL_MAP = {
  'socket': 'Socket',
  'cores': 'Số nhân',
  'threads': 'Số luồng',
  'tdp': 'TDP',
  'ram_slot': 'Số khe RAM',
  'ram_slots': 'Số khe RAM',
  'ram_type': 'Loại RAM',
  'size_format': 'Chuẩn kích thước',
  'capacity': 'Dung lượng',
  'speed': 'Tốc độ',
  'bus': 'Bus RAM',
  'chipset': 'Chipset',
  'vram': 'VRAM',
  'wattage': 'Công suất',
  'rating': 'Chứng nhận hiệu suất',
  'modular': 'Chuẩn cáp',
  'type': 'Loại',
  'size': 'Kích thước',
  'speed_read': 'Tốc độ đọc',
  'read_speed': 'Tốc độ đọc',
  'write_speed': 'Tốc độ ghi',
  'max_vga_length': 'Hỗ trợ VGA tối đa',
  'max_tdp': 'TDP tối đa hỗ trợ',
  'cooling_type': 'Loại tản nhiệt',
  'fan_size': 'Kích thước quạt',
  'fan_rgb': 'Đèn LED',
  'bộ nhớ và tốc độ hỗ trợ (mt/s)': 'Tốc độ RAM tối đa',
  'tần số turbo tối đa của p-core': 'Xung P-core tối đa',
  'bộ nhớ đệm intel® smart (l3)': 'Bộ nhớ đệm L3',
  'tần số cơ bản của e-core': 'Xung cơ bản E-core',
  'tần số cơ bản của p-core': 'Xung cơ bản P-core',
  'nhân đồ họa': 'Đồ họa tích hợp',
  'đồ họa tích hợp': 'Đồ họa tích hợp',
  'số làn cpu pcie': 'Số làn PCIe',
  'dòng cpu': 'Dòng CPU',
  'bộ nhớ đệm l2 tổng': 'Bộ nhớ đệm L2',
  'xung nhịp tối đa': 'Xung nhịp tối đa',
  'socket_support': 'Hỗ trợ Socket'
};

function getSpecLabel(key) {
  const normalized = String(key).toLowerCase().trim();
  return SPEC_LABEL_MAP[normalized] || (key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '));
}


function StarRating({ value, max = 5, size = 16, onChange }) {
  const [hover, setHover] = useState(null);
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {Array.from({ length: max }, (_, i) => i + 1).map((s) => {
        const on = (hover ?? value) >= s;
        return (
          <Star key={s} size={size}
            fill={on ? '#f59e0b' : 'none'} stroke={on ? '#f59e0b' : '#64748b'}
            style={{ cursor: onChange ? 'pointer' : 'default', transition: 'all 0.1s' }}
            onMouseEnter={() => onChange && setHover(s)}
            onMouseLeave={() => onChange && setHover(null)}
            onClick={() => onChange && onChange(s)}
          />
        );
      })}
    </div>
  );
}

function RatingBar({ stars, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '32px', textAlign: 'right', flexShrink: 0 }}>{stars}★</span>
      <div style={{ flex: 1, height: '7px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', borderRadius: '99px', transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '28px', flexShrink: 0 }}>{count}</span>
    </div>
  );
}

const TRUST = [
  { icon: <Shield size={18} />, label: 'Bảo hành chính hãng', sub: '24–36 tháng', color: '#10b981' },
  { icon: <Truck size={18} />, label: 'Giao nhanh toàn quốc', sub: '1–2 ngày', color: '#0ea5e9' },
  { icon: <RotateCcw size={18} />, label: 'Đổi trả miễn phí', sub: '7 ngày lỗi', color: '#f59e0b' },
  { icon: <Package size={18} />, label: 'Đóng gói cẩn thận', sub: 'Chống va đập', color: '#6366f1' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, isInWishlist } = useCart();
  const fav = isInWishlist(id);

  const [product, setProduct] = useState(() => {
    const cached = localStorage.getItem('aetherpc_products');
    if (cached) {
      const list = JSON.parse(cached);
      return list.find(p => String(p.id) === String(id)) || null;
    }
    return FALLBACK_PRODUCTS.find(p => String(p.id) === String(id)) || null;
  });

  const [allProducts, setAllProducts] = useState(() => {
    const cached = localStorage.getItem('aetherpc_products');
    return cached ? JSON.parse(cached) : FALLBACK_PRODUCTS;
  });

  const [loading, setLoading] = useState(() => {
    const cached = localStorage.getItem('aetherpc_products');
    if (cached) {
      const list = JSON.parse(cached);
      return !list.some(p => String(p.id) === String(id));
    }
    return !FALLBACK_PRODUCTS.some(p => String(p.id) === String(id));
  });

  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState('specs');
  const [activeImg, setActiveImg] = useState(null);
  const thumbnailRef = useRef(null);
  
  const [reviews, setReviews] = useState(() => {
    const cached = localStorage.getItem('aetherpc_products');
    let foundId = null;
    if (cached) {
      const list = JSON.parse(cached);
      const found = list.find(p => String(p.id) === String(id));
      if (found) foundId = found.id;
    }
    if (!foundId) {
      const found = FALLBACK_PRODUCTS.find(p => String(p.id) === String(id));
      if (found) foundId = found.id;
    }
    return foundId ? generateReviews(foundId) : [];
  });

  const [cartOk, setCartOk] = useState(false);
  const [reviewForm, setReviewForm] = useState({ name: '', title: '', body: '', stars: 0 });
  const [reviewDone, setReviewDone] = useState(false);
  const [helpful, setHelpful] = useState({});
  const [rfil, setRfil] = useState('all');

  useEffect(() => {
    window.scrollTo(0, 0);
    setActiveImg(null);
    const load = async () => {
      const cached = localStorage.getItem('aetherpc_products');
      let hasProduct = false;
      if (cached) {
        const list = JSON.parse(cached);
        hasProduct = list.some(p => String(p.id) === String(id));
      } else {
        hasProduct = FALLBACK_PRODUCTS.some(p => String(p.id) === String(id));
      }

      if (!hasProduct) {
        setLoading(true);
      }

      try {
        const data = await api.get('/products');
        const list = data && data.length > 0 ? data : FALLBACK_PRODUCTS;
        setAllProducts(list);
        localStorage.setItem('aetherpc_products', JSON.stringify(list));
        const found = list.find(p => String(p.id) === String(id));
        setProduct(found || null);
        if (found) setReviews(generateReviews(found.id));
      } catch {
        const list = cached ? JSON.parse(cached) : FALLBACK_PRODUCTS;
        setAllProducts(list);
        const found = list.find(p => String(p.id) === String(id));
        setProduct(found || null);
        if (found) setReviews(generateReviews(found.id));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleCart = () => {
    if (!product) return;
    addToCart(product, qty);
    setCartOk(true);
    setTimeout(() => setCartOk(false), 2500);
  };

  const handleBuyNow = () => {
    if (!product) return;
    addToCart(product, qty);
    navigate('/cart');
  };

  const handleReview = (e) => {
    e.preventDefault();
    if (reviewForm.stars === 0) return;
    setReviews(r => [{ user: reviewForm.name || 'Ẩn danh', stars: reviewForm.stars, title: reviewForm.title, body: reviewForm.body, helpful: 0, date: new Date().toLocaleDateString('vi-VN') }, ...r]);
    setReviewDone(true);
    setReviewForm({ name: '', title: '', body: '', stars: 0 });
    setTimeout(() => setReviewDone(false), 3500);
  };

  const avg = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.stars, 0) / reviews.length).toFixed(1) : 0;
  const starCounts = [5, 4, 3, 2, 1].map(s => ({ stars: s, count: reviews.filter(r => r.stars === s).length }));
  const related = allProducts.filter(p => product && p.category === product.category && String(p.id) !== String(id)).slice(0, 4);
  const filteredReviews = rfil === 'all' ? reviews : reviews.filter(r => r.stars === parseInt(rfil));

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-glass)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: 'var(--text-muted)' }}>Đang tải sản phẩm...</p>
    </div>
  );

  if (!product) return (
    <div style={{ textAlign: 'center', padding: '6rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <Package size={60} style={{ color: 'var(--text-muted)' }} />
      </div>
      <h2 style={{ marginBottom: '0.5rem' }}>Không tìm thấy sản phẩm</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Sản phẩm có thể đã ngừng kinh doanh.</p>
      <button onClick={() => navigate('/')} className="btn btn-primary"><ArrowLeft size={15} /> Về Trang Chủ</button>
    </div>
  );

  const showDiscount = product.discountPercent > 0;
  const imgSrc = product.image || `https://placehold.co/500x400/1e263d/94a3b8?text=${product.category}`;
  const specEntries = Object.entries(product.specs || {});

  const productImages = (() => {
    const raw = product.imageUrls || [];
    const list = [product.image || product.primaryImage || '', ...raw];
    const unique = [...new Set(list)].filter(Boolean);
    return unique.map(url => ({ url, style: {} }));
  })();

  return (
    <div style={{ paddingBottom: '5rem' }}>

      {/* ── Breadcrumb ── */}
      <div style={{
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.85rem 0',
        marginBottom: '2rem',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#64748b', flexWrap: 'wrap' }}>
          <Link to="/" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>Trang Chủ</Link>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <Link to={`/?cat=${product.category}`} style={{ color: '#475569', fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = '#2563eb'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}>{product.category}</Link>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <span style={{ color: '#0f172a', fontWeight: 700, maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</span>
        </div>
      </div>

      <div className="container">

        {/* ══════════════════════════════════════════════════════
            MAIN PRODUCT PANEL  (image left | info right)
        ════════════════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '2.5rem', marginBottom: '2.5rem', alignItems: 'stretch' }}>

          {/* ── LEFT: Image ── */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
            <div style={{ background: '#fff', borderRadius: 'var(--radius-2xl)', padding: '2rem', height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              {showDiscount && (
                <span style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'var(--danger)', color: '#fff', fontSize: '0.875rem', fontWeight: 800, padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-md)', zIndex: 10 }}>
                  -{product.discountPercent}%
                </span>
              )}
              <img src={activeImg?.url || imgSrc} alt={product.name}
                style={{
                  maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                  transition: 'transform 0.3s',
                  ...(activeImg?.style || {})
                }}
                onMouseEnter={e => {
                  if (!activeImg?.style?.transform) {
                    e.currentTarget.style.transform = 'scale(1.04)';
                  }
                }}
                onMouseLeave={e => {
                  if (!activeImg?.style?.transform) {
                    e.currentTarget.style.transform = 'none';
                  }
                }}
                onError={e => { e.target.src = `https://placehold.co/400x320/f1f5f9/64748b?text=${product.category}`; }}
              />
            </div>
            {/* Thumbnails slider */}
            {productImages.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', width: '100%' }}>
                {/* Prev Button */}
                <button
                  onClick={() => thumbnailRef.current?.scrollBy({ left: -180, behavior: 'smooth' })}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)',
                    color: 'var(--text-primary)', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Thumbnails Scroll Container */}
                <div
                  ref={thumbnailRef}
                  className="no-scrollbar"
                  style={{
                    display: 'flex', gap: '0.75rem', overflowX: 'auto',
                    scrollbarWidth: 'none', msOverflowStyle: 'none',
                    scrollBehavior: 'smooth', flex: 1, padding: '2px 0'
                  }}
                >
                  <style>{`
                    .no-scrollbar::-webkit-scrollbar {
                      display: none;
                    }
                  `}</style>
                  {productImages.map((imgObj, idx) => {
                    const isSelected = activeImg ? activeImg.url === imgObj.url && JSON.stringify(activeImg.style) === JSON.stringify(imgObj.style) : idx === 0;
                    return (
                      <div key={idx}
                        onClick={() => setActiveImg(imgObj)}
                        style={{
                          width: '72px', height: '72px', background: '#fff',
                          borderRadius: 'var(--radius-md)', padding: '0.375rem',
                          border: `2px solid ${isSelected ? 'var(--primary)' : 'rgba(0,0,0,0.08)'}`,
                          cursor: 'pointer', overflow: 'hidden', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          transition: 'border-color 0.2s, transform 0.2s',
                          flexShrink: 0,
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                      >
                        <img src={imgObj.url} alt=""
                          style={{
                            maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                            ...(imgObj.style || {})
                          }}
                          onError={e => { e.target.src = 'https://placehold.co/60x60/f1f5f9/64748b?text=+'; }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => thumbnailRef.current?.scrollBy({ left: 180, behavior: 'smooth' })}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)',
                    color: 'var(--text-primary)', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT: Info ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem', height: '100%', minWidth: 0 }}>

            {/* ① Badges + Title */}
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem' }}>{product.category}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Thương hiệu: <strong style={{ color: 'var(--secondary)' }}>{product.brand}</strong>
                </span>
                {showDiscount && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.55rem', background: 'rgba(239,68,68,0.12)', color: 'var(--danger)', borderRadius: '99px', border: '1px solid rgba(239,68,68,0.25)' }}>
                    Giảm giá
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, lineHeight: 1.4, color: 'var(--text-primary)', margin: 0 }}>{product.name}</h1>
              {product.sku && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Mã sản phẩm (SKU): <strong style={{ color: 'var(--warning)', fontFamily: 'monospace' }}>{product.sku}</strong>
                </div>
              )}
            </div>

            {/* ② Rating + In-stock */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.875rem', borderBottom: '1px solid var(--border-glass)' }}>
              <StarRating value={Math.round(parseFloat(avg))} size={14} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b' }}>{avg}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({reviews.length} đánh giá)</span>
              {product.available && product.stockQuantity > 0 ? (
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                  ✓ Còn {product.stockQuantity} sản phẩm
                </span>
              ) : product.available && product.stockQuantity === 0 ? (
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 600 }}>
                  ✓ Hàng đặt trước
                </span>
              ) : (
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>
                  ✗ Ngừng kinh doanh
                </span>
              )}
            </div>

            {/* ③ Price */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--success)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {fmt(product.price)}
              </span>
              {showDiscount && product.originalPrice > product.price && (
                <>
                  <span style={{ fontSize: '1rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>{fmt(product.originalPrice)}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', background: 'rgba(239,68,68,0.12)', color: 'var(--danger)', borderRadius: '99px', border: '1px solid rgba(239,68,68,0.2)' }}>
                    -{product.discountPercent}%
                  </span>
                </>
              )}
            </div>

            {/* ④ Specs — compact chips (chỉ 3 thông số nổi bật) */}
            {specEntries.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.425rem' }}>
                {specEntries.slice(0, 3).map(([k, v]) => (
                  <span key={k} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.25rem 0.625rem',
                    background: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: '99px', fontSize: '0.75rem',
                  }}>
                    <span style={{ color: 'var(--text-muted)', textTransform: 'none' }}>{getSpecLabel(k)}:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{Array.isArray(v) ? v.join(', ') : String(v)}</strong>
                  </span>
                ))}
                {specEntries.length > 3 && (
                  <button onClick={() => setActiveTab('specs')}
                    style={{ padding: '0.25rem 0.625rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)', borderRadius: '99px', fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    +{specEntries.length - 3} thêm ↓
                  </button>
                )}
              </div>
            )}

            {/* ⑤ Qty + Add to cart + Buy now + Wishlist — TWO ROWS */}
            {(() => {
              const inStock = (Number(product.stockQuantity) > 0 || Number(product.stock) > 0) && !product.isPreorder;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                  
                  {/* Preorder Notice Banner */}
                  {!inStock && (
                    <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', color: '#b45309', fontSize: '0.82rem', lineHeight: '1.45' }}>
                      ⏳ <strong>Sản Phẩm Đặt Trước:</strong> Mặt hàng này hiện đang tạm hết sẵn tại kho. Quý khách vui lòng liên hệ Hotline <strong style={{ color: '#d97706' }}>0912.888.999</strong> hoặc Live Chat CSKH để được hỗ trợ đặt giữ hàng!
                    </div>
                  )}

                  {/* Row 1: Qty stepper + Wishlist */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {/* Qty stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0, height: '44px', opacity: inStock ? 1 : 0.5 }}>
                      <button disabled={!inStock} onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: '36px', height: '44px', background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-primary)', cursor: inStock ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Minus size={13} />
                      </button>
                      <span style={{ width: '36px', textAlign: 'center', fontWeight: 700, background: 'var(--bg-secondary)', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9375rem' }}>{qty}</span>
                      <button disabled={!inStock} onClick={() => setQty(q => q + 1)} style={{ width: '36px', height: '44px', background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-primary)', cursor: inStock ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={13} />
                      </button>
                    </div>

                    {/* Wishlist */}
                    <button onClick={() => product && toggleWishlist(product)} style={{
                      width: '44px', height: '44px', flexShrink: 0,
                      background: fav ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${fav ? 'rgba(239,68,68,0.35)' : 'var(--border-glass)'}`,
                      borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                    }}>
                      <Heart size={15} fill={fav ? '#ef4444' : 'none'} stroke={fav ? '#ef4444' : 'var(--text-muted)'} />
                    </button>
                  </div>

                  {/* Row 2: Add to cart + Buy now */}
                  <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                    {inStock ? (
                      <>
                        {/* Add to cart */}
                        <button onClick={handleCart} className="btn btn-primary" style={{
                          flex: 1, height: '44px', fontSize: '0.875rem', fontWeight: 700, gap: '0.4rem',
                          background: cartOk ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,var(--primary),#4f46e5)',
                          transition: 'all 0.3s', borderRadius: 'var(--radius-md)', minWidth: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {cartOk ? <><Check size={14} />Đã thêm!</> : <><ShoppingCart size={14} />Thêm Vào Giỏ</>}
                        </button>

                        {/* Buy now */}
                        <button onClick={handleBuyNow} style={{
                          flex: 1, height: '44px', fontSize: '0.875rem', fontWeight: 700, gap: '0.4rem',
                          border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-md)',
                          background: 'linear-gradient(135deg,#059669,#10b981)',
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-sans)', transition: 'opacity 0.2s', minWidth: 0,
                        }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                          <Zap size={14} />Mua Ngay
                        </button>
                      </>
                    ) : (
                      <button
                        disabled
                        style={{
                          width: '100%', height: '44px', fontSize: '0.875rem', fontWeight: 800,
                          border: '1px solid #cbd5e1', cursor: 'not-allowed', borderRadius: 'var(--radius-md)',
                          backgroundColor: '#f1f5f9', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                        }}
                      >
                        ⏳ Hàng Đặt Trước (Không Thể Mua Trực Tiếp)
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ⑥ Trust badges — 4 cột */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
              {TRUST.map(t => (
                <div key={t.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.25rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ color: t.color }}>{t.icon}</span>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>{t.label}</span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: 1.25 }}>{t.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            TABS: Thông số | Mô tả | Đánh giá
        ════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: '3rem' }}>
          {/* Tab nav */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)' }}>
            {[
              { key: 'specs', label: 'Thông Số Kỹ Thuật', icon: <Settings size={15} /> },
              { key: 'description', label: 'Mô Tả Sản Phẩm', icon: <FileText size={15} /> },
              { key: 'reviews', label: `Đánh Giá (${reviews.length})`, icon: <MessageSquare size={15} /> },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.875rem 1.5rem', border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
                color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                fontFamily: 'var(--font-sans)', transition: 'all 0.15s', marginBottom: '-1px',
              }}>{tab.icon} {tab.label}</button>
            ))}
          </div>

          {/* Tab content */}
          <div className="card-glass" style={{ borderRadius: '0 0 var(--radius-xl) var(--radius-xl)', borderTop: 'none', padding: '2rem' }}>

            {/* SPECS TAB */}
            {activeTab === 'specs' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 3rem' }}>
                {[
                  ...specEntries,
                  ['Thương hiệu', product.brand],
                  ['Danh mục', product.category],
                  ['Bảo hành', '24–36 tháng chính hãng'],
                  ['Xuất xứ', 'Chính hãng nhập khẩu'],
                ].map(([k, v], i) => (
                  <div key={k + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'none', flexShrink: 0, marginRight: '0.5rem' }}>{getSpecLabel(k)}</span>
                    <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)', textAlign: 'right' }}>{Array.isArray(v) ? v.join(', ') : String(v)}</strong>
                  </div>
                ))}
              </div>
            )}

            {/* DESCRIPTION TAB */}
            {activeTab === 'description' && (
              <div style={{ maxWidth: '780px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>Giới Thiệu {product.name}</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.85, marginBottom: '1.25rem', fontSize: '0.9375rem' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{product.name}</strong> là sản phẩm chất lượng cao từ thương hiệu <strong style={{ color: 'var(--secondary)' }}>{product.brand}</strong>, thuộc danh mục <strong>{product.category}</strong>. Sản phẩm được nhập khẩu chính hãng, có đầy đủ tem bảo hành và hóa đơn VAT.
                </p>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.85, marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
                  Với hiệu năng vượt trội, đây là lựa chọn lý tưởng cho cả gaming, workstation và nâng cấp hệ thống. Linh kiện được kiểm tra kỹ thuật trước khi xuất kho.
                </p>
                <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem' }}>
                  <h4 style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Sparkles size={16} style={{ color: 'var(--accent)' }} /> Điểm Nổi Bật
                  </h4>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {['Hàng chính hãng 100%, tem bảo hành rõ ràng', 'Bảo hành tại AetherPC: 24–36 tháng', 'Kiểm tra kỹ thuật trước khi xuất kho', 'Đổi trả trong 7 ngày nếu lỗi từ NSX', 'Tư vấn kỹ thuật miễn phí sau mua hàng'].map(item => (
                      <li key={item} style={{ display: 'flex', gap: '0.625rem', fontSize: '0.875rem', color: 'var(--text-secondary)', alignItems: 'flex-start' }}>
                        <Check size={14} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />{item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* REVIEWS TAB */}
            {activeTab === 'reviews' && (
              <div>
                {/* Summary */}
                {reviews.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '2.5rem', marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border-glass)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '4.5rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1, marginBottom: '0.5rem' }}>{avg}</div>
                      <StarRating value={Math.round(parseFloat(avg))} size={20} />
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{reviews.length} đánh giá</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                      {starCounts.map(({ stars, count }) => (
                        <RatingBar key={stars} stars={stars} count={count} total={reviews.length} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Filter */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  {[{ key: 'all', label: 'Tất Cả' }, { key: '5', label: '5 Sao' }, { key: '4', label: '4 Sao' }, { key: '3', label: '3 Sao' }].map(t => (
                    <button key={t.key} onClick={() => setRfil(t.key)} style={{ padding: '0.35rem 0.875rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', cursor: 'pointer', background: rfil === t.key ? 'var(--primary)' : 'rgba(255,255,255,0.02)', color: rfil === t.key ? '#fff' : 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'var(--font-sans)', transition: 'all var(--transition-fast)' }}>{t.label}</button>
                  ))}
                </div>

                {/* List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                  {filteredReviews.length === 0
                    ? <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Chưa có đánh giá nào.</div>
                    : filteredReviews.map((rv, idx) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem', gap: '1rem', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: `hsl(${(idx * 47 + 200) % 360},60%,35%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', color: '#fff', flexShrink: 0 }}>
                              {rv.user.charAt(0)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{rv.user}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rv.date}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <StarRating value={rv.stars} size={14} />
                            {rv.stars === 5 && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Đã xác minh</span>}
                          </div>
                        </div>
                        {rv.title && <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.35rem' }}>{rv.title}</h4>}
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '0.75rem' }}>{rv.body}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <span>Hữu ích không?</span>
                          <button onClick={() => setHelpful(h => ({ ...h, [idx]: true }))} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', background: 'none', color: helpful[idx] ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-sans)', transition: 'all 0.2s' }}>
                            <ThumbsUp size={12} />{(rv.helpful || 0) + (helpful[idx] ? 1 : 0)} Hữu ích
                          </button>
                        </div>
                      </div>
                    ))
                  }
                </div>

                {/* Write review */}
                <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.07),rgba(14,165,233,0.03))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-xl)', padding: '2rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.5rem' }}>Viết Đánh Giá Của Bạn</h3>
                  {reviewDone ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                        <Check size={40} style={{ color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '50%' }} />
                      </div>
                      <h4>Cảm ơn đánh giá của bạn!</h4>
                    </div>
                  ) : (
                    <form onSubmit={handleReview}>
                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Đánh giá của bạn *</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <StarRating value={reviewForm.stars} size={28} onChange={s => setReviewForm(f => ({ ...f, stars: s }))} />
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            {['', 'Rất tệ', 'Không tốt', 'Bình thường', 'Tốt', 'Tuyệt vời!'][reviewForm.stars] || 'Chọn số sao'}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Họ tên (tùy chọn)</label>
                          <input className="form-input" placeholder="Nguyễn Văn A" value={reviewForm.name} onChange={e => setReviewForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Tiêu đề đánh giá</label>
                          <input className="form-input" placeholder="Tóm tắt ý kiến..." value={reviewForm.title} onChange={e => setReviewForm(f => ({ ...f, title: e.target.value }))} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Nội dung đánh giá *</label>
                        <textarea required className="form-textarea" rows={4} placeholder="Chia sẻ trải nghiệm của bạn..." value={reviewForm.body} onChange={e => setReviewForm(f => ({ ...f, body: e.target.value }))} />
                      </div>
                      <button type="submit" className="btn btn-primary" style={{ gap: '0.4rem' }} disabled={reviewForm.stars === 0}>
                        <Send size={14} /> Gửi Đánh Giá
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            RELATED PRODUCTS
        ════════════════════════════════════════════════════════ */}
        {related.length > 0 && (
          <section>
            <div className="section-header" style={{ marginBottom: '1.25rem' }}>
              <h2 className="section-title" style={{ fontSize: '1.25rem' }}>
                Sản Phẩm <span className="gradient-text">Tương Tự</span>
              </h2>
              <Link to={`/?cat=${product.category}`} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.45rem 0.875rem', gap: '0.3rem' }}>
                Xem thêm <ChevronRight size={13} />
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1.125rem' }}>
              {related.map(rp => (
                <Link key={rp.id} to={`/product/${rp.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card-glass" style={{ padding: '1rem', height: '100%', transition: 'transform 0.2s, border-color 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--border-glass)'; }}
                  >
                    <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem', marginBottom: '0.75rem', border: '1px solid rgba(0,0,0,0.06)' }}>
                      <img src={rp.image || `https://placehold.co/200x160/1e263d/94a3b8?text=${rp.category}`} alt={rp.name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                        onError={e => { e.target.src = `https://placehold.co/160x120/f1f5f9/64748b?text=${rp.category}`; }} />
                    </div>
                    <span className="badge badge-info" style={{ fontSize: '0.65rem', marginBottom: '0.4rem' }}>{rp.category}</span>
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.4, marginBottom: '0.5rem', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{rp.name}</h4>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--success)' }}>{fmt(rp.price)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
