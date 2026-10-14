import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fetchVisibleCompaniesAndCategories } from '../lib/access'
import { PRIORITIES, labelFor } from '../data/constants'
import { companyCardStyle } from '../lib/companyColors'
import Icon from '../components/Icon'

// Warna tombol Prioritas sesuai tingkat urgensi (selaras dengan
// PriorityBadge): sebelum dipilih tampil berwarna lembut, saat dipilih
// berubah menjadi warna penuh.
const PRIORITY_BUTTON = {
  low: {
    idle: 'bg-gray-50 text-gray-600 ring-gray-300 hover:bg-gray-100',
    active: 'bg-gray-500 text-white ring-gray-500',
  },
  medium: {
    idle: 'bg-sky-50 text-sky-700 ring-sky-200 hover:bg-sky-100',
    active: 'bg-sky-600 text-white ring-sky-600',
  },
  high: {
    idle: 'bg-orange-50 text-orange-700 ring-orange-200 hover:bg-orange-100',
    active: 'bg-orange-500 text-white ring-orange-500',
  },
  urgent: {
    idle: 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100',
    active: 'bg-red-600 text-white ring-red-600',
  },
}

export default function NewTicket() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [companies, setCompanies] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    companyId: '',
    assetIdentifier: '',
    location: '',
    priority: 'medium',
  })

  useEffect(() => {
    // Hanya perusahaan & kategori yang boleh dilihat pengguna ini
    // (diatur Super Admin di Administrasi Pengguna) yang muncul di sini
    // — Super Admin sendiri melihat semua. Dibaca sekali saat halaman
    // dibuka; profil sudah pasti termuat di titik ini (dijamin Layout),
    // jadi tidak perlu jadi dependency efek ini (kalau iya, daftar akan
    // ter-fetch ulang dan mereset pilihan yang sudah dibuat pengguna).
    fetchVisibleCompaniesAndCategories(profile).then(({ companies: c, categories: cat }) => {
      setCompanies(c)
      setCategories(cat)
      setForm((f) => ({
        ...f,
        categoryId: cat.length ? cat[0].id : '',
        companyId: c.length
          ? (profile?.default_company_id && c.some((x) => x.id === profile.default_company_id)
              ? profile.default_company_id
              : c[0].id)
          : '',
      }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Buka tab kosong SEKARANG JUGA — langsung sebagai respons klik
    // pengguna (sinkron), bukan setelah proses async selesai. Kalau
    // ditunda sampai setelah await, browser modern akan menganggapnya
    // pop-up yang tidak diminta dan memblokirnya. Tab ini diarahkan ke
    // WhatsApp belakangan setelah tiket berhasil disimpan & nomor
    // kontak yang cocok ditemukan — atau ditutup lagi kalau tidak ada
    // kontak yang cocok.
    const waWindow = window.open('', '_blank')

    const { data, error: insertError } = await supabase
      .from('tickets')
      .insert({
        title: form.title,
        description: form.description,
        category_id: form.categoryId,
        company_id: form.companyId,
        asset_identifier: form.assetIdentifier || null,
        location: form.location || null,
        priority: form.priority,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      setLoading(false)
      setError(insertError.message)
      if (waWindow) waWindow.close()
      return
    }

    // Cari nomor WhatsApp kontak support yang cocok dengan perusahaan +
    // kategori tiket ini. Kalau tidak ada yang cocok (belum dikonfigurasi
    // Super Admin di menu Kontak Support), tab kosong tadi ditutup lagi
    // tanpa mengganggu — pembuatan tiket tetap dianggap berhasil.
    const { data: waNumber } = await supabase.rpc('get_support_whatsapp', {
      p_company_id: form.companyId,
      p_category_id: form.categoryId,
    })

    if (waNumber && waWindow) {
      const companyName = companies.find((c) => c.id === form.companyId)?.name || ''
      const message = [
        `*Tiket Baru: ${data.ticket_number}*`,
        `Judul: ${data.title}`,
        `Perusahaan: ${companyName}`,
        `Pelapor: ${profile?.full_name || '—'}`,
        `Prioritas: ${labelFor(PRIORITIES, data.priority)}`,
        '',
        'Deskripsi:',
        data.description,
        '',
        `Lihat detail: ${window.location.origin}/tickets/${data.id}`,
      ].join('\n')

      waWindow.location.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`
    } else if (waWindow) {
      waWindow.close()
    }

    setLoading(false)
    navigate(`/tickets/${data.id}`)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-ink">Buat Tiket Baru</h1>
      <p className="mb-6 text-sm text-ink-light">
        Jelaskan gangguan atau kebutuhan Anda selengkap mungkin agar tim support dapat menindaklanjuti dengan cepat.
      </p>

      <form
        onSubmit={handleSubmit}
        // Warna latar form mengikuti perusahaan yang sedang dipilih dan
        // berganti otomatis (dengan transisi halus) saat pilihan diganti.
        style={companyCardStyle(companies.find((c) => c.id === form.companyId)?.name)}
        className="card space-y-5 p-6 transition-colors duration-300"
      >
        <div>
          <label className="label" htmlFor="title">Judul Masalah</label>
          <input
            id="title"
            required
            className="input"
            placeholder="cth. Keran wastafel bocor"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="company">Perusahaan</label>
          {companies.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Anda belum memiliki akses ke perusahaan mana pun. Hubungi Super Admin.
            </p>
          ) : (
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
          )}
        </div>

        <div>
          <label className="label" htmlFor="category">Kategori Masalah</label>
          {categories.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Belum ada akses kategori.
            </p>
          ) : (
            <select
              id="category"
              className="input"
              value={form.categoryId}
              onChange={(e) => update('categoryId', e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Isian "ID Aset / Plat Nomor" disembunyikan; kolom asset_identifier tetap ada di database (dikirim null). */}
        <div>
          <label className="label" htmlFor="location">Lokasi</label>
          <input
            id="location"
            className="input"
            placeholder="cth. Lt. 5 - Ruang Marketing"
            value={form.location}
            onChange={(e) => update('location', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Prioritas</label>
          <div className="grid grid-cols-4 gap-2">
            {PRIORITIES.map((p) => (
              <button
                type="button"
                key={p.value}
                onClick={() => update('priority', p.value)}
                aria-pressed={form.priority === p.value}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold ring-1 ring-inset transition-colors ${
                  PRIORITY_BUTTON[p.value][form.priority === p.value ? 'active' : 'idle']
                }`}
              >
                {form.priority === p.value && <Icon name="check" className="h-4 w-4" />}
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="description">Deskripsi Lengkap</label>
          <textarea
            id="description"
            required
            rows={5}
            className="input resize-none"
            placeholder="Jelaskan kronologi masalah, kapan terjadi, dan dampaknya..."
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <p className="text-xs text-ink-light">
          Setelah tiket tersimpan, WhatsApp mungkin terbuka otomatis di tab baru dengan pesan
          sudah terisi ke kontak support terkait — tinggal periksa &amp; klik Kirim di sana.
        </p>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost inline-flex items-center gap-2">
            <Icon name="x" className="h-4 w-4" />
            Batal
          </button>
          <button type="submit" disabled={loading} className="btn-primary inline-flex items-center gap-2">
            <Icon name="send" className="h-4 w-4" />
            {loading ? 'Mengirim...' : 'Kirim Tiket'}
          </button>
        </div>
      </form>
    </div>
  )
}
