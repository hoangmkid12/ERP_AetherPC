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

// Create nodemailer transporter - supports Gmail App Password & generic SMTP
const getTransporter = () => {
  // Option 1: Gmail with App Password (GMAIL_USER + GMAIL_APP_PASSWORD)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') // Remove spaces from App Password
      }
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
 * Gửi email xác nhận đơn hàng khi khách hàng hoàn tất thanh toán/đặt hàng
 */
const sendOrderConfirmationEmail = async ({ toEmail, customerName, orderId, items, totalAmount, paymentMethod, shippingAddress }) => {
  const formattedTotal = Number(totalAmount).toLocaleString('vi-VN') + ' đ';
  
  const itemsHtml = (items || []).map((item, idx) => {
    const price = Number(item.price || item.totalPrice || 0);
    const qty = Number(item.quantity || 1);
    const itemTotal = price * qty;
    const bgRow = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    return `
      <tr style="background-color: ${bgRow}; border-bottom: 1px solid #edf2f7;">
        <td style="padding: 12px 10px; color: #0f172a; font-weight: 600; font-size: 13px; line-height: 1.4; word-break: break-word;">
          ${item.name || item.productName || 'Linh kiện máy tính'}
          ${item.selectedSpec ? `<div style="font-size: 11px; color: #64748b; font-weight: normal; margin-top: 2px;">Cấu hình: ${typeof item.selectedSpec === 'object' ? JSON.stringify(item.selectedSpec) : item.selectedSpec}</div>` : ''}
        </td>
        <td style="padding: 12px 6px; text-align: center; color: #475569; font-weight: 700; font-size: 13px; white-space: nowrap;">x${qty}</td>
        <td style="padding: 12px 10px; text-align: right; color: #334155; font-size: 12.5px; white-space: nowrap;">${price.toLocaleString('vi-VN')} đ</td>
        <td style="padding: 12px 10px; text-align: right; color: #2563eb; font-weight: 800; font-size: 13px; white-space: nowrap;">${itemTotal.toLocaleString('vi-VN')} đ</td>
      </tr>
    `;
  }).join('');

  const isFreeshipAddress = shippingAddress && (shippingAddress.toLowerCase().includes('hồ chí minh') || shippingAddress.toLowerCase().includes('hà nội'));
  const shipFeeLabel = isFreeshipAddress ? '<span style="color:#16a34a; font-weight:800;">MIỄN PHÍ</span> <span style="font-size:11px; color:#16a34a;">(Freeship HN & TP.HCM)</span>' : '<span style="color:#0f172a; font-weight:700;">30.000 đ</span> <span style="font-size:11px; color:#64748b;">(Giao tỉnh / ngoại thành)</span>';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Xác nhận đơn hàng #${orderId}</title>
      <style>
        @media only screen and (max-width: 480px) {
          .email-card { border-radius: 8px !important; margin: 0 auto !important; width: 100% !important; }
          .header-banner { padding: 20px 16px !important; }
          .body-content { padding: 16px 14px !important; }
          .summary-table td { padding: 4px 0 !important; font-size: 12.5px !important; }
          .cta-btn { padding: 12px 20px !important; font-size: 13px !important; width: 100% !important; box-sizing: border-box !important; display: block !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 24px 12px; background-color: #f8fafc; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
      <div class="email-card" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15,23,42,0.03);">
        
        <!-- Header: Minimalist & Professional -->
        <div class="header-banner" style="padding: 24px 24px 18px 24px; border-bottom: 2px solid #0f172a; background-color: #ffffff;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
            AETHER COMPUTER ERP
          </div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.3;">
            XÁC NHẬN ĐƠN HÀNG THÀNH CÔNG
          </h1>
          <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Cảm ơn bạn đã mua sắm tại Aether PC</p>
        </div>

        <!-- Body Content -->
        <div class="body-content" style="padding: 24px;">
          
          <p style="font-size: 14px; color: #0f172a; margin-top: 0; line-height: 1.5;">
            Xin chào <strong>${customerName || 'Quý khách hàng'}</strong>,
          </p>
          <p style="font-size: 13.5px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
            Đơn hàng <strong>#${orderId}</strong> đã được ghi nhận thành công và đang được bộ phận Kho &amp; Bán hàng xử lý.
          </p>

          <!-- Order Summary Card -->
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
              Thông Tin Đơn Hàng
            </div>
            <table class="summary-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #64748b; padding: 4px 0; width: 38%;">Mã đơn hàng:</td>
                <td style="font-weight: 700; color: #0f172a; text-align: right;">#${orderId}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Thời gian:</td>
                <td style="font-weight: 600; color: #334155; text-align: right;">${new Date().toLocaleString('vi-VN')}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Hình thức thanh toán:</td>
                <td style="font-weight: 700; color: #0f172a; text-align: right;">
                  ${paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản VietQR' : 'COD (Tiền mặt khi nhận hàng)'}
                </td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Phí vận chuyển:</td>
                <td style="font-weight: 600; color: #0f172a; text-align: right;">${shipFeeLabel}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Địa chỉ nhận hàng:</td>
                <td style="font-weight: 600; color: #0f172a; text-align: right; word-break: break-word;">${shippingAddress || 'TP. Hồ Chí Minh'}</td>
              </tr>
            </table>
          </div>

          <!-- Product Table -->
          <div style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            Danh Sách Sản Phẩm
          </div>
          <div style="border: 1px solid #334155; border-radius: 8px; overflow-x: auto; margin-bottom: 20px; background-color: #ffffff;">
            <table style="width: 100%; border-collapse: collapse; min-width: 100%;">
              <thead>
                <tr style="background-color: #0f172a; color: #ffffff; font-size: 11px; text-transform: uppercase; font-weight: 700; border-bottom: 1px solid #1e293b;">
                  <th style="padding: 8px 10px; text-align: left; color: #ffffff;">Sản phẩm</th>
                  <th style="padding: 8px 6px; text-align: center; width: 35px; color: #ffffff;">SL</th>
                  <th style="padding: 8px 10px; text-align: right; width: 85px; color: #ffffff;">Đơn giá</th>
                  <th style="padding: 8px 10px; text-align: right; width: 95px; color: #ffffff;">Tổng</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>

          <!-- Grand Total Table -->
          <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; margin-bottom: 22px;">
            <tr>
              <td style="padding: 14px 16px; vertical-align: middle;">
                <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">TỔNG CỘNG THANH TOÁN</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">(Đã bao gồm VAT &amp; Phí vận chuyển)</div>
              </td>
              <td style="padding: 14px 16px; text-align: right; vertical-align: middle; white-space: nowrap;">
                <div style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">
                  ${formattedTotal}
                </div>
              </td>
            </tr>
          </table>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 24px 0 8px 0;">
            <a href="http://localhost:3000/my-orders" class="cta-btn" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-weight: 700; font-size: 13px; padding: 12px 26px; border-radius: 8px; text-decoration: none;">
              Tra Cứu Đơn Hàng Ngay →
            </a>
          </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; color: #64748b; font-size: 12px; line-height: 1.6;">
          <p style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a;">AETHER COMPUTER JOINT STOCK COMPANY</p>
          <p style="margin: 0 0 2px 0;">Hotline CSKH: <strong>1900 6868</strong> | Email: <strong>support@aether-erp.vn</strong></p>
        </div>

      </div>
    </body>
    </html>
  `;

  const emailData = {
    id: `MAIL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    type: 'ORDER_CONFIRMATION',
    toEmail: toEmail || 'khachhang@gmail.com',
    customerName: customerName || 'Khách hàng',
    orderId,
    subject: `[Aether ERP] Xác nhận đơn hàng thành công #${orderId}`,
    html: htmlContent,
    sentAt: new Date().toISOString()
  };

  logEmail(emailData);

  const transporter = getTransporter();
  if (transporter) {
    try {
      const senderEmail = getSenderEmail();
      await transporter.sendMail({
        from: `"AetherPC - Hệ Thống ERP" <${senderEmail}>`,
        to: emailData.toEmail,
        subject: emailData.subject,
        html: htmlContent
      });
      console.log(`[EmailService] ✅ Gửi email xác nhận đơn hàng #${orderId} tới ${emailData.toEmail} thành công!`);
    } catch (err) {
      console.error('[EmailService] ❌ Lỗi gửi email:', err.message);
      if (err.message.includes('Invalid login') || err.message.includes('Username and Password')) {
        console.error('[EmailService] Gợi ý: Hãy kiểm tra lại GMAIL_USER và GMAIL_APP_PASSWORD trong file .env');
      }
    }
  } else {
    console.log(`[EmailService] ⚠️ Chưa cài SMTP. Email xác nhận đơn hàng ${orderId} đã được log vào file.`);
  }

  return emailData;
};

/**
 * Gửi email thông báo cập nhật trạng thái đơn hàng (CONFIRMED, SHIPPED, DELIVERED, CANCELLED,...)
 */
const sendOrderStatusUpdateEmail = async ({ toEmail, customerName, orderId, status, note, items, totalAmount, proofPhoto, proofUrl, receiverNote, deliveredTime, shippingFee }) => {
  const statusVN = STATUS_LABELS[status] || status;
  const formattedTotal = totalAmount ? (Number(totalAmount).toLocaleString('vi-VN') + ' đ') : '';

  let statusBg = '#eff6ff';
  let statusColor = '#2563eb';
  let statusBorder = '#bfdbfe';
  let statusIcon = '🔄';

  if (['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(status)) {
    statusBg = '#ecfdf5';
    statusColor = '#059669';
    statusBorder = '#a7f3d0';
    statusIcon = '🚚';
  } else if (['CANCELLED', 'FAILED_DELIVERY'].includes(status)) {
    statusBg = '#fef2f2';
    statusColor = '#dc2626';
    statusBorder = '#fecaca';
    statusIcon = '❌';
  } else if (['AWAITING_STOCK', 'WAITING_PAYMENT'].includes(status)) {
    statusBg = '#fffbe6';
    statusColor = '#d97706';
    statusBorder = '#fef08a';
    statusIcon = '⏳';
  }

  const isDelivered = ['DELIVERED', 'COMPLETED'].includes(status);
  const rawProofPhoto = proofPhoto || proofUrl || null;
  // Kiểm tra nếu ảnh là base64 → sẽ dùng CID attachment thay vì inline base64 (Gmail chặn data: URI)
  const isBase64Proof = rawProofPhoto && rawProofPhoto.startsWith('data:');
  const activeProofPhoto = isBase64Proof ? 'cid:proofimage' : (rawProofPhoto || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80');
  const deliveryTimestamp = deliveredTime || new Date().toLocaleString('vi-VN');

  // Format order items table with enhanced field parsing and fallback
  let orderItems = items || [];
  if (typeof orderItems === 'string') {
    try { orderItems = JSON.parse(orderItems); } catch(e) { orderItems = []; }
  }

  const itemsSubtotal = (orderItems || []).reduce((sum, item) => {
    const rawPrice = item.price || item.unitPrice || item.total || 0;
    const qty = item.quantity || item.qty || item.count || 1;
    return sum + (Number(rawPrice) * Number(qty));
  }, 0);

  const calculatedFee = (totalAmount && itemsSubtotal > 0 && totalAmount > itemsSubtotal) ? (totalAmount - itemsSubtotal) : 0;
  const shippingFeeVal = shippingFee !== undefined ? Number(shippingFee) : calculatedFee;

  let itemsTableHtml = '';
  if (Array.isArray(orderItems) && orderItems.length > 0) {
    const itemsRows = orderItems.map((item, idx) => {
      const pName = item.name || item.title || item.productName || item.product?.name || item.model || `Linh kiện máy tính #${item.productId || idx+1}`;
      const pCat = item.category || item.cat || 'LINH KIỆN PC';
      const rawPrice = item.price || item.unitPrice || item.total || (totalAmount ? totalAmount / orderItems.length : 0);
      const pQty = item.quantity || item.qty || item.count || 1;
      const pTotal = rawPrice ? ((rawPrice * pQty).toLocaleString('vi-VN') + ' đ') : (totalAmount ? (Number(totalAmount).toLocaleString('vi-VN') + ' đ') : 'Liên hệ');
      const bgStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

      return `
        <tr style="background-color: ${bgStyle};">
          <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
            <div style="display: inline-block; background-color: #0f172a; color: #ffffff; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; margin-bottom: 4px;">${pCat}</div>
            <div style="font-weight: 700; color: #0f172a; font-size: 13.5px; line-height: 1.4;">${pName}</div>
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #334155; font-size: 13.5px; text-align: center; vertical-align: middle;">
            x${pQty}
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #0f172a; font-size: 13.5px; text-align: right; vertical-align: middle;">
            ${pTotal}
          </td>
        </tr>
      `;
    }).join('');

    itemsTableHtml = `
      <div style="margin-bottom: 20px; border: 1px solid #334155; border-radius: 10px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #0f172a; border-bottom: 1px solid #1e293b; padding: 12px 16px; font-size: 12px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
          📦 DANH SÁCH SẢN PHẨM TRONG ĐƠN HÀNG (#${orderId})
        </div>
        <table style="width: 100%; border-collapse: collapse; text-align: left; background-color: #ffffff;">
          <thead>
            <tr style="background-color: #1e293b; font-size: 11px; color: #ffffff; text-transform: uppercase;">
              <th style="padding: 10px 14px; font-weight: 800; color: #ffffff;">Tên Sản Phẩm</th>
              <th style="padding: 10px 14px; font-weight: 800; text-align: center; width: 60px; color: #ffffff;">SL</th>
              <th style="padding: 10px 14px; font-weight: 800; text-align: right; width: 120px; color: #ffffff;">Thành Tiền</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
      </div>
    `;
  } else if (totalAmount) {
    itemsTableHtml = `
      <div style="margin-bottom: 20px; border: 1px solid #334155; border-radius: 10px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #0f172a; border-bottom: 1px solid #1e293b; padding: 12px 16px; font-size: 12px; font-weight: 800; color: #ffffff; text-transform: uppercase;">
          📦 THÔNG TIN SẢN PHẨM ĐƠN HÀNG (#${orderId})
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; background-color: #ffffff;">
          <tr style="background-color: #ffffff;">
            <td style="padding: 12px 14px; color: #0f172a; font-weight: 700;">Linh kiện máy tính chính hãng AetherPC (Theo đơn #${orderId})</td>
            <td style="padding: 12px 14px; color: #475569; font-weight: 700; text-align: center;">x1</td>
            <td style="padding: 12px 14px; color: #0f172a; font-weight: 800; text-align: right;">${formattedTotal}</td>
          </tr>
        </table>
      </div>
    `;
  }

  const proofSectionHtml = isDelivered ? `
    <!-- Proof of Delivery Section -->
    <div style="background-color: #f0fdf4; border: 1.5px solid #a7f3d0; border-radius: 14px; padding: 18px; margin-bottom: 20px;">
      <div style="font-size: 12.5px; font-weight: 900; color: #166534; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px; border-bottom: 1px dashed #6ee7b7; padding-bottom: 8px;">
        📸 MINH CHỨNG GIAO HÀNG THÀNH CÔNG (PROOF OF DELIVERY)
      </div>

      <!-- Proof Image Container -->
      <div style="text-align: center; margin-bottom: 14px; background: #ffffff; padding: 10px; border-radius: 12px; border: 1px solid #cbd5e1;">
        <img src="${activeProofPhoto}" alt="Minh chứng giao hàng #${orderId}" style="max-width: 100%; max-height: 280px; border-radius: 8px; object-fit: contain; display: block; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
      </div>

      <!-- Delivery Evidence Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; background: #ffffff; border-radius: 10px; border: 1px solid #d1fae5;">
        <tr>
          <td style="padding: 8px 12px; color: #64748b; font-weight: 600; width: 42%; border-bottom: 1px solid #f1f5f9;">🕒 Thời gian giao:</td>
          <td style="padding: 8px 12px; color: #0f172a; font-weight: 700; text-align: right; border-bottom: 1px solid #f1f5f9;">${deliveryTimestamp}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; color: #64748b; font-weight: 600; border-bottom: 1px solid #f1f5f9;">👤 Ghi chú người nhận:</td>
          <td style="padding: 8px 12px; color: #15803d; font-weight: 700; text-align: right; border-bottom: 1px solid #f1f5f9;">${receiverNote || note || 'Đã ký nhận và mở hàng kiểm tra nguyên vẹn'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; color: #64748b; font-weight: 600;">✔️ Trạng thái kiện hàng:</td>
          <td style="padding: 8px 12px; color: #16a34a; font-weight: 800; text-align: right;">Đã kiểm tra • Nguyên tem niêm phong Aether PC</td>
        </tr>
      </table>
    </div>
  ` : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cập nhật trạng thái đơn hàng #${orderId}</title>
      <style>
        @media only screen and (max-width: 480px) {
          .email-card { border-radius: 8px !important; width: 100% !important; }
          .header-banner { padding: 20px 16px !important; }
          .body-content { padding: 16px 14px !important; }
          .cta-btn { padding: 12px 20px !important; font-size: 13px !important; width: 100% !important; box-sizing: border-box !important; display: block !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 24px 12px; background-color: #f8fafc; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
      <div class="email-card" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15,23,42,0.03);">
        
        <!-- Header: Minimalist & Professional -->
        <div class="header-banner" style="padding: 24px 24px 18px 24px; border-bottom: 2px solid #0f172a; background-color: #ffffff;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
            AETHER COMPUTER ERP
          </div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.3;">
            CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG
          </h1>
          <div style="margin-top: 4px; font-size: 13px; color: #64748b;">Mã đơn hàng: <strong style="color: #0f172a;">#${orderId}</strong></div>
        </div>

        <!-- Body Content -->
        <div class="body-content" style="padding: 24px;">
          
          <p style="font-size: 14px; color: #0f172a; margin-top: 0; line-height: 1.5;">
            Xin chào <strong>${customerName || 'Quý khách hàng'}</strong>,
          </p>
          <p style="font-size: 13.5px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
            Đơn hàng <strong>#${orderId}</strong> vừa được cập nhật tiến trình mới nhất:
          </p>

          <!-- Minimal Status Box -->
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; text-align: center;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b;">Trạng Thái Mới Nhất</div>
            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px;">${statusVN}</div>
            ${note ? `<div style="margin-top: 8px; font-size: 12.5px; color: #475569; font-style: italic;">"${note}"</div>` : ''}
          </div>

          ${itemsTableHtml}

          ${proofSectionHtml}

          <!-- Metadata Box with Shipping Fee Breakdown -->
          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; font-size: 13px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #64748b; padding: 4px 0; width: 45%;">Mã đơn hàng:</td>
                <td style="font-weight: 700; color: #0f172a; text-align: right;">#${orderId}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Thời gian cập nhật:</td>
                <td style="font-weight: 600; color: #334155; text-align: right;">${new Date().toLocaleString('vi-VN')}</td>
              </tr>
              ${itemsSubtotal > 0 ? `
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Tạm tính linh kiện:</td>
                <td style="font-weight: 600; color: #334155; text-align: right;">${itemsSubtotal.toLocaleString('vi-VN')} đ</td>
              </tr>` : ''}
              <tr>
                <td style="color: #64748b; padding: 4px 0;">Phí giao hàng:</td>
                <td style="font-weight: 700; color: ${shippingFeeVal > 0 ? '#0f172a' : '#16a34a'}; text-align: right;">
                  ${shippingFeeVal > 0 ? `+${shippingFeeVal.toLocaleString('vi-VN')} đ` : 'MIỄN PHÍ'}
                </td>
              </tr>
              ${formattedTotal ? `
              <tr style="border-top: 1px dashed #cbd5e1;">
                <td style="color: #0f172a; padding: 8px 0 4px 0; font-weight: 800; font-size: 14px;">Tổng thanh toán:</td>
                <td style="font-weight: 900; color: #0f172a; text-align: right; font-size: 16px; padding-top: 8px;">${formattedTotal}</td>
              </tr>` : ''}
            </table>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 24px 0 8px 0;">
            <a href="http://localhost:3000/my-orders" class="cta-btn" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-weight: 700; font-size: 13px; padding: 12px 26px; border-radius: 8px; text-decoration: none;">
              Xem Chi Tiết Đơn Hàng →
            </a>
          </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; color: #64748b; font-size: 12px; line-height: 1.6;">
          <p style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a;">AETHER COMPUTER JOINT STOCK COMPANY</p>
          <p style="margin: 0 0 2px 0;">Hotline CSKH: <strong>1900 6868</strong> | Email: <strong>support@aether-erp.vn</strong></p>
        </div>

      </div>
    </body>
    </html>
  `;

  const emailData = {
    id: `MAIL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    type: 'STATUS_UPDATE',
    toEmail: toEmail || 'khachhang@gmail.com',
    customerName: customerName || 'Khách hàng',
    orderId,
    status,
    statusVN,
    subject: `[Aether ERP] Cập nhật trạng thái đơn hàng #${orderId}: ${statusVN}`,
    html: htmlContent,
    sentAt: new Date().toISOString()
  };

  logEmail(emailData);

  const transporter = getTransporter();
  if (transporter) {
    try {
      const senderEmail = getSenderEmail();
      // Build mail options với CID attachment nếu ảnh proof là base64
      const mailOptions = {
        from: `"AetherPC - Hệ Thống ERP" <${senderEmail}>`,
        to: emailData.toEmail,
        subject: emailData.subject,
        html: htmlContent
      };
      // Attach ảnh proof dưới dạng CID inline attachment (Gmail hỗ trợ hiển thị)
      if (isDelivered && isBase64Proof && rawProofPhoto) {
        const matches = rawProofPhoto.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1]; // jpeg, png, etc.
          const base64Data = matches[2];
          mailOptions.attachments = [{
            filename: `proof_delivery_${orderId}.${ext}`,
            content: Buffer.from(base64Data, 'base64'),
            cid: 'proofimage',
            contentType: `image/${ext}`
          }];
        }
      }
      await transporter.sendMail(mailOptions);
      console.log(`[EmailService] ✅ Gửi email cập nhật trạng thái #${orderId} → ${statusVN} tới ${emailData.toEmail} thành công!${isBase64Proof ? ' (Kèm ảnh proof CID attachment)' : ''}`);
    } catch (err) {
      console.error('[EmailService] ❌ Lỗi gửi email cập nhật trạng thái:', err.message);
    }
  } else {
    console.log(`[EmailService] ⚠️ Chưa cài SMTP. Email cập nhật trạng thái đơn ${orderId} đã được log.`);
  }

  return emailData;
};

/**
 * Gửi email chào mừng khi khách hàng đăng ký tài khoản thành công
 */
const sendWelcomeEmail = async ({ toEmail, customerName }) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Chào mừng bạn đến với Aether Computer ERP</title>
      <style>
        @media only screen and (max-width: 480px) {
          .email-card { border-radius: 8px !important; width: 100% !important; }
          .header-banner { padding: 20px 16px !important; }
          .body-content { padding: 16px 14px !important; }
          .cta-btn { padding: 12px 20px !important; font-size: 13px !important; width: 100% !important; box-sizing: border-box !important; display: block !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 24px 12px; background-color: #f8fafc; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
      <div class="email-card" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15,23,42,0.03);">
        
        <!-- Header: Minimalist & Professional -->
        <div class="header-banner" style="padding: 24px 24px 18px 24px; border-bottom: 2px solid #0f172a; background-color: #ffffff;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
            AETHER COMPUTER ERP
          </div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.3;">
            CHÀO MỪNG THÀNH VIÊN MỚI
          </h1>
          <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Tài khoản mua sắm của bạn đã được khởi tạo thành công</p>
        </div>

        <!-- Body Content -->
        <div class="body-content" style="padding: 24px;">
          <p style="font-size: 14px; color: #0f172a; margin-top: 0; line-height: 1.5;">
            Xin chào <strong>${customerName || 'Quý khách hàng'}</strong>,
          </p>
          <p style="font-size: 13.5px; color: #334155; line-height: 1.6;">
            Cảm ơn bạn đã đăng ký tài khoản tại <strong>Aether Computer ERP</strong>. Bây giờ bạn có thể trải nghiệm mua sắm linh kiện máy tính cao cấp, tích lũy điểm thưởng thành viên và theo dõi tiến trình đơn hàng realtime.
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; margin: 20px 0;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 8px;">
              Đặc Quyền Thành Viên Của Bạn:
            </div>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #334155; line-height: 1.7;">
              <li>Tích lũy 1 điểm cho mỗi 10.000đ chi tiêu (nâng hạng Bạc, Vàng, Kim Cương).</li>
              <li>Nhận mã giảm giá độc quyền dành riêng cho thành viên.</li>
              <li>Nhận email tự động cập nhật tiến trình đóng gói &amp; giao hàng tức thì.</li>
              <li>Yêu cầu bảo hành &amp; đổi trả 1-click dễ dàng.</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 24px 0 8px 0;">
            <a href="http://localhost:3000" class="cta-btn" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-weight: 700; font-size: 13px; padding: 12px 26px; border-radius: 8px; text-decoration: none;">
              Khám Phá Sản Phẩm Ngay →
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; color: #64748b; font-size: 12px; line-height: 1.6;">
          <p style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a;">AETHER COMPUTER JOINT STOCK COMPANY</p>
          <p style="margin: 0 0 2px 0;">Hotline: <strong>1900 6868</strong> | Email: <strong>support@aether-erp.vn</strong></p>
        </div>

      </div>
    </body>
    </html>
  `;

  const emailData = {
    id: `MAIL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    type: 'WELCOME',
    toEmail: toEmail || 'khachhang@gmail.com',
    customerName: customerName || 'Khách hàng',
    subject: `[Aether ERP] Chào mừng ${customerName || 'thành viên mới'} đến với Aether PC!`,
    html: htmlContent,
    sentAt: new Date().toISOString()
  };

  logEmail(emailData);

  const transporter = getTransporter();
  if (transporter) {
    try {
      const senderEmail = getSenderEmail();
      await transporter.sendMail({
        from: `"AetherPC - Hệ Thống ERP" <${senderEmail}>`,
        to: emailData.toEmail,
        subject: emailData.subject,
        html: htmlContent
      });
      console.log(`[EmailService] ✅ Gửi email chào mừng thành công tới ${emailData.toEmail}`);
    } catch (err) {
      console.error('[EmailService] ❌ Lỗi gửi email chào mừng:', err.message);
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
