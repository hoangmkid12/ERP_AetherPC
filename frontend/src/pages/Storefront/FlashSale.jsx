import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useInventoryStore } from "../../stores";
import { useCart } from "../../context/CartContext";
import { notify } from "../../context/NotificationContext";
import {
  Zap, ChevronRight, Star, TrendingUp, Package,
  Percent, Timer, X, Search, SlidersHorizontal,
  ChevronDown, ShoppingCart, CheckCircle, Eye, ArrowRight
} from "lucide-react";

function useCountdown(target) {
  const [left, setLeft] = useState(Math.max(0, target - Date.now()));
  useEffect(() => {
    setLeft(Math.max(0, target - Date.now()));
    const id = setInterval(() => setLeft(Math.max(0, target - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);
  return {
    h: Math.floor(left / 3600000),
    m: Math.floor((left % 3600000) / 60000),
    s: Math.floor((left % 60000) / 1000),
  };
}
const pad = (n) => String(n).padStart(2, "0");
const SALE_END = Date.now() + 8 * 3600 * 1000 + 47 * 60 * 1000 + 33 * 1000;

const CATEGORIES = [
  { id: "ALL", label: "Tất Cả", icon: "🛒" },
  { id: "CPU", label: "CPU", icon: "🖥️" },
  { id: "VGA", label: "Card Màn Hình", icon: "🎮" },
  { id: "RAM", label: "RAM", icon: "💾" },
  { id: "SSD", label: "SSD", icon: "💿" },
  { id: "HDD", label: "HDD", icon: "🗄️" },
  { id: "MAINBOARD", label: "Mainboard", icon: "🔌" },
  { id: "PSU", label: "Nguồn", icon: "⚡" },
  { id: "CASE", label: "Thùng máy", icon: "📦" },
  { id: "COOLING", label: "Tản Nhiệt", icon: "❄️" },
];

const SORT_OPTIONS = [
  { id: "discount", label: "Giảm nhiều nhất" },
  { id: "price_asc", label: "Giá tăng dần" },
  { id: "price_desc", label: "Giá giảm dần" },
  { id: "popular", label: "Phổ biến nhất" },
];

function CountdownBlock({ value, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ backgroundColor: "#ffffff", color: "#dc2626", fontWeight: 900, fontSize: "2.2rem", lineHeight: 1, minWidth: 70, textAlign: "center", padding: "0.55rem 0.4rem", borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.18)", letterSpacing: -2 }}>
        {value}
      </div>
      <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
    </div>
  );
}

function FlashProductCard({ p, onAddCart }) {
  const navigate = useNavigate();
  const soldPercent = Math.min(96, 30 + ((p.id * 17) % 60));
  const reviewCount = 12 + (p.id % 88);
  const rating = (4.0 + (p.id % 11) / 10).toFixed(1);
  const isHot = soldPercent > 75;
  const isSoldOut = soldPercent >= 96;
  const [added, setAdded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const handleAdd = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (isSoldOut) return;
    const inStock = (Number(p.stockQuantity) > 0 || Number(p.stock) > 0) && !p.isPreorder;
    if (!inStock) {
      notify('Sản phẩm này hiện đang trong diện ĐẶT TRƯỚC, vui lòng liên hệ CSKH để được hỗ trợ!', 'error');
      return;
    }
    onAddCart(p, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };
  return (
    <div
      style={{ backgroundColor: "#ffffff", borderRadius: 16, border: hovered ? "2px solid #dc2626" : "2px solid #f1f5f9", boxShadow: hovered ? "0 12px 40px rgba(220,38,38,0.18)" : "0 2px 12px rgba(0,0,0,0.06)", transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)", transform: hovered ? "translateY(-6px) scale(1.01)" : "translateY(0) scale(1)", cursor: "pointer", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate("/product/" + p.id)}
    >
      <div style={{ position: "absolute", top: 10, left: 10, display: "flex", flexDirection: "column", gap: 4, zIndex: 2 }}>
        {p.discountPercent > 0 && <span style={{ backgroundColor: "#dc2626", color: "#fff", fontSize: "0.68rem", fontWeight: 900, padding: "3px 8px", borderRadius: 6 }}>-{p.discountPercent}%</span>}
        {isHot && !isSoldOut && <span style={{ backgroundColor: "#f97316", color: "#fff", fontSize: "0.63rem", fontWeight: 800, padding: "2px 7px", borderRadius: 5 }}>🔥 HOT</span>}
        {isSoldOut && <span style={{ backgroundColor: "#64748b", color: "#fff", fontSize: "0.63rem", fontWeight: 800, padding: "2px 7px", borderRadius: 5 }}>HẾT HÀNG</span>}
      </div>
      <div style={{ width: "100%", height: 170, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc", padding: "1rem", position: "relative" }}>
        <img src={p.image || "https://placehold.co/160x140/f8fafc/94a3b8?text=" + p.category} alt={p.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", transition: "transform 0.3s", transform: hovered ? "scale(1.08)" : "scale(1)", filter: isSoldOut ? "grayscale(60%)" : "none" }} onError={(e) => { e.target.src = "https://placehold.co/160x140/f8fafc/94a3b8?text=" + p.category; }} />
        {hovered && !isSoldOut && (
          <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", backgroundColor: "rgba(15,23,42,0.85)", color: "#fff", fontSize: "0.72rem", fontWeight: 600, padding: "4px 12px", borderRadius: 99, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            <Eye size={12} /> Xem nhanh
          </div>
        )}
      </div>
      <div style={{ padding: "0.85rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6366f1", backgroundColor: "#eef2ff", padding: "2px 8px", borderRadius: 99, display: "inline-block", width: "fit-content", textTransform: "uppercase", letterSpacing: "0.5px" }}>{p.category}</span>
        <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.4, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.name}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ display: "flex", gap: 1 }}>
            {[1,2,3,4,5].map(st => <Star key={st} size={10} fill={st <= Math.round(parseFloat(rating)) ? "#f59e0b" : "none"} color={st <= Math.round(parseFloat(rating)) ? "#f59e0b" : "#cbd5e1"} />)}
          </div>
          <span style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 600 }}>{rating} ({reviewCount})</span>
        </div>
        <div style={{ marginTop: "auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "1.15rem", fontWeight: 900, color: "#dc2626", lineHeight: 1 }}>{new Intl.NumberFormat("vi-VN").format(p.price)}đ</span>
            {p.originalPrice > p.price && <span style={{ fontSize: "0.75rem", color: "#94a3b8", textDecoration: "line-through" }}>{new Intl.NumberFormat("vi-VN").format(p.originalPrice)}đ</span>}
          </div>
          {p.originalPrice > p.price && <div style={{ fontSize: "0.7rem", color: "#16a34a", fontWeight: 700, marginTop: 2 }}>Tiết kiệm {new Intl.NumberFormat("vi-VN").format(p.originalPrice - p.price)}đ</div>}
        </div>
        <div>
          <div style={{ height: 16, backgroundColor: "#fee2e2", borderRadius: 99, overflow: "hidden", position: "relative" }}>
            <div style={{ height: "100%", width: soldPercent + "%", background: isSoldOut ? "linear-gradient(90deg,#94a3b8,#64748b)" : soldPercent > 75 ? "linear-gradient(90deg,#ef4444,#dc2626)" : "linear-gradient(90deg,#f97316,#dc2626)", borderRadius: 99 }} />
            <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: "0.6rem", fontWeight: 800, color: soldPercent > 50 ? "#fff" : "#dc2626", whiteSpace: "nowrap" }}>
              {isSoldOut ? "Hết hàng" : soldPercent > 80 ? "Sắp hết" : "Đã bán " + soldPercent + "%"}
            </span>
          </div>
        </div>
        <button onClick={handleAdd} disabled={isSoldOut} style={{ marginTop: "0.4rem", width: "100%", padding: "0.55rem", borderRadius: 10, border: "none", background: isSoldOut ? "#e2e8f0" : added ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg,#dc2626 0%,#ef4444 50%,#f97316 100%)", color: isSoldOut ? "#94a3b8" : "#fff", fontWeight: 800, fontSize: "0.8rem", cursor: isSoldOut ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", transition: "all 0.2s", boxShadow: isSoldOut ? "none" : "0 4px 12px rgba(220,38,38,0.3)" }}>
          {added ? <><CheckCircle size={15} /> Đã thêm!</> : isSoldOut ? "Hết Hàng" : <><ShoppingCart size={15} /> Thêm Vào Giỏ</>}
        </button>
      </div>
    </div>
  );
}

export default function FlashSale() {
  const products = useInventoryStore(state => state.products) || [];
  const { addToCart } = useCart();
  const { h, m, s } = useCountdown(SALE_END);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [sortBy, setSortBy] = useState("discount");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const sortRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setShowSortMenu(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allSaleProducts = (products || []).filter(p => p.available && p.price > 0).map(p => ({
    ...p,
    discountPercent: p.discountPercent || (Math.round((p.id * 7) % 35) + 5),
    originalPrice: p.originalPrice || Math.round(p.price * (1 + ((p.id * 13) % 40 + 15) / 100)),
  }));

  const filtered = allSaleProducts.filter(p => {
    const catMatch = activeCategory === "ALL" || p.category === activeCategory;
    const searchMatch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return catMatch && searchMatch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "discount") return b.discountPercent - a.discountPercent;
    if (sortBy === "price_asc") return a.price - b.price;
    if (sortBy === "price_desc") return b.price - a.price;
    return (b.id % 100) - (a.id % 100);
  });

  const displayed = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;
  const avgDiscount = allSaleProducts.length > 0 ? Math.round(allSaleProducts.reduce((s, p) => s + p.discountPercent, 0) / allSaleProducts.length) : 0;
  const maxSave = allSaleProducts.length > 0 ? Math.max(...allSaleProducts.map(p => p.originalPrice - p.price)) : 0;

  return (
    <div style={{ backgroundColor: "#f1f5f9", minHeight: "100vh" }}>
      <div style={{ background: "linear-gradient(135deg,#7f1d1d 0%,#dc2626 35%,#ef4444 65%,#f97316 100%)", padding: "3rem 0 2.5rem", position: "relative", overflow: "hidden" }}>
        {[{s:320,t:-90,r:-70,o:0.07},{s:180,t:30,r:200,o:0.06},{s:120,b:-30,l:130,o:0.08},{s:240,b:-70,l:-50,o:0.05}].map((c,i) => (
          <div key={i} style={{ position:"absolute", width:c.s, height:c.s, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.25)", top:c.t, bottom:c.b, left:c.l, right:c.r, opacity:c.o, pointerEvents:"none" }} />
        ))}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem", position: "relative", zIndex: 1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.4rem", marginBottom:"1.5rem", fontSize:"0.78rem" }}>
            <Link to="/" style={{ color:"rgba(255,255,255,0.75)", textDecoration:"none", fontWeight:600 }}>Trang chủ</Link>
            <ChevronRight size={13} color="rgba(255,255,255,0.6)" />
            <span style={{ color:"#fff", fontWeight:700 }}>Flash Sale</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"2.5rem" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"0.75rem" }}>
                <div style={{ width:58, height:58, borderRadius:16, background:"rgba(255,255,255,0.2)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", border:"1.5px solid rgba(255,255,255,0.35)", boxShadow:"0 4px 24px rgba(0,0,0,0.15)" }}>
                  <Zap size={30} fill="#fff" color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize:"0.7rem", color:"rgba(255,255,255,0.75)", fontWeight:700, textTransform:"uppercase", letterSpacing:"2px", marginBottom:2 }}>TechZone Store</div>
                  <h1 style={{ fontSize:"2.4rem", fontWeight:900, color:"#ffffff", margin:0, letterSpacing:"-1.5px", textTransform:"uppercase", lineHeight:1 }}>⚡ Flash Sale</h1>
                </div>
              </div>
              <p style={{ color:"rgba(255,255,255,0.88)", fontSize:"0.95rem", fontWeight:500, margin:"0 0 1.1rem" }}>Giảm giá sốc mỗi ngày — Số lượng có hạn, bán hết là dừng ngay!</p>
              <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap" }}>
                {[
                  { icon:<Package size={14}/>, label: allSaleProducts.length + " sản phẩm đang sale" },
                  { icon:<Percent size={14}/>, label: "Giảm trung bình " + avgDiscount + "%" },
                  { icon:<TrendingUp size={14}/>, label: "Tiết kiệm đến " + new Intl.NumberFormat("vi-VN").format(maxSave) + "đ" },
                ].map((st, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:"0.35rem", color:"rgba(255,255,255,0.9)", fontSize:"0.8rem", fontWeight:600, backgroundColor:"rgba(255,255,255,0.12)", padding:"0.3rem 0.7rem", borderRadius:99, backdropFilter:"blur(4px)" }}>
                    {st.icon} {st.label}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:"0.73rem", color:"rgba(255,255,255,0.8)", fontWeight:700, textTransform:"uppercase", letterSpacing:"1.2px", marginBottom:"0.85rem", display:"flex", alignItems:"center", gap:"0.4rem", justifyContent:"center" }}>
                <Timer size={15} /> Kết thúc sau
              </div>
              <div style={{ display:"flex", alignItems:"flex-start", gap:"0.6rem" }}>
                <CountdownBlock value={pad(h)} label="Giờ" />
                <span style={{ color:"#fff", fontWeight:900, fontSize:"2.2rem", lineHeight:"3.2rem", opacity:0.6 }}>:</span>
                <CountdownBlock value={pad(m)} label="Phút" />
                <span style={{ color:"#fff", fontWeight:900, fontSize:"2.2rem", lineHeight:"3.2rem", opacity:0.6 }}>:</span>
                <CountdownBlock value={pad(s)} label="Giây" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"2rem 1.5rem" }}>
        <div style={{ backgroundColor:"#fff", borderRadius:16, padding:"1.25rem", marginBottom:"1.5rem", boxShadow:"0 2px 16px rgba(0,0,0,0.06)", border:"1px solid #e2e8f0", display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ display:"flex", gap:"0.75rem", alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ position:"relative", flex:"1 1 240px" }}>
              <Search size={15} style={{ position:"absolute", left:"0.75rem", top:"50%", transform:"translateY(-50%)", color:"#94a3b8" }} />
              <input type="text" placeholder="Tìm sản phẩm flash sale..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width:"100%", padding:"0.6rem 2.2rem 0.6rem 2.2rem", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:"0.85rem", color:"#0f172a", outline:"none", boxSizing:"border-box" }} onFocus={e=>e.target.style.borderColor="#dc2626"} onBlur={e=>e.target.style.borderColor="#e2e8f0"} />
              {searchQuery && <button onClick={()=>setSearchQuery("")} style={{ position:"absolute", right:"0.6rem", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#94a3b8", padding:2, display:"flex" }}><X size={14}/></button>}
            </div>
            <span style={{ fontSize:"0.8rem", color:"#64748b", fontWeight:600, whiteSpace:"nowrap" }}>{sorted.length} sản phẩm</span>
            <div style={{ position:"relative" }} ref={sortRef}>
              <button onClick={()=>setShowSortMenu(v=>!v)} style={{ display:"flex", alignItems:"center", gap:"0.4rem", padding:"0.6rem 0.85rem", borderRadius:10, border:"1.5px solid #e2e8f0", backgroundColor:"#fff", color:"#0f172a", fontSize:"0.82rem", fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
                <SlidersHorizontal size={14} color="#dc2626" />
                {SORT_OPTIONS.find(o=>o.id===sortBy)?.label}
                <ChevronDown size={13} style={{ transform:showSortMenu?"rotate(180deg)":"none", transition:"0.2s" }} />
              </button>
              {showSortMenu && (
                <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:50, backgroundColor:"#fff", borderRadius:12, border:"1px solid #e2e8f0", boxShadow:"0 8px 32px rgba(0,0,0,0.12)", overflow:"hidden", minWidth:180 }}>
                  {SORT_OPTIONS.map(opt => (
                    <button key={opt.id} onClick={()=>{setSortBy(opt.id);setShowSortMenu(false);}} style={{ display:"block", width:"100%", textAlign:"left", padding:"0.65rem 1rem", background:sortBy===opt.id?"#fef2f2":"#fff", color:sortBy===opt.id?"#dc2626":"#0f172a", fontWeight:sortBy===opt.id?700:500, fontSize:"0.83rem", border:"none", borderBottom:"1px solid #f1f5f9", cursor:"pointer" }}>
                      {sortBy===opt.id?"✓ ":""}{opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
            {CATEGORIES.map(cat => {
              const count = cat.id==="ALL" ? allSaleProducts.length : allSaleProducts.filter(p=>p.category===cat.id).length;
              if (count===0 && cat.id!=="ALL") return null;
              const active = activeCategory===cat.id;
              return (
                <button key={cat.id} onClick={()=>{setActiveCategory(cat.id);setVisibleCount(20);}} style={{ padding:"0.4rem 0.85rem", borderRadius:99, border:active?"2px solid #dc2626":"1.5px solid #e2e8f0", backgroundColor:active?"#fef2f2":"#f8fafc", color:active?"#dc2626":"#475569", fontSize:"0.78rem", fontWeight:active?800:600, cursor:"pointer", transition:"all 0.15s", display:"flex", alignItems:"center", gap:"0.3rem", whiteSpace:"nowrap" }}>
                  {cat.icon} {cat.label} <span style={{ backgroundColor:active?"#dc2626":"#e2e8f0", color:active?"#fff":"#64748b", fontSize:"0.65rem", fontWeight:800, padding:"0px 5px", borderRadius:99 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {displayed.length === 0 ? (
          <div style={{ backgroundColor:"#fff", borderRadius:16, padding:"4rem", textAlign:"center", boxShadow:"0 2px 12px rgba(0,0,0,0.05)" }}>
            <Zap size={48} color="#e2e8f0" />
            <p style={{ color:"#94a3b8", fontSize:"1rem", fontWeight:600, marginTop:"1rem" }}>Không tìm thấy sản phẩm phù hợp</p>
            <button onClick={()=>{setSearchQuery("");setActiveCategory("ALL");}} style={{ marginTop:"1rem", padding:"0.5rem 1.5rem", borderRadius:10, border:"none", background:"#dc2626", color:"#fff", fontWeight:700, cursor:"pointer" }}>Xóa bộ lọc</button>
          </div>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:"1.1rem" }}>
              {displayed.map(p => <FlashProductCard key={p.id} p={p} onAddCart={addToCart} />)}
            </div>
            {hasMore ? (
              <div style={{ textAlign:"center", marginTop:"2rem" }}>
                <button onClick={()=>setVisibleCount(v=>v+20)} style={{ padding:"0.75rem 2.5rem", borderRadius:99, border:"2px solid #dc2626", backgroundColor:"#fff", color:"#dc2626", fontWeight:800, fontSize:"0.9rem", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:"0.5rem", boxShadow:"0 4px 16px rgba(220,38,38,0.12)", transition:"all 0.2s" }} onMouseEnter={e=>{e.currentTarget.style.background="#dc2626";e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="#fff";e.currentTarget.style.color="#dc2626";}}>
                  <ArrowRight size={16} /> Xem thêm ({sorted.length - visibleCount} sản phẩm)
                </button>
              </div>
            ) : (
              <div style={{ textAlign:"center", marginTop:"2rem", color:"#94a3b8", fontSize:"0.82rem", fontWeight:600 }}>Đã hiển thị tất cả {sorted.length} sản phẩm Flash Sale</div>
            )}
          </>
        )}

        <div style={{ marginTop:"3rem", display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:"1rem" }}>
          {[
            { icon:"⚡", title:"Giá Flash Sale", desc:"Chỉ áp dụng trong thời gian đếm ngược, không gộp với khuyến mãi khác" },
            { icon:"📦", title:"Số Lượng Có Hạn", desc:"Mỗi sản phẩm Flash Sale chỉ có một số lượng nhất định, bán hết là dừng" },
            { icon:"🔒", title:"Bảo Hành Đầy Đủ", desc:"Sản phẩm Flash Sale vẫn được bảo hành chính hãng đầy đủ theo quy định" },
            { icon:"🚚", title:"Giao Hàng Nhanh", desc:"Đơn Flash Sale được ưu tiên xử lý và giao hàng trong ngày" },
          ].map((item, i) => (
            <div key={i} style={{ backgroundColor:"#fff", borderRadius:12, padding:"1.1rem", border:"1px solid #f1f5f9", boxShadow:"0 2px 8px rgba(0,0,0,0.04)", display:"flex", gap:"0.75rem", alignItems:"flex-start" }}>
              <span style={{ fontSize:"1.5rem", lineHeight:1 }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight:800, color:"#0f172a", fontSize:"0.85rem", marginBottom:"0.2rem" }}>{item.title}</div>
                <div style={{ fontSize:"0.75rem", color:"#64748b", lineHeight:1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}