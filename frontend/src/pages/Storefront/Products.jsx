import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { api } from '../../services/api';
import { 
  Cpu, Gamepad2, Database, Layers, HardDrive, Zap, Box, Wind, Monitor, Keyboard, Mouse,
  Search, SlidersHorizontal, ArrowUpDown, ChevronDown, Check, Star, ShoppingCart, Eye, 
  ArrowRight, ShieldCheck, Tag, Sparkles, Filter, RefreshCw
} from 'lucide-react';

const CATEGORIES = [
  { key: 'ALL', label: 'Tất Cả Danh Mục', icon: Box },
  { key: 'CPU', label: 'CPU (Vi Xử Lý)', icon: Cpu },
  { key: 'VGA', label: 'Card Màn Hình (VGA)', icon: Gamepad2 },
  { key: 'RAM', label: 'Bộ Nhớ RAM', icon: Database },
  { key: 'MAINBOARD', label: 'Bo Mạch Chủ', icon: Layers },
  { key: 'STORAGE', label: 'Ổ Cứng SSD / HDD', icon: HardDrive },
  { key: 'PSU', label: 'Nguồn Máy Tính', icon: Zap },
  { key: 'CASE', label: 'Vỏ Case PC', icon: Box },
  { key: 'COOLER', label: 'Tản Nhiệt CPU', icon: Wind },
  { key: 'MONITOR', label: 'Màn Hình', icon: Monitor },
  { key: 'KEYBOARD', label: 'Bàn Phím Cơ', icon: Keyboard },
  { key: 'MOUSE', label: 'Chuột Gaming', icon: Mouse }
];

const PRICE_PRESETS = [
  { key: 'ALL', label: 'Tất Cả Mức Giá' },
  { key: 'UNDER_2M', label: 'Dưới 2 triệu', min: 0, max: 2000000 },
  { key: '2M_5M', label: '2 - 5 triệu', min: 2000000, max: 5000000 },
  { key: '5M_10M', label: '5 - 10 triệu', min: 5000000, max: 10000000 },
  { key: '10M_20M', label: '10 - 20 triệu', min: 10000000, max: 20000000 },
  { key: 'OVER_20M', label: 'Trên 20 triệu', min: 20000000, max: Infinity }
];

function fmt(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0);
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category')?.toUpperCase() || 'ALL');
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [priceRange, setPriceRange] = useState('ALL');
  const [sliderMaxPrice, setSliderMaxPrice] = useState(50000000);
  const [sortBy, setSortBy] = useState('default');
  const [addedId, setAddedId] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      const cached = localStorage.getItem('aetherpc_products');
      if (cached) {
        setProducts(JSON.parse(cached));
        setLoading(false);
      }
      try {
        const res = await api.get('/products');
        if (res && res.length > 0) {
          setProducts(res);
          localStorage.setItem('aetherpc_products', JSON.stringify(res));
        }
      } catch (e) {
        console.warn('Using cached products.', e);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Update query params
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) setSelectedCategory(cat.toUpperCase());
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  // Available brands based on selected category
  const availableBrands = useMemo(() => {
    const relevant = selectedCategory === 'ALL'
      ? products
      : products.filter(p => p.category?.toUpperCase() === selectedCategory);
    const brands = [...new Set(relevant.map(p => p.brand).filter(Boolean))];
    return brands.sort();
  }, [products, selectedCategory]);

  // Filter and sort products (Prioritize in-stock over preorder)
  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        const matchSearch = !search || 
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.brand?.toLowerCase().includes(search.toLowerCase()) ||
          p.sku?.toLowerCase().includes(search.toLowerCase());

        const matchCat = selectedCategory === 'ALL' || p.category?.toUpperCase() === selectedCategory;
        const matchBrand = selectedBrands.length === 0 || selectedBrands.includes(p.brand);

        let matchPrice = true;
        if (priceRange === 'SLIDER') {
          matchPrice = p.price <= sliderMaxPrice;
        } else if (priceRange !== 'ALL') {
          const preset = PRICE_PRESETS.find(pr => pr.key === priceRange);
          if (preset) {
            matchPrice = p.price >= preset.min && p.price <= preset.max;
          }
        }
        return matchSearch && matchCat && matchBrand && matchPrice;
      })
      .sort((a, b) => {
        // 1. Prioritize In-stock (stockQuantity > 0 || stock > 0) over Preorder
        const aInStock = (Number(a.stockQuantity) > 0 || Number(a.stock) > 0) && !a.isPreorder;
        const bInStock = (Number(b.stockQuantity) > 0 || Number(b.stock) > 0) && !b.isPreorder;

        if (aInStock && !bInStock) return -1;
        if (!aInStock && bInStock) return 1;

        // 2. Then apply user sorting
        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
        return 0;
      });
  }, [products, search, selectedCategory, selectedBrands, priceRange, sliderMaxPrice, sortBy]);

  const handleAddToCart = (p) => {
    const isPreorder = (!p.stockQuantity || p.stockQuantity <= 0) && (!p.stock || p.stock <= 0);
    if (isPreorder || p.isPreorder) {
      alert('Sản phẩm này hiện đang trong trạng thái ĐẶT TRƯỚC (Hết hàng sẵn tại kho). Vui lòng liên hệ CSKH / Hotline để được hỗ trợ đặt giữ hàng!');
      return;
    }
    addToCart(p, 1);
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 2000);
  };

  const handleClearFilters = () => {
    setSelectedBrands([]);
    setPriceRange('ALL');
    setSortBy('default');
    setSelectedCategory('ALL');
    setSearch('');
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '2rem 0', fontFamily: 'Inter, sans-serif' }}>
      <div className="container" style={{ maxWidth: '1380px', margin: '0 auto', padding: '0 1.5rem' }}>
        
        {/* Breadcrumb & Header Banner */}
        <div style={{ marginBottom: '1.5rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem 2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.35rem' }}>
                <Link to="/" style={{ color: '#64748b', textDecoration: 'none' }}>Trang Chủ</Link>
                <span>/</span>
                <span style={{ color: '#2563eb', fontWeight: 700 }}>Danh Mục Sản Phẩm</span>
              </div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Tất Cả Linh Kiện & Sản Phẩm PC Chính Hãng
              </h1>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>
                Khám phá kho linh kiện máy tính, màn hình và phụ kiện cao cấp bảo hành 36 tháng
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ position: 'relative', width: '280px' }}>
                <input
                  type="text"
                  placeholder="Tìm theo tên linh kiện, thương hiệu..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem 0.55rem 2.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              </div>
            </div>
          </div>

          {/* Quick Categories Bar */}
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '1rem 0 0', marginTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => {
                    setSelectedCategory(cat.key);
                    setSelectedBrands([]);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '99px',
                    border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    color: isSelected ? '#2563eb' : '#475569',
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? 800 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s'
                  }}
                >
                  <Icon size={15} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Grid: Filters Sidebar + Products Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left: Filter Sidebar */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.25rem', position: 'sticky', top: '90px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                <Filter size={16} style={{ color: '#2563eb' }} />
                <span>Bộ Lọc Sản Phẩm</span>
              </div>
              <button
                onClick={handleClearFilters}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Xóa tất cả
              </button>
            </div>

            {/* Brand Filter */}
            <div style={{ marginBottom: '1.25rem' }}>
              <strong style={{ fontSize: '0.85rem', color: '#0f172a', display: 'block', marginBottom: '0.6rem' }}>
                Thương Hiệu ({availableBrands.length})
              </strong>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {availableBrands.map(b => (
                  <label key={b} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(b)}
                      onChange={e => {
                        if (e.target.checked) setSelectedBrands(p => [...p, b]);
                        else setSelectedBrands(p => p.filter(item => item !== b));
                      }}
                    />
                    <span>{b}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Filter with Slider */}
            <div>
              <strong style={{ fontSize: '0.85rem', color: '#0f172a', display: 'block', marginBottom: '0.6rem' }}>
                Mức Giá
              </strong>

              {/* Range Slider UI */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.75rem', color: '#64748b' }}>
                  <span>Từ 0 ₫</span>
                  <span style={{ fontWeight: 800, color: '#2563eb' }}>Đến {fmt(sliderMaxPrice)}</span>
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

              {/* Price Presets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {PRICE_PRESETS.map(pr => (
                  <label key={pr.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="pricePreset"
                      checked={priceRange === pr.key}
                      onChange={() => setPriceRange(pr.key)}
                    />
                    <span>{pr.label}</span>
                  </label>
                ))}
              </div>
            </div>

          </div>

          {/* Right: Products List */}
          <div>
            
            {/* Top Bar: Total Count & Sort */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', backgroundColor: '#ffffff', padding: '0.75rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Tìm thấy <strong style={{ color: '#0f172a' }}>{filteredProducts.length}</strong> sản phẩm
                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>
                  (Ưu tiên hàng có sẵn tại kho)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Sắp xếp:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', color: '#0f172a' }}
                >
                  <option value="default">Mặc định (Còn hàng lên đầu)</option>
                  <option value="price_asc">Giá tăng dần</option>
                  <option value="price_desc">Giá giảm dần</option>
                  <option value="name_asc">Tên A → Z</option>
                </select>
              </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <Box size={48} style={{ color: '#94a3b8', margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem' }}>Không tìm thấy sản phẩm phù hợp</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1.25rem' }}>Hãy thử điều chỉnh bộ lọc hoặc xóa từ khóa tìm kiếm</p>
                <button
                  onClick={handleClearFilters}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Xóa Bộ Lọc
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
                {filteredProducts.map(p => {
                  const inStock = (Number(p.stockQuantity) > 0 || Number(p.stock) > 0) && !p.isPreorder;
                  const showDiscount = p.discountPercent > 0;

                  return (
                    <div
                      key={p.id}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #cbd5e1',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                        position: 'relative'
                      }}
                    >
                      {/* Top Image + Badges */}
                      <div>
                        <div style={{ position: 'relative', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fdfdfd', borderRadius: '8px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                          <img
                            src={p.image || 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=400&auto=format&fit=crop&q=80'}
                            alt={p.name}
                            style={{ maxHeight: '160px', maxWidth: '90%', objectFit: 'contain', transition: 'transform 0.2s' }}
                          />

                          {showDiscount && (
                            <span style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: '#ef4444', color: '#ffffff', fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                              -{p.discountPercent}%
                            </span>
                          )}

                          {inStock ? (
                            <span style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: '#10b981', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px' }}>
                              Còn {p.stockQuantity || p.stock || 10} sp
                            </span>
                          ) : (
                            <span style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: '#f59e0b', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '4px' }}>
                              Đặt trước
                            </span>
                          )}
                        </div>

                        {/* Category & Brand */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                            {p.category}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                            {p.brand}
                          </span>
                        </div>

                        {/* Title */}
                        <Link
                          to={`/product/${p.id}`}
                          style={{
                            display: 'block',
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            lineHeight: 1.4,
                            textDecoration: 'none',
                            marginBottom: '0.5rem',
                            height: '2.5rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {p.name}
                        </Link>
                      </div>

                      {/* Bottom: Price + CTA Button */}
                      <div style={{ marginTop: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.65rem' }}>
                          <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#16a34a' }}>
                            {fmt(p.price)}
                          </span>
                          {showDiscount && (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                              {fmt(p.originalPrice)}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 38px', gap: '0.4rem' }}>
                          {inStock ? (
                            <button
                              onClick={() => handleAddToCart(p)}
                              style={{
                                backgroundColor: addedId === p.id ? '#16a34a' : '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.5rem',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem',
                                transition: 'all 0.15s'
                              }}
                            >
                              {addedId === p.id ? <><Check size={14} /> Đã Thêm</> : <><ShoppingCart size={14} /> Thêm Vào Giỏ</>}
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
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              ⏳ Đặt Trước
                            </button>
                          )}

                          <Link
                            to={`/product/${p.id}`}
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#475569',
                              textDecoration: 'none'
                            }}
                            title="Xem chi tiết sản phẩm"
                          >
                            <Eye size={15} />
                          </Link>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
