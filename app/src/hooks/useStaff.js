import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilSemuaBaris, db } from '../lib/supabaseClient'

export function kolomStaffKeInternal(row) {
  return {
    kode: row.kode,
    nama: row.nama,
    jabatan: row.jabatan,
    aktif: row.aktif,
    tanggalMulai: row.tanggal_mulai,
    tanggalKeluar: row.tanggal_keluar,
  }
}

export function useStaffQuery(enabled) {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await ambilSemuaBaris('staff', 'nama')).map(kolomStaffKeInternal),
    enabled,
  })
}

export function generateKodeStaffBaru(staffList) {
  let maks = 0
  staffList.forEach((s) => {
    const m = /^S(\d+)$/.exec(s.kode || '')
    if (m) maks = Math.max(maks, parseInt(m[1], 10))
  })
  return 'S' + String(maks + 1).padStart(3, '0')
}

export function useStaffMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff'] })

  async function simpanStaff(baris) {
    const { error } = await db.from('staff').upsert(baris)
    if (error) throw error
    await invalidate()
  }

  async function hapusStaff(kode) {
    const { error } = await db.from('staff').delete().eq('kode', kode)
    if (error) throw error
    await invalidate()
  }

  return { simpanStaff, hapusStaff }
}
