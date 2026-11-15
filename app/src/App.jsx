import { useEffect, useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import { useUI } from './contexts/UIContext'
import { useRealtimeSync } from './hooks/useRealtimeSync'
import Login from './components/Login'
import ResetPassword from './components/ResetPassword'
import Dashboard from './pages/Dashboard'
import StaffPage from './pages/Staff'
import AbsensiPage from './pages/Absensi'
import StokPage from './pages/Stok'
import TransaksiPage from './pages/Transaksi'
import LaporanPage from './pages/Laporan'
import PopupPembaruan from './components/common/PopupPembaruan'
import { pembaruanBelumDilihat, semuaPembaruan, tandaiSudahDilihat } from './lib/pembaruan'
import { useVersiBaru } from './lib/versiBaru'

const TABS = [
  { key: 'home', label: 'Beranda', icon: '🏠' },
  { key: 'staff', label: 'Staff', icon: '👤' },
  { key: 'absensi', label: 'Absensi', icon: '📅' },
  { key: 'stok', label: 'Katalog', icon: '🗂️' },
  { key: 'transaksi', label: 'Transaksi', icon: '🛒' },
  { key: 'laporan', label: 'Laporan', icon: '💰' },
]

export default function App() {
  const { session, profil, recoveryMode } = useAuth()
  const [tab, setTab] = useState('home')
  const [popupPembaruan, setPopupPembaruan] = useState(null) // null = tertutup, [] = daftar entri
  const versiBaru = useVersiBaru()

  useRealtimeSync(!!session)

  // Begitu login & peran sudah diketahui: tampilkan pembaruan yang belum dilihat di HP ini.
  const peran = profil?.peran
  useEffect(() => {
    if (!session || !peran) return
    const baru = pembaruanBelumDilihat(peran)
    if (baru.length) setPopupPembaruan(baru)
    else tandaiSudahDilihat() // entri terbaru cuma buat peran lain → anggap sudah dilihat
  }, [session, peran])

  function tutupPembaruan() {
    tandaiSudahDilihat()
    setPopupPembaruan(null)
  }

  if (recoveryMode) {
    return <ResetPassword />
  }

  if (session === undefined || (session && profil === undefined)) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Memuat…</div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <AppHeader onBukaPembaruan={() => setPopupPembaruan(semuaPembaruan(peran))} />
        {versiBaru && (
          <button className="banner-versi-baru" onClick={() => window.location.reload()}>
            🔄 Versi baru tersedia — ketuk untuk muat ulang
          </button>
        )}
      </div>

      <main className="app-main">
        {tab === 'home' && <Dashboard onNavigate={setTab} />}
        {tab === 'staff' && <StaffPage />}
        {tab === 'absensi' && <AbsensiPage />}
        {tab === 'stok' && <StokPage />}
        {tab === 'transaksi' && <TransaksiPage />}
        {tab === 'laporan' && <LaporanPage />}
      </main>

      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            <span className="ic">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {popupPembaruan && <PopupPembaruan daftar={popupPembaruan} onClose={tutupPembaruan} />}
    </div>
  )
}

function AppHeader({ onBukaPembaruan }) {
  const { profil, logout } = useAuth()
  const { notify } = useUI()

  async function handleLogout() {
    await logout()
    notify('👋 Berhasil keluar')
  }

  return (
    <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>📦 BENGKEL MANAGER</span>
      <div className="row" style={{ flexWrap: 'nowrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'white', opacity: 0.9 }}>
          {profil?.peran === 'pemilik' ? '🔓' : '🔒'} {profil?.nama || '—'}
        </span>
        <button onClick={onBukaPembaruan} title="Apa yang baru" style={TOMBOL_HEADER}>
          📢
        </button>
        <button
          onClick={handleLogout}
          title="Keluar"
          style={TOMBOL_HEADER}
        >
          Keluar
        </button>
      </div>
    </header>
  )
}

const TOMBOL_HEADER = {
  background: 'rgba(255,255,255,0.15)',
  border: 'none',
  borderRadius: 8,
  color: 'white',
  padding: '6px 10px',
  fontSize: 13,
  cursor: 'pointer',
  minHeight: 'auto',
}
