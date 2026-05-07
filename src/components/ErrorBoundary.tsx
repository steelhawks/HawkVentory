import { Component, type ReactNode } from 'react'

/**
 * Top-level error boundary. Without this, an uncaught render-time error blanks the whole page.
 * In production this surfaces a clear message; in dev you'll still see the full stack in the console.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('App error boundary caught:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-lg w-full p-6 rounded-2xl bg-zinc-900 border border-red-500/40">
          <h1 className="text-lg font-bold text-red-400 mb-2">Something broke</h1>
          <p className="text-sm text-zinc-300 mb-3">
            {this.state.error.message || 'An unexpected error occurred.'}
          </p>
          <button onClick={() => { this.setState({ error: null }); location.reload() }}
            className="px-4 py-2 rounded-full bg-hawk-500 hover:bg-hawk-400 text-white font-semibold text-sm">
            Reload
          </button>
        </div>
      </div>
    )
  }
}
