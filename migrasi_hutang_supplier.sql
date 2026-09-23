-- Excel requirement #4: catat tagihan dari supplier/distributor barang — mana yang belum
-- dibayar dan mana yang sudah lunas. Sengaja tidak diikat ke baris `barang` tertentu, karena
-- satu pengiriman biasanya berisi banyak SKU dengan satu status pembayaran gabungan. Lihat
-- diskusi desain di riwayat chat untuk alasan lengkapnya.

create table hutang_supplier (
  id uuid primary key default gen_random_uuid(),
  nama_supplier text not null,
  tanggal date not null,
  deskripsi text not null,   -- catatan barang yang dikirim, bebas teks (mis. "Oli Castrol 20 botol, Ban 5 set")
  nominal integer default 0,
  status text not null default 'Belum Lunas' check (status in ('Belum Lunas', 'Lunas')),
  tanggal_lunas date,
  bulan text,   -- YYYY-MM, ikut pola tabel pengeluaran (buat filter kalau diperlukan nanti)
  dibuat_pada timestamptz default now()
);

alter table hutang_supplier enable row level security;

-- Sama seperti pengaturan/investor/lembur/pengeluaran: layar Laporan seluruhnya khusus pemilik.
create policy "hutang_supplier pemilik" on hutang_supplier for all using (is_pemilik()) with check (is_pemilik());

-- Daftarkan ke publication realtime, biar perubahan di tabel ini ikut ke-sync otomatis
-- seperti tabel lain (barang, riwayat, dst) — kalau baris ini gagal karena publication-nya
-- beda nama, cek nama publication realtime di Database > Replication di dashboard Supabase.
alter publication supabase_realtime add table hutang_supplier;
