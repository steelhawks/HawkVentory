import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useItems, useLocations, locationPath, CATEGORIES, categoryLabel } from '../lib/data'
import type { Category } from '../lib/database.types'

export default function Inventory() {
  const { items, loading } = useItems()
  const { locations } = useLocations()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | 'all'>('all')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter((it) => {
      if (cat !== 'all' && it.category !== cat) return false
      if (needle && !it.name.toLowerCase().includes(needle)) return false
      return true
    })
  }, [items, q, cat])

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-bold">Inventory</h1>
        <Link to="/item/new"
          className="px-4 py-2 rounded-lg bg-hawk-400 text-zinc-950 font-semibold text-sm">
          + Add
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
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
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="mb-2">No items yet.</p>
          <Link to="/item/new" className="text-hawk-400 underline">Add the first one →</Link>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((it) => (
            <li key={it.id}>
              <Link to={`/item/${it.id}`}
                className="block p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-hawk-400 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{it.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{categoryLabel(it.category)}</div>
                  </div>
                  <span className="shrink-0 text-sm font-mono px-2 py-0.5 rounded bg-zinc-800">×{it.quantity}</span>
                </div>
                <div className="text-xs text-zinc-400 mt-2 truncate">
                  📍 {locationPath(it.location_id, locations)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
