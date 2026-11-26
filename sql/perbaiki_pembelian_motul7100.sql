-- Motul 7100 (MTL-OLI-003): barangnya SUDAH diterima 25/11 (waktu didaftarkan sebagai barang baru langsung
-- diisi stok 3 — stok itu BENAR). Yang salah: catatan 🛒 Pembelian-nya masih "Dipesan" (belum datang).
-- Kalau dibiarkan & "✅ Terima barang" ditekan, stok jadi 6.
--
-- Perbaikan (stok TIDAK diubah):
--   1) Pembelian Motul 7100 → status Diterima (25/11), harga pokok lama/baru 270.000.
--   2) Entri riwayat_restock 25/11 di barang ditandai pembelian_id → kalau suatu saat pembelian ini
--      dibatalkan, stok & riwayatnya ikut beres seperti pembelian biasa.
-- Satu blok = satu transaksi; kalau keadaannya tidak persis seperti dicek, semuanya batal.

-- ============ LANGKAH 1 — PRATINJAU (harus 1 pesanan + barang stok ≥ 3 dengan 1 entri restock tanpa pembelian_id) ============
select id, tanggal, status_barang, total, items from pembelian
where status_barang = 'Dipesan' and items @> '[{"kode": "MTL-OLI-003"}]';
select kode, nama, stok, restock, terjual, harga_pokok, riwayat_restock from barang where kode = 'MTL-OLI-003';

-- ============ LANGKAH 2 — JALANKAN ============
do $$
declare
  v_jml int;
  v_id uuid;
begin
  select count(*), min(id::text)::uuid into v_jml, v_id from pembelian
  where status_barang = 'Dipesan' and total = 810000 and items @> '[{"kode": "MTL-OLI-003", "jumlah": 3}]';
  if v_jml <> 1 then raise exception 'Pesanan Motul 7100 ditemukan % (harus 1) — dibatalkan', v_jml; end if;

  update barang
  set riwayat_restock = jsonb_build_array(jsonb_build_object('jumlah', 3, 'tanggal', '25/11/2026 10:31', 'pembelian_id', v_id))
  where kode = 'MTL-OLI-003'
    and riwayat_restock = '[{"jumlah": 3, "tanggal": "25/11/2026 10:31"}]'::jsonb;
  if not found then raise exception 'Riwayat restock Motul 7100 sudah berubah — dibatalkan, cek dulu'; end if;

  update pembelian
  set status_barang = 'Diterima',
      tanggal_terima = '2026-11-25',
      waktu_restock = '25/11/2026 10:31',
      items = jsonb_build_array(items->0 || '{"hargaPokokLama": 270000, "hargaPokokBaru": 270000}'::jsonb)
  where id = v_id;

  raise notice 'OK: pembelian % sekarang Diterima, stok tidak diubah', v_id;
end $$;

-- ============ LANGKAH 3 — CEK (pesanan 0, pembelian Diterima, stok tetap 3) ============
select count(*) as pesanan_belum_datang from pembelian where status_barang = 'Dipesan';
select tanggal, status_barang, tanggal_terima, items from pembelian where items @> '[{"kode": "MTL-OLI-003"}]';
select kode, stok, restock, harga_pokok, riwayat_restock from barang where kode = 'MTL-OLI-003';
