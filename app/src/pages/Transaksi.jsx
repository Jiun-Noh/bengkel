import { useMemo, useState } from 'react'
import { useBarangQuery, useBarangMutations } from '../hooks/useBarang'
import { useJasaQuery } from '../hooks/useJasa'
import { useRiwayatQuery, useRiwayatMutations } from '../hooks/useRiwayat'
import { useStaffQuery } from '../hooks/useStaff'
import { useUI } from '../contexts/UIContext'
import { formatRupiah, kapitalNama, kapitalKode, waktuSekarang } from '../lib/format'
import { cetakNota } from '../lib/cetakNota'
import Modal from '../components/common/Modal'

const FORM_KOSONG = {
  namaPelanggan: '',
  nomorHP: '',
  platKendaraan: '',
  jenisMotor: '',
  jenisJasa: '',
  biayaJasaTotal: '',
  mekanik: '',
  caraBayar: 'Tunai',
  uangdibayarkan: '0',
}

function ambilTanggalDariTeks(tgl) {
  if (!tgl) return null
  const p = tgl.split(' ')[0].split('/')
  if (p.length !== 3) return null
  return new Date(p[2], p[1] - 1, p[0])
}

function tanggalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function awalBulanIniISO() {
  const d = new Date()
  return tanggalISO(new Date(d.getFullYear(), d.getMonth(), 1))
}
function hariIniISO() {
  return tanggalISO(new Date())
}

export default function TransaksiPage() {
  const { data: barang = [] } = useBarangQuery(true)
  const { data: jasaList = [] } = useJasaQuery(true)
  const { data: riwayat = [], isLoading } = useRiwayatQuery(true)
  const { data: staffList = [] } = useStaffQuery(true)
  const { ubahStokTerjual } = useBarangMutations()
  const { tambahRiwayat, hapusRiwayat, ubahRiwayat } = useRiwayatMutations()
  const { notify, confirm } = useUI()

  const [form, setForm] = useState(FORM_KOSONG)
  const [keranjang, setKeranjang] = useState([])
  const [kodeJual, setKodeJual] = useState('')
  const [jumlahJual, setJumlahJual] = useState('')
  const [saranAktif, setSaranAktif] = useState(null) // 'nama' | 'plat' | null
  const [saranBarangAktif, setSaranBarangAktif] = useState(false)
  const [saranJasaAktif, setSaranJasaAktif] = useState(false)
  const [saving, setSaving] = useState(false)

  const [cari, setCari] = useState('')
  const [filterDari, setFilterDari] = useState(awalBulanIniISO())
  const [filterSampai, setFilterSampai] = useState(hariIniISO())
  const [detailIdx, setDetailIdx] = useState(null)
  const [editIdx, setEditIdx] = useState(null)

  const mekanikAktif = staffList.filter((s) => s.aktif && s.jabatan === 'Mekanik')

  const barangUntukKode = barang.find((b) => b.kode === kodeJual.toUpperCase())

  const totalBrgCart = keranjang.reduce((s, i) => s + i.subtotal, 0)
  const jasaNum = parseInt(form.biayaJasaTotal, 10) || 0
  const totalBayarCart = totalBrgCart + jasaNum
  const dpNum = parseInt(form.uangdibayarkan, 10) || 0
  const sisaCart = Math.max(0, totalBayarCart - dpNum)

  const daftarPelanggan = useMemo(() => {
    const daftar = []
    riwayat.forEach((r) => {
      if (r.namaPelanggan && r.namaPelanggan !== '-') {
        const ada = daftar.find((x) => x.nama === r.namaPelanggan && x.plat === r.platKendaraan)
        // riwayat sudah terurut dari yang terbaru, jadi kecocokan pertama = kunjungan terakhir pelanggan ini.
        if (!ada) daftar.push({ nama: r.namaPelanggan, plat: r.platKendaraan, motor: r.jenisMotor, nomorHP: r.nomorHP, kunjunganTerakhir: r.tgl })
      }
    })
    return daftar
  }, [riwayat])

  const riwayatPelangganAktif = useMemo(() => {
    const nama = form.namaPelanggan.trim()
    const plat = form.platKendaraan.trim().toUpperCase()
    if (!nama || !plat) return []
    return riwayat.filter((r) => r.namaPelanggan === nama && r.platKendaraan === plat).slice(0, 3)
  }, [riwayat, form.namaPelanggan, form.platKendaraan])

  const saranList = useMemo(() => {
    if (!saranAktif) return []
    const kata = (saranAktif === 'nama' ? form.namaPelanggan : form.platKendaraan).trim().toUpperCase()
    if (kata.length < 2) return []
    return daftarPelanggan.filter((p) => (saranAktif === 'nama' ? p.nama : p.plat).toUpperCase().includes(kata))
  }, [saranAktif, form.namaPelanggan, form.platKendaraan, daftarPelanggan])

  const saranBarang = useMemo(() => {
    if (!saranBarangAktif) return []
    const kata = kodeJual.trim().toUpperCase()
    if (!kata) return barang.slice(0, 8)
    return barang.filter((b) => b.kode.toUpperCase().includes(kata) || b.nama.toUpperCase().includes(kata)).slice(0, 8)
  }, [saranBarangAktif, kodeJual, barang])

  function pilihBarang(b) {
    setKodeJual(b.kode)
    setSaranBarangAktif(false)
  }

  const saranJasa = useMemo(() => {
    if (!saranJasaAktif) return []
    const kata = form.jenisJasa.trim().toUpperCase()
    if (!kata) return jasaList.slice(0, 8)
    return jasaList.filter((j) => j.nama.toUpperCase().includes(kata)).slice(0, 8)
  }, [saranJasaAktif, form.jenisJasa, jasaList])

  function pilihPelanggan(p) {
    setForm((f) => ({
      ...f,
      namaPelanggan: p.nama,
      platKendaraan: p.plat,
      jenisMotor: p.motor,
      nomorHP: p.nomorHP && p.nomorHP !== '-' ? p.nomorHP : f.nomorHP,
    }))
    setSaranAktif(null)
  }

  function isiDariHP(hp) {
    setForm((f) => ({ ...f, nomorHP: hp }))
    const kata = hp.trim().replace(/\D/g, '')
    if (kata.length < 4) return
    const ditemukan = riwayat.find((r) => (r.nomorHP || '').replace(/\D/g, '').includes(kata))
    if (ditemukan) {
      setForm((f) => ({
        ...f,
        nomorHP: hp,
        namaPelanggan: f.namaPelanggan.trim() ? f.namaPelanggan : ditemukan.namaPelanggan,
        platKendaraan: f.platKendaraan.trim() ? f.platKendaraan : ditemukan.platKendaraan,
        jenisMotor: f.jenisMotor.trim() ? f.jenisMotor : ditemukan.jenisMotor,
      }))
    }
  }

  function pilihJasa(j) {
    setForm((f) => ({ ...f, jenisJasa: j.nama, biayaJasaTotal: j.harga || '' }))
    setSaranJasaAktif(false)
  }

  function tambahKeKeranjang() {
    const kode = kodeJual.trim().toUpperCase()
    const jumlah = parseInt(jumlahJual, 10) || 0
    const b = barang.find((x) => x.kode === kode)
    if (!kode) { notify('⚠️ Masukkan Kode Barang!', 'error'); return }
    if (!b) { notify('⚠️ Barang tidak ditemukan!', 'error'); return }
    if (jumlah < 1) { notify('⚠️ Jumlah minimal 1!', 'error'); return }
    if (jumlah > (b.stok || 0)) { notify(`⚠️ Stok tidak cukup! Sisa: ${b.stok || 0} ${b.satuan}`, 'error'); return }

    setKeranjang((prev) => {
      const idx = prev.findIndex((x) => x.kode === kode)
      if (idx >= 0) {
        const baru = [...prev]
        baru[idx] = { ...baru[idx], jumlah: baru[idx].jumlah + jumlah, subtotal: (baru[idx].jumlah + jumlah) * baru[idx].hargaJual }
        return baru
      }
      return [
        ...prev,
        {
          kode: b.kode,
          nama: b.nama,
          satuan: b.satuan || 'PCS',
          jumlah,
          hargaPokok: b.hargaPokok,
          hargaJual: b.hargaJual,
          subtotal: jumlah * b.hargaJual,
          laba: jumlah * (b.hargaJual - b.hargaPokok),
        },
      ]
    })
    setKodeJual('')
    setJumlahJual('')
  }

  function hapusDariKeranjang(idx) {
    setKeranjang((prev) => prev.filter((_, i) => i !== idx))
  }

  function resetSemua() {
    setForm(FORM_KOSONG)
    setKeranjang([])
    setKodeJual('')
    setJumlahJual('')
  }

  async function selesaikanTransaksi() {
    const adaBarang = keranjang.length > 0
    const adaJasa = jasaNum > 0
    if (!adaBarang && !adaJasa) {
      notify('⚠️ Masukkan barang ATAU pilih jasa!', 'error')
      return
    }

    setSaving(true)
    try {
      for (const item of keranjang) {
        const b = barang.find((x) => x.kode === item.kode)
        if (!b) continue
        await ubahStokTerjual(b.kode, (b.stok || 0) - item.jumlah, (b.terjual || 0) + item.jumlah)
      }

      const totalModal = keranjang.reduce((s, i) => s + i.hargaPokok * i.jumlah, 0)
      const totalLabaBrg = keranjang.reduce((s, i) => s + i.laba, 0)

      await tambahRiwayat({
        tgl: waktuSekarang(),
        nama_pelanggan: form.namaPelanggan.trim() || '-',
        nomor_hp: form.nomorHP.trim() || '-',
        plat_kendaraan: form.platKendaraan.trim() || '-',
        jenis_motor: form.jenisMotor.trim().toUpperCase() || '-',
        nama_jasa: form.jenisJasa,
        nama_mekanik: form.mekanik || '-',
        biaya_jasa: jasaNum,
        items: JSON.parse(JSON.stringify(keranjang)),
        total_barang: totalBrgCart,
        modal_keluar: totalModal,
        laba_barang: totalLabaBrg,
        total_bayar: totalBayarCart,
        cara_bayar: form.caraBayar,
        uangdibayarkan: dpNum,
        sisa_bayar: sisaCart,
      })

      notify(`✅ SELESAI!\nTotal Bayar: ${formatRupiah(totalBayarCart)}\nDibayar: ${formatRupiah(dpNum)}\nSisa: ${formatRupiah(sisaCart)}`)
      resetSemua()
    } catch (err) {
      notify('❌ Gagal menyimpan transaksi ke cloud: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const dataTampil = useMemo(() => {
    let d = riwayat
    const kata = cari.trim().toUpperCase()
    if (kata) {
      const kataAngka = kata.replace(/\D/g, '')
      d = d.filter((r) => {
        const nama = (r.namaPelanggan || '').toUpperCase()
        const plat = (r.platKendaraan || '').toUpperCase()
        const hp = (r.nomorHP || '').replace(/\D/g, '')
        let uraian = (r.items || []).map((i) => i.nama).join(', ').toUpperCase()
        if (r.namaJasa) uraian += (uraian ? ' | ' : '') + r.namaJasa.toUpperCase()
        return nama.includes(kata) || plat.includes(kata) || (kataAngka.length >= 3 && hp.includes(kataAngka)) || uraian.includes(kata)
      })
    }
    if (filterDari || filterSampai) {
      const tglDari = filterDari ? new Date(filterDari) : new Date('2000-01-01')
      const tglSampai = filterSampai ? new Date(filterSampai) : new Date()
      tglSampai.setHours(23, 59, 59)
      d = d.filter((r) => {
        const t = ambilTanggalDariTeks(r.tgl)
        if (!t) return true
        return t >= tglDari && t <= tglSampai
      })
    }
    return d
  }, [riwayat, cari, filterDari, filterSampai])

  const sekarang = new Date()
  const ringkasan = useMemo(() => {
    const bulanIni = dataTampil.filter((r) => {
      const t = ambilTanggalDariTeks(r.tgl)
      return t && t.getMonth() === sekarang.getMonth() && t.getFullYear() === sekarang.getFullYear()
    })
    let total = 0, tunai = 0, qris = 0, transfer = 0, kartuDebit = 0, kartuKredit = 0
    bulanIni.forEach((r) => {
      const n = r.totalBayar || 0
      total += n
      const c = (r.caraBayar || '').toUpperCase()
      if (c.includes('TUNAI')) tunai += n
      else if (c.includes('QRIS')) qris += n
      else if (c.includes('TRANSFER')) transfer += n
      else if (c.includes('KREDIT')) kartuKredit += n
      else if (c.includes('DEBIT')) kartuDebit += n
    })
    return { jumlah: bulanIni.length, total, tunai, qris, transfer, kartuDebit, kartuKredit }
  }, [dataTampil])

  async function hapus(r) {
    const ok = await confirm('⚠️ Hapus riwayat ini?')
    if (!ok) return
    try {
      await hapusRiwayat(r.id)
    } catch (err) {
      notify('❌ Gagal menghapus di cloud: ' + err.message, 'error')
    }
  }

  const detailRiwayat = detailIdx != null ? dataTampil[detailIdx] : null
  const editRiwayat = editIdx != null ? dataTampil[editIdx] : null

  return (
    <div>
      <h1>🛒 Manajemen Transaksi &amp; Penjualan</h1>

      <div className="card">
        <h2>🛒 Input Transaksi Baru</h2>

        <h3 style={{ fontSize: 15 }}>👤 Data Pelanggan</h3>
        <div className="field" style={{ position: 'relative' }}>
          <label>Nama Pelanggan</label>
          <input
            value={form.namaPelanggan}
            onChange={(e) => { setForm((f) => ({ ...f, namaPelanggan: kapitalNama(e.target.value) })); setSaranAktif('nama') }}
            onBlur={() => setTimeout(() => setSaranAktif(null), 150)}
            placeholder="Nama Pelanggan"
          />
          {saranAktif === 'nama' && saranList.length > 0 && (
            <SaranBox saranList={saranList} onPilih={pilihPelanggan} />
          )}
        </div>
        <div className="field">
          <label>Nomor HP</label>
          <input value={form.nomorHP} onChange={(e) => isiDariHP(e.target.value)} placeholder="📱 Nomor HP / WhatsApp" />
        </div>
        <div className="field" style={{ position: 'relative' }}>
          <label>Nomor Plat</label>
          <input
            value={form.platKendaraan}
            onChange={(e) => { setForm((f) => ({ ...f, platKendaraan: e.target.value.toUpperCase() })); setSaranAktif('plat') }}
            onBlur={() => setTimeout(() => setSaranAktif(null), 150)}
            placeholder="Contoh: DK 1234 AB"
          />
          {saranAktif === 'plat' && saranList.length > 0 && (
            <SaranBox saranList={saranList} onPilih={pilihPelanggan} />
          )}
        </div>
        <div className="field">
          <label>Jenis Motor</label>
          <input value={form.jenisMotor} onChange={(e) => setForm((f) => ({ ...f, jenisMotor: e.target.value.toUpperCase() }))} placeholder="Contoh: HONDA BEAT" />
        </div>

        {riwayatPelangganAktif.length > 0 && (
          <div style={{ margin: '0 0 12px', padding: 10, background: '#fff8e1', borderRadius: 6, fontSize: 12 }}>
            <strong>🕐 Riwayat Kunjungan Terakhir Pelanggan Ini:</strong>
            {riwayatPelangganAktif.map((r) => {
              const uraian = (r.items || []).map((x) => `${x.nama}×${x.jumlah}`).join(', ') || r.namaJasa || 'Jasa'
              return (
                <div key={r.id} style={{ marginTop: 4 }}>
                  📅 {r.tgl} — {uraian} ({formatRupiah(r.totalBayar || 0)})
                </div>
              )
            })}
          </div>
        )}

        <h3 style={{ fontSize: 15 }}>🔧 Jenis Jasa Service</h3>
        <div className="field" style={{ position: 'relative' }}>
          <label>Pilih Jasa</label>
          <input
            placeholder="🔍 Cari Jenis Jasa..."
            value={form.jenisJasa}
            onChange={(e) => { setForm((f) => ({ ...f, jenisJasa: e.target.value })); setSaranJasaAktif(true) }}
            onFocus={() => setSaranJasaAktif(true)}
            onBlur={() => setTimeout(() => setSaranJasaAktif(false), 150)}
          />
          {saranJasaAktif && saranJasa.length > 0 && <SaranJasaBox saranJasa={saranJasa} onPilih={pilihJasa} />}
        </div>
        <div className="field">
          <label>👨‍🔧 Mekanik</label>
          <select value={form.mekanik} onChange={(e) => setForm((f) => ({ ...f, mekanik: e.target.value }))}>
            <option value="">— Pilih Mekanik —</option>
            {mekanikAktif.map((s) => (
              <option key={s.kode} value={s.nama}>👨‍🔧 {s.nama}</option>
            ))}
            <option value="Semua Mekanik">👨‍🔧 Semua Mekanik</option>
          </select>
        </div>
        <div className="field">
          <label>Biaya Jasa (Rp)</label>
          <input type="number" min="0" value={form.biayaJasaTotal} onChange={(e) => setForm((f) => ({ ...f, biayaJasaTotal: e.target.value }))} />
        </div>

        <h3 style={{ fontSize: 15 }}>➕ Tambah Barang</h3>
        <div className="row">
          <div style={{ flex: '2 1 160px', position: 'relative' }}>
            <input
              placeholder="🔍 Cari Kode / Nama Barang..."
              value={kodeJual}
              onChange={(e) => { setKodeJual(e.target.value.toUpperCase()); setSaranBarangAktif(true) }}
              onFocus={() => setSaranBarangAktif(true)}
              onBlur={() => setTimeout(() => setSaranBarangAktif(false), 150)}
            />
            {saranBarangAktif && saranBarang.length > 0 && <SaranBarangBox saranBarang={saranBarang} onPilih={pilihBarang} />}
          </div>
          <div style={{ flex: '1 1 100px', fontSize: 12, padding: '10px 4px', background: '#f0f8ff', borderRadius: 6 }}>
            {kodeJual.length >= 2 ? (barangUntukKode ? `✅ ${barangUntukKode.nama}` : '⚠️ Tidak ditemukan') : ''}
          </div>
          <div style={{ flex: '1 1 90px' }}>
            <input type="number" min="1" placeholder="Jumlah" value={jumlahJual} onChange={(e) => setJumlahJual(e.target.value)} />
          </div>
        </div>
        <button className="btn" type="button" onClick={tambahKeKeranjang}>➕ Tambah ke Keranjang</button>

        <h3 style={{ fontSize: 15, marginTop: 15 }}>📋 Uraian Barang</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama Barang</th>
                <th className="tengah">Jumlah</th>
                <th className="angka">Harga Jual</th>
                <th className="angka">Subtotal</th>
                <th className="tengah">Hapus</th>
              </tr>
            </thead>
            <tbody>
              {keranjang.map((item, i) => (
                <tr key={item.kode}>
                  <td>{item.nama}</td>
                  <td className="tengah">{item.jumlah} {item.satuan}</td>
                  <td className="angka">{formatRupiah(item.hargaJual)}</td>
                  <td className="angka">{formatRupiah(item.subtotal)}</td>
                  <td className="tengah">
                    <button className="btn btn-red btn-sm" onClick={() => hapusDariKeranjang(i)}>X</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, padding: 10, background: '#f9f9f9', borderRadius: 6 }}>
          <p><strong>Total Barang:</strong> {formatRupiah(totalBrgCart)}</p>
          <p><strong>Biaya Jasa:</strong> {formatRupiah(jasaNum)}</p>
          <hr />
          <p style={{ fontWeight: 700, fontSize: 16 }}>TOTAL BAYAR: {formatRupiah(totalBayarCart)}</p>
        </div>

        <div style={{ marginTop: 12, padding: 10, background: '#f0f8ff', borderRadius: 6 }}>
          <h3 style={{ fontSize: 15 }}>💳 Cara Pembayaran</h3>
          <div className="row">
            {['Tunai', 'QRIS', 'Transfer', 'Kartu Debit', 'Kartu Kredit'].map((c) => (
              <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="caraBayar" checked={form.caraBayar === c} onChange={() => setForm((f) => ({ ...f, caraBayar: c }))} style={{ width: 'auto', minHeight: 'auto' }} />
                {c === 'Tunai' ? '💵' : c === 'QRIS' ? '📱' : c === 'Transfer' ? '🏦' : c === 'Kartu Debit' ? '🏧' : '💳'} {c}
              </label>
            ))}
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>💰 DP / Uang Dibayarkan</label>
            <input type="number" min="0" value={form.uangdibayarkan} onChange={(e) => setForm((f) => ({ ...f, uangdibayarkan: e.target.value }))} />
            <p style={{ marginTop: 6 }}>Sisa Bayar: <strong>{formatRupiah(sisaCart)}</strong></p>
          </div>
          <div className="row">
            <button className="btn" onClick={selesaikanTransaksi} disabled={saving}>{saving ? 'Menyimpan…' : '✅ Selesai & Simpan'}</button>
            <button className="btn btn-blue" onClick={() => (riwayat[0] ? cetakNota(riwayat[0]) : notify('⚠️ Belum ada data penjualan!', 'error'))}>🖨️ Cetak Nota Terakhir</button>
            <button className="btn btn-orange" onClick={resetSemua}>🗑️ Kosongkan</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>📝 Riwayat Penjualan</h2>
        <div style={{ marginBottom: 12, padding: 10, background: '#f0f7ff', borderRadius: 6 }}>
          <input placeholder="🔍 Ketik Nama / Plat / Nomor HP..." value={cari} onChange={(e) => setCari(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            <label>Dari:</label>
            <input type="date" value={filterDari} onChange={(e) => setFilterDari(e.target.value)} style={{ width: 150 }} />
            <label>Sampai:</label>
            <input type="date" value={filterSampai} onChange={(e) => setFilterSampai(e.target.value)} style={{ width: 150 }} />
            <button className="btn btn-blue btn-sm" onClick={() => { setCari(''); setFilterDari(''); setFilterSampai('') }}>↩️ Tampilkan Semua</button>
          </div>
          <p style={{ fontSize: 12, color: '#888', marginTop: 6, marginBottom: 0 }}>
            ⓘ Bawaannya menampilkan transaksi bulan ini. Ubah tanggal atau pakai "Tampilkan Semua" untuk lihat bulan lain.
          </p>
        </div>

        <div className="table-wrap">
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Tanggal &amp; Waktu</th>
                <th>Pelanggan &amp; Plat</th>
                <th>Uraian</th>
                <th>Mekanik</th>
                <th className="angka">Total Bayar</th>
                <th>Pembayaran</th>
                <th>Status</th>
                <th className="tengah">Detail</th>
                <th className="tengah">Ubah</th>
                <th className="tengah">Cetak</th>
                <th className="tengah">Hapus</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={11} className="tengah" style={{ padding: 12, color: '#888' }}>Memuat...</td></tr>
              )}
              {!isLoading && dataTampil.length === 0 && (
                <tr><td colSpan={11} className="tengah" style={{ padding: 12, color: '#888' }}>📭 Belum ada transaksi</td></tr>
              )}
              {dataTampil.map((r, i) => {
                const uraian = (r.items || []).map((x) => `${x.nama}×${x.jumlah}`).join(', ') || r.namaJasa || 'Jasa'
                const lunas = !((r.uangdibayarkan || 0) > 0 && (r.sisaBayar || 0) > 0)
                return (
                  <tr key={r.id}>
                    <td>{r.tgl}</td>
                    <td>{r.namaPelanggan}<br /><small>{r.platKendaraan}{r.nomorHP && r.nomorHP !== '-' ? <><br />📱 {r.nomorHP}</> : null}</small></td>
                    <td>{uraian}</td>
                    <td>{r.namaMekanik || '-'}</td>
                    <td className="angka">{formatRupiah(r.totalBayar || 0)}</td>
                    <td>{r.caraBayar || 'Tunai'}{(r.uangdibayarkan || 0) > 0 && <><br /><small>{formatRupiah(r.uangdibayarkan)}</small></>}</td>
                    <td style={{ color: lunas ? 'green' : 'red', fontWeight: 700 }}>
                      {lunas ? '✅ Lunas' : '⚠️ Belum Lunas'}
                      {(r.sisaBayar || 0) > 0 && <><br /><small>Sisa: {formatRupiah(r.sisaBayar)}</small></>}
                    </td>
                    <td className="tengah"><button className="btn btn-blue btn-sm" onClick={() => setDetailIdx(i)}>📋</button></td>
                    <td className="tengah"><button className="btn btn-orange btn-sm" onClick={() => setEditIdx(i)}>✏️</button></td>
                    <td className="tengah"><button className="btn btn-blue btn-sm" onClick={() => cetakNota(r)}>🖨️</button></td>
                    <td className="tengah"><button className="btn btn-red btn-sm" onClick={() => hapus(r)}>🗑️</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, padding: 12, background: '#e8f5e9', borderRadius: 6, fontWeight: 700, lineHeight: 1.8 }}>
          <div>📊 Jumlah Transaksi: {ringkasan.jumlah}</div>
          <div>💰 Total Semua Bayar: {formatRupiah(ringkasan.total)}</div>
          <div style={{ color: '#2e7d32' }}>
            💵 Tunai: {formatRupiah(ringkasan.tunai)} &nbsp;|&nbsp; 📱 QRIS: {formatRupiah(ringkasan.qris)} &nbsp;|&nbsp; 🏦 Transfer: {formatRupiah(ringkasan.transfer)}
            <br />
            🏧 Kartu Debit: {formatRupiah(ringkasan.kartuDebit)} &nbsp;|&nbsp; 💳 Kartu Kredit: {formatRupiah(ringkasan.kartuKredit)}
          </div>
        </div>
      </div>

      {detailRiwayat && (
        <Modal title="📋 Detail Transaksi" onClose={() => setDetailIdx(null)}>
          <p>📅 Tanggal: {detailRiwayat.tgl}</p>
          <p>👤 Pelanggan: {detailRiwayat.namaPelanggan}</p>
          <p>🚗 Plat/Motor: {detailRiwayat.platKendaraan} / {detailRiwayat.jenisMotor}</p>
          <p>📱 HP: {detailRiwayat.nomorHP || '-'}</p>
          <p>🔧 Mekanik: {detailRiwayat.namaMekanik || '-'}</p>
          <p>💳 Cara Bayar: {detailRiwayat.caraBayar || 'Tunai'}</p>
          <p>💰 Total Bayar: {formatRupiah(detailRiwayat.totalBayar || 0)}</p>
          {(detailRiwayat.uangdibayarkan || 0) > 0 && (
            <>
              <p>💰 Dibayarkan: {formatRupiah(detailRiwayat.uangdibayarkan)}</p>
              <p>📉 Sisa Bayar: {formatRupiah(detailRiwayat.sisaBayar || 0)}</p>
            </>
          )}
          {detailRiwayat.biayaJasa > 0 && (
            <p>🔧 Jasa: {detailRiwayat.namaJasa || '-'} — {formatRupiah(detailRiwayat.biayaJasa)}</p>
          )}
          {(detailRiwayat.items || []).length > 0 && (
            <>
              <p style={{ marginTop: 8 }}><strong>📦 Barang:</strong></p>
              {detailRiwayat.items.map((x, i) => (
                <div key={i}>- {x.nama} × {x.jumlah} = {formatRupiah(x.subtotal)}</div>
              ))}
            </>
          )}
        </Modal>
      )}

      {editRiwayat && (
        <EditRiwayatModal
          data={editRiwayat}
          onClose={() => setEditIdx(null)}
          onSimpanPelanggan={async (kolom) => {
            try {
              await ubahRiwayat(editRiwayat.id, kolom)
              notify('✅ Data berhasil diubah!')
              setEditIdx(null)
            } catch (err) {
              notify('❌ Gagal menyimpan ke cloud: ' + err.message, 'error')
            }
          }}
          onCatatPelunasan={async (nominal) => {
            const uangBaru = (editRiwayat.uangdibayarkan || 0) + nominal
            const sisaBaru = Math.max(0, (editRiwayat.sisaBayar || 0) - nominal)
            try {
              await ubahRiwayat(editRiwayat.id, { uangdibayarkan: uangBaru, sisa_bayar: sisaBaru })
              notify(`✅ Pembayaran dicatat!\nDibayar: ${formatRupiah(nominal)}\nSisa sekarang: ${formatRupiah(sisaBaru)}`)
              setEditIdx(null)
            } catch (err) {
              notify('❌ Gagal menyimpan ke cloud: ' + err.message, 'error')
            }
          }}
        />
      )}
    </div>
  )
}

function SaranBox({ saranList, onPilih }) {
  return (
    <div style={{ position: 'absolute', zIndex: 5, background: 'white', border: '1px solid #ddd', borderRadius: 8, width: '100%', marginTop: 4, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
      {saranList.map((p) => (
        <div
          key={p.nama + p.plat}
          style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
          onMouseDown={() => onPilih(p)}
        >
          {p.nama} — {p.plat} — {p.motor}
          {p.kunjunganTerakhir && <><br /><small style={{ color: '#888' }}>Kunjungan terakhir: {p.kunjunganTerakhir}</small></>}
        </div>
      ))}
    </div>
  )
}

function SaranBarangBox({ saranBarang, onPilih }) {
  return (
    <div style={{ position: 'absolute', zIndex: 5, background: 'white', border: '1px solid #ddd', borderRadius: 8, width: '100%', marginTop: 4, boxShadow: '0 4px 10px rgba(0,0,0,0.1)', maxHeight: 260, overflowY: 'auto' }}>
      {saranBarang.map((b) => (
        <div
          key={b.kode}
          style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', gap: 8 }}
          onMouseDown={() => onPilih(b)}
        >
          <span>{b.nama} <small style={{ color: '#888' }}>({b.kode})</small></span>
          <small style={{ color: (b.stok || 0) <= 0 ? '#c00' : '#888', whiteSpace: 'nowrap' }}>Stok: {b.stok || 0}</small>
        </div>
      ))}
    </div>
  )
}

function SaranJasaBox({ saranJasa, onPilih }) {
  return (
    <div style={{ position: 'absolute', zIndex: 5, background: 'white', border: '1px solid #ddd', borderRadius: 8, width: '100%', marginTop: 4, boxShadow: '0 4px 10px rgba(0,0,0,0.1)', maxHeight: 260, overflowY: 'auto' }}>
      {saranJasa.map((j) => (
        <div
          key={j.id}
          style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', gap: 8 }}
          onMouseDown={() => onPilih(j)}
        >
          <span>🔧 {j.nama}</span>
          <small style={{ color: '#888', whiteSpace: 'nowrap' }}>{formatRupiah(j.harga || 0)}</small>
        </div>
      ))}
    </div>
  )
}

function EditRiwayatModal({ data, onClose, onSimpanPelanggan, onCatatPelunasan }) {
  const [nama, setNama] = useState(data.namaPelanggan)
  const [plat, setPlat] = useState(data.platKendaraan)
  const [motor, setMotor] = useState(data.jenisMotor)
  const [hp, setHp] = useState(data.nomorHP || '')
  const [mekanik, setMekanik] = useState(data.namaMekanik || '')
  const [nominal, setNominal] = useState(data.sisaBayar || 0)

  return (
    <Modal title="✏️ Ubah Transaksi" onClose={onClose}>
      <h4>Data Pelanggan</h4>
      <div className="field"><label>Nama Pelanggan</label><input value={nama} onChange={(e) => setNama(e.target.value)} /></div>
      <div className="field"><label>Nomor Plat</label><input value={plat} onChange={(e) => setPlat(e.target.value)} /></div>
      <div className="field"><label>Jenis Motor</label><input value={motor} onChange={(e) => setMotor(e.target.value)} /></div>
      <div className="field"><label>Nomor HP</label><input value={hp} onChange={(e) => setHp(e.target.value)} /></div>
      <div className="field"><label>Nama Mekanik</label><input value={mekanik} onChange={(e) => setMekanik(e.target.value)} /></div>
      <button
        className="btn btn-block"
        onClick={() => onSimpanPelanggan({ nama_pelanggan: nama, plat_kendaraan: plat, jenis_motor: motor, nomor_hp: hp, nama_mekanik: mekanik })}
      >
        💾 Simpan Data Pelanggan
      </button>

      <hr style={{ margin: '18px 0' }} />

      <h4>Catat Pelunasan</h4>
      {(data.sisaBayar || 0) <= 0 ? (
        <p style={{ color: 'green' }}>✅ Transaksi ini sudah LUNAS.</p>
      ) : (
        <>
          <p>Sisa bayar saat ini: <strong>{formatRupiah(data.sisaBayar)}</strong></p>
          <div className="field">
            <label>Uang Pelunasan</label>
            <input type="number" min="0" value={nominal} onChange={(e) => setNominal(e.target.value)} />
          </div>
          <button
            className="btn btn-block btn-blue"
            onClick={() => {
              const n = parseInt(nominal, 10) || 0
              if (n <= 0) return
              onCatatPelunasan(n)
            }}
          >
            💰 Catat Pelunasan
          </button>
        </>
      )}
    </Modal>
  )
}
