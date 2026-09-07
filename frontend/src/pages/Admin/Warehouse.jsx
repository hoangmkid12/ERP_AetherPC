import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInventoryStore, useSalesStore, useFinanceStore, useUtilityStore, useHRStore } from '../../stores';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { useNotification, notify, promptText } from '../../context/NotificationContext';
import { DELIVERY_REGIONS, detectDeliveryRegion } from '../../utils/deliveryRegions';
import { QC_STATUS, getStatusInfo } from '../../utils/statusLabels';
import { api } from '../../services/api';
import { Package, CheckCircle, X, AlertCircle, Truck, RotateCcw, Sparkles, RefreshCw, Box, Image, Plus } from 'lucide-react';
import ActorNotificationBar from '../../components/ActorNotificationBar';
import PackAndScanModal from '../../components/PackAndScanModal';
import OrderDetailModal from '../../components/OrderDetailModal';

const STANDARD_SUPPLIERS = [
  'Intel Vietnam',
  'Mai Hoàng Distribution',
  'Vĩnh Xuân PSC',
  'Viễn Sơn Distribution',
  'Thủy Linh Distribution',
  'ASUS Vietnam',
  'MSI Vietnam',
  'Gigabyte Vietnam',
  'Corsair Vietnam',
  'Kingston Vietnam',
  'Western Digital Vietnam',
  'Samsung Vina',
  'Khác / Nhập nội bộ'
];

const PREDEFINED_LOCATIONS = [
  'ZONE-A/SHELF-01/BIN-01',
  'ZONE-A/SHELF-01/BIN-02',
  'ZONE-B/SHELF-01/BIN-01',
  'ZONE-C/SHELF-02/BIN-01',
  'ZONE-D/SHELF-03/BIN-01'
];

const safeFormatPrice = (amount) => {
  const n = parseFloat(amount) || 0;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
};

const MAX_GALLERY_IMAGES = 8;

// Shared cover-photo + gallery editor for the Add/Edit Product forms — matches how the
// storefront itself presents a product (Product.primaryImage as the cover shown in
// listings, ProductImage rows as the secondary photo strip on the detail page; see
// ProductDetail.jsx's productImages = [cover, ...imageUrls]). `existingImages` (already
// saved, id+url — deletable one at a time via onDeleteExistingImage) and `pendingFiles`
// (chosen this session, not yet uploaded — removable locally, no id yet) render as one
// continuous thumbnail strip so Kho staff see the final gallery order they're building.
const GALLERY_THUMB_SIZE = 88; // same size as the cover box — keeps the two rows visually level

const ProductGalleryField = ({ coverFile, coverUrl, onCoverSelect, existingImages, pendingFiles, onAddFiles, onRemovePendingFile, onDeleteExistingImage, deletingImageId }) => {
  const coverPreview = coverFile ? URL.createObjectURL(coverFile) : coverUrl;
  const totalGalleryCount = (existingImages || []).length + (pendingFiles || []).length;

  // The delete "×" badge sits half outside each thumbnail (top/right: -7px) so it reads
  // as an overlay rather than crowding the photo — the scroll strip needs matching
  // padding on those same sides, or that overlap gets clipped by the strip's own
  // overflow-x: auto (which computes overflow-y to auto too, clipping the badge's top).
  const thumbWrapStyle = { position: 'relative', flexShrink: 0, width: GALLERY_THUMB_SIZE, height: GALLERY_THUMB_SIZE };
  const badgeStyle = (bg) => ({
    position: 'absolute', top: '-7px', right: '-7px', width: '20px', height: '20px', borderRadius: '50%',
    backgroundColor: bg, color: '#ffffff', border: '2px solid #ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
  });

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.6rem', color: '#1e293b' }}>Hình Ảnh Sản Phẩm</label>
      <div style={{ display: 'flex', gap: '1.1rem', alignItems: 'flex-start' }}>
        {/* Cover photo */}
        <div style={{ flexShrink: 0, width: GALLERY_THUMB_SIZE }}>
          <label
            htmlFor="product-cover-input"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              width: GALLERY_THUMB_SIZE, height: GALLERY_THUMB_SIZE, borderRadius: '8px', cursor: 'pointer', overflow: 'hidden',
              border: coverPreview ? '1px solid #cbd5e1' : '2px dashed #cbd5e1',
              backgroundColor: coverPreview ? 'transparent' : '#f8fafc'
            }}
          >
            {coverPreview ? (
              <img src={coverPreview} alt="Ảnh bìa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <>
                <Image size={20} style={{ color: '#94a3b8' }} />
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.25rem', textAlign: 'center', padding: '0 0.3rem' }}>Chọn ảnh</span>
              </>
            )}
          </label>
          <input id="product-cover-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => onCoverSelect(e.target.files?.[0] || null)} style={{ display: 'none' }} />
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textAlign: 'center', marginTop: '0.4rem' }}>Ảnh Bìa</div>
        </div>

        {/* Divider between cover and gallery — makes the "one main photo, several extra
            photos" grouping visually obvious instead of one undifferentiated row. */}
        <div style={{ width: '1px', alignSelf: 'stretch', backgroundColor: '#e2e8f0', flexShrink: 0 }} />

        {/* Gallery strip */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', padding: '7px 7px 0.3rem 2px', margin: '-7px -7px 0 -2px' }}>
            {(existingImages || []).map(img => (
              <div key={img.id} style={thumbWrapStyle}>
                <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                <button
                  type="button"
                  disabled={deletingImageId === img.id}
                  onClick={() => onDeleteExistingImage(img.id)}
                  title="Xoá ảnh này"
                  style={{ ...badgeStyle('#dc2626'), cursor: deletingImageId === img.id ? 'default' : 'pointer', opacity: deletingImageId === img.id ? 0.6 : 1 }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {(pendingFiles || []).map((file, idx) => (
              <div key={`pending-${idx}`} style={thumbWrapStyle}>
                <img src={URL.createObjectURL(file)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid #93c5fd' }} />
                <button type="button" onClick={() => onRemovePendingFile(idx)} title="Bỏ ảnh này" style={badgeStyle('#475569')}>
                  <X size={12} />
                </button>
              </div>
            ))}
            {totalGalleryCount < MAX_GALLERY_IMAGES && (
              <label
                htmlFor="product-gallery-input"
                title="Thêm ảnh phụ"
                style={{
                  flexShrink: 0, width: GALLERY_THUMB_SIZE, height: GALLERY_THUMB_SIZE, borderRadius: '6px', border: '2px dashed #cbd5e1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: '#f8fafc'
                }}
              >
                <Plus size={20} style={{ color: '#94a3b8' }} />
              </label>
            )}
          </div>
          <input
            id="product-gallery-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => { if (e.target.files?.length) onAddFiles(e.target.files); e.target.value = ''; }}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', marginTop: '0.4rem' }}>Ảnh Phụ ({totalGalleryCount}/{MAX_GALLERY_IMAGES})</div>
        </div>
      </div>
    </div>
  );
};

const DEFAULT_SAMPLE_MOVEMENTS = [
  {
    id: 'MOV-2026-001',
    type: 'IN',
    reference: 'GRN-PO-2026-0801',
    productName: 'Intel Core i9-14900K',
    quantity: 15,
    timestamp: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    actor: 'Thủ Kho - Lê Văn C',
    note: 'Nhập kho từ đơn mua #PO-2026-0801 (Nghiệm thu QA/QC Đạt 100%)'
  },
  {
    id: 'MOV-2026-002',
    type: 'IN',
    reference: 'GRN-PO-2026-0802',
    productName: 'ASUS ROG STRIX RTX 4090 24GB',
    quantity: 10,
    timestamp: new Date(Date.now() - 3600000 * 24 * 1.5).toISOString(),
    actor: 'Thủ Kho - Lê Văn C',
    note: 'Nhập kho từ đơn mua #PO-2026-0802'
  },
  {
    id: 'MOV-2026-003',
    type: 'OUT',
    reference: 'ORD-2026-9041',
    productName: 'RAM Corsair Vengeance RGB 32GB DDR5',
    quantity: 2,
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
    actor: 'Thủ Kho - Lê Văn C',
    note: 'Xuất kho giao hàng cho đơn ORD-2026-9041'
  },
  {
    id: 'MOV-2026-004',
    type: 'IN',
    reference: 'DIR-INT-2026-09',
    productName: 'SSD Samsung 990 PRO 2TB NVMe',
    quantity: 20,
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    actor: 'Thủ Kho - Lê Văn C',
    note: 'Nhập kho trực tiếp / Kiểm kê bổ sung dư hàng'
  }
];

const DEFAULT_SAMPLE_RECEIPTS = [
  {
    id: 'GRN-PO-2026-0801',
    receiptNumber: 'GRN-PO-2026-0801',
    poId: 'PO-2026-0801',
    supplierName: 'Intel Vietnam',
    status: 'READY',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    po: {
      id: 'PO-2026-0801',
      poNumber: 'PO-2026-0801',
      status: 'QA_PASSED',
      supplier: { name: 'Intel Vietnam' },
      items: [
        { productId: 101, name: 'Intel Core i9-14900K', quantity: 10, unitCost: 14500000 }
      ]
    }
  },
  {
    id: 'GRN-PO-2026-0802',
    receiptNumber: 'GRN-PO-2026-0802',
    poId: 'PO-2026-0802',
    supplierName: 'Mai Hoàng Distribution',
    status: 'READY',
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    po: {
      id: 'PO-2026-0802',
      poNumber: 'PO-2026-0802',
      status: 'QA_PASSED',
      supplier: { name: 'Mai Hoàng Distribution' },
      items: [
        { productId: 102, name: 'ASUS ROG STRIX RTX 4090 24GB', quantity: 5, unitCost: 48000000 }
      ]
    }
  },
  {
    id: 'GRN-PO-2026-0800',
    receiptNumber: 'GRN-PO-2026-0800',
    poId: 'PO-2026-0800',
    supplierName: 'Vĩnh Xuân PSC',
    status: 'DONE',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    po: {
      id: 'PO-2026-0800',
      poNumber: 'PO-2026-0800',
      status: 'DONE',
      supplier: { name: 'Vĩnh Xuân PSC' },
      items: [
        { productId: 103, name: 'RAM Corsair Vengeance RGB 32GB DDR5', quantity: 20, unitCost: 3200000 }
      ]
    }
  }
];

const DEFAULT_SAMPLE_RETURNS = [
  {
    id: 'RMA-2026-001',
    rmaNumber: 'RMA-2026-001',
    orderId: 'ORD-2026-9035',
    customerName: 'Lê Văn Tuấn',
    productName: 'RAM Corsair Vengeance RGB 32GB DDR5',
    quantity: 1,
    reason: 'Lỗi khe cắm - Khách báo không nhận Bus 6000MHz',
    status: 'PENDING_INSPECTION',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    customerPhone: '0908 123 456'
  },
  {
    id: 'RMA-2026-002',
    rmaNumber: 'RMA-2026-002',
    orderId: 'ORD-2026-8942',
    customerName: 'Nguyễn Hoàng Nam',
    productName: 'ASUS ROG STRIX RTX 4090 24GB',
    quantity: 1,
    reason: 'Quạt tản nhiệt có tiếng rít bất thường khi Full Load',
    status: 'INSPECTED_SCRAP',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    customerPhone: '0912 987 654'
  },
  {
    id: 'RMA-2026-003',
    rmaNumber: 'RMA-2026-003',
    orderId: 'ORD-2026-8810',
    customerName: 'Phạm Minh Trí',
    productName: 'Nguồn Corsair RM1000x 1000W 80 Plus Gold',
    quantity: 1,
    reason: 'Đổi trả do khách đặt nhầm công suất hệ thống',
    status: 'RESTOCKED',
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    customerPhone: '0988 555 222'
  }
];

const parseDateVal = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    if (val.includes('/')) {
      const parts = val.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

const isDateInRange = (dateVal, startDate, endDate) => {
  if (!startDate && !endDate) return true;
  const d = parseDateVal(dateVal);
  if (!d) return true;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const itemYMD = `${yyyy}-${mm}-${dd}`;

  if (startDate && itemYMD < startDate) return false;
  if (endDate && itemYMD > endDate) return false;
  return true;
};

// ──── Sub-Component: Stock Movement Detail Modal ────
function MovementDetailModal({ movement, onClose, formatDateTime }) {
  if (!movement) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        maxWidth: '560px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
        border: '1px solid #cbd5e1',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              Chi Tiết Nhật Ký Điều Chuyển Kho
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Mã chứng từ: <strong style={{ color: '#2563eb' }}>{movement.reference}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', color: '#475569' }}
          >
            Đóng
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', fontSize: '0.85rem', color: '#334155' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.78rem', display: 'block' }}>Mã Giao Dịch</span>
              <strong style={{ color: '#0f172a' }}>{movement.id}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.78rem', display: 'block' }}>Loại Điều Chuyển</span>
              <span style={{
                padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 800,
                backgroundColor: movement.type === 'IN' ? '#dcfce7' : '#ffe4e6',
                color: movement.type === 'IN' ? '#15803d' : '#e11d48'
              }}>
                {movement.type === 'IN' ? 'NHẬP KHO (IN)' : 'XUẤT KHO (OUT)'}
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.78rem', display: 'block' }}>Sản Phẩm</span>
              <strong style={{ color: '#0f172a' }}>{movement.productName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.78rem', display: 'block' }}>Số Lượng Biến Động</span>
              <strong style={{ color: movement.type === 'IN' ? '#16a34a' : '#e11d48', fontSize: '1rem' }}>
                {movement.type === 'IN' ? `+${movement.quantity}` : `-${movement.quantity}`} sản phẩm
              </strong>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.78rem', display: 'block' }}>Thời Gian Thực Hiện</span>
              <span style={{ fontWeight: 600 }}>
                {formatDateTime ? formatDateTime(movement.timestamp) : new Date(movement.timestamp).toLocaleString('vi-VN')}
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.78rem', display: 'block' }}>Người Thực Hiện</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{movement.actor || 'Thủ Kho'}</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b', fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem' }}>Ghi Chú Chi Tiết</span>
            <div style={{ color: '#0f172a', fontWeight: 500 }}>{movement.note || 'Không có ghi chú thêm.'}</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '0.45rem 1.15rem', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ──── Sub-Component: RFQ Alert History Modal ────
function RfqAlertHistoryModal({ show, onClose, logs, formatDateTime }) {
  const [historySearch, setHistorySearch] = useState('');

  if (!show) return null;

  const filteredLogs = (logs || []).filter(log =>
    (log.productName || '').toLowerCase().includes(historySearch.toLowerCase()) ||
    (log.supplier || '').toLowerCase().includes(historySearch.toLowerCase()) ||
    (log.reason || '').toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        maxWidth: '850px',
        width: '100%',
        maxHeight: '90vh',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
        border: '1px solid #cbd5e1',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              Lịch Sử Gửi Cảnh Báo YCBG (RFQ)
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Nhật ký gửi cảnh báo tồn kho tới Bộ Phận Mua Hàng & Ban Giám Đốc
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px',
              padding: '0.3rem 0.6rem', fontSize: '0.85rem', cursor: 'pointer', color: '#475569'
            }}
          >
            Đóng
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ padding: '1rem 1.5rem', backgroundColor: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Tìm theo tên linh kiện, nhà cung cấp, lý do cảnh báo..."
            style={{
              width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.82rem',
              backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a'
            }}
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
          />
        </div>

        {/* Table logs */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          {filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontSize: '0.88rem' }}>
              Chưa có lịch sử cảnh báo RFQ nào được gửi gần đây.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem 0.5rem', width: '18%' }}>Thời Gian</th>
                  <th style={{ padding: '0.6rem 0.5rem', width: '32%' }}>Linh Kiện & Nhà Cung Cấp</th>
                  <th style={{ padding: '0.6rem 0.5rem', width: '14%', textAlign: 'center' }}>Tồn / Ngưỡng</th>
                  <th style={{ padding: '0.6rem 0.5rem', width: '14%', textAlign: 'center' }}>Đề Xuất Mua</th>
                  <th style={{ padding: '0.6rem 0.5rem', width: '22%' }}>Ghi Chú & Người Gửi</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.78rem' }}>
                      {formatDateTime ? formatDateTime(log.sentAt) : new Date(log.sentAt).toLocaleString('vi-VN')}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <strong style={{ color: '#0f172a', display: 'block' }}>{log.productName}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Mã #{log.productId} | NCC: {log.supplier}</span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                        backgroundColor: Number(log.currentStock) === 0 ? '#ffe4e6' : '#fef3c7',
                        color: Number(log.currentStock) === 0 ? '#e11d48' : '#d97706'
                      }}>
                        {log.currentStock} / {log.threshold} SP
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 800, color: '#16a34a', fontSize: '0.9rem' }}>
                      +{log.requestedQty} SP
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#334155' }}>
                      <div style={{ fontSize: '0.78rem', marginBottom: '2px' }}>{log.reason}</div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Bởi: {log.sender}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Tổng số cảnh báo đã ghi nhận: <strong>{filteredLogs.length}</strong> lượt
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '0.45rem 1.15rem', fontSize: '0.82rem', fontWeight: 700,
              color: '#475569', backgroundColor: '#ffffff', border: '1px solid #cbd5e1',
              borderRadius: '6px', cursor: 'pointer'
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ──── Sub-Component: Regional Shipper Dispatch Modal ────
function RegionalShipperModal({
  orderToAssign,
  onClose,
  safeFormatPrice,
  updateOrderStatus,
  sendSystemNotification,
  addNotification,
  orders,
  setOrders
}) {
  const hrEmployees = useHRStore(state => state.employees) || [];
  const storedErpEmps = (() => {
    try { return JSON.parse(localStorage.getItem('erp_employees') || '[]'); } catch (_) { return []; }
  })();

  const rawList = [...hrEmployees, ...storedErpEmps];
  const uniqueEmps = [];
  const seenUsernames = new Set();
  rawList.forEach(e => {
    if (!e) return;
    const u = (e.username || e.name || '').toLowerCase();
    if (u && !seenUsernames.has(u)) {
      seenUsernames.add(u);
      uniqueEmps.push(e);
    }
  });

  const defaultShippers = [
    { id: 15, fullname: 'Nguyễn Văn A', username: 'delivery', phone: '0912.345.678', deliveryRegion: 'HCM_KV1', role: 'DELIVERY' },
    { id: 17, fullname: 'Trần Văn B', username: 'delivery2', phone: '0988.765.432', deliveryRegion: 'HCM_KV2', role: 'DELIVERY' },
    { id: 18, fullname: 'Lê Hoàng Long', username: 'delivery3', phone: '0909.112.233', deliveryRegion: 'HCM_KV3', role: 'DELIVERY' },
    { id: 19, fullname: 'Vũ Đức Thịnh', username: 'delivery4', phone: '0933.445.566', deliveryRegion: 'HCM_KV4', role: 'DELIVERY' },
    { id: 20, fullname: 'Phạm Văn Bắc', username: 'delivery5', phone: '0977.889.900', deliveryRegion: 'HN_NORTH', role: 'DELIVERY' },
    { id: 21, fullname: 'Đặng Quốc Toàn', username: 'delivery6', phone: '0944.556.677', deliveryRegion: 'ALL', role: 'DELIVERY' }
  ];

  defaultShippers.forEach(ds => {
    if (!seenUsernames.has(ds.username)) {
      seenUsernames.add(ds.username);
      uniqueEmps.push(ds);
    }
  });

  const allShippers = uniqueEmps.filter(e => e.role === 'DELIVERY' || e.department === 'Giao Vận');

  const initialRegion = orderToAssign.deliveryRegion || detectDeliveryRegion(orderToAssign.shippingAddress || orderToAssign.address || '');
  const [selectedRegion, setSelectedRegion] = useState(initialRegion);

  const currentRegionObj = DELIVERY_REGIONS.find(r => r.code === selectedRegion) || DELIVERY_REGIONS[0];
  const isHCM = selectedRegion.startsWith('HCM');

  const regionalShippers = allShippers.filter(s => s.deliveryRegion === selectedRegion || s.deliveryRegion === 'ALL');
  const otherShippers = allShippers.filter(s => s.deliveryRegion !== selectedRegion && s.deliveryRegion !== 'ALL');

  const getShipperStatusObj = (shipper) => {
    try {
      const statuses = JSON.parse(localStorage.getItem('erp_shipper_statuses') || '{}');
      if (shipper.id && statuses[shipper.id] !== undefined) return statuses[shipper.id];
      if (shipper.username && statuses[shipper.username] !== undefined) return statuses[shipper.username];
      if (shipper.fullname && statuses[shipper.fullname] !== undefined) return statuses[shipper.fullname];
      if (shipper.name && statuses[shipper.name] !== undefined) return statuses[shipper.name];
    } catch (e) {}
    return { isOnline: true, reason: '' };
  };

  const getShipperWorkload = (shipper) => {
    const statusObj = getShipperStatusObj(shipper);
    const isOnline = statusObj.isOnline !== false;

    const activeCount = (orders || []).filter(o => 
      ['SHIPPED', 'OUT_FOR_DELIVERY', 'ASSIGNED'].includes(o.status) &&
      (
        String(o.assignedShipperId) === String(shipper.id) ||
        String(o.assignedShipperUsername) === String(shipper.username) ||
        (shipper.fullname && String(o.assignedShipper || o.assignedShipperName).includes(shipper.fullname)) ||
        (shipper.name && String(o.assignedShipper || o.assignedShipperName).includes(shipper.name))
      )
    ).length;

    const isOverload = activeCount >= 5;

    let rankScore = 1; // 1: Online & Free, 2: Online & Delivering, 3: Online & Overload, 4: Offline
    let statusText = 'Sẵn Sàng (0 đơn)';
    let badgeBg = '#dcfce7';
    let badgeColor = '#15803d';

    if (!isOnline) {
      rankScore = 4;
      statusText = 'Đã Tắt Nhận Đơn (Tạm nghỉ)';
      badgeBg = '#f1f5f9';
      badgeColor = '#64748b';
    } else if (isOverload) {
      rankScore = 3;
      statusText = `Quá Tải Chuyến (${activeCount} đơn)`;
      badgeBg = '#fee2e2';
      badgeColor = '#dc2626';
    } else if (activeCount > 0) {
      rankScore = 2;
      statusText = `Đang Giao ${activeCount} đơn`;
      badgeBg = '#fef3c7';
      badgeColor = '#b45309';
    }

    return { count: activeCount, isOnline, isOverload, rankScore, statusText, badgeBg, badgeColor, isFree: isOnline && activeCount === 0 };
  };

  // Sắp xếp Shipper theo độ ưu tiên: Người Online & Rảnh nhất lên đầu
  const sortedRegionalShippers = [...regionalShippers].sort((a, b) => {
    const wlA = getShipperWorkload(a);
    const wlB = getShipperWorkload(b);
    if (wlA.rankScore !== wlB.rankScore) return wlA.rankScore - wlB.rankScore;
    return wlA.count - wlB.count;
  });

  const bestShipper = sortedRegionalShippers.length > 0 ? sortedRegionalShippers[0] : null;
  const bestShipperWorkload = bestShipper ? getShipperWorkload(bestShipper) : null;

  const autoTrackingCode = isHCM
    ? `NB-${selectedRegion}-${(orderToAssign.orderId || orderToAssign.id || '').replace(/\D/g, '').slice(-6) || Date.now().toString().slice(-6)}`
    : `3PL-VN-${Date.now().toString().slice(-6)}`;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000, padding: '1rem' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', maxWidth: '640px', width: '100%', border: '1px solid #cbd5e1', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
                Điều Phối Vận Chuyển - Đơn #{orderToAssign.orderId || orderToAssign.id}
              </h3>
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 800, backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                {currentRegionObj.shortName}
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>
              Khách hàng: <strong style={{ color: '#2563eb' }}>{orderToAssign.customerName}</strong> ({orderToAssign.phone || '090xxxxxxx'})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.25rem 0.6rem', cursor: 'pointer', color: '#475569', fontWeight: 600 }}
          >
            Đóng
          </button>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const shipperVal = formData.get('shipperName') || '';
          const trackingCode = formData.get('trackingCode') || autoTrackingCode;
          const deliveryType = formData.get('deliveryType') || (isHCM ? 'INTERNAL_HCM' : 'EXTERNAL_3PL');
          const note = formData.get('note') || '';
          
          let matchedShipperId = null;
          let shipperDisplayName = shipperVal;
          
          // Check if selected is an employee shipper
          const foundEmp = allShippers.find(s => 
            (s.fullname && shipperVal.includes(s.fullname)) ||
            (s.name && shipperVal.includes(s.name)) ||
            (s.username && shipperVal.includes(s.username))
          );
          if (foundEmp) {
            matchedShipperId = foundEmp.id || foundEmp.username;
            shipperDisplayName = `Shipper Nội Bộ - ${foundEmp.fullname || foundEmp.name} (${foundEmp.phone || '0912.xxx.xxx'})`;
          }

          const ordId = String(orderToAssign.orderId || orderToAssign.id || '');

          if (typeof updateOrderStatus === 'function') {
            updateOrderStatus(ordId, 'SHIPPED', `Đã bàn giao cho ${shipperDisplayName} [Mã VĐ: ${trackingCode}] - Khu vực: ${currentRegionObj.shortName}`, {
              assignedShipper: shipperDisplayName,
              assignedShipperId: matchedShipperId,
              assignedShipperUsername: foundEmp?.username || (typeof matchedShipperId === 'string' ? matchedShipperId : null),
              assignedShipperName: foundEmp?.fullname || foundEmp?.name || shipperDisplayName,
              deliveryRegion: selectedRegion,
              trackingCode: trackingCode,
              deliveryType: deliveryType,
              shippingNote: note,
              shippedAt: new Date().toISOString()
            });
          } else {
            const updatedOrders = orders.map(o => {
              if ((o.orderId && o.orderId === ordId) || o.id === ordId || String(o.id) === String(orderToAssign.id)) {
                return {
                  ...o,
                  status: 'SHIPPED',
                  deliveryStatus: 'SHIPPED',
                  assignedShipper: shipperDisplayName,
                  assignedShipperId: matchedShipperId,
                  assignedShipperUsername: foundEmp?.username || (typeof matchedShipperId === 'string' ? matchedShipperId : null),
                  assignedShipperName: foundEmp?.fullname || foundEmp?.name || shipperDisplayName,
                  deliveryRegion: selectedRegion,
                  trackingCode: trackingCode,
                  deliveryType: deliveryType,
                  shippingNote: note,
                  shippedAt: new Date().toISOString(),
                  lastNote: `Đã bàn giao cho ${shipperDisplayName}. Mã tra cứu: ${trackingCode}`
                };
              }
              return o;
            });
            if (typeof setOrders === 'function') {
              setOrders(updatedOrders);
            }
            try { localStorage.setItem('erp_orders', JSON.stringify(updatedOrders)); } catch (_) {}
          }

          if (sendSystemNotification) {
            sendSystemNotification({
              targetRoles: ['DELIVERY', 'SALES', 'CUSTOMER'],
              title: `Đã Bàn Giao Vận Chuyển Đơn #${ordId}`,
              message: `Đơn hàng đã bàn giao cho ${shipperDisplayName} (${currentRegionObj.shortName} - Mã VĐ: ${trackingCode}) xuất phát đi giao.`,
              type: 'INFO'
            });
          }

          if (typeof addNotification === 'function') {
            addNotification(`Điều phối vận chuyển thành công! Đơn hàng #${ordId} [${currentRegionObj.shortName}] đã chuyển giao cho ${shipperDisplayName}.`, 'success');
          }

          onClose();
        }} style={{ padding: '1.5rem', overflowY: 'auto' }}>
          
          {/* Detected Region Indicator & Selector */}
          <div style={{
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            backgroundColor: '#eff6ff',
            border: '1.5px solid #bfdbfe'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>Khu Vực Giao Hàng Phân Bổ:</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: '0.15rem' }}>
                  Hệ thống tự động nhận diện từ địa chỉ nhận hàng của khách.
                </div>
              </div>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid #93c5fd', backgroundColor: '#ffffff', fontSize: '0.78rem', fontWeight: 700, color: '#1e40af' }}
              >
                {DELIVERY_REGIONS.map(r => (
                  <option key={r.code} value={r.code}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Gợi ý cân bằng tải thông minh */}
          {bestShipper && (
            <div style={{
              padding: '0.65rem 0.9rem',
              backgroundColor: bestShipperWorkload?.isFree ? '#f0fdf4' : '#f8fafc',
              border: `1.5px solid ${bestShipperWorkload?.isFree ? '#86efac' : '#cbd5e1'}`,
              borderRadius: '8px',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.4rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Đề xuất cân bằng tải khu vực:</span>{' '}
                  <strong style={{ color: '#0f172a' }}>{bestShipper.fullname}</strong>{' '}
                  <span style={{ color: bestShipperWorkload?.badgeColor, fontWeight: 700 }}>
                    ({bestShipperWorkload?.statusText})
                  </span>
                </div>
              </div>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                backgroundColor: bestShipperWorkload?.badgeBg,
                color: bestShipperWorkload?.badgeColor,
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1'
              }}>
                {bestShipperWorkload?.isFree ? 'ƯU TIÊN #1 (RẢNH RỖI)' : 'PHÙ HỢP TUYẾN'}
              </span>
            </div>
          )}

          {/* Order Summary */}
          <div style={{ backgroundColor: '#f8fafc', padding: '0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', color: '#475569' }}>
              <div style={{ gridColumn: 'span 2' }}>Địa chỉ giao: <strong style={{ color: '#0f172a' }}>{orderToAssign.shippingAddress || orderToAssign.address || 'TP.HCM'}</strong></div>
              <div>Thu hộ COD: <strong style={{ color: '#16a34a' }}>{safeFormatPrice(orderToAssign.totalAmount || orderToAssign.total || 0)}</strong></div>
              <div>Hình thức: <strong style={{ color: '#0f172a' }}>{orderToAssign.paymentMethod || 'COD'}</strong></div>
              <div>Đóng gói: <strong style={{ color: '#2563eb' }}>{orderToAssign.packedSerials?.length || 1} linh kiện đã niêm phong</strong></div>
              <div>Khu vực vận chuyển: <strong style={{ color: '#d97706' }}>{currentRegionObj.shortName}</strong></div>
            </div>
          </div>

          {/* Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.75rem', alignItems: 'start' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem', whiteSpace: 'nowrap' }}>
                  Nhân Viên / Đơn Vị Giao Hàng *
                </label>
                <select
                  name="shipperName"
                  key={selectedRegion}
                  defaultValue={
                    bestShipper 
                      ? `Shipper Nội Bộ - ${bestShipper.fullname} (${bestShipper.phone || '0912.xxx.xxx'})`
                      : (sortedRegionalShippers.length > 0 
                          ? `Shipper Nội Bộ - ${sortedRegionalShippers[0].fullname} (${sortedRegionalShippers[0].phone || '0912.xxx.xxx'})`
                          : 'Đối Tác Giao Hàng Tiết Kiệm (GHTK Express)')
                  }
                  style={{ width: '100%', padding: '0.6rem 0.75rem', fontSize: '0.82rem', fontWeight: 600, border: '1.5px solid #2563eb', borderRadius: '6px', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                >
                  {/* Regional matched Shippers sorted by best priority */}
                  <optgroup label={`Shipper Khu Vực Này (${currentRegionObj.shortName})`}>
                    {sortedRegionalShippers.length > 0 ? (
                      sortedRegionalShippers.map(s => {
                        const wl = getShipperWorkload(s);
                        return (
                          <option
                            key={s.id || s.username}
                            value={`Shipper Nội Bộ - ${s.fullname} (${s.phone || '0912.xxx.xxx'})`}
                            style={{ color: wl.isOnline && !wl.isOverload ? '#0f172a' : '#64748b' }}
                          >
                            ★ {s.fullname} ({s.phone || '09xx.xxx.xxx'}) — [{wl.statusText}]
                          </option>
                        );
                      })
                    ) : (
                      <option disabled value="">(Chưa có shipper chuyên trách khu vực này)</option>
                    )}
                  </optgroup>

                  {/* Other regional Shippers */}
                  {otherShippers.length > 0 && (
                    <optgroup label="Shipper Các Khu Vực Khác (Điều Phối Chéo)">
                      {otherShippers.map(s => {
                        const sReg = DELIVERY_REGIONS.find(r => r.code === s.deliveryRegion);
                        const wl = getShipperWorkload(s);
                        return (
                          <option key={s.id || s.username} value={`Shipper Nội Bộ - ${s.fullname} (${s.phone || '0912.xxx.xxx'})`}>
                            {s.fullname} ({s.phone || '09xx.xxx.xxx'}) — [Gốc: {sReg?.shortName || s.deliveryRegion}] — [{wl.statusText}]
                          </option>
                        );
                      })}
                    </optgroup>
                  )}

                  {/* 3PL Partners */}
                  <optgroup label="Đối Tác Vận Chuyển Liên Tỉnh (3PL Logistics)">
                    <option value="Đối Tác Giao Hàng Tiết Kiệm (GHTK Express)">Đối Tác Giao Hàng Tiết Kiệm (GHTK Express) [Khuyên dùng liên tỉnh]</option>
                    <option value="Đối Tác Giao Hàng Nhanh (GHN Express)">Đối Tác Giao Hàng Nhanh (GHN Express) [Lấy hàng 15-30p]</option>
                    <option value="Đối Tác Viettel Post">Đối Tác Viettel Post [Phủ 100% huyện xã]</option>
                    <option value="Đối Tác VNPost (Bưu Điện Việt Nam)">Đối Tác VNPost (Bưu Điện Việt Nam)</option>
                  </optgroup>
                </select>
                <div style={{ fontSize: '0.71rem', color: '#64748b', marginTop: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.2rem' }}>
                  <span>✓ Gán trực tiếp vào app Shipper</span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>Rảnh • Giao • Bận • Tắt</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem', whiteSpace: 'nowrap' }}>
                  Mã Vận Đơn
                </label>
                <input
                  type="text"
                  name="trackingCode"
                  defaultValue={autoTrackingCode}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', fontSize: '0.82rem', fontWeight: 700, color: '#2563eb', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#f8fafc', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                Ghi Chú Giao Hàng Cho Shipper / Đơn Vị Vận Chuyển
              </label>
              <textarea
                name="note"
                rows={2}
                defaultValue={isHCM ? `Giao khu vực ${currentRegionObj.shortName}, gọi khách trước 15 phút` : 'Hàng linh kiện điện tử giá trị cao, bảo quản cẩn thận, cho khách đồng kiểm ngoại quan'}
                style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.55rem 1.15rem', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', color: '#475569', cursor: 'pointer' }}
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              style={{ padding: '0.55rem 1.35rem', fontSize: '0.82rem', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#ffffff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Truck size={15} /> Xác Nhận Phân Công & Bàn Giao
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──── Sub-Component: RFQ Alert Confirmation Modal ────
function RfqAlertModal({ rfqModalData, setRfqModalData, sendSystemNotification, setRfqAlertLogs }) {
  if (!rfqModalData || !rfqModalData.item) return null;
  const { item, qty, reason } = rfqModalData;

  const handleConfirm = () => {
    const finalQty = Number(qty);
    if (!finalQty || finalQty <= 0) {
      notify('Vui lòng nhập số lượng đề xuất hợp lệ (lớn hơn 0).', 'error');
      return;
    }

    const newLog = {
      id: 'RFQ-ALT-' + Date.now(),
      sentAt: new Date().toISOString(),
      sender: 'Thủ kho',
      productId: item.id,
      productName: item.name,
      category: item.category,
      supplier: item.supplier,
      currentStock: item.stock,
      threshold: item.threshold || 5,
      requestedQty: finalQty,
      reason: reason
    };

    try {
      const existingLogs = JSON.parse(localStorage.getItem('erp_rfq_alert_logs') || '[]');
      const updatedLogs = [newLog, ...existingLogs];
      localStorage.setItem('erp_rfq_alert_logs', JSON.stringify(updatedLogs));
      if (setRfqAlertLogs) setRfqAlertLogs(updatedLogs);
    } catch (e) {}

    if (sendSystemNotification) {
      sendSystemNotification({
        targetRoles: ['PURCHASING', 'CEO', 'ADMIN'],
        title: `Cảnh Báo Kho: ${item.name}`,
        message: `Kho báo linh kiện ${item.name} hiện còn ${item.stock} cái (Ngưỡng: ${item.threshold || 5}). Đề xuất mua ${finalQty} cái. Lý do: ${reason}`,
        link: '/admin/purchasing',
        navState: { createRFQ: true, product: item, quantity: finalQty, reason: reason },
        type: 'RFQ_ALERT',
        itemData: { ...item, requestedQty: finalQty, alertReason: reason }
      });
    }

    setRfqModalData(null);

    notify(
      `GỬI CẢNH BÁO RFQ THÀNH CÔNG!\n\n` +
      `• Linh kiện: ${item.name}\n` +
      `• Số lượng đề xuất mua: ${finalQty} sản phẩm\n` +
      `• Ghi chú / Lý do: ${reason}\n` +
      `• Đơn vị tiếp nhận: Bộ phận Mua Hàng & Ban Giám Đốc\n\n` +
      `Cảnh báo Yêu cầu Báo giá đã được ghi nhận trực tiếp vào Lịch sử và Quả chuông Thông báo Hệ thống!`,
      'success'
    );
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        maxWidth: '560px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
        border: '1px solid #cbd5e1',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              Xác Nhận Gửi Cảnh Báo RFQ
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Khởi tạo đề xuất mua sắm cho Bộ Phận Mua Hàng
            </p>
          </div>
          <button
            onClick={() => setRfqModalData(null)}
            style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer' }}
          >
            Đóng
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
            <strong style={{ fontSize: '0.95rem', color: '#0f172a', display: 'block', marginBottom: '0.5rem' }}>{item.name}</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', color: '#475569' }}>
              <div>• Mã SP: <strong style={{ color: '#0f172a' }}>#{item.id}</strong></div>
              <div>• Phân nhóm: <strong style={{ color: '#0f172a' }}>{item.category}</strong></div>
              <div>• Nhà cung cấp: <strong style={{ color: '#0f172a' }}>{item.supplier}</strong></div>
              <div>• Ngưỡng an toàn: <strong style={{ color: '#0f172a' }}>{item.threshold || 5} SP</strong></div>
            </div>
            <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Tồn kho hiện tại:</span>
              <span style={{
                padding: '3px 10px',
                borderRadius: '4px',
                fontSize: '0.78rem',
                fontWeight: 700,
                backgroundColor: Number(item.stock) === 0 ? '#ffe4e6' : '#fef3c7',
                color: Number(item.stock) === 0 ? '#e11d48' : '#d97706'
              }}>
                {Number(item.stock) === 0 ? 'Hết hàng (0 SP)' : `Cảnh báo tồn (${item.stock} SP)`}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                Số lượng đề xuất mua (Sản phẩm) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => {
                  const val = e.target.value;
                  setRfqModalData(prev => ({ ...prev, qty: val }));
                }}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                Lý do cảnh báo / Ghi chú cho Bộ Phận Mua Hàng
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setRfqModalData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Nhập lý do gửi cảnh báo hoặc ghi chú thêm..."
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.82rem',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justify: 'flex-end',
          gap: '0.75rem'
        }}>
          <button
            type="button"
            onClick={() => setRfqModalData(null)}
            style={{
              padding: '0.5rem 1.15rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#475569',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#ffffff',
              backgroundColor: '#2563eb',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Xác Nhận Gửi Cảnh Báo RFQ
          </button>
        </div>
      </div>
    </div>
  );
}

// ──── Sub-Component: Receipt Detail Modal ────
function ReceiptDetailModal({ selectedReceipt, onClose, purchaseOrders = [], onRequestValidate, submitting, formatPrice }) {
  if (!selectedReceipt) return null;

  const safeFormatPrice = (val) => formatPrice ? formatPrice(val) : (val || 0).toLocaleString('vi-VN') + ' VNĐ';

  const effectivePo = (selectedReceipt.po && typeof selectedReceipt.po === 'object' && selectedReceipt.po.items?.length > 0)
    ? selectedReceipt.po
    : ((purchaseOrders || []).find(p => 
        p && (p.id === selectedReceipt.poId || 
        p.poNumber === selectedReceipt.poId || 
        p.poNumber === selectedReceipt.receiptNumber?.replace('GRN-', '') ||
        (selectedReceipt.receiptNumber && selectedReceipt.receiptNumber.includes(p.poNumber)))
      ) || selectedReceipt.po || {});

  let qaLog = null;
  try {
    const qaLogs = JSON.parse(localStorage.getItem('erp_qa_inspection_logs') || '[]');
    const poNum = effectivePo?.poNumber || selectedReceipt.poId || selectedReceipt.receiptNumber?.replace('GRN-', '');
    qaLog = qaLogs.find(l => l.poNumber === poNum || (effectivePo && String(l.poNumber) === String(effectivePo.id)));
  } catch (e) {}

  // NOTE: selectedReceipt.status === 'READY' is the default state of EVERY receipt
  // awaiting warehouse action — it says nothing about whether QC has inspected the
  // batch, so it must never be treated as evidence of QA_PASSED. Only the PO's real
  // QC status (from the QC log or the PO record itself) may gate the intake button.
  const poStatus = qaLog?.status || effectivePo?.status || selectedReceipt.poStatus || null;
  const isQaPassed = poStatus === 'QA_PASSED';
  const isQaPartial = poStatus === 'QA_PARTIAL';
  const canValidate = isQaPassed || isQaPartial;

  const rawItemsList = (effectivePo && effectivePo.items?.length > 0)
    ? effectivePo.items
    : (selectedReceipt.items?.length > 0
        ? selectedReceipt.items
        : [{ name: 'Intel Core i9-14900K (Linh kiện mẫu)', quantity: 10, unitCost: 14500000 }]);

  const itemsList = rawItemsList.map(item => {
    const originalQty = parseInt(item.quantity || item.qty) || 1;
    let actualQty = originalQty;
    if (qaLog && qaLog.passedQty !== undefined) {
      if (rawItemsList.length === 1) {
        actualQty = Number(qaLog.passedQty);
      } else {
        const ratio = Number(qaLog.passedQty) / (Number(qaLog.totalQty) || 1);
        actualQty = Math.round(originalQty * ratio);
      }
    }
    return {
      ...item,
      quantity: actualQty,
      originalQty,
      hasQaAdjustment: qaLog && actualQty !== originalQty
    };
  });
  
  const totalAmount = itemsList.reduce((s, i) => {
    const uCost = parseFloat(i.unitCost || i.unitPrice || i.price || 0);
    const qty = parseInt(i.quantity) || 1;
    const tCost = parseFloat(i.totalCost || i.total) || (uCost * qty) || 0;
    return s + (isNaN(tCost) ? 0 : tCost);
  }, 0);

  const poNumberDisplay = effectivePo?.poNumber || selectedReceipt.poId || selectedReceipt.receiptNumber?.replace('GRN-', '') || 'Chưa có';
  const supplierDisplay = effectivePo?.supplier?.name || effectivePo?.supplierName || effectivePo?.supplierCode || selectedReceipt.supplierName || 'Chưa rõ';

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '1.5rem' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: '950px', maxHeight: '92vh', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 40px rgba(15,23,42,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        
        {/* Toolbar Header */}
        <div style={{ borderBottom: '2px solid #2563eb', background: '#f8fafc', padding: '1.25rem 1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {selectedReceipt.status === 'READY' && (
                <button
                  onClick={() => onRequestValidate(selectedReceipt, poStatus, itemsList)}
                  disabled={submitting || !canValidate}
                  title={!canValidate ? 'Lô hàng chưa được QC/QA kiểm định — không thể nhập kho.' : undefined}
                  style={{ padding: '0.6rem 1.4rem', borderRadius: '6px', fontWeight: 800, fontSize: '0.88rem', backgroundColor: canValidate ? '#2563eb' : '#94a3b8', color: '#ffffff', border: 'none', cursor: canValidate ? 'pointer' : 'not-allowed' }}
                >
                  Xác Nhận Nhập Kho {qaLog ? `(${qaLog.passedQty} SP)` : ''}
                </button>
              )}
              {selectedReceipt.status === 'DONE' && (
                <span style={{
                  padding: '0.5rem 1.1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 800,
                  backgroundColor: '#dcfce7', color: '#15803d', border: '1.5px solid #bbf7d0'
                }}>
                  Đã Nhập Kho Thành Công
                </span>
              )}
            </div>

            <button 
              onClick={onClose} 
              style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', cursor: 'pointer', padding: '0.3rem 0.8rem', borderRadius: '4px', fontWeight: 600 }} 
            >
              Đóng
            </button>
          </div>

          {/* Stepper */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem',
            backgroundColor: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0'
          }}>
            {[
              { key: 'RFQ', label: '1. YCBG (RFQ)' },
              { key: 'RFQ_SENT', label: '2. Đã Gửi YCBG' },
              { key: 'QUOTED', label: '3. Đã Báo Giá' },
              { key: 'PO', label: '4. Đơn PO' },
              { key: 'QC', label: '5. Kiểm Định QC' },
              { key: 'READY', label: '6. Chờ Nhập Kho' },
              { key: 'DONE', label: '7. Đã Nhập Kho' }
            ].map((step, idx, arr) => {
              const stepsList = ['RFQ', 'RFQ_SENT', 'QUOTED', 'PO', 'QC', 'READY', 'DONE'];
              let currentKey = 'PO';
              if (selectedReceipt.status === 'DONE' || ['RECEIVED', 'DONE', 'COMPLETED'].includes(effectivePo.status)) {
                currentKey = 'DONE';
              } else if (selectedReceipt.status === 'READY') {
                if (isQaPassed || isQaPartial) {
                  currentKey = 'READY';
                } else {
                  currentKey = 'QC';
                }
              } else if (['RFQ', 'RFQ_SENT', 'QUOTED', 'PO'].includes(poStatus)) {
                currentKey = poStatus;
              }

              const currentIdx = stepsList.indexOf(currentKey);
              const isActive = idx === currentIdx;
              const isPassed = idx < currentIdx;

              let activeBg = '#2563eb';
              if (step.key === 'DONE') activeBg = '#16a34a';

              return (
                <React.Fragment key={step.key}>
                  <div style={{
                    padding: '0.4rem 0.55rem',
                    fontSize: '0.73rem', fontWeight: isActive ? 800 : (isPassed ? 700 : 500),
                    background: isActive ? activeBg : (isPassed ? '#f1f5f9' : '#ffffff'),
                    color: isActive ? '#ffffff' : (isPassed ? '#334155' : '#94a3b8'),
                    borderRadius: '4px',
                    border: isActive ? `1.5px solid ${activeBg}` : '1px solid #e2e8f0',
                    whiteSpace: 'nowrap', flex: '1', textAlign: 'center'
                  }}>
                    {step.label}
                  </div>
                  {idx < arr.length - 1 && (
                    <div style={{ height: '2px', flex: '0.3', background: isPassed ? '#cbd5e1' : '#e2e8f0' }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Modal Body Content */}
        <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>MÃ PHIẾU NHẬP KHO THỰC TẾ</div>
              <h2 style={{ fontSize: '1.85rem', fontWeight: 900, margin: '0.2rem 0 0 0', color: '#0f172a' }}>
                {selectedReceipt.receiptNumber}
              </h2>
              <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color: '#64748b' }}>
                Mã đơn mua hàng liên kết: <strong style={{ color: '#2563eb' }}>{poNumberDisplay}</strong>
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1rem', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#0f172a', fontWeight: 800 }}>Danh Sách Linh Kiện Nhập Kho</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.5rem' }}>Tên Sản Phẩm</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Số Lượng Đặt</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Số Lượng Nhập Thực Tế</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Đơn Giá</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Thành Tiền</th>
                </tr>
              </thead>
              <tbody>
                {itemsList.map((item, idx) => {
                  const uCost = parseFloat(item.unitCost || item.unitPrice || item.price || 0);
                  const qty = parseInt(item.quantity) || 1;
                  const tCost = (uCost * qty) || 0;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600, color: '#0f172a' }}>{item.name || item.productName || item.product?.name}</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#64748b' }}>{item.originalQty || qty}</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 800, color: '#16a34a' }}>{qty}</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#475569' }}>{safeFormatPrice(uCost)}</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{safeFormatPrice(tCost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* QC/QA Inspection Report — prefers the real QcInspection record persisted by
              the backend, falls back to the local QC log for offline/legacy entries. */}
          {(() => {
            const dbInspection = selectedReceipt.qcInspections?.[0] || null;
            const inspectorName = dbInspection?.inspector?.fullName
              ? `${dbInspection.inspector.fullName}${dbInspection.inspector.employeeCode ? ` (${dbInspection.inspector.employeeCode})` : ''}`
              : (qaLog?.inspector || null);
            const inspectedAt = dbInspection?.inspectedAt
              ? new Date(dbInspection.inspectedAt).toLocaleString('vi-VN')
              : (qaLog?.date || null);
            const passedQtyDisplay = dbInspection ? dbInspection.passedQuantity : qaLog?.passedQty;
            const defectiveQtyDisplay = dbInspection ? dbInspection.defectiveQuantity : qaLog?.failedQty;
            const sampleRateDisplay = dbInspection?.sampleRate;
            const notesDisplay = dbInspection?.notes || qaLog?.notes;
            const qcStatusRaw = dbInspection?.status
              || (qaLog?.status === 'QA_PASSED' ? 'PASSED' : qaLog?.status === 'QA_PARTIAL' ? 'CONDITIONAL' : qaLog?.status === 'QA_REJECTED' ? 'FAILED' : null);
            const qcInfo = qcStatusRaw ? getStatusInfo(QC_STATUS, qcStatusRaw) : null;
            const badge = qcInfo ? { text: qcInfo.label, bg: qcInfo.bg, color: qcInfo.color, border: qcInfo.border } : null;

            if (!inspectorName && !inspectedAt && passedQtyDisplay === undefined && !notesDisplay) return null;

            return (
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: 800 }}>Biên Bản Kiểm Định QA/QC</h4>
                  {badge && (
                    <span style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800, backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                      {badge.text}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
                  <div>
                    <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>Người Kiểm Định</div>
                    <div style={{ color: '#0f172a', fontWeight: 700 }}>{inspectorName || 'Chưa rõ'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>Ngày Kiểm Định</div>
                    <div style={{ color: '#0f172a', fontWeight: 700 }}>{inspectedAt || 'Chưa rõ'}</div>
                  </div>
                  {sampleRateDisplay !== undefined && (
                    <div>
                      <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>Tỷ Lệ Lấy Mẫu</div>
                      <div style={{ color: '#0f172a', fontWeight: 700 }}>{sampleRateDisplay}%</div>
                    </div>
                  )}
                  <div>
                    <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>Số Lượng Đạt / Lỗi</div>
                    <div style={{ fontWeight: 700 }}>
                      <span style={{ color: '#16a34a' }}>{passedQtyDisplay ?? '—'}</span>
                      <span style={{ color: '#94a3b8' }}> / </span>
                      <span style={{ color: '#dc2626' }}>{defectiveQtyDisplay ?? '—'}</span>
                    </div>
                  </div>
                </div>
                {notesDisplay && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #e2e8f0', fontSize: '0.82rem', color: '#475569' }}>
                    <strong style={{ color: '#334155' }}>Ghi chú: </strong>{notesDisplay}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Nhà Cung Cấp: </span>
            <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{supplierDisplay}</strong>
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#2563eb' }}>
            Tổng Tiền Trị Giá: {safeFormatPrice(totalAmount)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Collects one Serial Number per unit being received, per line item, before a GRN
// intake can be confirmed — the backend (validateReceipt) rejects the request with
// a 400 if any line's serial count doesn't exactly match its intake quantity.
function SerialEntryModal({ target, onClose, onConfirm, submitting }) {
  const items = target.items || [];

  const [rawByProduct, setRawByProduct] = useState(() => {
    const initial = {};
    items.forEach(it => { initial[it.productId] = ''; });
    return initial;
  });

  const parseSerials = (raw) => (raw || '')
    .split(/[\n,]/)
    .map(s => s.trim())
    .filter(Boolean);

  const parsedByProduct = {};
  items.forEach(it => { parsedByProduct[it.productId] = parseSerials(rawByProduct[it.productId]); });

  const allSerialsFlat = Object.values(parsedByProduct).flat();
  const hasGlobalDuplicate = new Set(allSerialsFlat).size !== allSerialsFlat.length;

  const allValid = items.length > 0 && items.every(it => {
    const need = parseInt(it.quantity) || 0;
    return parsedByProduct[it.productId].length === need;
  }) && !hasGlobalDuplicate;

  const genSerialsFor = (item) => {
    const need = parseInt(item.quantity) || 0;
    const stamp = Date.now().toString(36).toUpperCase();
    const list = Array.from({ length: need }, (_, i) => `SN-${item.productId}-${stamp}-${String(i + 1).padStart(3, '0')}`);
    setRawByProduct(prev => ({ ...prev, [item.productId]: list.join('\n') }));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: '1rem' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', maxWidth: '640px', width: '100%', maxHeight: '88vh', border: '1px solid #cbd5e1', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Quét / Nhập Serial Number</h3>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            Mỗi đơn vị nhập kho phải có 1 Serial Number riêng để truy vết bảo hành — mỗi dòng textarea là 1 mã (hoặc dán danh sách cách nhau bằng dấu phẩy).
          </p>
        </div>

        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.map(item => {
            const need = parseInt(item.quantity) || 0;
            const got = parsedByProduct[item.productId]?.length || 0;
            const ok = got === need;
            return (
              <div key={item.productId} style={{ border: `1px solid ${ok ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: '8px', padding: '0.85rem 1rem', backgroundColor: ok ? '#f0fdf4' : '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || item.productName}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: ok ? '#15803d' : '#b45309' }}>{got}/{need} mã</span>
                    <button type="button" onClick={() => genSerialsFor(item)} style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.25rem 0.55rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#2563eb', cursor: 'pointer' }}>Tự Sinh Mã</button>
                  </div>
                </div>
                <textarea
                  value={rawByProduct[item.productId] || ''}
                  onChange={(e) => setRawByProduct(prev => ({ ...prev, [item.productId]: e.target.value }))}
                  placeholder={`Nhập ${need} Serial Number, mỗi dòng 1 mã...`}
                  rows={Math.min(6, Math.max(2, need))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.65rem', fontSize: '0.8rem', fontFamily: 'monospace', border: '1px solid #cbd5e1', borderRadius: '6px', resize: 'vertical' }}
                />
              </div>
            );
          })}
          {hasGlobalDuplicate && (
            <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 700 }}>Có Serial Number bị trùng lặp giữa các dòng — vui lòng kiểm tra lại.</div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '0.5rem 1.15rem', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', color: '#475569', cursor: 'pointer' }}>Hủy</button>
          <button
            type="button"
            disabled={!allValid || submitting}
            onClick={() => onConfirm(parsedByProduct)}
            style={{ padding: '0.5rem 1.35rem', fontSize: '0.82rem', border: 'none', borderRadius: '6px', background: allValid ? '#2563eb' : '#94a3b8', color: '#ffffff', fontWeight: 700, cursor: allValid && !submitting ? 'pointer' : 'not-allowed' }}
          >
            {submitting ? 'Đang xử lý...' : 'Xác Nhận Nhập Kho'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──── MAIN WAREHOUSE COMPONENT ────
export default function Warehouse() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const setActiveTab = (t) => {
    setSearchParams({ tab: t });
  };

  const { user, isCEO, isWarehouseManager, isWarehouse, isAdmin } = useAuth();
  const { can, canDo, canCreate, canEdit, canDelete, canApprove } = usePermission();
  const isManager = canDo('warehouse_dispatch_shipper') || canApprove('warehouse') || isCEO || isAdmin;
  const canPackScan = canDo('warehouse_pack_scan') || isWarehouse || isAdmin;
  const canDispatch = canDo('warehouse_dispatch_shipper') || isCEO || isAdmin;
  const canStockIntake = canDo('warehouse_stock_intake') || isWarehouse || isAdmin;
  const canApprovePr = canDo('warehouse_approve_pr') || isCEO || isAdmin;
  const canAuditAdjust = canDo('warehouse_audit_adjust') || isCEO || isAdmin;
  const inventory = useInventoryStore(state => state.inventory) || [];
  const setInventory = (items) => {
    useInventoryStore.setState({ inventory: items });
    try { localStorage.setItem('erp_inventory', JSON.stringify(items)); } catch (e) {}
  };
  const updateProduct = useInventoryStore(state => state.updateProduct);
  const createProduct = useInventoryStore(state => state.createProduct);
  const deleteProductImage = useInventoryStore(state => state.deleteProductImage);
  const products = useInventoryStore(state => state.products) || [];

  const orders = useSalesStore(state => state.orders) || [];
  const setOrders = (items) => {
    useSalesStore.setState({ orders: items });
    try { localStorage.setItem('erp_orders', JSON.stringify(items)); } catch (e) {}
  };
  const returnRequests = useSalesStore(state => state.returnRequests) || [];
  const setReturnRequests = (items) => {
    useSalesStore.setState({ returnRequests: items });
    try { localStorage.setItem('erp_return_requests', JSON.stringify(items)); } catch (e) {}
  };
  const updateOrderStatus = useSalesStore(state => state.updateOrderStatus);
  const updateReturnStatus = useSalesStore(state => state.updateReturnStatus);

  const purchaseOrders = useFinanceStore(state => state.purchaseOrders) || [];
  const setPurchaseOrders = (items) => {
    useFinanceStore.setState({ purchaseOrders: items });
    try { localStorage.setItem('erp_pos', JSON.stringify(items)); } catch (e) {}
  };

  const sendSystemNotification = useUtilityStore(state => state.sendSystemNotification);
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString('vi-VN');
  };
  const { addNotification } = useNotification();

  // receipts & stockMovements quản lý local (không có trong ERPContext)
  const [receipts, setReceipts] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('erp_receipts') || '[]'); } catch { return []; }
  });
  const [stockMovements, setStockMovements] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('erp_stock_movements') || '[]'); } catch { return []; }
  });

  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsError, setReceiptsError] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [serialEntryTarget, setSerialEntryTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Pack & Scan Modal
  const [packScanOrder, setPackScanOrder] = useState(null);

  // Shipper Assign Modal
  const [orderToAssign, setOrderToAssign] = useState(null);

  // RFQ Alert Logs
  const [rfqAlertLogs, setRfqAlertLogs] = useState([]);
  const [showRfqHistoryModal, setShowRfqHistoryModal] = useState(false);

  // Return Request Processing Modal
  const [selectedReturnProcessing, setSelectedReturnProcessing] = useState(null);
  const [returnShelfLocation, setReturnShelfLocation] = useState('SHELF_A1_RESTOCK');
  const [returnProcessNote, setReturnProcessNote] = useState('');

  // Stock Movement Details Modal
  const [selectedMovementLog, setSelectedMovementLog] = useState(null);

  // Filter States
  const [receiptStatusFilter, setReceiptStatusFilter] = useState('ALL');
  const [receiptSearch, setReceiptSearch] = useState('');
  const [grnStartDate, setGrnStartDate] = useState('');
  const [grnEndDate, setGrnEndDate] = useState('');

  // Inventory Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedLocationStatus, setSelectedLocationStatus] = useState('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL');

  // Delivery Filter States
  const [deliverySearch, setDeliverySearch] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('PENDING');
  const [deliveryShipperFilter, setDeliveryShipperFilter] = useState('ALL');

  // History Filter States
  const [movementTypeFilter, setMovementTypeFilter] = useState('ALL');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  // Direct Intake Form States
  const [directProduct, setDirectProduct] = useState('');
  const [directQty, setDirectQty] = useState('');
  const [directSupplier, setDirectSupplier] = useState('Intel Vietnam');
  const [directPrice, setDirectPrice] = useState('');
  const [directReason, setDirectReason] = useState('DIRECT_PURCHASE');
  const [directRef, setDirectRef] = useState('');
  const [directLocation, setDirectLocation] = useState('ZONE-A/SHELF-01/BIN-01');
  const [directNote, setDirectNote] = useState('');
  const [directSerials, setDirectSerials] = useState('');

  // Add Product Modal
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProdForm, setNewProdForm] = useState({ name: '', category: 'CPU', stock: '', price: '', supplier: 'Intel Vietnam', supplierCode: '', threshold: '5', location: 'ZONE-A/SHELF-01/BIN-01', available: true, description: '', imageFile: null, imageFiles: [] });

  // Edit Product Modal — opened either read-only (clicking the product name: "xem chi
  // tiết") or editable (the Hành Động button, managers only: "chỉnh sửa"). Same modal,
  // gated by this flag so the two entry points don't collide.
  const [editingProd, setEditingProd] = useState(null);
  const [productViewOnly, setProductViewOnly] = useState(false);

  // RFQ Modal States
  const [lowStockRfqModalData, setLowStockRfqModalData] = useState(null);
  const [backorderRfqData, setBackorderRfqData] = useState(null);

  // RFQ Alerts Filter States
  const [rfqSearch, setRfqSearch] = useState('');
  const [rfqSupplierFilter, setRfqSupplierFilter] = useState('ALL');
  const [rfqStockStatusFilter, setRfqStockStatusFilter] = useState('ALL');

  // Backorders & Order Detail Modal State
  const [backorderSearch, setBackorderSearch] = useState('');
  const [backorderStockFilter, setBackorderStockFilter] = useState('ALL');
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState(null);

  // RMA Returns Filter States
  const [returnStatusTab, setReturnStatusTab] = useState('ALL'); // 'ALL' | 'PENDING' | 'PROCESSED'
  const [returnSearch, setReturnSearch] = useState('');
  const [returnSpecificStatus, setReturnSpecificStatus] = useState('ALL');

  const getMergedRfqLogs = () => {
    let explicitLogs = [];
    try {
      explicitLogs = JSON.parse(localStorage.getItem('erp_rfq_alert_logs') || '[]');
    } catch (e) {}

    let notifLogs = [];
    try {
      const rawNotifs = JSON.parse(localStorage.getItem('erp_system_notifications') || '[]');
      notifLogs = rawNotifs
        .filter(n => n.type === 'RFQ_ALERT')
        .map(n => {
          const itemData = n.itemData || {};
          const productName = itemData.name || (n.title ? n.title.replace('Cảnh Báo Kho: ', '') : 'Linh kiện cảnh báo');
          const productId = itemData.id || '---';
          return {
            id: n.id,
            sentAt: n.createdAt,
            sender: 'Thủ kho',
            productId: productId,
            productName: productName,
            category: itemData.category || 'STORAGE',
            supplier: itemData.supplier || 'Nhà phân phối',
            currentStock: itemData.stock !== undefined ? itemData.stock : 0,
            threshold: itemData.threshold || 5,
            requestedQty: itemData.requestedQty || 10,
            reason: itemData.alertReason || n.message || 'Tồn kho chạm ngưỡng tối thiểu, cần mua bổ sung'
          };
        });
    } catch (e) {}

    const combined = [...explicitLogs];
    notifLogs.forEach(nl => {
      if (!combined.some(c => String(c.productId) === String(nl.productId) && Math.abs(new Date(c.sentAt) - new Date(nl.sentAt)) < 10000)) {
        combined.push(nl);
      }
    });

    return combined.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
  };

  const loadRfqLogs = () => {
    setRfqAlertLogs(getMergedRfqLogs());
  };

  useEffect(() => {
    loadRfqLogs();
    const handleNotifSent = () => loadRfqLogs();
    window.addEventListener('erp-notification-sent', handleNotifSent);
    return () => window.removeEventListener('erp-notification-sent', handleNotifSent);
  }, []);

  // Ensure default sample movements if stockMovements is empty
  const usingSampleMovements = !(stockMovements && stockMovements.length > 0);
  const effectiveStockMovements = usingSampleMovements
    ? DEFAULT_SAMPLE_MOVEMENTS
    : stockMovements;

  // Sync receipts & PO status
  const fetchReceipts = async (silent = false) => {
    if (!silent && receipts.length === 0) {
      setReceiptsLoading(true);
    }
    // Reset legacy cached inventory once to load newly reallocated stock dataset (v10)
    if (!localStorage.getItem('erp_inv_v10_synced')) {
      localStorage.removeItem('erp_inventory');
      localStorage.removeItem('erp_inv_v7_synced');
      localStorage.removeItem('erp_inv_v8_synced');
      localStorage.removeItem('erp_inv_v9_synced');
      localStorage.setItem('erp_inv_v10_synced', 'true');
    }
    setReceiptsError(null);
    try {
      let apiReceipts = [];
      try {
        const [receiptsRes, movementsRes] = await Promise.all([
          api.get('/warehouse/receipts'),
          api.get('/warehouse/stock-movements?limit=50')
        ]);
        if (receiptsRes?.success) apiReceipts = receiptsRes.data || [];
        if (movementsRes?.success && movementsRes.data?.length > 0) {
          // Backend rows use referenceId/product.name/createdAt/createdBy —
          // normalize to the flat {reference, productName, timestamp, actor}
          // shape the history table/detail modal actually read, otherwise
          // every real movement renders with blank product/date/reference.
          const normalizedMovements = movementsRes.data.map(m => ({
            id: m.id,
            type: m.type,
            reference: m.referenceId || m.reference || '—',
            productName: m.product?.name || m.productName || m.productId || '—',
            quantity: m.quantity,
            timestamp: m.createdAt || m.timestamp,
            actor: m.createdBy || m.actor || 'Thủ Kho',
            note: m.note
          }));
          setStockMovements(normalizedMovements);
        }
      } catch (e) {
        console.warn('API fallback:', e);
      }

      let qaLogs = [];
      try { qaLogs = JSON.parse(localStorage.getItem('erp_qa_inspection_logs') || '[]'); } catch (_) {}

      let localPOs = [];
      try { localPOs = JSON.parse(localStorage.getItem('erp_pos') || '[]'); } catch (_) {}
      [...(purchaseOrders || [])].forEach(p => {
        if (!localPOs.some(l => l.poNumber === p.poNumber || String(l.id) === String(p.id))) {
          localPOs.push(p);
        }
      });

      const syncedApiReceipts = apiReceipts.map(receipt => {
        const poNum = receipt.po?.poNumber || receipt.poId;
        const matchingPO = localPOs.find(p => p.poNumber === poNum || String(p.id) === String(receipt.poId));
        const matchingLog = qaLogs.find(l => l.poNumber === poNum || String(l.poNumber) === String(receipt.poId));
        const effectivePoStatus = matchingLog?.status || matchingPO?.status || receipt.po?.status;
        const isWarehouseReceived = matchingPO?.warehouseStatus === 'RECEIVED' || matchingPO?.status === 'DONE' || receipt.status === 'DONE';
        const isCompleted = isWarehouseReceived || ['RECEIVED', 'DONE', 'COMPLETED'].includes(effectivePoStatus);

        return {
          ...receipt,
          status: isCompleted ? 'DONE' : 'READY',
          po: {
            ...(receipt.po || matchingPO || {}),
            poNumber: poNum,
            status: effectivePoStatus
          }
        };
      });

      // Standard enterprise PO/RFQ code formatter
      const formatPurchaseReference = (po) => {
        if (!po) return '';
        const raw = String(po.poNumber || po.reference || po.id || '').trim();
        if (raw.startsWith('PO-') || raw.startsWith('RFQ-') || raw.startsWith('PR-')) return raw;
        const numOnly = raw.replace(/\D/g, '') || '1';
        const padded = String(numOnly).padStart(4, '0');
        const isRfq = ['RFQ', 'RFQ_SENT', 'AWAITING_SUPPLIER_QUOTE', 'QUOTED'].includes(po.status) || po.type === 'BACKORDER_RFQ' || po.type === 'RFQ';
        return `${isRfq ? 'RFQ' : 'PO'}-2026-${padded}`;
      };

      const combinedReceipts = [...syncedApiReceipts];
      // Only let local-cache/store POs synthesize a brand-new GRN row when the real
      // receipts API genuinely returned nothing — once it has data, it's authoritative
      // on which receipts exist, so stale localStorage can't inject phantom GRNs.
      if (apiReceipts.length === 0) {
        localPOs
          .filter(po => ['CONFIRMED_BY_SUPPLIER', 'QA_PASSED', 'QA_PARTIAL', 'RECEIVED', 'DONE', 'COMPLETED'].includes(po.status))
          .forEach(po => {
            const poNumber = formatPurchaseReference(po);
            const matchingLog = qaLogs.find(l => l.poNumber === poNumber || String(l.poNumber) === String(po.id));
            const effectiveStatus = matchingLog?.status || po.status;

            if (!combinedReceipts.some(r => r.po?.poNumber === poNumber || r.receiptNumber === `GRN-${poNumber}` || r.id === `GRN-${poNumber}`)) {
              const isCompleted = po.warehouseStatus === 'RECEIVED' || po.status === 'DONE' || po.status === 'COMPLETED';
              combinedReceipts.push({
                id: `GRN-${poNumber}`,
                receiptNumber: `GRN-${poNumber}`,
                status: isCompleted ? 'DONE' : 'READY',
                poId: po.id,
                poNumber: poNumber,
                po: {
                  ...po,
                  poNumber: poNumber,
                  status: effectiveStatus
                },
                warehouse: { name: 'Kho Tổng' },
                createdAt: po.createdAt || new Date().toISOString()
              });
            }
          });
      }

      setReceipts(combinedReceipts);
    } catch (err) {
      setReceiptsError('Không thể tải phiếu nhập kho');
    } finally {
      setReceiptsLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  // Real Supplier directory (Purchasing's Danh Bạ NCC) — the product edit form used
  // to offer a hardcoded list of supplier NAMES (STANDARD_SUPPLIERS) with no relation
  // to any actual Supplier row, so "saving" a NCC never matched a real code and could
  // never actually persist. Fetched once; ACTIVE only, since assigning a product to a
  // supplier Purchasing has stopped working with would be misleading.
  const [realSuppliers, setRealSuppliers] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/purchasing/suppliers');
        if (res?.success && Array.isArray(res.data)) {
          setRealSuppliers(res.data.filter(s => s.status !== 'INACTIVE'));
        }
      } catch (_) {}
    })();
  }, []);

  // Validate receipt intake
  const handleValidateReceipt = async (receipt, currentPoStatus, serialsMap) => {
    const poNum = receipt.po?.poNumber || receipt.poId || receipt.receiptNumber?.replace('GRN-', '');
    let qaLog = null;
    try {
      const qaLogs = JSON.parse(localStorage.getItem('erp_qa_inspection_logs') || '[]');
      qaLog = qaLogs.find(l => l.poNumber === poNum || String(l.poNumber) === String(receipt.poId));
    } catch (e) {}

    const effectiveStatus = qaLog?.status || currentPoStatus || receipt.po?.status;

    // receipt.status === 'READY' is just "awaiting warehouse action" — it says nothing
    // about QC having inspected the batch, so it must never bypass this gate (the
    // backend enforces the real gate too, but the UI should refuse before even trying).
    if (!['QA_PASSED', 'QA_PARTIAL'].includes(effectiveStatus)) {
      notify(`Lô hàng #${poNum} chưa hoàn tất nghiệm thu QA/QC! Vui lòng chờ bộ phận QA kiểm định chất lượng.`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      let apiError = null;
      try {
        const res = await api.post(`/warehouse/receipts/${receipt.id}/validate`, {
          warehouseId: receipt.warehouseId || 1,
          serials: serialsMap || {}
        });
        if (!res?.success) apiError = new Error(res?.message || 'Máy chủ từ chối xác nhận nhập kho.');
      } catch (e) {
        apiError = e;
      }

      // The backend independently re-checks the QC/QA gate (409 if not
      // actually passed) — trust that result. Applying the local inventory
      // bump / "success" toast regardless of what the server said would let
      // the UI report stock received that was never actually recorded.
      if (apiError) {
        notify(apiError.message || `Không thể xác nhận nhập kho phiếu ${receipt.receiptNumber}. Vui lòng thử lại.`, 'error');
        setSubmitting(false);
        return;
      }

      const targetItems = receipt.po?.items || receipt.items || [];
      const newMovements = [...effectiveStockMovements];

      targetItems.forEach(item => {
        let intakeQty = parseInt(item.quantity || item.qty) || 1;
        if (qaLog && qaLog.passedQty !== undefined) {
          if (targetItems.length === 1) intakeQty = Number(qaLog.passedQty);
          else intakeQty = Math.round(intakeQty * (Number(qaLog.passedQty) / (Number(qaLog.totalQty) || 1)));
        }

        newMovements.unshift({
          id: 'MOV-' + Date.now() + '-' + Math.floor(Math.random()*1000),
          type: 'IN',
          reference: receipt.receiptNumber || `GRN-${poNum}`,
          productName: item.name || item.productName || 'Sản phẩm',
          quantity: intakeQty,
          timestamp: new Date().toISOString(),
          actor: user?.fullname || 'Thủ Kho',
          note: `Nhập kho từ đơn mua #${poNum} (QA: ${effectiveStatus})`
        });
      });

      // Re-pull authoritative on-hand quantities from the DB (the backend
      // transaction above already incremented Inventory.quantityOnHand /
      // Product.stockQuantity) instead of hand-recomputing them client-side —
      // that recompute used to key inventory rows by an id/name shape that
      // never matched the real store data, so the table kept showing stale
      // pre-intake numbers even though the receipt was validated successfully.
      try { await useInventoryStore.getState().getInventory(); } catch (_) {}
      setStockMovements(newMovements);

      const updatedReceipts = receipts.map(r => r.id === receipt.id ? { ...r, status: 'DONE' } : r);
      setReceipts(updatedReceipts);

      const updatedPOs = purchaseOrders.map(p => (p.poNumber === poNum || String(p.id) === String(receipt.poId)) ? { ...p, warehouseStatus: 'RECEIVED', status: 'DONE' } : p);
      setPurchaseOrders(updatedPOs);
      try { localStorage.setItem('erp_pos', JSON.stringify(updatedPOs)); } catch (_) {}

      addNotification({
        type: 'success',
        title: 'Nhập kho thành công!',
        message: `Đã xác nhận nhập kho phiếu ${receipt.receiptNumber} (${poNum}).`
      });

      setSelectedReceipt(null);
    } catch (err) {
      notify('Không thể xác nhận nhập kho!', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Open Backorder RFQ Proposal Modal
  const handleOpenBackorderRfqModal = (order, missingItem) => {
    if (!order) return;
    const targetItem = missingItem || (order.items && order.items[0]) || { name: 'Linh kiện máy tính', quantity: 1 };
    const pName = targetItem.name || targetItem.productName || 'Linh kiện máy tính';
    const pId = String(targetItem.productId || targetItem.id || Date.now());
    const neededQty = Number(targetItem.neededQty || targetItem.quantity || 1);
    const matchInv = (inventory || []).find(inv => String(inv.id) === pId || (inv.name && inv.name.toLowerCase() === pName.toLowerCase()));
    const currentStock = matchInv ? Number(matchInv.stock) : 0;
    const suppName = matchInv?.supplier || (pName.toLowerCase().includes('asus') ? 'ASUS Vietnam' : pName.toLowerCase().includes('msi') ? 'MSI Vietnam' : pName.toLowerCase().includes('samsung') ? 'Samsung Vina' : pName.toLowerCase().includes('intel') ? 'Intel Vietnam' : 'Mai Hoàng Distribution');
    const estUnitPrice = matchInv?.price ? Math.round(Number(matchInv.price) * 0.8) : (targetItem.unitPrice || targetItem.price ? Math.round(Number(targetItem.unitPrice || targetItem.price) * 0.8) : 1500000);

    setBackorderRfqData({
      order,
      orderId: order.orderId || order.id || 'N/A',
      customerName: order.customerName || 'Khách hàng',
      productId: pId,
      productName: pName,
      neededQty,
      currentStock,
      suggestedQty: Math.max(neededQty * 2, 5),
      supplier: suppName,
      unitPrice: estUnitPrice,
      reason: `Nợ khách hàng đơn #${order.orderId || order.id || 'N/A'} (${order.customerName || 'Khách hàng'}) - Khách cần ${neededQty} SP`
    });
  };

  // Handle Confirm and Send RFQ to Purchasing
  const handleConfirmSendBackorderRfq = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!backorderRfqData) return;

    const { order, orderId, productId, productName, suggestedQty, supplier, unitPrice, reason, neededQty } = backorderRfqData;
    const finalQty = Number(suggestedQty) || 5;
    const totalAmount = finalQty * Number(unitPrice || 1500000);
    // Map the guessed brand/supplier name to a real Supplier.code — the old
    // 's1'..'s5' placeholders never matched any actual row, so this RFQ was
    // structurally unable to reach the real backend regardless of anything
    // else. This mapping is still a best-effort guess for pre-filling the
    // form; Purchasing can change the supplier before actually sending it.
    const brandCodeMap = [
      [/asus/i, 'SUP-ASUS-VN'], [/msi/i, 'SUP-MSI-VN'], [/samsung/i, 'SUP-SAMSUNG-VN'],
      [/intel/i, 'SUP-INTEL-VN'], [/amd/i, 'SUP-AMD-VN'], [/kingston/i, 'SUP-KINGSTON-VN'],
      [/corsair/i, 'SUP-CORSAIR-VN'], [/gigabyte/i, 'SUP-GIGABYTE-VN'], [/lg\b/i, 'SUP-LG-VN']
    ];
    const suppCode = (brandCodeMap.find(([re]) => re.test(supplier || '')) || [null, 'SUP-MAIHOANG'])[1];

    let poNumber = `RFQ-BO-${Date.now().toString().slice(-6)}`;
    let apiSucceeded = false;
    try {
      const res = await api.post('/purchasing/orders', {
        supplierCode: suppCode,
        expectedDeliveryDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        items: [{ productId: String(productId), quantity: finalQty, unitCost: unitPrice }]
      });
      if (res?.success && res?.data?.poNumber) {
        poNumber = res.data.poNumber;
        apiSucceeded = true;
      }
    } catch (apiErr) {
      console.warn('Backorder RFQ API error, saving locally only:', apiErr);
    }

    const newPO = {
      id: poNumber,
      poNumber: poNumber,
      supplierCode: suppCode,
      supplier: { code: suppCode, name: supplier },
      supplierName: supplier,
      createdBy: user?.fullname || user?.email || 'Thủ Kho',
      orderDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      expectedDeliveryDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      totalAmount: totalAmount,
      status: 'RFQ_SENT',
      type: 'BACKORDER_RFQ',
      relatedOrderId: orderId,
      items: [
        {
          productId,
          productName,
          name: productName,
          quantity: finalQty,
          unitCost: unitPrice,
          totalCost: totalAmount
        }
      ],
      supplierNote: `[ĐỀ XUẤT TỪ KHO - NỢ KHÁCH #${orderId}]: Khách hàng ${order.customerName || 'đặt mua'} đang chờ linh kiện "${productName}". Yêu cầu phòng Mua Hàng gửi RFQ mua gấp tối thiểu ${neededQty || 1} SP (Đề xuất đặt ${finalQty} SP để bổ sung tồn kho).`
    };

    // 1. Save to state & localStorage for POs
    const updatedPOs = [newPO, ...(purchaseOrders || [])];
    setPurchaseOrders(updatedPOs);
    try {
      const curLocalPos = JSON.parse(localStorage.getItem('erp_pos') || '[]');
      localStorage.setItem('erp_pos', JSON.stringify([newPO, ...curLocalPos.filter(p => p.id !== poNumber)]));
    } catch (_) {}

    // 2. Save RFQ Alert Log
    const newLog = {
      id: 'RFQ-ALT-' + Date.now(),
      sentAt: new Date().toISOString(),
      sender: 'Thủ kho',
      productId,
      productName,
      category: 'COMP',
      supplier,
      currentStock: backorderRfqData.currentStock,
      threshold: 5,
      requestedQty: finalQty,
      reason
    };
    try {
      const existingLogs = JSON.parse(localStorage.getItem('erp_rfq_alert_logs') || '[]');
      localStorage.setItem('erp_rfq_alert_logs', JSON.stringify([newLog, ...existingLogs]));
      if (setRfqAlertLogs) setRfqAlertLogs([newLog, ...existingLogs]);
    } catch (_) {}

    // 3. Send system notification to Purchasing & Admin
    if (typeof sendSystemNotification === 'function') {
      sendSystemNotification({
        targetRoles: ['PURCHASING', 'CEO', 'ADMIN'],
        title: `[ĐỀ XUẤT MUA HÀNG KHẨN] ${productName}`,
        message: `Thủ kho vừa tạo đề xuất mua hàng ${poNumber} cho linh kiện "${productName}" (${finalQty} cái). Đơn nợ khách #${orderId}.`,
        link: '/admin/purchasing',
        type: 'RFQ_ALERT',
        itemData: newPO
      });
    }

    if (typeof addNotification === 'function') {
      addNotification(apiSucceeded ? {
        type: 'success',
        title: 'Đã gửi Đề Xuất Mua Hàng (RFQ)',
        message: `Mã phiếu: ${poNumber}. Đã chuyển yêu cầu mua ${finalQty} cái "${productName}" sang bộ phận Mua Hàng.`
      } : {
        type: 'warning',
        title: 'Chưa gửi được lên máy chủ',
        message: `Đề xuất mua "${productName}" chỉ mới lưu tạm trên trình duyệt này — Phòng Mua Hàng CHƯA thấy được. Vui lòng thử lại hoặc báo Phòng Mua Hàng tạo RFQ thủ công.`
      });
    }

    setBackorderRfqData(null);
    navigate('/admin/purchasing?tab=orders');
  };

  // Handle Fulfill Backorder
  const handleFulfillBackorder = async (order) => {
    const ordId = order.orderId || order.id;
    // Route through the real store action (which calls the backend's atomic,
    // race-condition-safe stock deduction — the same mechanism already used
    // for normal order confirmation) instead of only flipping local state.
    // Previously this never touched the server at all, so nothing actually
    // reserved the stock: two backorders both needing the last unit could
    // each show "Đã Đủ Hàng" and both get confirmed here.
    try {
      await updateOrderStatus(ordId, 'CONFIRMED', 'Đã đủ tồn kho linh kiện, sẵn sàng đóng gói xuất kho.');

      if (typeof addNotification === 'function') {
        addNotification({
          type: 'success',
          title: 'Đã xác nhận xuất kho',
          message: `Đơn hàng #${ordId} đã chuyển sang trạng thái Sẵn Sàng Đóng Gói (CONFIRMED).`
        });
      }
      notify(`Đã xác nhận đơn hàng #${ordId} đủ điều kiện xuất kho. Đơn đã được chuyển sang danh sách Đóng gói & Giao hàng.`, 'success');
    } catch (err) {
      // api.js's fetch wrapper throws a plain Error carrying the server's
      // JSON `message` string — there's no numeric status code on it — so
      // detect the stock-conflict case by matching the backend's own wording.
      const isStockConflict = /tồn kho không đủ|không đủ tồn/i.test(err?.message || '');
      notify(
        isStockConflict
          ? `Không thể xác nhận đơn #${ordId}: tồn kho vừa được đơn khác lấy hết trong lúc bạn xử lý. Đơn vẫn ở trạng thái Chờ Hàng.`
          : `Không thể xác nhận đơn #${ordId}: ${err?.message || 'lỗi kết nối máy chủ'}.`,
        'error'
      );
    }
  };

  // Shipper assignment
  const handleConfirmAssign = (order, shipperUser) => {
    const updatedOrders = orders.map(o => {
      if (o.id === order.id || o.orderId === order.orderId) {
        return {
          ...o,
          status: 'SHIPPED',
          deliveryStatus: 'SHIPPED',
          assignedShipper: shipperUser ? shipperUser.fullname : 'Giao Hàng Tự Do',
          assignedShipperId: shipperUser ? shipperUser.id : null,
          shippedAt: new Date().toISOString()
        };
      }
      return o;
    });
    setOrders(updatedOrders);
    try { localStorage.setItem('erp_orders', JSON.stringify(updatedOrders)); } catch (_) {}

    addNotification({
      type: 'success',
      title: 'Đã xuất kho & bàn giao!',
      message: `Đơn hàng #${order.orderId || order.id} đã chuyển trạng thái Đang Giao Hàng.`
    });

    setOrderToAssign(null);
  };

  // Called from PackAndScanModal when user clicks Xác Nhận Đóng Gói
  const handleConfirmPack = (packedOrder, serials) => {
    try {
      const ordId = String(packedOrder.orderId || packedOrder.id || '');

      // Dùng updateOrderStatus từ ERPContext — đúng cách, không crash
      if (typeof updateOrderStatus === 'function') {
        updateOrderStatus(ordId, 'READY_TO_SHIP', 'Kho đã hoàn tất đóng gói và kiểm tra Serial.', {
          packedSerials: serials || [],
          packedAt: new Date().toISOString()
        });
      } else {
        // Fallback: cập nhật localStorage trực tiếp
        const stored = JSON.parse(localStorage.getItem('erp_orders') || '[]');
        const updated = stored.map(o => {
          if (String(o.orderId || o.id) === ordId) {
            return { ...o, status: 'READY_TO_SHIP', packedSerials: serials || [], packedAt: new Date().toISOString() };
          }
          return o;
        });
        localStorage.setItem('erp_orders', JSON.stringify(updated));
      }

      if (typeof addNotification === 'function') {
        addNotification(`Đã hoàn tất đóng gói! Đơn hàng #${ordId} đã sẵn sàng phân công Shipper.`, 'success');
      }
    } catch (err) {
      console.error('handleConfirmPack error:', err);
    }

    // Đóng pack modal và mở shipper modal trong cùng render cycle
    setPackScanOrder(null);
    setOrderToAssign(packedOrder);
  };

  // Add Product Submit
  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    if (!isManager) {
      notify('Bạn không có quyền thêm sản phẩm mới.', 'error');
      return;
    }
    if (!newProdForm.name.trim() || !newProdForm.stock) {
      notify('Vui lòng nhập tên sản phẩm và số lượng tồn kho!', 'error');
      return;
    }

    try {
      await createProduct({
        name: newProdForm.name.trim(),
        category: newProdForm.category,
        stockQuantity: parseInt(newProdForm.stock, 10) || 0,
        threshold: parseInt(newProdForm.threshold, 10) || 5,
        price: parseFloat(newProdForm.price) || 0,
        available: newProdForm.available !== false,
        description: newProdForm.description || '',
        ...(newProdForm.imageFile && { imageFile: newProdForm.imageFile }),
        ...(newProdForm.imageFiles?.length > 0 && { imageFiles: newProdForm.imageFiles }),
        ...(newProdForm.supplierCode && { supplierCode: newProdForm.supplierCode })
      });

      setShowAddProduct(false);
      setNewProdForm({ name: '', category: 'CPU', stock: '', price: '', supplier: 'Intel Vietnam', supplierCode: '', threshold: '5', location: 'ZONE-A/SHELF-01/BIN-01', available: true, description: '', imageFile: null, imageFiles: [] });
      notify(`Đã thêm sản phẩm ${newProdForm.name.trim()} vào cơ sở dữ liệu thành công!`, 'success');
    } catch (err) {
      notify(err?.message || 'Không thể lưu sản phẩm mới vào cơ sở dữ liệu. Vui lòng thử lại.', 'error');
    }
  };

  // Edit Product Submit
  const handleEditProductSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!editingProd) return;
    if (!isManager || productViewOnly) {
      notify('Bạn không có quyền chỉnh sửa thông tin sản phẩm.', 'error');
      return;
    }

    const targetId = editingProd.id;
    // name/price/stock/supplierCode are real Product columns the backend persists
    // (see product.controller.js updateProduct); category/location/threshold live in
    // Inventory/WarehouseLocation and aren't accepted by that endpoint yet, so they
    // still only update local state below, same as before this fix.
    const fieldsToUpdate = {
      name: editingProd.name,
      category: editingProd.category,
      supplier: editingProd.supplier,
      location: editingProd.location,
      stock: editingProd.stock !== undefined ? (parseInt(editingProd.stock, 10) || 0) : 0,
      price: editingProd.price !== undefined ? (parseFloat(editingProd.price) || 0) : 0,
      threshold: editingProd.threshold !== undefined ? (parseInt(editingProd.threshold, 10) || 5) : 5,
      available: editingProd.available !== false,
      description: editingProd.description || '',
      ...(editingProd.imageFile && { imageFile: editingProd.imageFile }),
      ...(editingProd.imageFiles?.length > 0 && { imageFiles: editingProd.imageFiles }),
      ...(editingProd.supplierCode && { supplierCode: editingProd.supplierCode })
    };

    try {
      if (updateProduct) {
        await updateProduct(targetId, fieldsToUpdate);
      } else if (setInventory) {
        setInventory(prev => (prev || []).map(p => String(p.id) === String(targetId) ? { ...p, ...fieldsToUpdate } : p));
      }

      const savedId = editingProd.id;
      setEditingProd(null);
      notify(`Đã cập nhật thành công thông tin sản phẩm #${savedId}!`, 'success');
    } catch (err) {
      notify(err?.message || 'Không thể lưu thay đổi vào cơ sở dữ liệu. Vui lòng thử lại.', 'error');
    }
  };

  // Delete one already-saved gallery photo — separate from the Lưu Cập Nhật save
  // action above, takes effect immediately (matches the trash icon's implied "this is
  // permanent now" affordance rather than queuing it behind the next full form save).
  const [deletingGalleryImageId, setDeletingGalleryImageId] = useState(null);
  const handleDeleteGalleryImage = async (imageId) => {
    if (!editingProd) return;
    const confirmed = window.confirm('Xoá ảnh này khỏi sản phẩm?');
    if (!confirmed) return;
    setDeletingGalleryImageId(imageId);
    try {
      await deleteProductImage(editingProd.id, imageId);
      setEditingProd(prev => prev ? { ...prev, gallery: (prev.gallery || []).filter(img => img.id !== imageId) } : prev);
      notify('Đã xoá ảnh.', 'success');
    } catch (err) {
      notify(err?.message || 'Không thể xoá ảnh. Vui lòng thử lại.', 'error');
    } finally {
      setDeletingGalleryImageId(null);
    }
  };

  // Direct Intake Submit
  const handleDirectIntakeSubmit = async (e) => {
    e.preventDefault();
    if (!canStockIntake) {
      notify('Bạn không có quyền nhập kho trực tiếp.', 'error');
      return;
    }
    const qtyNum = parseInt(directQty, 10);
    if (!directProduct || isNaN(qtyNum) || qtyNum <= 0) {
      notify('Vui lòng chọn sản phẩm và nhập số lượng nhập kho hợp lệ (lớn hơn 0)!', 'error');
      return;
    }

    const parsedSerials = directSerials.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    if (parsedSerials.length !== qtyNum) {
      notify(`Cần nhập đủ ${qtyNum} Serial Number (mỗi dòng 1 mã) — hiện có ${parsedSerials.length}.`, 'error');
      return;
    }
    if (new Set(parsedSerials).size !== parsedSerials.length) {
      notify('Danh sách Serial Number có mã bị trùng lặp.', 'error');
      return;
    }

    const selectedInv = inventory.find(i => String(i.id) === String(directProduct) || i.name === directProduct);
    const prodName = selectedInv ? selectedInv.name : directProduct;
    const refCode = directRef.trim() || ('DIR-' + Date.now().toString().slice(-6));

    setSubmitting(true);
    try {
      // Ghi vào CSDL thật trước — trước đây hàm này chỉ sửa state cục bộ và
      // localStorage, không hề gọi API nào, nên "nhập kho" ở tab này chưa
      // từng thật sự cộng vào tồn kho chung của hệ thống.
      await api.post('/warehouse/inventory/adjust', {
        productId: directProduct,
        quantity: qtyNum,
        warehouseId: 1,
        location: directLocation,
        reason: directReason,
        note: directNote,
        refCode,
        serials: parsedSerials
      });

      const updatedInventory = inventory.map(item => {
        if (String(item.id) === String(directProduct) || item.name === directProduct) {
          return {
            ...item,
            stock: item.stock + qtyNum,
            location: directLocation || item.location,
            supplier: directSupplier || item.supplier
          };
        }
        return item;
      });
      setInventory(updatedInventory);

      const newMov = {
        id: 'MOV-' + Date.now(),
        type: 'IN',
        reference: refCode,
        productName: prodName,
        quantity: qtyNum,
        timestamp: new Date().toISOString(),
        actor: user?.fullname || 'Thủ Kho',
        note: `Nhập trực tiếp / Kiểm kê (${directReason}). Ghi chú: ${directNote || 'N/A'}`
      };
      setStockMovements(prev => [newMov, ...prev]);

      setDirectQty('');
      setDirectNote('');
      setDirectRef('');
      setDirectSerials('');
      notify(`Đã hoàn tất nhập kho trực tiếp ${qtyNum} SP ${prodName} (Mã chứng từ: ${refCode}).`, 'success');
    } catch (err) {
      notify(err.message || 'Không thể ghi nhận nhập kho trực tiếp lên máy chủ. Vui lòng thử lại.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter calculations — in warehouse context we show all products except truly discontinued
  // available=false means hidden from storefront but still physically in warehouse
  const activeInventory = inventory.filter(item => item.status !== 'DISCONTINUED');
  const outOfStockItems = activeInventory.filter(item => Number(item.stock) === 0);
  const lowStockItems = activeInventory.filter(item => Number(item.stock) > 0 && Number(item.stock) <= Number(item.threshold || 5));
  // RFQ Alerts tab needs both out-of-stock and below-threshold items — the table already
  // renders a distinct "Hết Hàng" badge/style for stock===0 rows, so the underlying list
  // must include them too, not just lowStockItems (dưới ngưỡng nhưng còn hàng).
  const restockNeededItems = activeInventory.filter(item => Number(item.stock) <= Number(item.threshold || 5));
  const rfqSupplierOptions = [...new Set(restockNeededItems.map(item => item.supplier).filter(Boolean))].sort();
  const filteredRfqItems = restockNeededItems.filter(item => {
    const matchSearch = !rfqSearch.trim() ||
      (item.name && item.name.toLowerCase().includes(rfqSearch.toLowerCase())) ||
      (item.supplier && item.supplier.toLowerCase().includes(rfqSearch.toLowerCase()));
    const matchSupplier = rfqSupplierFilter === 'ALL' || item.supplier === rfqSupplierFilter;
    const matchStatus = rfqStockStatusFilter === 'ALL' ||
      (rfqStockStatusFilter === 'OUT_OF_STOCK' && Number(item.stock) === 0) ||
      (rfqStockStatusFilter === 'LOW_STOCK' && Number(item.stock) > 0);
    return matchSearch && matchSupplier && matchStatus;
  });
  const usingSampleReceipts = !(receipts && receipts.length > 0);
  const effectiveReceipts = usingSampleReceipts ? DEFAULT_SAMPLE_RECEIPTS : receipts;
  const usingSampleReturns = !(returnRequests && returnRequests.length > 0);
  const effectiveReturnRequests = usingSampleReturns ? DEFAULT_SAMPLE_RETURNS : returnRequests;
  const readyReceipts = effectiveReceipts.filter(r => r.status === 'READY');
  // Shared with the Delivery tab's default "PENDING" filter (below) so the
  // Overview KPI card always matches the count the linked tab actually shows.
  const PENDING_DELIVERY_STATUSES = ['CONFIRMED', 'READY_TO_SHIP', 'PACKED', 'PENDING', 'PROCESSING', 'AWAITING_SHIP'];
  const pendingDeliveriesCount = orders.filter(o => PENDING_DELIVERY_STATUSES.includes(o.status)).length;

  const CAT_ALIASES = {
    'CPU': ['CPU', 'PROCESSOR', 'BỘ XỬ LÝ'],
    'VGA': ['VGA', 'GPU', 'GRAPHICS', 'CARD MÀN HÌNH', 'VIDEO CARD'],
    'MAINBOARD': ['MAINBOARD', 'MOTHERBOARD', 'BO MẠCH CHỦ', 'MAIN'],
    'RAM': ['RAM', 'MEMORY', 'BỘ NHỚ'],
    'STORAGE': ['STORAGE', 'HDD', 'SSD', 'Ổ CỨNG', 'O CUNG'],
    'PSU': ['PSU', 'POWER SUPPLY', 'NGUỒN', 'NGUON'],
    'CASE': ['CASE', 'CHASSIS', 'VỎ CASE', 'THÙNG MÁY'],
    'COOLER': ['COOLER', 'TẢN NHIỆT', 'FAN', 'COOLING'],
    'MONITOR': ['MONITOR', 'MÀN HÌNH', 'MAN HINH', 'SCREEN', 'DISPLAY'],
    'KEYBOARD': ['KEYBOARD', 'BÀN PHÍM', 'BAN PHIM', 'PHÍM'],
    'MOUSE': ['MOUSE', 'CHUỘT', 'CHUOT']
  };

  const filteredProducts = activeInventory.filter(item => {
    const matchSearch = !searchQuery.trim() || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || (item.supplier && item.supplier.toLowerCase().includes(searchQuery.toLowerCase()));
    const itemCatUpper = String(item.category || '').toUpperCase().trim();
    const matchCat = selectedCategory === 'ALL' || (() => {
      const aliases = CAT_ALIASES[selectedCategory] || [selectedCategory];
      return aliases.some(a => itemCatUpper === a || itemCatUpper.includes(a));
    })();
    const matchLoc = selectedLocationStatus === 'ALL' || (selectedLocationStatus === 'ASSIGNED' ? (!!item.location && item.location !== 'Chưa xếp kệ') : (!item.location || item.location === 'Chưa xếp kệ'));
    const matchSup = selectedSupplier === 'ALL' || item.supplier === selectedSupplier;

    let matchStock = true;
    if (stockStatusFilter === 'IN_STOCK') matchStock = Number(item.stock) > 0;
    if (stockStatusFilter === 'LOW_STOCK') matchStock = Number(item.stock) > 0 && Number(item.stock) <= Number(item.threshold || 5);
    if (stockStatusFilter === 'OUT_OF_STOCK') matchStock = Number(item.stock) === 0;

    return matchSearch && matchCat && matchLoc && matchSup && matchStock;
  });

  // Dynamic suppliers available for current selected category
  const categoryMatchedInventory = activeInventory.filter(item => {
    if (selectedCategory === 'ALL') return true;
    const itemCatUpper = String(item.category || '').toUpperCase().trim();
    const aliases = CAT_ALIASES[selectedCategory] || [selectedCategory];
    return aliases.some(a => itemCatUpper === a || itemCatUpper.includes(a));
  });
  const availableSuppliers = [...new Set(categoryMatchedInventory.map(i => i.supplier).filter(Boolean))].sort();

  // Stock status counts computed in context of category/supplier/location/search filters
  const baseForStockStatus = activeInventory.filter(item => {
    const matchSearch = !searchQuery.trim() || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || (item.supplier && item.supplier.toLowerCase().includes(searchQuery.toLowerCase()));
    const itemCatUpper = String(item.category || '').toUpperCase().trim();
    const matchCat = selectedCategory === 'ALL' || (() => {
      const aliases = CAT_ALIASES[selectedCategory] || [selectedCategory];
      return aliases.some(a => itemCatUpper === a || itemCatUpper.includes(a));
    })();
    const matchLoc = selectedLocationStatus === 'ALL' || (selectedLocationStatus === 'ASSIGNED' ? (!!item.location && item.location !== 'Chưa xếp kệ') : (!item.location || item.location === 'Chưa xếp kệ'));
    const matchSup = selectedSupplier === 'ALL' || item.supplier === selectedSupplier;
    return matchSearch && matchCat && matchLoc && matchSup;
  });
  const countAllStock = baseForStockStatus.length;
  const countInStock = baseForStockStatus.filter(i => Number(i.stock) > 0).length;
  const countLowStock = baseForStockStatus.filter(i => Number(i.stock) > 0 && Number(i.stock) <= Number(i.threshold || 5)).length;
  const countOutOfStock = baseForStockStatus.filter(i => Number(i.stock) === 0).length;

  const filteredReceiptsList = effectiveReceipts.filter(r => {
    const poNum = r.po?.poNumber || r.poId || r.receiptNumber;
    const matchSearch = !receiptSearch.trim() || r.receiptNumber.toLowerCase().includes(receiptSearch.toLowerCase()) || String(poNum).toLowerCase().includes(receiptSearch.toLowerCase());
    const matchStatus = receiptStatusFilter === 'ALL' || r.status === receiptStatusFilter;
    const matchDate = isDateInRange(r.createdAt, grnStartDate, grnEndDate);
    return matchSearch && matchStatus && matchDate;
  });

  // QC/QA badge for a receipt row: prefers the real QcInspection record persisted by the
  // backend, falls back to the local QC log (offline/legacy entries), then to the PO status.
  const mapPoStatusToQcStatus = (poStatus) => {
    if (poStatus === 'QA_PASSED') return 'PASSED';
    if (poStatus === 'QA_PARTIAL') return 'CONDITIONAL';
    if (poStatus === 'QA_REJECTED') return 'FAILED';
    return null;
  };
  const getReceiptQcBadge = (r) => {
    const dbInspection = r.qcInspections?.[0];
    let statusKey = dbInspection?.status;
    if (!statusKey) {
      try {
        const qaLogs = JSON.parse(localStorage.getItem('erp_qa_inspection_logs') || '[]');
        const poNum = r.po?.poNumber || r.poId;
        const log = qaLogs.find(l => l.poNumber === poNum || String(l.poNumber) === String(r.poId));
        statusKey = mapPoStatusToQcStatus(log?.status);
      } catch (_) {}
    }
    if (!statusKey) {
      statusKey = mapPoStatusToQcStatus(r.po?.status);
    }
    if (!statusKey) return { text: 'Chưa Kiểm Định', bg: '#f1f5f9', color: '#64748b' };
    const info = getStatusInfo(QC_STATUS, statusKey);
    return { text: info.label, bg: info.bg, color: info.color, border: info.border };
  };

  // Single source of truth for a return/RMA item's display state — badge
  // label/color, action-button text/color, and whether warehouse may act on
  // it right now. Used by the returns table (badge + action button cells)
  // and the return-processing modal, so all three can never drift out of
  // sync the way three separate copies of this branching previously could.
  const getReturnStatusDisplay = (status) => {
    const st = status || 'PENDING';
    const qcApproved = ['QC_PASSED', 'VENDOR_WARRANTY'].includes(st);
    const alreadyShelved = ['RESTOCKED', 'EXCHANGED', 'EXCHANGE_NEW', 'INSPECTED_SCRAP'].includes(st);
    const isVendor = st === 'VENDOR_WARRANTY';
    const isScrap = st === 'INSPECTED_SCRAP';
    const isReject = ['REJECTED', 'REJECT_RMA'].includes(st);
    const isExchanged = ['EXCHANGE_NEW', 'EXCHANGED'].includes(st);
    const isRestockedDone = st === 'RESTOCKED' || (alreadyShelved && !isVendor && !isScrap && !isExchanged);

    let label = 'Chờ QC Kiểm Định';
    let bg = '#fef3c7', color = '#b45309', border = '#fde68a';
    let actionText = 'Chờ QC (chưa thể xử lý)';
    let actionColor = '#94a3b8';

    if (isRestockedDone) {
      label = 'Đã Nhập Lại Kho'; bg = '#dcfce7'; color = '#15803d'; border = '#bbf7d0';
      actionText = 'Xem vị trí kệ'; actionColor = '#16a34a';
    } else if (isExchanged) {
      label = 'Đã Duyệt Đổi Mới'; bg = '#ede9fe'; color = '#6d28d9'; border = '#ddd6fe';
      actionText = 'Xem đổi mới'; actionColor = '#7c3aed';
    } else if (isVendor) {
      label = 'Chuyển Gửi Hãng BH'; bg = '#ffedd5'; color = '#c2410c'; border = '#fed7aa';
      actionText = qcApproved ? 'Xử Lý Gửi Hãng' : 'Chi tiết gửi hãng'; actionColor = '#d97706';
    } else if (isScrap) {
      label = 'Phế Phẩm / Kho Lỗi'; bg = '#ffe4e6'; color = '#be123c'; border = '#fecdd3';
      actionText = 'Xem kho lỗi'; actionColor = '#e11d48';
    } else if (isReject) {
      label = 'Từ Chối Bảo Hành'; bg = '#fee2e2'; color = '#dc2626'; border = '#fca5a5';
      actionText = 'Xem lý do'; actionColor = '#64748b';
    } else if (qcApproved) {
      // QC_PASSED and not yet shelved: this is the one state where warehouse
      // actually has something to do.
      actionText = 'Xử Lý Nhập Kho'; actionColor = '#2563eb';
    }

    const hasQcDecision = qcApproved || alreadyShelved || isReject;
    return { label, bg, color, border, actionText, actionColor, qcApproved, alreadyShelved, hasQcDecision, canShelveNow: qcApproved && !alreadyShelved };
  };

  const DELIVERY_RELEVANT_STATUSES = [...PENDING_DELIVERY_STATUSES, 'SHIPPED', 'OUT_FOR_DELIVERY', 'ASSIGNED', 'DELIVERED', 'COMPLETED'];
  const deliveryShipperOptions = [...new Set(
    orders.filter(o => DELIVERY_RELEVANT_STATUSES.includes(o.status) && o.assignedShipper).map(o => o.assignedShipper)
  )].sort();
  const filteredDeliveriesList = orders.filter(o => {
    const matchSearch = !deliverySearch.trim() || String(o.orderId || o.id).toLowerCase().includes(deliverySearch.toLowerCase()) || (o.customerName && o.customerName.toLowerCase().includes(deliverySearch.toLowerCase()));
    const matchStatus = deliveryFilter === 'ALL' ||
      (deliveryFilter === 'PENDING' && PENDING_DELIVERY_STATUSES.includes(o.status)) ||
      (deliveryFilter === 'SHIPPED' && ['SHIPPED', 'OUT_FOR_DELIVERY', 'ASSIGNED'].includes(o.status)) ||
      (deliveryFilter === 'DELIVERED' && ['DELIVERED', 'COMPLETED'].includes(o.status)) ||
      (deliveryFilter === 'AWAITING_STOCK' && o.status === 'AWAITING_STOCK') ||
      (deliveryFilter === 'CANCELLED' && o.status === 'CANCELLED') ||
      (deliveryFilter === 'FAILED_DELIVERY' && o.status === 'FAILED_DELIVERY');
    const matchShipper = deliveryShipperFilter === 'ALL' ||
      (deliveryShipperFilter === 'UNASSIGNED' && !o.assignedShipper) ||
      o.assignedShipper === deliveryShipperFilter;
    return matchSearch && matchStatus && matchShipper;
  });

  const filteredHistoryList = effectiveStockMovements.filter(m => {
    const matchSearch = !historySearch.trim() || (m.productName && m.productName.toLowerCase().includes(historySearch.toLowerCase())) || (m.reference && m.reference.toLowerCase().includes(historySearch.toLowerCase()));
    const matchType = movementTypeFilter === 'ALL' || m.type === movementTypeFilter;
    const matchDate = isDateInRange(m.timestamp, historyStartDate, historyEndDate);
    return matchSearch && matchType && matchDate;
  });

  // Backorders List (Orders with AWAITING_STOCK status)
  const backorderOrders = orders.filter(o => o && o.status === 'AWAITING_STOCK');
  // Shared with the table row rendering below (which recomputes the same per-item
  // breakdown for display) so the filter and the badges never disagree.
  const isOrderFulfillable = (order) => (order.items || []).every(item => {
    const inv = (inventory || []).find(i => String(i.id) === String(item.productId || item.id));
    const currentStock = inv ? Number(inv.stock) : 0;
    return currentStock >= (Number(item.quantity) || 1);
  });
  const filteredBackordersList = backorderOrders.filter(o => {
    const matchSearch = !backorderSearch.trim() ||
      String(o.orderId || o.id).toLowerCase().includes(backorderSearch.toLowerCase()) ||
      (o.customerName && o.customerName.toLowerCase().includes(backorderSearch.toLowerCase())) ||
      (o.items && o.items.some(i => (i.name || i.productName || '').toLowerCase().includes(backorderSearch.toLowerCase())));
    const matchStock = backorderStockFilter === 'ALL' ||
      (backorderStockFilter === 'READY' && isOrderFulfillable(o)) ||
      (backorderStockFilter === 'MISSING' && !isOrderFulfillable(o));
    return matchSearch && matchStock;
  });

  // RMA Returns Classification & Filtering
  const isReturnProcessed = (item) => {
    const st = item?.status || 'PENDING';
    return ['QC_PASSED', 'RESTOCKED', 'APPROVED', 'VENDOR_WARRANTY', 'INSPECTED_SCRAP', 'EXCHANGE_NEW', 'EXCHANGED', 'REJECTED', 'REJECT_RMA'].includes(st);
  };

  const pendingReturnsList = effectiveReturnRequests.filter(item => !isReturnProcessed(item));
  const processedReturnsList = effectiveReturnRequests.filter(item => isReturnProcessed(item));

  const filteredReturnsList = effectiveReturnRequests.filter(item => {
    const processed = isReturnProcessed(item);
    const st = item?.status || 'PENDING';

    // 1. Tab filter
    if (returnStatusTab === 'PENDING' && processed) return false;
    if (returnStatusTab === 'PROCESSED' && !processed) return false;

    // 2. Specific status dropdown filter
    if (returnSpecificStatus !== 'ALL') {
      if (returnSpecificStatus === 'PENDING' && processed) return false;
      if (returnSpecificStatus === 'RESTOCKED' && !['QC_PASSED', 'RESTOCKED', 'APPROVED'].includes(st)) return false;
      if (returnSpecificStatus === 'EXCHANGE' && !['EXCHANGE_NEW', 'EXCHANGED'].includes(st)) return false;
      if (returnSpecificStatus === 'VENDOR' && st !== 'VENDOR_WARRANTY') return false;
      if (returnSpecificStatus === 'SCRAP' && st !== 'INSPECTED_SCRAP') return false;
      if (returnSpecificStatus === 'REJECTED' && !['REJECTED', 'REJECT_RMA'].includes(st)) return false;
    }

    // 3. Search query
    if (returnSearch.trim()) {
      const q = returnSearch.toLowerCase().trim();
      const rmaCode = String(item.rmaNumber || item.code || (item.id ? `RET-${String(item.id).padStart(3, '0')}` : '')).toLowerCase();
      const ordCode = String(item.orderId || item.orderNumber || '').toLowerCase();
      const prod = String(item.productName || item.product?.name || (typeof item.product === 'string' ? item.product : '') || item.items?.[0]?.name || '').toLowerCase();
      const cust = String(item.customerName || item.customer?.fullname || item.customer?.name || (typeof item.customer === 'string' ? item.customer : '') || '').toLowerCase();
      const phone = String(item.customerPhone || item.phone || item.customer?.phone || '').toLowerCase();
      const reason = String(item.reason || item.description || item.note || '').toLowerCase();

      const match = rmaCode.includes(q) || ordCode.includes(q) || prod.includes(q) || cust.includes(q) || phone.includes(q) || reason.includes(q);
      if (!match) return false;
    }

    return true;
  });

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Notification Bar */}
      <div style={{ marginBottom: '1.25rem' }}>
        <ActorNotificationBar />
      </div>

      {/* 1. VIEW: TỔNG QUAN TỒN KHO */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Tổng Quan Tồn Kho
            </h2>
          </div>

          {(usingSampleReceipts || usingSampleReturns || usingSampleMovements) && (
            <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px', padding: '0.65rem 0.9rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: '#854d0e', fontWeight: 600 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              Một số số liệu bên dưới là <strong>dữ liệu minh họa</strong> (chưa có phiếu nhập kho/trả hàng/lịch sử thật nào trong hệ thống).
            </div>
          )}

          {/* Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            
            {/* Card 1: Phiếu nhập kho */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              padding: '1.25rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0284c7', margin: '0 0 1rem 0' }}>
                  Phiếu nhập kho
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    onClick={() => setActiveTab('grn')}
                    style={{
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {readyReceipts.length} Cần nhập
                  </button>
                  <div style={{ fontSize: '0.82rem', color: '#475569', textAlign: 'right' }}>
                    <div>Trễ: <strong style={{ color: '#0f172a' }}>0</strong></div>
                    <div>Hoạt động: <strong style={{ color: '#0f172a' }}>{receipts.length}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Lệnh giao hàng */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              padding: '1.25rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0284c7', margin: '0 0 1rem 0' }}>
                  Lệnh giao hàng
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    onClick={() => setActiveTab('delivery')}
                    style={{
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {pendingDeliveriesCount} Cần xuất
                  </button>
                  <div style={{ fontSize: '0.82rem', color: '#475569', textAlign: 'right' }}>
                    <div>Trễ: <strong style={{ color: '#0f172a' }}>0</strong></div>
                    <div>Hoạt động: <strong style={{ color: '#0f172a' }}>{orders.length}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Nhập kho trực tiếp */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              padding: '1.25rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0284c7', margin: '0 0 1rem 0' }}>
                  Nhập kho trực tiếp
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    onClick={() => setActiveTab('intake')}
                    style={{
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Mở
                  </button>
                  <div style={{ fontSize: '0.82rem', color: '#475569', textAlign: 'right' }}>
                    <div>Tổng sản phẩm: <strong style={{ color: '#0f172a' }}>{activeInventory.length}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Bổ sung hàng (RFQ Alert) */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              padding: '1.25rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0284c7', margin: '0 0 1rem 0' }}>
                  Bổ sung hàng
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    onClick={() => setActiveTab('rfq')}
                    style={{
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {restockNeededItems.length} Cần mua
                  </button>
                  <div style={{ fontSize: '0.82rem', color: '#475569', textAlign: 'right' }}>
                    <div>Hết hàng: <strong style={{ color: '#ef4444' }}>{outOfStockItems.length}</strong></div>
                    <div>Dưới ngưỡng: <strong style={{ color: '#d97706' }}>{lowStockItems.length}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 5: Hàng lỗi & Trả về */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              padding: '1.25rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0284c7', margin: '0 0 1rem 0' }}>
                  Hàng lỗi & Trả về
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    onClick={() => setActiveTab('returns')}
                    style={{
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Mở
                  </button>
                  <div style={{ fontSize: '0.82rem', color: '#475569', textAlign: 'right' }}>
                    <div>Chờ xử lý: <strong style={{ color: '#0f172a' }}>{(returnRequests || []).length}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 6: Đơn Chờ Hàng (Backorders) */}
            <div style={{
              borderRadius: '8px',
              border: backorderOrders.length > 0 ? '1.5px solid #fdba74' : '1px solid #cbd5e1',
              padding: '1.25rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              backgroundColor: backorderOrders.length > 0 ? '#fff7ed' : '#ffffff'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: backorderOrders.length > 0 ? '#c2410c' : '#0284c7', margin: '0 0 1rem 0' }}>
                  Đơn Hàng Chờ Nhập Kho
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    onClick={() => setActiveTab('backorders')}
                    style={{
                      backgroundColor: backorderOrders.length > 0 ? '#ea580c' : '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {backorderOrders.length} Đơn chờ hàng
                  </button>
                  <div style={{ fontSize: '0.82rem', color: '#475569', textAlign: 'right' }}>
                    <div>Linh kiện cần nhập: <strong style={{ color: '#dc2626' }}>{backorderOrders.reduce((s, o) => s + (o.items?.length || 1), 0)} SP</strong></div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW: QUẢN LÝ ĐƠN HÀNG CHỜ NHẬP KHO (BACKORDERS) - CLEAN ENTERPRISE UI */}
      {/* ========================================================================= */}
      {activeTab === 'backorders' && (
        <div>
          {/* Header Bar */}
          <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Quản Lý Đơn Hàng Chờ Nhập Kho
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                Danh sách các đơn hàng tạm giữ chỗ do thiếu tồn kho. Hệ thống tự động giải phóng đơn sang Chờ xuất kho khi hoàn tất nhập hàng PO.
              </p>
            </div>

            <button
              onClick={() => {
                const totalAwaiting = backorderOrders.length;
                if (totalAwaiting === 0) {
                  notify('Hiện tại không có đơn hàng nào đang chờ nhập hàng.', 'info');
                  return;
                }
                let resolvedCount = 0;
                backorderOrders.forEach(o => {
                  let canFulfill = true;
                  (o.items || []).forEach(item => {
                    const inv = activeInventory.find(i => String(i.id) === String(item.productId || item.id));
                    if (!inv || Number(inv.stock) < (Number(item.quantity) || 1)) canFulfill = false;
                  });
                  if (canFulfill) resolvedCount++;
                });

                if (resolvedCount > 0) {
                  notify(`Đã tìm thấy ${resolvedCount} đơn hàng đã có đủ tồn kho trong hệ thống. Bạn có thể nhấn nút "Đóng Gói Ngay" để tiếp tục xử lý.`, 'success');
                } else {
                  notify(`Đang có ${totalAwaiting} đơn chờ hàng. Các sản phẩm này hiện vẫn chưa đủ tồn kho. Vui lòng bấm "Đề Xuất Mua Hàng" để gửi yêu cầu cho phòng Mua Hàng.`, 'info');
                }
              }}
              style={{
                backgroundColor: '#ffffff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                padding: '0.55rem 1.1rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Kiểm Tra Lại Tồn Kho Hệ Thống
            </button>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', padding: '1.1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Đơn Hàng Chờ Xử Lý
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ea580c', marginTop: '0.25rem' }}>
                {backorderOrders.length} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>đơn</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '1.1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Mặt Hàng Thiếu Tồn Kho
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>
                {backorderOrders.reduce((sum, o) => {
                  const missingCount = (o.items || []).filter(item => {
                    const inv = (inventory || []).find(i => String(i.id) === String(item.productId || item.id));
                    return !inv || Number(inv.stock) < (Number(item.quantity) || 1);
                  }).length;
                  return sum + missingCount;
                }, 0)} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>sản phẩm</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '1.1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tổng Giá Trị Đơn Treo
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                {safeFormatPrice(backorderOrders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0))}
              </div>
            </div>
          </div>

          {/* Search Filter Bar */}
          <div style={{ backgroundColor: '#ffffff', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Tìm theo mã đơn hàng, tên khách hàng, tên linh kiện..."
              value={backorderSearch}
              onChange={e => setBackorderSearch(e.target.value)}
              style={{ flex: '1 1 260px', padding: '0.55rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
            <select
              value={backorderStockFilter}
              onChange={e => setBackorderStockFilter(e.target.value)}
              style={{ padding: '0.55rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            >
              <option value="ALL">Tất cả tình trạng tồn kho</option>
              <option value="READY">Đã đủ hàng (sẵn sàng đóng gói)</option>
              <option value="MISSING">Còn thiếu hàng</option>
            </select>
          </div>

          {/* Backorders Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem', width: '13%' }}>Mã Đơn Hàng</th>
                  <th style={{ padding: '0.75rem 1rem', width: '15%' }}>Khách Hàng</th>
                  <th style={{ padding: '0.75rem 1rem', width: '34%' }}>Tình Trạng Linh Kiện & Tồn Kho</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', width: '12%' }}>Tổng Tiền</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', width: '13%' }}>Trạng Thái</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', width: '13%' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredBackordersList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Hiện tại không có đơn hàng nào cần nhập kho.</div>
                      <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Tất cả các đơn hàng đều đã có đủ tồn kho khả dụng để xuất giao.</div>
                    </td>
                  </tr>
                ) : (
                  filteredBackordersList.map((order, idx) => {
                    const orderItems = order.items || [];
                    
                    // Evaluate availability of each item
                    const evaluatedItems = orderItems.map(item => {
                      const invItem = (inventory || []).find(inv => String(inv.id) === String(item.productId || item.id));
                      const currentStock = invItem ? Number(invItem.stock) : 0;
                      const neededQty = Number(item.quantity) || 1;
                      const isOutOfStock = currentStock < neededQty;
                      const shortage = Math.max(0, neededQty - currentStock);
                      return {
                        ...item,
                        currentStock,
                        neededQty,
                        isOutOfStock,
                        shortage
                      };
                    });

                    const allFulfilled = evaluatedItems.every(i => !i.isOutOfStock);
                    const missingItems = evaluatedItems.filter(i => i.isOutOfStock);

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        {/* Order Code & Date */}
                        <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 800, color: '#2563eb', fontSize: '0.9rem' }}>
                            #{order.orderId || order.id}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                            {order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : '18/08/2026'}
                          </div>
                        </td>

                        {/* Customer Info */}
                        <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                            {order.customerName || 'Khách Hàng'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                            {order.phone || '090xxxxxxx'}
                          </div>
                        </td>

                        {/* Items Breakdown */}
                        <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {evaluatedItems.map((it, iIdx) => (
                              <div
                                key={iIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.45rem 0.75rem',
                                  borderRadius: '6px',
                                  backgroundColor: it.isOutOfStock ? '#fef2f2' : '#f8fafc',
                                  border: `1px solid ${it.isOutOfStock ? '#fecaca' : '#e2e8f0'}`
                                }}
                              >
                                <div style={{ flex: '1 1 auto', minWidth: 0, paddingRight: '0.75rem' }}>
                                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.3' }}>
                                    {it.name || it.productName || 'Linh Kiện Máy Tính'}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.1rem' }}>
                                    Yêu cầu: <strong>{it.neededQty}</strong> · Tồn kho: <strong>{it.currentStock}</strong>
                                  </div>
                                </div>

                                <div style={{ flexShrink: 0 }}>
                                  {it.isOutOfStock ? (
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.72rem',
                                      fontWeight: 800,
                                      backgroundColor: '#fee2e2',
                                      color: '#b91c1c',
                                      border: '1px solid #fca5a5',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      Thiếu {it.shortage} SP
                                    </span>
                                  ) : (
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      backgroundColor: '#f1f5f9',
                                      color: '#475569',
                                      border: '1px solid #cbd5e1',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      Đủ hàng
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Total Amount */}
                        <td style={{ padding: '1rem', textAlign: 'right', verticalAlign: 'middle', fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>
                          {safeFormatPrice(order.totalAmount)}
                        </td>

                        {/* Stock Status Badge */}
                        <td style={{ padding: '1rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          {allFulfilled ? (
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                              display: 'inline-block'
                            }}>
                              Đã Đủ Hàng
                            </span>
                          ) : (
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              backgroundColor: '#ffedd5',
                              color: '#c2410c',
                              border: '1px solid #fed7aa',
                              display: 'inline-block'
                            }}>
                              Thiếu {missingItems.length} Linh Kiện
                            </span>
                          )}
                        </td>

                        {/* Actions Column */}
                        <td style={{ padding: '1rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxWidth: '150px', margin: '0 auto' }}>
                            {allFulfilled ? (
                              <button
                                onClick={() => handleFulfillBackorder(order)}
                                title="Chuyển đơn sang khâu đóng gói"
                                style={{
                                  backgroundColor: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '5px',
                                  padding: '0.45rem 0.5rem',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  width: '100%',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                Đóng Gói Ngay
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenBackorderRfqModal(order, missingItems[0] || orderItems[0])}
                                title="Đề xuất Phòng Mua Hàng tạo yêu cầu báo giá (RFQ)"
                                style={{
                                  backgroundColor: '#2563eb',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '5px',
                                  padding: '0.45rem 0.5rem',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  width: '100%',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                Đề Xuất RFQ
                              </button>
                            )}

                            <button
                              onClick={() => setSelectedOrderForDetail(order)}
                              style={{
                                backgroundColor: '#ffffff',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                borderRadius: '5px',
                                padding: '0.4rem 0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                width: '100%',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Xem Chi Tiết
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. VIEW: HOẠT ĐỘNG > PHIẾU NHẬP KHO (GRN) */}
      {activeTab === 'grn' && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Hoạt Động / Phiếu Nhập Kho
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
              Tiếp nhận lô hàng từ Nhà cung cấp sau khi đã nghiệm thu QA/QC
            </p>
          </div>

          {usingSampleReceipts && (
            <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px', padding: '0.65rem 0.9rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: '#854d0e', fontWeight: 600 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              Chưa có phiếu nhập kho thật nào — danh sách bên dưới là <strong>dữ liệu minh họa</strong>.
            </div>
          )}

          {/* Filter bar */}
          <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Tìm theo mã phiếu nhập GRN, mã PO..."
              value={receiptSearch}
              onChange={(e) => setReceiptSearch(e.target.value)}
              style={{ flex: 1, minWidth: '220px', padding: '0.55rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
            <select
              value={receiptStatusFilter}
              onChange={(e) => setReceiptStatusFilter(e.target.value)}
              style={{ padding: '0.55rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="READY">Chờ nhập kho</option>
              <option value="DONE">Đã nhập kho</option>
            </select>
          </div>

          {/* Receipts Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Mã Phiếu GRN</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Mã Đơn PO</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Nhà Cung Cấp</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Ngày Khởi Tạo</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Trạng Thái QA/QC</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Trạng Thái Kho</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceiptsList.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      Không có phiếu nhập kho nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredReceiptsList.map(r => (
                    <tr 
                      key={r.id} 
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => setSelectedReceipt(r)}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#2563eb' }}>{r.receiptNumber}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>{r.po?.poNumber || r.poId || '---'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{r.po?.supplier?.name || r.supplierName || 'Intel Vietnam'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{formatDateTime ? formatDateTime(r.createdAt) : new Date(r.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        {(() => {
                          const qcBadge = getReceiptQcBadge(r);
                          return (
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: qcBadge.bg, color: qcBadge.color }}>
                              {qcBadge.text}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700,
                          backgroundColor: r.status === 'DONE' ? '#dcfce7' : '#fef3c7',
                          color: r.status === 'DONE' ? '#15803d' : '#d97706'
                        }}>
                          {r.status === 'DONE' ? 'Đã Nhập Kho' : 'Chờ Nhập Kho'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedReceipt(r); }}
                          style={{
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.35rem 0.85rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Xem Chi Tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. VIEW: HOẠT ĐỘNG > LỆNH GIAO HÀNG (DELIVERY) */}
      {activeTab === 'delivery' && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Hoạt Động / Lệnh Giao Hàng
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
              Kiểm tra đóng gói, quét mã sản phẩm và phân công nhân viên Shipper giao hàng
            </p>
          </div>

          {/* Filter bar */}
          <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Tìm theo mã đơn hàng ORD, tên khách hàng..."
              value={deliverySearch}
              onChange={(e) => setDeliverySearch(e.target.value)}
              style={{ flex: 1, minWidth: '220px', padding: '0.55rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
            <select
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
              style={{ padding: '0.55rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            >
              <option value="PENDING">Chờ xuất kho & bàn giao</option>
              <option value="SHIPPED">Đang giao hàng</option>
              <option value="DELIVERED">Đã giao hàng thành công</option>
              <option value="AWAITING_STOCK">Đang chờ hàng</option>
              <option value="CANCELLED">Đã hủy</option>
              <option value="FAILED_DELIVERY">Giao thất bại</option>
              <option value="ALL">Tất cả đơn hàng</option>
            </select>
            <select
              value={deliveryShipperFilter}
              onChange={(e) => setDeliveryShipperFilter(e.target.value)}
              style={{ padding: '0.55rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            >
              <option value="ALL">Tất cả Shipper</option>
              <option value="UNASSIGNED">Chưa phân công</option>
              {deliveryShipperOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Delivery Orders Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Mã Đơn Hàng</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Khách Hàng</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Địa Chỉ Giao</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Giá Trị Đơn</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Shipper Đảm Nhận</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Tiến Trình & Trạng Thái</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Hành Động Nghiệp Vụ</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveriesList.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      Không có lệnh giao hàng nào trong danh sách.
                    </td>
                  </tr>
                ) : (
                  filteredDeliveriesList.map(o => {
                    const isPendingPack = ['CONFIRMED', 'PROCESSING', 'PENDING', 'AWAITING_SHIP'].includes(o.status);
                    const isPackedWaitingShipper = ['PACKED', 'READY_TO_SHIP'].includes(o.status);
                    const isShipping = ['SHIPPED', 'OUT_FOR_DELIVERY', 'ASSIGNED'].includes(o.status);
                    const isDelivered = ['DELIVERED', 'COMPLETED'].includes(o.status);
                    // Only reachable when deliveryFilter === 'ALL' — none of the 4 buckets above
                    // include these, so without this the progress badge and action button were
                    // silently blank for every cancelled/failed order in the "all orders" view.
                    const isCancelled = o.status === 'CANCELLED';
                    const isFailedDelivery = o.status === 'FAILED_DELIVERY';
                    const isAwaitingStock = o.status === 'AWAITING_STOCK';

                    return (
                      <tr key={o.id || o.orderId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#2563eb' }}>
                          #{o.orderId || o.id}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#0f172a' }}>
                          <div style={{ fontWeight: 700 }}>{o.customerName || 'Khách hàng'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{o.phone || o.customerPhone || '090xxxxxxx'}</div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#475569', maxWidth: '240px' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {o.shippingAddress || o.address || 'TP. Hồ Chí Minh'}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                          {safeFormatPrice(o.totalAmount || o.total || 0)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#334155' }}>
                          {isShipping || isDelivered ? (
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>
                              {o.assignedShipper || 'Shipper Nội Bộ'}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                              {isPackedWaitingShipper ? 'Chưa phân công' : '---'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          {isPendingPack && (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              backgroundColor: '#fff7ed',
                              color: '#c2410c',
                              border: '1px solid #fdba74'
                            }}>
                              Chờ Đóng Gói
                            </span>
                          )}

                          {isPackedWaitingShipper && (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              backgroundColor: '#f5f3ff',
                              color: '#6d28d9',
                              border: '1px solid #ddd6fe'
                            }}>
                              Đã Đóng Gói
                            </span>
                          )}

                          {isShipping && (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe'
                            }}>
                              Đang Giao Hàng
                            </span>
                          )}

                          {isDelivered && (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              backgroundColor: '#f0fdf4',
                              color: '#15803d',
                              border: '1px solid #bbf7d0'
                            }}>
                              Đã Giao Hàng
                            </span>
                          )}

                          {isCancelled && (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              backgroundColor: '#f1f5f9',
                              color: '#64748b',
                              border: '1px solid #cbd5e1'
                            }}>
                              Đã Hủy
                            </span>
                          )}

                          {isFailedDelivery && (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              backgroundColor: '#fef2f2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca'
                            }}>
                              Giao Thất Bại
                            </span>
                          )}

                          {isAwaitingStock && (
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              backgroundColor: '#fff7ed',
                              color: '#c2410c',
                              border: '1px solid #fdba74'
                            }}>
                              Chờ Hàng
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}>
                            {isPendingPack && (
                              canPackScan ? (
                                <button
                                  onClick={() => setPackScanOrder(o)}
                                  style={{
                                    backgroundColor: '#1d4ed8',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '5px',
                                    padding: '0.45rem 0.85rem',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Đóng Gói & Quét Mã
                                </button>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span style={{ fontSize: '0.74rem', color: '#c2410c', fontWeight: 600, backgroundColor: '#fff7ed', padding: '0.35rem 0.65rem', borderRadius: '4px', border: '1px solid #fed7aa' }}>
                                    Chờ Thủ kho đóng gói
                                  </span>
                                  <button
                                    onClick={() => setSelectedOrderForDetail(o)}
                                    style={{
                                      backgroundColor: '#ffffff',
                                      color: '#475569',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '5px',
                                      padding: '0.45rem 0.65rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Xem Đơn
                                  </button>
                                </div>
                              )
                            )}

                            {isPackedWaitingShipper && (
                              canDispatch ? (
                                <>
                                  <button
                                    onClick={() => setOrderToAssign(o)}
                                    style={{
                                      backgroundColor: '#6d28d9',
                                      color: '#ffffff',
                                      border: 'none',
                                      borderRadius: '5px',
                                      padding: '0.45rem 0.85rem',
                                      fontSize: '0.78rem',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Phân Công Shipper
                                  </button>
                                  <button
                                    onClick={() => setSelectedOrderForDetail(o)}
                                    style={{
                                      backgroundColor: '#ffffff',
                                      color: '#475569',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '5px',
                                      padding: '0.45rem 0.65rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Xem Gói Hàng
                                  </button>
                                </>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span style={{ fontSize: '0.74rem', color: '#6d28d9', fontWeight: 600, backgroundColor: '#f5f3ff', padding: '0.35rem 0.65rem', borderRadius: '4px', border: '1px solid #ddd6fe' }}>
                                    Chờ Quản lý phân công
                                  </span>
                                  <button
                                    onClick={() => setSelectedOrderForDetail(o)}
                                    style={{
                                      backgroundColor: '#ffffff',
                                      color: '#475569',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '5px',
                                      padding: '0.45rem 0.65rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Xem Gói Hàng
                                  </button>
                                </div>
                              )
                            )}

                            {isAwaitingStock && (
                              <button
                                onClick={() => setActiveTab('backorders')}
                                style={{
                                  backgroundColor: '#fff7ed',
                                  color: '#c2410c',
                                  border: '1px solid #fdba74',
                                  borderRadius: '5px',
                                  padding: '0.45rem 0.65rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer'
                                }}
                              >
                                Xem Chờ Hàng
                              </button>
                            )}

                            {(isShipping || isDelivered || isCancelled || isFailedDelivery) && (
                              <button
                                onClick={() => setSelectedOrderForDetail(o)}
                                style={{
                                  backgroundColor: '#ffffff',
                                  color: '#475569',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '5px',
                                  padding: '0.45rem 0.65rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                Xem Chi Tiết
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. VIEW: HOẠT ĐỘNG > NHẬP TRỰC TIẾP (INTAKE) */}
      {activeTab === 'intake' && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Hoạt Động / Nhập Kho Trực Tiếp
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
              Tạo phiếu nhập trực tiếp bổ sung số lượng tồn kho không qua đơn mua PO
            </p>
          </div>

          {!canStockIntake && (
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>
              Bạn không có quyền nhập kho trực tiếp — chỉ Quản Lý Kho / CEO / Quản Trị mới thực hiện được thao tác này.
            </div>
          )}

          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1.5rem', opacity: canStockIntake ? 1 : 0.6 }}>
            <fieldset disabled={!canStockIntake} style={{ border: 'none', padding: 0, margin: 0 }}>
            <form onSubmit={handleDirectIntakeSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                    Chọn sản phẩm nhập kho *
                  </label>
                  <select
                    value={directProduct}
                    onChange={(e) => setDirectProduct(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  >
                    <option value="">-- Chọn sản phẩm --</option>
                    {activeInventory.map(prod => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name} (Tồn hiện tại: {prod.stock})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                    Số lượng nhập bổ sung *
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Nhập số lượng..."
                    value={directQty}
                    onChange={(e) => setDirectQty(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                    Vị trí lưu kho (Kệ / Bin)
                  </label>
                  <select
                    value={directLocation}
                    onChange={(e) => setDirectLocation(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  >
                    {PREDEFINED_LOCATIONS.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                    Mã tham chiếu / Số chứng từ
                  </label>
                  <input
                    type="text"
                    placeholder="VD: INT-2026-001"
                    value={directRef}
                    onChange={(e) => setDirectRef(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                  Ghi chú chi tiết / Lý do điều chỉnh
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi rõ lý do nhập bổ sung hoặc kiểm kê thừa..."
                  value={directNote}
                  onChange={(e) => setDirectNote(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                  Serial Number ({directSerials.split(/[\n,]/).map(s => s.trim()).filter(Boolean).length}/{parseInt(directQty, 10) || 0} mã) *
                </label>
                <textarea
                  rows={3}
                  placeholder="Mỗi dòng 1 Serial Number, số dòng phải khớp đúng số lượng nhập..."
                  value={directSerials}
                  onChange={(e) => setDirectSerials(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.8rem', fontFamily: 'monospace', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.6rem 1.5rem',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Xác Nhận Nhập Kho Trực Tiếp
              </button>
            </form>
            </fieldset>
          </div>
        </div>
      )}

      {/* 5. VIEW: HOẠT ĐỘNG > BỔ SUNG HÀNG (RFQ) */}
      {activeTab === 'rfq' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Hoạt Động / Mua Sắm & Bổ Sung Hàng
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                Quản lý danh sách linh kiện chạm ngưỡng tồn kho an toàn và gửi cảnh báo YCBG
              </p>
            </div>
            <button
              onClick={() => setShowRfqHistoryModal(true)}
              style={{
                backgroundColor: '#ffffff',
                color: '#2563eb',
                border: '1px solid #2563eb',
                borderRadius: '6px',
                padding: '0.5rem 1.25rem',
                fontSize: '0.83rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Lịch Sử Cảnh Báo ({rfqAlertLogs.length})
            </button>
          </div>

          {/* Filter bar */}
          <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Tìm theo tên sản phẩm, nhà cung cấp..."
              value={rfqSearch}
              onChange={(e) => setRfqSearch(e.target.value)}
              style={{ flex: 1, minWidth: '220px', padding: '0.55rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
            <select
              value={rfqSupplierFilter}
              onChange={(e) => setRfqSupplierFilter(e.target.value)}
              style={{ padding: '0.55rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            >
              <option value="ALL">Tất cả nhà cung cấp</option>
              {rfqSupplierOptions.map(sup => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
            <select
              value={rfqStockStatusFilter}
              onChange={(e) => setRfqStockStatusFilter(e.target.value)}
              style={{ padding: '0.55rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="OUT_OF_STOCK">Hết Hàng</option>
              <option value="LOW_STOCK">Cảnh Báo Tồn</option>
            </select>
          </div>

          {/* Low stock table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Sản Phẩm</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Nhà Cung Cấp</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Tồn Hiện Tại</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Ngưỡng An Toàn</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Trạng Thái</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {filteredRfqItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      {restockNeededItems.length === 0
                        ? 'Tất cả sản phẩm đều đang ở mức tồn kho an toàn!'
                        : 'Không tìm thấy sản phẩm nào khớp bộ lọc.'}
                    </td>
                  </tr>
                ) : (
                  filteredRfqItems.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>{item.name}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{item.supplier}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 800, color: Number(item.stock) === 0 ? '#ef4444' : '#d97706' }}>
                        {item.stock} SP
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#64748b' }}>{item.threshold || 5} SP</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700,
                          backgroundColor: Number(item.stock) === 0 ? '#ffe4e6' : '#fef3c7',
                          color: Number(item.stock) === 0 ? '#e11d48' : '#d97706'
                        }}>
                          {Number(item.stock) === 0 ? 'Hết Hàng' : 'Cảnh Báo Tồn'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <button
                          onClick={() => setLowStockRfqModalData({ item, qty: (item.threshold || 5) * 2, reason: 'Tồn kho chạm ngưỡng tối thiểu' })}
                          style={{
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.35rem 0.85rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Gửi Cảnh Báo RFQ
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. VIEW: HOẠT ĐỘNG > HÀNG LỖI & TRẢ VỀ (RETURNS) */}
      {activeTab === 'returns' && (
        <div>
          {/* Header Title */}
          <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Hoạt Động / Hàng Lỗi & Trả Về</span>
                <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 800, backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                  {effectiveReturnRequests.length} Hồ Sơ
                </span>
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                Tiếp nhận linh kiện trả về từ khách hàng, kiểm định lỗi kỹ thuật, phân luồng lưu trữ kệ kho (A1/B3/C2/D) và chuyển tiếp hoàn tiền hoặc đổi mới.
              </p>
              {usingSampleReturns && (
                <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px', padding: '0.5rem 0.8rem', marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.76rem', color: '#854d0e', fontWeight: 600 }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  Chưa có hồ sơ trả hàng thật nào — danh sách bên dưới là dữ liệu minh họa.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => window.location.href = '/admin/quality-control?tab=returns'}
                style={{
                  backgroundColor: '#f5f3ff',
                  color: '#7c3aed',
                  border: '1px solid #ddd6fe',
                  borderRadius: '6px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>Màn Hình QC Thẩm Định</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.href = '/admin/accountant?tab=refunds'}
                style={{
                  backgroundColor: '#ecfdf5',
                  color: '#15803d',
                  border: '1px solid #a7f3d0',
                  borderRadius: '6px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>Phòng Kế Toán (Hoàn Tiền)</span>
              </button>
            </div>
          </div>

          {/* 3 KPI Summary Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            
            {/* Card 1: Tất Cả */}
            <div
              onClick={() => { setReturnStatusTab('ALL'); setReturnSpecificStatus('ALL'); }}
              style={{
                backgroundColor: returnStatusTab === 'ALL' ? '#eff6ff' : '#ffffff',
                borderRadius: '10px',
                border: returnStatusTab === 'ALL' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                padding: '1rem 1.25rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: returnStatusTab === 'ALL' ? '0 4px 12px rgba(37, 99, 235, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                  TỔNG HỒ SƠ ĐỔI TRẢ (RMA)
                </span>
                <span style={{ backgroundColor: '#e2e8f0', color: '#334155', fontSize: '0.72rem', fontWeight: 800, padding: '2px 7px', borderRadius: '10px' }}>
                  Tất cả
                </span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 850, color: '#0f172a', marginTop: '0.35rem' }}>
                {effectiveReturnRequests.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                Toàn bộ kiện hàng khách hàng và giao vận đã gửi về
              </div>
            </div>

            {/* Card 2: Đang Xử Lý */}
            <div
              onClick={() => { setReturnStatusTab('PENDING'); setReturnSpecificStatus('ALL'); }}
              style={{
                backgroundColor: returnStatusTab === 'PENDING' ? '#fffbeb' : '#ffffff',
                borderRadius: '10px',
                border: returnStatusTab === 'PENDING' ? '2px solid #d97706' : '1px solid #fde68a',
                padding: '1rem 1.25rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: returnStatusTab === 'PENDING' ? '0 4px 12px rgba(217, 119, 6, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>ĐANG XỬ LÝ (CHỜ NHẬP KHO)</span>
                </span>
                <span style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontSize: '0.72rem', fontWeight: 800, padding: '2px 7px', borderRadius: '10px' }}>
                  Cần xử lý ngay
                </span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 850, color: '#d97706', marginTop: '0.35rem' }}>
                {pendingReturnsList.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '0.2rem' }}>
                Kiện hàng đang chờ QC thẩm định & thủ kho phân luồng xếp kệ
              </div>
            </div>

            {/* Card 3: Đã Xử Lý */}
            <div
              onClick={() => { setReturnStatusTab('PROCESSED'); setReturnSpecificStatus('ALL'); }}
              style={{
                backgroundColor: returnStatusTab === 'PROCESSED' ? '#f0fdf4' : '#ffffff',
                borderRadius: '10px',
                border: returnStatusTab === 'PROCESSED' ? '2px solid #16a34a' : '1px solid #bbf7d0',
                padding: '1rem 1.25rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: returnStatusTab === 'PROCESSED' ? '0 4px 12px rgba(22, 163, 74, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>ĐÃ XỬ LÝ (ĐÃ VÀO KỆ LƯU TRỮ)</span>
                </span>
                <span style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', fontSize: '0.72rem', fontWeight: 800, padding: '2px 7px', borderRadius: '10px' }}>
                  Hoàn tất
                </span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 850, color: '#16a34a', marginTop: '0.35rem' }}>
                {processedReturnsList.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '0.2rem' }}>
                Đã phân vào Kệ A1/B3 (Bán lại), C2 (Gửi hãng), D (Xác lỗi) & chuyển tiếp
              </div>
            </div>

          </div>

          {/* Filter & Toolbar Control Bar */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            
            {/* Segmented Filter Buttons (Phân Luồng Chính) */}
            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '3px' }}>
              <button
                type="button"
                onClick={() => setReturnStatusTab('ALL')}
                style={{
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: returnStatusTab === 'ALL' ? 800 : 600,
                  backgroundColor: returnStatusTab === 'ALL' ? '#ffffff' : 'transparent',
                  color: returnStatusTab === 'ALL' ? '#0f172a' : '#64748b',
                  boxShadow: returnStatusTab === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>Tất Cả</span>
                <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '10px', backgroundColor: returnStatusTab === 'ALL' ? '#e2e8f0' : '#e2e8f0', color: '#334155' }}>
                  {effectiveReturnRequests.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReturnStatusTab('PENDING')}
                style={{
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: returnStatusTab === 'PENDING' ? 800 : 600,
                  backgroundColor: returnStatusTab === 'PENDING' ? '#ffffff' : 'transparent',
                  color: returnStatusTab === 'PENDING' ? '#b45309' : '#64748b',
                  boxShadow: returnStatusTab === 'PENDING' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>Đang Xử Lý</span>
                <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 800 }}>
                  {pendingReturnsList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReturnStatusTab('PROCESSED')}
                style={{
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: returnStatusTab === 'PROCESSED' ? 800 : 600,
                  backgroundColor: returnStatusTab === 'PROCESSED' ? '#ffffff' : 'transparent',
                  color: returnStatusTab === 'PROCESSED' ? '#15803d' : '#64748b',
                  boxShadow: returnStatusTab === 'PROCESSED' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>Đã Xử Lý</span>
                <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 800 }}>
                  {processedReturnsList.length}
                </span>
              </button>
            </div>

            {/* Search and Detail Dropdown Filters */}
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
              {/* Search Box */}
              <div style={{ position: 'relative', minWidth: '260px', maxWidth: '380px', flex: 1 }}>
                <input
                  type="text"
                  value={returnSearch}
                  onChange={(e) => setReturnSearch(e.target.value)}
                  placeholder="Tìm Mã RMA, Đơn gốc, Tên SP, Khách..."
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.8rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    backgroundColor: '#f8fafc',
                    boxSizing: 'border-box'
                  }}
                />
                {returnSearch && (
                  <button
                    type="button"
                    onClick={() => setReturnSearch('')}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Specific Status Dropdown */}
              <select
                value={returnSpecificStatus}
                onChange={(e) => setReturnSpecificStatus(e.target.value)}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">Tất cả trạng thái kiểm định</option>
                <option value="PENDING">Chờ QC Thẩm Định / Tiếp Nhận</option>
                <option value="RESTOCKED">Đã Nhập Lại Kho (Kệ A1/B3)</option>
                <option value="EXCHANGE">Đã Duyệt Đổi Mới 1-1</option>
                <option value="VENDOR">Chuyển Gửi Hãng BH (Kệ C2)</option>
                <option value="SCRAP">Phế Phẩm / Kho Lỗi (Kệ D)</option>
                <option value="REJECTED">Từ Chối Bảo Hành</option>
              </select>

              {(returnSearch || returnSpecificStatus !== 'ALL' || returnStatusTab !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setReturnStatusTab('ALL');
                    setReturnSearch('');
                    setReturnSpecificStatus('ALL');
                  }}
                  style={{
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.78rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Đặt lại
                </button>
              )}
            </div>

          </div>

          {/* Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Mã Yêu Cầu RMA</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Sản Phẩm Trả Về</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Khách Hàng</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Lý Do Đổi Trả</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Tiến Độ Xử Lý</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Trạng Thái Kiểm Định</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Ngày Tạo</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {filteredReturnsList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem', color: '#cbd5e1' }}><Box size={32} /></div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                        Không tìm thấy hồ sơ RMA nào phù hợp với bộ lọc hiện tại
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        Thử xóa từ khóa tìm kiếm hoặc chuyển sang nhóm "Tất Cả" để xem toàn bộ danh sách.
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setReturnStatusTab('ALL');
                          setReturnSearch('');
                          setReturnSpecificStatus('ALL');
                        }}
                        style={{
                          marginTop: '0.85rem',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          borderRadius: '6px',
                          padding: '0.45rem 1rem',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Hiển Thị Tất Cả ({effectiveReturnRequests.length} Hồ Sơ)
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredReturnsList.map((item, index) => {
                    const prodName = typeof item.productName === 'string'
                      ? item.productName
                      : (item.product?.name || (typeof item.product === 'string' ? item.product : item.items?.[0]?.name || (index % 2 === 0 ? 'RAM Corsair Vengeance RGB 32GB DDR5' : 'Màn hình Dell UltraSharp 27" 4K')));
                    const orderNum = item.orderId || item.orderNumber || item.orderCode || `ORD-${101 + index}`;
                    const qty = item.quantity || item.qty || 1;
                    const custName = typeof item.customerName === 'string'
                      ? item.customerName
                      : (item.customer?.fullname || item.customer?.name || (typeof item.customer === 'string' ? item.customer : 'Khách lẻ'));
                    const phone = typeof item.customerPhone === 'string'
                      ? item.customerPhone
                      : (item.phone || item.customer?.phone || '0908 123 456');
                    const reasonText = typeof item.reason === 'string'
                      ? item.reason
                      : (item.note || item.description || 'Lỗi sản phẩm / Yêu cầu bảo hành');
                    
                    let dateDisplay = '18/8/2026';
                    const rawDate = item.createdAt || item.date || item.createdDate || item.time;
                    if (rawDate) {
                      const d = new Date(rawDate);
                      if (!isNaN(d.getTime())) {
                        dateDisplay = formatDateTime ? formatDateTime(rawDate) : d.toLocaleDateString('vi-VN');
                      }
                    }

                    const st = item.status || 'PENDING';
                    const processed = isReturnProcessed(item);

                    return (
                      <tr
                        key={item.id || index}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: processed ? '#ffffff' : '#fffdf5',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        {/* Mã RMA */}
                        <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                          <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '0.88rem' }}>
                            {item.rmaNumber || item.code || (item.id ? `RET-${String(item.id).padStart(3, '0')}` : `RET-${String(index + 1).padStart(3, '0')}`)}
                          </span>
                        </td>

                        {/* Sản phẩm */}
                        <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                          <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.85rem' }}>{prodName}</strong>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Đơn hàng <strong>#{orderNum}</strong> | SL: {qty} SP</span>
                        </td>

                        {/* Khách hàng */}
                        <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                          <div style={{ color: '#0f172a', fontWeight: 700 }}>{custName}</div>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>SĐT: {phone}</span>
                        </td>

                        {/* Lý do đổi trả */}
                        <td style={{ padding: '0.85rem 1rem', color: '#475569', verticalAlign: 'middle', maxWidth: '240px' }}>
                          <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '0.8rem' }}>
                            {reasonText}
                          </span>
                        </td>

                        {/* Phân nhóm tiến độ: Đang Xử Lý vs Đã Xử Lý */}
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          {processed ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              backgroundColor: '#f0fdf4',
                              color: '#16a34a',
                              border: '1px solid #bbf7d0',
                              whiteSpace: 'nowrap'
                            }}>
                              <span>✓</span>
                              <span>Đã Xử Lý</span>
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              backgroundColor: '#fffbeb',
                              color: '#d97706',
                              border: '1px solid #fde68a',
                              whiteSpace: 'nowrap'
                            }}>
                              <span>Đang Xử Lý</span>
                            </span>
                          )}
                        </td>

                        {/* Trạng thái chi tiết */}
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          {(() => {
                            const rsd = getReturnStatusDisplay(st);
                            return (
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                backgroundColor: rsd.bg,
                                color: rsd.color,
                                border: `1px solid ${rsd.border}`,
                                display: 'inline-block',
                                whiteSpace: 'nowrap'
                              }}>
                                {rsd.label}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Ngày tạo */}
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.78rem', verticalAlign: 'middle' }}>
                          {dateDisplay}
                        </td>

                        {/* Hành động */}
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          {(() => {
                            const rsd = getReturnStatusDisplay(st);
                            return (
                              <button
                                onClick={() => {
                                  setSelectedReturnProcessing(item);
                                  setReturnShelfLocation(
                                    item.shelfLocation || (
                                      item.status === 'VENDOR_WARRANTY' ? 'SHELF_C2_VENDOR' :
                                      item.status === 'INSPECTED_SCRAP' ? 'SHELF_D_SCRAP' : 'SHELF_A1_RESTOCK'
                                    )
                                  );
                                  setReturnProcessNote(item.shelfNote || item.resolution || item.reason || 'Đã phân luồng vị trí kệ kho');
                                }}
                                disabled={!rsd.hasQcDecision}
                                title={!rsd.hasQcDecision ? 'Chưa qua kiểm định QC' : undefined}
                                style={{
                                  backgroundColor: rsd.actionColor,
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '0.45rem 0.9rem',
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  cursor: !rsd.hasQcDecision ? 'not-allowed' : 'pointer',
                                  opacity: !rsd.hasQcDecision ? 0.6 : 1,
                                  display: 'inline-block',
                                  minWidth: '120px',
                                  textAlign: 'center',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                              >
                                {rsd.actionText}
                              </button>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. VIEW: SẢN PHẨM > DANH SÁCH SẢN PHẨM (INVENTORY) */}
      {activeTab === 'inventory' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Sản Phẩm / Danh Sách Sản Phẩm
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                Quản lý danh mục tất cả linh kiện máy tính, giá niêm yết, vị trí kệ và ngưỡng Min-Max
              </p>
            </div>
            {isManager && (
              <button
                onClick={() => setShowAddProduct(true)}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.55rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                + Thêm Sản Phẩm Mới
              </button>
            )}
          </div>

          {/* Enhanced Filter Toolbar */}
          <div style={{
            backgroundColor: '#ffffff',
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            marginBottom: '1.25rem',
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1.8fr) minmax(140px, 1fr) minmax(160px, 1.2fr) minmax(170px, 1.2fr) minmax(130px, 1fr)',
            gap: '0.75rem',
            alignItems: 'center'
          }}>
            <input
              type="text"
              placeholder="Tìm theo tên linh kiện, nhà cung cấp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 0.85rem',
                fontSize: '0.83rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedSupplier('ALL');
              }}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 0.65rem',
                fontSize: '0.83rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">Tất cả phân nhóm</option>
              <option value="CPU">CPU</option>
              <option value="VGA">VGA</option>
              <option value="MAINBOARD">Mainboard</option>
              <option value="RAM">RAM</option>
              <option value="STORAGE">Storage</option>
              <option value="PSU">PSU</option>
              <option value="CASE">Case</option>
              <option value="COOLER">Cooler</option>
              <option value="MONITOR">Monitor</option>
              <option value="KEYBOARD">Keyboard</option>
              <option value="MOUSE">Mouse</option>
            </select>

            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 0.65rem',
                fontSize: '0.83rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">Tất cả nhà cung cấp ({availableSuppliers.length})</option>
              {availableSuppliers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 0.65rem',
                fontSize: '0.83rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">Tất cả trạng thái tồn ({countAllStock})</option>
              <option value="IN_STOCK">Còn hàng ({countInStock})</option>
              <option value="LOW_STOCK">Cảnh báo tồn ({countLowStock})</option>
              <option value="OUT_OF_STOCK">Hết hàng ({countOutOfStock})</option>
            </select>

            <select
              value={selectedLocationStatus}
              onChange={(e) => setSelectedLocationStatus(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 0.65rem',
                fontSize: '0.83rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">Tất cả vị trí kệ</option>
              <option value="ASSIGNED">Đã xếp kệ</option>
              <option value="UNASSIGNED">Chưa xếp kệ</option>
            </select>
          </div>

          {/* Inventory Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ width: '23%', padding: '0.75rem 1rem' }}>Tên Sản Phẩm</th>
                  <th style={{ width: '8%', padding: '0.75rem 0.85rem' }}>Phân Nhóm</th>
                  <th style={{ width: '16%', padding: '0.75rem 0.85rem' }}>Nhà Cung Cấp</th>
                  <th style={{ width: '13%', padding: '0.75rem 0.85rem', textAlign: 'center' }}>Vị Trí Kệ</th>
                  <th style={{ width: '8%', padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Tồn Hiện Tại</th>
                  <th style={{ width: '10%', padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Trạng Thái</th>
                  <th style={{ width: '10%', padding: '0.75rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Đơn Giá</th>
                  <th style={{ width: '12%', padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      Không tìm thấy sản phẩm nào.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(p => {
                    const stockNum = Number(p.stock) || 0;
                    const threshNum = Number(p.threshold || 5);
                    const isOutOfStock = stockNum === 0;
                    const isLowStock = stockNum > 0 && stockNum <= threshNum;

                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td
                          title={`${p.name} — Nhấn để xem chi tiết`}
                          onClick={() => { setEditingProd(p); setProductViewOnly(true); }}
                          style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#2563eb', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {p.name}
                        </td>
                        <td title={p.category} style={{ padding: '0.75rem 0.85rem', color: '#475569', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.category}</td>
                        <td title={p.supplier || ''} style={{ padding: '0.75rem 0.85rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.supplier || 'Chưa rõ'}</td>
                        <td title={p.location || ''} style={{ padding: '0.75rem 0.85rem', textAlign: 'center', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.location || 'Chưa xếp'}</td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap', color: isOutOfStock ? '#dc2626' : (isLowStock ? '#d97706' : '#0f172a') }}>
                          {stockNum}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {isOutOfStock ? (
                            <span style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.6rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#dc2626',
                              backgroundColor: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: '12px'
                            }}>
                              Hết hàng
                            </span>
                          ) : isLowStock ? (
                            <span style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.6rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#b45309',
                              backgroundColor: '#fffbeb',
                              border: '1px solid #fde68a',
                              borderRadius: '12px'
                            }}>
                              Cảnh báo tồn
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.6rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#15803d',
                              backgroundColor: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              borderRadius: '12px'
                            }}>
                              Còn hàng
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>
                          {safeFormatPrice(p.price)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => { setEditingProd(p); setProductViewOnly(false); }}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              backgroundColor: '#ffffff',
                              color: '#2563eb',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              padding: '0.3rem 0.4rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {isManager ? 'Chỉnh Sửa' : 'Xem Chi Tiết'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}





      {/* 10. VIEW: BÁO CÁO > LỊCH SỬ ĐIỀU CHUYỂN (HISTORY - WORKING & VIEWABLE) */}
      {activeTab === 'history' && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Báo Cáo / Lịch Sử Điều Chuyển Kho
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
              Nhật ký xuất nhập kho hai chiều ghi nhận tất cả biến động linh kiện (Nhấn vào bất kỳ dòng nào để xem chi tiết)
            </p>
          </div>

          {usingSampleMovements && (
            <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px', padding: '0.65rem 0.9rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: '#854d0e', fontWeight: 600 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              Chưa có lịch sử điều chuyển kho thật nào — danh sách bên dưới là <strong>dữ liệu minh họa</strong>.
            </div>
          )}

          {/* Filter Toolbar */}
          <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Tìm theo mã chứng từ GRN/ORD, tên sản phẩm..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              style={{ flex: 1, minWidth: '220px', padding: '0.55rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
            <select
              value={movementTypeFilter}
              onChange={(e) => setMovementTypeFilter(e.target.value)}
              style={{ padding: '0.55rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            >
              <option value="ALL">Tất cả loại dịch chuyển</option>
              <option value="IN">Nhập Kho (IN)</option>
              <option value="OUT">Xuất Kho (OUT)</option>
            </select>
          </div>

          {/* History Table with Full Click & Detail Viewer */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Thời Gian</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Loại Biến Động</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Mã Chứng Từ</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Sản Phẩm</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Số Lượng</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Người Thực Hiện</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistoryList.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      Chưa có nhật ký biến động kho nào.
                    </td>
                  </tr>
                ) : (
                  filteredHistoryList.map(mv => (
                    <tr 
                      key={mv.id} 
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => setSelectedMovementLog(mv)}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                        {formatDateTime ? formatDateTime(mv.timestamp) : new Date(mv.timestamp).toLocaleString('vi-VN')}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700,
                          backgroundColor: mv.type === 'IN' ? '#dcfce7' : '#ffe4e6',
                          color: mv.type === 'IN' ? '#15803d' : '#e11d48'
                        }}>
                          {mv.type === 'IN' ? 'NHẬP KHO' : 'XUẤT KHO'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#2563eb' }}>{mv.reference}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>{mv.productName}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 800, color: mv.type === 'IN' ? '#16a34a' : '#e11d48' }}>
                        {mv.type === 'IN' ? `+${mv.quantity}` : `-${mv.quantity}`}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{mv.actor || 'Thủ Kho'}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedMovementLog(mv); }}
                          style={{
                            backgroundColor: '#ffffff',
                            color: '#2563eb',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            padding: '0.3rem 0.65rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Xem Chi Tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 11. VIEW: CẤU HÌNH > KHO HÀNG & VỊ TRÍ KỆ (LOCATIONS) */}
      {activeTab === 'locations' && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Cấu Hình / Kho Hàng & Vị Trí Kệ
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
              Danh sách khu vực kệ kho cố định trong nhà kho
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {PREDEFINED_LOCATIONS.map(loc => {
              const count = activeInventory.filter(i => i.location === loc).length;
              return (
                <div key={loc} style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#2563eb', fontSize: '1rem', fontWeight: 800 }}>{loc}</h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                    Số sản phẩm gán vị trí này: <strong style={{ color: '#0f172a' }}>{count}</strong> sản phẩm
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 12. VIEW: CẤU HÌNH > DANH MỤC SẢN PHẨM (CATEGORIES) */}
      {activeTab === 'categories' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Cấu Hình / Danh Mục Sản Phẩm
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                Quản lý phân nhóm danh mục linh kiện, tổng mã sản phẩm, số lượng tồn thực tế và giá trị tài sản
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const name = await promptText('Nhập tên danh mục linh kiện mới (ví dụ: NETWORKING, PERIPHERALS...):');
                if (name && name.trim()) {
                  notify(`Đã thêm danh mục quy chuẩn ${name.trim().toUpperCase()} vào hệ thống!`, 'success');
                }
              }}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.55rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              + Thêm Danh Mục Mới
            </button>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Mã Danh Mục</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Mô Tả Phân Nhóm</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Tổng Sản Phẩm</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Tổng Trị Giá Tồn</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { code: 'CPU', desc: 'Bộ vi xử lý trung tâm Intel / AMD' },
                  { code: 'VGA', desc: 'Card màn hình & Xử lý đồ họa NVIDIA / AMD' },
                  { code: 'MAINBOARD', desc: 'Bo mạch chủ máy tính các chuẩn ATX / MATX / ITX' },
                  { code: 'RAM', desc: 'Bộ nhớ trong DDR4 / DDR5' },
                  { code: 'STORAGE', desc: 'Ổ cứng SSD NVMe / SATA & HDD' },
                  { code: 'PSU', desc: 'Nguồn máy tính chuẩn 80 Plus Gold / Platinum' },
                  { code: 'CASE', desc: 'Vỏ thùng máy tính Gaming & Workstation Server' },
                  { code: 'COOLER', desc: 'Tản nhiệt khí & Tản nhiệt nước All-In-One' },
                  { code: 'MONITOR', desc: 'Màn hình máy tính đồ họa 2K / 4K / Gaming' },
                  { code: 'KEYBOARD', desc: 'Bàn phím cơ Custom & Chuẩn văn phòng', aliases: ['KEYBOARD', 'BÀN PHÍM', 'BANPHIM'] },
                  { code: 'MOUSE', desc: 'Chuột Gaming & Chuột không dây', aliases: ['MOUSE', 'CHUỘT'] }
                ].map(cat => {
                  const aliases = cat.aliases || [cat.code];
                  // Use all products (from backend) for total count
                  const allProdsInCat = products.filter(p => {
                    const c = String(typeof p.category === 'object' ? p.category?.name : p.category || '').toUpperCase().trim();
                    return aliases.some(a => c === a || c.includes(a));
                  });
                  // Get matching IDs from backend products, then look up in activeInventory
                  const matchedIds = new Set(allProdsInCat.map(p => String(p.id || p.productId)));
                  const invProdsInCat = activeInventory.filter(i => {
                    // Match by ID first (most reliable), then fallback to category string
                    if (matchedIds.has(String(i.id))) return true;
                    const c = String(i.category || '').toUpperCase().trim();
                    return aliases.some(a => c === a || c.includes(a));
                  });

                  const totalSkus = allProdsInCat.length || invProdsInCat.length;
                  const totalValue = invProdsInCat.reduce((sum, item) => sum + ((Number(item.stock) || 0) * (Number(item.price) || 0)), 0);

                  return (
                    <tr key={cat.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#2563eb' }}>{cat.code}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{cat.desc}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                        {totalSkus}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: totalValue > 0 ? '#2563eb' : '#64748b' }}>
                        {safeFormatPrice(totalValue)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat.code);
                            setSelectedSupplier('ALL');
                            setStockStatusFilter('ALL');
                            setSelectedLocationStatus('ALL');
                            setSearchQuery('');
                            setActiveTab('inventory');
                          }}
                          style={{
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            padding: '0.4rem 1rem',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            minWidth: '160px',
                            display: 'inline-block',
                            textAlign: 'center'
                          }}
                        >
                          Xem Sản Phẩm ({totalSkus})
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──── MODALS ──── */}

      {/* Stock Movement Log Detail Modal */}
      {selectedMovementLog && (
        <MovementDetailModal
          movement={selectedMovementLog}
          onClose={() => setSelectedMovementLog(null)}
          formatDateTime={formatDateTime}
        />
      )}

      {/* Receipt Detail Modal */}
      {selectedReceipt && (
        <ReceiptDetailModal
          selectedReceipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          purchaseOrders={purchaseOrders}
          onRequestValidate={(receipt, poStatus, items) => setSerialEntryTarget({ receipt, poStatus, items })}
          submitting={submitting}
          formatPrice={safeFormatPrice}
        />
      )}

      {/* Serial Number Entry — required before any GRN intake can be confirmed
          (see backend validateReceipt: rejects with 400 if counts don't match). */}
      {serialEntryTarget && (
        <SerialEntryModal
          target={serialEntryTarget}
          onClose={() => setSerialEntryTarget(null)}
          submitting={submitting}
          onConfirm={async (serialsMap) => {
            await handleValidateReceipt(serialEntryTarget.receipt, serialEntryTarget.poStatus, serialsMap);
            setSerialEntryTarget(null);
          }}
        />
      )}

      {/* Regional Shipper Assign Modal */}
      {orderToAssign && (
        <RegionalShipperModal
          orderToAssign={orderToAssign}
          onClose={() => setOrderToAssign(null)}
          safeFormatPrice={safeFormatPrice}
          updateOrderStatus={updateOrderStatus}
          sendSystemNotification={sendSystemNotification}
          addNotification={addNotification}
          orders={orders}
          setOrders={setOrders}
        />
      )}


      {/* RFQ History Modal */}
      <RfqAlertHistoryModal
        show={showRfqHistoryModal}
        onClose={() => setShowRfqHistoryModal(false)}
        logs={rfqAlertLogs}
        formatDateTime={formatDateTime}
      />

      {/* Add Product Modal */}
      {showAddProduct && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', maxWidth: '600px', width: '100%', maxHeight: '90vh', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Thêm Sản Phẩm Mới Vào Sổ Kho</h3>
              <button onClick={() => setShowAddProduct(false)} style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer' }}>Đóng</button>
            </div>
            <form onSubmit={handleAddProductSubmit} style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Tên Sản Phẩm *</label>
                  <input type="text" required value={newProdForm.name} onChange={(e) => setNewProdForm({ ...newProdForm, name: e.target.value })} style={{ width: '100%', padding: '0.55rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Phân Nhóm</label>
                    <select value={newProdForm.category} onChange={(e) => setNewProdForm({ ...newProdForm, category: e.target.value })} style={{ width: '100%', padding: '0.55rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                      <option value="CPU">CPU</option>
                      <option value="VGA">VGA</option>
                      <option value="MAINBOARD">Mainboard</option>
                      <option value="RAM">RAM</option>
                      <option value="STORAGE">Storage</option>
                      <option value="PSU">PSU</option>
                      <option value="CASE">Case</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Số Lượng Tồn Kho *</label>
                    <input type="number" required min="0" value={newProdForm.stock} onChange={(e) => setNewProdForm({ ...newProdForm, stock: e.target.value })} style={{ width: '100%', padding: '0.55rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Đơn Giá (VNĐ)</label>
                    <input type="number" min="0" value={newProdForm.price} onChange={(e) => setNewProdForm({ ...newProdForm, price: e.target.value })} style={{ width: '100%', padding: '0.55rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Ngưỡng An Toàn</label>
                    <input type="number" min="1" value={newProdForm.threshold} onChange={(e) => setNewProdForm({ ...newProdForm, threshold: e.target.value })} style={{ width: '100%', padding: '0.55rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Nhà Cung Cấp</label>
                  <select value={newProdForm.supplierCode} onChange={(e) => { const sup = realSuppliers.find(s => s.code === e.target.value); setNewProdForm({ ...newProdForm, supplierCode: e.target.value, supplier: sup ? sup.name : newProdForm.supplier }); }} style={{ width: '100%', padding: '0.55rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                    <option value="">-- Chọn Nhà Cung Cấp (không bắt buộc) --</option>
                    {realSuppliers.map(s => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <ProductGalleryField
                  coverFile={newProdForm.imageFile}
                  coverUrl={null}
                  onCoverSelect={(file) => setNewProdForm({ ...newProdForm, imageFile: file })}
                  existingImages={[]}
                  pendingFiles={newProdForm.imageFiles || []}
                  onAddFiles={(fileList) => {
                    const room = MAX_GALLERY_IMAGES - (newProdForm.imageFiles || []).length;
                    setNewProdForm({ ...newProdForm, imageFiles: [...(newProdForm.imageFiles || []), ...Array.from(fileList).slice(0, room)] });
                  }}
                  onRemovePendingFile={(idx) => setNewProdForm({ ...newProdForm, imageFiles: (newProdForm.imageFiles || []).filter((_, i) => i !== idx) })}
                  onDeleteExistingImage={() => {}}
                  deletingImageId={null}
                />
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>Mô Tả Sản Phẩm</label>
                  <textarea rows={3} value={newProdForm.description || ''} onChange={(e) => setNewProdForm({ ...newProdForm, description: e.target.value })} style={{ width: '100%', padding: '0.55rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'inherit', fontSize: '0.83rem', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.83rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newProdForm.available !== false} onChange={(e) => setNewProdForm({ ...newProdForm, available: e.target.checked })} />
                  Hiển thị trên trang bán hàng
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowAddProduct(false)} style={{ padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff' }}>Hủy</button>
                <button type="submit" style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#fff', fontWeight: 700 }}>Lưu Sản Phẩm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enhanced Edit Product Modal — read-only ("Xem Chi Tiết", opened from the
          product name) unless the viewer is a manager AND explicitly chose to edit
          (the Hành Động button, or the "Chỉnh Sửa" button inside the read-only view). */}
      {editingProd && (() => {
        const isReadOnlyView = !isManager || productViewOnly;
        const closeModal = () => { setEditingProd(null); setProductViewOnly(false); };
        const stockNum = Number(editingProd.stock) || 0;
        const threshNum = Number(editingProd.threshold || 5);
        const stockBadge = stockNum === 0
          ? { label: 'Hết hàng', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
          : stockNum <= threshNum
            ? { label: 'Cảnh báo tồn', color: '#b45309', bg: '#fffbeb', border: '#fde68a' }
            : { label: 'Còn hàng', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' };
        // Plain label/value row for the simple read-only detail view — not a form
        // field, just static text, so this reads as "product info" rather than an
        // edit form with its inputs greyed out.
        const infoRow = (label, value) => (
          <div key={label}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.3rem' }}>{label}</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>{value}</div>
          </div>
        );
        return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', maxWidth: '560px', width: '100%', maxHeight: '90vh', border: '1px solid #cbd5e1', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{isReadOnlyView ? 'Thông Tin Sản Phẩm' : 'Chỉnh Sửa Thông Tin Sản Phẩm'}</h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Mã định danh: <strong style={{ color: '#2563eb' }}>#{editingProd.id}</strong></span>
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', color: '#475569', fontWeight: 600, flexShrink: 0 }}>Đóng</button>
            </div>

            {isReadOnlyView ? (
              // Simple read-only detail card — plain text, no form controls.
              <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.1rem' }}>
                  {editingProd.image && (
                    <img src={editingProd.image} alt={editingProd.name} style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', flexShrink: 0 }} />
                  )}
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{editingProd.name}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem', marginBottom: '1.1rem' }}>
                  {infoRow('Phân Nhóm', editingProd.category)}
                  {infoRow('Nhà Cung Cấp', editingProd.supplier || 'Chưa rõ')}
                  {infoRow('Vị Trí Kệ', editingProd.location || 'Chưa xếp kệ')}
                  {infoRow('Đơn Giá Niêm Yết', safeFormatPrice(editingProd.price))}
                  {infoRow('Ngưỡng An Toàn', `${threshNum} sản phẩm`)}
                  {infoRow('Trên Trang Bán Hàng', editingProd.available !== false
                    ? <span style={{ color: '#15803d' }}>Đang hiển thị</span>
                    : <span style={{ color: '#dc2626' }}>Đang ẩn</span>)}
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.3rem' }}>Tồn Kho Hiện Tại</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>{stockNum} sản phẩm</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '10px', color: stockBadge.color, backgroundColor: stockBadge.bg, border: `1px solid ${stockBadge.border}` }}>{stockBadge.label}</span>
                    </div>
                  </div>
                </div>
                {editingProd.gallery?.length > 0 && (
                  <div style={{ marginBottom: '1.1rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.3rem' }}>Ảnh Phụ ({editingProd.gallery.length})</div>
                    <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                      {editingProd.gallery.map(img => (
                        <img key={img.id} src={img.url} alt="" style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', flexShrink: 0 }} />
                      ))}
                    </div>
                  </div>
                )}
                {editingProd.description && (
                  <div style={{ marginBottom: '1.1rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.3rem' }}>Mô Tả Sản Phẩm</div>
                    <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{editingProd.description}</div>
                  </div>
                )}
                {!isManager && (
                  <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.65rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.78rem', color: '#1e40af', fontWeight: 600 }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    Chỉ Quản Lý Kho mới được chỉnh sửa giá/tồn kho/vị trí.
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1.1rem' }}>
                  <button type="button" onClick={closeModal} style={{ padding: '0.5rem 1.15rem', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', color: '#475569', cursor: 'pointer' }}>Đóng</button>
                  {isManager && (
                    <button type="button" onClick={() => setProductViewOnly(false)} style={{ padding: '0.5rem 1.35rem', fontSize: '0.82rem', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>Chỉnh Sửa</button>
                  )}
                </div>
              </div>
            ) : (
              // Edit form — only reachable by a manager who explicitly chose to edit.
              <form onSubmit={handleEditProductSubmit} style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>Tên Linh Kiện / Sản Phẩm *</label>
                    <input type="text" required value={editingProd.name || ''} onChange={(e) => setEditingProd({ ...editingProd, name: e.target.value })} style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#0f172a' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>Phân Nhóm Danh Mục</label>
                      <select value={editingProd.category || 'CPU'} onChange={(e) => setEditingProd({ ...editingProd, category: e.target.value })} style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#0f172a' }}>
                        <option value="CPU">CPU</option>
                        <option value="VGA">VGA</option>
                        <option value="MAINBOARD">Mainboard</option>
                        <option value="RAM">RAM</option>
                        <option value="STORAGE">Storage</option>
                        <option value="PSU">PSU</option>
                        <option value="CASE">Case</option>
                        <option value="COOLER">Tản nhiệt (Cooler)</option>
                        <option value="MONITOR">Màn hình</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>Nhà Cung Cấp</label>
                      <select
                        value={editingProd.supplierCode || realSuppliers.find(s => s.name === editingProd.supplier)?.code || ''}
                        onChange={(e) => {
                          const sup = realSuppliers.find(s => s.code === e.target.value);
                          setEditingProd({ ...editingProd, supplierCode: e.target.value, supplier: sup ? sup.name : editingProd.supplier });
                        }}
                        style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#0f172a' }}
                      >
                        <option value="">-- Chọn Nhà Cung Cấp --</option>
                        {realSuppliers.map(s => (
                          <option key={s.code} value={s.code}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>Vị Trí Kệ Lưu Kho</label>
                      <select value={editingProd.location || 'ZONE-A/SHELF-01/BIN-01'} onChange={(e) => setEditingProd({ ...editingProd, location: e.target.value })} style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.83rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#0f172a' }}>
                        <option value="Chưa xếp kệ">Chưa xếp kệ</option>
                        {PREDEFINED_LOCATIONS.map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>Đơn Giá Niêm Yết (VNĐ)</label>
                      <input type="number" min="0" value={editingProd.price !== undefined ? editingProd.price : 0} onChange={(e) => setEditingProd({ ...editingProd, price: parseFloat(e.target.value) || 0 })} style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.85rem', fontWeight: 700, color: '#16a34a', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>Số Lượng Tồn Kho Thực Tế</label>
                      <input type="number" required min="0" value={editingProd.stock !== undefined ? editingProd.stock : 0} onChange={(e) => setEditingProd({ ...editingProd, stock: parseInt(e.target.value, 10) || 0 })} style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.85rem', fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#0f172a' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>Ngưỡng An Toàn</label>
                      <input type="number" min="1" value={editingProd.threshold || 5} onChange={(e) => setEditingProd({ ...editingProd, threshold: parseInt(e.target.value, 10) || 5 })} style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#0f172a' }} />
                    </div>
                  </div>

                  <ProductGalleryField
                    coverFile={editingProd.imageFile}
                    coverUrl={editingProd.image}
                    onCoverSelect={(file) => setEditingProd({ ...editingProd, imageFile: file })}
                    existingImages={editingProd.gallery || []}
                    pendingFiles={editingProd.imageFiles || []}
                    onAddFiles={(fileList) => {
                      const room = MAX_GALLERY_IMAGES - (editingProd.gallery || []).length - (editingProd.imageFiles || []).length;
                      setEditingProd({ ...editingProd, imageFiles: [...(editingProd.imageFiles || []), ...Array.from(fileList).slice(0, room)] });
                    }}
                    onRemovePendingFile={(idx) => setEditingProd({ ...editingProd, imageFiles: (editingProd.imageFiles || []).filter((_, i) => i !== idx) })}
                    onDeleteExistingImage={handleDeleteGalleryImage}
                    deletingImageId={deletingGalleryImageId}
                  />
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>Mô Tả Sản Phẩm</label>
                    <textarea rows={3} value={editingProd.description || ''} onChange={(e) => setEditingProd({ ...editingProd, description: e.target.value })} style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', color: '#0f172a', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.83rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                    <input type="checkbox" checked={editingProd.available !== false} onChange={(e) => setEditingProd({ ...editingProd, available: e.target.checked })} />
                    Hiển thị trên trang bán hàng
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <button type="button" onClick={closeModal} style={{ padding: '0.5rem 1.15rem', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', color: '#475569', cursor: 'pointer' }}>Hủy bỏ</button>
                  <button type="button" onClick={handleEditProductSubmit} style={{ padding: '0.5rem 1.35rem', fontSize: '0.82rem', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>Lưu Cập Nhật</button>
                </div>
              </form>
            )}
          </div>
        </div>
        );
      })()}

      {/* Order Detail Modal */}
      {selectedOrderForDetail && (
        <OrderDetailModal
          order={selectedOrderForDetail}
          onClose={() => setSelectedOrderForDetail(null)}
        />
      )}

      {/* Backorder RFQ Proposal Modal */}
      {backorderRfqData && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', maxWidth: '580px', width: '100%', border: '1px solid #cbd5e1', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  Khởi Tạo Đề Xuất Mua Hàng (RFQ)
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Phục vụ đơn nợ khách: <strong style={{ color: '#2563eb' }}>#{backorderRfqData.orderId}</strong> ({backorderRfqData.customerName})
                </span>
              </div>
              <button onClick={() => setBackorderRfqData(null)} style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', color: '#475569', fontWeight: 600 }}>
                Đóng
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmSendBackorderRfq} style={{ padding: '1.5rem' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', marginBottom: '0.5rem' }}>
                  {backorderRfqData.productName}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', color: '#475569' }}>
                  <div>Khách yêu cầu: <strong style={{ color: '#dc2626' }}>{backorderRfqData.neededQty || 1} cái</strong></div>
                  <div>Tồn kho hiện tại: <strong style={{ color: Number(backorderRfqData.currentStock || 0) === 0 ? '#dc2626' : '#15803d' }}>{backorderRfqData.currentStock || 0} cái</strong></div>
                  <div>Đơn giá vốn ước tính: <strong style={{ color: '#0f172a' }}>{safeFormatPrice(backorderRfqData.unitPrice || 0)}</strong></div>
                  <div>Tổng trị giá đề xuất: <strong style={{ color: '#16a34a' }}>{safeFormatPrice((Number(backorderRfqData.suggestedQty) || 5) * (Number(backorderRfqData.unitPrice) || 1500000))}</strong></div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                      Số Lượng Đề Xuất Mua *
                    </label>
                    <input
                      type="number"
                      required
                      min={backorderRfqData.neededQty || 1}
                      value={backorderRfqData.suggestedQty || 5}
                      onChange={(e) => setBackorderRfqData({ ...backorderRfqData, suggestedQty: parseInt(e.target.value, 10) || 1 })}
                      style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.9rem', fontWeight: 800, color: '#2563eb', border: '1.5px solid #bfdbfe', borderRadius: '6px', backgroundColor: '#eff6ff', boxSizing: 'border-box' }}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                      (Tối thiểu {backorderRfqData.neededQty || 1} cái để trả khách)
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                      Nhà Cung Cấp Đề Xuất
                    </label>
                    <select
                      value={backorderRfqData.supplier || 'Intel Vietnam'}
                      onChange={(e) => setBackorderRfqData({ ...backorderRfqData, supplier: e.target.value })}
                      style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    >
                      {STANDARD_SUPPLIERS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      {backorderRfqData.supplier && !STANDARD_SUPPLIERS.includes(backorderRfqData.supplier) && (
                        <option value={backorderRfqData.supplier}>{backorderRfqData.supplier}</option>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                    Ghi Chú Cho Phòng Mua Hàng
                  </label>
                  <textarea
                    rows={3}
                    value={backorderRfqData.reason}
                    onChange={(e) => setBackorderRfqData({ ...backorderRfqData, reason: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setBackorderRfqData(null)}
                  style={{ padding: '0.55rem 1.15rem', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', color: '#475569', cursor: 'pointer' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.55rem 1.35rem', fontSize: '0.82rem', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#ffffff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.25)' }}
                >
                  Xác Nhận & Gửi RFQ Sang Mua Hàng
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* RFQ Alert Confirmation Modal (for Low Stock) */}
      <RfqAlertModal
        rfqModalData={lowStockRfqModalData}
        setRfqModalData={setLowStockRfqModalData}
        sendSystemNotification={sendSystemNotification}
        setRfqAlertLogs={setRfqAlertLogs}
      />

      {/* Pack & Scan Modal */}
      {packScanOrder && (
        <PackAndScanModal
          show={true}
          order={packScanOrder}
          onClose={() => setPackScanOrder(null)}
          onConfirmPack={handleConfirmPack}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: XỬ LÝ NHẬP KHO HÀNG ĐỔI TRẢ & ĐỊNH VỊ KỆ KHO */}
      {/* ========================================================================= */}
      {selectedReturnProcessing && (() => {
        const item = selectedReturnProcessing;
        const isExchange = item.type === 'EXCHANGE' || item.status === 'EXCHANGED' || item.status === 'EXCHANGE_NEW';
        const refundVal = parseFloat(item.refundAmount || item.totalAmount || 0);
        const hasRefundInfo = item.type === 'REFUND' || refundVal > 0 || Boolean(item.bankAccountNo);
        const prodName = typeof item.productName === 'string'
          ? item.productName
          : (item.product?.name || (typeof item.product === 'string' ? item.product : item.items?.[0]?.name || 'Linh kiện máy tính'));
        const custName = typeof item.customerName === 'string'
          ? item.customerName
          : (item.customer?.fullname || item.customer?.name || (typeof item.customer === 'string' ? item.customer : 'Khách lẻ'));
        const phone = typeof item.customerPhone === 'string'
          ? item.customerPhone
          : (item.phone || item.customer?.phone || 'N/A');
        const reasonText = typeof item.reason === 'string'
          ? item.reason
          : (item.description || item.note || 'Hàng đổi trả / bảo hành');
        const rmaNum = item.rmaNumber || item.code || (item.id ? `RET-${String(item.id).padStart(3, '0')}` : 'RET-001');
        const ordId = item.orderId || item.orderNumber || 'N/A';
        const st = item.status || 'PENDING';
        // Warehouse may only shelve/scrap a return AFTER QC has actually
        // rendered a decision (QC_PASSED / VENDOR_WARRANTY) — never before,
        // and never a second time once already shelved (RESTOCKED/EXCHANGED/
        // INSPECTED_SCRAP), which would double-count inventory. Same helper
        // the returns table uses for its badge/action column, so this modal
        // can never disagree with what the table just showed.
        const rsd = getReturnStatusDisplay(st);
        const isPassed = st === 'RESTOCKED' || (rsd.alreadyShelved && st !== 'EXCHANGE_NEW' && st !== 'EXCHANGED' && st !== 'INSPECTED_SCRAP');
        const isVendor = st === 'VENDOR_WARRANTY';
        const isScrap = st === 'INSPECTED_SCRAP';
        const isReject = ['REJECTED', 'REJECT_RMA'].includes(st);
        const qcApproved = rsd.qcApproved;
        const alreadyShelved = rsd.alreadyShelved;
        const canShelveNow = rsd.canShelveNow;

        let badgeLabel = 'Chờ QC Thẩm Định';
        if (isPassed) badgeLabel = 'Đã Nhập Lại Kho';
        else if (isExchange) badgeLabel = 'Đã Duyệt Đổi Mới';
        else if (isVendor) badgeLabel = 'Chờ Gửi Hãng BH';
        else if (isScrap) badgeLabel = 'Phế Phẩm / Kho Lỗi';
        else if (isReject) badgeLabel = 'Từ Chối Bảo Hành';

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              maxWidth: '620px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem 1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Package size={22} style={{ color: '#2563eb' }} />
                    <span>Xử Lý Nhập Kho Kiện Hàng Đổi Trả</span>
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0' }}>
                    Phân luồng vị trí kệ lưu trữ và ghi nhận biến động số lượng vào Thẻ Kho ERP
                  </p>
                </div>
                <button
                  onClick={() => setSelectedReturnProcessing(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Kiện Hàng Overview Card */}
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '1rem', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#2563eb' }}>
                      {rmaNum}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '0.4rem' }}>
                      • Đơn gốc: <strong>#{ordId}</strong>
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span style={{
                    padding: '3px 9px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    backgroundColor: isPassed ? '#dcfce7' : isExchange ? '#ede9fe' : isVendor ? '#ffedd5' : isScrap ? '#ffe4e6' : isReject ? '#fee2e2' : '#fef3c7',
                    color: isPassed ? '#15803d' : isExchange ? '#6d28d9' : isVendor ? '#c2410c' : isScrap ? '#be123c' : isReject ? '#dc2626' : '#b45309',
                    border: `1px solid ${isPassed ? '#bbf7d0' : isExchange ? '#ddd6fe' : isVendor ? '#fed7aa' : isScrap ? '#fecdd3' : isReject ? '#fca5a5' : '#fde68a'}`
                  }}>
                    {badgeLabel}
                  </span>
                </div>

                <div style={{ marginTop: '0.5rem', fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                  {prodName}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.76rem', color: '#475569', marginTop: '0.35rem' }}>
                  <span>Khách hàng: <strong>{custName}</strong></span>
                  <span>SĐT: {phone}</span>
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>Lý do: {reasonText}</span>
                </div>

                {/* QC Proof Photo Display */}
                {item.qcProofPhoto && (
                  <div style={{ marginTop: '0.65rem', padding: '0.65rem 0.85rem', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <img
                      src={item.qcProofPhoto}
                      alt="QC Proof"
                      style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #c4b5fd' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#6d28d9' }}>Ảnh Thẩm Định Từ Kỹ Thuật QC (Tem Seal / Ngoại Quan)</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                        Kỹ thuật QC đã chụp ảnh xác nhận kiện hàng còn nguyên trạng khi tiếp nhận.
                      </div>
                    </div>
                  </div>
                )}

                {hasRefundInfo && (
                  <div style={{ marginTop: '0.65rem', padding: '0.65rem 0.85rem', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ backgroundColor: '#15803d', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                          HỒ SƠ HOÀN TIỀN 100%
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 700 }}>
                          Tự động lập Phiếu Đề Nghị Chi gửi Kế toán sau khi nhập kệ
                        </span>
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#15803d' }}>
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(refundVal)}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#14532d', marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                      <span>Ngân hàng: <strong>{item.bankName || 'MB Bank'}</strong></span>
                      <span>Số tài khoản: <code style={{ fontWeight: 800, color: '#15803d' }}>{item.bankAccountNo || 'Chưa cung cấp'}</code></span>
                      <span>Chủ tài khoản: <strong style={{ textTransform: 'uppercase' }}>{item.bankAccountName || custName}</strong></span>
                    </div>
                  </div>
                )}

                {isExchange && (
                  <div style={{ marginTop: '0.65rem', padding: '0.65rem 0.85rem', backgroundColor: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ backgroundColor: '#1d4ed8', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                        HỒ SƠ ĐỔI MỚI 1-1
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 700 }}>
                        Sau khi nhập kho kiện hàng cũ, hệ thống sẽ tự động tạo Đơn Hàng Đổi Mới (#ORD-EXC-...) 0đ để xuất kho giao cho khách.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {!canShelveNow && !alreadyShelved && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '0.9rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                  <AlertCircle size={22} style={{ color: '#b45309', flexShrink: 0 }} />
                  <div style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 600 }}>
                    Kiện hàng này chưa qua kiểm định QC — chưa thể nhập kệ hay thanh lý. Vui lòng chờ bộ phận QA/QC hoàn tất thẩm định trước.
                  </div>
                </div>
              )}
              {alreadyShelved && (
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.9rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                  <CheckCircle size={22} style={{ color: '#15803d', flexShrink: 0 }} />
                  <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
                    Kiện hàng này đã được xử lý và nhập kệ xong{item.shelfLocation ? ` (${item.shelfLocation})` : ''}.
                  </div>
                </div>
              )}

              {/* Phân Luồng Kệ Kho Form — chỉ hiện khi QC đã duyệt và chưa xử lý */}
              {canShelveNow && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 750, color: '#1e293b', marginBottom: '0.45rem' }}>
                    Chọn Vị Trí Kệ Kho Lưu Trữ *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    {[
                      { key: 'SHELF_A1_RESTOCK', label: 'Kệ A1 - Tồn Kho Bán Mới', desc: 'Hàng nguyên seal, đủ điều kiện bán lại', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
                      { key: 'SHELF_B3_OUTLET', label: 'Kệ B3 - Kho Outlet Open-Box', desc: 'Móp vỏ hộp nhẹ, bán thanh lý -15%', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
                      { key: 'SHELF_C2_VENDOR', label: 'Kệ C2 - Khu Chờ Gửi Hãng', desc: 'Chờ đóng gói chuyển tiếp NCC/Hãng', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
                      { key: 'SHELF_D_SCRAP', label: 'Kệ D - Khu Phế Phẩm / Lỗi', desc: 'Lỗi nặng, giữ làm xác linh kiện/hủy', color: '#be123c', bg: '#fff1f2', border: '#fecdd3' }
                    ].map(shelf => {
                      const isSelected = returnShelfLocation === shelf.key;
                      return (
                        <div
                          key={shelf.key}
                          onClick={() => setReturnShelfLocation(shelf.key)}
                          style={{
                            padding: '0.75rem 0.85rem',
                            borderRadius: '8px',
                            border: isSelected ? `2px solid ${shelf.color}` : '1px solid #cbd5e1',
                            backgroundColor: isSelected ? shelf.bg : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ fontWeight: 750, fontSize: '0.82rem', color: shelf.color }}>
                            {shelf.label}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px' }}>
                            {shelf.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 750, color: '#1e293b', marginBottom: '0.35rem' }}>
                    Ghi Chú Nhập Kệ & Mã Định Danh Ô Kho
                  </label>
                  <input
                    type="text"
                    value={returnProcessNote}
                    onChange={e => setReturnProcessNote(e.target.value)}
                    placeholder="Ví dụ: Đã xếp vào Ô Kệ A1-04, mã vạch seal nguyên vẹn..."
                    style={{ width: '100%', padding: '0.6rem 0.75rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReturnProcessing(null);
                      window.location.href = '/admin/quality-control?tab=returns';
                    }}
                    style={{
                      backgroundColor: '#f5f3ff',
                      color: '#7c3aed',
                      border: '1px solid #ddd6fe',
                      borderRadius: '6px',
                      padding: '0.5rem 0.85rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Màn Hình QC Thẩm Định
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReturnProcessing(null);
                      window.location.href = '/admin/accountant?tab=refunds';
                    }}
                    style={{
                      backgroundColor: '#ecfdf5',
                      color: '#15803d',
                      border: '1px solid #a7f3d0',
                      borderRadius: '6px',
                      padding: '0.5rem 0.85rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Phòng Kế Toán (Chi Hoàn Tiền)
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedReturnProcessing(null)}
                    style={{ backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Đóng
                  </button>
                  {canShelveNow && (
                  <button
                    type="button"
                    onClick={async () => {
                      const isScrap = returnShelfLocation === 'SHELF_D_SCRAP';
                      const isVendor = returnShelfLocation === 'SHELF_C2_VENDOR';
                      const targetStatus = isScrap ? 'INSPECTED_SCRAP' : isVendor ? 'VENDOR_WARRANTY' : (isExchange ? 'EXCHANGED' : 'RESTOCKED');

                      // Gọi backend TRƯỚC — confirmReturnWarehouse tự tính đúng
                      // kết quả (nhập kệ bán / đổi mới / gửi hãng / phế phẩm)
                      // từ shelfLocation, và chỉ cộng tồn kho khi hàng thật sự
                      // vào kệ bán được. Chỉ cập nhật state cục bộ sau khi API
                      // xác nhận — trước đây hàm này luôn "thành công" trên
                      // UI dù request có tới được server hay không.
                      if (typeof updateReturnStatus !== 'function') {
                        notify('Không thể xử lý: thiếu chức năng cập nhật trạng thái.', 'error');
                        return;
                      }
                      try {
                        await updateReturnStatus(item.id || item.orderId, targetStatus, {
                          shelfLocation: returnShelfLocation,
                          type: isExchange ? 'EXCHANGE' : 'REFUND',
                          shelfNote: returnProcessNote || 'Đã phân luồng vị trí kệ kho',
                          note: returnProcessNote || `Kho đã xếp vào ${returnShelfLocation} (${targetStatus})`
                        });
                      } catch (err) {
                        notify(err?.message || 'Không thể xác nhận xử lý trên máy chủ. Vui lòng thử lại.', 'error');
                        return;
                      }

                      // Lấy base list từ returnRequests hoặc effectiveReturnRequests
                      const baseList = (returnRequests && returnRequests.length > 0) ? [...returnRequests] : [...effectiveReturnRequests];
                      const targetId = String(item.id || '');
                      const targetRma = String(item.rmaNumber || item.code || '');
                      const targetOrder = String(item.orderId || '');

                      const updated = baseList.map(r => {
                        const matchId = targetId && String(r.id) === targetId;
                        const matchRma = targetRma && (String(r.rmaNumber) === targetRma || String(r.code) === targetRma);
                        const matchOrder = targetOrder && String(r.orderId) === targetOrder;
                        if (matchId || matchRma || matchOrder) {
                          return {
                            ...r,
                            status: targetStatus,
                            shelfLocation: returnShelfLocation,
                            shelfNote: returnProcessNote || 'Đã phân luồng vị trí kệ kho'
                          };
                        }
                        return r;
                      });

                      if (typeof setReturnRequests === 'function') {
                        setReturnRequests(updated);
                      }
                      localStorage.setItem('erp_return_requests', JSON.stringify(updated));

                      // Tự động tăng tồn kho hiển thị cục bộ nếu nhập kho bán mới hoặc outlet
                      // (khớp với logic backend: chỉ 2 kệ này mới thật sự cộng tồn kho bán)
                      if (['SHELF_A1_RESTOCK', 'SHELF_B3_OUTLET'].includes(returnShelfLocation)) {
                        const pName = prodName;
                        if (pName && Array.isArray(inventory) && typeof setInventory === 'function') {
                          const invUpdated = inventory.map(inv => {
                            if (inv.name === pName || (pName && inv.name.toLowerCase().includes(pName.toLowerCase()))) {
                              return { ...inv, stock: Number(inv.stock || 0) + 1 };
                            }
                            return inv;
                          });
                          setInventory(invUpdated);
                          localStorage.setItem('erp_inventory', JSON.stringify(invUpdated));
                        }
                      }

                      // Lưu log điều chuyển kho
                      const toLocationLabel = returnShelfLocation === 'SHELF_A1_RESTOCK' ? 'Kệ A1 (Tồn Kho Bán Mới)' : returnShelfLocation === 'SHELF_B3_OUTLET' ? 'Kệ B3 (Thanh Lý Outlet)' : returnShelfLocation === 'SHELF_C2_VENDOR' ? 'Kệ C2 (Chờ Gửi Hãng)' : 'Kệ D (Kho Lỗi Phế Phẩm)';
                      const newLog = {
                        id: `MOV-RET-${Date.now().toString().slice(-4)}`,
                        // History table/modal only render IN/OUT badges — a
                        // return being shelved is physically an inbound
                        // movement regardless of the RMA sub-reason, which
                        // stays visible in the note instead.
                        type: 'IN',
                        reference: `RMA-${ordId}`,
                        productName: prodName,
                        quantity: 1,
                        timestamp: new Date().toISOString(),
                        actor: user?.fullname || 'Thủ Kho',
                        note: `${returnProcessNote || 'Đã phân luồng vị trí kệ kho'} — Từ Khu Vực Tiếp Nhận Trả Hàng đến ${toLocationLabel} (${isScrap ? 'Phế phẩm' : isVendor ? 'Bảo hành hãng' : 'Nhập lại kho bán'})`
                      };
                      const updatedMovements = [newLog, ...stockMovements];
                      setStockMovements(updatedMovements);
                      localStorage.setItem('erp_stock_movements', JSON.stringify(updatedMovements));

                      if (typeof sendSystemNotification === 'function') {
                        sendSystemNotification({
                          title: isExchange
                            ? `[ĐƠN ĐỔI MỚI 1-1] RMA ${rmaNum}`
                            : `[PHIẾU ĐỀ NGHỊ HOÀN TIỀN] RMA ${rmaNum}`,
                          content: isExchange
                            ? `Thủ kho đã xếp kiện hàng cũ vào ${newLog.toLocation}. Đã tự động tạo Đơn Đổi Mới để đóng gói xuất hàng cho khách.`
                            : `Thủ kho đã hoàn tất xếp kiện hàng vào ${newLog.toLocation}. Đã lập Phiếu đề nghị chuyển Kế toán giải ngân hoàn tiền.`,
                          type: 'SUCCESS',
                          recipient: isExchange ? 'Kho Vận, Giao Vận, CSKH' : 'Kế Toán, Ban Giám Đốc'
                        });
                      }

                      const formattedRefundVal = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(refundVal);

                      if (isScrap) {
                        notify(`Đã ghi nhận kiện hàng vào ${newLog.toLocation}. Không cộng vào tồn kho bán.`, 'success');
                      } else if (isVendor) {
                        notify(`Đã ghi nhận kiện hàng chuyển gửi hãng bảo hành tại ${newLog.toLocation}. Không cộng vào tồn kho bán.`, 'success');
                      } else if (isExchange) {
                        notify(`Đã nhập kho kiện hàng cũ vào ${newLog.toLocation}. Đơn hàng đổi mới (bù trừ 100%) đã được tạo và chuyển sang danh sách Hoạt Động / Lệnh Giao Hàng để Kho đóng gói và bàn giao Shipper.`, 'success');
                      } else if (item.type === 'REFUND' || refundVal > 0) {
                        notify(`Đã nhập kho kiện hàng vào ${newLog.toLocation}. Phiếu Đề Nghị Chi Hoàn Tiền (${formattedRefundVal}) đã được lập và chuyển sang Phòng Kế Toán giải ngân qua Napas247.`, 'success');
                      } else {
                        notify(`Đã phân luồng kiện hàng vào ${newLog.toLocation} và cập nhật trạng thái thành công.`, 'success');
                      }

                      setSelectedReturnProcessing(null);
                    }}
                    style={{
                      backgroundColor: returnShelfLocation === 'SHELF_D_SCRAP' ? '#be123c' : returnShelfLocation === 'SHELF_C2_VENDOR' ? '#c2410c' : isExchange ? '#2563eb' : '#16a34a',
                      color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.15rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    {returnShelfLocation === 'SHELF_D_SCRAP'
                      ? 'Xác Nhận Nhập Kệ & Chuyển Phế Phẩm'
                      : returnShelfLocation === 'SHELF_C2_VENDOR'
                        ? 'Xác Nhận Nhập Kệ & Chuyển Gửi Hãng BH'
                        : isExchange
                          ? 'Xác Nhận Nhập Kệ & Khởi Tạo Đơn Đổi Mới'
                          : 'Xác Nhận Nhập Kệ & Lập Phiếu Cho Kế Toán'}
                  </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
