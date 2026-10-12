import React, { useRef } from 'react';
import { Printer, X, FileText } from 'lucide-react';
import { printDocument } from '../../utils/printDocument';
import { SHOP } from './catalog';

// Hoá đơn bán hàng hiển thị cho khách:
// - sample = true: hoá đơn MẪU (xem trước khi build PC) — có hình mờ "HOÁ ĐƠN MẪU", không đóng dấu.
// - sample = false: hoá đơn của đơn đã đặt/xác nhận thành công — có mộc đỏ của công ty.
// Giá bán trên hệ thống đã gồm VAT 10% nên tiền thuế được tách ngược từ tổng thanh toán.

const VAT_RATE = 0.1;

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const GROUP_UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

const readTriple = (n, full) => {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const out = [];
  if (full || h > 0) out.push(`${DIGITS[h]} trăm`);
  if (t > 1) {
    out.push(`${DIGITS[t]} mươi`);
    if (u === 1) out.push('mốt');
    else if (u === 5) out.push('lăm');
    else if (u > 0) out.push(DIGITS[u]);
  } else if (t === 1) {
    out.push('mười');
    if (u === 5) out.push('lăm');
    else if (u > 0) out.push(DIGITS[u]);
  } else if (u > 0) {
    if (full || h > 0) out.push('lẻ');
    out.push(DIGITS[u]);
  }
  return out.join(' ');
};

/** Đọc số tiền thành chữ tiếng Việt, ví dụ 25.500.000 → "Hai mươi lăm triệu năm trăm nghìn đồng chẵn". */
export const moneyToWords = (value) => {
  let n = Math.round(Math.abs(Number(value) || 0));
  if (n === 0) return 'Không đồng';
  const groups = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const words = [];
  let started = false;
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    words.push(readTriple(groups[i], started), GROUP_UNITS[i]);
    started = true;
  }
  const text = words.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} đồng chẵn`;
};

const fmt = (v) => `${Math.round(Number(v) || 0).toLocaleString('vi-VN')} đ`;

const PAYMENT_LABELS = {
  BANK_TRANSFER: 'Chuyển khoản (VietQR)',
  CASH: 'Tiền mặt khi nhận hàng (COD)',
  COD: 'Tiền mặt khi nhận hàng (COD)',
  CARD: 'Thẻ ngân hàng'
};

/** Con dấu tròn màu đỏ của công ty (SVG, in được, không phụ thuộc ảnh ngoài). */
export function CompanySeal({ size = 150 }) {
  const ring = `${SHOP.legalName} ★ ${SHOP.sealCity} ★ `;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-label="Dấu công ty" role="img"
      style={{ transform: 'rotate(-14deg)', opacity: 0.88, mixBlendMode: 'multiply', display: 'block' }}>
      <defs>
        <path id="aether-seal-ring" d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
      </defs>
      <g fill="none" stroke="#d0021b">
        <circle cx="100" cy="100" r="95" strokeWidth="5" />
        <circle cx="100" cy="100" r="87" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="56" strokeWidth="2" />
      </g>
      <text fill="#d0021b" fontFamily="Arial, Helvetica, sans-serif" fontSize="14.5" fontWeight="700" letterSpacing="1.2">
        <textPath href="#aether-seal-ring" startOffset="0" textLength="458" lengthAdjust="spacing">{ring}</textPath>
      </text>
      <text x="100" y="80" textAnchor="middle" fill="#d0021b" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700">M.S.D.N: {SHOP.taxCode}</text>
      <text x="100" y="107" textAnchor="middle" fill="#d0021b" fontFamily="Arial, sans-serif" fontSize="20" fontWeight="900" letterSpacing="0.5">AETHERPC</text>
      <text x="100" y="128" textAnchor="middle" fill="#d0021b" fontFamily="Arial, sans-serif" fontSize="16">★</text>
    </svg>
  );
}

/**
 * @param {{ open: boolean, onClose: () => void, invoice: {
 *   sample?: boolean, orderId?: string, date?: string|Date, customerName?: string, phone?: string,
 *   email?: string, address?: string, paymentMethod?: string, paid?: boolean,
 *   items: { name: string, category?: string, quantity?: number, price: number }[],
 *   shippingFee?: number, discount?: number, total?: number, note?: string
 * } }} props
 */
export default function InvoiceModal({ open, onClose, invoice }) {
  const docRef = useRef(null);
  if (!open || !invoice) return null;

  const items = (invoice.items || []).filter(Boolean);
  const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
  const shippingFee = Number(invoice.shippingFee) || 0;
  const discount = Number(invoice.discount) || 0;
  const total = invoice.total != null ? Number(invoice.total) : Math.max(0, subtotal + shippingFee - discount);
  const beforeVat = Math.round(total / (1 + VAT_RATE));
  const vat = total - beforeVat;
  const sample = Boolean(invoice.sample);
  const dateObj = invoice.date ? new Date(invoice.date) : new Date();
  const date = Number.isNaN(dateObj.getTime()) ? new Date() : dateObj;
  const invoiceNo = sample ? 'MẪU' : `HD-${String(invoice.orderId || '').replace(/^#/, '')}`;

  const cell = { padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontSize: '13px', verticalAlign: 'top' };
  const head = { ...cell, fontWeight: 700, backgroundColor: '#f1f5f9', borderBottom: '2px solid #0f172a', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase' };
  const sumRow = { display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '3px 0', fontSize: '13px' };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100000001, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '820px' }}>
        <div className="aetherpc-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ color: '#ffffff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} /> {sample ? 'Hoá đơn mẫu cho cấu hình của bạn' : `Hoá đơn đơn hàng #${invoice.orderId}`}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => printDocument(docRef.current, { title: sample ? 'Hoa don mau - AetherPC' : `Hoa don ${invoiceNo} - AetherPC` })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>
              <Printer size={16} /> In / Lưu PDF
            </button>
            <button type="button" onClick={onClose} aria-label="Đóng"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '0.55rem', borderRadius: '8px', border: 'none', backgroundColor: '#ffffff', color: '#0f172a', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div ref={docRef} style={{ position: 'relative', backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '12px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', fontFamily: 'Arial, Helvetica, sans-serif', overflow: 'hidden' }}>
          {sample && (
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ transform: 'rotate(-28deg)', fontSize: '86px', fontWeight: 900, color: 'rgba(220,38,38,0.08)', letterSpacing: '6px', whiteSpace: 'nowrap' }}>HOÁ ĐƠN MẪU</span>
            </div>
          )}

          {/* Đầu hoá đơn */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap', borderBottom: '2px solid #0f172a', paddingBottom: '1rem' }}>
            <div style={{ minWidth: 0, flex: '1 1 300px' }}>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#d70018', letterSpacing: '0.5px' }}>AetherPC</div>
              <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px' }}>{SHOP.legalName}</div>
              <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.6, marginTop: '4px' }}>
                Mã số thuế: {SHOP.taxCode}<br />
                Địa chỉ: {SHOP.address}<br />
                Hotline: {SHOP.hotline} · Email: {SHOP.email}
              </div>
            </div>
            <div style={{ textAlign: 'right', flex: '1 1 220px' }}>
              <div style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase' }}>Hoá đơn bán hàng</div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>(Hoá đơn giá trị gia tăng)</div>
              <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.7, marginTop: '6px' }}>
                Ký hiệu: <strong style={{ color: '#0f172a' }}>1C26TAE</strong><br />
                Số: <strong style={{ color: sample ? '#dc2626' : '#0f172a' }}>{invoiceNo}</strong><br />
                Ngày {String(date.getDate()).padStart(2, '0')} tháng {String(date.getMonth() + 1).padStart(2, '0')} năm {date.getFullYear()}
              </div>
            </div>
          </div>

          {/* Người mua */}
          <div style={{ fontSize: '13px', lineHeight: 1.75, margin: '1rem 0' }}>
            <div>Họ tên người mua: <strong>{invoice.customerName || (sample ? '……………………………………' : 'Khách lẻ')}</strong></div>
            <div>Điện thoại: <strong>{invoice.phone || (sample ? '……………………' : '—')}</strong>{invoice.email ? <> · Email: <strong>{invoice.email}</strong></> : null}</div>
            <div>Địa chỉ giao hàng: <strong>{invoice.address || (sample ? '……………………………………………………………' : '—')}</strong></div>
            <div>Hình thức thanh toán: <strong>{sample ? 'Chọn khi đặt hàng (COD / Chuyển khoản)' : (PAYMENT_LABELS[invoice.paymentMethod] || invoice.paymentMethod || '—')}</strong>
              {!sample && <> · Trạng thái: <strong style={{ color: invoice.paid ? '#16a34a' : '#d97706' }}>{invoice.paid ? 'Đã thanh toán' : 'Thanh toán khi nhận hàng'}</strong></>}
            </div>
          </div>

          {/* Bảng hàng hoá */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
              <thead>
                <tr>
                  <th style={{ ...head, width: '40px', textAlign: 'center' }}>STT</th>
                  <th style={head}>Tên hàng hoá, dịch vụ</th>
                  <th style={{ ...head, width: '60px', textAlign: 'center' }}>SL</th>
                  <th style={{ ...head, width: '120px', textAlign: 'right' }}>Đơn giá</th>
                  <th style={{ ...head, width: '130px', textAlign: 'right' }}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const qty = Number(it.quantity) || 1;
                  return (
                    <tr key={i}>
                      <td style={{ ...cell, textAlign: 'center' }}>{i + 1}</td>
                      <td style={cell}>
                        <div style={{ fontWeight: 600 }}>{it.name}</div>
                        {it.category && <div style={{ fontSize: '11px', color: '#64748b' }}>{it.category}</div>}
                      </td>
                      <td style={{ ...cell, textAlign: 'center' }}>{qty}</td>
                      <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(it.price)}</td>
                      <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{fmt((Number(it.price) || 0) * qty)}</td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={5} style={{ ...cell, textAlign: 'center', color: '#64748b' }}>Chưa có sản phẩm</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Tổng tiền */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <div style={{ width: '100%', maxWidth: '340px' }}>
              <div style={sumRow}><span>Cộng tiền hàng:</span><span>{fmt(subtotal)}</span></div>
              {shippingFee > 0 && <div style={sumRow}><span>Phí vận chuyển:</span><span>{fmt(shippingFee)}</span></div>}
              {discount > 0 && <div style={sumRow}><span>Chiết khấu / khuyến mãi:</span><span style={{ color: '#16a34a' }}>-{fmt(discount)}</span></div>}
              <div style={{ ...sumRow, color: '#475569' }}><span>Tiền trước thuế:</span><span>{fmt(beforeVat)}</span></div>
              <div style={{ ...sumRow, color: '#475569' }}><span>Thuế GTGT (10%):</span><span>{fmt(vat)}</span></div>
              <div style={{ ...sumRow, borderTop: '2px solid #0f172a', marginTop: '4px', paddingTop: '8px', fontSize: '15px' }}>
                <strong>Tổng thanh toán:</strong><strong style={{ color: '#dc2626' }}>{fmt(total)}</strong>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '13px', marginTop: '0.5rem' }}>
            Số tiền viết bằng chữ: <em style={{ fontWeight: 600 }}>{moneyToWords(total)}.</em>
          </div>
          {invoice.note && <div style={{ fontSize: '12px', color: '#475569', marginTop: '0.35rem' }}>Ghi chú: {invoice.note}</div>}

          {/* Chữ ký */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1.75rem', fontSize: '13px', textAlign: 'center' }}>
            <div style={{ flex: 1 }}>
              <strong>Người mua hàng</strong>
              <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</div>
            </div>
            <div style={{ flex: 1, position: 'relative', minHeight: '170px' }}>
              <strong>Người bán hàng</strong>
              <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>(Ký, đóng dấu, ghi rõ họ tên)</div>
              {sample ? (
                <div style={{ marginTop: '2.5rem', fontSize: '12px', color: '#dc2626', fontWeight: 700 }}>Bản xem trước — chưa có giá trị thanh toán</div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.35rem' }}><CompanySeal size={140} /></div>
                  <div style={{ fontWeight: 700, marginTop: '-0.5rem' }}>{SHOP.legalName}</div>
                </>
              )}
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px dashed #cbd5e1', fontSize: '11px', color: '#64748b', textAlign: 'center', lineHeight: 1.6 }}>
            {sample
              ? 'Giá trên hoá đơn mẫu là giá niêm yết tại thời điểm xem, có thể thay đổi theo tồn kho và khuyến mãi khi đặt hàng.'
              : 'Hoá đơn điện tử được khởi tạo từ hệ thống AetherPC. Vui lòng giữ hoá đơn để được hỗ trợ bảo hành, đổi trả.'}
            <br />Cảm ơn quý khách đã tin tưởng và mua sắm tại AetherPC!
          </div>
        </div>
      </div>
    </div>
  );
}
