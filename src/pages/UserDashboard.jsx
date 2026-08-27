import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import TicketCard from '../components/TicketCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { STATUSES } from '../data/constants'

export default function UserDashboard() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

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

  const filtered = statusFilter === 'all' ? tickets : tickets.filter((t) => t.status === statusFilter)

  const counts = STATUSES.reduce((acc, s) => {
    acc[s.value] = tickets.filter((t) => t.status === s.value).length
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

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-inset ${
            statusFilter === 'all' ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-light ring-gray-200'
          }`}
        >
          Semua ({tickets.length})
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
          <p className="text-ink-light">Belum ada tiket pada kategori ini.</p>
          <Link to="/tickets/new" className="btn-primary mt-4 inline-flex">
            Buat Tiket Pertama Anda
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => <TicketCard key={t.id} ticket={t} />)}
        </div>
      )}
    </div>
  )
}
