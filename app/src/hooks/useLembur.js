import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilSemuaBaris, db } from '../lib/supabaseClient'

function kolomLemburKeInternal(row) {
  return { id: row.id, staffKode: row.staff_kode, bulan: row.bulan, jam: row.jam }
}

export function useLemburQuery(enabled) {
  return useQuery({
    queryKey: ['lembur'],
    queryFn: async () => (await ambilSemuaBaris('lembur', 'bulan')).map(kolomLemburKeInternal),
    enabled,
  })
}

export function useLemburMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lembur'] })

  async function simpanLembur(staffKode, bulan, jam) {
    const { error } = await db.from('lembur').upsert({ staff_kode: staffKode, bulan, jam }, { onConflict: 'staff_kode,bulan' })
    if (error) throw error
    await invalidate()
  }

  return { simpanLembur }
}
