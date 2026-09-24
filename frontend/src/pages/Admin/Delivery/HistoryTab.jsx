import React, { useState, useEffect, useMemo } from 'react';
import { Filter, RefreshCw, History as HistoryIcon, Calendar } from 'lucide-react';
import OrderCard from './components/OrderCard';
import FilterSheet from './components/FilterSheet';
import DateFilterControl from './components/DateFilterControl';
import { getDefaultDateFilter, getDateFilterLabel } from './deliveryHelpers';

const PAGE_SIZE = 25;

const selectStyle = { width: '100%', padding: '0.55rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', fontSize: '0.8rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: 600, boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' };

export default function HistoryTab({
  orders, fmt, getOrderTimeClassification, onOpenDetail, actions,
  filterState, totalCodCollected,
  pullHandlers, isRefreshing, pullDistance
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [orders]);

  const {
    search, setSearch,
    paymentFilter, setPaymentFilter,
    orderDateFilter = getDefaultDateFilter(),
    setOrderDateFilter,
    sortOrder, setSortOrder
  } = filterState;

  // Tính COD động theo khoảng thời gian và đơn hàng đã lọc
  const periodCodCollected = useMemo(() => {
    return (orders || [])
      .filter(o => o.status === 'DELIVERED')
      .reduce((sum, o) => sum + (o.paymentMethod === 'COD' || !o.paymentMethod ? (parseFloat(o.totalAmount || o.total || 0)) : 0), 0);
  }, [orders]);

  const isDefaultDate = orderDateFilter?.period === 'TODAY';
  const hasActiveFilters = search || paymentFilter !== 'ALL' || !isDefaultDate || sortOrder !== 'NEWEST';

  const resetFilters = () => {
    setSearch('');
    setPaymentFilter('ALL');
    if (setOrderDateFilter) setOrderDateFilter(getDefaultDateFilter());
    setSortOrder('NEWEST');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <HistoryIcon size={16} /> Lịch Sử Giao Hàng ({orders.length})
        </strong>
        <button type="button" onClick={() => setSheetOpen(true)} className="delivery-icon-btn" style={{ position: 'relative' }} title="Bộ lọc">
          <Filter size={16} />
          {hasActiveFilters && (
            <span style={{ position: 'absolute', top: '3px', right: '3px', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--danger)' }} />
          )}
        </button>
      </div>

      {/* Date Filter Indicator Bar with Quick Reset Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: '0.65rem', border: '1px solid var(--border-glass)', fontSize: '0.74rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
          <Calendar size={13} style={{ color: 'var(--primary)' }} />
          <span>Thời gian: <strong style={{ color: 'var(--text-primary)' }}>{getDateFilterLabel(orderDateFilter)}</strong></span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {orderDateFilter?.period !== 'ALL' && (
            <button
              type="button"
              onClick={() => setOrderDateFilter && setOrderDateFilter(prev => ({ ...prev, period: 'ALL' }))}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Xem tất cả
            </button>
          )}
          {orderDateFilter?.period !== 'TODAY' && (
            <button
              type="button"
              onClick={() => setOrderDateFilter && setOrderDateFilter(getDefaultDateFilter())}
              style={{ background: 'none', border: 'none', color: 'var(--success)', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Hôm nay
            </button>
          )}
        </div>
      </div>

      <div className="delivery-card" style={{ marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Tổng COD thu hộ ({getDateFilterLabel(orderDateFilter)})</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Cần nộp Kế toán • {orders.filter(o => o.status === 'DELIVERED').length} đơn hoàn tất</div>
        </div>
        <strong style={{ fontSize: '1rem', color: 'var(--success)' }}>{fmt(periodCodCollected)}</strong>
      </div>

      <div {...pullHandlers} style={{ overflowY: 'auto' }}>
        {(isRefreshing || pullDistance > 0) && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem', color: 'var(--primary)' }}>
            <RefreshCw size={16} style={{ opacity: Math.min(pullDistance / 60, 1), animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          </div>
        )}

        {orders.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Chưa có lịch sử giao hàng phù hợp bộ lọc ({getDateFilterLabel(orderDateFilter)}).
          </div>
        ) : (
          <>
            {orders.slice(0, visibleCount).map((ord, oIdx) => (
              <OrderCard
                key={ord.id || oIdx}
                order={ord}
                variant="history"
                fmt={fmt}
                getOrderTimeClassification={getOrderTimeClassification}
                onOpenDetail={onOpenDetail}
                actions={actions}
              />
            ))}
            {orders.length > visibleCount && (
              <button
                type="button"
                onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                style={{ width: '100%', padding: '0.7rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', cursor: 'pointer', marginTop: '0.25rem' }}
              >
                Xem Thêm ({orders.length - visibleCount} đơn còn lại)
              </button>
            )}
          </>
        )}
      </div>

      <FilterSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Bộ Lọc Lịch Sử" onReset={resetFilters}>
        <div>
          <label style={labelStyle}>Tìm kiếm</label>
          <input
            type="text"
            placeholder="Mã đơn, tên khách, SĐT, địa chỉ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={selectStyle}
          />
        </div>

        {/* Unified DateFilterControl */}
        <DateFilterControl
          dateFilter={orderDateFilter}
          onChange={setOrderDateFilter}
          variant="sheet"
        />

        <div>
          <label style={labelStyle}>Hình thức thanh toán</label>
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} style={selectStyle}>
            <option value="ALL">Tất Cả Hình Thức</option>
            <option value="COD">Thu Tiền Mặt COD</option>
            <option value="PREPAID">Đã Trả Online</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Sắp xếp</label>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={selectStyle}>
            <option value="NEWEST">Mới Nhất Trước</option>
            <option value="OLDEST">Cũ Nhất Trước</option>
            <option value="COD_DESC">Tiền COD Cao Nhất</option>
            <option value="COD_ASC">Tiền COD Thấp Nhất</option>
          </select>
        </div>
      </FilterSheet>
    </div>
  );
}
