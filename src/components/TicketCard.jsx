import { Link } from 'react-router-dom'
import StatusBadge from './StatusBadge'
import PriorityBadge from './PriorityBadge'
import { formatDateTime } from '../data/constants'

export default function TicketCard({ ticket, showRequester = false, showCompany = false, linkState }) {
  return (
    <Link
      to={`/tickets/${ticket.id}`}
      state={linkState}
      className="card block overflow-hidden transition-shadow hover:shadow-md"
    >
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold tracking-wide text-brand-600">
              {ticket.ticket_number}
            </span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <h3 className="truncate font-display text-base font-bold text-ink">{ticket.title}</h3>
          <p className="mt-0.5 line-clamp-1 text-sm text-ink-light">{ticket.description}</p>
        </div>
        <div className="shrink-0 text-left text-xs text-ink-light sm:text-right">
          <p>{ticket.categories?.name}</p>
          {showCompany && <p className="font-medium text-ink">{ticket.companies?.name}</p>}
          {showRequester && <p>Pelapor: {ticket.reporter?.full_name}</p>}
          <p className="mt-0.5">{formatDateTime(ticket.created_at)}</p>
        </div>
      </div>
      <div className="ticket-perf mx-5" />
      <div className="flex items-center justify-between px-5 py-2.5 text-xs text-ink-light">
        <span>Aset: {ticket.asset_identifier || '—'}</span>
        <span>Lokasi: {ticket.location || '—'}</span>
      </div>
    </Link>
  )
}
