import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flame, Check, ShoppingCart, Plus } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import useCatalog from './useCatalog';
import { fmtVnd, PLACEHOLDER_IMG } from './catalog';
import { pickBundleItems } from './bundleRules';

// Khung "Mua kèm giá sốc" trên trang chi tiết sản phẩm: chọn linh kiện đi kèm được giảm thêm,
// thêm cả sản phẩm chính và các món đã chọn vào giỏ trong một lần bấm.
export default function BundleDeals({ product, qty = 1, disabled = false }) {
  const { products } = useCatalog();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const deals = useMemo(() => (product ? pickBundleItems(product, products) : []), [product, products]);
  const [picked, setPicked] = useState({});
  const [added, setAdded] = useState(false);

  useEffect(() => { setPicked({}); setAdded(false); }, [product?.id]);

  if (!deals.length) return null;

  const chosen = deals.filter(d => picked[d.product.id]);
  const mainPrice = Number(product.price) || 0;
  const total = mainPrice * qty + chosen.reduce((s, d) => s + d.price * qty, 0);
  const saving = chosen.reduce((s, d) => s + (Number(d.product.price) - d.price) * qty, 0);
  const toggle = (id) => setPicked(p => ({ ...p, [id]: !p[id] }));

  const addAll = (goToCart) => {
    addToCart(product, qty);
    chosen.forEach(d => addToCart(d.product, qty, { bundleWith: product.id, bundleLabel: `Mua kèm ${product.name}` }));
    if (goToCart) { navigate('/cart'); return; }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <section className="sf-box sf-bundle" aria-labelledby="sf-bundle-title">
      <div className="sf-bundle-head">
        <h2 id="sf-bundle-title"><Flame size={19} /> Mua kèm giá sốc</h2>
        <span>Chọn thêm linh kiện để được giảm ngay khi mua cùng sản phẩm này</span>
      </div>

      <div className="sf-bundle-list">
        {deals.map(({ product: p, percent, price }) => {
          const on = !!picked[p.id];
          return (
            <label key={p.id} className={`sf-bundle-item${on ? ' is-on' : ''}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(p.id)} disabled={disabled}
                aria-label={`Mua kèm ${p.name}`} />
              <span className="tick" aria-hidden="true">{on && <Check size={13} strokeWidth={3} />}</span>
              <span className="sf-bundle-off">-{percent}%</span>
              <img src={p.image || PLACEHOLDER_IMG} alt="" loading="lazy" onError={e => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
              <span className="sf-bundle-info">
                <Link to={`/product/${p.id}`} className="name" title={p.name} onClick={e => e.stopPropagation()}>{p.name}</Link>
                <span className="price">{fmtVnd(price)}</span>
                <span className="old">{fmtVnd(p.price)}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="sf-bundle-foot">
        <div className="sum">
          <span>Tổng tiền ({1 + chosen.length} sản phẩm{qty > 1 ? `, mỗi loại ×${qty}` : ''}):</span>
          <b>{fmtVnd(total)}</b>
          {saving > 0 && <em>Tiết kiệm thêm {fmtVnd(saving)}</em>}
        </div>
        <div className="actions">
          <button type="button" className="sf-btn sf-btn-outline" disabled={disabled || !chosen.length} onClick={() => addAll(false)}>
            {added ? <><Check size={16} /> Đã thêm vào giỏ</> : <><ShoppingCart size={16} /> Thêm {1 + chosen.length} sản phẩm vào giỏ</>}
          </button>
          <button type="button" className="sf-btn sf-btn-primary" disabled={disabled || !chosen.length} onClick={() => addAll(true)}>
            <Plus size={16} /> Mua kèm ngay
          </button>
        </div>
      </div>
      <p className="sf-bundle-note">
        Giá mua kèm áp dụng khi đặt cùng sản phẩm chính trong một đơn hàng, số lượng không vượt quá số lượng sản phẩm chính.
      </p>
    </section>
  );
}
