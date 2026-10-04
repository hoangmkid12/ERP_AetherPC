/**
 * WAREHOUSE TRAINER - HUẤN LUYỆN CHUYÊN BIỆT CHO THỦ KHO & KỸ THUẬT LẮP RÁP PC
 * Bao quát 100% nghiệp vụ Kho & Kỹ thuật AetherPC:
 * 1. Đơn hàng chờ xuất kho, đóng gói, bàn giao cho shipper.
 * 2. Cảnh báo linh kiện hết hàng (= 0), sắp hết tồn (< 5 cái), vị trí kho.
 * 3. Kiểm đếm hàng nhập từ Nhà cung cấp (PO/GRN).
 * 4. Kỹ thuật lắp ráp PC, thẩm định nguồn công suất thực (PSU Wattage).
 * 5. Tiêu chuẩn đóng gói chống bể vỡ kính cường lực và benchmark test nhiệt độ.
 */

const WAREHOUSE_SYSTEM_PROMPT = `BẠN LÀ TRỢ LÝ ĐỒNG HÀNH CHUYÊN BIỆT CHO THỦ KHO & KỸ THUẬT VIÊN LẮP RÁP PC AETHERPC:
- PHONG CÁCH: Chính xác, kỹ thuật cao, chú trọng an toàn linh kiện và tiêu chuẩn vận hành.
- THÔNG TIN ƯU TIÊN:
  1. Mã linh kiện (SKU / Part Number), số lượng tồn thực tế.
  2. Trạng thái đơn hàng: Chờ đóng gói (READY_TO_SHIP), Chờ lấy hàng.
  3. Tiêu chuẩn phần cứng: Công suất nguồn khuyến nghị, độ tương thích socket, nhiệt độ test benchmark.
- NGUYÊN TẮC: Luôn nhắc nhở an toàn tĩnh điện (ESD) và bọc túi khí chống bể vỡ kính case PC.`;

const WAREHOUSE_FEW_SHOTS = [
  {
    question: "Có bao nhiêu đơn hàng đang chờ đóng gói xuất kho?",
    sql: "SELECT order_id, total_amount, shipping_address, status, created_at FROM orders WHERE status = 'READY_TO_SHIP' ORDER BY created_at ASC LIMIT 20;",
    description: "Tra cứu danh sách đơn hàng đã xác nhận cần đóng gói xuất kho"
  },
  {
    question: "Linh kiện nào trong kho đang bị hết hàng hoàn toàn?",
    sql: "SELECT p.product_id, p.name, p.sku, c.name AS danh_muc, b.name AS thuong_hieu FROM products p JOIN categories c ON c.id = p.category_id JOIN brands b ON b.id = p.brand_id WHERE p.stock_quantity = 0 AND p.status = 'ACTIVE' ORDER BY c.name ASC LIMIT 25;",
    description: "Cảnh báo các sản phẩm có tồn kho bằng 0 để lên kế hoạch nhập hàng"
  },
  {
    question: "Những sản phẩm nào sắp hết hàng cần cảnh báo nhập kho?",
    sql: "SELECT p.product_id, p.name, p.sku, p.stock_quantity, p.price FROM products p WHERE p.stock_quantity > 0 AND p.stock_quantity <= 5 AND p.status = 'ACTIVE' ORDER BY p.stock_quantity ASC LIMIT 20;",
    description: "Cảnh báo linh kiện tồn kho thấp dưới hoặc bằng 5 sản phẩm"
  },
  {
    question: "Kiểm tra tồn kho linh kiện card màn hình VGA hiện tại",
    sql: "SELECT p.product_id, p.name, p.sku, p.stock_quantity, p.price FROM products p JOIN categories c ON c.id = p.category_id WHERE (c.slug ILIKE '%vga%' OR c.slug ILIKE '%card%' OR c.name ILIKE '%card%') AND p.status = 'ACTIVE' ORDER BY p.stock_quantity DESC LIMIT 20;",
    description: "Tra cứu số lượng tồn kho của nhóm linh kiện Card đồ họa VGA"
  },
  {
    question: "Có phiếu yêu cầu nhập hàng PO nào đang chờ kho nhập không?",
    sql: "SELECT po_number, supplier_code, total_amount, status, created_at FROM purchase_orders WHERE status IN ('APPROVED', 'PENDING', 'ORDERED') ORDER BY created_at ASC LIMIT 15;",
    description: "Danh sách các đơn mua hàng từ nhà cung cấp đang chờ nhập kho"
  }
];

const WAREHOUSE_SEMANTIC_RULES = (lower) => {
  // 1. Hỏi đơn chờ đóng gói / chờ xuất kho / ready to ship
  if (/(chờ đóng gói|chờ xuất|chờ lấy hàng|đóng gói|ready to ship|xuất kho)/.test(lower) && /đơn/.test(lower)) {
    return `SELECT order_id, total_amount, shipping_address, status, created_at FROM orders WHERE status = 'READY_TO_SHIP' ORDER BY created_at ASC LIMIT 20;`;
  }

  // 2. Hỏi sản phẩm hết hàng
  if (/(hết hàng|tồn.*bằng 0|tồn.*=.*0|cháy hàng|hết tồn)/.test(lower)) {
    return `SELECT product_id, name, sku, stock_quantity, price FROM products WHERE stock_quantity = 0 AND status = 'ACTIVE' LIMIT 20;`;
  }

  // 3. Hỏi sản phẩm sắp hết hàng / cảnh báo tồn
  if (/(sắp hết hàng|tồn kho thấp|cảnh báo tồn|sắp hết|dưới 5)/.test(lower)) {
    return `SELECT product_id, name, sku, stock_quantity, price FROM products WHERE stock_quantity > 0 AND stock_quantity <= 5 AND status = 'ACTIVE' ORDER BY stock_quantity ASC LIMIT 20;`;
  }

  // 4. Phiếu PO nhập hàng
  if (/(nhập hàng|phiếu nhập|purchase order|po)/.test(lower)) {
    return `SELECT po_number, supplier_code, total_amount, status, created_at FROM purchase_orders WHERE status IN ('APPROVED', 'PENDING', 'ORDERED') ORDER BY created_at ASC LIMIT 15;`;
  }

  return null;
};

const WAREHOUSE_KNOWLEDGE_SOP = {
  packing_pc: {
    title: "Quy Chuẩn Đóng Gói Thùng Xốp & Bọc Kính Case PC",
    content: `📦 **TIÊU CHUẨN ĐÓNG GÓI THÙNG MÁY PC GAMING:**
1. **Bên trong thùng máy:** Bắt buộc chèn túi khí bọt biển Instapak ôm sát Card đồ họa (VGA) và Tản nhiệt tháp để chống cong gãy chân PCIe khi vận chuyển rung lắc.
2. **Mặt kính cường lực:** Dán màng PE bảo vệ chống trầy, chèn xốp định hình dày tối thiểu 20mm ở cả 4 góc thùng máy.
3. **Phụ kiện kèm theo:** Dây nguồn, ốc vít thừa, hộp main/card cho vào túi zip phụ đặt trong khoang xốp trên nóc thùng.
4. **Bên ngoài:** Dán tem niêm phong "HÀNG DỄ VỠ - XIN NHẸ TAY" và tem mũi tên chỉ chiều đứng bắt buộc.`
  },
  qc_benchmark: {
    title: "Tiêu Chuẩn Test Benchmark & Nhiệt Độ Linh Kiện Trước Khi Xuất",
    content: `⚙️ **QUY TRÌNH KIỂM ĐỊNH KỸ THUẬT (QC BENCHMARK):**
1. **CPU Stress Test:** Chạy Cinebench R23 tối thiểu 10 phút. Nhiệt độ an toàn: Dưới 85°C (Tản khí) hoặc dưới 78°C (Tản nước AIO).
2. **GPU Stress Test:** Chạy Furmark độ phân giải 2K trong 15 phút. Nhiệt độ GPU không vượt quá 75°C, Hotspot không quá 90°C, quạt quay êm không cạ dây.
3. **RAM Stability:** Bật XMP/EXPO trong BIOS, kiểm tra nhận đủ Bus và dung lượng trong Windows Task Manager.
4. Kỹ thuật viên ký tên vào Phiếu nghiệm thu xuất xưởng trước khi dán tem bảo hành AetherPC.`
  }
};

module.exports = {
  WAREHOUSE_SYSTEM_PROMPT,
  WAREHOUSE_FEW_SHOTS,
  WAREHOUSE_SEMANTIC_RULES,
  WAREHOUSE_KNOWLEDGE_SOP
};
