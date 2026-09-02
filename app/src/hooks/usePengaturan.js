import { useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/supabaseClient'

function kolomPengaturanKeInternal(row) {
  return {
    operasional: row?.operasional || 0,
    maintenance: row?.maintenance || 0,
    persenMekanik: row?.persen_mekanik ?? 15,
    persenInvestor: row?.persen_investor ?? 15,
    kataSandiLaporan: row?.kata_sandi_laporan || '1234',
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

  async function simpanPengaturan({ operasional, maintenance, persenMekanik, persenInvestor }) {
    const { error } = await db
      .from('pengaturan')
      .update({ operasional, maintenance, persen_mekanik: persenMekanik, persen_investor: persenInvestor })
      .eq('id', 1)
    if (error) throw error
    await invalidate()
  }

  async function gantiSandiLaporan(baru) {
    const { error } = await db.from('pengaturan').update({ kata_sandi_laporan: baru }).eq('id', 1)
    if (error) throw error
    await invalidate()
  }

  return { simpanPengaturan, gantiSandiLaporan }
}
