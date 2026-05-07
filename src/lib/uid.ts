/**
 * Cross-context UUID generator.
 *
 * `crypto.randomUUID()` is only available in **secure contexts** (HTTPS or localhost).
 * GitHub Pages serves HTTPS by default but if a user lands on the http:// URL the
 * native function is undefined, which would crash anything that calls it. We use
 * crypto.randomUUID when available, fall back to a non-cryptographic Math.random
 * implementation otherwise. None of our use sites are security-sensitive — they're
 * just channel names and React keys.
 */
export function uid(): string {
  const c = (typeof crypto !== 'undefined' ? crypto : undefined) as
    | (Crypto & { randomUUID?: () => string })
    | undefined
  if (c?.randomUUID) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
