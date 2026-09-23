-- Multi-mekanik per transaksi (disepakati langsung dengan pemilik, bukan dari sheet requirement).
-- Satu transaksi bisa dikerjakan lebih dari satu mekanik. Total % bagi hasil semua mekanik di
-- satu transaksi maksimal 40%, ditentukan (dan dikunci) saat transaksi itu dibuat — bukan dihitung
-- ulang dari % default staf saat laporan dilihat, supaya perubahan % staf di kemudian hari tidak
-- mengubah riwayat transaksi lama.
--
-- riwayat.nama_mekanik (text) tetap dipakai sebagai nama gabungan buat tampilan cepat/pencarian
-- (pola yang sama dengan nama_jasa vs jasa_items). Baris LAMA (sebelum migrasi ini) tidak punya
-- mekanik_items — Laporan.jsx otomatis fallback ke perilaku lama (pakai % staf saat ini) untuk
-- baris seperti itu, jadi tidak perlu backfill data historis.

alter table riwayat add column if not exists mekanik_items jsonb default '[]';
