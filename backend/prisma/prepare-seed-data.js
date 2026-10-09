// Chuẩn bị scraper/data/ cho `npm run db:seed` trên máy mới: thư mục này bị gitignore nên clone về
// không có. Lấy danh mục sản phẩm đã commit sẵn ở frontend/public/products_clean.json, rồi chạy
// scraper/generate_erp_seeds.py (offline) để sinh suppliers/customers/orders.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..', '..');
const dataDir = path.join(root, 'scraper', 'data');
const source = path.join(root, 'frontend', 'public', 'products_clean.json');
const target = path.join(dataDir, 'products_clean.json');

fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(target)) {
  if (!fs.existsSync(source)) {
    console.error(`Không tìm thấy ${source} — không có danh mục sản phẩm để seed.`);
    process.exit(1);
  }
  fs.copyFileSync(source, target);
  console.log('Đã sao chép products_clean.json vào scraper/data/.');
}

const python = process.platform === 'win32' ? 'python' : 'python3';
const run = spawnSync(python, [path.join(root, 'scraper', 'generate_erp_seeds.py')], { cwd: root, stdio: 'inherit' });
if (run.error || run.status !== 0) {
  console.error('Chạy generate_erp_seeds.py thất bại — cần cài Python 3.');
  process.exit(1);
}
console.log('Dữ liệu seed đã sẵn sàng. Chạy tiếp: npm run db:seed');
