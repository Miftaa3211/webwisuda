require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const multer = require('multer');


const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session
app.use(session({
  secret: 'wisuda-polinela-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 } // 1 hour
}));

// Flash messages
app.use(flash());

// Global variables
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

// Routes
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const mahasiswaRoutes = require('./routes/mahasiswa');
const adminRoutes = require('./routes/admin');

app.use('/', publicRoutes);
app.use('/auth', authRoutes);
app.use('/mahasiswa', mahasiswaRoutes);
app.use('/admin', adminRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('404', { title: '404 - Halaman Tidak Ditemukan' });
});

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server berjalan di http://0.0.0.0:${PORT}`);
});
