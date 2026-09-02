import { useMemo } from 'react'
import { useBarangQuery } from '../hooks/useBarang'
import { useRiwayatQuery } from '../hooks/useRiwayat'
import { formatRupiah } from '../lib/format'

const STOK_MINIM = 3

export default function Dashboard({ onNavigate }) {
  const { data: barang = [] } = useBarangQuery(true)
  const { data: riwayat = [] } = useRiwayatQuery(true)

  const sekarang = new Date()

  const transaksiHariIni = useMemo(
    () =>
      riwayat.filter((r) => {
        const t = ambilTanggalDariTeks(r.tgl)
        return (
          t &&
          t.getFullYear() === sekarang.getFullYear() &&
          t.getMonth() === sekarang.getMonth() &&
          t.getDate() === sekarang.getDate()
        )
      }),
    [riwayat],
  )

  const omsetHariIni = transaksiHariIni.reduce((s, r) => s + (r.totalBayar || 0), 0)
  const stokMinimalCount = barang.filter((b) => (b.stok || 0) <= STOK_MINIM).length

  const { terlaris, jarangLaku } = useMemo(() => hitungTerlaris(riwayat), [riwayat])

  return (
    <div>
      <h1 style={{ textAlign: 'center', marginBottom: 16 }}>📊 Dashboard Bengkel</h1>

      <div className="summary-grid">
        <div className="summary-card" style={{ borderLeftColor: '#27ae60' }}>
          <div className="summary-label">💰 Omset Hari Ini</div>
          <div className="summary-value">{formatRupiah(omsetHariIni)}</div>
        </div>
        <div className="summary-card" style={{ borderLeftColor: '#3498db' }}>
          <div className="summary-label">📊 Transaksi Hari Ini</div>
          <div className="summary-value">{transaksiHariIni.length}</div>
        </div>
        <div className="summary-card" style={{ borderLeftColor: '#e74c3c' }}>
          <div className="summary-label">👥 Stok Minimal</div>
          <div className="summary-value">{stokMinimalCount} item</div>
        </div>
        <div className="summary-card" style={{ borderLeftColor: '#f39c12' }}>
          <div className="summary-label">🔥 Barang Terlaris</div>
          <div className="summary-value" style={{ fontSize: 14 }}>
            {terlaris[0]?.[0] || '—'}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>📝 Info Cepat</h2>
        <p style={{ lineHeight: 1.8 }}>
          👋 Selamat datang di <strong>Sistem Manajemen Bengkel</strong>!
          <br />
          ⏰ Tanggal:{' '}
          <strong>
            {sekarang.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </strong>
        </p>
      </div>

      <div className="card">
        <h3>🔥 5 Barang Terlaris</h3>
        <DaftarRingkas data={terlaris} kosong="Belum ada data penjualan" />
      </div>
      <div className="card">
        <h3>🐢 5 Barang Jarang Terjual</h3>
        <DaftarRingkas data={jarangLaku} kosong="Belum cukup data" />
      </div>
    </div>
  )
}

function DaftarRingkas({ data, kosong }) {
  if (data.length === 0) return <div style={{ color: '#666' }}>{kosong}</div>
  return (
    <div>
      {data.map(([nama, jumlah], i) => (
        <div key={nama} style={{ padding: '4px 0', borderBottom: '1px dashed #ddd', display: 'flex', justifyContent: 'space-between' }}>
          <span>
            {i + 1}. {nama}
          </span>
          <strong>× {jumlah}</strong>
        </div>
      ))}
    </div>
  )
}

function hitungTerlaris(riwayat) {
  const terjual = {}
  riwayat.forEach((r) => {
    ;(r.items || []).forEach((brg) => {
      const nama = brg.nama || 'Barang Tidak Diketahui'
      terjual[nama] = (terjual[nama] || 0) + (brg.jumlah || 0)
    })
  })
  const daftar = Object.entries(terjual).sort((a, b) => b[1] - a[1])
  return {
    terlaris: daftar.slice(0, 5),
    jarangLaku: daftar.filter((x) => x[1] > 0).slice(-5).reverse(),
  }
}

function ambilTanggalDariTeks(tgl) {
  if (!tgl) return null
  const p = tgl.split(' ')[0].split('/')
  if (p.length !== 3) return null
  return new Date(p[2], p[1] - 1, p[0])
}
