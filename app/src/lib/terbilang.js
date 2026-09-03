// Ubah angka jadi teks terbilang Bahasa Indonesia, dipakai di slip gaji cetak A4.
function terbilangRatus(n) {
  const h = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan']
  if (n < 10) return h[n]
  if (n < 20) return n === 10 ? 'Sepuluh' : 'Sebelas'
  if (n < 100) return `${h[Math.floor(n / 10)]} Puluh ${h[n % 10]}`.trim()
  if (n === 100) return 'Seratus'
  return `${n < 200 ? 'Seratus' : `${h[Math.floor(n / 100)]} Ratus`} ${terbilangRatus(n % 100)}`.trim()
}

export function terbilang(angka) {
  let n = Math.abs(parseInt(angka, 10) || 0)
  const huruf = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas']
  const satuan = ['', 'Ribu', 'Juta', 'Miliar', 'Triliun']
  if (n === 0) return 'Nol Rupiah'
  if (n < 12) return `${huruf[n]} Rupiah`

  let hasil = ''
  let i = 0
  while (n > 0) {
    const ratus = n % 1000
    const r = terbilangRatus(ratus)
    if (r !== '') hasil = `${r} ${satuan[i]} ${hasil}`
    n = Math.floor(n / 1000)
    i++
  }
  return `${hasil.trim()} Rupiah`
}
