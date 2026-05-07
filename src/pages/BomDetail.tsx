import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
  useBoms, useBomItems, useItems, useLocations, useProfiles, useAllItemStocks,
  CATEGORIES, BOM_COLORS, bomColorChip, categoryLabel, locationPath, profileLabel,
  adjustItemInUse,
} from '../lib/data'
import { CreatedBy } from '../components/CreatedBy'
import type { Bom, BomColor, BomItem, Item } from '../lib/database.types'

export default function BomDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { boms, refresh: refreshBoms } = useBoms()
  const { bomItems, refresh: refreshLines } = useBomItems(id ?? null)
  const { items, refresh: refreshItems } = useItems()
  const { locations } = useLocations()
  const { profiles } = useProfiles()
  const { stocks: allStocks } = useAllItemStocks()

  const stocksByItem = useMemo(() => {
    const m = new Map<string, typeof allStocks>()
    for (const s of allStocks) {
      const arr = m.get(s.item_id) ?? []
      arr.push(s); m.set(s.item_id, arr)
    }
    return m
  }, [allStocks])

  const bom = useMemo(() => boms.find((b) => b.id === id) ?? null, [boms, id])
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)

  // Filters within the BOM
  const [showInUseOnly, setShowInUseOnly] = useState<'all' | 'in_use' | 'available'>('all')

  const lines = useMemo(() => {
    return bomItems
      .map((bi) => ({ bi, item: bi.item_id ? itemById.get(bi.item_id) ?? null : null }))
      .filter(({ item }) => {
        if (showInUseOnly === 'all') return true
        if (!item) return showInUseOnly === 'available'  // wishlist lines never count as "in use"
        return showInUseOnly === 'in_use' ? item.in_use > 0 : item.in_use < item.quantity
      })
  }, [bomItems, itemById, showInUseOnly])

  const totals = useMemo(() => {
    let needed = 0, stock = 0, inUse = 0, available = 0, missing = 0
    for (const bi of bomItems) {
      needed += bi.quantity_needed
      const it = bi.item_id ? itemById.get(bi.item_id) : null
      if (!it) { missing += bi.quantity_needed; continue }
      stock += it.quantity
      inUse += it.in_use
      available += Math.max(0, it.quantity - it.in_use)
      if (it.quantity < bi.quantity_needed) missing += bi.quantity_needed - it.quantity
    }
    return { needed, stock, inUse, available, missing }
  }, [bomItems, itemById])

  if (!bom) {
    return (
      <div className="px-4 md:px-6 py-6">
        <button onClick={() => nav('/boms')} className="text-sm text-zinc-400 mb-3">← All BOMs</button>
        <p className="text-zinc-500">BOM not found.</p>
      </div>
    )
  }

  async function deleteBom() {
    if (!confirm(`Delete BOM "${bom!.name}"? Line items will be removed but inventory items are unaffected.`)) return
    const { error } = await supabase.from('boms').delete().eq('id', bom!.id)
    if (error) alert(error.message)
    else nav('/boms')
  }

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-4xl">
      <button onClick={() => nav('/boms')} className="text-sm text-zinc-400 mb-3">← All BOMs</button>

      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold truncate">{bom.name}</h1>
            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${bomColorChip(bom.color)}`}>
              {bom.color}
            </span>
          </div>
          {bom.description && <p className="text-sm text-zinc-400 mt-1">{bom.description}</p>}
          <div className="mt-1.5"><CreatedBy userId={bom.created_by ?? null} at={bom.created_at} verb="Created" /></div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setEditing(true)}
            className="px-3 py-2 rounded-lg border border-zinc-800 text-zinc-300 text-sm">Edit</button>
          <button onClick={deleteBom}
            className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 text-sm">Delete</button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <BigStat label="Lines"     value={bomItems.length} />
        <BigStat label="Needed"    value={totals.needed} />
        <BigStat label="In use"    value={totals.inUse}    tone={totals.inUse > 0 ? 'crimson' : 'neutral'} />
        <BigStat label="Available" value={totals.available} tone={totals.available > 0 ? 'emerald' : 'neutral'} />
        <BigStat label="Missing"   value={totals.missing}  tone={totals.missing > 0 ? 'crimson' : 'emerald'} />
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
          {(['all', 'in_use', 'available'] as const).map((opt) => (
            <button key={opt} onClick={() => setShowInUseOnly(opt)}
              className={`px-3 py-1.5 rounded-md transition ${
                showInUseOnly === opt ? 'bg-hawk-500 text-white' : 'text-zinc-400 hover:text-zinc-100'
              }`}>
              {opt === 'all' ? 'All' : opt === 'in_use' ? 'In use' : 'Available'}
            </button>
          ))}
        </div>
        <button onClick={() => setAdding(true)}
          className="px-3 py-2 rounded-lg bg-hawk-500 hover:bg-hawk-400 text-white font-semibold text-sm transition">
          + Add line
        </button>
      </div>

      {/* Lines */}
      {bomItems.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <p className="mb-2">No parts in this BOM yet.</p>
          <button onClick={() => setAdding(true)} className="text-hawk-400 underline">Add the first part →</button>
        </div>
      ) : (
        <ul className="space-y-2">
          {lines.map(({ bi, item }) => {
            const stocks = item ? (stocksByItem.get(item.id) ?? []) : []
            const placed = Array.from(new Set(stocks.map((s) => s.location_id).filter((x): x is string => !!x)))
            const locName =
              !item ? '' :
              placed.length === 0 ? 'Unassigned' :
              placed.length === 1 ? locationPath(placed[0], locations) :
              `${locationPath(placed[0], locations)} +${placed.length - 1} more`
            return (
              <Line key={bi.id} bi={bi} item={item} stocks={stocks}
                locationName={locName}
                addedBy={profileLabel(profiles, bi.created_by)}
                onLinesChanged={refreshLines}
                onItemsChanged={refreshItems} />
            )
          })}
        </ul>
      )}

      {editing && <EditBomModal bom={bom} onSaved={refreshBoms} onClose={() => setEditing(false)} />}
      {adding  && <AddLineModal bomId={bom.id} items={items} onSaved={refreshLines} onClose={() => setAdding(false)} />}
    </div>
  )
}

function BigStat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'crimson' | 'emerald' }) {
  const cls = tone === 'crimson' ? 'bg-hawk-500/15 text-hawk-300 border-hawk-500/30'
            : tone === 'emerald' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : 'bg-zinc-900 text-zinc-100 border-zinc-800'
  return (
    <div className={`rounded-lg p-2.5 text-center border ${cls}`}>
      <div className="text-xl font-mono font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
    </div>
  )
}

function Line({
  bi, item, stocks, locationName, addedBy, onLinesChanged, onItemsChanged,
}: {
  bi: BomItem
  item: Item | null
  stocks: import('../lib/database.types').ItemStock[]
  locationName: string
  addedBy: string
  onLinesChanged: () => void
  onItemsChanged: () => void
}) {
  const available = item ? Math.max(0, item.quantity - item.in_use) : 0
  const shortfall = item ? Math.max(0, bi.quantity_needed - item.quantity) : bi.quantity_needed
  const status = !item ? 'missing'
                : item.in_use >= item.quantity && item.quantity > 0 ? 'in_use'
                : item.in_use > 0 ? 'partial'
                : item.quantity >= bi.quantity_needed ? 'ok'
                : 'low'

  async function remove() {
    if (!confirm('Remove this line from the BOM?')) return
    const { error } = await supabase.from('bom_items').delete().eq('id', bi.id)
    if (error) alert(error.message)
    else onLinesChanged()
  }

  async function adjustInUse(delta: number) {
    if (!item) return
    await adjustItemInUse(stocks, delta)
    onItemsChanged()
  }

  return (
    <li className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
      <div className="flex items-start gap-3">
        <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
          status === 'ok'      ? 'bg-emerald-400' :
          status === 'in_use'  ? 'bg-hawk-400' :
          status === 'partial' ? 'bg-amber-400' :
          status === 'low'     ? 'bg-amber-400' :
                                 'bg-red-400'
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item ? (
              <Link to={`/item/${item.id}`} className="font-semibold truncate hover:text-hawk-400">{item.name}</Link>
            ) : (
              <span className="font-semibold text-zinc-300">{bi.label}</span>
            )}
            {item && item.in_use > 0 && (
              <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                item.in_use >= item.quantity
                  ? 'bg-hawk-500/20 text-hawk-300 border-hawk-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {item.in_use}/{item.quantity} in use
              </span>
            )}
            {!item && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
                Not in inventory
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {item && <span>{categoryLabel(item.category)}</span>}
            {item && locationName && <span>📍 {locationName}</span>}
            {bi.notes && <span className="italic">{bi.notes}</span>}
            <span>added by <span className="text-zinc-400">{addedBy}</span></span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-sm">
            <span className={item && item.quantity < bi.quantity_needed ? 'text-amber-400' : 'text-zinc-100'}>
              {item?.quantity ?? 0}
            </span>
            <span className="text-zinc-600"> / </span>
            <span className="text-zinc-400">{bi.quantity_needed}</span>
          </div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">stock / need</div>
          {shortfall > 0 && (
            <div className="text-[10px] text-red-400 mt-0.5">short {shortfall}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 pl-5">
        {item && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => adjustInUse(-1)} disabled={item.in_use <= 0}
              className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-sm font-bold grid place-items-center">−</button>
            <span className="text-xs font-mono text-zinc-300 min-w-[3rem] text-center">
              {item.in_use} <span className="text-zinc-600">/</span> {item.quantity}
            </span>
            <button onClick={() => adjustInUse(+1)} disabled={item.in_use >= item.quantity}
              className="w-7 h-7 rounded-full bg-hawk-500/80 hover:bg-hawk-500 disabled:opacity-30 text-sm font-bold text-white grid place-items-center">+</button>
            <span className="text-[10px] text-zinc-500 ml-1">{available} avail</span>
          </div>
        )}
        <button onClick={remove} className="text-xs text-red-400 hover:text-red-300 ml-auto">Remove</button>
      </div>
    </li>
  )
}

function EditBomModal({ bom, onSaved, onClose }: { bom: Bom; onSaved: () => void; onClose: () => void }) {
  const [name, setName] = useState(bom.name)
  const [description, setDescription] = useState(bom.description ?? '')
  const [color, setColor] = useState<BomColor>(bom.color)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { error } = await supabase.from('boms').update({
      name: name.trim(), description: description.trim() || null, color,
    }).eq('id', bom.id)
    setBusy(false)
    if (error) setErr(error.message)
    else { onSaved(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-md bg-zinc-950 border border-zinc-800 rounded-t-2xl md:rounded-2xl p-5">
        <h2 className="text-lg font-bold mb-3">Edit BOM</h2>
        <form onSubmit={save} className="space-y-3">
          <input required value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none" />
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description"
            className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none" />
          <div className="flex flex-wrap gap-2">
            {BOM_COLORS.map((c) => (
              <button type="button" key={c.value} onClick={() => setColor(c.value)}
                className={`px-2.5 py-1 text-xs rounded border ${c.chip} ${color === c.value ? 'ring-2 ' + c.ring : 'opacity-60'}`}>
                {c.label}
              </button>
            ))}
          </div>
          {err && <p className="text-sm text-red-400">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={busy}
              className="flex-1 py-2.5 rounded-lg bg-hawk-500 hover:bg-hawk-400 text-white font-semibold disabled:opacity-50 transition">
              {busy ? '…' : 'Save'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-zinc-800 text-zinc-300">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddLineModal({ bomId, items, onSaved, onClose }: { bomId: string; items: Item[]; onSaved: () => void; onClose: () => void }) {
  const { user } = useAuth()
  const [mode, setMode] = useState<'inventory' | 'wishlist'>('inventory')
  const [itemId, setItemId] = useState<string>('')
  const [label, setLabel] = useState('')
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((i) => {
      if (categoryFilter !== 'all' && i.category !== categoryFilter) return false
      if (q && !i.name.toLowerCase().includes(q)) return false
      return true
    }).slice(0, 200)
  }, [items, search, categoryFilter])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const payload: {
      bom_id: string
      item_id: string | null
      label: string | null
      quantity_needed: number
      notes: string | null
      created_by: string | null
    } =
      mode === 'inventory'
        ? { bom_id: bomId, item_id: itemId, label: null, quantity_needed: qty, notes: notes.trim() || null, created_by: user?.id ?? null }
        : { bom_id: bomId, item_id: null, label: label.trim(), quantity_needed: qty, notes: notes.trim() || null, created_by: user?.id ?? null }
    const { error } = await supabase.from('bom_items').insert(payload)
    setBusy(false)
    if (error) setErr(error.message)
    else { onSaved(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-lg bg-zinc-950 border border-zinc-800 rounded-t-2xl md:rounded-2xl p-5 max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-bold mb-3">Add line</h2>

        <div className="flex gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs mb-4">
          <button type="button" onClick={() => setMode('inventory')}
            className={`flex-1 px-3 py-1.5 rounded-md transition ${mode === 'inventory' ? 'bg-hawk-500 text-white' : 'text-zinc-400'}`}>
            From inventory
          </button>
          <button type="button" onClick={() => setMode('wishlist')}
            className={`flex-1 px-3 py-1.5 rounded-md transition ${mode === 'wishlist' ? 'bg-hawk-500 text-white' : 'text-zinc-400'}`}>
            Wishlist (not yet stocked)
          </button>
        </div>

        <form onSubmit={save} className="space-y-3">
          {mode === 'inventory' ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none" />
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none">
                  <option value="all">All categories</option>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="max-h-64 overflow-auto border border-zinc-800 rounded-lg divide-y divide-zinc-800">
                {filtered.length === 0 ? (
                  <p className="p-3 text-sm text-zinc-500 text-center">No matches</p>
                ) : filtered.map((i) => (
                  <button key={i.id} type="button" onClick={() => setItemId(i.id)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-zinc-900 transition ${
                      itemId === i.id ? 'bg-hawk-500/15' : ''
                    }`}>
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{i.name}</span>
                      <span className="block text-xs text-zinc-500">{categoryLabel(i.category)} · stock {i.quantity}</span>
                    </span>
                    {i.in_use > 0 && (
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                        i.in_use >= i.quantity
                          ? 'bg-hawk-500/20 text-hawk-300 border-hawk-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}>{i.in_use}/{i.quantity} in use</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. 16T 20DP gear"
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none" />
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Quantity needed</span>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none" />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Notes (optional)</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. driven side"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none" />
            </label>
          </div>

          {err && <p className="text-sm text-red-400">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={busy || (mode === 'inventory' && !itemId) || (mode === 'wishlist' && !label.trim())}
              className="flex-1 py-2.5 rounded-lg bg-hawk-500 hover:bg-hawk-400 text-white font-semibold disabled:opacity-50 transition">
              {busy ? '…' : 'Add to BOM'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-zinc-800 text-zinc-300">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
