import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Check, Clock, PackageCheck, Gift, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { notify } from '../../context/NotificationContext';
import { fmtVnd, isInStock, discountOf, shortSpecs, PLACEHOLDER_IMG } from './catalog';

// Thẻ sản phẩm dùng chung cho mọi trang storefront.
// stockBar: hiện thanh số lượng còn lại (tồn kho thật) thay cho nút giỏ hàng — dùng ở khối Flash Sale.
export default function ProductCard({ product: p, badge, stockBar = false, showSpecs = true }) {
  const { addToCart, toggleWishlist, isInWishlist } = useCart();
  const [added, setAdded] = useState(false);
  if (!p) return null;
  const inStock = isInStock(p);
  const off = discountOf(p);
  const fav = isInWishlist(p.id);
  const specs = showSpecs ? shortSpecs(p, 3) : [];

  const onAdd = (e) => {
    e.preventDefault();
    if (!inStock) {
      notify('Sản phẩm đang tạm hết hàng. Vui lòng liên hệ Hotline 1800 9999 hoặc chat với CSKH để đặt trước.', 'error');
      return;
    }
    addToCart(p, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="sf-card">
      <Link to={`/product/${p.id}`} className="sf-card-img">
        <div className="sf-card-tags">
          {badge && <span className="sf-tag sf-tag-hot">{badge}</span>}
          {off >= 20 && !badge && <span className="sf-tag sf-tag-hot">Giảm sốc</span>}
          {p.price >= 10000000 && <span className="sf-tag sf-tag-gift"><Gift size={11} /> Quà tặng</span>}
        </div>
        <img src={p.image || PLACEHOLDER_IMG} alt={p.name} loading="lazy"
          onError={e => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
      </Link>
      <button type="button" className={`sf-card-fav${fav ? ' is-on' : ''}`} title={fav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
        onClick={() => toggleWishlist(p)}>
        <Heart size={15} fill={fav ? 'currentColor' : 'none'} />
      </button>

      {p.brand && p.brand !== 'Khác' && <div className="sf-card-brand">{p.brand}</div>}
      <Link to={`/product/${p.id}`} className="sf-card-name" title={p.name}>{p.name}</Link>
      {showSpecs && (
        <div className="sf-card-specs">
          {specs.map(s => <span key={s}>{s}</span>)}
        </div>
      )}

      <div className="sf-card-price">
        {off > 0 && p.originalPrice > p.price
          ? <span className="sf-price-old">{fmtVnd(p.originalPrice)}</span>
          : <span className="sf-price-old is-empty">0₫</span>}
        <div className="sf-price-row">
          <span className="sf-price">{fmtVnd(p.price)}</span>
          {off > 0 && <span className="sf-discount">-{off}%</span>}
        </div>
      </div>

      {stockBar ? (
        <div className="sf-sold">
          <div className="sf-sold-bar">
            <i style={{ width: `${Math.min(100, Math.max(10, (Number(p.stockQuantity) || 0) / 60 * 100))}%` }} />
            <span>{Number(p.stockQuantity) <= 5 ? `Sắp hết — chỉ còn ${p.stockQuantity}` : `Còn ${p.stockQuantity} sản phẩm`}</span>
          </div>
        </div>
      ) : (
        <div className="sf-card-foot">
          {inStock
            ? <span className="sf-stock-ok"><PackageCheck size={13} /> Còn hàng</span>
            : <span className="sf-stock-pre"><Clock size={13} /> Đặt trước</span>}
          <button type="button" className={`sf-card-cart${added ? ' is-done' : ''}`} onClick={onAdd} disabled={!inStock}
            title={inStock ? 'Thêm vào giỏ hàng' : 'Tạm hết hàng'}>
            {added ? <Check size={16} /> : <ShoppingCart size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}

// Hàng sản phẩm cuộn ngang có nút trái/phải
export function ProductCarousel({ products, render }) {
  const ref = useRef(null);
  const scroll = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  return (
    <div className="sf-carousel">
      <button type="button" className="sf-carousel-nav prev" onClick={() => scroll(-1)} aria-label="Trước"><ChevronLeft size={18} /></button>
      <div className="sf-row-scroll" ref={ref}>
        {products.map((p, i) => render ? render(p, i) : <ProductCard key={p.id} product={p} />)}
      </div>
      <button type="button" className="sf-carousel-nav next" onClick={() => scroll(1)} aria-label="Sau"><ChevronRight size={18} /></button>
    </div>
  );
}
