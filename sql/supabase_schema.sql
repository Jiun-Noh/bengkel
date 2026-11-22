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
  no_transaksi text unique,        -- format INV-{tahun}-{6 digit urut}, diisi otomatis lewat trigger di bawah
  tgl text not null,               -- format "DD/MM/YYYY HH:MM", disamakan dengan aplikasi
  nama_pelanggan text,
  nomor_hp text,
  plat_kendaraan text,
  jenis_motor text,
  nama_jasa text,             -- gabungan nama semua jasa (dipisah koma), buat pencarian/tampilan ringkas
  nama_mekanik text,          -- gabungan nama semua mekanik (dipisah koma), buat pencarian/tampilan ringkas
  mekanik_items jsonb default '[]', -- rincian per mekanik: [{nama, persen}], persen dikunci saat transaksi dibuat (total maks 40%)
  biaya_jasa integer default 0,  -- total semua jasa
  jasa_items jsonb default '[]', -- rincian per jasa: [{id, nama, harga}]
  items jsonb default '[]',
  total_barang integer default 0,
  modal_keluar integer default 0,
  laba_barang integer default 0,
  total_bayar integer default 0,
  cara_bayar text default 'Tunai',
  uangdibayarkan integer default 0,
  sisa_bayar integer default 0,
  poin_didapat integer default 0,    -- poin member yang didapat dari transaksi ini
  poin_digunakan integer default 0,  -- poin member yang dipakai (dipotong dari total_bayar) di transaksi ini
  diskon_poin integer default 0,     -- nilai rupiah dari poin_digunakan (poin_digunakan x 1.000)
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
  persen_bagi_hasil integer default 8,  -- % komisi default saat kerja SOLO (maks 40, disepakati dgn pemilik); saat transaksi dikerjakan >1 mekanik, % masing2 diisi langsung di Transaksi & dikunci ke riwayat.mekanik_items
  persen_bagi_hasil_bersama numeric default 20,  -- % komisi saat kerja BERSAMA mekanik lain (diisi pemilik; total tiap transaksi diskalakan ke maks 40)
  nominal_telat_per_menit integer default 1000,  -- denda keterlambatan per menit, bisa beda tiap staf
  nominal_mangkir integer default 50000,  -- denda per hari Tanpa Keterangan (mangkir), bisa beda tiap staf
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
  jam_masuk_standar text default '09:00',  -- jam masuk standar (shop-wide), dasar hitung potongan telat di Laporan
  kata_sandi_laporan text default '1234',  -- legacy, tidak dipakai lagi sejak akses Laporan ditentukan oleh profil.peran
  check (id = 1)
);
insert into pengaturan (id) values (1);

create table pengeluaran (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  kategori text not null,   -- 'Operasional' | 'Maintenance' | 'Belanja Stok' (yang terakhir tidak dipotong dari Laba Bersih)
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

-- poin_ledger: poin member pelanggan (kunci = nomor_hp, tidak ada proses "daftar member" terpisah).
-- Disimpan per-batch (bukan satu angka saldo) supaya kadaluarsa 1 tahun per-batch bisa akurat —
-- lihat komentar lengkap di migrasi_poin_pelanggan.sql.
create table poin_ledger (
  id uuid primary key default gen_random_uuid(),
  nomor_hp text not null,
  nama text,
  tanggal date not null,
  jenis text not null check (jenis in ('earn', 'redeem')),
  jumlah integer not null,
  sisa integer not null default 0,
  kadaluarsa date,
  riwayat_id uuid references riwayat(id) on delete set null,
  dibuat_pada timestamptz default now()
);
create index idx_poin_ledger_hp on poin_ledger (nomor_hp);

-- hutang_supplier: tagihan dari supplier/distributor barang, belum/sudah lunas.
-- Sengaja tidak diikat ke baris `barang` tertentu — satu pengiriman biasanya berisi
-- banyak SKU dengan satu status pembayaran gabungan, jadi disimpan sebagai catatan bebas.
create table hutang_supplier (
  id uuid primary key default gen_random_uuid(),
  nama_supplier text not null,
  tanggal date not null,
  deskripsi text not null,
  nominal integer default 0,
  status text not null default 'Belum Lunas' check (status in ('Belum Lunas', 'Lunas')),  -- legacy, sejak hutang_supplier_pembayaran ada status dihitung dari situ
  tanggal_lunas date,  -- legacy, idem
  bulan text,
  dibuat_pada timestamptz default now()
);

-- hutang_supplier_pembayaran: ledger cicilan/pembayaran sebagian ke supplier — tiap baris = satu
-- kali bayar, supaya kwitansi bisa dicetak per pembayaran. Status Lunas/Belum Lunas & sisa tagihan
-- dihitung di client dari jumlah baris ini, bukan dari kolom status di atas.
create table hutang_supplier_pembayaran (
  id uuid primary key default gen_random_uuid(),
  hutang_supplier_id uuid not null references hutang_supplier(id) on delete cascade,
  tanggal date not null,
  nominal integer default 0,
  dibuat_pada timestamptz default now()
);
create index idx_hutang_supplier_pembayaran_hutang on hutang_supplier_pembayaran (hutang_supplier_id);

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
alter table hutang_supplier enable row level security;
alter table hutang_supplier_pembayaran enable row level security;
alter table poin_ledger enable row level security;

-- Helper: cek apakah user yang login sekarang berperan 'pemilik'.
-- security definer supaya select ke `profil` di sini gak kena RLS profil sendiri (hindari rekursi).
create or replace function is_pemilik() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profil where id = auth.uid() and peran = 'pemilik');
$$;

create policy "lihat profil sendiri" on profil for select using (auth.uid() = id);
create policy "pemilik kelola profil" on profil for all
  using (is_pemilik()) with check (is_pemilik());

-- barang: semua login bisa lihat, restock (update), dan daftarkan barang BARU (insert) —
-- termasuk isi harga_pokok/harga_jual-nya saat pendaftaran (permintaan eksplisit pemilik).
-- Hapus barang tetap cuma pemilik. Proteksi harga cuma berlaku buat UPDATE barang yang SUDAH
-- ADA (lewat trigger cegah_ubah_harga_barang di bawah) — mencegah harga barang lama diam-diam
-- diubah staf, bukan membatasi harga barang baru.
create policy "barang select" on barang for select using (auth.role() = 'authenticated');
create policy "barang insert" on barang for insert with check (auth.role() = 'authenticated');
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

-- poin_ledger: sama seperti riwayat — semua login bisa lihat/isi/ubah (dipakai/didapat pas transaksi
-- jalan di halaman Transaksi yang dipakai semua staf), hapus permanen cuma pemilik.
create policy "poin_ledger select" on poin_ledger for select using (auth.role() = 'authenticated');
create policy "poin_ledger insert" on poin_ledger for insert with check (auth.role() = 'authenticated');
create policy "poin_ledger update" on poin_ledger for update using (auth.role() = 'authenticated');
create policy "poin_ledger delete" on poin_ledger for delete using (is_pemilik());

-- pengaturan/investor/lembur/pengeluaran/hutang_supplier: layar Laporan seluruhnya khusus pemilik.
create policy "pengaturan pemilik" on pengaturan for all using (is_pemilik()) with check (is_pemilik());
create policy "investor pemilik" on investor for all using (is_pemilik()) with check (is_pemilik());
create policy "lembur pemilik" on lembur for all using (is_pemilik()) with check (is_pemilik());
create policy "pengeluaran pemilik" on pengeluaran for all using (is_pemilik()) with check (is_pemilik());
create policy "hutang_supplier pemilik" on hutang_supplier for all using (is_pemilik()) with check (is_pemilik());
create policy "hutang_supplier_pembayaran pemilik" on hutang_supplier_pembayaran for all using (is_pemilik()) with check (is_pemilik());

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

-- Perubahan stok/terjual/restock dihitung langsung di database (tambah/kurang dari nilai saat ini),
-- supaya data basi di HP atau dua HP jualan bersamaan nggak bikin penjualan hilang.
-- (lihat migrasi_stok_atomik.sql)
-- Jual (p_jumlah positif) atau kembalikan stok dari transaksi yang dihapus (p_jumlah negatif).
create or replace function jual_barang(p_kode text, p_jumlah integer) returns void
language plpgsql set search_path = public as $$
begin
  update barang
  set stok = coalesce(stok, 0) - p_jumlah,
      terjual = greatest(0, coalesce(terjual, 0) + p_jumlah)
  where kode = p_kode;
  if not found then
    raise exception 'Barang % tidak ditemukan', p_kode;
  end if;
end;
$$;

-- Pembelian stok (🛒 Pembelian di Katalog, khusus pemilik) — belanja barang dagangan BUKAN biaya;
-- stok + harga pokok rata-rata tertimbang + hutang supplier dalam satu fungsi. (lihat migrasi_pembelian.sql)
-- Realtime: alter publication supabase_realtime add table pembelian;
create table if not exists pembelian (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  bulan text not null,                 -- YYYY-MM
  nama_supplier text,
  -- [{kode, nama, jumlah, harga, subtotal, hargaPokokLama, hargaPokokBaru}] — harga = modal per
  -- satuan di pembelian INI (tersimpan, nggak berubah walau harga pokok barang nanti berubah)
  items jsonb not null default '[]',
  total integer not null default 0,
  status_bayar text not null check (status_bayar in ('Lunas', 'Hutang')),
  hutang_supplier_id uuid references hutang_supplier(id) on delete set null,
  waktu_restock text,                  -- "DD/MM/YYYY HH:MM" yang ditulis ke riwayat_restock
  dibuat_pada timestamptz default now()
);
create index if not exists idx_pembelian_bulan on pembelian (bulan);

alter table pembelian enable row level security;
drop policy if exists "pembelian pemilik" on pembelian;
create policy "pembelian pemilik" on pembelian for all using (is_pemilik()) with check (is_pemilik());

-- Catat pembelian: untuk tiap barang → stok & restock bertambah, entri riwayat_restock (ditandai
-- pembelian_id), Harga Pokok = rata-rata tertimbang. Kalau Hutang → otomatis masuk Hutang Supplier.
-- Semua dalam satu transaksi database: gagal satu, batal semua.
--
-- p_items: [{"kode": "...", "jumlah": 5, "harga": 69585}, ...]
create or replace function catat_pembelian(
  p_tanggal date,
  p_supplier text,
  p_items jsonb,
  p_status text,
  p_waktu text
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_id uuid := gen_random_uuid();
  v_it jsonb;
  v_kode text;
  v_jumlah integer;
  v_harga integer;
  v_brg record;
  v_hp_baru integer;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_desk text := '';
  v_hutang uuid;
  v_supplier text := nullif(trim(coalesce(p_supplier, '')), '');
begin
  if not is_pemilik() then
    raise exception 'Hanya pemilik yang boleh mencatat pembelian stok';
  end if;
  if p_status not in ('Lunas', 'Hutang') then
    raise exception 'Status bayar tidak dikenal: %', p_status;
  end if;
  if p_status = 'Hutang' and v_supplier is null then
    raise exception 'Pembelian hutang wajib isi nama supplier';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Belum ada barang yang dibeli';
  end if;

  for v_it in select * from jsonb_array_elements(p_items) loop
    v_kode := v_it->>'kode';
    v_jumlah := (v_it->>'jumlah')::integer;
    v_harga := (v_it->>'harga')::integer;
    if v_jumlah is null or v_jumlah <= 0 then
      raise exception 'Jumlah beli % harus minimal 1', v_kode;
    end if;
    if v_harga is null or v_harga < 0 then
      raise exception 'Harga beli % tidak boleh minus', v_kode;
    end if;

    select kode, nama, coalesce(stok, 0) as stok, coalesce(harga_pokok, 0) as harga_pokok
      into v_brg from barang where kode = v_kode for update;
    if not found then
      raise exception 'Barang % tidak ditemukan', v_kode;
    end if;

    -- Rata-rata tertimbang dari stok yang MASIH ADA. Stok 0/minus → pakai harga beli ini.
    if v_brg.stok <= 0 then
      v_hp_baru := v_harga;
    else
      v_hp_baru := round((v_brg.stok::numeric * v_brg.harga_pokok + v_jumlah::numeric * v_harga) / (v_brg.stok + v_jumlah));
    end if;

    update barang
    set stok = coalesce(stok, 0) + v_jumlah,
        restock = coalesce(restock, 0) + v_jumlah,
        harga_pokok = v_hp_baru,
        riwayat_restock = coalesce(riwayat_restock, '[]'::jsonb)
          || jsonb_build_array(jsonb_build_object('jumlah', v_jumlah, 'tanggal', p_waktu, 'pembelian_id', v_id))
    where kode = v_kode;

    v_total := v_total + v_jumlah * v_harga;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'kode', v_kode, 'nama', v_brg.nama, 'jumlah', v_jumlah, 'harga', v_harga,
      'subtotal', v_jumlah * v_harga, 'hargaPokokLama', v_brg.harga_pokok, 'hargaPokokBaru', v_hp_baru));
    v_desk := v_desk || case when v_desk = '' then '' else ', ' end || v_brg.nama || ' ×' || v_jumlah;
  end loop;

  if p_status = 'Hutang' then
    insert into hutang_supplier (nama_supplier, tanggal, deskripsi, nominal, bulan)
    values (v_supplier, p_tanggal, 'Pembelian: ' || v_desk, v_total, to_char(p_tanggal, 'YYYY-MM'))
    returning id into v_hutang;
  end if;

  insert into pembelian (id, tanggal, bulan, nama_supplier, items, total, status_bayar, hutang_supplier_id, waktu_restock)
  values (v_id, p_tanggal, to_char(p_tanggal, 'YYYY-MM'), v_supplier, v_items, v_total, p_status, v_hutang, p_waktu);

  return v_id;
end;
$$;

-- Batalkan pembelian (mis. salah input): stok & restock dikurangi lagi, entri riwayat_restock-nya
-- dihapus, hutang supplier-nya ikut dihapus. Ditolak kalau hutang itu sudah ada pembayarannya
-- (biar kwitansi yang sudah dicetak nggak kehilangan induknya).
-- Harga Pokok dikembalikan ke nilai sebelum pembelian HANYA kalau sejak itu belum berubah lagi
-- (masih persis hargaPokokBaru) — kalau sudah ada pembelian/edit lain, dibiarkan.
create or replace function batal_pembelian(p_id uuid) returns void
language plpgsql set search_path = public as $$
declare
  v_pb record;
  v_it jsonb;
begin
  if not is_pemilik() then
    raise exception 'Hanya pemilik yang boleh membatalkan pembelian stok';
  end if;

  select * into v_pb from pembelian where id = p_id for update;
  if not found then
    raise exception 'Pembelian ini tidak ditemukan (mungkin sudah dibatalkan dari HP lain)';
  end if;

  if v_pb.hutang_supplier_id is not null then
    if exists (select 1 from hutang_supplier_pembayaran where hutang_supplier_id = v_pb.hutang_supplier_id) then
      raise exception 'Hutang pembelian ini sudah ada pembayarannya. Hapus dulu pembayarannya di Laporan → Hutang Supplier.';
    end if;
    delete from hutang_supplier where id = v_pb.hutang_supplier_id;
  end if;

  -- urutan terbalik: kalau satu barang muncul dua kali, harga pokok dikembalikan berurutan
  for v_it in
    select el from jsonb_array_elements(v_pb.items) with ordinality as e(el, ord) order by ord desc
  loop
    update barang
    set stok = coalesce(stok, 0) - (v_it->>'jumlah')::integer,
        restock = coalesce(restock, 0) - (v_it->>'jumlah')::integer,
        harga_pokok = case when harga_pokok = (v_it->>'hargaPokokBaru')::integer
                           then (v_it->>'hargaPokokLama')::integer else harga_pokok end
    where kode = v_it->>'kode';
    -- barang sudah dihapus dari katalog → tidak ada yang perlu dikembalikan
  end loop;

  update barang b
  set riwayat_restock = (
    select coalesce(jsonb_agg(e.el order by e.ord), '[]'::jsonb)
    from jsonb_array_elements(b.riwayat_restock) with ordinality as e(el, ord)
    where e.el->>'pembelian_id' is distinct from p_id::text
  )
  where b.kode in (select el->>'kode' from jsonb_array_elements(v_pb.items) as x(el));

  delete from pembelian where id = p_id;
end;
$$;

-- Restock manual sekarang KHUSUS PEMILIK (di app, tombol 🔄 membuka 🛒 Pembelian).
create or replace function restock_barang(p_kode text, p_jumlah integer, p_tanggal text) returns void
language plpgsql set search_path = public as $$
begin
  if not is_pemilik() then
    raise exception 'Hanya pemilik yang boleh restock';
  end if;
  update barang
  set stok = coalesce(stok, 0) + p_jumlah,
      restock = coalesce(restock, 0) + p_jumlah,
      riwayat_restock = coalesce(riwayat_restock, '[]'::jsonb)
                        || jsonb_build_array(jsonb_build_object('jumlah', p_jumlah, 'tanggal', p_tanggal))
  where kode = p_kode;
  if not found then
    raise exception 'Barang % tidak ditemukan', p_kode;
  end if;
end;
$$;

-- Batal restock manual: khusus pemilik, dan entri hasil 🛒 Pembelian TIDAK bisa dibatalkan dari
-- sini (harus lewat Batalkan Pembelian, supaya catatan pembelian & hutangnya ikut beres).
create or replace function batal_restock_barang(p_kode text, p_jumlah integer, p_tanggal text) returns void
language plpgsql set search_path = public as $$
declare
  v_idx integer;
begin
  if not is_pemilik() then
    raise exception 'Hanya pemilik yang boleh membatalkan restock';
  end if;
  perform 1 from barang where kode = p_kode for update; -- kunci baris dulu
  if not found then
    raise exception 'Barang % tidak ditemukan', p_kode;
  end if;

  select e.ord - 1 into v_idx
  from barang b, jsonb_array_elements(coalesce(b.riwayat_restock, '[]'::jsonb)) with ordinality as e(el, ord)
  where b.kode = p_kode
    and (e.el->>'jumlah')::integer = p_jumlah
    and e.el->>'tanggal' = p_tanggal
    and not (e.el ? 'pembelian_id')
  order by e.ord
  limit 1;

  if v_idx is null then
    raise exception 'Riwayat restock ini tidak ditemukan (mungkin sudah dibatalkan, atau ini dari 🛒 Pembelian — batalkan lewat daftar Pembelian)';
  end if;

  update barang
  set stok = coalesce(stok, 0) - p_jumlah,
      restock = coalesce(restock, 0) - p_jumlah,
      riwayat_restock = riwayat_restock - v_idx
  where kode = p_kode;
end;
$$;

-- Nomor transaksi otomatis (INV-{tahun}-{6 digit urut}) buat riwayat, lewat tabel counter
-- per-tahun + trigger. insert...on conflict...returning atomik di Postgres, jadi aman dari
-- race condition kalau dua staf selesai transaksi nyaris bersamaan.
create table if not exists no_transaksi_counter (
  tahun integer primary key,
  terakhir integer not null default 0
);
alter table no_transaksi_counter enable row level security;
-- Sengaja tidak dikasih policy — tabel ini cuma disentuh lewat trigger security definer di bawah.

create or replace function set_no_transaksi() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  thn integer := extract(year from now());
  urut integer;
begin
  if new.no_transaksi is not null then
    return new;
  end if;
  insert into no_transaksi_counter (tahun, terakhir) values (thn, 1)
    on conflict (tahun) do update set terakhir = no_transaksi_counter.terakhir + 1
    returning terakhir into urut;
  new.no_transaksi := 'INV-' || thn || '-' || lpad(urut::text, 6, '0');
  return new;
end;
$$;
create trigger isi_no_transaksi before insert on riwayat
for each row execute function set_no_transaksi();

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
