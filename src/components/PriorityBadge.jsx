import { PRIORITIES, labelFor } from '../data/constants'

const COLORS = {
  low: 'bg-gray-50 text-gray-600 ring-gray-400/20',
  medium: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  high: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  urgent: 'bg-red-50 text-red-700 ring-red-600/20',
}

export default function PriorityBadge({ priority }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        COLORS[priority] || COLORS.medium
      }`}
    >
      {labelFor(PRIORITIES, priority)}
    </span>
  )
}
