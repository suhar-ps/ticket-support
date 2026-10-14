// Kode warna unik per perusahaan, dipakai sebagai latar baris/kartu tiket
// supaya perusahaan bisa dikenali sekilas. Warna dikunci pada NAMA
// perusahaan (nama bersifat unik di database), jadi tetap konsisten di
// semua halaman. Nama perusahaan tetap ditampilkan di setiap baris —
// warna hanya pembantu visual, bukan satu-satunya penanda.
//
//   bg     : warna latar pastel (aman untuk teks gelap)
//   accent : warna yang lebih pekat, untuk garis tepi
const PALETTE = {
  // ---- Jakarta ----
  'PT SAS International':            { bg: '#E3EDFC', accent: '#3B6FD4' }, // biru
  'PT Petrindo Semesta':             { bg: '#FEF6C7', accent: '#C99A06' }, // kuning
  'PT Sarana Instrument':            { bg: '#DDF5E4', accent: '#2E9E5B' }, // hijau
  'PT Omni Composite Solutions':     { bg: '#FDE2E6', accent: '#D6455D' }, // merah muda
  'PT Mika Tunggal':                 { bg: '#FFE8D2', accent: '#E26A1B' }, // oranye
  'PT Agora':                        { bg: '#D6F4F8', accent: '#1699B5' }, // cyan
  // ---- Cikande ----
  'PT SAS International (Cikande)':  { bg: '#E9E4FB', accent: '#6D4FD1' }, // ungu
  'PT Brilliant Flow Control':       { bg: '#EAF6C9', accent: '#6FA41C' }, // hijau limau
  'PT Brilliant New Energy Surface': { bg: '#F9DFEF', accent: '#C23B93' }, // magenta
}

const NEUTRAL = { bg: '#F3F4F6', accent: '#9CA3AF' }

// Perusahaan baru yang belum ada di PALETTE tetap dapat warna yang
// konsisten (diturunkan dari hash nama), jadi tidak perlu ubah kode
// hanya untuk menambah perusahaan.
function hashHue(name) {
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

export function companyColor(name) {
  if (!name) return NEUTRAL
  if (PALETTE[name]) return PALETTE[name]
  const hue = hashHue(name)
  return { bg: `hsl(${hue} 70% 92%)`, accent: `hsl(${hue} 55% 45%)` }
}

// Style siap pakai untuk <tr> tabel (latar saja).
export function companyRowStyle(name) {
  return { backgroundColor: companyColor(name).bg }
}

// Style siap pakai untuk kartu (latar + garis tepi kiri).
export function companyCardStyle(name) {
  const c = companyColor(name)
  return { backgroundColor: c.bg, borderLeft: `4px solid ${c.accent}` }
}
