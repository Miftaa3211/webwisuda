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

// Dashboard Mahasiswa
exports.dashboard = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Get mahasiswa data
    const [mahasiswa] = await db.query(
      'SELECT * FROM mahasiswa WHERE user_id = ?',
      [userId]
    );
    
    if (mahasiswa.length === 0) {
      req.flash('error_msg', 'Data mahasiswa tidak ditemukan');
      return res.redirect('/');
    }
    
    // Check if already registered for wisuda
    const [pendaftaran] = await db.query(
      'SELECT * FROM pendaftaran_wisuda WHERE mahasiswa_id = ?',
      [mahasiswa[0].id]
    );
    
    // Render langsung tanpa prefix mahasiswa/
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

// Show upload berkas page
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
    
    // Check if already registered
    const [existingPendaftaran] = await db.query(
      'SELECT * FROM pendaftaran_wisuda WHERE mahasiswa_id = ?',
      [mahasiswa[0].id]
    );
    
    res.render('upload_berkas', {
      title: 'Upload Berkas Wisuda',
      mahasiswa: mahasiswa[0],
      pendaftaran: existingPendaftaran.length > 0 ? existingPendaftaran[0] : null
    });
    
  } catch (error) {
    console.error('Error:', error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/mahasiswa/dashboard');
  }
};

// Process pendaftaran/upload - FIXED VERSION
exports.submitPendaftaran = (req, res) => {
  upload(req, res, async function(err) {
    // Handle multer errors
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
      
      console.log('User ID:', userId);
      console.log('Files uploaded:', Object.keys(req.files || {}));
      
      // Get mahasiswa data
      const [mahasiswa] = await db.query(
        'SELECT id FROM mahasiswa WHERE user_id = ?',
        [userId]
      );
      
      if (mahasiswa.length === 0) {
        req.flash('error_msg', 'Data mahasiswa tidak ditemukan');
        return res.redirect('/mahasiswa/dashboard');
      }
      
      const mahasiswaId = mahasiswa[0].id;
      console.log('Mahasiswa ID:', mahasiswaId);
      
      // Validate that files were uploaded
      if (!req.files || Object.keys(req.files).length === 0) {
        req.flash('error_msg', 'Tidak ada file yang diupload');
        return res.redirect('/mahasiswa/upload-berkas');
      }
      
      // Check if already registered
      const [existingPendaftaran] = await db.query(
        'SELECT id FROM pendaftaran_wisuda WHERE mahasiswa_id = ?',
        [mahasiswaId]
      );
      
      let pendaftaranId;
      
      if (existingPendaftaran.length > 0) {
        // Update existing
        pendaftaranId = existingPendaftaran[0].id;
        await db.query(
          'UPDATE pendaftaran_wisuda SET status = "Diajukan", tanggal_daftar = CURDATE() WHERE id = ?',
          [pendaftaranId]
        );
        console.log('Updated existing pendaftaran:', pendaftaranId);
      } else {
        // Insert new pendaftaran
        const [pendaftaranResult] = await db.query(
          'INSERT INTO pendaftaran_wisuda (mahasiswa_id, tanggal_daftar, status) VALUES (?, CURDATE(), "Diajukan")',
          [mahasiswaId]
        );
        pendaftaranId = pendaftaranResult.insertId;
        console.log('Created new pendaftaran:', pendaftaranId);
      }
      
      // Insert dokumen - sesuai dengan field name di form
      const fileFields = ['ktp', 'kk', 'ktm', 'transkrip', 'foto', 'toeic', 'bebas_tanggungan', 'cover_ta'];
      const dokumenMap = {
        'ktp': 'KTP',
        'kk': 'KK',
        'ktm': 'KTM',
        'transkrip': 'Transkrip',
        'foto': 'Foto',
        'toeic': 'TOEIC',
        'bebas_tanggungan': 'Bebas_Tanggungan',
        'cover_ta': 'Cover_TA'
      };
      
      let uploadedCount = 0;
      
      for (const field of fileFields) {
        if (req.files[field] && req.files[field][0]) {
          const file = req.files[field][0];
          
          console.log(`Processing ${field}:`, file.filename);
          
          // Check if dokumen already exists
          const [existing] = await db.query(
            'SELECT id FROM dokumen_wisuda WHERE pendaftaran_id = ? AND jenis_dokumen = ?',
            [pendaftaranId, dokumenMap[field]]
          );
          
          if (existing.length > 0) {
            // Update
          await db.query(
            'UPDATE dokumen_wisuda SET nama_file = ?, path_file = ?, status = "Lengkap", uploaded_at = NOW() WHERE id = ?',
            [file.originalname, file.filename, existing[0].id]
          );
            console.log(`Updated ${field}`);
          } else {
            // Insert
          await db.query(
            'INSERT INTO dokumen_wisuda (pendaftaran_id, jenis_dokumen, nama_file, path_file, status) VALUES (?, ?, ?, ?, "Lengkap")',
            [pendaftaranId, dokumenMap[field], file.originalname, file.filename]
          );
            console.log(`Inserted ${field}`);
          }
          
          uploadedCount++;
        }
      }
      
      console.log(`Total files uploaded: ${uploadedCount}`);
      
      if (uploadedCount === 0) {
        req.flash('error_msg', 'Tidak ada dokumen yang berhasil diupload');
        return res.redirect('/mahasiswa/upload-berkas');
      }
      
      req.flash('success_msg', `Pendaftaran wisuda berhasil! ${uploadedCount} dokumen telah diupload. Mohon tunggu proses verifikasi.`);
      res.redirect('/mahasiswa/dashboard');
      
    } catch (error) {
      console.error('Database Error:', error);
      req.flash('error_msg', 'Terjadi kesalahan saat menyimpan data: ' + error.message);
      res.redirect('/mahasiswa/upload-berkas');
    }
  });
};

// Show detail pendaftaran
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
    
    // Get pendaftaran and dokumen
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
    
    // Get dokumen
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
// Show riwayat pendaftaran
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
    
    // Get all pendaftaran history
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
exports.cetakBukti = async (req, res) => {
  try {
    const userId = req.session.user.id;

    // PERBAIKAN: Hanya ambil kolom yang PASTI ADA di database Anda
    const [rows] = await db.query(`
      SELECT 
        m.nama,
        m.nim,
        m.prodi,
        m.jurusan,
        m.no_hp,
        p.tanggal_daftar,
        p.status,
        p.id as pendaftaran_id
      FROM mahasiswa m
      JOIN pendaftaran_wisuda p ON m.id = p.mahasiswa_id
      WHERE m.user_id = ?
    `, [userId]);

    if (rows.length === 0) {
      req.flash('error_msg', 'Data pendaftaran tidak ditemukan');
      return res.redirect('/mahasiswa/dashboard');
    }

    const data = rows[0];

    // Ambil status dokumen
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
