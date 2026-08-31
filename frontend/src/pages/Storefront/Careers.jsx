import React, { useState } from 'react';
import { MapPin, Clock, DollarSign, Users, ChevronDown, ChevronUp, Send, CheckCircle, Heart, BookOpen, Gift, Award, Briefcase, Mail, Phone } from 'lucide-react';

const JOBS = [
  {
    id: 1,
    title: 'Chuyên Viên Tư Vấn Kỹ Thuật (Sales)',
    department: 'Bán Hàng',
    type: 'Toàn thời gian',
    location: 'TP. Hồ Chí Minh',
    salary: '12–18 triệu/tháng',
    level: 'Junior / Mid-level',
    description: 'Tư vấn trực tiếp cho khách hàng về linh kiện máy tính, hỗ trợ cấu hình PC phù hợp nhu cầu và ngân sách. Xử lý đơn hàng online và offline.',
    requirements: [
      'Có kiến thức vững về linh kiện máy tính (CPU, GPU, RAM, SSD...)',
      'Kỹ năng giao tiếp tốt, nhiệt tình với khách hàng',
      'Ưu tiên có kinh nghiệm bán hàng linh kiện từ 1 năm trở lên',
      'Có thể làm việc cuối tuần',
    ],
    benefits: ['Lương cứng + hoa hồng', 'Thưởng KPI hàng tháng', 'Bảo hiểm đầy đủ', 'Cơ hội thăng tiến'],
  },
  {
    id: 2,
    title: 'Kỹ Thuật Viên Lắp Ráp & Bảo Trì PC',
    department: 'Kỹ Thuật',
    type: 'Toàn thời gian',
    location: 'TP. Hồ Chí Minh',
    salary: '10–15 triệu/tháng',
    level: 'Junior',
    description: 'Lắp ráp máy tính theo yêu cầu khách hàng, cài đặt hệ điều hành và phần mềm, chẩn đoán và sửa chữa các sự cố phần cứng.',
    requirements: [
      'Thành thạo lắp ráp máy tính, nhận biết linh kiện',
      'Hiểu biết về Windows, Linux cơ bản',
      'Cẩn thận, tỉ mỉ, có tinh thần trách nhiệm',
      'Ưu tiên có bằng kỹ thuật điện tử / CNTT',
    ],
    benefits: ['Môi trường làm việc hiện đại', 'Đào tạo kỹ thuật bài bản', 'Bảo hiểm đầy đủ'],
  },
  {
    id: 3,
    title: 'Nhân Viên Kho & Vận Chuyển',
    department: 'Kho Vận',
    type: 'Toàn thời gian',
    location: 'TP. Hồ Chí Minh',
    salary: '8–12 triệu/tháng',
    level: 'Entry level',
    description: 'Quản lý hàng hóa nhập kho, đóng gói và chuẩn bị đơn hàng giao khách, phối hợp với bộ phận vận chuyển và đảm bảo đúng thời gian.',
    requirements: [
      'Sức khỏe tốt, cẩn thận trong công việc',
      'Có kinh nghiệm kho vận là lợi thế',
      'Biết dùng phần mềm quản lý kho cơ bản',
      'Trung thực, chăm chỉ',
    ],
    benefits: ['Ca làm việc linh hoạt', 'Phụ cấp ăn trưa', 'Bảo hiểm xã hội'],
  },
  {
    id: 4,
    title: 'Marketing & Content Creator',
    department: 'Marketing',
    type: 'Toàn thời gian / Part-time',
    location: 'Remote / TP.HCM',
    salary: '12–20 triệu/tháng',
    level: 'Mid-level',
    description: 'Lên kế hoạch và thực hiện content marketing cho các kênh Facebook, TikTok, YouTube. Viết bài review sản phẩm, hướng dẫn build PC, quản lý cộng đồng online.',
    requirements: [
      'Đam mê công nghệ và gaming, biết về linh kiện PC',
      'Kỹ năng viết nội dung hấp dẫn, SEO cơ bản',
      'Biết dùng Canva, Photoshop hoặc video editing là lợi thế',
      'Có portfolio bài viết kỹ thuật là điểm cộng lớn',
    ],
    benefits: ['Làm việc remote linh hoạt', 'Thưởng dự án', 'MacBook hỗ trợ làm việc'],
  },
];

const PERKS = [
  { icon: DollarSign, title: 'Lương Cạnh Tranh', desc: 'Review lương 2 lần/năm, thưởng KPI rõ ràng và minh bạch.' },
  { icon: BookOpen, title: 'Đào Tạo Bài Bản', desc: 'Chương trình onboarding 2 tuần và training kỹ thuật liên tục.' },
  { icon: Heart, title: 'Bảo Hiểm Toàn Diện', desc: 'BHXH, BHYT, bảo hiểm tai nạn và khám sức khỏe định kỳ.' },
  { icon: Users, title: 'Môi Trường Đam Mê', desc: 'Văn phòng tech-friendly với PC gaming, consoles và không gian sáng tạo.' },
  { icon: Award, title: 'Thăng Tiến Nhanh', desc: 'Lộ trình phát triển rõ ràng, ưu tiên đề bạt nội bộ.' },
  { icon: Gift, title: 'Phúc Lợi Nhân Viên', desc: 'Sinh nhật, lễ tết, teambuilding, ưu đãi mua hàng nội bộ 15%.' },
];

function JobCard({ job }) {
  const [expanded, setExpanded] = useState(false);
  const [applying, setApplying] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', note: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setApplying(false); setForm({ name: '', email: '', phone: '', note: '' }); }, 3000);
  };

  const DEPT_COLORS = {
    'Bán Hàng': { bg: 'rgba(99,102,241,0.12)', color: 'var(--primary)' },
    'Kỹ Thuật': { bg: 'rgba(16,185,129,0.12)', color: 'var(--success)' },
    'Kho Vận': { bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)' },
    'Marketing': { bg: 'rgba(217,70,239,0.12)', color: 'var(--accent)' },
  };
  const deptColor = DEPT_COLORS[job.department] || { bg: 'rgba(99,102,241,0.12)', color: 'var(--primary)' };

  return (
    <div className="job-card" style={{ flexDirection: 'column', gap: '0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
            <span style={{ ...deptColor, fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.625rem', borderRadius: '99px', textTransform: 'uppercase' }}>
              {job.department}
            </span>
            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{job.type}</span>
            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{job.level}</span>
          </div>
          <h3 style={{ fontSize: '1.075rem', fontWeight: 700, marginBottom: '0.5rem' }}>{job.title}</h3>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <MapPin size={12} /> {job.location}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <DollarSign size={12} /> {job.salary}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button onClick={() => setExpanded(!expanded)} className="btn btn-secondary" style={{ padding: '0.5rem', gap: '0.3rem', fontSize: '0.8rem' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Thu Gọn' : 'Xem Chi Tiết'}
          </button>
          <button onClick={() => { setApplying(true); setExpanded(true); }} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
            Ứng Tuyển
          </button>
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem', marginTop: '0.25rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7, marginBottom: '1.25rem' }}>
            {job.description}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                <CheckCircle size={15} style={{ color: 'var(--success)' }} /> Yêu Cầu
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {job.requirements.map((r, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }}>•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                <Gift size={15} style={{ color: 'var(--primary)' }} /> Quyền Lợi
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {job.benefits.map((b, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }}>✦</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Application Form */}
          {applying && (
            <div style={{
              background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginTop: '0.5rem',
            }}>
              {submitted ? (
                <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                  <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto 1rem' }} />
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Đã Gửi Hồ Sơ Thành Công!</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Chúng tôi sẽ liên hệ bạn trong 3–5 ngày làm việc.
                  </p>
                </div>
              ) : (
                <>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                    <Briefcase size={16} /> Form Ứng Tuyển — {job.title}
                  </h4>
                  <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Họ và Tên *</label>
                        <input required className="form-input" placeholder="Nguyễn Văn A" value={form.name}
                          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Email *</label>
                        <input required type="email" className="form-input" placeholder="email@example.com" value={form.email}
                          onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Số Điện Thoại *</label>
                      <input required className="form-input" placeholder="0901 234 567" value={form.phone}
                        onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Giới Thiệu Bản Thân</label>
                      <textarea className="form-textarea" placeholder="Kinh nghiệm, kỹ năng liên quan, lý do muốn ứng tuyển..."
                        value={form.note} onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ gap: '0.4rem' }}>
                        <Send size={14} /> Gửi Hồ Sơ
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setApplying(false)}>
                        Hủy
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Careers() {
  const [filterDept, setFilterDept] = useState('all');
  const departments = ['all', ...new Set(JOBS.map(j => j.department))];
  const filtered = filterDept === 'all' ? JOBS : JOBS.filter(j => j.department === filterDept);

  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* Hero */}
      <div style={{ position: 'relative', height: '440px', overflow: 'hidden', marginBottom: '4rem' }}>
        <img src="/careers_banner.png" alt="Tuyển dụng AetherPC" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(11,15,25,0.92) 0%, rgba(11,15,25,0.45) 100%)',
          display: 'flex', alignItems: 'center',
        }}>
          <div className="container">
            <span className="badge badge-success" style={{ marginBottom: '1.25rem', fontSize: '0.8rem', padding: '0.4rem 1rem' }}>
              👥 Đang Tuyển Dụng
            </span>
            <h1 style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 900,
              lineHeight: 1.2, marginBottom: '1.25rem', maxWidth: '600px',
            }}>
              Xây Dựng Tương Lai Cùng <span className="gradient-text">AetherPC</span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1rem', maxWidth: '500px', lineHeight: 1.7, marginBottom: '2rem' }}>
              Chúng tôi tìm kiếm những tài năng đam mê công nghệ, sẵn sàng cùng nhau tạo ra trải nghiệm mua sắm tuyệt vời nhất cho người dùng Việt Nam.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <a href="#jobs" className="btn btn-primary" style={{ padding: '0.75rem 1.75rem' }}>
                Xem {JOBS.length} Vị Trí Đang Tuyển
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Perks */}
      <section className="container" style={{ marginBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 className="section-title">Tại Sao Chọn <span className="gradient-text">AetherPC?</span></h2>
          <p className="section-subtitle">Môi trường làm việc tốt nhất cho người đam mê công nghệ</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
            {PERKS.map((perk) => {
              const IconComponent = perk.icon;
              return (
                <div key={perk.title} className="card-glass" style={{ padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <IconComponent size={28} style={{ flexShrink: 0, color: 'var(--primary)' }} />
                  <div>
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.375rem' }}>{perk.title}</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{perk.desc}</p>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* Hiring Process */}
      <section style={{
        background: 'linear-gradient(135deg, rgba(21,27,44,0.8), rgba(11,15,25,0.9))',
        borderTop: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)',
        padding: '3.5rem 0', marginBottom: '4rem',
      }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 className="section-title">Quy Trình <span className="gradient-text">Ứng Tuyển</span></h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
            {[
              { step: '01', icon: Briefcase, title: 'Nộp Hồ Sơ', desc: 'Điền form ứng tuyển online ngay tại trang này' },
              { step: '02', icon: Phone, title: 'Sàng Lọc Điện Thoại', desc: 'HR liên hệ trong 3–5 ngày làm việc' },
              { step: '03', icon: Users, title: 'Phỏng Vấn', desc: 'Phỏng vấn kỹ thuật và văn hóa doanh nghiệp' },
              { step: '04', icon: Award, title: 'Offer & Onboarding', desc: 'Nhận offer và bắt đầu hành trình cùng AetherPC' },
            ].map((s) => (
              <div key={s.step} className="card-glass" style={{ textAlign: 'center', padding: '1.75rem 1.25rem' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '0.875rem',
                  color: '#fff', margin: '0 auto 1rem',
                }}>{s.step}</div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.625rem', color: 'var(--secondary)' }}>
                  <s.icon size={24} />
                </div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.375rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Job Listings */}
      <section id="jobs" className="container">
        <div className="section-header">
          <div>
            <h2 className="section-title">Vị Trí <span className="gradient-text">Đang Tuyển</span></h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{JOBS.length} vị trí đang mở tuyển dụng</p>
          </div>
        </div>

        {/* Dept Filter */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
          {departments.map((d) => (
            <button key={d} onClick={() => setFilterDept(d)} style={{
              padding: '0.4rem 1.125rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              border: '1px solid var(--border-glass)', fontWeight: 600, fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              background: filterDept === d ? 'var(--primary)' : 'rgba(255,255,255,0.02)',
              color: filterDept === d ? '#fff' : 'var(--text-secondary)',
              transition: 'all var(--transition-fast)',
              textTransform: d === 'all' ? 'none' : 'none',
            }}>
              {d === 'all' ? 'Tất Cả Phòng Ban' : d}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map((job) => <JobCard key={job.id} job={job} />)}
        </div>

        {/* Contact HR */}
        <div className="card-glass" style={{
          marginTop: '3rem', padding: '2rem', textAlign: 'center',
          background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.2)',
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Không Thấy Vị Trí Phù Hợp?
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Gửi CV của bạn đến HR — chúng tôi luôn tìm kiếm những tài năng xuất sắc.
          </p>
          <a href="mailto:hr@aetherpc.vn" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.625rem 1.5rem' }}>
            <Mail size={14} /> hr@aetherpc.vn
          </a>
        </div>
      </section>
    </div>
  );
}
