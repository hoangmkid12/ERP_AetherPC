import React, { useState, useEffect } from 'react';
import { Truck, Filter, RefreshCw, Calendar } from 'lucide-react';
import OrderCard from './components/OrderCard';
import FilterSheet from './components/FilterSheet';
import DateFilterControl from './components/DateFilterControl';
import RouteOptimizerPanel from './components/RouteOptimizerPanel';

const PAGE_SIZE = 25;

const selectStyle = { width: '100%', padding: '0.55rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', fontSize: '0.8rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: 600, boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' };

export default function ActiveTab({
  orders, fmt, getOrderTimeClassification, onOpenDetail, actions,
  filterState, activeOrdersList, todayCount, newCount, backlogCount,
  countShipping, doneCount, countAwaiting, countRescheduled, countRejected, countReturning,
  onGoToPending, pullHandlers, isRefreshing, pullDistance,
  gpsOrderId, simulatingOrderId,
  onStartOptimized
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [orders]);
  const {
    search, setSearch,
    regionFilter, setRegionFilter,
    paymentFilter, setPaymentFilter,
    incidentFilter, setIncidentFilter,
    orderDateFilter, setOrderDateFilter,
    sortOrder, setSortOrder
  } = filterState;

  const hasActiveFilters = search || regionFilter !== 'ALL' || paymentFilter !== 'ALL' || incidentFilter !== 'ALL' || (orderDateFilter && orderDateFilter.period !== 'TODAY') || sortOrder !== 'NEWEST';

  const resetFilters = () => {
    setSearch('');
    setRegionFilter('ALL');
    setPaymentFilter('ALL');
    setIncidentFilter('ALL');
    if (setOrderDateFilter) {
      setOrderDateFilter({
        period: 'TODAY',
        selectedDate: new Date().toISOString().split('T')[0],
        selectedMonth: new Date().toISOString().slice(0, 7),
        selectedYear: String(new Date().getFullYear()),
        customStartDate: '',
        customEndDate: ''
      });
    }
    setSortOrder('NEWEST');
  };

  const handlePillClick = (tabId) => {
    if (tabId === 'TODAY') {
      if (setOrderDateFilter) setOrderDateFilter(prev => ({ ...prev, period: 'TODAY' }));
      setIncidentFilter('ALL');
    } else if (tabId === 'BACKLOG') {
      setIncidentFilter('BACKLOG');
    } else if (tabId === 'ALL') {
      if (setOrderDateFilter) setOrderDateFilter(prev => ({ ...prev, period: 'ALL' }));
      setIncidentFilter('ALL');
    } else {
      setIncidentFilter(tabId);
    }
  };

  const pillTabs = [
    { id: 'ALL', label: 'Tất Cả', count: activeOrdersList.length },
    { id: 'TODAY', label: 'Hôm Nay', count: todayCount },
    { id: 'NEW', label: 'Mới Nhận', count: newCount },
    { id: 'BACKLOG', label: 'Đơn Tồn', count: backlogCount },
    { id: 'SHIPPING', label: 'Đang Đi Giao', count: countShipping },
    { id: 'DELIVERED', label: 'Đã Giao', count: doneCount },
    { id: 'AWAITING_CALLBACK', label: 'Chờ Gọi Lại', count: countAwaiting },
    { id: 'RESCHEDULED', label: 'Khách Hẹn Lại', count: countRescheduled },
    { id: 'REJECTED', label: 'Từ Chối / Hủy', count: countRejected },
    { id: 'RETURNING', label: 'Đang Hoàn Kho', count: countReturning }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          Đang Giao ({orders.length})
        </strong>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="delivery-icon-btn"
          style={{ position: 'relative' }}
          title="Bộ lọc"
        >
          <Filter size={16} />
          {hasActiveFilters && (
            <span style={{ position: 'absolute', top: '3px', right: '3px', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--danger)' }} />
          )}
        </button>
      </div>

      {/* Interactive Quick Time Filter Bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)',
        padding: '0.45rem 0.7rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-md)', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.4rem'
      }}>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              if (setOrderDateFilter) setOrderDateFilter(prev => ({ ...prev, period: 'TODAY' }));
              setIncidentFilter('ALL');
            }}
            style={{
              background: orderDateFilter?.period === 'TODAY' && incidentFilter !== 'BACKLOG' ? 'rgba(37,99,235,0.12)' : 'none',
              border: orderDateFilter?.period === 'TODAY' && incidentFilter !== 'BACKLOG' ? '1px solid var(--primary)' : '1px solid transparent',
              borderRadius: '12px', padding: '2px 8px', cursor: 'pointer',
              color: orderDateFilter?.period === 'TODAY' && incidentFilter !== 'BACKLOG' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: orderDateFilter?.period === 'TODAY' && incidentFilter !== 'BACKLOG' ? 700 : 500, fontSize: '0.72rem'
            }}
          >
            Hôm nay: <strong style={{ color: 'var(--primary)' }}>{todayCount}</strong> {newCount > 0 && <span style={{ color: '#ea580c' }}>(mới: {newCount})</span>}
          </button>

          <span style={{ color: 'var(--border-glass)' }}>|</span>

          <button
            type="button"
            onClick={() => {
              setIncidentFilter('BACKLOG');
            }}
            style={{
              background: incidentFilter === 'BACKLOG' ? 'rgba(217,119,6,0.12)' : 'none',
              border: incidentFilter === 'BACKLOG' ? '1px solid var(--warning)' : '1px solid transparent',
              borderRadius: '12px', padding: '2px 8px', cursor: 'pointer',
              color: incidentFilter === 'BACKLOG' ? 'var(--warning)' : 'var(--text-secondary)',
              fontWeight: incidentFilter === 'BACKLOG' ? 700 : 500, fontSize: '0.72rem'
            }}
          >
            Tồn: <strong style={{ color: 'var(--warning)' }}>{backlogCount}</strong>
          </button>

          <span style={{ color: 'var(--border-glass)' }}>|</span>

          <button
            type="button"
            onClick={() => {
              if (setOrderDateFilter) setOrderDateFilter(prev => ({ ...prev, period: 'ALL' }));
              setIncidentFilter('ALL');
            }}
            style={{
              background: orderDateFilter?.period === 'ALL' && incidentFilter === 'ALL' ? 'rgba(100,116,139,0.12)' : 'none',
              border: orderDateFilter?.period === 'ALL' && incidentFilter === 'ALL' ? '1px solid var(--text-muted)' : '1px solid transparent',
              borderRadius: '12px', padding: '2px 8px', cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontWeight: orderDateFilter?.period === 'ALL' && incidentFilter === 'ALL' ? 700 : 500, fontSize: '0.72rem'
            }}
          >
            Tất cả: <strong>{activeOrdersList.length}</strong>
          </button>
        </div>

        <span style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 600 }}>
          {orderDateFilter?.period === 'TODAY' ? 'Thời gian: Hôm nay' : (orderDateFilter?.period === 'ALL' ? 'Thời gian: Tất cả' : `Lọc: ${orderDateFilter?.period}`)}
        </span>
      </div>

      {/* Route Optimizer Panel — hiện khi có ≥ 2 đơn đang giao */}
      {orders.length >= 2 && (
        <RouteOptimizerPanel
          orders={orders}
          onStartOptimized={onStartOptimized}
        />
      )}

      <div {...pullHandlers} style={{ overflowY: 'auto' }}>
        {(isRefreshing || pullDistance > 0) && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem', color: 'var(--primary)' }}>
            <RefreshCw size={16} style={{ opacity: Math.min(pullDistance / 60, 1), animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          </div>
        )}

        {orders.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Truck size={38} style={{ color: 'var(--text-muted)', margin: '0 auto 0.6rem' }} />
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              Không tìm thấy đơn hàng nào phù hợp
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.3rem 0 0.85rem' }}>
              Hãy đổi bộ lọc hoặc sang tab "Chờ Nhận" để nhận thêm đơn.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {orderDateFilter?.period !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => {
                    if (setOrderDateFilter) setOrderDateFilter(prev => ({ ...prev, period: 'ALL' }));
                    setIncidentFilter('ALL');
                  }}
                  style={{ padding: '0.45rem 0.9rem', fontSize: '0.76rem', fontWeight: 700, backgroundColor: 'var(--bg-tertiary)', color: 'var(--primary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                >
                  Xem Tất Cả ({activeOrdersList.length} đơn)
                </button>
              )}
              <button
                type="button"
                onClick={onGoToPending}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.76rem', fontWeight: 700, backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
              >
                Sang Tab Chờ Nhận
              </button>
            </div>
          </div>
        ) : (
          <>
            {orders.slice(0, visibleCount).map((ord, oIdx) => {
              const orderKey = String(ord.orderId || ord.id);
              return (
                <OrderCard
                  key={ord.id || oIdx}
                  order={ord}
                  variant="active"
                  fmt={fmt}
                  getOrderTimeClassification={getOrderTimeClassification}
                  onOpenDetail={onOpenDetail}
                  actions={actions}
                  isGpsActive={gpsOrderId === orderKey}
                  isSimulating={simulatingOrderId === orderKey}
                />
              );
            })}
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

      <FilterSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Bộ Lọc Đơn Đang Giao" onReset={resetFilters}>
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

        <div>
          <label style={labelStyle}>Tiến độ giao hàng</label>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {pillTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handlePillClick(tab.id)}
                style={{
                  padding: '0.3rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                  border: (incidentFilter === tab.id || (tab.id === 'TODAY' && orderDateFilter?.period === 'TODAY' && incidentFilter === 'ALL') || (tab.id === 'ALL' && orderDateFilter?.period === 'ALL' && incidentFilter === 'ALL'))
                    ? '1.5px solid var(--primary)'
                    : '1px solid var(--border-glass)',
                  backgroundColor: (incidentFilter === tab.id || (tab.id === 'TODAY' && orderDateFilter?.period === 'TODAY' && incidentFilter === 'ALL') || (tab.id === 'ALL' && orderDateFilter?.period === 'ALL' && incidentFilter === 'ALL'))
                    ? 'rgba(37,99,235,0.1)'
                    : 'var(--bg-primary)',
                  color: (incidentFilter === tab.id || (tab.id === 'TODAY' && orderDateFilter?.period === 'TODAY' && incidentFilter === 'ALL') || (tab.id === 'ALL' && orderDateFilter?.period === 'ALL' && incidentFilter === 'ALL'))
                    ? 'var(--primary)'
                    : 'var(--text-secondary)'
                }}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* Date Filter Control with support for Month, Year, Day */}
        {orderDateFilter && setOrderDateFilter && (
          <DateFilterControl
            dateFilter={orderDateFilter}
            onChange={setOrderDateFilter}
            variant="sheet"
          />
        )}

        <div>
          <label style={labelStyle}>Khu vực</label>
          <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={selectStyle}>
            <option value="ALL">Tất Cả Khu Vực</option>
            <option value="HCM">Nội Thành TP.HCM</option>
            <option value="PROVINCE">Ngoại Tỉnh (3PL)</option>
          </select>
        </div>

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
