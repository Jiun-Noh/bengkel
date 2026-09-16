-- Bengkel Manager: Supabase 스키마 + RLS 정책
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 실행하세요.

create table barang (
  kode text primary key,
  nama text not null,
  jenis_motor text,
  satuan text default 'PCS',
  harga_pokok integer default 0,
  harga_jual integer default 0,
  stok integer default 0,
  stok_awal integer default 0,
  restock integer default 0,
  terjual integer default 0,
  tanggal_stok_awal text,
  riwayat_restock jsonb default '[]',
  diubah_oleh uuid references auth.users(id),  -- jejak ringan: siapa terakhir insert/update baris ini
  diubah_pada timestamptz
);

create table riwayat (
  id uuid primary key default gen_random_uuid(),
  tgl text not null,               -- format "DD/MM/YYYY HH:MM", disamakan dengan aplikasi
  nama_pelanggan text,
  nomor_hp text,
  plat_kendaraan text,
  jenis_motor text,
  nama_jasa text,
  nama_mekanik text,
  biaya_jasa integer default 0,
  items jsonb default '[]',
  total_barang integer default 0,
  modal_keluar integer default 0,
  laba_barang integer default 0,
  total_bayar integer default 0,
  cara_bayar text default 'Tunai',
  uangdibayarkan integer default 0,
  sisa_bayar integer default 0,
  created_at timestamptz default now()
);

create table absensi (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  jam_datang text,
  jam_pulang text,
  jam_kerja text,
  jabatan text,
  nama text not null,
  status text,
  keterangan text,
  bulan text,
  unique (tanggal, nama)
);

create table staff (
  kode text primary key,
  nama text not null,
  jabatan text,
  aktif boolean default true,
  tanggal_mulai date,   -- tanggal mulai kerja, dipakai di surat pengalaman kerja/keterangan magang
  tanggal_keluar date,  -- tanggal keluar/selesai; kosong (null) berarti masih aktif bekerja
  gaji_pokok integer default 0,   -- Mekanik/Kasir/Lainnya: gaji pokok bulanan. Freelance: gaji harian (dibayar per hari hadir)
  uang_makan integer default 0,   -- uang makan bulanan (khusus Magang)
  uang_bensin integer default 0,  -- uang bensin bulanan (khusus Magang)
  uang_lembur_per_jam integer default 10000,  -- tarif lembur per jam, bisa beda tiap staf
  persen_bagi_hasil integer default 8,  -- % komisi dari jasa yang dilayani, bisa beda tiap staf (Mekanik/Freelance/Lainnya; tidak dipakai Kasir/Magang)
  diubah_oleh uuid references auth.users(id),  -- jejak ringan: siapa terakhir insert/update baris ini
  diubah_pada timestamptz
);

create table pengaturan (
  id int primary key default 1,
  operasional integer default 0,   -- legacy, tidak dipakai lagi sejak tabel `pengeluaran` ada (lihat di bawah)
  maintenance integer default 0,   -- legacy, tidak dipakai lagi sejak tabel `pengeluaran` ada
  persen_mekanik integer default 8,   -- legacy, tidak dipakai lagi sejak staff.persen_bagi_hasil per-staf ada
  persen_investor integer default 15,   -- legacy, tidak dipakai lagi sejak tabel `investor` per-investor punya % sendiri
  persen_pemilik integer default 60,    -- bagian pemilik dari Laba Bersih (kartu Pembagian Laba Bersih)
  persen_cadangan integer default 15,   -- dana cadangan/lainnya dari Laba Bersih
  kata_sandi_laporan text default '1234',  -- legacy, tidak dipakai lagi sejak akses Laporan ditentukan oleh profil.peran
  check (id = 1)
);
insert into pengaturan (id) values (1);

create table pengeluaran (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  kategori text not null,   -- 'Operasional' | 'Maintenance'
  deskripsi text not null,
  nominal integer default 0,
  bulan text,                -- YYYY-MM, buat filter cepat "bulan berjalan" di Laporan
  created_at timestamptz default now()
);

create table lembur (
  id uuid primary key default gen_random_uuid(),
  staff_kode text not null,
  bulan text not null,   -- YYYY-MM
  jam numeric default 0,
  unique (staff_kode, bulan)
);

create table investor (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  persen numeric default 0,   -- % bagian dari Laba Bersih bulanan (kartu Pembagian Laba Bersih)
  dibuat_pada timestamptz default now()
);

create table jasa (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  harga integer default 0,
  dibuat_pada timestamptz default now()
);

-- profil: akun login (auth.users) → nama tampil + peran (pemilik/karyawan).
-- Terpisah dari `staff` (data HR) supaya login & kepegawaian gak saling ganggu.
create table profil (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  peran text not null default 'karyawan' check (peran in ('pemilik', 'karyawan')),
  staff_kode text references staff(kode),
  dibuat_pada timestamptz default now()
);

alter table barang enable row level security;
alter table riwayat enable row level security;
alter table absensi enable row level security;
alter table staff enable row level security;
alter table pengaturan enable row level security;
alter table pengeluaran enable row level security;
alter table lembur enable row level security;
alter table investor enable row level security;
alter table jasa enable row level security;
alter table profil enable row level security;

-- Helper: cek apakah user yang login sekarang berperan 'pemilik'.
-- security definer supaya select ke `profil` di sini gak kena RLS profil sendiri (hindari rekursi).
create or replace function is_pemilik() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profil where id = auth.uid() and peran = 'pemilik');
$$;

create policy "lihat profil sendiri" on profil for select using (auth.uid() = id);
create policy "pemilik kelola profil" on profil for all
  using (is_pemilik()) with check (is_pemilik());

-- barang: semua login bisa lihat & restock (update), tapi cuma pemilik yang bisa
-- bikin barang baru / hapus. Ubah harga_pokok/harga_jual dijaga terpisah lewat trigger di bawah.
create policy "barang select" on barang for select using (auth.role() = 'authenticated');
create policy "barang insert" on barang for insert with check (is_pemilik());
create policy "barang update" on barang for update using (auth.role() = 'authenticated');
create policy "barang delete" on barang for delete using (is_pemilik());

-- jasa: semua login bisa lihat (buat dipilih di Transaksi), kelola katalog cuma pemilik.
create policy "jasa select" on jasa for select using (auth.role() = 'authenticated');
create policy "jasa insert" on jasa for insert with check (is_pemilik());
create policy "jasa update" on jasa for update using (is_pemilik());
create policy "jasa delete" on jasa for delete using (is_pemilik());

-- staff: semua login bisa lihat daftar (buat dropdown dsb), kelola data staf cuma pemilik.
create policy "staff select" on staff for select using (auth.role() = 'authenticated');
create policy "staff insert" on staff for insert with check (is_pemilik());
create policy "staff update" on staff for update using (is_pemilik());
create policy "staff delete" on staff for delete using (is_pemilik());

-- absensi: semua login bisa lihat/isi/ubah presensi, hapus permanen cuma pemilik.
create policy "absensi select" on absensi for select using (auth.role() = 'authenticated');
create policy "absensi insert" on absensi for insert with check (auth.role() = 'authenticated');
create policy "absensi update" on absensi for update using (auth.role() = 'authenticated');
create policy "absensi delete" on absensi for delete using (is_pemilik());

-- riwayat: semua login bisa lihat/buat transaksi & ubah (mis. catat pelunasan), hapus cuma pemilik.
create policy "riwayat select" on riwayat for select using (auth.role() = 'authenticated');
create policy "riwayat insert" on riwayat for insert with check (auth.role() = 'authenticated');
create policy "riwayat update" on riwayat for update using (auth.role() = 'authenticated');
create policy "riwayat delete" on riwayat for delete using (is_pemilik());

-- pengaturan/investor/lembur/pengeluaran: layar Laporan seluruhnya khusus pemilik.
create policy "pengaturan pemilik" on pengaturan for all using (is_pemilik()) with check (is_pemilik());
create policy "investor pemilik" on investor for all using (is_pemilik()) with check (is_pemilik());
create policy "lembur pemilik" on lembur for all using (is_pemilik()) with check (is_pemilik());
create policy "pengeluaran pemilik" on pengeluaran for all using (is_pemilik()) with check (is_pemilik());

-- Trigger: cegah karyawan mengubah harga_pokok/harga_jual barang lewat jalur UPDATE mana pun
-- (mis. langsung lewat API, bukan lewat form Restock di app). Restock sungguhan cuma ubah stok.
create or replace function cegah_ubah_harga_barang() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_pemilik() and (new.harga_pokok is distinct from old.harga_pokok or new.harga_jual is distinct from old.harga_jual) then
    raise exception 'Hanya pemilik yang boleh mengubah harga barang';
  end if;
  return new;
end;
$$;
create trigger jaga_harga_barang before update on barang
for each row execute function cegah_ubah_harga_barang();

-- Jejak ringan: catat siapa & kapan terakhir insert/update baris (bukan histori nilai lama,
-- cuma "siapa terakhir pegang ini" — buat barang & staff, yang paling sensitif).
create or replace function catat_perubahan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.diubah_oleh := auth.uid();
  new.diubah_pada := now();
  return new;
end;
$$;
create trigger catat_perubahan_barang before insert or update on barang
for each row execute function catat_perubahan();
create trigger catat_perubahan_staff before insert or update on staff
for each row execute function catat_perubahan();

insert into jasa (nama, harga) values
  ('Service CVT 110-150cc', 80000),
  ('Service CVT 250cc Up', 150000),
  ('Service Mesin Matic 110-150cc', 150000),
  ('Service Mesin Matic 250cc Up', 250000),
  ('Service Mesin Bebek 110-125cc', 100000),
  ('Service Mesin Bebek 150-200cc', 150000),
  ('Service Mesin Sport 250-300cc', 200000),
  ('Service Mesin Sport 400-500cc', 300000),
  ('Service Mesin Sport 600-1000cc', 450000),
  ('Service Mesin Sport 1000cc Up', 600000),
  ('Service Karburator/TB Matic', 60000),
  ('Service Karburator/TB Bebek', 50000),
  ('Service Karburator/TB Sport/Moge', 100000),
  ('Service Rantai & Gir Bebek', 40000),
  ('Service Rantai & Gir Sport/Moge', 80000),
  ('Service Rem Matic', 40000),
  ('Service Rem Bebek', 35000),
  ('Service Rem Sport/Moge', 60000),
  ('Service Shock Dpn Matic', 35000),
  ('Service Shock Blkg Matic', 35000),
  ('Service Shock Dpn Bebek', 30000),
  ('Service Shock Blkg Bebek', 30000),
  ('Service Shock Dpn Sport/Moge', 50000),
  ('Service Shock Blkg Sport/Moge', 50000),
  ('Jasa Ganti Oli Matic', 35000),
  ('Jasa Ganti Oli Bebek', 25000),
  ('Jasa Ganti Oli Sport/Moge', 50000),
  ('Jasa Pasang Part', 0),
  ('Jasa Lainnya', 0);
