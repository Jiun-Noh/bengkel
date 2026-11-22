// Daftar pembaruan aplikasi — ditampilkan sebagai popup "Apa yang baru" ke pengguna.
//
// CARA PAKAI tiap deploy yang ada perubahan yang terasa buat pengguna:
//   tambahkan entri BARU di PALING ATAS. `versi` harus unik (pakai tanggal, tambah -2 kalau
//   deploy dua kali sehari). `untuk: 'pemilik'` = cuma tampil ke akun pemilik.
// Deploy yang cuma perbaikan kecil/tak terlihat → nggak perlu entri, popup nggak muncul.

export const DAFTAR_PEMBARUAN = [
  {
    versi: '2026-11-16-2',
    tanggal: '16 November 2026 (2)',
    item: [
      { teks: '📦 Perbaikan stok: angka Stok & Terjual sekarang selalu pas walau jualan dari beberapa HP sekaligus atau sinyal sempat putus (sebelumnya kadang ada penjualan yang nggak tercatat di stok).' },
      { teks: '✏️ Ubah data barang (nama/harga) nggak lagi ikut menimpa angka stok.', untuk: 'pemilik' },
    ],
  },
  {
    versi: '2026-11-16',
    tanggal: '16 November 2026',
    item: [
      { teks: '🚶 Tombol "Pelanggan Umum" di Transaksi buat pembeli cepat tanpa data. Mau dapat poin? Cukup minta Nomor HP-nya, nama boleh kosong.' },
      { teks: '📅 Riwayat Penjualan: tombol periode cepat (Hari Ini, Kemarin, 7 Hari, Bulan Ini, Bulan Lalu, Semua). Total di bawah tabel sekarang ikut filter.' },
      { teks: '💳 Catat Pelunasan: cara bayar bisa dipilih ulang selama transaksi belum lunas.' },
      { teks: '🗂️ Katalog: filter stok ⚠️ Menipis & ❌ Habis. Kode & motor yang panjang dipotong — ketuk buat lihat lengkap.' },
      { teks: '📜 Tabel panjang (Transaksi, Absensi, Katalog) sekarang di-scroll di dalam tabel, judul kolom tetap kelihatan.' },
      { teks: '🔒 Nomor HP di transaksi yang sudah tersimpan cuma bisa diubah pemilik.' },
      { teks: '🎁 Klaim poin susulan: transaksi tanpa No. HP bisa dikasih poin belakangan (maks. 7 hari) lewat ✏️ Ubah.', untuk: 'pemilik' },
      { teks: '🗑️ Hapus transaksi sekarang otomatis mengembalikan stok barang & mengurangi angka Terjual.', untuk: 'pemilik' },
      { teks: '📈 Laporan: grafik Tren (urut tanggal) & Jam Ramai; Pengeluaran & Hutang Supplier bisa dicari dan di-scroll.', untuk: 'pemilik' },
    ],
  },
]

const KUNCI_DILIHAT = 'bengkel.pembaruanDilihat'

function untukPeran(entri, peran) {
  const item = entri.item.filter((i) => !i.untuk || i.untuk === 'semua' || i.untuk === peran)
  return item.length ? { ...entri, item } : null
}

export function semuaPembaruan(peran) {
  return DAFTAR_PEMBARUAN.map((e) => untukPeran(e, peran)).filter(Boolean)
}

// Entri yang belum pernah dilihat di HP/browser ini. Kalau belum pernah lihat sama sekali,
// cukup entri terbaru saja (jangan banjiri pengguna dengan seluruh sejarah).
export function pembaruanBelumDilihat(peran) {
  let dilihat = null
  try {
    dilihat = localStorage.getItem(KUNCI_DILIHAT)
  } catch {
    // private mode — anggap belum pernah lihat
  }
  const idx = DAFTAR_PEMBARUAN.findIndex((e) => e.versi === dilihat)
  const baru = idx === -1 ? DAFTAR_PEMBARUAN.slice(0, 1) : DAFTAR_PEMBARUAN.slice(0, idx)
  return baru.map((e) => untukPeran(e, peran)).filter(Boolean)
}

export function tandaiSudahDilihat() {
  if (!DAFTAR_PEMBARUAN.length) return
  try {
    localStorage.setItem(KUNCI_DILIHAT, DAFTAR_PEMBARUAN[0].versi)
  } catch {
    // abaikan
  }
}
