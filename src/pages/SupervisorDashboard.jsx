import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx-js-style'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fetchVisibleCompaniesAndCategories } from '../lib/access'
import LoadingSpinner from '../components/LoadingSpinner'
import StatusBadge from '../components/StatusBadge'
import PriorityBadge from '../components/PriorityBadge'
import { STATUSES, PRIORITIES, formatDateTime, labelFor } from '../data/constants'

const STATUS_COLORS = {
  open: '#3B82F6',
  in_progress: '#D97706',
  pending: '#7C3AED',
  resolved: '#059669',
  closed: '#9CA3AF',
}

// Format Date -> "YYYY-MM-DD" memakai komponen tanggal LOKAL (bukan
// toISOString, yang mengonversi ke UTC dan bisa menggeser tanggal
// mundur/maju tergantung zona waktu perangkat, mis. WIB).
function toDateInputValue(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultDateRange() {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: toDateInputValue(firstOfMonth), to: toDateInputValue(now) }
}

// Waktu pengerjaan (jam): dari created_at sampai resolved_at kalau
// tiket sudah Selesai/Ditutup (berhenti menghitung, angkanya tetap),
// atau sampai SAAT INI kalau masih berjalan (terus bertambah selama
// halaman dibuka/dimuat ulang).
function calculateWorkHours(ticket) {
  const start = new Date(ticket.created_at)
  const isDone = ['resolved', 'closed'].includes(ticket.status)
  const end = isDone && ticket.resolved_at ? new Date(ticket.resolved_at) : new Date()
  return (end - start) / 36e5
}

function formatWorkHours(hours) {
  if (hours == null || Number.isNaN(hours)) return '—'
  return `${hours.toFixed(1)} jam`
}

export default function SupervisorDashboard() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const [tickets, setTickets] = useState([])
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [companyFilter, setCompanyFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState([])
  const [{ from: dateFrom, to: dateTo }, setDateRange] = useState(defaultDateRange)
  const [savingDefault, setSavingDefault] = useState(false)
  const [defaultSaved, setDefaultSaved] = useState(false)
  const [exporting, setExporting] = useState(false)

  function setDateFrom(value) {
    setDateRange((r) => ({ ...r, from: value }))
  }
  function setDateTo(value) {
    setDateRange((r) => ({ ...r, to: value }))
  }
  function resetDateRange() {
    setDateRange(defaultDateRange())
  }

  // Status: array kosong berarti "semua status" (tidak difilter).
  function toggleStatus(value) {
    setStatusFilter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  async function handleSaveDefaultCompany() {
    setSavingDefault(true)
    const { error } = await supabase
      .from('profiles')
      .update({ default_company_id: companyFilter === 'all' ? null : companyFilter })
      .eq('id', user.id)
    setSavingDefault(false)
    if (!error) {
      await refreshProfile()
      setDefaultSaved(true)
      setTimeout(() => setDefaultSaved(false), 2500)
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Daftar tiket sudah otomatis dibatasi RLS ke perusahaan+kategori
      // yang terkait ke pengguna ini (kecuali Super Admin, yang melihat
      // semua). Opsi filter juga disamakan.
      const [{ data: ticketData }, { companies: companyData, categories: categoryData }] = await Promise.all([
        supabase
          .from('tickets')
          .select('*, categories(name), companies(name), reporter:profiles!tickets_created_by_fkey(full_name), assignee:profiles!tickets_assigned_to_fkey(full_name)')
          .order('created_at', { ascending: false }),
        fetchVisibleCompaniesAndCategories(profile),
      ])
      setTickets(ticketData || [])
      setCompanies(companyData)
      setCategories(categoryData)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const rangeStart = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
    const rangeEnd = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null

    return tickets.filter((t) => {
      if (companyFilter !== 'all' && t.company_id !== companyFilter) return false
      if (categoryFilter !== 'all' && t.category_id !== categoryFilter) return false
      if (statusFilter.length > 0 && !statusFilter.includes(t.status)) return false

      const createdAt = new Date(t.created_at)
      if (rangeStart && createdAt < rangeStart) return false
      if (rangeEnd && createdAt > rangeEnd) return false

      return true
    })
  }, [tickets, companyFilter, categoryFilter, statusFilter, dateFrom, dateTo])

  const stats = useMemo(() => {
    const total = filtered.length
    const resolved = filtered.filter((t) => t.status === 'resolved' || t.status === 'closed')
    const openish = filtered.filter((t) => !['resolved', 'closed'].includes(t.status))

    const resolutionHours = resolved
      .filter((t) => t.resolved_at)
      .map((t) => (new Date(t.resolved_at) - new Date(t.created_at)) / 36e5)
    const avgResolutionHours = resolutionHours.length
      ? resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length
      : null

    return { total, resolvedCount: resolved.length, openCount: openish.length, avgResolutionHours }
  }, [filtered])

  const byStatus = useMemo(() => {
    return STATUSES.map((s) => ({
      name: s.label,
      key: s.value,
      value: filtered.filter((t) => t.status === s.value).length,
    }))
  }, [filtered])

  const byCategory = useMemo(() => {
    return categories.map((c) => ({
      name: c.name,
      value: filtered.filter((t) => t.category_id === c.id).length,
    }))
  }, [filtered, categories])

  const byCompany = useMemo(() => {
    return companies.map((c) => ({
      name: c.name.replace('PT ', ''),
      value: filtered.filter((t) => t.company_id === c.id).length,
    }))
  }, [filtered, companies])

  // Ambil catatan perbaikan TERAKHIR (non-kosong) per tiket dari
  // ticket_updates — untuk kolom "Catatan Perbaikan" di ekspor, karena
  // satu tiket bisa punya banyak catatan tapi laporan cuma butuh satu
  // baris per tiket.
  async function fetchLatestNotes(ticketIds) {
    if (ticketIds.length === 0) return {}
    const { data } = await supabase
      .from('ticket_updates')
      .select('ticket_id, note, created_at')
      .in('ticket_id', ticketIds)
      .order('created_at', { ascending: true })

    const latest = {}
    for (const u of data || []) {
      if (u.note && u.note.trim()) {
        latest[u.ticket_id] = u.note.trim()
      }
    }
    return latest
  }

  // Format "YYYY-MM-DD" (dari input tanggal) jadi teks tanggal
  // berbahasa Indonesia, mis. "1 Januari 2026".
  function formatDateOnly(isoDateStr) {
    if (!isoDateStr) return ''
    return new Date(`${isoDateStr}T00:00:00`).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  async function exportXlsx() {
    setExporting(true)

    const latestNoteByTicket = await fetchLatestNotes(filtered.map((t) => t.id))

    // Laporan selalu diurutkan tanggal dilapor paling lama dulu (ASC),
    // terlepas dari urutan tabel di layar.
    const sortedForExport = [...filtered].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    )

    const headers = [
      'Tanggal Dilapor',
      'Judul Masalah',
      'Pelapor',
      'Perusahaan',
      'Kategori',
      'Lokasi',
      'Prioritas',
      'Deskripsi',
      'Ditugaskan',
      'Tanggal Diperbaiki',
      'Catatan Perbaikan',
      'Status',
      'Lama Perbaikan (jam)',
    ]
    const rows = sortedForExport.map((t) => [
      formatDateTime(t.created_at),
      t.title,
      t.reporter?.full_name || '',
      t.companies?.name || '',
      t.categories?.name || '',
      t.location || '',
      labelFor(PRIORITIES, t.priority),
      t.description || '',
      t.assignee?.full_name || 'Belum ditugaskan',
      t.resolved_at ? formatDateTime(t.resolved_at) : '',
      latestNoteByTicket[t.id] || '',
      labelFor(STATUSES, t.status),
      Math.round(calculateWorkHours(t) * 10) / 10,
    ])

    const lastColIndex = headers.length - 1 // untuk rentang merge judul & periode

    const titleRow = ['Laporan Permasalahan & Perbaikan']
    const periodRow = [`Periode: ${formatDateOnly(dateFrom)} sampai ${formatDateOnly(dateTo)}`]
    const blankRow = []

    const worksheet = XLSX.utils.aoa_to_sheet([titleRow, periodRow, blankRow, headers, ...rows])

    // Baris 1: judul, font 18 bold. Baris 2: periode, font 10.
    worksheet['A1'].s = { font: { bold: true, sz: 18 } }
    worksheet['A2'].s = { font: { sz: 10 } }

    // Gabungkan sel judul & periode supaya membentang di atas seluruh
    // kolom tabel, bukan cuma di kolom A.
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIndex } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIndex } },
    ]

    worksheet['!cols'] = [
      { wch: 18 }, // Tanggal Dilapor
      { wch: 28 }, // Judul Masalah
      { wch: 20 }, // Pelapor
      { wch: 24 }, // Perusahaan
      { wch: 22 }, // Kategori
      { wch: 20 }, // Lokasi
      { wch: 10 }, // Prioritas
      { wch: 40 }, // Deskripsi
      { wch: 20 }, // Ditugaskan
      { wch: 18 }, // Tanggal Diperbaiki
      { wch: 40 }, // Catatan Perbaikan
      { wch: 14 }, // Status
      { wch: 16 }, // Lama Perbaikan (jam)
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Tiket')
    XLSX.writeFile(workbook, `laporan-tiket-${new Date().toISOString().slice(0, 10)}.xlsx`)

    setExporting(false)
  }

  if (loading) return <LoadingSpinner label="Menyusun laporan..." />

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Laporan &amp; Analitik</h1>
          <p className="text-sm text-ink-light">
            Ringkasan kinerja penanganan gangguan seluruh perusahaan · Default Anda:{' '}
            <span className="font-medium text-ink">
              {profile?.default_company_id
                ? companies.find((c) => c.id === profile.default_company_id)?.name || 'Semua Perusahaan'
                : 'Semua Perusahaan'}
            </span>
          </p>
        </div>
        <button onClick={exportXlsx} disabled={exporting} className="btn-secondary">
          {exporting ? 'Menyiapkan...' : '⬇ Ekspor XLSX'}
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-light">Dari</span>
          <input
            type="date"
            className="input w-auto"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-light">Sampai</span>
          <input
            type="date"
            className="input w-auto"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <button type="button" onClick={resetDateRange} className="btn-ghost text-xs">
          Bulan Ini
        </button>
        <select className="input sm:max-w-xs" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
          <option value="all">Semua Perusahaan</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          type="button"
          onClick={handleSaveDefaultCompany}
          disabled={savingDefault}
          className="btn-ghost text-xs"
          title="Jadikan perusahaan yang sedang dipilih sebagai tampilan default Anda setiap kali membuka menu ini"
        >
          {savingDefault ? 'Menyimpan...' : defaultSaved ? 'Tersimpan ✓' : 'Jadikan Default'}
        </button>
        <select className="input sm:max-w-xs" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">Semua Kategori</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-xs font-medium text-ink-light">Status:</span>
        <label className="flex items-center gap-1.5 text-xs text-ink">
          <input
            type="checkbox"
            checked={statusFilter.length === 0}
            onChange={() => setStatusFilter([])}
            className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          Semua
        </label>
        {STATUSES.map((s) => (
          <label key={s.value} className="flex items-center gap-1.5 text-xs text-ink">
            <input
              type="checkbox"
              checked={statusFilter.includes(s.value)}
              onChange={() => toggleStatus(s.value)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            {s.label}
          </label>
        ))}
        {statusFilter.length > 0 && (
          <button type="button" onClick={() => setStatusFilter([])} className="text-xs font-medium text-ink-light hover:text-ink">
            Reset Status
          </button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Tiket" value={stats.total} />
        <StatCard label="Belum Selesai" value={stats.openCount} />
        <StatCard label="Selesai / Ditutup" value={stats.resolvedCount} />
        <StatCard
          label="Rata-rata Waktu Penyelesaian"
          value={stats.avgResolutionHours ? `${stats.avgResolutionHours.toFixed(1)} jam` : '—'}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-display text-sm font-bold text-ink">Tiket per Status</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byStatus} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {byStatus.map((entry) => (
                  <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-display text-sm font-bold text-ink">Tiket per Kategori</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byCategory} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2F6F5E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-display text-sm font-bold text-ink">Tiket per Perusahaan</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byCompany} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#5A9F8B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 p-5">
          <h2 className="font-display text-sm font-bold text-ink">Detail Tiket ({filtered.length})</h2>
          <p className="text-xs text-ink-light">Klik salah satu baris untuk melihat detail masalah & riwayat tanggapan.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-50/60 text-xs uppercase tracking-wide text-ink-light">
              <tr>
                <th className="px-5 py-3 font-semibold">Nomor</th>
                <th className="px-5 py-3 font-semibold">Judul</th>
                <th className="px-5 py-3 font-semibold">Perusahaan</th>
                <th className="px-5 py-3 font-semibold">Prioritas</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Waktu Pengerjaan</th>
                <th className="px-5 py-3 font-semibold">Dibuat</th>
                <th className="px-5 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((t) => {
                const isDone = ['resolved', 'closed'].includes(t.status)
                return (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    className="cursor-pointer hover:bg-brand-50/40"
                    title="Klik untuk lihat detail tiket"
                  >
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-brand-600">{t.ticket_number}</td>
                    <td className="px-5 py-3 text-ink">{t.title}</td>
                    <td className="px-5 py-3 text-ink-light">{t.companies?.name}</td>
                    <td className="px-5 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                    <td className="whitespace-nowrap px-5 py-3 text-ink-light">
                      {formatWorkHours(calculateWorkHours(t))}
                      {!isDone && <span className="ml-1 text-[10px] text-amber-600">(berjalan)</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-ink-light">{formatDateTime(t.created_at)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-xs font-medium text-brand-600">
                      Lihat detail →
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-ink-light">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold text-ink">{value}</p>
    </div>
  )
}
