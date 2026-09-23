import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilSemuaBaris, db } from '../lib/supabaseClient'

export function kolomRiwayatKeInternal(row) {
  return {
    id: row.id,
    noTransaksi: row.no_transaksi,
    tgl: row.tgl,
    namaPelanggan: row.nama_pelanggan,
    nomorHP: row.nomor_hp,
    platKendaraan: row.plat_kendaraan,
    jenisMotor: row.jenis_motor,
    namaJasa: row.nama_jasa,
    namaMekanik: row.nama_mekanik,
    mekanikItems: row.mekanik_items || [],
    biayaJasa: row.biaya_jasa,
    jasaItems: row.jasa_items || [],
    items: row.items || [],
    totalBarang: row.total_barang,
    modalKeluar: row.modal_keluar,
    labaBarang: row.laba_barang,
    totalBayar: row.total_bayar,
    caraBayar: row.cara_bayar,
    uangdibayarkan: row.uangdibayarkan,
    sisaBayar: row.sisa_bayar,
    poinDidapat: row.poin_didapat || 0,
    poinDigunakan: row.poin_digunakan || 0,
    diskonPoin: row.diskon_poin || 0,
  }
}

export function useRiwayatQuery(enabled) {
  return useQuery({
    queryKey: ['riwayat'],
    queryFn: async () => (await ambilSemuaBaris('riwayat', ['created_at', 'id'], true)).map(kolomRiwayatKeInternal),
    enabled,
  })
}

export function useRiwayatMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['riwayat'] })

  async function tambahRiwayat(baris) {
    const { data, error } = await db.from('riwayat').insert(baris).select().single()
    if (error) throw error
    await invalidate()
    return kolomRiwayatKeInternal(data)
  }

  async function hapusRiwayat(id) {
    const { error } = await db.from('riwayat').delete().eq('id', id)
    if (error) throw error
    await invalidate()
  }

  async function ubahRiwayat(id, kolom) {
    const { error } = await db.from('riwayat').update(kolom).eq('id', id)
    if (error) throw error
    await invalidate()
  }

  return { tambahRiwayat, hapusRiwayat, ubahRiwayat }
}
