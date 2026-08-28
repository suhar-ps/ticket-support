export const ASSET_TYPES = [
  { value: 'computer', label: 'Komputer / IT Asset' },
  { value: 'vehicle', label: 'Kendaraan Operasional' },
  { value: 'building', label: 'Fasilitas Gedung' },
  { value: 'other', label: 'Lainnya' },
]

export const PRIORITIES = [
  { value: 'low', label: 'Rendah' },
  { value: 'medium', label: 'Sedang' },
  { value: 'high', label: 'Tinggi' },
  { value: 'urgent', label: 'Mendesak' },
]

export const STATUSES = [
  { value: 'open', label: 'Baru' },
  { value: 'in_progress', label: 'Sedang Dikerjakan' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'resolved', label: 'Selesai' },
  { value: 'closed', label: 'Ditutup' },
]

export const ROLE_LABELS = {
  user: 'Pelapor',
  support: 'Tim Support',
  supervisor: 'Supervisor',
  superadmin: 'Super Admin',
}

export function labelFor(list, value) {
  return list.find((item) => item.value === value)?.label || value
}

export function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
