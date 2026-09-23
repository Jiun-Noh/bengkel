-- Denda telat (per menit) & mangkir (per hari) per staf, plus jam masuk standar (shop-wide).
-- Excel requirement #3: potongan gaji otomatis untuk keterlambatan & ketidakhadiran tanpa kabar.

alter table staff add column if not exists nominal_telat_per_menit integer default 1000;
alter table staff add column if not exists nominal_mangkir integer default 50000;

alter table pengaturan add column if not exists jam_masuk_standar text default '09:00';

-- Isi staf yang sudah ada dengan nilai default supaya gak kosong.
update staff set nominal_telat_per_menit = 1000 where nominal_telat_per_menit is null;
update staff set nominal_mangkir = 50000 where nominal_mangkir is null;

update pengaturan set jam_masuk_standar = '09:00' where jam_masuk_standar is null;
