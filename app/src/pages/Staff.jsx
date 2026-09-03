import { useEffect, useMemo, useState } from 'react'
import { useStaffQuery, useStaffMutations, generateKodeStaffBaru } from '../hooks/useStaff'
import { useUI } from '../contexts/UIContext'
import { kapitalNama } from '../lib/format'
import { JABATAN_OPTIONS } from '../lib/jabatanOptions'
import { cetakSuratStaff } from '../lib/cetakSurat'
import Fab from '../components/common/Fab'
import AksiPemilik from '../components/common/AksiPemilik'

const FORM_KOSONG = {
  nama: '',
  jabatan: 'Mekanik',
  aktif: true,
  tanggalMulai: '',
  tanggalKeluar: '',
  gajiPokok: '',
  uangMakan: '',
  uangBensin: '',
}

export default function StaffPage() {
  const { data: staffList = [], isLoading } = useStaffQuery(true)
  const { simpanStaff, hapusStaff } = useStaffMutations()
  const { notify, confirm } = useUI()

  const [mode, setMode] = useState('list') // 'list' | 'form'
  const [editingKode, setEditingKode] = useState(null)
  const [form, setForm] = useState(FORM_KOSONG)
  const [kodeBaru, setKodeBaru] = useState('')
  const [cari, setCari] = useState('')
  const [saving, setSaving] = useState(false)

  // Kode auto-generate hanya saat menambah staff baru, bukan saat sedang mengedit
  useEffect(() => {
    if (!editingKode) setKodeBaru(generateKodeStaffBaru(staffList))
  }, [staffList, editingKode])

  const kodeTampil = editingKode || kodeBaru

  const hasil = useMemo(() => {
    const kata = cari.trim().toUpperCase()
    if (!kata) return staffList
    return staffList.filter((s) => s.kode.toUpperCase().includes(kata) || s.nama.toUpperCase().includes(kata))
  }, [staffList, cari])

  function resetForm() {
    setEditingKode(null)
    setForm(FORM_KOSONG)
  }

  function bukaTambah() {
    resetForm()
    setMode('form')
  }

  function mulaiEdit(s) {
    setEditingKode(s.kode)
    setForm({
      nama: s.nama,
      jabatan: s.jabatan,
      aktif: s.aktif,
      tanggalMulai: s.tanggalMulai || '',
      tanggalKeluar: s.tanggalKeluar || '',
      gajiPokok: s.gajiPokok || '',
      uangMakan: s.uangMakan || '',
      uangBensin: s.uangBensin || '',
    })
    setMode('form')
  }

  function kembaliKeDaftar() {
    resetForm()
    setMode('list')
  }

  async function submit(e) {
    e.preventDefault()
    const nama = form.nama.trim()
    if (!nama) {
      notify('⚠️ Isi Nama Staff!', 'error')
      return
    }
    setSaving(true)
    try {
      await simpanStaff({
        kode: kodeTampil,
        nama,
        jabatan: form.jabatan,
        aktif: form.aktif,
        tanggal_mulai: form.tanggalMulai || null,
        tanggal_keluar: form.tanggalKeluar || null,
        gaji_pokok: parseInt(form.gajiPokok, 10) || 0,
        uang_makan: parseInt(form.uangMakan, 10) || 0,
        uang_bensin: parseInt(form.uangBensin, 10) || 0,
      })
      notify(editingKode ? '✅ Data staff berhasil diubah!' : `✅ Staff baru berhasil ditambahkan!\nKode: ${kodeTampil}`)
      resetForm()
      setMode('list')
    } catch (err) {
      notify('❌ Gagal menyimpan ke cloud: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function hapus(kode) {
    const ok = await confirm(`⚠️ Hapus staff ${kode}?\n(Data absensi lama tidak akan ikut terhapus)`)
    if (!ok) return
    try {
      await hapusStaff(kode)
      if (editingKode === kode) kembaliKeDaftar()
    } catch (err) {
      notify('❌ Gagal menghapus di cloud: ' + err.message, 'error')
    }
  }

  if (mode === 'form') {
    return (
      <div>
        <div className="form-header">
          <button className="btn-back" onClick={kembaliKeDaftar} aria-label="Kembali">←</button>
          <h1>{editingKode ? '✏️ Ubah Staff' : '➕ Tambah Staff'}</h1>
        </div>

        <form className="card" onSubmit={submit}>
          <div className="field">
            <label>Kode Staff</label>
            <input value={kodeTampil} readOnly disabled />
          </div>
          <div className="field">
            <label>Nama Staff</label>
            <input
              placeholder="Nama Lengkap"
              value={form.nama}
              onChange={(e) => setForm((f) => ({ ...f, nama: kapitalNama(e.target.value) }))}
              autoFocus
            />
          </div>
          <div className="field">
            <label>Jabatan</label>
            <select value={form.jabatan} onChange={(e) => setForm((f) => ({ ...f, jabatan: e.target.value }))}>
              {JABATAN_OPTIONS.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select
              value={form.aktif ? '1' : '0'}
              onChange={(e) => setForm((f) => ({ ...f, aktif: e.target.value === '1' }))}
            >
              <option value="1">✅ Aktif</option>
              <option value="0">🚫 Nonaktif</option>
            </select>
          </div>

          <div className="field">
            <label>📅 Tanggal Mulai Kerja</label>
            <input
              type="date"
              value={form.tanggalMulai}
              onChange={(e) => setForm((f) => ({ ...f, tanggalMulai: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>🚪 Tanggal Keluar</label>
            <input
              type="date"
              value={form.tanggalKeluar}
              onChange={(e) => setForm((f) => ({ ...f, tanggalKeluar: e.target.value }))}
            />
          </div>
          <p style={{ fontSize: 12, color: '#888', marginTop: -8 }}>
            ⓘ Dipakai untuk mengisi tanggal di surat pengalaman kerja / keterangan magang. Kosongkan Tanggal Keluar jika masih aktif bekerja.
          </p>

          {form.jabatan === 'Magang' ? (
            <>
              <div className="field">
                <label>🍽️ Uang Makan / Bulan (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={form.uangMakan}
                  onChange={(e) => setForm((f) => ({ ...f, uangMakan: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="field">
                <label>🛵 Uang Bensin / Bulan (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={form.uangBensin}
                  onChange={(e) => setForm((f) => ({ ...f, uangBensin: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </>
          ) : (
            <div className="field">
              <label>💰 Gaji Pokok / Bulan (Rp)</label>
              <input
                type="number"
                min="0"
                value={form.gajiPokok}
                onChange={(e) => setForm((f) => ({ ...f, gajiPokok: e.target.value }))}
                placeholder="0"
              />
            </div>
          )}
          <p style={{ fontSize: 12, color: '#888', marginTop: -8 }}>
            ⓘ Dipakai untuk hitung slip gaji bulanan di Laporan (Mode Pemilik). Boleh dikosongkan/0 dulu, isi kapan saja.
          </p>

          <button className="btn btn-block" type="submit" disabled={saving}>
            {saving ? 'Menyimpan…' : '✅ Simpan Staff'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      <h1>👤 Manajemen Data Staff</h1>

      <div className="card">
        <h2>📋 Daftar Staff</h2>
        <input placeholder="🔍 Cari Kode / Nama Staff..." value={cari} onChange={(e) => setCari(e.target.value)} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="tengah">Aksi</th>
                <th className="tengah">No</th>
                <th>Kode</th>
                <th>Nama</th>
                <th>Jabatan</th>
                <th className="tengah">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="tengah" style={{ padding: 12, color: '#888' }}>
                    Memuat...
                  </td>
                </tr>
              )}
              {!isLoading && hasil.length === 0 && (
                <tr>
                  <td colSpan={6} className="tengah" style={{ padding: 12, color: '#888' }}>
                    📭 Belum ada staff
                  </td>
                </tr>
              )}
              {hasil.map((s, i) => (
                <tr key={s.kode}>
                  <td className="tengah">
                    <AksiPemilik>
                      <div className="row" style={{ flexWrap: 'nowrap', gap: 4, justifyContent: 'center' }}>
                        <button
                          className="btn btn-blue btn-sm"
                          onClick={() => cetakSuratStaff(s)}
                          title={s.jabatan === 'Magang' ? 'Cetak Surat Keterangan Magang' : 'Cetak Surat Pengalaman Kerja'}
                        >
                          🖨️
                        </button>
                        <button className="btn btn-orange btn-sm" onClick={() => mulaiEdit(s)}>
                          ✏️
                        </button>
                        <button className="btn btn-red btn-sm" onClick={() => hapus(s.kode)}>
                          🗑️
                        </button>
                      </div>
                    </AksiPemilik>
                  </td>
                  <td className="tengah">{i + 1}</td>
                  <td>{s.kode}</td>
                  <td>{s.nama}</td>
                  <td>{s.jabatan}</td>
                  <td className="tengah">{s.aktif ? '✅ Aktif' : '🚫 Nonaktif'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Fab onClick={bukaTambah} title="Tambah Staff" />
    </div>
  )
}
