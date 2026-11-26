-- 🛒 Pembelian: (1) PESANAN "sudah dibayar, barang belum datang" dan (2) penanda catatan lama.
--
-- (1) Kadang belanja dibayar dulu (atau dicatat hutang), barangnya datang beberapa hari kemudian.
--     status_barang = 'Dipesan' → stok & harga pokok BELUM disentuh. Waktu barang datang, tombol
--     "✅ Terima barang" memanggil terima_pembelian → stok bertambah & harga pokok dihitung ulang
--     (rata-rata tertimbang dari stok SAAT barang datang).
-- (2) data_lama = true → catatan dipindah dari Pengeluaran "Belanja Stok" (sebelum ada 🛒 Pembelian).
--     Cuma catatan: stoknya sudah masuk dulu lewat stok awal/restock, jadi tidak bisa dibatalkan.
--
-- JALANKAN FILE INI DULU, BARU DEPLOY APP-nya. Aman dijalankan ulang.
-- App versi lama tetap jalan (catat_pembelian tanpa p_sudah_datang = barang sudah datang).

alter table pembelian add column if not exists status_barang text not null default 'Diterima';
alter table pembelian add column if not exists tanggal_terima date;
alter table pembelian add column if not exists data_lama boolean not null default false;
alter table pembelian drop constraint if exists pembelian_status_barang_check;
alter table pembelian add constraint pembelian_status_barang_check check (status_barang in ('Dipesan', 'Diterima'));
update pembelian set tanggal_terima = tanggal where status_barang = 'Diterima' and tanggal_terima is null;

-- Masukkan barang dari satu pembelian ke stok: stok & restock bertambah, entri riwayat_restock
-- (ditandai pembelian_id), harga pokok = rata-rata tertimbang. Mengembalikan items yang sudah
-- dilengkapi hargaPokokLama/hargaPokokBaru (dipakai buat pratinjau & pembatalan).
create or replace function pembelian_masukkan_stok(p_id uuid, p_items jsonb, p_waktu text) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_it jsonb;
  v_brg record;
  v_jumlah integer;
  v_harga integer;
  v_hp_baru integer;
  v_hasil jsonb := '[]'::jsonb;
begin
  if not is_pemilik() then
    raise exception 'Hanya pemilik yang boleh menambah stok';
  end if;

  for v_it in
    select e.el from jsonb_array_elements(p_items) with ordinality as e(el, ord) order by e.ord
  loop
    v_jumlah := (v_it->>'jumlah')::integer;
    v_harga := (v_it->>'harga')::integer;

    select kode, nama, coalesce(stok, 0) as stok, coalesce(harga_pokok, 0) as harga_pokok
      into v_brg from barang where kode = v_it->>'kode' for update;
    if not found then
      raise exception 'Barang % tidak ditemukan (mungkin sudah dihapus dari Katalog)', v_it->>'kode';
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
          || jsonb_build_array(jsonb_build_object('jumlah', v_jumlah, 'tanggal', p_waktu, 'pembelian_id', p_id))
    where kode = v_brg.kode;

    v_hasil := v_hasil || jsonb_build_array(v_it || jsonb_build_object(
      'nama', v_brg.nama, 'hargaPokokLama', v_brg.harga_pokok, 'hargaPokokBaru', v_hp_baru));
  end loop;

  return v_hasil;
end;
$$;

-- Catat pembelian. p_sudah_datang = false → pesanan (stok belum ditambah). Hutang → otomatis masuk
-- Hutang Supplier (hutangnya ada sejak dipesan, bukan sejak barang datang).
-- p_items: [{"kode": "...", "jumlah": 5, "harga": 69585}, ...]
drop function if exists catat_pembelian(date, text, jsonb, text, text);
create or replace function catat_pembelian(
  p_tanggal date,
  p_supplier text,
  p_items jsonb,
  p_status text,
  p_waktu text,
  p_sudah_datang boolean default true
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_id uuid := gen_random_uuid();
  v_it jsonb;
  v_kode text;
  v_jumlah integer;
  v_harga integer;
  v_nama text;
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
    select nama into v_nama from barang where kode = v_kode;
    if not found then
      raise exception 'Barang % tidak ditemukan', v_kode;
    end if;

    v_total := v_total + v_jumlah * v_harga;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'kode', v_kode, 'nama', v_nama, 'jumlah', v_jumlah, 'harga', v_harga, 'subtotal', v_jumlah * v_harga));
    v_desk := v_desk || case when v_desk = '' then '' else ', ' end || v_nama || ' ×' || v_jumlah;
  end loop;

  if coalesce(p_sudah_datang, true) then
    v_items := pembelian_masukkan_stok(v_id, v_items, p_waktu);
  end if;

  if p_status = 'Hutang' then
    insert into hutang_supplier (nama_supplier, tanggal, deskripsi, nominal, bulan)
    values (v_supplier, p_tanggal, 'Pembelian: ' || v_desk, v_total, to_char(p_tanggal, 'YYYY-MM'))
    returning id into v_hutang;
  end if;

  insert into pembelian (id, tanggal, bulan, nama_supplier, items, total, status_bayar, hutang_supplier_id,
                         waktu_restock, status_barang, tanggal_terima)
  values (v_id, p_tanggal, to_char(p_tanggal, 'YYYY-MM'), v_supplier, v_items, v_total, p_status, v_hutang,
          case when coalesce(p_sudah_datang, true) then p_waktu end,
          case when coalesce(p_sudah_datang, true) then 'Diterima' else 'Dipesan' end,
          case when coalesce(p_sudah_datang, true) then p_tanggal end);

  return v_id;
end;
$$;

-- Barang pesanan datang → masukkan ke stok sekarang.
create or replace function terima_pembelian(p_id uuid, p_tanggal date, p_waktu text) returns void
language plpgsql set search_path = public as $$
declare
  v_pb record;
begin
  if not is_pemilik() then
    raise exception 'Hanya pemilik yang boleh menerima barang pesanan';
  end if;
  select * into v_pb from pembelian where id = p_id for update;
  if not found then
    raise exception 'Pesanan ini tidak ditemukan (mungkin sudah dibatalkan dari HP lain)';
  end if;
  if v_pb.status_barang <> 'Dipesan' then
    raise exception 'Barang pesanan ini sudah diterima sebelumnya';
  end if;

  update pembelian
  set items = pembelian_masukkan_stok(p_id, v_pb.items, p_waktu),
      status_barang = 'Diterima',
      tanggal_terima = coalesce(p_tanggal, current_date),
      waktu_restock = p_waktu
  where id = p_id;
end;
$$;

-- Batalkan pembelian/pesanan. Sudah diterima → stok & restock dikurangi lagi, entri riwayat_restock
-- dihapus, harga pokok dikembalikan kalau sejak itu belum berubah. Masih dipesan → cukup hapus catatannya.
-- Hutang supplier ikut dihapus, kecuali sudah ada pembayarannya (ditolak). Catatan lama tidak bisa dibatalkan.
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
  if v_pb.data_lama then
    raise exception 'Ini catatan belanja lama (dipindah dari Pengeluaran) — stoknya bukan dari catatan ini, jadi tidak bisa dibatalkan.';
  end if;

  if v_pb.hutang_supplier_id is not null then
    if exists (select 1 from hutang_supplier_pembayaran where hutang_supplier_id = v_pb.hutang_supplier_id) then
      raise exception 'Hutang pembelian ini sudah ada pembayarannya. Hapus dulu pembayarannya di Laporan → Hutang Supplier.';
    end if;
    delete from hutang_supplier where id = v_pb.hutang_supplier_id;
  end if;

  if v_pb.status_barang = 'Diterima' then
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
  end if;

  delete from pembelian where id = p_id;
end;
$$;
