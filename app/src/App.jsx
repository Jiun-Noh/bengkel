import { useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import { useRealtimeSync } from './hooks/useRealtimeSync'
import Login from './components/Login'
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
  { key: 'stok', label: 'Stok', icon: '📦' },
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
    <div>
      <header className="app-header">📦 BENGKEL MANAGER</header>

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
  )
}
