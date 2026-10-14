import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS } from '../data/constants'

// Ikon menu: garis tipis 24x24 (gaya Lucide), mengikuti warna teks menu.
const ICON_PATHS = {
  ticket: (
    <>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </>
  ),
  plus: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </>
  ),
  inbox: (
    <>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
}

function NavIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

const NAV_BY_ROLE = {
  user: [
    { to: '/', label: 'Tiket Saya', icon: 'ticket' },
    { to: '/tickets/new', label: 'Buat Tiket', icon: 'plus' },
  ],
  support: [
    { to: '/', label: 'Antrian Support', icon: 'inbox' },
  ],
  supervisor: [
    { to: '/', label: 'Laporan & Analitik', icon: 'chart' },
    { to: '/tickets/new', label: 'Buat Tiket', icon: 'plus' },
    { to: '/my-tickets', label: 'Tiket Saya', icon: 'ticket' },
    { to: '/queue', label: 'Antrian Support', icon: 'inbox' },
  ],
  superadmin: [
    { to: '/', label: 'Laporan & Analitik', icon: 'chart' },
    { to: '/tickets/new', label: 'Buat Tiket', icon: 'plus' },
    { to: '/my-tickets', label: 'Tiket Saya', icon: 'ticket' },
    { to: '/queue', label: 'Antrian Support', icon: 'inbox' },
    { to: '/admin/users', label: 'Administrasi Pengguna', icon: 'users' },
    { to: '/admin/support-contacts', label: 'Kontak Support', icon: 'phone' },
  ],
}

export default function Layout({ children }) {
  const { profile, profileError, loading, session, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const navItems = NAV_BY_ROLE[profile?.role] || []

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  // Sesi login berhasil tapi baris profil gagal/belum bisa dimuat.
  // Ditampilkan sebagai pesan yang jelas dengan opsi tindakan, bukan
  // spinner tak berujung.
  if (!loading && session && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="card max-w-sm p-6 text-center">
          <p className="mb-1 font-display text-lg font-bold text-ink">Gagal Memuat Profil</p>
          <p className="mb-4 text-sm text-ink-light">
            {profileError || 'Akun Anda belum memiliki data profil di database.'}
          </p>
          <div className="flex justify-center gap-2">
            <button onClick={refreshProfile} className="btn-secondary">
              Coba Lagi
            </button>
            <button onClick={handleSignOut} className="btn-primary">
              Keluar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="FixHub" className="h-8 w-8 object-contain" />
              <span className="font-display text-lg font-bold tracking-tight text-ink">
                FixHub
              </span>
            </div>
            <nav className="hidden gap-1 sm:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-ink-light hover:bg-brand-50 hover:text-ink'
                    }`
                  }
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* Nama & role pengguna yang login — tampil juga di mobile
                (teks dipotong "…" kalau nama terlalu panjang). */}
            <div className="min-w-0 max-w-[8.5rem] text-right sm:max-w-none">
              <p className="truncate text-xs font-semibold leading-tight text-ink sm:text-sm">
                {profile?.full_name || '...'}
              </p>
              <p className="truncate text-[11px] leading-tight text-ink-light sm:text-xs">
                {ROLE_LABELS[profile?.role] || ''}
              </p>
            </div>
            <button onClick={handleSignOut} className="btn-secondary shrink-0 !px-3 !py-2 text-xs">
              Keluar
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-brand-50 px-5 py-2 sm:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-light'
                }`
              }
            >
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  )
}
