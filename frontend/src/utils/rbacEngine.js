// Centralized Granular Operational RBAC Engine for AetherPC ERP

export const ERP_SYSTEM_MODULES = [
  { id: 'dashboard', name: 'Báo Cáo Tổng Quan', path: '/admin/dashboard', desc: 'Chỉ số KPI, hiệu quả kinh doanh, tài chính và điều hành', category: 'Quản Trị' },
  { id: 'sales', name: 'Bán Hàng & Đơn Hàng', path: '/admin/sales', desc: 'Bán lẻ tại quầy POS, quản lý đơn hàng và khách hàng', category: 'Kinh Doanh' },
  { id: 'warehouse', name: 'Quản Lý Kho & Tồn Kho', path: '/admin/warehouse', desc: 'Nhập xuất tồn, vị trí kệ, đóng gói và điều phối giao hàng', category: 'Kho Vận' },
  { id: 'purchasing', name: 'Mua Hàng & Nhà Cung Cấp', path: '/admin/purchasing', desc: 'Yêu cầu báo giá, đơn mua hàng PO và quản lý nhà cung cấp', category: 'Mua Hàng' },
  { id: 'quality-control', name: 'Kiểm Định Chất Lượng', path: '/admin/quality-control', desc: 'Kiểm tra chất lượng hàng nhập và thẩm định đổi trả bảo hành', category: 'Kỹ Thuật' },
  { id: 'assembly', name: 'Lắp Ráp Máy Tính', path: '/admin/assembly', desc: 'Quy trình lắp ráp linh kiện, kiểm thử kỹ thuật và dán tem', category: 'Kỹ Thuật' },
  { id: 'delivery', name: 'Giao Hàng & Thu Tiền', path: '/admin/delivery', desc: 'Điều phối tuyến giao, xác nhận giao hàng và thu hộ tiền mặt', category: 'Giao Vận' },
  { id: 'accounting', name: 'Kế Toán & Tài Chính', path: '/admin/accounting', desc: 'Sổ quỹ thu chi, đối soát công nợ, bảng lương và hóa đơn', category: 'Tài Chính' },
  { id: 'cskh', name: 'Chăm Sóc Khách Hàng', path: '/admin/cskh', desc: 'Tiếp nhận yêu cầu bảo hành, phản hồi khiếu nại và tư vấn', category: 'Dịch Vụ' },
  { id: 'hr', name: 'Quản Trị Nhân Sự', path: '/admin/hr', desc: 'Hồ sơ nhân sự, chấm công, ngày phép và tính lương', category: 'Nhân Sự' },
  { id: 'system', name: 'Quản Trị Hệ Thống', path: '/admin/system', desc: 'Phân quyền tài khoản, cấu hình bảo mật và sao lưu dữ liệu', category: 'Quản Trị' }
];

export const ERP_ROLES = [
  { code: 'ADMIN', name: 'Quản Trị Viên', color: '#ef4444', desc: 'Toàn quyền cấu hình, bảo mật và vận hành hệ thống' },
  { code: 'CEO', name: 'Ban Giám Đốc', color: '#f59e0b', desc: 'Xem toàn bộ báo cáo và phê duyệt các giao dịch trọng yếu' },
  { code: 'SALES_MANAGER', name: 'Quản Lý Bán Hàng', color: '#1d4ed8', desc: 'Quản lý kênh bán hàng, duyệt chiết khấu và đơn hàng lớn' },
  { code: 'SALES', name: 'Nhân Viên Bán Hàng', color: '#2563eb', desc: 'Bán lẻ tại quầy POS, tạo đơn và tra cứu tồn kho' },
  { code: 'WAREHOUSE_MANAGER', name: 'Quản Lý Kho', color: '#059669', desc: 'Quản lý mặt bằng kho, duyệt phiếu yêu cầu và phân công giao hàng' },
  { code: 'WAREHOUSE', name: 'Thủ Kho', color: '#10b981', desc: 'Quét mã đóng gói, dán nhãn niêm phong và bốc dỡ nhập kệ' },
  { code: 'PURCHASING', name: 'Nhân Viên Mua Hàng', color: '#f97316', desc: 'Tìm kiếm nhà cung cấp, đàm phán giá và lập đơn mua hàng' },
  { code: 'QC', name: 'Kiểm Định Chất Lượng', color: '#8b5cf6', desc: 'Nghiệm thu chất lượng hàng nhập và thẩm định linh kiện bảo hành' },
  { code: 'ASSEMBLY', name: 'Kỹ Thuật Lắp Ráp', color: '#0ea5e9', desc: 'Lắp ráp phần cứng máy tính và kiểm thử hiệu năng' },
  { code: 'DELIVERY', name: 'Nhân Viên Giao Hàng', color: '#64748b', desc: 'Giao hàng theo tuyến, chụp ảnh chứng từ và thu tiền mặt' },
  { code: 'ACCOUNTANT', name: 'Kế Toán', color: '#14b8a6', desc: 'Kiểm soát dòng tiền thu chi, đối soát và quyết toán tài chính' },
  { code: 'CSKH', name: 'Chăm Sóc Khách Hàng', color: '#06b6d4', desc: 'Tiếp nhận hỗ trợ, tư vấn khách hàng và xử lý đổi trả' },
  { code: 'HR', name: 'Quản Trị Nhân Sự', color: '#ec4899', desc: 'Quản lý hồ sơ nhân viên, chấm công và chế độ đãi ngộ' }
];

// Danh mục toàn bộ các nghiệp vụ thực tế trong ERP (Granular Operations Catalog)
export const OPERATIONAL_PERMISSIONS = [
  // 1. Phân Hệ Bán Hàng & Đơn Hàng
  { id: 'sales_pos_checkout', moduleId: 'sales', name: 'Bán lẻ tại quầy POS & in phiếu thu', desc: 'Mở ca thu ngân, quét mã vạch linh kiện và thanh toán tại quầy' },
  { id: 'sales_approve_discount', moduleId: 'sales', name: 'Duyệt chiết khấu bán lẻ vượt hạn mức (> 10%)', desc: 'Phê duyệt mức giảm giá đặc biệt cho khách hàng thân thiết hoặc đơn lớn' },
  { id: 'sales_cancel_order', moduleId: 'sales', name: 'Duyệt hủy đơn hàng & hoàn tiền khách', desc: 'Xác nhận hủy đơn hàng và cho phép hoàn tiền theo quy định' },
  { id: 'sales_manage_promotions', moduleId: 'sales', name: 'Quản lý bảng giá & chương trình khuyến mãi', desc: 'Thêm sửa xóa các mã giảm giá và chiến dịch khuyến mãi' },
  { id: 'sales_view_orders', moduleId: 'sales', name: 'Xem danh sách và tra cứu lịch sử đơn hàng', desc: 'Tra cứu toàn bộ đơn hàng của cửa hàng và trạng thái xử lý' },

  // 2. Phân Hệ Kho Vận & Tồn Kho
  { id: 'warehouse_pack_scan', moduleId: 'warehouse', name: 'Đóng gói & quét mã vạch niêm phong (Thủ kho)', desc: 'Thao tác vật lý: lấy linh kiện, kiểm tra seal và quét mã đóng gói kiện hàng' },
  { id: 'warehouse_dispatch_shipper', moduleId: 'warehouse', name: 'Phân công Shipper & đơn vị giao vận (Quản lý kho)', desc: 'Điều phối tài xế nội bộ theo tuyến hoặc bàn giao cho đối tác 3PL' },
  { id: 'warehouse_stock_intake', moduleId: 'warehouse', name: 'Xếp hàng lên kệ kho sau khi QA nghiệm thu Đạt', desc: 'Bốc dỡ linh kiện từ dock nhập và quét mã vị trí xếp vào ô kệ cố định' },
  { id: 'warehouse_create_pr', moduleId: 'warehouse', name: 'Lập đề xuất Phiếu Yêu Cầu Mua Hàng (PR)', desc: 'Tạo phiếu PR khi phát hiện số lượng tồn kho chạm ngưỡng cảnh báo an toàn (ROP)' },
  { id: 'warehouse_approve_pr', moduleId: 'warehouse', name: 'Ký duyệt Phiếu Yêu Cầu Mua Hàng (PR) của kho', desc: 'Quản lý kho kiểm tra và ký duyệt trước khi chuyển tự động sang phòng Mua hàng' },
  { id: 'warehouse_manage_locations', moduleId: 'warehouse', name: 'Cấu hình sơ đồ vị trí kệ kho (Zone / Shelf / Bin)', desc: 'Thêm mới hoặc sửa đổi cấu trúc sơ đồ các khu vực và dãy kệ' },
  { id: 'warehouse_audit_adjust', moduleId: 'warehouse', name: 'Phê duyệt kiểm kê & điều chỉnh tồn kho', desc: 'Xác nhận số lượng tồn thực tế chênh lệch và cập nhật số liệu kho' },
  { id: 'warehouse_view_inventory', moduleId: 'warehouse', name: 'Tra cứu tồn kho & vị trí linh kiện', desc: 'Xem số lượng khả dụng, giá trị tồn và vị trí ô kệ của từng linh kiện' },

  // 3. Phân Hệ Mua Hàng & Nhà Cung Cấp
  { id: 'purchasing_create_rfq', moduleId: 'purchasing', name: 'Lập & gửi Yêu Cầu Báo Giá (RFQ) đa NCC', desc: 'Tiếp nhận PR từ kho, chọn danh sách nhà cung cấp phù hợp và gửi RFQ' },
  { id: 'purchasing_compare_quotes', moduleId: 'purchasing', name: 'So sánh bảng giá NCC & lập tờ trình báo giá', desc: 'Tổng hợp ma trận đánh giá giá cả, hạn mức nợ và chất lượng để trình cấp trên' },
  { id: 'purchasing_approve_po', moduleId: 'purchasing', name: 'Ký duyệt Báo Giá / Đơn PO (Ban Giám Đốc)', desc: 'CEO phê duyệt chính thức bảng chào giá để phát hành đơn mua hàng PO' },
  { id: 'purchasing_issue_po', moduleId: 'purchasing', name: 'Phát hành & gửi Đơn Mua Hàng (PO) tới NCC', desc: 'Ký hợp đồng và gửi đơn PO chính thức yêu cầu nhà cung cấp giao hàng' },
  { id: 'purchasing_manage_suppliers', moduleId: 'purchasing', name: 'Quản lý danh bạ & đánh giá Nhà Cung Cấp', desc: 'Thêm mới thông tin NCC, thời hạn thanh toán và chấm điểm chất lượng' },
  { id: 'purchasing_view_orders', moduleId: 'purchasing', name: 'Tra cứu đơn mua hàng & nhà cung cấp', desc: 'Xem danh sách PO, báo giá và hồ sơ NCC mà không thao tác tạo/duyệt' },

  // 4. Phân Hệ Kiểm Định Chất Lượng (QA/QC)
  { id: 'qc_inspect_inbound', moduleId: 'quality-control', name: 'Tiến hành nghiệm thu lô hàng PO tại Dock nhập', desc: 'Kiểm tra ngoại quan, test seal niêm phong, quét Serial và ký biên bản QA_PASSED/REJECTED' },
  { id: 'qc_inspect_rma', moduleId: 'quality-control', name: 'Thẩm định lỗi kỹ thuật linh kiện bảo hành / RMA', desc: 'Đưa linh kiện lên Bench Test kiểm tra lỗi nguồn, cong socket, chập cháy' },
  { id: 'qc_inspect_restock', moduleId: 'quality-control', name: 'Kiểm tra tem niêm phong kiện hàng hoàn / bom', desc: 'Đánh giá điều kiện ngoại quan kiện hàng khách không nhận trước khi cho nhập lại kho' },
  { id: 'qc_view_logs', moduleId: 'quality-control', name: 'Tra cứu hồ sơ & biên bản kiểm định chất lượng', desc: 'Xem lại các biên bản nghiệm thu đầu vào và lịch sử lỗi kỹ thuật' },

  // 5. Phân Hệ Lắp Ráp Máy Tính (Assembly)
  { id: 'assembly_build_pc', moduleId: 'assembly', name: 'Thực hiện quy trình lắp ráp phần cứng PC 4 bước', desc: 'Nhận linh kiện từ kho, lắp ráp main/chip/card và đi dây thùng máy' },
  { id: 'assembly_benchmark_stamp', moduleId: 'assembly', name: 'Chạy stress test benchmark & dán tem bảo hành', desc: 'Kiểm thử độ ổn định nhiệt độ, hiệu năng và dán tem niêm phong trước khi giao' },
  { id: 'assembly_view_dashboard', moduleId: 'assembly', name: 'Xem tổng quan tiến độ lắp ráp & nghiệm thu', desc: 'Theo dõi số lệnh đang chờ, đang lắp ráp và đã hoàn tất mà không trực tiếp thao tác' },

  // 6. Phân Hệ Giao Hàng & Thu Tiền COD
  { id: 'delivery_execute_route', moduleId: 'delivery', name: 'Nhận tuyến giao, chụp ảnh POD & thu tiền mặt COD', desc: 'Tài xế nhận hàng, cập nhật tiến độ giao, tải ảnh bằng chứng giao hàng và thu tiền' },
  { id: 'delivery_pickup_rma', moduleId: 'delivery', name: 'Thu hồi linh kiện bảo hành RMA từ khách về kho', desc: 'Đến tận nơi thu hồi hàng lỗi từ khách hàng theo phiếu yêu cầu' },
  { id: 'delivery_view_dashboard', moduleId: 'delivery', name: 'Xem tổng quan tuyến giao & trạng thái COD', desc: 'Theo dõi tiến độ giao hàng toàn đội xe mà không trực tiếp thao tác từng đơn' },

  // 7. Phân Hệ Kế Toán & Tài Chính
  { id: 'accounting_pay_po', moduleId: 'accounting', name: 'Chi trả tiền hàng cho Nhà Cung Cấp theo đơn PO', desc: 'Đối soát hóa đơn và thực hiện lệnh chuyển khoản thanh toán cho NCC' },
  { id: 'accounting_settle_cod', moduleId: 'accounting', name: 'Đối soát & thu hồi tiền COD từ đội ngũ Shipper', desc: 'Thu tiền mặt và chốt sổ dòng tiền giao hàng hàng ngày' },
  { id: 'accounting_disburse_payroll', moduleId: 'accounting', name: 'Giải ngân chi trả bảng lương nhân sự', desc: 'Thực hiện chuyển khoản lương định kỳ sau khi CEO đã phê duyệt' },
  { id: 'accounting_manage_invoices', moduleId: 'accounting', name: 'Quản lý sổ quỹ thu chi & xuất hóa đơn VAT', desc: 'Ghi nhận mọi bút toán thu chi và phát hành hóa đơn tài chính' },

  // 8. Phân Hệ Chăm Sóc Khách Hàng (CSKH)
  { id: 'cskh_handle_tickets', moduleId: 'cskh', name: 'Tiếp nhận khiếu nại, tư vấn Live Chat & tạo phiếu RMA', desc: 'Hỗ trợ khách hàng trực tuyến, ghi nhận sự cố và lập hồ sơ đổi trả' },
  { id: 'cskh_approve_exchange', moduleId: 'cskh', name: 'Duyệt phương án đổi mới / bồi hoàn cho khách', desc: 'Xác nhận giải pháp hỗ trợ sau khi có kết quả thẩm định từ phòng QA/QC' },

  // 9. Phân Hệ Quản Trị Nhân Sự (HR)
  { id: 'hr_manage_employees', moduleId: 'hr', name: 'Quản lý hồ sơ nhân viên, chấm công & ngày phép', desc: 'Theo dõi hợp đồng lao động, dữ liệu vân tay chấm công và đơn xin nghỉ phép' },
  { id: 'hr_prepare_payroll', moduleId: 'hr', name: 'Tổng hợp công & lập Bảng lương hàng tháng', desc: 'Tính toán thưởng phạt, bảo hiểm và lập bảng lương hoàn chỉnh trình CEO' },
  { id: 'hr_approve_payroll_ceo', moduleId: 'hr', name: 'Phê duyệt Bảng lương toàn công ty (Ban Giám Đốc)', desc: 'CEO kiểm tra tổng quỹ lương và ký duyệt giải ngân' },

  // 10. Phân Hệ Báo Cáo Tổng Quan & Quản Trị
  { id: 'dashboard_view_kpi', moduleId: 'dashboard', name: 'Xem báo cáo tổng thể KPI, doanh thu & lợi nhuận P&L', desc: 'Theo dõi bức tranh tài chính, dòng tiền và hiệu quả kinh doanh toàn doanh nghiệp' },
  { id: 'system_admin_full', moduleId: 'system', name: 'Toàn quyền cấu hình hệ thống, tài khoản & sao lưu', desc: 'Quản lý phân quyền RBAC, kiểm soát bảo mật và sao lưu dữ liệu' }
];

// Ma trận quyền hạn nghiệp vụ mặc định chuẩn hóa theo đúng vai trò thực tế
export const DEFAULT_OPERATIONAL_MATRIX = {
  ADMIN: {
    // Admin có toàn bộ quyền
    sales_pos_checkout: true, sales_approve_discount: true, sales_cancel_order: true, sales_manage_promotions: true, sales_view_orders: true,
    warehouse_pack_scan: true, warehouse_dispatch_shipper: true, warehouse_stock_intake: true, warehouse_create_pr: true, warehouse_approve_pr: true, warehouse_manage_locations: true, warehouse_audit_adjust: true, warehouse_view_inventory: true,
    purchasing_create_rfq: true, purchasing_compare_quotes: true, purchasing_approve_po: true, purchasing_issue_po: true, purchasing_manage_suppliers: true, purchasing_view_orders: true,
    qc_inspect_inbound: true, qc_inspect_rma: true, qc_inspect_restock: true, qc_view_logs: true,
    assembly_build_pc: true, assembly_benchmark_stamp: true, assembly_view_dashboard: true,
    delivery_execute_route: true, delivery_pickup_rma: true, delivery_view_dashboard: true,
    accounting_pay_po: true, accounting_settle_cod: true, accounting_disburse_payroll: true, accounting_manage_invoices: true,
    cskh_handle_tickets: true, cskh_approve_exchange: true,
    hr_manage_employees: true, hr_prepare_payroll: true, hr_approve_payroll_ceo: true,
    dashboard_view_kpi: true, system_admin_full: true
  },
  CEO: {
    dashboard_view_kpi: true,
    sales_view_orders: true,
    sales_approve_discount: true,
    purchasing_approve_po: true,
    hr_approve_payroll_ceo: true,
    accounting_manage_invoices: true,
    warehouse_view_inventory: true,
    // CEO được cấp quyền ở mọi route these 4 module (App.jsx allowedRoles) và
    // luôn bypass authMiddleware backend — trước đây ma trận này thiếu nên
    // sidebar không hiện link dù CEO truy cập trực tiếp bằng URL vẫn vào được.
    qc_view_logs: true,
    cskh_approve_exchange: true,
    delivery_view_dashboard: true,
    assembly_view_dashboard: true
  },
  SALES_MANAGER: {
    sales_view_orders: true,
    sales_pos_checkout: true,
    sales_approve_discount: true,
    sales_cancel_order: true,
    sales_manage_promotions: true,
    cskh_handle_tickets: true,
    cskh_approve_exchange: true,
    warehouse_view_inventory: true,
    // order.routes.js PATCH /:id/status (dùng để cập nhật trạng thái giao
    // hàng) cấp quyền thật cho SALES_MANAGER — giữ quyền xem trang Giao Hàng.
    delivery_view_dashboard: true
  },
  SALES: {
    sales_pos_checkout: true,
    sales_view_orders: true,
    warehouse_view_inventory: true
    // cskh_handle_tickets: KHÔNG cấp — backend chat.routes.js (POST /cskh/reply,
    // GET /cskh/sessions) chỉ nhận SALES_MANAGER, không nhận SALES thường; cấp
    // ở đây trước đây khiến sidebar hiện link CSKH nhưng bấm vào là bị chặn.
  },
  WAREHOUSE_MANAGER: {
    warehouse_view_inventory: true,
    warehouse_dispatch_shipper: true,
    warehouse_approve_pr: true,
    warehouse_manage_locations: true,
    warehouse_audit_adjust: true,
    qc_view_logs: true,
    // purchase.routes.js cấp GET /suppliers, /products, /orders cho
    // WAREHOUSE_MANAGER thật — trước đây matrix thiếu nên sidebar không hiện
    // link Mua Hàng dù route/backend đều đã cho phép.
    purchasing_view_orders: true,
    delivery_view_dashboard: true
  },
  WAREHOUSE: {
    warehouse_view_inventory: true,
    warehouse_pack_scan: true,
    warehouse_stock_intake: true,
    warehouse_create_pr: true,
    // order.routes.js PATCH /returns/:id/qc-inspect cấp quyền thật cho
    // WAREHOUSE (không chỉ QC) — trước đây matrix thiếu nên sidebar không
    // hiện link Kiểm Định Chất Lượng dù route/backend đã cho phép.
    qc_inspect_restock: true,
    // order.routes.js PATCH /:id/status (dùng cho "Xác Nhận Xuất Kho" & bàn
    // giao shipper) cấp quyền thật cho WAREHOUSE — giữ quyền xem trang Giao Hàng.
    delivery_view_dashboard: true
  },
  PURCHASING: {
    purchasing_create_rfq: true,
    purchasing_compare_quotes: true,
    purchasing_issue_po: true,
    purchasing_manage_suppliers: true,
    warehouse_view_inventory: true,
    qc_view_logs: true
  },
  // QA và QUALITY_CONTROL được chuẩn hoá về khóa 'QC' qua normalizeRoleForRbac
  // trước khi tra ma trận này — không khai lặp lại 2 khối giống hệt nhau nữa
  // (nguồn gốc của lỗi QUALITY_CONTROL "mồ côi" đã sửa ở backend trước đó).
  QC: {
    qc_inspect_inbound: true,
    qc_inspect_rma: true,
    qc_inspect_restock: true,
    qc_view_logs: true,
    warehouse_view_inventory: true
  },
  ASSEMBLY: {
    assembly_build_pc: true,
    assembly_benchmark_stamp: true
    // warehouse_view_inventory: KHÔNG cấp — warehouse.routes.js không cấp
    // ASSEMBLY ở bất kỳ route nào; trước đây sidebar hiện link Kho cho nhân
    // viên lắp ráp nhưng bấm vào là bị chặn.
  },
  DELIVERY: {
    delivery_execute_route: true,
    delivery_pickup_rma: true
    // warehouse_view_inventory: KHÔNG cấp — warehouse.routes.js không cấp
    // DELIVERY ở bất kỳ route nào (receipts/inventory/stock-movements); trước
    // đây sidebar hiện link Kho cho Shipper nhưng bấm vào là bị chặn.
  },
  ACCOUNTANT: {
    accounting_pay_po: true,
    accounting_settle_cod: true,
    accounting_disburse_payroll: true,
    accounting_manage_invoices: true,
    sales_view_orders: true
    // dashboard_view_kpi: KHÔNG cấp — App.jsx '/admin/dashboard' chỉ cho
    // CEO/ADMIN, và Accounting.jsx (module 'accounting') đã có sẵn đúng các
    // chỉ số P&L/doanh thu/chi phí này ở tầng kế toán, không cần trang riêng.
  },
  CSKH: {
    cskh_handle_tickets: true,
    cskh_approve_exchange: true,
    sales_view_orders: true
    // qc_view_logs: KHÔNG cấp — không route QC nào (warehouse/purchase/order)
    // cấp quyền cho CSKH; trước đây sidebar hiện link QC nhưng bấm vào bị chặn.
  },
  HR: {
    hr_manage_employees: true,
    hr_prepare_payroll: true
    // dashboard_view_kpi: KHÔNG cấp — cùng lý do với ACCOUNTANT ở trên, và
    // không thuộc phạm vi nghiệp vụ nhân sự.
  }
};

export const getOperationalRbac = () => {
  try {
    const raw = localStorage.getItem('erp_operational_rbac_v3');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return { ...DEFAULT_OPERATIONAL_MATRIX, ...parsed };
      }
    }
  } catch (e) {}
  return DEFAULT_OPERATIONAL_MATRIX;
};

export const saveOperationalRbac = (newMatrix) => {
  try {
    localStorage.setItem('erp_operational_rbac_v3', JSON.stringify(newMatrix));
    window.dispatchEvent(new Event('erp-rbac-changed'));
  } catch (e) {}
};

// QC, QA và QUALITY_CONTROL là 3 giá trị role tương đương cho cùng 1 chức
// năng kiểm định chất lượng (khớp với QC_ROLES phía backend, constants/roles.js).
// Trước đây ma trận này khai 2 khối 'QC'/'QA' giống hệt nhau và 'QUALITY_CONTROL'
// không có khối nào — chuẩn hoá về 1 khóa 'QC' duy nhất để tránh lặp/bỏ sót.
export const QC_EQUIVALENT_ROLES = ['QC', 'QA', 'QUALITY_CONTROL'];
const normalizeRoleForRbac = (roleCode) => (QC_EQUIVALENT_ROLES.includes(roleCode) ? 'QC' : roleCode);

export const canDo = (userRole, operationId) => {
  if (!userRole) return false;
  const roleCode = normalizeRoleForRbac(String(userRole).toUpperCase());
  if (roleCode === 'ADMIN') return true;

  const matrix = getOperationalRbac();
  const rolePerms = matrix[roleCode];
  if (!rolePerms) return false;

  return Boolean(rolePerms[operationId]);
};

// Compatibility adapter for module-level check
export const hasPermission = (userRole, moduleName, actionType = 'read') => {
  if (!userRole) return false;
  const roleCode = normalizeRoleForRbac(String(userRole).toUpperCase());
  if (roleCode === 'ADMIN') return true;

  const matrix = getOperationalRbac();
  const rolePerms = matrix[roleCode] || {};

  // Find if any operation under this module is enabled
  const moduleOps = OPERATIONAL_PERMISSIONS.filter(op => op.moduleId === moduleName);
  if (moduleOps.length === 0) return true;

  if (actionType === 'read') {
    return moduleOps.some(op => Boolean(rolePerms[op.id]));
  }
  
  if (actionType === 'approve') {
    const approveOps = moduleOps.filter(op => op.id.includes('approve') || op.id.includes('dispatch') || op.id.includes('inspect'));
    if (approveOps.length > 0) return approveOps.some(op => Boolean(rolePerms[op.id]));
    return moduleOps.some(op => Boolean(rolePerms[op.id]));
  }

  return moduleOps.some(op => Boolean(rolePerms[op.id]));
};

export const getActiveRbacMatrix = () => getOperationalRbac();

// Single source of truth for "which roles can enter module X" — derived live
// from the same matrix that drives the sidebar (`hasPermission`), instead of
// a second hand-maintained role→module list. App.jsx's route guards call this
// directly so a route's access and its sidebar visibility can never drift
// apart again (previously: allowedRoles in App.jsx, DEFAULT_OPERATIONAL_MATRIX
// here, and ROLE_RELEVANT_MODULES below were 3 separate lists edited by hand).
export const getRolesForModule = (moduleId) => {
  const canonicalMatches = ERP_ROLES.map(r => r.code).filter(roleCode => hasPermission(roleCode, moduleId, 'read'));
  const expanded = new Set();
  canonicalMatches.forEach(roleCode => {
    // ERP_ROLES only lists the canonical 'QC' entry — expand it back into all
    // 3 real role values a user's session can actually carry, so a real
    // QUALITY_CONTROL/QA employee isn't silently excluded from the route.
    if (roleCode === 'QC') QC_EQUIVALENT_ROLES.forEach(r => expanded.add(r));
    else expanded.add(roleCode);
  });
  return Array.from(expanded);
};

// Replaces the old hand-maintained ROLE_RELEVANT_MODULES object (a 3rd list
// that drifted out of sync with the matrix above) — derives "modules relevant
// to this role" the same way `getRolesForModule` derives the reverse, so the
// two can never disagree.
export const getRoleRelevantModules = (roleCode) =>
  ERP_SYSTEM_MODULES.filter(m => hasPermission(roleCode, m.id, 'read')).map(m => m.id);
export const saveRbacMatrix = (m) => saveOperationalRbac(m);
