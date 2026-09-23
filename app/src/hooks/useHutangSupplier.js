import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilSemuaBaris, db } from '../lib/supabaseClient'

function kolomHutangSupplierKeInternal(row) {
  return {
    id: row.id,
    namaSupplier: row.nama_supplier,
    tanggal: row.tanggal,
    deskripsi: row.deskripsi,
    nominal: row.nominal,
    status: row.status,
    tanggalLunas: row.tanggal_lunas,
    bulan: row.bulan,
  }
}

export function useHutangSupplierQuery(enabled) {
  return useQuery({
    queryKey: ['hutang_supplier'],
    queryFn: async () => (await ambilSemuaBaris('hutang_supplier', ['tanggal', 'id'])).map(kolomHutangSupplierKeInternal),
    enabled,
  })
}

export function useHutangSupplierMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hutang_supplier'] })

  async function tambahHutangSupplier({ namaSupplier, tanggal, deskripsi, nominal }) {
    const { error } = await db.from('hutang_supplier').insert({
      nama_supplier: namaSupplier,
      tanggal,
      deskripsi,
      nominal,
      status: 'Belum Lunas',
      bulan: tanggal.substring(0, 7),
    })
    if (error) throw error
    await invalidate()
  }

  async function ubahStatusHutangSupplier(id, status) {
    const { error } = await db
      .from('hutang_supplier')
      .update({ status, tanggal_lunas: status === 'Lunas' ? new Date().toISOString().split('T')[0] : null })
      .eq('id', id)
    if (error) throw error
    await invalidate()
  }

  async function hapusHutangSupplier(id) {
    const { error } = await db.from('hutang_supplier').delete().eq('id', id)
    if (error) throw error
    await invalidate()
  }

  return { tambahHutangSupplier, ubahStatusHutangSupplier, hapusHutangSupplier }
}
