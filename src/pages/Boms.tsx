import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useBoms, useAllBomItems, useItems, useProfiles, BOM_COLORS, bomColorChip, profileLabel } from '../lib/data'
import type { BomColor } from '../lib/database.types'

export default function Boms() {
  const { boms, loading, refresh: refreshBoms } = useBoms()
  const { bomItems } = useAllBomItems()
  const { items } = useItems()
  const { profiles } = useProfiles()
  const [showNew, setShowNew] = useState(false)

  const stats = useMemo(() => {
    const m = new Map<string, { lines: number; needed: number; inUse: number; inStock: number }>()
    for (const b of boms) m.set(b.id, { lines: 0, needed: 0, inUse: 0, inStock: 0 })
    const itemById = new Map(items.map((i) => [i.id, i]))
    for (const bi of bomItems) {
      const s = m.get(bi.bom_id); if (!s) continue
      s.lines += 1
      s.needed += bi.quantity_needed
      const it = bi.item_id ? itemById.get(bi.item_id) : undefined
      if (it) {
        s.inStock += it.quantity
        s.inUse += it.in_use   // sum the unit count, not just "is any in use"
      }
    }
    return m
  }, [boms, bomItems, items])

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl md:text-3xl font-bold">Bills of Materials</h1>
        <button onClick={() => setShowNew(true)}
          className="px-4 py-2 rounded-lg bg-hawk-500 hover:bg-hawk-400 text-white font-semibold text-sm transition shadow-lg shadow-hawk-900/30">
          + New BOM
        </button>
      </div>
      <p className="text-sm text-zinc-500 mb-4">Group parts by subsystem — Intake, Drivetrain, Elevator, etc.</p>

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : boms.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="mb-2">No BOMs yet.</p>
          <button onClick={() => setShowNew(true)} className="text-hawk-400 underline">Create your first BOM →</button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boms.map((b) => {
            const s = stats.get(b.id) ?? { lines: 0, needed: 0, inUse: 0, inStock: 0 }
            return (
              <li key={b.id}>
                <Link to={`/bom/${b.id}`}
                  className="block p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-hawk-400 transition">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{b.name}</div>
                      {b.description && <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{b.description}</div>}
                    </div>
                    <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${bomColorChip(b.color)}`}>
                      {b.color}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">
                    by <span className="text-zinc-400">{profileLabel(profiles, b.created_by)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <Stat label="Lines"   value={s.lines} />
                    <Stat label="Stock"   value={s.inStock} />
                    <Stat label="In use"  value={s.inUse} accent={s.inUse > 0} />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {showNew && <NewBomModal onSaved={refreshBoms} onClose={() => setShowNew(false)} />}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg py-1.5 ${accent ? 'bg-hawk-500/15 text-hawk-300' : 'bg-zinc-950'}`}>
      <div className="text-base font-mono font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  )
}

function NewBomModal({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<BomColor>('crimson')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { error } = await supabase.from('boms').insert({
      name: name.trim(),
      description: description.trim() || null,
      color,
      created_by: user?.id ?? null,
    })
    setBusy(false)
    if (error) setErr(error.message)
    else { onSaved(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-md bg-zinc-950 border border-zinc-800 rounded-t-2xl md:rounded-2xl p-5">
        <h2 className="text-lg font-bold mb-3">New BOM</h2>
        <form onSubmit={save} className="space-y-3">
          <label className="block">
            <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Name</span>
            <input required autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Intake 2026, Drivetrain, Climber"
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none" />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Description (optional)</span>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none" />
          </label>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5">Color</div>
            <div className="flex flex-wrap gap-2">
              {BOM_COLORS.map((c) => (
                <button type="button" key={c.value} onClick={() => setColor(c.value)}
                  className={`px-2.5 py-1 text-xs rounded border ${c.chip} ${color === c.value ? 'ring-2 ' + c.ring : 'opacity-60'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          {err && <p className="text-sm text-red-400">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={busy}
              className="flex-1 py-2.5 rounded-lg bg-hawk-500 hover:bg-hawk-400 text-white font-semibold disabled:opacity-50 transition">
              {busy ? '…' : 'Create'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-zinc-800 text-zinc-300">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
