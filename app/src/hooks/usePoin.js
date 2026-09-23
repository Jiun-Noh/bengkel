import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilSemuaBaris, db } from '../lib/supabaseClient'

export const RUPIAH_PER_KELIPATAN_POIN = 50000
export const POIN_PER_KELIPATAN = 2
export const NILAI_RUPIAH_PER_POIN = 1000
export const MIN_POIN_PAKAI = 100

function kolomPoinKeInternal(row) {
  return {
    id: row.id,
    nomorHP: row.nomor_hp,
    nama: row.nama,
    tanggal: row.tanggal,
    jenis: row.jenis,
    jumlah: row.jumlah,
    sisa: row.sisa,
    kadaluarsa: row.kadaluarsa,
    riwayatId: row.riwayat_id,
  }
}

export function usePoinLedgerQuery(enabled) {
  return useQuery({
    queryKey: ['poin_ledger'],
    queryFn: async () => (await ambilSemuaBaris('poin_ledger', ['tanggal', 'id'])).map(kolomPoinKeInternal),
    enabled,
  })
}

// Saldo poin yang masih berlaku (belum kadaluarsa) buat satu nomor HP.
export function hitungSaldoPoin(ledger, nomorHP, tanggalAcuanISO) {
  if (!nomorHP || nomorHP === '-') return 0
  return ledger
    .filter((l) => l.nomorHP === nomorHP && l.jenis === 'earn' && l.kadaluarsa >= tanggalAcuanISO)
    .reduce((s, l) => s + (l.sisa || 0), 0)
}

export function hitungPoinDidapat(totalBayar) {
  return Math.floor((totalBayar || 0) / RUPIAH_PER_KELIPATAN_POIN) * POIN_PER_KELIPATAN
}

function tambahSatuTahun(tanggalISO) {
  const [y, m, d] = tanggalISO.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setFullYear(dt.getFullYear() + 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function usePoinMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['poin_ledger'] })

  // Proses satu transaksi: pakai poin dulu (FIFO dari batch earn tertua yang masih berlaku),
  // baru catat poin baru yang didapat dari nominal yang benar-benar dibayar (setelah diskon poin).
  async function prosesPoin({ nomorHP, nama, tanggalISO, riwayatId, poinDigunakan, totalBayarSetelahDiskon }) {
    if (!nomorHP || nomorHP === '-') return

    if (poinDigunakan > 0) {
      const { data: batchAktif, error: errAmbil } = await db
        .from('poin_ledger')
        .select('*')
        .eq('nomor_hp', nomorHP)
        .eq('jenis', 'earn')
        .gt('sisa', 0)
        .gte('kadaluarsa', tanggalISO)
        .order('tanggal', { ascending: true })
      if (errAmbil) throw errAmbil

      let sisaDipakai = poinDigunakan
      for (const batch of batchAktif || []) {
        if (sisaDipakai <= 0) break
        const potong = Math.min(batch.sisa, sisaDipakai)
        const { error: errUpdate } = await db.from('poin_ledger').update({ sisa: batch.sisa - potong }).eq('id', batch.id)
        if (errUpdate) throw errUpdate
        sisaDipakai -= potong
      }

      const { error: errRedeem } = await db.from('poin_ledger').insert({
        nomor_hp: nomorHP,
        nama,
        tanggal: tanggalISO,
        jenis: 'redeem',
        jumlah: poinDigunakan,
        riwayat_id: riwayatId,
      })
      if (errRedeem) throw errRedeem
    }

    const poinBaru = hitungPoinDidapat(totalBayarSetelahDiskon)
    if (poinBaru > 0) {
      const { error: errEarn } = await db.from('poin_ledger').insert({
        nomor_hp: nomorHP,
        nama,
        tanggal: tanggalISO,
        jenis: 'earn',
        jumlah: poinBaru,
        sisa: poinBaru,
        kadaluarsa: tambahSatuTahun(tanggalISO),
        riwayat_id: riwayatId,
      })
      if (errEarn) throw errEarn
    }

    await invalidate()
  }

  return { prosesPoin }
}
