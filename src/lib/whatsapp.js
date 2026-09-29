// Membuang semua karakter selain angka (spasi, tanda "+", strip, kurung,
// dll), supaya nomor selalu tersimpan dalam format yang dibutuhkan
// tautan wa.me: kode negara diikuti nomor, tanpa simbol apa pun.
export function normalizeWhatsappNumber(raw) {
  return (raw || '').replace(/\D/g, '')
}

export const WHATSAPP_FORMAT_HINT =
  'Format internasional tanpa tanda "+", contoh: 6281234567890 (62 = kode negara Indonesia, lalu nomor tanpa angka 0 di depan).'

// Daftar kode negara untuk dropdown pendaftaran. Baru ada satu pilihan
// sekarang — tinggal tambah baris di sini kalau nanti perlu negara lain.
export const COUNTRY_CODES = [
  { code: '62', label: 'Indonesia (+62)' },
]

// Gabungkan kode negara (tanpa tanda "+") dengan nomor telepon lokal.
// Nomor lokal boleh diketik dengan angka 0 di depan seperti kebiasaan
// Indonesia (mis. "081234567890") — angka 0 itu (hanya SATU di paling
// depan) akan dibuang sebelum digabung dengan kode negaranya. Simbol
// lain (spasi, strip, dll) juga dibuang. Mengembalikan null kalau nomor
// lokalnya kosong (supaya tidak menyimpan kode negara doang).
export function combinePhoneNumber(countryCode, localNumber) {
  const digitsOnly = normalizeWhatsappNumber(localNumber).replace(/^0/, '')
  return digitsOnly ? `${countryCode}${digitsOnly}` : null
}
