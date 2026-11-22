-- Sheet request batch 3, #3: pembayaran ke supplier bisa dicicil (beberapa kali bayar sebagian),
-- dan tiap pembayaran perlu bukti/kwitansi yang bisa dicetak buat diserahkan ke supplier.
--
-- Ditambah tabel ledger baru (bukan cuma nominal_dibayar tunggal) supaya tiap cicilan tercatat
-- terpisah dengan tanggalnya sendiri — itu yang bikin cetak kwitansi PER pembayaran jadi mungkin.
-- Status Lunas/Belum Lunas & sisa tagihan sekarang DIHITUNG dari jumlah pembayaran di ledger ini,
-- bukan dari kolom hutang_supplier.status lagi (kolom itu tetap dibiarkan ada buat data lama).

create table hutang_supplier_pembayaran (
  id uuid primary key default gen_random_uuid(),
  hutang_supplier_id uuid not null references hutang_supplier(id) on delete cascade,
  tanggal date not null,
  nominal integer default 0,
  dibuat_pada timestamptz default now()
);
create index idx_hutang_supplier_pembayaran_hutang on hutang_supplier_pembayaran (hutang_supplier_id);

alter table hutang_supplier_pembayaran enable row level security;
create policy "hutang_supplier_pembayaran pemilik" on hutang_supplier_pembayaran for all using (is_pemilik()) with check (is_pemilik());

alter publication supabase_realtime add table hutang_supplier_pembayaran;

-- Backfill: baris yang sudah ditandai Lunas lewat tombol lama diberi satu baris pembayaran lunas
-- (nominal penuh, tanggal = tanggal_lunas kalau ada) supaya status barunya tetap konsisten.
insert into hutang_supplier_pembayaran (hutang_supplier_id, tanggal, nominal)
select id, coalesce(tanggal_lunas, tanggal), nominal
from hutang_supplier
where status = 'Lunas';
