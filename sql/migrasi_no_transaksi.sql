-- Excel requirement #6: nomor transaksi unik di nota, plus waktu cetak & nama kasir yang mencetak.
-- Nomor transaksi (format INV-{tahun}-{6 digit urut}) dibuat otomatis lewat trigger + tabel counter
-- (bukan dihitung di client) supaya aman dari race condition kalau dua staf selesai transaksi
-- nyaris bersamaan — insert...on conflict...returning di Postgres itu atomik per baris.
-- Waktu cetak & nama kasir TIDAK disimpan di DB — itu murni ditentukan saat tombol cetak ditekan
-- (waktu sekarang + nama akun yang sedang login), jadi tidak perlu kolom baru buat itu.

alter table riwayat add column if not exists no_transaksi text unique;

create table if not exists no_transaksi_counter (
  tahun integer primary key,
  terakhir integer not null default 0
);
alter table no_transaksi_counter enable row level security;
-- Sengaja tidak dikasih policy apa pun — tabel ini cuma disentuh lewat trigger security definer
-- di bawah, jadi default deny-all buat akses langsung dari client sudah pas.

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

drop trigger if exists isi_no_transaksi on riwayat;
create trigger isi_no_transaksi before insert on riwayat
for each row execute function set_no_transaksi();
