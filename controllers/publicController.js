const db = require('../config/database');

// =========================================
// 1. LANDING PAGE (INDEX)
// =========================================
exports.index = async (req, res) => {
  try {
    let infoWisuda = { periode: '-', tanggal: '-', deadline: '-', lokasi: '-' };
    try {
      const [settings] = await db.query('SELECT * FROM pengaturan_wisuda LIMIT 1');
      if (settings.length > 0) {
        const config = settings[0];
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        infoWisuda = {
          periode: config.periode_wisuda,
          tanggal: new Date(config.tanggal_wisuda).toLocaleDateString('id-ID', options),
          buka: config.tanggal_buka ? new Date(config.tanggal_buka).toLocaleDateString('id-ID', options) : '-',
          deadline: new Date(config.tenggat_pendaftaran).toLocaleDateString('id-ID', options),
          lokasi: config.lokasi,
          pesan: config.pesan_info
        };
      }
    } catch (e) { console.log('Info wisuda default'); }

    res.render('index', {
      title: 'Wisuda Politeknik Negeri Lampung',
      infoWisuda: infoWisuda
    });

  } catch (error) {
    console.error('Error Index:', error);
    res.render('index', { title: 'Wisuda Polinela', infoWisuda: {} });
  }
};

// =========================================
// 2. HALAMAN INFORMASI
// =========================================
exports.informasi = async (req, res) => {
  try {
    res.render('informasi', { title: 'Informasi Wisuda' });
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
};

// =========================================
// 3. HALAMAN STATISTIK
// =========================================
exports.statistik = async (req, res) => {
  try {
    const [totalResult] = await db.query('SELECT COUNT(*) as total FROM mahasiswa WHERE tahun_lulus IS NOT NULL');
    const totalLulusan = totalResult[0].total || 0;
    const currentYear = new Date().getFullYear(); 
    const [activeResult] = await db.query('SELECT COUNT(*) as total FROM mahasiswa WHERE tahun_lulus = ?', [currentYear]);
    const lulusanAktif = activeResult[0].total || 0;
    const [allMahasiswa] = await db.query('SELECT COUNT(*) as total FROM mahasiswa');
    const persentaseKelulusan = allMahasiswa[0].total > 0 
      ? Math.round((totalLulusan / allMahasiswa[0].total) * 100) 
      : 0;
    const [yearData] = await db.query(`SELECT tahun_lulus, COUNT(*) as jumlah FROM mahasiswa WHERE tahun_lulus IS NOT NULL GROUP BY tahun_lulus ORDER BY tahun_lulus ASC`);
    const [majorData] = await db.query(`SELECT jurusan, COUNT(*) as total FROM mahasiswa WHERE tahun_lulus IS NOT NULL GROUP BY jurusan ORDER BY total DESC`);
    const chartYears = yearData.map(row => row.tahun_lulus);
    const chartYearData = yearData.map(row => row.jumlah);
    const chartMajors = majorData.map(row => row.jurusan);
    const chartMajorData = majorData.map(row => row.total);

    res.render('statistik', {
      title: 'Statistik Kelulusan',
      totalLulusan, lulusanAktif, persentaseKelulusan,
      chartYears, chartYearData, chartMajors, chartMajorData
    });

  } catch (error) {
    console.error('Error Statistik:', error);
    res.render('statistik', {
      title: 'Statistik Kelulusan',
      totalLulusan: 0, lulusanAktif: 0, persentaseKelulusan: 0,
      chartYears: [], chartYearData: [], chartMajors: [], chartMajorData: []
    });
  }
};

// =========================================
// 4a. HALAMAN DAFTAR IPK (TABEL)
// =========================================
exports.daftarIPK = async (req, res) => {
  try {
    const [topStudents] = await db.query(`
      SELECT 
        m.nama, m.nim, m.prodi, m.jurusan, m.ipk, m.tahun_lulus,
        m.foto_profil as foto_akun,
        d.path_file as foto_berkas
      FROM mahasiswa m
      LEFT JOIN pendaftaran_wisuda p ON m.id = p.mahasiswa_id
      LEFT JOIN dokumen_wisuda d ON p.id = d.pendaftaran_id AND d.jenis_dokumen = 'Foto'
      WHERE m.ipk IS NOT NULL
      ORDER BY m.ipk DESC
      LIMIT 200
    `);

    res.render('daftar-ipk', {
      title: 'Daftar IPK Tertinggi',
      topStudents: topStudents
    });

  } catch (error) {
    console.error('Error Daftar IPK:', error);
    res.render('daftar-ipk', { title: 'Daftar IPK', topStudents: [] });
  }
};

// =========================================
// 4b. HALAMAN BEST OF THE BEST (JENJANG - IPK > 3.9)
// =========================================
exports.ipkPerJenjang = async (req, res) => {
  try {
    // 1. QUERY UTAMA: Ambil SEMUA mahasiswa dengan IPK > 3.9
    // Urutkan dari yang terbesar (DESC) agar 4.00 muncul duluan, lalu 3.98, dst.
    const [students] = await db.query(`
      SELECT 
        m.nama, m.nim, m.prodi, m.jurusan, m.ipk, m.tahun_lulus,
        m.foto_profil as foto_akun,
        d.path_file as foto_berkas
      FROM mahasiswa m
      LEFT JOIN pendaftaran_wisuda p ON m.id = p.mahasiswa_id
      LEFT JOIN dokumen_wisuda d ON p.id = d.pendaftaran_id AND d.jenis_dokumen = 'Foto'
      WHERE m.ipk > 3.9
      ORDER BY m.ipk DESC
    `);

    // 2. Fungsi Deteksi Jenjang
    const getJenjang = (prodiName) => {
      const p = (prodiName || '').toUpperCase();
      if (p.includes('S2') || p.includes('PASCASARJANA') || p.includes('MAGISTER')) return 'S2';
      if (p.includes('D4') || p.includes('SARJANA TERAPAN') || p.includes('S1')) return 'D4';
      if (p.includes('D3') || p.includes('DIPLOMA TIGA')) return 'D3';
      if (p.includes('D2') || p.includes('DIPLOMA DUA')) return 'D2';
      return 'Lainnya';
    };

    // 3. Grouping Mahasiswa ke dalam Jenjang
    // Tidak ada filter "Hanya Juara 1", semua yang lolos query (> 3.9) akan dimasukkan.
    let bestStudents = { 'D2': [], 'D3': [], 'D4': [], 'S2': [] };

    students.forEach(mhs => {
      const jenjang = getJenjang(mhs.prodi);
      
      // Pastikan array jenjang tersebut ada sebelum push
      if (bestStudents[jenjang]) {
        bestStudents[jenjang].push(mhs);
      }
    });

    res.render('ipk-tertinggi', {
      title: 'Mahasiswa Terbaik per Jenjang',
      bestStudents: bestStudents
    });

  } catch (error) {
    console.error('Error Page Best IPK:', error);
    res.redirect('/daftar-ipk');
  }
};
// =========================================
// 5. HALAMAN TENTANG (UPDATE: Tanggal Per Kloter)
// =========================================
exports.tentang = async (req, res) => {
  try {
    // 1. Ambil Data Pengaturan UMUM
    let infoWisuda = {
      periode: 'Belum Ditentukan',
      lokasi: '-'
    };

    const [settings] = await db.query('SELECT * FROM pengaturan_wisuda LIMIT 1');
    const options = { day: 'numeric', month: 'long', year: 'numeric' };

    if (settings.length > 0) {
      const s = settings[0];
      infoWisuda = {
        periode: s.periode_wisuda,
        lokasi: s.lokasi || 'Gedung Serba Guna'
      };
    }

    // 2. Ambil Kloter BESERTA Tanggal
    const [kloters] = await db.query(`
      SELECT 
        k.id, k.nama_kloter, k.kuota_maksimal, k.tanggal_wisuda, k.tanggal_buka, k.tanggal_tutup,
        (SELECT COUNT(*) FROM pendaftaran_wisuda p WHERE p.kloter_id = k.id) as terisi
      FROM kloter_wisuda k
      WHERE k.is_active = 1
      ORDER BY k.urutan ASC
    `);

    // Proses data kloter untuk view
    const daftarKloter = kloters.map(k => {
      const sisa = k.kuota_maksimal - k.terisi;
      
      const tglPelaksanaan = k.tanggal_wisuda 
        ? new Date(k.tanggal_wisuda).toLocaleDateString('id-ID', options) 
        : 'Belum ditentukan';
      
      // Format tanggal buka - tutup
      const tglBuka = k.tanggal_buka ? new Date(k.tanggal_buka).toLocaleDateString('id-ID', {day:'numeric', month:'short'}) : '?';
      const tglTutup = k.tanggal_tutup ? new Date(k.tanggal_tutup).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'}) : '?';

      return {
        nama: k.nama_kloter,
        pelaksanaan: tglPelaksanaan,
        masa_daftar: `${tglBuka} - ${tglTutup}`, // Format: 10 Jan - 20 Jan 2026
        sisa: sisa > 0 ? sisa : 0
      };
    });

    res.render('tentang', { 
      title: 'Tentang Wisuda Polinela',
      info: infoWisuda,
      kloters: daftarKloter 
    });

  } catch (error) {
    console.error('Error Halaman Tentang:', error);
    res.render('tentang', { 
      title: 'Tentang Wisuda Polinela',
      info: { periode: '-', lokasi: '-' },
      kloters: [] 
    });
  }
};

// =========================================
// 6. HALAMAN CALON WISUDAWAN (Filter Kloter)
// =========================================
exports.calonWisudawan = async (req, res) => {
  try {
    // 1. Ambil data mahasiswa yang SUDAH DIVERIFIKASI (Siap Wisuda)
    // Join ke tabel kloter untuk pengelompokan
    const [students] = await db.query(`
      SELECT 
        m.nama, m.nim, m.prodi, m.jurusan, m.tahun_lulus,
        m.foto_profil as foto_akun,
        d.path_file as foto_berkas,
        k.nama_kloter, k.id as kloter_id
      FROM pendaftaran_wisuda p
      JOIN mahasiswa m ON p.mahasiswa_id = m.id
      JOIN kloter_wisuda k ON p.kloter_id = k.id
      LEFT JOIN dokumen_wisuda d ON p.id = d.pendaftaran_id AND d.jenis_dokumen = 'Foto'
      WHERE p.status = 'Diverifikasi'
      ORDER BY k.urutan ASC, m.nama ASC
    `);

    // 2. Grouping Data Berdasarkan Kloter
    // Hasil: { 'Kloter 1': [mhs1, mhs2], 'Kloter 2': [mhs3] }
    let groupedByKloter = {};
    let kloterNames = [];

    students.forEach(mhs => {
      const kloterName = mhs.nama_kloter;
      
      if (!groupedByKloter[kloterName]) {
        groupedByKloter[kloterName] = [];
        kloterNames.push(kloterName); // Simpan nama kloter untuk urutan tab
      }
      
      groupedByKloter[kloterName].push(mhs);
    });

    res.render('calon-wisudawan', {
      title: 'Daftar Calon Wisudawan',
      groupedStudents: groupedByKloter,
      kloterList: kloterNames
    });

  } catch (error) {
    console.error('Error Calon Wisudawan:', error);
    res.redirect('/');
  }
};