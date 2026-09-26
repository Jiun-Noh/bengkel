-- Sheet request batch 2, #1: % bagi hasil saat mekanik kerja BERSAMA (2+ orang) diatur pemilik
-- per staf di halaman Staff (pasangannya persen_bagi_hasil yang khusus kerja solo), supaya kasir
-- tidak bisa mengubah angkanya di Transaksi. Default 20: 2 orang x 20 = 40 (batas total), dan untuk
-- 3+ orang otomatis diskalakan proporsional ke 40 — hasilnya sama dengan bagi rata yang lama.

alter table staff add column if not exists persen_bagi_hasil_bersama numeric default 20;
update staff set persen_bagi_hasil_bersama = 20 where persen_bagi_hasil_bersama is null;
