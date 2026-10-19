-- Izinkan staf (bukan cuma pemilik) mendaftarkan barang BARU, termasuk mengisi harga_pokok/
-- harga_jual saat pendaftaran — ini permintaan eksplisit pemilik. Proteksi harga yang sudah ada
-- (trigger cegah_ubah_harga_barang) TETAP berlaku dan TIDAK diubah di sini: itu cuma menjaga
-- UPDATE harga barang yang SUDAH ADA (perubahan harga diam-diam di barang lama), bukan INSERT
-- barang baru — jadi keamanan intinya (harga barang existing tidak bisa diam-diam diubah staf)
-- tetap utuh. Restock (UPDATE stok barang existing) sudah dari dulu terbuka buat semua staf,
-- tidak berubah.

drop policy if exists "barang insert" on barang;
create policy "barang insert" on barang for insert with check (auth.role() = 'authenticated');
