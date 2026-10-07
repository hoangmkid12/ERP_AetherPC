import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Clock, DollarSign, Users, ChevronDown, ChevronUp, Send, CheckCircle, Heart, BookOpen, Gift, Award,
  Briefcase, Mail, Wrench, Package, Megaphone, ShoppingBag, BarChart3
} from 'lucide-react';

const HR_EMAIL = 'hr@aetherpc.vn';

const JOBS = [
  {
    id: 1, icon: ShoppingBag,
    title: 'Chuyên Viên Tư Vấn Kỹ Thuật (Sales)', department: 'Bán Hàng', type: 'Toàn thời gian',
    location: 'TP. Hồ Chí Minh', salary: '12–18 triệu/tháng', level: 'Junior / Mid-level',
    description: 'Tư vấn trực tiếp cho khách hàng về linh kiện máy tính, hỗ trợ cấu hình PC phù hợp nhu cầu và ngân sách. Xử lý đơn hàng online và offline.',
    requirements: ['Có kiến thức vững về linh kiện máy tính (CPU, GPU, RAM, SSD...)', 'Kỹ năng giao tiếp tốt, nhiệt tình với khách hàng', 'Ưu tiên có kinh nghiệm bán hàng linh kiện từ 1 năm trở lên', 'Có thể làm việc cuối tuần'],
    benefits: ['Lương cứng + hoa hồng', 'Thưởng KPI hàng tháng', 'Bảo hiểm đầy đủ', 'Cơ hội thăng tiến'],
  },
  {
    id: 2, icon: Wrench,
    title: 'Kỹ Thuật Viên Lắp Ráp & Bảo Trì PC', department: 'Kỹ Thuật', type: 'Toàn thời gian',
    location: 'TP. Hồ Chí Minh', salary: '10–15 triệu/tháng', level: 'Junior',
    description: 'Lắp ráp máy tính theo yêu cầu khách hàng, cài đặt hệ điều hành và phần mềm, chẩn đoán và sửa chữa các sự cố phần cứng.',
    requirements: ['Thành thạo lắp ráp máy tính, nhận biết linh kiện', 'Hiểu biết về Windows, Linux cơ bản', 'Cẩn thận, tỉ mỉ, có tinh thần trách nhiệm', 'Ưu tiên có bằng kỹ thuật điện tử / CNTT'],
    benefits: ['Môi trường làm việc hiện đại', 'Đào tạo kỹ thuật bài bản', 'Bảo hiểm đầy đủ'],
  },
  {
    id: 3, icon: Package,
    title: 'Nhân Viên Kho & Vận Chuyển', department: 'Kho Vận', type: 'Toàn thời gian',
    location: 'TP. Hồ Chí Minh', salary: '8–12 triệu/tháng', level: 'Entry level',
    description: 'Quản lý hàng hóa nhập kho, đóng gói và chuẩn bị đơn hàng giao khách, phối hợp với bộ phận vận chuyển và đảm bảo đúng thời gian.',
    requirements: ['Sức khỏe tốt, cẩn thận trong công việc', 'Có kinh nghiệm kho vận là lợi thế', 'Biết dùng phần mềm quản lý kho cơ bản', 'Trung thực, chăm chỉ'],
    benefits: ['Ca làm việc linh hoạt', 'Phụ cấp ăn trưa', 'Bảo hiểm xã hội'],
  },
  {
    id: 4, icon: Megaphone,
    title: 'Marketing & Content Creator', department: 'Marketing', type: 'Toàn thời gian / Part-time',
    location: 'Remote / TP.HCM', salary: '12–20 triệu/tháng', level: 'Mid-level',
    description: 'Lên kế hoạch và thực hiện content marketing cho các kênh Facebook, TikTok, YouTube. Viết bài review sản phẩm, hướng dẫn build PC, quản lý cộng đồng online.',
    requirements: ['Đam mê công nghệ và gaming, biết về linh kiện PC', 'Kỹ năng viết nội dung hấp dẫn, SEO cơ bản', 'Biết dùng Canva, Photoshop hoặc video editing là lợi thế', 'Có portfolio bài viết kỹ thuật là điểm cộng lớn'],
    benefits: ['Làm việc remote linh hoạt', 'Thưởng dự án', 'MacBook hỗ trợ làm việc'],
  },
];

const PERKS = [
  { icon: DollarSign, title: 'Lương cạnh tranh', desc: 'Review lương 2 lần/năm, thưởng KPI rõ ràng và minh bạch.' },
  { icon: BookOpen, title: 'Đào tạo bài bản', desc: 'Chương trình onboarding 2 tuần và training kỹ thuật liên tục.' },
  { icon: Heart, title: 'Bảo hiểm toàn diện', desc: 'BHXH, BHYT, bảo hiểm tai nạn và khám sức khỏe định kỳ.' },
  { icon: Users, title: 'Môi trường đam mê', desc: 'Văn phòng tech-friendly với PC gaming và không gian sáng tạo.' },
  { icon: Award, title: 'Thăng tiến nhanh', desc: 'Lộ trình phát triển rõ ràng, ưu tiên đề bạt nội bộ.' },
  { icon: Gift, title: 'Phúc lợi nhân viên', desc: 'Sinh nhật, lễ tết, teambuilding, ưu đãi mua hàng nội bộ 15%.' },
];

const STEPS = [
  { title: 'Gửi hồ sơ', desc: 'Điền form ứng tuyển, đính kèm CV và gửi email tới phòng Nhân sự' },
  { title: 'Sàng lọc', desc: 'Phòng Nhân sự liên hệ trong 3–5 ngày làm việc' },
  { title: 'Phỏng vấn', desc: 'Phỏng vấn chuyên môn và văn hóa doanh nghiệp' },
  { title: 'Nhận việc', desc: 'Nhận thư mời và bắt đầu onboarding cùng AetherPC' },
];

function JobCard({ job }) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', note: '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Chưa có API tuyển dụng: mở ứng dụng email với nội dung hồ sơ điền sẵn để ứng viên đính kèm CV và gửi.
  const submit = (e) => {
    e.preventDefault();
    const subject = `[Ứng tuyển] ${job.title} - ${form.name}`;
    const body = [
      `Vị trí ứng tuyển: ${job.title} (${job.department})`,
      `Họ và tên: ${form.name}`,
      `Email: ${form.email}`,
      `Số điện thoại: ${form.phone}`,
      '',
      'Giới thiệu bản thân:',
      form.note || '(chưa nhập)',
      '',
      '(Vui lòng đính kèm CV trước khi gửi)',
    ].join('\n');
    window.location.href = `mailto:${HR_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  return (
    <div className={`sf-job${open ? ' is-open' : ''}`}>
      <div className="sf-job-head">
        <span className="sf-job-ic"><job.icon size={22} /></span>
        <div className="sf-job-title">
          <h3>{job.title}</h3>
          <div className="sf-job-meta">
            <span><Briefcase size={13} /> {job.department}</span>
            <span><MapPin size={13} /> {job.location}</span>
            <span><Clock size={13} /> {job.type}</span>
            <span><BarChart3 size={13} /> {job.level}</span>
            <span className="salary"><DollarSign size={13} /> {job.salary}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="sf-btn sf-btn-ghost" onClick={() => setOpen(o => !o)}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {open ? 'Thu gọn' : 'Chi tiết'}
          </button>
          <button type="button" className="sf-btn sf-btn-primary" onClick={() => { setOpen(true); setApplying(true); }}>Ứng tuyển</button>
        </div>
      </div>

      {open && (
        <div className="sf-job-body">
          <p>{job.description}</p>
          <div className="sf-job-lists">
            <div>
              <h4><CheckCircle size={16} color="var(--sf-success)" /> Yêu cầu</h4>
              <ul>{job.requirements.map(r => <li key={r}>{r}</li>)}</ul>
            </div>
            <div>
              <h4><Gift size={16} color="var(--sf-primary)" /> Quyền lợi</h4>
              <ul>{job.benefits.map(b => <li key={b}>{b}</li>)}</ul>
            </div>
          </div>

          {applying && (
            <div className="sf-apply">
              {sent ? (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <Mail size={36} color="var(--sf-primary)" />
                  <h4 style={{ margin: '8px 0 6px' }}>Đã mở ứng dụng email với hồ sơ của bạn</h4>
                  <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--sf-text-2)' }}>
                    Hãy đính kèm CV và bấm gửi. Nếu ứng dụng email không mở, gửi trực tiếp tới <b>{HR_EMAIL}</b>.
                  </p>
                  <button type="button" className="sf-btn sf-btn-ghost" onClick={() => setSent(false)}>Sửa lại thông tin</button>
                </div>
              ) : (
                <form onSubmit={submit}>
                  <h4>Ứng tuyển: {job.title}</h4>
                  <div className="sf-form-grid">
                    <div className="sf-form-field"><label>Họ và tên *</label><input required value={form.name} onChange={set('name')} placeholder="Nguyễn Văn A" /></div>
                    <div className="sf-form-field"><label>Email *</label><input required type="email" value={form.email} onChange={set('email')} placeholder="email@example.com" /></div>
                    <div className="sf-form-field"><label>Số điện thoại *</label><input required type="tel" value={form.phone} onChange={set('phone')} placeholder="09xxxxxxxx" /></div>
                    <div className="sf-form-field" style={{ gridColumn: '1 / -1' }}>
                      <label>Giới thiệu bản thân</label>
                      <textarea rows={3} value={form.note} onChange={set('note')} placeholder="Kinh nghiệm, kỹ năng liên quan, lý do muốn ứng tuyển..." />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="submit" className="sf-btn sf-btn-primary"><Send size={15} /> Tạo email ứng tuyển</button>
                    <button type="button" className="sf-btn sf-btn-ghost" onClick={() => setApplying(false)}>Hủy</button>
                    <span style={{ fontSize: 12.5, color: 'var(--sf-muted)' }}>Hồ sơ được gửi qua email tới {HR_EMAIL}</span>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Careers() {
  const [dept, setDept] = useState('all');
  const departments = ['all', ...new Set(JOBS.map(j => j.department))];
  const list = dept === 'all' ? JOBS : JOBS.filter(j => j.department === dept);

  return (
    <div className="sf-container">
      <nav className="sf-breadcrumb"><Link to="/">Trang chủ</Link><span>/</span><span className="cur">Tuyển dụng</span></nav>

      <section className="sf-intro">
        <div>
          <span className="kicker">Tuyển dụng</span>
          <h1>Cùng AetherPC mang <em>chiếc PC ưng ý</em> đến từng khách hàng</h1>
          <p>Chúng tôi tìm những người đam mê công nghệ cho các vị trí bán hàng, kỹ thuật, kho vận và marketing — làm việc trong một quy trình được số hóa từ kho đến tay khách.</p>
          <div className="sf-intro-actions">
            <a href="#jobs" className="sf-btn sf-btn-primary sf-btn-lg">Xem {JOBS.length} vị trí đang tuyển</a>
            <a href={`mailto:${HR_EMAIL}`} className="sf-btn sf-btn-lg" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}><Mail size={16} /> {HR_EMAIL}</a>
          </div>
        </div>
        <div className="sf-intro-stats">
          <div><b>{JOBS.length}</b><span>Vị trí đang tuyển</span></div>
          <div><b>{departments.length - 1}</b><span>Phòng ban</span></div>
          <div><b>3–5 ngày</b><span>Phản hồi hồ sơ</span></div>
          <div><b>15%</b><span>Ưu đãi mua hàng nội bộ</span></div>
        </div>
      </section>

      <section id="jobs" className="sf-section" style={{ scrollMarginTop: 130 }}>
        <div className="sf-section-head">
          <div>
            <h2 className="sf-section-title">Vị trí <span className="accent">đang tuyển</span></h2>
            <p className="sf-section-sub">{list.length} vị trí{dept !== 'all' ? ` thuộc phòng ${dept}` : ''}</p>
          </div>
          <div className="sf-section-links" style={{ marginLeft: 'auto' }}>
            {departments.map(d => (
              <button key={d} type="button" className={`sf-chip${dept === d ? ' is-active' : ''}`} onClick={() => setDept(d)}>
                {d === 'all' ? 'Tất cả' : d}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map(j => <JobCard key={j.id} job={j} />)}
        </div>
      </section>

      <section className="sf-section sf-section-box">
        <div className="sf-section-head"><h2 className="sf-section-title">Quy trình <span className="accent">ứng tuyển</span></h2></div>
        <div className="sf-steps" style={{ '--n': STEPS.length }}>
          {STEPS.map((s, i) => (
            <div key={s.title} className={`sf-step${i === STEPS.length - 1 ? ' is-last' : ''}`}>
              <div className="dot">{String(i + 1).padStart(2, '0')}</div>
              <b>{s.title}</b>
              <span>{s.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sf-section">
        <div className="sf-section-head"><h2 className="sf-section-title">Vì sao chọn <span className="accent">AetherPC</span></h2></div>
        <div className="sf-cards-3">
          {PERKS.map(p => (
            <div key={p.title} className="sf-info-card">
              <span className="ic"><p.icon size={22} /></span>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sf-section sf-info-card" style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3>Chưa thấy vị trí phù hợp?</h3>
          <p>Gửi CV tới phòng Nhân sự — chúng tôi sẽ liên hệ khi có vị trí phù hợp với bạn.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href={`mailto:${HR_EMAIL}`} className="sf-btn sf-btn-primary"><Mail size={15} /> {HR_EMAIL}</a>
        </div>
      </section>
    </div>
  );
}
