import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

// Role awal SELALU 'user' — pendaftaran publik tidak pernah membuat
// akun Support/Supervisor. Kenaikan role hanya dilakukan oleh
// Supervisor lewat halaman Administrasi Pengguna (atau lewat SQL Editor
// untuk mengangkat Supervisor pertama kali).
const DEFAULT_ROLE = 'user'

export default function Register() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.password.length < 6) {
      setError('Kata sandi minimal 6 karakter.')
      return
    }

    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        // Disimpan sebagai metadata di auth.users. Dibaca oleh trigger
        // database (handle_new_user) untuk membuat baris profil secara
        // otomatis, terlepas dari apakah sesi login sudah aktif atau
        // belum (mis. saat "Confirm email" masih diwajibkan).
        data: {
          full_name: form.fullName,
          role: DEFAULT_ROLE,
        },
      },
    })

    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }

    const userId = data.user?.id
    if (!userId) {
      setLoading(false)
      setError('Pendaftaran gagal, silakan coba lagi.')
      return
    }

    // Jika sesi langsung aktif (email confirmation nonaktif), samakan
    // data profil sebagai jaring pengaman — trigger di database sudah
    // membuat baris ini, upsert di sini hanya memastikan datanya sesuai
    // dengan yang baru saja diisi di form.
    if (data.session) {
      await supabase.from('profiles').upsert(
        {
          id: userId,
          full_name: form.fullName,
          role: DEFAULT_ROLE,
        },
        { onConflict: 'id' }
      )
    }

    setLoading(false)

    if (data.session) {
      navigate('/')
    } else {
      setError('')
      alert('Pendaftaran berhasil. Silakan cek email Anda untuk verifikasi sebelum masuk.')
      navigate('/login')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Buat Akun Baru</h1>
          <p className="mt-1 text-sm text-ink-light">Daftarkan diri Anda ke FixHub</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="fullName">Nama Lengkap</label>
            <input
              id="fullName"
              required
              className="input"
              placeholder="cth. Budi Santoso"
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              className="input"
              placeholder="nama@perusahaan.com"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="password">Kata Sandi</label>
            <input
              id="password"
              type="password"
              required
              className="input"
              placeholder="Minimal 6 karakter"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Memproses...' : 'Daftar'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-light">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  )
}
