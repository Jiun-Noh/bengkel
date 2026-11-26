-- Rapikan belanja stok: semua belanja barang dagangan dikumpulkan di 🛒 Pembelian.
--
-- SYARAT: migrasi_pembelian_pesanan.sql SUDAH dijalankan (kolom status_barang/data_lama & fungsi baru).
--
-- Isi:
--   B. Rapikan 25–26 Nov: Motul 7100 (sudah dibayar, BELUM datang) dicatat sebagai PESANAN di Pembelian
--      → stok belum bertambah; 4 catatan "Belanja Stok" di Pengeluaran (3 dobel + Motul 7100) dihapus.
--   C. Pindahkan Pengeluaran "Belanja Stok" lama → pembelian (data_lama = true).
--
-- PENTING soal C: ini cuma MEMINDAH CATATAN. Stok, restock, harga pokok barang TIDAK disentuh (belanja lama
-- itu sudah masuk stok awal/restock dulu). Laba Bersih & "Belanja Stok bulan ini" juga tidak berubah —
-- angkanya cuma pindah dari tabel pengeluaran ke tabel pembelian.
--
-- Sebelum mulai: backup tabel pengeluaran (Table Editor → pengeluaran → Export → CSV).
-- Jalankan tiap LANGKAH terpisah, berurutan. B harus sebelum C.

-- ====================== LANGKAH 1 — cek migrasi sudah jalan (harus muncul 3 baris) ======================
select column_name from information_schema.columns
where table_name = 'pembelian' and column_name in ('status_barang', 'tanggal_terima', 'data_lama');

-- ====================== LANGKAH 2 — (B) PRATINJAU 25–26 Nov (tidak mengubah apa pun) ======================
-- Harus: tepat 1 barang Motul 7100, dan 4 baris pengeluaran di bawahnya.
select kode, nama, stok, harga_pokok, harga_jual from barang where nama ilike '%7100%';

select id, tanggal, kategori, deskripsi, nominal, created_at
from pengeluaran
where kategori = 'Belanja Stok' and created_at >= '2026-11-25'
order by created_at;

-- ====================== LANGKAH 3 — (B) JALANKAN 25–26 Nov ======================
-- 1) Catat Motul 7100 ×3 @ Rp 270.000 (dibayar 25 Nov, Lunas) sebagai PESANAN lewat fungsi
--    catat_pembelian yang sama dengan app. Dijalankan "atas nama" akun pemilik.
-- 2) Hapus 4 baris Pengeluaran "Belanja Stok" (3 dobel + Motul 7100 yang sekarang sudah di Pembelian).
-- Satu blok = satu transaksi: kalau ada yang nggak sesuai (barang ≠ 1, baris terhapus ≠ 4), SEMUA batal.
do $$
declare
  v_pemilik uuid;
  v_kode text;
  v_jml int;
  v_id uuid;
  v_hapus int;
begin
  select id into v_pemilik from profil where peran = 'pemilik' order by dibuat_pada limit 1;
  if v_pemilik is null then raise exception 'Akun pemilik tidak ditemukan'; end if;

  select count(*), min(kode) into v_jml, v_kode from barang where nama ilike '%7100%';
  if v_jml <> 1 then raise exception 'Barang Motul 7100 ditemukan % baris (harus 1)', v_jml; end if;

  -- supaya auth.uid() / is_pemilik() di dalam catat_pembelian membaca akun pemilik
  perform set_config('request.jwt.claim.sub', v_pemilik::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pemilik, 'role', 'authenticated')::text, true);

  -- p_sudah_datang = false → PESANAN: stok & harga pokok belum disentuh. Nanti waktu barangnya datang,
  -- tekan "✅ Terima barang" di Katalog → 🛒 Pembelian.
  v_id := catat_pembelian(
    p_tanggal => '2026-11-25', p_supplier => null,
    p_items => jsonb_build_array(jsonb_build_object('kode', v_kode, 'jumlah', 3, 'harga', 270000)),
    p_status => 'Lunas', p_waktu => '25/11/2026 10:31', p_sudah_datang => false
  );

  delete from pengeluaran
  where kategori = 'Belanja Stok' and created_at >= '2026-11-25'
    and deskripsi in ('Motul 7100 (10w-40) 3btl', 'MOTUL GP MATIC 1L 5btl', 'MOTUL GP MATIC 1L 3btl', 'KOPI GOLDA (12btl)');
  get diagnostics v_hapus = row_count;
  if v_hapus <> 4 then raise exception 'Baris pengeluaran yang cocok % (harus 4) — dibatalkan', v_hapus; end if;

  raise notice 'OK: pembelian % (barang %) dicatat, % baris pengeluaran dihapus', v_id, v_kode, v_hapus;
end $$;

-- ====================== LANGKAH 4 — (C) PRATINJAU pemindahan (tidak mengubah data) ======================
-- alasan_tidak_dipindah kosong = AKAN dipindah. Yang ada alasannya tetap di Pengeluaran sebagai Belanja Stok.
create or replace function pg_temp.norm_nama(t text) returns text language sql immutable as $$
  -- buang tanda jumlah: "(3 PCS)", "(12BTL)", "12BTL", "x5", "×3" — tapi "(KUNCI 10)", "(12V 6Ah)" tetap
  select trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    upper(coalesce(t, '')),
    '\(\s*[0-9]+\s*(PCS|PC|BTL|BOTOL|SET|PASANG|PSG|BUAH|BH|UNIT|DUS|BOX|LUSIN|LTR|LITER)?\s*\)', ' ', 'g'),
    '\m[0-9]+\s*(PCS|PC|BTL|BOTOL|SET|PASANG|PSG|BUAH|BH|UNIT|DUS|BOX|LUSIN|LTR|LITER)\M', ' ', 'g'),
    '(\mX|×)\s*[0-9]+\M', ' ', 'g'),
    '[^A-Z0-9]+', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

create or replace function pg_temp.ambil_jumlah(t text) returns integer language sql immutable as $$
  -- jumlah = angka TERAKHIR yang berbentuk "(3 PCS)" / "(4)", kalau tidak ada "12BTL" / "3 pcs", kalau tidak ada "x5" / "×3"
  select coalesce(
    (select m[1]::int from regexp_matches(upper(t), '\(\s*([0-9]+)\s*(?:PCS|PC|BTL|BOTOL|SET|PASANG|PSG|BUAH|BH|UNIT|DUS|BOX|LUSIN)?\s*\)', 'g') with ordinality as r(m, n) order by n desc limit 1),
    (select m[1]::int from regexp_matches(upper(t), '\m([0-9]+)\s*(?:PCS|PC|BTL|BOTOL|SET|PASANG|PSG|BUAH|BH|UNIT|DUS|BOX|LUSIN)\M', 'g') with ordinality as r(m, n) order by n desc limit 1),
    (select m[1]::int from regexp_matches(upper(t), '(?:\mX|×)\s*([0-9]+)\M', 'g') with ordinality as r(m, n) order by n desc limit 1)
  );
$$;

-- Rencana per baris Pengeluaran "Belanja Stok": barang mana, berapa, harga satuan, dan boleh dipindah atau tidak.
-- Barang dicari: (1) KODE barang tertulis di deskripsi, (2) nama persis sama, (3) nama barang terkandung di
-- deskripsi (ambil yang terpanjang). Harus TEPAT SATU barang — kalau ada dua barang bernama sama → tidak dipindah.
create temp table if not exists rencana_pindah as
with b as (select kode, nama, harga_pokok, pg_temp.norm_nama(nama) as n from barang),
p as (
  select id, tanggal, bulan, deskripsi, nominal, upper(deskripsi) as u, pg_temp.norm_nama(deskripsi) as n,
         pg_temp.ambil_jumlah(deskripsi) as jumlah
  from pengeluaran
  where kategori = 'Belanja Stok' and created_at < '2026-11-23'
),
k as (
  select p.id,
    (select array_agg(b.kode) from b where length(b.kode) >= 6 and b.kode ~ '[0-9]' and position(upper(b.kode) in p.u) > 0) as lewat_kode,
    (select array_agg(b.kode) from b where b.n = p.n and b.n <> '') as lewat_nama,
    (select array_agg(b.kode) from b
      where length(b.n) >= 5 and p.n like '%' || b.n || '%'
        and length(b.n) = (select max(length(b2.n)) from b b2 where length(b2.n) >= 5 and p.n like '%' || b2.n || '%')) as lewat_isi
  from p
),
pilih as (
  select p.*,
    case
      when cardinality(k.lewat_kode) = 1 then k.lewat_kode[1]
      when k.lewat_kode is null and cardinality(k.lewat_nama) = 1 then k.lewat_nama[1]
      when k.lewat_kode is null and k.lewat_nama is null and cardinality(k.lewat_isi) = 1 then k.lewat_isi[1]
    end as kode,
    case
      when cardinality(k.lewat_kode) = 1 then 'kode'
      when k.lewat_kode is null and cardinality(k.lewat_nama) = 1 then 'nama'
      when k.lewat_kode is null and k.lewat_nama is null and cardinality(k.lewat_isi) = 1 then 'isi'
    end as cara,
    coalesce(k.lewat_kode, k.lewat_nama, k.lewat_isi) as kandidat
  from p join k on k.id = p.id
)
select pilih.id, pilih.tanggal, pilih.bulan, pilih.deskripsi, pilih.nominal, pilih.jumlah, pilih.kode, pilih.cara,
  b.nama, b.harga_pokok,
  case when pilih.jumlah > 0 then round(pilih.nominal::numeric / pilih.jumlah)::int end as harga,
  case
    when pilih.kandidat is null then 'barang tidak ketemu di Katalog'
    when pilih.kode is null then 'barang ganda: ' || array_to_string(pilih.kandidat, ', ')
    when pilih.jumlah is null or pilih.jumlah <= 0 then 'jumlah tidak terbaca'
    when b.harga_pokok > 0 and (pilih.nominal::numeric / pilih.jumlah > b.harga_pokok * 3
                                or pilih.nominal::numeric / pilih.jumlah < b.harga_pokok / 3.0)
      then 'harga satuan beda jauh dari harga pokok (' || b.harga_pokok || ')'
  end as alasan_tidak_dipindah
from pilih left join b on b.kode = pilih.kode;

select tanggal, deskripsi, nominal, jumlah, harga, kode, nama, cara, harga_pokok, alasan_tidak_dipindah
from rencana_pindah
order by (alasan_tidak_dipindah is null) desc, tanggal, deskripsi;

-- ====================== LANGKAH 5 — (C) JALANKAN pemindahan ======================
-- Satu blok = satu transaksi. Kalau jumlah yang dihapus ≠ jumlah yang dicatat, semuanya batal.
drop table if exists rencana_pindah;
create or replace function pg_temp.norm_nama(t text) returns text language sql immutable as $$
  -- buang tanda jumlah: "(3 PCS)", "(12BTL)", "12BTL", "x5", "×3" — tapi "(KUNCI 10)", "(12V 6Ah)" tetap
  select trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    upper(coalesce(t, '')),
    '\(\s*[0-9]+\s*(PCS|PC|BTL|BOTOL|SET|PASANG|PSG|BUAH|BH|UNIT|DUS|BOX|LUSIN|LTR|LITER)?\s*\)', ' ', 'g'),
    '\m[0-9]+\s*(PCS|PC|BTL|BOTOL|SET|PASANG|PSG|BUAH|BH|UNIT|DUS|BOX|LUSIN|LTR|LITER)\M', ' ', 'g'),
    '(\mX|×)\s*[0-9]+\M', ' ', 'g'),
    '[^A-Z0-9]+', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

create or replace function pg_temp.ambil_jumlah(t text) returns integer language sql immutable as $$
  -- jumlah = angka TERAKHIR yang berbentuk "(3 PCS)" / "(4)", kalau tidak ada "12BTL" / "3 pcs", kalau tidak ada "x5" / "×3"
  select coalesce(
    (select m[1]::int from regexp_matches(upper(t), '\(\s*([0-9]+)\s*(?:PCS|PC|BTL|BOTOL|SET|PASANG|PSG|BUAH|BH|UNIT|DUS|BOX|LUSIN)?\s*\)', 'g') with ordinality as r(m, n) order by n desc limit 1),
    (select m[1]::int from regexp_matches(upper(t), '\m([0-9]+)\s*(?:PCS|PC|BTL|BOTOL|SET|PASANG|PSG|BUAH|BH|UNIT|DUS|BOX|LUSIN)\M', 'g') with ordinality as r(m, n) order by n desc limit 1),
    (select m[1]::int from regexp_matches(upper(t), '(?:\mX|×)\s*([0-9]+)\M', 'g') with ordinality as r(m, n) order by n desc limit 1)
  );
$$;

-- Rencana per baris Pengeluaran "Belanja Stok": barang mana, berapa, harga satuan, dan boleh dipindah atau tidak.
-- Barang dicari: (1) KODE barang tertulis di deskripsi, (2) nama persis sama, (3) nama barang terkandung di
-- deskripsi (ambil yang terpanjang). Harus TEPAT SATU barang — kalau ada dua barang bernama sama → tidak dipindah.
create temp table if not exists rencana_pindah as
with b as (select kode, nama, harga_pokok, pg_temp.norm_nama(nama) as n from barang),
p as (
  select id, tanggal, bulan, deskripsi, nominal, upper(deskripsi) as u, pg_temp.norm_nama(deskripsi) as n,
         pg_temp.ambil_jumlah(deskripsi) as jumlah
  from pengeluaran
  where kategori = 'Belanja Stok' and created_at < '2026-11-23'
),
k as (
  select p.id,
    (select array_agg(b.kode) from b where length(b.kode) >= 6 and b.kode ~ '[0-9]' and position(upper(b.kode) in p.u) > 0) as lewat_kode,
    (select array_agg(b.kode) from b where b.n = p.n and b.n <> '') as lewat_nama,
    (select array_agg(b.kode) from b
      where length(b.n) >= 5 and p.n like '%' || b.n || '%'
        and length(b.n) = (select max(length(b2.n)) from b b2 where length(b2.n) >= 5 and p.n like '%' || b2.n || '%')) as lewat_isi
  from p
),
pilih as (
  select p.*,
    case
      when cardinality(k.lewat_kode) = 1 then k.lewat_kode[1]
      when k.lewat_kode is null and cardinality(k.lewat_nama) = 1 then k.lewat_nama[1]
      when k.lewat_kode is null and k.lewat_nama is null and cardinality(k.lewat_isi) = 1 then k.lewat_isi[1]
    end as kode,
    case
      when cardinality(k.lewat_kode) = 1 then 'kode'
      when k.lewat_kode is null and cardinality(k.lewat_nama) = 1 then 'nama'
      when k.lewat_kode is null and k.lewat_nama is null and cardinality(k.lewat_isi) = 1 then 'isi'
    end as cara,
    coalesce(k.lewat_kode, k.lewat_nama, k.lewat_isi) as kandidat
  from p join k on k.id = p.id
)
select pilih.id, pilih.tanggal, pilih.bulan, pilih.deskripsi, pilih.nominal, pilih.jumlah, pilih.kode, pilih.cara,
  b.nama, b.harga_pokok,
  case when pilih.jumlah > 0 then round(pilih.nominal::numeric / pilih.jumlah)::int end as harga,
  case
    when pilih.kandidat is null then 'barang tidak ketemu di Katalog'
    when pilih.kode is null then 'barang ganda: ' || array_to_string(pilih.kandidat, ', ')
    when pilih.jumlah is null or pilih.jumlah <= 0 then 'jumlah tidak terbaca'
    when b.harga_pokok > 0 and (pilih.nominal::numeric / pilih.jumlah > b.harga_pokok * 3
                                or pilih.nominal::numeric / pilih.jumlah < b.harga_pokok / 3.0)
      then 'harga satuan beda jauh dari harga pokok (' || b.harga_pokok || ')'
  end as alasan_tidak_dipindah
from pilih left join b on b.kode = pilih.kode;

do $$
declare
  v_masuk int;
  v_hapus int;
begin
  insert into pembelian (tanggal, bulan, nama_supplier, items, total, status_bayar, status_barang, tanggal_terima, data_lama, dibuat_pada)
  select tanggal, coalesce(bulan, to_char(tanggal, 'YYYY-MM')), null,
    jsonb_build_array(jsonb_build_object(
      'kode', kode, 'nama', nama, 'jumlah', jumlah, 'harga', harga, 'subtotal', nominal,
      'deskripsiAsli', deskripsi)),
    nominal, 'Lunas', 'Diterima', tanggal, true, tanggal::timestamptz
  from rencana_pindah where alasan_tidak_dipindah is null;
  get diagnostics v_masuk = row_count;

  delete from pengeluaran where id in (select id from rencana_pindah where alasan_tidak_dipindah is null);
  get diagnostics v_hapus = row_count;

  if v_masuk <> v_hapus then
    raise exception 'Jumlah tidak cocok: % dicatat, % dihapus — dibatalkan', v_masuk, v_hapus;
  end if;
  raise notice 'OK: % catatan dipindah ke pembelian', v_masuk;
end $$;

-- ====================== LANGKAH 6 — CEK HASIL ======================
select bulan, count(*) as nota, sum(total) as total from pembelian where data_lama group by bulan order by bulan;
select bulan, count(*) as sisa, sum(nominal) as total from pengeluaran where kategori = 'Belanja Stok' group by bulan order by bulan;
select kode, nama, stok, restock, harga_pokok from barang where nama ilike '%7100%';   -- stok TIDAK berubah (masih pesanan)
select tanggal, status_barang, total, items from pembelian where status_barang = 'Dipesan';
