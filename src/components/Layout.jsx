import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS } from '../data/constants'

const NAV_BY_ROLE = {
  user: [
    { to: '/', label: 'Tiket Saya' },
    { to: '/tickets/new', label: 'Buat Tiket' },
  ],
  support: [{ to: '/', label: 'Antrian Support' }],
  supervisor: [{ to: '/', label: 'Laporan & Analitik' }],
}

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const navItems = NAV_BY_ROLE[profile?.role] || []

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-display text-sm font-extrabold text-white">
                T
              </span>
              <span className="font-display text-lg font-bold tracking-tight text-ink">
                TiketPro
              </span>
            </div>
            <nav className="hidden gap-1 sm:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-ink-light hover:bg-brand-50 hover:text-ink'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-ink leading-tight">
                {profile?.full_name || '...'}
              </p>
              <p className="text-xs text-ink-light leading-tight">
                {ROLE_LABELS[profile?.role] || ''} · {profile?.companies?.name || ''}
              </p>
            </div>
            <button onClick={handleSignOut} className="btn-secondary !px-3 !py-2 text-xs">
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
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-light'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  )
}
