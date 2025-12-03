const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Hanya file JPG, PNG, atau PDF yang diperbolehkan'));
    }
  }
}).fields([
  { name: 'ktp', maxCount: 1 },
  { name: 'kk', maxCount: 1 },
  { name: 'ktm', maxCount: 1 },
  { name: 'transkrip', maxCount: 1 },
  { name: 'foto', maxCount: 1 },
  { name: 'toeic', maxCount: 1 },
  { name: 'bebas_tanggungan', maxCount: 1 },
  { name: 'cover_ta', maxCount: 1 }
]);

// 1. Dashboard Mahasiswa
exports.dashboard = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const [mahasiswa] = await db.query(
      'SELECT * FROM mahasiswa WHERE user_id = ?',
      [userId]
    );
    
    if (mahasiswa.length === 0) {
      req.flash('error_msg', 'Data mahasiswa tidak ditemukan');
      return res.redirect('/');
    }
    
    const [pendaftaran] = await db.query(
      'SELECT * FROM pendaftaran_wisuda WHERE mahasiswa_id = ?',
      [mahasiswa[0].id]
    );
    
    res.render('dashboard_mahasiswa', {
      title: 'Dashboard Mahasiswa',
      mahasiswa: mahasiswa[0],
      pendaftaran: pendaftaran.length > 0 ? pendaftaran[0] : null,
      user: req.session.user
    });
    
  } catch (error) {
    console.error('Error:', error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/');
  }
};

// 2. Show Upload Berkas (Dengan Logika Smart Check)
exports.showUploadBerkas = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const [mahasiswa] = await db.query(
      'SELECT * FROM mahasiswa WHERE user_id = ?',
      [userId]
    );
    
    if (mahasiswa.length === 0) {
      req.flash('error_msg', 'Data mahasiswa tidak ditemukan');
      return res.redirect('/mahasiswa/dashboard');
    }
    
    const [existingPendaftaran] = await db.query(
      'SELECT * FROM pendaftaran_wisuda WHERE mahasiswa_id = ?',
      [mahasiswa[0].id]
    );

    // [PENTING] Ambil data dokumen untuk dikirim ke View
    let dokumenMap = {};
    if (existingPendaftaran.length > 0) {
      const [dokumenList] = await db.query(
        'SELECT * FROM dokumen_wisuda WHERE pendaftaran_id = ?',
        [existingPendaftaran[0].id]
      );
      dokumenList.forEach(doc => {
        dokumenMap[doc.jenis_dokumen] = doc;
      });
    }
    
    res.render('upload_berkas', {
      title: 'Upload Berkas Wisuda',
      mahasiswa: mahasiswa[0],
      pendaftaran: existingPendaftaran.length > 0 ? existingPendaftaran[0] : null,
      dokumen: dokumenMap // Data dokumen dikirim ke EJS
    });
    
  } catch (error) {
    console.error('Error:', error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/mahasiswa/dashboard');
  }
};

// 3. Submit Pendaftaran (Dengan Logika Status "Diajukan")
exports.submitPendaftaran = (req, res) => {
  upload(req, res, async function(err) {
    if (err instanceof multer.MulterError) {
      console.error('Multer Error:', err);
      req.flash('error_msg', 'Error upload: ' + err.message);
      return res.redirect('/mahasiswa/upload-berkas');
    } else if (err) {
      console.error('Upload Error:', err);
      req.flash('error_msg', err.message || 'Gagal mengupload file');
      return res.redirect('/mahasiswa/upload-berkas');
    }
    
    try {
      const userId = req.session.user.id;
      
      const [mahasiswa] = await db.query(
        'SELECT id FROM mahasiswa WHERE user_id = ?',
        [userId]
      );
      
      if (mahasiswa.length === 0) {
        req.flash('error_msg', 'Data mahasiswa tidak ditemukan');
        return res.redirect('/mahasiswa/dashboard');
      }
      
      const mahasiswaId = mahasiswa[0].id;
      
      if (!req.files || Object.keys(req.files).length === 0) {
        req.flash('error_msg', 'Tidak ada file yang dipilih');
        return res.redirect('/mahasiswa/upload-berkas');
      }
      
      // Cek pendaftaran
      const [existingPendaftaran] = await db.query(
        'SELECT id FROM pendaftaran_wisuda WHERE mahasiswa_id = ?',
        [mahasiswaId]
      );
      
      let pendaftaranId;
      
      if (existingPendaftaran.length > 0) {
        pendaftaranId = existingPendaftaran[0].id;
        // Reset status pendaftaran utama jadi "Diajukan"
        await db.query(
          'UPDATE pendaftaran_wisuda SET status = "Diajukan", tanggal_daftar = CURDATE() WHERE id = ?',
          [pendaftaranId]
        );
      } else {
        const [pendaftaranResult] = await db.query(
          'INSERT INTO pendaftaran_wisuda (mahasiswa_id, tanggal_daftar, status) VALUES (?, CURDATE(), "Diajukan")',
          [mahasiswaId]
        );
        pendaftaranId = pendaftaranResult.insertId;
      }
      
      const fileFields = ['ktp', 'kk', 'ktm', 'transkrip', 'foto', 'toeic', 'bebas_tanggungan', 'cover_ta'];
      const dokumenMap = {
        'ktp': 'KTP', 'kk': 'KK', 'ktm': 'KTM', 'transkrip': 'Transkrip',
        'foto': 'Foto', 'toeic': 'TOEIC', 'bebas_tanggungan': 'Bebas_Tanggungan', 'cover_ta': 'Cover_TA'
      };
      
      let uploadedCount = 0;
      
      for (const field of fileFields) {
        if (req.files[field] && req.files[field][0]) {
          const file = req.files[field][0];
          
          const [existing] = await db.query(
            'SELECT id FROM dokumen_wisuda WHERE pendaftaran_id = ? AND jenis_dokumen = ?',
            [pendaftaranId, dokumenMap[field]]
          );
          
          if (existing.length > 0) {
            // [LOGIKA STATUS KUNING] Update jadi "Diajukan" agar admin cek ulang
            await db.query(
              'UPDATE dokumen_wisuda SET nama_file = ?, path_file = ?, status = "Diajukan", catatan = NULL, uploaded_at = NOW() WHERE id = ?',
              [file.originalname, file.filename, existing[0].id]
            );
          } else {
            // Insert baru dengan status "Diajukan"
            await db.query(
              'INSERT INTO dokumen_wisuda (pendaftaran_id, jenis_dokumen, nama_file, path_file, status) VALUES (?, ?, ?, ?, "Diajukan")',
              [pendaftaranId, dokumenMap[field], file.originalname, file.filename]
            );
          }
          uploadedCount++;
        }
      }
      
      if (uploadedCount === 0) {
        req.flash('error_msg', 'Tidak ada dokumen yang berhasil diupload');
        return res.redirect('/mahasiswa/upload-berkas');
      }
      
      req.flash('success_msg', `Berhasil! ${uploadedCount} dokumen telah diunggah dan menunggu verifikasi.`);
      res.redirect('/mahasiswa/dashboard');
      
    } catch (error) {
      console.error('Database Error:', error);
      req.flash('error_msg', 'Terjadi kesalahan: ' + error.message);
      res.redirect('/mahasiswa/upload-berkas');
    }
  });
};

// 4. Detail Pendaftaran
exports.detailPendaftaran = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const [mahasiswa] = await db.query(
      'SELECT * FROM mahasiswa WHERE user_id = ?',
      [userId]
    );
    
    if (mahasiswa.length === 0) {
      req.flash('error_msg', 'Data mahasiswa tidak ditemukan');
      return res.redirect('/mahasiswa/dashboard');
    }
    
    const [pendaftaran] = await db.query(`
      SELECT p.*, u.email as verified_by_email
      FROM pendaftaran_wisuda p
      LEFT JOIN users u ON p.verified_by = u.id
      WHERE p.mahasiswa_id = ?
    `, [mahasiswa[0].id]);
    
    if (pendaftaran.length === 0) {
      req.flash('error_msg', 'Anda belum terdaftar untuk wisuda');
      return res.redirect('/mahasiswa/dashboard');
    }
    
    const [dokumen] = await db.query(
      'SELECT * FROM dokumen_wisuda WHERE pendaftaran_id = ?',
      [pendaftaran[0].id]
    );
    
    res.render('detail_pendaftaran', {
      title: 'Detail Pendaftaran Wisuda',
      mahasiswa: mahasiswa[0],
      pendaftaran: pendaftaran[0],
      dokumen
    });
    
  } catch (error) {
    console.error('Error:', error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/mahasiswa/dashboard');
  }
};

// 5. Riwayat Pendaftaran
exports.riwayatPendaftaran = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const [mahasiswa] = await db.query(
      'SELECT * FROM mahasiswa WHERE user_id = ?',
      [userId]
    );
    
    if (mahasiswa.length === 0) {
      req.flash('error_msg', 'Data mahasiswa tidak ditemukan');
      return res.redirect('/mahasiswa/dashboard');
    }
    
    const [riwayat] = await db.query(`
      SELECT p.*, 
             COUNT(d.id) as jumlah_dokumen
      FROM pendaftaran_wisuda p
      LEFT JOIN dokumen_wisuda d ON d.pendaftaran_id = p.id
      WHERE p.mahasiswa_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, [mahasiswa[0].id]);
    
    res.render('riwayat_pendaftaran', {
      title: 'Riwayat Pendaftaran Wisuda',
      mahasiswa: mahasiswa[0],
      riwayat
    });
    
  } catch (error) {
    console.error('Error:', error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/mahasiswa/dashboard');
  }
};

// 6. Cetak Bukti (Fungsi yang sebelumnya hilang)
exports.cetakBukti = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [rows] = await db.query(`
      SELECT 
        m.nama, m.nim, m.prodi, m.jurusan, m.no_hp,
        p.tanggal_daftar, p.status, p.id as pendaftaran_id
      FROM mahasiswa m
      JOIN pendaftaran_wisuda p ON m.id = p.mahasiswa_id
      WHERE m.user_id = ?
    `, [userId]);

    if (rows.length === 0) {
      req.flash('error_msg', 'Data pendaftaran tidak ditemukan');
      return res.redirect('/mahasiswa/dashboard');
    }

    const data = rows[0];

    const [dokumen] = await db.query(`
      SELECT jenis_dokumen, status 
      FROM dokumen_wisuda 
      WHERE pendaftaran_id = ?
    `, [data.pendaftaran_id]);

    res.render('cetak_bukti', {
      title: 'Cetak Bukti Pendaftaran',
      data: data,
      dokumen: dokumen,
      user: req.session.user
    });

  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Gagal memuat halaman cetak');
    res.redirect('/mahasiswa/dashboard');
  }
};

// 7. Edit Profile (Fungsi yang sebelumnya hilang)
exports.editProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await db.query(`SELECT * FROM mahasiswa WHERE user_id = ?`, [userId]);
    
    if (rows.length === 0) return res.redirect('/mahasiswa/dashboard');

    res.render('edit_profile', {
      title: 'Edit Profil',
      user: req.session.user,
      mahasiswa: rows[0]
    });

  } catch (error) {
    console.error(error);
    res.redirect('/mahasiswa/dashboard');
  }
};

// 8. Update Profile (Fungsi yang sebelumnya hilang)
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { nama, no_hp, angkatan, tahun_lulus, ipk } = req.body;
    
    let query = `UPDATE mahasiswa SET nama = ?, no_hp = ?, angkatan = ?, tahun_lulus = ?, ipk = ?`;
    let params = [nama, no_hp, angkatan, tahun_lulus, ipk];

    if (req.file) {
      const [oldData] = await db.query(`SELECT foto_profil FROM mahasiswa WHERE user_id = ?`, [userId]);
      if (oldData[0].foto_profil) {
        const oldPath = path.join(__dirname, '../public/uploads/profile', oldData[0].foto_profil);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      query += `, foto_profil = ?`;
      params.push(req.file.filename);
    }

    query += ` WHERE user_id = ?`;
    params.push(userId);

    await db.query(query, params);
    req.session.user.nama = nama;
    req.flash('success_msg', 'Profil berhasil diperbarui');
    res.redirect('/mahasiswa/edit-profile');

  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Gagal update profil: ' + error.message);
    res.redirect('/mahasiswa/edit-profile');
  }
};

// 9. Delete Profile Photo (Fungsi yang sebelumnya hilang)
exports.deleteProfilePhoto = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await db.query(`SELECT foto_profil FROM mahasiswa WHERE user_id = ?`, [userId]);
    
    if (rows.length > 0 && rows[0].foto_profil) {
      const filePath = path.join(__dirname, '../public/uploads/profile', rows[0].foto_profil);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await db.query(`UPDATE mahasiswa SET foto_profil = NULL WHERE user_id = ?`, [userId]);
      return res.json({ success: true, message: 'Foto berhasil dihapus' });
    }
    res.json({ success: false, message: 'Foto tidak ditemukan' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};