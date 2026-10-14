import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import LoadingSpinner from '../components/LoadingSpinner'
import Icon from '../components/Icon'
import { AREAS, companiesInArea } from '../lib/areas'
import { companyRowStyle } from '../lib/companyColors'

const EMPTY_FORM = { area: AREAS[0], companyId: '', categoryId: '', contactUserId: '' }
const CONTACT_ROLES = ['support', 'supervisor', 'superadmin']
// Role yang boleh dipilih sebagai penanggung jawab di form kontak.
const RESPONSIBLE_ROLES = ['support', 'supervisor']

function contactDisplayName(c) {
  return c.contact_user_id ? (c.linked_user?.full_name || c.contact_name || '') : (c.contact_name || '')
}

function contactWhatsapp(c) {
  return c.contact_user_id ? c.linked_user?.whatsapp_number || '' : ''
}

export default function SupportContacts() {
  const [contacts, setContacts] = useState([])
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [areaFilter, setAreaFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')

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
        .select(
          'id, company_id, category_id, contact_user_id, contact_name, companies(name), categories(name), linked_user:profiles(full_name, whatsapp_number)'
        ),
      supabase.from('companies').select('id, name, area').order('name'),
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
    // Hanya Support/Supervisor/Super Admin yang muncul di dropdown "Pilih
    // dari Pengguna Terdaftar" — merekalah yang berperan sebagai
    // penanggung jawab tiket, bukan Pelapor.
    setUsers(
      (userData || [])
        .filter((u) => CONTACT_ROLES.includes(u.role))
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
    )
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (companies.length && categories.length && !form.companyId) {
      const first = companiesInArea(companies, form.area)[0] || companies[0]
      setForm((f) => ({ ...f, area: first.area, companyId: first.id, categoryId: categories[0].id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, categories])

  // Daftar perusahaan untuk filter mengikuti area yang dipilih.
  const filterCompanies = areaFilter === 'all' ? companies : companiesInArea(companies, areaFilter)
  // Daftar perusahaan di form tambah mengikuti area yang dipilih di form.
  const formCompanies = companiesInArea(companies, form.area)

  const areaByCompanyId = useMemo(
    () => Object.fromEntries(companies.map((c) => [c.id, c.area])),
    [companies]
  )

  function changeAreaFilter(area) {
    setAreaFilter(area)
    // Perusahaan yang sedang difilter tapi bukan di area baru -> kembali ke "Semua".
    if (area !== 'all' && companyFilter !== 'all' && areaByCompanyId[companyFilter] !== area) {
      setCompanyFilter('all')
    }
  }

  // Penanggung jawab: hanya pengguna role Tim Support atau Supervisor yang
  // areanya sama dengan area terpilih. Yang belum punya area (belum diisi
  // di Administrasi Pengguna) tidak ditampilkan — dihitung terpisah untuk
  // peringatan.
  const supportUsers = useMemo(() => users.filter((u) => RESPONSIBLE_ROLES.includes(u.role)), [users])
  const formUsers = supportUsers.filter((u) => u.area === form.area)
  const supportWithoutArea = supportUsers.filter((u) => !u.area).length

  // Untuk baris yang sedang diedit: area mengikuti perusahaan kontak itu.
  // Pengguna yang saat ini tertaut (atau sedang dipilih) selalu tetap ada
  // di daftar supaya pilihannya tidak hilang.
  function usersForEdit(c) {
    const area = areaByCompanyId[c.company_id]
    return users.filter(
      (u) =>
        u.id === c.contact_user_id ||
        u.id === editForm.contactUserId ||
        (RESPONSIBLE_ROLES.includes(u.role) && u.area === area)
    )
  }

  function changeFormArea(area) {
    const first = companiesInArea(companies, area)[0]
    // Ganti area -> penanggung jawab dikosongkan (daftarnya ikut berubah).
    setForm((f) => ({ ...f, area, companyId: first ? first.id : '', contactUserId: '' }))
  }

  // Filter area & perusahaan, lalu urut Perusahaan → Kategori → Nama Kontak.
  const sortedContacts = useMemo(() => {
    let filtered = contacts
    if (areaFilter !== 'all') filtered = filtered.filter((c) => areaByCompanyId[c.company_id] === areaFilter)
    if (companyFilter !== 'all') filtered = filtered.filter((c) => c.company_id === companyFilter)
    return [...filtered].sort((a, b) => {
      const byCompany = (a.companies?.name || '').localeCompare(b.companies?.name || '')
      if (byCompany !== 0) return byCompany
      const byCategory = (a.categories?.name || '').localeCompare(b.categories?.name || '')
      if (byCategory !== 0) return byCategory
      return contactDisplayName(a).localeCompare(contactDisplayName(b))
    })
  }, [contacts, areaFilter, companyFilter, areaByCompanyId])

  async function handleAdd(e) {
    e.preventDefault()
    setAddError('')

    if (!form.contactUserId) {
      setAddError('Pilih pengguna dari daftar terlebih dahulu.')
      return
    }

    const selectedUser = users.find((u) => u.id === form.contactUserId)

    setAddLoading(true)
    const { error } = await supabase.from('support_contacts').insert({
      company_id: form.companyId,
      category_id: form.categoryId,
      contact_user_id: form.contactUserId,
      contact_name: selectedUser?.full_name || null,
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

    setForm((f) => ({ ...f, contactUserId: '' }))
    setShowAddForm(false)
    await load()
  }

  function startEdit(c) {
    setEditingId(c.id)
    setEditForm({
      companyId: c.company_id,
      categoryId: c.category_id,
      contactUserId: c.contact_user_id || '',
    })
    setRowError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setRowError('')
  }

  async function saveEdit(id) {
    if (!editForm.contactUserId) {
      setRowError('Pilih pengguna dari daftar terlebih dahulu.')
      return
    }
    const selectedUser = users.find((u) => u.id === editForm.contactUserId)
    setRowPendingId(id)
    setRowError('')
    const { error } = await supabase
      .from('support_contacts')
      .update({
        contact_user_id: editForm.contactUserId,
        contact_name: selectedUser?.full_name || null,
      })
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

  const unlinkedCount = useMemo(() => contacts.filter((c) => !c.contact_user_id).length, [contacts])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Kontak Support</h1>
          <p className="text-sm text-ink-light">
            Penanggung jawab WhatsApp per kombinasi perusahaan + kategori. Nomornya selalu
            diambil langsung dari data pengguna yang ditautkan.
          </p>
        </div>
        <button onClick={() => { setShowAddForm((v) => !v); setAddError('') }} className="btn-primary">
          {showAddForm ? 'Batal' : '+ Tambah Kontak'}
        </button>
      </div>

      {missingCombos > 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {missingCombos} kombinasi perusahaan+kategori belum punya kontak — untuk kombinasi itu,
          WhatsApp tidak akan terbuka otomatis (aksi utamanya tetap berhasil normal).
        </p>
      )}
      {unlinkedCount > 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {unlinkedCount} kontak belum ditautkan ke akun pengguna (mis. peninggalan data lama) —
          nomornya tidak akan ditemukan sampai ditautkan ulang lewat tombol Edit.
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          aria-label="Filter Area"
          className="input sm:max-w-[10rem]"
          value={areaFilter}
          onChange={(e) => changeAreaFilter(e.target.value)}
        >
          <option value="all">Semua Area</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          aria-label="Filter Perusahaan"
          className="input sm:max-w-xs"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <option value="all">
            {areaFilter === 'all' ? 'Semua Perusahaan' : `Semua Perusahaan di ${areaFilter}`}
          </option>
          {filterCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="card mb-6 space-y-4 p-6">
          <h2 className="font-display text-sm font-bold text-ink">Tambah Kontak</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="addArea">Area</label>
              <select
                id="addArea"
                className="input"
                value={form.area}
                onChange={(e) => changeFormArea(e.target.value)}
              >
                {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="addCompany">Perusahaan</label>
              <select
                id="addCompany"
                required
                className="input"
                value={form.companyId}
                onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
              >
                {formCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
            <div className="sm:col-span-3">
              <label className="label" htmlFor="addFromUser">Pengguna Penanggung Jawab</label>
              <select
                id="addFromUser"
                required
                className="input"
                value={form.contactUserId}
                onChange={(e) => setForm((f) => ({ ...f, contactUserId: e.target.value }))}
              >
                <option value="">
                  {formUsers.length === 0 ? `— Tidak ada Tim Support/Supervisor di area ${form.area} —` : '— Pilih pengguna —'}
                </option>
                {formUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                ))}
              </select>
              {form.contactUserId && (
                <p className="mt-1.5 text-xs">
                  Nomor WhatsApp:{' '}
                  {users.find((u) => u.id === form.contactUserId)?.whatsapp_number ? (
                    <span className="font-mono font-medium text-ink">
                      {users.find((u) => u.id === form.contactUserId).whatsapp_number}
                    </span>
                  ) : (
                    <span className="font-medium text-amber-700">
                      belum tercatat — lengkapi dulu lewat Administrasi Pengguna
                    </span>
                  )}
                </p>
              )}
              <p className="mt-1.5 text-xs text-ink-light">
                Hanya menampilkan pengguna dengan role Tim Support atau Supervisor di area {form.area}.
                Nomor WhatsApp yang dipakai untuk notifikasi selalu mengikuti data terkini di
                profil pengguna ini — kalau nomornya berubah nanti, otomatis ikut ter-update
                tanpa perlu diedit di sini.
              </p>
              {supportWithoutArea > 0 && (
                <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {supportWithoutArea} pengguna Tim Support/Supervisor belum punya area sehingga tidak muncul di
                  daftar ini — isi area-nya lewat Administrasi Pengguna &gt; Edit.
                </p>
              )}
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
      ) : sortedContacts.length === 0 ? (
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
                {sortedContacts.map((c) => {
                  const isEditing = editingId === c.id
                  const isPending = rowPendingId === c.id
                  return (
                    <tr
                      key={c.id}
                      style={companyRowStyle(c.companies?.name)}
                      className="hover:brightness-95"
                    >
                      <td className="px-5 py-3 text-ink">{c.companies?.name}</td>
                      <td className="px-5 py-3 text-ink-light">{c.categories?.name}</td>
                      <td className="px-5 py-3 text-ink">
                        {isEditing ? (
                          <select
                            className="input !py-1.5 !text-xs"
                            value={editForm.contactUserId}
                            onChange={(e) => setEditForm((f) => ({ ...f, contactUserId: e.target.value }))}
                          >
                            <option value="">— Pilih pengguna —</option>
                            {usersForEdit(c).map((u) => (
                              <option key={u.id} value={u.id}>{u.full_name}</option>
                            ))}
                          </select>
                        ) : c.contact_user_id ? (
                          <>
                            {contactDisplayName(c)}
                            <span className="ml-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
                              Tertaut
                            </span>
                          </>
                        ) : (
                          <>
                            {c.contact_name || <span className="text-ink-light">—</span>}
                            <span className="ml-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              Belum tertaut
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink-light">
                        {contactWhatsapp(c) || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(c.id)}
                                disabled={isPending}
                                className="btn-secondary !px-2.5 !py-1 text-xs inline-flex items-center gap-1.5"
                              >
                                <Icon name="save" />
                                {isPending ? 'Menyimpan...' : 'Simpan'}
                              </button>
                              <button onClick={cancelEdit} className="btn-ghost !px-2.5 !py-1 text-xs inline-flex items-center gap-1.5">
                                <Icon name="x" />
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
                              <button onClick={() => startEdit(c)} className="btn-ghost !px-2.5 !py-1 text-xs inline-flex items-center gap-1.5">
                                <Icon name="pencil" />
                                Edit
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(c.id)}
                                className="btn-ghost !px-2.5 !py-1 text-xs text-red-600 hover:bg-red-50 inline-flex items-center gap-1.5"
                              >
                                <Icon name="trash" />
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
