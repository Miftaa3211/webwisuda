-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 12, 2025 at 10:03 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.1.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `wisuda_polinela`
--

-- --------------------------------------------------------

--
-- Table structure for table `dokumen_wisuda`
--

CREATE TABLE `dokumen_wisuda` (
  `id` int(11) NOT NULL,
  `pendaftaran_id` int(11) NOT NULL,
  `jenis_dokumen` enum('KTP','KK','KTM','Transkrip','Foto','TOEIC','Bebas_Tanggungan','Cover_TA') NOT NULL,
  `nama_file` varchar(255) NOT NULL,
  `path_file` varchar(255) NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `mahasiswa`
--

CREATE TABLE `mahasiswa` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `nim` varchar(20) NOT NULL,
  `nama` varchar(100) NOT NULL,
  `jurusan` varchar(100) NOT NULL,
  `prodi` varchar(100) NOT NULL,
  `angkatan` varchar(10) DEFAULT NULL,
  `ipk` decimal(3,2) DEFAULT NULL,
  `tahun_lulus` varchar(10) DEFAULT NULL,
  `no_hp` varchar(20) DEFAULT NULL,
  `alamat` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `mahasiswa`
--

INSERT INTO `mahasiswa` (`id`, `user_id`, `nim`, `nama`, `jurusan`, `prodi`, `angkatan`, `ipk`, `tahun_lulus`, `no_hp`, `alamat`, `created_at`) VALUES
(1, 2, '2011010001', 'Ahmad Fauzi', 'Teknik Elektro', 'Teknik Elektronika', '2020', 3.95, '2024', '081234567801', 'Bandar Lampung', '2025-11-12 07:29:14'),
(2, 2, '2011010002', 'Siti Nurhaliza', 'Teknik Mesin', 'Teknik Mesin Produksi', '2020', 3.94, '2024', '081234567802', 'Metro', '2025-11-12 07:29:14'),
(3, 2, '2011010003', 'Budi Santoso', 'Teknik Sipil', 'Teknik Konstruksi Gedung', '2020', 3.93, '2024', '081234567803', 'Lampung Selatan', '2025-11-12 07:29:14'),
(4, 2, '2011010004', 'Dewi Lestari', 'Akuntansi', 'Akuntansi Keuangan', '2020', 3.92, '2024', '081234567804', 'Bandar Lampung', '2025-11-12 07:29:14'),
(5, 2, '2011010005', 'Eko Prasetyo', 'Teknologi Informasi', 'Teknik Informatika', '2020', 3.91, '2024', '081234567805', 'Lampung Timur', '2025-11-12 07:29:14'),
(6, 2, '2011010006', 'Fitri Handayani', 'Administrasi Niaga', 'Administrasi Bisnis', '2020', 3.90, '2024', '081234567806', 'Pringsewu', '2025-11-12 07:29:14'),
(7, 2, '2011010007', 'Guntur Wijaya', 'Teknik Elektro', 'Teknik Telekomunikasi', '2020', 3.89, '2024', '081234567807', 'Bandar Lampung', '2025-11-12 07:29:14'),
(8, 2, '2011010008', 'Hani Rahmawati', 'Akuntansi', 'Akuntansi Perpajakan', '2020', 3.88, '2024', '081234567808', 'Lampung Tengah', '2025-11-12 07:29:14'),
(9, 2, '2011010009', 'Irfan Maulana', 'Teknik Mesin', 'Teknik Alat Berat', '2020', 3.87, '2024', '081234567809', 'Metro', '2025-11-12 07:29:14'),
(10, 2, '2011010010', 'Joko Susilo', 'Teknologi Informasi', 'Sistem Informasi Bisnis', '2020', 3.86, '2024', '081234567810', 'Bandar Lampung', '2025-11-12 07:29:14'),
(11, 2, '2011010011', 'Kartika Sari', 'Teknik Sipil', 'Teknik Perancangan Jalan', '2020', 3.85, '2024', '081234567811', 'Lampung Utara', '2025-11-12 07:29:14'),
(12, 2, '2011010012', 'Lutfi Rahman', 'Administrasi Niaga', 'Administrasi Perkantoran', '2020', 3.84, '2024', '081234567812', 'Pesawaran', '2025-11-12 07:29:14'),
(13, 2, '2011010013', 'Maya Safitri', 'Teknik Elektro', 'Teknik Listrik', '2020', 3.83, '2024', '081234567813', 'Bandar Lampung', '2025-11-12 07:29:14'),
(14, 2, '2011010014', 'Nur Hidayat', 'Teknologi Informasi', 'Teknik Komputer', '2020', 3.82, '2024', '081234567814', 'Lampung Selatan', '2025-11-12 07:29:14'),
(15, 2, '2011010015', 'Oki Firmansyah', 'Teknik Mesin', 'Teknik Otomotif', '2020', 3.81, '2024', '081234567815', 'Metro', '2025-11-12 07:29:14'),
(16, 2, '2017010001', 'Lulusan 2020 - 1', 'Teknik Elektro', 'Teknik Elektronika', NULL, 3.45, '2020', NULL, NULL, '2025-11-12 07:29:14'),
(17, 2, '2017010002', 'Lulusan 2020 - 2', 'Teknik Mesin', 'Teknik Mesin Produksi', NULL, 3.32, '2020', NULL, NULL, '2025-11-12 07:29:14'),
(18, 2, '2017010003', 'Lulusan 2020 - 3', 'Teknik Sipil', 'Teknik Konstruksi', NULL, 3.28, '2020', NULL, NULL, '2025-11-12 07:29:14'),
(19, 2, '2017010004', 'Lulusan 2020 - 4', 'Akuntansi', 'Akuntansi Keuangan', NULL, 3.56, '2020', NULL, NULL, '2025-11-12 07:29:14'),
(20, 2, '2017010005', 'Lulusan 2020 - 5', 'Teknologi Informasi', 'Teknik Informatika', NULL, 3.67, '2020', NULL, NULL, '2025-11-12 07:29:14'),
(21, 4, '23753064', 'miftaaaa', 'Teknologi Informasi', 'teknik informatika', '2021', NULL, NULL, '083123740394', 'wdasdasd', '2025-11-12 08:44:05');

-- --------------------------------------------------------

--
-- Table structure for table `pendaftaran_wisuda`
--

CREATE TABLE `pendaftaran_wisuda` (
  `id` int(11) NOT NULL,
  `mahasiswa_id` int(11) NOT NULL,
  `tanggal_daftar` date NOT NULL,
  `status` enum('Diajukan','Diverifikasi','Ditolak') DEFAULT 'Diajukan',
  `catatan` text DEFAULT NULL,
  `verified_by` int(11) DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pengumuman`
--

CREATE TABLE `pengumuman` (
  `id` int(11) NOT NULL,
  `judul` varchar(200) NOT NULL,
  `konten` text NOT NULL,
  `tanggal_mulai` date DEFAULT NULL,
  `tanggal_selesai` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('mahasiswa','admin') DEFAULT 'mahasiswa',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `password`, `role`, `created_at`) VALUES
(1, 'admin@polinela.ac.id', '$2b$10$YourHashedPasswordHere', 'admin', '2025-11-12 07:29:14'),
(2, 'mahasiswa1@polinela.ac.id', '$2b$10$YourHashedPasswordHere', 'mahasiswa', '2025-11-12 07:29:14'),
(3, 'mahasiswa2@polinela.ac.id', '$2b$10$YourHashedPasswordHere', 'mahasiswa', '2025-11-12 07:29:14'),
(4, 'mfhtarizkyy@gmail.com', '$2b$10$I4m4m9jrSrcUdXhvFdlMf.sJJxTG6twH4sdAuq7ddKSW5gYVbuAUK', 'mahasiswa', '2025-11-12 08:44:05');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `dokumen_wisuda`
--
ALTER TABLE `dokumen_wisuda`
  ADD PRIMARY KEY (`id`),
  ADD KEY `pendaftaran_id` (`pendaftaran_id`);

--
-- Indexes for table `mahasiswa`
--
ALTER TABLE `mahasiswa`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nim` (`nim`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `pendaftaran_wisuda`
--
ALTER TABLE `pendaftaran_wisuda`
  ADD PRIMARY KEY (`id`),
  ADD KEY `mahasiswa_id` (`mahasiswa_id`),
  ADD KEY `verified_by` (`verified_by`);

--
-- Indexes for table `pengumuman`
--
ALTER TABLE `pengumuman`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `dokumen_wisuda`
--
ALTER TABLE `dokumen_wisuda`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `mahasiswa`
--
ALTER TABLE `mahasiswa`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `pendaftaran_wisuda`
--
ALTER TABLE `pendaftaran_wisuda`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pengumuman`
--
ALTER TABLE `pengumuman`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `dokumen_wisuda`
--
ALTER TABLE `dokumen_wisuda`
  ADD CONSTRAINT `dokumen_wisuda_ibfk_1` FOREIGN KEY (`pendaftaran_id`) REFERENCES `pendaftaran_wisuda` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `mahasiswa`
--
ALTER TABLE `mahasiswa`
  ADD CONSTRAINT `mahasiswa_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `pendaftaran_wisuda`
--
ALTER TABLE `pendaftaran_wisuda`
  ADD CONSTRAINT `pendaftaran_wisuda_ibfk_1` FOREIGN KEY (`mahasiswa_id`) REFERENCES `mahasiswa` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `pendaftaran_wisuda_ibfk_2` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
