const express = require('express');
const {
  loginCustomer, loginEmployee, registerCustomer, getMe, updateProfile, changePassword,
  forgotPassword, verifyResetToken, resetPassword, getGoogleConfig, loginWithGoogle
} = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Takes the brute-force limiter as a param so it can be scoped to only the
// credential-guessing endpoints (login/register) — earlier this limiter was
// applied to the whole /api/v1/auth router, which also throttled `GET /me`
// (fired on every page load/refresh to restore the session) and locked
// active users out after a handful of navigations, not just failed logins.
module.exports = (authLimiter) => {
  const router = express.Router();

  // @route   POST /api/v1/auth/login
  // @desc    Customer login portal
  router.post('/login', authLimiter, loginCustomer);

  // @route   POST /api/v1/auth/register
  // @desc    Customer registration
  router.post('/register', authLimiter, registerCustomer);

  // @route   POST /api/v1/auth/employee/login
  // @desc    Employee ERP login portal
  router.post('/employee/login', authLimiter, loginEmployee);

  // @route   GET /api/v1/auth/google/config
  // @desc    Google OAuth client ID for the frontend's Google Identity Services button
  router.get('/google/config', getGoogleConfig);

  // @route   POST /api/v1/auth/google
  // @desc    Sign in / sign up a customer with a Google ID token
  router.post('/google', authLimiter, loginWithGoogle);

  // @route   POST /api/v1/auth/forgot-password
  // @desc    Email a one-time password-reset link
  router.post('/forgot-password', authLimiter, forgotPassword);

  // @route   GET /api/v1/auth/reset-password/verify
  // @desc    Check a reset token before showing the new-password form
  router.get('/reset-password/verify', authLimiter, verifyResetToken);

  // @route   POST /api/v1/auth/reset-password
  // @desc    Set a new password using the emailed reset token
  router.post('/reset-password', authLimiter, resetPassword);

  // @route   POST /api/v1/auth/logout
  // @desc    Logout and clear authentication cookie
  router.post('/logout', (req, res) => {
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    res.json({ success: true, message: 'Đã đăng xuất.' });
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

  return router;
};
