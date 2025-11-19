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

// Dashboard & Monitoring
router.get('/dashboard', adminController.dashboard);
router.get('/monitoring', adminController.monitoring);

// Detail & Verification
router.get('/detail/:id', adminController.detailPendaftaran);
router.post('/update-status/:id', adminController.updateStatus);
router.post('/update-dokumen/:id', adminController.updateDokumen);

// Export
router.get('/export', adminController.exportData);
router.get('/cetak-detail/:id', adminController.cetakDetailPendaftaran);
// Bantuan Page
router.get('/bantuan', adminController.bantuan);

module.exports = router;
