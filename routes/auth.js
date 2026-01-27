const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ================= REGISTER =================
router.get('/register', authController.showRegister);
router.post('/register', authController.register);

// ================= LOGIN =================
router.get('/login', (req, res) => {
  res.render('login', {
    title: 'Login - Wisuda Polinela', 
    error_msg: req.flash('error_msg'),
    success_msg: req.flash('success_msg')
  });
});

router.post('/login', authController.login);
router.get('/check-npm/:npm', authController.checkNPM);
// ================= LOGOUT =================
router.get('/logout', authController.logout);

// ================= PASSWORD =================
router.post('/forgot-password', authController.forgotPassword);
router.get('/reset-password/:token', authController.showResetPasswordForm);
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;
