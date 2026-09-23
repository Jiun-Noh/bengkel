-- Isi no_transaksi buat baris riwayat LAMA yang belum punya nomor (dibuat sebelum trigger
-- isi_no_transaksi ada). Jalankan ini SETELAH migrasi_no_transaksi.sql.
--
-- Nomor urut dihitung per tahun berdasarkan tanggal transaksi asli (kolom `tgl`, bukan
-- created_at), diurutkan kronologis dalam tahun itu — jadi transaksi Januari dapat nomor
-- lebih kecil dari transaksi Desember di tahun yang sama, seperti kalau trigger sudah ada
-- dari awal. Asumsi: `tgl` selalu format "DD/MM/YYYY HH:MM" (format baku aplikasi ini).

with parsed as (
  select id,
         extract(year from to_timestamp(tgl, 'DD/MM/YYYY HH24:MI'))::int as thn,
         to_timestamp(tgl, 'DD/MM/YYYY HH24:MI') as waktu
  from riwayat
  where no_transaksi is null
),
bernomor as (
  select id, thn, row_number() over (partition by thn order by waktu) as urut
  from parsed
)
update riwayat r
set no_transaksi = 'INV-' || b.thn || '-' || lpad(b.urut::text, 6, '0')
from bernomor b
where r.id = b.id;

-- Sinkronkan counter per tahun ke nomor terbesar yang baru saja dipakai, supaya transaksi
-- BARU berikutnya (lewat trigger) lanjut dari situ, bukan mulai dari 1 lagi.
insert into no_transaksi_counter (tahun, terakhir)
select
  split_part(no_transaksi, '-', 2)::int as tahun,
  max(split_part(no_transaksi, '-', 3)::int) as terakhir
from riwayat
where no_transaksi is not null
group by tahun
on conflict (tahun) do update set terakhir = greatest(no_transaksi_counter.terakhir, excluded.terakhir);
