# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

"""
========================================================================
  GearVN.com -- Web Scraper Unified cho KLTN ERP Linh Kiện Máy Tính
  Nguồn: gearvn.com  |  Platform: Haravan (public JSON API)
========================================================================
  Đặc điểm:
  ► Gộp toàn bộ danh mục từ 3 giai đoạn cào (27 collection handles)
  ► Tự động khử trùng lặp sản phẩm bằng product_id
  ► Đảm bảo rate-limiting (delay 1.5s/request) để tránh bị chặn
  ► Kết xuất trực tiếp ra JSON & CSV sạch
========================================================================
"""

import requests
import json
import csv
import time
import re
import os
from datetime import datetime
from bs4 import BeautifulSoup

# ─────────────────────────────────────────────
# Cấu hình danh mục và hệ thống
# ─────────────────────────────────────────────
BASE_URL = "https://www.gearvn.com"
PRODUCTS_PER_PAGE = 50   
REQUEST_DELAY = 1.5   
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")

# Tất cả 27 collection handles từ các giai đoạn cào
CATEGORIES = [
    # 1. CPU
    {"handle": "cpu-bo-vi-xu-ly",          "name": "CPU - Bộ vi xử lý",     "slug": "cpu"},
    
    # 2. GPU (Card màn hình)
    {"handle": "vga-card-man-hinh",        "name": "GPU - Card màn hình",    "slug": "gpu"},
    
    # 3. RAM (PC & Laptop)
    {"handle": "ram-pc",                   "name": "RAM PC",                 "slug": "ram"},
    {"handle": "ram-laptop",               "name": "RAM Laptop",             "slug": "ram_laptop"},
    
    # 4. Lưu trữ (SSD & HDD)
    {"handle": "ssd-o-cung-the-ran",       "name": "SSD - Ổ cứng thể rắn",  "slug": "ssd"},
    {"handle": "ssd-laptop",               "name": "SSD Laptop",             "slug": "ssd_laptop"},
    {"handle": "hdd-o-cung",               "name": "HDD - Ổ cứng cơ học",    "slug": "hdd"},
    {"handle": "hdd-seagate",              "name": "HDD Seagate",            "slug": "hdd"},
    {"handle": "hdd-2tb",                  "name": "HDD 2TB",                "slug": "hdd"},
    
    # 5. Mainboard (Bo mạch chủ)
    {"handle": "mainboard-bo-mach-chu",    "name": "Mainboard - Bo mạch chủ", "slug": "mainboard"},
    
    # 6. PSU (Nguồn máy tính)
    {"handle": "nguon-may-tinh",           "name": "PSU - Nguồn máy tính",   "slug": "psu"},
    {"handle": "psu-nguon-may-tinh",       "name": "PSU - Nguồn máy tính",   "slug": "psu"},
    
    # 7. Case (Vỏ máy)
    {"handle": "case-thung-may-tinh",      "name": "Case - Thùng máy tính",  "slug": "case"},
    
    # 8. Cooler (Tản nhiệt)
    {"handle": "tan-nhiet-cpu",            "name": "Cooler - Tản nhiệt CPU", "slug": "cooler"},
    {"handle": "tan-nhiet-may-tinh",       "name": "Cooler - Tản nhiệt máy tính", "slug": "cooler"},
    
    # 9. Màn hình (Gaming, văn phòng, cong...)
    {"handle": "man-hinh-may-tinh",        "name": "Monitor - Màn hình",     "slug": "monitor"},
    {"handle": "man-hinh-may-tinh-gaming", "name": "Monitor - Màn hình gaming", "slug": "monitor"},
    {"handle": "man-hinh-144-240hz",       "name": "Monitor - Màn hình gaming",  "slug": "monitor"},
    {"handle": "man-hinh-24-inch",         "name": "Monitor - Màn hình 24\"",    "slug": "monitor"},
    {"handle": "man-hinh-cong",            "name": "Monitor - Màn hình cong",    "slug": "monitor"},
    
    # 10. Bàn phím
    {"handle": "ban-phim",                 "name": "Bàn phím",               "slug": "keyboard"},
    {"handle": "ban-phim-co-gx-switch",    "name": "Bàn phím cơ GX",         "slug": "keyboard"},
    {"handle": "ban-phim-tkl",             "name": "Bàn phím TKL",           "slug": "keyboard"},
    {"handle": "ban-phim-logitech",        "name": "Bàn phím Logitech",       "slug": "keyboard"},
    {"handle": "ban-phim-akko",            "name": "Bàn phím Akko",           "slug": "keyboard"},
    {"handle": "ban-phim-gia-co",          "name": "Bàn phím giả cơ",        "slug": "keyboard"},
    
    # 11. Chuột máy tính
    {"handle": "chuot-may-tinh",           "name": "Chuột máy tính",         "slug": "mouse"},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://www.gearvn.com/",
}

def log(msg, level="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    icons = {"INFO": "[*]", "OK": "[OK]", "WARN": "[!]", "ERR": "[ERR]", "DATA": "[+]"}
    print(f"[{ts}] {icons.get(level,'[-]')} {msg}")

def safe_int(val):
    try: return int(str(val).replace(",", "").strip())
    except: return 0

def html_to_text(html_str):
    if not html_str: return ""
    try:
        soup = BeautifulSoup(html_str, "html.parser")
        return soup.get_text(separator=" ").strip()
    except Exception:
        return html_str

def parse_specs_from_tags(tags_str):
    specs = {}
    if not tags_str: return specs
    for tag in tags_str.split(","):
        tag = tag.strip()
        if tag.startswith("spec_") and ":" in tag[5:]:
            key, _, value = tag[5:].partition(":")
            specs[key.strip()] = value.strip()
    return specs

def parse_filter_tags(tags_str):
    filters = {}
    if not tags_str: return filters
    for tag in tags_str.split(","):
        tag = tag.strip()
        if tag.startswith("filter_") and ":" in tag[7:]:
            key, _, value = tag[7:].partition(":")
            filters[key.strip()] = value.strip()
    return filters

def parse_warranty(tags_str):
    if not tags_str: return None
    match = re.search(r"warranty(?:_product)?:(\d+)", tags_str)
    return f"{match.group(1)} tháng" if match else None

def normalize_price(price_str):
    try: return int(str(price_str).replace(".", "").replace(",", "").strip())
    except: return 0

def fetch_collection_page(handle, page=1):
    url = f"{BASE_URL}/collections/{handle}/products.json"
    params = {"limit": PRODUCTS_PER_PAGE, "page": page}
    try:
        resp = requests.get(url, headers=HEADERS, params=params, timeout=15)
        resp.raise_for_status()
        return resp.json().get("products", [])
    except Exception as e:
        log(f"Lỗi tải collection [{handle}], trang {page}: {e}", "ERR")
        return []

def scrape_category(category):
    handle = category["handle"]
    cat_name = category["name"]
    cat_slug = category["slug"]
    
    log(f"Bắt đầu scrape: {cat_name} ({handle})", "INFO")
    all_products = []
    page = 1
    
    while True:
        log(f"  Trang {page}...", "INFO")
        products = fetch_collection_page(handle, page=page)
        if not products:
            break
        all_products.extend(products)
        log(f"  → {len(products)} sản phẩm (tổng: {len(all_products)})", "DATA")
        if len(products) < PRODUCTS_PER_PAGE:
            break
        page += 1
        time.sleep(REQUEST_DELAY)
        
    return all_products, cat_name, cat_slug

def clean_product(raw, category_name, category_slug, category_handle):
    raw_tags = raw.get("tags") or []
    tags_str = ", ".join(raw_tags) if isinstance(raw_tags, list) else (raw_tags or "")
    
    specs = parse_specs_from_tags(tags_str)
    filters = parse_filter_tags(tags_str)
    warranty = parse_warranty(tags_str)
    
    variants = raw.get("variants", [])
    first_variant = variants[0] if variants else {}
    
    price = normalize_price(first_variant.get("price", 0))
    compare_price = normalize_price(first_variant.get("compare_at_price", 0))
    discount_pct = 0
    if compare_price > price > 0:
        discount_pct = round((compare_price - price) / compare_price * 100, 1)
        
    images = raw.get("images", [])
    primary_image = images[0].get("src", "") if images else ""
    image_urls = [img.get("src", "") for img in images if img.get("src")]
    
    sku = first_variant.get("sku", "") or first_variant.get("barcode", "")
    id_match = re.search(r"id_gearvn:(\d+)", tags_str)
    gearvn_id = id_match.group(1) if id_match else ""
    
    return {
        "product_id":        str(raw.get("id", "")),
        "gearvn_id":         gearvn_id,
        "sku":               sku,
        "handle":            raw.get("handle", ""),
        "url":               f"{BASE_URL}/products/{raw.get('handle', '')}",
        "category_name":     category_name,
        "category_slug":     category_slug,
        "category_handle":   category_handle,
        "product_type":      raw.get("product_type", ""),
        "name":              raw.get("title", ""),
        "brand":             raw.get("vendor", ""),
        "description_text":  html_to_text(raw.get("body_html", ""))[:1000],
        "price":             price,
        "original_price":    compare_price if compare_price > 0 else price,
        "discount_percent":  discount_pct,
        "currency":          "VND",
        "available":         raw.get("available", False),
        "stock_quantity":    safe_int(first_variant.get("inventory_quantity", 0)),
        "primary_image":     primary_image,
        "image_urls":        "|".join(image_urls),
        "image_count":       len(image_urls),
        "warranty":          warranty or specs.get("Bảo hành", ""),
        "specs":             json.dumps(specs, ensure_ascii=False),
        "filters":           json.dumps(filters, ensure_ascii=False),
        "published_at":      raw.get("published_at", ""),
        "updated_at":        raw.get("updated_at", ""),
        "scraped_at":        datetime.now().isoformat(),
    }

def save_outputs(data):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    json_path = os.path.join(OUTPUT_DIR, "products_clean.json")
    csv_path = os.path.join(OUTPUT_DIR, "products_clean.csv")
    
    # Save JSON
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    log(f"Đã lưu JSON: {json_path} ({len(data)} records)", "OK")
    
    # Save CSV
    if data:
        keys = list(data[0].keys())
        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(data)
        log(f"Đã lưu CSV: {csv_path} ({len(data)} rows)", "OK")

def main():
    log("=" * 65, "INFO")
    log("  GEARVN UNIFIED SCRAPER — Bắt đầu thu thập dữ liệu", "INFO")
    log(f"  Tổng số danh mục cấu hình: {len(CATEGORIES)} collections", "INFO")
    log("=" * 65, "INFO")
    
    all_clean = []
    seen_ids = set()
    stats = {}
    
    for cat in CATEGORIES:
        raw_products, cat_name, cat_slug = scrape_category(cat)
        
        cleaned_count = 0
        for p in raw_products:
            pid = str(p.get("id", ""))
            if pid not in seen_ids:
                clean = clean_product(p, cat_name, cat_slug, cat["handle"])
                all_clean.append(clean)
                seen_ids.add(pid)
                cleaned_count += 1
                
        stats[cat_name] = stats.get(cat_name, 0) + cleaned_count
        time.sleep(REQUEST_DELAY * 2)
        
    log("\n📁 Đang ghi tệp kết quả...", "INFO")
    save_outputs(all_clean)
    
    log("\n📊 BÁO CÁO CÀO DỮ LIỆU TỔNG HỢP:", "INFO")
    for cat_name, count in sorted(stats.items(), key=lambda x: -x[1]):
        log(f"  {cat_name:<35} {count:>5} sản phẩm mới/không trùng", "DATA")
        
    log(f"\n  Tổng sản phẩm lưu trữ: {len(all_clean):,}", "OK")
    log(f"  Thương hiệu thực tế  : {len(set(p['brand'] for p in all_clean if p['brand']))}", "OK")
    log(f"  Dữ liệu lưu tại: {OUTPUT_DIR}", "OK")

if __name__ == "__main__":
    main()
