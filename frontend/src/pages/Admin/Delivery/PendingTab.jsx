import React, { useState, useEffect } from 'react';
import { Package, Search, RefreshCw } from 'lucide-react';
import OrderCard from './components/OrderCard';

const PAGE_SIZE = 25;

export default function PendingTab({
  orders, fmt, getOrderTimeClassification, onOpenDetail, actions,
  search, setSearch, onGoToActive,
  pullHandlers, isRefreshing, pullDistance
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [orders]);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          Sẵn Sàng Giao ({orders.length})
        </strong>
      </div>

      <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
        <input
          type="text"
          placeholder="Tìm mã đơn, khách hàng, địa chỉ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.55rem 0.7rem 0.55rem 2.1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', fontSize: '0.82rem', boxSizing: 'border-box' }}
        />
        <Search size={15} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
      </div>

      <div
        {...pullHandlers}
        style={{ overflowY: 'auto' }}
      >
        {(isRefreshing || pullDistance > 0) && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem', color: 'var(--primary)' }}>
            <RefreshCw size={16} style={{ opacity: Math.min(pullDistance / 60, 1), animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          </div>
        )}

        {orders.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Package size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 0.5rem' }} />
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              Hiện không có đơn hàng nào chờ nhận tại kho
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.35rem 0 0.85rem' }}>
              Các đơn đã nhận đang nằm trong tab "Đang Giao".
            </p>
            <button
              type="button"
              onClick={onGoToActive}
              style={{ padding: '0.5rem 1rem', fontSize: '0.78rem', fontWeight: 700, backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
            >
              Chuyển Sang Tab Đang Giao
            </button>
          </div>
        ) : (
          <>
            {orders.slice(0, visibleCount).map((ord, oIdx) => (
              <OrderCard
                key={ord.id || oIdx}
                order={ord}
                variant="pending"
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
    </div>
  );
}
