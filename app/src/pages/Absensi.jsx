import { useMemo, useState } from 'react'
import { useStaffQuery } from '../hooks/useStaff'
import { useAbsensiQuery, useAbsensiMutations } from '../hooks/useAbsensi'
import { useUI } from '../contexts/UIContext'
import { hitungJamKerja } from '../lib/format'
import Fab from '../components/common/Fab'

const JABATAN_OPTIONS = [
  { value: '', label: '🗂️ Semua' },
  { value: 'Mekanik', label: '🔧 Mekanik' },
  { value: 'Kasir', label: '💰 Kasir' },
  { value: 'Magang', label: '🧑‍🎓 Magang' },
  { value: 'Lainnya', label: '📋 Lainnya' },
]

const STATUS_OPTIONS = [
  { value: 'Hadir', label: '✅ Hadir' },
  { value: 'Setengah Hari', label: '⛔ ½ Hari' },
  { value: 'Izin', label: '📝 Izin' },
  { value: 'Tanpa Keterangan', label: '❌ TanpaKet' },
]

const STATUS_TAMPIL = {
  Hadir: { teks: '✅ Hadir', warna: 'green' },
  'Setengah Hari': { teks: '⛔ ½ Hari', warna: 'orange' },
  Izin: { teks: '📝 Izin', warna: 'purple' },
  'Tanpa Keterangan': { teks: '❌ TanpaKet', warna: 'red' },
}

function periodeIni() {
  const s = new Date()
  return s.getFullYear() + '-' + String(s.getMonth() + 1).padStart(2, '0')
}

function jamSekarangHHMM() {
  return new Date().toTimeString().substring(0, 5)
}

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export default function AbsensiPage() {
  const { data: staffList = [] } = useStaffQuery(true)
  const { data: daftarAbsensi = [], isLoading } = useAbsensiQuery(true)
  const { simpanAbsensi, hapusAbsensi } = useAbsensiMutations()
  const { notify, confirm } = useUI()

  const [mode, setMode] = useState('list') // 'list' | 'form'
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split('T')[0])
  const [jamDatang, setJamDatang] = useState(jamSekarangHHMM)
  const [jamPulang, setJamPulang] = useState('')
  const [jabatanFilter, setJabatanFilter] = useState('')
  const [namaTerpilih, setNamaTerpilih] = useState('')
  const [arsipJabatan, setArsipJabatan] = useState(null)
  const [status, setStatus] = useState('Hadir')
  const [keterangan, setKeterangan] = useState('')
  const [barisDiedit, setBarisDiedit] = useState(null) // { tanggal, nama } kunci lama
  const [saving, setSaving] = useState(false)

  const editMode = !!barisDiedit

  const stafTerpilih = staffList.find((s) => s.nama === namaTerpilih)

  const namaOptions = useMemo(() => {
    const aktif = staffList
      .filter((s) => s.aktif && (!jabatanFilter || s.jabatan === jabatanFilter))
      .sort((a, b) => a.nama.localeCompare(b.nama))
    if (namaTerpilih && !staffList.some((s) => s.nama === namaTerpilih)) {
      aktif.push({ kode: '_arsip', nama: namaTerpilih, jabatan: arsipJabatan, arsip: true })
    }
    return aktif
  }, [staffList, jabatanFilter, namaTerpilih, arsipJabatan])

  function pilihNama(nama) {
    setNamaTerpilih(nama)
    const s = staffList.find((x) => x.nama === nama)
    if (s) setJabatanFilter(s.jabatan)
    if (!editMode) setJamPulang('')
  }

  function bukaTambah() {
    setBarisDiedit(null)
    setArsipJabatan(null)
    setTanggal(new Date().toISOString().split('T')[0])
    setJamDatang(jamSekarangHHMM())
    setJamPulang('')
    setJabatanFilter('')
    setNamaTerpilih('')
    setStatus('Hadir')
    setKeterangan('')
    setMode('form')
  }

  function kembaliKeDaftar() {
    setBarisDiedit(null)
    setArsipJabatan(null)
    setStatus('Hadir')
    setJabatanFilter('')
    setNamaTerpilih('')
    setJamPulang('')
    setKeterangan('')
    setMode('list')
  }

  function mulaiEdit(r) {
    setTanggal(r.tanggal)
    setJamDatang(r.jamDatang || '')
    setJamPulang(r.jamPulang || '')
    setJabatanFilter(r.jabatan)
    setNamaTerpilih(r.nama)
    setArsipJabatan(staffList.some((s) => s.nama === r.nama) ? null : r.jabatan)
    setStatus(r.status)
    setKeterangan(r.keterangan || '')
    setBarisDiedit({ tanggal: r.tanggal, nama: r.nama })
    setMode('form')
  }

  async function hapus(r) {
    const ok = await confirm(`⚠️ Hapus permanen?\n📅 ${r.tanggal}\n👤 ${r.nama}`)
    if (!ok) return
    try {
      await hapusAbsensi(r.tanggal, r.nama)
      if (barisDiedit && barisDiedit.tanggal === r.tanggal && barisDiedit.nama === r.nama) kembaliKeDaftar()
    } catch (err) {
      notify('❌ Gagal menghapus di cloud: ' + err.message, 'error')
    }
  }

  function isiJamPulangSekarang() {
    const jam = jamSekarangHHMM()
    setJamPulang(jam)
    notify(`✅ Jam Pulang terisi: ${jam}\n👉 Cek Nama lalu klik SIMPAN ABSENSI`)
  }

  async function submit(e) {
    e.preventDefault()
    if (!tanggal) {
      notify('⚠️ Pilih Tanggal dulu!', 'error')
      return
    }
    if (!namaTerpilih) {
      notify('⚠️ Isi Nama Staff!', 'error')
      return
    }

    const jabatanFinal = stafTerpilih?.jabatan || arsipJabatan || jabatanFilter

    if (!barisDiedit) {
      const ada = daftarAbsensi.some((x) => x.tanggal === tanggal && x.nama === namaTerpilih)
      if (ada) {
        const ok = await confirm(`⚠️ Data untuk ${namaTerpilih} tanggal ${tanggal} sudah ada!\nIngin PERBARUI dengan yang baru?`)
        if (!ok) return
      }
    }

    const data = {
      tanggal,
      jamDatang,
      jamPulang,
      jamKerja: hitungJamKerja(jamDatang, jamPulang),
      jabatan: jabatanFinal,
      nama: namaTerpilih,
      status,
      keterangan,
      bulan: tanggal.substring(0, 7),
    }

    setSaving(true)
    try {
      await simpanAbsensi(data, barisDiedit)
      notify(
        `${barisDiedit ? '✅ Data Diperbarui!' : '✅ Absensi Disimpan!'}\n📅 ${tanggal}\n👤 ${namaTerpilih} (${jabatanFinal})\n⏰ ${jamDatang} — ${jamPulang || '—'}`,
      )
      kembaliKeDaftar()
    } catch (err) {
      notify('❌ Gagal menyimpan ke cloud: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const bulanFilter = periodeIni()
  const dataBulanIni = useMemo(
    () => daftarAbsensi.filter((x) => x.bulan === bulanFilter).sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    [daftarAbsensi, bulanFilter],
  )

  const rekapStaff = useMemo(() => hitungRekapPerStaff(dataBulanIni), [dataBulanIni])
  const [thn, bln] = bulanFilter.split('-')
  const labelBulan = `${NAMA_BULAN[parseInt(bln, 10) - 1]} ${thn}`

  if (mode === 'form') {
    return (
      <div>
        <div className="form-header">
          <button className="btn-back" onClick={kembaliKeDaftar} aria-label="Kembali">←</button>
          <h1>{editMode ? '✏️ Ubah Absensi' : '➕ Input Absensi'}</h1>
        </div>

        <form className="card" style={{ background: '#fff9e6', border: '2px solid #ffc107' }} onSubmit={submit}>
          <div className="field">
            <label>Tanggal</label>
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>

          <div className="grid-2">
            <div className="field">
              <label>⏰ Jam Datang</label>
              <input type="time" value={jamDatang} onChange={(e) => setJamDatang(e.target.value)} />
            </div>
            <div className="field">
              <label>🏠 Jam Pulang</label>
              <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                <input type="time" value={jamPulang} onChange={(e) => setJamPulang(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                <button
                  type="button"
                  className="btn btn-blue btn-sm"
                  onClick={isiJamPulangSekarang}
                  title="Isi jam sekarang"
                  style={{ flexShrink: 0 }}
                >
                  🕐
                </button>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label>💼 Jabatan</label>
              <select value={jabatanFilter} disabled={editMode} onChange={(e) => setJabatanFilter(e.target.value)}>
                {JABATAN_OPTIONS.map((j) => (
                  <option key={j.value} value={j.value}>
                    {j.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label>👤 Nama Staff</label>
              <select value={namaTerpilih} disabled={editMode} onChange={(e) => pilihNama(e.target.value)}>
                <option value="">— Pilih Staff —</option>
                {namaOptions.map((s) => (
                  <option key={s.kode} value={s.nama}>
                    {s.nama} {s.arsip ? '(arsip)' : `(${s.jabatan})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>📌 Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>📝 Keterangan</label>
            <input
              placeholder="Alasan izin atau keterangan lain..."
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
            />
          </div>

          <button className="btn btn-block" type="submit" disabled={saving}>
            {saving ? 'Menyimpan…' : '✅ SIMPAN ABSENSI'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      <h1>📅 Manajemen Absensi Karyawan</h1>

      <div className="card">
        <h2>📋 Rekap Absensi {labelBulan}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="tengah">Aksi</th>
                <th>Tanggal</th>
                <th>Datang</th>
                <th>Pulang</th>
                <th>Jam Kerja</th>
                <th>Jabatan</th>
                <th>Nama Staff</th>
                <th>Status</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className="tengah" style={{ padding: 12, color: '#888' }}>
                    Memuat...
                  </td>
                </tr>
              )}
              {!isLoading && dataBulanIni.length === 0 && (
                <tr>
                  <td colSpan={9} className="tengah" style={{ padding: 15, color: '#888' }}>
                    📭 Belum ada data absensi bulan ini
                  </td>
                </tr>
              )}
              {dataBulanIni.map((r) => {
                const st = STATUS_TAMPIL[r.status] || { teks: r.status, warna: '#333' }
                return (
                  <tr key={r.tanggal + '|' + r.nama}>
                    <td className="tengah">
                      <div className="row" style={{ flexWrap: 'nowrap', gap: 4, justifyContent: 'center' }}>
                        <button className="btn btn-blue btn-sm" onClick={() => mulaiEdit(r)}>
                          ✏️
                        </button>
                        <button className="btn btn-red btn-sm" onClick={() => hapus(r)}>
                          🗑️
                        </button>
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.tanggal}</td>
                    <td className="tengah" style={{ fontWeight: 700 }}>{r.jamDatang || '—'}</td>
                    <td className="tengah" style={{ fontWeight: 700 }}>{r.jamPulang || '—'}</td>
                    <td className="tengah" style={{ color: '#2563eb', fontWeight: 700 }}>{r.jamKerja || '—'}</td>
                    <td className="tengah">{r.jabatan}</td>
                    <td>{r.nama}</td>
                    <td style={{ color: st.warna, fontWeight: 700 }}>{st.teks}</td>
                    <td>{r.keterangan || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ background: '#e8f5e9', border: '1px solid #a5d6a7' }}>
        <h4 style={{ color: '#2e7d32' }}>📊 Ringkasan Kehadiran Per Staff — {labelBulan}</h4>
        <div className="table-wrap">
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#c8e6c9' }}>
                <th className="tengah">No</th>
                <th>Nama Staff</th>
                <th className="tengah">Jabatan</th>
                <th className="tengah">✅Hadir</th>
                <th className="tengah">⛔½Hari</th>
                <th className="tengah">📝Izin</th>
                <th className="tengah">❌TanpaKet</th>
                <th className="tengah">Total Hari</th>
                <th className="tengah">Total Jam</th>
              </tr>
            </thead>
            <tbody>
              {rekapStaff.length === 0 && (
                <tr>
                  <td colSpan={9} className="tengah" style={{ padding: 10, color: '#666' }}>
                    📭 Belum ada data absensi bulan ini
                  </td>
                </tr>
              )}
              {rekapStaff.map((r, i) => (
                <tr key={r.nama + '|' + r.jabatan}>
                  <td className="tengah">{i + 1}</td>
                  <td>{r.nama}</td>
                  <td className="tengah">{r.jabatan}</td>
                  <td className="tengah" style={{ color: 'green', fontWeight: 700 }}>{r.hadir}</td>
                  <td className="tengah" style={{ color: 'orange', fontWeight: 700 }}>{r.setengah}</td>
                  <td className="tengah" style={{ color: 'purple', fontWeight: 700 }}>{r.izin}</td>
                  <td className="tengah" style={{ color: 'red', fontWeight: 700 }}>{r.tanpaKet}</td>
                  <td className="tengah" style={{ fontWeight: 700 }}>{r.totalHari}</td>
                  <td className="tengah" style={{ color: '#2563eb', fontWeight: 700 }}>{r.teksJam}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Fab onClick={bukaTambah} title="Input Absensi" />
    </div>
  )
}

function hitungRekapPerStaff(dataBulanIni) {
  const rekap = {}
  dataBulanIni.forEach((r) => {
    const kunci = r.nama + '|' + r.jabatan
    if (!rekap[kunci]) {
      rekap[kunci] = { nama: r.nama, jabatan: r.jabatan, hadir: 0, setengah: 0, izin: 0, tanpaKet: 0, totalMenit: 0 }
    }
    if (r.status === 'Hadir') rekap[kunci].hadir++
    else if (r.status === 'Setengah Hari') rekap[kunci].setengah++
    else if (r.status === 'Izin') rekap[kunci].izin++
    else if (r.status === 'Tanpa Keterangan') rekap[kunci].tanpaKet++

    if (r.jamDatang && r.jamPulang) {
      const [j1, m1] = r.jamDatang.split(':').map(Number)
      const [j2, m2] = r.jamPulang.split(':').map(Number)
      let menit = j2 * 60 + m2 - (j1 * 60 + m1)
      if (menit < 0) menit += 24 * 60
      rekap[kunci].totalMenit += menit
    }
  })

  return Object.values(rekap)
    .sort((a, b) => a.nama.localeCompare(b.nama))
    .map((r) => {
      const totalHari = r.hadir + r.setengah + r.izin + r.tanpaKet
      const jam = Math.floor(r.totalMenit / 60)
      const menit = r.totalMenit % 60
      return { ...r, totalHari, teksJam: r.totalMenit > 0 ? `${jam}j ${menit}m` : '—' }
    })
}
