import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { login, resetPasswordForEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [lupaSandi, setLupaSandi] = useState(false)
  const [emailReset, setEmailReset] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetPesan, setResetPesan] = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await login(email.trim(), sandi)
    setLoading(false)
    if (err) {
      setError('Email/kata sandi salah, atau tidak ada koneksi internet!')
      setSandi('')
    }
  }

  async function submitReset(e) {
    e.preventDefault()
    setResetLoading(true)
    setResetPesan('')
    const err = await resetPasswordForEmail(emailReset.trim())
    setResetLoading(false)
    setResetPesan(
      err ? '❌ Gagal mengirim email, coba lagi.' : '✅ Cek email Anda untuk link reset kata sandi.',
    )
  }

  if (lupaSandi) {
    return (
      <div className="login-screen">
        <form className="login-box" onSubmit={submitReset}>
          <h2>🔑 Lupa Kata Sandi</h2>
          <div className="field" style={{ textAlign: 'left', marginTop: 16 }}>
            <input
              type="email"
              placeholder="Email"
              value={emailReset}
              onChange={(e) => setEmailReset(e.target.value)}
              autoFocus
            />
          </div>
          {resetPesan && <p style={{ fontSize: 13, marginBottom: 8 }}>{resetPesan}</p>}
          <button className="btn btn-block" type="submit" disabled={resetLoading}>
            {resetLoading ? 'Mengirim...' : 'Kirim Link Reset'}
          </button>
          <p className="hint" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setLupaSandi(false); setResetPesan('') }}>
            ← Kembali ke halaman masuk
          </p>
        </form>
      </div>
    )
  }

  return (
    <div className="login-screen">
      <form className="login-box" onSubmit={submit}>
        <h2>🔐 Masuk Aplikasi Bengkel</h2>
        <div className="field" style={{ textAlign: 'left', marginTop: 16 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>
        <div className="field" style={{ textAlign: 'left' }}>
          <input
            type="password"
            placeholder="Kata Sandi"
            value={sandi}
            onChange={(e) => setSandi(e.target.value)}
          />
        </div>
        {error && <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 8 }}>❌ {error}</p>}
        <button className="btn btn-block" type="submit" disabled={loading}>
          {loading ? 'Menghubungkan...' : 'MASUK'}
        </button>
        <p className="hint" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setLupaSandi(true)}>
          Lupa kata sandi?
        </p>
        <p className="hint">Pakai akun masing-masing (email pribadi yang sudah didaftarkan)</p>
      </form>
    </div>
  )
}
