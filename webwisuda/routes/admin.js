const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.flash('error_msg', 'Akses ditolak');
    return res.redirect('/');
  }
  next();
};

router.use(requireAdmin);
router.get('/dashboard', adminController.dashboard);

module.exports = router;
