const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../../logs');
if (!fs.existsSync(LOGS_DIR)) {
  try { fs.mkdirSync(LOGS_DIR, { recursive: true }); } catch (e) {}
}
const LOGS_FILE = path.join(LOGS_DIR, 'email_logs.json');

// Helper to save log
const logEmail = (emailData) => {
  try {
    let logs = [];
    if (fs.existsSync(LOGS_FILE)) {
      logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8') || '[]');
    }
    logs.unshift(emailData);
    if (logs.length > 100) logs = logs.slice(0, 100);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('[EmailService] Error writing log file:', err);
  }
};

const getEmailLogs = () => {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8') || '[]');
    }
  } catch (err) {
    console.error('[EmailService] Error reading log file:', err);
  }
  return [];
};

// Map status to Vietnamese friendly label
const STATUS_LABELS = {
  'PENDING': 'Chờ Xử Lý',
  'WAITING_PAYMENT': 'Chờ Thanh Toán',
  'CONFIRMED': 'Đã Xác Nhận & Đủ Hàng',
  'PACKED': 'Đã Đóng Gói',
  'PROCESSING': 'Đang Lắp Ráp / Xử Lý',
  'AWAITING_STOCK': 'Tạm Giữ (Chờ Nhập Hàng)',
  'READY_TO_SHIP': 'Sẵn Sàng Giao Hàng',
  'SHIPPED': 'Đang Vận Chuyển',
  'DELIVERED': 'Đã Giao Hàng Thành Công',
  'COMPLETED': 'Hoàn Tất Đơn Hàng',
  'CANCELLED': 'Đã Hủy Đơn Hàng',
  'FAILED_DELIVERY': 'Giao Thất Bại',
  'RETURN_REQUESTED': 'Yêu Cầu Đổi / Trả',
  'RETURNING': 'Đang Thu Hồi Hàng',
  'RETURNED': 'Đã Nhận Hàng Hoàn',
  'REFUNDED': 'Đã Hoàn Tiền'
};

// 4-stage happy-path tracker. Statuses not covered by any step (cancel/return/
// refund/...) are "exception" statuses — they don't advance a linear bar, so
// they get a standalone status banner instead (see renderExceptionBanner).
const STEP_DEFS = [
  { label: 'Đặt Hàng', statuses: ['PENDING', 'WAITING_PAYMENT', 'CONFIRMED'] },
  { label: 'Chuẩn Bị Hàng', statuses: ['PACKED', 'PROCESSING', 'AWAITING_STOCK', 'READY_TO_SHIP'] },
  { label: 'Vận Chuyển', statuses: ['SHIPPED'] },
  { label: 'Đã Giao', statuses: ['DELIVERED', 'COMPLETED'] }
];
const getStepIndex = (status) => STEP_DEFS.findIndex(step => step.statuses.includes(status));

const STATUS_VISUALS = {
  DEFAULT: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', icon: '🔄' },
  SHIPPING: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', icon: '🚚' },
  DANGER: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: '❌' },
  WARNING: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', icon: '⏳' },
  RETURN: { bg: '#fdf4ff', color: '#a21caf', border: '#f5d0fe', icon: '↩️' }
};
const getStatusVisual = (status) => {
  if (['SHIPPED', 'DELIVERED', 'COMPLETED', 'READY_TO_SHIP'].includes(status)) return STATUS_VISUALS.SHIPPING;
  if (['CANCELLED', 'FAILED_DELIVERY'].includes(status)) return STATUS_VISUALS.DANGER;
  if (['AWAITING_STOCK', 'WAITING_PAYMENT'].includes(status)) return STATUS_VISUALS.WARNING;
  if (['RETURN_REQUESTED', 'RETURNING', 'RETURNED', 'REFUNDED'].includes(status)) return STATUS_VISUALS.RETURN;
  return STATUS_VISUALS.DEFAULT;
};

// Create nodemailer transporter - supports Gmail App Password & generic SMTP
const getTransporter = () => {
  // Option 1: Gmail with App Password (GMAIL_USER + GMAIL_APP_PASSWORD)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') // Remove spaces from App Password
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }
  // Option 2: Generic SMTP (SMTP_HOST + SMTP_USER)
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return null;
};

// Get the sender email address
const getSenderEmail = () => {
  return process.env.GMAIL_USER || process.env.SMTP_USER || 'noreply@aether-erp.vn';
};

/**
 * Unified email sender supporting:
 * 1. Resend HTTP API (HTTPS port 443 - recommended on Railway)
 * 2. Brevo HTTP API (HTTPS port 443 - recommended on Railway)
 * 3. Fallback to Nodemailer SMTP (Note: Railway blocks outbound SMTP ports 465/587)
 */
const dispatchEmail = async ({ toEmail, customerName, subject, html, attachments = [] }) => {
  // Option 1: Resend HTTP API (Port 443 HTTPS)
  if (process.env.RESEND_API_KEY) {
    const fromAddress = process.env.RESEND_FROM || 'AetherPC <onboarding@resend.dev>';
    const resendAttachments = attachments.map(att => ({
      filename: att.filename,
      content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content
    }));

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toEmail],
        subject,
        html,
        ...(resendAttachments.length ? { attachments: resendAttachments } : {})
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Resend API Error: ${data.message || JSON.stringify(data)}`);
    }
    return { provider: 'Resend API', id: data.id };
  }

  // Option 2: Brevo HTTP API (Port 443 HTTPS)
  if (process.env.BREVO_API_KEY) {
    const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER || 'support@aetherpc.site';
    const senderName = process.env.BREVO_SENDER_NAME || 'AetherPC - Hệ Thống ERP';
    const brevoAttachments = attachments.map(att => ({
      name: att.filename,
      content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content
    }));

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY.trim(),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: toEmail, name: customerName || 'Khách hàng' }],
        subject,
        htmlContent: html,
        ...(brevoAttachments.length ? { attachment: brevoAttachments } : {})
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Brevo API Error: ${data.message || JSON.stringify(data)}`);
    }
    return { provider: 'Brevo API', id: data.messageId };
  }

  // Option 3: Fallback to Nodemailer SMTP
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('Chưa cấu hình dịch vụ email (Cần RESEND_API_KEY, BREVO_API_KEY hoặc GMAIL_USER + GMAIL_APP_PASSWORD)');
  }

  const senderEmail = getSenderEmail();
  const info = await transporter.sendMail({
    from: `"AetherPC - Hệ Thống ERP" <${senderEmail}>`,
    to: toEmail,
    subject,
    html,
    attachments
  });
  return { provider: 'Gmail/SMTP', id: info.messageId };
};

const BRAND = {
  siteUrl: 'https://www.aetherpc.site',
  hotline: '1900 6868',
  supportEmail: 'support@aether-erp.vn',
  company: 'AETHER COMPUTER JOINT STOCK COMPANY',
  // Demo/placeholder — swap for the real showroom address & socials before going live.
  showroomAddress: '268 Lý Thường Kiệt, Phường 14, Quận 10, TP. Hồ Chí Minh',
  // No dedicated policy page exists yet — the real storefront footer (Footer.jsx)
  // points "Chính sách đổi trả" at /about too, so mirror that instead of a 404.
  returnPolicyUrl: 'https://www.aetherpc.site/about'
};

const money = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Định dạng ngày giờ chuẩn giờ Việt Nam (GMT+7, Asia/Ho_Chi_Minh)
 * Đảm bảo hiển thị chính xác giờ Việt Nam trên mọi server deploy (Railway, Docker, AWS...)
 */
const formatVietnamDateTime = (date = new Date()) => {
  try {
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    return d.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false
    });
  } catch (err) {
    return new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  }
};
// Product.primaryImage on admin-uploaded items is a relative backend path
// (e.g. "/api/uploads/products/xxx.jpg") — that resolves against nothing (or
// the mail client's own origin) inside an email and shows as a broken image.
// Scraped catalog products already carry a full https:// URL and pass through
// unchanged; only bare "/..." paths get the real site domain prefixed.
const resolveImageUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${BRAND.siteUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

// Shared 600px shell (dark tech header/footer, light content card) used by every
// transactional email — keeps header/footer/brand identity in exactly one place
// instead of duplicated per-template as before.
const renderShell = ({ title, heading, subheading, bodyHtml }) => `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<style>
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  @media only screen and (max-width: 480px) {
    .email-container { width: 100% !important; }
    .outer-pad { padding: 14px 6px !important; }
    .header-pad { padding: 20px 18px 16px 18px !important; }
    .body-pad { padding: 18px 16px 6px 16px !important; }
    .footer-pad { padding: 16px 16px 20px 16px !important; }
    .stack-col { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
    .cta-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; }
    .thumb-cell, .thumb-cell img, .thumb-cell table { width: 44px !important; height: 44px !important; }
    .tracker-circle { width: 22px !important; height: 22px !important; font-size: 10px !important; }
    .tracker-label { font-size: 8.5px !important; min-height: 22px !important; }
  }
  /* Email dark-mode is client-controlled and inconsistent (Outlook ignores this
     entirely) — this only prevents the light content card from being auto-inverted
     into an unreadable state on clients that do honor it (Apple Mail, Gmail app). */
  @media (prefers-color-scheme: dark) {
    .force-light-bg { background-color: #ffffff !important; }
    .force-light-text { color: #0f172a !important; }
  }
</style>
</head>
<body style="margin: 0; padding: 0; background-color: #EEF2F6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #EEF2F6;">
    <tr>
      <td align="center" class="outer-pad" style="padding: 28px 12px;">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="width: 600px; max-width: 600px; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <tr>
            <td class="header-pad" style="background-color: #0F172A; padding: 26px 28px 20px 28px;">
              <div style="font-size: 11px; font-weight: 800; color: #00D2FF; text-transform: uppercase; letter-spacing: 1.6px;">AETHER COMPUTER</div>
              <div style="font-size: 19px; font-weight: 800; color: #ffffff; margin-top: 4px; line-height: 1.3;">${heading}</div>
              ${subheading ? `<div style="font-size: 12.5px; color: #94a3b8; margin-top: 4px;">${subheading}</div>` : ''}
              <div style="font-size: 11px; color: #94a3b8; margin-top: 10px;">☎️ Hotline kỹ thuật / build PC: <strong style="color: #e2e8f0;">${BRAND.hotline}</strong></div>
            </td>
          </tr>
          <tr>
            <td class="force-light-bg body-pad" style="background-color: #ffffff; padding: 26px 26px 8px 26px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td class="force-light-bg footer-pad" style="background-color: #ffffff; border-top: 1px solid #e2e8f0; padding: 20px 26px 26px 26px; text-align: center;">
              <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${BRAND.company}</div>
              <div style="font-size: 11.5px; color: #64748b; line-height: 1.7;">
                Showroom &amp; TT Bảo Hành: ${BRAND.showroomAddress}<br>
                Hotline khẩn cấp: <strong style="color: #0f172a;">${BRAND.hotline}</strong> &nbsp;|&nbsp; Email: <strong style="color: #0f172a;">${BRAND.supportEmail}</strong><br>
                <a href="${BRAND.returnPolicyUrl}" style="color: #2563eb; text-decoration: none; font-weight: 600;">Chính sách đổi trả linh kiện 1-đổi-1</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// Table-based 4-step progress tracker for the happy-path flow.
const renderTracker = (status) => {
  const idx = Math.max(0, getStepIndex(status));
  const stepCells = STEP_DEFS.map((step, i) => {
    const state = i < idx ? 'done' : i === idx ? 'active' : 'pending';
    const circleBg = state === 'pending' ? '#334155' : '#00D2FF';
    const circleText = state === 'pending' ? '#94a3b8' : '#0f172a';
    const labelColor = state === 'pending' ? '#94a3b8' : '#1e293b';
    // 4 step cells @ 22% + 3 connector cells @ 4% = 100% exactly — a previous
    // 25%/4% mix summed to 112% and overflowed the tracker, most visible on
    // narrow phone screens where the table has no slack to absorb the excess.
    // min-height on the label reserves the same vertical space across all 4
    // columns regardless of whether a given label wraps to 1 or 2 lines —
    // without it, a longer label (e.g. "Chuẩn Bị Hàng") makes only its own
    // column taller and the row reads as lopsided, worse on narrow phones
    // where every label is more likely to wrap.
    return `<td align="center" width="22%" class="tracker-cell" style="padding-top: 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;"><tr>
          <td width="26" height="26" align="center" valign="middle" class="tracker-circle" style="width: 26px; height: 26px; border-radius: 50%; background-color: ${circleBg}; font-size: 12px; font-weight: 900; color: ${circleText}; font-family: 'Segoe UI', Arial, sans-serif;">${state === 'done' ? '✓' : i + 1}</td>
        </tr></table>
        <div class="tracker-label" style="font-size: 10px; font-weight: 700; color: ${labelColor}; margin-top: 6px; line-height: 1.3; min-height: 26px;">${step.label}</div>
      </td>`;
  });
  const withConnectors = stepCells.reduce((acc, cell, i) => {
    if (i === 0) return cell;
    const connectorLit = i <= idx;
    return `${acc}<td width="4%" style="padding: 0 2px;"><div style="height: 2px; margin-top: 13px; background-color: ${connectorLit ? '#00D2FF' : '#e2e8f0'};"></div></td>${cell}`;
  }, '');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 20px;">
      <tr><td style="padding: 18px 14px 16px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${withConnectors}</tr></table>
      </td></tr>
    </table>`;
};

// Standalone banner for statuses that don't fit the linear tracker (cancelled,
// returns, refund, failed delivery, ...).
const renderExceptionBanner = (status, note) => {
  const v = getStatusVisual(status);
  const label = STATUS_LABELS[status] || status;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${v.bg}; border: 1px solid ${v.border}; border-radius: 10px; margin-bottom: 20px;">
      <tr><td style="padding: 18px; text-align: center;">
        <div style="font-size: 26px; line-height: 1;">${v.icon}</div>
        <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: ${v.color}; margin-top: 8px;">Trạng Thái Đơn Hàng</div>
        <div style="font-size: 17px; font-weight: 800; color: #0f172a; margin-top: 2px;">${label}</div>
        ${note ? `<div style="font-size: 12.5px; color: #475569; margin-top: 8px; font-style: italic;">"${escapeHtml(note)}"</div>` : ''}
      </td></tr>
    </table>`;
};

// Itemized product table — thumbnail + warranty badge come from Product
// (primaryImage/warranty) when the caller joined it; falls back gracefully to
// an initial-letter swatch and no badge when that data isn't available (e.g.
// the legacy /orders/email-notify path that only has client-side cart items).
const renderItemsTable = (orderId, items) => {
  let list = items || [];
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch (e) { list = []; }
  }
  if (!Array.isArray(list) || list.length === 0) return '';

  const rows = list.map((item, idx) => {
    const name = item.name || item.productName || item.product?.name || `Linh kiện #${item.productId || idx + 1}`;
    const qty = Number(item.quantity || item.qty || 1);
    const unitPrice = Number(item.price || item.unitPrice || 0);
    const lineTotal = Number(item.totalPrice || (unitPrice * qty));
    const imageUrl = resolveImageUrl(item.image || item.product?.primaryImage || item.imageUrl || '');
    const warranty = item.warranty || item.product?.warranty || '';
    const specNote = item.selectedSpec
      ? (typeof item.selectedSpec === 'object' ? Object.values(item.selectedSpec).filter(Boolean).join(' • ') : item.selectedSpec)
      : '';

    // Fallback swatch uses the same light-blue accent family as the warranty
    // badge (not the dark header navy) so a missing product photo doesn't drop
    // a jarring dark square into an otherwise all-light product row.
    const thumbCell = imageUrl
      ? `<img src="${imageUrl}" width="56" height="56" alt="${escapeHtml(name)}" class="thumb-cell" style="display: block; width: 56px; height: 56px; border-radius: 8px; object-fit: cover; border: 1px solid #cbd5e1;">`
      : `<table role="presentation" width="56" height="56" cellpadding="0" cellspacing="0" class="thumb-cell" style="width: 56px; height: 56px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;"><tr><td align="center" valign="middle" style="color: #2563eb; font-size: 18px; font-weight: 800; font-family: 'Segoe UI', Arial, sans-serif;">${escapeHtml((name || '?').charAt(0).toUpperCase())}</td></tr></table>`;

    return `
      <tr>
        <td width="56" valign="top" class="thumb-cell" style="padding: 12px 8px 12px 14px; border-bottom: 1px solid #e2e8f0;">${thumbCell}</td>
        <td valign="top" style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0;">
          <div style="font-size: 13.5px; font-weight: 700; color: #0f172a; line-height: 1.4; word-break: break-word;">${escapeHtml(name)}</div>
          ${specNote ? `<div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">${escapeHtml(specNote)}</div>` : ''}
          ${warranty ? `<div style="display: inline-block; margin-top: 5px; font-size: 10.5px; font-weight: 700; color: #2563eb; background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 2px 6px; border-radius: 4px;">🛡️ Bảo hành ${escapeHtml(warranty)}</div>` : ''}
        </td>
        <td align="center" valign="top" style="padding: 12px 6px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #475569; white-space: nowrap;">x${qty}</td>
        <td align="right" valign="top" style="padding: 12px 14px 12px 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 800; color: #0f172a; white-space: nowrap;">${money(lineTotal)}</td>
      </tr>`;
  }).join('');

  return `
    <div style="font-size: 11.5px; font-weight: 800; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">📦 Danh Sách Linh Kiện (#${escapeHtml(orderId)})</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; margin-bottom: 20px;">
      ${rows}
    </table>`;
};

// Financial breakdown — ensures mathematical consistency between subtotal,
// shipping fee, discount, and total amount.
const renderFinancials = ({ subtotal, shippingFee, discount, totalAmount }) => {
  const rows = [];
  const subVal = Number(subtotal || 0);
  const shipVal = Number(shippingFee || 0);
  let discVal = Number(discount || 0);
  const totVal = Number(totalAmount || (subVal + shipVal - discVal));

  // Đảm bảo tính nhất quán toán học tuyệt đối:
  // Nếu subVal + shipVal == totVal, nghĩa là không có giảm giá checkout bổ sung
  // (tránh hiển thị dòng giảm giá niêm yết cũ gây hiểu lầm phép tính)
  if (Math.abs((subVal + shipVal) - totVal) < 100) {
    discVal = 0;
  } else if (discVal > 0 && Math.abs((subVal + shipVal - discVal) - totVal) > 100) {
    discVal = Math.max(0, subVal + shipVal - totVal);
  }

  if (subtotal !== undefined && subtotal !== null) {
    rows.push(`<tr><td style="color: #64748b; padding: 4px 0;">Tạm tính linh kiện:</td><td style="font-weight: 600; color: #334155; text-align: right;">${money(subVal)}</td></tr>`);
  }
  rows.push(`<tr><td style="color: #64748b; padding: 4px 0;">Phí vận chuyển:</td><td style="font-weight: 700; color: #16a34a; text-align: right;">Miễn phí (0 đ)</td></tr>`);
  if (discVal > 0) {
    rows.push(`<tr><td style="color: #64748b; padding: 4px 0;">Giảm giá / Voucher:</td><td style="font-weight: 700; color: #16a34a; text-align: right;">-${money(discVal)}</td></tr>`);
  }
  rows.push(`<tr style="border-top: 1px dashed #cbd5e1;"><td style="color: #0f172a; padding: 8px 0 0 0; font-weight: 800; font-size: 14px;">Tổng thanh toán:</td><td style="font-weight: 900; color: #0f172a; text-align: right; font-size: 16px; padding-top: 8px;">${money(totVal)}</td></tr>`);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">${rows.join('')}</table>
      </td></tr>
    </table>`;
};

/**
 * Gửi email xác nhận đơn hàng khi khách hàng hoàn tất thanh toán/đặt hàng
 */
const sendOrderConfirmationEmail = async ({ toEmail, customerName, orderId, items, subtotal, discount, totalAmount, paymentMethod, shippingAddress, shippingFee }) => {
  const bodyHtml = `
    <p style="font-size: 14px; color: #0f172a; margin: 0 0 4px 0; line-height: 1.5;">Xin chào <strong>${escapeHtml(customerName || 'Quý khách hàng')}</strong>,</p>
    <p style="font-size: 13.5px; color: #334155; line-height: 1.6; margin: 0 0 18px 0;">
      Đơn hàng <strong>#${escapeHtml(orderId)}</strong> đã được ghi nhận thành công và đang được bộ phận Kho &amp; Bán hàng xử lý.
    </p>

    ${renderTracker('CONFIRMED')}

    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Thông Tin Đơn Hàng</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
        <tr><td style="color: #64748b; padding: 4px 0; width: 42%;">Mã đơn hàng:</td><td style="font-weight: 700; color: #0f172a; text-align: right;">#${escapeHtml(orderId)}</td></tr>
        <tr><td style="color: #64748b; padding: 4px 0;">Thời gian:</td><td style="font-weight: 600; color: #334155; text-align: right;">${formatVietnamDateTime(new Date())}</td></tr>
        <tr><td style="color: #64748b; padding: 4px 0;">Hình thức thanh toán:</td><td style="font-weight: 700; color: #0f172a; text-align: right;">${paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản VietQR' : 'COD (Tiền mặt khi nhận hàng)'}</td></tr>
        <tr><td style="color: #64748b; padding: 4px 0; vertical-align: top;">Địa chỉ giao hàng:</td><td style="font-weight: 600; color: #0f172a; text-align: right; word-break: break-word;">${escapeHtml(shippingAddress || 'TP. Hồ Chí Minh')}</td></tr>
      </table>
    </div>

    ${renderItemsTable(orderId, items)}
    ${renderFinancials({ subtotal, shippingFee, discount, totalAmount })}

    <div style="text-align: center; margin: 22px 0 8px 0;">
      <a href="${BRAND.siteUrl}/my-orders" class="cta-btn" target="_blank" style="display: inline-block; background-color: #00D2FF; color: #0f172a; font-weight: 800; font-size: 13px; padding: 13px 28px; border-radius: 8px; text-decoration: none;">Tra Cứu Đơn Hàng Ngay →</a>
    </div>
  `;

  const html = renderShell({
    title: `Xác nhận đơn hàng #${orderId}`,
    heading: 'XÁC NHẬN ĐƠN HÀNG THÀNH CÔNG',
    subheading: 'Cảm ơn bạn đã mua sắm tại Aether Computer',
    bodyHtml
  });

  const emailData = {
    id: `MAIL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    type: 'ORDER_CONFIRMATION',
    toEmail: toEmail || 'khachhang@gmail.com',
    customerName: customerName || 'Khách hàng',
    orderId,
    subject: `[Aether ERP] Xác nhận đơn hàng thành công #${orderId}`,
    html,
    sentAt: new Date().toISOString()
  };

  logEmail(emailData);

  try {
    const result = await dispatchEmail({
      toEmail: emailData.toEmail,
      customerName: emailData.customerName,
      subject: emailData.subject,
      html
    });
    console.log(`[EmailService] ✅ Gửi email xác nhận đơn hàng #${orderId} tới ${emailData.toEmail} thành công qua ${result.provider}!`);
  } catch (err) {
    console.error(`[EmailService] ❌ Lỗi gửi email xác nhận đơn hàng #${orderId}:`, err.message);
    if (err.message.includes('Connection timeout')) {
      console.error('[EmailService] 💡 Gợi ý: Railway chặn cổng SMTP 465/587. Thêm biến RESEND_API_KEY hoặc BREVO_API_KEY trên Railway để gửi qua cổng HTTPS 443.');
    }
  }

  return emailData;
};

/**
 * Gửi email thông báo cập nhật trạng thái đơn hàng (CONFIRMED, SHIPPED, DELIVERED, CANCELLED,...)
 */
const sendOrderStatusUpdateEmail = async ({ toEmail, customerName, orderId, status, note, items, subtotal, discount, totalAmount, shippingFee, proofPhoto, proofUrl, receiverNote, deliveredTime }) => {
  const statusVN = STATUS_LABELS[status] || status;
  const isDelivered = ['DELIVERED', 'COMPLETED'].includes(status);
  const isException = getStepIndex(status) === -1;

  const rawProofPhoto = proofPhoto || proofUrl || null;
  const hasProof = Boolean(rawProofPhoto);

  // Link ảnh minh chứng công khai HTTPS để Gmail / webmail load qua Google Image Proxy
  const publicProofUrl = `${BRAND.siteUrl}/api/v1/orders/${encodeURIComponent(orderId)}/proof-photo`;
  // Nếu rawProofPhoto là URL ngoài (https://...) thì dùng trực tiếp, nếu là base64 thì dùng public endpoint
  const activeProofPhoto = (rawProofPhoto && /^https?:\/\//i.test(rawProofPhoto)) ? rawProofPhoto : publicProofUrl;
  const isBase64Proof = rawProofPhoto && rawProofPhoto.startsWith('data:');

  // Ngày giờ giao hàng chuẩn giờ Việt Nam GMT+7
  const deliveryTimestamp = formatVietnamDateTime(deliveredTime || new Date());

  const proofSectionHtml = (isDelivered && hasProof) ? `
    <div style="background-color: #f0fdf4; border: 1.5px solid #a7f3d0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
      <div style="font-size: 12px; font-weight: 900; color: #166534; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 12px; border-bottom: 1px dashed #6ee7b7; padding-bottom: 8px;">📸 Minh Chứng Giao Hàng Thành Công</div>
      <div style="text-align: center; margin-bottom: 14px; background: #ffffff; padding: 12px; border-radius: 10px; border: 1px solid #cbd5e1;">
        <a href="${activeProofPhoto}" target="_blank" style="text-decoration: none; display: block;">
          <img src="${activeProofPhoto}" alt="Minh chứng giao hàng #${escapeHtml(orderId)}" style="max-width: 100%; max-height: 320px; border-radius: 8px; object-fit: contain; display: block; margin: 0 auto; border: 1px solid #e2e8f0;">
        </a>
        <div style="font-size: 11px; color: #2563eb; margin-top: 8px; font-weight: 700;">🔍 Nhấp vào ảnh để xem kích thước gốc</div>
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px; background: #ffffff; border-radius: 8px; border: 1px solid #d1fae5;">
        <tr><td style="padding: 8px 12px; color: #64748b; font-weight: 600; width: 42%; border-bottom: 1px solid #f1f5f9;">🕒 Thời gian giao:</td><td style="padding: 8px 12px; color: #0f172a; font-weight: 700; text-align: right; border-bottom: 1px solid #f1f5f9;">${escapeHtml(deliveryTimestamp)}</td></tr>
        <tr><td style="padding: 8px 12px; color: #64748b; font-weight: 600;">👤 Ghi chú người nhận:</td><td style="padding: 8px 12px; color: #15803d; font-weight: 700; text-align: right;">${escapeHtml(receiverNote || note || 'Đã ký nhận và mở hàng kiểm tra nguyên vẹn')}</td></tr>
      </table>
      <p style="font-size: 11.5px; color: #475569; margin: 10px 0 0 0; line-height: 1.5;">💡 Khuyến nghị đồng kiểm/quay video mở hộp và giữ lại minh chứng để đối chiếu khi cần kích hoạt bảo hành điện tử.</p>
    </div>
  ` : '';

  const bodyHtml = `
    <p style="font-size: 14px; color: #0f172a; margin: 0 0 4px 0; line-height: 1.5;">Xin chào <strong>${escapeHtml(customerName || 'Quý khách hàng')}</strong>,</p>
    <p style="font-size: 13.5px; color: #334155; line-height: 1.6; margin: 0 0 18px 0;">Đơn hàng <strong>#${escapeHtml(orderId)}</strong> vừa được cập nhật tiến trình mới nhất:</p>

    ${isException ? renderExceptionBanner(status, note) : renderTracker(status)}
    ${!isException && note ? `<p style="font-size: 12.5px; color: #475569; font-style: italic; margin: -10px 0 20px 0; text-align: center;">"${escapeHtml(note)}"</p>` : ''}

    ${renderItemsTable(orderId, items)}
    ${proofSectionHtml}
    ${renderFinancials({ subtotal, shippingFee, discount, totalAmount })}

    <div style="text-align: center; margin: 22px 0 8px 0;">
      <a href="${BRAND.siteUrl}/my-orders" class="cta-btn" target="_blank" style="display: inline-block; background-color: #00D2FF; color: #0f172a; font-weight: 800; font-size: 13px; padding: 13px 28px; border-radius: 8px; text-decoration: none;">Tra Cứu Vận Đơn →</a>
    </div>
  `;

  const html = renderShell({
    title: `Cập nhật trạng thái đơn hàng #${orderId}`,
    heading: 'CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG',
    subheading: `Mã đơn hàng #${orderId} — ${statusVN}`,
    bodyHtml
  });

  const emailData = {
    id: `MAIL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    type: 'STATUS_UPDATE',
    toEmail: toEmail || 'khachhang@gmail.com',
    customerName: customerName || 'Khách hàng',
    orderId,
    status,
    statusVN,
    subject: `[Aether ERP] Cập nhật trạng thái đơn hàng #${orderId}: ${statusVN}`,
    html,
    sentAt: new Date().toISOString()
  };

  logEmail(emailData);

  try {
    const attachments = [];
    if (isDelivered && isBase64Proof && rawProofPhoto) {
      const matches = rawProofPhoto.match(/^data:image\/(\w+);base64,(.+)$/);
      if (matches) {
        const ext = matches[1].toLowerCase() === 'jpg' ? 'jpeg' : matches[1].toLowerCase();
        const base64Data = matches[2];
        attachments.push({
          filename: `proof_delivery_${orderId}.${ext}`,
          content: Buffer.from(base64Data, 'base64'),
          contentType: `image/${ext}`
        });
      }
    }

    const result = await dispatchEmail({
      toEmail: emailData.toEmail,
      customerName: emailData.customerName,
      subject: emailData.subject,
      html,
      attachments
    });
    console.log(`[EmailService] ✅ Gửi email cập nhật trạng thái #${orderId} → ${statusVN} tới ${emailData.toEmail} thành công qua ${result.provider}!${isBase64Proof ? ' (Kèm ảnh proof CID attachment)' : ''}`);
  } catch (err) {
    console.error('[EmailService] ❌ Lỗi gửi email cập nhật trạng thái:', err.message);
    if (err.message.includes('Connection timeout')) {
      console.error('[EmailService] 💡 Gợi ý: Railway chặn cổng SMTP 465/587. Thêm biến RESEND_API_KEY hoặc BREVO_API_KEY trên Railway để gửi qua cổng HTTPS 443.');
    }
  }

  return emailData;
};

/**
 * Gửi email chào mừng khi khách hàng đăng ký tài khoản thành công
 */
const sendWelcomeEmail = async ({ toEmail, customerName }) => {
  const bodyHtml = `
    <p style="font-size: 14px; color: #0f172a; margin: 0 0 4px 0; line-height: 1.5;">Xin chào <strong>${escapeHtml(customerName || 'Quý khách hàng')}</strong>,</p>
    <p style="font-size: 13.5px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
      Tài khoản thành viên của bạn tại <strong>Aether Computer</strong> đã được khởi tạo thành công. Từ bây giờ bạn có thể mua sắm linh kiện PC chính hãng, theo dõi tiến trình đơn hàng realtime và tích lũy ưu đãi thành viên.
    </p>

    <div style="text-align: center; margin: 22px 0;">
      <a href="${BRAND.siteUrl}" class="cta-btn" target="_blank" style="display: inline-block; background-color: #00D2FF; color: #0f172a; font-weight: 800; font-size: 13px; padding: 13px 28px; border-radius: 8px; text-decoration: none;">Khám Phá Sản Phẩm Ngay →</a>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
      <tr>
        <td class="stack-col" width="33.3%" valign="top" style="padding: 0 6px 12px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
            <tr><td style="padding: 14px 10px; text-align: center;">
              <div style="font-size: 20px;">🛡️</div>
              <div style="font-size: 11px; font-weight: 800; color: #0f172a; margin-top: 6px;">Bảo Hành Điện Tử</div>
              <div style="font-size: 10.5px; color: #64748b; margin-top: 4px; line-height: 1.4;">Tra cứu theo Serial/SN chính hãng</div>
            </td></tr>
          </table>
        </td>
        <td class="stack-col" width="33.3%" valign="top" style="padding: 0 3px 12px 3px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
            <tr><td style="padding: 14px 10px; text-align: center;">
              <div style="font-size: 20px;">🎁</div>
              <div style="font-size: 11px; font-weight: 800; color: #0f172a; margin-top: 6px;">Tích Điểm Đổi Quà</div>
              <div style="font-size: 10.5px; color: #64748b; margin-top: 4px; line-height: 1.4;">1 điểm / 10.000đ, đổi Gear &amp; phụ kiện</div>
            </td></tr>
          </table>
        </td>
        <td class="stack-col" width="33.3%" valign="top" style="padding: 0 0 12px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
            <tr><td style="padding: 14px 10px; text-align: center;">
              <div style="font-size: 20px;">🛠️</div>
              <div style="font-size: 11px; font-weight: 800; color: #0f172a; margin-top: 6px;">Hỗ Trợ Build/Nâng Cấp</div>
              <div style="font-size: 10.5px; color: #64748b; margin-top: 4px; line-height: 1.4;">Tư vấn kỹ thuật trọn đời sản phẩm</div>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const html = renderShell({
    title: 'Chào mừng bạn đến với Aether Computer',
    heading: 'CHÀO MỪNG THÀNH VIÊN MỚI',
    subheading: 'Tài khoản mua sắm của bạn đã được khởi tạo thành công',
    bodyHtml
  });

  const emailData = {
    id: `MAIL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    type: 'WELCOME',
    toEmail: toEmail || 'khachhang@gmail.com',
    customerName: customerName || 'Khách hàng',
    subject: `[Aether ERP] Chào mừng ${customerName || 'thành viên mới'} đến với Aether PC!`,
    html,
    sentAt: new Date().toISOString()
  };

  logEmail(emailData);

  try {
    console.log(`[EmailService] ⏳ Đang gửi email chào mừng tới ${emailData.toEmail}...`);
    const result = await dispatchEmail({
      toEmail: emailData.toEmail,
      customerName: emailData.customerName,
      subject: emailData.subject,
      html
    });
    console.log(`[EmailService] ✅ Gửi email chào mừng thành công tới ${emailData.toEmail} qua ${result.provider}! (ID: ${result.id})`);
  } catch (err) {
    console.error('[EmailService] ❌ Lỗi gửi email chào mừng:', err.message || err);
    if (err.message && err.message.includes('Connection timeout')) {
      console.error('[EmailService] 💡 Gợi ý: Railway chặn kết nối SMTP qua cổng 465/587. Vui lòng thêm biến RESEND_API_KEY hoặc BREVO_API_KEY trên Railway Variables để gửi qua cổng HTTPS 443.');
    }
  }

  return emailData;
};

module.exports = {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendWelcomeEmail,
  getEmailLogs
};
