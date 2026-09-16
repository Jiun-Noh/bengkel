-- Persentase Bagi Hasil Jasa jadi per-staf (dulu satu angka global di pengaturan).

alter table staff add column if not exists persen_bagi_hasil integer default 8;

-- Isi staf yang sudah ada dengan nilai default lama (8%) supaya gak kosong.
update staff set persen_bagi_hasil = 8 where persen_bagi_hasil is null;
