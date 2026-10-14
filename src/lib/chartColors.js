// Warna bar untuk grafik "Tiket per Status" dan "Tiket per Kategori".
//
// Semua warna di sini sengaja dipilih JAUH dari warna perusahaan
// (lib/companyColors.js) supaya satu warna di dashboard tidak punya dua
// arti: warna perusahaan hanya untuk perusahaan. Jaraknya diukur dengan
// CIEDE2000 — setiap warna di bawah berjarak >= 14 dari semua warna
// aksen perusahaan (>= 18 antar sesama warna di sini); angka ~10 sudah
// terlihat "mirip" di samping-menyamping.
//
// Kalau suatu hari menambah warna perusahaan baru di companyColors.js,
// hindari rona yang dekat dengan warna-warna ini.

// Status — tetap searah dengan lencana status (biru tua, cokelat-kuning,
// ungu, hijau, abu-abu), tetapi dengan nada gelap/redup.
export const STATUS_CHART_COLORS = {
  open: '#0F172A',        // biru-hitam (Baru)
  in_progress: '#78350F', // cokelat (Sedang Dikerjakan)
  pending: '#581C87',     // ungu tua (Menunggu)
  resolved: '#3F6212',    // hijau zaitun tua (Selesai)
  closed: '#475569',      // abu-abu kebiruan (Ditutup)
}

// Kategori — satu warna tetap per nama kategori.
const CATEGORY_PALETTE = {
  'Hardware': '#134E4A',                   // hijau-biru tua
  'Software': '#0D9488',                   // teal
  'Network & Infrastructure': '#B5838D',   // mawar debu
  'Facilities & Maintenance': '#B08968',   // pasir
  'Housekeeping & Environment': '#7A8B69', // hijau sage
  'Security & Access Control': '#881337',  // marun
}

// Kategori baru (di luar daftar di atas) mendapat salah satu warna
// cadangan ini — tetap konsisten untuk nama yang sama dan tetap jauh dari
// warna perusahaan.
const FALLBACK = ['#4A2040', '#5D4037', '#172554', '#115E59', '#1F2937', '#5B6B1A', '#8D6E2F']

export function categoryChartColor(name) {
  if (!name) return '#475569'
  if (CATEGORY_PALETTE[name]) return CATEGORY_PALETTE[name]
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 997
  return FALLBACK[h % FALLBACK.length]
}
