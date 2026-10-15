import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fetchQueueCompaniesAndCategories } from '../lib/access'
import TicketCard from '../components/TicketCard'
import LoadingSpinner from '../components/LoadingSpinner'
import Icon from '../components/Icon'
import { monthKey, useMonthParam } from '../lib/useMonthParam'
import { STATUSES, PRIORITIES } from '../data/constants'

const isActiveStatus = (status) => !['resolved', 'closed'].includes(status)

export default function SupportDashboard() {
  const { profile } = useAuth()
  const [tickets, setTickets] = useState([])
  const [categories, setCategories] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  // Default: bulan sesuai tanggal sistem. Kosong ('') = semua bulan.
  // Tersimpan di URL, jadi tetap terpilih setelah kembali dari detail tiket.
  const [month, setMonth] = useMonthParam()

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      // Daftar tiket sendiri sudah otomatis dibatasi RLS ke
      // perusahaan yang diberi akses ke pengguna ini (Kelola Akses), kecuali
      // Super Admin yang melihat semua perusahaan. Pilihan perusahaan
      // disamakan; kategori tidak membatasi sehingga semua ditampilkan.
      const [{ data: ticketData }, { companies: companyData, categories: categoryData }] = await Promise.all([
        supabase
          .from('tickets')
          .select(
            '*, categories(name), companies(name), reporter:profiles!tickets_created_by_fkey(full_name)'
          )
          .order('created_at', { ascending: false }),
        fetchQueueCompaniesAndCategories(profile),
      ])
      if (active) {
        setTickets(ticketData || [])
        setCategories(categoryData || [])
        setCompanies(companyData || [])
        setLoading(false)
      }
    }
    load()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tiket yang masuk cakupan bulan terpilih:
  //  - dibuat di bulan itu, ATAU
  //  - belum Selesai/Ditutup dan dibuat pada bulan itu atau sebelumnya
  //    (tiket aktif dari bulan lalu tetap muncul sampai selesai).
  const scoped = useMemo(() => {
    if (!month) return tickets
    return tickets.filter((t) => {
      const created = monthKey(t.created_at)
      return created === month || (isActiveStatus(t.status) && created < month)
    })
  }, [tickets, month])

  const filtered = useMemo(() => {
    return scoped.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
      if (categoryFilter !== 'all' && t.category_id !== categoryFilter) return false
      if (companyFilter !== 'all' && t.company_id !== companyFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          t.title.toLowerCase().includes(q) ||
          t.ticket_number.toLowerCase().includes(q) ||
          (t.asset_identifier || '').toLowerCase().includes(q) ||
          (t.reporter?.full_name || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [scoped, statusFilter, priorityFilter, categoryFilter, companyFilter, search])

  // Kartu ringkasan mengikuti cakupan bulan, supaya angkanya sama dengan daftar.
  const openCount = scoped.filter((t) => t.status === 'open').length
  const inProgressCount = scoped.filter((t) => t.status === 'in_progress').length
  const pendingCount = scoped.filter((t) => t.status === 'pending').length
  const urgentCount = scoped.filter((t) => t.priority === 'urgent' && isActiveStatus(t.status)).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Antrian Support</h1>
        <p className="text-sm text-ink-light">Kelola dan perbarui status seluruh laporan gangguan</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <SummaryStat label="Tiket Baru" value={openCount} tone="blue" />
        <SummaryStat label="Sedang Dikerjakan" value={inProgressCount} tone="amber" />
        <SummaryStat label="Menunggu" value={pendingCount} tone="violet" />
        <SummaryStat label="Prioritas Mendesak (belum selesai)" value={urgentCount} tone="red" />
      </div>

      <div className="card mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          className="input sm:max-w-xs"
          placeholder="Cari nomor tiket, judul, aset, pelapor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input sm:max-w-[10rem]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Semua Status</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="input sm:max-w-[10rem]" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="all">Semua Prioritas</option>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select className="input sm:max-w-[12rem]" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">Semua Kategori</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input sm:max-w-[14rem]" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
          <option value="all">Semua Perusahaan</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="monthFilter" className="text-xs font-medium text-ink-light">Bulan</label>
          <input
            id="monthFilter"
            type="month"
            className="input sm:max-w-[11rem]"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button type="button" onClick={() => setMonth(monthKey(new Date()))} className="btn-ghost !px-2.5 !py-1 text-xs inline-flex items-center gap-1.5">
            <Icon name="calendar-check" />
            Bulan Ini
          </button>
          <button type="button" onClick={() => setMonth('')} className="btn-ghost !px-2.5 !py-1 text-xs inline-flex items-center gap-1.5">
            <Icon name="calendar-range" />
            Semua Bulan
          </button>
        </div>
      </div>
      <p className="-mt-3 mb-5 text-xs text-ink-light">
        Tiket yang belum Selesai/Ditutup dari bulan sebelumnya tetap ditampilkan.
      </p>

      {loading ? (
        <LoadingSpinner label="Memuat antrian tiket..." />
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-ink-light">Tidak ada tiket yang cocok dengan filter.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <TicketCard key={t.id} ticket={t} showRequester showCompany showCaptions linkState={{ origin: 'queue' }} />
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryStat({ label, value, tone }) {
  const toneClasses = {
    blue: 'text-blue-700 bg-blue-50',
    amber: 'text-amber-700 bg-amber-50',
    violet: 'text-violet-700 bg-violet-50',
    red: 'text-red-700 bg-red-50',
  }
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-ink-light">{label}</p>
      <p className={`mt-1 inline-flex rounded-lg px-2 py-0.5 font-display text-2xl font-extrabold ${toneClasses[tone]}`}>
        {value}
      </p>
    </div>
  )
}
