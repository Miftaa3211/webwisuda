const express = require('express');
const router = express.Router();
const mahasiswaController = require('../controllers/mahasiswaController');

const requireMahasiswa = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'mahasiswa') {
    req.flash('error_msg', 'Silakan login');
    return res.redirect('/');
  }
  next();
};

router.use(requireMahasiswa);
router.get('/dashboard', mahasiswaController.dashboard);

module.exports = router;
