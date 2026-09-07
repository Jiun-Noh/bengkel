import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilSemuaBaris, db } from '../lib/supabaseClient'

function kolomJasaKeInternal(row) {
  return { id: row.id, nama: row.nama, harga: row.harga }
}

export function useJasaQuery(enabled) {
  return useQuery({
    queryKey: ['jasa'],
    queryFn: async () => (await ambilSemuaBaris('jasa', ['nama', 'id'])).map(kolomJasaKeInternal),
    enabled,
  })
}

export function useJasaMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['jasa'] })

  async function tambahJasa({ nama, harga }) {
    const { error } = await db.from('jasa').insert({ nama, harga })
    if (error) throw error
    await invalidate()
  }

  async function ubahJasa(id, { nama, harga }) {
    const { error } = await db.from('jasa').update({ nama, harga }).eq('id', id)
    if (error) throw error
    await invalidate()
  }

  async function hapusJasa(id) {
    const { error } = await db.from('jasa').delete().eq('id', id)
    if (error) throw error
    await invalidate()
  }

  return { tambahJasa, ubahJasa, hapusJasa }
}
