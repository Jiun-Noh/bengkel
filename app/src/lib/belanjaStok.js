// Pencocokan deskripsi Pengeluaran dengan nama barang di Katalog — logikanya SAMA dengan
// pg_temp.norm_barang di migrasi_pindah_belanja_stok.sql (kalau satu diubah, ubah juga yang lain).

export const KATEGORI_BELANJA_STOK = 'Belanja Stok'

export function normBarang(teks) {
  return (teks || '')
    .toUpperCase()
    .replace(/\([^)]*[0-9][^)]*\)/g, ' ') // (2PCS), (12 BTL)
    .replace(/\b[0-9]+\s*(PCS|PC|BTL|BOTOL|SET|PASANG|PSG|BUAH|BH|UNIT|DUS|BOX|LUSIN|LTR|LITER|X)\b/g, ' ') // 12BTL, 2 PCS
    .replace(/(\bX|×)\s*[0-9]+\b/g, ' ') // X5, ×3
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// → { jenis: 'persis' | 'mirip', nama } atau null
export function cariBarangCocok(deskripsi, daftarNormBarang) {
  const n = normBarang(deskripsi)
  if (!n) return null
  const persis = daftarNormBarang.find((b) => b.n === n)
  if (persis) return { jenis: 'persis', nama: persis.nama }
  if (n.length < 5) return null
  const mirip = daftarNormBarang.find((b) => b.n.length >= 5 && (n.includes(b.n) || b.n.includes(n)))
  return mirip ? { jenis: 'mirip', nama: mirip.nama } : null
}

export function siapkanNormBarang(barang) {
  // nama terpanjang dulu → kalau "mirip" beberapa barang, yang paling spesifik yang disarankan
  return barang
    .map((b) => ({ nama: b.nama, n: normBarang(b.nama) }))
    .filter((b) => b.n)
    .sort((a, b) => b.n.length - a.n.length)
}

// Tanggal hari ini (YYYY-MM-DD) menurut jam HP, bukan UTC — toISOString() bisa mundur sehari
// sebelum jam 7/8 pagi di Indonesia.
export function hariIniLokal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
