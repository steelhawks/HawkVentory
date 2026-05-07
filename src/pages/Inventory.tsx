import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useItems, useLocations, useBoms, useAllBomItems,
  locationPath, CATEGORIES, categoryLabel, bomColorChip,
} from '../lib/data'
import type { Category } from '../lib/database.types'
import { supabase } from '../lib/supabase'

export default function Inventory() {
  const { items, loading, refresh: refreshItems } = useItems()
  const { locations } = useLocations()
  const { boms } = useBoms()
  const { bomItems } = useAllBomItems()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | 'all'>('all')
  const [bomFilter, setBomFilter] = useState<string>('all')         // bom id, 'all', 'unassigned'
  const [useFilter, setUseFilter] = useState<'all' | 'in_use' | 'available'>('all')

  // Map item.id → list of bom ids it belongs to
  const itemBoms = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const bi of bomItems) {
      if (!bi.item_id) continue
      const arr = m.get(bi.item_id) ?? []
      arr.push(bi.bom_id)
      m.set(bi.item_id, arr)
    }
    return m
  }, [bomItems])
  const bomById = useMemo(() => new Map(boms.map((b) => [b.id, b])), [boms])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter((it) => {
      if (cat !== 'all' && it.category !== cat) return false
      if (needle && !it.name.toLowerCase().includes(needle)) return false
      if (useFilter === 'in_use' && !it.in_use) return false
      if (useFilter === 'available' && it.in_use) return false
      if (bomFilter !== 'all') {
        const bomsForItem = itemBoms.get(it.id) ?? []
        if (bomFilter === 'unassigned') { if (bomsForItem.length > 0) return false }
        else if (!bomsForItem.includes(bomFilter)) return false
      }
      return true
    })
  }, [items, q, cat, useFilter, bomFilter, itemBoms])

  async function toggleInUse(id: string, current: boolean) {
    const { error } = await supabase.from('items').update({ in_use: !current }).eq('id', id)
    if (error) alert(error.message)
    else refreshItems()
  }

  const activeBom = bomFilter !== 'all' && bomFilter !== 'unassigned' ? bomById.get(bomFilter) ?? null : null

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold">Inventory</h1>
        <Link to="/item/new"
          className="px-4 py-2 rounded-lg bg-hawk-500 hover:bg-hawk-400 text-white font-semibold text-sm transition shadow-lg shadow-hawk-900/30">
          + Add
        </Link>
      </div>

      <div className="flex flex-col gap-2 mb-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search items…"
            className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none"
          />
          <select
            value={cat} onChange={(e) => setCat(e.target.value as Category | 'all')}
            className="px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select
            value={bomFilter} onChange={(e) => setBomFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none"
          >
            <option value="all">All BOMs</option>
            <option value="unassigned">Not in any BOM</option>
            {boms.length > 0 && <option disabled>──────────</option>}
            {boms.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs self-start">
          {(['all', 'in_use', 'available'] as const).map((opt) => (
            <button key={opt} onClick={() => setUseFilter(opt)}
              className={`px-3 py-1.5 rounded-md transition ${
                useFilter === opt ? 'bg-hawk-500 text-white' : 'text-zinc-400 hover:text-zinc-100'
              }`}>
              {opt === 'all' ? 'All' : opt === 'in_use' ? 'In use' : 'Available'}
            </button>
          ))}
        </div>
      </div>

      {activeBom && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-2">
          <div className="text-sm">
            Showing parts for{' '}
            <Link to={`/bom/${activeBom.id}`} className="font-semibold text-hawk-400 hover:underline">{activeBom.name}</Link>
            <span className="text-zinc-500"> · {filtered.length} item{filtered.length === 1 ? '' : 's'}</span>
          </div>
          <button onClick={() => setBomFilter('all')} className="text-xs text-zinc-400 hover:text-zinc-100">Clear</button>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="mb-2">No items yet.</p>
          <Link to="/item/new" className="text-hawk-400 underline">Add the first one →</Link>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((it) => {
            const itemBomList = (itemBoms.get(it.id) ?? []).map((bid) => bomById.get(bid)).filter(Boolean)
            return (
              <li key={it.id} className="relative">
                <Link to={`/item/${it.id}`}
                  className={`block p-4 rounded-xl bg-zinc-900 border transition ${
                    it.in_use ? 'border-hawk-500/50 hover:border-hawk-400' : 'border-zinc-800 hover:border-hawk-400'
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate flex items-center gap-2">
                        {it.name}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">{categoryLabel(it.category)}</div>
                    </div>
                    <span className="shrink-0 text-sm font-mono px-2 py-0.5 rounded bg-zinc-800">×{it.quantity}</span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-2 truncate">
                    📍 {locationPath(it.location_id, locations)}
                  </div>
                  {(it.in_use || itemBomList.length > 0) && (
                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                      {it.in_use && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-hawk-500/20 text-hawk-300 border border-hawk-500/40">
                          In use
                        </span>
                      )}
                      {itemBomList.slice(0, 3).map((b) => (
                        <span key={b!.id} className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${bomColorChip(b!.color)}`}>
                          {b!.name}
                        </span>
                      ))}
                      {itemBomList.length > 3 && (
                        <span className="text-[10px] text-zinc-500">+{itemBomList.length - 3}</span>
                      )}
                    </div>
                  )}
                </Link>
                <button
                  onClick={(e) => { e.preventDefault(); toggleInUse(it.id, it.in_use) }}
                  title={it.in_use ? 'Mark as available' : 'Mark as in use'}
                  className={`absolute top-2 right-2 w-7 h-7 rounded-md grid place-items-center transition ${
                    it.in_use
                      ? 'bg-hawk-500/20 text-hawk-300 hover:bg-hawk-500/30'
                      : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-4 h-4">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
