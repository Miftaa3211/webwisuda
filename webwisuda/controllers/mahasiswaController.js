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

    // Ambil Data Mahasiswa
    const [mahasiswa] = await db.query('SELECT * FROM mahasiswa WHERE user_id = ?', [userId]);
    if (mahasiswa.length === 0) return res.redirect('/');
    
    // Ambil Data Pendaftaran + Info Kloter (TERMASUK TANGGAL KLOTER)
    const [pendaftaran] = await db.query(`
      SELECT p.*, k.nama_kloter, k.tanggal_wisuda
      FROM pendaftaran_wisuda p
      LEFT JOIN kloter_wisuda k ON p.kloter_id = k.id
      WHERE p.mahasiswa_id = ?
    `, [mahasiswa[0].id]);
    
    const dataPendaftaran = pendaftaran.length > 0 ? pendaftaran[0] : null;

    // --- LOGIKA WAKTU & PENGATURAN ---
    const [settings] = await db.query('SELECT * FROM pengaturan_wisuda LIMIT 1');
    const config = settings[0];
    
    const now = new Date();
    const openDate = new Date(config.tanggal_buka);
    const closeDate = new Date(config.tenggat_pendaftaran);
    
    // Cek Status Waktu
    const isNotOpenYet = now < openDate; 
    const isClosed = now > closeDate;    
    
    const isVerified = dataPendaftaran && dataPendaftaran.status === 'Diverifikasi';

    // Format Tanggal
    const options = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' };
    
    const infoWaktu = {
      buka: openDate.toLocaleDateString('id-ID', options) + ' WIB',
      tenggat: closeDate.toLocaleDateString('id-ID', options) + ' WIB'
    };

    res.render('dashboard_mahasiswa', {
      title: 'Dashboard Mahasiswa',
      mahasiswa: mahasiswa[0],
      pendaftaran: dataPendaftaran,
      user: req.session.user,
      statusWaktu: { isNotOpenYet, isClosed, isVerified },
      infoWaktu
    });

  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
};

// =====================
// 2. Upload Berkas
// =====================
exports.showUploadBerkas = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [mhs] = await db.query('SELECT * FROM mahasiswa WHERE user_id = ?', [userId]);
    const [pendaftaran] = await db.query('SELECT * FROM pendaftaran_wisuda WHERE mahasiswa_id = ?', [mhs[0].id]);

    // Proteksi: Jika sudah diverifikasi
    if (pendaftaran.length > 0 && pendaftaran[0].status === 'Diverifikasi') {
      req.flash('error_msg', 'Pendaftaran Anda sudah diverifikasi. Tidak dapat mengubah berkas.');
      return res.redirect('/mahasiswa/dashboard');
    }
    
    // Proteksi: Cek Tanggal
    const [settings] = await db.query('SELECT * FROM pengaturan_wisuda LIMIT 1');
    const now = new Date();
    if (now > new Date(settings[0].tenggat_pendaftaran)) {
       req.flash('error_msg', 'Masa pendaftaran sudah berakhir.');
       return res.redirect('/mahasiswa/dashboard');
    }

    // --- LOGIKA KLOTER (SEQUENTIAL) ---
    const [rawKloters] = await db.query(`
      SELECT 
        k.*, 
        (SELECT COUNT(*) FROM pendaftaran_wisuda p WHERE p.kloter_id = k.id) as terisi
      FROM kloter_wisuda k
      WHERE k.is_active = 1
      ORDER BY k.urutan ASC
    `);

    let openBatchIndex = -1;
    for (let i = 0; i < rawKloters.length; i++) {
        if (rawKloters[i].terisi < rawKloters[i].kuota_maksimal) {
            openBatchIndex = i;
            break;
        }
    }

    const processedKloters = rawKloters.map((k, index) => {
        const sisa = k.kuota_maksimal - k.terisi;
        let status = '';

        if (openBatchIndex === -1) {
            status = 'full'; 
        } else {
            if (index < openBatchIndex) {
                status = 'full';
            } else if (index === openBatchIndex) {
                status = 'open';
            } else {
                status = 'locked';
            }
        }
        return { ...k, sisa, status };
    });

    let dokumenMap = {};
    if (pendaftaran.length > 0) {
      const [dokumenList] = await db.query('SELECT * FROM dokumen_wisuda WHERE pendaftaran_id = ?', [pendaftaran[0].id]);
      dokumenList.forEach(doc => { dokumenMap[doc.jenis_dokumen] = doc; });
    }

    res.render('upload_berkas', {
      title: 'Upload Berkas',
      mahasiswa: mhs[0],
      pendaftaran: pendaftaran[0],
      dokumen: dokumenMap,
      kloters: processedKloters
    });

  } catch (error) {
    console.error(error);
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

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction(); 

      const userId = req.session.user.id;
      const { kloter_id } = req.body; 

      if (!kloter_id) {
        throw new Error('Silakan pilih Kloter Wisuda terlebih dahulu.');
      }

      const [cekKloter] = await connection.query(
        `SELECT kuota_maksimal, 
        (SELECT COUNT(*) FROM pendaftaran_wisuda WHERE kloter_id = ?) as terisi 
        FROM kloter_wisuda WHERE id = ? FOR UPDATE`,
        [kloter_id, kloter_id]
      );

      if (cekKloter.length === 0) throw new Error('Kloter tidak ditemukan.');
      if (cekKloter[0].terisi >= cekKloter[0].kuota_maksimal) throw new Error('Mohon maaf, Kuota kloter ini baru saja penuh.');

      const [mhs] = await connection.query('SELECT id FROM mahasiswa WHERE user_id = ?', [userId]);
      if (mhs.length === 0) throw new Error('Data mahasiswa tidak ditemukan');
      const mahasiswaId = mhs[0].id;

      const [existingPendaftaran] = await connection.query('SELECT id FROM pendaftaran_wisuda WHERE mahasiswa_id = ?', [mahasiswaId]);

      let pendaftaranId;
      if (existingPendaftaran.length > 0) {
        pendaftaranId = existingPendaftaran[0].id;
        await connection.query(
          'UPDATE pendaftaran_wisuda SET status = "Diajukan", tanggal_daftar = CURDATE(), kloter_id = ? WHERE id = ?',
          [kloter_id, pendaftaranId]
        );
      } else {
        const result = await connection.query(
          'INSERT INTO pendaftaran_wisuda (mahasiswa_id, kloter_id, tanggal_daftar, status) VALUES (?, ?, CURDATE(), "Diajukan")',
          [mahasiswaId, kloter_id]
        );
        pendaftaranId = result[0].insertId;
      }

      const fields = ['ktp', 'kk', 'ktm', 'transkrip', 'foto', 'toeic', 'bebas_tanggungan', 'cover_ta'];
      const map = { ktp: 'KTP', kk: 'KK', ktm: 'KTM', transkrip: 'Transkrip', foto: 'Foto', toeic: 'TOEIC', bebas_tanggungan: 'Bebas_Tanggungan', cover_ta: 'Cover_TA' };

      let uploaded = 0;
      for (const field of fields) {
        if (req.files[field]) {
          const file = req.files[field][0];
          
          const [existingDoc] = await connection.query('SELECT id FROM dokumen_wisuda WHERE pendaftaran_id = ? AND jenis_dokumen = ?', [pendaftaranId, map[field]]);

          if (existingDoc.length > 0) {
            await connection.query(
              'UPDATE dokumen_wisuda SET nama_file = ?, path_file = ?, status = "Diajukan", catatan = NULL WHERE id = ?',
              [file.originalname, file.filename, existingDoc[0].id]
            );
          } else {
            await connection.query(
              'INSERT INTO dokumen_wisuda (pendaftaran_id, jenis_dokumen, nama_file, path_file, status) VALUES (?, ?, ?, ?, "Diajukan")',
              [pendaftaranId, map[field], file.originalname, file.filename]
            );
          }
          uploaded++;
        }
      }

      await connection.commit();
      req.flash('success_msg', `Pendaftaran Berhasil! Kuota Anda telah diamankan.`);
      res.redirect('/mahasiswa/dashboard');

    } catch (error) {
      await connection.rollback(); 
      console.error(error);
      req.flash('error_msg', error.message || 'Terjadi kesalahan saat memproses pendaftaran.');
      res.redirect('/mahasiswa/upload-berkas');
    } finally {
      connection.release();
    }
  });
};

// =====================
// 4. Detail Pendaftaran
// =====================
exports.detailPendaftaran = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [mhs] = await db.query('SELECT * FROM mahasiswa WHERE user_id = ?', [userId]);
    const [pendaftaran] = await db.query(`
      SELECT p.*, k.nama_kloter, k.tanggal_wisuda 
      FROM pendaftaran_wisuda p
      LEFT JOIN kloter_wisuda k ON p.kloter_id = k.id
      WHERE p.mahasiswa_id = ?`, 
      [mhs[0].id]
    );
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
// 5. Riwayat Pendaftaran
// =====================
exports.riwayatPendaftaran = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [mhs] = await db.query('SELECT * FROM mahasiswa WHERE user_id = ?', [userId]);

    const [riwayat] = await db.query(
      `SELECT p.*, k.nama_kloter, COUNT(d.id) as jumlah_dokumen
       FROM pendaftaran_wisuda p
       LEFT JOIN dokumen_wisuda d ON d.pendaftaran_id = p.id
       LEFT JOIN kloter_wisuda k ON p.kloter_id = k.id
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
        p.tanggal_daftar, p.status, p.id as pendaftaran_id,
        k.nama_kloter, k.tanggal_wisuda
      FROM mahasiswa m
      JOIN pendaftaran_wisuda p ON m.id = p.mahasiswa_id
      LEFT JOIN kloter_wisuda k ON p.kloter_id = k.id
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
// 8. Update Profile
// =====================
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { nama, no_hp, angkatan, tahun_lulus, ipk } = req.body;

    let query = `UPDATE mahasiswa SET nama=?, no_hp=?, angkatan=?, tahun_lulus=?, ipk=?`;
    let params = [nama, no_hp, angkatan, tahun_lulus, ipk];

    if (req.file) {
      const [old] = await db.query(`SELECT foto_profil FROM mahasiswa WHERE user_id = ?`, [userId]);
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
// 10. Preview File
// =====================
exports.previewFile = async (req, res) => {
  try {
    const dokumenId = req.params.id;
    const [rows] = await db.query(`SELECT * FROM dokumen_wisuda WHERE id = ?`, [dokumenId]);

    if (rows.length === 0) return res.status(404).send("File tidak ditemukan");
    const filePath = path.join(__dirname, "../public/uploads", rows[0].path_file);
    if (!fs.existsSync(filePath)) return res.status(404).send("File tidak ada");

    res.sendFile(filePath);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error preview file");
  }
};