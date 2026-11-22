-- Transaksi sekarang bisa punya lebih dari satu jasa sekaligus (bukan cuma 1).
-- nama_jasa & biaya_jasa tetap ada sebagai ringkasan (gabungan nama & total),
-- jasa_items simpan rincian per jasa buat ditampilkan/dicetak satu-satu.

alter table riwayat add column if not exists jasa_items jsonb default '[]';
