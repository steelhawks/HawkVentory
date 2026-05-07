import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (loading) return null
  if (session) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setInfo(null)
    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    else if (mode === 'signup') setInfo('Check your email to confirm your account.')
    setBusy(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Backdrop hawk */}
      <img
        src={`${import.meta.env.BASE_URL}hawk.svg`} alt=""
        aria-hidden="true"
        className="absolute -right-32 -bottom-24 w-[900px] max-w-none opacity-[0.04] pointer-events-none select-none"
      />

      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-hawk-500 grid place-items-center ring-1 ring-hawk-400/40 shadow-2xl shadow-hawk-900/50 mb-4">
            <img src={`${import.meta.env.BASE_URL}hawk.svg`} alt="Steel Hawks" className="w-14 h-7 hawk-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">HawkVentory</h1>
          <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-hawk-400 font-semibold">
            <span className="h-px w-6 bg-hawk-400/40" />
            Team 2601 · Steel Hawks
            <span className="h-px w-6 bg-hawk-400/40" />
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email" required autoComplete="email" placeholder="team email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-zinc-900/80 border border-zinc-800 focus:border-hawk-400 focus:ring-2 focus:ring-hawk-400/20 focus:outline-none transition"
          />
          <input
            type="password" required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-zinc-900/80 border border-zinc-800 focus:border-hawk-400 focus:ring-2 focus:ring-hawk-400/20 focus:outline-none transition"
          />
          <button
            type="submit" disabled={busy}
            className="w-full py-3 rounded-lg bg-hawk-500 hover:bg-hawk-400 text-white font-semibold disabled:opacity-50 transition shadow-lg shadow-hawk-900/40"
          >
            {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {info && <p className="mt-3 text-sm text-emerald-400">{info}</p>}

        <button
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null) }}
          className="mt-6 w-full text-sm text-zinc-400 hover:text-hawk-400 transition"
        >
          {mode === 'signin' ? "New to the team? Create an account" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
