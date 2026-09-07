import React, { useState, useEffect } from 'react';
import { Package, Filter, RefreshCw, Calendar } from 'lucide-react';
import FilterSheet from './components/FilterSheet';

const PAGE_SIZE = 25;

const selectStyle = { width: '100%', padding: '0.55rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', fontSize: '0.8rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: 600, boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' };

export default function ReturnsTab({
  fmt, orders, pendingReturns,
  rmaSearch, setRmaSearch, rmaDateFilter, setRmaDateFilter,
  rmaCustomStartDate, setRmaCustomStartDate, rmaCustomEndDate, setRmaCustomEndDate,
  rmaStatusFilter, setRmaStatusFilter,
  onPickup, onDeliverWarehouse,
  pullHandlers, isRefreshing, pullDistance
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const getReturnDateTime = (ret) => {
    const dateVal = ret.createdAt || ret.date || ret.pickedUpAt || ret.deliveredWarehouseAt;
    if (!dateVal) return null;
    if (typeof dateVal === 'string' && dateVal.includes('/')) {
      const parts = dateVal.split('/');
      if (parts.length === 3) {
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
  };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const endOfYesterday = new Date(endOfToday);
  endOfYesterday.setDate(endOfYesterday.getDate() - 1);
  const past7Days = new Date(startOfToday);
  past7Days.setDate(past7Days.getDate() - 7);
  const past30Days = new Date(startOfToday);
  past30Days.setDate(past30Days.getDate() - 30);

  const filteredReturns = pendingReturns.filter(ret => {
    if (rmaSearch.trim()) {
      const q = rmaSearch.trim().toLowerCase();
      const matchedOrder = orders.find(o => String(o.orderId || o.id) === String(ret.orderId));
      const match =
        String(ret.id || '').toLowerCase().includes(q) ||
        String(ret.orderId || '').toLowerCase().includes(q) ||
        String(ret.customerName || matchedOrder?.customerName || '').toLowerCase().includes(q) ||
        String(ret.phone || matchedOrder?.phone || '').includes(q) ||
        String(ret.address || ret.shippingAddress || matchedOrder?.shippingAddress || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    const isReturning = ret.status === 'RETURNING_TO_WAREHOUSE';
    const isDeliveredToWarehouse = ret.status === 'DELIVERED_TO_WAREHOUSE';
    const isPickupPending = ['PENDING', 'RETURN_APPROVED', 'RETURN_REQUESTED', 'PROCESSING'].includes(ret.status);

    if (rmaStatusFilter === 'PENDING_PICKUP' && !isPickupPending) return false;
    if (rmaStatusFilter === 'RETURNING' && !isReturning) return false;
    if (rmaStatusFilter === 'DELIVERED_WAREHOUSE' && !isDeliveredToWarehouse) return false;

    if (rmaDateFilter !== 'ALL') {
      const retDate = getReturnDateTime(ret);
      if (retDate) {
        if (rmaDateFilter === 'TODAY') {
          if (retDate < startOfToday || retDate > endOfToday) return false;
        } else if (rmaDateFilter === 'YESTERDAY') {
          if (retDate < startOfYesterday || retDate > endOfYesterday) return false;
        } else if (rmaDateFilter === 'LAST_7_DAYS') {
          if (retDate < past7Days || retDate > endOfToday) return false;
        } else if (rmaDateFilter === 'LAST_30_DAYS') {
          if (retDate < past30Days || retDate > endOfToday) return false;
        } else if (rmaDateFilter === 'CUSTOM') {
          if (rmaCustomStartDate) {
            const s = new Date(rmaCustomStartDate + 'T00:00:00');
            if (retDate < s) return false;
          }
          if (rmaCustomEndDate) {
            const e = new Date(rmaCustomEndDate + 'T23:59:59');
            if (retDate > e) return false;
          }
        }
      }
    }

    return true;
  });

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [rmaSearch, rmaStatusFilter, rmaDateFilter, rmaCustomStartDate, rmaCustomEndDate]);

  const hasActiveFilters = rmaSearch || rmaStatusFilter !== 'ALL' || rmaDateFilter !== 'ALL';

  const resetFilters = () => {
    setRmaSearch('');
    setRmaStatusFilter('ALL');
    setRmaDateFilter('ALL');
    setRmaCustomStartDate('');
    setRmaCustomEndDate('');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          Thu Hồi RMA ({filteredReturns.length}/{pendingReturns.length})
        </strong>
        <button type="button" onClick={() => setSheetOpen(true)} className="delivery-icon-btn" style={{ position: 'relative' }} title="Bộ lọc">
          <Filter size={16} />
          {hasActiveFilters && (
            <span style={{ position: 'absolute', top: '3px', right: '3px', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--danger)' }} />
          )}
        </button>
      </div>

      <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
        Nhận lại kiện hàng lỗi tại nhà khách và bàn giao về kho cho QC.
      </p>

      <div {...pullHandlers} style={{ overflowY: 'auto' }}>
        {(isRefreshing || pullDistance > 0) && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem', color: 'var(--primary)' }}>
            <RefreshCw size={16} style={{ opacity: Math.min(pullDistance / 60, 1), animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          </div>
        )}

        {filteredReturns.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Package size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 0.5rem' }} />
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              Không có yêu cầu thu hồi nào phù hợp
            </div>
          </div>
        ) : (
          filteredReturns.slice(0, visibleCount).map((ret, rIdx) => {
            const isReturning = ret.status === 'RETURNING_TO_WAREHOUSE';
            const isDeliveredToWarehouse = ret.status === 'DELIVERED_TO_WAREHOUSE';
            const isPickupPending = ['PENDING', 'RETURN_APPROVED', 'RETURN_REQUESTED', 'PROCESSING'].includes(ret.status);
            const matchedOrder = orders.find(o => String(o.orderId || o.id) === String(ret.orderId));
            const pickupAddr = ret.address || ret.shippingAddress || matchedOrder?.shippingAddress || 'TP. Hồ Chí Minh';

            const statusBadge = isPickupPending
              ? { text: 'CHỜ THU HỒI', bg: 'rgba(217,119,6,0.12)', color: 'var(--warning)' }
              : isReturning
                ? { text: 'ĐANG VỀ KHO', bg: 'rgba(37,99,235,0.12)', color: 'var(--primary)' }
                : { text: 'ĐÃ VỀ KHO', bg: 'rgba(22,163,74,0.12)', color: 'var(--success)' };

            return (
              <div key={ret.id || rIdx} className="delivery-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '0.5rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.88rem', color: '#7c3aed' }}>#RMA-{ret.id}</strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Đơn: #{ret.orderId}</div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800, backgroundColor: statusBadge.bg, color: statusBadge.color, whiteSpace: 'nowrap' }}>
                    {statusBadge.text}
                  </span>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '0.15rem' }}>
                  {ret.customerName || matchedOrder?.customerName}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '0.3rem' }}>
                  {ret.phone || matchedOrder?.phone}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  {pickupAddr}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem' }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800,
                    backgroundColor: ret.type === 'REFUND' ? 'rgba(22,163,74,0.1)' : 'rgba(37,99,235,0.1)',
                    color: ret.type === 'REFUND' ? 'var(--success)' : 'var(--primary)'
                  }}>
                    {ret.type === 'REFUND' ? 'Hoàn tiền 100%' : 'Đổi mới'}
                  </span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{ret.reason || 'Lỗi sản phẩm'}</span>
                </div>

                {isPickupPending && (
                  <button
                    type="button"
                    onClick={() => onPickup(ret)}
                    style={{ width: '100%', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.6rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Xác Nhận Đã Thu Hồi
                  </button>
                )}
                {isReturning && (
                  <button
                    type="button"
                    onClick={() => onDeliverWarehouse(ret)}
                    style={{ width: '100%', backgroundColor: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.6rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Bàn Giao Về Kho Cho QC
                  </button>
                )}
                {isDeliveredToWarehouse && (
                  <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Hoàn tất bàn giao
                  </div>
                )}
              </div>
            );
          })
        )}
        {filteredReturns.length > visibleCount && (
          <button
            type="button"
            onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
            style={{ width: '100%', padding: '0.7rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', cursor: 'pointer', marginTop: '0.25rem' }}
          >
            Xem Thêm ({filteredReturns.length - visibleCount} yêu cầu còn lại)
          </button>
        )}
      </div>

      <FilterSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Bộ Lọc Thu Hồi RMA" onReset={resetFilters}>
        <div>
          <label style={labelStyle}>Tìm kiếm</label>
          <input
            type="text"
            placeholder="Mã RMA, mã đơn, tên khách, SĐT, địa chỉ..."
            value={rmaSearch}
            onChange={e => setRmaSearch(e.target.value)}
            style={selectStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Tiến độ</label>
          <select value={rmaStatusFilter} onChange={e => setRmaStatusFilter(e.target.value)} style={selectStyle}>
            <option value="ALL">Tất Cả Tiến Độ</option>
            <option value="PENDING_PICKUP">Chờ Thu Hồi Tại Nhà</option>
            <option value="RETURNING">Đang Chuyển Về Kho</option>
            <option value="DELIVERED_WAREHOUSE">Đã Về Kho Cho QC</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Khoảng thời gian</label>
          <select value={rmaDateFilter} onChange={e => setRmaDateFilter(e.target.value)} style={selectStyle}>
            <option value="ALL">Tất Cả Ngày</option>
            <option value="TODAY">Hôm Nay</option>
            <option value="YESTERDAY">Hôm Qua</option>
            <option value="LAST_7_DAYS">7 Ngày Qua</option>
            <option value="LAST_30_DAYS">30 Ngày Qua</option>
            <option value="CUSTOM">Tùy Chọn Ngày...</option>
          </select>
        </div>

        {rmaDateFilter === 'CUSTOM' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}><Calendar size={11} /> Từ ngày</label>
              <input type="date" value={rmaCustomStartDate} onChange={e => setRmaCustomStartDate(e.target.value)} style={selectStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Đến ngày</label>
              <input type="date" value={rmaCustomEndDate} onChange={e => setRmaCustomEndDate(e.target.value)} style={selectStyle} />
            </div>
          </div>
        )}
      </FilterSheet>
    </div>
  );
}
