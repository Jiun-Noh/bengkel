import { createContext, useContext, useState } from 'react'
import { usePengaturanQuery } from '../hooks/usePengaturan'

const OwnerModeContext = createContext(null)
const STORAGE_KEY = 'ownerModeUnlocked'

// Mode Pemilik — pintu gerbang UI ringan (bukan RLS sungguhan) untuk sembunyikan
// tombol ubah/hapus dari layar karyawan. Pakai kata sandi yang sama dengan Laporan,
// supaya pemilik cukup ingat satu kata sandi untuk semua area sensitif.
export function OwnerModeProvider({ children }) {
  const { data: pengaturan } = usePengaturanQuery(true)
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(STORAGE_KEY) === '1')

  function unlock(password) {
    const sandi = pengaturan?.kataSandiLaporan || '1234'
    if (password !== sandi) return false
    setUnlocked(true)
    sessionStorage.setItem(STORAGE_KEY, '1')
    return true
  }

  function lock() {
    setUnlocked(false)
    sessionStorage.removeItem(STORAGE_KEY)
  }

  return <OwnerModeContext.Provider value={{ unlocked, unlock, lock }}>{children}</OwnerModeContext.Provider>
}

export function useOwnerMode() {
  const ctx = useContext(OwnerModeContext)
  if (!ctx) throw new Error('useOwnerMode harus dipakai di dalam OwnerModeProvider')
  return ctx
}
