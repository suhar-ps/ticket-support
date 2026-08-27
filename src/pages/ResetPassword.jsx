import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Tautan reset dari email membuat Supabase otomatis membentuk sesi
    // pemulihan begitu halaman ini dimuat (dibaca dari token di URL).
    // Kita dengarkan event PASSWORD_RECOVERY, dan sebagai jaring
    // pengaman juga cek langsung apakah sesi sudah terbentuk.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
        setChecking(false)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      setChecking(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.')
      return
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    setTimeout(() => navigate('/'), 1500)
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <p className="text-sm text-ink-light">Memeriksa tautan reset...</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="card w-full max-w-sm p-6 text-center">
          <h1 className="font-display text-lg font-bold text-ink">Tautan Tidak Valid</h1>
          <p className="mt-2 text-sm text-ink-light">
            Tautan reset kata sandi ini tidak valid atau sudah kedaluwarsa. Minta tautan baru
            lewat halaman Lupa Kata Sandi.
          </p>
          <Link to="/forgot-password" className="btn-primary mt-5 inline-flex">
            Minta Tautan Baru
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="card w-full max-w-sm p-6 text-center">
          <h1 className="font-display text-lg font-bold text-ink">Kata Sandi Diperbarui</h1>
          <p className="mt-2 text-sm text-ink-light">Mengalihkan Anda ke aplikasi...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Atur Kata Sandi Baru</h1>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="password">Kata Sandi Baru</label>
            <input
              id="password"
              type="password"
              required
              className="input"
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="confirmPassword">Konfirmasi Kata Sandi</label>
            <input
              id="confirmPassword"
              type="password"
              required
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
          </button>
        </form>
      </div>
    </div>
  )
}
