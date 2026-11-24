// Daftar pembaruan aplikasi — ditampilkan sebagai popup "Apa yang baru" ke pengguna.
//
// CARA PAKAI tiap deploy yang ada perubahan yang terasa buat pengguna:
//   tambahkan entri BARU di PALING ATAS. `versi` harus unik (pakai tanggal, tambah -2 kalau
//   deploy dua kali sehari). `untuk: 'pemilik'` = cuma tampil ke akun pemilik.
// Deploy yang cuma perbaikan kecil/tak terlihat → nggak perlu entri, popup nggak muncul.

export const DAFTAR_PEMBARUAN = [
  {
    versi: '2026-11-24',
    tanggal: '24 November 2026',
    item: [
      { teks: '📈 Ringkasan Bulan Ini lebih gampang dibaca: dibagi jadi Penjualan → Laba Kotor → Potongan → Laba Bersih, lengkap dengan tanda + − =. Ada baris "Modal barang terjual" biar kelihatan modal dipotong waktu barangnya laku.', untuk: 'pemilik' },
      { teks: '🧾 Baris baru "Total Omset" (barang + jasa) — angkanya sama dengan Total Semua Bayar di Transaksi. "Omset Penjualan" diganti nama jadi "Penjualan Barang" (cuma barang).', untuk: 'pemilik' },
      { teks: '💸 Form Pengeluaran sekarang cuma Operasional & Maintenance. Belanja barang dagangan wajib lewat 🗂️ Katalog → 🛒 Pembelian.', untuk: 'pemilik' },
      { teks: '📱 Perbaikan tampilan: angka besar di Ringkasan nggak lagi keluar dari kotak di HP.', untuk: 'pemilik' },
    ],
  },
  {
    versi: '2026-11-23',
    tanggal: '23 November 2026',
    item: [
      { teks: '🛒 Baru: Katalog → 🛒 Pembelian. Beli barang dagangan cukup catat di sini: pilih barang, jumlah, harga beli → stok bertambah, harga pokok dihitung ulang otomatis (rata-rata), dan kalau hutang langsung masuk Hutang Supplier. Tombol 🔄 di daftar Barang juga membuka layar ini.', untuk: 'pemilik' },
      { teks: '📈 Laba Bersih sekarang dihitung benar: belanja stok BUKAN biaya lagi (modal barang sudah dipotong waktu barangnya terjual). Sebelumnya modal yang sama terpotong dua kali, jadi laba kelihatan lebih kecil dari aslinya. Bulan-bulan lalu juga sudah dihitung ulang.', untuk: 'pemilik' },
      { teks: '💸 Pengeluaran: kategori baru "Belanja Stok", kategori bisa diganti langsung di tabel, dan catatan yang mirip nama barang diberi tanda 📦 Cocok dengan katalog. Mulai sekarang Operasional cuma buat listrik, sewa, sabun, dll.', untuk: 'pemilik' },
      { teks: '📊 Ringkasan Bulan Ini: diskon tukar poin ikut dipotong, bulan rugi ditampilkan minus (bukan 0), plus info Belum dibayar pelanggan, Belanja Stok bulan ini, dan Nilai stok di rak.', untuk: 'pemilik' },
      { teks: '⏳ Ketuk "Belum dibayar pelanggan" buat lihat siapa saja yang belum lunas (termasuk dari bulan lalu), lengkap dengan tombol 💬 WA untuk kirim pesan pengingat.', untuk: 'pemilik' },
      { teks: '🔒 Tambah stok (🔄) sekarang khusus pemilik. Jualan tetap seperti biasa.', untuk: 'karyawan' },
    ],
  },
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
