// Theme chung cho mọi biểu đồ Chart.js trong hệ thống: cùng font, cỡ chữ, chú thích, tooltip, lưới.
// Từng biểu đồ vẫn có thể ghi đè trong options riêng; ở đây chỉ đặt mặc định cho đồng nhất.
// Dùng Chart.defaults.set() vì file này chạy trước khi các trang đăng ký plugin/element
// (Legend, Tooltip, BarElement...) — truy cập trực tiếp các nhánh đó lúc này sẽ là undefined.
import { Chart } from 'chart.js';

const FONT = "'Be Vietnam Pro', 'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

Chart.defaults.set('font', { family: FONT, size: 12 });
Chart.defaults.set({ color: '#64748b', borderColor: '#eef2f6' });

Chart.defaults.set('plugins.legend.labels', {
  usePointStyle: true,
  pointStyle: 'circle',
  boxWidth: 8,
  boxHeight: 8,
  padding: 14,
  font: { family: FONT, size: 12 },
});

Chart.defaults.set('plugins.tooltip', {
  backgroundColor: '#0f172a',
  titleColor: '#f8fafc',
  bodyColor: '#e2e8f0',
  padding: 10,
  cornerRadius: 8,
  boxPadding: 4,
  titleFont: { family: FONT, size: 12, weight: '600' },
  bodyFont: { family: FONT, size: 12 },
});

Chart.defaults.set('elements.bar', { borderRadius: 4 });
Chart.defaults.set('elements.arc', { borderWidth: 2, borderColor: '#ffffff' });
Chart.defaults.set('elements.line', { borderWidth: 2, tension: 0.35 });
Chart.defaults.set('elements.point', { radius: 3, hoverRadius: 5 });

Chart.defaults.set('scale.grid', { color: '#eef2f6' });
Chart.defaults.set('scale.ticks', { color: '#64748b', font: { family: FONT, size: 11 } });
