-- Akun karyawan baru: kasirbengkel@gmail.com
-- Jalankan SETELAH akun ini dibuat di Dashboard > Authentication > Users.

insert into profil (id, nama, peran)
select id, 'Kasir', 'karyawan' from auth.users where email = 'kasirbengkel@gmail.com'
on conflict (id) do update set nama = excluded.nama, peran = excluded.peran;
