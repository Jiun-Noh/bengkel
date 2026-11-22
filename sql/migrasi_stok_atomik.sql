-- Perubahan stok/terjual/restock dihitung LANGSUNG di database (tambah/kurang dari nilai saat ini),
-- bukan lagi "app hitung angka baru dari data di HP lalu timpa". Cara lama bisa kehilangan
-- penjualan kalau data di HP sudah basi (sinyal realtime terlewat) atau dua HP jualan bersamaan —
-- kasus MIZONE: 4 transaksi tapi Terjual cuma 3.
--
-- JALANKAN FILE INI DULU, BARU DEPLOY APP-nya. App versi baru memanggil fungsi-fungsi di bawah;
-- kalau fungsinya belum ada, jualan & restock akan gagal tersimpan.
--
-- Semua fungsi SECURITY INVOKER (bawaan): tetap tunduk RLS & trigger yang sudah ada
-- (jaga_harga_barang, catat_perubahan_barang), jadi hak akses nggak berubah.

-- Jual (p_jumlah positif) atau kembalikan stok dari transaksi yang dihapus (p_jumlah negatif).
create or replace function jual_barang(p_kode text, p_jumlah integer) returns void
language plpgsql set search_path = public as $$
begin
  update barang
  set stok = coalesce(stok, 0) - p_jumlah,
      terjual = greatest(0, coalesce(terjual, 0) + p_jumlah)
  where kode = p_kode;
  if not found then
    raise exception 'Barang % tidak ditemukan', p_kode;
  end if;
end;
$$;

-- Restock: tambah stok & total restock, dan catat ke riwayat_restock — dalam satu UPDATE.
create or replace function restock_barang(p_kode text, p_jumlah integer, p_tanggal text) returns void
language plpgsql set search_path = public as $$
begin
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

-- Batalkan satu entri restock. Entri dicari berdasarkan isinya (jumlah + tanggal), bukan nomor
-- urut dari HP — nomor urut di HP bisa sudah basi kalau ada restock lain di HP lain.
create or replace function batal_restock_barang(p_kode text, p_jumlah integer, p_tanggal text) returns void
language plpgsql set search_path = public as $$
declare
  v_idx integer;
begin
  perform 1 from barang where kode = p_kode for update; -- kunci baris dulu
  if not found then
    raise exception 'Barang % tidak ditemukan', p_kode;
  end if;

  select e.ord - 1 into v_idx
  from barang b, jsonb_array_elements(coalesce(b.riwayat_restock, '[]'::jsonb)) with ordinality as e(el, ord)
  where b.kode = p_kode
    and (e.el->>'jumlah')::integer = p_jumlah
    and e.el->>'tanggal' = p_tanggal
  order by e.ord
  limit 1;

  if v_idx is null then
    raise exception 'Riwayat restock ini tidak ditemukan (mungkin sudah dibatalkan dari HP lain)';
  end if;

  update barang
  set stok = coalesce(stok, 0) - p_jumlah,
      restock = coalesce(restock, 0) - p_jumlah,
      riwayat_restock = riwayat_restock - v_idx
  where kode = p_kode;
end;
$$;
