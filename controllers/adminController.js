const db = require('../config/database');

// =====================
// 1. Dashboard Admin
// =====================
exports.dashboard = async (req, res) => {
  res.redirect('/admin/monitoring');
};

// =====================
// 2. Monitoring Pendaftaran (IPK + Filter)
// =====================
exports.monitoring = async (req, res) => {
  try {
    const user = req.session.user;

    // === KODE MATA-MATA (DEBUGGING) ===
    console.log("==========================================");
    console.log("🔍 DEBUG MONITORING ADMIN");
    console.log("------------------------------------------");
    console.log("1. Admin Login  :", user.nama || user.email);
    console.log("2. Role         :", user.role);
    console.log("3. Scope (Area) :", `'${user.scope}'`);
    
    if (!user.scope) {
        console.log("⚠️ PERINGATAN: Scope kosong! Admin ini tidak punya wilayah kerja.");
    }
    // ===================================
    
    let query = `
      SELECT 
        p.id, p.tanggal_daftar, p.status AS status_verifikasi, p.catatan,
        m.nama, m.nim, m.prodi, m.jurusan, m.no_hp, m.ipk, 
        k.nama_kloter, k.tanggal_wisuda,
        (SELECT COUNT(*) FROM dokumen_wisuda d WHERE d.pendaftaran_id = p.id) AS jumlah_dokumen,
        (SELECT COUNT(*) FROM dokumen_wisuda d WHERE d.pendaftaran_id = p.id AND d.status = 'Lengkap') AS dokumen_lengkap
      FROM pendaftaran_wisuda p
      JOIN mahasiswa m ON p.mahasiswa_id = m.id
      LEFT JOIN kloter_wisuda k ON p.kloter_id = k.id
    `;

    const params = [];

    // Filter Mahasiswa berdasarkan Scope Admin
    if (user.role === 'admin_jurusan') {
      console.log("4. Query Filter : Jurusan LIKE %" + user.scope + "%");
      query += ` WHERE m.jurusan LIKE ?`;
      params.push(`%${user.scope}%`); 
    } 
    else if (user.role === 'admin_prodi') {
      console.log("4. Query Filter : Prodi LIKE %" + user.scope + "%");
      query += ` WHERE m.prodi LIKE ?`;
      params.push(`%${user.scope}%`);
    } else {
      console.log("4. Query Filter : TIDAK ADA (Admin Pusat/Lab)");
    }
    console.log("==========================================");

    query += ` ORDER BY p.created_at DESC`;

    const [pendaftaran] = await db.query(query, params);

    const data = pendaftaran.map(p => ({
      ...p,
      status_berkas: (p.jumlah_dokumen > 0 && p.jumlah_dokumen === p.dokumen_lengkap) ? 'Lengkap' : 'Belum Lengkap'
    }));

    res.render('dashboard_admin', {
      title: 'Monitoring ' + (user.scope || 'Pusat'),
      pendaftaran: data,
      user: user
    });

  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Gagal memuat data monitoring');
    res.redirect('/');
  }
};

// =====================
// 3. Detail Pendaftaran
// =====================
exports.detailPendaftaran = async (req, res) => {
  try {
    const pendaftaranId = req.params.id;
    const user = req.session.user;

    const [pendaftaran] = await db.query(`
      SELECT 
        p.*, m.nama, m.nim, m.prodi, m.jurusan, m.no_hp, u.email AS user_email,
        k.nama_kloter, k.tanggal_wisuda
      FROM pendaftaran_wisuda p
      JOIN mahasiswa m ON p.mahasiswa_id = m.id
      JOIN users u ON m.user_id = u.id
      LEFT JOIN kloter_wisuda k ON p.kloter_id = k.id
      WHERE p.id = ?
    `, [pendaftaranId]);

    if (pendaftaran.length === 0) {
      req.flash('error_msg', 'Data tidak ditemukan');
      return res.redirect('/admin/monitoring');
    }

    // FILTER DOKUMEN
    let queryDokumen = 'SELECT * FROM dokumen_wisuda WHERE pendaftaran_id = ?';
    let paramsDokumen = [pendaftaranId];

    if (user.role === 'admin_jurusan') {
        queryDokumen += " AND jenis_dokumen = 'Bebas_Tanggungan'";
    } else if (user.role === 'admin_prodi') {
        queryDokumen += " AND jenis_dokumen = 'Cover_TA'";
    } else if (user.role === 'admin_labbahasa') {
        queryDokumen += " AND jenis_dokumen = 'TOEIC'";
    }
    
    queryDokumen += ' ORDER BY jenis_dokumen';
    const [dokumen] = await db.query(queryDokumen, paramsDokumen);

    res.render('detail_pendaftaran_admin', {
      title: 'Detail Pendaftaran Wisuda',
      pendaftaran: pendaftaran[0],
      dokumen,
      user: req.session.user
    });

  } catch (error) {
    console.error('Error:', error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/admin/monitoring');
  }
};

// =====================
// 4. Update Status Pendaftaran
// =====================
exports.updateStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status, catatan } = req.body;

    if (req.session.user.role !== 'admin') {
        req.flash('error_msg', 'Akses ditolak.');
        return res.redirect('/admin/detail/' + id);
    }

    await db.query(
      `UPDATE pendaftaran_wisuda SET status = ?, catatan = ?, verified_by = ?, verified_at = NOW() WHERE id = ?`,
      [status, catatan || null, req.session.user.id, id]
    );

    req.flash('success_msg', 'Status berhasil diperbarui');
    res.redirect('/admin/detail/' + id);
  } catch (error) {
    console.error(error);
    res.redirect('/admin/detail/' + req.params.id);
  }
};

// =====================
// 5. Update Status Dokumen
// =====================
exports.updateDokumen = async (req, res) => {
  try {
    const dokumenId = req.params.id;
    let { status, catatan } = req.body;
    const user = req.session.user;

    const [docCheck] = await db.query('SELECT jenis_dokumen, pendaftaran_id FROM dokumen_wisuda WHERE id = ?', [dokumenId]);
    if (docCheck.length === 0) return res.redirect('/admin/monitoring');

    const jenisDokumen = docCheck[0].jenis_dokumen; 
    const pendaftaranId = docCheck[0].pendaftaran_id;

    if (user.role === 'admin') {
        if (['TOEIC', 'Bebas_Tanggungan', 'Cover_TA'].includes(jenisDokumen)) {
            req.flash('error_msg', 'Admin Pusat hanya berhak melihat dokumen ini.');
            return res.redirect('/admin/detail/' + pendaftaranId);
        }
    }
    if (user.role === 'admin_jurusan' && jenisDokumen !== 'Bebas_Tanggungan') {
        req.flash('error_msg', 'Akses Ditolak.'); return res.redirect('/admin/detail/' + pendaftaranId);
    } 
    if (user.role === 'admin_prodi' && jenisDokumen !== 'Cover_TA') {
        req.flash('error_msg', 'Akses Ditolak.'); return res.redirect('/admin/detail/' + pendaftaranId);
    }
    if (user.role === 'admin_labbahasa' && jenisDokumen !== 'TOEIC') {
        req.flash('error_msg', 'Akses Ditolak.'); return res.redirect('/admin/detail/' + pendaftaranId);
    }

    if (status === 'Ditolak' && !catatan) catatan = 'Dokumen tidak valid.';
    if (status === 'Lengkap') catatan = null;

    await db.query(`UPDATE dokumen_wisuda SET status = ?, catatan = ? WHERE id = ?`, [status, catatan, dokumenId]);
    req.flash('success_msg', `Dokumen berhasil diverifikasi.`);
    res.redirect('/admin/detail/' + pendaftaranId);

  } catch (error) {
    console.error(error);
    res.redirect('/admin/monitoring');
  }
};

// =====================
// 6. Export & Print
// =====================
exports.exportData = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT m.nama, m.nim, m.prodi, m.jurusan, m.no_hp, p.tanggal_daftar, p.status, k.nama_kloter 
      FROM pendaftaran_wisuda p
      JOIN mahasiswa m ON p.mahasiswa_id = m.id
      LEFT JOIN kloter_wisuda k ON p.kloter_id = k.id
      ORDER BY p.created_at DESC
    `);
    
    let csv = 'Nama,NPM,Prodi,Jurusan,HP,Tanggal,Status,Kloter\n';
    rows.forEach(r => {
      csv += `"${r.nama}","${r.nim}","${r.prodi}","${r.jurusan}","${r.no_hp}","${r.tanggal_daftar}","${r.status}","${r.nama_kloter || '-'}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=pendaftaran.csv');
    res.send(csv);
  } catch (error) { res.redirect('/admin/monitoring'); }
};

exports.cetakDetailPendaftaran = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, m.nama, m.nim, m.prodi, m.jurusan, m.no_hp, u.email AS user_email, k.nama_kloter
      FROM pendaftaran_wisuda p
      JOIN mahasiswa m ON p.mahasiswa_id = m.id
      JOIN users u ON m.user_id = u.id
      LEFT JOIN kloter_wisuda k ON p.kloter_id = k.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (rows.length === 0) return res.status(404).send('Data tidak ditemukan');
    const [dokumen] = await db.query('SELECT * FROM dokumen_wisuda WHERE pendaftaran_id = ?', [req.params.id]);

    res.render('cetak_detail_admin', { pendaftaran: rows[0], dokumen });
  } catch (error) { res.status(500).send('Error'); }
};

exports.bantuan = (req, res) => {
  res.render('bantuan_admin', { title: 'Bantuan', user: req.session.user });
};

// =====================
// PENGATURAN & KLOTER
// =====================
// FUNGSI INI YANG HILANG SEBELUMNYA (SANGAT PENTING!)
exports.halamanPengaturan = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM pengaturan_wisuda LIMIT 1');
    let setting = rows.length > 0 ? rows[0] : {};
    
    const [kloters] = await db.query(`
      SELECT k.*, (SELECT COUNT(*) FROM pendaftaran_wisuda p WHERE p.kloter_id = k.id) as terisi 
      FROM kloter_wisuda k ORDER BY k.urutan ASC
    `);
    
    const safeFormatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return ''; 
        return d.toISOString().split('T')[0];
    };

    kloters.forEach(k => {
        k.tanggal_fmt = safeFormatDate(k.tanggal_wisuda);
        k.buka_fmt = safeFormatDate(k.tanggal_buka);   
        k.tutup_fmt = safeFormatDate(k.tanggal_tutup); 
    });

    res.render('pengaturan_admin', {
      title: 'Pengaturan Wisuda',
      setting, kloters, user: req.session.user
    });
  } catch (error) {
    console.error("Error Halaman Pengaturan:", error);
    res.redirect('/admin/dashboard');
  }
};

exports.updatePengaturan = async (req, res) => {
  try {
    const { lokasi, periode_wisuda, pesan_info } = req.body;
    await db.query(`UPDATE pengaturan_wisuda SET lokasi=?, periode_wisuda=?, pesan_info=? WHERE id=1`, 
      [lokasi, periode_wisuda, pesan_info || null]);
    req.flash('success_msg', 'Pengaturan umum disimpan');
    res.redirect('/admin/pengaturan');
  } catch (error) { res.redirect('/admin/pengaturan'); }
};

exports.addKloter = async (req, res) => {
  try {
    const { nama_kloter, tanggal_wisuda, tanggal_buka, tanggal_tutup, kuota_maksimal, urutan } = req.body;
    await db.query(
      'INSERT INTO kloter_wisuda (nama_kloter, tanggal_wisuda, tanggal_buka, tanggal_tutup, kuota_maksimal, urutan) VALUES (?, ?, ?, ?, ?, ?)',
      [nama_kloter, tanggal_wisuda, tanggal_buka, tanggal_tutup, kuota_maksimal, urutan]
    );
    req.flash('success_msg', 'Kloter ditambahkan'); res.redirect('/admin/pengaturan');
  } catch (error) { res.redirect('/admin/pengaturan'); }
};

exports.updateKloter = async (req, res) => {
  try {
    let { id, nama_kloter, tanggal_wisuda, tanggal_buka, tanggal_tutup, kuota_maksimal, is_active } = req.body;
    const activeStatus = is_active ? 1 : 0;
    await db.query(
      `UPDATE kloter_wisuda SET nama_kloter=?, tanggal_wisuda=?, tanggal_buka=?, tanggal_tutup=?, kuota_maksimal=?, is_active=? WHERE id=?`,
      [nama_kloter, tanggal_wisuda, tanggal_buka, tanggal_tutup, kuota_maksimal, activeStatus, id]
    );
    req.flash('success_msg', 'Kloter diperbarui'); res.redirect('/admin/pengaturan');
  } catch (error) { res.redirect('/admin/pengaturan'); }
};

exports.deleteKloter = async (req, res) => {
    try {
        const { id } = req.body;
        const [cek] = await db.query('SELECT id FROM pendaftaran_wisuda WHERE kloter_id = ?', [id]);
        if(cek.length > 0) { req.flash('error_msg', 'Gagal: Kloter ada pendaftar!'); return res.redirect('/admin/pengaturan'); }
        await db.query('DELETE FROM kloter_wisuda WHERE id = ?', [id]);
        req.flash('success_msg', 'Kloter dihapus'); res.redirect('/admin/pengaturan');
    } catch (error) { res.redirect('/admin/pengaturan'); }
};