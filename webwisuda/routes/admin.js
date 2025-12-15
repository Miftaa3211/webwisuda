const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// --- MIDDLEWARE KHUSUS ADMIN ---
// Fungsi ini mengecek apakah user yang login punya akses admin
const requireAdmin = (req, res, next) => {
  // 1. Cek apakah ada session user
  if (!req.session.user) {
    return res.redirect('/');
  }

  // 2. Cek apakah role mengandung kata 'admin'
  // Ini akan mengizinkan: 'admin', 'admin_prodi', 'admin_jurusan', 'super_admin', 'admin_toic'
  if (req.session.user.role && req.session.user.role.includes('admin')) {
    return next(); // Boleh masuk
  }

  // 3. Jika bukan admin (misal mahasiswa), tolak
  req.flash('error_msg', 'Akses ditolak! Anda bukan Admin.');
  return res.redirect('/');
};

// Terapkan middleware ini ke semua route di bawahnya
router.use(requireAdmin);

// --- ROUTES ---

// Dashboard & Monitoring
router.get('/dashboard', adminController.dashboard);
router.get('/monitoring', adminController.monitoring);

// Detail & Verification
router.get('/detail/:id', adminController.detailPendaftaran);
router.post('/update-status/:id', adminController.updateStatus);
router.post('/update-dokumen/:id', adminController.updateDokumen);

// Export & Cetak
router.get('/export', adminController.exportData);
router.get('/cetak-detail/:id', adminController.cetakDetailPendaftaran);

// Bantuan Page
router.get('/bantuan', adminController.bantuan);

module.exports = router;
