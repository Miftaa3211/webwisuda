const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// =====================
// DEFINISI RUTE PUBLIC
// =====================

// 1. Halaman Home
router.get('/', publicController.index);

// 2. Halaman Informasi
router.get('/informasi', publicController.informasi);

// 3. Halaman Statistik
router.get('/statistik', publicController.statistik);

// 4a. Halaman Daftar IPK (Tabel)
router.get('/daftar-ipk', publicController.daftarIPK);

// 4b. Halaman Mahasiswa Terbaik per Jenjang (Card)
router.get('/ipk-tertinggi-jenjang', publicController.ipkPerJenjang);

// 5. Halaman Tentang
router.get('/tentang', publicController.tentang);

// [BARU] 6. Halaman Calon Wisudawan (Per Kloter)
router.get('/calon-wisudawan', publicController.calonWisudawan);

module.exports = router;