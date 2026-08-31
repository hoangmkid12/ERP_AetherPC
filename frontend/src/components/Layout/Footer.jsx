import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Phone, Mail, MapPin, Facebook, Youtube, MessageCircle, Shield, Truck, CreditCard, RotateCcw } from 'lucide-react';

const FOOTER_LINKS = {
  'Sản Phẩm': [
    { label: 'CPU (Bộ vi xử lý)', path: '/?cat=CPU' },
    { label: 'Card đồ họa (VGA)', path: '/?cat=VGA' },
    { label: 'RAM & Bộ nhớ', path: '/?cat=RAM' },
    { label: 'Bo mạch chủ', path: '/?cat=MAINBOARD' },
    { label: 'Ổ cứng & SSD', path: '/?cat=STORAGE' },
    { label: 'Nguồn máy tính (PSU)', path: '/?cat=PSU' },
    { label: 'Tản nhiệt (Cooler)', path: '/?cat=COOLER' },
    { label: 'Thùng máy (Case)', path: '/?cat=CASE' },
    { label: 'Màn hình máy tính', path: '/?cat=MONITOR' },
    { label: 'Bàn phím cơ', path: '/?cat=KEYBOARD' },
    { label: 'Chuột máy tính', path: '/?cat=MOUSE' },
  ],
  'Dịch Vụ': [
    { label: 'Tự Build PC', path: '/pc-builder' },
    { label: 'Tư vấn cấu hình', path: '/pc-builder' },
    { label: 'Bảo hành & Sửa chữa', path: '/about' },
    { label: 'Giao hàng toàn quốc', path: '/about' },
  ],
  'Công Ty': [
    { label: 'Giới thiệu AetherPC', path: '/about' },
    { label: 'Tin tức & Blog', path: '/news' },
    { label: 'Khuyến mãi', path: '/promotions' },
    { label: 'Tuyển dụng', path: '/careers' },
    { label: 'Liên hệ', path: '/about' },
  ],
  'Hỗ Trợ': [
    { label: 'Đơn hàng của tôi', path: '/my-orders' },
    { label: 'Chính sách đổi trả', path: '/about' },
    { label: 'Hướng dẫn thanh toán', path: '/about' },
    { label: 'Câu hỏi thường gặp', path: '/about' },
  ],
};

const TRUST_BADGES = [
  { icon: <Shield size={20} />, label: 'Bảo Hành Chính Hãng', sub: '24–36 tháng', color: '#10b981' },
  { icon: <Truck size={20} />, label: 'Giao Hàng Nhanh', sub: 'Toàn quốc 24h', color: '#0ea5e9' },
  { icon: <CreditCard size={20} />, label: 'Thanh Toán An Toàn', sub: 'Mọi phương thức', color: '#6366f1' },
  { icon: <RotateCcw size={20} />, label: 'Đổi Trả Dễ Dàng', sub: '7 ngày miễn phí', color: '#f59e0b' },
];

export default function Footer() {
  return (
    <footer style={{
      marginTop: 'auto',
      backgroundColor: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-glass)',
      color: 'var(--text-secondary)',
    }}>
      {/* Trust Badges Row */}
      <div style={{
        borderBottom: '1px solid var(--border-glass)',
        padding: '1.75rem 0',
      }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.25rem',
          }}>
            {TRUST_BADGES.map((badge) => (
              <div key={badge.label} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-glass)',
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: `rgba(${badge.color === '#10b981' ? '16,185,129' : badge.color === '#0ea5e9' ? '14,165,233' : badge.color === '#6366f1' ? '99,102,241' : '245,158,11'}, 0.15)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: badge.color,
                  flexShrink: 0,
                }}>
                  {badge.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{badge.label}</div>
                  <div style={{ fontSize: '0.75rem' }}>{badge.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Footer Grid */}
      <div className="container" style={{ padding: '3rem 1.5rem 2rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr repeat(4, 1fr)',
          gap: '2.5rem',
          marginBottom: '2.5rem',
        }}>
          {/* Brand Column */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontFamily: 'var(--font-title)',
              fontSize: '1.25rem',
              color: 'var(--text-primary)',
              fontWeight: 800,
              marginBottom: '1rem',
            }}>
              <Cpu size={24} style={{ stroke: 'var(--secondary)' }} />
              <span style={{
                background: 'linear-gradient(135deg, var(--secondary), var(--primary))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>AetherPC</span>
            </div>

            <p style={{ fontSize: '0.8125rem', lineHeight: '1.7', marginBottom: '1.25rem' }}>
              Hệ thống bán lẻ linh kiện máy tính chính hãng hàng đầu. Tư vấn tận tâm, sản phẩm chất lượng cao, giá cả cạnh tranh.
            </p>

            {/* Contact */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Phone size={13} style={{ color: 'var(--secondary)', flexShrink: 0 }} />
                <span>1800 9999 (Miễn phí)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={13} style={{ color: 'var(--secondary)', flexShrink: 0 }} />
                <span>support@aetherpc.vn</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <MapPin size={13} style={{ color: 'var(--secondary)', flexShrink: 0, marginTop: '2px' }} />
                <span>123 Nguyễn Văn Linh, Q.7, TP.HCM</span>
              </div>
            </div>

            {/* Social */}
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              {[
                { icon: <Facebook size={16} />, label: 'Facebook', color: '#1877f2' },
                { icon: <Youtube size={16} />, label: 'YouTube', color: '#ff0000' },
                { icon: <MessageCircle size={16} />, label: 'Zalo', color: '#0068ff' },
              ].map((s) => (
                <a key={s.label} href="#" title={s.label} style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-glass)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  transition: 'all var(--transition-fast)',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.color = s.color; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 700 }}>
                {title}
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.path} className="hover-link" style={{ fontSize: '0.8125rem' }}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div style={{
          borderTop: '1px solid var(--border-glass)',
          borderBottom: '1px solid var(--border-glass)',
          padding: '1.5rem 0',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
              📧 Nhận thông báo khuyến mãi
            </div>
            <div style={{ fontSize: '0.8rem' }}>Đăng ký để nhận ưu đãi độc quyền mỗi tuần</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flex: '1', maxWidth: '420px' }}>
            <input
              type="email"
              placeholder="Email của bạn..."
              className="form-input"
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" style={{ flexShrink: 0 }}>
              Đăng Ký
            </button>
          </div>
        </div>

        {/* Academic Info + Copyright */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}>
          <p>© {new Date().getFullYear()} AetherPC. Đề tài KLTN — SV: Nguyễn Hoàng Mỹ (22633181) — GVHD: ThS. Trần Thị Kim Chi</p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span>Chính sách bảo mật</span>
            <span>•</span>
            <span>Điều khoản sử dụng</span>
            <span>•</span>
            <span>Sitemap</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
