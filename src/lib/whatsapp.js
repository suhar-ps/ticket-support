// Membuang semua karakter selain angka (spasi, tanda "+", strip, kurung,
// dll), supaya nomor selalu tersimpan dalam format yang dibutuhkan
// tautan wa.me: kode negara diikuti nomor, tanpa simbol apa pun.
// Tidak mengoreksi awalan "0" gaya lokal Indonesia menjadi "62" — itu
// tetap harus diisi manual oleh penggunanya.
export function normalizeWhatsappNumber(raw) {
  return (raw || '').replace(/\D/g, '')
}

export const WHATSAPP_FORMAT_HINT =
  'Format internasional tanpa tanda "+", contoh: 6281234567890 (62 = kode negara Indonesia, lalu nomor tanpa angka 0 di depan).'
