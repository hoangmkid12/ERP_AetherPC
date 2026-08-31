import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Clock, Search, Calendar } from 'lucide-react';

const ARTICLES = [
  {
    id: 1,
    category: 'review',
    categoryLabel: 'Review',
    title: 'Đánh Giá RTX 4070 Super: Lựa Chọn Hoàn Hảo Tầm Giá 20 Triệu?',
    excerpt: 'Card đồ họa RTX 4070 Super mang lại hiệu năng vượt trội so với thế hệ trước. Chúng tôi đã test card này qua hàng loạt bài kiểm tra từ gaming đến workstation để cho bạn cái nhìn toàn diện nhất.',
    image: '/news_1.png',
    date: '18/06/2026',
    readTime: '5 phút',
    author: 'Tech Team AetherPC',
    featured: true,
  },
  {
    id: 2,
    category: 'guide',
    categoryLabel: 'Hướng Dẫn',
    title: 'Hướng Dẫn Tự Lắp PC Gaming Từ A-Z Cho Người Mới Bắt Đầu',
    excerpt: 'Bài viết chi tiết từng bước lắp ráp máy tính gaming: từ cách chọn linh kiện tương thích, cài đặt hệ điều hành cho đến tối ưu hóa hiệu năng.',
    image: '/news_2.png',
    date: '15/06/2026',
    readTime: '12 phút',
    author: 'Build Team',
    featured: false,
  },
  {
    id: 3,
    category: 'news',
    categoryLabel: 'Tin Tức',
    title: 'Intel Core i9-15900K vs AMD Ryzen 9 9900X: Ai Thắng Cuộc Chiến CPU 2026?',
    excerpt: 'Cuộc so sánh nảy lửa giữa hai ông lớn CPU thế hệ mới nhất. Benchmark đầy đủ từ gaming, render video đến compile code cho câu trả lời rõ ràng nhất.',
    image: '/news_3.png',
    date: '12/06/2026',
    readTime: '8 phút',
    author: 'AetherPC Review',
    featured: false,
  },
  {
    id: 4,
    category: 'guide',
    categoryLabel: 'Hướng Dẫn',
    title: 'Cách Chọn PSU Đúng Cho Cấu Hình PC: Tránh Sai Lầm Phổ Biến',
    excerpt: 'Nguồn điện là linh kiện dễ bị bỏ qua nhất khi build PC. Bài viết này giúp bạn tính toán công suất chính xác và chọn PSU phù hợp cho từng cấu hình.',
    image: '/news_2.png',
    date: '10/06/2026',
    readTime: '7 phút',
    author: 'Tech Team AetherPC',
    featured: false,
  },
  {
    id: 5,
    category: 'news',
    categoryLabel: 'Tin Tức',
    title: 'DDR5 vs DDR4: Năm 2026 Có Nên Lên DDR5 Không?',
    excerpt: 'Với giá DDR5 đang giảm mạnh, câu hỏi về việc có nên chuyển sang DDR5 trở nên thiết thực hơn bao giờ hết. Cùng phân tích ưu/nhược điểm.',
    image: '/news_1.png',
    date: '08/06/2026',
    readTime: '6 phút',
    author: 'AetherPC Review',
    featured: false,
  },
  {
    id: 6,
    category: 'review',
    categoryLabel: 'Review',
    title: 'Deepcool AK620 Digital: Tản Nhiệt Khí Tầm Giá 1.5 Triệu Đáng Mua?',
    excerpt: 'Deepcool AK620 Digital với màn hình LCD mini hiển thị nhiệt độ CPU — liệu đây có phải là tản nhiệt khí tốt nhất tầm giá dưới 2 triệu đồng?',
    image: '/news_3.png',
    date: '05/06/2026',
    readTime: '4 phút',
    author: 'Build Team',
    featured: false,
  },
];

const CATEGORY_COLORS = {
  review: { bg: 'rgba(99,102,241,0.12)', color: 'var(--primary)' },
  guide: { bg: 'rgba(16,185,129,0.12)', color: 'var(--success)' },
  news: { bg: 'rgba(14,165,233,0.12)', color: 'var(--secondary)' },
};

export default function News() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const initialCat = searchParams.get('cat') || 'all';
  const [activeCategory, setActiveCategory] = useState(initialCat);

  const filtered = ARTICLES.filter((a) => {
    const matchCat = activeCategory === 'all' || a.category === activeCategory;
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.excerpt.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const featured = ARTICLES.find(a => a.featured);
  const rest = filtered.filter(a => !a.featured);

  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* Page Hero */}
      <div style={{
        padding: '4rem 0 3rem',
        textAlign: 'center',
        borderBottom: '1px solid var(--border-glass)',
        marginBottom: '3rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-40%', left: '50%', transform: 'translateX(-50%)',
          width: '700px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(14,165,233,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <span className="badge badge-info" style={{ marginBottom: '1.25rem', padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
            Blog & Tin Tức Công Nghệ
          </span>
          <h1 className="section-title" style={{ fontSize: '2.75rem', marginBottom: '1rem' }}>
            Tin Tức <span className="gradient-text">AetherPC</span>
          </h1>
          <p className="section-subtitle" style={{ maxWidth: '560px', margin: '0 auto 2rem' }}>
            Review sản phẩm chuyên sâu, hướng dẫn build PC, và tin tức công nghệ mới nhất từ đội ngũ kỹ thuật AetherPC.
          </p>

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: '480px', margin: '0 auto' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Tìm kiếm bài viết..."
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>
      </div>

      <div className="container">
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'Tất Cả' },
            { key: 'review', label: 'Review' },
            { key: 'guide', label: 'Hướng Dẫn' },
            { key: 'news', label: 'Tin Tức' },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveCategory(tab.key)} style={{
              padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              border: '1px solid var(--border-glass)', fontWeight: 600, fontSize: '0.875rem',
              fontFamily: 'var(--font-sans)',
              background: activeCategory === tab.key ? 'var(--primary)' : 'rgba(255,255,255,0.02)',
              color: activeCategory === tab.key ? '#fff' : 'var(--text-secondary)',
              transition: 'all var(--transition-fast)',
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Featured Article */}
        {featured && (activeCategory === 'all' || activeCategory === featured.category) && !search && (
          <Link to={`/news/${featured.id}`} style={{ display: 'block', textDecoration: 'none', marginBottom: '2.5rem' }}>
            <div style={{
              borderRadius: 'var(--radius-2xl)', overflow: 'hidden',
              border: '1px solid var(--border-glass)',
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              background: 'var(--bg-glass)',
              transition: 'all var(--transition-normal)',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.boxShadow = '0 16px 32px -8px rgba(99,102,241,0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <img src={featured.image} alt={featured.title} style={{ width: '100%', height: '320px', objectFit: 'cover' }} />
              <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{
                    ...CATEGORY_COLORS[featured.category],
                    fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.75rem',
                    borderRadius: '99px', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{featured.categoryLabel}</span>
                  <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Nổi Bật</span>
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.35, marginBottom: '1rem' }}>
                  {featured.title}
                </h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  {featured.excerpt}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={13} /> {featured.date}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={13} /> {featured.readTime}</span>
                  </div>
                  <span className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}>
                    Đọc Ngay <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Article Grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)', border: '1px dashed var(--border-glass)', borderRadius: 'var(--radius-lg)' }}>
            Không tìm thấy bài viết nào phù hợp.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {(activeCategory === 'all' && !search ? rest : filtered).map((article) => (
              <Link to={`/news/${article.id}`} key={article.id} className="news-card" style={{ textDecoration: 'none' }}>
                <img src={article.image} alt={article.title} className="news-card-img" />
                <div className="news-card-body">
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <span style={{
                      ...CATEGORY_COLORS[article.category],
                      fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem',
                      borderRadius: '99px', textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{article.categoryLabel}</span>
                  </div>
                  <h3 className="news-card-title">{article.title}</h3>
                  <p className="news-card-excerpt">{article.excerpt}</p>
                  <div className="news-card-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={12} /> {article.date}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={12} /> {article.readTime} đọc</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
