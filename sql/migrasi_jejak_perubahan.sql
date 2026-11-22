-- Jejak ringan: siapa & kapan terakhir insert/update barang & staff.
-- Bukan histori nilai lama (audit log penuh) — cuma "siapa terakhir pegang baris ini".

alter table barang add column if not exists diubah_oleh uuid references auth.users(id);
alter table barang add column if not exists diubah_pada timestamptz;

alter table staff add column if not exists diubah_oleh uuid references auth.users(id);
alter table staff add column if not exists diubah_pada timestamptz;

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
