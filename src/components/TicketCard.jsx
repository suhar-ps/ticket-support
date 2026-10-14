import { Link } from 'react-router-dom'
import StatusBadge from './StatusBadge'
import PriorityBadge from './PriorityBadge'
import { formatDateTime } from '../data/constants'
import { companyCardStyle } from '../lib/companyColors'
import { calculateWorkHours, formatWorkDays, formatWorkHours, isTicketDone } from '../lib/workTime'

export default function TicketCard({
  ticket,
  showRequester = false,
  showCompany = false,
  showCaptions = false,
  linkState,
}) {
  // Semua kartu tiket (Antrian Support maupun Tiket Saya) diberi warna
  // latar sesuai perusahaan tiketnya.
  const tint = companyCardStyle(ticket.companies?.name)
  const workHours = calculateWorkHours(ticket)
  const workDays = formatWorkDays(workHours)

  return (
    <Link
      to={`/tickets/${ticket.id}`}
      state={linkState}
      style={tint}
      className="card block overflow-hidden transition-shadow hover:shadow-md"
    >
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold tracking-wide text-brand-600">
              {ticket.ticket_number}
            </span>
            {showCaptions ? (
              // Dengan caption: "Status: [badge]" dan "Prioritas: [badge]"
              // (dipakai di Antrian Support).
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-ink-light">Status:</span>
                  <StatusBadge status={ticket.status} />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-ink-light">Prioritas:</span>
                  <PriorityBadge priority={ticket.priority} />
                </span>
              </>
            ) : (
              <>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
              </>
            )}
          </div>
          <h3 className="truncate font-display text-base font-bold text-ink">{ticket.title}</h3>
          <p className="mt-0.5 line-clamp-1 text-sm text-ink-light">{ticket.description}</p>
        </div>
        <div className="shrink-0 text-left text-xs text-ink-light sm:text-right">
          <p>{ticket.categories?.name}</p>
          {showCompany && <p className="font-medium text-ink">{ticket.companies?.name}</p>}
          {showRequester && <p>Pelapor: {ticket.reporter?.full_name}</p>}
          <p className="mt-0.5">{formatDateTime(ticket.created_at)}</p>
          <p className="mt-0.5">
            Waktu pengerjaan:{' '}
            <span className="font-semibold text-ink">{formatWorkHours(workHours)}</span>
            {workDays && <span> ({workDays})</span>}
            {!isTicketDone(ticket) && <span className="ml-1 text-[10px] text-amber-600">(berjalan)</span>}
          </p>
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
