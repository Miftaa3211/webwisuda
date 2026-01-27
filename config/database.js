const mysql = require('mysql2');

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
