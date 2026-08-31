# -*- coding: utf-8 -*-
import json
import csv
import os
import re

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
INPUT_JSON_PATH = os.path.join(DATA_DIR, "products_clean.json")
OUTPUT_JSON_PATH = os.path.join(DATA_DIR, "products_clean.json") # Overwrite
OUTPUT_CSV_PATH = os.path.join(DATA_DIR, "products_clean.csv")

def load_data():
    with open(INPUT_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    # Save JSON
    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(data)} products to JSON: {OUTPUT_JSON_PATH}")

    # Save CSV
    if len(data) > 0:
        keys = list(data[0].keys())
        with open(OUTPUT_CSV_PATH, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            for p in data:
                # Convert specs and filters to strings for CSV compatibility
                p_csv = p.copy()
                if isinstance(p_csv.get("specs"), dict):
                    p_csv["specs"] = json.dumps(p_csv["specs"], ensure_ascii=False)
                if isinstance(p_csv.get("filters"), dict):
                    p_csv["filters"] = json.dumps(p_csv["filters"], ensure_ascii=False)
                writer.writerow(p_csv)
        print(f"Saved {len(data)} products to CSV: {OUTPUT_CSV_PATH}")

def clean_text(text):
    if not text:
        return ""
    # Normalize whitespaces
    return re.sub(r'\s+', ' ', text).strip()

def parse_specs_from_description(desc, category_slug, name):
    specs = {}
    
    # Pre-cleaning
    desc_clean = clean_text(desc)
    name_clean = clean_text(name)
    combined_text = f"{name_clean} | {desc_clean}"

    # Standard patterns lookup helper
    def find_pattern(patterns, text, flags=re.IGNORECASE):
        for pattern in patterns:
            match = re.search(pattern, text, flags)
            if match:
                return match.group(1).strip()
        return None

    # --- 1. CPU ENRICHMENT ---
    if category_slug == "cpu":
        # Socket
        socket = find_pattern([
            r'(?:socket|sk)\s*(lga\s*\d+|am\d+|s\d+|tr\d+|\d+)',
            r'\b(lga\s*1700|lga\s*1200|lga\s*1151|lga\s*1851|am4|am5)\b'
        ], combined_text)
        if socket:
            specs["Socket"] = socket.upper()

        # Cores (Số nhân)
        cores = find_pattern([
            r'(\d+)\s*(?:nhân|cores|core)(?!\s*đồ)',
            r'\b(?:cpu|bộ vi xử lý)\s*(\d+)\s*nhân\b'
        ], combined_text)
        if cores:
            specs["Số nhân"] = cores

        # Threads (Số luồng)
        threads = find_pattern([
            r'(\d+)\s*(?:luồng|threads)'
        ], combined_text)
        if threads:
            specs["Số luồng"] = threads

        # Base / Boost Clock (Xung nhịp)
        clock = find_pattern([
            r'turbo\s*up\s*to\s*([\d\.]+\s*ghz)',
            r'xung\s*nhịp\s*([\d\.]+\s*ghz)',
            r'([\d\.]+\s*ghz)\s*(?:turbo|boost|max)',
            r'\b([\d\.]+\s*ghz)\b'
        ], combined_text)
        if clock:
            specs["Xung nhịp tối đa"] = clock

        # TDP (Điện năng tiêu thụ)
        tdp = find_pattern([
            r'(?:tdp|điện năng tiêu thụ|công suất tỏa nhiệt)\s*[:\-]?\s*(\d+\s*w)',
            r'\b(\d+\s*w)\s*tdp\b',
            r'\b(125w|65w|46w|253w|250w|150w|180w)\b'
        ], combined_text)
        if tdp:
            specs["Điện năng tiêu thụ"] = tdp.upper()

        # Integrated graphics
        if re.search(r'\b(f|kf)\b', name_clean, re.IGNORECASE) or "không tích hợp đồ họa" in desc_clean.lower() or "không đồ họa" in desc_clean.lower():
            specs["Đồ họa tích hợp"] = "Không"
        else:
            graphics = find_pattern([
                r'(intel®?\s*(?:uhd|iris®?\s*xe)\s*graphics\s*\d*)',
                r'(amd\s*radeon™?\s*graphics)',
                r'đồ\s*họa\s*tích\s*hợp\s*[:\-]?\s*([^\|;\.#]+)'
            ], combined_text)
            if graphics:
                specs["Đồ họa tích hợp"] = graphics
            elif re.search(r'\b(g7400|g6405|i3|i5|i7|i9|ultra)\b', name_clean, re.IGNORECASE):
                specs["Đồ họa tích hợp"] = "Có"

    # --- 2. GPU (VGA) ENRICHMENT ---
    elif category_slug == "gpu":
        # Memory Size / Capacity (Dung lượng VRAM)
        vram = find_pattern([
            r'\b(\d+gb)\s*(?:gddr\d|hbm\d|hbm|memory|dung lượng)\b',
            r'(?:dung lượng|dung lượng bộ nhớ)\s*[:\-]?\s*(\d+\s*gb)',
            r'\b(\d+\s*gb)\b'
        ], name_clean) # Check in name first for accuracy (e.g. 8GB, 12GB, 16GB)
        if not vram:
            vram = find_pattern([
                r'(?:dung lượng|dung lượng bộ nhớ|memory size)\s*[:\-]?\s*(\d+\s*gb)',
                r'\b(\d+gb)\s*gddr\b'
            ], combined_text)
        if vram:
            specs["Dung lượng bộ nhớ"] = vram.upper()

        # Memory Type (Loại bộ nhớ)
        vram_type = find_pattern([
            r'\b(gddr6x|gddr6|gddr5|gddr7|hbm2|gddr)\b'
        ], combined_text)
        if vram_type:
            specs["Loại bộ nhớ"] = vram_type.upper()

        # Memory Bus Width (Interface / Bus bộ nhớ)
        bus_width = find_pattern([
            r'(?:bus bộ nhớ|memory bus|giao tiếp bộ nhớ|băng thông bộ nhớ)\s*[:\-]?\s*(\d+\s*bit)',
            r'\b(\d+\s*bit)\b'
        ], combined_text)
        if bus_width:
            specs["Băng thông bộ nhớ"] = bus_width

        # Recommended PSU (Nguồn đề xuất)
        psu_rec = find_pattern([
            r'(?:nguồn đề xuất|nguồn khuyến cáo|nguồn tối thiểu|recommended psu|psu đề xuất|power requirement|nguồn)\s*[:\-]?\s*(\d+\s*w)',
            r'\b(\d+\s*w)\s*(?:hoặc\s*cao\s*hơn\s*)?(?:nguồn|psu|khuyến nghị)\b',
            r'\b(?:nguồn|psu)\s*(?:khuyến nghị|đề xuất|tối thiểu)\s*(\d+\s*w)\b'
        ], combined_text)
        if psu_rec:
            specs["Nguồn đề xuất"] = psu_rec.upper()

        # Fan count (Số quạt tản nhiệt)
        fans = find_pattern([
            r'(\d+)\s*(?:quạt|fan)',
            r'\b(1|2|3)\s*fans?\b'
        ], combined_text)
        if fans:
            specs["Số quạt"] = fans

    # --- 3. PSU (Nguồn máy tính) ENRICHMENT ---
    elif category_slug == "psu":
        # Wattage (Công suất)
        wattage = find_pattern([
            r'\b(\d+w)\b',
            r'(?:công suất|công suất định mức)\s*[:\-]?\s*(\d+\s*w)'
        ], name_clean) # Check in name first for accuracy (e.g. 750W, 850W)
        if not wattage:
            wattage = find_pattern([
                r'(?:công suất|công suất định mức|total power|output)\s*[:\-]?\s*(\d+\s*w)',
                r'\b(\d+w)\b'
            ], combined_text)
        if wattage:
            specs["Công suất"] = wattage.upper()

        # 80 Plus Rating (Chuẩn hiệu suất)
        rating = find_pattern([
            r'\b(titanium|platinum|gold|silver|bronze|white)\b',
            r'(80\s*plus\s*(?:titanium|platinum|gold|silver|bronze|white|standard))',
            r'chuẩn\s*hiệu\s*suất\s*[:\-]?\s*([^\|;\.#]+)'
        ], combined_text)
        if rating:
            if "80 plus" not in rating.lower() and rating.lower() in ["titanium", "platinum", "gold", "silver", "bronze", "white"]:
                rating = f"80 Plus {rating.capitalize()}"
            specs["Chuẩn hiệu suất"] = rating

        # Modular Type (Kiểu cáp nguồn)
        modular = "Non-Modular"
        if "full modular" in combined_text.lower() or "fully modular" in combined_text.lower():
            modular = "Full Modular"
        elif "semi modular" in combined_text.lower() or "semi-modular" in combined_text.lower():
            modular = "Semi-Modular"
        specs["Kiểu cáp nguồn"] = modular

        # Standard (Chuẩn nguồn)
        std = find_pattern([
            r'\b(atx\s*3\.\d|pcie\s*5\.\d|atx12v|sfx|atx)\b'
        ], combined_text)
        if std:
            specs["Chuẩn nguồn"] = std.upper()

    # --- 4. MAINBOARD (Bo mạch chủ) ENRICHMENT ---
    elif category_slug == "mainboard":
        # Socket
        socket = find_pattern([
            r'(?:socket|sk)\s*(lga\s*\d+|am\d+|\d+)',
            r'\b(lga\s*1700|lga\s*1200|lga\s*1151|lga\s*1851|am4|am5)\b'
        ], combined_text)
        if socket:
            specs["Socket"] = socket.upper()

        # Chipset
        chipset = find_pattern([
            r'\b(h610|b760|z790|z890|a620|b650|x670|a520|b550|x570|h510|b560|z590|b450|z690|h310|b365|b760m|h610m|z790m)\b'
        ], combined_text)
        if chipset:
            # Clean trailing 'm' if it stands for micro-ATX in product names
            chipset_clean = chipset.upper()
            if chipset_clean.endswith("M") and chipset_clean[:-1] in ["B760", "H610", "Z790", "A620", "B650", "H510", "B560"]:
                chipset_clean = chipset_clean[:-1]
            specs["Chipset"] = chipset_clean

        # Form Factor (Kích thước)
        form_factor = find_pattern([
            r'\b(atx|micro-atx|m-atx|mini-itx|e-atx|eatx|matx)\b'
        ], combined_text)
        if form_factor:
            ff_upper = form_factor.upper()
            if ff_upper in ["M-ATX", "MATX"]:
                ff_upper = "Micro-ATX"
            specs["Chuẩn kích thước"] = ff_upper

        # RAM Type Supported (Loại RAM hỗ trợ)
        ram_type = find_pattern([
            r'\b(ddr5|ddr4)\b'
        ], combined_text)
        if ram_type:
            specs["Loại RAM hỗ trợ"] = ram_type.upper()

    # --- 5. RAM ENRICHMENT ---
    elif category_slug == "ram":
        # RAM Type
        ram_type = find_pattern([
            r'\b(ddr5|ddr4|ddr3)\b'
        ], combined_text)
        if ram_type:
            specs["Loại RAM"] = ram_type.upper()

        # Capacity (Dung lượng)
        capacity = find_pattern([
            r'\b(\d+gb)\b',
            r'(?:dung lượng|dung lượng bộ nhớ)\s*[:\-]?\s*(\d+\s*gb)'
        ], name_clean)
        if not capacity:
            capacity = find_pattern([
                r'\b(\d+gb)\b'
            ], combined_text)
        if capacity:
            specs["Dung lượng"] = capacity.upper()

        # Bus Speed / Frequency (Tốc độ Bus)
        bus = find_pattern([
            r'\b(\d{4}\s*mhz)\b',
            r'\b(bus|tốc độ)\s*(\d{4})\b',
            r'\b(\d{4}\s*mt/s)\b'
        ], combined_text)
        if bus:
            specs["Tốc độ Bus"] = bus.upper()

        # Kit quantity (Số lượng thanh)
        kit = "1 thanh"
        if "kit" in name_clean.lower() or "2x" in name_clean.lower() or "kit 2" in combined_text.lower():
            kit = "2 thanh"
        elif "4x" in name_clean.lower() or "kit 4" in combined_text.lower():
            kit = "4 thanh"
        specs["Số lượng thanh"] = kit

    # --- 6. CASE (Vỏ máy tính) ENRICHMENT ---
    elif category_slug == "case":
        # Form Factor Supported (Mainboard hỗ trợ)
        mb_support = []
        if "atx" in combined_text.lower():
            mb_support.append("ATX")
        if "micro-atx" in combined_text.lower() or "m-atx" in combined_text.lower() or "matx" in combined_text.lower():
            mb_support.append("Micro-ATX")
        if "mini-itx" in combined_text.lower() or "itx" in combined_text.lower():
            mb_support.append("Mini-ITX")
        if "e-atx" in combined_text.lower() or "eatx" in combined_text.lower():
            mb_support.append("E-ATX")
        if mb_support:
            specs["Mainboard hỗ trợ"] = ", ".join(mb_support)

        # Color (Màu sắc)
        color = None
        if "white" in name_clean.lower() or "trắng" in name_clean.lower():
            color = "Trắng"
        elif "black" in name_clean.lower() or "đen" in name_clean.lower():
            color = "Đen"
        elif "pink" in name_clean.lower() or "hồng" in name_clean.lower():
            color = "Hồng"
        if color:
            specs["Màu sắc"] = color

    # --- 7. COOLER (Tản nhiệt) ENRICHMENT ---
    elif category_slug == "cooler":
        # Cooler Type
        cooler_type = "Tản nhiệt khí"
        if "aio" in name_clean.lower() or "liquid" in name_clean.lower() or "nước" in name_clean.lower() or "water" in name_clean.lower():
            cooler_type = "Tản nhiệt nước AIO"
        specs["Loại tản nhiệt"] = cooler_type

        # Sockets Supported
        mb_support = []
        if "1700" in combined_text: mb_support.append("LGA1700")
        if "1200" in combined_text: mb_support.append("LGA1200")
        if "115" in combined_text: mb_support.append("LGA115x")
        if "1851" in combined_text: mb_support.append("LGA1851")
        if "am4" in combined_text.lower(): mb_support.append("AM4")
        if "am5" in combined_text.lower(): mb_support.append("AM5")
        if mb_support:
            specs["Socket hỗ trợ"] = ", ".join(mb_support)

        # Radiator Size for AIO
        if cooler_type == "Tản nhiệt nước AIO":
            rad_size = find_pattern([
                r'\b(120|240|280|360|420)\b'
            ], name_clean)
            if rad_size:
                specs["Kích thước tản nhiệt"] = f"{rad_size}mm"

    return specs

def enrich_dataset():
    print("Loading data...")
    products = load_data()
    print(f"Loaded {len(products)} products.")

    enriched_count = 0
    updated_specs_count = 0

    for p in products:
        category_slug = p.get("category_slug", "")
        desc = p.get("description_text", "")
        name = p.get("name", "")
        
        # Load existing specs
        existing_specs = {}
        try:
            if p.get("specs") and p["specs"] != "{}":
                existing_specs = json.loads(p["specs"])
        except Exception as e:
            print(f"Error parsing specs for {p.get('name')}: {e}")
            existing_specs = {}

        # Parse new specs from description/name
        parsed_specs = parse_specs_from_description(desc, category_slug, name)
        
        # Merge filters if they contain useful fields
        filters_dict = {}
        try:
            if p.get("filters") and p["filters"] != "{}":
                filters_dict = json.loads(p["filters"])
        except Exception as e:
            pass

        # Normalize filters and merge into parsed specs
        for fk, fv in filters_dict.items():
            if fk == "Socket" and "Socket" not in parsed_specs:
                parsed_specs["Socket"] = fv
            elif fk == "Dòng CPU" and "Dòng CPU" not in parsed_specs:
                parsed_specs["Dòng CPU"] = fv
            elif fk == "Thế hệ CPU" and "Thế hệ CPU" not in parsed_specs:
                parsed_specs["Thế hệ CPU"] = fv

        # Update existing specs with parsed specs
        new_specs = existing_specs.copy()
        has_updates = False
        for k, v in parsed_specs.items():
            if k not in new_specs or new_specs[k] in ("", None, "Đang cập nhật", "-"):
                new_specs[k] = v
                has_updates = True

        if has_updates or (not existing_specs and new_specs):
            p["specs"] = json.dumps(new_specs, ensure_ascii=False)
            updated_specs_count += 1

        enriched_count += 1

    print(f"Enrichment process completed.")
    print(f"Analyzed: {enriched_count} products.")
    print(f"Enriched/Updated specs: {updated_specs_count} products.")

    save_data(products)

if __name__ == "__main__":
    enrich_dataset()
