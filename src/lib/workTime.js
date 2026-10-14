// Waktu pengerjaan tiket (dipakai Laporan & Analitik dan Detail Tiket,
// supaya angkanya selalu sama di kedua tempat).
//
// Dihitung dari created_at sampai resolved_at kalau tiket sudah
// Selesai/Ditutup (berhenti menghitung, angkanya tetap), atau sampai
// SAAT INI kalau masih berjalan (bertambah setiap halaman dimuat ulang).

export function isTicketDone(ticket) {
  return ['resolved', 'closed'].includes(ticket?.status)
}

export function calculateWorkHours(ticket) {
  const start = new Date(ticket.created_at)
  const end = isTicketDone(ticket) && ticket.resolved_at ? new Date(ticket.resolved_at) : new Date()
  return (end - start) / 36e5
}

export function formatWorkHours(hours) {
  if (hours == null || Number.isNaN(hours)) return '—'
  return `${hours.toFixed(1)} jam`
}

// Pelengkap yang lebih mudah dibaca untuk durasi panjang, mis.
// 150.0 jam -> "6 hari 6 jam". Kosong kalau kurang dari 24 jam.
export function formatWorkDays(hours) {
  if (hours == null || Number.isNaN(hours) || hours < 24) return ''
  const days = Math.floor(hours / 24)
  const rest = Math.round(hours - days * 24)
  return rest > 0 ? `${days} hari ${rest} jam` : `${days} hari`
}
