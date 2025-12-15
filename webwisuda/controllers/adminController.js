const db = require('../config/database');

// Dashboard Admin
exports.dashboard = async (req, res) => {
  res.redirect('/admin/monitoring');
};

// Monitoring Pendaftaran (Disesuaikan dengan Role)
exports.monitoring = async (req, res) => {
  try {
    const user = req.session.user; // Ambil data user dari session
    let queryParams = [];
    
    // 1. Query Dasar
    let query = `
      SELECT 
        p.id,
        p.tanggal_daftar,
        p.status AS status_verifikasi,
        p.catatan,
        m.nama,
        m.nim,
        m.prodi,
        m.jurusan,
        m.no_hp,
        (SELECT COUNT(*) FROM dokumen_wisuda d WHERE d.pendaftaran_id = p.id) AS jumlah_dokumen,
        (SELECT COUNT(*) FROM dokumen_wisuda d WHERE d.pendaftaran_id = p.id AND d.status = 'Lengkap') AS dokumen_lengkap
      FROM pendaftaran_wisuda p
      JOIN mahasiswa m ON p.mahasiswa_id = m.id
    `;

    // 2. Filter Berdasarkan Role
    if (user.role === 'admin_prodi') {
      query += ` WHERE m.prodi = ?`;
      queryParams.push(user.prodi);
    } else if (user.role === 'admin_jurusan') {
      query += ` WHERE m.jurusan = ?`;
      queryParams.push(user.jurusan);
    } 
    // Admin Toic & Super Admin tidak kena filter (melihat semua)

    // 3. Order By
    query += ` ORDER BY p.created_at DESC`;

    // Eksekusi Query
    const [pendaftaran] = await db.query(query, queryParams);

    // Mapping Status Berkas
    const data = pendaftaran.map(p => ({
      ...p,
      status_berkas: (p.jumlah_dokumen > 0 && p.jumlah_dokumen === p.dokumen_lengkap)
        ? 'Lengkap'
        : 'Belum Lengkap'
    }));

    res.render('dashboard_admin', {
      title: 'Monitoring Pendaftaran Wisuda',
      pendaftaran: data,
      user: req.session.user // Kirim data user untuk Navbar
    });

  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Gagal memuat data monitoring');
    res.redirect('/');
  }
};

// Detail Pendaftaran (Dengan Keamanan Role)
exports.detailPendaftaran = async (req, res) => {
  try {
    const pendaftaranId = req.params.id;
    const user = req.session.user;

    // Ambil data pendaftaran + info mahasiswa
    const [pendaftaran] = await db.query(`
      SELECT 
        p.*,
        m.nama, m.nim, m.prodi, m.jurusan, m.no_hp,
        u.email AS user_email
      FROM pendaftaran_wisuda p
      JOIN mahasiswa m ON p.mahasiswa_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE p.id = ?
    `, [pendaftaranId]);

    if (pendaftaran.length === 0) {
      req.flash('error_msg', 'Data pendaftaran tidak ditemukan');
      return res.redirect('/admin/monitoring');
    }

    const dataMhs = pendaftaran[0];

    // --- SECURITY CHECK ---
    // Cegah Admin Prodi A melihat data Mahasiswa Prodi B lewat URL
    if (user.role === 'admin_prodi' && dataMhs.prodi !== user.prodi) {
      req.flash('error_msg', 'Anda tidak memiliki akses ke data prodi lain.');
      return res.redirect('/admin/monitoring');
    }
    
    if (user.role === 'admin_jurusan' && dataMhs.jurusan !== user.jurusan) {
      req.flash('error_msg', 'Anda tidak memiliki akses ke data jurusan lain.');
      return res.redirect('/admin/monitoring');
    }
    // ----------------------

    const [dokumen] = await db.query(`
      SELECT * FROM dokumen_wisuda 
      WHERE pendaftaran_id = ?
      ORDER BY jenis_dokumen
    `, [pendaftaranId]);

    res.render('detail_pendaftaran_admin', {
      title: 'Detail Pendaftaran Wisuda',
      pendaftaran: dataMhs,
      dokumen,
      user: req.session.user
    });

  } catch (error) {
    console.error('Error:', error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/admin/monitoring');
  }
};

// Update Status Pendaftaran
exports.updateStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status, catatan } = req.body;

    // Opsional: Anda bisa membatasi admin toic agar tidak bisa mengubah status kelulusan akhir
    // if (req.session.user.role === 'admin_toic') { ... }

    await db.query(
      `UPDATE pendaftaran_wisuda 
       SET status = ?, catatan = ?, verified_by = ?, verified_at = NOW() 
       WHERE id = ?`,
      [status, catatan || null, req.session.user.id, id]
    );

    req.flash('success_msg', 'Status berhasil diperbarui');
    res.redirect('/admin/detail/' + id);

  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Gagal memperbarui status');
    res.redirect('/admin/detail/' + req.params.id);
  }
};

// Update Status Dokumen
exports.updateDokumen = async (req, res) => {
  try {
    const dokumenId = req.params.id;
    let { status, catatan } = req.body; 

    if (status === 'Ditolak' && !catatan) {
      catatan = 'Dokumen tidak valid atau buram. Mohon unggah ulang.';
    }

    if (status === 'Lengkap') {
      catatan = null;
    }

    await db.query(`
      UPDATE dokumen_wisuda 
      SET status = ?, catatan = ?
      WHERE id = ?
    `, [status, catatan, dokumenId]);

    const [row] = await db.query(`
      SELECT pendaftaran_id FROM dokumen_wisuda WHERE id = ?
    `, [dokumenId]);

    if (row.length > 0) {
      req.flash('success_msg', `Dokumen berhasil diubah menjadi ${status}`);
      res.redirect('/admin/detail/' + row[0].pendaftaran_id);
    } else {
      res.redirect('/admin/monitoring');
    }

  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Gagal update dokumen');
    res.redirect('/admin/monitoring');
  }
};

// Export Data (Disesuaikan dengan Role)
exports.exportData = async (req, res) => {
  try {
    const user = req.session.user;
    let queryParams = [];

    // Base Query
    let query = `
      SELECT 
        m.nama, m.nim, m.prodi, m.jurusan, m.no_hp,
        p.tanggal_daftar, p.status,
        (SELECT COUNT(*) FROM dokumen_wisuda d WHERE d.pendaftaran_id = p.id) AS jumlah_dokumen
      FROM pendaftaran_wisuda p
      JOIN mahasiswa m ON p.mahasiswa_id = m.id
    `;

    // Filter Berdasarkan Role
    if (user.role === 'admin_prodi') {
      query += ` WHERE m.prodi = ?`;
      queryParams.push(user.prodi);
    } else if (user.role === 'admin_jurusan') {
      query += ` WHERE m.jurusan = ?`;
      queryParams.push(user.jurusan);
    }
    
    query += ` ORDER BY p.created_at DESC`;

    const [rows] = await db.query(query, queryParams);

    let csv = 'Nama,NIM,Program Studi,Jurusan,No HP,Tanggal Daftar,Status,Jumlah Dokumen\n';
    rows.forEach(r => {
      csv += `"${r.nama}","${r.nim}","${r.prodi}","${r.jurusan}","${r.no_hp}","${r.tanggal_daftar}","${r.status}","${r.jumlah_dokumen}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=pendaftaran_wisuda.csv');
    res.send(csv);

  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Gagal export data');
    res.redirect('/admin/monitoring');
  }
};

// Bantuan Page
exports.bantuan = (req, res) => {
  res.render('bantuan_admin', {
    title: 'Bantuan',
    user: req.session.user
  });
};

// Cetak Detail (Dengan Keamanan Role)
exports.cetakDetailPendaftaran = async (req, res) => {
  try {
    const pendaftaranId = req.params.id;
    const user = req.session.user;

    const [rows] = await db.query(`
      SELECT 
        p.*,
        m.nama, m.nim, m.prodi, m.jurusan, m.no_hp,
        u.email AS user_email
      FROM pendaftaran_wisuda p
      JOIN mahasiswa m ON p.mahasiswa_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE p.id = ?
    `, [pendaftaranId]);

    if (rows.length === 0) {
      return res.status(404).send('Data tidak ditemukan');
    }

    const dataMhs = rows[0];

    // --- SECURITY CHECK (Sama seperti detail) ---
    if (user.role === 'admin_prodi' && dataMhs.prodi !== user.prodi) {
      return res.status(403).send('Akses Ditolak: Bukan Prodi Anda');
    }
    if (user.role === 'admin_jurusan' && dataMhs.jurusan !== user.jurusan) {
      return res.status(403).send('Akses Ditolak: Bukan Jurusan Anda');
    }
    // ---------------------------------------------

    const [dokumen] = await db.query(`
      SELECT * FROM dokumen_wisuda 
      WHERE pendaftaran_id = ?
    `, [pendaftaranId]);

    res.render('cetak_detail_admin', {
      pendaftaran: dataMhs,
      dokumen: dokumen
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Terjadi kesalahan server');
  }
};
