import { useEffect, useMemo, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import { useRiwayatQuery } from '../hooks/useRiwayat'
import { usePengaturanQuery, usePengaturanMutations } from '../hooks/usePengaturan'
import { usePengeluaranQuery, usePengeluaranMutations } from '../hooks/usePengeluaran'
import { useStaffQuery } from '../hooks/useStaff'
import { useAbsensiQuery } from '../hooks/useAbsensi'
import { useLemburQuery, useLemburMutations } from '../hooks/useLembur'
import { useInvestorQuery, useInvestorMutations } from '../hooks/useInvestor'
import { useUI } from '../contexts/UIContext'
import { useOwnerMode } from '../contexts/OwnerModeContext'
import { formatRupiah, waktuSekarang } from '../lib/format'
import { cetakSlipGaji } from '../lib/cetakSlipGaji'
import { cetakSlipInvestor } from '../lib/cetakSlipInvestor'
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

function bulanIniISO() {
  const s = new Date()
  return s.getFullYear() + '-' + String(s.getMonth() + 1).padStart(2, '0')
}

const KATEGORI_PENGELUARAN = ['Operasional', 'Maintenance']

function LaporanIsi({ pengaturan, riwayat, simpanPengaturan, onGantiSandi, gantiSandiModal }) {
  const { notify, confirm } = useUI()
  const { data: pengeluaran = [] } = usePengeluaranQuery(true)
  const { tambahPengeluaran, hapusPengeluaran } = usePengeluaranMutations()
  const { data: staffList = [] } = useStaffQuery(true)
  const { data: daftarAbsensi = [] } = useAbsensiQuery(true)
  const { data: lembur = [] } = useLemburQuery(true)
  const { simpanLembur } = useLemburMutations()
  const { data: investorList = [] } = useInvestorQuery(true)
  const { tambahInvestor, ubahInvestor, hapusInvestor } = useInvestorMutations()

  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')
  const [jenisGrafik, setJenisGrafik] = useState('bulanan')
  const [pengSetting, setPengSetting] = useState({
    persenMekanik: pengaturan?.persenMekanik ?? 8,
    persenPemilik: pengaturan?.persenPemilik ?? 60,
    persenCadangan: pengaturan?.persenCadangan ?? 15,
  })

  const [formPengeluaran, setFormPengeluaran] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    kategori: 'Operasional',
    deskripsi: '',
    nominal: '',
  })
  const [savingPengeluaran, setSavingPengeluaran] = useState(false)

  const bulanIni = bulanIniISO()
  const [thnIni, blnIni] = bulanIni.split('-')
  const labelBulanIni = `${NAMA_BULAN[parseInt(blnIni, 10) - 1]} ${thnIni}`

  const pengeluaranBulanIni = useMemo(
    () => pengeluaran.filter((p) => p.bulan === bulanIni).sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    [pengeluaran, bulanIni],
  )

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

  const dataBulanIni = useMemo(
    () =>
      riwayat.filter((r) => {
        const t = ambilTanggalDariTeks(r.tgl)
        if (!t) return false
        const iso = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0')
        return iso === bulanIni
      }),
    [riwayat, bulanIni],
  )

  const daftarGajiStaf = useMemo(
    () => hitungDaftarGajiStaf(staffList, daftarAbsensi, riwayat, lembur, bulanIni, pengSetting.persenMekanik),
    [staffList, daftarAbsensi, riwayat, lembur, bulanIni, pengSetting.persenMekanik],
  )
  const daftarUangSakuMagang = useMemo(
    () => hitungDaftarUangSakuMagang(staffList, daftarAbsensi, lembur, bulanIni),
    [staffList, daftarAbsensi, lembur, bulanIni],
  )
  const totalGajiStaf = useMemo(() => daftarGajiStaf.reduce((s, x) => s + Math.max(0, x.total), 0), [daftarGajiStaf])
  const totalUangSakuMagang = useMemo(() => daftarUangSakuMagang.reduce((s, x) => s + Math.max(0, x.total), 0), [daftarUangSakuMagang])

  // Metrik untuk grafik & kartu ringkasan atas — ikut filter periode Dari~Sampai (bebas dipilih user).
  const ringkasan = useMemo(() => {
    const omset = dataFilter.reduce((s, r) => s + (r.totalBarang || 0), 0)
    const totalJasa = dataFilter.reduce((s, r) => s + (r.biayaJasa || 0), 0)
    const labaBarang = dataFilter.reduce((s, r) => s + (r.labaBarang || 0), 0)
    const labaKotor = labaBarang + totalJasa
    return { omset, totalJasa, labaBarang, labaKotor }
  }, [dataFilter])

  // Kartu "Ringkasan Bulan Ini" — selalu bulan berjalan, tidak ikut filter Dari~Sampai, reset tiap awal bulan.
  const ringkasanBulanIni = useMemo(() => {
    const omset = dataBulanIni.reduce((s, r) => s + (r.totalBarang || 0), 0)
    const totalJasa = dataBulanIni.reduce((s, r) => s + (r.biayaJasa || 0), 0)
    const labaBarang = dataBulanIni.reduce((s, r) => s + (r.labaBarang || 0), 0)
    const labaKotor = labaBarang + totalJasa
    const biayaOp = pengeluaranBulanIni.filter((p) => p.kategori === 'Operasional').reduce((s, p) => s + (p.nominal || 0), 0)
    const biayaMt = pengeluaranBulanIni.filter((p) => p.kategori === 'Maintenance').reduce((s, p) => s + (p.nominal || 0), 0)
    const labaBersih = labaKotor - biayaOp - biayaMt - totalGajiStaf - totalUangSakuMagang
    return { omset, totalJasa, labaBarang, labaKotor, biayaOp, biayaMt, totalGajiStaf, totalUangSakuMagang, labaBersih }
  }, [dataBulanIni, pengeluaranBulanIni, totalGajiStaf, totalUangSakuMagang])

  async function simpanSetting() {
    try {
      await simpanPengaturan(pengSetting)
    } catch (err) {
      notify('❌ Gagal menyimpan pengaturan: ' + err.message, 'error')
    }
  }

  async function submitPengeluaran(e) {
    e.preventDefault()
    const nominal = parseInt(formPengeluaran.nominal, 10) || 0
    if (!formPengeluaran.deskripsi.trim()) {
      notify('⚠️ Isi deskripsi pengeluaran!', 'error')
      return
    }
    if (nominal <= 0) {
      notify('⚠️ Isi nominal yang benar!', 'error')
      return
    }
    setSavingPengeluaran(true)
    try {
      await tambahPengeluaran({
        tanggal: formPengeluaran.tanggal,
        kategori: formPengeluaran.kategori,
        deskripsi: formPengeluaran.deskripsi.trim(),
        nominal,
      })
      notify('✅ Pengeluaran dicatat!')
      setFormPengeluaran((f) => ({ ...f, deskripsi: '', nominal: '' }))
    } catch (err) {
      notify('❌ Gagal menyimpan ke cloud: ' + err.message, 'error')
    } finally {
      setSavingPengeluaran(false)
    }
  }

  async function hapusPengeluaranBaris(p) {
    const ok = await confirm(`⚠️ Hapus pengeluaran "${p.deskripsi}" (${formatRupiah(p.nominal)})?`)
    if (!ok) return
    try {
      await hapusPengeluaran(p.id)
    } catch (err) {
      notify('❌ Gagal menghapus di cloud: ' + err.message, 'error')
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

        <div style={{ margin: '15px 0', padding: 15, background: '#fdf2f8', borderRadius: 6, border: '1px solid #fbcfe8' }}>
          <h3>💸 Pengeluaran Bulan Ini — {labelBulanIni}</h3>
          <form onSubmit={submitPengeluaran} className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label>Kategori</label>
              <select value={formPengeluaran.kategori} onChange={(e) => setFormPengeluaran((f) => ({ ...f, kategori: e.target.value }))}>
                {KATEGORI_PENGELUARAN.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: '2 1 200px' }}>
              <label>Deskripsi</label>
              <input
                value={formPengeluaran.deskripsi}
                onChange={(e) => setFormPengeluaran((f) => ({ ...f, deskripsi: e.target.value }))}
                placeholder="Contoh: Listrik, Sewa, Beli sabun cuci"
              />
            </div>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label>Nominal (Rp)</label>
              <input
                type="number"
                min="0"
                value={formPengeluaran.nominal}
                onChange={(e) => setFormPengeluaran((f) => ({ ...f, nominal: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label>Tanggal</label>
              <input
                type="date"
                value={formPengeluaran.tanggal}
                onChange={(e) => setFormPengeluaran((f) => ({ ...f, tanggal: e.target.value }))}
              />
            </div>
            <button className="btn btn-sm" type="submit" disabled={savingPengeluaran} style={{ marginBottom: 12 }}>
              {savingPengeluaran ? 'Menyimpan…' : '➕ Tambah'}
            </button>
          </form>

          <div className="table-wrap">
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kategori</th>
                  <th>Deskripsi</th>
                  <th className="angka">Nominal</th>
                  <th className="tengah">Hapus</th>
                </tr>
              </thead>
              <tbody>
                {pengeluaranBulanIni.length === 0 && (
                  <tr>
                    <td colSpan={5} className="tengah" style={{ padding: 10, color: '#888' }}>
                      📭 Belum ada pengeluaran bulan ini
                    </td>
                  </tr>
                )}
                {pengeluaranBulanIni.map((p) => (
                  <tr key={p.id}>
                    <td>{p.tanggal}</td>
                    <td>{p.kategori}</td>
                    <td>{p.deskripsi}</td>
                    <td className="angka">{formatRupiah(p.nominal)}</td>
                    <td className="tengah">
                      <button className="btn btn-red btn-sm" onClick={() => hapusPengeluaranBaris(p)}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: 10, fontWeight: 700 }}>
            Total Operasional: {formatRupiah(ringkasanBulanIni.biayaOp)} &nbsp;|&nbsp; Total Maintenance: {formatRupiah(ringkasanBulanIni.biayaMt)}
          </p>
        </div>

        <TabelGajiStaf
          daftar={daftarGajiStaf}
          labelBulanIni={labelBulanIni}
          persenMekanik={pengSetting.persenMekanik}
          onUbahPersenMekanik={(v) => setPengSetting((s) => ({ ...s, persenMekanik: v }))}
          onSimpanPersenMekanik={simpanSetting}
          simpanLembur={simpanLembur}
          bulanIni={bulanIni}
        />

        <TabelUangSakuMagang
          daftar={daftarUangSakuMagang}
          labelBulanIni={labelBulanIni}
          simpanLembur={simpanLembur}
          bulanIni={bulanIni}
        />

        <div style={{ margin: '15px 0', padding: 15, background: '#fff8e1', borderRadius: 6 }}>
          <h3>📈 Ringkasan Bulan Ini — {labelBulanIni}</h3>
          <p style={{ fontSize: 12, color: '#888', marginTop: -8, marginBottom: 10 }}>
            ⓘ Semua angka di kartu ini bulan berjalan saja (reset tiap awal bulan), tidak ikut filter periode di grafik atas.
          </p>
          <table>
            <tbody>
              <tr><td>💰 Omset Penjualan</td><td className="angka">{formatRupiah(ringkasanBulanIni.omset)}</td></tr>
              <tr><td>🔧 Total Jasa</td><td className="angka">{formatRupiah(ringkasanBulanIni.totalJasa)}</td></tr>
              <tr><td>📦 Laba Barang</td><td className="angka">{formatRupiah(ringkasanBulanIni.labaBarang)}</td></tr>
              <tr><td>📊 Laba Kotor</td><td className="angka">{formatRupiah(ringkasanBulanIni.labaKotor)}</td></tr>
              <tr><td>➖ Total Gaji Staf</td><td className="angka merah">{formatRupiah(ringkasanBulanIni.totalGajiStaf)}</td></tr>
              <tr><td>➖ Total Uang Saku Magang</td><td className="angka merah">{formatRupiah(ringkasanBulanIni.totalUangSakuMagang)}</td></tr>
              <tr><td>➖ Biaya Operasional</td><td className="angka merah">{formatRupiah(ringkasanBulanIni.biayaOp)}</td></tr>
              <tr><td>➖ Biaya Maintenance</td><td className="angka merah">{formatRupiah(ringkasanBulanIni.biayaMt)}</td></tr>
              <tr style={{ fontWeight: 700, borderTop: '2px solid #ccc' }}>
                <td>✅ Laba Bersih</td>
                <td className="angka hijau">{formatRupiah(Math.max(0, ringkasanBulanIni.labaBersih))}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
            ⓘ "Bagi Hasil Mekanik" sudah termasuk di dalam Total Gaji Staf di atas, jadi tidak dipotong dua kali di sini.
          </p>
        </div>

        <PembagianLabaBersih
          labaBersih={Math.max(0, ringkasanBulanIni.labaBersih)}
          labelBulanIni={labelBulanIni}
          persenPemilik={pengSetting.persenPemilik}
          persenCadangan={pengSetting.persenCadangan}
          onUbahPersenPemilik={(v) => setPengSetting((s) => ({ ...s, persenPemilik: v }))}
          onUbahPersenCadangan={(v) => setPengSetting((s) => ({ ...s, persenCadangan: v }))}
          onSimpanSetting={simpanSetting}
          investorList={investorList}
          tambahInvestor={tambahInvestor}
          ubahInvestor={ubahInvestor}
          hapusInvestor={hapusInvestor}
        />

        <button className="btn btn-outline btn-sm" onClick={onGantiSandi}>🔧 Ganti Kata Sandi Laporan</button>
      </div>

      {gantiSandiModal}
    </div>
  )
}

function hitungRekapAbsensi(daftarAbsensi, bulan, nama) {
  const data = daftarAbsensi.filter((a) => a.bulan === bulan && a.nama === nama)
  return {
    hadir: data.filter((a) => a.status === 'Hadir').length,
    setengah: data.filter((a) => a.status === 'Setengah Hari').length,
    izin: data.filter((a) => a.status === 'Izin').length,
    tanpaKabar: data.filter((a) => a.status === 'Tanpa Keterangan').length,
  }
}

// Hanya transaksi yang mekaniknya persis nama ini yang dihitung — transaksi "Semua Mekanik" (dibagi rata/tim)
// belum diatribusikan ke siapa pun secara otomatis.
function hitungJasaBulanIni(riwayat, bulan, namaMekanik) {
  const [thn, bln] = bulan.split('-').map(Number)
  const data = riwayat.filter((r) => {
    if (r.namaMekanik !== namaMekanik) return false
    const t = ambilTanggalDariTeks(r.tgl)
    return t && t.getFullYear() === thn && t.getMonth() + 1 === bln
  })
  return { jumlah: data.length, nilai: data.reduce((s, r) => s + (r.biayaJasa || 0), 0) }
}

function hitungDaftarGajiStaf(staffList, daftarAbsensi, riwayat, lembur, bulanIni, persenMekanik) {
  return staffList
    .filter((s) => s.aktif && s.jabatan !== 'Magang')
    .map((s) => {
      const rekap = hitungRekapAbsensi(daftarAbsensi, bulanIni, s.nama)
      // Kasir tidak melayani jasa servis, jadi jasa/bagi hasil tidak berlaku buat jabatan ini.
      const jasa = s.jabatan === 'Kasir' ? { jumlah: 0, nilai: 0 } : hitungJasaBulanIni(riwayat, bulanIni, s.nama)
      const jamLembur = lembur.find((l) => l.staffKode === s.kode && l.bulan === bulanIni)?.jam || 0
      const bagiHasil = s.jabatan === 'Kasir' ? 0 : Math.round((jasa.nilai * persenMekanik) / 100)
      const lemburNominal = Math.round((s.uangLemburPerJam || 10000) * jamLembur)

      let potongan
      let total
      if (s.jabatan === 'Freelance') {
        // Freelance dibayar per hari hadir (harian penuh + setengah hari), bukan gaji bulanan tetap.
        const totalHarian = Math.round((s.gajiPokok || 0) * rekap.hadir + (s.gajiPokok || 0) * 0.5 * rekap.setengah)
        potongan = 0
        total = totalHarian + bagiHasil + lemburNominal
      } else {
        const gajiPerHari = (s.gajiPokok || 0) / 26
        potongan = Math.round(gajiPerHari * rekap.tanpaKabar)
        total = (s.gajiPokok || 0) - potongan + bagiHasil + lemburNominal
      }
      return { ...s, rekap, jasa, jamLembur, bagiHasil, lemburNominal, potongan, total }
    })
}

function hitungDaftarUangSakuMagang(staffList, daftarAbsensi, lembur, bulanIni) {
  return staffList
    .filter((s) => s.aktif && s.jabatan === 'Magang')
    .map((s) => {
      const rekap = hitungRekapAbsensi(daftarAbsensi, bulanIni, s.nama)
      const jamLembur = lembur.find((l) => l.staffKode === s.kode && l.bulan === bulanIni)?.jam || 0
      const umPerHari = ((s.uangMakan || 0) + (s.uangBensin || 0)) / 26
      const lemburNominal = Math.round((s.uangLemburPerJam || 10000) * jamLembur)
      const potongan = Math.round(umPerHari * rekap.tanpaKabar)
      const total = (s.uangMakan || 0) + (s.uangBensin || 0) - potongan + lemburNominal
      return { ...s, rekap, jamLembur, lemburNominal, potongan, total }
    })
}

function InputLembur({ nilaiAwal, onSimpan }) {
  const [nilai, setNilai] = useState(nilaiAwal)

  useEffect(() => {
    setNilai(nilaiAwal)
  }, [nilaiAwal])

  return (
    <input
      type="number"
      min="0"
      value={nilai}
      onChange={(e) => setNilai(e.target.value)}
      onBlur={() => onSimpan(parseFloat(nilai) || 0)}
      style={{ width: 60, padding: 4, minHeight: 'auto', textAlign: 'right' }}
    />
  )
}

function TabelGajiStaf({ daftar, bulanIni, labelBulanIni, persenMekanik, onUbahPersenMekanik, onSimpanPersenMekanik, simpanLembur }) {
  const { notify } = useUI()

  async function ubahLembur(kode, nilai) {
    try {
      await simpanLembur(kode, bulanIni, nilai)
    } catch (err) {
      notify('❌ Gagal menyimpan jam lembur: ' + err.message, 'error')
    }
  }

  function cetak(s) {
    const rincian =
      s.jabatan === 'Freelance'
        ? [
            { label: `Gaji Harian × ${s.rekap.hadir} hari penuh`, nilai: Math.round((s.gajiPokok || 0) * s.rekap.hadir) },
            ...(s.rekap.setengah > 0
              ? [{ label: `Gaji Harian × ${s.rekap.setengah} setengah hari`, nilai: Math.round((s.gajiPokok || 0) * 0.5 * s.rekap.setengah) }]
              : []),
            { label: `Bagi Hasil Jasa (${persenMekanik}%)`, nilai: s.bagiHasil },
            { label: `Uang Lembur (${s.jamLembur} jam × ${formatRupiah(s.uangLemburPerJam || 10000)})`, nilai: s.lemburNominal },
          ]
        : [
            { label: 'Gaji Pokok', nilai: s.gajiPokok || 0 },
            { label: 'Potongan Tanpa Kabar', nilai: -s.potongan },
            { label: `Bagi Hasil Jasa (${persenMekanik}%)`, nilai: s.bagiHasil },
            { label: `Uang Lembur (${s.jamLembur} jam × ${formatRupiah(s.uangLemburPerJam || 10000)})`, nilai: s.lemburNominal },
          ]
    cetakSlipGaji({
      judul: 'SLIP GAJI & BAGI HASIL',
      nama: s.nama,
      jabatan: s.jabatan,
      labelPeriode: labelBulanIni,
      rekap: s.rekap,
      rincian,
      total: s.total,
    })
  }

  return (
    <div style={{ margin: '15px 0', padding: 15, background: '#eef2ff', borderRadius: 6, border: '1px solid #c7d2fe' }}>
      <h3>🔧 Gaji Staf (Mekanik/Kasir/Lainnya) — {labelBulanIni}</h3>
      <div className="row" style={{ alignItems: 'center', marginBottom: 8 }}>
        <label>Persentase Bagi Hasil Jasa:</label>
        <input
          type="number"
          min="0"
          max="100"
          value={persenMekanik}
          onChange={(e) => onUbahPersenMekanik(parseInt(e.target.value, 10) || 0)}
          onBlur={onSimpanPersenMekanik}
          style={{ width: 70 }}
        />
        <span style={{ fontSize: 12, color: '#666' }}>% — bisa diubah kapan saja</span>
      </div>
      <div className="table-wrap">
        <table style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th className="tengah">Aksi</th>
              <th>Nama</th>
              <th>Jabatan</th>
              <th className="angka">Gaji Pokok</th>
              <th className="tengah">Jasa Dilayani</th>
              <th className="angka">Bagi Hasil</th>
              <th className="tengah">Jam Lembur</th>
              <th className="angka">Nominal Lembur</th>
              <th className="angka">Potongan</th>
              <th className="angka">Total Diterima</th>
            </tr>
          </thead>
          <tbody>
            {daftar.length === 0 && (
              <tr>
                <td colSpan={10} className="tengah" style={{ padding: 10, color: '#888' }}>
                  📭 Belum ada staf aktif (Mekanik/Kasir/Freelance/Lainnya)
                </td>
              </tr>
            )}
            {daftar.map((s) => (
              <tr key={s.kode}>
                <td className="tengah">
                  <button className="btn btn-blue btn-sm" onClick={() => cetak(s)}>
                    🖨️
                  </button>
                </td>
                <td>{s.nama}</td>
                <td>{s.jabatan}</td>
                <td className="angka">{formatRupiah(s.gajiPokok || 0)}</td>
                <td className="tengah">
                  {s.jabatan === 'Kasir' ? '−' : `${s.jasa.jumlah}× (${formatRupiah(s.jasa.nilai)})`}
                </td>
                <td className="angka">{formatRupiah(s.bagiHasil)}</td>
                <td className="tengah">
                  <InputLembur nilaiAwal={s.jamLembur} onSimpan={(v) => ubahLembur(s.kode, v)} />
                </td>
                <td className="angka">{formatRupiah(s.lemburNominal)}</td>
                <td className="angka merah">{formatRupiah(s.potongan)}</td>
                <td className="angka" style={{ fontWeight: 700 }}>
                  {formatRupiah(Math.max(0, s.total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
        ⓘ "Jasa Dilayani" dihitung otomatis dari Transaksi bulan ini yang mekaniknya persis nama staf ini (tidak berlaku untuk Kasir). Transaksi dengan mekanik "Semua Mekanik" belum ikut terhitung ke siapa pun.
        <br />
        ⓘ Freelance: kolom "Gaji Pokok" adalah gaji harian, Total dihitung dari jumlah hari hadir × gaji harian (bukan gaji bulanan tetap).
      </p>
    </div>
  )
}

function TabelUangSakuMagang({ daftar, bulanIni, labelBulanIni, simpanLembur }) {
  const { notify } = useUI()

  async function ubahLembur(kode, nilai) {
    try {
      await simpanLembur(kode, bulanIni, nilai)
    } catch (err) {
      notify('❌ Gagal menyimpan jam lembur: ' + err.message, 'error')
    }
  }

  function cetak(s) {
    cetakSlipGaji({
      judul: 'SLIP UANG SAKU MAGANG',
      nama: s.nama,
      jabatan: 'Magang',
      labelPeriode: labelBulanIni,
      rekap: s.rekap,
      rincian: [
        { label: 'Uang Makan', nilai: s.uangMakan || 0 },
        { label: 'Uang Bensin', nilai: s.uangBensin || 0 },
        { label: 'Potongan Tanpa Kabar', nilai: -s.potongan },
        { label: `Uang Lembur (${s.jamLembur} jam × ${formatRupiah(s.uangLemburPerJam || 10000)})`, nilai: s.lemburNominal },
      ],
      total: s.total,
    })
  }

  return (
    <div style={{ margin: '15px 0', padding: 15, background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
      <h3>🧑‍🎓 Uang Saku Magang — {labelBulanIni}</h3>
      <div className="table-wrap">
        <table style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th className="tengah">Aksi</th>
              <th>Nama</th>
              <th>Mulai</th>
              <th>Selesai</th>
              <th className="angka">Uang Makan</th>
              <th className="angka">Uang Bensin</th>
              <th className="tengah">Jam Lembur</th>
              <th className="angka">Nominal Lembur</th>
              <th className="angka">Potongan</th>
              <th className="angka">Total</th>
            </tr>
          </thead>
          <tbody>
            {daftar.length === 0 && (
              <tr>
                <td colSpan={10} className="tengah" style={{ padding: 10, color: '#888' }}>
                  📭 Belum ada staf magang aktif
                </td>
              </tr>
            )}
            {daftar.map((s) => (
              <tr key={s.kode}>
                <td className="tengah">
                  <button className="btn btn-blue btn-sm" onClick={() => cetak(s)}>
                    🖨️
                  </button>
                </td>
                <td>{s.nama}</td>
                <td>{s.tanggalMulai || '—'}</td>
                <td>{s.tanggalKeluar || '—'}</td>
                <td className="angka">{formatRupiah(s.uangMakan || 0)}</td>
                <td className="angka">{formatRupiah(s.uangBensin || 0)}</td>
                <td className="tengah">
                  <InputLembur nilaiAwal={s.jamLembur} onSimpan={(v) => ubahLembur(s.kode, v)} />
                </td>
                <td className="angka">{formatRupiah(s.lemburNominal)}</td>
                <td className="angka merah">{formatRupiah(s.potongan)}</td>
                <td className="angka" style={{ fontWeight: 700 }}>
                  {formatRupiah(Math.max(0, s.total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InputInvestorNama({ nilaiAwal, onSimpan }) {
  const [nilai, setNilai] = useState(nilaiAwal)
  return (
    <input
      value={nilai}
      onChange={(e) => setNilai(e.target.value)}
      onBlur={() => { if (nilai.trim() && nilai !== nilaiAwal) onSimpan(nilai) }}
      placeholder="Nama Investor"
      style={{ minWidth: 120 }}
    />
  )
}

function InputInvestorPersen({ nilaiAwal, onSimpan }) {
  const [nilai, setNilai] = useState(nilaiAwal)
  return (
    <input
      type="number"
      min="0"
      max="100"
      value={nilai}
      onChange={(e) => setNilai(e.target.value)}
      onBlur={() => {
        const v = parseFloat(nilai) || 0
        if (v !== nilaiAwal) onSimpan(v)
      }}
      style={{ width: 70 }}
    />
  )
}

function PembagianLabaBersih({
  labaBersih,
  labelBulanIni,
  persenPemilik,
  persenCadangan,
  onUbahPersenPemilik,
  onUbahPersenCadangan,
  onSimpanSetting,
  investorList,
  tambahInvestor,
  ubahInvestor,
  hapusInvestor,
}) {
  const { notify, confirm } = useUI()
  const [namaBaru, setNamaBaru] = useState('')
  const [persenBaru, setPersenBaru] = useState('')
  const [saving, setSaving] = useState(false)

  const totalPersenInvestor = investorList.reduce((s, x) => s + (x.persen || 0), 0)
  const totalNominalInvestor = investorList.reduce((s, x) => s + Math.round((labaBersih * (x.persen || 0)) / 100), 0)
  const nominalPemilik = Math.round((labaBersih * persenPemilik) / 100)
  const nominalCadangan = Math.round((labaBersih * persenCadangan) / 100)
  const totalPersenSemua = persenPemilik + totalPersenInvestor + persenCadangan
  const seimbang = totalPersenSemua === 100

  async function submitTambah(e) {
    e.preventDefault()
    if (!namaBaru.trim()) {
      notify('⚠️ Isi nama investor!', 'error')
      return
    }
    setSaving(true)
    try {
      await tambahInvestor({ nama: namaBaru.trim(), persen: parseFloat(persenBaru) || 0 })
      setNamaBaru('')
      setPersenBaru('')
    } catch (err) {
      notify('❌ Gagal menyimpan ke cloud: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function ubahNama(inv, nama) {
    try {
      await ubahInvestor(inv.id, { nama, persen: inv.persen })
    } catch (err) {
      notify('❌ Gagal menyimpan ke cloud: ' + err.message, 'error')
    }
  }

  async function ubahPersen(inv, persen) {
    try {
      await ubahInvestor(inv.id, { nama: inv.nama, persen })
    } catch (err) {
      notify('❌ Gagal menyimpan ke cloud: ' + err.message, 'error')
    }
  }

  async function hapus(inv) {
    const ok = await confirm(`⚠️ Hapus investor "${inv.nama}"?`)
    if (!ok) return
    try {
      await hapusInvestor(inv.id)
    } catch (err) {
      notify('❌ Gagal menghapus di cloud: ' + err.message, 'error')
    }
  }

  function cetak(inv) {
    cetakSlipInvestor({
      nama: inv.nama,
      persen: inv.persen || 0,
      labaBersih,
      nominal: Math.round((labaBersih * (inv.persen || 0)) / 100),
      labelPeriode: labelBulanIni,
    })
  }

  return (
    <div style={{ margin: '15px 0', padding: 15, background: '#fefce8', borderRadius: 6, border: '1px solid #fde68a' }}>
      <h3>💰 Pembagian Laba Bersih — {labelBulanIni}</h3>
      <p style={{ fontSize: 12, color: '#888', marginTop: -6, marginBottom: 10 }}>
        ⓘ Dasar pembagian: Laba Bersih {formatRupiah(labaBersih)} (lihat "✅ Laba Bersih" di Ringkasan Bulan Ini).
      </p>

      <h4 style={{ margin: '8px 0' }}>👤 Bagian Pemilik</h4>
      <div className="row" style={{ alignItems: 'center' }}>
        <label>Persentase Pemilik:</label>
        <input
          type="number"
          min="0"
          max="100"
          value={persenPemilik}
          onChange={(e) => onUbahPersenPemilik(parseInt(e.target.value, 10) || 0)}
          onBlur={onSimpanSetting}
          style={{ width: 70 }}
        />
        <span>% — Nominal: <strong>{formatRupiah(nominalPemilik)}</strong></span>
      </div>

      <h4 style={{ margin: '15px 0 8px' }}>🤝 Daftar Investor</h4>
      <div className="table-wrap">
        <table style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Nama Investor</th>
              <th className="tengah">% Bagian</th>
              <th className="angka">Nominal</th>
              <th className="tengah">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {investorList.length === 0 && (
              <tr>
                <td colSpan={4} className="tengah" style={{ padding: 10, color: '#888' }}>
                  📭 Belum ada investor
                </td>
              </tr>
            )}
            {investorList.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <InputInvestorNama nilaiAwal={inv.nama} onSimpan={(v) => ubahNama(inv, v)} />
                </td>
                <td className="tengah">
                  <InputInvestorPersen nilaiAwal={inv.persen || 0} onSimpan={(v) => ubahPersen(inv, v)} />
                </td>
                <td className="angka">{formatRupiah(Math.round((labaBersih * (inv.persen || 0)) / 100))}</td>
                <td className="tengah">
                  <div className="row" style={{ flexWrap: 'nowrap', gap: 4, justifyContent: 'center' }}>
                    <button className="btn btn-blue btn-sm" onClick={() => cetak(inv)} title="Cetak Slip A4">🖨️</button>
                    <button className="btn btn-red btn-sm" onClick={() => hapus(inv)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot style={{ fontWeight: 700, background: '#f5f5f5' }}>
            <tr>
              <td>Total Investor</td>
              <td className="tengah">{totalPersenInvestor}%</td>
              <td className="angka">{formatRupiah(totalNominalInvestor)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <form onSubmit={submitTambah} className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '2 1 160px' }}>
          <label>Nama Investor Baru</label>
          <input value={namaBaru} onChange={(e) => setNamaBaru(e.target.value)} placeholder="Nama Investor" />
        </div>
        <div className="field" style={{ flex: '1 1 100px' }}>
          <label>% Bagian</label>
          <input type="number" min="0" max="100" value={persenBaru} onChange={(e) => setPersenBaru(e.target.value)} placeholder="0" />
        </div>
        <button className="btn btn-sm" type="submit" disabled={saving} style={{ marginBottom: 12 }}>
          {saving ? 'Menyimpan…' : '➕ Tambah Investor'}
        </button>
      </form>

      <h4 style={{ margin: '15px 0 8px' }}>📦 Dana Cadangan / Lainnya</h4>
      <div className="row" style={{ alignItems: 'center' }}>
        <label>Persentase Dana Cadangan:</label>
        <input
          type="number"
          min="0"
          max="100"
          value={persenCadangan}
          onChange={(e) => onUbahPersenCadangan(parseInt(e.target.value, 10) || 0)}
          onBlur={onSimpanSetting}
          style={{ width: 70 }}
        />
        <span>% — Nominal: <strong>{formatRupiah(nominalCadangan)}</strong></span>
      </div>

      <div
        style={{
          marginTop: 15,
          padding: 10,
          background: seimbang ? '#e8f5e9' : '#fff3cd',
          borderRadius: 6,
          fontWeight: 700,
        }}
      >
        {seimbang ? '✅' : '⚠️'} Keseimbangan: Total {totalPersenSemua}% | Sisa {100 - totalPersenSemua}%
      </div>
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
