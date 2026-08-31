# -*- coding: utf-8 -*-
import json
import csv
import os
import random
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
PRODUCTS_JSON_PATH = os.path.join(DATA_DIR, "products_clean.json")

# Outputs
SUPPLIERS_JSON = os.path.join(DATA_DIR, "suppliers.json")
SUPPLIERS_CSV = os.path.join(DATA_DIR, "suppliers.csv")
CUSTOMERS_JSON = os.path.join(DATA_DIR, "customers.json")
CUSTOMERS_CSV = os.path.join(DATA_DIR, "customers.csv")
ORDERS_JSON = os.path.join(DATA_DIR, "orders.json")
ORDERS_CSV = os.path.join(DATA_DIR, "orders.csv")
ORDER_ITEMS_CSV = os.path.join(DATA_DIR, "order_items.csv") # Flattened for relational database mapping

random.seed(42)

# Date constraints (last 12 months relative to June 2026)
CURRENT_DATE = datetime(2026, 6, 19, 13, 0, 0)
START_DATE = CURRENT_DATE - timedelta(days=365)

# --- 1. SAMPLE VIETNAMESE NAMES & ADDRESSES ---
FAMILY_NAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"]
MIDDLE_NAMES_MALE = ["Văn", "Hữu", "Đức", "Quốc", "Đình", "Minh", "Hoàng", "Anh", "Quang", "Duy", "Ngọc", "Thành", "Lâm"]
MIDDLE_NAMES_FEMALE = ["Thị", "Ngọc", "Quỳnh", "Phương", "Khánh", "Mai", "Diệu", "Linh", "Thu", "Vy", "Thảo", "Hồng", "Trúc"]
GIVEN_NAMES_MALE = ["Hùng", "Dũng", "Tuấn", "Nam", "Minh", "Hải", "Sơn", "Phong", "Huy", "Việt", "Trung", "Hoàng", "Anh", "Khoa", "Bách", "Kiệt", "Khánh", "Duy", "Tùng", "Long"]
GIVEN_NAMES_FEMALE = ["Trang", "Hoa", "Lan", "Mai", "Vy", "Linh", "Giang", "Hương", "Thảo", "Ngọc", "Hà", "Vân", "Phương", "Trúc", "Yến", "Chi", "Nhi", "Hạnh", "Trinh", "Anh"]

DOMAINS = ["gmail.com", "yahoo.com", "outlook.com.vn", "fpt.edu.vn", "vnu.edu.vn", "hust.edu.vn"]

PROVINCES = [
    {
        "name": "Hồ Chí Minh",
        "districts": ["Quận 1", "Quận 3", "Quận 10", "Quận Bình Thạnh", "Quận Gò Vấp", "Quận Tân Bình", "Thành phố Thủ Đức", "Quận Phú Nhuận"],
        "streets": ["Nguyễn Thị Minh Khai", "Lê Lợi", "3 Tháng 2", "Điện Biên Phủ", "Phan Đăng Lưu", "Quang Trung", "Nguyễn Kiệm", "Võ Văn Tần"]
    },
    {
        "name": "Hà Nội",
        "districts": ["Quận Cầu Giấy", "Quận Thanh Xuân", "Quận Đống Đa", "Quận Hai Bà Trưng", "Quận Ba Đình", "Quận Hoàn Kiếm", "Quận Nam Từ Liêm"],
        "streets": ["Nguyễn Trãi", "Xuân Thủy", "Chùa Bộc", "Bà Triệu", "Kim Mã", "Tràng Tiền", "Tố Hữu", "Trần Duy Hưng"]
    },
    {
        "name": "Đà Nẵng",
        "districts": ["Quận Hải Châu", "Quận Thanh Khê", "Quận Sơn Trà", "Quận Ngũ Hành Sơn"],
        "streets": ["Lê Duẩn", "Nguyễn Văn Linh", "Trần Hưng Đạo", "Võ Nguyên Giáp", "Hùng Vương"]
    },
    {
        "name": "Cần Thơ",
        "districts": ["Quận Ninh Kiều", "Quận Cái Răng", "Quận Bình Thủy"],
        "streets": ["Đại lộ Hòa Bình", "Mậu Thân", "Nguyễn Văn Cừ", "Trần Văn Khéo"]
    },
    {
        "name": "Hải Phòng",
        "districts": ["Quận Hồng Bàng", "Quận Ngô Quyền", "Quận Lê Chân"],
        "streets": ["Lạch Tray", "Trần Hưng Đạo", "Lê Hồng Phong", "Tô Hiệu"]
    }
]

# --- 2. REVIEW TEMPLATES ---
REVIEWS = {
    5: [
        "Sản phẩm cực kỳ chất lượng, đóng gói cẩn thận, giao hàng nhanh.",
        "Rất đáng tiền, chạy mượt mà, chính hãng 100%.",
        "Thiết kế đẹp mắt, hiệu năng vượt trội so với tầm giá. Rất hài lòng!",
        "Lắp đặt dễ dàng, chạy êm ái và mát mẻ. Shop hỗ trợ nhiệt tình.",
        "Hàng chuẩn GearVN, nguyên seal mới cứng, bảo hành đầy đủ. Vote 5 sao!"
    ],
    4: [
        "Sản phẩm dùng tốt, đúng mô tả, tuy nhiên giao hàng hơi trễ 1 ngày.",
        "Chất lượng ổn áp, chạy ngon lành, đóng gói kỹ càng.",
        "Thiết kế đẹp, chạy mát, dịch vụ chăm sóc khách hàng khá tốt.",
        "Hiệu năng tốt trong tầm giá, dùng mượt mà không lỗi lầm gì.",
        "Sản phẩm tốt, nhân viên tư vấn nhiệt tình, sẽ tiếp tục ủng hộ."
    ],
    3: [
        "Dùng tạm ổn, nhưng vỏ hộp hơi móp méo khi vận chuyển.",
        "Sản phẩm bình thường, không quá nổi bật, dịch vụ giao hàng ở mức trung bình.",
        "Hiệu năng đủ dùng cho tác vụ cơ bản, nhiệt độ hơi ấm khi tải nặng.",
        "Chất lượng sản phẩm ok nhưng tổng đài hỗ trợ kỹ thuật phản hồi hơi chậm."
    ],
    2: [
        "Sản phẩm có dấu hiệu trầy xước nhẹ, giao hàng chậm, đóng gói sơ sài.",
        "Hiệu năng không đúng như quảng cáo, hay bị sụt nguồn đột ngột.",
        "Giao sai phiên bản màu sắc, đang chờ shop đổi trả."
    ],
    1: [
        "Sản phẩm bị lỗi hỏng ngay khi bóc hộp, không lên nguồn. Dịch vụ tệ.",
        "Hàng cũ đóng lại seal, chạy lỗi liên tục, bảo hành rất phiền phức. Không nên mua.",
        "Giao hàng quá chậm (mất 7 ngày), hàng móp méo hư hại nghiêm trọng."
    ]
}

def generate_vietnamese_name():
    family = random.choice(FAMILY_NAMES)
    is_male = random.random() > 0.5
    if is_male:
        mid = random.choice(MIDDLE_NAMES_MALE)
        given = random.choice(GIVEN_NAMES_MALE)
    else:
        mid = random.choice(MIDDLE_NAMES_FEMALE)
        given = random.choice(GIVEN_NAMES_FEMALE)
    return f"{family} {mid} {given}", is_male

def generate_vietnamese_address():
    prov = random.choice(PROVINCES)
    dist = random.choice(prov["districts"])
    street = random.choice(prov["streets"])
    num = random.randint(5, 550)
    return f"{num} Đường {street}, {dist}, TP. {prov['name']}", prov["name"]

def generate_phone():
    prefixes = ["090", "091", "098", "093", "086", "097", "038", "077", "079", "083", "085"]
    prefix = random.choice(prefixes)
    suffix = "".join(str(random.randint(0, 9)) for _ in range(7))
    return f"{prefix}{suffix}"

# --- 3. GENERATE SUPPLIERS ---
def create_suppliers(brands):
    supplier_list = [
        {"name": "Công ty TNHH Synnex FPT", "code": "SUP-FPT", "email": "contact@fpt.com.vn", "phone": "02473007300", "address": "Tòa nhà FPT, Phố Duy Tân, Cầu Giấy, Hà Nội"},
        {"name": "Công ty Cổ phần Máy tính Viễn Sơn", "code": "SUP-VIENSON", "email": "info@vienson.com.vn", "phone": "02838326085", "address": "175 Nguyễn Thị Minh Khai, Quận 1, TP. Hồ Chí Minh"},
        {"name": "Công ty TNHH Tin học Mai Hoàng", "code": "SUP-MAIHOANG", "email": "sales@maihoang.com.vn", "phone": "02435377109", "address": "241 Phố Vọng, Hai Bà Trưng, Hà Nội"},
        {"name": "Công ty Thương mại Quốc tế Thủy Linh", "code": "SUP-THUYLINH", "email": "info@thuylinh.vn", "phone": "02435665588", "address": "33 Thái Hà, Đống Đa, Hà Nội"},
        {"name": "Công ty TNHH Kỹ thuật Tin học Kha Thiên", "code": "SUP-KTC", "email": "ktc@ktc.com.vn", "phone": "02838404567", "address": "384/1 Vạn Kiếp, Bình Thạnh, TP. Hồ Chí Minh"},
        {"name": "Công ty Cổ phần Đầu tư Công nghệ Anh Ngọc", "code": "SUP-ANHNGOC", "email": "contact@anhngoc.vn", "phone": "02439763189", "address": "12 Cát Linh, Đống Đa, Hà Nội"},
        {"name": "Intel Vietnam Authorized Distributor", "code": "SUP-INTEL-VN", "email": "disti.vietnam@intel.com", "phone": "02838252000", "address": "Tòa nhà Saigon Centre, 65 Lê Lợi, Quận 1, TP. Hồ Chí Minh"},
        {"name": "AMD Southeast Asia Pte Ltd (VN Representative)", "code": "SUP-AMD-VN", "email": "vietnam.sales@amd.com", "phone": "02839101212", "address": "Tòa nhà Lim Tower, 9-11 Tôn Đức Thắng, Quận 1, TP. Hồ Chí Minh"},
        {"name": "ASUS Vietnam Co., Ltd", "code": "SUP-ASUS-VN", "email": "support_vn@asus.com", "phone": "18006588", "address": "Tòa nhà Viettel Complex, 285 Cách Mạng Tháng Tám, Quận 10, TP. Hồ Chí Minh"},
        {"name": "MSI Vietnam Representative Office", "code": "SUP-MSI-VN", "email": "msivn@msi.com", "phone": "02839257888", "address": "Tòa nhà Royal Tower, 235 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh"},
        {"name": "Samsung Vina Electronics Co., Ltd", "code": "SUP-SAMSUNG-VN", "email": "partner.support@samsung.com", "phone": "1800588889", "address": "Tòa nhà Bitexco Financial Tower, 2 Hải Triều, Quận 1, TP. Hồ Chí Minh"},
        {"name": "LG Electronics Vietnam", "code": "SUP-LG-VN", "email": "lg.vietnam@lge.com", "phone": "18001503", "address": "Tòa nhà Keangnam Landmark 72, Phạm Hùng, Nam Từ Liêm, Hà Nội"},
        {"name": "Công ty TNHH Gigabyte Việt Nam", "code": "SUP-GIGABYTE-VN", "email": "support@gigabyte.vn", "phone": "02838228585", "address": "Tòa nhà Bitexco Office, 19-25 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh"},
        {"name": "Công ty TNHH Corsair Vietnam Office", "code": "SUP-CORSAIR-VN", "email": "seasia@corsair.com", "phone": "02862885999", "address": "Tòa nhà Deutsches Haus, 33 Lê Duẩn, Quận 1, TP. Hồ Chí Minh"},
        {"name": "Công ty TNHH Kingston Technology VN", "code": "SUP-KINGSTON-VN", "email": "sales_vietnam@kingston.com.vn", "phone": "02838234567", "address": "Tòa nhà mPlaza Saigon, 39 Lê Duẩn, Quận 1, TP. Hồ Chí Minh"}
    ]
    
    # Assign brands to suppliers
    brand_mapping = {
        "SUP-INTEL-VN": ["Intel"],
        "SUP-AMD-VN": ["AMD"],
        "SUP-ASUS-VN": ["ASUS", "Phoenix", "ROG", "TUF"],
        "SUP-MSI-VN": ["MSI", "Spatium", "Ventus", "Gaming X"],
        "SUP-GIGABYTE-VN": ["GIGABYTE", "Aorus", "Windforce"],
        "SUP-SAMSUNG-VN": ["Samsung"],
        "SUP-LG-VN": ["LG"],
        "SUP-CORSAIR-VN": ["Corsair"],
        "SUP-KINGSTON-VN": ["Kingston", "Kingston Fury"],
        "SUP-FPT": ["Corsair", "Kingston", "Seagate", "Cooler Master", "Deepcool", "Jonsbo", "Western Digital", "WD", "AOC", "Gigabyte", "Asus", "Crucial"],
        "SUP-VIENSON": ["GIGABYTE", "MSI", "Corsair", "ASUS", "Jonsbo", "Cooler Master", "Lian Li", "Thermalright"],
        "SUP-MAIHOANG": ["MSI", "Kingston", "Corsair", "G.Skill", "Rapoo", "Dahua", "Dareu"],
        "SUP-THUYLINH": ["GIGABYTE", "Intel", "Samsung", "Kingston", "Antec", "Dell", "Crucial"],
        "SUP-KTC": ["Corsair", "Western Digital", "WD", "HP", "Lexar"],
        "SUP-ANHNGOC": ["Rapoo", "Kingston", "ASRock", "Hikvision"]
    }
    
    # Fill actual brands
    for s in supplier_list:
        code = s["code"]
        mapped = brand_mapping.get(code, [])
        # Find which brands in catalog belong to this supplier
        supplied_brands = []
        for b in brands:
            if any(m.lower() in b.lower() for m in mapped):
                supplied_brands.append(b)
        
        # If supplier has no brands assigned via map, assign 3 random brands
        if not supplied_brands:
            supplied_brands = random.sample(brands, min(3, len(brands)))
            
        s["supplied_brands"] = supplied_brands
        s["created_at"] = (START_DATE - timedelta(days=random.randint(100, 300))).isoformat()
        s["status"] = "ACTIVE"
        
    return supplier_list

# --- 4. GENERATE CUSTOMERS ---
def create_customers(count=500):
    customers = []
    used_emails = set()
    used_phones = set()
    
    for i in range(1, count + 1):
        name, is_male = generate_vietnamese_name()
        phone = generate_phone()
        while phone in used_phones:
            phone = generate_phone()
        used_phones.add(phone)
        
        # Normalize name to build email
        import unicodedata
        name_no_accents = ''.join(c for c in unicodedata.normalize('NFD', name) if unicodedata.category(c) != 'Mn')
        name_parts = name_no_accents.lower().split()
        if len(name_parts) >= 2:
            email_base = f"{name_parts[-1]}.{name_parts[0]}"
        else:
            email_base = name_parts[0]
            
        # Add random digits if duplicates
        email = f"{email_base}@{random.choice(DOMAINS)}"
        idx = 1
        while email in used_emails:
            email = f"{email_base}{random.randint(10, 99)}@{random.choice(DOMAINS)}"
        used_emails.add(email)
        
        address, city = generate_vietnamese_address()
        tier = random.choices(["REGULAR", "SILVER", "GOLD", "PLATINUM"], weights=[70, 20, 8, 2])[0]
        
        created_at = START_DATE - timedelta(days=random.randint(10, 300))
        
        customers.append({
            "customer_id": f"CUST-{i:04d}",
            "name": name,
            "gender": "MALE" if is_male else "FEMALE",
            "email": email,
            "phone": phone,
            "address": address,
            "city": city,
            "tier": tier,
            "status": "ACTIVE",
            "created_at": created_at.isoformat()
        })
        
    return customers

# --- 5. GENERATE ORDERS & ORDER ITEMS ---
def create_orders(products, customers, order_count=3000):
    # Group products by category_slug for logic bundle selection
    cats = {}
    for p in products:
        slug = p["category_slug"]
        if slug not in cats:
            cats[slug] = []
        cats[slug].append(p)
        
    # Helper to check socket compatibility
    def parse_socket(p):
        try:
            specs = json.loads(p.get("specs", "{}"))
            return specs.get("Socket", "").strip().upper()
        except:
            return ""

    def parse_ram_type(p):
        try:
            specs = json.loads(p.get("specs", "{}"))
            # In Motherboard specs: "Loại RAM hỗ trợ"
            # In RAM specs: "Loại RAM"
            return specs.get("Loại RAM hỗ trợ", specs.get("Loại RAM", "")).strip().upper()
        except:
            return ""

    orders = []
    order_items = []
    
    order_id_counter = 1
    item_id_counter = 1

    # Date generator with non-uniform seasonal weights
    def get_weighted_random_date():
        # Distribute dates across last 12 months with peaks
        # Summer / Back-to-school (Aug-Sep): Weight 2.0
        # Holiday / Black Friday (Nov-Dec): Weight 2.5
        # Tet Holiday (Jan-Feb): Weight 2.2
        # Normal months (Mar-Jul, Oct): Weight 1.0
        
        total_days = 365
        while True:
            days_ago = random.randint(0, total_days)
            date = CURRENT_DATE - timedelta(days=days_ago)
            month = date.month
            
            weight = 1.0
            if month in [8, 9]:
                weight = 2.0
            elif month in [11, 12]:
                weight = 2.5
            elif month in [1, 2]:
                weight = 2.2
                
            if random.random() < (weight / 2.5):
                # Add random hour, minute, second
                hour = random.choices(list(range(24)), weights=[1,0.5,0.2,0.1,0.1,0.2,0.5,1.5,3,4,4.5,5,4.5,4,4.5,5,5.5,5,4.5,4,5,5.5,4.5,2])[0]
                minute = random.randint(0, 59)
                second = random.randint(0, 59)
                return date.replace(hour=hour, minute=minute, second=second)

    print("Generating orders...")
    for _ in range(order_count):
        cust = random.choice(customers)
        date_created = get_weighted_random_date()
        
        # Decide buy intent
        # 10% Full PC build
        # 25% CPU + Mainboard (compatible) (+ optional RAM)
        # 15% Gaming peripherals bundle (Keyboard + Mouse + Headset/Monitor)
        # 50% Single item purchase
        intent = random.choices(["BUILD", "CPU_MAIN", "PERIPHERAL", "SINGLE"], weights=[10, 25, 15, 50])[0]
        
        selected_products = []
        
        if intent == "BUILD":
            # Select compatible CPU + Mainboard
            cpu = random.choice(cats.get("cpu", products))
            cpu_socket = parse_socket(cpu)
            
            # Find compatible mainboard
            compatible_mbs = []
            if cpu_socket and cats.get("mainboard"):
                compatible_mbs = [mb for mb in cats["mainboard"] if parse_socket(mb) == cpu_socket]
            
            if compatible_mbs:
                mb = random.choice(compatible_mbs)
            else:
                mb = random.choice(cats.get("mainboard", products))
                
            selected_products.append((cpu, 1))
            selected_products.append((mb, 1))
            
            # Add RAM matching RAM Type of Motherboard if possible
            mb_ram_type = parse_ram_type(mb)
            ram_candidates = cats.get("ram", [])
            if mb_ram_type and ram_candidates:
                matching_rams = [r for r in ram_candidates if parse_ram_type(r) == mb_ram_type]
                if matching_rams:
                    selected_products.append((random.choice(matching_rams), random.choice([1, 2])))
                else:
                    selected_products.append((random.choice(ram_candidates), random.choice([1, 2])))
            elif ram_candidates:
                selected_products.append((random.choice(ram_candidates), random.choice([1, 2])))
                
            # Add GPU
            if cats.get("gpu") and random.random() > 0.1: # 90% have GPU
                selected_products.append((random.choice(cats["gpu"]), 1))
                
            # Add PSU
            if cats.get("psu"):
                selected_products.append((random.choice(cats["psu"]), 1))
                
            # Add Case
            if cats.get("case"):
                selected_products.append((random.choice(cats["case"]), 1))
                
            # Add SSD
            if cats.get("ssd"):
                selected_products.append((random.choice(cats["ssd"]), 1))
                
            # Add Cooler
            if cats.get("cooler") and random.random() > 0.4:
                selected_products.append((random.choice(cats["cooler"]), 1))
                
        elif intent == "CPU_MAIN":
            cpu = random.choice(cats.get("cpu", products))
            cpu_socket = parse_socket(cpu)
            
            compatible_mbs = []
            if cpu_socket and cats.get("mainboard"):
                compatible_mbs = [mb for mb in cats["mainboard"] if parse_socket(mb) == cpu_socket]
                
            if compatible_mbs:
                mb = random.choice(compatible_mbs)
            else:
                mb = random.choice(cats.get("mainboard", products))
                
            selected_products.append((cpu, 1))
            selected_products.append((mb, 1))
            
            # 50% add RAM
            if cats.get("ram") and random.random() > 0.5:
                selected_products.append((random.choice(cats["ram"]), random.choice([1, 2])))
                
        elif intent == "PERIPHERAL":
            # Pick a monitor, mouse, keyboard
            items_to_add = random.randint(2, 3)
            choices = []
            if cats.get("monitor"): choices.append("monitor")
            if cats.get("mouse"): choices.append("mouse")
            if cats.get("keyboard"): choices.append("keyboard")
            
            random.shuffle(choices)
            for c in choices[:items_to_add]:
                selected_products.append((random.choice(cats[c]), 1))
                
        else: # SINGLE
            # Grab one random product, favor hot categories (GPU, Monitor, Mouse, Keyboard)
            hot_cats = ["gpu", "monitor", "mouse", "keyboard", "ssd", "ram"]
            chosen_cat = random.choice(hot_cats)
            if cats.get(chosen_cat):
                selected_products.append((random.choice(cats[chosen_cat]), 1))
            else:
                selected_products.append((random.choice(products), 1))
                
        # Ensure we have at least 1 product
        if not selected_products:
            selected_products.append((random.choice(products), 1))
            
        # Calculate totals
        subtotal = 0
        total_discount = 0
        
        items_payload = []
        
        for prod, qty in selected_products:
            price = prod["price"]
            orig_price = prod["original_price"]
            
            item_subtotal = price * qty
            item_discount = (orig_price - price) * qty
            
            subtotal += item_subtotal
            total_discount += item_discount
            
            items_payload.append({
                "product": prod,
                "quantity": qty,
                "price": price,
                "original_price": orig_price
            })
            
        shipping_fee = 30000 if subtotal < 5000000 else 0
        total_amount = subtotal + shipping_fee
        
        # Decide order status
        # Deliver timeline logic
        # 94% Delivered, 2% Cancelled, 4% Active (processing/pending/shipped - if order date is close to current date)
        days_diff = (CURRENT_DATE - date_created).days
        
        if days_diff < 5:
            # Recent order
            status = random.choices(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"], weights=[20, 30, 20, 25, 5])[0]
        else:
            status = random.choices(["DELIVERED", "CANCELLED"], weights=[96, 4])[0]
            
        payment_method = random.choices(["COD", "BANK_TRANSFER", "VNPAY", "MOMO", "CREDIT_CARD"], weights=[40, 35, 12, 10, 3])[0]
        payment_status = "PENDING"
        if status in ["DELIVERED", "SHIPPED"]:
            payment_status = "PAID"
        elif status == "CANCELLED":
            payment_status = "REFUNDED" if payment_method != "COD" and random.random() > 0.2 else "CANCELLED"
            
        # Order timeline
        confirmed_at = None
        shipped_at = None
        delivered_at = None
        cancelled_at = None
        
        if status != "PENDING":
            confirmed_at = (date_created + timedelta(minutes=random.randint(5, 45))).isoformat()
            
        if status in ["SHIPPED", "DELIVERED"]:
            shipped_at = (date_created + timedelta(hours=random.randint(2, 18))).isoformat()
            
        if status == "DELIVERED":
            delivered_at = (date_created + timedelta(days=random.randint(1, 3), hours=random.randint(0, 5))).isoformat()
            
        if status == "CANCELLED":
            cancelled_at = (date_created + timedelta(hours=random.randint(1, 24))).isoformat()
            
        order_code = f"ORD-{date_created.strftime('%y%m%d')}-{order_id_counter:04d}"
        
        order = {
            "order_id": order_code,
            "customer_id": cust["customer_id"],
            "customer_name": cust["name"],
            "phone": cust["phone"],
            "address": cust["address"],
            "city": cust["city"],
            "subtotal": subtotal,
            "discount": total_discount,
            "shipping_fee": shipping_fee,
            "total_amount": total_amount,
            "payment_method": payment_method,
            "payment_status": payment_status,
            "status": status,
            "created_at": date_created.isoformat(),
            "confirmed_at": confirmed_at,
            "shipped_at": shipped_at,
            "delivered_at": delivered_at,
            "cancelled_at": cancelled_at,
            "items": []
        }
        
        # Build individual items
        for item in items_payload:
            p = item["product"]
            qty = item["quantity"]
            price = item["price"]
            orig_price = item["original_price"]
            
            # Rating & review generation for completed orders
            rating = None
            review_text = ""
            if status == "DELIVERED":
                rating = random.choices([5, 4, 3, 2, 1], weights=[70, 18, 7, 3, 2])[0]
                review_text = random.choice(REVIEWS[rating])
                
            order_item = {
                "order_item_id": f"ORI-{item_id_counter:06d}",
                "order_id": order_code,
                "product_id": p["product_id"],
                "sku": p["sku"],
                "name": p["name"],
                "category_name": p["category_name"],
                "brand": p["brand"],
                "quantity": qty,
                "price": price,
                "original_price": orig_price,
                "total_price": price * qty,
                "rating": rating,
                "review": review_text
            }
            order_items.append(order_item)
            order["items"].append(order_item)
            item_id_counter += 1
            
        orders.append(order)
        order_id_counter += 1

    return orders, order_items

def save_suppliers(suppliers):
    with open(SUPPLIERS_JSON, "w", encoding="utf-8") as f:
        json.dump(suppliers, f, ensure_ascii=False, indent=2)
        
    with open(SUPPLIERS_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["supplier_id", "code", "name", "email", "phone", "address", "supplied_brands", "created_at", "status"])
        for s in suppliers:
            writer.writerow([
                s.get("supplier_id", s["code"]),
                s["code"],
                s["name"],
                s["email"],
                s["phone"],
                s["address"],
                ", ".join(s["supplied_brands"]),
                s["created_at"],
                s["status"]
            ])
            
def save_customers(customers):
    with open(CUSTOMERS_JSON, "w", encoding="utf-8") as f:
        json.dump(customers, f, ensure_ascii=False, indent=2)
        
    if customers:
        keys = list(customers[0].keys())
        with open(CUSTOMERS_CSV, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(customers)

def save_orders(orders, order_items):
    # Save orders to JSON
    # To keep JSON size manageable, we can save full structures with nested items
    with open(ORDERS_JSON, "w", encoding="utf-8") as f:
        json.dump(orders, f, ensure_ascii=False, indent=2)
        
    # Save orders summary to CSV (without nested items to keep CSV flat)
    if orders:
        keys = [k for k in orders[0].keys() if k != "items"]
        with open(ORDERS_CSV, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            for o in orders:
                o_csv = {k: o[k] for k in keys}
                writer.writerow(o_csv)
                
    # Save order items to flat CSV for relational database mapping
    if order_items:
        keys = list(order_items[0].keys())
        with open(ORDER_ITEMS_CSV, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(order_items)

def main():
    print("=" * 65)
    print("  ERP SEED DATA GENERATOR — KLTN")
    print("=" * 65)
    
    if not os.path.exists(PRODUCTS_JSON_PATH):
        print(f"Error: {PRODUCTS_JSON_PATH} not found. Clean first.")
        return
        
    with open(PRODUCTS_JSON_PATH, "r", encoding="utf-8") as f:
        products = json.load(f)
        
    brands = sorted(list(set(p["brand"] for p in products if p.get("brand"))))
    print(f"Found {len(products)} products, {len(brands)} brands.")
    
    print("\n[1] Generating Suppliers...")
    suppliers = create_suppliers(brands)
    save_suppliers(suppliers)
    print(f"    Saved {len(suppliers)} suppliers to JSON/CSV.")
    
    print("\n[2] Generating Customers...")
    customers = create_customers(500)
    save_customers(customers)
    print(f"    Saved {len(customers)} customers to JSON/CSV.")
    
    print("\n[3] Generating Orders & Reviews...")
    orders, order_items = create_orders(products, customers, 3000)
    save_orders(orders, order_items)
    print(f"    Saved {len(orders)} orders and {len(order_items)} items to JSON/CSV.")
    
    print("\n" + "=" * 65)
    print("  SUCCESSFULLY GENERATED ALL ERP SEED FILES!")
    print(f"  - Products  : {len(products)} (already scraped)")
    print(f"  - Suppliers : {len(suppliers)}")
    print(f"  - Customers : {len(customers)}")
    print(f"  - Orders    : {len(orders)}")
    print(f"  - Reviews   : {sum(1 for i in order_items if i.get('rating') is not None)}")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    main()
