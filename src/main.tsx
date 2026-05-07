// Polyfill crypto.randomUUID for non-secure contexts (plain HTTP).
// Supabase's realtime client calls this directly, so patching only our own
// usage isn't enough — we need it on the global crypto object.
if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID !== 'function') {
  const polyfill = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = (Math.random() * 16) | 0
      const v = ch === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  // Cast through unknown — the native type signature uses a template-literal type
  // we can't satisfy without `as const`, but the runtime shape is identical.
  ;(window.crypto as unknown as { randomUUID: () => string }).randomUUID = polyfill
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
