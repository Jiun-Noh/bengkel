import { useEffect, useMemo, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import { useRiwayatQuery } from '../hooks/useRiwayat'
import { usePengaturanQuery, usePengaturanMutations } from '../hooks/usePengaturan'
import { useUI } from '../contexts/UIContext'
import { useOwnerMode } from '../contexts/OwnerModeContext'
import { formatRupiah, waktuSekarang } from '../lib/format'
import Modal from '../components/common/Modal'

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function ambilTanggalDariTeks(tgl) {
  if (!tgl) return null
  const p = tgl.split(' ')[0].split('/')
  if (p.length !== 3) return null
  return new Date(p[2], p[1] - 1, p[0])
}

export default function LaporanPage() {
  const { data: pengaturan, isLoading: loadingPengaturan } = usePengaturanQuery(true)
  const { data: riwayat = [] } = useRiwayatQuery(true)
  const { simpanPengaturan, gantiSandiLaporan } = usePengaturanMutations()
  const { notify } = useUI()
  const { unlocked, unlock } = useOwnerMode()

  const [sandiInput, setSandiInput] = useState('')
  const [gantiSandiOpen, setGantiSandiOpen] = useState(false)

  function coba(e) {
    e.preventDefault()
    if (unlock(sandiInput)) {
      setSandiInput('')
    } else {
      notify('❌ Kata sandi laporan salah!', 'error')
      setSandiInput('')
    }
  }

  if (!unlocked) {
    return (
      <div>
        <h1>💰 Laporan &amp; Pembagian Hasil (Pemilik)</h1>
        <form className="card" style={{ background: '#fff3cd', textAlign: 'center' }} onSubmit={coba}>
          <h3>🔒 Bagian Khusus Pemilik</h3>
          <p>Masukkan kata sandi untuk melihat laporan &amp; pengaturan pembagian</p>
          <input
            type="password"
            placeholder="Kata Sandi"
            value={sandiInput}
            onChange={(e) => setSandiInput(e.target.value)}
            style={{ maxWidth: 240, margin: '0 auto 10px' }}
          />
          <button className="btn" type="submit" disabled={loadingPengaturan}>🔓 Buka Akses</button>
          <br />
          <button className="btn btn-orange btn-sm" type="button" onClick={() => setGantiSandiOpen(true)} style={{ marginTop: 10 }}>
            🔧 Ganti Kata Sandi Laporan
          </button>
        </form>
        {gantiSandiOpen && (
          <GantiSandiModal
            sandiSekarang={pengaturan?.kataSandiLaporan || '1234'}
            onClose={() => setGantiSandiOpen(false)}
            onSimpan={async (baru) => {
              try {
                await gantiSandiLaporan(baru)
                notify('✅ Kata sandi laporan berhasil diganti!')
                setGantiSandiOpen(false)
              } catch (err) {
                notify('❌ Gagal menyimpan ke cloud: ' + err.message, 'error')
              }
            }}
          />
        )}
      </div>
    )
  }

  return <LaporanIsi pengaturan={pengaturan} riwayat={riwayat} simpanPengaturan={simpanPengaturan} onGantiSandi={() => setGantiSandiOpen(true)} gantiSandiModal={
    gantiSandiOpen && (
      <GantiSandiModal
        sandiSekarang={pengaturan?.kataSandiLaporan || '1234'}
        onClose={() => setGantiSandiOpen(false)}
        onSimpan={async (baru) => {
          try {
            await gantiSandiLaporan(baru)
            notify('✅ Kata sandi laporan berhasil diganti!')
            setGantiSandiOpen(false)
          } catch (err) {
            notify('❌ Gagal menyimpan ke cloud: ' + err.message, 'error')
          }
        }}
      />
    )
  } />
}

function LaporanIsi({ pengaturan, riwayat, simpanPengaturan, onGantiSandi, gantiSandiModal }) {
  const { notify } = useUI()
  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')
  const [jenisGrafik, setJenisGrafik] = useState('bulanan')
  const [pengSetting, setPengSetting] = useState({
    operasional: pengaturan?.operasional || 0,
    maintenance: pengaturan?.maintenance || 0,
    persenMekanik: pengaturan?.persenMekanik ?? 15,
    persenInvestor: pengaturan?.persenInvestor ?? 15,
  })

  const dataFilter = useMemo(() => {
    if (!dari && !sampai) return riwayat
    const tglDari = dari ? new Date(dari) : new Date('2000-01-01')
    const tglSampai = sampai ? new Date(sampai) : new Date()
    tglSampai.setHours(23, 59, 59)
    return riwayat.filter((r) => {
      const t = ambilTanggalDariTeks(r.tgl)
      if (!t) return true
      return t >= tglDari && t <= tglSampai
    })
  }, [riwayat, dari, sampai])

  const ringkasan = useMemo(() => {
    const omset = dataFilter.reduce((s, r) => s + (r.totalBarang || 0), 0)
    const totalJasa = dataFilter.reduce((s, r) => s + (r.biayaJasa || 0), 0)
    const labaBarang = dataFilter.reduce((s, r) => s + (r.labaBarang || 0), 0)
    const labaKotor = labaBarang + totalJasa
    const biayaOp = pengSetting.operasional
    const biayaMt = pengSetting.maintenance
    const bagiMekanik = Math.round((totalJasa * pengSetting.persenMekanik) / 100)
    const bagiInvestor = Math.round((labaKotor * pengSetting.persenInvestor) / 100)
    const labaBersih = labaKotor - biayaOp - biayaMt - bagiMekanik - bagiInvestor
    return { omset, totalJasa, labaBarang, labaKotor, biayaOp, biayaMt, bagiMekanik, bagiInvestor, labaBersih }
  }, [dataFilter, pengSetting])

  async function simpanSetting() {
    try {
      await simpanPengaturan(pengSetting)
    } catch (err) {
      notify('❌ Gagal menyimpan pengaturan: ' + err.message, 'error')
    }
  }

  function backupExcel() {
    let isi = 'Tanggal\tPelanggan\tPlat\tNomor HP\tUraian\tTotal Bayar\tPembayaran\tUang Dibayarkan\tSisa Bayar\tMekanik\n'
    dataFilter.forEach((r) => {
      const uraian = (r.items || []).map((x) => `${x.nama}×${x.jumlah}`).join(', ') || r.namaJasa || 'Jasa'
      isi += `${r.tgl}\t${r.namaPelanggan}\t${r.platKendaraan}\t${r.nomorHP || '-'}\t${uraian}\t${r.totalBayar || 0}\t${r.caraBayar || 'Tunai'}\t${r.uangdibayarkan || 0}\t${r.sisaBayar || 0}\t${r.namaMekanik || '-'}\n`
    })
    const blob = new Blob([isi], { type: 'text/tab-separated-values;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'LaporanPenjualan_' + waktuSekarang().replace(/\//g, '-').replace(/ /g, '_') + '.xls'
    a.click()
  }

  return (
    <div>
      <h1>💰 Laporan &amp; Pembagian Hasil (Pemilik)</h1>

      <div className="card">
        <h2>📈 Ringkasan Penjualan &amp; Grafik</h2>

        <div style={{ margin: '10px 0', padding: 10, background: '#f0f8ff', borderRadius: 6 }}>
          <strong>📅 Filter Periode Laporan</strong>
          <div className="row" style={{ marginTop: 8 }}>
            <label>Dari:</label>
            <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} style={{ width: 150 }} />
            <label>Sampai:</label>
            <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} style={{ width: 150 }} />
            <button className="btn btn-blue btn-sm" onClick={() => { setDari(''); setSampai('') }}>↩️ Tampilkan Semua</button>
            <button className="btn btn-blue btn-sm" onClick={backupExcel}>📥 Backup Excel</button>
          </div>
        </div>

        <div className="row" style={{ marginBottom: 12 }}>
          {[['harian', '📅 Harian'], ['bulanan', '📆 Bulanan'], ['tahunan', '🗓️ Tahunan']].map(([v, label]) => (
            <button
              key={v}
              className="btn btn-sm"
              style={{ background: jenisGrafik === v ? '#2563eb' : '#ddd', color: jenisGrafik === v ? 'white' : '#333' }}
              onClick={() => setJenisGrafik(v)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="card" style={{ marginBottom: 15 }}>
          <GrafikPenjualan data={dataFilter} jenis={jenisGrafik} />
        </div>

        <div className="summary-grid">
          <RingkasCard label="Omset Penjualan" value={ringkasan.omset} bg="#e8f5e9" fg="#1b5e20" />
          <RingkasCard label="Total Jasa" value={ringkasan.totalJasa} bg="#e3f2fd" fg="#0d47a1" />
          <RingkasCard label="Laba Barang" value={ringkasan.labaBarang} bg="#fff3e0" fg="#e65100" />
          <RingkasCard label="Laba Kotor" value={ringkasan.labaKotor} bg="#f3e5f5" fg="#4a148c" />
        </div>

        <div style={{ margin: '15px 0', padding: 15, background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}>
          <h3>⚙️ Pengaturan Pembagian Hasil</h3>
          <div className="row">
            <SettingField label="Operasional (Rp)" value={pengSetting.operasional} onChange={(v) => setPengSetting((s) => ({ ...s, operasional: v }))} onBlur={simpanSetting} />
            <SettingField label="Maintenance (Rp)" value={pengSetting.maintenance} onChange={(v) => setPengSetting((s) => ({ ...s, maintenance: v }))} onBlur={simpanSetting} />
            <SettingField label="% Bagi Hasil Mekanik" value={pengSetting.persenMekanik} onChange={(v) => setPengSetting((s) => ({ ...s, persenMekanik: v }))} onBlur={simpanSetting} />
            <SettingField label="% Bagi Hasil Investor" value={pengSetting.persenInvestor} onChange={(v) => setPengSetting((s) => ({ ...s, persenInvestor: v }))} onBlur={simpanSetting} />
          </div>
        </div>

        <div style={{ margin: '15px 0', padding: 15, background: '#fff8e1', borderRadius: 6 }}>
          <h3>📊 Rincian Pembagian</h3>
          <table>
            <tbody>
              <tr><td>💰 Laba Kotor</td><td className="angka">{formatRupiah(ringkasan.labaKotor)}</td></tr>
              <tr><td>➖ Biaya Operasional</td><td className="angka merah">{formatRupiah(ringkasan.biayaOp)}</td></tr>
              <tr><td>➖ Biaya Maintenance</td><td className="angka merah">{formatRupiah(ringkasan.biayaMt)}</td></tr>
              <tr><td>➖ Bagi Hasil Mekanik</td><td className="angka merah">{formatRupiah(ringkasan.bagiMekanik)} ({pengSetting.persenMekanik}%)</td></tr>
              <tr><td>➖ Bagi Hasil Investor</td><td className="angka merah">{formatRupiah(ringkasan.bagiInvestor)} ({pengSetting.persenInvestor}%)</td></tr>
              <tr style={{ fontWeight: 700, borderTop: '2px solid #ccc' }}>
                <td>✅ Laba Bersih Pemilik</td>
                <td className="angka hijau">{formatRupiah(Math.max(0, ringkasan.labaBersih))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <button className="btn btn-outline btn-sm" onClick={onGantiSandi}>🔧 Ganti Kata Sandi Laporan</button>
      </div>

      {gantiSandiModal}
    </div>
  )
}

function RingkasCard({ label, value, bg, fg }) {
  return (
    <div style={{ padding: 12, background: bg, borderRadius: 6 }}>
      <p style={{ fontSize: 13, color: fg }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: fg }}>{formatRupiah(value)}</p>
    </div>
  )
}

function SettingField({ label, value, onChange, onBlur }) {
  return (
    <div className="field" style={{ flex: '1 1 200px' }}>
      <label>{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)} onBlur={onBlur} />
    </div>
  )
}

function GantiSandiModal({ sandiSekarang, onClose, onSimpan }) {
  const [lama, setLama] = useState('')
  const [baru, setBaru] = useState('')
  const [ulang, setUlang] = useState('')
  const { notify } = useUI()

  function submit(e) {
    e.preventDefault()
    if (lama !== sandiSekarang) { notify('❌ Sandi lama salah!', 'error'); return }
    if (!baru || baru.length < 4) { notify('⚠️ Sandi terlalu pendek! (minimal 4 karakter)', 'error'); return }
    if (baru !== ulang) { notify('❌ Sandi baru tidak cocok!', 'error'); return }
    onSimpan(baru)
  }

  return (
    <Modal title="🔧 Ganti Kata Sandi Laporan" onClose={onClose} maxWidth={360}>
      <form onSubmit={submit}>
        <div className="field"><label>Kata Sandi Lama</label><input type="password" value={lama} onChange={(e) => setLama(e.target.value)} /></div>
        <div className="field"><label>Kata Sandi Baru</label><input type="password" value={baru} onChange={(e) => setBaru(e.target.value)} /></div>
        <div className="field"><label>Ulangi Kata Sandi Baru</label><input type="password" value={ulang} onChange={(e) => setUlang(e.target.value)} /></div>
        <button className="btn btn-block" type="submit">💾 Simpan</button>
      </form>
    </Modal>
  )
}

function ambilDataRingkasan(riwayat, jenis) {
  const data = {}
  if (jenis === 'harian') {
    const urutanJam = Array.from({ length: 24 }, (_, i) => String((i + 1) % 24).padStart(2, '0') + ':00')
    urutanJam.forEach((jam) => { data[jam] = { transaksi: 0, penjualan: 0, jasa: 0 } })
    riwayat.forEach((r) => {
      if (!r.tgl) return
      const bagian = r.tgl.split(' ')
      if (bagian.length < 2) return
      const jam = bagian[1].substring(0, 5)
      if (data[jam]) {
        data[jam].transaksi += 1
        data[jam].penjualan += r.totalBarang || 0
        data[jam].jasa += r.biayaJasa || 0
      }
    })
    return urutanJam.map((jam) => [jam, data[jam]])
  } else if (jenis === 'bulanan') {
    for (let t = 1; t <= 31; t++) data[String(t).padStart(2, '0')] = { transaksi: 0, penjualan: 0, jasa: 0, urut: t }
    riwayat.forEach((r) => {
      const t = ambilTanggalDariTeks(r.tgl)
      if (!t) return
      const hari = String(t.getDate()).padStart(2, '0')
      if (data[hari]) {
        data[hari].transaksi += 1
        data[hari].penjualan += r.totalBarang || 0
        data[hari].jasa += r.biayaJasa || 0
      }
    })
    return Object.entries(data).sort((a, b) => a[1].urut - b[1].urut)
  } else {
    NAMA_BULAN.forEach((nama, idx) => { data[nama] = { transaksi: 0, penjualan: 0, jasa: 0, urut: idx + 1 } })
    riwayat.forEach((r) => {
      const t = ambilTanggalDariTeks(r.tgl)
      if (!t) return
      const nama = NAMA_BULAN[t.getMonth()]
      data[nama].transaksi += 1
      data[nama].penjualan += r.totalBarang || 0
      data[nama].jasa += r.biayaJasa || 0
    })
    return Object.entries(data).sort((a, b) => a[1].urut - b[1].urut)
  }
}

function GrafikPenjualan({ data, jenis }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    const daftar = ambilDataRingkasan(data, jenis)
    const label = daftar.map((x) => x[0])
    const dataPenjualan = daftar.map((x) => x[1].penjualan)
    const dataJasa = daftar.map((x) => x[1].jasa)
    const jumlahTransaksi = daftar.map((x) => x[1].transaksi)
    const labelPenuh = label.map((l, i) => `${l} (${jumlahTransaksi[i]})`)

    if (chartRef.current) chartRef.current.destroy()
    if (!canvasRef.current) return

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: labelPenuh,
        datasets: [
          { label: 'Penjualan Barang', data: dataPenjualan, backgroundColor: '#22c55e', borderRadius: 4 },
          { label: 'Biaya Jasa', data: dataJasa, backgroundColor: '#3b82f6', borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: { callbacks: { label: (i) => `${i.dataset.label}: ${formatRupiah(i.raw)}` } },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => (v === 0 ? 'Rp 0' : v < 1000000 ? `Rp ${(v / 1000).toFixed(0)}rb` : `Rp ${(v / 1000000).toFixed(1)} Jt`),
            },
          },
        },
      },
    })

    return () => chartRef.current?.destroy()
  }, [data, jenis])

  return (
    <div style={{ position: 'relative', height: 260 }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
