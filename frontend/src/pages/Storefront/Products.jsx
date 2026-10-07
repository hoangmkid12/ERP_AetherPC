import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronLeft, ChevronRight, SearchX, GitCompare } from 'lucide-react';
import ProductCard from '../../components/Storefront/ProductCard';
import ComparisonModal from '../../components/Storefront/ProductComparison';
import useCatalog from '../../components/Storefront/useCatalog';
import { SF_CATEGORIES, PRICE_RANGES, SORTS, categoryLabel, discountOf, isInStock, fmtVnd } from '../../components/Storefront/catalog';

const PAGE_SIZE = 20;

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

export default function Products() {
  const [params, setParams] = useSearchParams();
  const { products, loading } = useCatalog();
  const [showFilter, setShowFilter] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);

  // Bộ lọc đọc từ URL để chia sẻ/lưu được và để menu danh mục trỏ thẳng tới đây
  const category = (params.get('category') || '').toUpperCase();
  const brands = (params.get('brand') || '').split(',').filter(Boolean);
  const price = params.get('price') || '';
  const minP = Number(params.get('min')) || 0;
  const maxP = Number(params.get('max')) || 0;
  const sort = params.get('sort') || 'popular';
  const q = params.get('q') || '';
  const onlyStock = params.get('stock') === '1';
  const onlySale = params.get('sale') === '1';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [minInput, setMinInput] = useState(minP ? String(minP) : '');
  const [maxInput, setMaxInput] = useState(maxP ? String(maxP) : '');
  useEffect(() => { setMinInput(minP ? String(minP) : ''); setMaxInput(maxP ? String(maxP) : ''); }, [minP, maxP]);

  const update = (changes, keepPage = false) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '' || v === false) next.delete(k);
      else next.set(k, String(v));
    });
    if (!keepPage) next.delete('page');
    setParams(next);
  };

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [page, category]);

  const words = norm(q).split(/\s+/).filter(Boolean);
  const range = PRICE_RANGES.find(r => r.key === price);

  // Lọc theo mọi điều kiện trừ thương hiệu → dùng để đếm số sản phẩm của từng thương hiệu
  const baseFiltered = useMemo(() => products.filter(p => {
    if (category && p.category !== category) return false;
    if (words.length && !words.every(w => norm(`${p.name} ${p.brand} ${p.sku}`).includes(w))) return false;
    if (range && !(p.price >= range.min && p.price < range.max)) return false;
    if (minP && p.price < minP) return false;
    if (maxP && p.price > maxP) return false;
    if (onlyStock && !isInStock(p)) return false;
    if (onlySale && discountOf(p) <= 0) return false;
    return true;
  }), [products, category, q, price, minP, maxP, onlyStock, onlySale]); // eslint-disable-line react-hooks/exhaustive-deps

  const brandCounts = useMemo(() => {
    const m = {};
    baseFiltered.forEach(p => { if (p.brand && p.brand !== 'Khác') m[p.brand] = (m[p.brand] || 0) + 1; });
    brands.forEach(b => { if (!(b in m)) m[b] = 0; });
    return Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [baseFiltered, params]); // eslint-disable-line react-hooks/exhaustive-deps

  const catCounts = useMemo(() => {
    const m = {};
    products.forEach(p => { m[p.category] = (m[p.category] || 0) + 1; });
    return m;
  }, [products]);

  const list = useMemo(() => {
    const arr = brands.length ? baseFiltered.filter(p => brands.includes(p.brand)) : [...baseFiltered];
    return arr.sort((a, b) => {
      const s = isInStock(b) - isInStock(a);           // còn hàng luôn lên trước
      if (s) return s;
      if (sort === 'price_asc') return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      if (sort === 'name_asc') return a.name.localeCompare(b.name, 'vi');
      if (sort === 'discount') return discountOf(b) - discountOf(a);
      return (Number(b.stockQuantity) || 0) - (Number(a.stockQuantity) || 0) || discountOf(b) - discountOf(a);
    });
  }, [baseFiltered, params]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const curPage = Math.min(page, pages);
  const view = list.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  const toggleBrand = (b) => {
    const next = brands.includes(b) ? brands.filter(x => x !== b) : [...brands, b];
    update({ brand: next.join(',') });
  };

  const title = q ? `Kết quả tìm kiếm cho "${q}"` : category ? categoryLabel(category) : 'Tất cả sản phẩm';

  const activeChips = [
    category && { label: categoryLabel(category), clear: { category: null, brand: null } },
    q && { label: `"${q}"`, clear: { q: null } },
    ...brands.map(b => ({ label: b, clear: { brand: brands.filter(x => x !== b).join(',') } })),
    range && { label: range.label, clear: { price: null } },
    (minP || maxP) && { label: `${minP ? fmtVnd(minP) : '0₫'} – ${maxP ? fmtVnd(maxP) : '...'}`, clear: { min: null, max: null } },
    onlyStock && { label: 'Còn hàng', clear: { stock: null } },
    onlySale && { label: 'Đang giảm giá', clear: { sale: null } },
  ].filter(Boolean);

  const pageNumbers = (() => {
    const out = [];
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - curPage) <= 2) out.push(i);
      else if (out[out.length - 1] !== '…') out.push('…');
    }
    return out;
  })();

  const visibleBrands = showAllBrands ? brandCounts : brandCounts.slice(0, 8);

  return (
    <div className="sf-container">
      <nav className="sf-breadcrumb" aria-label="breadcrumb">
        <Link to="/">Trang chủ</Link><span>/</span>
        {category ? <><Link to="/products">Sản phẩm</Link><span>/</span><span className="cur">{categoryLabel(category)}</span></> : <span className="cur">Sản phẩm</span>}
      </nav>

      {/* Danh mục nhanh */}
      <div className="sf-section-box" style={{ marginBottom: 12, padding: 12 }}>
        <div className="sf-section-links" style={{ flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <button type="button" className={`sf-chip${!category ? ' is-active' : ''}`} onClick={() => update({ category: null, brand: null })}>Tất cả</button>
          {SF_CATEGORIES.map(c => (
            <button key={c.key} type="button" className={`sf-chip${category === c.key ? ' is-active' : ''}`}
              onClick={() => update({ category: c.key, brand: null })}>
              <c.icon size={15} /> {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sf-listing">
        {showFilter && <div className="sf-filter-backdrop" onClick={() => setShowFilter(false)} />}
        <aside className={`sf-filter${showFilter ? ' is-open' : ''}`} aria-label="Bộ lọc sản phẩm">
          <div className="sf-filter-head">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SlidersHorizontal size={16} /> Bộ lọc</span>
            <span style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setParams(q ? { q } : {})}>Xóa lọc</button>
              <button type="button" className="sf-mobile-filter-btn" onClick={() => setShowFilter(false)} aria-label="Đóng"><X size={18} /></button>
            </span>
          </div>

          <div className="sf-filter-group">
            <h4>Danh mục</h4>
            {SF_CATEGORIES.map(c => (
              <label key={c.key} className={`sf-check${category === c.key ? ' is-on' : ''}`}>
                <input type="radio" name="cat" checked={category === c.key} onChange={() => update({ category: c.key, brand: null })} />
                {c.label}<span className="cnt">{catCounts[c.key] || 0}</span>
              </label>
            ))}
          </div>

          {brandCounts.length > 0 && (
            <div className="sf-filter-group">
              <h4>Thương hiệu</h4>
              {visibleBrands.map(([b, n]) => (
                <label key={b} className={`sf-check${brands.includes(b) ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={brands.includes(b)} onChange={() => toggleBrand(b)} />
                  {b}<span className="cnt">{n}</span>
                </label>
              ))}
              {brandCounts.length > 8 && (
                <button type="button" onClick={() => setShowAllBrands(v => !v)}
                  style={{ border: 'none', background: 'none', color: 'var(--sf-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 0 0' }}>
                  {showAllBrands ? 'Thu gọn' : `Xem thêm ${brandCounts.length - 8} thương hiệu`}
                </button>
              )}
            </div>
          )}

          <div className="sf-filter-group">
            <h4>Mức giá</h4>
            <label className={`sf-check${!price ? ' is-on' : ''}`}>
              <input type="radio" name="price" checked={!price} onChange={() => update({ price: null })} /> Tất cả
            </label>
            {PRICE_RANGES.map(r => (
              <label key={r.key} className={`sf-check${price === r.key ? ' is-on' : ''}`}>
                <input type="radio" name="price" checked={price === r.key} onChange={() => update({ price: r.key, min: null, max: null })} /> {r.label}
              </label>
            ))}
            <form className="sf-price-inputs" onSubmit={e => { e.preventDefault(); update({ min: Number(minInput) || null, max: Number(maxInput) || null, price: null }); }}>
              <input inputMode="numeric" placeholder="Từ" value={minInput} onChange={e => setMinInput(e.target.value.replace(/\D/g, ''))} />
              <span>–</span>
              <input inputMode="numeric" placeholder="Đến" value={maxInput} onChange={e => setMaxInput(e.target.value.replace(/\D/g, ''))} />
              <button type="submit" className="sf-btn sf-btn-outline" style={{ height: 34, padding: '0 10px' }}>Áp dụng</button>
            </form>
          </div>

          <div className="sf-filter-group">
            <h4>Tình trạng</h4>
            <label className={`sf-check${onlyStock ? ' is-on' : ''}`}>
              <input type="checkbox" checked={onlyStock} onChange={() => update({ stock: onlyStock ? null : 1 })} /> Còn hàng tại kho
            </label>
            <label className={`sf-check${onlySale ? ' is-on' : ''}`}>
              <input type="checkbox" checked={onlySale} onChange={() => update({ sale: onlySale ? null : 1 })} /> Đang giảm giá
            </label>
          </div>
        </aside>

        <div style={{ minWidth: 0 }}>
          <div className="sf-listing-top">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <h1>{title}</h1>
                <div className="count">{loading && !products.length ? 'Đang tải sản phẩm...' : `${list.length.toLocaleString('vi-VN')} sản phẩm`}</div>
              </div>
              <button type="button" className="sf-btn sf-btn-ghost sf-mobile-filter-btn" onClick={() => setShowFilter(true)}><SlidersHorizontal size={16} /> Bộ lọc</button>
              <button type="button" className="sf-btn sf-btn-ghost" onClick={() => setShowCompare(true)}><GitCompare size={16} /> So sánh sản phẩm</button>
            </div>
            <div className="sf-sortbar">
              <span>Sắp xếp:</span>
              {SORTS.map(s => (
                <button key={s.key} type="button" className={`sf-chip${sort === s.key ? ' is-active' : ''}`} onClick={() => update({ sort: s.key === 'popular' ? null : s.key })}>{s.label}</button>
              ))}
            </div>
            {activeChips.length > 0 && (
              <div className="sf-active-filters">
                {activeChips.map(c => (
                  <button key={c.label} type="button" className="sf-chip" onClick={() => update(c.clear)}>{c.label} <X size={13} /></button>
                ))}
                <button type="button" className="sf-viewall" style={{ marginLeft: 4, border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => setParams({})}>Xóa tất cả</button>
              </div>
            )}
          </div>

          {view.length === 0 ? (
            <div className="sf-empty">
              <SearchX size={44} color="#9ca3af" />
              <h3>{loading ? 'Đang tải sản phẩm...' : 'Không tìm thấy sản phẩm phù hợp'}</h3>
              {!loading && <p>Hãy thử bỏ bớt bộ lọc hoặc tìm với từ khóa khác.</p>}
              {!loading && <button type="button" className="sf-btn sf-btn-primary" onClick={() => setParams({})}>Xem tất cả sản phẩm</button>}
            </div>
          ) : (
            <div className="sf-grid sf-grid-4">
              {view.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}

          {pages > 1 && (
            <div className="sf-pagination">
              <button type="button" disabled={curPage === 1} onClick={() => update({ page: curPage - 1 }, true)} aria-label="Trang trước"><ChevronLeft size={16} /></button>
              {pageNumbers.map((n, i) => n === '…'
                ? <button key={`e${i}`} type="button" disabled>…</button>
                : <button key={n} type="button" className={n === curPage ? 'is-on' : ''} onClick={() => update({ page: n === 1 ? null : n }, true)}>{n}</button>)}
              <button type="button" disabled={curPage === pages} onClick={() => update({ page: curPage + 1 }, true)} aria-label="Trang sau"><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      </div>

      {showCompare && <ComparisonModal products={products} onClose={() => setShowCompare(false)} />}
    </div>
  );
}
