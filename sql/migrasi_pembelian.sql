-- Pembelian stok (belanja barang dagangan) — menggabungkan "catat pengeluaran" + "Restock" jadi
-- satu langkah, dan menghitung ulang Harga Pokok dengan RATA-RATA TERTIMBANG.
--
-- Kenapa: belanja stok BUKAN biaya. Uangnya berubah jadi barang di rak; modalnya baru jadi biaya
-- saat barangnya terjual (sudah dipotong lewat Laba Barang = harga jual − harga pokok). Kalau
-- belanja stok juga dicatat di Pengeluaran Operasional, modal yang sama terpotong DUA KALI.
--
-- JALANKAN FILE INI DULU, BARU DEPLOY APP-nya (app baru memanggil fungsi & tabel di bawah).
-- Aman dijalankan ulang? Tabel pakai "if not exists", fungsi pakai "create or replace".
-- Baris "alter publication" akan error kalau dijalankan dua kali — itu wajar, abaikan.

create table if not exists pembelian (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  bulan text not null,                 -- YYYY-MM
  nama_supplier text,
  -- [{kode, nama, jumlah, harga, subtotal, hargaPokokLama, hargaPokokBaru}] — harga = modal per
  -- satuan di pembelian INI (tersimpan, nggak berubah walau harga pokok barang nanti berubah)
  items jsonb not null default '[]',
  total integer not null default 0,
  status_bayar text not null check (status_bayar in ('Lunas', 'Hutang')),
  hutang_supplier_id uuid references hutang_supplier(id) on delete set null,
  waktu_restock text,                  -- "DD/MM/YYYY HH:MM" yang ditulis ke riwayat_restock
  dibuat_pada timestamptz default now()
);
create index if not exists idx_pembelian_bulan on pembelian (bulan);

alter table pembelian enable row level security;
drop policy if exists "pembelian pemilik" on pembelian;
create policy "pembelian pemilik" on pembelian for all using (is_pemilik()) with check (is_pemilik());

-- Catat pembelian: untuk tiap barang → stok & restock bertambah, entri riwayat_restock (ditandai
-- pembelian_id), Harga Pokok = rata-rata tertimbang. Kalau Hutang → otomatis masuk Hutang Supplier.
-- Semua dalam satu transaksi database: gagal satu, batal semua.
--
-- p_items: [{"kode": "...", "jumlah": 5, "harga": 69585}, ...]
create or replace function catat_pembelian(
  p_tanggal date,
  p_supplier text,
  p_items jsonb,
  p_status text,
  p_waktu text
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_id uuid := gen_random_uuid();
  v_it jsonb;
  v_kode text;
  v_jumlah integer;
  v_harga integer;
  v_brg record;
  v_hp_baru integer;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_desk text := '';
  v_hutang uuid;
  v_supplier text := nullif(trim(coalesce(p_supplier, '')), '');
begin
  if not is_pemilik() then
    raise exception 'Hanya pemilik yang boleh mencatat pembelian stok';
  end if;
  if p_status not in ('Lunas', 'Hutang') then
    raise exception 'Status bayar tidak dikenal: %', p_status;
  end if;
  if p_status = 'Hutang' and v_supplier is null then
    raise exception 'Pembelian hutang wajib isi nama supplier';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Belum ada barang yang dibeli';
  end if;

  for v_it in select * from jsonb_array_elements(p_items) loop
    v_kode := v_it->>'kode';
    v_jumlah := (v_it->>'jumlah')::integer;
    v_harga := (v_it->>'harga')::integer;
    if v_jumlah is null or v_jumlah <= 0 then
      raise exception 'Jumlah beli % harus minimal 1', v_kode;
    end if;
    if v_harga is null or v_harga < 0 then
      raise exception 'Harga beli % tidak boleh minus', v_kode;
    end if;

    select kode, nama, coalesce(stok, 0) as stok, coalesce(harga_pokok, 0) as harga_pokok
      into v_brg from barang where kode = v_kode for update;
    if not found then
      raise exception 'Barang % tidak ditemukan', v_kode;
    end if;

    -- Rata-rata tertimbang dari stok yang MASIH ADA. Stok 0/minus → pakai harga beli ini.
    if v_brg.stok <= 0 then
      v_hp_baru := v_harga;
    else
      v_hp_baru := round((v_brg.stok::numeric * v_brg.harga_pokok + v_jumlah::numeric * v_harga) / (v_brg.stok + v_jumlah));
    end if;

    update barang
    set stok = coalesce(stok, 0) + v_jumlah,
        restock = coalesce(restock, 0) + v_jumlah,
        harga_pokok = v_hp_baru,
        riwayat_restock = coalesce(riwayat_restock, '[]'::jsonb)
          || jsonb_build_array(jsonb_build_object('jumlah', v_jumlah, 'tanggal', p_waktu, 'pembelian_id', v_id))
    where kode = v_kode;

    v_total := v_total + v_jumlah * v_harga;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'kode', v_kode, 'nama', v_brg.nama, 'jumlah', v_jumlah, 'harga', v_harga,
      'subtotal', v_jumlah * v_harga, 'hargaPokokLama', v_brg.harga_pokok, 'hargaPokokBaru', v_hp_baru));
    v_desk := v_desk || case when v_desk = '' then '' else ', ' end || v_brg.nama || ' ×' || v_jumlah;
  end loop;

  if p_status = 'Hutang' then
    insert into hutang_supplier (nama_supplier, tanggal, deskripsi, nominal, bulan)
    values (v_supplier, p_tanggal, 'Pembelian: ' || v_desk, v_total, to_char(p_tanggal, 'YYYY-MM'))
    returning id into v_hutang;
  end if;

  insert into pembelian (id, tanggal, bulan, nama_supplier, items, total, status_bayar, hutang_supplier_id, waktu_restock)
  values (v_id, p_tanggal, to_char(p_tanggal, 'YYYY-MM'), v_supplier, v_items, v_total, p_status, v_hutang, p_waktu);

  return v_id;
end;
$$;

-- Batalkan pembelian (mis. salah input): stok & restock dikurangi lagi, entri riwayat_restock-nya
-- dihapus, hutang supplier-nya ikut dihapus. Ditolak kalau hutang itu sudah ada pembayarannya
-- (biar kwitansi yang sudah dicetak nggak kehilangan induknya).
-- Harga Pokok dikembalikan ke nilai sebelum pembelian HANYA kalau sejak itu belum berubah lagi
-- (masih persis hargaPokokBaru) — kalau sudah ada pembelian/edit lain, dibiarkan.
create or replace function batal_pembelian(p_id uuid) returns void
language plpgsql set search_path = public as $$
declare
  v_pb record;
  v_it jsonb;
begin
  if not is_pemilik() then
    raise exception 'Hanya pemilik yang boleh membatalkan pembelian stok';
  end if;

  select * into v_pb from pembelian where id = p_id for update;
  if not found then
    raise exception 'Pembelian ini tidak ditemukan (mungkin sudah dibatalkan dari HP lain)';
  end if;

  if v_pb.hutang_supplier_id is not null then
    if exists (select 1 from hutang_supplier_pembayaran where hutang_supplier_id = v_pb.hutang_supplier_id) then
      raise exception 'Hutang pembelian ini sudah ada pembayarannya. Hapus dulu pembayarannya di Laporan → Hutang Supplier.';
    end if;
    delete from hutang_supplier where id = v_pb.hutang_supplier_id;
  end if;

  -- urutan terbalik: kalau satu barang muncul dua kali, harga pokok dikembalikan berurutan
  for v_it in
    select el from jsonb_array_elements(v_pb.items) with ordinality as e(el, ord) order by ord desc
  loop
    update barang
    set stok = coalesce(stok, 0) - (v_it->>'jumlah')::integer,
        restock = coalesce(restock, 0) - (v_it->>'jumlah')::integer,
        harga_pokok = case when harga_pokok = (v_it->>'hargaPokokBaru')::integer
                           then (v_it->>'hargaPokokLama')::integer else harga_pokok end
    where kode = v_it->>'kode';
    -- barang sudah dihapus dari katalog → tidak ada yang perlu dikembalikan
  end loop;

  update barang b
  set riwayat_restock = (
    select coalesce(jsonb_agg(e.el order by e.ord), '[]'::jsonb)
    from jsonb_array_elements(b.riwayat_restock) with ordinality as e(el, ord)
    where e.el->>'pembelian_id' is distinct from p_id::text
  )
  where b.kode in (select el->>'kode' from jsonb_array_elements(v_pb.items) as x(el));

  delete from pembelian where id = p_id;
end;
$$;

-- Restock manual sekarang KHUSUS PEMILIK (di app, tombol 🔄 membuka 🛒 Pembelian).
create or replace function restock_barang(p_kode text, p_jumlah integer, p_tanggal text) returns void
language plpgsql set search_path = public as $$
begin
  if not is_pemilik() then
    raise exception 'Hanya pemilik yang boleh restock';
  end if;
  update barang
  set stok = coalesce(stok, 0) + p_jumlah,
      restock = coalesce(restock, 0) + p_jumlah,
      riwayat_restock = coalesce(riwayat_restock, '[]'::jsonb)
                        || jsonb_build_array(jsonb_build_object('jumlah', p_jumlah, 'tanggal', p_tanggal))
  where kode = p_kode;
  if not found then
    raise exception 'Barang % tidak ditemukan', p_kode;
  end if;
end;
$$;

-- Batal restock manual: khusus pemilik, dan entri hasil 🛒 Pembelian TIDAK bisa dibatalkan dari
-- sini (harus lewat Batalkan Pembelian, supaya catatan pembelian & hutangnya ikut beres).
create or replace function batal_restock_barang(p_kode text, p_jumlah integer, p_tanggal text) returns void
language plpgsql set search_path = public as $$
declare
  v_idx integer;
begin
  if not is_pemilik() then
    raise exception 'Hanya pemilik yang boleh membatalkan restock';
  end if;
  perform 1 from barang where kode = p_kode for update; -- kunci baris dulu
  if not found then
    raise exception 'Barang % tidak ditemukan', p_kode;
  end if;

  select e.ord - 1 into v_idx
  from barang b, jsonb_array_elements(coalesce(b.riwayat_restock, '[]'::jsonb)) with ordinality as e(el, ord)
  where b.kode = p_kode
    and (e.el->>'jumlah')::integer = p_jumlah
    and e.el->>'tanggal' = p_tanggal
    and not (e.el ? 'pembelian_id')
  order by e.ord
  limit 1;

  if v_idx is null then
    raise exception 'Riwayat restock ini tidak ditemukan (mungkin sudah dibatalkan, atau ini dari 🛒 Pembelian — batalkan lewat daftar Pembelian)';
  end if;

  update barang
  set stok = coalesce(stok, 0) - p_jumlah,
      restock = coalesce(restock, 0) - p_jumlah,
      riwayat_restock = riwayat_restock - v_idx
  where kode = p_kode;
end;
$$;

-- Realtime: biar daftar Pembelian di HP lain ikut ter-update.
alter publication supabase_realtime add table pembelian;
