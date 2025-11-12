const db = require('../config/database');
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
