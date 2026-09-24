import React, { useState, useEffect } from 'react';
import { Package, Filter, RefreshCw, Calendar } from 'lucide-react';
import FilterSheet from './components/FilterSheet';
import DateFilterControl from './components/DateFilterControl';
import { formatRmaCode } from '../../../utils/statusLabels';
import { getReturnDateTime, matchesDateFilter, getDateFilterLabel, getDefaultDateFilter } from './deliveryHelpers';

const PAGE_SIZE = 25;

const selectStyle = { width: '100%', padding: '0.55rem 0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', fontSize: '0.8rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: 600, boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' };

export default function ReturnsTab({
  fmt, orders, pendingReturns,
  rmaSearch, setRmaSearch,
  rmaDateFilter = getDefaultDateFilter(),
  setRmaDateFilter,
  rmaStatusFilter, setRmaStatusFilter,
  onPickup, onDeliverWarehouse,
  onRedeliverPickup, onRedeliverComplete,
  pullHandlers, isRefreshing, pullDistance
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredReturns = (pendingReturns || []).filter(ret => {
    if (rmaSearch && rmaSearch.trim()) {
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
    const isRejectedByQc = ret.status === 'REJECTED';
    const isReturningToCustomer = ret.status === 'RETURNING_TO_CUSTOMER';
    const isReturnedToCustomer = ret.status === 'RETURNED_TO_CUSTOMER';

    if (rmaStatusFilter === 'PENDING_PICKUP' && !isPickupPending) return false;
    if (rmaStatusFilter === 'RETURNING' && !isReturning) return false;
    if (rmaStatusFilter === 'DELIVERED_WAREHOUSE' && !isDeliveredToWarehouse) return false;
    if (rmaStatusFilter === 'REJECTED_RETURN' && !isRejectedByQc) return false;
    if (rmaStatusFilter === 'RETURNING_TO_CUSTOMER' && !isReturningToCustomer) return false;
    if (rmaStatusFilter === 'RETURNED_TO_CUSTOMER' && !isReturnedToCustomer) return false;

    // Universal Date Filter
    const retDate = getReturnDateTime(ret);
    if (!matchesDateFilter(retDate, rmaDateFilter)) return false;

    return true;
  });

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [rmaSearch, rmaStatusFilter, rmaDateFilter]);

  const isDefaultDate = rmaDateFilter?.period === 'TODAY';
  const hasActiveFilters = rmaSearch || rmaStatusFilter !== 'ALL' || !isDefaultDate;

  const resetFilters = () => {
    setRmaSearch('');
    setRmaStatusFilter('ALL');
    if (setRmaDateFilter) setRmaDateFilter(getDefaultDateFilter());
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          Thu Hồi & Trả Hàng RMA ({filteredReturns.length}/{pendingReturns.length})
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
          <span>Thời gian: <strong style={{ color: 'var(--text-primary)' }}>{getDateFilterLabel(rmaDateFilter)}</strong></span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {rmaDateFilter?.period !== 'ALL' && (
            <button
              type="button"
              onClick={() => setRmaDateFilter && setRmaDateFilter(prev => ({ ...prev, period: 'ALL' }))}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Xem tất cả
            </button>
          )}
          {rmaDateFilter?.period !== 'TODAY' && (
            <button
              type="button"
              onClick={() => setRmaDateFilter && setRmaDateFilter(getDefaultDateFilter())}
              style={{ background: 'none', border: 'none', color: 'var(--success)', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Hôm nay
            </button>
          )}
        </div>
      </div>

      <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
        Thu hồi kiện hàng lỗi về kho cho QC hoặc nhận hàng bị từ chối giao trả lại khách.
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
              Không có yêu cầu thu hồi / trả hàng nào phù hợp
            </div>
          </div>
        ) : (
          filteredReturns.slice(0, visibleCount).map((ret, rIdx) => {
            const isReturning = ret.status === 'RETURNING_TO_WAREHOUSE';
            const isDeliveredToWarehouse = ret.status === 'DELIVERED_TO_WAREHOUSE';
            const isPickupPending = ['PENDING', 'RETURN_APPROVED', 'RETURN_REQUESTED', 'PROCESSING'].includes(ret.status);
            const isRejectedByQc = ret.status === 'REJECTED';
            const isReturningToCustomer = ret.status === 'RETURNING_TO_CUSTOMER';
            const isReturnedToCustomer = ret.status === 'RETURNED_TO_CUSTOMER';
            const matchedOrder = orders.find(o => String(o.orderId || o.id) === String(ret.orderId));
            const pickupAddr = ret.address || ret.shippingAddress || matchedOrder?.shippingAddress || 'TP. Hồ Chí Minh';

            const statusBadge = isPickupPending
              ? { text: 'CHỜ THU HỒI', bg: 'rgba(217,119,6,0.12)', color: 'var(--warning)' }
              : isReturning
                ? { text: 'ĐANG VỀ KHO', bg: 'rgba(37,99,235,0.12)', color: 'var(--primary)' }
                : isDeliveredToWarehouse
                  ? { text: 'ĐÃ VỀ KHO', bg: 'rgba(22,163,74,0.12)', color: 'var(--success)' }
                  : isRejectedByQc
                    ? { text: 'QC TỪ CHỐI - CHỜ TRẢ KHÁCH', bg: '#fee2e2', color: '#dc2626' }
                    : isReturningToCustomer
                      ? { text: 'ĐANG GIAO TRẢ KHÁCH', bg: '#ffedd5', color: '#ea580c' }
                      : isReturnedToCustomer
                        ? { text: 'ĐÃ HOÀN TRẢ KHÁCH', bg: '#f1f5f9', color: '#64748b' }
                        : { text: ret.status, bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' };

            return (
              <div key={ret.id || rIdx} className="delivery-card" style={isRejectedByQc ? { borderLeft: '4px solid #dc2626' } : isReturningToCustomer ? { borderLeft: '4px solid #ea580c' } : undefined}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '0.5rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.88rem', color: '#7c3aed' }}>{formatRmaCode(ret, rIdx + 1)}</strong>
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

                {/* Hộp thông tin QC từ chối (hiển thị cho Shipper biết nguyên nhân để giải thích với khách khi trả hàng) */}
                {(isRejectedByQc || isReturningToCustomer || isReturnedToCustomer) && (
                  <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.5rem 0.65rem', marginBottom: '0.65rem', fontSize: '0.74rem' }}>
                    <div style={{ fontWeight: 800, color: '#dc2626', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span>⚠️ Lý do QC từ chối đổi trả:</span>
                    </div>
                    <div style={{ color: '#991b1b', lineHeight: 1.35, fontWeight: 500 }}>
                      {ret.qcNotes || ret.reason || 'Sản phẩm vi phạm điều kiện đổi trả / tem niêm phong / sai Serial'}
                    </div>
                    {ret.qcProofPhoto && (
                      <div style={{ marginTop: '4px' }}>
                        <a href={ret.qcProofPhoto} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'underline' }}>
                          📷 Xem ảnh minh chứng vi phạm của QC
                        </a>
                      </div>
                    )}
                  </div>
                )}

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
                    Hoàn tất bàn giao về kho cho QC
                  </div>
                )}
                {isRejectedByQc && (
                  <button
                    type="button"
                    onClick={() => onRedeliverPickup?.(ret)}
                    style={{ width: '100%', backgroundColor: '#ea580c', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.6rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    🚚 Lấy Hàng Từ Kho Đi Trả Khách
                  </button>
                )}
                {isReturningToCustomer && (
                  <button
                    type="button"
                    onClick={() => onRedeliverComplete?.(ret)}
                    style={{ width: '100%', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.6rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    ✓ Xác Nhận Đã Trả Khách Thành Công
                  </button>
                )}
                {isReturnedToCustomer && (
                  <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#15803d', fontWeight: 700, backgroundColor: '#f0fdf4', padding: '0.4rem', borderRadius: '6px' }}>
                    ✓ Đã hoàn trả lại kiện hàng cho khách
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
            <option value="REJECTED_RETURN">QC Từ Chối - Chờ Giao Trả Khách</option>
            <option value="RETURNING_TO_CUSTOMER">Đang Giao Trả Khách</option>
            <option value="RETURNED_TO_CUSTOMER">Đã Hoàn Trả Khách</option>
          </select>
        </div>

        {/* Unified DateFilterControl */}
        <DateFilterControl
          dateFilter={rmaDateFilter}
          onChange={setRmaDateFilter}
          variant="sheet"
        />
      </FilterSheet>
    </div>
  );
}
