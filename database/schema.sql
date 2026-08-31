-- ============================================================================
--   KLTN -- CƠ SỞ DỮ LIỆU ERP BÁN LINH KIỆN MÁY TÍNH TÍCH HỢP AI
--   Hệ quản trị CSDL: PostgreSQL
--   Thiết kế: Đồng bộ hóa cấu trúc relational cho ERP và trường linh hoạt cho AI
-- ============================================================================

-- BẬT DỰ PHÒNG XÓA BẢNG NẾU ĐÃ TỒN TẠI (Để chạy lại script dễ dàng)
DROP TABLE IF EXISTS assembly_logs CASCADE;
DROP TABLE IF EXISTS bom_items CASCADE;
DROP TABLE IF EXISTS boms CASCADE;
DROP TABLE IF EXISTS work_orders CASCADE;
DROP TABLE IF EXISTS payrolls CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS attendances CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS goods_receipts CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS supplier_evaluations CASCADE;
DROP TABLE IF EXISTS supplier_contacts CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS warehouse_locations CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS order_payments CASCADE;
DROP TABLE IF EXISTS order_status_history CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customer_addresses CASCADE;
DROP TABLE IF EXISTS customer_segments CASCADE;
DROP TABLE IF EXISTS product_reviews CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- ============================================================================
--   1. NHÓM BẢNG SẢN PHẨM & BÁN HÀNG
-- ============================================================================

-- 1.1 Danh mục sản phẩm (Hỗ trợ phân cấp cha-con)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INT REFERENCES categories(id) ON DELETE SET NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    image_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1.2 Thương hiệu sản phẩm
CREATE TABLE brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    logo_url VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1.3 Sản phẩm chính (Sử dụng JSONB cho specs động để phục vụ AI)
CREATE TABLE products (
    product_id VARCHAR(50) PRIMARY KEY, -- Khớp với ID cào từ web (GearVN ID)
    gearvn_id VARCHAR(50),
    sku VARCHAR(100) UNIQUE,
    handle VARCHAR(150) UNIQUE NOT NULL,
    url VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    category_id INT REFERENCES categories(id) ON DELETE RESTRICT,
    brand_id INT REFERENCES brands(id) ON DELETE RESTRICT,
    product_type VARCHAR(100),
    description_text TEXT,
    price DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    original_price DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    discount_percent DECIMAL(5, 2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'VND',
    available BOOLEAN DEFAULT TRUE,
    stock_quantity INT DEFAULT 0,
    primary_image VARCHAR(255),
    image_count INT DEFAULT 0,
    warranty VARCHAR(100),
    specs JSONB NOT NULL DEFAULT '{}'::jsonb, -- dynamic specs cho lọc nâng cao & AI Content-based
    filters JSONB NOT NULL DEFAULT '{}'::jsonb, -- filter tags từ web
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, OUT_OF_STOCK
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1.4 Các biến thể sản phẩm (Màu sắc, Dung lượng, Tùy chọn...)
CREATE TABLE product_variants (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(50) REFERENCES products(product_id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb, -- ví dụ: {"color": "Red", "capacity": "16GB"}
    price_modifier DECIMAL(15, 2) DEFAULT 0.00, -- Cộng thêm vào giá gốc
    stock_quantity INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1.5 Bộ sưu tập hình ảnh sản phẩm
CREATE TABLE product_images (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(50) REFERENCES products(product_id) ON DELETE CASCADE,
    url VARCHAR(255) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0
);

-- 1.6 Khách hàng (Bao gồm B2C và B2B)
CREATE TABLE customers (
    customer_id VARCHAR(50) PRIMARY KEY, -- Ví dụ: CUST-0001
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Cho khách hàng đăng nhập hệ thống B2C
    name VARCHAR(150) NOT NULL,
    gender VARCHAR(10), -- MALE, FEMALE, OTHER
    phone VARCHAR(20) UNIQUE,
    address TEXT,
    city VARCHAR(100),
    loyalty_points INT DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'REGULAR', -- REGULAR, SILVER, GOLD, PLATINUM
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, LOCKED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1.7 Sổ địa chỉ giao hàng của khách hàng
CREATE TABLE customer_addresses (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE CASCADE,
    recipient_name VARCHAR(150) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    address_line TEXT NOT NULL,
    ward VARCHAR(100),
    district VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE
);

-- 1.8 Phân khúc khách hàng phục vụ AI tiếp thị
CREATE TABLE customer_segments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    criteria JSONB, -- mô tả thuật toán RFM hoặc K-means
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1.9 Đánh giá và nhận xét của khách hàng (Reviews)
CREATE TABLE product_reviews (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(50) REFERENCES products(product_id) ON DELETE CASCADE,
    customer_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE SET NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
--   2. NHÓM BẢNG ĐƠN HÀNG & GIAO DỊCH
-- ============================================================================

-- 2.1 Đơn mua hàng (Bán hàng)
CREATE TABLE orders (
    order_id VARCHAR(50) PRIMARY KEY, -- Ví dụ: ORD-260619-0001
    customer_id VARCHAR(50) REFERENCES customers(customer_id) ON DELETE RESTRICT,
    subtotal DECIMAL(15, 2) NOT NULL,
    discount DECIMAL(15, 2) DEFAULT 0.00,
    shipping_fee DECIMAL(15, 2) DEFAULT 0.00,
    total_amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL, -- COD, BANK_TRANSFER, MOMO, VNPAY, CREDIT_CARD
    payment_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PAID, REFUNDED, CANCELLED
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED
    notes TEXT,
    shipping_address TEXT NOT NULL,
    shipping_city VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

-- 2.2 Chi tiết đơn hàng
CREATE TABLE order_items (
    order_item_id VARCHAR(50) PRIMARY KEY, -- Ví dụ: ORI-000001
    order_id VARCHAR(50) REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id VARCHAR(50) REFERENCES products(product_id) ON DELETE RESTRICT,
    sku VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    price DECIMAL(15, 2) NOT NULL,
    original_price DECIMAL(15, 2) NOT NULL,
    total_price DECIMAL(15, 2) NOT NULL
);

-- 2.3 Nhật ký cập nhật trạng thái đơn hàng (Audit trail)
CREATE TABLE order_status_history (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) REFERENCES orders(order_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    note TEXT,
    changed_by VARCHAR(100), -- Tên nhân viên hoặc hệ thống
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.4 Lịch sử thanh toán đơn hàng
CREATE TABLE order_payments (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) REFERENCES orders(order_id) ON DELETE CASCADE,
    method VARCHAR(30) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    transaction_id VARCHAR(100), -- Mã giao dịch từ cổng thanh toán Momo, VNPay
    status VARCHAR(20) NOT NULL, -- SUCCESS, FAILED, PENDING
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
--   3. NHÓM BẢNG QUẢN LÝ KHO & MUA HÀNG (NCC)
-- ============================================================================

-- 3.1 Danh sách kho hàng
CREATE TABLE warehouses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.2 Vị trí cụ thể trong kho
CREATE TABLE warehouse_locations (
    id SERIAL PRIMARY KEY,
    warehouse_id INT REFERENCES warehouses(id) ON DELETE CASCADE,
    zone VARCHAR(10) NOT NULL,  -- Ví dụ: Khu A, Khu B
    shelf VARCHAR(10) NOT NULL, -- Kệ 1, Kệ 2
    bin VARCHAR(10) NOT NULL,   -- Ngăn 1, Ngăn 2
    capacity INT DEFAULT 100,    -- Sức chứa tối đa
    UNIQUE(warehouse_id, zone, shelf, bin)
);

-- 3.3 Quản lý tồn kho thực tế của sản phẩm
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(50) REFERENCES products(product_id) ON DELETE RESTRICT,
    warehouse_id INT REFERENCES warehouses(id) ON DELETE RESTRICT,
    location_id INT REFERENCES warehouse_locations(id) ON DELETE SET NULL,
    quantity_on_hand INT NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
    quantity_reserved INT NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0), -- Giữ hàng cho đơn hàng đang xử lý
    reorder_point INT DEFAULT 5, -- Mức tối thiểu cần cảnh báo nhập hàng
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, warehouse_id)
);

-- 3.4 Biến động kho hàng (Nhập, xuất, điều chuyển, kiểm kê)
CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(50) REFERENCES products(product_id) ON DELETE RESTRICT,
    from_warehouse_id INT REFERENCES warehouses(id) ON DELETE SET NULL,
    to_warehouse_id INT REFERENCES warehouses(id) ON DELETE SET NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    type VARCHAR(30) NOT NULL, -- PURCHASE_RECEIPT, SALES_DELIVERY, TRANSFER, ADJUSTMENT
    reference_id VARCHAR(50), -- Mã tham chiếu PO, SO hoặc Mã kiểm kho
    note TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.5 Nhà cung cấp linh kiện
CREATE TABLE suppliers (
    code VARCHAR(50) PRIMARY KEY, -- SUP-FPT, SUP-VIENSON...
    name VARCHAR(150) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    payment_terms VARCHAR(100), -- Ví dụ: NET 30, COD
    lead_time_days INT DEFAULT 7, -- Thời gian giao hàng trung bình (ngày)
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.6 Danh sách liên hệ tại Nhà cung cấp
CREATE TABLE supplier_contacts (
    id SERIAL PRIMARY KEY,
    supplier_code VARCHAR(50) REFERENCES suppliers(code) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100)
);

-- 3.7 Đánh giá hiệu suất nhà cung cấp (Supplier scorecard)
CREATE TABLE supplier_evaluations (
    id SERIAL PRIMARY KEY,
    supplier_code VARCHAR(50) REFERENCES suppliers(code) ON DELETE CASCADE,
    period VARCHAR(50) NOT NULL, -- Ví dụ: Q1/2026, Tháng 06/2026
    quality_score DECIMAL(3, 2), -- điểm từ 0.00 đến 5.00
    delivery_score DECIMAL(3, 2),
    price_score DECIMAL(3, 2),
    overall_score DECIMAL(3, 2),
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.8 Đơn mua hàng từ nhà cung cấp (Purchase Orders)
CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    po_number VARCHAR(50) UNIQUE NOT NULL, -- Ví dụ: PO-260619-0001
    supplier_code VARCHAR(50) REFERENCES suppliers(code) ON DELETE RESTRICT,
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, SENT, RECEIVED, COMPLETED, CANCELLED
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    expected_delivery_date DATE,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.9 Chi tiết đơn mua hàng từ NCC
CREATE TABLE purchase_order_items (
    id SERIAL PRIMARY KEY,
    po_id INT REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id VARCHAR(50) REFERENCES products(product_id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_cost DECIMAL(15, 2) NOT NULL,
    total_cost DECIMAL(15, 2) NOT NULL
);

-- 3.10 Phiếu nhận hàng kho (Goods Receipt Note)
CREATE TABLE goods_receipts (
    id SERIAL PRIMARY KEY,
    po_id INT REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    received_warehouse_id INT REFERENCES warehouses(id) ON DELETE RESTRICT,
    received_by VARCHAR(100) NOT NULL,
    received_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'COMPLETED', -- COMPLETED, PARTIAL
    note TEXT
);

-- ============================================================================
--   4. NHÓM BẢNG SẢN XUẤT & LẮP RÁP PC
-- ============================================================================

-- 4.1 Định mức nguyên vật liệu (Bill of Materials - BOM)
CREATE TABLE boms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    version VARCHAR(20) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4.2 Chi tiết định mức cấu hình PC (BOM Items)
CREATE TABLE bom_items (
    id SERIAL PRIMARY KEY,
    bom_id INT REFERENCES boms(id) ON DELETE CASCADE,
    product_id VARCHAR(50) REFERENCES products(product_id) ON DELETE RESTRICT,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    UNIQUE(bom_id, product_id)
);

-- 4.3 Nhóm bảng Nhân viên (hrm) - Cần định nghĩa trước để liên kết Work Order
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    employee_code VARCHAR(50) UNIQUE NOT NULL, -- Ví dụ: EMP-0001
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL, -- Sales, Warehouse, Purchasing, Assembly, HRM, Tech
    role VARCHAR(50) NOT NULL, -- STAFF, MANAGER, CEO, ADMIN
    base_salary DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4.4 Yêu cầu lắp ráp máy tính (Work Orders)
CREATE TABLE work_orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) REFERENCES orders(order_id) ON DELETE RESTRICT, -- Lắp ráp cho đơn hàng bán ra
    employee_id INT REFERENCES employees(id) ON DELETE SET NULL, -- Kỹ thuật viên phụ trách
    bom_id INT REFERENCES boms(id) ON DELETE RESTRICT, -- Lắp theo cấu hình định mức nào
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, ASSEMBLING, QC_TESTING, COMPLETED, FAILED
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4.5 Nhật ký lắp ráp từng bước (Assembly steps log)
CREATE TABLE assembly_logs (
    id SERIAL PRIMARY KEY,
    work_order_id INT REFERENCES work_orders(id) ON DELETE CASCADE,
    step_name VARCHAR(150) NOT NULL, -- Ví dụ: Lắp CPU, Kiểm thử benchmark
    status VARCHAR(20) NOT NULL, -- SUCCESS, FAILED
    note TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
--   5. NHÓM BẢNG QUẢN LÝ NHÂN SỰ (HRM)
-- ============================================================================

-- 5.1 Chấm công hàng ngày
CREATE TABLE attendances (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    overtime_hours DECIMAL(4, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'PRESENT', -- PRESENT, ABSENT, LATE, LEAVE
    UNIQUE(employee_id, date)
);

-- 5.2 Nghỉ phép
CREATE TABLE leave_requests (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL, -- ANNUAL_LEAVE, SICK_LEAVE, UNPAID_LEAVE
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    reason TEXT,
    approved_by INT REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5.3 Bảng lương chi tiết
CREATE TABLE payrolls (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
    period VARCHAR(50) NOT NULL, -- Ví dụ: Tháng 06/2026
    base_salary DECIMAL(15, 2) NOT NULL,
    allowances DECIMAL(15, 2) DEFAULT 0.00, -- Phụ cấp
    bonuses DECIMAL(15, 2) DEFAULT 0.00, -- Thưởng
    deductions DECIMAL(15, 2) DEFAULT 0.00, -- Khấu trừ (thuế, phạt)
    net_salary DECIMAL(15, 2) NOT NULL, -- Lương thực nhận
    status VARCHAR(20) DEFAULT 'UNPAID', -- UNPAID, PAID
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
--   6. CHỈ MỤC TỐI ƯU TRUY VẤN (INDEXES)
-- ============================================================================

-- Tăng tốc tìm kiếm sản phẩm theo tên (ILIKE) và bộ lọc
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_brand_cat ON products(brand_id, category_id);
-- Chỉ mục GIN để tối ưu hóa truy vấn trường specs JSONB
CREATE INDEX idx_products_specs_gin ON products USING gin (specs);

-- Tìm kiếm đơn hàng nhanh theo khách hàng và ngày
CREATE INDEX idx_orders_customer_date ON orders(customer_id, created_at);
CREATE INDEX idx_orders_status ON orders(status);

-- Tối ưu hóa truy vấn kho hàng
CREATE INDEX idx_inventory_product_warehouse ON inventory(product_id, warehouse_id);

-- Tối ưu hóa chấm công
CREATE INDEX idx_attendances_employee_date ON attendances(employee_id, date);
