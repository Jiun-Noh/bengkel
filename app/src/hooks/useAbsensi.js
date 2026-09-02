import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilSemuaBaris, db } from '../lib/supabaseClient'

export function kolomAbsensiKeInternal(row) {
  return {
    id: row.id,
    tanggal: row.tanggal,
    jamDatang: row.jam_datang,
    jamPulang: row.jam_pulang,
    jamKerja: row.jam_kerja,
    jabatan: row.jabatan,
    nama: row.nama,
    status: row.status,
    keterangan: row.keterangan,
    bulan: row.bulan,
  }
}

export function useAbsensiQuery(enabled) {
  return useQuery({
    queryKey: ['absensi'],
    queryFn: async () => (await ambilSemuaBaris('absensi', 'tanggal')).map(kolomAbsensiKeInternal),
    enabled,
  })
}

export function useAbsensiMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['absensi'] })

  // simpan(data, kunciLama) — kunciLama = {tanggal, nama} lama jika sedang mengedit & kuncinya berubah
  async function simpanAbsensi(data, kunciLama) {
    if (kunciLama && (kunciLama.tanggal !== data.tanggal || kunciLama.nama !== data.nama)) {
      const { error: errHapus } = await db.from('absensi').delete().eq('tanggal', kunciLama.tanggal).eq('nama', kunciLama.nama)
      if (errHapus) throw errHapus
    }

    const { error } = await db.from('absensi').upsert(
      {
        tanggal: data.tanggal,
        jam_datang: data.jamDatang,
        jam_pulang: data.jamPulang,
        jam_kerja: data.jamKerja,
        jabatan: data.jabatan,
        nama: data.nama,
        status: data.status,
        keterangan: data.keterangan,
        bulan: data.bulan,
      },
      { onConflict: 'tanggal,nama' },
    )
    if (error) throw error
    await invalidate()
  }

  async function hapusAbsensi(tanggal, nama) {
    const { error } = await db.from('absensi').delete().eq('tanggal', tanggal).eq('nama', nama)
    if (error) throw error
    await invalidate()
  }

  return { simpanAbsensi, hapusAbsensi }
}
