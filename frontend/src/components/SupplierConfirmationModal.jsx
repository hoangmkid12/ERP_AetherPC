import React from 'react';
import { Printer, X, CheckCircle2, Truck, Calendar, Building2, FileCheck } from 'lucide-react';
import { printDocument } from '../utils/printDocument';
import { formatCurrencyInWords } from '../utils/numberToWords';

export default function SupplierConfirmationModal({ order, onClose }) {
  if (!order) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateStr;
    }
  };

  const formatPrice = (val) => {
    const num = Number(val);
    return Number.isFinite(num) ? num.toLocaleString('vi-VN') + ' đ' : '0 đ';
  };

  const items = (order.items && order.items.length > 0)
    ? order.items
    : [{
        name: order.productName || order.name || 'Linh Kiện Máy Tính',
        quantity: order.quantity || 1,
        unitCost: order.unitCost || order.unitPrice || (order.totalAmount ? Math.round(order.totalAmount / (order.quantity || 1)) : 0),
        totalCost: order.totalCost || order.totalAmount || 0
      }];

  const supplier = order.supplier || {};
  const supplierName = supplier.name || order.supplierName || 'Nhà Cung Cấp';
  const supplierCode = supplier.code || order.supplierCode || 'NCC-AETHER';
  const supplierPhone = supplier.phone || order.supplierPhone || '—';
  const supplierEmail = supplier.email || order.supplierEmail || '—';
  const supplierAddress = supplier.address || order.supplierAddress || 'Việt Nam';

  const totalQty = items.reduce((sum, it) => sum + (parseInt(it.quantity) || 1), 0);
  const totalAmount = Number(order.totalAmount || items.reduce((sum, it) => sum + Number(it.totalCost || (it.quantity * it.unitCost) || 0), 0));

  const handlePrint = () => {
    printDocument('#aetherpc-supplier-confirm-document', {
      title: `Phieu_Xac_Nhan_NCC_${order.poNumber || order.code || 'PO'}`
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15,23,42,0.6)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1200,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '94vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* VÙNG IN CHUẨN KHỔ A4 — CÂN ĐỐI 100% CẢ TRANG */}
        <div id="aetherpc-supplier-confirm-document" style={{ backgroundColor: '#ffffff', padding: '1rem 1.4rem 1.5rem', boxSizing: 'border-box' }}>
          
          {/* 1. Header chứng từ */}
          <div style={{ paddingBottom: '0.75rem', borderBottom: '2.5px solid #0f172a', marginBottom: '0.85rem' }}>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: 'none' }}>
              <colgroup>
                <col style={{ width: '62%' }} />
                <col style={{ width: '38%' }} />
              </colgroup>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: 'top', paddingRight: '0.75rem', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      NHÀ CUNG CẤP / SUPPLIER
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginTop: '0.15rem', lineHeight: 1.3 }}>
                      {supplierName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.25rem', lineHeight: 1.4 }}>
                      Mã NCC: <strong style={{ color: '#0f172a' }}>{supplierCode}</strong>
                      {supplierPhone !== '—' && ` • ĐT: ${supplierPhone}`}
                      {supplierEmail !== '—' && ` • Email: ${supplierEmail}`}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.1rem', lineHeight: 1.35 }}>
                      Địa chỉ: {supplierAddress}
                    </div>
                  </td>

                  <td style={{ verticalAlign: 'top', textAlign: 'right', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>Mẫu số: PXN-NCC/2026</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#15803d', marginTop: '0.15rem' }}>
                      Số: PXN-{order.poNumber || order.code || 'PO'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                      Ngày xác nhận: <strong style={{ color: '#0f172a' }}>{formatDate(order.updatedAt || new Date())}</strong>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                      Căn cứ PO: <strong style={{ color: '#2563eb' }}>{order.poNumber || order.code || '—'}</strong>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 2. Tiêu đề chính */}
          <div style={{ textAlign: 'center', marginBottom: '1rem', paddingTop: '0.2rem' }}>
            <h2 style={{ margin: '0', fontSize: '1.28rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px', textTransform: 'uppercase' }}>
              PHIẾU XÁC NHẬN ĐƠN HÀNG & LỊCH GIAO HÀNG
            </h2>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginTop: '0.15rem' }}>
              (SUPPLIER ORDER & DELIVERY COMMITMENT CONFIRMATION)
            </div>
            <div style={{ marginTop: '0.45rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: '999px', padding: '0.25rem 0.9rem', fontSize: '0.74rem', fontWeight: 800, color: '#15803d' }}>
              <CheckCircle2 size={15} /> NCC ĐÃ XÁC NHẬN ĐƠN HÀNG VÀ CAM KẾT TIẾN ĐỘ
            </div>
          </div>

          {/* 3. Kính gửi */}
          <div style={{ fontSize: '0.78rem', color: '#334155', marginBottom: '0.8rem', lineHeight: 1.5 }}>
            <strong>Kính gửi:</strong> Phòng Mua Hàng & Bộ Phận Kiểm Định Chất Lượng (QC) — <strong>CÔNG TY TNHH CÔNG NGHỆ AETHERPC</strong>
          </div>

          {/* 4. Khối 2 cột: Bên Mua & Bên Giao — Độc lập 50% / 50% */}
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: 'none', marginBottom: '0.85rem' }}>
            <colgroup>
              <col style={{ width: '50%' }} />
              <col style={{ width: '50%' }} />
            </colgroup>
            <tbody>
              <tr>
                {/* Cột Trái: Bên Nhận Hàng (AetherPC) */}
                <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '0.5rem', boxSizing: 'border-box' }}>
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.75rem 0.9rem', minHeight: '145px', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '0.3rem' }}>
                      Bên Nhận Hàng (Bên A — Khách Hàng)
                    </div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                      CÔNG TY TNHH CÔNG NGHỆ AETHERPC
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: '0.3rem', lineHeight: 1.4 }}>
                      Địa điểm giao: <strong>Kho Tổng AetherPC — Lô E2a-7, Đường D1, Khu Công nghệ cao, TP. Thủ Đức, TP.HCM</strong>
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: '0.3rem' }}>
                      Bộ phận tiếp nhận: <strong style={{ color: '#0f172a' }}>Phòng Mua Hàng & Kiểm Định QC</strong>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                      Hotline: 1900 6868 • Email: purchasing@kltn-erp.vn
                    </div>
                  </div>
                </td>

                {/* Cột Phải: Bên Giao Hàng (Nhà Cung Cấp) */}
                <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '0.5rem', boxSizing: 'border-box' }}>
                  <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '8px', padding: '0.75rem 0.9rem', minHeight: '145px', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '0.3rem' }}>
                      Bên Giao Hàng (Bên B — Nhà Cung Cấp)
                    </div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                      {supplierName}
                    </div>

                    <div style={{ marginTop: '0.35rem', padding: '0.35rem 0.65rem', backgroundColor: '#dcfce7', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>
                        CAM KẾT NGÀY GIAO HÀNG CHÍNH THỨC:
                      </div>
                      <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#15803d', marginTop: '0.1rem' }}>
                        {order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : 'Theo thỏa thuận đơn PO'}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: '0.35rem' }}>
                      Thời gian xác nhận: <strong style={{ color: '#0f172a' }}>{formatDateTime(order.updatedAt || new Date())}</strong>
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: '0.2rem' }}>
                      Hình thức: <strong>Giao tận kho (kèm CO/CQ, Hóa đơn VAT)</strong>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 5. Ghi chú của NCC (Nếu có) */}
          {(order.supplierNote || order.note) && (
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.55rem 0.85rem', marginBottom: '0.85rem', fontSize: '0.75rem', lineHeight: 1.45 }}>
              <span style={{ fontWeight: 800, color: '#b45309', textTransform: 'uppercase', fontSize: '0.7rem' }}>GHI CHÚ / CAM KẾT CỦA NCC: </span>
              <span style={{ color: '#78350f', fontStyle: 'italic' }}>"{order.supplierNote || order.note}"</span>
            </div>
          )}

          {/* 6. Bảng Hàng Hóa Xác Nhận */}
          <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.2px' }}>
            Danh mục linh kiện / hàng hóa xác nhận cung ứng:
          </div>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', marginBottom: '0.45rem', fontSize: '0.78rem' }}>
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: 'auto' }} />
              <col style={{ width: '55px' }} />
              <col style={{ width: '115px' }} />
              <col style={{ width: '125px' }} />
              <col style={{ width: '110px' }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '2px solid #0f172a', backgroundColor: '#f8fafc' }}>
                <th style={{ textAlign: 'center', padding: '0.45rem 0.35rem', color: '#475569' }}>STT</th>
                <th style={{ textAlign: 'left', padding: '0.45rem 0.5rem', color: '#475569' }}>Tên Sản Phẩm / Linh Kiện</th>
                <th style={{ textAlign: 'center', padding: '0.45rem 0.35rem', color: '#475569' }}>SL</th>
                <th style={{ textAlign: 'right', padding: '0.45rem 0.5rem', color: '#475569' }}>Đơn Giá</th>
                <th style={{ textAlign: 'right', padding: '0.45rem 0.5rem', color: '#475569' }}>Thành Tiền</th>
                <th style={{ textAlign: 'center', padding: '0.45rem 0.5rem', color: '#475569' }}>Tình Trạng</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const itName = it.product?.name || it.productName || it.name || it.productId || 'Linh Kiện Máy Tính';
                const itQty = parseInt(it.quantity) || 1;
                const itUnit = Number(it.unitCost || it.unitPrice || (order.totalAmount ? Math.round(order.totalAmount / itQty) : 0));
                const itTotal = Number(it.totalCost || it.totalAmount || (itQty * itUnit) || 0);
                return (
                  <tr key={it.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '0.5rem 0.5rem', color: '#0f172a', fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.35 }}>{itName}</td>
                    <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center', color: '#0f172a', fontWeight: 700 }}>{itQty}</td>
                    <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>{formatPrice(itUnit)}</td>
                    <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatPrice(itTotal)}</td>
                    <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
                        ✓ Sẵn sàng giao
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <td colSpan={2} style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#334155' }}>Tổng số lượng:</td>
                <td style={{ padding: '0.5rem 0.35rem', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>{totalQty} SP</td>
                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#334155' }}>Tổng giá trị xác nhận:</td>
                <td colSpan={2} style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', color: '#16a34a', whiteSpace: 'nowrap' }}>
                  {formatPrice(totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>

          {totalAmount > 0 && (
            <p style={{ fontSize: '0.74rem', color: '#64748b', fontStyle: 'italic', margin: '0.2rem 0 0.6rem' }}>
              Bằng chữ: <strong style={{ color: '#334155' }}>{formatCurrencyInWords(totalAmount)}</strong>.
            </p>
          )}

          {/* 7. Điều khoản cam kết pháp lý */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.85rem', marginBottom: '0.85rem', fontSize: '0.74rem', color: '#475569', lineHeight: 1.5 }}>
            <strong style={{ color: '#0f172a' }}>Cam kết của Nhà Cung Cấp:</strong>
            <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
              <li>Hàng hóa được giao bảo đảm mới 100%, đúng quy cách kỹ thuật, nguyên niêm phong (seal) của hãng sản xuất.</li>
              <li>Bàn giao kèm theo đầy đủ Hóa đơn GTGT, Phiếu đóng gói (Packing List) và Chứng từ xuất xưởng (CO/CQ) hợp pháp.</li>
              <li>Phối hợp cùng Bộ phận Kiểm Định QC và Bộ phận Kho của AetherPC nghiệm thu thực tế trước khi hoàn tất thủ tục bàn giao.</li>
            </ul>
          </div>

          {/* 8. Khối Chữ Ký — 2 Ô TRÊN 1 HÀNG (MỖI Ô RỘNG 50% THOÁNG ĐÃNG, KHÔNG BAO GIỜ BỊ TRÀN) */}
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: 'none', marginTop: '0.9rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.75rem' }}>
            <colgroup>
              <col style={{ width: '50%' }} />
              <col style={{ width: '50%' }} />
            </colgroup>
            <tbody>
              {/* HÀNG 1: ĐẠI DIỆN MUA HÀNG & ĐẠI DIỆN NHÀ CUNG CẤP */}
              <tr>
                {/* CỘT 1: BÊN MUA HÀNG TIẾP NHẬN */}
                <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top', padding: '0.5rem 0.75rem 0.75rem', boxSizing: 'border-box' }}>
                  <strong style={{ fontSize: '0.76rem', color: '#0f172a', display: 'block' }}>ĐẠI DIỆN PHÒNG MUA HÀNG TIẾP NHẬN</strong>
                  <div style={{ fontSize: '0.64rem', color: '#94a3b8', marginTop: '0.15rem' }}>(Ký, ghi rõ họ tên)</div>
                  <div style={{ minHeight: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.35rem auto' }}>
                    <div style={{
                      border: '1.5px dashed #2563eb',
                      borderRadius: '6px',
                      backgroundColor: '#eff6ff',
                      padding: '0.35rem 0.75rem',
                      display: 'inline-block',
                      minWidth: '160px',
                      maxWidth: '220px',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.2px' }}>
                        ✓ ĐÃ TIẾP NHẬN ĐƠN
                      </div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                        Phòng Mua Hàng AetherPC
                      </div>
                      <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '2px' }}>
                        {formatDate(order.createdAt || new Date())}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>
                    {order.buyerName || 'Nhân Viên Mua Hàng'}
                  </div>
                </td>

                {/* CỘT 2: ĐẠI DIỆN NHÀ CUNG CẤP */}
                <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top', padding: '0.5rem 0.75rem 0.75rem', boxSizing: 'border-box' }}>
                  <strong style={{ fontSize: '0.76rem', color: '#0f172a', display: 'block' }}>ĐẠI DIỆN NHÀ CUNG CẤP XÁC NHẬN</strong>
                  <div style={{ fontSize: '0.64rem', color: '#94a3b8', marginTop: '0.15rem' }}>(Ký số xác nhận & cam kết)</div>
                  <div style={{ minHeight: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.35rem auto' }}>
                    <div style={{
                      border: '1.5px dashed #059669',
                      borderRadius: '6px',
                      backgroundColor: '#ecfdf5',
                      padding: '0.35rem 0.75rem',
                      display: 'inline-block',
                      minWidth: '160px',
                      maxWidth: '220px',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#047857', letterSpacing: '0.2px' }}>
                        ✓ ĐÃ XÁC NHẬN ĐIỆN TỬ
                      </div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a', marginTop: '2px', wordBreak: 'break-word' }}>
                        {supplierName}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '2px' }}>
                        {formatDateTime(order.updatedAt || new Date())}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>
                    {supplierName}
                  </div>
                </td>
              </tr>

              {/* HÀNG 2: BỘ PHẬN KIỂM ĐỊNH QC & BỘ PHẬN KHO TIẾP NHẬN */}
              <tr>
                {/* CỘT 1: BỘ PHẬN KIỂM ĐỊNH QC */}
                <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top', padding: '0.5rem 0.75rem 0.35rem', boxSizing: 'border-box' }}>
                  <strong style={{ fontSize: '0.76rem', color: '#0f172a', display: 'block' }}>BỘ PHẬN KIỂM ĐỊNH QC</strong>
                  <div style={{ fontSize: '0.64rem', color: '#94a3b8', marginTop: '0.15rem' }}>(Tiếp nhận kế hoạch kiểm định)</div>
                  <div style={{ minHeight: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.35rem auto' }}>
                    <div style={{
                      border: '1px dashed #cbd5e1',
                      borderRadius: '6px',
                      backgroundColor: '#f8fafc',
                      padding: '0.35rem 0.75rem',
                      display: 'inline-block',
                      minWidth: '160px',
                      maxWidth: '220px',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ fontSize: '0.64rem', color: '#0f172a', fontWeight: 700 }}>
                        TIẾP NHẬN KIỂM ĐỊNH
                      </div>
                      <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '2px' }}>
                        (Nghiệm thu khi giao hàng)
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>
                    Đại Diện KCS / QC
                  </div>
                </td>

                {/* CỘT 2: BỘ PHẬN QUẢN LÝ KHO */}
                <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'top', padding: '0.5rem 0.75rem 0.35rem', boxSizing: 'border-box' }}>
                  <strong style={{ fontSize: '0.76rem', color: '#0f172a', display: 'block' }}>BỘ PHẬN QUẢN LÝ KHO</strong>
                  <div style={{ fontSize: '0.64rem', color: '#94a3b8', marginTop: '0.15rem' }}>(Kiểm đếm và nhập kho)</div>
                  <div style={{ minHeight: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.35rem auto' }}>
                    <div style={{
                      border: '1px dashed #cbd5e1',
                      borderRadius: '6px',
                      backgroundColor: '#f8fafc',
                      padding: '0.35rem 0.75rem',
                      display: 'inline-block',
                      minWidth: '160px',
                      maxWidth: '220px',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ fontSize: '0.64rem', color: '#0f172a', fontWeight: 700 }}>
                        TIẾP NHẬN NHẬP KHO
                      </div>
                      <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '2px' }}>
                        (Ký nhận sau nghiệm thu)
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>
                    Thủ Kho AetherPC
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

        </div>

        {/* Thanh thao tác dưới cùng (Không in) */}
        <div
          className="aetherpc-no-print"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '0.85rem 1.4rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            borderRadius: '0 0 14px 14px'
          }}
        >
          <button
            onClick={handlePrint}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.55rem 1.25rem',
              fontSize: '0.86rem',
              fontWeight: 700,
              backgroundColor: '#16a34a',
              border: 'none',
              borderRadius: '6px'
            }}
          >
            <Printer size={16} /> In Phiếu Xác Nhận NCC
          </button>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.86rem', borderRadius: '6px' }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
