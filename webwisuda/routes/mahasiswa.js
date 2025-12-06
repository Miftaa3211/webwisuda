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
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/profile') 
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});


const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Hanya file gambar (JPG/PNG) yang diperbolehkan!'));
  }
});


const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
};
router.use(requireMahasiswa);

router.get('/dashboard', mahasiswaController.dashboard);
router.get('/edit-profile', mahasiswaController.editProfile);
router.post('/update-profile', upload.single('foto_profil'), mahasiswaController.updateProfile);
router.post('/delete-profile-photo', mahasiswaController.deleteProfilePhoto);
router.get('/upload-berkas', mahasiswaController.showUploadBerkas);
router.post('/submit-pendaftaran', mahasiswaController.submitPendaftaran);
router.get('/detail-pendaftaran', mahasiswaController.detailPendaftaran);
router.get('/riwayat', mahasiswaController.riwayatPendaftaran);
router.get('/cetak-bukti', mahasiswaController.cetakBukti);


router.get('/preview/:id', mahasiswaController.previewFile);


// Hapus dokumen
router.post('/hapus-berkas/:id', async (req, res) => {
  const db = require('../config/database');
  const dokumenId = req.params.id;

  try {
    await db.query(`
      UPDATE dokumen_pendaftaran
      SET nama_file = NULL, path_file = NULL, status = 'Belum Upload', catatan_admin = NULL
      WHERE id = ?
    `, [dokumenId]);

    req.flash('success_msg', 'Berkas berhasil dihapus.');
    res.redirect('/mahasiswa/upload-berkas');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Gagal menghapus berkas.');
    res.redirect('/mahasiswa/upload-berkas');
  }
});


module.exports = router;
