import { useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/supabaseClient'

function kolomPengaturanKeInternal(row) {
  return {
    persenPemilik: row?.persen_pemilik ?? 60,
    persenCadangan: row?.persen_cadangan ?? 15,
    jamMasukStandar: row?.jam_masuk_standar || '09:00',
  }
}

export function usePengaturanQuery(enabled) {
  return useQuery({
    queryKey: ['pengaturan'],
    queryFn: async () => {
      const { data, error } = await db.from('pengaturan').select('*').eq('id', 1).single()
      if (error) throw error
      return kolomPengaturanKeInternal(data)
    },
    enabled,
  })
}

export function usePengaturanMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pengaturan'] })

  async function simpanPengaturan({ persenPemilik, persenCadangan, jamMasukStandar }) {
    const { error } = await db
      .from('pengaturan')
      .update({ persen_pemilik: persenPemilik, persen_cadangan: persenCadangan, jam_masuk_standar: jamMasukStandar })
      .eq('id', 1)
    if (error) throw error
    await invalidate()
  }

  return { simpanPengaturan }
}
