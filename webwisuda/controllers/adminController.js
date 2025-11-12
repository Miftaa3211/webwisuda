const db = require('../config/database');

exports.dashboard = async (req, res) => {
  try {
    const [totalPendaftar] = await db.query('SELECT COUNT(*) as total FROM pendaftaran_wisuda');
    
    res.render('dashboard_admin', {
      title: 'Dashboard Admin',
      stats: { total: totalPendaftar[0].total }
    });
  } catch (error) {
    console.error('Error:', error);
    res.redirect('/');
  }
};
