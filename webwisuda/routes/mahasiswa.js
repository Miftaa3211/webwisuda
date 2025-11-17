const express = require('express');
const router = express.Router();
const mahasiswaController = require('../controllers/mahasiswaController');

// Middleware to check if user is logged in as mahasiswa
const requireMahasiswa = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'mahasiswa') {
    req.flash('error_msg', 'Silakan login terlebih dahulu');
    return res.redirect('/');
  }
  next();
};

// Apply middleware to all routes
router.use(requireMahasiswa);

// Dashboard
router.get('/dashboard', mahasiswaController.dashboard);

// Upload berkas
router.get('/upload-berkas', mahasiswaController.showUploadBerkas);
router.post('/submit-pendaftaran', mahasiswaController.submitPendaftaran);

// Detail pendaftaran
router.get('/detail-pendaftaran', mahasiswaController.detailPendaftaran);

module.exports = router;
