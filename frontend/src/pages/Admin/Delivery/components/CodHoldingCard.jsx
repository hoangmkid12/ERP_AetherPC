import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, CheckCircle2 } from 'lucide-react';
import { api } from '../../../../services/api';
import { notify, confirm } from '../../../../context/NotificationContext';

// Tiền mặt thu hộ của nhân viên giao hàng — lấy từ máy chủ (OrderPayment), không cộng từ
// danh sách đơn: đơn đổi sang chuyển khoản / trả nhiều phần / đã được Kế toán thu sẽ bị tính sai.
export default function CodHoldingCard({ fmt, refreshKey }) {
  const [cod, setCod] = useState(null);
  const [remitting, setRemitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/ledger/cod/my');
      setCod(res.data || null);
    } catch {
      setCod(null);
    }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (!cod) return null;

  const notRemitted = (cod.pending || []).filter(p => !p.remittedAt).length;
  const remitted = (cod.pending || []).filter(p => p.remittedAt).length;

  const handleRemit = async () => {
    if (cod.holdingAmount <= 0) return;
    if (!(await confirm(`Khai báo đã nộp ${fmt(cod.holdingAmount)} tiền mặt (${notRemitted} đơn) cho Kế toán? Kế toán sẽ kiểm đếm và xác nhận.`))) return;
    setRemitting(true);
    try {
      const res = await api.post('/ledger/cod/my/remit', {});
      notify(res.message || 'Đã khai báo nộp tiền.', 'success');
      load();
    } catch (err) {
      notify(err?.message || 'Không thể khai báo nộp tiền.', 'error');
    } finally {
      setRemitting(false);
    }
  };

  const row = (label, sub, amount, color) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', padding: '0.45rem 0', borderTop: '1px solid var(--border-glass)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
      <strong style={{ fontSize: '0.88rem', color, whiteSpace: 'nowrap' }}>{fmt(amount)}</strong>
    </div>
  );

  return (
    <div className="delivery-card" style={{ marginBottom: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
        <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: 'rgba(22,163,74,0.12)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Wallet size={16} />
        </div>
        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>Tiền thu hộ của bạn</div>
      </div>

      {row('Đang giữ, chưa nộp', `${notRemitted} đơn`, cod.holdingAmount, cod.holdingAmount > 0 ? 'var(--warning)' : 'var(--text-secondary)')}
      {cod.remittedPendingAmount > 0 && row('Đã nộp, chờ Kế toán xác nhận', `${remitted} đơn`, cod.remittedPendingAmount, 'var(--primary)')}
      {row('Kế toán đã xác nhận', '30 ngày gần nhất', cod.settledAmount30d, 'var(--success)')}

      {cod.holdingAmount > 0 ? (
        <button
          type="button"
          onClick={handleRemit}
          disabled={remitting}
          style={{ width: '100%', marginTop: '0.5rem', padding: '0.7rem', fontSize: '0.85rem', fontWeight: 800, color: '#fff', backgroundColor: 'var(--success)', border: 'none', borderRadius: 'var(--radius-md)', cursor: remitting ? 'default' : 'pointer', opacity: remitting ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
        >
          <Wallet size={16} /> {remitting ? 'Đang gửi...' : 'Khai báo đã nộp tiền cho Kế toán'}
        </button>
      ) : (
        <div style={{ marginTop: '0.4rem', fontSize: '0.77rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <CheckCircle2 size={14} /> Bạn không còn giữ tiền thu hộ nào chưa nộp.
        </div>
      )}
    </div>
  );
}
