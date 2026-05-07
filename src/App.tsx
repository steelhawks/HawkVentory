import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { hasSupabaseConfig } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Inventory from './pages/Inventory'
import ItemEdit from './pages/ItemEdit'
import MapView from './pages/MapView'
import Locations from './pages/Locations'
import Boms from './pages/Boms'
import BomDetail from './pages/BomDetail'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function FullScreenSpinner() {
  return (
    <div className="min-h-screen grid place-items-center text-zinc-500 text-sm">
      Loading…
    </div>
  )
}

function SetupScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-hawk-500 grid place-items-center ring-1 ring-hawk-400/30">
            <img src={`${import.meta.env.BASE_URL}hawk.svg`} alt="" className="w-8 h-4 hawk-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">HawkVentory</h1>
            <p className="text-xs text-hawk-400 uppercase tracking-wider">Team 2601 — setup needed</p>
          </div>
        </div>
        <p className="text-sm text-zinc-300 mb-3">Supabase environment variables are missing. To finish setup:</p>
        <ol className="text-sm text-zinc-400 space-y-2 list-decimal list-inside">
          <li>In the project root, copy <code className="px-1 rounded bg-zinc-800">.env.example</code> to <code className="px-1 rounded bg-zinc-800">.env</code></li>
          <li>Fill in <code className="px-1 rounded bg-zinc-800">VITE_SUPABASE_URL</code> and <code className="px-1 rounded bg-zinc-800">VITE_SUPABASE_ANON_KEY</code> (Supabase → Project Settings → API)</li>
          <li>Run the SQL in <code className="px-1 rounded bg-zinc-800">supabase/migrations/0001_init.sql</code> in your Supabase SQL Editor</li>
          <li>Restart the dev server (<code className="px-1 rounded bg-zinc-800">npm run dev</code>) — Vite only reads <code>.env</code> at startup</li>
        </ol>
      </div>
    </div>
  )
}

export default function App() {
  if (!hasSupabaseConfig) return <SetupScreen />

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Inventory />} />
          <Route path="boms" element={<Boms />} />
          <Route path="bom/:id" element={<BomDetail />} />
          <Route path="map" element={<MapView />} />
          <Route path="locations" element={<Locations />} />
          <Route path="item/:id" element={<ItemEdit />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
