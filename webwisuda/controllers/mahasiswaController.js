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
    const profileDir = 'public/uploads/profile/';
    
    // Buat folder jika belum ada
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

    // Tentukan folder tujuan berdasarkan fieldname (foto profil vs dokumen)
    if (file.fieldname === 'foto_profil') {
      cb(null, profileDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Limit 2MB
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
  { name: 'cover_ta', maxCount: 1 },
  { name: 'foto_profil', maxCount: 1 } // Tambahan untuk edit profil
]);

// =====================
// 1. Dashboard
// =====================
exports.dashboard = async (req, res) => {
  try {
    const userId = req.session.user.id;

    // 1. Ambil data Mahasiswa
    const [mahasiswa] = await db.query(
      'SELECT * FROM mahasiswa WHERE user_id = ?', [userId]
    );

    if (mahasiswa.length === 0) {
      req.flash('error_msg', 'Data mahasiswa tidak ditemukan');
      return res.redirect('/');
    }

    // 2. Ambil data Pendaftaran
    const [pendaftaran] = await db.query(
      'SELECT * FROM pendaftaran_wisuda WHERE mahasiswa_id = ?',
      [mahasiswa[0].id]
    );

    // 3. Ambil Data Periode & Kuota Aktif
    const [periodeRows] = await db.query(
      'SELECT * FROM periode_wisuda WHERE is_active = 1 LIMIT 1'
    );
    
    let periode = null;
    let isClosed = true; 
    let tenggatWaktuStr = "-";

    if (periodeRows.length > 0) {
        periode = periodeRows[0];
        
        const sekarang = new Date();
        const tutup = new Date(periode.tanggal_tutup);
        const sisaSlot = periode.kuota - periode.terisi;

        // Tutup jika: Lewat tanggal ATAU Slot habis
        if (sekarang > tutup || sisaSlot <= 0) {
            isClosed = true;
        } else {
            isClosed = false;
        }

        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        tenggatWaktuStr = tutup.toLocaleDateString('id-ID', options);
    }

    res.render('dashboard_mahasiswa', {
      title: 'Dashboard Mahasiswa',
      mahasiswa: mahasiswa[0],
      pendaftaran: pendaftaran.length > 0 ? pendaftaran[0] : null,
      user: req.session.user,
      periode: periode,
      isClosed: isClosed,       
      tenggatWaktu: tenggatWaktuStr 
    });

  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/');
  }
};

// =====================
// 2. Upload Berkas (Tampilan)
// =====================
exports.showUploadBerkas = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [mahasiswa] = await db.query(
      'SELECT * FROM mahasiswa WHERE user_id = ?', [userId]
    );

    if (mahasiswa.length === 0) return res.redirect('/mahasiswa/dashboard');

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
    res.redirect('/mahasiswa/dashboard');
  }
};

// =====================
// 3. Submit Pendaftaran (Upload & Simpan Draft)
// =====================
exports.submitPendaftaran = (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      req.flash('error_msg', err.message);
      return res.redirect('/mahasiswa/upload-berkas');
    }

    try {
      const userId = req.session.user.id;
      const [mhs] = await db.query('SELECT id FROM mahasiswa WHERE user_id = ?', [userId]);
      const mahasiswaId = mhs[0].id;

      const [pendaftaran] = await db.query(
        'SELECT id, status FROM pendaftaran_wisuda WHERE mahasiswa_id = ?',
        [mahasiswaId]
      );

      let pendaftaranId;

      // Logic: Jika belum ada pendaftaran, buat baru dengan status 'Draft'
      // Jika sudah ada (misal Ditolak), biarkan statusnya, nanti berubah saat Finalisasi
      if (pendaftaran.length > 0) {
        pendaftaranId = pendaftaran[0].id;
      } else {
        const result = await db.query(
          'INSERT INTO pendaftaran_wisuda (mahasiswa_id, tanggal_daftar, status) VALUES (?, CURDATE(), "Draft")',
          [mahasiswaId]
        );
        pendaftaranId = result[0].insertId;
      }

      const fields = ['ktp', 'kk', 'ktm', 'transkrip', 'foto', 'toeic', 'bebas_tanggungan', 'cover_ta'];
      const map = { ktp: 'KTP', kk: 'KK', ktm: 'KTM', transkrip: 'Transkrip', foto: 'Foto', toeic: 'TOEIC', bebas_tanggungan: 'Bebas_Tanggungan', cover_ta: 'Cover_TA' };

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

      req.flash('success_msg', `${uploaded} dokumen berhasil diupload. Silakan cek kelengkapan di Dashboard lalu klik "Ajukan Finalisasi" untuk mengunci slot.`);
      res.redirect('/mahasiswa/dashboard');

    } catch (error) {
      console.error(error);
      req.flash('error_msg', 'Terjadi kesalahan saat upload');
      res.redirect('/mahasiswa/upload-berkas');
    }
  });
};

// ============================================
// 4. (BARU) Finalisasi / Ajukan Validasi
// ============================================
exports.ajukanVerifikasi = async (req, res) => {
    const connection = await db.getConnection(); 
    
    try {
        const userId = req.session.user.id;
        await connection.beginTransaction();

        // 1. Ambil Data Mahasiswa
        const [mhs] = await connection.query('SELECT id FROM mahasiswa WHERE user_id = ?', [userId]);
        const mhsId = mhs[0].id;

        // 2. Cek Status Pendaftaran
        const [pendaftaran] = await connection.query(
            'SELECT * FROM pendaftaran_wisuda WHERE mahasiswa_id = ?', [mhsId]
        );

        if (pendaftaran.length === 0) {
            await connection.rollback();
            req.flash('error_msg', 'Anda belum mengupload berkas.');
            return res.redirect('/mahasiswa/dashboard');
        }

        if (pendaftaran[0].status !== 'Draft' && pendaftaran[0].status !== 'Ditolak') {
            await connection.rollback();
            req.flash('error_msg', 'Anda sudah melakukan pengajuan sebelumnya.');
            return res.redirect('/mahasiswa/dashboard');
        }

        // 3. Cek Periode Aktif & Kunci Baris (Locking)
        const [periode] = await connection.query(
            'SELECT * FROM periode_wisuda WHERE is_active = 1 LIMIT 1 FOR UPDATE'
        );

        if (periode.length === 0) {
            await connection.rollback();
            req.flash('error_msg', 'Tidak ada periode wisuda aktif.');
            return res.redirect('/mahasiswa/dashboard');
        }

        const activePeriode = periode[0];

        // 4. CEK KUOTA
        if (activePeriode.terisi >= activePeriode.kuota) {
            await connection.rollback();
            req.flash('error_msg', 'Mohon maaf, Kuota Wisuda untuk periode ini sudah PENUH.');
            return res.redirect('/mahasiswa/dashboard');
        }

        // 5. Update Status Pendaftaran
        await connection.query(
            'UPDATE pendaftaran_wisuda SET status = ?, tanggal_daftar = CURDATE() WHERE id = ?',
            ['Diajukan', pendaftaran[0].id]
        );

        // 6. KURANGI SLOT (Tambah counter terisi)
        await connection.query(
            'UPDATE periode_wisuda SET terisi = terisi + 1 WHERE id = ?',
            [activePeriode.id]
        );

        await connection.commit();

        req.flash('success_msg', 'Pendaftaran berhasil diajukan! Slot wisuda berhasil diamankan.');
        res.redirect('/mahasiswa/dashboard');

    } catch (error) {
        await connection.rollback();
        console.error('Error Finalisasi:', error);
        req.flash('error_msg', 'Gagal mengajukan: ' + error.message);
        res.redirect('/mahasiswa/dashboard');
    } finally {
        connection.release();
    }
};

// =====================
// 5. Detail Pendaftaran
// =====================
exports.detailPendaftaran = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [mhs] = await db.query('SELECT * FROM mahasiswa WHERE user_id = ?', [userId]);
    const [pendaftaran] = await db.query('SELECT * FROM pendaftaran_wisuda WHERE mahasiswa_id = ?', [mhs[0].id]);
    const [dokumen] = await db.query('SELECT * FROM dokumen_wisuda WHERE pendaftaran_id = ?', [pendaftaran[0].id]);

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
// 6. Riwayat Pendaftaran
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
// 7. Cetak Bukti
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

    if (rows.length === 0) return res.redirect('/mahasiswa/dashboard');

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
// 8. Edit Profile
// =====================
exports.editProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await db.query(`SELECT * FROM mahasiswa WHERE user_id = ?`, [userId]);

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
// 9. Update Profile
// =====================
exports.updateProfile = (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      req.flash('error_msg', err.message);
      return res.redirect('/mahasiswa/edit-profile');
    }

    try {
      const userId = req.session.user.id;
      const { nama, no_hp, angkatan, tahun_lulus, ipk } = req.body;

      let query = `UPDATE mahasiswa SET nama=?, no_hp=?, angkatan=?, tahun_lulus=?, ipk=?`;
      let params = [nama, no_hp, angkatan, tahun_lulus, ipk];

      // Handle Foto Profil (dari multer field 'foto_profil')
      if (req.files['foto_profil']) {
        const file = req.files['foto_profil'][0];
        
        // Hapus foto lama
        const [old] = await db.query(`SELECT foto_profil FROM mahasiswa WHERE user_id = ?`, [userId]);
        if (old[0].foto_profil) {
          const oldPath = path.join(__dirname, "../public/uploads/profile", old[0].foto_profil);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        query += `, foto_profil=?`;
        params.push(file.filename);
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
  });
};

// =====================
// 10. Delete Profile Photo
// =====================
exports.deleteProfilePhoto = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await db.query(`SELECT foto_profil FROM mahasiswa WHERE user_id = ?`, [userId]);

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
// 11. Preview File
// =====================
exports.previewFile = async (req, res) => {
  try {
    const dokumenId = req.params.id;
    const [rows] = await db.query(`SELECT * FROM dokumen_wisuda WHERE id = ?`, [dokumenId]);

    if (rows.length === 0) return res.status(404).send("File tidak ditemukan");

    const filePath = path.join(__dirname, "../public/uploads", rows[0].path_file);
    if (!fs.existsSync(filePath)) return res.status(404).send("File tidak ada di server");

    res.sendFile(filePath);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error preview file");
  }
};
