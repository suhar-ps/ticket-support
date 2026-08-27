import { STATUSES, labelFor } from '../data/constants'

const COLORS = {
  open: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  in_progress: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  pending: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  closed: 'bg-gray-100 text-gray-500 ring-gray-400/20',
}

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        COLORS[status] || COLORS.open
      }`}
    >
      {labelFor(STATUSES, status)}
    </span>
  )
}
