// Chụp lại giao diện chương 5 từ mã nguồn hiện tại (frontend dev :3000 → API :5000 không chạy bộ hẹn giờ).
// node shoot.js <thư mục ảnh ra> [tên ảnh...]
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const OUT = process.argv[2];
const ONLY = process.argv.slice(3);
const BASE = 'http://localhost:3000';
const EXE = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1243', 'chrome-win64', 'chrome.exe');
const PW = '123456';

const SHOTS = [
  { name: 'h5_03', url: '/login' },
  { name: 'h5_04', url: '/login', after: async (p) => { await p.getByRole('tab', { name: 'Đăng ký' }).click(); } },
  { name: 'h5_05a', url: '/' },
  { name: 'h5_05b', url: '/pc-builder' },
  { name: 'h5_06', user: 'customer_demo@kltn-erp.vn', url: '/cart', before: 'addToCart' },
  { name: 'h5_07', user: 'sales', url: '/admin/sales?tab=pos', after: async (p) => { await p.getByPlaceholder(/Tìm linh kiện/).fill('Ryzen'); } },
  { name: 'h5_08', user: 'sales_manager', url: '/admin/sales?tab=orders', after: async (p) => { await p.locator('select').filter({ hasText: 'Tất cả trạng thái' }).first().selectOption('SHIPPED'); } },
  { name: 'h5_09', user: 'cskh', url: '/admin/cskh?tab=livechat', wait: 5000 },
  { name: 'h5_10', user: 'purchasing', url: '/admin/purchasing?tab=rfq' },
  { name: 'h5_11', user: 'SUP-ASUS-VN', url: '/supplier/portal' },
  { name: 'h5_12', user: 'qc', url: '/admin/quality-control?tab=inbound' },
  { name: 'h5_13', user: 'qc', url: '/admin/quality-control?tab=returns' },
  { name: 'h5_14', user: 'warehouse_manager', url: '/admin/warehouse?tab=grn' },
  { name: 'h5_15', user: 'assembly', url: '/admin/assembly?tab=jobs' },
  { name: 'h5_16', user: 'warehouse_manager', url: '/admin/warehouse?tab=delivery' },
  { name: 'h5_17', user: 'delivery', url: '/admin/delivery?tab=active', mobile: true },
  { name: 'h5_18', user: 'accounting', url: '/admin/accounting?tab=cod_settlement' },
  { name: 'h5_19', user: 'accounting', url: '/admin/accounting?tab=po_payments' },
  { name: 'h5_20', user: 'hr', url: '/admin/hr?tab=payroll', wait: 4000, after: async (p) => { await p.locator('input[type=month]').first().fill('2026-06'); } },
  { name: 'h5_21', user: 'hr', url: '/admin/me?tab=checkin', wait: 7000 },
  { name: 'h5_22', user: 'ceo', url: '/admin/dashboard?tab=overview' },
  { name: 'h5_23', user: 'ceo', url: '/admin/dashboard?tab=approvals' },
  { name: 'h5_24', user: 'admin', url: '/admin/system?tab=rbac' },
];

async function login(page, user) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('#username', user).catch(() => page.getByPlaceholder('Nhập tên đăng nhập hoặc email').fill(user));
  await page.fill('#password', PW);
  await Promise.all([
    page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 }),
    page.locator('button[type=submit]').first().click(),
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function addToCart(page) {
  const res = await page.request.get(BASE + '/api/v1/products?search=ViewSonic&limit=1');
  const id = (await res.json()).data?.[0]?.productId;
  await page.goto(BASE + '/product/' + id, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Thêm vào giỏ/i }).first().click();
  await page.waitForTimeout(800);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: EXE,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--lang=vi-VN'],
  });
  for (const s of SHOTS) {
    if (ONLY.length && !ONLY.includes(s.name)) continue;
    const ctx = await browser.newContext({
      viewport: s.mobile ? { width: 420, height: 880 } : { width: 1440, height: 860 },
      deviceScaleFactor: s.mobile ? 2 : 1.5, locale: 'vi-VN', isMobile: !!s.mobile, hasTouch: !!s.mobile,
      permissions: ['camera', 'geolocation'], geolocation: { latitude: 10.7769, longitude: 106.7009 },
    });
    const page = await ctx.newPage();
    try {
      if (s.user) await login(page, s.user);
      if (s.before === 'addToCart') await addToCart(page);
      await page.goto(BASE + s.url, { waitUntil: 'networkidle', timeout: 45000 });
      // mở danh sách chức năng của phân hệ đang xem trên thanh điều hướng (mặc định thu gọn)
      await page.evaluate(() => {
        for (const t of document.querySelectorAll('.sidebar-module-toggle[aria-expanded="false"]')) {
          const a = t.closest('a');
          if (a && location.pathname.startsWith(new URL(a.href).pathname)) t.click();
        }
      }).catch(() => {});
      if (s.after) await s.after(page);
      await page.waitForTimeout(s.wait || 2500);
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.mouse.move(0, 0);
      await page.screenshot({ path: path.join(OUT, s.name + '.png') });
      console.log('OK', s.name, page.url());
    } catch (e) {
      console.log('FAIL', s.name, e.message.split('\n')[0]);
      await page.screenshot({ path: path.join(OUT, s.name + '_fail.png') }).catch(() => {});
    }
    await ctx.close();
  }
  await browser.close();
})();
