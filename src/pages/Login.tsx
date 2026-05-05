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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-hawk-400 grid place-items-center">
            <svg viewBox="0 0 32 32" className="w-7 h-7"><path d="M8 22 L16 8 L24 22 L20 22 L16 16 L12 22 Z" fill="#0a0a0a"/></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">HawkVentory</h1>
            <p className="text-xs text-zinc-400">Team 2601 Steel Hawks</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email" required autoComplete="email" placeholder="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none"
          />
          <input
            type="password" required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none"
          />
          <button
            type="submit" disabled={busy}
            className="w-full py-3 rounded-lg bg-hawk-400 text-zinc-950 font-semibold disabled:opacity-50"
          >
            {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {info && <p className="mt-3 text-sm text-emerald-400">{info}</p>}

        <button
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null) }}
          className="mt-6 w-full text-sm text-zinc-400 hover:text-zinc-200"
        >
          {mode === 'signin' ? "New to the team? Create an account" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
