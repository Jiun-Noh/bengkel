import { createClient } from '@supabase/supabase-js'

export const SHOP_EMAIL = import.meta.env.VITE_SHOP_EMAIL

export const db = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

// Supabase membatasi hasil select ke maksimal 1000 baris per query secara default.
// Tabel yang bisa tumbuh besar (riwayat, absensi, dst) diambil bertahap per halaman
// supaya data lama tidak diam-diam hilang saat baris sudah melewati 1000.
export async function ambilSemuaBaris(tabel, kolomUrut, menurun = false) {
  const semua = []
  const ukuranHalaman = 1000
  let dari = 0
  for (;;) {
    const { data, error } = await db
      .from(tabel)
      .select('*')
      .order(kolomUrut, { ascending: true })
      .range(dari, dari + ukuranHalaman - 1)
    if (error) throw error
    semua.push(...(data || []))
    if (!data || data.length < ukuranHalaman) break
    dari += ukuranHalaman
  }
  if (menurun) semua.reverse()
  return semua
}
