import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInventoryStore, useSalesStore, useFinanceStore } from '../stores';
import { Bell, AlertTriangle, CheckCircle2, ShoppingBag, Truck, CreditCard, ShieldAlert, ArrowRight, Zap, X, Search, Filter } from 'lucide-react';

const CATEGORY_MAP_VI = {
  CPU: 'Bộ Vi Xử Lý (CPU)',
  VGA: 'Card Màn Hình (VGA)',
  MAINBOARD: 'Bo Mạch Chủ (Mainboard)',
  RAM: 'Bộ Nhớ Trong (RAM)',
  STORAGE: 'Ổ Cứng / Thẻ Nhớ (Storage)',
  CASE: 'Vỏ Máy Tính (Case)',
  PSU: 'Nguồn Máy Tính (PSU)',
  COOLER: 'Tản Nhiệt (Cooler)',
  MONITOR: 'Màn Hình (Monitor)',
  KEYBOARD: 'Bàn Phím (Keyboard)',
  MOUSE: 'Chuột Máy Tính (Mouse)',
  HEADPHONE: 'Tai Nghe (Headphone)',
  SPEAKER: 'Loa Máy Tính (Speaker)',
  ACCESSORY: 'Phụ Kiện (Accessory)',
  GEAR: 'Gaming Gear'
};

const getCategoryNameVi = (cat) => {
  if (!cat) return 'Khác';
  const key = String(cat).toUpperCase();
  return CATEGORY_MAP_VI[key] || cat;
};

export default function ActorNotificationBar() {
  const navigate = useNavigate();
  const { user, isCEO, isPurchasing, isAccountant, isWarehouse, isWarehouseManager, isSales, isSalesManager, isAssembly, isHR, isAdmin, isQC } = useAuth();
  const inventory = useInventoryStore(state => state.inventory) || [];
  const orders = useSalesStore(state => state.orders) || [];
  const purchaseOrders = useFinanceStore(state => state.purchaseOrders) || [];
  const receipts = [];

  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalStatusFilter, setModalStatusFilter] = useState('ALL');
  const [modalCategoryFilter, setModalCategoryFilter] = useState('ALL');

  const role = user?.role || '';
  
  const isItemDiscontinued = (item) => {
    return !item || item.available === false || item.isAvailable === false || item.status === 'DISCONTINUED' || item.status === 'INACTIVE' || item.available === 'false';
  };

  const activeInventory = (inventory || []).filter(item => !isItemDiscontinued(item));
  const outOfStockCount = activeInventory.filter(item => Number(item.stock || 0) === 0).length;
  const warningCount = activeInventory.filter(item => Number(item.stock || 0) > 0 && Number(item.stock || 0) <= Number(item.threshold || 0)).length;
  const lowStockList = activeInventory.filter(item => Number(item.stock || 0) <= Number(item.threshold || 0));
  const lowStockCount = lowStockList.length;

  const pendingQuotedPOs = (purchaseOrders || []).filter(po => po && po.status === 'QUOTED').length;
  const pendingPayablePOs = (purchaseOrders || []).filter(po => po && po.status === 'PO').length;
  const pendingReceipts = (receipts || []).filter(r => r && r.status === 'READY').length;
  const pendingExportCount = (orders || []).filter(o => o && o.status === 'CONFIRMED').length;
  const pendingDeliveryOrders = (orders || []).filter(o => o && (o.status === 'CONFIRMED' || o.status === 'READY_TO_SHIP')).length;

  const categoriesInModal = ['ALL', ...new Set(lowStockList.map(item => item.category).filter(Boolean))];

  const filteredModalList = lowStockList.filter(item => {
    const matchSearch = !modalSearch.trim() || 
      (item.name && item.name.toLowerCase().includes(modalSearch.toLowerCase())) ||
      (item.supplier && item.supplier.toLowerCase().includes(modalSearch.toLowerCase()));
    const isOut = Number(item.stock || 0) === 0;
    const matchStatus = modalStatusFilter === 'ALL' || 
      (modalStatusFilter === 'OUT_OF_STOCK' && isOut) ||
      (modalStatusFilter === 'WARNING' && !isOut);
    const matchCat = modalCategoryFilter === 'ALL' || item.category === modalCategoryFilter;
    return matchSearch && matchStatus && matchCat;
  });

  let bannerTitle = '';
  let bannerDesc = '';
  let actionText = '';
  let actionPath = '';
  let badgeText = '';
  let badgeColor = 'var(--primary)';
  let icon = <Bell size={18} />;

  if (isPurchasing) {
    bannerTitle = 'Trung Tâm Nhiệm Vụ Mua Hàng';
    bannerDesc = outOfStockCount > 0 
      ? `🔴 CẢNH BÁO: Có ${outOfStockCount} linh kiện HẾT HÀNG và ${warningCount} linh kiện DƯỚI NGƯỠNG AN TOÀN (Tổng ${lowStockCount} SP cần nhập)!`
      : warningCount > 0 
        ? `⚡ Tồn kho: Có ${warningCount} linh kiện dưới ngưỡng tồn an toàn đề xuất lập Yêu Cầu Báo Giá.`
        : 'Tất cả linh kiện đều đang ở mức tồn kho an toàn!';
    actionText = 'Xem Danh Sách Mua Hàng';
    actionPath = '/admin/purchasing';
    badgeText = `${lowStockCount} Cần Mua`;
    badgeColor = outOfStockCount > 0 ? '#ef4444' : '#fbbf24';
    icon = <ShoppingBag size={18} style={{ color: badgeColor }} />;
  } else if (isWarehouse || isWarehouseManager) {
    bannerTitle = 'Trung Tâm Nhiệm Vụ Quản Lý Kho';
    bannerDesc = pendingReceipts > 0 || lowStockCount > 0
      ? `📥 Có ${pendingReceipts} đơn nhận chờ nhập kho | Tồn kho thiếu: ${outOfStockCount} hết hàng, ${warningCount} dưới ngưỡng.`
      : 'Kho đang vận hành ổn định, không có đơn nhận hàng tồn đọng!';
    actionText = 'Quản Lý Kho Thực Tế';
    actionPath = '/admin/warehouse';
    badgeText = `${pendingReceipts} Đơn Nhận`;
    badgeColor = '#2563eb';
    icon = <Truck size={18} style={{ color: badgeColor }} />;
  } else if (isAccountant) {
    bannerTitle = 'Trung Tâm Nhiệm Vụ Kế Toán Tài Chính';
    bannerDesc = pendingPayablePOs > 0
      ? `💳 Có ${pendingPayablePOs} đơn mua hàng đã duyệt đang chờ Kế Toán giải ngân thanh toán NCC!`
      : 'Tất cả hóa đơn mua hàng và sổ cái doanh thu đã được đối soát đầy đủ!';
    actionText = 'Mở Sổ Cái & Thanh Toán';
    actionPath = '/admin/accounting';
    badgeText = `${pendingPayablePOs} Chờ Chi`;
    badgeColor = '#16a34a';
    icon = <CreditCard size={18} style={{ color: badgeColor }} />;
  } else if (isCEO || isAdmin) {
    bannerTitle = 'Trung Tâm Giám Sát Ban Giám Đốc';
    bannerDesc = pendingQuotedPOs > 0
      ? `🔔 THÔNG BÁO: Có ${pendingQuotedPOs} đơn báo giá từ NCC đang chờ Ban Giám Đốc phê duyệt!`
      : `Hệ thống hoạt động ổn định. Tồn kho thiếu: ${outOfStockCount} hết hàng + ${warningCount} dưới ngưỡng (Tổng: ${lowStockCount} SP) | Đơn chờ xuất kho: ${pendingExportCount}`;
    actionText = 'Duyệt Báo Giá NCC';
    actionPath = '/admin/purchasing';
    badgeText = `${pendingQuotedPOs} Đơn Chờ CEO`;
    badgeColor = '#fbbf24';
    icon = <ShieldAlert size={18} style={{ color: badgeColor }} />;
  } else if (isQC || role === 'QC' || role === 'QA') {
    const pendingQaCount = (purchaseOrders || []).filter(po => ['CONFIRMED_BY_SUPPLIER', 'PO', 'APPROVED', 'PENDING_QA', 'SHIPPED', 'DELIVERED', 'RFQ_SENT', 'SENT'].includes(po.status)).length;
    bannerTitle = 'Trung Tâm Kiểm Định Chất Lượng QA/QC (Quality Control Task Center)';
    bannerDesc = pendingQaCount > 0
      ? `🔬 Có ${pendingQaCount} lô hàng mới từ NCC giao tới, cần thực hiện nghiệm thu chất lượng!`
      : 'Tất cả các lô hàng nhập đã được kiểm định hoàn tất!';
    actionText = 'Kiểm Định Ngay';
    actionPath = '/admin/quality-control';
    badgeText = `${pendingQaCount} Lô Chờ QA/QC`;
    badgeColor = '#2563eb';
    icon = <ShieldAlert size={18} style={{ color: badgeColor }} />;
  } else if (isSales || isSalesManager) {
    bannerTitle = 'Trung Tâm Nhiệm Vụ Bán Hàng & Đơn Hàng (Sales Task Center)';
    bannerDesc = pendingDeliveryOrders > 0
      ? `🚚 Có ${pendingDeliveryOrders} đơn bán lẻ mới cần kiểm tra và bàn giao kho xuất hàng!`
      : 'Tất cả đơn bán lẻ đã được xử lý hoàn tất!';
    actionText = 'Quản Lý Đơn Hàng';
    actionPath = '/admin/sales';
    badgeText = `${pendingDeliveryOrders} Đơn Mới`;
    badgeColor = '#818cf8';
    icon = <ShoppingBag size={18} style={{ color: badgeColor }} />;
  } else if (role === 'DELIVERY') {
    const uName = String(user?.fullname || user?.name || '').toLowerCase();
    const uUser = String(user?.username || '').toLowerCase();
    const uPhone = String(user?.phone || '').replace(/\D/g, '');

    const myAssignedOrders = (orders || []).filter(o => {
      if (!o || o.status !== 'SHIPPED') return false;
      const s = String(o.assignedShipper || '').toLowerCase();
      return (uName && s.includes(uName)) || (uUser && s.includes(uUser)) || (uPhone && s.includes(uPhone)) || String(o.assignedShipperId) === String(user?.id);
    });

    const readyAtWarehouse = (orders || []).filter(o => o && o.status === 'READY_TO_SHIP');
    const totalDeliveryTasks = myAssignedOrders.length + readyAtWarehouse.length;

    bannerTitle = 'Trung Tâm Nhiệm Vụ Giao Vận (Delivery Task Center)';
    bannerDesc = myAssignedOrders.length > 0
      ? `🚚 THÔNG BÁO MỚI: Bạn có ${myAssignedOrders.length} đơn hàng mới đã được Thủ kho bàn giao, sẵn sàng xuất phát đi giao và thu tiền COD!`
      : readyAtWarehouse.length > 0
        ? `📦 Có ${readyAtWarehouse.length} đơn hàng đã đóng gói xong tại kho đang chờ Shipper nhận chuyến!`
        : 'Hiện tại tất cả các chuyến giao hàng của bạn đã hoàn tất. Không có đơn tồn đọng!';
    actionText = 'Xem Chuyến Giao Ngay';
    actionPath = '/admin/delivery?tab=pending';
    badgeText = `${totalDeliveryTasks} Chuyến Cần Giao`;
    badgeColor = myAssignedOrders.length > 0 ? '#16a34a' : '#2563eb';
    icon = <Truck size={18} style={{ color: badgeColor }} />;
  } else {
    return null;
  }

  const handleActionClick = () => {
    if (isPurchasing || (isCEO && lowStockCount > 0)) {
      setShowModal(true);
      window.dispatchEvent(new Event('open-low-stock-modal'));
    }
    if (actionPath) {
      if (isQC || role === 'QC' || role === 'QA') {
        navigate(actionPath, { state: { openInspection: true, timestamp: Date.now() } });
      } else {
        navigate(actionPath, { state: { showLowStockList: true, timestamp: Date.now() } });
      }
    }
  };

  const handleOpenRFQForProduct = (prod) => {
    setShowModal(false);
    const targetQty = prod?.requestedQty || prod?.quantity;
    navigate('/admin/purchasing', { state: { createRFQ: true, product: prod, quantity: targetQty, timestamp: Date.now() } });
    window.dispatchEvent(new CustomEvent('open-rfq-prefill-modal', { detail: { product: prod, quantity: targetQty } }));
  };

  return (
    <>
      <div style={{
        marginBottom: '1.5rem',
        padding: '0.85rem 1.25rem',
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        border: '1px solid #cbd5e1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            {icon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                {bannerTitle}
              </h4>
              {badgeText && (
                <span style={{
                  backgroundColor: '#fef3c7', color: '#d97706',
                  padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700,
                  border: '1px solid #fde68a'
                }}>
                  {badgeText}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0', lineHeight: 1.3 }}>
              {bannerDesc}
            </p>
          </div>
        </div>

        {actionPath && actionText && (
          <button
            onClick={handleActionClick}
            style={{
              fontSize: '0.78rem', padding: '0.5rem 1rem', borderRadius: '8px',
              display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700,
              color: '#ffffff', backgroundColor: badgeColor || '#2563eb', border: 'none',
              cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
            }}
          >
            <span>{actionText}</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* Built-in Low Stock Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 99999, padding: '1.5rem'
        }}>
          <div style={{
            width: '100%', maxWidth: '940px', maxHeight: '88vh', overflowY: 'auto',
            padding: '1.75rem', borderRadius: '20px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1',
            boxShadow: '0 25px 60px rgba(15,23,42,0.2)'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem'
            }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShoppingBag size={20} style={{ color: '#d97706' }} />
                  Danh Sách Linh Kiện Cần Bổ Sung Tồn Kho (Low Stock List)
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0 0' }}>
                  Hiển thị <strong style={{ color: '#d97706' }}>{filteredModalList.length}</strong> / {lowStockList.length} sản phẩm hết hàng hoặc dưới ngưỡng tồn an toàn (Min-Max Rule).
                </p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Search & Filter Toolbar */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Tìm theo tên linh kiện, nhà cung cấp..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  style={{ paddingLeft: '2.4rem', height: '36px', fontSize: '0.82rem', width: '100%', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                />
              </div>

              <div style={{ width: '170px' }}>
                <select
                  className="input-field"
                  value={modalStatusFilter}
                  onChange={(e) => setModalStatusFilter(e.target.value)}
                  style={{ height: '36px', fontSize: '0.82rem', padding: '0 0.75rem', width: '100%', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="OUT_OF_STOCK">🔴 Hết Hàng (0)</option>
                  <option value="WARNING">⚡ Cảnh Báo Tồn Kho</option>
                </select>
              </div>

              <div style={{ width: '210px' }}>
                <select
                  className="input-field"
                  value={modalCategoryFilter}
                  onChange={(e) => setModalCategoryFilter(e.target.value)}
                  style={{ height: '36px', fontSize: '0.82rem', padding: '0 0.75rem', width: '100%', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}
                >
                  <option value="ALL">Tất cả phân nhóm</option>
                  {categoriesInModal.map(cat => cat !== 'ALL' && (
                    <option key={cat} value={cat}>{getCategoryNameVi(cat)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table Container */}
            <div className="table-container" style={{ maxHeight: '460px', overflowY: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <table className="erp-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '42%', textAlign: 'left' }}>Tên Linh Kiện</th>
                    <th style={{ width: '12%', textAlign: 'center' }}>Tồn Hiện Tại</th>
                    <th style={{ width: '12%', textAlign: 'center' }}>Ngưỡng An Toàn</th>
                    <th style={{ width: '16%', textAlign: 'center' }}>Trạng Thái</th>
                    <th style={{ width: '18%', textAlign: 'center' }}>Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModalList.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                        🎉 Không tìm thấy linh kiện nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredModalList.map((item, idx) => (
                      <tr key={item.id || item.productId || idx}>
                        <td style={{ textAlign: 'left', wordBreak: 'break-word' }}>
                          <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>{item.name || item.productName}</strong>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            Phân nhóm: <span style={{ color: '#818cf8' }}>{getCategoryNameVi(item.category)}</span> | NCC: {item.supplier || 'Chưa rõ'}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.9rem', color: Number(item.stock || 0) === 0 ? '#ef4444' : '#fbbf24' }}>
                          {item.stock ?? 0}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {item.threshold ?? 5}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {Number(item.stock || 0) === 0 ? (
                            <span className="badge badge-danger" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>HẾT HÀNG</span>
                          ) : (
                            <span className="badge badge-warning" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>CẢNH BÁO TỒN</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleOpenRFQForProduct(item)}
                            className="btn btn-primary shadow-glow hover-scale"
                            style={{
                              padding: '0.45rem 0.85rem',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.35rem',
                              borderRadius: '8px',
                              whiteSpace: 'nowrap',
                              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                              cursor: 'pointer'
                            }}
                          >
                            <Zap size={13} />
                            <span>⚡ Tạo RFQ</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Bấm <strong>"⚡ Tạo RFQ"</strong> để tự động khởi tạo phiếu báo giá mua hàng cho nhà cung cấp.
              </span>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ borderRadius: '8px', padding: '0.45rem 1.25rem' }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
