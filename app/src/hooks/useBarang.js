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
    queryFn: async () => (await ambilSemuaBaris('barang', 'nama')).map(kolomBarangKeInternal),
    enabled,
  })
}

export function useBarangMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['barang'] })

  async function simpanBarang(baris) {
    const { error } = await db.from('barang').upsert(baris)
    if (error) throw error
    await invalidate()
  }

  async function hapusBarang(kode) {
    const { error } = await db.from('barang').delete().eq('kode', kode)
    if (error) throw error
    await invalidate()
  }

  async function ubahStokTerjual(kode, stok, terjual) {
    const { error } = await db.from('barang').update({ stok, terjual }).eq('kode', kode)
    if (error) throw error
  }

  return { simpanBarang, hapusBarang, ubahStokTerjual }
}
