-- Pindahkan catatan Pengeluaran "Operasional" yang sebenarnya BELANJA BARANG DAGANGAN ke kategori
-- "Belanja Stok" (tidak dipotong dari Laba Bersih). Semua periode.
--
-- AMAN: tidak ada yang dihapus. Deskripsi, nominal, tanggal tetap — yang berubah cuma kolom kategori.
-- Sebelum menjalankan LANGKAH 2, backup dulu: Table Editor → pengeluaran → Export → CSV.
--
-- Cara cocokkan: deskripsi dibandingkan dengan nama barang di Katalog, setelah tanda jumlah
-- seperti "(2PCS)", "12BTL", "x5", "×3" dibuang dan huruf besar/kecil & tanda baca disamakan.
--   persis = setelah dibersihkan, deskripsi SAMA dengan nama barang → dipindah otomatis di Langkah 2
--   mirip  = salah satu mengandung yang lain → TIDAK dipindah otomatis; pemilik cek sendiri di app
--
-- Jalankan tiap langkah TERPISAH (blok sampai garis berikutnya), masing-masing sekali "Run".

-- =========================== LANGKAH 1 — PRATINJAU (tidak mengubah apa pun) ===========================
create or replace function pg_temp.norm_barang(t text) returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    upper(coalesce(t, '')),
    '\([^)]*[0-9][^)]*\)', ' ', 'g'),                                                     -- (2PCS), (12 BTL)
    '\m[0-9]+\s*(PCS|PC|BTL|BOTOL|SET|PASANG|PSG|BUAH|BH|UNIT|DUS|BOX|LUSIN|LTR|LITER|X)\M', ' ', 'g'), -- 12BTL, 2 PCS, 5X
    '(\mX|×)\s*[0-9]+\M', ' ', 'g'),                                                        -- X5, ×3
    '[^A-Z0-9]+', ' ', 'g'),                                                                -- tanda baca → spasi
    '\s+', ' ', 'g'));
$$;

with b as (select nama, pg_temp.norm_barang(nama) as n from barang),
p as (select id, tanggal, deskripsi, nominal, pg_temp.norm_barang(deskripsi) as n
      from pengeluaran where kategori = 'Operasional')
select p.tanggal, p.deskripsi, p.nominal,
  coalesce(
    (select 'persis: ' || string_agg(b.nama, ' | ') from b where b.n = p.n and b.n <> ''),
    (select 'mirip: ' || string_agg(b.nama, ' | ') from b
      where length(b.n) >= 5 and length(p.n) >= 5 and (p.n like '%' || b.n || '%' or b.n like '%' || p.n || '%')),
    '—'
  ) as cocok_dengan
from p
order by (case when exists (select 1 from b where b.n = p.n and b.n <> '') then 0 else 1 end), p.tanggal;

-- ============== LANGKAH 2 — PINDAHKAN yang "persis" ke Belanja Stok (setelah pratinjau OK) ==============
create or replace function pg_temp.norm_barang(t text) returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    upper(coalesce(t, '')),
    '\([^)]*[0-9][^)]*\)', ' ', 'g'),
    '\m[0-9]+\s*(PCS|PC|BTL|BOTOL|SET|PASANG|PSG|BUAH|BH|UNIT|DUS|BOX|LUSIN|LTR|LITER|X)\M', ' ', 'g'),
    '(\mX|×)\s*[0-9]+\M', ' ', 'g'),
    '[^A-Z0-9]+', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

update pengeluaran p
set kategori = 'Belanja Stok'
where p.kategori = 'Operasional'
  and pg_temp.norm_barang(p.deskripsi) <> ''
  and exists (select 1 from barang b where pg_temp.norm_barang(b.nama) = pg_temp.norm_barang(p.deskripsi))
returning p.tanggal, p.deskripsi, p.nominal;

-- ====== LANGKAH 2B — PRATINJAU tahap kedua: cocok lewat KODE barang atau "mirip" (jalankan setelah Langkah 2) ======
-- Banyak deskripsi diawali kode part (AHM-..., YMH-...) atau kata "OLI"/"SHELL", jadi tidak "persis".
-- Kolom akan_dipindah = true → ikut dipindah di Langkah 2C. TREKER (alat bengkel) dan minuman yang
-- belum pasti (COCA COLA ZERO, GOLDA) sengaja TIDAK ikut — dicek pemilik sendiri di app.
create or replace function pg_temp.norm_barang(t text) returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    upper(coalesce(t, '')),
    '\([^)]*[0-9][^)]*\)', ' ', 'g'),
    '\m[0-9]+\s*(PCS|PC|BTL|BOTOL|SET|PASANG|PSG|BUAH|BH|UNIT|DUS|BOX|LUSIN|LTR|LITER|X)\M', ' ', 'g'),
    '(\mX|×)\s*[0-9]+\M', ' ', 'g'),
    '[^A-Z0-9]+', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

with b as (select kode, nama, pg_temp.norm_barang(nama) as n from barang),
p as (select id, tanggal, deskripsi, nominal, pg_temp.norm_barang(deskripsi) as n, upper(deskripsi) as u
      from pengeluaran where kategori = 'Operasional'),
c as (
  select p.*,
    (select string_agg(b.kode || ' ' || b.nama, ' | ') from b
      where length(b.kode) >= 6 and b.kode ~ '[0-9]' and position(upper(b.kode) in p.u) > 0) as cocok_kode,
    (select string_agg(b.nama, ' | ') from b
      where length(b.n) >= 5 and length(p.n) >= 5 and (p.n like '%' || b.n || '%' or b.n like '%' || p.n || '%')) as mirip
  from p
)
select tanggal, deskripsi, nominal, cocok_kode, mirip,
  ((cocok_kode is not null or mirip is not null) and deskripsi !~* '^\s*(TREKER|COCA COLA ZERO|GOLDA)') as akan_dipindah
from c
order by akan_dipindah desc, tanggal;

-- ================= LANGKAH 2C — PINDAHKAN yang akan_dipindah = true di Langkah 2B =================
create or replace function pg_temp.norm_barang(t text) returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    upper(coalesce(t, '')),
    '\([^)]*[0-9][^)]*\)', ' ', 'g'),
    '\m[0-9]+\s*(PCS|PC|BTL|BOTOL|SET|PASANG|PSG|BUAH|BH|UNIT|DUS|BOX|LUSIN|LTR|LITER|X)\M', ' ', 'g'),
    '(\mX|×)\s*[0-9]+\M', ' ', 'g'),
    '[^A-Z0-9]+', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

update pengeluaran p
set kategori = 'Belanja Stok'
where p.kategori = 'Operasional'
  and p.deskripsi !~* '^\s*(TREKER|COCA COLA ZERO|GOLDA)'
  and (
    exists (select 1 from barang b
            where length(b.kode) >= 6 and b.kode ~ '[0-9]' and position(upper(b.kode) in upper(p.deskripsi)) > 0)
    or exists (select 1 from barang b
            where length(pg_temp.norm_barang(b.nama)) >= 5 and length(pg_temp.norm_barang(p.deskripsi)) >= 5
              and (pg_temp.norm_barang(p.deskripsi) like '%' || pg_temp.norm_barang(b.nama) || '%'
                   or pg_temp.norm_barang(b.nama) like '%' || pg_temp.norm_barang(p.deskripsi) || '%'))
  )
returning p.tanggal, p.deskripsi, p.nominal;

-- ============== LANGKAH 3 — SISA Operasional per bulan (buat dicek pemilik di app) ==============
select bulan, count(*) as jumlah_catatan, sum(nominal) as total
from pengeluaran where kategori = 'Operasional'
group by bulan order by bulan;
