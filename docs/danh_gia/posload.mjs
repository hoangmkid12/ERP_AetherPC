import { BASE, login, q } from './lib.mjs';
const tok = (await login('sales')).token;
const prod = (await q("select product_id from products where available = true order by product_id limit 1 offset 40"))[0].product_id;
await q('update products set stock_quantity = 100000 where product_id = $1', [prod]);
await q('update inventory set quantity_on_hand = 100000 where product_id = $1', [prod]);
let next = 0; const codes = {};
const t0 = performance.now();
await Promise.all(Array.from({ length: 50 }, async () => {
  while (next < 500) { next++;
    const r = await fetch(`${BASE}/orders/pos`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ items: [{ productId: prod, quantity: 1 }], paymentMethod: 'CASH', type: 'POS' }) });
    codes[r.status] = (codes[r.status] || 0) + 1; }
}));
console.log({ total: 500, conc: 50, sec: ((performance.now() - t0) / 1000).toFixed(1), codes });
process.exit(0);
