const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// ==========================================
// MIDDLEWARE CEK LOGIN & HAK AKSES
// ==========================================
const requireAdmin = (req, res, next) => {
  const user = req.session.user;
  
  // PERBAIKAN DISINI: Tambahkan 'admin_labbahasa' ke dalam daftar
  if (!user || !['admin', 'admin_jurusan', 'admin_prodi', 'admin_labbahasa'].includes(user.role)) {
    req.flash('error_msg', 'Akses ditolak. Role Anda tidak dikenali.');
    return res.redirect('/');
  }
  next();
};

// Terapkan middleware
router.use(requireAdmin);

// ... (Sisa kode router ke bawah TETAP SAMA seperti sebelumnya)
// ==============================
// 1. DASHBOARD & MONITORING
// ==============================
router.get('/dashboard', adminController.dashboard);
router.get('/monitoring', adminController.monitoring);

// ==============================
// 2. FITUR PENGATURAN
// ==============================
router.get('/pengaturan', adminController.halamanPengaturan);
router.post('/pengaturan/update', adminController.updatePengaturan);

router.post('/kloter/add', adminController.addKloter);
router.post('/kloter/update', adminController.updateKloter);
router.post('/kloter/delete', adminController.deleteKloter);

// ==============================
// 3. DETAIL & VERIFIKASI
// ==============================
router.get('/detail/:id', adminController.detailPendaftaran);
router.post('/update-status/:id', adminController.updateStatus);
router.post('/update-dokumen/:id', adminController.updateDokumen);

// ==============================
// 4. EXPORT & CETAK
// ==============================
router.get('/export', adminController.exportData);
router.get('/cetak-detail/:id', adminController.cetakDetailPendaftaran);

// ==============================
// 5. BANTUAN
// ==============================
router.get('/bantuan', adminController.bantuan);

module.exports = router;