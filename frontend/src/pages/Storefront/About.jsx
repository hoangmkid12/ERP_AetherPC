import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, Target, Heart, Zap, User, Compass } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

const TEAM = [
  { name: 'Nguyễn Văn Anh', role: 'CEO & Founder', years: '12 năm kinh nghiệm' },
  { name: 'Trần Thị Bảo', role: 'Giám Đốc Kỹ Thuật', years: '8 năm kinh nghiệm' },
  { name: 'Lê Minh Cường', role: 'Trưởng Phòng Bán Hàng', years: '6 năm kinh nghiệm' },
  { name: 'Phạm Thu Duyên', role: 'Chuyên Viên Kỹ Thuật', years: '5 năm kinh nghiệm' },
  { name: 'Hoàng Quốc Gia', role: 'Kho Vận & Logistics', years: '4 năm kinh nghiệm' },
  { name: 'Ngô Thị Hà', role: 'Kế Toán Trưởng', years: '7 năm kinh nghiệm' },
];

const VALUES = [
  { icon: <Target size={28} />, title: 'Chính Trực', desc: 'Cam kết 100% hàng chính hãng, rõ ràng nguồn gốc xuất xứ, không bán hàng nhái hay hàng cũ.', color: '#6366f1' },
  { icon: <Users size={28} />, title: 'Khách Hàng Là Trên Hết', desc: 'Mỗi quyết định đều lấy trải nghiệm khách hàng làm trung tâm, từ tư vấn đến sau bán hàng.', color: '#10b981' },
  { icon: <Zap size={28} />, title: 'Đổi Mới Liên Tục', desc: 'Luôn cập nhật sản phẩm mới nhất, ứng dụng công nghệ hiện đại vào quy trình vận hành.', color: '#f59e0b' },
  { icon: <Heart size={28} />, title: 'Đam Mê Công Nghệ', desc: 'Đội ngũ là những người thực sự yêu thích và đam mê linh kiện máy tính, gaming và công nghệ.', color: '#ef4444' },
];

const TIMELINE = [
  { year: '2014', title: 'Thành Lập AetherPC', desc: 'Cửa hàng đầu tiên tại Quận 3, TP.HCM với đội ngũ 3 người và kho hàng nhỏ.' },
  { year: '2016', title: 'Mở Rộng Kho Vận', desc: 'Chuyển sang địa điểm mới tại Quận 7, tăng diện tích showroom gấp 5 lần.' },
  { year: '2018', title: 'Ra Mắt Website Bán Hàng Online', desc: 'Bước vào thương mại điện tử, phục vụ khách hàng toàn quốc qua giao hàng nhanh.' },
  { year: '2020', title: 'Đối Tác Chính Hãng Intel & AMD', desc: 'Trở thành đại lý ủy quyền chính thức của Intel và AMD tại Việt Nam.' },
  { year: '2023', title: 'Ra Mắt Hệ Thống ERP Nội Bộ', desc: 'Ứng dụng hệ thống quản lý doanh nghiệp thông minh, tối ưu toàn bộ quy trình.' },
  { year: '2026', title: 'AetherPC 2.0', desc: 'Nâng cấp toàn diện nền tảng TMĐT với AI tư vấn cấu hình thông minh.' },
];

const PARTNERS = ['Intel', 'AMD', 'NVIDIA', 'ASUS', 'MSI', 'Gigabyte', 'Corsair', 'Kingston', 'Samsung', 'Seagate', 'NZXT', 'Deepcool'];

export default function About() {
  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* Hero */}
      <div style={{
        position: 'relative', height: '460px', overflow: 'hidden', marginBottom: '4rem',
      }}>
        <img src="/about_team.png" alt="Đội ngũ AetherPC" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(11,15,25,0.92) 0%, rgba(11,15,25,0.5) 100%)',
          display: 'flex', alignItems: 'center',
        }}>
          <div className="container">
            <span className="badge badge-info" style={{ marginBottom: '1.25rem', fontSize: '0.8rem', padding: '0.4rem 1rem' }}>
              Về Chúng Tôi
            </span>
            <h1 style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900,
              fontFamily: 'var(--font-title)', lineHeight: 1.2,
              marginBottom: '1.25rem', maxWidth: '620px',
            }}>
              Hơn 10 Năm Đồng Hành Cùng <span className="gradient-text">Công Nghệ Việt</span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.05rem', maxWidth: '520px', lineHeight: 1.7, marginBottom: '2rem' }}>
              AetherPC là hệ thống cửa hàng linh kiện máy tính chính hãng, được tin tưởng bởi hơn 50.000 khách hàng trên toàn quốc.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/" className="btn btn-primary" style={{ padding: '0.75rem 1.75rem' }}>
                Xem Sản Phẩm <ArrowRight size={15} />
              </Link>
              <Link to="/careers" className="btn btn-secondary" style={{ padding: '0.75rem 1.75rem' }}>
                Tuyển Dụng
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <section className="container" style={{ marginBottom: '5rem' }}>
        <div className="card-glass" style={{ borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            {[
              { num: '2014', label: 'Năm Thành Lập' },
              { num: '50.000+', label: 'Khách Hàng Tin Dùng' },
              { num: '5.000+', label: 'SKU Sản Phẩm' },
              { num: '10+', label: 'Năm Kinh Nghiệm' },
              { num: '99%', label: 'Tỉ Lệ Hài Lòng' },
            ].map((s, i) => (
              <div key={s.label} style={{
                textAlign: 'center', padding: '2rem 1rem',
                borderRight: i < 4 ? '1px solid var(--border-glass)' : 'none',
              }}>
                <div className="stat-number">{s.num}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="container" style={{ marginBottom: '5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card-glass" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', marginBottom: '1.25rem', color: 'var(--success)' }}>
              <Target size={40} />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '1rem' }}>Sứ Mệnh</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.9375rem' }}>
              Đưa công nghệ máy tính đến gần hơn với mọi người Việt Nam. AetherPC cam kết cung cấp linh kiện chính hãng với giá cạnh tranh, kèm tư vấn chuyên sâu giúp khách hàng đưa ra quyết định mua sắm tốt nhất.
            </p>
          </div>
          <div className="card-glass" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', marginBottom: '1.25rem', color: 'var(--primary)' }}>
              <Compass size={40} />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '1rem' }}>Tầm Nhìn</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.9375rem' }}>
              Trở thành nền tảng TMĐT linh kiện máy tính số một Việt Nam vào năm 2030, với hệ sinh thái hoàn chỉnh từ bán lẻ, tư vấn AI, dịch vụ lắp ráp đến bảo hành sau bán hàng.
            </p>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section style={{
        background: 'linear-gradient(135deg, rgba(21,27,44,0.8), rgba(11,15,25,0.9))',
        borderTop: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)',
        padding: '4rem 0', marginBottom: '5rem',
      }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 className="section-title">Giá Trị <span className="gradient-text">Cốt Lõi</span></h2>
            <p className="section-subtitle">Những nguyên tắc định hướng mọi hoạt động của AetherPC</p>
          </div>
          <div className="usp-grid">
            {VALUES.map((v) => (
              <div key={v.title} className="usp-card">
                <div className="usp-icon" style={{ background: `${v.color}18`, color: v.color }}>
                  {v.icon}
                </div>
                <h3 className="usp-title">{v.title}</h3>
                <p className="usp-desc">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="container" style={{ marginBottom: '5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 className="section-title">Hành Trình <span className="gradient-text">Phát Triển</span></h2>
          <p className="section-subtitle">Từ cửa hàng nhỏ đến hệ thống TMĐT hàng đầu</p>
        </div>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div className="timeline">
            {TIMELINE.map((item) => (
              <div key={item.year} className="timeline-item">
                <div className="timeline-dot" />
                <div style={{
                  background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{
                      background: 'var(--primary)', color: '#fff',
                      padding: '0.2rem 0.625rem', borderRadius: '99px',
                      fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'var(--font-title)',
                    }}>{item.year}</span>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{item.title}</h3>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="container" style={{ marginBottom: '5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 className="section-title">Đội Ngũ <span className="gradient-text">Chuyên Nghiệp</span></h2>
          <p className="section-subtitle">Con người là tài sản quý giá nhất của AetherPC</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
          {TEAM.map((member) => (
            <div key={member.name} className="card-glass" style={{ textAlign: 'center', padding: '2rem 1.25rem' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: 'rgba(37, 99, 235, 0.1)',
                border: '2px solid rgba(37, 99, 235, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem',
                color: 'var(--primary)'
              }}>
                <User size={28} />
              </div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.375rem' }}>{member.name}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '0.375rem' }}>{member.role}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{member.years}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Partners */}
      <section style={{ borderTop: '1px solid var(--border-glass)', padding: '3rem 0', marginBottom: '2rem' }}>
        <div className="container">
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
            Thương Hiệu Phân Phối Chính Hãng
          </p>
          <div className="brand-logo-grid">
            {PARTNERS.map((brand) => (
              <div key={brand} className="brand-logo-item">
                <BrandLogo name={brand} height={20} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container">
        <div className="card-glass" style={{
          padding: '3rem 2rem', textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(14,165,233,0.08) 100%)',
          borderColor: 'rgba(99,102,241,0.2)',
        }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.875rem' }}>
            Bạn Muốn Cùng Phát Triển Với AetherPC?
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: '0.9375rem' }}>
            Chúng tôi luôn tìm kiếm những tài năng đam mê công nghệ để cùng nhau xây dựng tương lai.
          </p>
          <Link to="/careers" className="btn btn-primary" style={{ padding: '0.875rem 2rem', fontSize: '1rem' }}>
            Xem Vị Trí Tuyển Dụng <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
