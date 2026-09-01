import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import LoadingSpinner from '../components/LoadingSpinner'
import { normalizeWhatsappNumber, WHATSAPP_FORMAT_HINT } from '../lib/whatsapp'

const EMPTY_FORM = { companyId: '', categoryId: '', contactName: '', whatsappNumber: '' }

export default function SupportContacts() {
  const [contacts, setContacts] = useState([])
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [rowPendingId, setRowPendingId] = useState(null)
  const [rowError, setRowError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  async function load() {
    setLoading(true)
    setListError('')
    const [{ data, error }, { data: companyData }, { data: categoryData }, { data: userData }] = await Promise.all([
      supabase
        .from('support_contacts')
        .select('id, company_id, category_id, contact_name, whatsapp_number, companies(name), categories(name)')
        .order('created_at', { ascending: false }),
      supabase.from('companies').select('id, name').order('name'),
      supabase.from('categories').select('id, name').order('name'),
      supabase.rpc('list_users_for_admin'),
    ])
    if (error) {
      setListError(error.message)
    } else {
      setContacts(data || [])
    }
    setCompanies(companyData || [])
    setCategories(categoryData || [])
    setUsers([...(userData || [])].sort((a, b) => a.full_name.localeCompare(b.full_name)))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (companies.length && categories.length && !form.companyId) {
      setForm((f) => ({ ...f, companyId: companies[0].id, categoryId: categories[0].id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, categories])

  function applyUserToForm(setter, userId) {
    if (!userId) return
    const u = users.find((x) => x.id === userId)
    if (!u) return
    setter((f) => ({ ...f, contactName: u.full_name, whatsappNumber: u.whatsapp_number || '' }))
  }

  async function handleAdd(e) {
    e.preventDefault()
    setAddError('')

    const number = normalizeWhatsappNumber(form.whatsappNumber)
    if (!number) {
      setAddError('Nomor WhatsApp wajib diisi.')
      return
    }

    setAddLoading(true)
    const { error } = await supabase.from('support_contacts').insert({
      company_id: form.companyId,
      category_id: form.categoryId,
      contact_name: form.contactName.trim() || null,
      whatsapp_number: number,
    })
    setAddLoading(false)

    if (error) {
      setAddError(
        error.code === '23505'
          ? 'Kombinasi perusahaan + kategori ini sudah punya kontak. Edit yang sudah ada saja.'
          : error.message
      )
      return
    }

    setForm((f) => ({ ...f, contactName: '', whatsappNumber: '' }))
    setShowAddForm(false)
    await load()
  }

  function startEdit(c) {
    setEditingId(c.id)
    setEditForm({
      companyId: c.company_id,
      categoryId: c.category_id,
      contactName: c.contact_name || '',
      whatsappNumber: c.whatsapp_number,
    })
    setRowError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setRowError('')
  }

  async function saveEdit(id) {
    const number = normalizeWhatsappNumber(editForm.whatsappNumber)
    if (!number) {
      setRowError('Nomor WhatsApp wajib diisi.')
      return
    }
    setRowPendingId(id)
    setRowError('')
    const { error } = await supabase
      .from('support_contacts')
      .update({ contact_name: editForm.contactName.trim() || null, whatsapp_number: number })
      .eq('id', id)
    setRowPendingId(null)
    if (error) {
      setRowError(error.message)
      return
    }
    setEditingId(null)
    await load()
  }

  async function handleDelete(id) {
    setRowPendingId(id)
    setRowError('')
    const { error } = await supabase.from('support_contacts').delete().eq('id', id)
    setRowPendingId(null)
    setConfirmDeleteId(null)
    if (error) {
      setRowError(error.message)
      return
    }
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }

  const missingCombos = useMemo(() => {
    const existing = new Set(contacts.map((c) => `${c.company_id}:${c.category_id}`))
    let count = 0
    for (const co of companies) {
      for (const ca of categories) {
        if (!existing.has(`${co.id}:${ca.id}`)) count += 1
      }
    }
    return count
  }, [contacts, companies, categories])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Kontak Support</h1>
          <p className="text-sm text-ink-light">
            Nomor WhatsApp penanggung jawab per kombinasi perusahaan + kategori. Dipakai untuk
            mengisi otomatis pesan WhatsApp saat pelapor menyimpan tiket baru.
          </p>
        </div>
        <button onClick={() => { setShowAddForm((v) => !v); setAddError('') }} className="btn-primary">
          {showAddForm ? 'Batal' : '+ Tambah Kontak'}
        </button>
      </div>

      {missingCombos > 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {missingCombos} kombinasi perusahaan+kategori belum punya kontak — untuk kombinasi itu,
          WhatsApp tidak akan terbuka otomatis saat tiket dibuat (pembuatan tiket tetap berhasil
          normal).
        </p>
      )}

      {showAddForm && (
        <form onSubmit={handleAdd} className="card mb-6 space-y-4 p-6">
          <h2 className="font-display text-sm font-bold text-ink">Tambah Kontak</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="addCompany">Perusahaan</label>
              <select
                id="addCompany"
                className="input"
                value={form.companyId}
                onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
              >
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="addCategory">Kategori</label>
              <select
                id="addCategory"
                className="input"
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              >
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="addFromUser">Pilih dari Pengguna Terdaftar (opsional)</label>
              <select
                id="addFromUser"
                className="input"
                value=""
                onChange={(e) => applyUserToForm(setForm, e.target.value)}
              >
                <option value="">— Ketik manual, atau pilih pengguna di sini —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-ink-light">
                Memilih pengguna otomatis mengisi Nama Kontak & Nomor WhatsApp di bawah sesuai
                data pengguna tsb — tetap bisa diubah manual setelahnya.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="addName">Nama Kontak (opsional)</label>
              <input
                id="addName"
                className="input"
                placeholder="cth. Pak Budi - IT Support"
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="addNumber">Nomor WhatsApp</label>
              <input
                id="addNumber"
                className="input"
                placeholder="cth. 6281234567890"
                value={form.whatsappNumber}
                onChange={(e) => setForm((f) => ({ ...f, whatsappNumber: e.target.value }))}
              />
              <p className="mt-1.5 text-xs text-ink-light">{WHATSAPP_FORMAT_HINT}</p>
            </div>
          </div>

          {addError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</p>}

          <div className="flex justify-end">
            <button type="submit" disabled={addLoading} className="btn-primary">
              {addLoading ? 'Menyimpan...' : 'Simpan Kontak'}
            </button>
          </div>
        </form>
      )}

      {listError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{listError}</p>}
      {rowError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{rowError}</p>}

      {loading ? (
        <LoadingSpinner label="Memuat kontak support..." />
      ) : contacts.length === 0 ? (
        <div className="card p-10 text-center text-ink-light">Belum ada kontak support.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-50/60 text-xs uppercase tracking-wide text-ink-light">
                <tr>
                  <th className="px-5 py-3 font-semibold">Perusahaan</th>
                  <th className="px-5 py-3 font-semibold">Kategori</th>
                  <th className="px-5 py-3 font-semibold">Nama Kontak</th>
                  <th className="px-5 py-3 font-semibold">No. WhatsApp</th>
                  <th className="px-5 py-3 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contacts.map((c) => {
                  const isEditing = editingId === c.id
                  const isPending = rowPendingId === c.id
                  return (
                    <tr key={c.id} className="hover:bg-brand-50/30">
                      <td className="px-5 py-3 text-ink">{c.companies?.name}</td>
                      <td className="px-5 py-3 text-ink-light">{c.categories?.name}</td>
                      <td className="px-5 py-3 text-ink">
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <select
                              className="input !py-1.5 !text-xs"
                              value=""
                              onChange={(e) => applyUserToForm(setEditForm, e.target.value)}
                            >
                              <option value="">— Isi dari pengguna terdaftar —</option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>{u.full_name}</option>
                              ))}
                            </select>
                            <input
                              className="input !py-1.5 !text-sm"
                              value={editForm.contactName}
                              onChange={(e) => setEditForm((f) => ({ ...f, contactName: e.target.value }))}
                            />
                          </div>
                        ) : (
                          c.contact_name || <span className="text-ink-light">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink">
                        {isEditing ? (
                          <input
                            className="input !py-1.5 !text-sm"
                            value={editForm.whatsappNumber}
                            onChange={(e) => setEditForm((f) => ({ ...f, whatsappNumber: e.target.value }))}
                          />
                        ) : (
                          c.whatsapp_number
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(c.id)}
                                disabled={isPending}
                                className="btn-secondary !px-2.5 !py-1 text-xs"
                              >
                                {isPending ? 'Menyimpan...' : 'Simpan'}
                              </button>
                              <button onClick={cancelEdit} className="btn-ghost !px-2.5 !py-1 text-xs">
                                Batal
                              </button>
                            </>
                          ) : confirmDeleteId === c.id ? (
                            <>
                              <span className="text-xs text-ink-light">Yakin hapus?</span>
                              <button
                                onClick={() => handleDelete(c.id)}
                                disabled={isPending}
                                className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
                              >
                                {isPending ? 'Menghapus...' : 'Ya, Hapus'}
                              </button>
                              <button onClick={() => setConfirmDeleteId(null)} className="btn-ghost !px-2.5 !py-1 text-xs">
                                Batal
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(c)} className="btn-ghost !px-2.5 !py-1 text-xs">
                                Edit
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(c.id)}
                                className="btn-ghost !px-2.5 !py-1 text-xs text-red-600 hover:bg-red-50"
                              >
                                Hapus
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
