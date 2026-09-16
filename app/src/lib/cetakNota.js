import { formatRupiah } from './format'
import { SHOP } from './shopInfo'

export function cetakNota(data) {
  if (!data) return

  let nota = `<html><head><style>body{font-family:Courier New; font-size:13px; width:280px; padding:10px; margin:0 auto;}.tengah{text-align:center; white-space:nowrap;}.kanan{text-align:right; white-space:nowrap;}.garis{border-bottom:1px dashed #000; margin:6px 0;}table{width:100%; border-collapse:collapse; font-size:12px;}.logo{max-width:200px; max-height:100px; object-fit:contain;}</style></head><body><div class="tengah"><img class="logo" src="${SHOP.logo}" alt="${SHOP.nama}" />${SHOP.alamat ? `<p style="margin:4px 0; font-size:12px;">${SHOP.alamat}</p>` : ''}${SHOP.telepon ? `<p style="margin:4px 0; font-size:12px;">Telp: ${SHOP.telepon}</p>` : ''}</div><div class="garis"></div><p>Tanggal: ${data.tgl}</p><p>Pelanggan: ${data.namaPelanggan}</p><p>📱 HP: ${data.nomorHP || '-'}</p><p>Plat/Motor: ${data.platKendaraan} / ${data.jenisMotor}</p><div class="garis"></div><table><tr><td><strong>URAIAN</strong></td><td class="tengah"><strong>JUMLAH</strong></td><td class="kanan"><strong>SUBTOTAL</strong></td></tr><tr><td colspan="3"><div class="garis"></div></td></tr>`

  ;(data.items || []).forEach((i) => {
    nota += `<tr><td>${i.nama}</td><td class="tengah">${i.jumlah} ${i.satuan}</td><td class="kanan">${formatRupiah(i.subtotal)}</td></tr>`
  })

  if (data.biayaJasa > 0) {
    nota += `<tr><td>🔧 ${data.namaJasa || 'Jasa'}</td><td class="tengah">—</td><td class="kanan">${formatRupiah(data.biayaJasa)}</td></tr>`
  }

  nota += `<tr><td colspan="3"><div class="garis"></div></td></tr><tr><td colspan="2"><strong>TOTAL</strong></td><td class="kanan"><strong>${formatRupiah(data.totalBayar)}</strong></td></tr>`

  if (data.uangdibayarkan > 0) {
    nota += `<tr><td colspan="2">💰 Total Bayar </td><td class="kanan">${formatRupiah(data.uangdibayarkan)}</td></tr><tr><td colspan="2">📉 Sisa Bayar</td><td class="kanan">${formatRupiah(data.sisaBayar)}</td></tr>`
  }

  nota += `<tr><td colspan="2">💳 Cara Bayar</td><td class="kanan">${data.caraBayar}</td></tr></table><div class="garis"></div><p class="tengah">Terima Kasih 🙏</p><script>window.onload=function(){ window.print(); }<\/script></body></html>`

  const win = window.open('', '_blank', 'width=320,height=600')
  win.document.write(nota)
  win.document.close()
}
