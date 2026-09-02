import { createContext, useContext, useEffect, useState } from 'react'
import { db, SHOP_EMAIL } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = belum dicek, null = belum login

  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = db.auth.onAuthStateChange((_event, sess) => setSession(sess))
    return () => listener.subscription.unsubscribe()
  }, [])

  async function login(password) {
    const { error } = await db.auth.signInWithPassword({ email: SHOP_EMAIL, password })
    return error
  }

  async function logout() {
    await db.auth.signOut()
  }

  async function gantiSandi(sandiLama, sandiBaru) {
    const { error: errLama } = await db.auth.signInWithPassword({ email: SHOP_EMAIL, password: sandiLama })
    if (errLama) return { error: 'Sandi lama salah!' }
    const { error } = await db.auth.updateUser({ password: sandiBaru })
    if (error) return { error: error.message }
    return { error: null }
  }

  return (
    <AuthContext.Provider value={{ session, login, logout, gantiSandi }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}
