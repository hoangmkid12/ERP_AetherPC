import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { SF_CATEGORIES, PRICE_RANGES } from './catalog';
import useCatalog from './useCatalog';

// Menu danh mục nhiều cấp: rê chuột vào một danh mục để xem thương hiệu, khoảng giá và lối tắt.
// inline = cột trái trang chủ (bảng phụ nổi đè lên banner); ngược lại là dropdown dưới header.
export default function CategoryMenu({ inline = false, onNavigate }) {
  const { products } = useCatalog();
  const [active, setActive] = useState(inline ? null : SF_CATEGORIES[0].key);

  const brandsByCat = useMemo(() => {
    const map = {};
    for (const p of products) {
      if (!p.brand || p.brand === 'Khác') continue;
      const m = (map[p.category] ||= {});
      m[p.brand] = (m[p.brand] || 0) + 1;
    }
    const out = {};
    for (const [cat, m] of Object.entries(map)) {
      out[cat] = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([b]) => b);
    }
    return out;
  }, [products]);

  const cat = SF_CATEGORIES.find(c => c.key === active);
  const go = () => onNavigate && onNavigate();
  const q = (extra) => `/products?category=${active}${extra ? `&${extra}` : ''}`;

  return (
    <div className={`sf-catmenu${inline ? ' sf-catmenu-inline' : ''}`} onMouseLeave={() => inline && setActive(null)}>
      <div className="sf-catmenu-list">
        {SF_CATEGORIES.map(c => {
          const Icon = c.icon;
          return (
            <Link key={c.key} to={`/products?category=${c.key}`} onClick={go}
              className={`sf-catmenu-item${active === c.key ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(c.key)}>
              <Icon size={18} className="ic" />
              <span>{c.label}</span>
              <ChevronRight size={14} className="chev" />
            </Link>
          );
        })}
      </div>
      {cat && (
        <div className="sf-catmenu-flyout">
          <div className="sf-catmenu-col">
            <h4>Thương hiệu</h4>
            {(brandsByCat[cat.key] || []).map(b => (
              <Link key={b} to={q(`brand=${encodeURIComponent(b)}`)} onClick={go}>{cat.short} {b}</Link>
            ))}
          </div>
          <div className="sf-catmenu-col">
            <h4>Mức giá</h4>
            {PRICE_RANGES.map(r => (
              <Link key={r.key} to={q(`price=${r.key}`)} onClick={go}>{r.label}</Link>
            ))}
          </div>
          <div className="sf-catmenu-col">
            <h4>Gợi ý mua sắm</h4>
            <Link to={q('sort=discount')} onClick={go}>{cat.short} giảm giá sâu</Link>
            <Link to={q('sort=price_asc')} onClick={go}>{cat.short} giá tốt</Link>
            <Link to={q('sort=price_desc')} onClick={go}>{cat.short} cao cấp</Link>
            <Link to={q('stock=1')} onClick={go}>Có sẵn tại kho</Link>
            <Link to="/pc-builder" onClick={go}>Tự build PC với {cat.short}</Link>
            <Link to={q()} onClick={go} style={{ color: 'var(--sf-primary)', fontWeight: 600 }}>Xem tất cả {cat.label.toLowerCase()} →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
