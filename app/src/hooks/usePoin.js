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

function hariIniISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

  async function insertEarn({ nomorHP, nama, tanggalISO, riwayatId, poinBaru }) {
    if (poinBaru <= 0) return
    const { error } = await db.from('poin_ledger').insert({
      nomor_hp: nomorHP,
      nama,
      tanggal: tanggalISO,
      jenis: 'earn',
      jumlah: poinBaru,
      sisa: poinBaru,
      kadaluarsa: tambahSatuTahun(tanggalISO),
      riwayat_id: riwayatId,
    })
    if (error) throw error
  }

  // Proses satu transaksi: pakai poin dulu (FIFO dari batch earn tertua yang masih berlaku) —
  // ini selalu terjadi langsung, terlepas dari status lunas. Poin BARU cuma didapat kalau
  // `sudahLunas` true (transaksi ini langsung lunas saat dibuat); kalau belum lunas, poinnya
  // baru diberikan nanti lewat earnPoinSaatLunas() pas pelunasan bikin sisa bayar jadi 0.
  async function prosesPoin({ nomorHP, nama, tanggalISO, riwayatId, poinDigunakan, totalBayarSetelahDiskon, sudahLunas }) {
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

    if (sudahLunas) {
      await insertEarn({ nomorHP, nama, tanggalISO, riwayatId, poinBaru: hitungPoinDidapat(totalBayarSetelahDiskon) })
    }

    await invalidate()
  }

  // Dipanggil dari alur "Catat Pelunasan" pas pembayaran bikin sisa bayar transaksi itu jadi 0
  // buat PERTAMA KALInya — baru di sinilah poin yang tadinya cuma "berpotensi" (dihitung dari
  // totalBayar transaksi, sudah tersimpan di riwayat.poin_didapat) benar-benar dikreditkan.
  async function earnPoinSaatLunas({ nomorHP, nama, tanggalISO, riwayatId, totalBayarSetelahDiskon }) {
    if (!nomorHP || nomorHP === '-') return
    await insertEarn({ nomorHP, nama, tanggalISO, riwayatId, poinBaru: hitungPoinDidapat(totalBayarSetelahDiskon) })
    await invalidate()
  }

  // Dipanggil pas sebuah riwayat DIHAPUS — membatalkan efek poinnya:
  // - Batch earn yang dibuat dari transaksi ini di-nol-kan sisanya (dicegah dipakai lagi;
  //   barisnya tetap disimpan sebagai histori, bukan dihapus).
  // - Poin yang tadinya DIPAKAI di transaksi ini dikembalikan sebagai batch earn BARU (kadaluarsa
  //   1 tahun dari sekarang) — bukan restorasi presisi ke batch asal (butuh rincian per-batch
  //   yang belum kita simpan), tapi saldo pelanggan tetap benar & bukan malah menguntungkan dia.
  async function batalkanPoinUntukRiwayat(riwayatId) {
    const { data: earnRows, error: errAmbilEarn } = await db
      .from('poin_ledger')
      .select('id')
      .eq('riwayat_id', riwayatId)
      .eq('jenis', 'earn')
    if (errAmbilEarn) throw errAmbilEarn
    for (const row of earnRows || []) {
      const { error } = await db.from('poin_ledger').update({ sisa: 0 }).eq('id', row.id)
      if (error) throw error
    }

    const { data: redeemRows, error: errAmbilRedeem } = await db
      .from('poin_ledger')
      .select('*')
      .eq('riwayat_id', riwayatId)
      .eq('jenis', 'redeem')
    if (errAmbilRedeem) throw errAmbilRedeem
    const tanggalISO = hariIniISO()
    for (const row of redeemRows || []) {
      await insertEarn({ nomorHP: row.nomor_hp, nama: row.nama, tanggalISO, riwayatId: null, poinBaru: row.jumlah })
    }

    await invalidate()
  }

  return { prosesPoin, earnPoinSaatLunas, batalkanPoinUntukRiwayat }
}
