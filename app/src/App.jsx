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
  // Sub-tab Katalog yang dibuka (mis. tombol 🛒 Catat Pembelian di Laporan → langsung ke Pembelian)
  const [katalogAwal, setKatalogAwal] = useState('barang')
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
        {tab === 'stok' && <StokPage awal={katalogAwal} />}
        {tab === 'transaksi' && <TransaksiPage />}
        {tab === 'laporan' && (
          <LaporanPage
            onBukaPembelian={() => {
              setKatalogAwal('pembelian')
              setTab('stok')
              window.scrollTo(0, 0)
            }}
          />
        )}
      </main>

      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => { setKatalogAwal('barang'); setTab(t.key) }}>
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
  const { notify, confirm } = useUI()

  async function handleLogout() {
    // Tombolnya sekarang cuma ikon → gampang kepencet, jadi tanya dulu
    if (!(await confirm('Keluar dari aplikasi?'))) return
    await logout()
    notify('👋 Berhasil keluar')
  }

  return (
    <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>📦 BENGKEL MANAGER</span>
      <div className="row" style={{ flexWrap: 'nowrap', gap: 8, alignItems: 'center' }}>
        <span
          style={{ fontSize: 13, color: 'white', opacity: 0.9, minWidth: 0, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={profil?.nama || ''}
        >
          {profil?.peran === 'pemilik' ? '🔓' : '🔒'} {profil?.nama || '—'}
        </span>
        <button onClick={onBukaPembaruan} title="Apa yang baru" aria-label="Apa yang baru" style={TOMBOL_HEADER}>
          📢
        </button>
        <button onClick={handleLogout} title="Keluar" aria-label="Keluar" style={TOMBOL_HEADER}>
          {/* ikon "keluar" (pintu + panah) */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  )
}

// Tombol ikon kotak ukuran tetap — nggak ikut menyusut waktu header sempit (dulu teks "Keluar" sampai keluar dari tombol)
const TOMBOL_HEADER = {
  background: 'rgba(255,255,255,0.15)',
  border: 'none',
  borderRadius: 8,
  color: 'white',
  width: 34,
  height: 34,
  padding: 0,
  fontSize: 16,
  cursor: 'pointer',
  minHeight: 'auto',
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}
