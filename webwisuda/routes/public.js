const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// 1. Halaman Home (Landing Page)
router.get('/', publicController.index);

// 2. Halaman Informasi (Alur & Syarat)
router.get('/informasi', publicController.informasi);

// 3. Halaman Statistik (Chart & Data Kelulusan)
router.get('/statistik', publicController.statistik);

// 4. Halaman Daftar IPK (Tabel Mahasiswa)
router.get('/daftar-ipk', publicController.daftarIPK);

// 5.  Halaman Tentang
router.get('/tentang', publicController.tentang);

module.exports = router;
