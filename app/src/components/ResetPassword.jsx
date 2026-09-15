import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUI } from '../contexts/UIContext'

export default function ResetPassword() {
  const { gantiSandiSendiri, selesaiRecovery, logout } = useAuth()
  const { notify } = useUI()
  const [sandi, setSandi] = useState('')
  const [ulang, setUlang] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!sandi || sandi.length < 6) {
      setError('Kata sandi minimal 6 karakter!')
      return
    }
    if (sandi !== ulang) {
      setError('Kata sandi tidak cocok!')
      return
    }
    setLoading(true)
    const { error: err } = await gantiSandiSendiri(sandi)
    setLoading(false)
    if (err) {
      setError(err)
      return
    }
    notify('✅ Kata sandi berhasil diganti! Silakan masuk lagi.')
    await logout()
    selesaiRecovery()
  }

  return (
    <div className="login-screen">
      <form className="login-box" onSubmit={submit}>
        <h2>🔑 Atur Kata Sandi Baru</h2>
        <div className="field" style={{ textAlign: 'left', marginTop: 16 }}>
          <input
            type="password"
            placeholder="Kata Sandi Baru"
            value={sandi}
            onChange={(e) => setSandi(e.target.value)}
            autoFocus
          />
        </div>
        <div className="field" style={{ textAlign: 'left' }}>
          <input
            type="password"
            placeholder="Ulangi Kata Sandi Baru"
            value={ulang}
            onChange={(e) => setUlang(e.target.value)}
          />
        </div>
        {error && <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 8 }}>❌ {error}</p>}
        <button className="btn btn-block" type="submit" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan Kata Sandi'}
        </button>
      </form>
    </div>
  )
}
