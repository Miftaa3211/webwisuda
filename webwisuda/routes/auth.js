// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ============================================
// REGISTRATION ROUTES
// ============================================
router.get('/register', (req, res) => {
  res.render('register', {
    error_msg: req.flash('error_msg') || ''
  });
});

router.post('/register', authController.register);

// ============================================
// LOGIN & LOGOUT ROUTES
// ============================================
router.get('/login', (req, res) => {
  res.render('login', {
    error_msg: req.flash('error_msg') || '',
    success_msg: req.flash('success_msg') || ''
  });
});

router.post('/login', authController.login);
router.get('/logout', authController.logout);

// ============================================
// FORGOT PASSWORD ROUTES
// ============================================
router.post('/forgot-password', authController.forgotPassword);

// ============================================
// RESET PASSWORD ROUTES
// ============================================
router.get('/reset-password/:token', authController.showResetPasswordForm);
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router; 