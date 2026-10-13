// API harness cho kiểm thử E2E theo vai trò (tài khoản demo, mật khẩu mặc định 123456): đăng nhập, cache cookie, gọi JSON.
const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:5000/api/v1'; // production: BASE=https://www.aetherpc.site/api/v1
const CACHE = path.join(require('os').tmpdir(), 'aetherpc_e2e_' + Buffer.from(BASE).toString('hex').slice(-16) + '.json');
let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE)); } catch {}
async function raw(method, url, body, cookie) {
  const r = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  return { status: r.status, json, setCookie: r.headers.getSetCookie?.() || [] };
}
async function login(user, password = '123456', customer = false) {
  if (cache[user]) return cache[user];
  const r = await raw('POST', customer ? '/auth/login' : '/auth/employee/login', { username: user, password });
  if (r.status !== 200) throw new Error(`login ${user} -> ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  const tok = r.json.token || r.json.data?.token;
  const cookie = tok ? `authToken=${tok}` : r.setCookie.map(c => c.split(';')[0]).join('; ');
  cache[user] = cookie; fs.writeFileSync(CACHE, JSON.stringify(cache));
  return cookie;
}
function as(user, opts = {}) {
  const call = async (method, url, body) => {
    const cookie = await login(user, opts.password, opts.customer);
    const r = await raw(method, url, body, cookie);
    if (r.status === 401 && cache[user]) { delete cache[user]; return call(method, url, body); }
    return { status: r.status, ...r.json };
  };
  return { get: (u) => call('GET', u), post: (u, b) => call('POST', u, b || {}), patch: (u, b) => call('PATCH', u, b || {}), put: (u, b) => call('PUT', u, b || {}), del: (u) => call('DELETE', u) };
}
module.exports = { as, raw, login, BASE };
