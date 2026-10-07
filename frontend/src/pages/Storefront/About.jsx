import React, { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight, Users, Target, Heart, Zap, Compass, ShieldCheck, RotateCcw, Truck, CreditCard,
  ChevronRight, Wrench, PackageCheck, Headphones, MapPin, Phone, Mail
} from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import useCatalog from '../../components/Storefront/useCatalog';
import { SF_CATEGORIES, SHOP } from '../../components/Storefront/catalog';

const TEAM = [
  { name: 'Nguyễn Văn Anh', role: 'CEO & Founder', years: '12 năm kinh nghiệm' },
  { name: 'Trần Thị Bảo', role: 'Giám Đốc Kỹ Thuật', years: '8 năm kinh nghiệm' },
  { name: 'Lê Minh Cường', role: 'Trưởng Phòng Bán Hàng', years: '6 năm kinh nghiệm' },
  { name: 'Phạm Thu Duyên', role: 'Chuyên Viên Kỹ Thuật', years: '5 năm kinh nghiệm' },
  { name: 'Hoàng Quốc Gia', role: 'Kho Vận & Logistics', years: '4 năm kinh nghiệm' },
  { name: 'Ngô Thị Hà', role: 'Kế Toán Trưởng', years: '7 năm kinh nghiệm' },
];

const VALUES = [
  { icon: Target, title: 'Chính trực', desc: 'Cam kết 100% hàng chính hãng, rõ ràng nguồn gốc xuất xứ, không bán hàng nhái hay hàng cũ.' },
  { icon: Users, title: 'Khách hàng là trên hết', desc: 'Mỗi quyết định đều lấy trải nghiệm khách hàng làm trung tâm, từ tư vấn đến sau bán hàng.' },
  { icon: Zap, title: 'Đổi mới liên tục', desc: 'Luôn cập nhật sản phẩm mới, ứng dụng công nghệ hiện đại vào quy trình vận hành.' },
  { icon: Heart, title: 'Đam mê công nghệ', desc: 'Đội ngũ thực sự yêu thích linh kiện máy tính, gaming và công nghệ.' },
];

const SERVICES = [
  { icon: PackageCheck, title: 'Linh kiện & gaming gear', desc: 'CPU, VGA, mainboard, RAM, SSD, nguồn, tản nhiệt, màn hình và chuột gaming chính hãng.' },
  { icon: Wrench, title: 'Lắp ráp PC theo cấu hình', desc: 'Chọn linh kiện với công cụ Build PC, kỹ thuật viên lắp ráp, kiểm tra và niêm phong trước khi giao.' },
  { icon: Headphones, title: 'Tư vấn & hậu mãi', desc: 'Chat trực tuyến với CSKH, tiếp nhận đổi trả và bảo hành theo số Serial của từng linh kiện.' },
];

const TIMELINE = [
  { year: '2014', title: 'Thành lập AetherPC', desc: 'Cửa hàng đầu tiên tại Quận 3, TP.HCM với đội ngũ 3 người.' },
  { year: '2016', title: 'Mở rộng kho vận', desc: 'Chuyển về Quận 7, tăng diện tích showroom gấp 5 lần.' },
  { year: '2018', title: 'Bán hàng trực tuyến', desc: 'Ra mắt website, phục vụ khách hàng toàn quốc.' },
  { year: '2020', title: 'Đối tác Intel & AMD', desc: 'Trở thành đại lý ủy quyền chính thức tại Việt Nam.' },
  { year: '2023', title: 'Hệ thống ERP nội bộ', desc: 'Số hóa toàn bộ mua hàng, kho, bán hàng, nhân sự.' },
  { year: '2026', title: 'AetherPC 2.0', desc: 'Nâng cấp nền tảng TMĐT với trợ lý tư vấn cấu hình.' },
];

const PARTNERS = ['Intel', 'AMD', 'ASUS', 'MSI', 'Gigabyte', 'Corsair', 'Kingston', 'Samsung', 'NZXT', 'Deepcool'];

// Chính sách mô tả đúng cách hệ thống đang vận hành (giỏ hàng, đổi trả, giao hàng)
const POLICIES = [
  { id: 'bao-hanh', icon: ShieldCheck, title: 'Chính sách bảo hành', items: [
    'Sản phẩm được bảo hành chính hãng theo thời hạn ghi trên trang chi tiết (phổ biến 24–36 tháng).',
    'Mỗi linh kiện được ghi nhận số Serial khi xuất kho, dùng để tra cứu và tiếp nhận bảo hành.',
    'Máy lắp ráp tại AetherPC được kiểm tra BIOS/POST, cài hệ điều hành, chạy kiểm tra tải nặng và niêm phong trước khi giao.',
  ] },
  { id: 'doi-tra', icon: RotateCcw, title: 'Chính sách đổi trả', items: [
    'Gửi yêu cầu đổi trả cho đơn hàng đã giao ngay trong mục "Đơn hàng của tôi", kèm lý do và hình ảnh.',
    'Bộ phận chăm sóc khách hàng xem xét yêu cầu, sau đó bộ phận kiểm định thẩm định sản phẩm hoàn trả.',
    'Sản phẩm đạt điều kiện được đổi mới hoặc hoàn tiền theo hình thức khách hàng đã chọn.',
  ] },
  { id: 'giao-hang', icon: Truck, title: 'Chính sách giao hàng', items: [
    'Miễn phí giao hàng toàn quốc cho mọi đơn hàng.',
    'Đơn hàng được đội giao hàng của AetherPC phân công và giao tận nơi; ảnh xác nhận được lưu khi giao thành công.',
    'Theo dõi trạng thái đơn và vị trí người giao hàng trực tuyến trong mục "Đơn hàng của tôi".',
  ] },
  { id: 'thanh-toan', icon: CreditCard, title: 'Hướng dẫn thanh toán', items: [
    'Tiền mặt khi nhận hàng (COD).',
    'Chuyển khoản qua mã VietQR hiển thị ở bước thanh toán; đơn được xác nhận sau khi nhận được tiền.',
    'Nhập mã giảm giá ở bước thanh toán; giảm giá theo hạng thành viên được áp dụng tự động.',
  ] },
];

function Head({ title, accent, sub }) {
  return (
    <div className="sf-section-head">
      <div>
        <h2 className="sf-section-title">{title} {accent && <span className="accent">{accent}</span>}</h2>
        {sub && <p className="sf-section-sub">{sub}</p>}
      </div>
    </div>
  );
}

export default function About() {
  const { hash } = useLocation();
  const { products } = useCatalog();
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }, [hash]);

  const brandCount = useMemo(() => new Set(products.map(p => p.brand).filter(b => b && b !== 'Khác')).size, [products]);
  const firstOf = (cat) => products.find(p => p.category === cat && p.image);

  return (
    <div className="sf-container">
      <nav className="sf-breadcrumb"><Link to="/">Trang chủ</Link><span>/</span><span className="cur">Giới thiệu</span></nav>

      <section className="sf-intro">
        <div>
          <span className="kicker">Về AetherPC</span>
          <h1>Hơn 10 năm đồng hành cùng <em>người dùng PC Việt</em></h1>
          <p>AetherPC là cửa hàng linh kiện máy tính và gaming gear chính hãng, kèm dịch vụ lắp ráp PC theo cấu hình riêng. Mọi khâu từ nhập hàng, kiểm định, lắp ráp đến giao hàng đều được quản lý trên một hệ thống thống nhất.</p>
          <div className="sf-intro-actions">
            <Link to="/products" className="sf-btn sf-btn-primary sf-btn-lg">Xem sản phẩm <ArrowRight size={16} /></Link>
            <a href="#chinh-sach" className="sf-btn sf-btn-lg" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>Chính sách mua hàng</a>
          </div>
        </div>
        <div className="sf-intro-stats">
          <div><b>2014</b><span>Năm thành lập</span></div>
          <div><b>50.000+</b><span>Khách hàng đã phục vụ</span></div>
          <div><b>{products.length ? products.length.toLocaleString('vi-VN') : '—'}</b><span>Sản phẩm đang kinh doanh</span></div>
          <div><b>{brandCount || '—'}</b><span>Thương hiệu phân phối</span></div>
        </div>
      </section>

      <section className="sf-section sf-cards-2">
        <div className="sf-info-card">
          <span className="ic"><Target size={22} /></span>
          <h3>Sứ mệnh</h3>
          <p>Đưa công nghệ máy tính đến gần hơn với mọi người Việt Nam. AetherPC cam kết cung cấp linh kiện chính hãng với giá cạnh tranh, kèm tư vấn chuyên sâu giúp khách hàng đưa ra quyết định mua sắm tốt nhất.</p>
        </div>
        <div className="sf-info-card">
          <span className="ic"><Compass size={22} /></span>
          <h3>Tầm nhìn</h3>
          <p>Trở thành nền tảng TMĐT linh kiện máy tính hàng đầu Việt Nam vào năm 2030, với hệ sinh thái hoàn chỉnh từ bán lẻ, tư vấn cấu hình, dịch vụ lắp ráp đến bảo hành sau bán hàng.</p>
        </div>
      </section>

      <section className="sf-section sf-section-box">
        <Head title="Chúng tôi" accent="làm gì" sub="Ba mảng dịch vụ chính của AetherPC" />
        <div className="sf-cards-3">
          {SERVICES.map(s => (
            <div key={s.title} className="sf-info-card" style={{ boxShadow: 'none', border: '1px solid var(--sf-border)' }}>
              <span className="ic"><s.icon size={22} /></span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="sf-catgrid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', marginTop: 16 }}>
          {SF_CATEGORIES.map(c => {
            const p = firstOf(c.key);
            return (
              <Link key={c.key} to={`/products?category=${c.key}`}>
                {p ? <img src={p.image} alt="" /> : <span className="ic" style={{ background: c.tint, color: c.color }}><c.icon size={24} /></span>}
                <span>{c.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="sf-section">
        <Head title="Giá trị" accent="cốt lõi" sub="Những nguyên tắc định hướng mọi hoạt động của AetherPC" />
        <div className="sf-cards-4">
          {VALUES.map(v => (
            <div key={v.title} className="sf-info-card">
              <span className="ic"><v.icon size={22} /></span>
              <h3>{v.title}</h3>
              <p>{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sf-section sf-section-box">
        <Head title="Hành trình" accent="phát triển" />
        <div className="sf-steps" style={{ '--n': TIMELINE.length }}>
          {TIMELINE.map((t, i) => (
            <div key={t.year} className={`sf-step${i === TIMELINE.length - 1 ? ' is-last' : ''}`}>
              <div className="dot">{t.year.slice(2)}</div>
              <b>{t.year} · {t.title}</b>
              <span>{t.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sf-section">
        <Head title="Đội ngũ" accent="AetherPC" sub="Những người phụ trách từng mảng vận hành" />
        <div className="sf-team">
          {TEAM.map(m => {
            const parts = m.name.split(' ');
            const initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            return (
              <div key={m.name} className="sf-member">
                <div className="sf-avatar">{initials}</div>
                <b>{m.name}</b>
                <span className="role">{m.role}</span>
                <span className="exp">{m.years}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section id="chinh-sach" className="sf-section" style={{ scrollMarginTop: 130 }}>
        <Head title="Chính sách" accent="mua hàng" sub="Áp dụng cho mọi đơn hàng đặt trên website và tại cửa hàng" />
        <div className="sf-cards-2">
          {POLICIES.map(p => (
            <div key={p.id} id={p.id} className="sf-info-card" style={{ scrollMarginTop: 130 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="ic" style={{ margin: 0, width: 36, height: 36 }}><p.icon size={18} /></span>{p.title}</h3>
              <ul style={{ marginTop: 10 }}>{p.items.map(t => <li key={t}>{t}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      <section className="sf-section sf-section-box">
        <Head title="Thương hiệu" accent="phân phối chính hãng" />
        <div className="sf-brands">
          {PARTNERS.slice(0, 8).map(b => (
            <Link key={b} to={`/products?brand=${encodeURIComponent(b)}`} title={`Sản phẩm ${b}`} style={{ color: '#374151' }}>
              <BrandLogo name={b} height={22} />
            </Link>
          ))}
        </div>
      </section>

      <section className="sf-section sf-cards-2">
        <div className="sf-info-card">
          <h3>Liên hệ</h3>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 10, gap: 10 }}>
            <li style={{ display: 'flex', gap: 8 }}><MapPin size={16} color="var(--sf-primary)" /> {SHOP.address}</li>
            <li style={{ display: 'flex', gap: 8 }}><Phone size={16} color="var(--sf-primary)" /> Mua hàng: {SHOP.hotlineSales} · Bảo hành: {SHOP.hotline}</li>
            <li style={{ display: 'flex', gap: 8 }}><Mail size={16} color="var(--sf-primary)" /> {SHOP.email}</li>
          </ul>
        </div>
        <div className="sf-info-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3>Cùng phát triển với AetherPC</h3>
          <p>Chúng tôi đang tìm những người đam mê công nghệ cho các vị trí bán hàng, kỹ thuật, kho vận và marketing.</p>
          <div style={{ marginTop: 14 }}>
            <Link to="/careers" className="sf-btn sf-btn-primary">Xem vị trí tuyển dụng <ChevronRight size={16} /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
