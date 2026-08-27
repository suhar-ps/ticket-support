import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { ROLE_LABELS } from '../data/constants'

export default function Register() {
  const [companies, setCompanies] = useState([])
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    companyId: '',
    role: 'user',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('companies')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        setCompanies(data || [])
        if (data?.length) setForm((f) => ({ ...f, companyId: data[0].id }))
      })
  }, [])

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
    })

    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }

    const userId = data.user?.id
    if (!userId) {
      setLoading(false)
      setError('Pendaftaran berhasil, tetapi perlu verifikasi email sebelum bisa masuk.')
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      full_name: form.fullName,
      role: form.role,
      company_id: form.companyId,
    })

    setLoading(false)

    if (profileError) {
      setError('Akun dibuat, namun gagal menyimpan profil: ' + profileError.message)
      return
    }

    if (data.session) {
      navigate('/')
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Buat Akun Baru</h1>
          <p className="mt-1 text-sm text-ink-light">Daftarkan diri Anda ke TiketPro</p>
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

          <div>
            <label className="label" htmlFor="company">Perusahaan</label>
            <select
              id="company"
              className="input"
              value={form.companyId}
              onChange={(e) => update('companyId', e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Peran</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => update('role', value)}
                  className={`rounded-lg px-2 py-2.5 text-xs font-semibold ring-1 ring-inset transition-colors ${
                    form.role === value
                      ? 'bg-brand-600 text-white ring-brand-600'
                      : 'bg-white text-ink-light ring-gray-200 hover:bg-brand-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink-light">
              Untuk demo, peran dapat dipilih sendiri. Di lingkungan produksi, sebaiknya peran
              &quot;Support&quot; dan &quot;Supervisor&quot; hanya diberikan oleh admin melalui
              Supabase Dashboard.
            </p>
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
