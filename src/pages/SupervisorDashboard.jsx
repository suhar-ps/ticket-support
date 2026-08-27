import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '../lib/supabaseClient'
import LoadingSpinner from '../components/LoadingSpinner'
import StatusBadge from '../components/StatusBadge'
import PriorityBadge from '../components/PriorityBadge'
import { STATUSES, formatDateTime } from '../data/constants'

const STATUS_COLORS = {
  open: '#3B82F6',
  in_progress: '#D97706',
  pending: '#7C3AED',
  resolved: '#059669',
  closed: '#9CA3AF',
}

export default function SupervisorDashboard() {
  const [tickets, setTickets] = useState([])
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [companyFilter, setCompanyFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: ticketData }, { data: companyData }, { data: categoryData }] = await Promise.all([
        supabase
          .from('tickets')
          .select('*, categories(name), companies(name), reporter:profiles!tickets_created_by_fkey(full_name)')
          .order('created_at', { ascending: false }),
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('categories').select('id, name').order('name'),
      ])
      setTickets(ticketData || [])
      setCompanies(companyData || [])
      setCategories(categoryData || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (companyFilter !== 'all' && t.company_id !== companyFilter) return false
      if (categoryFilter !== 'all' && t.category_id !== categoryFilter) return false
      return true
    })
  }, [tickets, companyFilter, categoryFilter])

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

  function exportCsv() {
    const headers = ['Nomor Tiket', 'Judul', 'Perusahaan', 'Kategori', 'Prioritas', 'Status', 'Pelapor', 'Dibuat', 'Selesai']
    const rows = filtered.map((t) => [
      t.ticket_number,
      t.title.replace(/"/g, "'"),
      t.companies?.name || '',
      t.categories?.name || '',
      t.priority,
      t.status,
      t.reporter?.full_name || '',
      t.created_at,
      t.resolved_at || '',
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-tiket-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <LoadingSpinner label="Menyusun laporan..." />

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Laporan &amp; Analitik</h1>
          <p className="text-sm text-ink-light">Ringkasan kinerja penanganan gangguan seluruh perusahaan</p>
        </div>
        <button onClick={exportCsv} className="btn-secondary">⬇ Ekspor CSV</button>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <select className="input sm:max-w-xs" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
          <option value="all">Semua Perusahaan</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input sm:max-w-xs" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">Semua Kategori</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
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
                <th className="px-5 py-3 font-semibold">Dibuat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-brand-50/30">
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-brand-600">{t.ticket_number}</td>
                  <td className="px-5 py-3 text-ink">{t.title}</td>
                  <td className="px-5 py-3 text-ink-light">{t.companies?.name}</td>
                  <td className="px-5 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                  <td className="whitespace-nowrap px-5 py-3 text-ink-light">{formatDateTime(t.created_at)}</td>
                </tr>
              ))}
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
