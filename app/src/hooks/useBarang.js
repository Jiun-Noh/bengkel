import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilSemuaBaris, db } from '../lib/supabaseClient'

export function kolomBarangKeInternal(row) {
  return {
    kode: row.kode,
    nama: row.nama,
    jenisMotor: row.jenis_motor,
    satuan: row.satuan,
    hargaPokok: row.harga_pokok,
    hargaJual: row.harga_jual,
    stok: row.stok,
    stokAwal: row.stok_awal,
    restock: row.restock,
    terjual: row.terjual,
    tanggalStokAwal: row.tanggal_stok_awal,
    riwayatRestock: row.riwayat_restock || [],
  }
}

export function useBarangQuery(enabled) {
  return useQuery({
    queryKey: ['barang'],
    queryFn: async () => (await ambilSemuaBaris('barang', ['nama', 'kode'])).map(kolomBarangKeInternal),
    enabled,
  })
}

export function useBarangMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['barang'] })

  // Stok/terjual/restock JANGAN pernah ditulis sebagai angka jadi dari data di HP (bisa basi →
  // penjualan hilang). Semua perubahan angka lewat fungsi database yang menambah/mengurangi
  // nilai saat ini (lihat migrasi_stok_atomik.sql).

  async function tambahBarang(baris) {
    // insert (bukan upsert): kalau kode sudah ada, ditolak — nggak menimpa barang lama
    const { error } = await db.from('barang').insert(baris)
    if (error) throw error
    await invalidate()
  }

  // Cuma data katalog (nama, motor, satuan, harga) — angka stok tidak ikut ditulis.
  async function ubahInfoBarang(kode, kolom) {
    const { error } = await db.from('barang').update(kolom).eq('kode', kode)
    if (error) throw error
    await invalidate()
  }

  async function hapusBarang(kode) {
    const { error } = await db.from('barang').delete().eq('kode', kode)
    if (error) throw error
    await invalidate()
  }

  // jumlah positif = terjual, negatif = dikembalikan (transaksi dihapus)
  async function jualBarang(kode, jumlah) {
    const { error } = await db.rpc('jual_barang', { p_kode: kode, p_jumlah: jumlah })
    if (error) throw error
    await invalidate()
  }

  async function restockBarang(kode, jumlah, tanggal) {
    const { error } = await db.rpc('restock_barang', { p_kode: kode, p_jumlah: jumlah, p_tanggal: tanggal })
    if (error) throw error
    await invalidate()
  }

  async function batalRestock(kode, jumlah, tanggal) {
    const { error } = await db.rpc('batal_restock_barang', { p_kode: kode, p_jumlah: jumlah, p_tanggal: tanggal })
    if (error) throw error
    await invalidate()
  }

  return { tambahBarang, ubahInfoBarang, hapusBarang, jualBarang, restockBarang, batalRestock }
}
