import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { api } from '../../services/api';
import { Search, ShoppingCart, Eye, ArrowRight, Zap, Clock, ChevronLeft, ChevronRight, Star, Cpu, Gamepad2, Database, Layers, HardDrive, Box, Wind, Shield, Truck, Wrench, CreditCard, Calendar, Monitor, Keyboard, Mouse, Flame, TrendingUp, Filter, X, RotateCcw, SlidersHorizontal, Check, Sparkles, Trophy, Tag, ThumbsUp, Award } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

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

// ─── Hero Slides ──────────────────────────────────────────────────────────────
const HERO_SLIDES = [
  {
    id: 1,
    image: '/hero_banner.png',
    badge: 'Flash Sale',
    title: 'Linh Kiện Cao Cấp',
    titleHighlight: 'Giá Tốt Nhất',
    subtitle: 'CPU, VGA, RAM chính hãng — bảo hành dài hạn. Build PC trong mơ ngay hôm nay.',
    cta: { label: 'Mua Ngay', path: '/?scroll=products' },
    cta2: { label: 'Tự Build PC', path: '/pc-builder' },
    overlay: 'linear-gradient(90deg, rgba(11,15,25,0.95) 0%, rgba(11,15,25,0.6) 60%, transparent 100%)',
  },
  {
    id: 2,
    image: '/promo_banner.png',
    badge: 'Khuyến Mãi',
    title: 'Flash Sale Tháng 6',
    titleHighlight: 'Giảm Đến 30%',
    subtitle: 'Hàng trăm sản phẩm giảm giá sốc. Chỉ có tại AetherPC trong thời gian có hạn.',
    cta: { label: 'Xem Khuyến Mãi', path: '/promotions' },
    cta2: { label: 'Xem Sản Phẩm', path: '/' },
    overlay: 'linear-gradient(90deg, rgba(11,15,25,0.95) 0%, rgba(11,15,25,0.55) 60%, transparent 100%)',
  },
];

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'CPU', label: 'CPU', icon: Cpu, color: '#2563eb' },
  { key: 'VGA', label: 'Card Đồ Họa', icon: Gamepad2, color: '#3b82f6' },
  { key: 'RAM', label: 'RAM', icon: Database, color: '#10b981' },
  { key: 'MAINBOARD', label: 'Bo Mạch Chủ', icon: Layers, color: '#f59e0b' },
  { key: 'STORAGE', label: 'Ổ Cứng', icon: HardDrive, color: '#60a5fa' },
  { key: 'PSU', label: 'Nguồn', icon: Zap, color: '#ef4444' },
  { key: 'CASE', label: 'Case', icon: Box, color: '#64748b' },
  { key: 'COOLER', label: 'Tản Nhiệt', icon: Wind, color: '#0ea5e9' },
  { key: 'MONITOR', label: 'Màn Hình', icon: Monitor, color: '#ec4899' },
  { key: 'KEYBOARD', label: 'Bàn Phím', icon: Keyboard, color: '#a855f7' },
  { key: 'MOUSE', label: 'Chuột', icon: Mouse, color: '#14b8a6' },
];

// ─── News Data ────────────────────────────────────────────────────────────────
const NEWS_PREVIEW = [
  {
    id: 1,
    category: 'Review',
    title: 'Đánh Giá RTX 4070 Super: Lựa Chọn Hoàn Hảo Tầm Giá 20 Triệu?',
    excerpt: 'Card đồ họa RTX 4070 Super mang lại hiệu năng vượt trội so với thế hệ trước với mức giá hợp lý hơn.',
    image: '/news_1.png',
    date: '18/06/2026',
    readTime: '5 phút',
  },
  {
    id: 2,
    category: 'Hướng Dẫn',
    title: 'Hướng Dẫn Tự Lắp PC Gaming Từ A-Z Cho Người Mới Bắt Đầu',
    excerpt: 'Bài viết chi tiết từng bước lắp ráp máy tính, từ chọn linh kiện đến cài đặt hệ điều hành.',
    image: '/news_2.png',
    date: '15/06/2026',
    readTime: '12 phút',
  },
  {
    id: 3,
    category: 'Tin Tức',
    title: 'Intel Core i9-15900K vs AMD Ryzen 9 9900X: Ai Thắng Cuộc?',
    excerpt: 'Cuộc so sánh nảy lửa giữa hai ông lớn CPU thế hệ mới nhất năm 2026.',
    image: '/news_3.png',
    date: '12/06/2026',
    readTime: '8 phút',
  },
];

// ─── USP ─────────────────────────────────────────────────────────────────────
const USPS = [
  { icon: Shield, title: 'Hàng Chính Hãng 100%', desc: 'Nhập khẩu trực tiếp từ nhà sản xuất, có hóa đơn và chứng từ đầy đủ.', color: '#10b981' },
  { icon: Truck, title: 'Giao Hàng Siêu Tốc', desc: 'Giao trong ngày tại TP.HCM. Toàn quốc 1–2 ngày qua đối tác vận chuyển uy tín.', color: '#3b82f6' },
  { icon: Wrench, title: 'Tư Vấn Chuyên Sâu', desc: 'Đội ngũ kỹ thuật viên 5+ năm kinh nghiệm tư vấn miễn phí 24/7.', color: '#2563eb' },
  { icon: CreditCard, title: 'Thanh Toán Linh Hoạt', desc: 'Hỗ trợ tiền mặt, chuyển khoản, thẻ tín dụng, ví điện tử và trả góp 0%.', color: '#f59e0b' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPrice(price) {
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


function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const tick = () => {
      const diff = targetDate - Date.now();
      if (diff <= 0) { setTimeLeft({ h: 0, m: 0, s: 0 }); return; }
      setTimeLeft({
        h: Math.floor((diff / 3600000) % 24),
        m: Math.floor((diff / 60000) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}

// ─── Sub-Components ───────────────────────────────────────────────────────────
function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [isHoveredPrev, setIsHoveredPrev] = useState(false);
  const [isHoveredNext, setIsHoveredNext] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const id = setInterval(() => setCurrent(c => (c + 1) % HERO_SLIDES.length), 6000);
    return () => clearInterval(id);
  }, []);

  const slide = HERO_SLIDES[current];

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden', marginBottom: '2.5rem' }}>
      <div style={{ position: 'relative', height: '480px' }}>
        <img
          src={slide.image}
          alt={slide.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.6s ease' }}
        />
        {/* Gradient Overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: slide.overlay || 'linear-gradient(90deg, rgba(11,15,25,0.92) 0%, rgba(11,15,25,0.65) 50%, rgba(11,15,25,0.15) 100%)',
        }}>
          <div className="container" style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
            <div
              key={current}
              className="fade-in-up"
              style={{ maxWidth: '560px', position: 'relative', zIndex: 1 }}
            >
              {/* Badge */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                backgroundColor: '#dc2626', color: '#fff',
                fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px',
                padding: '0.35rem 1rem', borderRadius: '99px',
                marginBottom: '1.25rem',
                boxShadow: '0 4px 15px rgba(220,38,38,0.4)',
              }}>
                <Zap size={13} fill="#fff" /> {slide.badge}
              </span>

              {/* Title */}
              <h1 style={{
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                fontWeight: 900,
                fontFamily: 'var(--font-title)',
                lineHeight: 1.1,
                marginBottom: '1rem',
                letterSpacing: '-0.03em',
                color: '#ffffff',
              }}>
                {slide.title}<br />
                <span style={{
                  background: 'linear-gradient(135deg, #60a5fa, #818cf8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>{slide.titleHighlight}</span>
              </h1>

              {/* Subtitle */}
              <p style={{
                color: 'rgba(255,255,255,0.78)', fontSize: '1.05rem',
                lineHeight: 1.65, marginBottom: '2rem', maxWidth: '460px',
              }}>
                {slide.subtitle}
              </p>

              {/* CTA Buttons */}
              <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate(slide.cta.path)}
                  style={{
                    padding: '0.8rem 2rem', fontSize: '0.9375rem', fontWeight: 700,
                    border: 'none', borderRadius: '12px', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    boxShadow: '0 6px 20px rgba(37,99,235,0.4)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(37,99,235,0.5)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,0.4)'; }}
                >
                  {slide.cta.label} <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => navigate(slide.cta2.path)}
                  style={{
                    padding: '0.8rem 2rem', fontSize: '0.9375rem', fontWeight: 700,
                    border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: '12px', cursor: 'pointer',
                    backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff',
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                >
                  {slide.cta2.label}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Prev/Next Arrows */}
        <button
          onClick={() => setCurrent(c => (c - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
          onMouseEnter={() => setIsHoveredPrev(true)}
          onMouseLeave={() => setIsHoveredPrev(false)}
          style={{
            position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)',
            background: isHoveredPrev ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
            border: '1.5px solid rgba(255,255,255,0.2)',
            borderRadius: '50%', color: '#fff', cursor: 'pointer',
            width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(6px)', transition: 'all 0.2s',
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => setCurrent(c => (c + 1) % HERO_SLIDES.length)}
          onMouseEnter={() => setIsHoveredNext(true)}
          onMouseLeave={() => setIsHoveredNext(false)}
          style={{
            position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)',
            background: isHoveredNext ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
            border: '1.5px solid rgba(255,255,255,0.2)',
            borderRadius: '50%', color: '#fff', cursor: 'pointer',
            width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(6px)', transition: 'all 0.2s',
          }}
        >
          <ChevronRight size={20} />
        </button>

        {/* Dots Indicator */}
        <div style={{
          position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.3)', padding: '0.4rem 0.75rem',
          borderRadius: '99px', backdropFilter: 'blur(6px)',
        }}>
          {HERO_SLIDES.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} style={{
              width: i === current ? '28px' : '8px', height: '8px',
              borderRadius: '99px', border: 'none', cursor: 'pointer',
              background: i === current ? '#ffffff' : 'rgba(255,255,255,0.35)',
              transition: 'all 0.35s ease',
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}



function FlashSaleBar({ products }) {
  // Fixed end time using useRef so it never recalculates on re-render
  const saleEndRef = useRef(Date.now() + 7 * 3600 * 1000 + 23 * 60 * 1000 + 45 * 1000);
  const { h, m, s } = useCountdown(saleEndRef.current);
  const pad = (n) => String(n).padStart(2, '0');

  // Pick top discounted products for flash sale display
  const flashItems = (products || [])
    .filter(p => p.discountPercent > 0 && p.available && p.price > 0)
    .sort((a, b) => b.discountPercent - a.discountPercent)
    .slice(0, 8);

  // If no discounted products, show some products as "flash sale"
  const displayItems = flashItems.length > 0 ? flashItems : (products || []).filter(p => p.available && p.price > 0).slice(0, 8);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 40%, #f97316 100%)',
      borderRadius: '16px',
      padding: '0',
      marginBottom: '2.5rem',
      overflow: 'hidden',
      boxShadow: '0 8px 30px rgba(220,38,38,0.25)',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.2)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={22} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-title)', fontWeight: 900, fontSize: '1.25rem', color: '#ffffff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              ⚡ Flash Sale Hôm Nay
            </div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
              Giảm giá sốc — Số lượng có hạn, bán hết là dừng!
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Kết thúc sau:</span>
            {[{ v: pad(h), l: 'Giờ' }, { v: pad(m), l: 'Phút' }, { v: pad(s), l: 'Giây' }].map((u, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>:</span>}
                <div style={{
                  backgroundColor: '#ffffff',
                  color: '#dc2626',
                  fontWeight: 900,
                  fontSize: '1.1rem',
                  padding: '0.2rem 0.45rem',
                  borderRadius: '6px',
                  minWidth: '32px',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}>
                  {u.v}
                </div>
              </React.Fragment>
            ))}
          </div>

          <Link to="/flash-sale" style={{
            backgroundColor: '#ffffff',
            color: '#dc2626',
            fontWeight: 800,
            fontSize: '0.8rem',
            padding: '0.45rem 1rem',
            borderRadius: '8px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'transform 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            Xem Tất Cả <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Products Row */}
      {displayItems.length > 0 && (
        <div style={{
          padding: '0.75rem 1.5rem 1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '0.75rem',
        }}>
          {displayItems.map((p) => {
            const soldPercent = Math.min(95, 40 + (p.id % 55));
            return (
              <Link to={`/product/${p.id}`} key={`fs-${p.id}`} style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textDecoration: 'none',
                transition: 'transform 0.15s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ width: '100%', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  <img
                    src={p.image || `https://placehold.co/100x80/fff/ccc?text=${p.category}`}
                    alt={p.name}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    onError={(e) => { e.target.src = `https://placehold.co/100x80/fff/ccc?text=${p.category}`; }}
                  />
                </div>

                {p.discountPercent > 0 && (
                  <span style={{
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    marginBottom: '0.35rem',
                  }}>
                    GIẢM {p.discountPercent}%
                  </span>
                )}

                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#dc2626', marginBottom: '0.15rem' }}>
                  {new Intl.NumberFormat('vi-VN').format(p.price)}đ
                </div>

                {p.originalPrice > p.price && (
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                    {new Intl.NumberFormat('vi-VN').format(p.originalPrice)}đ
                  </div>
                )}

                {/* Sold Progress Bar */}
                <div style={{ width: '100%', marginTop: '0.4rem' }}>
                  <div style={{
                    height: '14px',
                    backgroundColor: '#fee2e2',
                    borderRadius: '99px',
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${soldPercent}%`,
                      background: 'linear-gradient(90deg, #f97316, #dc2626)',
                      borderRadius: '99px',
                      transition: 'width 0.5s ease',
                    }} />
                    <span style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      color: soldPercent > 50 ? '#fff' : '#dc2626',
                      whiteSpace: 'nowrap',
                    }}>
                      {soldPercent > 80 ? 'Sắp hết' : `Đã bán ${soldPercent}%`}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductCard({ p, onAddCart, onCompare }) {
  const navigate = useNavigate();
  const rating = (4.0 + (p.id % 11) / 10).toFixed(1);
  const reviews = 10 + (p.id % 90);
  const showDiscount = p.discountPercent > 0;

  return (
    <div className="card-glass" style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: '1.125rem', position: 'relative',
    }}>
      {/* Image — click => product detail */}
      <div
        onClick={() => navigate(`/product/${p.id}`)}
        style={{
          width: '100%', height: '170px',
          backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0.625rem', marginBottom: '0.875rem',
          overflow: 'hidden', position: 'relative',
          border: '1px solid rgba(0,0,0,0.06)',
          cursor: 'pointer',
        }}>
         <img
          src={p.image || `https://placehold.co/180x140/1e263d/94a3b8?text=${p.category}`}
          alt={p.name}
          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', transition: 'transform 0.3s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        />
        {showDiscount && (
          <span style={{
            position: 'absolute', top: '6px', left: '6px',
            background: 'var(--danger)', color: '#fff',
            fontSize: '0.7rem', fontWeight: 700,
            padding: '2px 6px', borderRadius: '4px',
          }}>-{p.discountPercent}%</span>
        )}
        {p.available && p.stockQuantity > 0 ? (
          <span style={{
            position: 'absolute', top: '6px', right: '6px',
            background: 'rgba(16,185,129,0.9)', color: '#fff',
            fontSize: '0.65rem', fontWeight: 700,
            padding: '2px 6px', borderRadius: '4px',
          }}>Còn {p.stockQuantity} sp</span>
        ) : p.available && p.stockQuantity === 0 ? (
          <span style={{
            position: 'absolute', top: '6px', right: '6px',
            background: 'rgba(245,158,11,0.9)', color: '#fff',
            fontSize: '0.65rem', fontWeight: 700,
            padding: '2px 6px', borderRadius: '4px',
          }}>Đặt trước</span>
        ) : (
          <span style={{
            position: 'absolute', top: '6px', right: '6px',
            background: 'rgba(239,68,68,0.9)', color: '#fff',
            fontSize: '0.65rem', fontWeight: 700,
            padding: '2px 6px', borderRadius: '4px',
          }}>Ngừng bán</span>
        )}
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.3rem', marginBottom: '0.375rem' }}>
        <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{p.category}</span>
        {p.sku && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }} title={p.sku}>{p.sku}</span>}
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{p.brand}</span>
      </div>

      {/* Name — click => product detail */}
      <h3
        onClick={() => navigate(`/product/${p.id}`)}
        style={{
          fontSize: '0.875rem', lineHeight: 1.45, margin: '0.25rem 0 0.5rem',
          height: '2.55rem', overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', color: 'var(--text-primary)',
          fontWeight: 600, cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--secondary)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
      >{p.name}</h3>

      {/* Stars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.625rem', fontSize: '0.75rem' }}>
        {[1,2,3,4,5].map(i => (
          <Star key={i} size={11} fill={i <= Math.round(rating) ? '#f59e0b' : 'none'} stroke={i <= Math.round(rating) ? '#f59e0b' : '#64748b'} />
        ))}
        <span style={{ color: 'var(--text-muted)', marginLeft: '0.25rem' }}>({reviews})</span>
      </div>

      {/* Specs */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)',
        padding: '0.5rem 0.625rem', marginBottom: '0.875rem',
        fontSize: '0.7375rem', color: 'var(--text-secondary)', flex: 1,
      }}>
        {Object.entries(p.specs || {}).slice(0, 3).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
            <span style={{ textTransform: 'none' }}>{getSpecLabel(k)}:</span>
            <strong style={{ color: 'var(--text-primary)', maxWidth: '130px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {Array.isArray(v) ? v.join(', ') : String(v)}
            </strong>
          </div>
        ))}
      </div>

      {/* Price + CTA */}
      <div>
        {showDiscount && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
            {formatPrice(p.originalPrice)}
          </span>
        )}
        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--success)', marginBottom: '0.75rem' }}>
          {formatPrice(p.price)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 36px', gap: '0.4rem' }}>
          {((Number(p.stockQuantity) > 0 || Number(p.stock) > 0) && !p.isPreorder) ? (
            <button onClick={() => onAddCart(p)} className="btn btn-primary" style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
              <ShoppingCart size={13} /> Thêm Vào Giỏ
            </button>
          ) : (
            <button
              disabled
              title="Sản phẩm hết hàng sẵn tại kho, vui lòng liên hệ đặt trước"
              style={{
                backgroundColor: '#f1f5f9',
                color: '#94a3b8',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.2rem'
              }}
            >
              ⏳ Đặt Trước
            </button>
          )}
          <Link to={`/product/${p.id}`} className="btn btn-secondary" style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Xem chi tiết">
            <Eye size={13} />
          </Link>
          <button 
            onClick={() => onCompare(p)} 
            className="btn btn-secondary" 
            style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
            title="So sánh nhanh"
          >
            <SlidersHorizontal size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Best Seller Card Component ──────────────────────────────────────────────
function BestSellerCard({ p, onAddCart, onCompare }) {
  const navigate = useNavigate();
  const rating = (4.0 + (p.id % 11) / 10).toFixed(1);
  const reviews = 10 + (p.id % 90);
  const showDiscount = p.discountPercent > 0;
  
  // Deterministic sales statistics based on ID
  const soldCount = 50 + (p.id % 120);
  const totalStock = 180 + (p.id % 40);
  const percentSold = Math.round((soldCount / totalStock) * 100);
  const remaining = totalStock - soldCount;

  return (
    <div className="card-glass" style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: '1.25rem', position: 'relative',
      border: '1px solid rgba(245, 158, 11, 0.25)', // Subtle gold border
      boxShadow: '0 4px 20px -2px rgba(245, 158, 11, 0.05)',
      overflow: 'hidden',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.7)';
      e.currentTarget.style.boxShadow = '0 10px 30px -5px rgba(245, 158, 11, 0.15), 0 0 15px rgba(245, 158, 11, 0.1)';
      e.currentTarget.style.transform = 'translateY(-6px)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.25)';
      e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(245, 158, 11, 0.05)';
      e.currentTarget.style.transform = 'translateY(0)';
    }}>
      {/* Radial backdrop gold glow */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        right: '-10%',
        width: '50%',
        height: '50%',
        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, transparent 70%)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      {/* Flame Badge & Discount */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
          color: '#fff',
          fontSize: '0.6875rem',
          fontWeight: 800,
          padding: '4px 8px',
          borderRadius: '20px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)',
        }}>
          <Flame size={12} fill="#fff" style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.5))' }} /> BÁN CHẠY
        </div>
        {showDiscount && (
          <span style={{
            background: 'var(--danger)', color: '#fff',
            fontSize: '0.7rem', fontWeight: 700,
            padding: '2px 6px', borderRadius: '4px',
          }}>-{p.discountPercent}%</span>
        )}
      </div>

      {/* Image */}
      <div
        onClick={() => navigate(`/product/${p.id}`)}
        style={{
          position: 'relative', zIndex: 1,
          width: '100%', height: '170px',
          backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0.625rem', marginBottom: '0.875rem',
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.06)',
          cursor: 'pointer',
        }}>
        <img
          src={p.image || `https://placehold.co/180x140/1e263d/94a3b8?text=${p.category}`}
          alt={p.name}
          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', transition: 'transform 0.3s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        />
        {p.available && p.stockQuantity > 0 ? (
          <span style={{
            position: 'absolute', top: '6px', right: '6px',
            background: 'rgba(16,185,129,0.9)', color: '#fff',
            fontSize: '0.65rem', fontWeight: 700,
            padding: '2px 6px', borderRadius: '4px',
          }}>Còn {p.stockQuantity} sp</span>
        ) : p.available && p.stockQuantity === 0 ? (
          <span style={{
            position: 'absolute', top: '6px', right: '6px',
            background: 'rgba(245,158,11,0.9)', color: '#fff',
            fontSize: '0.65rem', fontWeight: 700,
            padding: '2px 6px', borderRadius: '4px',
          }}>Đặt trước</span>
        ) : (
          <span style={{
            position: 'absolute', top: '6px', right: '6px',
            background: 'rgba(239,68,68,0.9)', color: '#fff',
            fontSize: '0.65rem', fontWeight: 700,
            padding: '2px 6px', borderRadius: '4px',
          }}>Ngừng bán</span>
        )}
      </div>

      {/* Meta */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.3rem', marginBottom: '0.375rem' }}>
        <span className="badge badge-warning" style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.15)' }}>{p.category}</span>
        {p.sku && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }} title={p.sku}>{p.sku}</span>}
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{p.brand}</span>
      </div>

      {/* Name */}
      <h3
        onClick={() => navigate(`/product/${p.id}`)}
        style={{
          position: 'relative', zIndex: 1,
          fontSize: '0.9rem', lineHeight: 1.45, margin: '0.25rem 0 0.5rem',
          height: '2.55rem', overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', color: 'var(--text-primary)',
          fontWeight: 700, cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#f59e0b'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
      >{p.name}</h3>

      {/* Stars */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.625rem', fontSize: '0.75rem' }}>
        {[1,2,3,4,5].map(i => (
          <Star key={i} size={11} fill={i <= Math.round(rating) ? '#f59e0b' : 'none'} stroke={i <= Math.round(rating) ? '#f59e0b' : '#64748b'} />
        ))}
        <span style={{ color: 'var(--text-secondary)', marginLeft: '0.25rem', fontWeight: 500 }}>{rating}</span>
        <span style={{ color: 'var(--text-muted)' }}>({reviews} đánh giá)</span>
      </div>

      {/* Sold progress indicator */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', marginBottom: '0.3rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Đã bán: <strong style={{ color: '#f59e0b' }}>{soldCount}</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>Còn lại: {remaining}</span>
        </div>
        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
          <div style={{
            width: `${percentSold}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
            borderRadius: '10px',
            boxShadow: '0 0 8px rgba(245, 158, 11, 0.5)',
          }} />
        </div>
      </div>

      {/* Specs (compact) */}
      <div style={{
        position: 'relative', zIndex: 1,
        backgroundColor: 'rgba(255,255,255,0.015)', borderRadius: 'var(--radius-sm)',
        padding: '0.5rem 0.625rem', marginBottom: '0.875rem',
        fontSize: '0.7375rem', color: 'var(--text-secondary)', flex: 1,
        border: '1px solid rgba(255, 255, 255, 0.02)'
      }}>
        {Object.entries(p.specs || {}).slice(0, 2).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
            <span style={{ textTransform: 'none' }}>{getSpecLabel(k)}:</span>
            <strong style={{ color: 'var(--text-primary)', maxWidth: '145px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {Array.isArray(v) ? v.join(', ') : String(v)}
            </strong>
          </div>
        ))}
      </div>

      {/* Price + CTA */}
      <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto' }}>
        {showDiscount && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
            {formatPrice(p.originalPrice)}
          </span>
        )}
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)', marginBottom: '0.75rem' }}>
          {formatPrice(p.price)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 38px 38px', gap: '0.4rem' }}>
          {((Number(p.stockQuantity) > 0 || Number(p.stock) > 0) && !p.isPreorder) ? (
            <button onClick={() => onAddCart(p)} className="btn btn-primary" style={{
              padding: '0.625rem', fontSize: '0.8125rem',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              boxShadow: '0 4px 10px rgba(245, 158, 11, 0.2)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #fbbf24, #f59e0b)';
              e.currentTarget.style.boxShadow = '0 6px 14px rgba(245, 158, 11, 0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
              e.currentTarget.style.boxShadow = '0 4px 10px rgba(245, 158, 11, 0.2)';
            }}>
              <ShoppingCart size={13} /> Thêm Vào Giỏ
            </button>
          ) : (
            <button
              disabled
              title="Sản phẩm hết hàng sẵn tại kho, vui lòng liên hệ đặt trước"
              style={{
                backgroundColor: '#f1f5f9',
                color: '#94a3b8',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.2rem'
              }}
            >
              ⏳ Đặt Trước
            </button>
          )}
          <Link to={`/product/${p.id}`} className="btn btn-secondary" style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Xem chi tiết">
            <Eye size={13} />
          </Link>
          <button 
            onClick={() => onCompare(p)} 
            className="btn btn-secondary" 
            style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
            title="So sánh nhanh"
          >
            <SlidersHorizontal size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Product Comparison Component ─────────────────────────────────────────────
function ProductComparison({ products, onAddCart, onClose, initialProduct, clearInitialProduct }) {
  const getCategoryLabel = (cat) => {
    const labels = {
      CPU: 'CPU / Vi Xử Lý',
      VGA: 'Card Đồ Họa (VGA)',
      RAM: 'Bộ Nhớ RAM',
      MAINBOARD: 'Bo Mạch Chủ',
      STORAGE: 'Ổ Cứng SSD/HDD',
      PSU: 'Nguồn Máy Tính',
      COOLER: 'Tản Nhiệt',
      MONITOR: 'Màn Hình',
      KEYBOARD: 'Bàn Phím',
      MOUSE: 'Chuột Gaming'
    };
    return labels[cat] || cat;
  };

  const categoryIcons = {
    CPU: Cpu,
    VGA: Gamepad2,
    RAM: Layers,
    MAINBOARD: Box,
    STORAGE: Database,
    PSU: Zap,
    COOLER: Wind,
    MONITOR: Monitor,
    KEYBOARD: Keyboard,
    MOUSE: Mouse
  };

  const [selectedCategory, setSelectedCategory] = useState('CPU');
  const [compareList, setCompareList] = useState([null, null]);
  const [slotSearchQueries, setSlotSearchQueries] = useState(['', '', '']);
  const [isSearchingSlot, setIsSearchingSlot] = useState([true, true, false]);

  useEffect(() => {
    if (initialProduct) {
      const cat = (initialProduct.category || 'CPU').toUpperCase();
      setSelectedCategory(cat);
      const catProds = (products || []).filter(p => p && p.category && p.category.toUpperCase() === cat);
      const otherProd = catProds.find(p => String(p.id) !== String(initialProduct.id)) || null;
      
      setCompareList([initialProduct, otherProd]);
      setSlotSearchQueries(['', '', '']);
      setIsSearchingSlot([false, otherProd ? false : true, false]);
      clearInitialProduct();
    }
  }, [initialProduct]);

  const categoriesWithProducts = ['CPU', 'VGA', 'RAM', 'MAINBOARD', 'STORAGE', 'PSU', 'COOLER', 'MONITOR', 'KEYBOARD', 'MOUSE'];

  // Filter products by selected category
  const categoryProducts = (products || []).filter(p => p && p.category && p.category.toUpperCase() === selectedCategory.toUpperCase());

  const handleSearchQueryChange = (idx, value) => {
    setSlotSearchQueries(prev => {
      const copy = [...prev];
      copy[idx] = value;
      return copy;
    });
  };

  const handleSelectProduct = (idx, prod) => {
    setCompareList(prev => {
      const copy = [...prev];
      copy[idx] = prod;
      return copy;
    });
    setIsSearchingSlot(prev => {
      const copy = [...prev];
      copy[idx] = false;
      return copy;
    });
    setSlotSearchQueries(prev => {
      const copy = [...prev];
      copy[idx] = '';
      return copy;
    });
  };

  const addCompareSlot = () => {
    if (compareList.length < 3 && categoryProducts.length > compareList.length) {
      const remaining = categoryProducts.find(p => !compareList.some(item => String(item?.id) === String(p.id)));
      setCompareList([...compareList, remaining || null]);
      const newIdx = compareList.length;
      if (!remaining) {
        setIsSearchingSlot(prev => {
          const copy = [...prev];
          copy[newIdx] = true;
          return copy;
        });
      }
    }
  };

  const removeCompareSlot = (index) => {
    if (compareList.length > 1) {
      const newList = compareList.filter((_, i) => i !== index);
      setCompareList(newList);
      setIsSearchingSlot(prev => prev.filter((_, i) => i !== index));
      setSlotSearchQueries(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleAutoCompareCompetitor = () => {
    if (categoryProducts.length < 2) return;
    const currentSelected = compareList[0];
    const available = categoryProducts.filter(p => String(p?.id) !== String(currentSelected?.id));
    if (available.length > 0) {
      setCompareList([currentSelected || categoryProducts[0], available[0]]);
      setIsSearchingSlot([false, false, false]);
    }
  };

  // Get all unique spec keys from compared products
  const validCompareList = compareList.filter(Boolean);
  const allSpecKeys = [...new Set(
    validCompareList.flatMap(p => p.specs ? Object.keys(p.specs) : [])
  )];

  const getBestSpecIndex = (key) => {
    if (validCompareList.length < 2) return -1;
    
    const isLowerBetter = key.toLowerCase().includes('price') || key.toLowerCase().includes('gia') || key.toLowerCase().includes('tdp');
    let bestIdx = -1;
    let bestVal = isLowerBetter ? Infinity : -Infinity;

    compareList.forEach((p, idx) => {
      if (!p) return;
      let rawVal = null;

      if (key === 'price') {
        rawVal = parseFloat(p.price);
      } else if (p.specs && p.specs[key] !== undefined) {
        const v = p.specs[key];
        const match = String(v).match(/[\d.]+/);
        rawVal = match ? parseFloat(match[0]) : null;
      }

      if (rawVal !== null && !isNaN(rawVal)) {
        if (isLowerBetter) {
          if (rawVal < bestVal) {
            bestVal = rawVal;
            bestIdx = idx;
          }
        } else {
          if (rawVal > bestVal) {
            bestVal = rawVal;
            bestIdx = idx;
          }
        }
      }
    });

    const validVals = compareList
      .map(p => {
        if (!p) return null;
        if (key === 'price') return parseFloat(p.price);
        if (p.specs && p.specs[key] !== undefined) {
          const match = String(p.specs[key]).match(/[\d.]+/);
          return match ? parseFloat(match[0]) : null;
        }
        return null;
      })
      .filter(v => v !== null && !isNaN(v));

    if (validVals.length >= 2 && new Set(validVals).size > 1) {
      return bestIdx;
    }
    return -1;
  };

  const getOptimalRecommendation = () => {
    if (validCompareList.length === 0) return null;

    if (validCompareList.length === 1) {
      const p = validCompareList[0];
      return {
        isSingle: true,
        product: p,
        reason: `Bạn đang xem **${p.name}** (${formatPrice(p.price)}). Nhấn nút bên dưới để AI tự động ghép linh kiện đối thủ so sánh!`
      };
    }

    const scores = validCompareList.map(p => {
      let score = 0;
      const price = parseFloat(p.price) || 1;
      const rating = 4.5;
      const specs = p.specs || {};

      score += rating * 15;
      score += (5000000 / price) * 12;

      if (selectedCategory === 'CPU') {
        const cores = parseInt(specs.cores) || 4;
        const threads = parseInt(specs.threads) || 8;
        score += (cores * threads * 2500000 / price) * 25;
      } else if (selectedCategory === 'VGA') {
        const vramGb = parseInt(specs.vram) || 8;
        score += (vramGb * 7000000 / price) * 25;
      } else if (selectedCategory === 'RAM') {
        const capGb = parseInt(specs.capacity) || 8;
        score += (capGb * 1200000 / price) * 25;
      } else if (selectedCategory === 'STORAGE') {
        const speed = parseInt(specs.speed_read) || 3000;
        score += (speed * 600000 / price) * 25;
      }

      return { product: p, score };
    });

    scores.sort((a, b) => b.score - a.score);
    const winner = scores[0].product;
    const runnerUp = scores[1]?.product;

    const winnerPrice = formatPrice(winner.price);
    let advantageText = '';

    if (selectedCategory === 'CPU') {
      const cores = winner.specs?.cores;
      advantageText = `Vượt trội nhờ hiệu năng tính toán đa nhiệm (${cores ? cores + ' nhân' : 'cực mạnh'}), phù hợp làm việc nặng & gaming với mức giá đầu tư tối ưu **${winnerPrice}**.`;
    } else if (selectedCategory === 'VGA') {
      const vram = winner.specs?.vram;
      advantageText = `Sở hữu dung lượng VRAM (${vram || 'cao'}) cùng khả năng xử lý đồ họa ấn tượng, đạt hiệu năng fps/giá tốt nhất.`;
    } else if (selectedCategory === 'RAM' || selectedCategory === 'STORAGE') {
      advantageText = `Tốc độ truy xuất và băng thông cao hơn, tăng tốc toàn bộ hệ thống với chi phí đầu tư hợp lý nhất.`;
    } else {
      advantageText = `Cân bằng xuất sắc giữa chất lượng linh kiện, độ ổn định lâu dài và mức giá **${winnerPrice}**.`;
    }

    return {
      isSingle: false,
      product: winner,
      runnerUp: runnerUp,
      reason: `**${winner.name}** là lựa chọn đáng mua nhất! ${advantageText}`
    };
  };

  const getSpecLabel = (key) => {
    const labels = {
      socket: 'Socket CPU',
      cores: 'Số Nhân (Cores)',
      threads: 'Số Luồng (Threads)',
      clock_base: 'Xung Cơ Bản',
      clock_boost: 'Xung Tối Đa (Boost)',
      cache: 'Bộ Nhớ Đệm (Cache)',
      vram: 'Dung Lượng VRAM',
      memory_type: 'Chuẩn Bộ Nhớ (RAM)',
      capacity: 'Dung Lượng',
      bus_speed: 'Tốc Độ BUS',
      form_factor: 'Kích Thước (Form Factor)',
      chipset: 'Chipset',
      wattage: 'Công Suất (Wattage)',
      rating: 'Chuẩn Hiệu Suất 80 Plus',
      tdp: 'Mức Tiêu Thụ Điện (TDP)'
    };
    return labels[key] || key.replace(/_/g, ' ').toUpperCase();
  };

  const bestPriceIdx = getBestSpecIndex('price');
  const recommendation = getOptimalRecommendation();

  return (
    <div style={{ padding: '0.25rem', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', color: '#1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem', marginBottom: '0.65rem', flexShrink: 0 }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, letterSpacing: '-0.02em' }}>
            <div style={{ width: 30, height: 30, borderRadius: '8px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)' }}>
              <SlidersHorizontal size={16} style={{ color: '#fff' }} />
            </div>
            So Sánh Thông Số & Đề Xuất Mua Hàng
          </h3>
          <p style={{ fontSize: '0.775rem', color: '#64748b', margin: '0.15rem 0 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Sparkles size={12} style={{ color: '#d97706' }} /> Phân tích tự động thông số & giá bán từ kho hàng AetherPC
          </p>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            style={{ 
              background: '#f1f5f9', 
              border: '1px solid #cbd5e1', 
              color: '#475569', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: 32,
              height: 32,
              borderRadius: '50%', 
              transition: 'all 0.2s',
              marginLeft: '1rem'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#ef4444';
              e.currentTarget.style.borderColor = '#ef4444';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.color = '#475569';
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.5rem', flexShrink: 0 }}>
        {categoriesWithProducts.map(cat => {
          const IconComp = categoryIcons[cat] || Box;
          const isSelected = selectedCategory === cat;
          const count = (products || []).filter(p => p && p.category && p.category.toUpperCase() === cat).length;

          return (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                const catProds = (products || []).filter(p => p && p.category && p.category.toUpperCase() === cat);
                setCompareList([catProds[0] || null, catProds[1] || null]);
                setSlotSearchQueries(['', '', '']);
                setIsSearchingSlot([catProds[0] ? false : true, catProds[1] ? false : true, false]);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                background: isSelected ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#f8fafc',
                color: isSelected ? '#ffffff' : '#475569',
                cursor: 'pointer',
                fontWeight: isSelected ? 700 : 600,
                fontSize: '0.775rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
            >
              <IconComp size={13} style={{ color: isSelected ? '#ffffff' : '#2563eb' }} />
              {getCategoryLabel(cat)}
              <span style={{
                fontSize: '0.65rem',
                padding: '1px 5px',
                borderRadius: '6px',
                background: isSelected ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                color: isSelected ? '#ffffff' : '#334155',
                marginLeft: '2px'
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Smart AI Recommendation Banner (Compact Single-Bar) */}
      {recommendation ? (
        <div style={{
          background: recommendation.isSingle
            ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
            : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          border: recommendation.isSingle
            ? '1px solid #bfdbfe'
            : '1px solid #bbf7d0',
          borderRadius: '10px',
          padding: '0.5rem 0.85rem',
          marginBottom: '0.65rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.85rem',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, flex: 1 }}>
            <div style={{
              background: recommendation.isSingle ? '#2563eb' : '#16a34a',
              color: '#fff',
              borderRadius: '6px',
              padding: '3px 7px',
              fontSize: '0.7rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              flexShrink: 0
            }}>
              {recommendation.isSingle ? <Sparkles size={12} /> : <Trophy size={12} />}
              {recommendation.isSingle ? 'AI Gợi Ý' : '💡 AI Khuyên Chọn'}
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} dangerouslySetInnerHTML={{
              __html: recommendation.reason.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #15803d; font-weight: 700;">$1</strong>')
            }} />
          </div>

          {!recommendation.isSingle ? (
            ((Number(recommendation.product?.stockQuantity) > 0 || Number(recommendation.product?.stock) > 0) && !recommendation.product?.isPreorder) ? (
              <button
                onClick={() => onAddCart(recommendation.product)}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                  whiteSpace: 'nowrap'
                }}
              >
                <ShoppingCart size={12} /> Thêm SP Khuyên Chọn Vào Giỏ ({formatPrice(recommendation.product.price)})
              </button>
            ) : (
              <button
                disabled
                style={{
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#94a3b8',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
                }}
              >
                ⏳ SP Khuyên Chọn (Đặt Trước)
              </button>
            )
          ) : (
            <button
              onClick={handleAutoCompareCompetitor}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                border: 'none',
                color: '#fff',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
            >
              <Zap size={12} /> Ghép Tự Động So Sánh
            </button>
          )}
        </div>
      ) : null}

      {/* Product Selection Slots Grid */}
      {compareList.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `200px repeat(${compareList.length}, minmax(260px, 1fr)) ${compareList.length < 3 && categoryProducts.length > compareList.length ? '130px' : ''}`,
          gap: '0.65rem',
          marginBottom: '0.65rem',
          alignItems: 'stretch',
          flexShrink: 0
        }}>
          {/* Column 0: Label Card */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '0.5rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minWidth: '200px'
          }}>
            <h4 style={{ margin: 0, fontSize: '0.825rem', fontWeight: 800, color: '#0f172a' }}>Linh Kiện So Sánh</h4>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.725rem', color: '#64748b' }}>
              Đã chọn {validCompareList.length}/{compareList.length} mẫu
            </p>
          </div>

          {/* Slot Cards */}
          {compareList.map((p, idx) => {
            const searching = isSearchingSlot[idx];
            const query = slotSearchQueries[idx].toLowerCase();
            const suggestions = categoryProducts
              .filter(item => item.name.toLowerCase().includes(query))
              .slice(0, 5);

            return (
              <div key={`slot-card-${idx}`} style={{
                background: '#ffffff',
                border: searching ? '1px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '0.5rem 0.75rem',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                minWidth: '260px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}>
                {/* Delete Slot Button */}
                {compareList.length > 2 && (
                  <button 
                    onClick={() => removeCompareSlot(idx)}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: '#ffe4e6',
                      border: 'none',
                      color: '#be123c',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 12
                    }}
                    title="Xóa cột này"
                  >
                    <X size={11} />
                  </button>
                )}

                {searching ? (
                  /* SEARCH MODE */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', height: '100%' }}>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                          type="text"
                          placeholder="Nhập tên linh kiện..."
                          value={slotSearchQueries[idx]}
                          onChange={(e) => handleSearchQueryChange(idx, e.target.value)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '0.35rem 0.35rem 0.35rem 1.8rem',
                            backgroundColor: '#ffffff',
                            border: '1px solid #2563eb',
                            borderRadius: '6px',
                            color: '#0f172a',
                            fontSize: '0.775rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      {p && (
                        <button
                          onClick={() => setIsSearchingSlot(prev => {
                            const copy = [...prev];
                            copy[idx] = false;
                            return copy;
                          })}
                          style={{
                            padding: '0.35rem 0.55rem',
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            color: '#475569',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          Hủy
                        </button>
                      )}
                    </div>

                    {/* Inline Suggestions List */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      maxHeight: '110px',
                      overflowY: 'auto'
                    }}>
                      {suggestions.length === 0 ? (
                        <div style={{ padding: '0.4rem', fontSize: '0.725rem', color: '#64748b', textAlign: 'center' }}>
                          Không tìm thấy linh kiện
                        </div>
                      ) : (
                        suggestions.map(sug => (
                          <div
                            key={sug.id}
                            onClick={() => handleSelectProduct(idx, sug)}
                            style={{
                              padding: '0.35rem 0.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: 'pointer',
                              borderRadius: '5px',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              transition: 'all 0.2s',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ width: '28px', height: '28px', backgroundColor: '#fff', borderRadius: '4px', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                              <img src={sug.image || `https://placehold.co/70x70/1e263d/94a3b8?text=${sug.category}`} alt={sug.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sug.name}</div>
                              <div style={{ fontSize: '0.675rem', color: '#16a34a', fontWeight: 700 }}>{formatPrice(sug.price)}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  /* DISPLAY PRODUCT MODE */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', height: '100%' }}>
                    {p ? (
                      <>
                        <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center' }}>
                          <div style={{ width: '44px', height: '44px', backgroundColor: '#fff', borderRadius: '8px', padding: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                            <img src={p.image || `https://placehold.co/70x70/1e263d/94a3b8?text=${p.category}`} alt={p.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.785rem', fontWeight: 700, color: '#0f172a', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.25' }} title={p.name}>
                              {p.name}
                            </div>
                            <span style={{ fontSize: '0.675rem', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', color: '#475569', fontWeight: 600, marginTop: '2px', display: 'inline-block' }}>
                              {p.brand}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: 'auto' }}>
                          <button
                            onClick={() => setIsSearchingSlot(prev => {
                              const copy = [...prev];
                              copy[idx] = true;
                              return copy;
                            })}
                            style={{
                              flex: 1,
                              padding: '0.3rem',
                              fontSize: '0.725rem',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.2rem'
                            }}
                          >
                            🔍 Đổi
                          </button>
                          {((Number(p.stockQuantity) > 0 || Number(p.stock) > 0) && !p.isPreorder) ? (
                            <button
                              onClick={() => onAddCart(p)}
                              style={{
                                flex: 1.3,
                                padding: '0.3rem',
                                fontSize: '0.725rem',
                                background: '#16a34a',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.25rem',
                                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.2)'
                              }}
                            >
                              <ShoppingCart size={11} /> Thêm Vào Giỏ
                            </button>
                          ) : (
                            <button
                              disabled
                              title="Hết hàng sẵn tại kho, vui lòng liên hệ đặt trước"
                              style={{
                                flex: 1.3,
                                padding: '0.3rem',
                                fontSize: '0.725rem',
                                backgroundColor: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#94a3b8',
                                borderRadius: '6px',
                                cursor: 'not-allowed',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              ⏳ Đặt Trước
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 0', border: '2px dashed #cbd5e1', borderRadius: '8px', height: '100%' }}>
                        <button
                          onClick={() => setIsSearchingSlot(prev => {
                            const copy = [...prev];
                            copy[idx] = true;
                            return copy;
                          })}
                          style={{
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.75rem',
                            background: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          🔍 Chọn linh kiện {idx + 1}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Slot Card Button */}
          {compareList.length < 3 && categoryProducts.length > compareList.length && (
            <button
              onClick={addCompareSlot}
              style={{
                background: '#f8fafc',
                border: '2px dashed #93c5fd',
                borderRadius: '10px',
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#2563eb',
                fontWeight: 700,
                fontSize: '0.75rem',
                gap: '0.2rem',
                minWidth: '130px',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#2563eb' }}>
                +
              </div>
              Thêm Cột
            </button>
          )}
        </div>
      )}

      {/* Specification Comparison Table Area */}
      {compareList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          Không có sản phẩm nào trong danh mục này để so sánh.
        </div>
      ) : (
        <div style={{
          overflowX: 'auto',
          overflowY: 'auto',
          flex: 1,
          paddingRight: '4px',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          background: '#ffffff'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '780px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{
                  width: '200px',
                  minWidth: '200px',
                  maxWidth: '200px',
                  padding: '0.9rem 1.25rem',
                  color: '#334155',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}>
                  Thông Số Chi Tiết
                </th>
                {compareList.map((p, idx) => (
                  <th key={`table-head-${idx}`} style={{
                    padding: '0.9rem 1.25rem',
                    minWidth: '260px',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {p ? p.name : `Linh kiện ${idx + 1}`}
                  </th>
                ))}
                {compareList.length < 3 && categoryProducts.length > compareList.length && <th></th>}
              </tr>
            </thead>
            <tbody>
              {/* Row: Price */}
              <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
                <td style={{
                  width: '200px',
                  minWidth: '200px',
                  maxWidth: '200px',
                  padding: '0.9rem 1.25rem',
                  color: '#334155',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}>
                  🏷️ Giá bán niêm yết
                </td>
                {compareList.map((p, idx) => {
                  const isCheapest = idx === bestPriceIdx;
                  return (
                    <td key={`price-${idx}`} style={{
                      padding: '0.9rem 1.25rem',
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: isCheapest ? '#16a34a' : '#0f172a',
                      background: isCheapest ? '#dcfce7' : 'transparent'
                    }}>
                      {p ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{formatPrice(p.price)}</span>
                          {isCheapest && (
                            <span style={{ fontSize: '0.7rem', background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              Giá tốt nhất
                            </span>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                  );
                })}
                {compareList.length < 3 && categoryProducts.length > compareList.length && <td></td>}
              </tr>

              {/* Row: Status */}
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{
                  width: '200px',
                  minWidth: '200px',
                  maxWidth: '200px',
                  padding: '0.9rem 1.25rem',
                  color: '#334155',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}>
                  📦 Trạng thái kho hàng
                </td>
                {compareList.map((p, idx) => {
                  if (!p) return <td key={`status-${idx}`} style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem' }}>-</td>;
                  
                  const isStockAvailable = p.available && p.stockQuantity > 0;
                  const isPreOrder = p.available && p.stockQuantity === 0;

                  return (
                    <td key={`status-${idx}`} style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem' }}>
                      <span style={{
                        color: isStockAvailable ? '#15803d' : (isPreOrder ? '#b45309' : '#be123c'),
                        background: isStockAvailable ? '#dcfce7' : (isPreOrder ? '#fef3c7' : '#ffe4e6'),
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isStockAvailable ? '#16a34a' : (isPreOrder ? '#d97706' : '#dc2626') }} />
                        {isStockAvailable ? `Còn ${p.stockQuantity} sản phẩm` : (isPreOrder ? 'Hàng đặt trước' : 'Ngừng kinh doanh')}
                      </span>
                    </td>
                  );
                })}
                {compareList.length < 3 && categoryProducts.length > compareList.length && <td></td>}
              </tr>

              {/* Dynamic Specs Rows */}
              {allSpecKeys.map(key => {
                const bestIdx = getBestSpecIndex(key);
                return (
                  <tr key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{
                      width: '200px',
                      minWidth: '200px',
                      maxWidth: '200px',
                      padding: '0.85rem 1.25rem',
                      color: '#475569',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}>
                      {getSpecLabel(key)}
                    </td>
                    {compareList.map((p, idx) => {
                      const val = p && p.specs ? p.specs[key] : null;
                      const isBest = idx === bestIdx;
                      return (
                        <td key={`spec-${key}-${idx}`} style={{
                          padding: '0.85rem 1.25rem',
                          fontSize: '0.85rem',
                          color: isBest ? '#15803d' : '#0f172a',
                          fontWeight: isBest ? 700 : 500,
                          background: isBest ? '#dcfce7' : 'transparent'
                        }}>
                          {val !== null && val !== undefined ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span>{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                              {isBest && (
                                <span style={{
                                  fontSize: '0.675rem',
                                  color: '#15803d',
                                  background: '#bbf7d0',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}>
                                  <Check size={11} /> Tốt nhất
                                </span>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                      );
                    })}
                    {compareList.length < 3 && categoryProducts.length > compareList.length && <td></td>}
                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const PRICE_PRESETS = [
  { key: 'ALL', label: 'Tất Cả Giá' },
  { key: 'under_2m', label: 'Dưới 2 triệu', min: 0, max: 2000000 },
  { key: '2m_5m', label: '2 - 5 triệu', min: 2000000, max: 5000000 },
  { key: '5m_10m', label: '5 - 10 triệu', min: 5000000, max: 10000000 },
  { key: '10m_20m', label: '10 - 20 triệu', min: 10000000, max: 20000000 },
  { key: 'above_20m', label: 'Trên 20 triệu', min: 20000000, max: Infinity },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [products, setProducts] = useState(() => {
    const cached = localStorage.getItem('aetherpc_products');
    return cached ? JSON.parse(cached) : FALLBACK_PRODUCTS;
  });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [loading, setLoading] = useState(() => {
    return !localStorage.getItem('aetherpc_products');
  });
  const [visibleCount, setVisibleCount] = useState(12);
  const [hoveredCat, setHoveredCat] = useState(null);
  const { addToCart } = useCart();
  const productsRef = React.useRef(null);

  // New states for product filtering & sorting
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [priceRange, setPriceRange] = useState('ALL');
  const [sliderMaxPrice, setSliderMaxPrice] = useState(50000000);
  const [customMinPrice, setCustomMinPrice] = useState('');
  const [customMaxPrice, setCustomMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [initialCompareProduct, setInitialCompareProduct] = useState(null);

  const handleQuickCompare = (prod) => {
    setInitialCompareProduct(prod);
    setShowCompareModal(true);
  };

  // Extract available brands for the selected category dynamically
  const availableBrands = React.useMemo(() => {
    const catProducts = products.filter(p => selectedCategory === 'ALL' || p.category.toUpperCase() === selectedCategory.toUpperCase());
    return [...new Set(catProducts.map(p => p.brand).filter(Boolean))].sort();
  }, [products, selectedCategory]);

  // Reset visibleCount whenever search query or filters change
  useEffect(() => {
    setVisibleCount(12);
  }, [search, selectedCategory, selectedBrands, priceRange, customMinPrice, customMaxPrice, sortBy]);

  // Clear selected brands when category changes to prevent stale filters
  useEffect(() => {
    setSelectedBrands([]);
  }, [selectedCategory]);

  useEffect(() => {
    const fetch = async () => {
      const cached = localStorage.getItem('aetherpc_products');
      if (cached) {
        setProducts(JSON.parse(cached));
      } else {
        setLoading(true);
      }
      try {
        const res = await api.get('/products');
        if (res && res.length > 0) {
          setProducts(res);
          localStorage.setItem('aetherpc_products', JSON.stringify(res));
        }
      } catch (e) {
        console.warn('Using fallback products.', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // Filter & sort products logic
  const filtered = React.useMemo(() => {
    return products
      .filter((p) => {
        // Search filter (by name or brand)
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.brand && p.brand.toLowerCase().includes(search.toLowerCase()));

        // Category filter
        const matchCat = selectedCategory === 'ALL' || p.category.toUpperCase() === selectedCategory.toUpperCase();

        // Brand filter
        const matchBrand = selectedBrands.length === 0 || selectedBrands.includes(p.brand);

        // Price range filter
        let matchPrice = true;
        if (priceRange === 'SLIDER') {
          matchPrice = p.price <= sliderMaxPrice;
        } else if (priceRange !== 'ALL') {
          const preset = PRICE_PRESETS.find(pr => pr.key === priceRange);
          if (preset) {
            matchPrice = p.price >= preset.min && p.price <= preset.max;
          }
        } else {
          // If no preset, check custom min/max inputs
          const min = parseFloat(customMinPrice);
          const max = parseFloat(customMaxPrice);
          if (!isNaN(min)) matchPrice = matchPrice && p.price >= min;
          if (!isNaN(max)) matchPrice = matchPrice && p.price <= max;
        }

        return matchSearch && matchCat && matchBrand && matchPrice;
      })
      .sort((a, b) => {
        // 1. Prioritize In-stock (stockQuantity > 0 || stock > 0) over Preorder
        const aInStock = (Number(a.stockQuantity) > 0 || Number(a.stock) > 0) && !a.isPreorder;
        const bInStock = (Number(b.stockQuantity) > 0 || Number(b.stock) > 0) && !b.isPreorder;

        if (aInStock && !bInStock) return -1;
        if (!aInStock && bInStock) return 1;

        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
        return 0;
      });
  }, [products, search, selectedCategory, selectedBrands, priceRange, customMinPrice, customMaxPrice, sortBy]);

  const handleClearAllFilters = () => {
    setSelectedBrands([]);
    setPriceRange('ALL');
    setCustomMinPrice('');
    setCustomMaxPrice('');
    setSortBy('default');
  };

  const renderFiltersContent = () => {
    return (
      <>
        {/* Brand Filter */}
        <div className="filter-group">
          <div className="filter-title">Thương Hiệu</div>
          {availableBrands.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Không có thương hiệu nào</div>
          ) : (
            <div className="filter-checkbox-list">
              {availableBrands.map((brand) => (
                <label key={brand} className="filter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedBrands.includes(brand)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBrands(prev => [...prev, brand]);
                      } else {
                        setSelectedBrands(prev => prev.filter(b => b !== brand));
                      }
                    }}
                  />
                  <span>{brand}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Price Range Slider & Presets */}
        <div className="filter-group">
          <div className="filter-title">Mức Giá</div>

          {/* Range Slider UI */}
          <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.75rem', color: '#64748b' }}>
              <span>Từ 0 ₫</span>
              <span style={{ fontWeight: 800, color: '#2563eb' }}>Đến {formatPrice(sliderMaxPrice)}</span>
            </div>
            <input
              type="range"
              min="500000"
              max="50000000"
              step="500000"
              value={sliderMaxPrice}
              onChange={(e) => {
                setSliderMaxPrice(Number(e.target.value));
                setPriceRange('SLIDER');
                setCustomMinPrice('');
                setCustomMaxPrice('');
              }}
              style={{
                width: '100%',
                accentColor: '#2563eb',
                cursor: 'pointer'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              <span>500k</span>
              <span>25 triệu</span>
              <span>50 triệu+</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {PRICE_PRESETS.map((preset) => (
              <label key={preset.key} className="filter-checkbox-label" style={{ fontWeight: priceRange === preset.key ? 600 : 400 }}>
                <input
                  type="radio"
                  name="priceRangePreset"
                  checked={priceRange === preset.key}
                  onChange={() => {
                    setPriceRange(preset.key);
                    if (preset.key !== 'ALL') {
                      setCustomMinPrice('');
                      setCustomMaxPrice('');
                    }
                  }}
                  style={{ accentColor: 'var(--primary)', width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <span>{preset.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Custom Price Inputs */}
        <div className="filter-group">
          <div className="filter-title">Giá Tự Chọn</div>
          <div className="price-inputs">
            <div className="price-input-wrapper">
              <input
                type="number"
                placeholder="Từ"
                className="form-input"
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.5rem' }}
                value={customMinPrice}
                onChange={(e) => {
                  setCustomMinPrice(e.target.value);
                  setPriceRange('ALL');
                }}
              />
            </div>
            <div className="price-input-wrapper">
              <input
                type="number"
                placeholder="Đến"
                className="form-input"
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.5rem' }}
                value={customMaxPrice}
                onChange={(e) => {
                  setCustomMaxPrice(e.target.value);
                  setPriceRange('ALL');
                }}
              />
            </div>
          </div>
        </div>

        {/* Sort Group */}
        <div className="filter-group">
          <div className="filter-title">Sắp Xếp Theo</div>
          <select
            className="form-input"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.5rem', cursor: 'pointer' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="default">Mặc định</option>
            <option value="price_asc">Giá: Thấp đến Cao</option>
            <option value="price_desc">Giá: Cao đến Thấp</option>
            <option value="name_asc">Tên: A-Z</option>
            <option value="name_desc">Tên: Z-A</option>
          </select>
        </div>
      </>
    );
  };

  const hasActiveFilters = selectedBrands.length > 0 || priceRange !== 'ALL' || customMinPrice !== '' || customMaxPrice !== '' || sortBy !== 'default';

  const renderActiveFilters = () => {
    if (!hasActiveFilters) return null;
    return (
      <div className="active-filters-bar">
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Bộ lọc áp dụng:</span>
        {selectedBrands.map(brand => (
          <span key={brand} className="active-filter-tag" onClick={() => setSelectedBrands(prev => prev.filter(b => b !== brand))}>
            {brand} <X size={12} />
          </span>
        ))}
        {priceRange !== 'ALL' && (
          <span className="active-filter-tag" onClick={() => setPriceRange('ALL')}>
            {PRICE_PRESETS.find(p => p.key === priceRange)?.label} <X size={12} />
          </span>
        )}
        {(customMinPrice !== '' || customMaxPrice !== '') && (
          <span className="active-filter-tag" onClick={() => { setCustomMinPrice(''); setCustomMaxPrice(''); }}>
            Giá tự chọn <X size={12} />
          </span>
        )}
        {sortBy !== 'default' && (
          <span className="active-filter-tag" onClick={() => setSortBy('default')}>
            Sắp xếp: {sortBy === 'price_asc' ? 'Giá tăng' : sortBy === 'price_desc' ? 'Giá giảm' : sortBy === 'name_asc' ? 'A-Z' : 'Z-A'} <X size={12} />
          </span>
        )}
        <button className="clear-all-filters-btn" onClick={handleClearAllFilters}>
          <RotateCcw size={12} /> Xóa tất cả bộ lọc
        </button>
      </div>
    );
  };

  const scrollToProducts = (cat) => {
    setSelectedCategory(cat);
    productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Sort and select top 4 best-sellers
  const getPopularityScore = (p) => {
    const rating = 4.0 + (p.id % 11) / 10;
    const reviews = 10 + (p.id % 90);
    return rating * 10 + reviews;
  };
  const bestSellers = [...products]
    .sort((a, b) => getPopularityScore(b) - getPopularityScore(a))
    .slice(0, 4);

  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* ── HERO SLIDER ── */}
      <HeroSlider />

      {/* ── QUICK CATEGORIES ── */}
      <section className="container" style={{ marginBottom: '3.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Danh Mục Sản Phẩm</h2>
        </div>
        <div className="category-grid">
          {CATEGORIES.map((cat) => {
            const IconComponent = cat.icon;
            const isHovered = hoveredCat === cat.key;
            return (
              <div 
                key={cat.key} 
                className="category-item" 
                onClick={() => scrollToProducts(cat.key)}
                onMouseEnter={() => setHoveredCat(cat.key)}
                onMouseLeave={() => setHoveredCat(null)}
                style={isHovered ? {
                  borderColor: cat.color,
                  boxShadow: `0 8px 24px -4px ${cat.color}44`,
                  transform: 'translateY(-4px)',
                  background: `${cat.color}08`,
                } : {}}
              >
                <div className="category-icon" style={{ 
                  background: isHovered ? `${cat.color}33` : `${cat.color}22`, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  transform: isHovered ? 'scale(1.1) rotate(5deg)' : 'scale(1) rotate(0deg)',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                  <IconComponent size={22} color={cat.color} />
                </div>
                <span className="category-name" style={isHovered ? { color: 'var(--text-primary)' } : {}}>{cat.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FLASH SALE BAR ── */}
      <section className="container">
        <FlashSaleBar products={products} />
      </section>

      {/* ── BEST SELLERS SECTION ── */}
      {bestSellers.length > 0 && (
        <section className="container" style={{ marginBottom: '4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
            <TrendingUp size={24} style={{ color: '#f59e0b' }} />
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Sản Phẩm <span style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Bán Chạy Nhất</span>
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                Linh kiện và phụ kiện máy tính được game thủ và creator tin dùng nhiều nhất tuần qua
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
            {bestSellers.map((p) => (
              <BestSellerCard key={`best-${p.id}`} p={p} onAddCart={(item) => addToCart(item, 1)} onCompare={handleQuickCompare} />
            ))}
          </div>
        </section>
      )}

      {/* ── PRODUCTS SECTION ── */}
      <section ref={productsRef} className="container" style={{ marginBottom: '4rem' }}>
        {/* Search + Filter */}
        <div className="card-glass" style={{
          padding: '1.125rem', display: 'flex',
          flexWrap: 'wrap', gap: '1rem', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: '2rem',
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '260px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{
                position: 'absolute', left: '12px', top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-muted)',
              }} />
              <input
                type="text"
                placeholder="Tìm kiếm linh kiện, thương hiệu..."
                className="form-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>
            {/* Mobile filters trigger */}
            <button 
              className="btn btn-secondary mobile-filters-trigger"
              onClick={() => setShowMobileFilters(true)}
              style={{ height: '38px', padding: '0 0.875rem' }}
              title="Mở bộ lọc"
            >
              <SlidersHorizontal size={16} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Lọc</span>
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {['ALL', ...CATEGORIES.map(c => c.key)].map((cat) => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
                padding: '0.4rem 0.875rem', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-glass)',
                backgroundColor: selectedCategory === cat ? 'var(--primary)' : 'rgba(255,255,255,0.02)',
                color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem',
                textTransform: 'uppercase', transition: 'all var(--transition-fast)',
              }}>
                {cat === 'ALL' ? 'Tất Cả' : (CATEGORIES.find(c => c.key === cat)?.label || cat)}
              </button>
            ))}
          </div>
        </div>

        {/* Compare Trigger Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.25rem', marginTop: '-1rem' }}>
          <button
            onClick={() => setShowCompareModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              padding: '0.6rem 1.25rem',
              color: '#2563eb',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.875rem',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.12)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#2563eb';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = '#2563eb';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#eff6ff';
              e.currentTarget.style.color = '#2563eb';
              e.currentTarget.style.borderColor = '#bfdbfe';
            }}
          >
            <SlidersHorizontal size={15} />
            <span>So Sánh Linh Kiện Máy Tính ⇄</span>
          </button>
        </div>

        {/* Active Filters Display */}
        {renderActiveFilters()}

        <div className="product-layout-container">
          {/* Sidebar - Desktop Only */}
          <aside className="filters-sidebar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter size={16} /> Bộ Lọc Sản Phẩm
              </span>
            </div>
            {renderFiltersContent()}
          </aside>

          {/* Main Products Panel */}
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                Đang tải sản phẩm...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 0', border: '1px dashed var(--border-glass)', borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)' }}>
                Không tìm thấy sản phẩm phù hợp.
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Hiển thị {Math.min(visibleCount, filtered.length)} / {filtered.length} sản phẩm
                </p>
                <div className="grid-cols-auto">
                  {filtered.slice(0, visibleCount).map((p, i) => (
                    <ProductCard key={`${p.id}-${i}`} p={p} onAddCart={(p) => addToCart(p, 1)} onCompare={handleQuickCompare} />
                  ))}
                </div>
                {filtered.length > visibleCount && (
                  <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
                    <button onClick={() => setVisibleCount(v => v + 12)} className="btn btn-primary" style={{
                      padding: '0.875rem 3rem',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      borderRadius: '12px',
                      boxShadow: '0 4px 15px rgba(37, 99, 235, 0.35)',
                      border: 'none'
                    }}>
                      Xem Thêm ({filtered.length - visibleCount} sản phẩm)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Mobile Filters Drawer Overlay */}
      {showMobileFilters && (
        <div className="mobile-filters-drawer-overlay" onClick={() => setShowMobileFilters(false)}>
          <div className="mobile-filters-drawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter size={18} /> Bộ Lọc & Sắp Xếp
              </span>
              <button 
                onClick={() => setShowMobileFilters(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem' }}>
              {renderFiltersContent()}
            </div>
            
            <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-glass)' }}>
              <button className="btn btn-secondary" onClick={() => { handleClearAllFilters(); setShowMobileFilters(false); }}>
                Đặt lại
              </button>
              <button className="btn btn-primary" onClick={() => setShowMobileFilters(false)}>
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCT COMPARISON MODAL ── */}
      {showCompareModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000000,
          padding: '1.25rem',
          boxSizing: 'border-box'
        }}
        onClick={() => setShowCompareModal(false)}
        >
          <div style={{
            width: '95vw',
            maxWidth: '1400px',
            height: '88vh',
            minHeight: '680px',
            maxHeight: '92vh',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '20px',
            boxShadow: '0 25px 60px rgba(15, 23, 42, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '1.5rem 1.75rem',
            zIndex: 100000001,
          }}
          onClick={e => e.stopPropagation()}
          >
            <ProductComparison 
              products={products} 
              onAddCart={(p) => {
                const inStock = (Number(p.stockQuantity) > 0 || Number(p.stock) > 0) && !p.isPreorder;
                if (!inStock) {
                  alert('Sản phẩm này hiện đang trong diện ĐẶT TRƯỚC, vui lòng liên hệ CSKH để được hỗ trợ!');
                  return;
                }
                addToCart(p, 1);
                alert(`✅ Đã thêm ${p.name} vào giỏ hàng!`);
              }} 
              onClose={() => setShowCompareModal(false)} 
              initialProduct={initialCompareProduct}
              clearInitialProduct={() => setInitialCompareProduct(null)}
            />
          </div>
        </div>
      )}

      {/* ── WHY AETHERPC ── */}
      <section style={{
        background: '#f1f5f9',
        borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
        padding: '4rem 0', marginBottom: '4rem',
      }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 className="section-title" style={{ color: '#0f172a' }}>Tại Sao Chọn <span style={{ color: 'var(--primary)' }}>AetherPC?</span></h2>
            <p className="section-subtitle" style={{ color: '#475569', marginBottom: 0 }}>Cam kết mang đến trải nghiệm mua sắm tốt nhất</p>
          </div>
          <div className="usp-grid">
            {USPS.map((u) => {
              const IconComponent = u.icon;
              return (
                <div key={u.title} className="usp-card">
                  <div className="usp-icon" style={{ background: `${u.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconComponent size={26} color={u.color} />
                  </div>
                  <h3 className="usp-title">{u.title}</h3>
                  <p className="usp-desc">{u.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="container" style={{ marginBottom: '4rem' }}>
        <div className="card-glass" style={{ borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
          <div className="stats-grid">
            {[
              { num: '50.000+', label: 'Khách Hàng Hài Lòng' },
              { num: '5.000+', label: 'Sản Phẩm Chính Hãng' },
              { num: '10+', label: 'Năm Kinh Nghiệm' },
              { num: '99%', label: 'Tỉ Lệ Bảo Hành Thành Công' },
            ].map((s) => (
              <div key={s.label} className="stat-item">
                <div className="stat-number">{s.num}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEWS PREVIEW ── */}
      <section className="container" style={{ marginBottom: '4rem' }}>
        <div className="section-header">
          <div>
            <h2 className="section-title">Tin Tức <span className="gradient-text">Công Nghệ</span></h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Review, hướng dẫn và tin tức mới nhất</p>
          </div>
          <Link to="/news" className="btn btn-secondary" style={{ gap: '0.375rem' }}>
            Xem Tất Cả <ArrowRight size={14} />
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {NEWS_PREVIEW.map((n) => (
            <Link to={`/news/${n.id}`} key={n.id} className="news-card" style={{ textDecoration: 'none' }}>
              <img src={n.image} alt={n.title} className="news-card-img" />
              <div className="news-card-body">
                <div className="news-card-category">{n.category}</div>
                <h3 className="news-card-title">{n.title}</h3>
                <p className="news-card-excerpt">{n.excerpt}</p>
                <div className="news-card-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Calendar size={12} /> {n.date}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} /> {n.readTime} đọc
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── BRANDS ── */}
      <section style={{
        borderTop: '1px solid var(--border-glass)',
        padding: '2.5rem 0',
        marginBottom: '2rem',
      }}>
        <div className="container">
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
            Thương Hiệu Phân Phối Chính Hãng
          </p>
          <div className="brand-logo-grid">
            {['Intel', 'AMD', 'ASUS', 'MSI', 'Gigabyte', 'Corsair', 'Kingston', 'Samsung', 'NZXT', 'Deepcool'].map((brand) => (
              <div key={brand} className="brand-logo-item">
                <BrandLogo name={brand} height={20} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
