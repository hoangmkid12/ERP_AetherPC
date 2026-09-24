import React, { useState, useMemo } from 'react';
import { Package, Truck, Clock, CheckCircle, AlertTriangle, Award, Calendar, BarChart3, PieChart } from 'lucide-react';
import { formatRmaCode } from '../../../utils/statusLabels';
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
import DateFilterControl from './components/DateFilterControl';
import {
  getDefaultDateFilter,
  matchesDateFilter,
  getOrderDateTime,
  getDateFilterLabel,
  getDeliveryIncidentStatus
} from './deliveryHelpers';

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
  fmt,
  orders = [],
  myDeliveryOrders = [],
  pendingReturns = [],
  isShipperMatched = () => true,
  onClaim,
  onGoToReturns
}) {
  // Mặc định bộ lọc thời gian là ngày realtime (Hôm nay)
  const [dateFilter, setDateFilter] = useState(getDefaultDateFilter);

  // Pool of orders assigned to this shipper
  const shipperOrders = useMemo(() => {
    const list = myDeliveryOrders.length > 0 ? myDeliveryOrders : orders;
    return list.filter(o => isShipperMatched(o));
  }, [orders, myDeliveryOrders, isShipperMatched]);

  // Orders filtered by the selected date filter (Hôm nay / Theo ngày / Theo tháng / Theo năm...)
  const periodOrders = useMemo(() => {
    return shipperOrders.filter(o => {
      const dt = getOrderDateTime(o);
      return matchesDateFilter(dt, dateFilter);
    });
  }, [shipperOrders, dateFilter]);

  // Returns filtered by the selected date filter
  const periodReturns = useMemo(() => {
    return pendingReturns.filter(r => {
      const dt = r.createdAt || r.pickedUpAt || r.deliveredWarehouseAt || r.date;
      return matchesDateFilter(dt, dateFilter);
    });
  }, [pendingReturns, dateFilter]);

  // Recalculate KPI stats dynamically for the selected time period
  const stats = useMemo(() => {
    const ready = periodOrders.filter(o => o.status === 'READY_TO_SHIP').length;
    const active = periodOrders.filter(o =>
      ['SHIPPED', 'SHIPPING_FAILED', 'RETURNING_TO_WAREHOUSE', 'CANCELLED'].includes(o.status)
    ).length;
    const done = periodOrders.filter(o => o.status === 'DELIVERED').length;
    const awaiting = periodOrders.filter(o => {
      const st = getDeliveryIncidentStatus(o);
      return st.isAwaiting;
    }).length;
    const failed = periodOrders.filter(o => {
      const st = getDeliveryIncidentStatus(o);
      return st.isRescheduled || st.isRejected || st.isReturning;
    }).length;

    const totalCod = periodOrders
      .filter(o => o.status === 'DELIVERED')
      .reduce((sum, o) => {
        const isCod = o.paymentMethod === 'COD' || !o.paymentMethod;
        return sum + (isCod ? parseFloat(o.totalAmount || o.total || 0) : 0);
      }, 0);

    return [
      { label: 'Chờ Nhận Tại Kho', value: `${ready} đơn`, color: 'var(--warning)', bg: 'rgba(217,119,6,0.1)', sub: 'Đơn sẵn sàng lấy', icon: <Package size={18} /> },
      { label: 'Đang Giao Trên Đường', value: `${active} đơn`, color: 'var(--primary)', bg: 'rgba(37,99,235,0.1)', sub: 'Đang giữ đi giao', icon: <Truck size={18} /> },
      { label: 'Chờ Khách Gọi Lại 24h', value: `${awaiting} đơn`, color: 'var(--warning)', bg: 'rgba(217,119,6,0.1)', sub: 'Tạm giữ liên lạc', icon: <Clock size={18} /> },
      { label: 'Giao Thành Công (POD)', value: `${done} đơn`, color: 'var(--success)', bg: 'rgba(22,163,74,0.1)', sub: 'Đã giao hoàn tất', icon: <CheckCircle size={18} /> },
      { label: 'Sự Cố / Chuyển Hoàn', value: `${failed} đơn`, color: 'var(--danger)', bg: 'rgba(220,38,38,0.1)', sub: 'Hẹn lại & hoàn kho', icon: <AlertTriangle size={18} /> },
      { label: 'Tổng Tiền Thu Hộ COD', value: fmt(totalCod), color: 'var(--success)', bg: 'rgba(22,163,74,0.1)', sub: 'Cần nộp kế toán', icon: <Award size={18} /> }
    ];
  }, [periodOrders, fmt]);

  // Doughnut chart: Ratio of order states in this time period
  const deliveryRatioData = useMemo(() => {
    const ready = periodOrders.filter(o => o.status === 'READY_TO_SHIP').length;
    const active = periodOrders.filter(o => ['SHIPPED'].includes(o.status)).length;
    const done = periodOrders.filter(o => o.status === 'DELIVERED').length;
    const failed = periodOrders.filter(o =>
      ['SHIPPING_FAILED', 'RETURNING_TO_WAREHOUSE', 'CANCELLED'].includes(o.status)
    ).length;

    const hasData = ready > 0 || active > 0 || done > 0 || failed > 0;

    return {
      labels: ['Giao thành công', 'Đang giao hàng', 'Chờ lấy hàng', 'Sự cố / Hoàn kho'],
      datasets: [
        {
          data: hasData ? [done, active, ready, failed] : [0, 0, 0, 0],
          backgroundColor: ['#16a34a', '#2563eb', '#f59e0b', '#ef4444'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    };
  }, [periodOrders]);

  // Bar chart: COD revenue breakdown adapting to the chosen date period
  const { barLabels, barValues, barTitle } = useMemo(() => {
    const period = dateFilter.period;
    let labels = [];
    let values = [];
    let title = 'Thu Hộ Tiền Mặt (COD) Trong Tuần';

    if (period === 'TODAY' || period === 'YESTERDAY' || period === 'SPECIFIC_DATE') {
      title = `Thu Hộ COD Theo Khung Giờ (${getDateFilterLabel(dateFilter)})`;
      labels = ['07h - 11h', '11h - 14h', '14h - 17h', '17h - 21h'];
      const buckets = [0, 0, 0, 0];
      periodOrders.forEach(o => {
        if (o.status === 'DELIVERED') {
          const dt = getOrderDateTime(o);
          const amt = (o.paymentMethod === 'COD' || !o.paymentMethod) ? parseFloat(o.totalAmount || o.total || 0) / 1000000 : 0;
          if (dt) {
            const h = dt.getHours();
            if (h >= 7 && h < 11) buckets[0] += amt;
            else if (h >= 11 && h < 14) buckets[1] += amt;
            else if (h >= 14 && h < 17) buckets[2] += amt;
            else buckets[3] += amt;
          } else {
            buckets[0] += amt;
          }
        }
      });
      values = buckets.map(v => Math.round(v * 10) / 10);
    } else if (period === 'THIS_MONTH' || period === 'SPECIFIC_MONTH') {
      title = `Thu Hộ COD Theo Tuần (${getDateFilterLabel(dateFilter)})`;
      labels = ['Tuần 1 (1-7)', 'Tuần 2 (8-14)', 'Tuần 3 (15-21)', 'Tuần 4 (22+)'];
      const buckets = [0, 0, 0, 0];
      periodOrders.forEach(o => {
        if (o.status === 'DELIVERED') {
          const dt = getOrderDateTime(o);
          const amt = (o.paymentMethod === 'COD' || !o.paymentMethod) ? parseFloat(o.totalAmount || o.total || 0) / 1000000 : 0;
          if (dt) {
            const dayNum = dt.getDate();
            if (dayNum <= 7) buckets[0] += amt;
            else if (dayNum <= 14) buckets[1] += amt;
            else if (dayNum <= 21) buckets[2] += amt;
            else buckets[3] += amt;
          }
        }
      });
      values = buckets.map(v => Math.round(v * 10) / 10);
    } else if (period === 'THIS_YEAR' || period === 'SPECIFIC_YEAR') {
      title = `Thu Hộ COD 12 Tháng (${getDateFilterLabel(dateFilter)})`;
      labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
      const buckets = Array(12).fill(0);
      periodOrders.forEach(o => {
        if (o.status === 'DELIVERED') {
          const dt = getOrderDateTime(o);
          const amt = (o.paymentMethod === 'COD' || !o.paymentMethod) ? parseFloat(o.totalAmount || o.total || 0) / 1000000 : 0;
          if (dt) {
            buckets[dt.getMonth()] += amt;
          }
        }
      });
      values = buckets.map(v => Math.round(v * 10) / 10);
    } else {
      title = `Thu Hộ Tiền Mặt (COD) (${getDateFilterLabel(dateFilter)})`;
      labels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
      const buckets = Array(7).fill(0);
      periodOrders.forEach(o => {
        if (o.status === 'DELIVERED') {
          const dt = getOrderDateTime(o);
          const amt = (o.paymentMethod === 'COD' || !o.paymentMethod) ? parseFloat(o.totalAmount || o.total || 0) / 1000000 : 0;
          if (dt) {
            const day = dt.getDay();
            const idx = day === 0 ? 6 : day - 1;
            buckets[idx] += amt;
          }
        }
      });
      values = buckets.map(v => Math.round(v * 10) / 10);
    }

    return { barLabels: labels, barValues: values, barTitle: title };
  }, [periodOrders, dateFilter]);

  const dailyCodData = {
    labels: barLabels,
    datasets: [
      {
        label: 'Tiền thu hộ COD (Triệu VNĐ)',
        data: barValues,
        backgroundColor: '#2563eb',
        borderRadius: 6
      }
    ]
  };

  return (
    <div>
      {/* Top Filter Card for Overview Tab */}
      <div className="delivery-card" style={{ marginBottom: '0.85rem', padding: '0.75rem 0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={15} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Thời Gian Thống Kê:
            </span>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--primary)',
              backgroundColor: 'rgba(37,99,235,0.1)',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              {getDateFilterLabel(dateFilter)}
            </span>
          </div>
        </div>

        {/* Quick filter selector bar: Hôm nay, Tháng này, Năm nay, Tùy chọn */}
        <DateFilterControl
          variant="inline"
          dateFilter={dateFilter}
          onChange={setDateFilter}
        />
      </div>

      {/* 6 KPI cards, 2-column grid */}
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
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <PieChart size={15} style={{ color: 'var(--primary)' }} /> Tỷ Lệ Hoàn Thành Giao Hàng
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
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <BarChart3 size={15} style={{ color: 'var(--primary)' }} /> {barTitle}
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
              {typeof onClaim === 'function' && (
                <button
                  onClick={() => onClaim(o.orderId || o.id)}
                  style={{ backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.7rem', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                >
                  Nhận
                </button>
              )}
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
          {periodReturns.slice(0, 3).map((r, rIdx) => (
            <div key={r.id || rIdx} style={{ padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatRmaCode(r, rIdx + 1)} — {r.customerName}</strong>
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
          {periodReturns.length === 0 && (
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>Không có yêu cầu thu hồi trong khoảng thời gian này.</div>
          )}
        </div>
      </div>
    </div>
  );
}
