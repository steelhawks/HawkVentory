import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const navItems = [
  { to: '/',          label: 'Inventory', icon: BoxIcon },
  { to: '/boms',      label: 'BOMs',      icon: BomIcon },
  { to: '/map',       label: 'Map',       icon: MapIcon },
  { to: '/locations', label: 'Places',    icon: PinIcon },
]

export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:border-r md:border-zinc-900 md:p-4">
        <div className="flex items-center gap-2.5 mb-8 px-2">
          <div className="w-9 h-9 rounded-md bg-hawk-500 grid place-items-center shadow-lg shadow-hawk-900/40 ring-1 ring-hawk-400/30">
            <img src={`${import.meta.env.BASE_URL}hawk.svg`} alt="" className="w-6 h-3 hawk-white" />
          </div>
          <div>
            <div className="font-bold leading-tight">HawkVentory</div>
            <div className="text-[10px] uppercase tracking-wider text-hawk-400/80 font-semibold">Team 2601 · Steel Hawks</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  isActive ? 'bg-zinc-900 text-hawk-400' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                }`
              }>
              <Icon className="w-5 h-5" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-2 pt-4 border-t border-zinc-900">
          <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
          <button onClick={signOut} className="mt-2 text-xs text-zinc-400 hover:text-zinc-200">Sign out</button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 pt-safe pb-2 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-hawk-500 grid place-items-center ring-1 ring-hawk-400/30">
            <img src={`${import.meta.env.BASE_URL}hawk.svg`} alt="" className="w-5 h-2.5 hawk-white" />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-sm">HawkVentory</div>
            <div className="text-[9px] uppercase tracking-wider text-hawk-400/80">Team 2601</div>
          </div>
        </div>
        <button onClick={signOut} className="text-xs text-zinc-400">Sign out</button>
      </header>

      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-900 flex pb-safe">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                isActive ? 'text-hawk-400' : 'text-zinc-500'
              }`
            }>
            <Icon className="w-6 h-6" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function BoxIcon(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...p}>
      <path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" />
    </svg>
  )
}
function MapIcon(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...p}>
      <path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" />
    </svg>
  )
}
function PinIcon(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...p}>
      <path d="M12 22s7-7.5 7-13a7 7 0 10-14 0c0 5.5 7 13 7 13z" /><circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}
function BomIcon(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...p}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  )
}
