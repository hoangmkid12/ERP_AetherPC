import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../services/api';
import { notify, confirm } from '../../context/NotificationContext';
import { ORDER_STATUS, getStatusLabel } from '../../utils/statusLabels';

const fmt = (n) => `${Number(n || 0).toLocaleString('vi-VN')}đ`;

// Đơn giao hàng tồn: còn "ngoài đường" từ trước hôm nay, hoặc đang giao mà
// không có shipper phụ trách (không shipper nào thấy/được phép cập nhật).
// Kho dùng bảng này để gọi shipper chốt đơn, hoặc gán lại shipper khác.
export default function StaleDeliveriesPanel() {
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  // Mặc định thu gọn: khung chỉ hiện tóm tắt số đơn tồn, bấm "Xem chi tiết" mới mở danh sách
  const [expanded, setExpanded] = useState(false);
  const [shippers, setShippers] = useState([]);
  const [reassign, setReassign] = useState({}); // { [orderId]: shipperId }
  const [busyOrderId, setBusyOrderId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders/stale-deliveries');
      setGroups(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      notify(err?.message || 'Không tải được danh sách đơn giao tồn.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.get('/hr/employees/shippers')
      .then(res => setShippers(res?.data || []))
      .catch(() => setShippers([]));
  }, [load]);

  const handleReassign = async (order) => {
    const shipperId = reassign[order.orderId];
    if (!shipperId) return;
    const shipper = shippers.find(s => String(s.id) === String(shipperId));
    if (!(await confirm(`Gán đơn #${order.orderId} cho shipper "${shipper?.fullName || shipperId}"?`))) return;
    setBusyOrderId(order.orderId);
    try {
      await api.patch(`/orders/${order.orderId}/status`, {
        status: order.status,
        assignedShipperId: Number(shipperId),
        note: `Kho gán lại đơn tồn cho shipper ${shipper?.fullName || shipperId}`
      });
      notify(`Đã gán đơn #${order.orderId} cho ${shipper?.fullName || 'shipper'}.`, 'success');
      setReassign(prev => ({ ...prev, [order.orderId]: '' }));
      load();
    } catch (err) {
      notify(err?.message || 'Không gán lại được shipper.', 'error');
    } finally {
      setBusyOrderId(null);
    }
  };

  if (!loading && total === 0) return null;

  return (
    <div style={{ backgroundColor: '#ffffff', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '1.25rem', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.85rem 1rem', backgroundColor: '#fef2f2', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlertTriangle size={20} style={{ color: '#dc2626' }} />
          <div>
            <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.95rem' }}>
              {loading && total === 0 ? 'Đang kiểm tra đơn giao tồn...' : `${total} đơn giao hàng tồn cần xử lý`}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#7f1d1d' }}>
              Đơn còn ngoài đường từ ngày trước hoặc đang giao mà chưa có shipper. Giao thất bại quá hạn (chờ gọi lại &gt; 24h, hẹn lại &gt; 3 ngày) được hệ thống tự chuyển hoàn kho.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #fecaca', backgroundColor: '#fff', color: '#991b1b', borderRadius: '6px', cursor: loading ? 'default' : 'pointer' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Làm mới
          </button>
          <button type="button" onClick={() => setExpanded(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #fecaca', backgroundColor: '#fff', color: '#991b1b', borderRadius: '6px', cursor: 'pointer' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {expanded ? 'Thu gọn' : 'Xem chi tiết'}
          </button>
        </div>
      </div>

      {expanded && groups.map(group => (
        <div key={group.shipperId || 'UNASSIGNED'} style={{ borderTop: '1px solid #fee2e2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 1rem', backgroundColor: '#fffbfb', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Truck size={16} style={{ color: group.shipperId ? '#d97706' : '#dc2626' }} />
              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>
                {group.shipperId ? group.shipperName : 'Chưa có shipper phụ trách'}
              </span>
              {group.shipperPhone && <span style={{ fontSize: '0.78rem', color: '#64748b' }}>• {group.shipperPhone}</span>}
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>• {group.orders.length} đơn</span>
            </div>
            {group.shipperId && group.codHolding > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 700 }}>
                Đang giữ tiền mặt COD chưa nộp: {fmt(group.codHolding)}
              </span>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748b', fontSize: '0.75rem', backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '0.45rem 1rem' }}>Mã Đơn</th>
                  <th style={{ padding: '0.45rem 1rem' }}>Trạng Thái</th>
                  <th style={{ padding: '0.45rem 1rem' }}>Khách Hàng</th>
                  <th style={{ padding: '0.45rem 1rem' }}>Tồn</th>
                  <th style={{ padding: '0.45rem 1rem', textAlign: 'right' }}>Giá Trị</th>
                  <th style={{ padding: '0.45rem 1rem' }}>Gán Lại Shipper</th>
                </tr>
              </thead>
              <tbody>
                {group.orders.map(o => (
                  <tr key={o.orderId} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.5rem 1rem', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>#{o.orderId}</td>
                    <td style={{ padding: '0.5rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{getStatusLabel(ORDER_STATUS, o.status)}</div>
                      {o.failReason && <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{o.failReason}</div>}
                    </td>
                    <td style={{ padding: '0.5rem 1rem', color: '#0f172a' }}>
                      <div>{o.customerName || 'Khách hàng'}</div>
                      {o.customerPhone && <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{o.customerPhone}</div>}
                    </td>
                    <td style={{ padding: '0.5rem 1rem', fontWeight: 800, color: o.daysStale >= 3 ? '#dc2626' : '#b45309', whiteSpace: 'nowrap' }}>
                      {o.daysStale > 0 ? `${o.daysStale} ngày` : 'Hôm nay'}
                    </td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(o.totalAmount)}</td>
                    <td style={{ padding: '0.5rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <select
                          value={reassign[o.orderId] || ''}
                          onChange={e => setReassign(prev => ({ ...prev, [o.orderId]: e.target.value }))}
                          disabled={busyOrderId === o.orderId}
                          style={{ padding: '0.3rem 0.4rem', fontSize: '0.78rem', border: '1px solid #e2e8f0', borderRadius: '5px', maxWidth: '170px' }}
                        >
                          <option value="">Chọn shipper...</option>
                          {shippers
                            .filter(s => String(s.id) !== String(group.shipperId))
                            .map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleReassign(o)}
                          disabled={!reassign[o.orderId] || busyOrderId === o.orderId}
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', fontWeight: 700, border: 'none', borderRadius: '5px', backgroundColor: reassign[o.orderId] ? '#2563eb' : '#cbd5e1', color: '#fff', cursor: reassign[o.orderId] ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                        >
                          {busyOrderId === o.orderId ? '...' : 'Gán'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
