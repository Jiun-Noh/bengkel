import { useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/supabaseClient'

function kolomPengaturanKeInternal(row) {
  return {
    persenMekanik: row?.persen_mekanik ?? 8,
    persenPemilik: row?.persen_pemilik ?? 60,
    persenCadangan: row?.persen_cadangan ?? 15,
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

  async function simpanPengaturan({ persenMekanik, persenPemilik, persenCadangan }) {
    const { error } = await db
      .from('pengaturan')
      .update({ persen_mekanik: persenMekanik, persen_pemilik: persenPemilik, persen_cadangan: persenCadangan })
      .eq('id', 1)
    if (error) throw error
    await invalidate()
  }

  return { simpanPengaturan }
}
