import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [sandi, setSandi] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await login(sandi)
    setLoading(false)
    if (err) {
      setError('Kata sandi salah, atau tidak ada koneksi internet!')
      setSandi('')
    }
  }

  return (
    <div className="login-screen">
      <form className="login-box" onSubmit={submit}>
        <h2>🔐 Masuk Aplikasi Bengkel</h2>
        <div className="field" style={{ textAlign: 'left', marginTop: 16 }}>
          <input
            type="password"
            placeholder="Masukkan Kata Sandi"
            value={sandi}
            onChange={(e) => setSandi(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 8 }}>❌ {error}</p>}
        <button className="btn btn-block" type="submit" disabled={loading}>
          {loading ? 'Menghubungkan...' : 'MASUK'}
        </button>
        <p className="hint">Kata sandi = kata sandi akun toko yang dibuat di Supabase</p>
      </form>
    </div>
  )
}
