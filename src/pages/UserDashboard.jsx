import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import TicketCard from '../components/TicketCard'
import LoadingSpinner from '../components/LoadingSpinner'
import Icon from '../components/Icon'
import { monthKey, useMonthParam } from '../lib/useMonthParam'
import { STATUSES } from '../data/constants'

const isActiveStatus = (status) => !['resolved', 'closed'].includes(status)

export default function UserDashboard() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  // Default: bulan sesuai tanggal sistem. Kosong ('') = semua bulan.
  // Tersimpan di URL, jadi tetap terpilih setelah kembali dari detail tiket.
  const [month, setMonth] = useMonthParam()

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('tickets')
        .select('*, categories(name), companies(name)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
      if (active) {
        setTickets(data || [])
        setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [user.id])

  // Tiket yang tampil untuk bulan terpilih:
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

  const filtered = statusFilter === 'all' ? scoped : scoped.filter((t) => t.status === statusFilter)

  const counts = STATUSES.reduce((acc, s) => {
    acc[s.value] = scoped.filter((t) => t.status === s.value).length
    return acc
  }, {})

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Tiket Saya</h1>
          <p className="text-sm text-ink-light">Pantau status laporan gangguan yang Anda ajukan</p>
        </div>
        <Link to="/tickets/new" className="btn-primary">
          + Buat Tiket Baru
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="monthFilter" className="text-xs font-medium text-ink-light">Bulan</label>
        <input
          id="monthFilter"
          type="month"
          className="input !py-1.5 !text-sm sm:max-w-[11rem]"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setMonth(monthKey(new Date()))}
          className="btn-ghost !px-2.5 !py-1 text-xs inline-flex items-center gap-1.5"
        >
          <Icon name="calendar-check" />
          Bulan Ini
        </button>
        <button
          type="button"
          onClick={() => setMonth('')}
          className="btn-ghost !px-2.5 !py-1 text-xs inline-flex items-center gap-1.5"
        >
          <Icon name="calendar-range" />
          Semua Bulan
        </button>
      </div>
      <p className="-mt-2 mb-4 text-xs text-ink-light">
        Tiket yang belum Selesai/Ditutup dari bulan sebelumnya tetap ditampilkan.
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-inset ${
            statusFilter === 'all' ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-light ring-gray-200'
          }`}
        >
          Semua ({scoped.length})
        </button>
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-inset ${
              statusFilter === s.value ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-light ring-gray-200'
            }`}
          >
            {s.label} ({counts[s.value] || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner label="Memuat tiket..." />
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-ink-light">Belum ada tiket{month ? ' pada bulan ini' : ''}{statusFilter !== 'all' ? ' dengan status tersebut' : ''}.</p>
          <Link to="/tickets/new" className="btn-primary mt-4 inline-flex">
            Buat Tiket Pertama Anda
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <TicketCard key={t.id} ticket={t} linkState={{ origin: 'my-tickets' }} />
          ))}
        </div>
      )}
    </div>
  )
}
