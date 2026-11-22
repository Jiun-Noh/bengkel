-- Migrasi: akun login individu + RLS berbasis peran.
-- Jalankan SETELAH membuat 2 akun baru di Dashboard > Authentication > Users:
--   liemsientong@gmail.com  (sudah punya password sendiri)
--   sylov28@gmail.com       (sudah punya password sendiri)
-- scrpt@naver.com sudah ada, tidak perlu dibuat ulang.

-- 1) Tabel profil: akun login -> nama tampil + peran.
create table profil (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  peran text not null default 'karyawan' check (peran in ('pemilik', 'karyawan')),
  staff_kode text references staff(kode),
  dibuat_pada timestamptz default now()
);
alter table profil enable row level security;

-- 2) Helper cek peran (security definer supaya tidak rekursi ke RLS profil sendiri).
create or replace function is_pemilik() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profil where id = auth.uid() and peran = 'pemilik');
$$;

create policy "lihat profil sendiri" on profil for select using (auth.uid() = id);
create policy "pemilik kelola profil" on profil for all
  using (is_pemilik()) with check (is_pemilik());

-- 3) Buang kebijakan lama yang terlalu longgar (semua tabel yang masih pakai "auth full access").
drop policy if exists "auth full access" on barang;
drop policy if exists "auth full access" on riwayat;
drop policy if exists "auth full access" on absensi;
drop policy if exists "auth full access" on staff;
drop policy if exists "auth full access" on pengaturan;
drop policy if exists "auth full access" on pengeluaran;
drop policy if exists "auth full access" on lembur;
drop policy if exists "auth full access" on investor;
drop policy if exists "auth full access" on jasa;

-- 4) Kebijakan baru per tabel, per aksi.
create policy "barang select" on barang for select using (auth.role() = 'authenticated');
create policy "barang insert" on barang for insert with check (is_pemilik());
create policy "barang update" on barang for update using (auth.role() = 'authenticated');
create policy "barang delete" on barang for delete using (is_pemilik());

create policy "jasa select" on jasa for select using (auth.role() = 'authenticated');
create policy "jasa insert" on jasa for insert with check (is_pemilik());
create policy "jasa update" on jasa for update using (is_pemilik());
create policy "jasa delete" on jasa for delete using (is_pemilik());

create policy "staff select" on staff for select using (auth.role() = 'authenticated');
create policy "staff insert" on staff for insert with check (is_pemilik());
create policy "staff update" on staff for update using (is_pemilik());
create policy "staff delete" on staff for delete using (is_pemilik());

create policy "absensi select" on absensi for select using (auth.role() = 'authenticated');
create policy "absensi insert" on absensi for insert with check (auth.role() = 'authenticated');
create policy "absensi update" on absensi for update using (auth.role() = 'authenticated');
create policy "absensi delete" on absensi for delete using (is_pemilik());

create policy "riwayat select" on riwayat for select using (auth.role() = 'authenticated');
create policy "riwayat insert" on riwayat for insert with check (auth.role() = 'authenticated');
create policy "riwayat update" on riwayat for update using (auth.role() = 'authenticated');
create policy "riwayat delete" on riwayat for delete using (is_pemilik());

create policy "pengaturan pemilik" on pengaturan for all using (is_pemilik()) with check (is_pemilik());
create policy "investor pemilik" on investor for all using (is_pemilik()) with check (is_pemilik());
create policy "lembur pemilik" on lembur for all using (is_pemilik()) with check (is_pemilik());
create policy "pengeluaran pemilik" on pengeluaran for all using (is_pemilik()) with check (is_pemilik());

-- 5) Trigger: karyawan tidak boleh ubah harga_pokok/harga_jual lewat jalur mana pun.
create or replace function cegah_ubah_harga_barang() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_pemilik() and (new.harga_pokok is distinct from old.harga_pokok or new.harga_jual is distinct from old.harga_jual) then
    raise exception 'Hanya pemilik yang boleh mengubah harga barang';
  end if;
  return new;
end;
$$;
create trigger jaga_harga_barang before update on barang
for each row execute function cegah_ubah_harga_barang();

-- 6) Isi profil untuk 3 akun awal — dicari otomatis lewat email, jadi tidak perlu
--    copy-paste UUID manual. Akun yang belum ada di auth.users otomatis dilewati (0 baris),
--    jadi aman dijalankan ulang setelah akun-akun itu benar-benar dibuat di Dashboard.
insert into profil (id, nama, peran)
select id, 'Sientong (Pemilik)', 'pemilik' from auth.users where email = 'liemsientong@gmail.com'
union all
select id, 'Jiun (Dev - Pemilik)', 'pemilik' from auth.users where email = 'sylov28@gmail.com'
union all
select id, 'Jiun (Dev - Karyawan)', 'karyawan' from auth.users where email = 'scrpt@naver.com'
on conflict (id) do update set nama = excluded.nama, peran = excluded.peran;
