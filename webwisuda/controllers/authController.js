const db = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ============================================
// 1. REGISTRASI
// ============================================
exports.showRegister = (req, res) => {
  res.render('register', { title: 'Registrasi Akun' });
};

exports.register = async (req, res) => {
  try {
    let { email, password, password_confirm, nim, nama, jurusan, prodi, angkatan, no_hp, alamat } = req.body;
    email = email.trim(); 

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
    req.flash('error_msg', 'Terjadi kesalahan saat registrasi');
    res.redirect('/auth/register');
  }
};

// ============================================
// 2. LOGIN & LOGOUT
// ============================================
// Di file controllers/authController.js

exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;
    email = email.trim();

    console.log('--- DEBUG LOGIN START ---'); // Cek Terminal
    console.log('Email Input:', email);

    // 1. Cek User
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      console.log('❌ User tidak ditemukan di database');
      req.flash('error_msg', 'Email tidak terdaftar');
      return res.redirect('/');
    }

    const user = users[0];
    console.log('✅ User ditemukan:', user.role);

    // 2. Cek Password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password Match Result:', isMatch); // Harus TRUE

    if (!isMatch) {
      console.log('❌ Password Salah');
      req.flash('error_msg', 'Password salah');
      return res.redirect('/');
    }

    // 3. Set Session (PENTING: Perhatikan tanda koma)
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      nama: user.nama || user.email,
      prodi: user.prodi || null,
      jurusan: user.jurusan || null
    };

    console.log('✅ Session Created. Role:', user.role);

    // 4. Redirect Logic (Support untuk semua jenis admin)
    // Cek apakah role mengandung kata 'admin' (misal: admin_prodi, admin_jurusan, super_admin)
    if (user.role && user.role.includes('admin')) {
      console.log('➡️ Redirecting to /admin/dashboard');
      return res.redirect('/admin/dashboard');
    } else {
      console.log('➡️ Redirecting to /mahasiswa/dashboard');
      return res.redirect('/mahasiswa/dashboard');
    }

  } catch (error) {
    console.error('CRITICAL ERROR LOGIN:', error);
    req.flash('error_msg', 'Terjadi kesalahan sistem');
    res.redirect('/');
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/'));
};

// ============================================
// 3. FORGOT PASSWORD (Kirim Email)
// ============================================
exports.forgotPassword = async (req, res) => {
  try {
    let { email } = req.body;
    
    console.log('=== FORGOT PASSWORD DEBUG ===');
    console.log('Raw req.body:', req.body);
    console.log('Raw email:', email);
    console.log('Email type:', typeof email);
    
    if (email === undefined || email === null) {
        console.log('❌ Email undefined atau null');
        return res.json({ 
          success: false, 
          message: 'Email tidak ditemukan dalam request.' 
        });
    }
    
    email = email.trim().toLowerCase();
    
    if (email === '') {
        console.log('❌ Email kosong setelah trim');
        return res.json({ 
          success: false, 
          message: 'Email tidak boleh kosong.' 
        });
    }
    
    console.log('✅ Email setelah trim:', email);
    console.log('Email length:', email.length);
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        console.log('❌ Format email tidak valid');
        return res.json({ 
          success: false, 
          message: 'Format email tidak valid.' 
        });
    }
    
    console.log('🔍 Mencari email di database:', email);
    const [users] = await db.query(
      'SELECT id, email FROM users WHERE LOWER(TRIM(email)) = ?', 
      [email]
    );
    
    console.log('📊 Jumlah user ditemukan:', users.length);
    
    if (users.length === 0) {
      console.log('❌ Email tidak terdaftar');
      return res.json({
        success: false,
        message: 'Email tidak terdaftar dalam sistem.'
      });
    }
    
    const user = users[0];
    console.log('✅ User ditemukan:', user.email);
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 jam
    
    console.log('🔑 Token generated:', resetToken.substring(0, 10) + '...');
    
    await db.query(
      'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
      [resetToken, resetTokenExpiry, user.id]
    );
    
    console.log('💾 Token disimpan ke database');
    console.log('\n=== DEBUG EMAIL CONFIGURATION ===');
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
    console.log('EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);
    console.log('EMAIL_PASS preview:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.substring(0, 4) + '****' : 'NOT SET');
    console.log('=================================\n');
    // ========================================
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    

    const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;
    console.log('🔗 Reset URL:', resetUrl);
    
    const mailOptions = {
      from: '"Wisuda Polinela" <no-reply@polinela.ac.id>',
      to: user.email,
      subject: 'Reset Password - Wisuda Polinela',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0047AB 0%, #0066FF 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #0047AB; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🔐 Reset Password</h2>
              <p>Wisuda Online Politeknik Negeri Lampung</p>
            </div>
            <div class="content">
              <h3>Halo,</h3>
              <p>Kami menerima permintaan untuk mereset password akun wisuda online Anda.</p>
              <p>Klik tombol di bawah ini untuk membuat password baru:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              <p><strong>Link berlaku selama 1 jam</strong></p>
              <p>Atau copy link berikut ke browser Anda:</p>
              <p style="word-break: break-all; background: #fff; padding: 10px; border-left: 4px solid #0047AB;">
                ${resetUrl}
              </p>
              <hr>
              <p style="color: #999; font-size: 14px;">
                Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah.
              </p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Politeknik Negeri Lampung. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    try {
      await transporter.sendMail(mailOptions);
      console.log('✅ Email berhasil dikirim ke:', user.email);
      
      return res.json({
        success: true,
        message: 'Link reset password telah dikirim ke email Anda.'
      });
    } catch (emailError) {
      console.error('❌ Error mengirim email:', emailError);
      
      await db.query(
        'UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
        [user.id]
      );
      
      return res.json({
        success: false,
        message: 'Gagal mengirim email. Silakan coba lagi atau hubungi admin.'
      });
    }
    
  } catch (error) {
    console.error('=== FORGOT PASSWORD ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    return res.json({
      success: false,
      message: 'Terjadi kesalahan server: ' + error.message
    });
  }
}; // <-- INI YANG HILANG! KURUNG KURAWAL PENUTUP

// ============================================
// 4. RESET PASSWORD (Tampilkan Form)
// ============================================
exports.showResetPasswordForm = async (req, res) => {
  try {
    const { token } = req.params;
    
    const [users] = await db.query(
      'SELECT id, email, reset_token_expiry FROM users WHERE reset_token = ?',
      [token]
    );
    
    if (users.length === 0) {
      req.flash('error_msg', 'Token reset password tidak valid.');
      return res.redirect('/');
    }
    
    const user = users[0];
    
    if (new Date() > new Date(user.reset_token_expiry)) {
      req.flash('error_msg', 'Token sudah kadaluarsa. Silakan minta link baru.');
      return res.redirect('/');
    }
    
    res.render('reset-password', {
      token: token,
      email: user.email, // Tambahkan ini untuk ditampilkan di form
      error_msg: req.flash('error_msg') || '',
      success_msg: req.flash('success_msg') || ''
    });
    
  } catch (error) {
    console.error('Show Reset Form Error:', error);
    return res.redirect('/');
  }
};

// ============================================
// 5. RESET PASSWORD (Proses Update)
// ============================================
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, password_confirm } = req.body;
    
    if (password !== password_confirm) {
      req.flash('error_msg', 'Password tidak cocok.');
      return res.redirect(`/auth/reset-password/${token}`);
    }
    
    if (password.length < 6) {
      req.flash('error_msg', 'Password minimal 6 karakter.');
      return res.redirect(`/auth/reset-password/${token}`);
    }
    
    const [users] = await db.query(
      'SELECT id, reset_token_expiry FROM users WHERE reset_token = ?',
      [token]
    );
    
    if (users.length === 0) {
      req.flash('error_msg', 'Token tidak valid.');
      return res.redirect('/');
    }
    
    const user = users[0];
    
    if (new Date() > new Date(user.reset_token_expiry)) {
      req.flash('error_msg', 'Token sudah kadaluarsa.');
      return res.redirect('/');
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await db.query(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );
    
    req.flash('success_msg', 'Password berhasil diubah! Silakan login.');
    return res.redirect('/?resetSuccess=true');
    
  } catch (error) {
    console.error('Reset Password Error:', error);
    req.flash('error_msg', 'Terjadi kesalahan sistem.');
    return res.redirect(`/auth/reset-password/${token}`);
  }
};
