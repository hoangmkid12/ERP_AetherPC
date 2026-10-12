import React, { useMemo, useRef } from 'react';
import { Printer, X, FileText } from 'lucide-react';
import { printDocument } from '../../utils/printDocument';
import { SHOP } from './catalog';

// Hoá đơn GTGT hiển thị cho khách, trình bày theo bản thể hiện hoá đơn điện tử:
// - stamped = true (mặc định): đơn đã đặt thành công — có mộc đỏ + thông tin ký số của công ty.
// - stamped = false: xem trước khi build PC — giữ nguyên hoá đơn, chỉ để trống vị trí đóng dấu.
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
  BANK_TRANSFER: 'Chuyển khoản',
  CASH: 'Tiền mặt (COD)',
  COD: 'Tiền mặt (COD)',
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

const FONT = '"Times New Roman", Times, serif';
const INK = '#111827';
const LINE = '#4b5563';
const td = { border: `1px solid ${LINE}`, padding: '6px 8px', fontSize: '13.5px', verticalAlign: 'top', color: INK };
const th = { ...td, fontWeight: 700, textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#f3f4f6' };
const idx = { ...td, textAlign: 'center', fontStyle: 'italic', fontSize: '12px', padding: '2px 8px', color: '#4b5563' };
const num = { ...td, textAlign: 'right', whiteSpace: 'nowrap' };
const row = { display: 'flex', gap: '0.35rem', fontSize: '14px', lineHeight: 1.75, color: INK };

/** Một dòng "Nhãn: giá trị"; thiếu giá trị thì để dòng chấm cho khách tự điền như hoá đơn giấy. */
const Field = ({ name, value }) => (
  <div style={row}>
    <span style={{ flexShrink: 0 }}>{name}:</span>
    {value
      ? <strong style={{ fontWeight: 600 }}>{value}</strong>
      : <span style={{ flex: 1, borderBottom: '1px dotted #6b7280', minHeight: '1.2em' }} />}
  </div>
);

/**
 * @param {{ open: boolean, onClose: () => void, invoice: {
 *   stamped?: boolean, orderId?: string, date?: string|Date, customerName?: string, phone?: string,
 *   email?: string, address?: string, paymentMethod?: string,
 *   items: { name: string, unit?: string, quantity?: number, price: number }[],
 *   shippingFee?: number, discount?: number, total?: number, note?: string
 * } }} props
 */
export default function InvoiceModal({ open, onClose, invoice }) {
  const docRef = useRef(null);
  // Số hoá đơn: theo mã đơn nếu có; chưa có đơn (xem trước khi build) thì sinh 1 số cố định cho lần mở này.
  const fallbackNo = useMemo(() => String(Date.now()).slice(-8), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open || !invoice) return null;

  const stamped = invoice.stamped !== false;
  const items = (invoice.items || []).filter(Boolean);
  const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
  const shippingFee = Number(invoice.shippingFee) || 0;
  const discount = Number(invoice.discount) || 0;
  const total = invoice.total != null ? Number(invoice.total) : Math.max(0, subtotal + shippingFee - discount);
  const beforeVat = Math.round(total / (1 + VAT_RATE));
  const vat = total - beforeVat;
  const dateObj = invoice.date ? new Date(invoice.date) : new Date();
  const date = Number.isNaN(dateObj.getTime()) ? new Date() : dateObj;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const invoiceNo = invoice.orderId ? String(invoice.orderId).replace(/^#/, '') : fallbackNo;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100000001, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '840px' }}>
        <div className="aetherpc-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ color: '#ffffff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} /> Hoá đơn {invoice.orderId ? `đơn hàng #${invoice.orderId}` : 'cấu hình PC'}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => printDocument(docRef.current, { title: `Hoa don ${invoiceNo} - AetherPC` })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>
              <Printer size={16} /> In / Lưu PDF
            </button>
            <button type="button" onClick={onClose} aria-label="Đóng"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '0.55rem', borderRadius: '8px', border: 'none', backgroundColor: '#ffffff', color: '#0f172a', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div ref={docRef} style={{ backgroundColor: '#ffffff', color: INK, borderRadius: '6px', padding: '2.25rem 2.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', fontFamily: FONT }}>
          {/* Đầu hoá đơn: logo + ký hiệu, số */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontFamily: '"Be Vietnam Pro", Arial, sans-serif', fontSize: '26px', fontWeight: 800, color: '#d70018', letterSpacing: '-0.5px', lineHeight: 1 }}>
              Aether<span style={{ color: INK }}>PC</span>
            </div>
            <div style={{ fontSize: '14px', lineHeight: 1.7, textAlign: 'right' }}>
              <div>Ký hiệu: <strong>1C26TAE</strong></div>
              <div>Số: <strong style={{ color: '#b91c1c', fontSize: '15px' }}>{invoiceNo}</strong></div>
            </div>
          </div>

          <div style={{ textAlign: 'center', margin: '0.5rem 0 1.25rem' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '0.5px' }}>HOÁ ĐƠN GIÁ TRỊ GIA TĂNG</div>
            <div style={{ fontSize: '13.5px', fontStyle: 'italic', marginTop: '2px' }}>(Bản thể hiện của hoá đơn điện tử)</div>
            <div style={{ fontSize: '14px', fontStyle: 'italic', marginTop: '4px' }}>Ngày {dd} tháng {mm} năm {date.getFullYear()}</div>
          </div>

          {/* Người bán */}
          <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: '0.6rem' }}>
            <div style={row}><span>Đơn vị bán hàng:</span><strong>{SHOP.legalName}</strong></div>
            <div style={row}><span>Mã số thuế:</span><strong style={{ letterSpacing: '1px' }}>{SHOP.taxCode}</strong></div>
            <div style={row}><span>Địa chỉ:</span><span>{SHOP.address}</span></div>
            <div style={{ ...row, flexWrap: 'wrap' }}><span>Điện thoại:</span><span style={{ marginRight: '1.5rem' }}>{SHOP.hotline}</span><span>Email: {SHOP.email}</span></div>
          </div>

          {/* Người mua */}
          <div style={{ borderTop: `1px solid ${LINE}`, marginTop: '0.6rem', padding: '0.6rem 0' }}>
            <Field name="Họ tên người mua hàng" value={invoice.customerName} />
            <div style={{ display: 'flex', columnGap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px' }}><Field name="Điện thoại" value={invoice.phone} /></div>
              <div style={{ flex: '1 1 240px' }}><Field name="Email" value={invoice.email} /></div>
            </div>
            <Field name="Địa chỉ" value={invoice.address} />
            <div style={{ display: 'flex', columnGap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px' }}><Field name="Hình thức thanh toán" value={PAYMENT_LABELS[invoice.paymentMethod] || invoice.paymentMethod || 'TM/CK'} /></div>
              {invoice.orderId && <div style={{ flex: '1 1 240px' }}><Field name="Đơn hàng" value={`#${invoice.orderId}`} /></div>}
            </div>
          </div>

          {/* Bảng hàng hoá */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px', fontFamily: FONT }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: '44px' }}>STT</th>
                  <th style={th}>Tên hàng hoá, dịch vụ</th>
                  <th style={{ ...th, width: '60px' }}>Đơn vị tính</th>
                  <th style={{ ...th, width: '64px' }}>Số lượng</th>
                  <th style={{ ...th, width: '118px' }}>Đơn giá</th>
                  <th style={{ ...th, width: '130px' }}>Thành tiền</th>
                </tr>
                <tr>
                  <td style={idx}>1</td><td style={idx}>2</td><td style={idx}>3</td><td style={idx}>4</td><td style={idx}>5</td><td style={idx}>6 = 4 x 5</td>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const qty = Number(it.quantity) || 1;
                  return (
                    <tr key={i}>
                      <td style={{ ...td, textAlign: 'center' }}>{i + 1}</td>
                      <td style={td}>{it.name}</td>
                      <td style={{ ...td, textAlign: 'center' }}>{it.unit || 'Cái'}</td>
                      <td style={{ ...td, textAlign: 'center' }}>{qty}</td>
                      <td style={num}>{fmt(it.price)}</td>
                      <td style={num}>{fmt((Number(it.price) || 0) * qty)}</td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={6} style={{ ...td, textAlign: 'center', fontStyle: 'italic' }}>Chưa có hàng hoá</td></tr>
                )}
                <tr>
                  <td colSpan={5} style={{ ...td, textAlign: 'right' }}>Cộng tiền hàng (đã gồm thuế GTGT):</td>
                  <td style={num}>{fmt(subtotal)}</td>
                </tr>
                {shippingFee > 0 && (
                  <tr><td colSpan={5} style={{ ...td, textAlign: 'right' }}>Phí vận chuyển:</td><td style={num}>{fmt(shippingFee)}</td></tr>
                )}
                {discount > 0 && (
                  <tr><td colSpan={5} style={{ ...td, textAlign: 'right' }}>Chiết khấu thương mại:</td><td style={num}>-{fmt(discount)}</td></tr>
                )}
                <tr>
                  <td colSpan={3} style={td}>Thuế suất GTGT: <strong>10%</strong></td>
                  <td colSpan={2} style={{ ...td, textAlign: 'right' }}>Tiền hàng chưa thuế:<br />Tiền thuế GTGT:</td>
                  <td style={num}>{fmt(beforeVat)}<br />{fmt(vat)}</td>
                </tr>
                <tr>
                  <td colSpan={5} style={{ ...td, textAlign: 'right', fontWeight: 700, fontSize: '14.5px' }}>Tổng tiền thanh toán:</td>
                  <td style={{ ...num, fontWeight: 700, fontSize: '14.5px', color: '#b91c1c' }}>{fmt(total)}</td>
                </tr>
                <tr>
                  <td colSpan={6} style={td}>Số tiền viết bằng chữ: <strong style={{ fontStyle: 'italic', fontWeight: 600 }}>{moneyToWords(total)}.</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          {invoice.note && <div style={{ fontSize: '13.5px', marginTop: '0.5rem' }}>Ghi chú: {invoice.note}</div>}

          {/* Chữ ký */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1.5rem', fontSize: '14px', textAlign: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Người mua hàng</div>
              <div style={{ fontSize: '12.5px', fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Người bán hàng</div>
              <div style={{ fontSize: '12.5px', fontStyle: 'italic' }}>(Ký, đóng dấu, ghi rõ họ tên)</div>
              {/* Luôn giữ chỗ đóng dấu để bố cục hoá đơn không đổi khi chưa đóng dấu */}
              <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {stamped && <CompanySeal size={138} />}
              </div>
              {stamped && (
                <div style={{ display: 'inline-block', border: '1px solid #16a34a', color: '#15803d', padding: '4px 10px', fontSize: '12px', lineHeight: 1.5, textAlign: 'left' }}>
                  Ký bởi: <strong>{SHOP.legalName}</strong><br />Ký ngày: {dd}/{mm}/{date.getFullYear()}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '0.6rem', borderTop: `1px solid ${LINE}`, fontSize: '12.5px', textAlign: 'center', lineHeight: 1.6 }}>
            <em>(Cần kiểm tra, đối chiếu khi lập, giao, nhận hoá đơn)</em><br />
            Tra cứu hoá đơn, bảo hành tại website AetherPC hoặc hotline {SHOP.hotline}
          </div>
        </div>
      </div>
    </div>
  );
}
