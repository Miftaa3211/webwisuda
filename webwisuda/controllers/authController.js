const db = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ============================================
// 1. REGISTRASI (TAMPILKAN FORM)
// ============================================
exports.showRegister = (req, res) => {
  res.render('register', { title: 'Registrasi Akun' });
};

// ============================================
// 2. PROSES REGISTRASI
// ============================================
exports.register = async (req, res) => {
  try {
    let { email, password, password_confirm, nim, nama, jurusan, prodi, angkatan, no_hp, alamat } = req.body;
    
    email = email.trim().toLowerCase(); 
    nim = nim.trim();
    nama = nama.trim(); 
    
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
    console.error('Error Register:', error);
    req.flash('error_msg', 'Terjadi kesalahan saat registrasi.');
    res.redirect('/auth/register');
  }
};

// ============================================
// 3. LOGIN (SUDAH DIPERBAIKI)
// ============================================
exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;
    email = email.trim().toLowerCase();

    // Ambil data user beserta kolom SCOPE
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (!users.length) {
      return res.status(401).json({ success: false, message: 'Email tidak terdaftar' });
    }

    const valid = await bcrypt.compare(password, users[0].password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Password salah' });
    }

    // [BAGIAN PENTING YANG DIPERBAIKI]
    // Menyimpan scope ke dalam session agar bisa dibaca di dashboard admin
    req.session.user = {
      id: users[0].id,
      email: users[0].email,
      role: users[0].role,
      nama: users[0].nama,
      scope: users[0].scope  // <--- INI BARIS KUNCINYA
    };

    let targetUrl = '/';
    if (['admin', 'admin_jurusan', 'admin_prodi', 'admin_labbahasa'].includes(users[0].role)) {
        targetUrl = '/admin/monitoring';
    } else if (users[0].role === 'mahasiswa') {
        targetUrl = '/mahasiswa/dashboard';
    }

    req.session.save((err) => {
        if (err) return res.status(500).json({ success: false, message: 'Gagal menyimpan sesi.' });
        return res.json({ success: true, redirect: targetUrl });
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ============================================
// 4. LOGOUT
// ============================================
exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) console.error('Logout error:', err);
    res.redirect('/auth/login');
  });
};

// ============================================
// 5. LUPA PASSWORD
// ============================================
exports.forgotPassword = async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) return res.json({ success: false, message: 'Email tidak boleh kosong.' });
    email = email.trim().toLowerCase();
    
    const [users] = await db.query('SELECT id, email FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.json({ success: false, message: 'Email tidak terdaftar.' });
    
    const user = users[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); 
    
    await db.query('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?', [resetToken, resetTokenExpiry, user.id]);
    
    const transporter = nodemailer.createTransport({
      service: 'gmail', 
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;
    
    await transporter.sendMail({
      from: '"Wisuda Polinela" <no-reply@polinela.ac.id>',
      to: user.email,
      subject: 'Reset Password',
      html: `<p>Klik link berikut: <a href="${resetUrl}">${resetUrl}</a></p>`
    });
    
    return res.json({ success: true, message: 'Link reset password telah dikirim ke email.' });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    return res.json({ success: false, message: 'Gagal mengirim email reset.' });
  }
};

exports.showResetPasswordForm = async (req, res) => {
  try {
    const { token } = req.params;
    const [users] = await db.query('SELECT * FROM users WHERE reset_token = ?', [token]);
    
    if (users.length === 0 || new Date() > new Date(users[0].reset_token_expiry)) {
      req.flash('error_msg', 'Token tidak valid.');
      return res.redirect('/');
    }
    
    res.render('reset-password', {
      token: token,
      email: users[0].email,
      error_msg: req.flash('error_msg') || '',
      success_msg: req.flash('success_msg') || ''
    });
  } catch (error) {
    console.error(error);
    return res.redirect('/');
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, password_confirm } = req.body;
    
    if (password !== password_confirm) {
        req.flash('error_msg', 'Password tidak cocok');
        return res.redirect(`/auth/reset-password/${token}`);
    }

    const [users] = await db.query('SELECT id FROM users WHERE reset_token = ?', [token]);
    if (users.length === 0) {
        req.flash('error_msg', 'Token invalid');
        return res.redirect('/');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?', [hashedPassword, users[0].id]);
    
    req.flash('success_msg', 'Password berhasil diubah! Silakan login.');
    return res.redirect('/?resetSuccess=true');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Terjadi kesalahan sistem.');
    return res.redirect(`/auth/reset-password/${token}`);
  }
};

// ============================================
// 6. CHECK NPM (FITUR AUTO-FILL)
// ============================================
exports.checkNPM = async (req, res) => {
  try {
    const { npm } = req.params;
    const [result] = await db.query('SELECT * FROM master_mahasiswa WHERE npm = ?', [npm]);

    if (result.length > 0) {
      return res.json({ success: true, data: result[0] });
    } else {
      return res.json({ success: false, message: 'Data NPM tidak ditemukan.' });
    }
  } catch (error) {
    console.error('Check NPM Error:', error);
    return res.json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};