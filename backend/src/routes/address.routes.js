const express = require('express');
const router = express.Router();
const { getProvinces, getCommunes, getWards } = require('../controllers/address.controller');

// @route   GET /api/v1/address/provinces
router.get('/provinces', getProvinces);

// @route   GET /api/v1/address/provinces/:code/communes
router.get('/provinces/:code/communes', getCommunes);

// @route   GET /api/v1/address/wards?province=...&district=...
router.get('/wards', getWards);

module.exports = router;

