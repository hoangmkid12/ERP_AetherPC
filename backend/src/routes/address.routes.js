const express = require('express');
const router = express.Router();
const { getProvinces, getCommunes } = require('../controllers/address.controller');

// Public storefront checkout needs these — no auth. Proxies AddressKit
// (production.cas.so) because that API only allows CORS from
// http://localhost:3000, not any deployed domain, so the browser can't call
// it directly outside local dev.
// @route   GET /api/v1/address/provinces
router.get('/provinces', getProvinces);

// @route   GET /api/v1/address/provinces/:code/communes
router.get('/provinces/:code/communes', getCommunes);

module.exports = router;
