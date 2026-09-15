import { createContext, useContext, useEffect, useState } from 'react'
import { db } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = belum dicek, null = belum login
  const [profil, setProfil] = useState(undefined) // undefined = belum dicek, null = tidak ada profil
  const [recoveryMode, setRecoveryMode] = useState(false) // true = user baru klik link reset kata sandi

  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = db.auth.onAuthStateChange((event, sess) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      setSession(sess)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) {
      setProfil(null)
      return
    }
    db.from('profil').select('*').eq('id', session.user.id).single().then(({ data }) => {
      setProfil(
        data
          ? { nama: data.nama, peran: data.peran, staffKode: data.staff_kode }
          : null,
      )
    })
  }, [session])

  async function login(email, password) {
    const { error } = await db.auth.signInWithPassword({ email, password })
    return error
  }

  async function logout() {
    await db.auth.signOut()
  }

  async function gantiSandiSendiri(sandiBaru) {
    const { error } = await db.auth.updateUser({ password: sandiBaru })
    return error ? { error: error.message } : { error: null }
  }

  async function resetPasswordForEmail(email) {
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    return error
  }

  function selesaiRecovery() {
    setRecoveryMode(false)
  }

  return (
    <AuthContext.Provider
      value={{ session, profil, recoveryMode, login, logout, gantiSandiSendiri, resetPasswordForEmail, selesaiRecovery }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}
