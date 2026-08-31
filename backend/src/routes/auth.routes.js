const express = require('express');
const router = express.Router();
const { loginCustomer, loginEmployee, registerCustomer, getMe, updateProfile, changePassword } = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// @route   POST /api/v1/auth/login
// @desc    Customer login portal
router.post('/login', loginCustomer);

// @route   POST /api/v1/auth/register
// @desc    Customer registration
router.post('/register', registerCustomer);

// @route   POST /api/v1/auth/employee/login
// @desc    Employee ERP login portal
router.post('/employee/login', loginEmployee);

// @route   POST /api/v1/auth/logout
// @desc    Logout and clear authentication cookie
router.post('/logout', (req, res) => {
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

// @route   GET /api/v1/auth/me
// @desc    Restore session from the authToken cookie / bearer token
router.get('/me', authMiddleware(), getMe);

// @route   PUT /api/v1/auth/profile
// @desc    Update user profile
router.put('/profile', authMiddleware(), updateProfile);

// @route   PUT /api/v1/auth/change-password
// @desc    Change user password
router.put('/change-password', authMiddleware(), changePassword);

module.exports = router;
