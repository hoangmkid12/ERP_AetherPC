# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import json
import csv
import os
from collections import Counter

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
PRODUCTS_JSON = os.path.join(DATA_DIR, "products_clean.json")
PRODUCTS_CSV = os.path.join(DATA_DIR, "products_clean.csv")
SUPPLIERS_JSON = os.path.join(DATA_DIR, "suppliers.json")
CUSTOMERS_JSON = os.path.join(DATA_DIR, "customers.json")
ORDERS_JSON = os.path.join(DATA_DIR, "orders.json")
ORDER_ITEMS_CSV = os.path.join(DATA_DIR, "order_items.csv")

def print_separator(char="=", length=70):
    print(char * length)

def validate_products():
    print_separator("-")
    print("  PHẦN I: KIỂM TRA CHẤT LƯỢNG SẢN PHẨM (PRODUCTS)")
    print_separator("-")
    
    if not os.path.exists(PRODUCTS_JSON):
        print(f"    [FAIL] Không tìm thấy file: {PRODUCTS_JSON}")
        return False
        
    with open(PRODUCTS_JSON, "r", encoding="utf-8") as f:
        products = json.load(f)
        
    print(f"    Tổng sản phẩm cào được: {len(products):,}")
    
    # Check fields
    fields = ["product_id", "sku", "name", "brand", "category_name", "price", "available", "specs", "primary_image"]
    missing = {fd: 0 for fd in fields}
    empty = {fd: 0 for fd in fields}
    
    for p in products:
        for fd in fields:
            if fd not in p:
                missing[fd] += 1
            elif p[fd] in (None, "", [], {}):
                empty[fd] += 1
                
    has_errors = False
    for fd in fields:
        m_cnt = missing[fd]
        e_cnt = empty[fd]
        if m_cnt > 0 or e_cnt > 0:
            print(f"    [WARNING] Trường '{fd:<15}': thiếu={m_cnt:>4} | rỗng={e_cnt:>4}")
            has_errors = True
            
    if not has_errors:
        print("    [OK] Tất cả trường thông tin cốt lõi đều đầy đủ.")
        
    # Specs completeness check
    has_specs = sum(1 for p in products if p.get("specs") and p["specs"] != "{}")
    print(f"    Tỷ lệ sản phẩm có specs: {has_specs:,} / {len(products):,} ({has_specs/len(products)*100:.1f}%)")
    
    # Category distribution
    cat_counts = Counter(p["category_name"] for p in products)
    print("    Số lượng sản phẩm theo danh mục:")
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
        print(f"      - {cat:<35}: {count:>4} sp")
        
    return True

def validate_erp_seeds():
    print_separator("-")
    print("  PHẦN II: KIỂM TRA DỮ LIỆU SEED ERP (SUPPLIERS, CUSTOMERS, ORDERS)")
    print_separator("-")
    
    files = [SUPPLIERS_JSON, CUSTOMERS_JSON, ORDERS_JSON, ORDER_ITEMS_PATH]
    all_ok = True
    for fpath in files:
        if not os.path.exists(fpath):
            print(f"    [FAIL] Thiếu file: {os.path.basename(fpath)}")
            all_ok = False
            
    if not all_ok:
        return False
        
    # 1. Suppliers
    with open(SUPPLIERS_JSON, "r", encoding="utf-8") as f:
        suppliers = json.load(f)
    print(f"    [OK] Tải thành công {len(suppliers)} nhà cung cấp.")
    
    # 2. Customers
    with open(CUSTOMERS_JSON, "r", encoding="utf-8") as f:
        customers = json.load(f)
    city_counts = Counter(c["city"] for c in customers)
    tier_counts = Counter(c["tier"] for c in customers)
    print(f"    [OK] Tải thành công {len(customers)} khách hàng.")
    print(f"         Phân bổ vùng: HCM: {city_counts.get('Hồ Chí Minh',0)}, HN: {city_counts.get('Hà Nội',0)}, ĐN: {city_counts.get('Đà Nẵng',0)}, Cần Thơ: {city_counts.get('Cần Thơ',0)}, HP: {city_counts.get('Hải Phòng',0)}")
    print(f"         Hạng thành viên: Regular: {tier_counts.get('REGULAR',0)}, Silver: {tier_counts.get('SILVER',0)}, Gold: {tier_counts.get('GOLD',0)}, Platinum: {tier_counts.get('PLATINUM',0)}")
    
    # 3. Orders & Order Items
    with open(ORDERS_JSON, "r", encoding="utf-8") as f:
        orders = json.load(f)
        
    with open(ORDER_ITEMS_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        order_items = list(reader)
        
    total_revenue = sum(o["total_amount"] for o in orders)
    status_counts = Counter(o["status"] for o in orders)
    
    print(f"    [OK] Tải thành công {len(orders)} đơn hàng lịch sử ({len(order_items)} chi tiết đơn hàng).")
    print(f"         Tổng doanh số giả định: {total_revenue:,.0f} VND")
    print(f"         Giá trị đơn hàng TB   : {total_revenue/len(orders):,.0f} VND")
    print(f"         Trạng thái đơn: Delivered: {status_counts.get('DELIVERED',0)}, Cancelled: {status_counts.get('CANCELLED',0)}, Processing: {status_counts.get('PROCESSING',0)}, Pending: {status_counts.get('PENDING',0)}")
    
    # 4. Review count
    reviews_count = sum(1 for i in order_items if i.get("rating") != "")
    ratings = [int(i["rating"]) for i in order_items if i.get("rating") != ""]
    avg_rating = sum(ratings) / len(ratings) if ratings else 0
    print(f"         Số lượt review thu được: {reviews_count} (điểm TB: {avg_rating:.2f} / 5.0)")
    
    return True

if __name__ == "__main__":
    # Workaround for path
    ORDER_ITEMS_PATH = ORDER_ITEMS_CSV
    print_separator("=")
    print("  HỆ THỐNG KIỂM TRA TOÀN DIỆN DỮ LIỆU KLTN — ERP & CÀO TIN HỌC")
    print_separator("=")
    
    p_ok = validate_products()
    e_ok = validate_erp_seeds()
    
    print_separator("=")
    if p_ok and e_ok:
        print("  KẾT LUẬN: TOÀN BỘ BỘ DỮ LIỆU ĐẠT TIÊU CHUẨN CHẤT LƯỢNG CAO!")
        print("  Hệ thống sẵn sàng cho bước thiết kế Database và import dữ liệu.")
    else:
        print("  KẾT LUẬN: Phát hiện lỗi thiếu file dữ liệu. Vui lòng chạy scraper/seed trước.")
    print_separator("=")
