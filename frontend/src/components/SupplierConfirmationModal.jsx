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
          maxWidth: '750px',
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* VÙNG IN CHUẨN A4 */}
        <div id="aetherpc-supplier-confirm-document">
          {/* Header chứng từ */}
          <div style={{ padding: '0.75rem 1.1rem 0.55rem', borderBottom: '2px solid #0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, paddingRight: '0.75rem' }}>
                <div style={{ fontSize: '0.64rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  NHÀ CUNG CẤP / SUPPLIER
                </div>
                <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                  {supplierName}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.1rem', lineHeight: 1.35 }}>
                  Mã NCC: <strong style={{ color: '#0f172a' }}>{supplierCode}</strong>
                  {supplierPhone !== '—' && ` • ĐT: ${supplierPhone}`}
                  {supplierEmail !== '—' && ` • Email: ${supplierEmail}`}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                  Địa chỉ: {supplierAddress}
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 700 }}>Mẫu số: PXN-NCC/2026</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', marginTop: '0.1rem' }}>
                  Số: PXN-{order.poNumber || order.code || 'PO'}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.08rem' }}>
                  Ngày lập: <strong style={{ color: '#0f172a' }}>{formatDate(order.updatedAt || new Date())}</strong>
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.08rem' }}>
                  Căn cứ PO: <strong style={{ color: '#2563eb' }}>{order.poNumber || order.code || '—'}</strong>
                </div>
              </div>

              <button
                onClick={onClose}
                className="aetherpc-no-print"
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  cursor: 'pointer',
                  padding: '0.35rem',
                  borderRadius: '6px',
                  display: 'flex',
                  marginLeft: '0.75rem'
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tiêu đề chính */}
          <div style={{ textAlign: 'center', padding: '0.55rem 1.1rem 0.35rem' }}>
            <h2 style={{ margin: '0', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px', textTransform: 'uppercase' }}>
              PHIẾU XÁC NHẬN ĐƠN HÀNG & LỊCH GIAO HÀNG
            </h2>
            <div style={{ fontSize: '0.68rem', color: '#64748b', fontStyle: 'italic', marginTop: '0.1rem' }}>
              (SUPPLIER ORDER & DELIVERY COMMITMENT CONFIRMATION)
            </div>
            <div style={{ marginTop: '0.3rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: '999px', padding: '0.18rem 0.75rem', fontSize: '0.68rem', fontWeight: 800, color: '#15803d' }}>
              <CheckCircle2 size={13} /> NCC ĐÃ XÁC NHẬN ĐƠN HÀNG VÀ CAM KẾT TIẾN ĐỘ
            </div>
          </div>

          {/* Kính gửi & Nội dung cam kết */}
          <div style={{ padding: '0.3rem 1.1rem 0.65rem' }}>
            <div style={{ fontSize: '0.74rem', color: '#334155', marginBottom: '0.45rem', lineHeight: 1.4 }}>
              <strong>Kính gửi:</strong> Phòng Mua Hàng & Bộ Phận Kiểm Định Chất Lượng (QC) — <strong>CÔNG TY TNHH CÔNG NGHỆ AETHERPC</strong>
            </div>

            {/* Khối Thông tin Giao Nhận */}
            <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '8px', padding: '0.55rem 0.85rem', marginBottom: '0.45rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', fontSize: '0.74rem' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '0.5rem' }}>
                      <div style={{ color: '#166534', fontWeight: 700, marginBottom: '0.15rem' }}>ĐỊA ĐIỂM GIAO HÀNG (BÊN NHẬN):</div>
                      <div style={{ color: '#0f172a', fontWeight: 700 }}>Công Ty TNHH Công Nghệ AetherPC</div>
                      <div style={{ color: '#475569', fontSize: '0.7rem' }}>Kho Tổng: Lô E2a-7, Đường D1, Khu Công nghệ cao, TP. Thủ Đức, TP.HCM</div>
                      <div style={{ color: '#475569', fontSize: '0.7rem', marginTop: '0.15rem' }}>Bộ phận tiếp nhận kiểm định: <strong>Phòng QC & Thủ Kho</strong></div>
                    </td>
                    <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '0.5rem', borderLeft: '1px dashed #86efac' }}>
                      <div style={{ color: '#166534', fontWeight: 700, marginBottom: '0.15rem' }}>TIẾN ĐỘ CAM KẾT GIAO HÀNG:</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                        <span style={{ color: '#475569' }}>Ngày hẹn giao:</span>
                        <strong style={{ color: '#15803d', fontSize: '0.92rem' }}>
                          {order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : 'Theo thỏa thuận đơn PO'}
                        </strong>
                      </div>
                      <div style={{ color: '#475569', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                        Thời gian xác nhận: <strong>{formatDateTime(order.updatedAt || new Date())}</strong>
                      </div>
                      <div style={{ color: '#475569', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                        Hình thức giao: <strong>Giao hàng tận kho (kèm CO/CQ, Hóa đơn VAT)</strong>
                      </div>
                    </td>
                  </tr>
                  {(order.supplierNote || order.note) && (
                    <tr>
                      <td colSpan={2} style={{ paddingTop: '0.35rem', borderTop: '1px dashed #bbf7d0', marginTop: '0.35rem' }}>
                        <div style={{ color: '#166534', fontWeight: 700, fontSize: '0.7rem' }}>GHI CHÚ / CAM KẾT CỦA NHÀ CUNG CẤP:</div>
                        <div style={{ color: '#1e293b', fontStyle: 'italic', fontSize: '0.72rem', marginTop: '0.08rem' }}>
                          "{order.supplierNote || order.note}"
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bảng Hàng Hóa Xác Nhận */}
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
              Danh mục linh kiện / hàng hóa xác nhận cung ứng:
            </div>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', marginBottom: '0.3rem', fontSize: '0.74rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #0f172a', backgroundColor: '#f8fafc' }}>
                  <th style={{ textAlign: 'center', padding: '0.32rem 0.25rem', color: '#475569', width: '34px' }}>STT</th>
                  <th style={{ textAlign: 'left', padding: '0.32rem 0.35rem', color: '#475569' }}>Tên Sản Phẩm / Linh Kiện</th>
                  <th style={{ textAlign: 'center', padding: '0.32rem 0.25rem', color: '#475569', width: '46px' }}>SL</th>
                  <th style={{ textAlign: 'right', padding: '0.32rem 0.35rem', color: '#475569', width: '100px' }}>Đơn Giá</th>
                  <th style={{ textAlign: 'right', padding: '0.32rem 0.35rem', color: '#475569', width: '110px' }}>Thành Tiền</th>
                  <th style={{ textAlign: 'center', padding: '0.32rem 0.35rem', color: '#475569', width: '90px' }}>Tình Trạng</th>
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
                      <td style={{ padding: '0.32rem 0.25rem', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '0.32rem 0.35rem', color: '#0f172a', fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.3 }}>{itName}</td>
                      <td style={{ padding: '0.32rem 0.25rem', textAlign: 'center', color: '#0f172a', fontWeight: 700 }}>{itQty}</td>
                      <td style={{ padding: '0.32rem 0.35rem', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>{formatPrice(itUnit)}</td>
                      <td style={{ padding: '0.32rem 0.35rem', textAlign: 'right', color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatPrice(itTotal)}</td>
                      <td style={{ padding: '0.32rem 0.35rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#15803d', backgroundColor: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
                          ✓ Sẵn sàng giao
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <td colSpan={2} style={{ padding: '0.35rem 0.35rem', textAlign: 'right', fontWeight: 700, color: '#334155' }}>Tổng số lượng:</td>
                  <td style={{ padding: '0.35rem 0.25rem', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>{totalQty} SP</td>
                  <td style={{ padding: '0.35rem 0.35rem', textAlign: 'right', fontWeight: 700, color: '#334155' }}>Tổng giá trị xác nhận:</td>
                  <td colSpan={2} style={{ padding: '0.35rem 0.35rem', textAlign: 'right', fontWeight: 800, fontSize: '0.88rem', color: '#16a34a', whiteSpace: 'nowrap' }}>
                    {formatPrice(totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {totalAmount > 0 && (
              <p style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', margin: '0.1rem 0 0.35rem' }}>
                Bằng chữ: <strong style={{ color: '#334155' }}>{formatCurrencyInWords(totalAmount)}</strong>.
              </p>
            )}

            {/* Cam kết quy chuẩn */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.35rem 0.65rem', marginBottom: '0.45rem', fontSize: '0.7rem', color: '#475569', lineHeight: 1.4 }}>
              <strong>Cam kết của Bên B (Nhà Cung Cấp):</strong> Hàng hóa được giao bảo đảm mới 100%, đúng quy cách kỹ thuật, đầy đủ chứng từ xuất xưởng (CO/CQ), phiếu đóng gói và hóa đơn VAT hợp pháp khi bàn giao cho bộ phận QC và Kho của AetherPC nghiệm thu.
            </div>

            {/* Khối Chữ Ký 3 Bên — Cân đối 3 cột */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', marginTop: '0.45rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.45rem' }}>
              <tbody>
                <tr>
                  {/* CỘT 1: BÊN MUA HÀNG TIẾP NHẬN */}
                  <td style={{ width: '33.33%', textAlign: 'center', verticalAlign: 'top', padding: '0.35rem 0.2rem 0' }}>
                    <strong style={{ fontSize: '0.72rem', color: '#0f172a', display: 'block' }}>PHÒNG MUA HÀNG TIẾP NHẬN</strong>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '0.1rem' }}>(Ký, ghi rõ họ tên)</div>
                    <div style={{ minHeight: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.2rem auto' }}>
                      <div style={{
                        border: '1.5px dashed #2563eb',
                        borderRadius: '6px',
                        backgroundColor: '#eff6ff',
                        padding: '0.2rem 0.4rem',
                        width: '100%',
                        maxWidth: '155px',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.2px' }}>
                          ✓ ĐÃ TIẾP NHẬN
                        </div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0f172a', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Phòng Mua Hàng
                        </div>
                        <div style={{ fontSize: '0.58rem', color: '#64748b', marginTop: '1px' }}>
                          {formatDate(order.createdAt || new Date())}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {order.buyerName || 'Nhân Viên Mua Hàng'}
                    </div>
                  </td>

                  {/* CỘT 2: BỘ PHẬN KIỂM ĐỊNH QC */}
                  <td style={{ width: '33.33%', textAlign: 'center', verticalAlign: 'top', padding: '0.35rem 0.2rem 0' }}>
                    <strong style={{ fontSize: '0.72rem', color: '#0f172a', display: 'block' }}>BỘ PHẬN KIỂM ĐỊNH QC</strong>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '0.1rem' }}>(Tiếp nhận kế hoạch kiểm thử)</div>
                    <div style={{ minHeight: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.2rem auto' }}>
                      <div style={{
                        border: '1px dashed #cbd5e1',
                        borderRadius: '6px',
                        backgroundColor: '#f8fafc',
                        padding: '0.25rem 0.4rem',
                        width: '100%',
                        maxWidth: '155px',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ fontSize: '0.62rem', color: '#0f172a', fontWeight: 700 }}>
                          KIỂM ĐỊNH LÔ HÀNG
                        </div>
                        <div style={{ fontSize: '0.58rem', color: '#64748b', marginTop: '1px' }}>
                          (Ký nghiệm thu khi giao)
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      Đại Diện KCS / QC
                    </div>
                  </td>

                  {/* CỘT 3: ĐẠI DIỆN NHÀ CUNG CẤP */}
                  <td style={{ width: '33.33%', textAlign: 'center', verticalAlign: 'top', padding: '0.35rem 0.2rem 0' }}>
                    <strong style={{ fontSize: '0.72rem', color: '#0f172a', display: 'block' }}>ĐẠI DIỆN NHÀ CUNG CẤP</strong>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '0.1rem' }}>(Ký số xác nhận & cam kết)</div>
                    <div style={{ minHeight: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.2rem auto' }}>
                      <div style={{
                        border: '1.5px dashed #059669',
                        borderRadius: '6px',
                        backgroundColor: '#ecfdf5',
                        padding: '0.2rem 0.4rem',
                        width: '100%',
                        maxWidth: '155px',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#047857', letterSpacing: '0.2px' }}>
                          ✓ ĐÃ XÁC NHẬN ĐIỆN TỬ
                        </div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0f172a', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {supplierName}
                        </div>
                        <div style={{ fontSize: '0.58rem', color: '#64748b', marginTop: '1px' }}>
                          {formatDateTime(order.updatedAt || new Date())}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {supplierName}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Thanh thao tác dưới cùng (Không in) */}
        <div
          className="aetherpc-no-print"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '0.75rem 1.1rem',
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
              padding: '0.5rem 1.1rem',
              fontSize: '0.84rem',
              fontWeight: 700,
              backgroundColor: '#16a34a',
              border: 'none',
              borderRadius: '6px'
            }}
          >
            <Printer size={15} /> In Phiếu Xác Nhận NCC
          </button>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.84rem', borderRadius: '6px' }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
