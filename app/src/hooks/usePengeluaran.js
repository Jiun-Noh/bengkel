import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilSemuaBaris, db } from '../lib/supabaseClient'

function kolomPengeluaranKeInternal(row) {
  return {
    id: row.id,
    tanggal: row.tanggal,
    kategori: row.kategori,
    deskripsi: row.deskripsi,
    nominal: row.nominal,
    bulan: row.bulan,
  }
}

export function usePengeluaranQuery(enabled) {
  return useQuery({
    queryKey: ['pengeluaran'],
    queryFn: async () => (await ambilSemuaBaris('pengeluaran', ['tanggal', 'id'])).map(kolomPengeluaranKeInternal),
    enabled,
  })
}

export function usePengeluaranMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pengeluaran'] })

  async function tambahPengeluaran({ tanggal, kategori, deskripsi, nominal }) {
    const { error } = await db.from('pengeluaran').insert({
      tanggal,
      kategori,
      deskripsi,
      nominal,
      bulan: tanggal.substring(0, 7),
    })
    if (error) throw error
    await invalidate()
  }

  async function hapusPengeluaran(id) {
    const { error } = await db.from('pengeluaran').delete().eq('id', id)
    if (error) throw error
    await invalidate()
  }

  return { tambahPengeluaran, hapusPengeluaran }
}
