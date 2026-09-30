import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilSemuaBaris, db } from '../lib/supabaseClient'

function kolomHutangSupplierKeInternal(row) {
  return {
    id: row.id,
    namaSupplier: row.nama_supplier,
    tanggal: row.tanggal,
    deskripsi: row.deskripsi,
    nominal: row.nominal,
    bulan: row.bulan,
  }
}

function kolomPembayaranKeInternal(row) {
  return {
    id: row.id,
    hutangSupplierId: row.hutang_supplier_id,
    tanggal: row.tanggal,
    nominal: row.nominal,
  }
}

export function useHutangSupplierQuery(enabled) {
  return useQuery({
    queryKey: ['hutang_supplier'],
    queryFn: async () => (await ambilSemuaBaris('hutang_supplier', ['tanggal', 'id'])).map(kolomHutangSupplierKeInternal),
    enabled,
  })
}

export function useHutangSupplierPembayaranQuery(enabled) {
  return useQuery({
    queryKey: ['hutang_supplier_pembayaran'],
    queryFn: async () => (await ambilSemuaBaris('hutang_supplier_pembayaran', ['tanggal', 'id'])).map(kolomPembayaranKeInternal),
    enabled,
  })
}

export function useHutangSupplierMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hutang_supplier'] })
  const invalidatePembayaran = () => queryClient.invalidateQueries({ queryKey: ['hutang_supplier_pembayaran'] })

  async function tambahHutangSupplier({ namaSupplier, tanggal, deskripsi, nominal }) {
    const { error } = await db.from('hutang_supplier').insert({
      nama_supplier: namaSupplier,
      tanggal,
      deskripsi,
      nominal,
      bulan: tanggal.substring(0, 7),
    })
    if (error) throw error
    await invalidate()
  }

  async function hapusHutangSupplier(id) {
    const { error } = await db.from('hutang_supplier').delete().eq('id', id)
    if (error) throw error
    await invalidate()
  }

  async function tambahPembayaranSupplier({ hutangSupplierId, tanggal, nominal }) {
    const { data, error } = await db
      .from('hutang_supplier_pembayaran')
      .insert({ hutang_supplier_id: hutangSupplierId, tanggal, nominal })
      .select()
      .single()
    if (error) throw error
    await invalidatePembayaran()
    return kolomPembayaranKeInternal(data)
  }

  async function hapusPembayaranSupplier(id) {
    const { error } = await db.from('hutang_supplier_pembayaran').delete().eq('id', id)
    if (error) throw error
    await invalidatePembayaran()
  }

  return { tambahHutangSupplier, hapusHutangSupplier, tambahPembayaranSupplier, hapusPembayaranSupplier }
}
