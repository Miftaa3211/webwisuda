const db = require('../config/database');

exports.dashboard = async (req, res) => {
  try {
    const [mahasiswa] = await db.query('SELECT * FROM mahasiswa WHERE user_id = ?', [req.session.user.id]);
    
    if (mahasiswa.length === 0) {
      req.flash('error_msg', 'Data tidak ditemukan');
      return res.redirect('/');
    }
    
    const [pendaftaran] = await db.query('SELECT * FROM pendaftaran_wisuda WHERE mahasiswa_id = ?', [mahasiswa[0].id]);
    
    res.render('dashboard_mahasiswa', {
      title: 'Dashboard Mahasiswa',
      mahasiswa: mahasiswa[0],
      pendaftaran: pendaftaran.length > 0 ? pendaftaran[0] : null
    });
  } catch (error) {
    console.error('Error:', error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/');
  }
};
