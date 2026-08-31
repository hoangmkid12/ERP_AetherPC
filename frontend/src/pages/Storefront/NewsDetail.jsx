import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, User, Tag, Share2, ShoppingCart, Calendar, BookOpen } from 'lucide-react';

const ARTICLES = {
  1: {
    id: 1, category: 'review', categoryLabel: 'Review',
    title: 'Đánh Giá RTX 4070 Super: Lựa Chọn Hoàn Hảo Tầm Giá 20 Triệu?',
    image: '/news_1.png',
    date: '18/06/2026', readTime: '5 phút', author: 'Tech Team AetherPC',
    content: [
      { type: 'h2', text: 'Tổng Quan' },
      { type: 'p', text: 'NVIDIA GeForce RTX 4070 Super là card đồ họa tầm trung cao cấp, được ra mắt đầu năm 2024 với kiến trúc Ada Lovelace thế hệ mới. Với mức giá khoảng 20 triệu đồng, đây là lựa chọn hấp dẫn cho game thủ muốn trải nghiệm 1440p hoặc thậm chí 4K gaming mượt mà.' },
      { type: 'h2', text: 'Thông Số Kỹ Thuật' },
      { type: 'specs', data: [['GPU', 'NVIDIA AD104'], ['VRAM', '12GB GDDR6X'], ['TDP', '220W'], ['Cổng kết nối', '3x DisplayPort 1.4, 1x HDMI 2.1'], ['Giá bán lẻ', '~21.990.000₫']] },
      { type: 'h2', text: 'Hiệu Năng Gaming' },
      { type: 'p', text: 'Trong các bài test 1440p Ultra, RTX 4070 Super đạt trung bình 95-120 FPS tại Cyberpunk 2077, 130-150 FPS tại Elden Ring, và 165+ FPS tại Counter-Strike 2. Đây là mức hiệu năng xuất sắc cho màn hình 165Hz 1440p.' },
      { type: 'h2', text: 'Nhận Xét Tổng Thể' },
      { type: 'p', text: 'RTX 4070 Super là một trong những card đồ họa có tỷ lệ giá/hiệu năng tốt nhất hiện tại. Với mức tiêu thụ điện 220W và hiệu năng vượt trội, đây là lựa chọn AetherPC strongly recommend cho hệ thống gaming 1440p.' },
    ],
    relatedProduct: { name: 'ASUS ROG Strix RTX 4070 Super 12GB OC', price: 21990000 },
  },
  2: {
    id: 2, category: 'guide', categoryLabel: 'Hướng Dẫn',
    title: 'Hướng Dẫn Tự Lắp PC Gaming Từ A-Z Cho Người Mới Bắt Đầu',
    image: '/news_2.png',
    date: '15/06/2026', readTime: '12 phút', author: 'Build Team',
    content: [
      { type: 'h2', text: 'Bước 1: Chuẩn Bị Linh Kiện & Dụng Cụ' },
      { type: 'p', text: 'Trước khi bắt đầu, hãy đảm bảo bạn đã có đủ tất cả linh kiện và một bộ tua vít từ tính. Chuẩn bị bề mặt làm việc phẳng, tránh tĩnh điện bằng cách chạm vào vỏ kim loại trước khi cầm linh kiện.' },
      { type: 'h2', text: 'Bước 2: Lắp CPU Vào Mainboard' },
      { type: 'p', text: 'Mở khóa socket CPU trên mainboard. Cẩn thận nhấc CPU lên bằng hai ngón tay ở cạnh, không chạm vào chân hoặc bề mặt tiếp xúc. Đặt CPU vào đúng hướng theo chỉ dẫn trên socket rồi đóng khóa lại.' },
      { type: 'h2', text: 'Bước 3: Lắp RAM' },
      { type: 'p', text: 'Xác định các khe RAM ưu tiên theo hướng dẫn mainboard (thường là khe A2 và B2 cho dual-channel). Căn khóa trên thanh RAM với khớp trên khe, ấn thẳng và mạnh xuống cho đến khi nghe tiếng click.' },
      { type: 'h2', text: 'Bước 4: Gắn SSD NVMe' },
      { type: 'p', text: 'Tìm khe M.2 trên mainboard, tháo vít giữ, cắm SSD vào slot theo góc khoảng 30 độ rồi ấn xuống và vặn vít lại. Đây là bước đơn giản nhất trong quá trình lắp PC.' },
      { type: 'h2', text: 'Bước 5: Lắp Mainboard Vào Case' },
      { type: 'p', text: 'Đặt I/O shield vào vị trí phía sau case. Cố định các trụ đồng (standoff) ở đúng vị trí ATX/mATX. Đặt mainboard vào case, vặn đủ 9 vít đồng đều, không siết quá chặt.' },
    ],
    relatedProduct: null,
  },
  3: {
    id: 3, category: 'news', categoryLabel: 'Tin Tức',
    title: 'Intel Core i9-15900K vs AMD Ryzen 9 9900X: Ai Thắng Cuộc Chiến CPU 2026?',
    image: '/news_3.png',
    date: '12/06/2026', readTime: '8 phút', author: 'AetherPC Review',
    content: [
      { type: 'h2', text: 'Đối Thủ Xứng Tầm' },
      { type: 'p', text: 'Intel Core i9-15900K (Panther Lake) và AMD Ryzen 9 9900X (Zen 5) là hai flagship CPU mới nhất năm 2026. Cả hai đều nhắm đến phân khúc cao cấp với giá khoảng 15–18 triệu đồng.' },
      { type: 'h2', text: 'Hiệu Năng Single-Core' },
      { type: 'p', text: 'Intel i9-15900K dẫn đầu về single-core nhờ kiến trúc hybrid với các P-core tốc độ cao lên đến 6.2 GHz boost. AMD Ryzen 9 9900X phản công với IPC cải thiện 15% so với thế hệ trước từ kiến trúc Zen 5.' },
      { type: 'h2', text: 'Multi-Core & Rendering' },
      { type: 'p', text: 'Trong các bài test render Blender, AMD Ryzen 9 9900X chiếm ưu thế nhờ 12 nhân vật lý. Tuy nhiên Intel i9-15900K bù đắp bằng 24 nhân tổng (8P + 16E) giúp đạt điểm Cinebench cao hơn.' },
      { type: 'h2', text: 'Kết Luận' },
      { type: 'p', text: 'Không có người thắng tuyệt đối. Nếu bạn chủ yếu gaming, Intel i9-15900K nhỉnh hơn một chút. Nếu workstation/creative work, AMD Ryzen 9 9900X là lựa chọn tốt hơn với mức giá thấp hơn và nền tảng AM5 có tuổi thọ dài hơn.' },
    ],
    relatedProduct: { name: 'Intel Core i7-14700K', price: 10990000 },
  },
};

// Fill remaining articles
for (let id = 4; id <= 6; id++) {
  ARTICLES[id] = {
    id, category: 'guide', categoryLabel: 'Hướng Dẫn',
    title: `Bài Viết #${id}`,
    image: '/news_2.png',
    date: '01/06/2026', readTime: '5 phút', author: 'AetherPC Team',
    content: [{ type: 'p', text: 'Nội dung bài viết đang được cập nhật...' }],
    relatedProduct: null,
  };
}

function formatPrice(p) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);
}

const CAT_COLORS = {
  review: { bg: 'rgba(99,102,241,0.12)', color: 'var(--primary)' },
  guide: { bg: 'rgba(16,185,129,0.12)', color: 'var(--success)' },
  news: { bg: 'rgba(14,165,233,0.12)', color: 'var(--secondary)' },
};

export default function NewsDetail() {
  const { id } = useParams();
  const article = ARTICLES[parseInt(id)];

  if (!article) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <BookOpen size={60} style={{ color: 'var(--text-muted)' }} />
        </div>
        <h2>Bài viết không tồn tại</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Bài viết bạn tìm không được tìm thấy.</p>
        <Link to="/news" className="btn btn-primary"><ArrowLeft size={14} /> Quay Lại Tin Tức</Link>
      </div>
    );
  }

  const cat = CAT_COLORS[article.category] || CAT_COLORS.news;

  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* Hero Image */}
      <div style={{ position: 'relative', height: '420px', overflow: 'hidden', marginBottom: '0' }}>
        <img src={article.image} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(11,15,25,1) 0%, rgba(11,15,25,0.4) 60%, transparent 100%)',
        }} />
        <div className="container" style={{ position: 'absolute', bottom: '2.5rem', left: '50%', transform: 'translateX(-50%)', width: '100%' }}>
          <span style={{
            ...cat, fontSize: '0.75rem', fontWeight: 700,
            padding: '0.3rem 0.875rem', borderRadius: '99px',
            textTransform: 'uppercase', display: 'inline-block', marginBottom: '1rem',
          }}>{article.categoryLabel}</span>
          <h1 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', fontWeight: 800, lineHeight: 1.25, maxWidth: '780px' }}>
            {article.title}
          </h1>
        </div>
      </div>

      <div className="container">
        {/* Meta */}
        <div style={{
          display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap',
          padding: '1.25rem 0', borderBottom: '1px solid var(--border-glass)',
          marginBottom: '2.5rem', fontSize: '0.875rem', color: 'var(--text-muted)',
        }}>
          <Link to="/news" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
            <ArrowLeft size={14} /> Tin Tức
          </Link>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <User size={13} /> {article.author}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Calendar size={13} /> {article.date}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Clock size={13} /> {article.readTime} đọc
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2.5rem', alignItems: 'start' }}>
          {/* Article Content */}
          <article>
            {article.content.map((block, i) => {
              if (block.type === 'h2') return (
                <h2 key={i} style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.875rem', marginTop: i > 0 ? '2.5rem' : 0, color: 'var(--text-primary)' }}>
                  {block.text}
                </h2>
              );
              if (block.type === 'p') return (
                <p key={i} style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '1rem', fontSize: '0.9375rem' }}>
                  {block.text}
                </p>
              );
              if (block.type === 'specs') return (
                <div key={i} className="card-glass" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {block.data.map(([k, v]) => (
                        <tr key={k} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                          <td style={{ padding: '0.625rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem', width: '40%' }}>{k}</td>
                          <td style={{ padding: '0.625rem 0', fontWeight: 600, fontSize: '0.875rem' }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
              return null;
            })}

            {/* Share */}
            <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Chia sẻ:</span>
              <button className="btn btn-secondary" style={{ gap: '0.375rem', fontSize: '0.8rem' }}>
                <Share2 size={13} /> Facebook
              </button>
              <button className="btn btn-secondary" style={{ gap: '0.375rem', fontSize: '0.8rem' }}>
                <Share2 size={13} /> Twitter
              </button>
            </div>
          </article>

          {/* Sidebar */}
          <aside style={{ position: 'sticky', top: '100px' }}>
            {/* Related Product */}
            {article.relatedProduct && (
              <div className="card-glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
                  <ShoppingCart size={16} /> Sản Phẩm Liên Quan
                </h3>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>{article.relatedProduct.name}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>{formatPrice(article.relatedProduct.price)}</div>
                </div>
                <Link to="/" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', gap: '0.5rem' }}>
                  <ShoppingCart size={14} /> Mua Ngay
                </Link>
              </div>
            )}

            {/* Recent Posts */}
            <div className="card-glass" style={{ padding: '1.5rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
                <Clock size={16} /> Bài Viết Mới Nhất
              </h3>
              {Object.values(ARTICLES).filter(a => a.id !== article.id).slice(0, 3).map((a) => (
                <Link key={a.id} to={`/news/${a.id}`} style={{
                  display: 'flex', gap: '0.75rem', marginBottom: '0.875rem',
                  textDecoration: 'none', alignItems: 'flex-start',
                }}>
                  <img src={a.image} alt={a.title} style={{ width: '64px', height: '48px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '0.25rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {a.title}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.date}</div>
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
