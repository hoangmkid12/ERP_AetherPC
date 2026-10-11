import React, { useState, useEffect, useCallback } from 'react';
import { Filter, RefreshCw, History as HistoryIcon, Calendar, Wallet } from 'lucide-react';
import { api } from '../../../services/api';
import { notify, confirm } from '../../../context/NotificationContext';
import OrderCard from './components/OrderCard';
import FilterSheet from './components/FilterSheet';
import DateFilterControl from './components/DateFilterControl';
import { getDefaultDateFilter, getDateFilterLabel } from './deliveryHelpers';

const PAGE_SIZE = 25;

const selectStyle = { width: '100%', padding: '0.55rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', fontSize: '0.8rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: 600, boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: '0.77rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' };

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

  // Tiền mặt COD thật sự đang giữ — lấy từ OrderPayment (settledAt/remittedAt)
  // ở backend, không ước tính từ danh sách đơn (đơn đổi sang chuyển khoản /
  // split / đã được Kế toán thu sẽ bị tính sai nếu cộng totalAmount).
  const [cod, setCod] = useState(null);
  const [remitting, setRemitting] = useState(false);
  const loadMyCod = useCallback(async () => {
    try {
      const res = await api.get('/ledger/cod/my');
      setCod(res.data || null);
    } catch {
      setCod(null);
    }
  }, []);
  useEffect(() => { loadMyCod(); }, [loadMyCod, orders]);

  const handleRemit = async () => {
    if (!cod || cod.holdingAmount <= 0) return;
    const count = cod.pending.filter(p => !p.remittedAt).length;
    if (!(await confirm(`Khai báo đã nộp ${fmt(cod.holdingAmount)} tiền mặt (${count} đơn) cho Kế toán? Kế toán sẽ kiểm đếm và xác nhận.`))) return;
    setRemitting(true);
    try {
      const res = await api.post('/ledger/cod/my/remit', {});
      notify(res.message || 'Đã khai báo nộp tiền.', 'success');
      loadMyCod();
    } catch (err) {
      notify(err?.message || 'Không thể khai báo nộp tiền.', 'error');
    } finally {
      setRemitting(false);
    }
  };

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: '0.65rem', border: '1px solid var(--border-glass)', fontSize: '0.79rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
          <Calendar size={13} style={{ color: 'var(--primary)' }} />
          <span>Thời gian: <strong style={{ color: 'var(--text-primary)' }}>{getDateFilterLabel(orderDateFilter)}</strong></span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {orderDateFilter?.period !== 'ALL' && (
            <button
              type="button"
              onClick={() => setOrderDateFilter && setOrderDateFilter(prev => ({ ...prev, period: 'ALL' }))}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '0.77rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Xem tất cả
            </button>
          )}
          {orderDateFilter?.period !== 'TODAY' && (
            <button
              type="button"
              onClick={() => setOrderDateFilter && setOrderDateFilter(getDefaultDateFilter())}
              style={{ background: 'none', border: 'none', color: 'var(--success)', fontWeight: 700, fontSize: '0.77rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Hôm nay
            </button>
          )}
        </div>
      </div>

      {cod && (
        <div className="delivery-card" style={{ marginBottom: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tiền mặt COD đang giữ</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Cần nộp Kế toán • {cod.pending.filter(p => !p.remittedAt).length} đơn
              </div>
            </div>
            <strong style={{ fontSize: '1rem', color: cod.holdingAmount > 0 ? 'var(--warning)' : 'var(--success)' }}>{fmt(cod.holdingAmount)}</strong>
          </div>
          {cod.remittedPendingAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.77rem', color: 'var(--text-secondary)' }}>
              <span>Đã khai báo nộp, chờ Kế toán xác nhận</span>
              <strong style={{ color: 'var(--primary)' }}>{fmt(cod.remittedPendingAmount)}</strong>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.77rem', color: 'var(--text-secondary)' }}>
            <span>Kế toán đã xác nhận thu (30 ngày)</span>
            <strong style={{ color: 'var(--success)' }}>{fmt(cod.settledAmount30d)}</strong>
          </div>
          {cod.holdingAmount > 0 && (
            <button
              type="button"
              onClick={handleRemit}
              disabled={remitting}
              style={{ width: '100%', padding: '0.6rem', fontSize: '0.82rem', fontWeight: 800, color: '#fff', backgroundColor: 'var(--success)', border: 'none', borderRadius: 'var(--radius-md)', cursor: remitting ? 'default' : 'pointer', opacity: remitting ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
            >
              <Wallet size={15} /> {remitting ? 'Đang gửi...' : 'Khai Báo Đã Nộp Tiền Cho Kế Toán'}
            </button>
          )}
        </div>
      )}

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
