import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Star, ShieldCheck, Truck, RotateCcw, Wrench, ChevronLeft, ChevronRight,
  Check, Minus, Plus, Heart, Package, ArrowLeft, Gift, Phone, PackageCheck, Clock, Send, MessageSquare
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { notify } from '../../context/NotificationContext';
import { api, normalizeProduct } from '../../services/api';
import ProductCard, { ProductCarousel } from '../../components/Storefront/ProductCard';
import { categoryLabel, discountOf, fmtVnd, isInStock, PLACEHOLDER_IMG, SHOP } from '../../components/Storefront/catalog';

const SPEC_LABEL_MAP = {
  socket: 'Socket', cores: 'Số nhân', threads: 'Số luồng', tdp: 'Điện năng tiêu thụ (TDP)', ram_slot: 'Số khe RAM',
  ram_slots: 'Số khe RAM', ram_type: 'Loại RAM', size_format: 'Chuẩn kích thước', capacity: 'Dung lượng', speed: 'Tốc độ',
  bus: 'Bus RAM', chipset: 'Chipset', vram: 'VRAM', wattage: 'Công suất', rating: 'Chứng nhận hiệu suất', modular: 'Chuẩn cáp',
  type: 'Loại', size: 'Kích thước', speed_read: 'Tốc độ đọc', read_speed: 'Tốc độ đọc', write_speed: 'Tốc độ ghi',
  max_vga_length: 'Hỗ trợ VGA tối đa', max_tdp: 'TDP tối đa hỗ trợ', cooling_type: 'Loại tản nhiệt', fan_size: 'Kích thước quạt',
};
function specLabel(key) {
  const k = String(key).toLowerCase().trim();
  if (SPEC_LABEL_MAP[k]) return SPEC_LABEL_MAP[k];
  const t = String(key).replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Format mô tả sản phẩm: lọc bỏ rác cào thô, phân tách thông số kỹ thuật và bài viết đánh giá chuyên nghiệp
function cleanDescription(text, name = '') {
  if (!text) return [];
  let t = String(text)
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/GEARVN|GearVN|Gearvn/g, 'AetherPC')
    .replace(/⭐[^⭐]*⭐/g, '')
    .replace(/Đã hết hàng[^\n#]*/gi, '')
    .replace(/Tham khảo các sản phẩm[^\n#]*/gi, '')
    .trim();

  // Bỏ phần rác 'Thông tin chung', 'Nhà sản xuất', 'Tình trạng', 'Bảo hành' ở đầu nếu có
  t = t.replace(/^[-–\s]*(Thông tin (chung|sản phẩm)|Nhà sản xuất|Hãng sản xuất|Tình trạng|Bảo hành)\s*:?[^.]*?(\d+\s*(tháng|năm)|New\s*100%|Mới)[^#\n.]*/gi, '');
  t = t.replace(/^[-–\s]*(Thông tin (chung|sản phẩm)|Nhà sản xuất|Hãng sản xuất|Tình trạng|Bảo hành)\s*:?[^#\n]*/gi, '');
  t = t.trim();

  // Tách 'Đánh giá chi tiết' và 'THÔNG SỐ KĨ THUẬT' thành các block riêng
  t = t.replace(/(Đánh giá chi tiết[^\n:]*:?)/gi, '## $1 ##');
  t = t.replace(/(THÔNG SỐ K[ĨI] THUẬT\s*:?)/gi, '## $1 ##');

  const rawBlocks = t.split(/##\s*/).map(x => x.trim()).filter(Boolean);
  const result = [];

  const SPEC_KEYS = [
    'GPU', 'Graphics Bus', 'Memory size', 'Memory type', 'Core clock', 'Memory clock',
    'Output', 'Maximum Digital Resolution', 'Memory Interface', 'Memory Bandwidth', 'CUDA Cores',
    'HDCP support', 'DirectX', 'OpenGL', 'Card Dimensions', 'Graphics Card Power', 'Package contents',
    'System Requirements', 'Base clock', 'Boost clock', 'Thương hiệu', 'Model Name', 'Model',
    'Kích cỡ', 'Kích thước', 'Kích thước', 'Giao tiếp', 'Giao thức', 'Dung lượng', 'NAND',
    'Truyền dữ liệu', 'Tiêu thụ điện năng', 'Nhiệt độ bảo quản', 'Nhiệt độ hoạt động', 'Trọng lượng',
    'Khối lượng', 'Tuổi thọ quạt', 'Tuổi thọ', 'Tổng số byte', 'Độ rung', 'Hỗ trợ Socket', 'Hỗ trợ Socket',
    'Chất liệu', 'Tốc độ quạt', 'Lưu lượng gió', 'Độ ồn', 'Kích thước quạt', 'Màu sắc', 'Màu sắc',
    'Bảo hành', 'Điện áp', 'Socket', 'Chipset', 'Chuẩn Bus', 'Độ phân giải', 'Series', 'Cổng xuất hình',
    'Số nhân', 'Số luồng', 'Bộ nhớ đệm', 'Xung cơ bản', 'TDP', 'Số khe RAM', 'Loại RAM'
  ];

  for (const block of rawBlocks) {
    if (!block || block.length < 5) continue;

    // Lọc bỏ block rác chỉ chứa thông tin bảo hành / tình trạng
    if (/^(Thông tin (chung|sản phẩm)|Hãng sản xuất|Nhà sản xuất|Tình trạng|Bảo hành)/i.test(block) && block.length < 150 && !block.includes('Đánh giá') && !block.includes('sản phẩm')) {
      continue;
    }

    // Nếu block là tiêu đề đánh giá
    if (/^Đánh giá chi tiết/i.test(block)) {
      continue;
    }

    // Kiểm tra xem block có chứa danh sách thông số dính liền không
    const matchedKeys = SPEC_KEYS.filter(k => block.includes(k));
    if (matchedKeys.length >= 2) {
      // Tách các thông số thành danh sách nhãn - giá trị
      const sortedKeys = [...matchedKeys].sort((a, b) => b.length - a.length);
      const splitRegex = new RegExp(`(${sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})[:\\s]+`, 'g');
      const parts = block.replace(/^THÔNG SỐ K[ĨI] THUẬT\s*:?\s*/i, '').split(splitRegex).map(s => s.trim()).filter(Boolean);
      
      const items = [];
      for (let i = 0; i < parts.length; i += 2) {
        if (parts[i] && parts[i + 1]) {
          // Làm sạch giá trị thông số
          let val = parts[i + 1].replace(/[:\s]+$/, '').trim();
          if (val.length > 0 && val.length < 250) {
            items.push({ label: parts[i], val });
          }
        }
      }
      if (items.length > 0) {
        result.push({ head: 'Thông số chi tiết sản phẩm', items });
        continue;
      }
    }

    // Nếu block là bài viết đánh giá hoặc giới thiệu (đoạn văn có dấu câu)
    const cleanParagraph = block.replace(/^(Đánh giá chi tiết[^\n.]*\.?\s*)/i, '').trim();
    if (cleanParagraph) {
      // Tách thành các đoạn văn mạch lạc nếu quá dài
      const sentences = cleanParagraph.split(/(?<=[.!?])\s+/);
      if (sentences.length > 4) {
        // Gom 3-4 câu thành 1 đoạn văn dễ đọc
        const paragraphs = [];
        for (let i = 0; i < sentences.length; i += 3) {
          paragraphs.push(sentences.slice(i, i + 3).join(' '));
        }
        result.push({ head: 'Đánh giá & Tính năng nổi bật', paragraphs });
      } else {
        result.push({ head: 'Đánh giá & Tính năng nổi bật', body: cleanParagraph });
      }
    }
  }

  return result;
}

function Stars({ value, size = 14, onChange }) {
  const [hover, setHover] = useState(null);
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => {
        const on = (hover ?? value) >= s - 0.25;
        return (
          <Star key={s} size={size} fill={on ? '#f59e0b' : 'none'} stroke={on ? '#f59e0b' : '#cbd5e1'}
            style={{ cursor: onChange ? 'pointer' : 'default' }}
            onMouseEnter={() => onChange && setHover(s)} onMouseLeave={() => onChange && setHover(null)}
            onClick={() => onChange && onChange(s)} />
        );
      })}
    </span>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth() || {};
  const { addToCart, toggleWishlist, isInWishlist } = useCart();
  const [product, setProduct] = useState(null);
  const [warranty, setWarranty] = useState('');
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState([]);
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [cartOk, setCartOk] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [rStars, setRStars] = useState(0);
  const [rText, setRText] = useState('');
  const [rSending, setRSending] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true); setImgIdx(0); setQty(1); setDescOpen(false);
    api.get(`/products/${id}`)
      .then(res => {
        const raw = res?.data || res;
        if (!raw || !raw.name) throw new Error('not found');
        setProduct(normalizeProduct(raw));
        setWarranty((raw.warranty || '').replace(/thang/i, 'tháng'));
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
    setRelated([]);
    api.get(`/products/${id}/recommendations`)
      .then(res => { const l = res?.data || res; if (Array.isArray(l)) setRelated(l.map(normalizeProduct)); })
      .catch(() => {});
    api.get(`/products/${id}/reviews`)
      .then(res => setReviews(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setReviews([]));
  }, [id]);

  const images = useMemo(() => {
    if (!product) return [];
    return [...new Set([product.image, ...(product.imageUrls || [])].filter(Boolean))];
  }, [product]);
  const desc = useMemo(() => cleanDescription(product?.descriptionText, product?.name), [product]);

  if (loading) return (
    <div className="sf-container" style={{ padding: '80px 0', textAlign: 'center', color: 'var(--sf-muted)' }}>
      <style>{'@keyframes sfspin{to{transform:rotate(360deg)}}'}</style>
      <div style={{ width: 40, height: 40, margin: '0 auto 12px', border: '3px solid #e5e7eb', borderTopColor: 'var(--sf-primary)', borderRadius: '50%', animation: 'sfspin .8s linear infinite' }} />
      Đang tải sản phẩm...
    </div>
  );

  if (!product) return (
    <div className="sf-container"><div className="sf-empty" style={{ marginTop: 20 }}>
      <Package size={48} color="#9ca3af" />
      <h3>Không tìm thấy sản phẩm</h3>
      <p>Sản phẩm có thể đã ngừng kinh doanh hoặc đường dẫn không đúng.</p>
      <button type="button" className="sf-btn sf-btn-primary" onClick={() => navigate('/products')}><ArrowLeft size={15} /> Xem sản phẩm khác</button>
    </div></div>
  );

  const inStock = isInStock(product);
  const off = discountOf(product);
  const fav = isInWishlist(product.id);
  const saving = product.originalPrice > product.price ? product.originalPrice - product.price : 0;
  const specEntries = Object.entries(product.specs || {}).filter(([k]) => !/bảo_hành/.test(k));
  const warrantyText = warranty || product.specs?.['bảo_hành'] || '24–36 tháng';
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const curImg = images[imgIdx] || PLACEHOLDER_IMG;
  const relatedList = related.filter(p => String(p.id) !== String(id));

  const handleCart = () => {
    addToCart(product, qty);
    setCartOk(true);
    setTimeout(() => setCartOk(false), 2000);
  };
  const handleBuy = () => { addToCart(product, qty); navigate('/cart'); };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!rStars) return;
    setRSending(true);
    try {
      const res = await api.post(`/products/${id}/reviews`, { rating: rStars, comment: rText.trim() || undefined });
      if (res?.data) setReviews(r => [res.data, ...r]);
      setRStars(0); setRText('');
      notify('Cảm ơn bạn đã đánh giá sản phẩm!', 'success');
    } catch (err) {
      notify(err.message || 'Không gửi được đánh giá, vui lòng thử lại.', 'error');
    } finally {
      setRSending(false);
    }
  };

  return (
    <div className="sf-container">
      <nav className="sf-breadcrumb" aria-label="breadcrumb">
        <Link to="/">Trang chủ</Link><span>/</span>
        <Link to={`/products?category=${product.category}`}>{categoryLabel(product.category)}</Link><span>/</span>
        <span className="cur">{product.name}</span>
      </nav>

      <div className="sf-box sf-pd">
        {/* Thư viện ảnh */}
        <div>
          <div className="sf-gallery-main">
            <div className="sf-card-tags" style={{ top: 12, left: 12 }}>
              {off > 0 && <span className="sf-tag sf-tag-hot">-{off}%</span>}
              {inStock && <span className="sf-tag sf-tag-soft">Có sẵn tại kho</span>}
            </div>
            <img src={curImg} alt={product.name} onError={e => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
            {images.length > 1 && <>
              <button type="button" className="sf-gallery-nav prev" onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)} aria-label="Ảnh trước"><ChevronLeft size={18} /></button>
              <button type="button" className="sf-gallery-nav next" onClick={() => setImgIdx(i => (i + 1) % images.length)} aria-label="Ảnh sau"><ChevronRight size={18} /></button>
            </>}
          </div>
          {images.length > 1 && (
            <div className="sf-gallery-thumbs">
              {images.map((u, i) => (
                <button key={u} type="button" className={i === imgIdx ? 'is-on' : ''} onClick={() => setImgIdx(i)} aria-label={`Ảnh ${i + 1}`}>
                  <img src={u} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thông tin mua hàng */}
        <div style={{ minWidth: 0 }}>
          <h1 className="sf-pd-title">{product.name}</h1>
          <div className="sf-pd-meta">
            {reviews.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Stars value={avg} /> <b>{avg.toFixed(1)}</b> ({reviews.length} đánh giá)</span>}
            <span>Thương hiệu: <b>{product.brand}</b></span>
            <span>Mã SP: <b>{product.sku}</b></span>
            <span>Bảo hành: <b>{warrantyText}</b></span>
          </div>

          <div className="sf-pd-pricebox">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span className="sf-pd-price">{fmtVnd(product.price)}</span>
              {saving > 0 && <span className="sf-pd-price-old">{fmtVnd(product.originalPrice)}</span>}
              {off > 0 && <span className="sf-discount" style={{ fontSize: 13, lineHeight: '22px' }}>-{off}%</span>}
            </div>
            {saving > 0 && <div className="sf-pd-save">Tiết kiệm {fmtVnd(saving)} so với giá niêm yết</div>}
            <div style={{ marginTop: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              {inStock
                ? <span className="sf-stock-ok"><PackageCheck size={15} /> Còn hàng ({product.stockQuantity} sản phẩm tại kho)</span>
                : <span className="sf-stock-pre"><Clock size={15} /> Tạm hết hàng — nhận đặt trước</span>}
            </div>
          </div>

          <div className="sf-offer">
            <div className="sf-offer-head"><Gift size={17} /> Quà tặng & ưu đãi khi mua tại AetherPC</div>
            <ul>
              <li><span className="n">1</span><span>Miễn phí giao hàng toàn quốc cho mọi đơn hàng.</span></li>
              <li><span className="n">2</span><span>Bảo hành chính hãng {warrantyText}, đổi mới nếu lỗi do nhà sản xuất.</span></li>
              <li><span className="n">3</span><span>Lắp ráp và kiểm tra miễn phí khi mua kèm linh kiện qua công cụ <Link to="/pc-builder" style={{ color: 'var(--sf-primary)', fontWeight: 600 }}>Build PC</Link>.</span></li>
              <li><span className="n">4</span><span>Tích điểm thành viên cho mỗi đơn hàng — <Link to="/member-tier" style={{ color: 'var(--sf-primary)', fontWeight: 600 }}>xem quyền lợi hạng thành viên</Link>.</span></li>
            </ul>
          </div>

          {!inStock && (
            <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, color: '#92400e', fontSize: 13.5, marginBottom: 12 }}>
              Sản phẩm đang tạm hết tại kho. Gọi <b>{SHOP.hotlineSales}</b> hoặc chat với CSKH để được giữ hàng khi có hàng về.
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Số lượng</span>
            <div className="sf-qty">
              <button type="button" disabled={!inStock || qty <= 1} onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Giảm"><Minus size={14} /></button>
              <span>{qty}</span>
              <button type="button" disabled={!inStock || qty >= (Number(product.stockQuantity) || 1)} onClick={() => setQty(q => q + 1)} aria-label="Tăng"><Plus size={14} /></button>
            </div>
            <button type="button" className="sf-btn sf-btn-ghost" onClick={() => toggleWishlist(product)} style={{ color: fav ? 'var(--sf-primary)' : undefined }}>
              <Heart size={16} fill={fav ? 'currentColor' : 'none'} /> {fav ? 'Đã yêu thích' : 'Yêu thích'}
            </button>
          </div>

          <div className="sf-buy-row">
            <button type="button" className="sf-btn sf-btn-primary sf-btn-lg sf-buy-now" disabled={!inStock} onClick={handleBuy}>
              MUA NGAY<small>Giao tận nơi hoặc nhận tại cửa hàng</small>
            </button>
            <button type="button" className="sf-btn sf-btn-outline sf-btn-lg" style={{ height: 56 }} disabled={!inStock} onClick={handleCart}>
              {cartOk ? <><Check size={18} /> Đã thêm vào giỏ</> : <><ShoppingCart size={18} /> Thêm vào giỏ</>}
            </button>
          </div>
          <div style={{ marginTop: 12, fontSize: 13.5, color: 'var(--sf-text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Phone size={15} color="var(--sf-primary)" /> Gọi đặt mua <b style={{ color: 'var(--sf-primary)' }}>{SHOP.hotlineSales}</b> (8:00 – 21:00)
          </div>

          <div className="sf-policy sf-policy-grid">
            <div className="sf-policy-item"><ShieldCheck size={18} /><div><b>Hàng chính hãng</b>Có hóa đơn, tem bảo hành đầy đủ</div></div>
            <div className="sf-policy-item"><Truck size={18} /><div><b>Giao hàng toàn quốc</b>Theo dõi trạng thái đơn trực tuyến</div></div>
            <div className="sf-policy-item"><RotateCcw size={18} /><div><b>Đổi trả dễ dàng</b>Gửi yêu cầu ngay trong mục Đơn hàng của tôi</div></div>
            <div className="sf-policy-item"><Wrench size={18} /><div><b>Hỗ trợ kỹ thuật</b>Tư vấn cài đặt, nâng cấp miễn phí</div></div>
          </div>
        </div>
      </div>

      {/* Mô tả + thông số */}
      <div className="sf-pd-body">
        <div className="sf-box sf-pd-panel">
          <h2>Mô tả sản phẩm</h2>
          {desc.length > 0 ? (
            <>
              <div className={`sf-desc${descOpen ? '' : ' is-clamped'}`}>
                {desc.map((d, i) => (
                  <div key={i} style={{ marginBottom: 20 }}>
                    {d.head && <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sf-text)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>{d.head}</h3>}
                    {d.items ? (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '8px 16px',
                        background: '#f8fafc',
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0'
                      }}>
                        {d.items.map((it, idx) => (
                          <div key={idx} style={{ display: 'flex', fontSize: '13.5px', lineHeight: 1.5, gap: 6 }}>
                            <span style={{ color: '#64748b', fontWeight: 600, minWidth: 100 }}>{it.label}:</span>
                            <span style={{ color: '#0f172a', fontWeight: 500, flex: 1 }}>{it.val}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: 0, lineHeight: 1.7, color: '#334155', fontSize: '14px' }}>{d.body}</p>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button type="button" className="sf-btn sf-btn-outline" onClick={() => setDescOpen(o => !o)}>{descOpen ? 'Thu gọn' : 'Xem thêm nội dung'}</button>
              </div>
            </>
          ) : (
            <p className="sf-desc">{product.name} chính hãng {product.brand}, phân phối bởi AetherPC với đầy đủ hóa đơn và bảo hành {warrantyText}.</p>
          )}
        </div>

        <div className="sf-box sf-pd-panel" style={{ position: 'sticky', top: 84 }}>
          <h2>Thông số kỹ thuật</h2>
          <table className="sf-spec-table">
            <tbody>
              <tr><td>Thương hiệu</td><td>{product.brand}</td></tr>
              <tr><td>Danh mục</td><td>{categoryLabel(product.category)}</td></tr>
              {specEntries.map(([k, v]) => (
                <tr key={k}><td>{specLabel(k)}</td><td>{Array.isArray(v) ? v.join(', ') : String(v)}</td></tr>
              ))}
              <tr><td>Bảo hành</td><td>{warrantyText}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Đánh giá thật từ khách hàng */}
      <section className="sf-section sf-box sf-pd-panel">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MessageSquare size={20} /> Đánh giá & nhận xét</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, alignItems: 'start' }}>
          <div style={{ textAlign: 'center', padding: 16, border: '1px solid var(--sf-border)', borderRadius: 8 }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: 'var(--sf-text)' }}>{reviews.length ? avg.toFixed(1) : '–'}<span style={{ fontSize: 18, color: 'var(--sf-muted)' }}>/5</span></div>
            <Stars value={avg} size={18} />
            <div style={{ fontSize: 13, color: 'var(--sf-muted)', marginTop: 4 }}>{reviews.length} lượt đánh giá</div>
            {[5, 4, 3, 2, 1].map(s => {
              const n = reviews.filter(r => r.rating === s).length;
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginTop: 6 }}>
                  <span style={{ width: 26 }}>{s}★</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#f3f4f6', overflow: 'hidden' }}>
                    <div style={{ width: `${reviews.length ? (n / reviews.length) * 100 : 0}%`, height: '100%', background: '#f59e0b' }} />
                  </div>
                  <span style={{ width: 20, textAlign: 'right', color: 'var(--sf-muted)' }}>{n}</span>
                </div>
              );
            })}
          </div>
          <div>
            {isAuthenticated && user?.role === 'CUSTOMER' ? (
              <form onSubmit={submitReview} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Bạn đánh giá sản phẩm này thế nào?</div>
                <Stars value={rStars} size={24} onChange={setRStars} />
                <textarea value={rText} onChange={e => setRText(e.target.value)} rows={3} placeholder="Chia sẻ cảm nhận của bạn về sản phẩm (không bắt buộc)"
                  style={{ width: '100%', marginTop: 8, border: '1px solid var(--sf-border)', borderRadius: 6, padding: 10, fontSize: 14, resize: 'vertical' }} />
                <button type="submit" className="sf-btn sf-btn-primary" disabled={!rStars || rSending} style={{ marginTop: 8 }}><Send size={15} /> Gửi đánh giá</button>
              </form>
            ) : (
              <div style={{ fontSize: 13.5, color: 'var(--sf-text-2)', marginBottom: 16 }}>
                <Link to="/login" style={{ color: 'var(--sf-primary)', fontWeight: 600 }}>Đăng nhập</Link> bằng tài khoản khách hàng để viết đánh giá.
              </div>
            )}
            {reviews.length === 0 ? (
              <p style={{ color: 'var(--sf-muted)', fontSize: 14 }}>Chưa có đánh giá nào cho sản phẩm này.</p>
            ) : reviews.slice(0, 8).map(r => (
              <div key={r.id} style={{ padding: '12px 0', borderTop: '1px solid var(--sf-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#f3f4f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--sf-text-2)' }}>
                    {(r.customer?.name || 'K').charAt(0)}
                  </span>
                  <b style={{ fontSize: 14 }}>{r.customer?.name || 'Khách hàng'}</b>
                  <Stars value={r.rating} size={13} />
                  <span style={{ fontSize: 12, color: 'var(--sf-muted)' }}>{new Date(r.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
                {r.comment && <p style={{ margin: '6px 0 0 42px', fontSize: 14, color: 'var(--sf-text-2)', lineHeight: 1.55 }}>{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {relatedList.length > 0 && (
        <section className="sf-section sf-section-box">
          <div className="sf-section-head">
            <h2 className="sf-section-title">Sản phẩm <span className="accent">tương tự</span></h2>
            <Link to={`/products?category=${product.category}`} className="sf-viewall">Xem tất cả <ChevronRight size={15} /></Link>
          </div>
          {relatedList.length >= 5
            ? <ProductCarousel products={relatedList} />
            : <div className="sf-grid">{relatedList.map(p => <ProductCard key={p.id} product={p} />)}</div>}
        </section>
      )}
    </div>
  );
}
