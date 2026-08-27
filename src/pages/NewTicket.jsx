import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { ASSET_TYPES, PRIORITIES } from '../data/constants'

export default function NewTicket() {
  const { user } = useAuth()
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
    assetType: 'computer',
    assetIdentifier: '',
    location: '',
    priority: 'medium',
  })

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        setCategories(data || [])
        if (data?.length) setForm((f) => ({ ...f, categoryId: data[0].id }))
      })

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
    setLoading(true)

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

    setLoading(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="category">Kategori Masalah</label>
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
