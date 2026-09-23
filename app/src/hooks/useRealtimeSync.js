import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/supabaseClient'

const TABEL_DIPANTAU = ['barang', 'riwayat', 'absensi', 'staff', 'pengaturan', 'pengeluaran', 'lembur', 'investor', 'jasa', 'hutang_supplier', 'poin_ledger']

// Satu channel realtime yang memantau semua tabel; setiap perubahan cukup
// meng-invalidate query TanStack yang sesuai, biar react-query yang refetch.
export function useRealtimeSync(aktif) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!aktif) return

    let channel = db.channel('sinkronisasi-bengkel')
    for (const tabel of TABEL_DIPANTAU) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: tabel }, () => {
        queryClient.invalidateQueries({ queryKey: [tabel] })
      })
    }
    channel.subscribe()

    return () => {
      db.removeChannel(channel)
    }
  }, [aktif, queryClient])
}
