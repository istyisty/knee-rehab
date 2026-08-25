import { Suspense, lazy } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { configured } from './lib/supabase'
import { Spinner } from './components/ui'
import Home from './pages/Home'
import SessionPage from './pages/Session'
import History from './pages/History'
import Runs from './pages/Runs'
// Charts are the heaviest dependency in the app — keep them off the first paint.
const Progress = lazy(() => import('./pages/Progress'))
import Settings from './pages/Settings'
const Report = lazy(() => import('./pages/Report'))

const TABS = [
  { to: '/', label: 'Today', icon: HomeIcon },
  { to: '/history', label: 'History', icon: ListIcon },
  { to: '/runs', label: 'Runs', icon: RunIcon },
  { to: '/progress', label: 'Progress', icon: ChartIcon },
]

export default function App() {
  const { pathname } = useLocation()
  const hideNav = pathname.startsWith('/session/') || pathname.startsWith('/report')

  if (!configured) return <NotConfigured />

  return (
    <div className="min-h-full flex flex-col">
      <main className={`flex-1 ${hideNav ? '' : 'pb-32'}`}>
        <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/session/:id" element={<SessionPage />} />
          <Route path="/history" element={<History />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/report" element={<Report />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>

      {!hideNav && (
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-ink-950/90 backdrop-blur-xl border-t border-ink-800 pb-dock">
          <div className="mx-auto max-w-md grid grid-cols-4">
            {TABS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to} to={to} end={to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition ${
                    isActive ? 'text-mint-400' : 'text-ink-500'
                  }`
                }
              >
                {({ isActive }) => (<><Icon active={isActive} />{label}</>)}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

function NotConfigured() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="card p-6 max-w-sm text-center">
        <h1 className="font-bold text-lg">Not connected</h1>
        <p className="mt-2 text-sm text-ink-500 leading-relaxed">
          The Supabase environment variables are missing. Set <code className="text-mint-400">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-mint-400">VITE_SUPABASE_ANON_KEY</code> in Netlify, then redeploy.
        </p>
      </div>
    </div>
  )
}

/* --- icons: 24px stroke, filled when active --- */
type IconProps = { active?: boolean }
const base = 'h-6 w-6'

function HomeIcon({ active }: IconProps) {
  return (
    <svg className={base} viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : 0.9}>
      <path d="M3 10.5 12 3l9 7.5" fill="none" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
    </svg>
  )
}
function ListIcon() {
  return (
    <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  )
}
function RunIcon() {
  return (
    <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="14.5" cy="4.5" r="1.9" />
      <path d="M12.8 8.4 9.5 10.7l1.9 3.1-1.2 5.6M11.4 13.8l3.6 1.4 1.5 4.2M12.8 8.4l3.4-.6 2.3 3.2 2.3.5M9.5 10.7 6.4 11l-1.3 2.6" />
    </svg>
  )
}
function ChartIcon() {
  return (
    <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V4M4 20h16" />
      <path d="M7.5 16.5 11 12l3 2.5 4.5-6" />
    </svg>
  )
}
