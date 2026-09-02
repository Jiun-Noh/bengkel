import { SHOP } from './shopInfo'

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatTanggalIndo(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return `${String(d).padStart(2, '0')} ${NAMA_BULAN[m - 1]} ${y}`
}

// Magang → surat keterangan magang selesai. Jabatan lain (Mekanik/Kasir/Freelance/Lainnya) → surat pengalaman kerja.
export function cetakSuratStaff(staff) {
  if (!staff) return

  const mulai = formatTanggalIndo(staff.tanggalMulai) || '—'
  const keluar = formatTanggalIndo(staff.tanggalKeluar) || 'sekarang'
  const tanggalCetak = formatTanggalIndo(new Date().toISOString().split('T')[0])
  const isMagang = staff.jabatan === 'Magang'

  const judul = isMagang ? 'SURAT KETERANGAN MAGANG' : 'SURAT PENGALAMAN KERJA'
  const baris = isMagang
    ? [
        ['Nama', staff.nama],
        ['Program', 'Magang / Praktik Kerja Lapangan'],
        ['Periode Magang', `${mulai} s/d ${keluar}`],
      ]
    : [
        ['Nama', staff.nama],
        ['Jabatan', staff.jabatan],
        ['Periode Kerja', `${mulai} s/d ${keluar}`],
      ]
  const isiUtama = isMagang
    ? `Yang bersangkutan telah menyelesaikan program magang di <strong>${SHOP.nama}</strong> dengan baik.`
    : `Yang bersangkutan benar telah bekerja di <strong>${SHOP.nama}</strong> pada posisi tersebut di atas dengan baik dan penuh tanggung jawab.`

  const baseInfo = SHOP.alamat || SHOP.telepon
    ? `<p style="margin:2px 0; font-size:12px;">${[SHOP.alamat, SHOP.telepon && `Telp: ${SHOP.telepon}`].filter(Boolean).join(' &nbsp;•&nbsp; ')}</p>`
    : ''

  const html = `<html><head><meta charset="utf-8"><title>${judul} - ${staff.nama}</title><style>
    @page { size: A4; margin: 2.5cm; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.7; color: #111; }
    .kop { text-align: center; border-bottom: 3px double #111; padding-bottom: 10px; margin-bottom: 24px; }
    .kop h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
    .judul { text-align: center; margin-bottom: 4px; }
    .judul h2 { margin: 0 0 4px; font-size: 16px; text-decoration: underline; }
    table.data { margin: 20px 0; border-collapse: collapse; }
    table.data td { padding: 3px 8px 3px 0; vertical-align: top; }
    table.data td.label { width: 150px; }
    .isi { text-align: justify; margin: 20px 0; }
    .ttd { margin-top: 60px; width: 260px; margin-left: auto; text-align: center; }
    .ttd .tanggal { margin-bottom: 70px; }
    .ttd .nama { text-decoration: underline; font-weight: bold; }
  </style></head><body>
    <div class="kop">
      <h1>${SHOP.nama}</h1>
      ${baseInfo}
    </div>
    <div class="judul"><h2>${judul}</h2></div>
    <p>Yang bertanda tangan di bawah ini, pemilik <strong>${SHOP.nama}</strong>, dengan ini menerangkan bahwa:</p>
    <table class="data">
      ${baris.map(([label, nilai]) => `<tr><td class="label">${label}</td><td>: ${nilai}</td></tr>`).join('')}
    </table>
    <p class="isi">${isiUtama}</p>
    <p>Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>
    <div class="ttd">
      <div class="tanggal">${tanggalCetak}</div>
      <div class="nama">${SHOP.pemilik}</div>
      <div>Pemilik</div>
    </div>
    <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`

  const win = window.open('', '_blank', 'width=850,height=1100')
  win.document.write(html)
  win.document.close()
}
