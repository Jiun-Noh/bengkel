-- Excel requirement #5: sistem poin member pelanggan.
-- Aturan (dikonfirmasi user): 50.000 rupiah belanja = 2 poin, minimal 100 poin buat dipakai,
-- 1 poin = Rp 1.000, poin kadaluarsa 1 tahun sejak didapat (per-batch, bukan seluruh saldo).
--
-- Kunci identitas pelanggan pakai nomor HP (sudah dikumpulkan tiap transaksi, tidak ada
-- proses "daftar member" terpisah). Poin disimpan sebagai ledger per-batch (bukan satu angka
-- saldo) supaya kadaluarsa per-tahun bisa dihitung akurat: tiap baris 'earn' punya `sisa`
-- (poin dari batch ini yang belum kepakai) dan `kadaluarsa`; saat pakai poin (redeem), diambil
-- dari batch earn tertua yang masih berlaku dulu (FIFO), baru batch berikutnya kalau kurang.
-- Saldo berjalan = jumlah `sisa` dari semua batch earn yang kadaluarsa-nya belum lewat — jadi
-- otomatis "kadaluarsa" tanpa perlu job terjadwal buat membersihkan baris lama.

create table poin_ledger (
  id uuid primary key default gen_random_uuid(),
  nomor_hp text not null,
  nama text,
  tanggal date not null,
  jenis text not null check (jenis in ('earn', 'redeem')),
  jumlah integer not null,          -- earn: poin yang didapat. redeem: poin yang dipakai (histori saja)
  sisa integer not null default 0,  -- khusus earn: sisa poin batch ini yang masih bisa dipakai
  kadaluarsa date,                  -- khusus earn: tanggal + 1 tahun
  riwayat_id uuid references riwayat(id) on delete set null,
  dibuat_pada timestamptz default now()
);
create index idx_poin_ledger_hp on poin_ledger (nomor_hp);

alter table riwayat add column if not exists poin_didapat integer default 0;
alter table riwayat add column if not exists poin_digunakan integer default 0;
alter table riwayat add column if not exists diskon_poin integer default 0;

alter table poin_ledger enable row level security;

-- Sama seperti riwayat: semua login bisa lihat/isi/ubah (proses jual-beli & pemakaian poin
-- terjadi di halaman Transaksi yang dipakai semua staf), hapus permanen cuma pemilik.
create policy "poin_ledger select" on poin_ledger for select using (auth.role() = 'authenticated');
create policy "poin_ledger insert" on poin_ledger for insert with check (auth.role() = 'authenticated');
create policy "poin_ledger update" on poin_ledger for update using (auth.role() = 'authenticated');
create policy "poin_ledger delete" on poin_ledger for delete using (is_pemilik());

alter publication supabase_realtime add table poin_ledger;
