import React, { useState, useMemo } from 'react';
import { Package, Truck, Clock, CheckCircle, AlertTriangle, Award, Calendar, BarChart3, PieChart, Wallet, FileText, Printer, X, CheckCheck, Undo2, ChevronRight } from 'lucide-react';
import CodHoldingCard from './components/CodHoldingCard';
import { formatRmaCode } from '../../../utils/statusLabels';
import { useAuth } from '../../../context/AuthContext';
import { printDocument } from '../../../utils/printDocument';
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
  getDeliveryIncidentStatus,
  isCodOrder, getOrderCashAmount, isOrderCodSettled
} from './deliveryHelpers';
import { SignatureRow, SignatureCell, displaySigner, historySigner } from '../../../components/Signature/ESignature';

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
  readyCount = 0,
  activeCount = 0,
  backlogCount = 0,
  onClaim,
  onGoToReturns,
  onGoToActive,
  onGoToPending
}) {
  // Mặc định bộ lọc thời gian là ngày realtime (Hôm nay)
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState(getDefaultDateFilter);
  const [showHandoverModal, setShowHandoverModal] = useState(false);

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

    // Phân tích chi tiết tiền mặt COD: Đã thu, Đã nộp kế toán, Đang giữ
    const codOrders = periodOrders.filter(o => {
      if (o.status !== 'DELIVERED') return false;
      return isCodOrder(o);
    });

    const settledOrders = codOrders.filter(isOrderCodSettled);
    const pendingOrders = codOrders.filter(o => !isOrderCodSettled(o));

    const totalCollected = codOrders.reduce((sum, o) => sum + getOrderCashAmount(o), 0);
    const settledAmount = settledOrders.reduce((sum, o) => sum + getOrderCashAmount(o), 0);
    const pendingAmount = pendingOrders.reduce((sum, o) => sum + getOrderCashAmount(o), 0);
    const percentSettled = totalCollected > 0 ? Math.min(100, Math.round((settledAmount / totalCollected) * 100)) : 100;

    return [
      { label: 'Giao thành công', value: `${done} đơn`, color: 'var(--success)', bg: 'rgba(22,163,74,0.1)', icon: <CheckCircle size={18} /> },
      { label: 'Tiền thu hộ đã thu', value: fmt(totalCollected), color: 'var(--primary)', bg: 'rgba(37,99,235,0.1)', icon: <Award size={18} /> },
      { label: 'Chờ khách gọi lại', value: `${awaiting} đơn`, color: 'var(--warning)', bg: 'rgba(217,119,6,0.1)', icon: <Clock size={18} /> },
      { label: 'Hẹn lại / hoàn kho', value: `${failed} đơn`, color: 'var(--danger)', bg: 'rgba(220,38,38,0.1)', icon: <AlertTriangle size={18} /> }
    ];
  }, [periodOrders, fmt]);

  // Bộ tính toán COD phục vụ khối Đối soát ca & Phiếu bàn giao
  const codAnalytics = useMemo(() => {
    const codOrders = periodOrders.filter(o => {
      if (o.status !== 'DELIVERED') return false;
      return isCodOrder(o);
    });

    const settledOrders = codOrders.filter(isOrderCodSettled);
    const pendingOrders = codOrders.filter(o => !isOrderCodSettled(o));

    const totalCollected = codOrders.reduce((sum, o) => sum + getOrderCashAmount(o), 0);
    const settledAmount = settledOrders.reduce((sum, o) => sum + getOrderCashAmount(o), 0);
    const pendingAmount = pendingOrders.reduce((sum, o) => sum + getOrderCashAmount(o), 0);
    const percentSettled = totalCollected > 0 ? Math.min(100, Math.round((settledAmount / totalCollected) * 100)) : 100;

    return {
      codOrders,
      settledOrders,
      pendingOrders,
      totalCollected,
      settledAmount,
      pendingAmount,
      percentSettled
    };
  }, [periodOrders]);

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
      labels: ['Giao thành công', 'Đang giao', 'Chờ nhận', 'Hẹn lại / hoàn kho'],
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
    let title = 'Tiền thu hộ trong tuần';

    const singleDay = period === 'CUSTOM' && dateFilter.customStartDate && dateFilter.customStartDate === dateFilter.customEndDate;
    if (period === 'TODAY' || period === 'YESTERDAY' || period === 'SPECIFIC_DATE' || singleDay) {
      title = `Tiền thu hộ theo khung giờ (${getDateFilterLabel(dateFilter)})`;
      labels = ['07h - 11h', '11h - 14h', '14h - 17h', '17h - 21h'];
      const buckets = [0, 0, 0, 0];
      periodOrders.forEach(o => {
        if (o.status === 'DELIVERED') {
          const dt = getOrderDateTime(o);
          const amt = (isCodOrder(o) ? getOrderCashAmount(o) : 0) / 1000000;
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
      title = `Tiền thu hộ theo tuần (${getDateFilterLabel(dateFilter)})`;
      labels = ['Tuần 1 (1-7)', 'Tuần 2 (8-14)', 'Tuần 3 (15-21)', 'Tuần 4 (22+)'];
      const buckets = [0, 0, 0, 0];
      periodOrders.forEach(o => {
        if (o.status === 'DELIVERED') {
          const dt = getOrderDateTime(o);
          const amt = (isCodOrder(o) ? getOrderCashAmount(o) : 0) / 1000000;
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
      title = `Tiền thu hộ 12 tháng (${getDateFilterLabel(dateFilter)})`;
      labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
      const buckets = Array(12).fill(0);
      periodOrders.forEach(o => {
        if (o.status === 'DELIVERED') {
          const dt = getOrderDateTime(o);
          const amt = (isCodOrder(o) ? getOrderCashAmount(o) : 0) / 1000000;
          if (dt) {
            buckets[dt.getMonth()] += amt;
          }
        }
      });
      values = buckets.map(v => Math.round(v * 10) / 10);
    } else {
      title = `Tiền thu hộ (${getDateFilterLabel(dateFilter)})`;
      labels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
      const buckets = Array(7).fill(0);
      periodOrders.forEach(o => {
        if (o.status === 'DELIVERED') {
          const dt = getOrderDateTime(o);
          const amt = (isCodOrder(o) ? getOrderCashAmount(o) : 0) / 1000000;
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
        label: 'Tiền thu hộ (triệu đồng)',
        data: barValues,
        backgroundColor: '#2563eb',
        borderRadius: 6
      }
    ]
  };

  const returnsToHandle = pendingReturns.filter(r =>
    ['RETURN_APPROVED', 'RETURNING_TO_WAREHOUSE', 'REJECTED', 'RETURNING_TO_CUSTOMER'].includes(r.status)
  ).length;
  const todos = [
    { key: 'backlog', show: backlogCount > 0, icon: <AlertTriangle size={18} />, color: 'var(--danger)', bg: 'rgba(220,38,38,0.1)',
      title: `${backlogCount} đơn tồn từ hôm trước`, sub: 'Giao trong hôm nay, báo hẹn lại hoặc hoàn kho', onClick: onGoToActive },
    { key: 'active', show: true, icon: <Truck size={18} />, color: 'var(--primary)', bg: 'rgba(37,99,235,0.1)',
      title: `${activeCount} đơn đang giao`, sub: activeCount > 0 ? 'Mở danh sách để bắt đầu giao' : 'Chưa có đơn nào trong tay', onClick: onGoToActive },
    { key: 'ready', show: true, icon: <Package size={18} />, color: 'var(--warning)', bg: 'rgba(217,119,6,0.1)',
      title: `${readyCount} đơn chờ nhận tại kho`, sub: readyCount > 0 ? 'Đến kho nhận hàng' : 'Kho chưa giao thêm đơn', onClick: onGoToPending },
    { key: 'returns', show: returnsToHandle > 0, icon: <Undo2 size={18} />, color: '#7c3aed', bg: 'rgba(124,58,237,0.1)',
      title: `${returnsToHandle} phiếu đổi trả cần xử lý`, sub: 'Thu hồi hàng hoặc giao trả khách', onClick: onGoToReturns }
  ].filter(t => t.show);

  return (
    <div>
      {/* Việc cần làm — luôn tính trên toàn bộ đơn đang giữ, không phụ thuộc bộ lọc thời gian */}
      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', margin: '0 0 0.45rem 0.1rem' }}>Việc cần làm</div>
      <div className="delivery-card" style={{ padding: 0, marginBottom: '0.85rem', overflow: 'hidden' }}>
        {todos.map((t, i) => (
          <button
            key={t.key}
            type="button"
            onClick={t.onClick}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.75rem 0.85rem', background: 'none', border: 'none', borderTop: i ? '1px solid var(--border-glass)' : 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: t.bg, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{t.icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 800, color: t.key === 'backlog' ? 'var(--danger)' : 'var(--text-primary)' }}>{t.title}</span>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.sub}</span>
            </span>
            <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>
        ))}
      </div>

      <CodHoldingCard fmt={fmt} refreshKey={myDeliveryOrders.length} />

      {/* Thống kê theo kỳ */}
      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', margin: '0.2rem 0 0.45rem 0.1rem' }}>Thống kê</div>
      <div className="delivery-card" style={{ marginBottom: '0.85rem', padding: '0.75rem 0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={15} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Thời gian:
            </span>
            <span style={{
              fontSize: '0.77rem',
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

        {/* Lọc theo khoảng ngày */}
        <DateFilterControl
          variant="inline"
          dateFilter={dateFilter}
          onChange={setDateFilter}
        />
      </div>

      {/* 4 thẻ thống kê theo kỳ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.7rem', marginBottom: '0.9rem' }}>
        {stats.map((st, sIdx) => (
          <div key={sIdx} className="delivery-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '80px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
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
            </div>
          </div>
        ))}
      </div>

      {periodOrders.length === 0 && (
        <div className="delivery-card" style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '1rem' }}>
          Chưa có đơn giao nào trong khoảng thời gian này. Chọn "Tháng Này" hoặc "Tất Cả" để xem thống kê dài hơn.
        </div>
      )}

      {/* Tiền thu hộ trong kỳ — chỉ hiện khi kỳ đang chọn có đơn thu tiền mặt */}
      {codAnalytics.codOrders.length > 0 && (
      <div className="delivery-card" style={{ marginBottom: '0.9rem', border: '1.5px solid #cbd5e1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Wallet size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Tiền thu hộ trong kỳ
              </h3>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Đối chiếu tiền đã thu với số Kế toán đã xác nhận
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowHandoverModal(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.4rem 0.75rem', borderRadius: '6px',
              border: '1px solid #e3e8ef', backgroundColor: '#ffffff',
              color: '#2563eb', fontSize: '0.79rem', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <FileText size={14} />
            <span>Phiếu bàn giao</span>
          </button>
        </div>

        {/* 3 Metric Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 700 }}>Đã thu</span>
            <strong style={{ fontSize: '0.88rem', color: '#0f172a', display: 'block', marginTop: '2px' }}>
              {fmt(codAnalytics.totalCollected)}
            </strong>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{codAnalytics.codOrders.length} đơn</span>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', color: '#15803d', display: 'block', fontWeight: 700 }}>Kế toán đã nhận</span>
            <strong style={{ fontSize: '0.88rem', color: '#16a34a', display: 'block', marginTop: '2px' }}>
              {fmt(codAnalytics.settledAmount)}
            </strong>
            <span style={{ fontSize: '0.7rem', color: '#16a34a' }}>{codAnalytics.settledOrders.length} đơn</span>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', color: codAnalytics.pendingAmount > 0 ? '#b45309' : '#64748b', display: 'block', fontWeight: 700 }}>Chưa đối soát</span>
            <strong style={{ fontSize: '0.88rem', color: codAnalytics.pendingAmount > 0 ? '#dc2626' : '#16a34a', display: 'block', marginTop: '2px' }}>
              {fmt(codAnalytics.pendingAmount)}
            </strong>
            <span style={{ fontSize: '0.7rem', color: codAnalytics.pendingAmount > 0 ? '#dc2626' : '#64748b' }}>
              {codAnalytics.pendingOrders.length} đơn
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '0.65rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '0.25rem', fontWeight: 700 }}>
            <span style={{ color: '#475569' }}>Đã đối soát:</span>
            <span style={{ color: codAnalytics.percentSettled === 100 ? '#16a34a' : '#2563eb' }}>
              {codAnalytics.percentSettled}% ({fmt(codAnalytics.settledAmount)} / {fmt(codAnalytics.totalCollected)})
            </span>
          </div>
          <div style={{ height: '7px', borderRadius: '999px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{
              width: `${codAnalytics.percentSettled}%`,
              height: '100%',
              borderRadius: '999px',
              backgroundColor: codAnalytics.percentSettled === 100 ? '#16a34a' : '#2563eb',
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>

        {/* Status Notification Banner */}
        {codAnalytics.pendingAmount > 0 ? (
          <div style={{ padding: '0.55rem 0.75rem', borderRadius: '6px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={15} style={{ color: '#d97706', flexShrink: 0 }} />
            <span style={{ fontSize: '0.77rem', color: '#92400e', lineHeight: 1.35 }}>
              Trong kỳ này còn <strong>{fmt(codAnalytics.pendingAmount)}</strong> chưa được Kế toán xác nhận. Nộp tiền và khai báo ở mục "Tiền thu hộ của bạn" phía trên.
            </span>
          </div>
        ) : codAnalytics.totalCollected > 0 ? (
          <div style={{ padding: '0.55rem 0.75rem', borderRadius: '6px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCheck size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
            <span style={{ fontSize: '0.77rem', color: '#15803d', lineHeight: 1.35 }}>
              Kế toán đã xác nhận đủ tiền thu hộ của các đơn trong kỳ này.
            </span>
          </div>
        ) : (
          <div style={{ padding: '0.55rem 0.75rem', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.77rem', color: '#64748b' }}>
            Chưa có đơn thu tiền mặt trong khoảng thời gian được chọn.
          </div>
        )}
      </div>

      )}

      {/* Biểu đồ — chỉ hiện khi kỳ đang chọn có dữ liệu */}
      {periodOrders.length > 0 && (<>
      <div className="delivery-card" style={{ height: '260px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <PieChart size={15} style={{ color: 'var(--primary)' }} /> Tỷ lệ hoàn thành giao hàng
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

      </>)}

      {/* Danh sách nhanh */}
      <div className="delivery-card">
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.7rem 0' }}>
          Đơn chờ nhận tại kho
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {shipperOrders.filter(o => o.status === 'READY_TO_SHIP').slice(0, 3).map((o, oIdx) => (
            <div key={o.id || oIdx} style={{ padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{o.orderId || o.id} — {o.customerName}</strong>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.shippingAddress || 'Quận 1, TP. Hồ Chí Minh'}</span>
              </div>
              {typeof onClaim === 'function' && (
                <button
                  onClick={() => onClaim(o.orderId || o.id)}
                  style={{ backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.7rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                >
                  Nhận
                </button>
              )}
            </div>
          ))}
          {shipperOrders.filter(o => o.status === 'READY_TO_SHIP').length === 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>Không có đơn chờ nhận.</div>
          )}
        </div>
      </div>

      <div className="delivery-card">
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.7rem 0' }}>
          Hàng đổi trả cần thu hồi
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {periodReturns.slice(0, 3).map((r, rIdx) => (
            <div key={r.id || rIdx} style={{ padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatRmaCode(r, rIdx + 1)} — {r.customerName}</strong>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{r.phone}</span>
              </div>
              <button
                onClick={onGoToReturns}
                style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.7rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
              >
                Xem
              </button>
            </div>
          ))}
          {periodReturns.length === 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>Không có yêu cầu thu hồi trong khoảng thời gian này.</div>
          )}
        </div>
      </div>

      {/* MODAL: PHIẾU BÀN GIAO TIỀN CA (HANDOVER VOUCHER) */}
      {showHandoverModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 100001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setShowHandoverModal(false)}
        >
          <div
            style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e3e8ef', width: '100%', maxWidth: '640px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '0.85rem 1.1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} style={{ color: '#2563eb' }} />
                <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>Phiếu bàn giao tiền thu hộ</strong>
              </div>
              <button
                type="button"
                onClick={() => setShowHandoverModal(false)}
                style={{ background: '#f1f5f9', border: 'none', padding: '0.35rem', borderRadius: '6px', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
              <div data-print-doc="cod-handover">
                {/* Print Header */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.77rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    CÔNG TY TNHH CÔNG NGHỆ AETHERPC • PHÒNG VẬN HÀNH & GIAO HÀNG
                  </div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', margin: '0.25rem 0' }}>
                    BIÊN BẢN BÀN GIAO TIỀN MẶT THU HỘ
                  </h2>
                  <div style={{ fontSize: '0.79rem', color: '#64748b' }}>
                    Mã biên bản: <code style={{ color: '#2563eb', fontWeight: 800 }}>#BG-COD-{Date.now().toString().slice(-8)}</code> • Thời gian xuất: {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date().toLocaleDateString('vi-VN')}
                  </div>
                </div>

                {/* Shipper & Summary Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.77rem' }}>Nhân viên giao hàng:</span>
                    <strong style={{ color: '#0f172a' }}>{user?.fullname || user?.name || 'Nhân viên giao hàng'}</strong>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.77rem', marginTop: '2px' }}>Khu vực: {user?.deliveryRegion || 'HCM_KV1'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.77rem' }}>Tổng tiền mặt cần nộp ca này:</span>
                    <strong style={{ color: '#b45309', fontSize: '1.05rem', display: 'block' }}>{fmt(codAnalytics.pendingAmount)}</strong>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.77rem' }}>
                      (Đã nộp: {fmt(codAnalytics.settledAmount)} / Tổng thu: {fmt(codAnalytics.totalCollected)})
                    </span>
                  </div>
                </div>

                {/* Table of Orders */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>
                    Danh sách đơn thu tiền mặt ({codAnalytics.codOrders.length} đơn)
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e3e8ef', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '0.45rem 0.6rem' }}>Mã Đơn</th>
                        <th style={{ padding: '0.45rem 0.6rem' }}>Khách Hàng</th>
                        <th style={{ padding: '0.45rem 0.6rem' }}>Địa Chỉ Giao</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>Tiền thu hộ</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codAnalytics.codOrders.map((o, idx) => {
                        const isSettled = isOrderCodSettled(o);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '0.45rem 0.6rem', fontWeight: 700, color: '#2563eb' }}>#{o.orderId || o.id}</td>
                            <td style={{ padding: '0.45rem 0.6rem', color: '#0f172a' }}>{o.customerName}</td>
                            <td style={{ padding: '0.45rem 0.6rem', color: '#64748b' }}>{o.shippingAddress}</td>
                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                              {fmt(getOrderCashAmount(o))}
                            </td>
                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
                              {isSettled ? (
                                <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800, backgroundColor: '#dcfce7', color: '#15803d' }}>
                                  ĐÃ DUYỆT
                                </span>
                              ) : (
                                <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800, backgroundColor: '#fef3c7', color: '#b45309' }}>
                                  CHỜ NỘP
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {codAnalytics.codOrders.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                            Không có đơn thu tiền mặt nào trong khoảng thời gian này.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Chữ ký điện tử — nhân viên giao hàng ký khi lập biên bản; kế toán ký khi xác nhận đã nhận đủ tiền tại quầy */}
                <SignatureRow>
                  <SignatureCell title="Nhân viên giao hàng" note="(Ký, ghi rõ họ tên)" name={user?.fullname || user?.name || ''} />
                  <SignatureCell title="Kế toán" note="(Ký, ghi rõ họ tên)" signed={false} />
                </SignatureRow>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '0.75rem 1.1rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => printDocument('[data-print-doc="cod-handover"]', { title: 'Phiếu bàn giao tiền thu hộ' })}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.45rem 0.9rem', borderRadius: '6px',
                  border: '1px solid #e3e8ef', backgroundColor: '#ffffff',
                  color: '#0f172a', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer'
                }}
              >
                <Printer size={15} />
                <span>In Biên Bản</span>
              </button>

              <button
                type="button"
                onClick={() => setShowHandoverModal(false)}
                style={{
                  padding: '0.45rem 1rem', borderRadius: '6px',
                  border: 'none', backgroundColor: '#2563eb',
                  color: '#ffffff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
