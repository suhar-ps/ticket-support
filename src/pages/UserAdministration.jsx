import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import Icon from '../components/Icon'
import { ROLE_LABELS, formatDateTime } from '../data/constants'
import { combinePhoneNumber, COUNTRY_CODES, normalizeWhatsappNumber, WHATSAPP_FORMAT_HINT } from '../lib/whatsapp'
import { AREAS, companiesInArea } from '../lib/areas'

const ROLE_ORDER = ['user', 'support', 'supervisor', 'superadmin']
const EMPTY_NEW_USER = {
  fullName: '',
  email: '',
  password: '',
  role: 'user',
  area: '',
  defaultCompanyId: '',
  countryCode: COUNTRY_CODES[0].code,
  phoneNumber: '',
}

function describeFunctionError(message) {
  if (!message) return ''
  if (message.includes('Failed to fetch') || message.includes('not found') || message.includes('404')) {
    return 'Edge Function terkait belum ter-deploy di project Supabase Anda. Lihat README bagian deploy Edge Function.'
  }
  return message
}

export default function UserAdministration() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [areaFilter, setAreaFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [listError, setListError] = useState('')

  // Tambah pengguna
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUser, setNewUser] = useState(EMPTY_NEW_USER)
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // Aksi per baris: hanya satu baris & satu mode yang aktif sekaligus,
  // supaya tidak ada dua form terbuka bersamaan.
  const [activeId, setActiveId] = useState(null)
  const [activeMode, setActiveMode] = useState(null) // 'edit' | 'password' | 'delete' | 'access'
  const [editValue, setEditValue] = useState('')
  const [editWhatsapp, setEditWhatsapp] = useState('')
  const [editRole, setEditRole] = useState('user')
  const [editArea, setEditArea] = useState('')
  const [editCompanyId, setEditCompanyId] = useState('')
  const [passwordValue, setPasswordValue] = useState('')
  const [companyIdsDraft, setCompanyIdsDraft] = useState([])
  const [categoryIdsDraft, setCategoryIdsDraft] = useState([])
  const [rowPendingId, setRowPendingId] = useState(null)
  const [rowError, setRowError] = useState('')
  const [successId, setSuccessId] = useState(null)

  async function load() {
    setLoading(true)
    setListError('')
    const [{ data, error }, { data: companyData, error: companyError }, { data: categoryData }] = await Promise.all([
      supabase.rpc('list_users_for_admin'),
      supabase.from('companies').select('id, name, area').order('name'),
      supabase.from('categories').select('id, name').order('name'),
    ])
    if (error) {
      setListError(error.message)
    } else {
      setUsers(data || [])
      // Database belum diperbarui: fungsi lama tidak mengembalikan kolom
      // area, sehingga Area & Perusahaan akan selalu tampak kosong.
      if (data?.length && !('area' in data[0])) {
        setListError(
          'Database belum diperbarui untuk fitur Area — jalankan supabase/add_area.sql di SQL Editor Supabase, lalu muat ulang halaman ini.'
        )
      }
    }
    if (companyError) {
      setListError(
        'Daftar perusahaan gagal dimuat (kolom area belum ada?) — jalankan supabase/add_area.sql di SQL Editor Supabase. ' +
          companyError.message
      )
    }
    setCompanies(companyData || [])
    setCategories(categoryData || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let list = users
    if (roleFilter !== 'all') {
      list = list.filter((u) => u.role === roleFilter)
    }
    if (areaFilter !== 'all') {
      list = list.filter((u) => u.area === areaFilter)
    }
    if (companyFilter !== 'all') {
      list = list.filter((u) => u.default_company_id === companyFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (u) => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      )
    }
    return list
  }, [users, roleFilter, areaFilter, companyFilter, search])

  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      let result
      if (sortField === 'full_name') {
        result = (a.full_name || '').localeCompare(b.full_name || '')
      } else {
        result = new Date(a.created_at) - new Date(b.created_at)
      }
      return sortDir === 'asc' ? result : -result
    })
    return list
  }, [filtered, sortField, sortDir])

  function handleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      // Nama: default A-Z saat pertama kali dipilih. Terdaftar: default
      // terbaru dulu saat pertama kali dipilih.
      setSortDir(field === 'full_name' ? 'asc' : 'desc')
    }
  }

  function sortIndicator(field) {
    if (sortField !== field) return null
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  const counts = ROLE_ORDER.reduce((acc, r) => {
    acc[r] = users.filter((u) => u.role === r).length
    return acc
  }, {})

  function flashSuccess(id) {
    setSuccessId(id)
    setTimeout(() => setSuccessId((cur) => (cur === id ? null : cur)), 2500)
  }

  function resetRowState() {
    setActiveId(null)
    setActiveMode(null)
    setEditValue('')
    setEditWhatsapp('')
    setEditRole('user')
    setEditArea('')
    setEditCompanyId('')
    setPasswordValue('')
    setCompanyIdsDraft([])
    setCategoryIdsDraft([])
    setRowError('')
  }

  // ---- Tambah pengguna (lewat Edge Function, butuh hak admin GoTrue) ----
  async function handleAddUser(e) {
    e.preventDefault()
    setAddError('')

    if (newUser.password.length < 6) {
      setAddError('Kata sandi minimal 6 karakter.')
      return
    }

    const whatsappNumber = combinePhoneNumber(newUser.countryCode, newUser.phoneNumber)
    if (!whatsappNumber) {
      setAddError('Nomor WhatsApp wajib diisi.')
      return
    }

    setAddLoading(true)
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: newUser.email,
        password: newUser.password,
        full_name: newUser.fullName,
        role: newUser.role,
        whatsapp_number: whatsappNumber,
        area: newUser.area || null,
        default_company_id: newUser.defaultCompanyId || null,
      },
    })

    const message = error?.message || data?.error
    if (message) {
      setAddLoading(false)
      setAddError(describeFunctionError(message))
      return
    }

    // Akun sudah dibuat. Area & perusahaan disimpan LAGI di sini lewat
    // fungsi database, tidak bergantung pada versi Edge Function atau
    // trigger yang sedang aktif di Supabase — jadi pasti tersimpan.
    let followUpError = ''
    const newUserId = data?.user?.id
    if (newUserId && (newUser.area || newUser.defaultCompanyId)) {
      const { error: profileErr } = await supabase.rpc('admin_update_profile', {
        target_user_id: newUserId,
        new_full_name: newUser.fullName.trim(),
        new_whatsapp_number: whatsappNumber,
        new_area: newUser.area || null,
        new_default_company_id: newUser.defaultCompanyId || null,
      })
      if (profileErr) {
        followUpError = profileErr.message
      } else {
        // Akses perusahaan awal: perusahaan yang dipilih saja, atau semua
        // perusahaan di area yang dipilih kalau perusahaan tidak dipilih.
        const accessIds = newUser.defaultCompanyId
          ? [newUser.defaultCompanyId]
          : companiesInArea(companies, newUser.area).map((c) => c.id)
        const { error: accessErr } = await supabase.rpc('admin_set_user_companies', {
          target_user_id: newUserId,
          company_ids: accessIds,
        })
        if (accessErr) followUpError = accessErr.message
      }
    }
    setAddLoading(false)

    setNewUser(EMPTY_NEW_USER)
    setShowAddForm(false)
    if (followUpError) {
      setRowError(
        `Akun berhasil dibuat, tetapi area/perusahaan belum tersimpan: ${followUpError}. Isi lewat tombol Edit.`
      )
    }
    await load()
  }

  // ---- Edit nama, WhatsApp, role, area & perusahaan ----
  function startEdit(u) {
    setActiveId(u.id)
    setActiveMode('edit')
    setEditValue(u.full_name)
    setEditWhatsapp(u.whatsapp_number || '')
    setEditRole(u.role)
    setEditArea(u.area || '')
    setEditCompanyId(u.default_company_id || '')
    setRowError('')
  }

  async function saveEdit(targetId) {
    if (!editValue.trim()) {
      setRowError('Nama lengkap tidak boleh kosong.')
      return
    }
    const current = users.find((u) => u.id === targetId)
    setRowPendingId(targetId)
    setRowError('')
    const normalizedWhatsapp = normalizeWhatsappNumber(editWhatsapp)

    const { error } = await supabase.rpc('admin_update_profile', {
      target_user_id: targetId,
      new_full_name: editValue.trim(),
      new_whatsapp_number: normalizedWhatsapp || null,
      new_area: editArea || null,
      new_default_company_id: editCompanyId || null,
    })
    if (error) {
      setRowPendingId(null)
      setRowError(error.message)
      return
    }

    // Profil sudah tersimpan -> perbarui tampilan dulu, lalu urus role
    // (RPC terpisah). Kalau role gagal, data profil tetap tercatat dan
    // pesan error role ditampilkan.
    const profilePatch = {
      full_name: editValue.trim(),
      whatsapp_number: normalizedWhatsapp || null,
      area: editArea || null,
      default_company_id: editCompanyId || null,
      // Server menambahkan perusahaan default baru ke akses pengguna.
      company_ids:
        editCompanyId && !(current?.company_ids || []).includes(editCompanyId)
          ? [...(current?.company_ids || []), editCompanyId]
          : current?.company_ids,
    }

    let roleError = null
    if (current && editRole !== current.role) {
      const { error: err } = await supabase.rpc('set_user_role', {
        target_user_id: targetId,
        new_role: editRole,
      })
      roleError = err
      if (!err) profilePatch.role = editRole
    }

    setRowPendingId(null)
    setUsers((prev) => prev.map((u) => (u.id === targetId ? { ...u, ...profilePatch } : u)))

    if (roleError) {
      setRowError(`Data tersimpan, tetapi role gagal diubah: ${roleError.message}`)
      return
    }
    resetRowState()
    flashSuccess(targetId)
  }

  // ---- Ganti password (lewat Edge Function, butuh hak admin GoTrue) ----
  function startPasswordEdit(u) {
    setActiveId(u.id)
    setActiveMode('password')
    setPasswordValue('')
    setRowError('')
  }

  async function savePassword(targetId) {
    if (passwordValue.length < 6) {
      setRowError('Kata sandi minimal 6 karakter.')
      return
    }
    setRowPendingId(targetId)
    setRowError('')
    const { data, error } = await supabase.functions.invoke('admin-set-password', {
      body: { target_user_id: targetId, new_password: passwordValue },
    })
    setRowPendingId(null)

    const message = error?.message || data?.error
    if (message) {
      setRowError(describeFunctionError(message))
      return
    }

    resetRowState()
    flashSuccess(targetId)
  }

  // ---- Kelola akses perusahaan & kategori ----
  function startAccessEdit(u) {
    setActiveId(u.id)
    setActiveMode('access')
    setCompanyIdsDraft(u.company_ids || [])
    setCategoryIdsDraft(u.category_ids || [])
    setRowError('')
  }

  function toggleDraftId(draft, setDraft, id) {
    setDraft(draft.includes(id) ? draft.filter((x) => x !== id) : [...draft, id])
  }

  async function saveAccess(targetId) {
    setRowPendingId(targetId)
    setRowError('')

    const [{ error: companiesError }, { error: categoriesError }] = await Promise.all([
      supabase.rpc('admin_set_user_companies', { target_user_id: targetId, company_ids: companyIdsDraft }),
      supabase.rpc('admin_set_user_categories', { target_user_id: targetId, category_ids: categoryIdsDraft }),
    ])

    setRowPendingId(null)

    const err = companiesError || categoriesError
    if (err) {
      setRowError(err.message)
      return
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === targetId ? { ...u, company_ids: companyIdsDraft, category_ids: categoryIdsDraft } : u
      )
    )
    resetRowState()
    flashSuccess(targetId)
  }

  // ---- Hapus pengguna ----
  function startDeleteConfirm(u) {
    setActiveId(u.id)
    setActiveMode('delete')
    setRowError('')
  }

  async function handleDelete(targetId) {
    setRowPendingId(targetId)
    setRowError('')
    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: targetId })
    setRowPendingId(null)
    if (error) {
      setRowError(error.message)
      return
    }
    setUsers((prev) => prev.filter((u) => u.id !== targetId))
    resetRowState()
  }

  const companyNameById = useMemo(
    () => Object.fromEntries(companies.map((c) => [c.id, c.name])),
    [companies]
  )
  // Pilihan perusahaan di filter mengikuti area yang dipilih di filter.
  const filterCompanies = areaFilter === 'all' ? companies : companiesInArea(companies, areaFilter)
  function changeAreaFilter(area) {
    setAreaFilter(area)
    // Perusahaan yang sedang difilter tapi bukan di area baru -> kembali ke "Semua".
    if (area !== 'all' && companyFilter !== 'all') {
      const co = companies.find((c) => c.id === companyFilter)
      if (!co || co.area !== area) setCompanyFilter('all')
    }
  }
  const newUserCompanies = companiesInArea(companies, newUser.area)
  const editCompanies = companiesInArea(companies, editArea)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Administrasi Pengguna</h1>
          <p className="text-sm text-ink-light">
            Tambah, ubah, atau hapus akun pengguna. Perubahan role berlaku penuh setelah
            pengguna terkait logout &amp; login kembali.
          </p>
        </div>
        <button onClick={() => { setShowAddForm((v) => !v); setAddError('') }} className="btn-primary">
          {showAddForm ? 'Batal' : '+ Tambah Pengguna'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddUser} className="card mb-6 space-y-4 p-6">
          <h2 className="font-display text-sm font-bold text-ink">Tambah Pengguna Baru</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="newFullName">Nama Lengkap</label>
              <input
                id="newFullName"
                required
                className="input"
                value={newUser.fullName}
                onChange={(e) => setNewUser((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="newEmail">Email</label>
              <input
                id="newEmail"
                type="email"
                required
                className="input"
                value={newUser.email}
                onChange={(e) => setNewUser((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="newPassword">Kata Sandi Awal</label>
              <input
                id="newPassword"
                type="password"
                required
                className="input"
                placeholder="Minimal 6 karakter"
                value={newUser.password}
                onChange={(e) => setNewUser((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="newRole">Role</label>
              <select
                id="newRole"
                className="input"
                value={newUser.role}
                onChange={(e) => setNewUser((f) => ({ ...f, role: e.target.value }))}
              >
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="newArea">Area</label>
              <select
                id="newArea"
                className="input"
                value={newUser.area}
                onChange={(e) => setNewUser((f) => ({ ...f, area: e.target.value, defaultCompanyId: '' }))}
              >
                <option value="">Tidak diatur (semua perusahaan)</option>
                {AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="newCompany">Perusahaan Default</label>
              <select
                id="newCompany"
                className="input"
                disabled={!newUser.area}
                value={newUser.defaultCompanyId}
                onChange={(e) => setNewUser((f) => ({ ...f, defaultCompanyId: e.target.value }))}
              >
                <option value="">
                  {newUser.area ? `Semua perusahaan di ${newUser.area}` : 'Pilih area terlebih dahulu'}
                </option>
                {newUserCompanies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Nomor WhatsApp (untuk keperluan notifikasi progress update)</label>
              <div className="flex gap-2">
                <select
                  aria-label="Kode Negara"
                  className="input w-36 flex-none"
                  value={newUser.countryCode}
                  onChange={(e) => setNewUser((f) => ({ ...f, countryCode: e.target.value }))}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <input
                  aria-label="Nomor Telepon"
                  required
                  className="input flex-1"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="cth. 081234567890 (hanya angka)"
                  value={newUser.phoneNumber}
                  onChange={(e) =>
                    setNewUser((f) => ({ ...f, phoneNumber: normalizeWhatsappNumber(e.target.value) }))
                  }
                />
              </div>
            </div>
          </div>

          <p className="text-xs text-ink-light">{WHATSAPP_FORMAT_HINT}</p>

          {addError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</p>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={addLoading} className="btn-primary">
              {addLoading ? 'Membuat akun...' : 'Buat Akun'}
            </button>
          </div>
        </form>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ROLE_ORDER.map((r) => (
          <div key={r} className="card p-4">
            <p className="text-xs font-medium text-ink-light">{ROLE_LABELS[r]}</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-ink">{counts[r] || 0}</p>
          </div>
        ))}
      </div>

      <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
        <input
          className="input sm:max-w-xs"
          placeholder="Cari nama atau email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input sm:max-w-[10rem]"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="all">Semua Role</option>
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <select
          aria-label="Filter Area"
          className="input sm:max-w-[10rem]"
          value={areaFilter}
          onChange={(e) => changeAreaFilter(e.target.value)}
        >
          <option value="all">Semua Area</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
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
          {filterCompanies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {listError && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{listError}</p>
      )}
      {rowError && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{rowError}</p>
      )}

      {loading ? (
        <LoadingSpinner label="Memuat daftar pengguna..." />
      ) : sorted.length === 0 ? (
        <div className="card p-10 text-center text-ink-light">Tidak ada pengguna yang cocok.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-50/60 text-xs uppercase tracking-wide text-ink-light">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => handleSort('full_name')}
                      className="font-semibold uppercase tracking-wide hover:text-ink"
                    >
                      Nama{sortIndicator('full_name')}
                    </button>
                    <span className="ml-1 font-normal normal-case tracking-normal">/ Email</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">WhatsApp</th>
                  <th className="px-4 py-3 font-semibold">Area / Perusahaan</th>
                  <th className="px-4 py-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => handleSort('created_at')}
                      className="font-semibold uppercase tracking-wide hover:text-ink"
                    >
                      Terdaftar{sortIndicator('created_at')}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((u) => {
                  const isSelf = u.id === user.id
                  const isPending = rowPendingId === u.id
                  const isActive = activeId === u.id

                  return (
                    <Fragment key={u.id}>
                    <tr className={isActive && (activeMode === 'edit' || activeMode === 'password') ? 'bg-brand-50/30' : 'hover:bg-brand-50/30'}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">
                          {u.full_name}
                          {isSelf && (
                            <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
                              Anda
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-ink-light">{u.email}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-light">
                        {u.whatsapp_number || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {u.area || u.default_company_id ? (
                          <>
                            <div className="text-ink">{u.area || '—'}</div>
                            <div className="text-xs text-ink-light">
                              {companyNameById[u.default_company_id] || 'Semua perusahaan di area'}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-light">{formatDateTime(u.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className="whitespace-nowrap rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isActive && (activeMode === 'edit' || activeMode === 'password') ? (
                          <span className="text-xs text-ink-light">
                            {activeMode === 'edit' ? 'Sedang diedit…' : 'Ganti password…'}
                          </span>
                        ) : isActive && activeMode === 'delete' ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-ink-light">Yakin hapus?</span>
                            <button
                              onClick={() => handleDelete(u.id)}
                              disabled={isPending}
                              className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
                            >
                              {isPending ? 'Menghapus...' : 'Ya, Hapus'}
                            </button>
                            <button onClick={resetRowState} className="btn-ghost !px-2.5 !py-1 text-xs">
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button onClick={() => startEdit(u)} className="btn-ghost !px-2.5 !py-1 text-xs inline-flex items-center gap-1.5">
                              <Icon name="pencil" />
                              Edit
                            </button>
                            <button onClick={() => startPasswordEdit(u)} className="btn-ghost !px-2.5 !py-1 text-xs inline-flex items-center gap-1.5">
                              <Icon name="key" />
                              Ganti Password
                            </button>
                            <button onClick={() => startAccessEdit(u)} className="btn-ghost !px-2.5 !py-1 text-xs inline-flex items-center gap-1.5">
                              <Icon name="shield-check" />
                              Kelola Akses
                            </button>
                            <button
                              onClick={() => startDeleteConfirm(u)}
                              disabled={isSelf}
                              className="btn-ghost !px-2.5 !py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 inline-flex items-center gap-1.5"
                            >
                              <Icon name="trash" />
                              Hapus
                            </button>
                            {successId === u.id && (
                              <span className="text-xs font-medium text-emerald-600">Tersimpan ✓</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    {isActive && activeMode === 'edit' && (
                      <tr className="bg-brand-50/30">
                        <td colSpan={6} className="px-4 pb-4 pt-1">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label className="label">Nama Lengkap</label>
                              <input
                                className="input"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                autoFocus
                              />
                            </div>
                            <div>
                              <label className="label">Nomor WhatsApp</label>
                              <input
                                className="input font-mono"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="6281234567890 (hanya angka)"
                                value={editWhatsapp}
                                onChange={(e) => setEditWhatsapp(normalizeWhatsappNumber(e.target.value))}
                              />
                              <p className="mt-1.5 text-xs text-ink-light">
                                Hanya angka — tanpa spasi, tanda “+”, strip, atau karakter lain.
                              </p>
                            </div>
                            <div>
                              <label className="label">Area</label>
                              <select
                                className="input"
                                value={editArea}
                                onChange={(e) => { setEditArea(e.target.value); setEditCompanyId('') }}
                              >
                                <option value="">Tidak diatur</option>
                                {AREAS.map((a) => (
                                  <option key={a} value={a}>{a}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label">Perusahaan Default</label>
                              <select
                                className="input"
                                disabled={!editArea}
                                value={editCompanyId}
                                onChange={(e) => setEditCompanyId(e.target.value)}
                              >
                                <option value="">
                                  {editArea ? `Semua perusahaan di ${editArea}` : 'Pilih area terlebih dahulu'}
                                </option>
                                {editCompanies.map((c) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label">Role</label>
                              <select
                                className="input"
                                value={editRole}
                                disabled={isSelf}
                                onChange={(e) => setEditRole(e.target.value)}
                              >
                                {ROLE_ORDER.map((r) => (
                                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                ))}
                              </select>
                              {isSelf ? (
                                <p className="mt-1.5 text-xs text-ink-light">
                                  Role akun Anda sendiri tidak bisa diubah di sini.
                                </p>
                              ) : editRole !== u.role ? (
                                <p className="mt-1.5 text-xs text-amber-700">
                                  Berlaku penuh setelah pengguna logout &amp; login kembali.
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-4 flex justify-end gap-2">
                            <button
                              onClick={() => saveEdit(u.id)}
                              disabled={isPending}
                              className="btn-secondary !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5"
                            >
                              <Icon name="save" />
                              {isPending ? 'Menyimpan...' : 'Simpan'}
                            </button>
                            <button onClick={resetRowState} className="btn-ghost !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5">
                              <Icon name="x" />
                              Batal
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {isActive && activeMode === 'password' && (
                      <tr className="bg-brand-50/30">
                        <td colSpan={6} className="px-4 pb-4 pt-1">
                          <div className="max-w-sm">
                            <label className="label">Kata Sandi Baru</label>
                            <input
                              type="password"
                              className="input"
                              placeholder="Minimal 6 karakter"
                              value={passwordValue}
                              onChange={(e) => setPasswordValue(e.target.value)}
                              autoFocus
                            />
                          </div>
                          <div className="mt-4 flex justify-end gap-2">
                            <button
                              onClick={() => savePassword(u.id)}
                              disabled={isPending}
                              className="btn-secondary !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5"
                            >
                              <Icon name="save" />
                              {isPending ? 'Menyimpan...' : 'Simpan'}
                            </button>
                            <button onClick={resetRowState} className="btn-ghost !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5">
                              <Icon name="x" />
                              Batal
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {isActive && activeMode === 'access' && (
                      <tr className="bg-brand-50/30">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
                            <div>
                              <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs font-semibold text-ink">Akses Perusahaan</p>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setCompanyIdsDraft(companies.map((c) => c.id))}
                                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                                  >
                                    Pilih Semua
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCompanyIdsDraft([])}
                                    className="text-xs font-medium text-ink-light hover:text-ink"
                                  >
                                    Kosongkan
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-4">
                                {AREAS.map((area) => {
                                  const areaList = companiesInArea(companies, area)
                                  if (areaList.length === 0) return null
                                  const areaIds = areaList.map((c) => c.id)
                                  return (
                                    <div key={area}>
                                      <div className="mb-1.5 flex items-center justify-between border-b border-gray-200 pb-1">
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-light">{area}</p>
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setCompanyIdsDraft((d) => [...new Set([...d, ...areaIds])])}
                                            className="text-[11px] font-medium text-brand-600 hover:text-brand-700"
                                          >
                                            Pilih area
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setCompanyIdsDraft((d) => d.filter((id) => !areaIds.includes(id)))}
                                            className="text-[11px] font-medium text-ink-light hover:text-ink"
                                          >
                                            Kosongkan
                                          </button>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-1 gap-1.5">
                                        {areaList.map((c) => (
                                          <label key={c.id} className="flex items-center gap-2 text-sm text-ink">
                                            <input
                                              type="checkbox"
                                              checked={companyIdsDraft.includes(c.id)}
                                              onChange={() => toggleDraftId(companyIdsDraft, setCompanyIdsDraft, c.id)}
                                              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                            />
                                            {c.name}
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>

                            <div className="border-t border-gray-200 pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                              <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs font-semibold text-ink">Akses Kategori</p>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setCategoryIdsDraft(categories.map((c) => c.id))}
                                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                                  >
                                    Pilih Semua
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCategoryIdsDraft([])}
                                    className="text-xs font-medium text-ink-light hover:text-ink"
                                  >
                                    Kosongkan
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                {categories.map((c) => (
                                  <label key={c.id} className="flex items-center gap-2 text-sm text-ink">
                                    <input
                                      type="checkbox"
                                      checked={categoryIdsDraft.includes(c.id)}
                                      onChange={() => toggleDraftId(categoryIdsDraft, setCategoryIdsDraft, c.id)}
                                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                    />
                                    {c.name}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>

                          {(companyIdsDraft.length === 0 || categoryIdsDraft.length === 0) && (
                            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                              {companyIdsDraft.length === 0 && categoryIdsDraft.length === 0
                                ? 'Tidak ada perusahaan maupun kategori terpilih — pengguna ini tidak akan melihat tiket apa pun.'
                                : companyIdsDraft.length === 0
                                ? 'Tidak ada perusahaan terpilih — pengguna ini tidak akan melihat tiket apa pun.'
                                : 'Tidak ada kategori terpilih — pengguna ini tidak akan melihat tiket apa pun.'}
                            </p>
                          )}

                          <div className="mt-4 flex justify-end gap-2">
                            <button
                              onClick={() => saveAccess(u.id)}
                              disabled={isPending}
                              className="btn-secondary !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5"
                            >
                              <Icon name="save" />
                              {isPending ? 'Menyimpan...' : 'Simpan Akses'}
                            </button>
                            <button onClick={resetRowState} className="btn-ghost !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5">
                              <Icon name="x" />
                              Batal
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
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
