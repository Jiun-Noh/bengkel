import { createClient } from '@supabase/supabase-js'

export const db = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

// Supabase membatasi hasil select ke maksimal 1000 baris per query secara default.
// Tabel yang bisa tumbuh besar (riwayat, absensi, dst) diambil bertahap per halaman
// supaya data lama tidak diam-diam hilang saat baris sudah melewati 1000.
//
// kolomUrut boleh berupa satu kolom (string) atau beberapa kolom (array, urutan prioritas).
// Kalau cuma satu kolom dan ada baris dengan nilai yang sama (mis. nama produk kembar),
// urutan Postgres di antara baris yang sama itu TIDAK dijamin stabil — bisa berubah
// posisinya begitu salah satu baris di-UPDATE. Makanya tiap pemanggil sebaiknya sertakan
// kolom unik (kode/id) sebagai penentu urutan terakhir.
export async function ambilSemuaBaris(tabel, kolomUrut, menurun = false) {
  const semua = []
  const ukuranHalaman = 1000
  let dari = 0
  const kolomList = Array.isArray(kolomUrut) ? kolomUrut : [kolomUrut]
  for (;;) {
    let query = db.from(tabel).select('*')
    for (const kolom of kolomList) query = query.order(kolom, { ascending: true })
    const { data, error } = await query.range(dari, dari + ukuranHalaman - 1)
    if (error) throw error
    semua.push(...(data || []))
    if (!data || data.length < ukuranHalaman) break
    dari += ukuranHalaman
  }
  if (menurun) semua.reverse()
  return semua
}
