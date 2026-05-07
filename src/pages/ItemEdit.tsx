import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useLocations, useItems, useItemPhotos, useItemStocks, CATEGORIES, locationPath } from '../lib/data'
import { uploadItemPhoto, deleteItemPhoto } from '../lib/photo'
import { CreatedBy } from '../components/CreatedBy'
import type { Category, Item, ItemPhoto, ItemStock, Location } from '../lib/database.types'

export default function ItemEdit() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const nav = useNavigate()
  const { user } = useAuth()
  const { items } = useItems()
  const { locations } = useLocations()

  const existing = useMemo(() => items.find((i) => i.id === id), [items, id])
  const { photos: existingPhotos } = useItemPhotos(isNew ? null : (id ?? null))
  const { stocks: existingStocks, refresh: refreshStocks } = useItemStocks(isNew ? null : (id ?? null))

  const [form, setForm] = useState<Partial<Item>>({
    name: '', category: 'tool', notes: '', photo_url: null,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Pending NEW stock rows (only used when creating a new item — saved on first insert).
  interface PendingStock { key: string; location_id: string | null; quantity: number; in_use: number }
  const [pendingStocks, setPendingStocks] = useState<PendingStock[]>([
    { key: crypto.randomUUID(), location_id: null, quantity: 1, in_use: 0 },
  ])

  // Pending uploads: chosen but not yet committed (uploaded on save).
  interface PendingPhoto { key: string; file: File; preview: string }
  const [pending, setPending] = useState<PendingPhoto[]>([])
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (existing) setForm(existing)
  }, [existing])

  // Revoke preview object URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => { pending.forEach((p) => URL.revokeObjectURL(p.preview)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onPickFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    const additions: PendingPhoto[] = files.map((f) => ({
      key: crypto.randomUUID(),
      file: f,
      preview: URL.createObjectURL(f),
    }))
    setPending((p) => [...p, ...additions])
    e.target.value = ''
  }

  function discardPending(key: string) {
    setPending((p) => {
      const target = p.find((x) => x.key === key)
      if (target) URL.revokeObjectURL(target.preview)
      return p.filter((x) => x.key !== key)
    })
  }

  async function deleteExistingPhoto(photo: ItemPhoto) {
    if (!confirm('Delete this photo?')) return
    setPhotoBusy(true)
    try {
      const { error } = await supabase.from('item_photos').delete().eq('id', photo.id)
      if (error) throw error
      await deleteItemPhoto(photo.url)
    } catch (e: unknown) {
      const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'Failed to remove'
      setErr(msg)
    } finally {
      setPhotoBusy(false)
    }
  }

  /** Move a photo to sort_order = 0 (and bump everything else). The trigger updates items.photo_url. */
  async function makePrimary(photo: ItemPhoto) {
    setPhotoBusy(true)
    try {
      const others = existingPhotos.filter((p) => p.id !== photo.id)
      // Two passes to avoid violating any future unique(item_id, sort_order) — write target last.
      for (let i = 0; i < others.length; i++) {
        const target = i + 1
        if (others[i].sort_order !== target) {
          await supabase.from('item_photos').update({ sort_order: target }).eq('id', others[i].id)
        }
      }
      if (photo.sort_order !== 0) {
        await supabase.from('item_photos').update({ sort_order: 0 }).eq('id', photo.id)
      }
    } finally {
      setPhotoBusy(false)
    }
  }

  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) =>
      locationPath(a.id, locations).localeCompare(locationPath(b.id, locations)),
    )
  }, [locations])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      // Save (or insert) the item first — we need its id to attach photos and stocks.
      // items.quantity/in_use/location_id are derived: pass 0/null on insert; the DB
      // trigger will update them when stocks are inserted below.
      let itemId = id ?? null
      if (isNew) {
        const { data, error } = await supabase.from('items').insert({
          name: form.name!.trim(),
          category: form.category as Category,
          quantity: 0,
          location_id: null,
          notes: form.notes ?? null,
          in_use: 0,
          created_by: user?.id ?? null,
        }).select('id').single()
        if (error) throw error
        itemId = data.id

        // Insert any stocks the user filled in on the create form.
        for (const s of pendingStocks) {
          if (s.quantity <= 0 && s.in_use <= 0) continue
          const cleanIn = Math.max(0, Math.min(s.quantity, s.in_use))
          const { error: e } = await supabase.from('item_stocks').insert({
            item_id: itemId,
            location_id: s.location_id,
            quantity: s.quantity,
            in_use: cleanIn,
            created_by: user?.id ?? null,
          })
          if (e) throw e
        }
      } else {
        const { error } = await supabase.from('items').update({
          name: form.name!.trim(),
          category: form.category as Category,
          notes: form.notes ?? null,
        }).eq('id', id!)
        if (error) throw error
      }

      // Upload all pending photos and append to the gallery.
      if (pending.length > 0 && itemId) {
        const lastOrder = existingPhotos.length > 0 ? existingPhotos[existingPhotos.length - 1].sort_order : -1
        const startOrder = lastOrder + 1
        for (let i = 0; i < pending.length; i++) {
          const url = await uploadItemPhoto(pending[i].file)
          const { error } = await supabase.from('item_photos').insert({
            item_id: itemId,
            url,
            sort_order: startOrder + i,
            created_by: user?.id ?? null,
          })
          if (error) throw error
        }
      }

      nav('/')
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) :
        e instanceof Error ? e.message : 'Failed to save'
      setErr(msg)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!id || isNew) return
    if (!confirm(`Delete "${existing?.name}"? This can't be undone.`)) return
    setBusy(true)
    const urlsToClean = existingPhotos.map((p) => p.url)
    const { error } = await supabase.from('items').delete().eq('id', id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    // Storage cleanup is best-effort — DB rows are already gone via cascade.
    for (const u of urlsToClean) await deleteItemPhoto(u)
    nav('/')
  }

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-2xl">
      <button onClick={() => nav(-1)} className="text-sm text-zinc-400 mb-3">← Back</button>
      <h1 className="text-2xl md:text-3xl font-bold">{isNew ? 'New item' : 'Edit item'}</h1>
      {!isNew && existing && (
        <div className="mb-4 mt-1"><CreatedBy userId={existing.created_by ?? null} at={existing.created_at} /></div>
      )}
      {isNew && <div className="mb-4" />}

      <form onSubmit={save} className="space-y-3">
        <Field label="Name">
          <input required value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls} />
        </Field>

        <Field label="Category">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
            className={inputCls}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>

        {/* Stocks: per-location quantity + in-use editor */}
        {isNew ? (
          <PendingStocksEditor
            stocks={pendingStocks} setStocks={setPendingStocks}
            sortedLocations={sortedLocations} locations={locations}
          />
        ) : (
          <ExistingStocksEditor
            itemId={id!} stocks={existingStocks} refresh={refreshStocks}
            userId={user?.id ?? null}
            sortedLocations={sortedLocations} locations={locations}
          />
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Photos (optional)</div>
            {(existingPhotos.length + pending.length) > 0 && (
              <div className="text-[10px] text-zinc-600">{existingPhotos.length + pending.length} total · first is primary</div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple
            onChange={onPickFiles} className="hidden" />

          {existingPhotos.length === 0 && pending.length === 0 ? (
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-6 rounded-2xl border-2 border-dashed border-zinc-800 hover:border-hawk-400 hover:bg-zinc-900/50 text-zinc-400 hover:text-zinc-100 transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
                <path d="M3 7h4l2-3h6l2 3h4v12H3z" /><circle cx="12" cy="13" r="4" />
              </svg>
              <span className="text-sm">Take or choose photos</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {existingPhotos.map((p, idx) => (
                <div key={p.id}
                  className={`relative aspect-square rounded-2xl overflow-hidden border bg-zinc-900 group/photo ${
                    idx === 0 ? 'border-hawk-500/50 ring-1 ring-hawk-500/30' : 'border-zinc-800'
                  }`}>
                  <img src={p.url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  {idx === 0 && (
                    <span className="absolute top-1.5 left-1.5 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full bg-hawk-500 text-white">
                      Primary
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover/photo:bg-black/40 transition flex items-end justify-end p-1.5 gap-1 opacity-0 group-hover/photo:opacity-100 focus-within:opacity-100">
                    {idx !== 0 && (
                      <button type="button" onClick={() => makePrimary(p)} disabled={photoBusy}
                        title="Make primary"
                        className="px-2 py-1 text-[10px] rounded-full bg-zinc-950/80 backdrop-blur border border-zinc-700 text-zinc-100 hover:border-hawk-400">
                        ★
                      </button>
                    )}
                    <button type="button" onClick={() => deleteExistingPhoto(p)} disabled={photoBusy}
                      title="Delete photo"
                      className="px-2 py-1 text-[10px] rounded-full bg-red-500/90 text-white">
                      ×
                    </button>
                  </div>
                </div>
              ))}
              {pending.map((p) => (
                <div key={p.key} className="relative aspect-square rounded-2xl overflow-hidden border border-hawk-500/40 bg-zinc-900">
                  <img src={p.preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <span className="absolute top-1.5 left-1.5 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full bg-hawk-500/90 text-white">
                    New
                  </span>
                  <button type="button" onClick={() => discardPending(p.key)}
                    title="Discard"
                    className="absolute bottom-1.5 right-1.5 px-2 py-1 text-[10px] rounded-full bg-red-500/90 text-white">
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-2xl border-2 border-dashed border-zinc-800 hover:border-hawk-400 hover:bg-zinc-900/50 text-zinc-500 hover:text-zinc-200 transition flex flex-col items-center justify-center gap-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-7 h-7">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="text-[10px] uppercase tracking-wider">Add</span>
              </button>
            </div>
          )}
        </div>

        <Field label="Notes">
          <textarea rows={3} value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={inputCls} />
        </Field>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={busy}
            className="flex-1 py-3 rounded-lg bg-hawk-500 hover:bg-hawk-400 text-white font-semibold disabled:opacity-50 transition shadow-lg shadow-hawk-900/30">
            {busy ? '…' : isNew ? 'Create' : 'Save'}
          </button>
          {!isNew && (
            <button type="button" onClick={remove} disabled={busy}
              className="px-4 py-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30">
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-hawk-400 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">{label}</span>
      {children}
    </label>
  )
}

/* ----- Stocks: per-location editors (one for new items, one for existing) ----- */

interface PendingStock { key: string; location_id: string | null; quantity: number; in_use: number }

function PendingStocksEditor({
  stocks, setStocks, sortedLocations, locations,
}: {
  stocks: PendingStock[]
  setStocks: (s: PendingStock[]) => void
  sortedLocations: Location[]
  locations: Location[]
}) {
  function update(idx: number, patch: Partial<PendingStock>) {
    const next = [...stocks]
    const merged = { ...next[idx], ...patch }
    if (merged.in_use > merged.quantity) merged.in_use = merged.quantity
    if (merged.in_use < 0) merged.in_use = 0
    if (merged.quantity < 0) merged.quantity = 0
    next[idx] = merged
    setStocks(next)
  }
  function add() {
    setStocks([...stocks, { key: crypto.randomUUID(), location_id: null, quantity: 1, in_use: 0 }])
  }
  function remove(idx: number) {
    setStocks(stocks.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs uppercase tracking-wide text-zinc-500">Stocks</div>
        <button type="button" onClick={add}
          className="text-xs px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 hover:border-hawk-400 text-zinc-300">
          + Add stock
        </button>
      </div>
      <div className="space-y-2">
        {stocks.length === 0 && (
          <div className="text-xs text-zinc-500 italic px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800">
            No stock yet — add one to record where the units live.
          </div>
        )}
        {stocks.map((s, i) => (
          <StockRow key={s.key}
            locationId={s.location_id} quantity={s.quantity} inUse={s.in_use}
            sortedLocations={sortedLocations} locations={locations}
            onChange={(p) => update(i, p)}
            onRemove={() => remove(i)}
            removable={stocks.length > 1}
          />
        ))}
      </div>
    </div>
  )
}

function ExistingStocksEditor({
  itemId, stocks, refresh, userId, sortedLocations, locations,
}: {
  itemId: string
  stocks: ItemStock[]
  refresh: () => void
  userId: string | null
  sortedLocations: Location[]
  locations: Location[]
}) {
  const [busy, setBusy] = useState(false)

  async function persist(stockId: string, patch: Partial<Pick<ItemStock, 'location_id' | 'quantity' | 'in_use'>>) {
    setBusy(true)
    const { error } = await supabase.from('item_stocks').update(patch).eq('id', stockId)
    setBusy(false)
    if (error) alert(error.message); else refresh()
  }

  async function add() {
    setBusy(true)
    const { error } = await supabase.from('item_stocks').insert({
      item_id: itemId, location_id: null, quantity: 1, in_use: 0, created_by: userId,
    })
    setBusy(false)
    if (error) alert(error.message); else refresh()
  }

  async function remove(stockId: string) {
    if (!confirm('Remove this stock entry?')) return
    setBusy(true)
    const { error } = await supabase.from('item_stocks').delete().eq('id', stockId)
    setBusy(false)
    if (error) alert(error.message); else refresh()
  }

  const totalQty   = stocks.reduce((a, s) => a + s.quantity, 0)
  const totalInUse = stocks.reduce((a, s) => a + s.in_use,   0)

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs uppercase tracking-wide text-zinc-500">Stocks</div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">
            <span className="text-zinc-200 font-mono">{totalInUse}</span> in use ·
            <span className="text-zinc-200 font-mono"> {Math.max(0, totalQty - totalInUse)}</span> available ·
            <span className="text-zinc-200 font-mono"> {totalQty}</span> total
          </span>
          <button type="button" onClick={add} disabled={busy}
            className="text-xs px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 hover:border-hawk-400 text-zinc-300 disabled:opacity-50">
            + Add stock
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {stocks.length === 0 && (
          <div className="text-xs text-zinc-500 italic px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800">
            No stock recorded — add one to mark where the units live.
          </div>
        )}
        {stocks.map((s) => (
          <StockRow key={s.id}
            locationId={s.location_id} quantity={s.quantity} inUse={s.in_use}
            sortedLocations={sortedLocations} locations={locations}
            onChange={(p) => {
              // Clamp client-side so the trigger never sees in_use > quantity
              const next: typeof p = { ...p }
              const q = next.quantity ?? s.quantity
              const u = next.in_use ?? s.in_use
              if (u > q) next.in_use = q
              persist(s.id, next)
            }}
            onRemove={() => remove(s.id)}
            removable
            disabled={busy}
          />
        ))}
      </div>
    </div>
  )
}

function StockRow({
  locationId, quantity, inUse, sortedLocations, locations,
  onChange, onRemove, removable, disabled,
}: {
  locationId: string | null
  quantity: number
  inUse: number
  sortedLocations: Location[]
  locations: Location[]
  onChange: (patch: { location_id?: string | null; quantity?: number; in_use?: number }) => void
  onRemove: () => void
  removable: boolean
  disabled?: boolean
}) {
  const available = Math.max(0, quantity - inUse)
  const fully     = quantity > 0 && inUse === quantity
  const partial   = inUse > 0 && inUse < quantity
  return (
    <div className={`p-3 rounded-2xl border transition ${
      fully   ? 'bg-hawk-500/10 border-hawk-500/40' :
      partial ? 'bg-amber-500/5 border-amber-500/30' :
                'bg-zinc-900 border-zinc-800'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <select value={locationId ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({ location_id: e.target.value || null })}
          className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-hawk-400 focus:outline-none text-sm">
          <option value="">— Unassigned —</option>
          {sortedLocations.map((l) => (
            <option key={l.id} value={l.id}>{locationPath(l.id, locations)}</option>
          ))}
        </select>
        {removable && (
          <button type="button" onClick={onRemove} disabled={disabled}
            title="Remove stock"
            className="w-9 h-9 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 grid place-items-center">
            ×
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stepper label="Quantity" value={quantity} min={Math.max(inUse, 0)}
          onChange={(n) => onChange({ quantity: n })} disabled={disabled} />
        <Stepper label="In use" value={inUse} min={0} max={quantity}
          onChange={(n) => onChange({ in_use: n })} disabled={disabled} accent />
      </div>
      <div className="flex items-center gap-2 text-xs mt-2">
        <span className={`px-2 py-0.5 rounded-full ${
          inUse > 0 ? 'bg-hawk-500/20 text-hawk-300 border border-hawk-500/40' : 'bg-zinc-800 text-zinc-500'
        }`}>
          {inUse} in use
        </span>
        <span className={`px-2 py-0.5 rounded-full ${
          available > 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-zinc-800 text-zinc-500'
        }`}>
          {available} available
        </span>
      </div>
    </div>
  )
}

function Stepper({
  label, value, onChange, min = 0, max, disabled, accent,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  disabled?: boolean
  accent?: boolean
}) {
  const cap = (n: number) => Math.max(min, max != null ? Math.min(max, n) : n)
  const decBtn = 'w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-sm font-bold grid place-items-center'
  const incBtn = accent
    ? 'w-7 h-7 rounded-full bg-hawk-500/80 hover:bg-hawk-500 disabled:opacity-30 text-sm font-bold text-white grid place-items-center'
    : 'w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-sm font-bold grid place-items-center'
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(cap(value - 1))} disabled={disabled || value <= min} className={decBtn}>−</button>
        <input type="number" value={value} min={min} max={max}
          disabled={disabled}
          onChange={(e) => onChange(cap(Number(e.target.value)))}
          className="w-12 text-center px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-mono text-sm" />
        <button type="button" onClick={() => onChange(cap(value + 1))} disabled={disabled || (max != null && value >= max)} className={incBtn}>+</button>
      </div>
    </div>
  )
}
