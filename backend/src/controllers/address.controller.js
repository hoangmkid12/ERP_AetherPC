// Proxies the AddressKit API (production.cas.so) so the browser doesn't call
// it directly — that host doesn't send Access-Control-Allow-Origin, so
// cross-origin fetches from the frontend are always blocked by CORS.
const ADDRESSKIT_BASE = 'https://production.cas.so/address-kit/latest';

// Provinces/communes barely ever change — cache in-process to avoid hammering
// the upstream API on every checkout page load.
let provincesCache = null;
const communesCache = new Map();

// GET /api/v1/address/provinces
const getProvinces = async (req, res, next) => {
  try {
    if (!provincesCache) {
      const upstream = await fetch(`${ADDRESSKIT_BASE}/provinces`);
      if (!upstream.ok) throw new Error(`AddressKit provinces error: ${upstream.status}`);
      const data = await upstream.json();
      provincesCache = Array.isArray(data?.provinces) ? data.provinces : [];
    }
    res.json({ success: true, data: { provinces: provincesCache } });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/address/provinces/:code/communes
const getCommunes = async (req, res, next) => {
  try {
    const { code } = req.params;
    if (!communesCache.has(code)) {
      const upstream = await fetch(`${ADDRESSKIT_BASE}/provinces/${encodeURIComponent(code)}/communes`);
      if (!upstream.ok) throw new Error(`AddressKit communes error: ${upstream.status}`);
      const data = await upstream.json();
      communesCache.set(code, Array.isArray(data?.communes) ? data.communes : []);
    }
    res.json({ success: true, data: { communes: communesCache.get(code) } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProvinces, getCommunes };
