import { useSearchParams } from 'react-router-dom'

// "YYYY-MM" dari komponen tanggal LOKAL (bukan toISOString, yang memakai
// UTC dan bisa menggeser bulan di sekitar tengah malam WIB).
export function monthKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Bulan terpilih untuk filter bulan di Tiket Saya & Antrian Support,
// disimpan di URL (?bulan=2026-09, atau ?bulan=all untuk "Semua Bulan").
//
// Karena tersimpan di URL, pilihan bulan TIDAK hilang saat pengguna
// membuka detail tiket lalu kembali (tombol "← Kembali" atau tombol back
// browser): halaman daftar dibuka lagi dengan bulan yang sama. Membuka
// halaman lewat menu (tanpa ?bulan) tetap dimulai dari bulan sistem.
// Nilai '' berarti "Semua Bulan".
export function useMonthParam() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('bulan')

  let month
  if (raw === 'all') month = ''
  else if (raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) month = raw
  else month = monthKey(new Date())

  function setMonth(value) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('bulan', value === '' ? 'all' : value)
        return next
      },
      // replace: mengganti bulan tidak menambah riwayat browser, jadi
      // tombol back tetap langsung keluar dari halaman daftar.
      { replace: true }
    )
  }

  return [month, setMonth]
}
