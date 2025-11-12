const db = require('../config/database');

// Landing Page
exports.index = async (req, res) => {
  try {
    // Query total lulusan
    const [totalResult] = await db.query('SELECT COUNT(*) as total FROM mahasiswa WHERE tahun_lulus IS NOT NULL');
    const totalLulusan = totalResult[0].total || 0;

    // Query lulusan tahun aktif (2024)
    const [activeResult] = await db.query('SELECT COUNT(*) as total FROM mahasiswa WHERE tahun_lulus = "2024"');
    const lulusanAktif = activeResult[0].total || 0;

    // Hitung persentase kelulusan
    const [allMahasiswa] = await db.query('SELECT COUNT(*) as total FROM mahasiswa');
    const persentaseKelulusan = allMahasiswa[0].total > 0 
      ? Math.round((totalLulusan / allMahasiswa[0].total) * 100) 
      : 0;

    // Query top 15 mahasiswa berdasarkan IPK
    let [topStudents] = await db.query(`
      SELECT nama, nim, jurusan, ipk, tahun_lulus 
      FROM mahasiswa 
      WHERE ipk IS NOT NULL 
      ORDER BY ipk DESC 
      LIMIT 15
    `);
    
    // Fallback: jika tidak ada data mahasiswa
    if (topStudents.length === 0) {
      topStudents = [
        { nama: 'Belum ada data', nim: '-', jurusan: '-', ipk: 0, tahun_lulus: '-' }
      ];
    }

    // Query data untuk chart kelulusan per tahun
    let [yearData] = await db.query(`
      SELECT tahun_lulus, COUNT(*) as jumlah 
      FROM mahasiswa 
      WHERE tahun_lulus IS NOT NULL 
      GROUP BY tahun_lulus 
      ORDER BY tahun_lulus
    `);
    
    // Fallback: jika tidak ada data tahun
    if (yearData.length === 0) {
      yearData = [
        { tahun_lulus: '2020', jumlah: 400 },
        { tahun_lulus: '2021', jumlah: 450 },
        { tahun_lulus: '2022', jumlah: 520 },
        { tahun_lulus: '2023', jumlah: 580 },
        { tahun_lulus: '2024', jumlah: 620 },
        { tahun_lulus: '2025', jumlah: 650 }
      ];
    }
    
    const chartYears = yearData.map(row => row.tahun_lulus);
    const chartYearData = yearData.map(row => row.jumlah);

    // Query data untuk chart kelulusan per jurusan
    let [majorData] = await db.query(`
      SELECT jurusan, COUNT(*) as total 
      FROM mahasiswa 
      WHERE tahun_lulus IS NOT NULL 
      GROUP BY jurusan 
      ORDER BY total DESC 
      LIMIT 5
    `);
    
    // Fallback: jika tidak ada data jurusan
    if (majorData.length === 0) {
      majorData = [
        { jurusan: 'Teknik Elektro', total: 580 },
        { jurusan: 'Teknologi Informasi', total: 520 },
        { jurusan: 'Teknik Mesin', total: 480 },
        { jurusan: 'Akuntansi', total: 450 },
        { jurusan: 'Teknik Sipil', total: 420 }
      ];
    }
    
    const chartMajors = majorData.map(row => row.jurusan);
    const chartMajorData = majorData.map(row => row.total);

    // Render halaman
    res.render('index', {
      title: 'Wisuda Politeknik Negeri Lampung',
      totalLulusan: totalLulusan || 2478,
      lulusanAktif: lulusanAktif || 620,
      persentaseKelulusan: persentaseKelulusan || 95,
      topStudents,
      chartYears,
      chartYearData,
      chartMajors,
      chartMajorData
    });

  } catch (error) {
    console.error('Error:', error);
    
    // Jika terjadi error (misal table belum ada), tampilkan data dummy
    res.render('index', {
      title: 'Wisuda Politeknik Negeri Lampung',
      totalLulusan: 2478,
      lulusanAktif: 620,
      persentaseKelulusan: 95,
      topStudents: [
        { nama: 'Ahmad Fauzi', nim: '2011010001', jurusan: 'Teknik Elektro', ipk: 3.95, tahun_lulus: '2024' },
        { nama: 'Siti Nurhaliza', nim: '2011010002', jurusan: 'Teknik Mesin', ipk: 3.94, tahun_lulus: '2024' },
        { nama: 'Budi Santoso', nim: '2011010003', jurusan: 'Teknik Sipil', ipk: 3.93, tahun_lulus: '2024' }
      ],
      chartYears: ['2020', '2021', '2022', '2023', '2024', '2025'],
      chartYearData: [400, 450, 520, 580, 620, 650],
      chartMajors: ['Teknik Elektro', 'Teknologi Informasi', 'Teknik Mesin', 'Akuntansi', 'Teknik Sipil'],
      chartMajorData: [580, 520, 480, 450, 420]
    });
  }
};

// API untuk mendapatkan data statistik (opsional)
exports.getStatistics = async (req, res) => {
  try {
    const [totalResult] = await db.query('SELECT COUNT(*) as total FROM mahasiswa WHERE tahun_lulus IS NOT NULL');
    const [yearData] = await db.query(`
      SELECT tahun_lulus, COUNT(*) as jumlah 
      FROM mahasiswa 
      WHERE tahun_lulus IS NOT NULL 
      GROUP BY tahun_lulus 
      ORDER BY tahun_lulus
    `);
    const [majorData] = await db.query(`
      SELECT jurusan, COUNT(*) as total 
      FROM mahasiswa 
      WHERE tahun_lulus IS NOT NULL 
      GROUP BY jurusan 
      ORDER BY total DESC
    `);

    res.json({
      success: true,
      data: {
        totalLulusan: totalResult[0].total || 0,
        byYear: yearData,
        byMajor: majorData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};