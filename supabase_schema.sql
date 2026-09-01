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
  riwayat_restock jsonb default '[]'
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
  aktif boolean default true
);

create table pengaturan (
  id int primary key default 1,
  operasional integer default 0,
  maintenance integer default 0,
  persen_mekanik integer default 15,
  persen_investor integer default 15,
  kata_sandi_laporan text default '1234',
  check (id = 1)
);
insert into pengaturan (id) values (1);

alter table barang enable row level security;
alter table riwayat enable row level security;
alter table absensi enable row level security;
alter table staff enable row level security;
alter table pengaturan enable row level security;

create policy "auth full access" on barang for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth full access" on riwayat for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth full access" on absensi for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth full access" on staff for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth full access" on pengaturan for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
