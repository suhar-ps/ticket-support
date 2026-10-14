import { useSearchParams } from 'react-router-dom'

// Filter Laporan & Analitik, disimpan di URL supaya tidak hilang saat
// pengguna membuka detail tiket (klik baris tabel) lalu kembali — tombol
// "← Kembali" maupun tombol back browser membuka laporan lagi dengan
// filter yang sama. Membuka halaman lewat menu (tanpa parameter) tetap
// dimulai dari tampilan standar: bulan berjalan, semua perusahaan,
// kategori & status.
//
//   ?dari=2026-10-01&sampai=2026-10-14   (kosong = "kosong")
//   &perusahaan=<id>&kategori=<id>&status=open,pending

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CLEARED = 'kosong'

// Format Date -> "YYYY-MM-DD" memakai komponen tanggal LOKAL (bukan
// toISOString, yang mengonversi ke UTC dan bisa menggeser tanggal
// mundur/maju tergantung zona waktu perangkat, mis. WIB).
function toDateInputValue(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Standar: tanggal 1 bulan ini sampai hari ini.
export function defaultDateRange() {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: toDateInputValue(firstOfMonth), to: toDateInputValue(now) }
}

export function useReportFilters() {
  const [params, setParams] = useSearchParams()
  const fallback = defaultDateRange()

  function readDate(key, fallbackValue) {
    const raw = params.get(key)
    if (raw === CLEARED) return ''
    if (raw && ISO_DATE.test(raw)) return raw
    return fallbackValue
  }

  const dateFrom = readDate('dari', fallback.from)
  const dateTo = readDate('sampai', fallback.to)
  const companyFilter = params.get('perusahaan') || 'all'
  const categoryFilter = params.get('kategori') || 'all'
  const statusFilter = (params.get('status') || '').split(',').filter(Boolean)

  // replace: mengubah filter tidak menambah riwayat browser.
  function update(mutate) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        mutate(next)
        return next
      },
      { replace: true }
    )
  }

  const setOrDelete = (key, value, emptyValue) => (next) => {
    if (!value || value === emptyValue) next.delete(key)
    else next.set(key, value)
  }

  return {
    dateFrom,
    dateTo,
    companyFilter,
    categoryFilter,
    statusFilter,
    setDateFrom: (value) => update((n) => n.set('dari', value || CLEARED)),
    setDateTo: (value) => update((n) => n.set('sampai', value || CLEARED)),
    // "Bulan Ini": kembali ke rentang standar (filter lain tidak diubah).
    resetDateRange: () => update((n) => { n.delete('dari'); n.delete('sampai') }),
    setCompanyFilter: (value) => update(setOrDelete('perusahaan', value, 'all')),
    setCategoryFilter: (value) => update(setOrDelete('kategori', value, 'all')),
    // Array kosong = semua status.
    setStatusFilter: (list) => update(setOrDelete('status', list.join(','))),
    toggleStatus: (value) =>
      update((n) => {
        const current = (n.get('status') || '').split(',').filter(Boolean)
        const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
        if (next.length) n.set('status', next.join(','))
        else n.delete('status')
      }),
  }
}
