import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useLocations, useItems, CATEGORIES, locationPath } from '../lib/data'
import type { Category, Item } from '../lib/database.types'

export default function ItemEdit() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const nav = useNavigate()
  const { user } = useAuth()
  const { items } = useItems()
  const { locations } = useLocations()

  const existing = useMemo(() => items.find((i) => i.id === id), [items, id])

  const [form, setForm] = useState<Partial<Item>>({
    name: '', category: 'tool', quantity: 1, location_id: null, notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (existing) setForm(existing)
  }, [existing])

  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) =>
      locationPath(a.id, locations).localeCompare(locationPath(b.id, locations)),
    )
  }, [locations])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      if (isNew) {
        const { error } = await supabase.from('items').insert({
          name: form.name!.trim(),
          category: form.category as Category,
          quantity: Number(form.quantity ?? 1),
          location_id: form.location_id ?? null,
          notes: form.notes ?? null,
          photo_url: null,
          created_by: user?.id ?? null,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.from('items').update({
          name: form.name!.trim(),
          category: form.category as Category,
          quantity: Number(form.quantity ?? 1),
          location_id: form.location_id ?? null,
          notes: form.notes ?? null,
        }).eq('id', id!)
        if (error) throw error
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
    const { error } = await supabase.from('items').delete().eq('id', id)
    setBusy(false)
    if (error) setErr(error.message)
    else nav('/')
  }

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-2xl">
      <button onClick={() => nav(-1)} className="text-sm text-zinc-400 mb-3">← Back</button>
      <h1 className="text-2xl md:text-3xl font-bold mb-4">{isNew ? 'New item' : 'Edit item'}</h1>

      <form onSubmit={save} className="space-y-3">
        <Field label="Name">
          <input required value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
              className={inputCls}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Quantity">
            <input type="number" min={0} value={form.quantity ?? 1}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              className={inputCls} />
          </Field>
        </div>

        <Field label="Location">
          <select value={form.location_id ?? ''} onChange={(e) => setForm({ ...form, location_id: e.target.value || null })}
            className={inputCls}>
            <option value="">— Unassigned —</option>
            {sortedLocations.map((l) => (
              <option key={l.id} value={l.id}>{locationPath(l.id, locations)}</option>
            ))}
          </select>
        </Field>

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
