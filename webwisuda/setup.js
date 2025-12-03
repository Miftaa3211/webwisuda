const fs = require('fs');
const path = require('path');

console.log('🚀 Setup Wisuda Online Polinela - LENGKAP\n');

// Buat folder structure
const folders = [
  'config', 'controllers', 'routes', 'views', 'views/layout',
  'public', 'public/css', 'public/js', 'public/images', 'public/uploads', 'database'
];

folders.forEach(folder => {
  const folderPath = path.join(__dirname, folder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log(`✅ ${folder}`);
  }
});

console.log('\n📄 Membuat file backend...\n');

// 1. config/database.js
fs.writeFileSync('config/database.js', `const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'wisuda_polinela',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Error koneksi database:', err.message);
  } else {
    console.log('✅ Database terhubung');
    connection.release();
  }
});

module.exports = pool.promise();
`);
console.log('✅ config/database.js');

// 2. controllers/publicController.js
fs.writeFileSync('controllers/publicController.js', `const db = require('../config/database');

exports.index = async (req, res) => {
  try {
    const [totalResult] = await db.query('SELECT COUNT(*) as total FROM mahasiswa WHERE tahun_lulus IS NOT NULL');
    const totalLulusan = totalResult[0].total;

    const [activeResult] = await db.query('SELECT COUNT(*) as total FROM mahasiswa WHERE tahun_lulus = "2024"');
    const lulusanAktif = activeResult[0].total;

    const [allMahasiswa] = await db.query('SELECT COUNT(*) as total FROM mahasiswa');
    const persentaseKelulusan = allMahasiswa[0].total > 0 
      ? Math.round((totalLulusan / allMahasiswa[0].total) * 100) 
      : 0;

    const [topStudents] = await db.query(\`
      SELECT nama, nim, jurusan, ipk, tahun_lulus 
      FROM mahasiswa 
      WHERE ipk IS NOT NULL 
      ORDER BY ipk DESC 
    \`);

    const [yearData] = await db.query(\`
      SELECT tahun_lulus, COUNT(*) as jumlah 
      FROM mahasiswa 
      WHERE tahun_lulus IS NOT NULL 
      GROUP BY tahun_lulus 
      ORDER BY tahun_lulus
    \`);
    
    const chartYears = yearData.map(row => row.tahun_lulus);
    const chartYearData = yearData.map(row => row.jumlah);

    const [majorData] = await db.query(\`
      SELECT jurusan, COUNT(*) as total 
      FROM mahasiswa 
      WHERE tahun_lulus IS NOT NULL 
      GROUP BY jurusan 
      ORDER BY total DESC 
      LIMIT 5
    \`);
    
    const chartMajors = majorData.map(row => row.jurusan);
    const chartMajorData = majorData.map(row => row.total);

    res.render('index', {
      title: 'Wisuda Politeknik Negeri Lampung',
      totalLulusan,
      lulusanAktif,
      persentaseKelulusan,
      topStudents,
      chartYears,
      chartYearData,
      chartMajors,
      chartMajorData
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Terjadi kesalahan pada server');
  }
};
`);
console.log('✅ controllers/publicController.js');

// 3. controllers/authController.js
fs.writeFileSync('controllers/authController.js', `const db = require('../config/database');
const bcrypt = require('bcrypt');

exports.showRegister = (req, res) => {
  res.render('register', { title: 'Registrasi Akun' });
};

exports.register = async (req, res) => {
  try {
    const { email, password, password_confirm, nim, nama, jurusan, prodi, angkatan, no_hp, alamat } = req.body;

    if (password !== password_confirm) {
      req.flash('error_msg', 'Password tidak cocok');
      return res.redirect('/auth/register');
    }

    const [existingUser] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      req.flash('error_msg', 'Email sudah terdaftar');
      return res.redirect('/auth/register');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [userResult] = await db.query(
      'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
      [email, hashedPassword, 'mahasiswa']
    );

    await db.query(
      'INSERT INTO mahasiswa (user_id, nim, nama, jurusan, prodi, angkatan, no_hp, alamat) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userResult.insertId, nim, nama, jurusan, prodi, angkatan, no_hp, alamat]
    );

    req.flash('success_msg', 'Registrasi berhasil! Silakan login.');
    res.redirect('/');
  } catch (error) {
    console.error('Error:', error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/auth/register');
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      req.flash('error_msg', 'Email atau password salah');
      return res.redirect('/');
    }

    const isMatch = await bcrypt.compare(password, users[0].password);
    if (!isMatch) {
      req.flash('error_msg', 'Email atau password salah');
      return res.redirect('/');
    }

    req.session.user = {
      id: users[0].id,
      email: users[0].email,
      role: users[0].role
    };

    if (users[0].role === 'admin') {
      res.redirect('/admin/dashboard');
    } else {
      res.redirect('/mahasiswa/dashboard');
    }
  } catch (error) {
    console.error('Error:', error);
    req.flash('error_msg', 'Terjadi kesalahan');
    res.redirect('/');
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/'));
};
`);
console.log('✅ controllers/authController.js');

// 4. controllers/mahasiswaController.js
fs.writeFileSync('controllers/mahasiswaController.js', `const db = require('../config/database');

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
`);
console.log('✅ controllers/mahasiswaController.js');

// 5. controllers/adminController.js
fs.writeFileSync('controllers/adminController.js', `const db = require('../config/database');

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
`);
console.log('✅ controllers/adminController.js');

// 6-9. Routes
fs.writeFileSync('routes/public.js', `const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

router.get('/', publicController.index);

module.exports = router;
`);

fs.writeFileSync('routes/auth.js', `const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/register', authController.showRegister);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

module.exports = router;
`);

fs.writeFileSync('routes/mahasiswa.js', `const express = require('express');
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
`);

fs.writeFileSync('routes/admin.js', `const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.flash('error_msg', 'Akses ditolak');
    return res.redirect('/');
  }
  next();
};

router.use(requireAdmin);
router.get('/dashboard', adminController.dashboard);

module.exports = router;
`);

console.log('✅ routes/public.js');
console.log('✅ routes/auth.js');
console.log('✅ routes/mahasiswa.js');
console.log('✅ routes/admin.js');

// 10. views/dashboard_mahasiswa.ejs
fs.writeFileSync('views/dashboard_mahasiswa.ejs', `<!DOCTYPE html>
<html>
<head>
  <title><%= title %></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</head>
<body style="background: #f5f5f5;">
  <nav class="navbar navbar-dark bg-primary">
    <div class="container">
      <span class="navbar-brand">Dashboard Mahasiswa</span>
      <a href="/auth/logout" class="btn btn-light btn-sm">Logout</a>
    </div>
  </nav>
  <div class="container mt-5">
    <div class="card">
      <div class="card-body">
        <h3>Selamat Datang, <%= mahasiswa.nama %></h3>
        <p class="text-muted">NIM: <%= mahasiswa.nim %> | Jurusan: <%= mahasiswa.jurusan %></p>
        <hr>
        <% if (pendaftaran) { %>
          <div class="alert alert-info">
            <strong>Status Pendaftaran:</strong> <%= pendaftaran.status %>
          </div>
        <% } else { %>
          <p>Anda belum mendaftar wisuda.</p>
        <% } %>
      </div>
    </div>
  </div>
</body>
</html>
`);

// 11. views/dashboard_admin.ejs
fs.writeFileSync('views/dashboard_admin.ejs', `<!DOCTYPE html>
<html>
<head>
  <title><%= title %></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body style="background: #f5f5f5;">
  <nav class="navbar navbar-dark bg-success">
    <div class="container">
      <span class="navbar-brand">Dashboard Admin</span>
      <a href="/auth/logout" class="btn btn-light btn-sm">Logout</a>
    </div>
  </nav>
  <div class="container mt-5">
    <div class="card">
      <div class="card-body">
        <h3>Admin Panel</h3>
        <p>Total Pendaftar: <strong><%= stats.total %></strong></p>
      </div>
    </div>
  </div>
</body>
</html>
`);

console.log('✅ views/dashboard_mahasiswa.ejs');
console.log('✅ views/dashboard_admin.ejs');

console.log('\n✨ Setup selesai!\n');
console.log('📝 Langkah selanjutnya:');
console.log('1. Import database: mysql -u root -p < database/schema.sql');
console.log('2. Jalankan: npm start');
console.log('3. Buka: http://localhost:3000\n');
console.log('💡 File index.ejs dan register.ejs sudah ada di artifacts Claude\n');



