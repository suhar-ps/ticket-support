import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import { ROLE_LABELS, formatDateTime } from '../data/constants'

const ROLE_ORDER = ['user', 'support', 'supervisor', 'superadmin']
const EMPTY_NEW_USER = { fullName: '', email: '', password: '', role: 'user' }

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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [listError, setListError] = useState('')

  // Tambah pengguna
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUser, setNewUser] = useState(EMPTY_NEW_USER)
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // Aksi per baris: hanya satu baris & satu mode yang aktif sekaligus,
  // supaya tidak ada dua form terbuka bersamaan.
  const [activeId, setActiveId] = useState(null)
  const [activeMode, setActiveMode] = useState(null) // 'edit' | 'password' | 'delete'
  const [editValue, setEditValue] = useState('')
  const [passwordValue, setPasswordValue] = useState('')
  const [rowPendingId, setRowPendingId] = useState(null)
  const [rowError, setRowError] = useState('')
  const [successId, setSuccessId] = useState(null)

  async function load() {
    setLoading(true)
    setListError('')
    const { data, error } = await supabase.rpc('list_users_for_admin')
    if (error) {
      setListError(error.message)
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    )
  }, [users, search])

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
    setPasswordValue('')
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

    setAddLoading(true)
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: newUser.email,
        password: newUser.password,
        full_name: newUser.fullName,
        role: newUser.role,
      },
    })
    setAddLoading(false)

    const message = error?.message || data?.error
    if (message) {
      setAddError(describeFunctionError(message))
      return
    }

    setNewUser(EMPTY_NEW_USER)
    setShowAddForm(false)
    await load()
  }

  // ---- Ubah role ----
  async function handleRoleChange(targetId, newRole) {
    setRowPendingId(targetId)
    setRowError('')
    const { error } = await supabase.rpc('set_user_role', {
      target_user_id: targetId,
      new_role: newRole,
    })
    setRowPendingId(null)
    if (error) {
      setRowError(error.message)
      return
    }
    setUsers((prev) => prev.map((u) => (u.id === targetId ? { ...u, role: newRole } : u)))
    flashSuccess(targetId)
  }

  // ---- Edit nama ----
  function startEdit(u) {
    setActiveId(u.id)
    setActiveMode('edit')
    setEditValue(u.full_name)
    setRowError('')
  }

  async function saveEdit(targetId) {
    if (!editValue.trim()) {
      setRowError('Nama lengkap tidak boleh kosong.')
      return
    }
    setRowPendingId(targetId)
    setRowError('')
    const { error } = await supabase.rpc('admin_update_profile', {
      target_user_id: targetId,
      new_full_name: editValue.trim(),
    })
    setRowPendingId(null)
    if (error) {
      setRowError(error.message)
      return
    }
    setUsers((prev) => prev.map((u) => (u.id === targetId ? { ...u, full_name: editValue.trim() } : u)))
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
          </div>

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

      <div className="card mb-5 p-4">
        <input
          className="input sm:max-w-xs"
          placeholder="Cari nama atau email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {listError && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{listError}</p>
      )}
      {rowError && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{rowError}</p>
      )}

      {loading ? (
        <LoadingSpinner label="Memuat daftar pengguna..." />
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-ink-light">Tidak ada pengguna yang cocok.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-50/60 text-xs uppercase tracking-wide text-ink-light">
                <tr>
                  <th className="px-5 py-3 font-semibold">Nama</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Terdaftar</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => {
                  const isSelf = u.id === user.id
                  const isPending = rowPendingId === u.id
                  const isActive = activeId === u.id

                  return (
                    <tr key={u.id} className="hover:bg-brand-50/30">
                      <td className="px-5 py-3 font-medium text-ink">
                        {isActive && activeMode === 'edit' ? (
                          <input
                            className="input !py-1.5 !text-sm"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <>
                            {u.full_name}
                            {isSelf && (
                              <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
                                Anda
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink-light">{u.email}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-light">{formatDateTime(u.created_at)}</td>
                      <td className="px-5 py-3">
                        <select
                          className="input !py-1.5 !text-xs sm:max-w-[9rem]"
                          value={u.role}
                          disabled={isPending}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          {ROLE_ORDER.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        {isActive && activeMode === 'password' ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="password"
                              className="input !py-1.5 !text-sm sm:max-w-[10rem]"
                              placeholder="Kata sandi baru"
                              value={passwordValue}
                              onChange={(e) => setPasswordValue(e.target.value)}
                              autoFocus
                            />
                            <button
                              onClick={() => savePassword(u.id)}
                              disabled={isPending}
                              className="btn-secondary !px-2.5 !py-1 text-xs"
                            >
                              {isPending ? 'Menyimpan...' : 'Simpan'}
                            </button>
                            <button onClick={resetRowState} className="btn-ghost !px-2.5 !py-1 text-xs">
                              Batal
                            </button>
                          </div>
                        ) : isActive && activeMode === 'edit' ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => saveEdit(u.id)}
                              disabled={isPending}
                              className="btn-secondary !px-2.5 !py-1 text-xs"
                            >
                              {isPending ? 'Menyimpan...' : 'Simpan'}
                            </button>
                            <button onClick={resetRowState} className="btn-ghost !px-2.5 !py-1 text-xs">
                              Batal
                            </button>
                          </div>
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
                          <div className="flex flex-wrap items-center gap-2">
                            <button onClick={() => startEdit(u)} className="btn-ghost !px-2.5 !py-1 text-xs">
                              Edit
                            </button>
                            <button onClick={() => startPasswordEdit(u)} className="btn-ghost !px-2.5 !py-1 text-xs">
                              Ganti Password
                            </button>
                            <button
                              onClick={() => startDeleteConfirm(u)}
                              disabled={isSelf}
                              className="btn-ghost !px-2.5 !py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                            >
                              Hapus
                            </button>
                            {successId === u.id && (
                              <span className="text-xs font-medium text-emerald-600">Tersimpan ✓</span>
                            )}
                          </div>
                        )}
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
