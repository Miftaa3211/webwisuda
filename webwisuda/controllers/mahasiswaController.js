const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// =====================
// MULTER CONFIG
// =====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads/';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) &&
        allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file JPG, PNG atau PDF yang diperbolehkan'));
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

// =====================
// 1. Dashboard
// =====================
exports.dashboard = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [mahasiswa] = await db.query(
      'SELECT * FROM mahasiswa WHERE user_id = ?', [userId]
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
    console.error(error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/');
  }
};

// =====================
// 2. Upload Berkas
// =====================
exports.showUploadBerkas = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [mahasiswa] = await db.query(
      'SELECT * FROM mahasiswa WHERE user_id = ?', [userId]
    );

    if (mahasiswa.length === 0) {
      req.flash('error_msg', 'Data mahasiswa tidak ditemukan');
      return res.redirect('/mahasiswa/dashboard');
    }

    const [pendaftaran] = await db.query(
      'SELECT * FROM pendaftaran_wisuda WHERE mahasiswa_id = ?',
      [mahasiswa[0].id]
    );

    let dokumenMap = {};

    if (pendaftaran.length > 0) {
      const [dokumenList] = await db.query(
        'SELECT * FROM dokumen_wisuda WHERE pendaftaran_id = ?',
        [pendaftaran[0].id]
      );
      dokumenList.forEach(doc => {
        dokumenMap[doc.jenis_dokumen] = doc;
      });
    }

    res.render('upload_berkas', {
      title: 'Upload Berkas Wisuda',
      mahasiswa: mahasiswa[0],
      pendaftaran: pendaftaran.length > 0 ? pendaftaran[0] : null,
      dokumen: dokumenMap
    });

  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/mahasiswa/dashboard');
  }
};

// =====================
// 3. Submit Pendaftaran
// =====================
exports.submitPendaftaran = (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      req.flash('error_msg', err.message);
      return res.redirect('/mahasiswa/upload-berkas');
    }

    try {
      const userId = req.session.user.id;

      const [mhs] = await db.query(
        'SELECT id FROM mahasiswa WHERE user_id = ?',
        [userId]
      );

      if (mhs.length === 0) {
        req.flash('error_msg', 'Data mahasiswa tidak ditemukan');
        return res.redirect('/mahasiswa/dashboard');
      }

      const mahasiswaId = mhs[0].id;

      const [pendaftaran] = await db.query(
        'SELECT id FROM pendaftaran_wisuda WHERE mahasiswa_id = ?',
        [mahasiswaId]
      );

      let pendaftaranId;

      if (pendaftaran.length > 0) {
        pendaftaranId = pendaftaran[0].id;
        await db.query(
          'UPDATE pendaftaran_wisuda SET status = "Diajukan", tanggal_daftar = CURDATE() WHERE id = ?',
          [pendaftaranId]
        );
      } else {
        const result = await db.query(
          'INSERT INTO pendaftaran_wisuda (mahasiswa_id, tanggal_daftar, status) VALUES (?, CURDATE(), "Diajukan")',
          [mahasiswaId]
        );
        pendaftaranId = result[0].insertId;
      }

      const fields = ['ktp', 'kk', 'ktm', 'transkrip', 'foto', 'toeic', 'bebas_tanggungan', 'cover_ta'];
      const map = {
        ktp: 'KTP',
        kk: 'KK',
        ktm: 'KTM',
        transkrip: 'Transkrip',
        foto: 'Foto',
        toeic: 'TOEIC',
        bebas_tanggungan: 'Bebas_Tanggungan',
        cover_ta: 'Cover_TA'
      };

      let uploaded = 0;

      for (const field of fields) {
        if (req.files[field]) {
          const file = req.files[field][0];

          const [existing] = await db.query(
            'SELECT id FROM dokumen_wisuda WHERE pendaftaran_id = ? AND jenis_dokumen = ?',
            [pendaftaranId, map[field]]
          );

          if (existing.length > 0) {
            await db.query(
              'UPDATE dokumen_wisuda SET nama_file = ?, path_file = ?, status = "Diajukan", catatan = NULL WHERE id = ?',
              [file.originalname, file.filename, existing[0].id]
            );
          } else {
            await db.query(
              'INSERT INTO dokumen_wisuda (pendaftaran_id, jenis_dokumen, nama_file, path_file, status) VALUES (?, ?, ?, ?, "Diajukan")',
              [pendaftaranId, map[field], file.originalname, file.filename]
            );
          }

          uploaded++;
        }
      }

      req.flash('success_msg', `${uploaded} dokumen berhasil diupload`);
      res.redirect('/mahasiswa/dashboard');

    } catch (error) {
      console.error(error);
      req.flash('error_msg', 'Terjadi kesalahan');
      res.redirect('/mahasiswa/upload-berkas');
    }
  });
};

// =====================
// 4. Detail Pendaftaran
// =====================
exports.detailPendaftaran = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [mhs] = await db.query(
      'SELECT * FROM mahasiswa WHERE user_id = ?', [userId]
    );

    const [pendaftaran] = await db.query(
      'SELECT * FROM pendaftaran_wisuda WHERE mahasiswa_id = ?', [mhs[0].id]
    );

    const [dokumen] = await db.query(
      'SELECT * FROM dokumen_wisuda WHERE pendaftaran_id = ?', [pendaftaran[0].id]
    );

    res.render('detail_pendaftaran', {
      title: 'Detail Pendaftaran Wisuda',
      mahasiswa: mhs[0],
      pendaftaran: pendaftaran[0],
      dokumen
    });

  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/mahasiswa/dashboard');
  }
};

// =====================
// 5. Riwayat Pendaftaran
// =====================
exports.riwayatPendaftaran = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [mhs] = await db.query('SELECT * FROM mahasiswa WHERE user_id = ?', [userId]);

    const [riwayat] = await db.query(
      `SELECT p.*, COUNT(d.id) as jumlah_dokumen
       FROM pendaftaran_wisuda p
       LEFT JOIN dokumen_wisuda d ON d.pendaftaran_id = p.id
       WHERE p.mahasiswa_id = ?
       GROUP BY p.id`, [mhs[0].id]
    );

    res.render('riwayat_pendaftaran', {
      title: 'Riwayat Pendaftaran Wisuda',
      mahasiswa: mhs[0],
      riwayat
    });

  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/mahasiswa/dashboard');
  }
};

// =====================
// 6. Cetak Bukti
// =====================
exports.cetakBukti = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [rows] = await db.query(`
      SELECT 
        m.nama, m.nim, m.prodi, m.jurusan, m.no_hp,
        p.tanggal_daftar, p.status, p.id as pendaftaran_id
      FROM mahasiswa m
      JOIN pendaftaran_wisuda p ON m.id = p.mahasiswa_id
      WHERE m.user_id = ?`,
      [userId]
    );

    const data = rows[0];

    const [dokumen] = await db.query(
      `SELECT jenis_dokumen, status FROM dokumen_wisuda WHERE pendaftaran_id = ?`,
      [data.pendaftaran_id]
    );

    res.render('cetak_bukti', {
      title: 'Cetak Bukti Pendaftaran',
      data,
      dokumen,
      user: req.session.user
    });

  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Gagal memuat halaman cetak');
    res.redirect('/mahasiswa/dashboard');
  }
};

// =====================
// 7. Edit Profile
// =====================
exports.editProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [rows] = await db.query(
      `SELECT * FROM mahasiswa WHERE user_id = ?`,
      [userId]
    );

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

// =====================
// 8. Update Profile
// =====================
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { nama, no_hp, angkatan, tahun_lulus, ipk } = req.body;

    let query = `UPDATE mahasiswa SET nama=?, no_hp=?, angkatan=?, tahun_lulus=?, ipk=?`;
    let params = [nama, no_hp, angkatan, tahun_lulus, ipk];

    if (req.file) {
      const [old] = await db.query(
        `SELECT foto_profil FROM mahasiswa WHERE user_id = ?`, [userId]
      );

      if (old[0].foto_profil) {
        const oldPath = path.join(__dirname, "../public/uploads/profile", old[0].foto_profil);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      query += `, foto_profil=?`;
      params.push(req.file.filename);
    }

    query += ` WHERE user_id = ?`;
    params.push(userId);

    await db.query(query, params);

    req.flash('success_msg', 'Profil berhasil diperbarui');
    res.redirect('/mahasiswa/edit-profile');

  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Gagal update profil');
    res.redirect('/mahasiswa/edit-profile');
  }
};

// =====================
// 9. Delete Profile Photo
// =====================
exports.deleteProfilePhoto = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [rows] = await db.query(
      `SELECT foto_profil FROM mahasiswa WHERE user_id = ?`,
      [userId]
    );

    if (rows[0].foto_profil) {
      const filePath = path.join(__dirname, "../public/uploads/profile", rows[0].foto_profil);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await db.query(`UPDATE mahasiswa SET foto_profil=NULL WHERE user_id = ?`, [userId]);
    }

    res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};

// =====================
// 10. Preview File
// =====================
exports.previewFile = async (req, res) => {
  try {
    const dokumenId = req.params.id;

    const [rows] = await db.query(
      `SELECT * FROM dokumen_wisuda WHERE id = ?`,
      [dokumenId]
    );

    if (rows.length === 0) return res.status(404).send("File tidak ditemukan");

    const filePath = path.join(__dirname, "../public/uploads", rows[0].path_file);

    if (!fs.existsSync(filePath)) return res.status(404).send("File tidak ada");

    res.sendFile(filePath);

  } catch (error) {
    console.error(error);
    res.status(500).send("Error preview file");
  }
};
