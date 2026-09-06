import { useMemo, useState } from 'react'
import { useBarangQuery, useBarangMutations } from '../hooks/useBarang'
import { useUI } from '../contexts/UIContext'
import { useOwnerMode } from '../contexts/OwnerModeContext'
import { formatRupiah, kapitalKode, kapitalNama, waktuSekarang } from '../lib/format'
import Modal from '../components/common/Modal'
import Fab from '../components/common/Fab'
import AksiPemilik from '../components/common/AksiPemilik'

const STOK_MINIM = 3
const FORM_KOSONG = { kode: '', nama: '', jenisMotor: '', satuan: 'PCS', hargaPokok: '', hargaJual: '', jumlahStok: '' }

export default function StokPage() {
  const { data: barang = [], isLoading } = useBarangQuery(true)
  const { simpanBarang, hapusBarang } = useBarangMutations()
  const { notify, confirm } = useUI()
  const { unlocked } = useOwnerMode()

  const [mode, setMode] = useState('list') // 'list' | 'form'
  const [form, setForm] = useState(FORM_KOSONG)
  const [editingKode, setEditingKode] = useState(null)
  const [restockMode, setRestockMode] = useState(false)
  const [cari, setCari] = useState('')
  const [riwayatKode, setRiwayatKode] = useState(null)
  const [saving, setSaving] = useState(false)

  const barangEditing = editingKode ? barang.find((b) => b.kode === editingKode) : null

  const hasil = useMemo(() => {
    const kata = cari.trim().toUpperCase()
    if (!kata) return barang
    return barang.filter(
      (b) => b.kode.includes(kata) || b.nama.toUpperCase().includes(kata) || (b.jenisMotor || '').toUpperCase().includes(kata),
    )
  }, [barang, cari])

  function ubahKode(nilai) {
    const kode = kapitalKode(nilai)
    setForm((f) => ({ ...f, kode }))
  }

  function resetForm() {
    setForm(FORM_KOSONG)
    setEditingKode(null)
    setRestockMode(false)
  }

  function bukaTambah() {
    resetForm()
    setMode('form')
  }

  function mulaiEdit(b) {
    setEditingKode(b.kode)
    setRestockMode(false)
    setForm({
      kode: b.kode,
      nama: b.nama,
      jenisMotor: b.jenisMotor || '',
      satuan: b.satuan || 'PCS',
      hargaPokok: b.hargaPokok,
      hargaJual: b.hargaJual,
      jumlahStok: b.stok,
    })
    setMode('form')
  }

  function mulaiRestock(b) {
    setEditingKode(null)
    setRestockMode(true)
    setForm({
      kode: b.kode,
      nama: b.nama,
      jenisMotor: b.jenisMotor || '',
      satuan: b.satuan || 'PCS',
      hargaPokok: b.hargaPokok,
      hargaJual: b.hargaJual,
      jumlahStok: '',
    })
    setMode('form')
  }

  function kembaliKeDaftar() {
    resetForm()
    setMode('list')
  }

  async function submit(e) {
    e.preventDefault()
    const kode = form.kode.trim().toUpperCase()
    const nama = form.nama.trim()
    if (!kode || !nama) {
      notify('⚠️ Kode & Nama Barang wajib diisi!', 'error')
      return
    }

    const pokok = parseInt(form.hargaPokok, 10) || 0
    const jual = parseInt(form.hargaJual, 10) || 0
    const jumlah = parseInt(form.jumlahStok, 10) || 0
    const waktu = waktuSekarang()
    const adaSebelumnya = barang.find((b) => b.kode === kode)

    if (!editingKode && !restockMode && adaSebelumnya) {
      notify(`❌ Kode "${kode}" sudah dipakai oleh "${adaSebelumnya.nama}"!\nPakai tombol 🔄 Restock di daftar untuk menambah stok, atau pakai kode lain.`, 'error')
      return
    }

    let baris
    let pesan

    if (editingKode) {
      const b = barangEditing
      baris = {
        kode,
        nama,
        jenis_motor: form.jenisMotor.trim(),
        satuan: form.satuan,
        harga_pokok: pokok,
        harga_jual: jual,
        stok: b.stok,
        stok_awal: b.stokAwal,
        restock: b.restock,
        terjual: b.terjual,
        tanggal_stok_awal: b.tanggalStokAwal,
        riwayat_restock: b.riwayatRestock || [],
      }
      pesan = '✅ Data barang berhasil diubah!'
    } else if (restockMode) {
      if (!adaSebelumnya) {
        notify('❌ Barang tidak ditemukan, mungkin sudah dihapus.', 'error')
        return
      }
      const b = adaSebelumnya
      const riwayatRestockBaru = [...(b.riwayatRestock || []), { jumlah, tanggal: waktu }]
      baris = {
        kode: b.kode,
        nama: b.nama,
        jenis_motor: b.jenisMotor,
        satuan: b.satuan,
        harga_pokok: b.hargaPokok,
        harga_jual: b.hargaJual,
        stok: (b.stok || 0) + jumlah,
        stok_awal: b.stokAwal,
        restock: (b.restock || 0) + jumlah,
        terjual: b.terjual,
        tanggal_stok_awal: b.tanggalStokAwal,
        riwayat_restock: riwayatRestockBaru,
      }
      pesan = `✅ Restock berhasil!\nJumlah: ${jumlah} ${form.satuan}\nStok Sekarang: ${baris.stok} ${form.satuan}`
    } else {
      baris = {
        kode,
        nama,
        jenis_motor: form.jenisMotor.trim(),
        satuan: form.satuan,
        harga_pokok: pokok,
        harga_jual: jual,
        stok: jumlah,
        stok_awal: jumlah,
        restock: jumlah,
        terjual: 0,
        tanggal_stok_awal: waktu,
        riwayat_restock: [{ jumlah, tanggal: waktu }],
      }
      pesan = `✅ Barang baru berhasil ditambahkan!`
    }

    setSaving(true)
    try {
      await simpanBarang(baris)
      notify(pesan)
      resetForm()
      setMode('list')
    } catch (err) {
      notify('❌ Gagal menyimpan ke cloud: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function hapus(kode) {
    const ok = await confirm(`⚠️ Hapus barang ${kode}?`)
    if (!ok) return
    try {
      await hapusBarang(kode)
      if (editingKode === kode) kembaliKeDaftar()
    } catch (err) {
      notify('❌ Gagal menghapus di cloud: ' + err.message, 'error')
    }
  }

  async function revertRestock(b, index) {
    const entry = b.riwayatRestock[index]
    const ok = await confirm(`⚠️ Batalkan restock +${entry.jumlah} ${b.satuan || 'PCS'} (${entry.tanggal})?\nStok akan dikurangi kembali.`)
    if (!ok) return
    const riwayatBaru = b.riwayatRestock.filter((_, i) => i !== index)
    try {
      await simpanBarang({
        kode: b.kode,
        nama: b.nama,
        jenis_motor: b.jenisMotor,
        satuan: b.satuan,
        harga_pokok: b.hargaPokok,
        harga_jual: b.hargaJual,
        stok: (b.stok || 0) - entry.jumlah,
        stok_awal: b.stokAwal,
        restock: (b.restock || 0) - entry.jumlah,
        terjual: b.terjual,
        tanggal_stok_awal: b.tanggalStokAwal,
        riwayat_restock: riwayatBaru,
      })
      notify('✅ Restock dibatalkan, stok sudah disesuaikan.')
    } catch (err) {
      notify('❌ Gagal membatalkan di cloud: ' + err.message, 'error')
    }
  }

  function backupExcel() {
    let isi = 'Kode\tNama Barang\tJenis Motor\tSatuan\tHarga Pokok\tHarga Jual\tStok Awal\tRestock\tTerjual\tSisa Stok\n'
    barang.forEach((b) => {
      isi += `${b.kode}\t${b.nama}\t${b.jenisMotor || '-'}\t${b.satuan || 'PCS'}\t${b.hargaPokok}\t${b.hargaJual}\t${b.stokAwal || 0}\t${b.restock || 0}\t${b.terjual || 0}\t${b.stok || 0}\n`
    })
    const blob = new Blob([isi], { type: 'text/tab-separated-values;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'DaftarStok_' + waktuSekarang().replace(/\//g, '-').replace(/ /g, '_') + '.xls'
    a.click()
  }

  const barangRiwayat = riwayatKode ? barang.find((b) => b.kode === riwayatKode) : null

  if (mode === 'form') {
    return (
      <div>
        <div className="form-header">
          <button className="btn-back" onClick={kembaliKeDaftar} aria-label="Kembali">←</button>
          <h1>{editingKode ? '✏️ Ubah Barang' : restockMode ? '📦 Restock Barang' : '➕ Tambah Barang'}</h1>
        </div>

        <form className="card" onSubmit={submit}>
          {restockMode && (
            <div className="edit-banner" style={{ background: '#e3f2fd', color: '#0d47a1' }}>
              <span>📦 Restock — kode/nama/harga terkunci, cuma jumlah yang ditambahkan ke stok "{form.nama}"</span>
            </div>
          )}

          <div className="field">
            <label>Kode Barang</label>
            <input value={form.kode} onChange={(e) => ubahKode(e.target.value)} readOnly={!!editingKode || restockMode} placeholder="Kode Barang" autoFocus={!restockMode} />
          </div>
          <div className="field">
            <label>Nama Barang</label>
            <input
              value={form.nama}
              onChange={(e) => setForm((f) => ({ ...f, nama: kapitalNama(e.target.value) }))}
              placeholder="Nama Barang"
              disabled={restockMode}
            />
          </div>
          <div className="field">
            <label>Jenis Motor</label>
            <input
              value={form.jenisMotor}
              onChange={(e) => setForm((f) => ({ ...f, jenisMotor: kapitalNama(e.target.value) }))}
              placeholder="Contoh: BEAT, SCOOPY"
              disabled={restockMode}
            />
          </div>
          <div className="field">
            <label>Satuan</label>
            <select value={form.satuan} onChange={(e) => setForm((f) => ({ ...f, satuan: e.target.value }))} disabled={restockMode}>
              <option value="PCS">PCS</option>
              <option value="BTL">BOTOL</option>
              <option value="SET">SET</option>
            </select>
          </div>
          <div className="field">
            <label>Harga Pokok</label>
            <input
              type="number"
              value={form.hargaPokok}
              onChange={(e) => setForm((f) => ({ ...f, hargaPokok: e.target.value }))}
              placeholder="Harga Modal Beli"
              disabled={restockMode}
            />
          </div>
          <div className="field">
            <label>Harga Jual</label>
            <input
              type="number"
              value={form.hargaJual}
              onChange={(e) => setForm((f) => ({ ...f, hargaJual: e.target.value }))}
              placeholder="Harga Jual ke Pelanggan"
              disabled={restockMode}
            />
          </div>
          <div className="field">
            <label>{editingKode ? 'Jumlah Stok (terkunci)' : restockMode ? 'Jumlah Restock' : 'Jumlah Stok'}</label>
            <input
              type="number"
              value={form.jumlahStok}
              onChange={(e) => setForm((f) => ({ ...f, jumlahStok: e.target.value }))}
              placeholder="Jumlah Stok"
              autoFocus={restockMode}
              disabled={!!editingKode}
            />
            {editingKode && (
              <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                ⓘ Ubah jumlah stok cuma lewat 🔄 Restock atau ✕ batalkan di Riwayat Restock, biar histori selalu sesuai.
              </p>
            )}
          </div>

          <button className="btn btn-block" type="submit" disabled={saving}>
            {saving ? 'Menyimpan…' : restockMode ? '✅ Simpan Restock' : '✅ Simpan Barang'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      <h1>📦 Manajemen Stok Barang</h1>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>📋 Daftar Stok Barang</h2>
          <AksiPemilik>
            <button className="btn btn-blue btn-sm" onClick={backupExcel}>
              📥 Backup Excel
            </button>
          </AksiPemilik>
        </div>
        <input placeholder="🔍 Cari Kode / Nama Barang / Motor..." value={cari} onChange={(e) => setCari(e.target.value)} style={{ marginTop: 10 }} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="tengah">Aksi</th>
                <th className="tengah">No</th>
                <th>Kode</th>
                <th>Nama Barang</th>
                <th>Motor</th>
                <th className="tengah">Satuan</th>
                <th className="angka">Harga Pokok</th>
                <th className="angka">Harga Jual</th>
                <th className="angka">Stok</th>
                <th className="angka">Terjual</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={10} className="tengah" style={{ padding: 12, color: '#888' }}>
                    Memuat...
                  </td>
                </tr>
              )}
              {!isLoading && hasil.length === 0 && (
                <tr>
                  <td colSpan={10} className="tengah" style={{ padding: 12, color: '#888' }}>
                    📭 Belum ada barang
                  </td>
                </tr>
              )}
              {hasil.map((b, i) => {
                const rendah = (b.stok || 0) <= STOK_MINIM
                return (
                  <tr key={b.kode} className={rendah ? 'baris-merah' : ''}>
                    <td className="tengah">
                      <div className="row" style={{ flexWrap: 'nowrap', gap: 4, justifyContent: 'center' }}>
                        <button className="btn btn-sm" onClick={() => mulaiRestock(b)} title="Restock">
                          🔄
                        </button>
                        <AksiPemilik>
                          <div className="row" style={{ flexWrap: 'nowrap', gap: 4, justifyContent: 'center' }}>
                            <button className="btn btn-blue btn-sm" onClick={() => setRiwayatKode(b.kode)}>
                              📋
                            </button>
                            <button className="btn btn-orange btn-sm" onClick={() => mulaiEdit(b)}>
                              ✏️
                            </button>
                            <button className="btn btn-red btn-sm" onClick={() => hapus(b.kode)}>
                              🗑️
                            </button>
                          </div>
                        </AksiPemilik>
                      </div>
                    </td>
                    <td className="tengah">{i + 1}</td>
                    <td>{b.kode}</td>
                    <td>{b.nama}</td>
                    <td>{b.jenisMotor || '-'}</td>
                    <td className="tengah">{b.satuan || 'PCS'}</td>
                    <td className="angka">{formatRupiah(b.hargaPokok)}</td>
                    <td className="angka">{formatRupiah(b.hargaJual)}</td>
                    <td className={`angka ${rendah ? 'merah' : ''}`}>{b.stok || 0}</td>
                    <td className="angka">{b.terjual || 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {barangRiwayat && (
        <Modal title={`📋 Riwayat Restock — ${barangRiwayat.kode}`} onClose={() => setRiwayatKode(null)}>
          <p>
            <strong>{barangRiwayat.nama}</strong>
          </p>
          <p>📅 Stok Awal: {barangRiwayat.stokAwal || 0} {barangRiwayat.satuan || 'PCS'} {barangRiwayat.tanggalStokAwal && `(${barangRiwayat.tanggalStokAwal})`}</p>
          <p>📦 Total Restock: {barangRiwayat.restock || 0} {barangRiwayat.satuan || 'PCS'}</p>
          <p>❌ Terjual: {barangRiwayat.terjual || 0}</p>
          <p>✅ Sisa Stok: {barangRiwayat.stok || 0}</p>
          {barangRiwayat.riwayatRestock?.length > 0 && (
            <>
              <p style={{ marginTop: 12 }}>
                <strong>📅 Detail Restock:</strong>
              </p>
              {barangRiwayat.riwayatRestock.map((r, i) => (
                <div
                  key={i}
                  className="row"
                  style={{ padding: '4px 0', borderBottom: '1px dashed #eee', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>{i + 1}. +{r.jumlah} {barangRiwayat.satuan || 'PCS'} — {r.tanggal}</span>
                  <button className="btn btn-red btn-sm" onClick={() => revertRestock(barangRiwayat, i)} title="Batalkan restock ini">
                    ✕
                  </button>
                </div>
              ))}
            </>
          )}
        </Modal>
      )}

      {unlocked && <Fab onClick={bukaTambah} title="Tambah Barang" />}
    </div>
  )
}
