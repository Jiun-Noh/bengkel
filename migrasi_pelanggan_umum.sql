-- Samakan nama pembeli tanpa data pelanggan jadi "Umum" (sesuai tombol 🚶 Pelanggan Umum di
-- halaman Transaksi). Data lama ada yang diketik manual "Unknown" / "unknown" / " UNKNOWN " dst.
-- Cuma kolom nama yang diganti — No. HP, poin, nominal, dll. tidak disentuh.
-- Baris bernama "-" (nama dikosongkan) SENGAJA tidak diubah: sebagian punya No. HP (pelanggan
-- yang cuma kasih nomor), jadi bukan pasti pembeli umum.

-- 1) Cek dulu berapa baris yang kena (opsional):
-- select count(*) from riwayat where upper(trim(nama_pelanggan)) = 'UNKNOWN';
-- select count(*) from poin_ledger where upper(trim(nama)) = 'UNKNOWN';

-- 2) Ganti:
update riwayat
set nama_pelanggan = 'Umum'
where upper(trim(nama_pelanggan)) = 'UNKNOWN';

update poin_ledger
set nama = 'Umum'
where upper(trim(nama)) = 'UNKNOWN';
