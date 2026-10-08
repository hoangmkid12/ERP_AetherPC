import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, Copy, Check, Loader2, AlertTriangle, QrCode, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { fmtVnd } from './catalog';

const POLL_MS = 3000;
const POLL_LIMIT_MS = 20 * 60 * 1000; // ngừng tự kiểm tra sau 20 phút, khách bấm "Kiểm tra lại" nếu cần

// Thanh toán chuyển khoản qua SePay: hiện mã VietQR (đã điền số tiền + nội dung) và tự kiểm tra
// trạng thái đơn mỗi vài giây — khi SePay báo tiền về, máy chủ đánh dấu đã thanh toán và khung
// này chuyển sang "Thanh toán thành công". Không tự đánh dấu đã trả ở phía trình duyệt.
export default function SepayPayment({ orderId, onPaid, compact = false }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [polling, setPolling] = useState(true);
  const startedAt = useRef(Date.now());
  const paidNotified = useRef(false);

  const load = async () => {
    try {
      const res = await api.get(`/payments/sepay/orders/${encodeURIComponent(orderId)}`);
      const data = res?.data || res;
      setInfo(prev => ({ ...prev, ...data }));
      setError('');
      if (data?.paymentStatus === 'PAID') {
        setPolling(false);
        if (!paidNotified.current) { paidNotified.current = true; onPaid?.(data); }
      }
    } catch (err) {
      setError(err.message || 'Không tải được thông tin thanh toán.');
    }
  };

  useEffect(() => {
    if (!orderId) return undefined;
    startedAt.current = Date.now();
    paidNotified.current = false;
    setPolling(true);
    load();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (!polling || !orderId) return undefined;
    const t = setInterval(() => {
      if (Date.now() - startedAt.current > POLL_LIMIT_MS) { setPolling(false); return; }
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, orderId]);

  const copy = (text, key) => {
    navigator.clipboard?.writeText(String(text)).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    }).catch(() => {});
  };

  // Khoản đã chuyển nhưng không dùng để thanh toán đơn (thiếu / dư / trùng): Kế toán sẽ hoàn lại
  const refundsPending = (info?.refunds || []).filter(r => r.status === 'REFUND_PENDING');
  const refundsDone = (info?.refunds || []).filter(r => r.status === 'REFUNDED');
  const sum = (list) => list.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const refundNote = (refundsPending.length > 0 || refundsDone.length > 0) && (
    <div className="sf-sepay-partial">
      {refundsPending.length > 0 && <div>Khoản {fmtVnd(sum(refundsPending))} chưa dùng để thanh toán sẽ được AetherPC hoàn lại vào tài khoản đã chuyển trong 1–3 ngày làm việc.</div>}
      {refundsDone.length > 0 && <div>Đã hoàn lại {fmtVnd(sum(refundsDone))} cho bạn.</div>}
    </div>
  );

  if (info?.paymentStatus === 'PAID') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="sf-sepay sf-sepay-done" role="status">
          <CheckCircle size={40} />
          <div>
            <b>Thanh toán thành công</b>
            <span>AetherPC đã nhận {fmtVnd(info.amount)} cho đơn #{info.orderId}. Đơn hàng đang được xử lý.</span>
          </div>
        </div>
        {refundNote}
      </div>
    );
  }

  // Trả thiếu: khách sửa số tiền khi chuyển — đơn chưa được xác nhận, phải quét lại đúng số tiền
  const underpaid = refundsPending.filter(r => /thiếu/i.test(r.reason || ''));

  if (!info) {
    return (
      <div className="sf-sepay sf-sepay-msg">
        {error ? <><AlertTriangle size={18} /> {error}</> : <><Loader2 size={18} className="spin" /> Đang tạo mã thanh toán...</>}
      </div>
    );
  }

  if (!info.qrUrl) {
    if (info.orderStatus === 'CANCELLED') {
      return (
        <div className="sf-sepay sf-sepay-msg" style={{ color: '#ef4444', backgroundColor: '#fef2f2', borderColor: '#fca5a5' }}>
          <AlertTriangle size={18} /> Đơn hàng #{info.orderId} đã được hủy.
        </div>
      );
    }
    return (
      <div className="sf-sepay sf-sepay-msg">
        <AlertTriangle size={18} /> Đơn #{info.orderId} không ở trạng thái chờ chuyển khoản.
      </div>
    );
  }

  const rows = [
    { key: 'bank', label: 'Ngân hàng', val: info.bankName || info.bank },
    { key: 'acc', label: 'Số tài khoản', val: info.accountNumber, copy: true },
    { key: 'name', label: 'Chủ tài khoản', val: info.accountHolder },
    { key: 'amount', label: 'Số tiền', val: fmtVnd(info.amount), raw: info.amount, copy: true, money: true },
    { key: 'content', label: 'Nội dung', val: info.content, copy: true, strong: true },
  ].filter(r => r.val);

  return (
    <div className={`sf-sepay${compact ? ' is-compact' : ''}`}>
      <div className="sf-sepay-qr">
        <div className="cap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textAlign: 'center', lineHeight: 1.3 }}>
          <QrCode size={16} style={{ flexShrink: 0 }} />
          <span>Quét mã bằng<br />app ngân hàng</span>
        </div>
        <img src={info.qrUrl} alt={`Mã VietQR thanh toán đơn ${info.orderId}`} width="220" height="220" />
      </div>

      <div className="sf-sepay-info">
        {rows.map(r => (
          <div key={r.key} className="row">
            <span>{r.label}</span>
            <span className="v">
              <b className={r.money ? 'money' : r.strong ? 'code' : ''}>{r.val}</b>
              {r.copy && (
                <button type="button" onClick={() => copy(r.raw ?? r.val, r.key)} aria-label={`Sao chép ${r.label.toLowerCase()}`} title="Sao chép">
                  {copied === r.key ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                </button>
              )}
            </span>
          </div>
        ))}
        {underpaid.length > 0 && (
          <div className="sf-sepay-partial" role="alert">
            <b>Chưa đủ số tiền:</b> AetherPC đã nhận {fmtVnd(sum(underpaid))}, chưa đủ {fmtVnd(info.amount)} của đơn hàng nên đơn chưa được xác nhận.
            Khoản {fmtVnd(sum(underpaid))} sẽ được hoàn lại cho bạn trong 1–3 ngày làm việc. Vui lòng quét lại mã QR để thanh toán đúng {fmtVnd(info.amount)}.
          </div>
        )}
        <div className="sf-sepay-status" aria-live="polite">
          {polling
            ? <><Loader2 size={16} className="spin" /> Đang chờ thanh toán — đơn sẽ tự xác nhận khi tiền về tài khoản</>
            : <>
                <AlertTriangle size={16} /> Chưa nhận được thanh toán.
                <button type="button" onClick={() => { startedAt.current = Date.now(); setPolling(true); load(); }}><RefreshCw size={13} /> Kiểm tra lại</button>
              </>}
        </div>
        <p className="sf-sepay-note">Vui lòng giữ nguyên <b>số tiền</b> và <b>nội dung chuyển khoản</b> để đơn hàng được xác nhận tự động.</p>
      </div>
    </div>
  );
}
