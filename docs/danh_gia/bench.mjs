// Đo hiệu năng API và kiểm thử tranh chấp tồn kho trên môi trường thử nghiệm (CSDL aether_e2e: 1.580 sản phẩm, ~3.000 đơn hàng).
import fs from 'fs';
import { BASE, login, q } from './lib.mjs';

const users = ['sales', 'accounting', 'hr', 'purchasing', 'warehouse', 'ceo'];
const tok = {};
for (const u of users) tok[u] = (await login(u)).token;
const prod = (await q("select product_id from products where available = true order by product_id limit 1 offset 40"))[0].product_id;

async function hit(user, method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (user) headers.Authorization = `Bearer ${tok[user]}`;
  const t0 = performance.now();
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const buf = await r.arrayBuffer();
  return { ms: performance.now() - t0, status: r.status, bytes: buf.byteLength };
}
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)]; };
const r1 = x => Math.round(x * 10) / 10;

const ENDPOINTS = [
  ['Danh sách sản phẩm (24/trang)', null, 'GET', '/products?limit=24&page=1'],
  ['Tìm kiếm sản phẩm theo tên', null, 'GET', '/products?search=RTX&limit=24'],
  ['Chi tiết sản phẩm', null, 'GET', `/products/${prod}`],
  ['Danh sách đơn hàng (nhân viên)', 'sales', 'GET', '/orders'],
  ['Danh sách tồn kho', 'warehouse', 'GET', '/warehouse/inventory'],
  ['Danh sách đơn mua hàng', 'purchasing', 'GET', '/purchasing/orders'],
  ['Sổ cái kế toán', 'accounting', 'GET', '/ledger'],
  ['Bảng lương theo kỳ', 'hr', 'GET', '/hr/payrolls?period=2026-09'],
  ['Đăng nhập nhân viên (băm bcrypt)', null, 'POST', '/auth/employee/login', { username: 'sales', password: '123456' }, 30],
  ['Tạo đơn bán tại quầy (ghi, giao dịch)', 'sales', 'POST', '/orders/pos', { items: [{ productId: prod, quantity: 1 }], paymentMethod: 'CASH', type: 'POS' }, 50],
];
await q('update products set stock_quantity = 100000 where product_id = $1', [prod]);
await q('update inventory set quantity_on_hand = 100000 where product_id = $1', [prod]);

const seq = [];
for (const [name, user, method, path, body, n = 100] of ENDPOINTS) {
  for (let i = 0; i < 5; i++) await hit(user, method, path, body);   // làm nóng
  const ms = []; let bytes = 0, bad = 0;
  for (let i = 0; i < n; i++) { const r = await hit(user, method, path, body); ms.push(r.ms); bytes = r.bytes; if (r.status >= 400) bad++; }
  const row = { name, method, path: path.split('?')[0].replace(prod, ':id'), n, p50: r1(pct(ms, 50)), p95: r1(pct(ms, 95)), max: r1(Math.max(...ms)), kb: r1(bytes / 1024), errors: bad };
  seq.push(row); console.log(row);
}

async function load(name, conc, total, mk) {
  const ms = []; let bad = 0, next = 0;
  const t0 = performance.now();
  await Promise.all(Array.from({ length: conc }, async () => {
    while (next < total) { next++; const r = await mk(); ms.push(r.ms); if (r.status >= 400) bad++; }
  }));
  const sec = (performance.now() - t0) / 1000;
  const row = { name, conc, total, rps: r1(total / sec), p50: r1(pct(ms, 50)), p95: r1(pct(ms, 95)), max: r1(Math.max(...ms)), errors: bad };
  console.log(row); return row;
}
const conc = [];
for (const c of [10, 50]) conc.push(await load('Danh sách sản phẩm', c, 1000, () => hit(null, 'GET', '/products?limit=24&page=1')));
conc.push(await load('Danh sách đơn hàng (nhân viên)', 20, 200, () => hit('sales', 'GET', '/orders')));
conc.push(await load('Tạo đơn bán tại quầy', 20, 200, () => hit('sales', 'POST', '/orders/pos', { items: [{ productId: prod, quantity: 1 }], paymentMethod: 'CASH', type: 'POS' })));

// Tranh chấp tồn kho: tồn = 5, 20 yêu cầu bán đồng thời mỗi yêu cầu 1 chiếc
const race = [];
for (let round = 1; round <= 3; round++) {
  const p2 = (await q("select product_id from products where available = true order by product_id limit 1 offset $1", [100 + round]))[0].product_id;
  await q('update products set stock_quantity = 5 where product_id = $1', [p2]);
  await q('update inventory set quantity_on_hand = 5, quantity_reserved = 0 where product_id = $1', [p2]);
  const rs = await Promise.all(Array.from({ length: 20 }, () => hit('sales', 'POST', '/orders/pos', { items: [{ productId: p2, quantity: 1 }], paymentMethod: 'CASH', type: 'POS' })));
  const after = (await q('select stock_quantity s from products where product_id = $1', [p2]))[0].s;
  const sold = (await q("select coalesce(sum(oi.quantity),0)::int n from order_items oi join orders o on o.order_id = oi.order_id where oi.product_id = $1 and o.created_at > now() - interval '5 minutes'", [p2]))[0].n;
  const row = { round, requests: 20, ok: rs.filter(r => r.status < 300).length, rejected: rs.filter(r => r.status >= 400).length, codes: [...new Set(rs.map(r => r.status))].join('/'), stockAfter: after, sold };
  race.push(row); console.log(row);
}
fs.writeFileSync('bench_results.json', JSON.stringify({ seq, conc, race, at: new Date().toISOString() }, null, 1));
process.exit(0);
