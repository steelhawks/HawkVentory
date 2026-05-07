import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useLocations, useItems, CATEGORIES, locationPath } from '../lib/data'
import { uploadItemPhoto, deleteItemPhoto } from '../lib/photo'
import { CreatedBy } from '../components/CreatedBy'
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
    name: '', category: 'tool', quantity: 1, location_id: null, notes: '', in_use: false, photo_url: null,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Photo state: pendingFile = newly chosen but not yet uploaded; pendingPreview = local object URL
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (existing) setForm(existing)
  }, [existing])

  useEffect(() => {
    return () => { if (pendingPreview) URL.revokeObjectURL(pendingPreview) }
  }, [pendingPreview])

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (!f) return
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingFile(f)
    setPendingPreview(URL.createObjectURL(f))
    e.target.value = ''  // allow re-picking the same file
  }

  function clearPending() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingFile(null)
    setPendingPreview(null)
  }

  async function removeExistingPhoto() {
    if (!form.photo_url) return
    setPhotoBusy(true)
    try {
      await deleteItemPhoto(form.photo_url)
      if (!isNew && id) {
        await supabase.from('items').update({ photo_url: null }).eq('id', id)
      }
      setForm((f) => ({ ...f, photo_url: null }))
    } catch (e: unknown) {
      const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'Failed to remove'
      setErr(msg)
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
      // Upload new photo first (if any), so we save the resulting URL on the row.
      let photoUrl: string | null = form.photo_url ?? null
      const oldPhotoToDelete = pendingFile && existing?.photo_url ? existing.photo_url : null
      if (pendingFile) {
        photoUrl = await uploadItemPhoto(pendingFile)
      }

      if (isNew) {
        const { error } = await supabase.from('items').insert({
          name: form.name!.trim(),
          category: form.category as Category,
          quantity: Number(form.quantity ?? 1),
          location_id: form.location_id ?? null,
          notes: form.notes ?? null,
          photo_url: photoUrl,
          in_use: !!form.in_use,
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
          photo_url: photoUrl,
          in_use: !!form.in_use,
        }).eq('id', id!)
        if (error) throw error
      }

      // Best-effort: remove the previous photo from storage now that the row references the new one.
      if (oldPhotoToDelete) await deleteItemPhoto(oldPhotoToDelete)

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
    const photoToClean = existing?.photo_url ?? null
    const { error } = await supabase.from('items').delete().eq('id', id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    if (photoToClean) await deleteItemPhoto(photoToClean)
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

        <label className="flex items-center gap-3 px-3 py-3 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer">
          <input type="checkbox" checked={!!form.in_use}
            onChange={(e) => setForm({ ...form, in_use: e.target.checked })}
            className="w-5 h-5 rounded border-zinc-700 bg-zinc-950 accent-hawk-500" />
          <div className="flex-1">
            <div className="font-medium">In use</div>
            <div className="text-xs text-zinc-500">Currently installed on the robot or otherwise allocated</div>
          </div>
          {form.in_use && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-hawk-500/20 text-hawk-300 border border-hawk-500/40">
              Active
            </span>
          )}
        </label>

        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5">Photo (optional)</div>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
            onChange={onPickFile} className="hidden" />

          {pendingPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-hawk-500/40 bg-zinc-900">
              <img src={pendingPreview} alt="New" className="w-full max-h-72 object-contain bg-black/40" />
              <div className="absolute top-2 right-2 flex gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs rounded bg-zinc-950/80 backdrop-blur border border-zinc-700 text-zinc-100">
                  Replace
                </button>
                <button type="button" onClick={clearPending}
                  className="px-3 py-1.5 text-xs rounded bg-red-500/80 text-white">
                  Discard
                </button>
              </div>
              <div className="absolute bottom-2 left-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-hawk-500/80 text-white">
                New — saves with item
              </div>
            </div>
          ) : form.photo_url ? (
            <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
              <img src={form.photo_url} alt={form.name ?? ''} className="w-full max-h-72 object-contain bg-black/40" />
              <div className="absolute top-2 right-2 flex gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs rounded bg-zinc-950/80 backdrop-blur border border-zinc-700 text-zinc-100">
                  Replace
                </button>
                <button type="button" onClick={removeExistingPhoto} disabled={photoBusy}
                  className="px-3 py-1.5 text-xs rounded bg-red-500/80 text-white disabled:opacity-50">
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-zinc-800 hover:border-hawk-400 hover:bg-zinc-900/50 text-zinc-400 hover:text-zinc-100 transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
                <path d="M3 7h4l2-3h6l2 3h4v12H3z" /><circle cx="12" cy="13" r="4" />
              </svg>
              <span className="text-sm">Take or choose a photo</span>
            </button>
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
