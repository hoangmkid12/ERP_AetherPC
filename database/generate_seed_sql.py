# -*- coding: utf-8 -*-
import json
import os
import re
from datetime import datetime, timedelta

# Files
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "scraper", "data")
PRODUCTS_JSON = os.path.join(DATA_DIR, "products_clean.json")
SUPPLIERS_JSON = os.path.join(DATA_DIR, "suppliers.json")
CUSTOMERS_JSON = os.path.join(DATA_DIR, "customers.json")
ORDERS_JSON = os.path.join(DATA_DIR, "orders.json")

OUTPUT_SQL = os.path.join(os.path.dirname(__file__), "seed.sql")

def escape_str(val):
    if val is None:
        return "NULL"
    # Convert to string and escape single quotes for SQL DML
    val_str = str(val).replace("'", "''")
    return f"'{val_str}'"

def escape_num(val):
    if val is None:
        return "NULL"
    return str(val)

def escape_bool(val):
    if val is None:
        return "NULL"
    return "TRUE" if val else "FALSE"

def escape_json(val):
    if val is None:
        return "'{}'::jsonb"
    if isinstance(val, dict):
        val_str = json.dumps(val, ensure_ascii=False).replace("'", "''")
    else:
        try:
            val_str = json.dumps(json.loads(val), ensure_ascii=False).replace("'", "''")
        except:
            val_str = "{}"
    return f"'{val_str}'::jsonb"

def main():
    print("=" * 65)
    print("  POSTGRESQL SEED GENERATOR — KLTN ERP")
    print("=" * 65)

    if not os.path.exists(PRODUCTS_JSON):
        print(f"Error: {PRODUCTS_JSON} not found. Run scraper first.")
        return

    # Load all inputs
    with open(PRODUCTS_JSON, "r", encoding="utf-8") as f:
        products = json.load(f)
    with open(SUPPLIERS_JSON, "r", encoding="utf-8") as f:
        suppliers = json.load(f)
    with open(CUSTOMERS_JSON, "r", encoding="utf-8") as f:
        customers = json.load(f)
    with open(ORDERS_JSON, "r", encoding="utf-8") as f:
        orders = json.load(f)

    sql_lines = []
    sql_lines.append("-- ============================================================================")
    sql_lines.append("--   KLTN -- DỮ LIỆU SEED ERP BÁN LINH KIỆN MÁY TÍNH TÍCH HỢP AI")
    sql_lines.append(f"--   Sinh lúc: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    sql_lines.append("-- ============================================================================")
    sql_lines.append("\nBEGIN;\n")

    # ── 1. SEED CATEGORIES ─────────────────────────────────────────
    print("Processing Categories...")
    sql_lines.append("-- ── 1. DANH MỤC SẢN PHẨM (categories) ──")
    unique_cats = {}
    cat_id_counter = 1
    for p in products:
        c_name = p.get("category_name", "Khác")
        c_slug = p.get("category_slug", "khac")
        c_handle = p.get("category_handle", "khac")
        if c_slug not in unique_cats:
            unique_cats[c_slug] = {
                "id": cat_id_counter,
                "name": c_name,
                "slug": c_slug,
                "handle": c_handle
            }
            cat_id_counter += 1

    for slug, c in unique_cats.items():
        sql_lines.append(
            f"INSERT INTO categories (id, name, slug) "
            f"VALUES ({c['id']}, {escape_str(c['name'])}, {escape_str(c['slug'])});"
        )
    sql_lines.append("SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));\n")

    # ── 2. SEED BRANDS ─────────────────────────────────────────────
    print("Processing Brands...")
    sql_lines.append("-- ── 2. THƯƠNG HIỆU (brands) ──")
    unique_brands = sorted(list(set(p["brand"] for p in products if p.get("brand"))))
    brand_name_to_id = {}
    for idx, b_name in enumerate(unique_brands, 1):
        brand_name_to_id[b_name] = idx
        sql_lines.append(f"INSERT INTO brands (id, name) VALUES ({idx}, {escape_str(b_name)});")
    sql_lines.append("SELECT setval('brands_id_seq', (SELECT MAX(id) FROM brands));\n")

    # ── 3. SEED PRODUCTS & IMAGES ──────────────────────────────────
    print("Processing Products...")
    sql_lines.append("-- ── 3. SẢN PHẨM (products) ──")
    
    product_images_lines = []
    product_images_lines.append("-- ── 3.1 ẢNH SẢN PHẨM (product_images) ──")
    
    for p in products:
        b_id = brand_name_to_id.get(p["brand"], "NULL")
        c_id = unique_cats.get(p["category_slug"], {}).get("id", "NULL")
        
        # Product insert
        sql_lines.append(
            f"INSERT INTO products (product_id, gearvn_id, sku, handle, url, name, category_id, brand_id, product_type, description_text, price, original_price, discount_percent, currency, available, stock_quantity, primary_image, image_count, warranty, specs, filters, status, published_at) "
            f"VALUES ({escape_str(p['product_id'])}, {escape_str(p.get('gearvn_id'))}, {escape_str(p.get('sku'))}, {escape_str(p['handle'])}, {escape_str(p['url'])}, {escape_str(p['name'])}, {c_id}, {b_id}, {escape_str(p.get('product_type'))}, {escape_str(p.get('description_text'))}, {escape_num(p['price'])}, {escape_num(p['original_price'])}, {escape_num(p['discount_percent'])}, {escape_str(p.get('currency'))}, {escape_bool(p['available'])}, {escape_num(p['stock_quantity'])}, {escape_str(p['primary_image'])}, {escape_num(p.get('image_count'))}, {escape_str(p.get('warranty'))}, {escape_json(p.get('specs'))}, {escape_json(p.get('filters'))}, 'ACTIVE', {escape_str(p.get('published_at'))});"
        )
        
        # Extract images
        img_urls = p.get("image_urls", "").split("|")
        for sort_idx, img_url in enumerate(img_urls):
            if img_url.strip():
                is_prim = "TRUE" if sort_idx == 0 else "FALSE"
                product_images_lines.append(
                    f"INSERT INTO product_images (product_id, url, is_primary, sort_order) "
                    f"VALUES ({escape_str(p['product_id'])}, {escape_str(img_url.strip())}, {is_prim}, {sort_idx});"
                )
                
    sql_lines.append("\n" + "\n".join(product_images_lines) + "\n")

    # ── 4. SEED SUPPLIERS & CONTACTS ───────────────────────────────
    print("Processing Suppliers...")
    sql_lines.append("-- ── 4. NHÀ CUNG CẤP (suppliers) ──")
    for s in suppliers:
        sql_lines.append(
            f"INSERT INTO suppliers (code, name, email, phone, address, payment_terms, lead_time_days, status, created_at) "
            f"VALUES ({escape_str(s['code'])}, {escape_str(s['name'])}, {escape_str(s['email'])}, {escape_str(s['phone'])}, {escape_str(s['address'])}, {escape_str(s.get('payment_terms', 'NET 30'))}, {escape_num(s.get('lead_time_days', 7))}, 'ACTIVE', {escape_str(s['created_at'])});"
        )
        
        # Add 1 contact per supplier
        contact_name = f"Liên Hệ - {s['name'].replace('Công ty ', '').replace('Cổ phần ', '')}"
        sql_lines.append(
            f"INSERT INTO supplier_contacts (supplier_code, name, role, phone, email) "
            f"VALUES ({escape_str(s['code'])}, {escape_str(contact_name)}, 'Đại Diện Kinh Doanh', {escape_str(s['phone'])}, {escape_str(s['email'])});"
        )
    sql_lines.append("\n")

    # ── 5. SEED CUSTOMERS & ADDRESSES ──────────────────────────────
    print("Processing Customers...")
    sql_lines.append("-- ── 5. KHÁCH HÀNG (customers) ──")
    for c in customers:
        # standard mock bcrypt hash for password "123456"
        pw_hash = "$2a$10$IyfWpe/v6d3OiOESKMx74eJNfiLnHx0T2oPH.isjyKrGgqXVHFRSG"
        sql_lines.append(
            f"INSERT INTO customers (customer_id, email, password_hash, name, gender, phone, address, city, loyalty_points, tier, status, created_at) "
            f"VALUES ({escape_str(c['customer_id'])}, {escape_str(c['email'])}, '{pw_hash}', {escape_str(c['name'])}, {escape_str(c['gender'])}, {escape_str(c['phone'])}, {escape_str(c['address'])}, {escape_str(c['city'])}, 0, {escape_str(c['tier'])}, 'ACTIVE', {escape_str(c['created_at'])});"
        )
        
        # Add default address
        sql_lines.append(
            f"INSERT INTO customer_addresses (customer_id, recipient_name, recipient_phone, address_line, city, is_default) "
            f"VALUES ({escape_str(c['customer_id'])}, {escape_str(c['name'])}, {escape_str(c['phone'])}, {escape_str(c['address'])}, {escape_str(c['city'])}, TRUE);"
        )
    sql_lines.append("\n")

    # ── 6. SEED EMPLOYEES (HRM) ────────────────────────────────────
    print("Processing Employees...")
    sql_lines.append("-- ── 6. NHÂN VIÊN (employees) ──")
    employees_data = [
        {"id": 1, "code": "EMP-0001", "name": "Nguyễn Văn Trưởng", "email": "truong.nv@kltn-erp.vn", "dept": "Tech", "role": "MANAGER", "salary": 25000000},
        {"id": 2, "code": "EMP-0002", "name": "Trần Thị Huệ", "email": "hue.tt@kltn-erp.vn", "dept": "Sales", "role": "STAFF", "salary": 12000000},
        {"id": 3, "code": "EMP-0003", "name": "Phạm Văn Minh", "email": "minh.pv@kltn-erp.vn", "dept": "Warehouse", "role": "STAFF", "salary": 10000000},
        {"id": 4, "code": "EMP-0004", "name": "Lê Văn Hùng", "email": "hung.lv@kltn-erp.vn", "dept": "Assembly", "role": "STAFF", "salary": 11000000},
        {"id": 5, "code": "EMP-0005", "name": "Hoàng Văn Tuấn", "email": "tuan.hv@kltn-erp.vn", "dept": "HRM", "role": "MANAGER", "salary": 18000000}
    ]
    for emp in employees_data:
        pw_hash = "$2a$10$IyfWpe/v6d3OiOESKMx74eJNfiLnHx0T2oPH.isjyKrGgqXVHFRSG" # password "123456"
        sql_lines.append(
            f"INSERT INTO employees (id, employee_code, full_name, email, password_hash, department, role, base_salary, status) "
            f"VALUES ({emp['id']}, {escape_str(emp['code'])}, {escape_str(emp['name'])}, {escape_str(emp['email'])}, '{pw_hash}', '{emp['dept']}', '{emp['role']}', {emp['salary']}, 'ACTIVE');"
        )
    sql_lines.append("SELECT setval('employees_id_seq', (SELECT MAX(id) FROM employees));\n")

    # ── 7. SEED ORDERS, ITEMS, PAYMENTS & REVIEWS ──────────────────
    print("Processing Orders & Reviews...")
    sql_lines.append("-- ── 7. ĐƠN HÀNG & GIAO DỊCH (orders, order_items, order_payments, product_reviews) ──")
    
    order_items_lines = []
    order_payments_lines = []
    reviews_lines = []
    order_history_lines = []
    
    bom_counter = 1
    work_order_counter = 1
    boms_lines = []
    boms_lines.append("-- ── 8. ĐỊNH MỨC & LẮP RÁP PC (boms, bom_items, work_orders, assembly_logs) ──")
    
    for o in orders:
        sql_lines.append(
            f"INSERT INTO orders (order_id, customer_id, subtotal, discount, shipping_fee, total_amount, payment_method, payment_status, status, notes, shipping_address, shipping_city, created_at, confirmed_at, shipped_at, delivered_at, cancelled_at) "
            f"VALUES ({escape_str(o['order_id'])}, {escape_str(o['customer_id'])}, {escape_num(o['subtotal'])}, {escape_num(o['discount'])}, {escape_num(o['shipping_fee'])}, {escape_num(o['total_amount'])}, {escape_str(o['payment_method'])}, {escape_str(o['payment_status'])}, {escape_str(o['status'])}, {escape_str(o.get('notes'))}, {escape_str(o['address'])}, {escape_str(o['city'])}, {escape_str(o['created_at'])}, {escape_str(o.get('confirmed_at'))}, {escape_str(o.get('shipped_at'))}, {escape_str(o.get('delivered_at'))}, {escape_str(o.get('cancelled_at'))});"
        )
        
        # Order status history
        order_history_lines.append(
            f"INSERT INTO order_status_history (order_id, status, note, changed_by, timestamp) "
            f"VALUES ({escape_str(o['order_id'])}, 'PENDING', 'Khởi tạo đơn hàng từ giỏ hàng', 'Khách hàng', {escape_str(o['created_at'])});"
        )
        if o.get("confirmed_at"):
            order_history_lines.append(
                f"INSERT INTO order_status_history (order_id, status, note, changed_by, timestamp) "
                f"VALUES ({escape_str(o['order_id'])}, 'CONFIRMED', 'Đã xác nhận đơn hàng', 'Nhân viên bán hàng', {escape_str(o['confirmed_at'])});"
            )
        if o.get("shipped_at"):
            order_history_lines.append(
                f"INSERT INTO order_status_history (order_id, status, note, changed_by, timestamp) "
                f"VALUES ({escape_str(o['order_id'])}, 'SHIPPED', 'Đã xuất kho bàn giao giao vận', 'Thủ kho', {escape_str(o['shipped_at'])});"
            )
        if o.get("delivered_at"):
            order_history_lines.append(
                f"INSERT INTO order_status_history (order_id, status, note, changed_by, timestamp) "
                f"VALUES ({escape_str(o['order_id'])}, 'DELIVERED', 'Giao hàng thành công', 'Shipper', {escape_str(o['delivered_at'])});"
            )
        if o.get("cancelled_at"):
            order_history_lines.append(
                f"INSERT INTO order_status_history (order_id, status, note, changed_by, timestamp) "
                f"VALUES ({escape_str(o['order_id'])}, 'CANCELLED', 'Khách yêu cầu hủy đơn', 'Hệ thống', {escape_str(o['cancelled_at'])});"
            )
            
        # Order items
        is_pc_build = len(o["items"]) >= 5 and any(i["category_name"] == "CPU - Bộ vi xử lý" for i in o["items"])
        
        for item in o["items"]:
            order_items_lines.append(
                f"INSERT INTO order_items (order_item_id, order_id, product_id, sku, name, quantity, price, original_price, total_price) "
                f"VALUES ({escape_str(item['order_item_id'])}, {escape_str(o['order_id'])}, {escape_str(item['product_id'])}, {escape_str(item.get('sku'))}, {escape_str(item['name'])}, {escape_num(item['quantity'])}, {escape_num(item['price'])}, {escape_num(item['original_price'])}, {escape_num(item['total_price'])});"
            )
            
            # Reviews
            if item.get("rating") is not None and item.get("rating") != "":
                reviews_lines.append(
                    f"INSERT INTO product_reviews (product_id, customer_id, rating, comment, created_at) "
                    f"VALUES ({escape_str(item['product_id'])}, {escape_str(o['customer_id'])}, {escape_num(item['rating'])}, {escape_str(item.get('review'))}, {escape_str(o.get('delivered_at', o['created_at']))});"
                )
                
        # Payment
        pay_status = "SUCCESS" if o["payment_status"] == "PAID" else ("FAILED" if o["payment_status"] == "CANCELLED" else "PENDING")
        tx_id = f"TX-{o['order_id'].split('-')[-1]}-{random_string(6)}" if o["payment_method"] != "COD" else "NULL"
        order_payments_lines.append(
            f"INSERT INTO order_payments (order_id, method, amount, transaction_id, status, created_at) "
            f"VALUES ({escape_str(o['order_id'])}, {escape_str(o['payment_method'])}, {escape_num(o['total_amount'])}, {escape_str(tx_id) if tx_id != 'NULL' else 'NULL'}, '{pay_status}', {escape_str(o['created_at'])});"
        )
        
        # ── 8. SEED BOMS & WORK ORDERS (PC BUILD ASSEMBLY) ───────────
        if is_pc_build:
            # Create a BOM for this PC Build
            cpu_name = next((i["name"] for i in o["items"] if i["category_name"] == "CPU - Bộ vi xử lý"), "Linh Kiện")
            bom_name = f"Cấu hình PC lắp ráp theo đơn {o['order_id']} - {cpu_name[:40]}"
            boms_lines.append(
                f"INSERT INTO boms (id, name, description, version, is_active) "
                f"VALUES ({bom_counter}, {escape_str(bom_name)}, 'Định mức linh kiện lắp ráp ráp PC tùy chọn của khách hàng', '1.0', TRUE);"
            )
            
            # Add BOM Items
            for item in o["items"]:
                boms_lines.append(
                    f"INSERT INTO bom_items (bom_id, product_id, quantity) "
                    f"VALUES ({bom_counter}, {escape_str(item['product_id'])}, {escape_num(item['quantity'])});"
                )
                
            # Create Work Order
            wo_status = "COMPLETED" if o["status"] == "DELIVERED" else ("PENDING" if o["status"] == "PENDING" else "ASSEMBLING")
            started = o.get("confirmed_at") or o["created_at"]
            completed = o.get("shipped_at") or o.get("delivered_at")
            
            boms_lines.append(
                f"INSERT INTO work_orders (id, order_id, employee_id, bom_id, status, started_at, completed_at, created_at) "
                f"VALUES ({work_order_counter}, {escape_str(o['order_id'])}, 4, {bom_counter}, '{wo_status}', {escape_str(started)}, {escape_str(completed) if completed else 'NULL'}, {escape_str(o['created_at'])});"
            )
            
            # Add assembly logs
            boms_lines.append(
                f"INSERT INTO assembly_logs (work_order_id, step_name, status, note, timestamp) "
                f"VALUES ({work_order_counter}, 'Nhận yêu cầu lắp ráp', 'SUCCESS', 'Đã tiếp nhận linh kiện từ kho hàng', {escape_str(started)});"
            )
            if wo_status in ["ASSEMBLING", "COMPLETED"]:
                boms_lines.append(
                    f"INSERT INTO assembly_logs (work_order_id, step_name, status, note, timestamp) "
                    f"VALUES ({work_order_counter}, 'Lắp ráp cơ khí', 'SUCCESS', 'Đã lắp CPU, RAM, Mainboard và nguồn vào vỏ case', {escape_str(started)});"
                )
            if wo_status == "COMPLETED":
                boms_lines.append(
                    f"INSERT INTO assembly_logs (work_order_id, step_name, status, note, timestamp) "
                    f"VALUES ({work_order_counter}, 'Kiểm thử & Benchmarking', 'SUCCESS', 'Nhiệt độ ổn định, cài hệ điều hành thành công', {escape_str(completed)});"
                )
                
            bom_counter += 1
            work_order_counter += 1

    sql_lines.append("\n" + "\n".join(order_items_lines) + "\n")
    sql_lines.append("\n" + "\n".join(order_payments_lines) + "\n")
    sql_lines.append("\n" + "\n".join(order_history_lines) + "\n")
    sql_lines.append("\n" + "\n".join(reviews_lines) + "\n")
    
    # Write boms & assembly
    sql_lines.append("\n" + "\n".join(boms_lines))
    sql_lines.append("SELECT setval('boms_id_seq', (SELECT MAX(id) FROM boms));")
    sql_lines.append("SELECT setval('work_orders_id_seq', (SELECT MAX(id) FROM work_orders));")
    sql_lines.append("SELECT setval('assembly_logs_id_seq', (SELECT MAX(id) FROM assembly_logs));\n")

    # ── 9. SEED WAREHOUSE & INVENTORY STOCK ───────────────────────
    print("Processing Warehouses & Stock...")
    sql_lines.append("-- ── 9. KHO HÀNG & TỒN KHO (warehouses, warehouse_locations, inventory) ──")
    sql_lines.append("INSERT INTO warehouses (id, name, address, is_active) VALUES (1, 'Kho Tổng TP.Hồ Chí Minh', '175 Nguyễn Thị Minh Khai, Quận 1, TP. HCM', TRUE);")
    sql_lines.append("INSERT INTO warehouses (id, name, address, is_active) VALUES (2, 'Kho Chi Nhánh Hà Nội', '33 Phố Thái Hà, Quận Đống Đa, Hà Nội', TRUE);")
    sql_lines.append("SELECT setval('warehouses_id_seq', (SELECT MAX(id) FROM warehouses));\n")
    
    # Warehouse locations
    sql_lines.append("INSERT INTO warehouse_locations (id, warehouse_id, zone, shelf, bin, capacity) VALUES (1, 1, 'ZONE-A', 'SHELF-01', 'BIN-01', 200);")
    sql_lines.append("INSERT INTO warehouse_locations (id, warehouse_id, zone, shelf, bin, capacity) VALUES (2, 1, 'ZONE-A', 'SHELF-01', 'BIN-02', 200);")
    sql_lines.append("INSERT INTO warehouse_locations (id, warehouse_id, zone, shelf, bin, capacity) VALUES (3, 2, 'ZONE-B', 'SHELF-01', 'BIN-01', 200);")
    sql_lines.append("SELECT setval('warehouse_locations_id_seq', (SELECT MAX(id) FROM warehouse_locations));\n")
    
    # Inventory for all products
    sql_lines.append("-- Khởi tạo tồn kho ngẫu nhiên cho toàn bộ 1586 sản phẩm cào")
    inventory_id = 1
    for p in products:
        # Randomize stock quantity (70-200) if raw stock is 0 (since cào web có thể 0, nhưng ERP cần có hàng để bán demo)
        stock_total = p.get("stock_quantity", 0)
        if stock_total <= 0:
            stock_total = random_range(20, 100)
            
        stock_wh1 = int(stock_total * 0.7)
        stock_wh2 = stock_total - stock_wh1
        
        # Warehouse 1
        sql_lines.append(
            f"INSERT INTO inventory (id, product_id, warehouse_id, location_id, quantity_on_hand, quantity_reserved, reorder_point) "
            f"VALUES ({inventory_id}, {escape_str(p['product_id'])}, 1, 1, {stock_wh1}, 0, 5);"
        )
        inventory_id += 1
        
        # Warehouse 2
        sql_lines.append(
            f"INSERT INTO inventory (id, product_id, warehouse_id, location_id, quantity_on_hand, quantity_reserved, reorder_point) "
            f"VALUES ({inventory_id}, {escape_str(p['product_id'])}, 2, 3, {stock_wh2}, 0, 5);"
        )
        inventory_id += 1
        
    sql_lines.append("SELECT setval('inventory_id_seq', (SELECT MAX(id) FROM inventory));\n")

    # ── 10. SEED ATTENDANCES & PAYROLLS ────────────────────────────
    print("Processing HRM Attendances & Payrolls...")
    sql_lines.append("-- ── 10. HRM CHẤM CÔNG VÀ LƯƠNG (attendances, payrolls) ──")
    
    # Attendances: last 30 days
    today = datetime(2026, 6, 19)
    for day_offset in range(30):
        date_str = (today - timedelta(days=day_offset)).strftime("%Y-%m-%d")
        # skip Sundays
        date_obj = today - timedelta(days=day_offset)
        if date_obj.weekday() == 6:
            continue
        for emp in employees_data:
            check_in = "08:00" if random_prob(0.9) else "08:15"
            check_out = "17:30"
            sql_lines.append(
                f"INSERT INTO attendances (employee_id, date, check_in, check_out, overtime_hours, status) "
                f"VALUES ({emp['id']}, '{date_str}', '{check_in}', '{check_out}', 0.00, 'PRESENT');"
            )
            
    # Payrolls: last 3 months (March, April, May 2026)
    periods = ["Tháng 03/2026", "Tháng 04/2026", "Tháng 05/2026"]
    for prd in periods:
        for emp in employees_data:
            allowance = int(emp["salary"] * 0.05)
            bonus = int(emp["salary"] * 0.1) if random_prob(0.3) else 0
            deduction = int(emp["salary"] * 0.02)
            net = emp["salary"] + allowance + bonus - deduction
            
            sql_lines.append(
                f"INSERT INTO payrolls (employee_id, period, base_salary, allowances, bonuses, deductions, net_salary, status, paid_at) "
                f"VALUES ({emp['id']}, '{prd}', {emp['salary']}, {allowance}, {bonus}, {deduction}, {net}, 'PAID', '{prd.replace('Tháng ', '2026-')}-05T10:00:00Z'::timestamptz);"
            )
            
    sql_lines.append("\nCOMMIT;\n")

    # Save to disk
    with open(OUTPUT_SQL, "w", encoding="utf-8") as f:
        f.write("\n".join(sql_lines))
    print(f"Successfully generated seed SQL: {OUTPUT_SQL} ({len(sql_lines)} lines)")

# Quick helpers to simulate random without numpy/faker dependencies
def random_string(length=6):
    import string
    chars = string.ascii_uppercase + string.digits
    import time
    t = int(time.time() * 1000)
    # Lấy các ký tự ngẫu nhiên giả lập qua số dư thời gian
    res = []
    for i in range(length):
        t = (t * 1103515245 + 12345) & 0x7fffffff
        res.append(chars[t % len(chars)])
    return "".join(res)

def random_range(start, end):
    import time
    t = int(time.time() * 10000)
    t = (t * 1103515245 + 12345) & 0x7fffffff
    return start + (t % (end - start + 1))

def random_prob(prob):
    # Trả về True với xác suất prob
    return random_range(1, 100) <= int(prob * 100)

if __name__ == "__main__":
    main()
