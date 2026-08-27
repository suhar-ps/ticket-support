import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    // Hanya tampilkan pesan error untuk masalah server (5xx). Untuk hal
    // lain (termasuk "email tidak ditemukan"), tetap tampilkan pesan
    // sukses yang sama — supaya orang tidak bisa menebak email siapa
    // saja yang punya akun lewat halaman ini (praktik keamanan standar).
    if (resetError && resetError.status >= 500) {
      setError('Terjadi kesalahan pada server, silakan coba lagi.')
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-sm text-center">
          <div className="card p-6">
            <h1 className="font-display text-xl font-bold text-ink">Cek Email Anda</h1>
            <p className="mt-2 text-sm text-ink-light">
              Jika <strong>{email}</strong> terdaftar, kami sudah mengirim tautan untuk
              mengatur ulang kata sandi. Periksa juga folder spam bila belum muncul dalam
              beberapa menit.
            </p>
            <Link to="/login" className="btn-secondary mt-5 inline-flex">
              Kembali ke Halaman Masuk
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Lupa Kata Sandi</h1>
          <p className="mt-1 text-sm text-ink-light">
            Masukkan email akun Anda, kami akan kirimkan tautan untuk mengatur ulang kata
            sandi.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              className="input"
              placeholder="nama@perusahaan.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Mengirim...' : 'Kirim Tautan Reset'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-light">
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            ← Kembali ke Halaman Masuk
          </Link>
        </p>
      </div>
    </div>
  )
}
