import { useState } from 'react'

// Grafik pie bergaya 3D (SVG murni). Recharts tidak punya pie 3D bawaan,
// jadi efeknya dibuat dengan sudut pandang miring: setiap irisan digambar
// sebagai elips, ditambah "dinding" setebal DEPTH di sisi depan yang
// diberi warna lebih gelap.
//
// Interaksi: arahkan kursor ke irisan ATAU ke baris legenda untuk
// menyorotnya (irisan bergeser keluar + keterangan jumlah & persen).
//
// data: [{ name, value, color }]  — irisan bernilai 0 tidak digambar,
// tetapi tetap muncul di legenda.

const W = 360
const H = 230
const CX = W / 2
const CY = 98
const RX = 128
const RY = 70
const DEPTH = 24
const POP = 11 // jarak irisan yang disorot bergeser keluar

function point(theta, dy = 0) {
  return [CX + RX * Math.cos(theta), CY + RY * Math.sin(theta) + dy]
}

function fmt(n) {
  return n.toFixed(2)
}

// Gelapkan warna hex (0..1) untuk dinding samping.
function shade(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.round(((n >> 16) & 255) * (1 - amount))
  const g = Math.round(((n >> 8) & 255) * (1 - amount))
  const b = Math.round((n & 255) * (1 - amount))
  return `rgb(${r}, ${g}, ${b})`
}

function topPath(a, b) {
  const [x1, y1] = point(a)
  const [x2, y2] = point(b)
  const large = b - a > Math.PI ? 1 : 0
  return `M ${fmt(CX)} ${fmt(CY)} L ${fmt(x1)} ${fmt(y1)} A ${RX} ${RY} 0 ${large} 1 ${fmt(x2)} ${fmt(y2)} Z`
}

// Dinding hanya terlihat di bagian DEPAN elips (sudut 0..PI, sisi bawah
// layar). Mengembalikan null kalau irisan seluruhnya ada di belakang.
function wallPath(a, b) {
  const s = Math.max(a, 0)
  const e = Math.min(b, Math.PI)
  if (e - s <= 0.0001) return null
  const [x1, y1] = point(s)
  const [x2, y2] = point(e)
  const [x3, y3] = point(e, DEPTH)
  const [x4, y4] = point(s, DEPTH)
  return (
    `M ${fmt(x1)} ${fmt(y1)} A ${RX} ${RY} 0 0 1 ${fmt(x2)} ${fmt(y2)} ` +
    `L ${fmt(x3)} ${fmt(y3)} A ${RX} ${RY} 0 0 0 ${fmt(x4)} ${fmt(y4)} Z`
  )
}

export default function Pie3D({ data, unit = 'tiket' }) {
  const [active, setActive] = useState(null)
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (total === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-ink-light">
        Belum ada data pada filter ini.
      </div>
    )
  }

  // Irisan mulai dari atas (-90°) searah jarum jam.
  let cursor = -Math.PI / 2
  const slices = []
  data.forEach((d, i) => {
    if (d.value <= 0) return
    const frac = d.value / total
    const a = cursor
    const b = cursor + frac * Math.PI * 2
    cursor = b
    slices.push({ ...d, index: i, a, b, frac })
  })
  const isFull = slices.length === 1
  // Irisan yang disorot digambar paling akhir supaya tidak tertutup irisan lain.
  const drawOrder = [...slices].sort((x, y) => (x.index === active) - (y.index === active))

  const shown = active != null ? data[active] : null
  const shownPct = shown ? Math.round((shown.value / total) * 100) : null

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-md" role="img" aria-label="Grafik pie 3D">
        {/* bayangan lembut di bawah pie */}
        <ellipse cx={CX} cy={CY + DEPTH + 6} rx={RX * 0.96} ry={RY * 0.9} fill="rgba(0,0,0,0.10)" />

        {drawOrder.map((s) => {
          const mid = (s.a + s.b) / 2
          const isActive = active === s.index
          const dx = isActive ? Math.cos(mid) * POP : 0
          const dy = isActive ? Math.sin(mid) * POP * (RY / RX) : 0
          const wall = wallPath(s.a, s.b)
          return (
            <g
              key={s.index}
              transform={`translate(${fmt(dx)} ${fmt(dy)})`}
              style={{ transition: 'transform 150ms ease-out', cursor: 'pointer' }}
              onMouseEnter={() => setActive(s.index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(s.index)}
              onBlur={() => setActive(null)}
              tabIndex={0}
            >
              <title>{`${s.name}: ${s.value} ${unit} (${Math.round(s.frac * 100)}%)`}</title>
              {wall && <path d={wall} fill={shade(s.color, 0.28)} stroke={shade(s.color, 0.4)} strokeWidth="0.6" />}
              {isFull ? (
                <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill={s.color} />
              ) : (
                <path d={topPath(s.a, s.b)} fill={s.color} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
              )}
            </g>
          )
        })}

        {/* keterangan irisan yang sedang disorot */}
        <text x={CX} y={H - 8} textAnchor="middle" fontSize="12" fill="#374151" fontWeight="600">
          {shown ? `${shown.name}: ${shown.value} ${unit} (${shownPct}%)` : `Total ${total} ${unit}`}
        </text>
      </svg>

      <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {data.map((d, i) => (
          <li
            key={d.name}
            onMouseEnter={() => d.value > 0 && setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-center gap-2 rounded-md px-1.5 py-1 ${active === i ? 'bg-black/5' : ''}`}
          >
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="min-w-0 flex-1 truncate text-ink" title={d.name}>{d.name}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">
              {d.value}
              <span className="ml-1 font-normal text-ink-light">({Math.round((d.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
