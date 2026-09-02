export function formatRupiah(angka) {
  return 'Rp ' + Math.round(angka || 0).toLocaleString('id-ID')
}

export function kapitalNama(teks) {
  return (teks || '').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function kapitalKode(teks) {
  return (teks || '').toUpperCase().replace(/\s/g, '')
}

export function waktuSekarang() {
  const d = new Date()
  const p2 = (n) => n.toString().padStart(2, '0')
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

export function hitungJamKerja(jamDatang, jamPulang) {
  if (!jamDatang || !jamPulang) return '-'
  const [j1, m1] = jamDatang.split(':').map(Number)
  const [j2, m2] = jamPulang.split(':').map(Number)
  let menit = j2 * 60 + m2 - (j1 * 60 + m1)
  if (menit < 0) menit += 24 * 60
  const jam = Math.floor(menit / 60)
  const sisa = menit % 60
  return jam > 0 ? `${jam}j ${sisa}m` : `${sisa}m`
}
