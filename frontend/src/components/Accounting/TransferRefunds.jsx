import React, { useCallback, useEffect, useState } from 'react';
import { RotateCcw, CheckCircle, Phone, Mail, Search, X, Landmark } from 'lucide-react';
import { api } from '../../services/api';
import { notify } from '../../context/NotificationContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(n) || 0);
const fmtDate = (d) => (d ? new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

const REASON_COLOR = {
  'Chuyển thiếu số tiền đơn hàng': ['#fef3c7', '#b45309'],
  'Chuyển dư so với giá trị đơn': ['#dbeafe', '#1d4ed8'],
  'Chuyển vào đơn đã hủy': ['#fee2e2', '#b91c1c'],
};

const th = { padding: '0.65rem 0.85rem', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' };
const td = { padding: '0.7rem 0.85rem', fontSize: '0.82rem', color: '#334155', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };

// Hoàn tiền chuyển khoản SePay: khoản khách chuyển thiếu (đơn chưa xác nhận), chuyển dư, chuyển trùng
// hoặc chuyển vào đơn đã hủy. Kế toán chuyển trả khách qua ngân hàng rồi xác nhận tại đây — hệ thống ghi
// bút toán REFUND vào Sổ Cái, trừ số dư tài khoản đã nhận tiền và ghi vào lịch sử đơn hàng.
export default function TransferRefunds({ onCountChange }) {
  const [view, setView] = useState('REFUND_PENDING');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [target, setTarget] = useState(null);
  const [refundRef, setRefundRef] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/payments/refunds?status=${view}`);
      const list = Array.isArray(res?.data) ? res.data : [];
      setRows(list);
      if (view === 'REFUND_PENDING') onCountChange?.(list.length);
    } catch (err) {
      notify(err.message || 'Không tải được danh sách hoàn tiền.', 'error');
    } finally {
      setLoading(false);
    }
  }, [view, onCountChange]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useAutoRefresh(load);

  const filtered = rows.filter(r => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [r.orderId, r.customerName, r.customerPhone, r.customerEmail, r.bankRef].some(v => String(v || '').toLowerCase().includes(s));
  });
  const totalPending = view === 'REFUND_PENDING' ? rows.reduce((s, r) => s + r.amount, 0) : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!refundRef.trim()) return;
    setSaving(true);
    try {
      const res = await api.post(`/payments/refunds/${target.id}/complete`, { refundRef: refundRef.trim(), note: note.trim() });
      notify(res?.message || 'Đã ghi nhận hoàn tiền.', 'success');
      setTarget(null); setRefundRef(''); setNote('');
      load();
    } catch (err) {
      notify(err.message || 'Không ghi nhận được hoàn tiền.', 'error');
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.85rem 1rem', color: '#92400e', fontSize: '0.84rem', lineHeight: 1.5 }}>
        <RotateCcw size={18} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 220 }}>
          Các khoản khách chuyển khoản qua SePay nhưng <b>không dùng để thanh toán đơn</b> (chuyển thiếu, chuyển dư, chuyển trùng, chuyển vào đơn đã hủy).
          Chuyển trả khách từ tài khoản ngân hàng công ty, sau đó bấm <b>Đã hoàn tiền</b> và nhập mã giao dịch hoàn.
        </span>
        {view === 'REFUND_PENDING' && rows.length > 0 && (
          <span style={{ fontWeight: 800, fontSize: '0.95rem', whiteSpace: 'nowrap' }}>Cần hoàn: {fmt(totalPending)} ({rows.length} khoản)</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {[['REFUND_PENDING', 'Chờ hoàn tiền'], ['REFUNDED', 'Đã hoàn tiền']].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setView(k)}
            style={{ padding: '0.45rem 0.9rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', border: `1px solid ${view === k ? '#2563eb' : '#e2e8f0'}`, backgroundColor: view === k ? '#eff6ff' : '#fff', color: view === k ? '#1d4ed8' : '#334155' }}>
            {label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.35rem 0.6rem', backgroundColor: '#fff', minWidth: 0, flex: '0 1 280px' }}>
          <Search size={15} color="#94a3b8" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Mã đơn, khách hàng, SĐT, mã GD..." style={{ border: 0, outline: 'none', fontSize: '0.82rem', width: '100%', minWidth: 0 }} />
        </div>
      </div>

      <div style={{ backgroundColor: '#fff', border: '1px solid #e3e8ef', borderRadius: '8px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Đơn hàng</th>
              <th style={th}>Khách hàng</th>
              <th style={th}>Lý do</th>
              <th style={{ ...th, textAlign: 'right' }}>Số tiền hoàn</th>
              <th style={th}>Nhận lúc</th>
              <th style={th}>{view === 'REFUNDED' ? 'Đã hoàn' : 'Thao tác'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td style={{ ...td, textAlign: 'center', color: '#94a3b8' }} colSpan={6}>Đang tải...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '2rem' }} colSpan={6}>
                {view === 'REFUND_PENDING' ? 'Không có khoản nào cần hoàn tiền.' : 'Chưa có khoản hoàn tiền nào.'}
              </td></tr>
            ) : filtered.map(r => {
              const [bg, color] = REASON_COLOR[r.reason] || ['#f1f5f9', '#475569'];
              return (
                <tr key={r.id}>
                  <td style={td}>
                    <b style={{ color: '#0f172a' }}>{r.orderId}</b>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Giá trị đơn {fmt(r.orderTotal)}</div>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.customerName || '—'}</div>
                    {r.customerPhone && <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12} /> {r.customerPhone}</div>}
                    {r.customerEmail && <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4, color: '#64748b' }}><Mail size={12} /> {r.customerEmail}</div>}
                  </td>
                  <td style={td}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '5px', fontSize: '0.74rem', fontWeight: 700, backgroundColor: bg, color }}>{r.reason}</span>
                    {r.bankRef && <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>Mã GD nhận: {r.bankRef}</div>}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#b91c1c', whiteSpace: 'nowrap' }}>{fmt(r.amount)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDate(r.receivedAt)}</td>
                  <td style={td}>
                    {r.status === 'REFUNDED' ? (
                      <div style={{ fontSize: '0.78rem' }}>
                        <div style={{ color: '#15803d', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={13} /> {fmtDate(r.refundedAt)}</div>
                        <div style={{ color: '#64748b' }}>bởi {r.refundedBy}</div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setTarget(r); setRefundRef(''); setNote(''); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #16a34a', backgroundColor: '#16a34a', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <CheckCircle size={14} /> Đã hoàn tiền
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {target && (
        <div role="dialog" aria-modal="true" aria-labelledby="refund-dlg-title" onClick={() => !saving && setTarget(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <form onSubmit={submit} onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: '12px', padding: '1.25rem 1.4rem', boxShadow: '0 20px 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 id="refund-dlg-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}><Landmark size={18} /> Xác nhận đã hoàn tiền</h3>
              <button type="button" onClick={() => setTarget(null)} aria-label="Đóng" style={{ border: 0, background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6, backgroundColor: '#f8fafc', borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
              Hoàn <b style={{ color: '#b91c1c' }}>{fmt(target.amount)}</b> cho <b>{target.customerName || 'khách hàng'}</b>{target.customerPhone ? ` (${target.customerPhone})` : ''}<br />
              Đơn {target.orderId} · {target.reason}
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
              Mã giao dịch chuyển trả *
              <input autoFocus required value={refundRef} onChange={e => setRefundRef(e.target.value)} placeholder="VD: FT26282123456"
                style={{ padding: '0.55rem 0.7rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 500 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
              Ghi chú
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="VD: Hoàn về TK Vietcombank của khách"
                style={{ padding: '0.55rem 0.7rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 500 }} />
            </label>
            <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b' }}>Hệ thống sẽ ghi bút toán hoàn tiền vào Sổ Cái, trừ số dư tài khoản đã nhận tiền và ghi vào lịch sử đơn hàng.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => setTarget(null)} disabled={saving} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontWeight: 700, cursor: 'pointer' }}>Hủy</button>
              <button type="submit" disabled={saving || !refundRef.trim()} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 0, backgroundColor: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: saving || !refundRef.trim() ? 0.6 : 1 }}>
                {saving ? 'Đang ghi nhận...' : 'Xác nhận đã hoàn'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
