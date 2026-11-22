import { useMemo, useState } from 'react'
import { useBarangQuery } from '../hooks/useBarang'
import { usePembelianQuery, usePembelianMutations } from '../hooks/usePembelian'
import { useHutangSupplierQuery } from '../hooks/useHutangSupplier'
import { useUI } from '../contexts/UIContext'
import { formatRupiah } from '../lib/format'
import { hariIniLokal } from '../lib/belanjaStok'

// 🛒 Pembelian stok (khusus pemilik): belanja barang dagangan dicatat di sini, BUKAN di
// Laporan → Pengeluaran. Satu simpan = stok bertambah + harga pokok dihitung ulang (rata-rata
// tertimbang) + catatan pembelian + (kalau hutang) masuk Hutang Supplier. Semua dikerjakan
// database dalam satu langkah — lihat migrasi_pembelian.sql.

export function buatDraftPembelian() {
  return { tanggal: hariIniLokal(), namaSupplier: '', statusBayar: 'Lunas', items: [] }
}

// Tambah barang ke draf; kalau sudah ada di draf, cukup biarkan (jumlahnya diisi di tab Pembelian).
export function tambahKeDraft(draft, b) {
  if (draft.items.some((it) => it.kode === b.kode)) return draft
  return { ...draft, items: [...draft.items, { kode: b.kode, jumlah: '', harga: b.hargaPokok ? String(b.hargaPokok) : '' }] }
}

// Sama persis dengan hitungan di catat_pembelian: stok ≤ 0 → harga beli; selain itu rata-rata tertimbang.
function hargaPokokBaru(stok, hpLama, jumlah, harga) {
  if (stok <= 0) return harga
  return Math.round((stok * hpLama + jumlah * harga) / (stok + jumlah))
}

function waktuRestock(tanggalISO) {
  const [y, m, d] = tanggalISO.split('-')
  const s = new Date()
  const p2 = (n) => String(n).padStart(2, '0')
  return `${d}/${m}/${y} ${p2(s.getHours())}:${p2(s.getMinutes())}`
}

function labelBulan(iso) {
  const [y, m] = iso.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

export default function PembelianSection({ draft, setDraft }) {
  const { data: barang = [] } = useBarangQuery(true)
  const { data: pembelian = [], isLoading } = usePembelianQuery(true)
  const { data: hutangSupplier = [] } = useHutangSupplierQuery(true)
  const { catatPembelian, batalPembelian } = usePembelianMutations()
  const { notify, confirm } = useUI()

  const [cari, setCari] = useState('')
  const [saving, setSaving] = useState(false)
  const [bulanLihat, setBulanLihat] = useState(hariIniLokal().substring(0, 7))
  const [batalId, setBatalId] = useState(null)

  const barangPerKode = useMemo(() => Object.fromEntries(barang.map((b) => [b.kode, b])), [barang])

  const daftarSupplier = useMemo(() => {
    const nama = new Set()
    pembelian.forEach((p) => p.namaSupplier && nama.add(p.namaSupplier))
    hutangSupplier.forEach((h) => h.namaSupplier && nama.add(h.namaSupplier))
    return [...nama].sort((a, b) => a.localeCompare(b))
  }, [pembelian, hutangSupplier])

  const hasilCari = useMemo(() => {
    const kata = cari.trim().toUpperCase()
    if (!kata) return []
    return barang
      .filter((b) => b.kode.includes(kata) || b.nama.toUpperCase().includes(kata) || (b.jenisMotor || '').toUpperCase().includes(kata))
      .slice(0, 8)
  }, [barang, cari])

  // Pratinjau per baris: harga pokok lama → baru. Barang yang muncul dua kali dihitung berurutan,
  // sama seperti di database.
  const baris = useMemo(() => {
    const jalan = {} // kode → { stok, hp }
    return draft.items.map((it, idx) => {
      const b = barangPerKode[it.kode]
      const jumlah = parseInt(it.jumlah, 10) || 0
      const harga = it.harga === '' ? null : parseInt(it.harga, 10)
      const teks = { teksJumlah: it.jumlah, teksHarga: it.harga }
      if (!b) return { ...it, ...teks, idx, b: null, jumlah, harga, subtotal: 0 }
      const awal = jalan[it.kode] || { stok: b.stok || 0, hp: b.hargaPokok || 0 }
      const baru = jumlah > 0 && harga != null && harga >= 0 ? hargaPokokBaru(awal.stok, awal.hp, jumlah, harga) : null
      if (baru != null) jalan[it.kode] = { stok: awal.stok + jumlah, hp: baru }
      return { ...it, ...teks, idx, b, jumlah, harga, subtotal: jumlah * (harga || 0), hpLama: awal.hp, hpBaru: baru }
    })
  }, [draft.items, barangPerKode])

  const total = baris.reduce((s, r) => s + r.subtotal, 0)

  const pembelianBulan = useMemo(
    () =>
      pembelian
        .filter((p) => p.bulan === bulanLihat)
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || (b.dibuatPada || '').localeCompare(a.dibuatPada || '')),
    [pembelian, bulanLihat],
  )
  const totalBulan = pembelianBulan.reduce((s, p) => s + p.total, 0)

  function ubahDraft(kolom) {
    setDraft((d) => ({ ...d, ...kolom }))
  }

  function ubahItem(idx, kolom) {
    setDraft((d) => ({ ...d, items: d.items.map((it, i) => (i === idx ? { ...it, ...kolom } : it)) }))
  }

  function hapusItem(idx) {
    setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== idx) }))
  }

  function pilihBarang(b) {
    setDraft((d) => tambahKeDraft(d, b))
    setCari('')
  }

  async function simpan(e) {
    e.preventDefault()
    if (baris.length === 0) {
      notify('⚠️ Tambahkan barang yang dibeli dulu!', 'error')
      return
    }
    const salah = baris.find((r) => !r.b || r.jumlah <= 0 || r.harga == null || Number.isNaN(r.harga) || r.harga < 0)
    if (salah) {
      notify(
        !salah.b
          ? `❌ Barang ${salah.kode} sudah tidak ada di katalog — hapus dari daftar.`
          : salah.jumlah <= 0
            ? `⚠️ Isi jumlah beli untuk ${salah.b.nama}!`
            : `⚠️ Isi harga beli per ${salah.b.satuan || 'PCS'} untuk ${salah.b.nama}!`,
        'error',
      )
      return
    }
    const supplier = draft.namaSupplier.trim()
    if (draft.statusBayar === 'Hutang' && !supplier) {
      notify('⚠️ Pembelian Hutang wajib isi nama supplier!', 'error')
      return
    }

    const gratis = baris.filter((r) => r.harga === 0)
    const ok = await confirm(
      `🛒 Simpan pembelian ${formatRupiah(total)}?\n\n` +
        baris.map((r) => `• ${r.b.nama} +${r.jumlah} @ ${formatRupiah(r.harga)}`).join('\n') +
        (draft.statusBayar === 'Hutang' ? `\n\n🚚 Masuk Hutang Supplier: ${supplier}` : '\n\n✅ Lunas') +
        (gratis.length ? `\n\n⚠️ Harga beli Rp 0: ${gratis.map((r) => r.b.nama).join(', ')} (barang gratis/bonus?)` : ''),
    )
    if (!ok) return

    setSaving(true)
    try {
      await catatPembelian({
        tanggal: draft.tanggal,
        namaSupplier: supplier,
        statusBayar: draft.statusBayar,
        items: baris.map((r) => ({ kode: r.kode, jumlah: r.jumlah, harga: r.harga })),
        waktu: waktuRestock(draft.tanggal),
      })
      notify(`✅ Pembelian tersimpan! Stok & harga pokok sudah diperbarui.${draft.statusBayar === 'Hutang' ? '\n🚚 Tercatat di Hutang Supplier.' : ''}`)
      setDraft({ ...buatDraftPembelian(), tanggal: draft.tanggal, namaSupplier: draft.namaSupplier, statusBayar: draft.statusBayar })
      setBulanLihat(draft.tanggal.substring(0, 7))
    } catch (err) {
      notify('❌ Gagal menyimpan pembelian: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function batalkan(p) {
    const ok = await confirm(
      `⚠️ Batalkan pembelian ${p.tanggal} (${formatRupiah(p.total)})?\n\n` +
        p.items.map((it) => `• ${it.nama} −${it.jumlah}`).join('\n') +
        '\n\nStok dikurangi lagi.' +
        (p.hutangSupplierId ? ' Catatan Hutang Supplier-nya ikut dihapus.' : ''),
    )
    if (!ok) return
    setBatalId(p.id)
    try {
      await batalPembelian(p.id)
      notify('✅ Pembelian dibatalkan, stok sudah disesuaikan.')
    } catch (err) {
      notify('❌ Gagal membatalkan: ' + err.message, 'error')
    } finally {
      setBatalId(null)
    }
  }

  return (
    <div>
      <form className="card" onSubmit={simpan}>
        <h2 style={{ marginTop: 0 }}>🛒 Catat Pembelian Stok</h2>
        <p style={{ fontSize: 12, color: '#666', marginTop: -6 }}>
          ⓘ Belanja barang dagangan dicatat di sini — <b>jangan</b> lagi di Laporan → Pengeluaran. Stok bertambah dan harga pokok dihitung ulang otomatis
          (rata-rata dari stok lama + barang baru).
        </p>

        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 140px' }}>
            <label>Tanggal</label>
            <input type="date" value={draft.tanggal} onChange={(e) => ubahDraft({ tanggal: e.target.value || hariIniLokal() })} />
          </div>
          <div className="field" style={{ flex: '2 1 180px' }}>
            <label>Supplier {draft.statusBayar === 'Hutang' ? '(wajib)' : '(boleh kosong)'}</label>
            <input
              list="daftar-supplier"
              value={draft.namaSupplier}
              onChange={(e) => ubahDraft({ namaSupplier: e.target.value })}
              placeholder="Contoh: CV Sumber Jaya"
            />
            <datalist id="daftar-supplier">
              {daftarSupplier.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="field">
          <label>Pembayaran</label>
          <div className="row">
            {[
              ['Lunas', '✅ Lunas (bayar sekarang)', '#16a34a'],
              ['Hutang', '🚚 Hutang ke supplier', '#ea580c'],
            ].map(([nilai, label, warna]) => (
              <button
                key={nilai}
                type="button"
                className="btn btn-sm"
                style={{ background: draft.statusBayar === nilai ? warna : '#ddd', color: draft.statusBayar === nilai ? 'white' : '#333' }}
                onClick={() => ubahDraft({ statusBayar: nilai })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ position: 'relative' }}>
          <label>Tambah barang</label>
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔍 Ketik kode / nama / motor…" />
          {hasilCari.length > 0 && (
            <div style={{ border: '1px solid #ddd', borderRadius: 8, marginTop: 4, background: 'white', maxHeight: 280, overflowY: 'auto' }}>
              {hasilCari.map((b) => {
                const sudah = draft.items.some((it) => it.kode === b.kode)
                return (
                  <button
                    key={b.kode}
                    type="button"
                    onClick={() => pilihBarang(b)}
                    disabled={sudah}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none',
                      borderBottom: '1px solid #f0f0f0', background: sudah ? '#f5f5f5' : 'white', cursor: sudah ? 'default' : 'pointer',
                    }}
                  >
                    <b>{b.nama}</b> <span style={{ color: '#888', fontSize: 12 }}>({b.kode}{b.jenisMotor ? ' · ' + b.jenisMotor : ''})</span>
                    <br />
                    <span style={{ fontSize: 12, color: '#666' }}>
                      Stok {b.stok || 0} · Pokok {formatRupiah(b.hargaPokok)} · Jual {formatRupiah(b.hargaJual)}
                      {sudah && ' · ✔ sudah di daftar'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {cari.trim() && hasilCari.length === 0 && (
            <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>🔍 Tidak ada. Barang baru? Tambahkan dulu di 📦 Barang (stok 0), lalu beli di sini.</p>
          )}
        </div>

        {baris.length === 0 && (
          <p style={{ color: '#888', textAlign: 'center', padding: '8px 0' }}>📭 Belum ada barang. Cari di atas, atau tekan 🔄 di daftar 📦 Barang.</p>
        )}

        {baris.map((r) => (
          <BarisPembelian key={r.idx} r={r} onUbah={(kolom) => ubahItem(r.idx, kolom)} onHapus={() => hapusItem(r.idx)} />
        ))}

        {baris.length > 0 && (
          <>
            <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700, fontSize: 17, margin: '12px 0' }}>
              <span>Total ({baris.length} barang)</span>
              <span>{formatRupiah(total)}</span>
            </div>
            <button className="btn btn-block" type="submit" disabled={saving}>
              {saving ? 'Menyimpan…' : '💾 Simpan Pembelian'}
            </button>
          </>
        )}
      </form>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>📋 Riwayat Pembelian</h2>
          <input type="month" value={bulanLihat} onChange={(e) => e.target.value && setBulanLihat(e.target.value)} style={{ width: 'auto' }} />
        </div>
        <p style={{ fontSize: 13, color: '#555' }}>
          {labelBulan(bulanLihat)}: <b>{pembelianBulan.length}</b> nota · Total <b>{formatRupiah(totalBulan)}</b>
        </p>
        {isLoading && <p style={{ color: '#888' }}>Memuat…</p>}
        {!isLoading && pembelianBulan.length === 0 && (
          <p style={{ color: '#888', textAlign: 'center' }}>
            📭 Belum ada pembelian bulan ini.
            {bulanLihat <= '2026-11' && (
              <>
                <br />
                <small>Belanja sebelum 23 November ada di Laporan → Pengeluaran (kategori "Belanja Stok").</small>
              </>
            )}
          </p>
        )}
        <div className="table-scroll" style={{ maxHeight: '60vh' }}>
          {pembelianBulan.map((p) => (
            <div key={p.id} style={{ borderTop: '1px solid #eee', padding: '10px 0' }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <div>
                  <b>{p.tanggal}</b> {p.namaSupplier && <span>· {p.namaSupplier}</span>}{' '}
                  <span className="badge" style={{ background: p.statusBayar === 'Hutang' ? '#ffedd5' : '#dcfce7', color: p.statusBayar === 'Hutang' ? '#c2410c' : '#15803d' }}>
                    {p.statusBayar === 'Hutang' ? '🚚 Hutang' : '✅ Lunas'}
                  </span>
                </div>
                <b style={{ whiteSpace: 'nowrap' }}>{formatRupiah(p.total)}</b>
              </div>
              <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                {p.items.map((it, i) => (
                  <div key={i}>
                    • {it.nama} ×{it.jumlah} @ {formatRupiah(it.harga)}
                    {it.hargaPokokLama !== it.hargaPokokBaru && (
                      <span style={{ color: '#888' }}> (pokok {formatRupiah(it.hargaPokokLama)} → {formatRupiah(it.hargaPokokBaru)})</span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'right', marginTop: 4 }}>
                <button className="btn btn-outline btn-sm" onClick={() => batalkan(p)} disabled={batalId === p.id}>
                  {batalId === p.id ? 'Membatalkan…' : '✕ Batalkan'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BarisPembelian({ r, onUbah, onHapus }) {
  const b = r.b
  if (!b) {
    return (
      <div style={{ border: '1px solid #fecaca', background: '#fff1f1', borderRadius: 8, padding: 10, marginBottom: 8 }} className="row">
        <span style={{ flex: 1 }}>❌ {r.kode} sudah tidak ada di katalog</span>
        <button type="button" className="btn btn-red btn-sm" onClick={onHapus}>✕</button>
      </div>
    )
  }
  const jual = b.hargaJual || 0
  const naik = r.hpBaru != null && r.hpBaru > r.hpLama
  const rugi = r.hpBaru != null && jual > 0 && r.hpBaru >= jual

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginBottom: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div style={{ minWidth: 0 }}>
          <b>{b.nama}</b> <span style={{ color: '#888', fontSize: 12 }}>({b.kode})</span>
          <div style={{ fontSize: 12, color: '#666' }}>Stok sekarang {b.stok || 0} {b.satuan || 'PCS'} · Jual {formatRupiah(jual)}</div>
        </div>
        <button type="button" className="btn btn-red btn-sm" onClick={onHapus} title="Hapus dari daftar">✕</button>
      </div>
      <div className="row" style={{ marginTop: 6, flexWrap: 'nowrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '1 1 0', marginBottom: 0 }}>
          <label style={{ fontSize: 12 }}>Jumlah ({b.satuan || 'PCS'})</label>
          <input type="number" inputMode="numeric" min="1" value={r.teksJumlah} onChange={(e) => onUbah({ jumlah: e.target.value })} placeholder="0" />
        </div>
        <div className="field" style={{ flex: '1.4 1 0', marginBottom: 0 }}>
          <label style={{ fontSize: 12 }}>Harga beli / {b.satuan || 'PCS'}</label>
          <input type="number" inputMode="numeric" min="0" value={r.teksHarga} onChange={(e) => onUbah({ harga: e.target.value })} placeholder="Rp" />
        </div>
      </div>
      <div style={{ fontSize: 12, marginTop: 6, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span>
          {r.hpBaru == null ? (
            <span style={{ color: '#888' }}>Harga pokok sekarang {formatRupiah(r.hpLama)}</span>
          ) : r.hpBaru === r.hpLama ? (
            <span style={{ color: '#888' }}>Harga pokok tetap {formatRupiah(r.hpLama)}</span>
          ) : (
            <span style={{ color: naik ? '#c2410c' : '#15803d' }}>
              Harga pokok {formatRupiah(r.hpLama)} → <b>{formatRupiah(r.hpBaru)}</b> {naik ? '▲' : '▼'}
            </span>
          )}
        </span>
        <b>{formatRupiah(r.subtotal)}</b>
      </div>
      {rugi && (
        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
          ⚠️ Harga pokok jadi ≥ harga jual ({formatRupiah(jual)}) — jual barang ini bakal rugi. Naikkan harga jual lewat ✏️ di 📦 Barang.
        </div>
      )}
      {!rugi && naik && jual > 0 && (
        <div style={{ fontSize: 12, color: '#c2410c', marginTop: 4 }}>
          Untung per {b.satuan || 'PCS'}: {formatRupiah(jual - r.hpLama)} → {formatRupiah(jual - r.hpBaru)}. Cek apakah harga jual perlu dinaikkan.
        </div>
      )}
    </div>
  )
}
