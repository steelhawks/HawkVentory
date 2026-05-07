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
          className="px-4 py-2 rounded-full bg-hawk-500 hover:bg-hawk-400 text-white font-semibold text-sm transition shadow-lg shadow-hawk-900/30">
          + Add
        </Link>
      </div>

      <div className="flex flex-col gap-2 mb-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search items…"
            className="flex-1 px-4 py-2.5 rounded-full bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none"
          />
          <select
            value={cat} onChange={(e) => setCat(e.target.value as Category | 'all')}
            className="px-4 py-2.5 rounded-full bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select
            value={bomFilter} onChange={(e) => setBomFilter(e.target.value)}
            className="px-4 py-2.5 rounded-full bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none"
          >
            <option value="all">All BOMs</option>
            <option value="unassigned">Not in any BOM</option>
            {boms.length > 0 && <option disabled>──────────</option>}
            {boms.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="flex gap-1 p-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs self-start">
          {(['all', 'in_use', 'available'] as const).map((opt) => (
            <button key={opt} onClick={() => setUseFilter(opt)}
              className={`px-3 py-1.5 rounded-full transition ${
                useFilter === opt ? 'bg-hawk-500 text-white' : 'text-zinc-400 hover:text-zinc-100'
              }`}>
              {opt === 'all' ? 'All' : opt === 'in_use' ? 'In use' : 'Available'}
            </button>
          ))}
        </div>
      </div>

      {activeBom && (
        <div className="mb-3 px-4 py-2 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-2">
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
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((it) => {
            const itemBomList = (itemBoms.get(it.id) ?? []).map((bid) => bomById.get(bid)).filter(Boolean)
            return (
              <li key={it.id} className="relative group rounded-3xl">
                <Link to={`/item/${it.id}`}
                  className={`relative block aspect-[4/3] rounded-3xl overflow-hidden isolate border transition shadow-lg shadow-black/30 ${
                    it.in_use
                      ? 'border-hawk-500/60 hover:border-hawk-400 ring-1 ring-hawk-500/40'
                      : 'border-zinc-800 hover:border-hawk-400'
                  }`}>
                  {/* Background: photo or stylized fallback */}
                  {it.photo_url ? (
                    <img src={it.photo_url} alt="" loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950">
                      <img src={`${import.meta.env.BASE_URL}hawk.svg`} alt=""
                        aria-hidden="true"
                        className="absolute -right-6 -bottom-4 w-44 opacity-[0.06] hawk-white pointer-events-none select-none" />
                      <div className="absolute inset-0 grid place-items-center text-zinc-700">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="w-12 h-12">
                          <path d="M3 7h4l2-3h6l2 3h4v12H3z" /><circle cx="12" cy="13" r="4" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Bottom-up dark scrim for text legibility */}
                  <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black via-black/85 to-transparent" />

                  {/* Top-right: quantity */}
                  <span className="absolute top-2 right-2 text-sm font-mono px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white border border-white/10">
                    ×{it.quantity}
                  </span>

                  {/* In-use ribbon (top-left, when active) */}
                  {it.in_use && (
                    <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full bg-hawk-500 text-white shadow-lg shadow-hawk-900/60">
                      In use
                    </span>
                  )}

                  {/* Bottom content */}
                  <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                    <div className="font-bold text-base leading-tight truncate" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                      {it.name}
                    </div>
                    <div className="mt-0.5 text-xs text-white/80 truncate flex items-center gap-2">
                      <span>{categoryLabel(it.category)}</span>
                      <span className="text-white/30">·</span>
                      <span className="truncate">📍 {locationPath(it.location_id, locations)}</span>
                    </div>
                    {itemBomList.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                        {itemBomList.slice(0, 3).map((b) => (
                          <span key={b!.id}
                            className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border backdrop-blur-sm ${bomColorChip(b!.color)}`}>
                            {b!.name}
                          </span>
                        ))}
                        {itemBomList.length > 3 && (
                          <span className="text-[10px] text-white/60">+{itemBomList.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>

                {/* Quick in-use toggle — bottom-right corner */}
                <button
                  onClick={(e) => { e.preventDefault(); toggleInUse(it.id, it.in_use) }}
                  title={it.in_use ? 'Mark as available' : 'Mark as in use'}
                  className={`absolute bottom-2 right-2 w-8 h-8 rounded-full grid place-items-center transition backdrop-blur-sm border ${
                    it.in_use
                      ? 'bg-hawk-500/90 text-white border-hawk-400 hover:bg-hawk-400'
                      : 'bg-black/50 text-white/70 border-white/10 hover:bg-black/70 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100'
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="w-4 h-4">
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
