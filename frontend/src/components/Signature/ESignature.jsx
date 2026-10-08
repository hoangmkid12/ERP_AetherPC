import React, { useId } from 'react';

// Chữ ký điện tử trên phiếu in: chữ ký dạng viết tay dựng từ họ tên người đã thực hiện bước duyệt, kèm thời điểm và
// mã xác thực của chứng từ; ô của người duyệt cuối có thêm mộc tròn công ty. Đây là chữ ký điện tử hiển thị gắn với
// tài khoản đã đăng nhập thực hiện thao tác (lấy từ lịch sử trạng thái), không phải chữ ký số dùng chứng thư số.

const COMPANY = { ring: 'CÔNG TY AETHERPC', city: 'TP. HỒ CHÍ MINH', center: 'AETHERPC', sub: 'PC & GAMING GEAR' };

// Đọc thời điểm ký: Date, chuỗi ISO, hoặc chuỗi hiển thị kiểu Việt Nam "HH:MM dd/mm/yyyy" / "dd/mm/yyyy HH:MM" / "dd/mm/yyyy"
// (new Date() của trình duyệt hiểu nhầm dd/mm thành mm/dd).
export function parseSignedAt(d) {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d) ? null : d;
  const str = String(d).trim();
  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const t = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    const x = new Date(+m[3], +m[2] - 1, +m[1], t ? +t[1] : 0, t ? +t[2] : 0, t && t[3] ? +t[3] : 0);
    return isNaN(x) ? null : x;
  }
  const x = new Date(str);
  return isNaN(x) ? null : x;
}

const fmt = (d) => {
  if (!d) return '';
  const x = parseSignedAt(d);
  if (!x) return String(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(x.getHours())}:${p(x.getMinutes())} ${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()}`;
};

// Mã xác thực ngắn, cố định theo (chứng từ, người ký, thời điểm) — dùng để đối chiếu với lịch sử chứng từ.
export function signatureCode(docRef, name, signedAt) {
  const t = parseSignedAt(signedAt);
  const str = `${docRef || ''}|${name || ''}|${t ? t.toISOString() : (signedAt || '')}`;
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  const hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

// Họ tên người ký có thể là email/mã nhân viên khi phiếu chỉ lưu định danh đăng nhập — đổi về dạng dễ đọc.
export function displaySigner(raw, fallback = '') {
  const s = String(raw || '').trim();
  if (!s) return fallback;
  if (s.includes('@')) {
    const local = s.split('@')[0].replace(/[._-]+/g, ' ').trim();
    return local ? local.replace(/\b\w/g, (m) => m.toUpperCase()) : fallback;
  }
  return s;
}

/** Bước đầu tiên trong lịch sử trạng thái của chứng từ chuyển sang một trong các trạng thái cho trước → { name, at }. */
export function historySigner(doc, statuses) {
  const list = [...(doc?.statusHistory || [])]
    .filter(h => statuses.includes(h.status || h.toStatus))
    .sort((x, y) => new Date(x.timestamp || x.changedAt || x.createdAt) - new Date(y.timestamp || y.changedAt || y.createdAt));
  const h = list[0];
  return h ? { name: displaySigner(h.changedBy), at: h.timestamp || h.changedAt || h.createdAt } : { name: '', at: null };
}

// Từ ngữ pháp lý/chung trong tên công ty — bỏ đi để chữ ký chỉ còn tên thương hiệu
const COMPANY_WORDS = /^(công|ty|cổ|phần|cp|tnhh|mtv|đầu|tư|công|nghệ|thương|mại|dịch|vụ|sản|xuất|phát|triển|giải|pháp|tập|đoàn|chi|nhánh|văn|phòng|đại|diện|co\.?|co|ltd\.?|ltd|pte|inc\.?|corp\.?|jsc|llc|limited|company|group|việt|nam|vietnam|vn|representative|office|and|&|,|-)$/i;

/** Chữ hiển thị của chữ ký: người → chữ cái đầu của họ + tên (vd "N. An"); công ty → tên thương hiệu (vd "ASUS"). */
export function signatureText(name) {
  const clean = String(name || '').replace(/\([^)]*\)/g, ' ').replace(/[,.]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const words = clean.split(' ');
  const isCompany = words.some(w => /^(công|ty|tnhh|co|ltd|pte|inc|corp|jsc|llc|limited|company)$/i.test(w));
  if (isCompany) {
    const brand = words.filter(w => !COMPANY_WORDS.test(w));
    return (brand.length ? brand : words).slice(0, 2).join(' ');
  }
  if (words.length === 1) return words[0];
  return `${words[0][0]}. ${words[words.length - 1]}`;
}

/** Chữ ký dạng viết tay dựng từ họ tên (nghiêng, có nét lượn), luôn vừa khung nhờ viewBox co giãn. */
export function HandSignature({ name, color = '#1e3a8a', height = 46 }) {
  const text = signatureText(name);
  if (!text) return null;
  const w = Math.max(120, text.length * 15 + 30);
  return (
    <svg viewBox={`0 0 ${w} 60`} height={height} style={{ maxWidth: '100%', overflow: 'visible' }} aria-label={`Chữ ký của ${name}`}>
      <g transform="rotate(-6 60 30)">
        <text x="10" y="38" fill={color} style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive", fontSize: 34, fontWeight: 700 }}>
          {text}
        </text>
        <path d={`M 8 46 C ${w * 0.3} 54, ${w * 0.55} 40, ${w * 0.75} 47 S ${w - 12} 50, ${w - 4} 40`}
          fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Thông tin mộc của một tổ chức: tên chạy quanh vòng, tên thương hiệu ở giữa. */
export function orgSeal(name) {
  const full = String(name || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  const brand = (signatureText(name) || full).toUpperCase();
  // Chữ giữa mộc: tên thương hiệu; quá dài thì giữ trọn từ đầu tiên thay vì cắt ngang chữ
  const center = brand.length > 11 ? brand.split(' ')[0].slice(0, 11) : brand;
  return { ring: full, center, sub: '' };
}

/** Mộc tròn đỏ. Mặc định là mộc AetherPC; truyền ring/center/sub để đóng mộc của tổ chức khác (nhà cung cấp). */
export function CompanySeal({ size = 74, ring, center, sub }) {
  const uid = useId().replace(/:/g, '');
  const red = '#d0202e';
  const isOwn = !ring;
  // Chữ quanh vòng luôn kín một vòng tròn: lặp tên khi quá ngắn, co giãn khi quá dài (textLength)
  let ringText = isOwn ? `${COMPANY.ring} ★ ${COMPANY.city} ★` : `${ring} ★`;
  while (ringText.length < 34) ringText = `${ringText} ${isOwn ? '' : ring + ' ★'}`.trim();
  const centerText = isOwn ? COMPANY.center : center;
  const subText = isOwn ? COMPANY.sub : sub;
  const centerSize = Math.max(8.5, Math.min(14, 96 / Math.max(4, (centerText || '').length)));
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label={`Mộc ${isOwn ? 'AetherPC' : ring}`}
      style={{ opacity: 0.86, mixBlendMode: 'multiply', transform: 'rotate(-12deg)' }}>
      <defs>
        <path id={`ring-${uid}`} d="M 60 60 m -44 0 a 44 44 0 1 1 88 0 a 44 44 0 1 1 -88 0" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke={red} strokeWidth="3.2" />
      <circle cx="60" cy="60" r="35" fill="none" stroke={red} strokeWidth="1.4" />
      <text fill={red} style={{ fontFamily: "'Be Vietnam Pro', Arial, sans-serif", fontSize: 10, fontWeight: 800 }}>
        <textPath href={`#ring-${uid}`} startOffset="0" textLength="268" lengthAdjust="spacingAndGlyphs">{ringText}</textPath>
      </text>
      <text x="60" y={subText ? 57 : 64} textAnchor="middle" fill={red} style={{ fontFamily: "'Be Vietnam Pro', Arial, sans-serif", fontSize: centerSize, fontWeight: 900 }}>{centerText}</text>
      {subText && <text x="60" y="69" textAnchor="middle" fill={red} style={{ fontFamily: "'Be Vietnam Pro', Arial, sans-serif", fontSize: 6.2, fontWeight: 700 }}>{subText}</text>}
    </svg>
  );
}

const S = {
  cell: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 0, padding: '0 4px' },
  title: { fontSize: '0.76rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', lineHeight: 1.3, minHeight: '2.6em', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  note: { fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic', marginTop: 2 },
  area: { position: 'relative', height: 80, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0 2px' },
  seal: { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-6%, -50%)', pointerEvents: 'none' },
  sealSig: { transform: 'translateX(-22%)' },
  meta: { fontSize: '0.6rem', color: '#64748b', lineHeight: 1.35, minHeight: '2.7em' },
  name: { fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginTop: 3, maxWidth: '100%', overflowWrap: 'anywhere', lineHeight: 1.3 },
  pending: { fontSize: '0.72rem', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: 6, padding: '6px 10px', background: '#f8fafc' },
};

/**
 * Một ô ký trên phiếu (chữ ký + mộc). sealName: tên nhà cung cấp → đóng mộc của chính nhà cung cấp đó.
 * @param title      người ký (vd "Thủ kho", "Giám đốc")
 * @param note       ghi chú dưới chức danh, mặc định "(Ký, ghi rõ họ tên)"
 * @param name       họ tên người ký (người đã thực hiện bước tương ứng)
 * @param signed     false → bước chưa thực hiện, hiển thị "Chưa ký"
 * @param seal       true → đóng mộc AetherPC
 * @param supplier   true → ô của nhà cung cấp, đóng mộc mang tên nhà cung cấp
 */
export function SignatureCell({ title, note = '(Ký, ghi rõ họ tên)', name, signed = true, seal = false, supplier = false, sealName, pendingText = 'Chưa ký', color }) {
  const isSigned = signed && !!name;
  const supplierSeal = (sealName || (supplier && name)) ? orgSeal(sealName || name) : null;
  const hasSeal = isSigned && (seal || !!supplierSeal);
  return (
    <div style={S.cell}>
      <div style={S.title}>{title}</div>
      <div style={S.note}>{note}</div>
      <div style={S.area}>
        {isSigned ? (
          <>
            <div style={hasSeal ? S.sealSig : undefined}><HandSignature name={name} color={color} /></div>
            {hasSeal && <div style={S.seal}>{supplierSeal ? <CompanySeal {...supplierSeal} /> : <CompanySeal />}</div>}
          </>
        ) : (
          <span style={S.pending}>{pendingText}</span>
        )}
      </div>
      <div style={S.name}>{isSigned ? name : ' '}</div>
    </div>
  );
}

/** Hàng ô ký: chia đều cột, các ô luôn thẳng hàng và không tràn khi tên dài. */
export function SignatureRow({ children, style }) {
  const n = React.Children.toArray(children).filter(Boolean).length || 1;
  return (
    <div className="esign-row" style={{
      display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 8, alignItems: 'start',
      marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #cbd5e1', breakInside: 'avoid', pageBreakInside: 'avoid', ...style
    }}>
      {children}
    </div>
  );
}

export default SignatureCell;
