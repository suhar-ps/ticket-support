import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fetchVisibleCompaniesAndCategories } from '../lib/access'
import { ASSET_TYPES, PRIORITIES, labelFor } from '../data/constants'

export default function NewTicket() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [companies, setCompanies] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingDefault, setSavingDefault] = useState(false)
  const [defaultSaved, setDefaultSaved] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    companyId: '',
    assetType: 'computer',
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
    // ter-fetch ulang dan mereset pilihan setiap kali tombol "Jadikan
    // Default" ditekan).
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

  async function handleSaveDefaultCompany() {
    if (!form.companyId) return
    setSavingDefault(true)
    const { error: saveError } = await supabase
      .from('profiles')
      .update({ default_company_id: form.companyId })
      .eq('id', user.id)
    setSavingDefault(false)
    if (!saveError) {
      await refreshProfile()
      setDefaultSaved(true)
      setTimeout(() => setDefaultSaved(false), 2500)
    }
  }

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
        asset_type: form.assetType,
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

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        <div>
          <label className="label" htmlFor="title">Judul Masalah</label>
          <input
            id="title"
            required
            className="input"
            placeholder="cth. Laptop tidak bisa menyala"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="company">Perusahaan</label>
            <button
              type="button"
              onClick={handleSaveDefaultCompany}
              disabled={savingDefault || !form.companyId}
              className="mb-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-40"
              title="Jadikan perusahaan yang dipilih sebagai default setiap kali membuat tiket baru"
            >
              {savingDefault ? 'Menyimpan...' : defaultSaved ? 'Tersimpan ✓' : 'Jadikan Default'}
            </button>
          </div>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <div>
            <label className="label" htmlFor="assetType">Jenis Aset</label>
            <select
              id="assetType"
              className="input"
              value={form.assetType}
              onChange={(e) => update('assetType', e.target.value)}
            >
              {ASSET_TYPES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="assetId">ID Aset / Plat Nomor (opsional)</label>
            <input
              id="assetId"
              className="input"
              placeholder="cth. PC-MKT-05 / B 1234 XY"
              value={form.assetIdentifier}
              onChange={(e) => update('assetIdentifier', e.target.value)}
            />
          </div>
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
        </div>

        <div>
          <label className="label">Prioritas</label>
          <div className="grid grid-cols-4 gap-2">
            {PRIORITIES.map((p) => (
              <button
                type="button"
                key={p.value}
                onClick={() => update('priority', p.value)}
                className={`rounded-lg px-2 py-2.5 text-xs font-semibold ring-1 ring-inset transition-colors ${
                  form.priority === p.value
                    ? 'bg-brand-600 text-white ring-brand-600'
                    : 'bg-white text-ink-light ring-gray-200 hover:bg-brand-50'
                }`}
              >
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
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost">
            Batal
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Mengirim...' : 'Kirim Tiket'}
          </button>
        </div>
      </form>
    </div>
  )
}
