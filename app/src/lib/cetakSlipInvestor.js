import { formatRupiah } from './format'
import { terbilang } from './terbilang'
import { SHOP } from './shopInfo'

// Bukti pembagian laba bersih untuk satu investor, dicetak A4.
export function cetakSlipInvestor({ nama, persen, labaBersih, nominal, labelPeriode }) {
  const tglCetak = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

  const baseInfo = SHOP.alamat || SHOP.telepon
    ? `<p style="margin:2px 0; font-size:12px; text-align:center;">${[SHOP.alamat, SHOP.telepon && `Telp: ${SHOP.telepon}`].filter(Boolean).join(' &nbsp;•&nbsp; ')}</p>`
    : ''

  const html = `<html><head><meta charset="utf-8"><title>Slip Investor - ${nama}</title><style>
    @page { size: A4; margin: 2.5cm; }
    body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #111; }
    .kop { text-align: center; border-bottom: 3px double #111; padding-bottom: 10px; margin-bottom: 20px; }
    .kop h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
    .judul { text-align: center; margin-bottom: 16px; }
    .judul h2 { margin: 0; font-size: 16px; text-decoration: underline; }
    table.data { margin: 14px 0; border-collapse: collapse; }
    table.data td { padding: 3px 8px 3px 0; vertical-align: top; }
    table.data td.label { width: 160px; }
    h3 { font-size: 14px; margin: 18px 0 8px; }
    .garis { border-bottom: 1px dashed #999; margin: 8px 0; }
    .total { font-size: 16px; font-weight: bold; margin-top: 10px; }
    .terbilang { font-style: italic; margin-top: 4px; font-size: 13px; }
    .ttd { margin-top: 50px; width: 100%; border-collapse: collapse; }
    .ttd td { text-align: center; width: 50%; }
    .ttd .garis-ttd { padding-top: 60px; border-bottom: 1px solid #000; }
    .ttd .nama-ttd { padding-top: 6px; font-size: 13px; }
  </style></head><body>
    <div class="kop">
      <h1>${SHOP.nama}</h1>
      ${baseInfo}
    </div>
    <div class="judul"><h2>📄 BUKTI PEMBAGIAN LABA BERSIH INVESTOR</h2></div>
    <table class="data">
      <tr><td class="label">Nama Investor</td><td>: ${nama}</td></tr>
      <tr><td class="label">Periode</td><td>: ${labelPeriode}</td></tr>
    </table>
    <div class="garis"></div>
    <h3>📊 Rincian Perhitungan</h3>
    <table class="data">
      <tr><td class="label">Laba Bersih Bulan Ini</td><td>: ${formatRupiah(labaBersih)}</td></tr>
      <tr><td class="label">Persentase Bagian</td><td>: ${persen}%</td></tr>
    </table>
    <div class="garis"></div>
    <p class="total">✅ JUMLAH DITERIMA: ${formatRupiah(nominal)}</p>
    <p class="terbilang">Terbilang: ${terbilang(nominal)}</p>
    <p style="margin-top:10px;">Keterangan: Pembagian laba bersih sesuai kesepakatan investasi.</p>
    <p style="margin-top:20px;">Dibuat pada: ${tglCetak}</p>
    <table class="ttd">
      <tr><td class="garis-ttd"></td><td class="garis-ttd"></td></tr>
      <tr><td class="nama-ttd">( ${SHOP.pemilik} )<br>Pemilik Bengkel</td><td class="nama-ttd">( ${nama} )<br>Penerima</td></tr>
    </table>
    <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`

  const win = window.open('', '_blank', 'width=850,height=1100')
  win.document.write(html)
  win.document.close()
}
