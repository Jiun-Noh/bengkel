import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilSemuaBaris, db } from '../lib/supabaseClient'

function kolomPembelianKeInternal(row) {
  return {
    id: row.id,
    tanggal: row.tanggal,
    bulan: row.bulan,
    namaSupplier: row.nama_supplier,
    items: row.items || [],
    total: row.total || 0,
    statusBayar: row.status_bayar,
    hutangSupplierId: row.hutang_supplier_id,
    statusBarang: row.status_barang || 'Diterima', // 'Dipesan' = sudah dibayar/hutang, barang belum datang
    tanggalTerima: row.tanggal_terima,
    dataLama: !!row.data_lama, // dipindah dari Pengeluaran "Belanja Stok" lama — cuma catatan
    dibuatPada: row.dibuat_pada,
  }
}

// Tabel pembelian cuma bisa dibaca pemilik (RLS) — panggil dengan enabled = pemilik.
export function usePembelianQuery(enabled) {
  return useQuery({
    queryKey: ['pembelian'],
    queryFn: async () => (await ambilSemuaBaris('pembelian', ['tanggal', 'id'])).map(kolomPembelianKeInternal),
    enabled,
  })
}

export function usePembelianMutations() {
  const queryClient = useQueryClient()
  // pembelian mengubah stok, harga pokok, dan (kalau hutang) Hutang Supplier sekaligus
  const invalidate = () =>
    Promise.all(['pembelian', 'barang', 'hutang_supplier'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })))

  // items: [{ kode, jumlah, harga }] — semua dihitung & disimpan di database dalam satu langkah
  // (lihat migrasi_pembelian.sql): stok + restock, harga pokok rata-rata tertimbang, hutang supplier.
  // sudahDatang = false → pesanan: dicatat (dan hutangnya kalau Hutang), stok belum ditambah.
  async function catatPembelian({ tanggal, namaSupplier, items, statusBayar, waktu, sudahDatang = true }) {
    const { data, error } = await db.rpc('catat_pembelian', {
      p_tanggal: tanggal,
      p_supplier: namaSupplier || null,
      p_items: items,
      p_status: statusBayar,
      p_waktu: waktu,
      p_sudah_datang: sudahDatang,
    })
    if (error) throw error
    await invalidate()
    return data
  }

  // Barang pesanan datang → masuk stok sekarang (harga pokok dihitung dari stok saat ini).
  async function terimaPembelian(id, tanggal, waktu) {
    const { error } = await db.rpc('terima_pembelian', { p_id: id, p_tanggal: tanggal, p_waktu: waktu })
    if (error) throw error
    await invalidate()
  }

  async function batalPembelian(id) {
    const { error } = await db.rpc('batal_pembelian', { p_id: id })
    if (error) throw error
    await invalidate()
  }

  return { catatPembelian, terimaPembelian, batalPembelian }
}
