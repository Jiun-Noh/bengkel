import { formatRupiah, waktuSekarang } from './format'
import { SHOP } from './shopInfo'

// Tata letak sengaja tidak memakai lebar tetap: lebar mengikuti kertas yang dipilih di driver
// printer (58 mm maupun 80 mm), dan semua teks boleh turun baris. Tiap baris tabel cuma 2 kolom
// (label kiri, nominal kanan) supaya muat di 58 mm; nama barang ditaruh di baris sendiri, lalu
// baris berikutnya berisi "jumlah x harga satuan" dan subtotal.
const CSS = `
@page{margin:0}
body{font-family:'Courier New',monospace; font-size:12px; margin:0; padding:2mm;}
p{margin:3px 0;}
.tengah{text-align:center;}
.kanan{text-align:right; white-space:nowrap; padding-left:6px;}
.garis{border-bottom:1px dashed #000; margin:6px 0;}
table{width:100%; border-collapse:collapse; font-size:12px;}
td{vertical-align:top;}
.logo{max-width:min(200px,100%); max-height:100px; object-fit:contain;}
.nw{white-space:nowrap;}
@media (max-width:230px){ body,table{font-size:11px;} }
`

function baris(label, nilai, tebal = false) {
  const l = tebal ? `<strong>${label}</strong>` : label
  const n = tebal ? `<strong>${nilai}</strong>` : nilai
  return `<tr><td>${l}</td><td class="kanan">${n}</td></tr>`
}

// saldoPoinSekarang = saldo poin pelanggan SETELAH transaksi ini (opsional — cuma diisi
// pas cetak nota langsung setelah transaksi selesai, biar "Poin sebelumnya/sekarang" akurat).
// Kalau tidak diisi (mis. cetak ulang nota lama dari daftar riwayat), cuma tampilkan
// poin didapat/dipakai di transaksi itu saja, tanpa baris saldo (biar tidak menyesatkan).
// namaPencetak = nama akun yang lagi login pas tombol cetak ditekan (ditampilkan sebagai "Kasir"
// di footer nota, beda dari data.tgl yang merupakan waktu transaksi dibuat, bukan waktu cetak).
export function cetakNota(data, saldoPoinSekarang, namaPencetak) {
  if (!data) return

  let nota = `<html><head><style>${CSS}</style></head><body>`

  nota += `<div class="tengah"><img class="logo" src="${SHOP.logo}" alt="${SHOP.nama}" />`
  if (SHOP.alamat) nota += `<p>${SHOP.alamat}</p>`
  if (SHOP.telepon) nota += `<p>Telp: ${SHOP.telepon}</p>`
  nota += `</div><div class="garis"></div>`

  if (data.noTransaksi) nota += `<p>No. Transaksi: <strong>${data.noTransaksi}</strong></p>`
  nota += `<p>Tanggal: ${data.tgl}</p>`
  nota += `<p>Pelanggan: ${data.namaPelanggan}</p>`
  nota += `<p>📱 HP: ${data.nomorHP || '-'}</p>`
  nota += `<p>Plat/Motor: ${data.platKendaraan} / ${data.jenisMotor}</p>`
  nota += `<div class="garis"></div>`

  nota += `<table>${baris('URAIAN', 'SUBTOTAL', true)}<tr><td colspan="2"><div class="garis"></div></td></tr>`

  ;(data.items || []).forEach((i) => {
    const hargaSatuan = i.hargaJual ?? (i.jumlah ? i.subtotal / i.jumlah : i.subtotal)
    nota += `<tr><td colspan="2">${i.nama}</td></tr>`
    nota += baris(`${i.jumlah} ${i.satuan} x <span class="nw">${formatRupiah(hargaSatuan)}</span>`, formatRupiah(i.subtotal))
  })

  if ((data.jasaItems || []).length > 0) {
    data.jasaItems.forEach((j) => {
      nota += baris(`🔧 ${j.nama}`, formatRupiah(j.harga))
    })
  } else if (data.biayaJasa > 0) {
    nota += baris(`🔧 ${data.namaJasa || 'Jasa'}`, formatRupiah(data.biayaJasa))
  }

  nota += `<tr><td colspan="2"><div class="garis"></div></td></tr>`

  if (data.diskonPoin > 0) {
    nota += baris(`🎁 Diskon Poin (${data.poinDigunakan} poin)`, `−${formatRupiah(data.diskonPoin)}`)
  }

  nota += baris('TOTAL', formatRupiah(data.totalBayar), true)

  if (data.uangdibayarkan > 0) {
    nota += baris('💰 Total Bayar', formatRupiah(data.uangdibayarkan))
    nota += baris('📉 Sisa Bayar', formatRupiah(data.sisaBayar))
  }

  nota += baris('💳 Cara Bayar', data.caraBayar)
  nota += `</table>`

  const adaHP = data.nomorHP && data.nomorHP !== '-'
  const poinDidapat = data.poinDidapat || 0
  const poinDigunakan = data.poinDigunakan || 0
  if (adaHP && (poinDidapat > 0 || poinDigunakan > 0 || saldoPoinSekarang != null)) {
    const poinSebelumnya = saldoPoinSekarang != null ? saldoPoinSekarang - poinDidapat + poinDigunakan : null
    nota += `<div class="garis"></div><p class="tengah"><strong>🎁 POIN MEMBER</strong></p><table>`
    if (poinSebelumnya != null) nota += baris('Poin sebelumnya', poinSebelumnya)
    if (poinDidapat > 0) nota += baris('Poin transaksi', `+${poinDidapat}`)
    if (poinDigunakan > 0) nota += baris('Poin digunakan', `−${poinDigunakan}`)
    if (saldoPoinSekarang != null) nota += baris('Poin sekarang', saldoPoinSekarang, true)
    nota += `</table>`
  }

  nota += `<div class="garis"></div><p class="tengah">Terima kasih telah mempercayakan perawatan motor Anda kepada kami.</p>`

  if (namaPencetak) {
    nota += `<div class="garis"></div><p style="font-size:11px; color:#555;">Dicetak: ${waktuSekarang()}<br />Kasir: ${namaPencetak}</p>`
  }

  nota += `<script>window.onload=function(){ window.print(); }<\/script></body></html>`

  const win = window.open('', '_blank', 'width=320,height=600')
  win.document.write(nota)
  win.document.close()
}
