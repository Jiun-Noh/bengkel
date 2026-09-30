import { formatRupiah } from './format'
import { terbilang } from './terbilang'
import { SHOP } from './shopInfo'

// Bukti pembayaran (kwitansi) ke supplier — diserahkan ke supplier sebagai bukti sudah bayar
// sejumlah `nominal` (bisa cicilan sebagian, bukan langsung lunas). Dicetak A4, bukan di printer
// thermal 58mm nota pelanggan, karena ini dokumen formal buat pihak luar (perlu tanda tangan).
export function cetakKwitansiSupplier({ namaSupplier, deskripsi, tanggal, nominal, totalTagihan, sisaTagihan }) {
  const tglCetak = new Date(tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

  const baseInfo = SHOP.alamat || SHOP.telepon
    ? `<p style="margin:2px 0; font-size:12px; text-align:center;">${[SHOP.alamat, SHOP.telepon && `Telp: ${SHOP.telepon}`].filter(Boolean).join(' &nbsp;•&nbsp; ')}</p>`
    : ''

  const html = `<html><head><meta charset="utf-8"><title>Kwitansi - ${namaSupplier}</title><style>
    @page { size: A4; margin: 2.5cm; }
    body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #111; }
    .kop { text-align: center; border-bottom: 3px double #111; padding-bottom: 10px; margin-bottom: 20px; }
    .kop img { max-width: 220px; max-height: 90px; object-fit: contain; }
    .judul { text-align: center; margin-bottom: 16px; }
    .judul h2 { margin: 0; font-size: 16px; text-decoration: underline; }
    table.data { margin: 14px 0; border-collapse: collapse; width: 100%; }
    table.data td { padding: 3px 8px 3px 0; vertical-align: top; }
    table.data td.label { width: 160px; }
    .garis { border-bottom: 1px dashed #999; margin: 8px 0; }
    .total { font-size: 16px; font-weight: bold; margin-top: 10px; }
    .terbilang { font-style: italic; margin-top: 4px; font-size: 13px; }
    .ttd { margin-top: 50px; width: 100%; border-collapse: collapse; }
    .ttd td { text-align: center; width: 50%; }
    .ttd .garis-ttd { padding-top: 60px; border-bottom: 1px solid #000; }
    .ttd .nama-ttd { padding-top: 6px; font-size: 13px; }
  </style></head><body>
    <div class="kop">
      <img src="${SHOP.logo}" alt="${SHOP.nama}" />
      ${baseInfo}
    </div>
    <div class="judul"><h2>📄 KWITANSI PEMBAYARAN</h2></div>
    <table class="data">
      <tr><td class="label">Kepada (Supplier)</td><td>: ${namaSupplier}</td></tr>
      <tr><td class="label">Untuk Pembayaran</td><td>: ${deskripsi}</td></tr>
      <tr><td class="label">Tanggal</td><td>: ${tglCetak}</td></tr>
    </table>
    <div class="garis"></div>
    <p class="total">✅ JUMLAH DIBAYAR: ${formatRupiah(nominal)}</p>
    <p class="terbilang">Terbilang: ${terbilang(nominal)}</p>
    <table class="data" style="margin-top:14px;">
      <tr><td class="label">Total Tagihan</td><td>: ${formatRupiah(totalTagihan)}</td></tr>
      <tr><td class="label">Sisa Tagihan</td><td>: ${sisaTagihan > 0 ? formatRupiah(sisaTagihan) : 'LUNAS'}</td></tr>
    </table>
    <table class="ttd">
      <tr><td class="garis-ttd"></td><td class="garis-ttd"></td></tr>
      <tr><td class="nama-ttd">( ${SHOP.pemilik} )<br>${SHOP.nama}</td><td class="nama-ttd">( ${namaSupplier} )<br>Supplier</td></tr>
    </table>
    <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`

  const win = window.open('', '_blank', 'width=850,height=1100')
  win.document.write(html)
  win.document.close()
}
