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
    gajiPokok: row.gaji_pokok || 0,
    uangMakan: row.uang_makan || 0,
    uangBensin: row.uang_bensin || 0,
    uangLemburPerJam: row.uang_lembur_per_jam || 10000,
    persenBagiHasil: row.persen_bagi_hasil ?? 8,
    persenBagiHasilBersama: row.persen_bagi_hasil_bersama ?? 20,
    nominalTelatPerMenit: row.nominal_telat_per_menit ?? 1000,
    nominalMangkir: row.nominal_mangkir ?? 50000,
  }
}

export function useStaffQuery(enabled) {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await ambilSemuaBaris('staff', ['nama', 'kode'])).map(kolomStaffKeInternal),
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
