import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Phone, Mail, MapPin, ShieldCheck, Truck, RotateCcw, Headphones } from 'lucide-react';
import { SF_CATEGORIES, SHOP } from '../Storefront/catalog';

const USPS = [
  { icon: ShieldCheck, title: 'Hàng chính hãng 100%', sub: 'Bảo hành 24–36 tháng' },
  { icon: Truck, title: 'Giao hàng toàn quốc', sub: 'Miễn phí mọi đơn hàng' },
  { icon: RotateCcw, title: 'Đổi trả dễ dàng', sub: 'Lỗi do nhà sản xuất' },
  { icon: Headphones, title: 'Hỗ trợ tận tâm', sub: 'Tư vấn cấu hình miễn phí' },
];

const COLS = [
  {
    title: 'Chính sách',
    links: [
      { label: 'Chính sách bảo hành', to: '/about#bao-hanh' },
      { label: 'Chính sách đổi trả', to: '/about#doi-tra' },
      { label: 'Chính sách giao hàng', to: '/about#giao-hang' },
      { label: 'Hướng dẫn thanh toán', to: '/about#thanh-toan' },
      { label: 'Ưu đãi hạng thành viên', to: '/member-tier' },
    ],
  },
  {
    title: 'Thông tin',
    links: [
      { label: 'Giới thiệu AetherPC', to: '/about' },
      { label: 'Tin công nghệ', to: '/news' },
      { label: 'Khuyến mãi', to: '/promotions' },
      { label: 'Tra cứu đơn hàng', to: '/my-orders' },
      { label: 'Tuyển dụng', to: '/careers' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="sf-footer">
      <div className="sf-container" style={{ paddingTop: 20 }}>
        <div className="sf-usp">
          {USPS.map(u => (
            <div key={u.title} className="sf-usp-item">
              <span className="sf-usp-ic"><u.icon size={20} /></span>
              <div><b>{u.title}</b><span>{u.sub}</span></div>
            </div>
          ))}
        </div>

        <div className="sf-footer-main">
          <div className="sf-footer-about">
            <Link to="/" className="sf-logo" style={{ color: 'var(--sf-text)' }}>
              <span className="sf-logo-mark" style={{ background: 'var(--sf-primary)', color: '#fff' }}><Cpu size={22} /></span>
              <span style={{ color: 'var(--sf-text)' }}>AetherPC</span>
            </Link>
            <p>Chuyên linh kiện máy tính, màn hình, gaming gear chính hãng và dịch vụ lắp ráp PC theo cấu hình riêng.</p>
            <div className="sf-footer-contact">
              <div><MapPin size={15} /><span>{SHOP.address}</span></div>
              <div><Mail size={15} /><span>{SHOP.email}</span></div>
              <div><Phone size={15} /><span>{SHOP.hotline} (miễn phí)</span></div>
            </div>
          </div>

          {COLS.map(c => (
            <div key={c.title} className="sf-footer-links">
              <h4>{c.title}</h4>
              {c.links.map(l => <Link key={l.label} to={l.to}>{l.label}</Link>)}
            </div>
          ))}

          <div className="sf-footer-links">
            <h4>Danh mục</h4>
            {SF_CATEGORIES.slice(0, 6).map(c => (
              <Link key={c.key} to={`/products?category=${c.key}`}>{c.label}</Link>
            ))}
          </div>

          <div>
            <h4>Tổng đài hỗ trợ</h4>
            <div className="sf-hotline">
              <span>Mua hàng: <b>{SHOP.hotlineSales}</b> (8:00 – 21:00)</span>
              <span>Bảo hành, khiếu nại: <b>{SHOP.hotline}</b></span>
              <span>Hoặc chat trực tuyến với CSKH ở góc màn hình</span>
            </div>
            <h4 style={{ marginTop: 18 }}>Thanh toán</h4>
            <div className="sf-paybadges">
              <span>Tiền mặt khi nhận hàng</span>
              <span>Chuyển khoản VietQR</span>
            </div>
            <h4 style={{ marginTop: 18 }}>Vận chuyển</h4>
            <div className="sf-paybadges">
              <span>Đội giao hàng AetherPC</span>
              <span>Theo dõi đơn trực tuyến</span>
            </div>
          </div>
        </div>

        <div className="sf-footer-bottom">
          <span>© {new Date().getFullYear()} AetherPC. Đề tài KLTN — SV: Nguyễn Hoàng Mỹ (22633181) — GVHD: ThS. Trần Thị Kim Chi</span>
          <span>Chính sách bảo mật · Điều khoản sử dụng</span>
        </div>
      </div>
    </footer>
  );
}
