import { useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import { OwnerModeProvider, useOwnerMode } from './contexts/OwnerModeContext'
import { useUI } from './contexts/UIContext'
import { useRealtimeSync } from './hooks/useRealtimeSync'
import Login from './components/Login'
import Modal from './components/common/Modal'
import Dashboard from './pages/Dashboard'
import StaffPage from './pages/Staff'
import AbsensiPage from './pages/Absensi'
import StokPage from './pages/Stok'
import TransaksiPage from './pages/Transaksi'
import LaporanPage from './pages/Laporan'

const TABS = [
  { key: 'home', label: 'Beranda', icon: '🏠' },
  { key: 'staff', label: 'Staff', icon: '👤' },
  { key: 'absensi', label: 'Absensi', icon: '📅' },
  { key: 'stok', label: 'Katalog', icon: '🗂️' },
  { key: 'transaksi', label: 'Transaksi', icon: '🛒' },
  { key: 'laporan', label: 'Laporan', icon: '💰' },
]

export default function App() {
  const { session } = useAuth()
  const [tab, setTab] = useState('home')

  useRealtimeSync(!!session)

  if (session === undefined) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Memuat…</div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <OwnerModeProvider>
      <div>
        <AppHeader />

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
      </div>
    </OwnerModeProvider>
  )
}

function AppHeader() {
  const { unlocked, unlock, lock } = useOwnerMode()
  const { notify } = useUI()
  const [modalOpen, setModalOpen] = useState(false)
  const [sandi, setSandi] = useState('')

  function submit(e) {
    e.preventDefault()
    if (unlock(sandi)) {
      notify('🔓 Mode Pemilik aktif')
      setSandi('')
      setModalOpen(false)
    } else {
      notify('❌ Kata sandi salah!', 'error')
      setSandi('')
    }
  }

  function toggle() {
    if (unlocked) {
      lock()
      notify('🔒 Mode Pemilik dimatikan')
    } else {
      setModalOpen(true)
    }
  }

  return (
    <>
      <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>📦 BENGKEL MANAGER</span>
        <button
          onClick={toggle}
          title={unlocked ? 'Mode Pemilik aktif — klik untuk kunci' : 'Klik untuk buka Mode Pemilik'}
          style={{
            background: unlocked ? 'rgba(39,174,96,0.25)' : 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            padding: '6px 10px',
            fontSize: 13,
            cursor: 'pointer',
            minHeight: 'auto',
          }}
        >
          {unlocked ? '🔓 Pemilik' : '🔒 Karyawan'}
        </button>
      </header>

      {modalOpen && (
        <Modal title="🔓 Buka Mode Pemilik" onClose={() => setModalOpen(false)} maxWidth={340}>
          <form onSubmit={submit}>
            <div className="field">
              <label>Kata Sandi Pemilik</label>
              <input
                type="password"
                value={sandi}
                onChange={(e) => setSandi(e.target.value)}
                placeholder="Sama dengan kata sandi Laporan"
                autoFocus
              />
            </div>
            <button className="btn btn-block" type="submit">
              Buka
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}
