import { useEffect, useState } from 'react'

// Deteksi versi baru yang sudah di-deploy selagi aplikasi masih terbuka di HP.
// Tiap build menulis dist/version.json berisi ID build (lihat vite.config.js); di sini ID itu
// dibandingkan dengan ID build yang sedang jalan (__BUILD_ID__).
const INTERVAL_CEK = 5 * 60 * 1000

async function cekVersi() {
  const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) return false
  const { build } = await res.json()
  return build && build !== __BUILD_ID__
}

export function useVersiBaru() {
  const [ada, setAda] = useState(false)

  useEffect(() => {
    if (!import.meta.env.PROD) return // di dev server nggak ada version.json
    let berhenti = false
    const cek = () =>
      cekVersi()
        .then((baru) => !berhenti && baru && setAda(true))
        .catch(() => {}) // offline — coba lagi nanti
    const saatTerlihat = () => document.visibilityState === 'visible' && cek()

    cek()
    const id = setInterval(cek, INTERVAL_CEK)
    document.addEventListener('visibilitychange', saatTerlihat)
    return () => {
      berhenti = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', saatTerlihat)
    }
  }, [])

  return ada
}
