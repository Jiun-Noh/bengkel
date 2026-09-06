import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilSemuaBaris, db } from '../lib/supabaseClient'

function kolomInvestorKeInternal(row) {
  return { id: row.id, nama: row.nama, persen: row.persen }
}

export function useInvestorQuery(enabled) {
  return useQuery({
    queryKey: ['investor'],
    queryFn: async () => (await ambilSemuaBaris('investor', ['dibuat_pada', 'id'])).map(kolomInvestorKeInternal),
    enabled,
  })
}

export function useInvestorMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['investor'] })

  async function tambahInvestor({ nama, persen }) {
    const { error } = await db.from('investor').insert({ nama, persen })
    if (error) throw error
    await invalidate()
  }

  async function ubahInvestor(id, { nama, persen }) {
    const { error } = await db.from('investor').update({ nama, persen }).eq('id', id)
    if (error) throw error
    await invalidate()
  }

  async function hapusInvestor(id) {
    const { error } = await db.from('investor').delete().eq('id', id)
    if (error) throw error
    await invalidate()
  }

  return { tambahInvestor, ubahInvestor, hapusInvestor }
}
