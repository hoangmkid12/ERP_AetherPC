import React from 'react';
import { Package, Truck, Clock, CheckCircle, AlertTriangle, Award } from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function OverviewTab({
  fmt, orders, pendingReturns,
  readyCount, activeCount, doneCount, failedCount, countAwaiting, totalCodCollected,
  onClaim, onGoToReturns
}) {
  const stats = [
    { label: 'Chờ Nhận Tại Kho', value: `${readyCount} đơn`, color: 'var(--warning)', bg: 'rgba(217,119,6,0.1)', sub: 'Đơn sẵn sàng lấy', icon: <Package size={18} /> },
    { label: 'Đang Giao Trên Đường', value: `${activeCount} đơn`, color: 'var(--primary)', bg: 'rgba(37,99,235,0.1)', sub: 'Đang giữ đi giao', icon: <Truck size={18} /> },
    { label: 'Chờ Khách Gọi Lại 24h', value: `${countAwaiting} đơn`, color: 'var(--warning)', bg: 'rgba(217,119,6,0.1)', sub: 'Tạm giữ liên lạc', icon: <Clock size={18} /> },
    { label: 'Giao Thành Công (POD)', value: `${doneCount} đơn`, color: 'var(--success)', bg: 'rgba(22,163,74,0.1)', sub: 'Đã giao hoàn tất', icon: <CheckCircle size={18} /> },
    { label: 'Sự Cố / Chuyển Hoàn', value: `${failedCount} đơn`, color: 'var(--danger)', bg: 'rgba(220,38,38,0.1)', sub: 'Hẹn lại & hoàn kho', icon: <AlertTriangle size={18} /> },
    { label: 'Tổng Tiền Thu Hộ COD', value: fmt(totalCodCollected), color: 'var(--success)', bg: 'rgba(22,163,74,0.1)', sub: 'Cần nộp kế toán', icon: <Award size={18} /> }
  ];

  const deliveryRatioData = {
    labels: ['Giao thành công', 'Đang giao hàng', 'Chờ lấy hàng', 'Sự cố / Hoàn kho'],
    datasets: [
      {
        data: [
          Math.max(doneCount, 1),
          Math.max(activeCount, 0),
          Math.max(readyCount, 0),
          Math.max(failedCount, 0)
        ],
        backgroundColor: ['#16a34a', '#2563eb', '#f59e0b', '#ef4444'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  const dailyCodData = {
    labels: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'],
    datasets: [
      {
        label: 'Tiền thu hộ COD (Triệu VNĐ)',
        data: [12.5, 18.2, 15.0, 24.8, 21.0, 32.5, Math.max(Math.round(totalCodCollected / 1000000), 16)],
        backgroundColor: '#2563eb',
        borderRadius: 6
      }
    ]
  };

  return (
    <div>
      {/* 6 KPI cards, 2-column grid on the phone-width column */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.7rem', marginBottom: '0.9rem' }}>
        {stats.map((st, sIdx) => (
          <div key={sIdx} className="delivery-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '92px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {st.label}
              </span>
              <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', backgroundColor: st.bg, color: st.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {st.icon}
              </div>
            </div>
            <div style={{ marginTop: '0.35rem' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {st.value}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                {st.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts stacked full-width */}
      <div className="delivery-card" style={{ height: '260px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.75rem 0' }}>
          Tỷ Lệ Hoàn Thành Giao Hàng
        </h3>
        <div style={{ flex: 1, position: 'relative' }}>
          <Doughnut
            data={deliveryRatioData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
            }}
          />
        </div>
      </div>

      <div className="delivery-card" style={{ height: '260px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.75rem 0' }}>
          Thu Hộ Tiền Mặt (COD) Trong Tuần
        </h3>
        <div style={{ flex: 1, position: 'relative' }}>
          <Bar
            data={dailyCodData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
              scales: {
                y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
              }
            }}
          />
        </div>
      </div>

      {/* Quick tasks stacked vertically */}
      <div className="delivery-card">
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.7rem 0' }}>
          Đơn Hàng Gần Vị Trí Cần Nhận Giao
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {orders.filter(o => o.status === 'READY_TO_SHIP').slice(0, 3).map((o, oIdx) => (
            <div key={o.id || oIdx} style={{ padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{o.orderId || o.id} — {o.customerName}</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.shippingAddress || 'Quận 1, TP. Hồ Chí Minh'}</span>
              </div>
              <button
                onClick={() => onClaim(o.orderId || o.id)}
                style={{ backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.7rem', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
              >
                Nhận
              </button>
            </div>
          ))}
          {orders.filter(o => o.status === 'READY_TO_SHIP').length === 0 && (
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>Không có đơn chờ nhận.</div>
          )}
        </div>
      </div>

      <div className="delivery-card">
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.7rem 0' }}>
          Yêu Cầu Thu Hồi RMA Cần Lấy
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {pendingReturns.slice(0, 3).map((r, rIdx) => (
            <div key={r.id || rIdx} style={{ padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#RMA-{r.id} — {r.customerName}</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{r.phone}</span>
              </div>
              <button
                onClick={onGoToReturns}
                style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.7rem', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
              >
                Xem
              </button>
            </div>
          ))}
          {pendingReturns.length === 0 && (
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>Không có yêu cầu thu hồi.</div>
          )}
        </div>
      </div>
    </div>
  );
}
