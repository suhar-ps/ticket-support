import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    // Cukup '*' — profiles punya DUA foreign key ke companies
    // (company_id & default_company_id), jadi embed otomatis
    // "companies(...)" jadi ambigu bagi PostgREST ("more than one
    // relationship was found"). Tidak masalah, karena hasil embed itu
    // toh tidak dipakai di mana pun — nama perusahaan default diambil
    // terpisah (client-side) di halaman Laporan & Analitik.
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      // Ditangkap secara eksplisit (bukan diabaikan) agar UI bisa
      // menampilkan pesan yang jelas alih-alih macet di layar loading
      // tanpa penjelasan.
      console.error('Gagal memuat profil:', error.message)
      setProfileError(error.message)
      setProfile(null)
    } else {
      setProfileError('')
      setProfile(data)
    }
    return data
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return
      setSession(session)
      if (session) await fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) {
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [fetchProfile])

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = {
    session,
    user: session?.user || null,
    profile,
    profileError,
    loading,
    signOut,
    refreshProfile: () => session && fetchProfile(session.user.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
