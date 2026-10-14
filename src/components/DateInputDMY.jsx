import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

// Input tanggal berformat dd/mm/yyyy.
//
// <input type="date"> bawaan browser menampilkan format sesuai bahasa
// browser/OS pengguna dan tidak bisa dipaksa, jadi di sini dipakai kolom
// teks dengan format tetap dd/mm/yyyy (garis miring ditambahkan otomatis
// saat mengetik) + tombol kalender yang membuka pemilih tanggal bawaan.
//
// Nilai ke luar/ke dalam tetap "YYYY-MM-DD" (ISO), jadi kode penyaringan
// & ekspor di halaman yang memakainya tidak perlu diubah.

export function isoToDMY(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// "dd/mm/yyyy" -> "YYYY-MM-DD", atau null kalau belum lengkap / tanggalnya
// tidak ada (mis. 31/02/2026).
function dmyToIso(text) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (!match) return null
  const [, d, m, y] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(m) - 1 ||
    date.getDate() !== Number(d)
  ) {
    return null
  }
  return `${y}-${m}-${d}`
}

// Hanya angka, maksimal 8, disisipi "/" setelah digit ke-2 dan ke-4.
function maskDMY(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  let out = digits.slice(0, 2)
  if (digits.length > 2) out += `/${digits.slice(2, 4)}`
  if (digits.length > 4) out += `/${digits.slice(4)}`
  return out
}

export default function DateInputDMY({ value, onChange, min, max, className = '', ariaLabel }) {
  const [text, setText] = useState(isoToDMY(value))
  const pickerRef = useRef(null)

  // Ikuti perubahan nilai dari luar (mis. tombol "Bulan Ini" atau
  // pemilih kalender), tanpa menimpa ketikan yang sedang berlangsung.
  useEffect(() => {
    if ((dmyToIso(text) || '') !== (value || '')) setText(isoToDMY(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleChange(e) {
    const next = maskDMY(e.target.value)
    setText(next)
    if (next === '') {
      onChange('')
      return
    }
    const iso = dmyToIso(next)
    if (iso) onChange(iso)
  }

  // Kalau ketikan belum lengkap/tidak valid saat kolom ditinggalkan,
  // kembalikan ke tanggal terakhir yang valid.
  function handleBlur() {
    if (text !== '' && dmyToIso(text) === null) setText(isoToDMY(value))
  }

  function openPicker() {
    const el = pickerRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') el.showPicker()
    else el.focus()
  }

  const invalid = text.length === 10 && dmyToIso(text) === null

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        maxLength={10}
        className={`input !pr-9 ${invalid ? '!ring-red-400' : ''}`}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      <button
        type="button"
        onClick={openPicker}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-light hover:text-ink"
        title="Pilih dari kalender"
        aria-label="Buka kalender"
      >
        <Icon name="calendar" className="h-4 w-4" />
      </button>
      {/* Pemilih tanggal bawaan browser — tersembunyi, hanya dipanggil lewat tombol kalender. */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ''}
        min={min || undefined}
        max={max || undefined}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
      />
    </div>
  )
}
