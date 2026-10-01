import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { combinePhoneNumber, COUNTRY_CODES } from '../lib/whatsapp'

// Role awal SELALU 'user' — pendaftaran publik tidak pernah membuat
// akun Support/Supervisor. Kenaikan role hanya dilakukan oleh Super
// Admin lewat halaman Administrasi Pengguna (atau lewat SQL Editor
// untuk mengangkat Super Admin pertama kali).
const DEFAULT_ROLE = 'user'

export default function Register() {
  const [companies, setCompanies] = useState([])
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    defaultCompanyId: '',
    countryCode: COUNTRY_CODES[0].code,
    phoneNumber: '',
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
        if (data?.length) setForm((f) => ({ ...f, defaultCompanyId: data[0].id }))
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

    const whatsappNumber = combinePhoneNumber(form.countryCode, form.phoneNumber)
    if (!whatsappNumber) {
      setError('Nomor WhatsApp wajib diisi.')
      return
    }

    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        // Ditentukan EKSPLISIT di sini (bukan mengandalkan "Site URL" di
        // pengaturan Supabase) supaya tautan konfirmasi di email selalu
        // mengarah ke tempat aplikasi ini SEDANG benar-benar dibuka —
        // otomatis ke domain Netlify kalau didaftarkan dari situs live,
        // atau ke localhost kalau sedang diuji coba lokal. URL ini harus
        // ada di daftar "Redirect URLs" Supabase (Authentication > URL
        // Configuration) — lihat README.
        emailRedirectTo: `${window.location.origin}/login`,
        // Disimpan sebagai metadata di auth.users. Dibaca oleh trigger
        // database (handle_new_user) untuk membuat baris profil secara
        // otomatis, terlepas dari apakah sesi login sudah aktif atau
        // belum (mis. saat "Confirm email" masih diwajibkan).
        data: {
          full_name: form.fullName,
          role: DEFAULT_ROLE,
          default_company_id: form.defaultCompanyId || null,
          whatsapp_number: whatsappNumber,
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
          default_company_id: form.defaultCompanyId || null,
          whatsapp_number: whatsappNumber,
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

          <div>
            <label className="label">
              Nomor WhatsApp (untuk keperluan notifikasi progress update)
            </label>
            <div className="flex gap-2">
              <select
                aria-label="Kode Negara"
                className="input w-36 flex-none"
                value={form.countryCode}
                onChange={(e) => update('countryCode', e.target.value)}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <input
                aria-label="Nomor Telepon"
                required
                className="input flex-1"
                placeholder="cth. 081234567890"
                value={form.phoneNumber}
                onChange={(e) => update('phoneNumber', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="defaultCompany">Perusahaan Default</label>
            <select
              id="defaultCompany"
              className="input"
              value={form.defaultCompanyId}
              onChange={(e) => update('defaultCompanyId', e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-ink-light">
              Dipakai untuk mengisi otomatis pilihan perusahaan saat Anda membuat tiket —
              bisa diubah kapan pun nanti.
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
