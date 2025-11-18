const express = require('express');
const router = express.Router();
const mahasiswaController = require('../controllers/mahasiswaController');

const requireMahasiswa = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'mahasiswa') {
    req.flash('error_msg', 'Silakan login terlebih dahulu');
    return res.redirect('/');
  }
  next();
};

router.use(requireMahasiswa);

router.get('/dashboard', mahasiswaController.dashboard);
router.get('/upload-berkas', mahasiswaController.showUploadBerkas);
router.post('/submit-pendaftaran', mahasiswaController.submitPendaftaran);
router.get('/detail-pendaftaran', mahasiswaController.detailPendaftaran);
router.get('/riwayat', mahasiswaController.riwayatPendaftaran); // ← TAMBAHKAN INI

module.exports = router;
