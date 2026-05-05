import { useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useLocations, locationPath } from '../lib/data'
import type { Location } from '../lib/database.types'

/**
 * Place management:
 * - Add a top-level room (e.g. "Lab", "Closet") and place it on the map by clicking.
 * - Add nested sub-locations (e.g. "Closet > Shelf 2") with a parent.
 * - Edit/delete existing locations.
 */
export default function Locations() {
  const { locations } = useLocations()
  const [editing, setEditing] = useState<Location | null>(null)
  const [showNew, setShowNew] = useState(false)

  const tree = useMemo(() => buildTree(locations), [locations])

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Places</h1>
          <p className="text-sm text-zinc-500">Rooms and sub-locations where items live.</p>
        </div>
        <button onClick={() => { setEditing(null); setShowNew(true) }}
          className="px-4 py-2 rounded-lg bg-hawk-400 text-zinc-950 font-semibold text-sm">
          + Add
        </button>
      </div>

      {tree.length === 0 ? (
        <div className="text-zinc-500 text-center py-12">No places yet — add a room to get started.</div>
      ) : (
        <ul className="space-y-1">
          {tree.map((node) => <TreeRow key={node.id} node={node} depth={0} onEdit={setEditing} locations={locations} />)}
        </ul>
      )}

      {(showNew || editing) && (
        <LocationForm
          location={editing}
          locations={locations}
          onClose={() => { setShowNew(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

interface TreeNode extends Location { children: TreeNode[] }

function buildTree(all: Location[]): TreeNode[] {
  const byParent = new Map<string | null, TreeNode[]>()
  for (const l of all) {
    const node: TreeNode = { ...l, children: [] }
    const arr = byParent.get(l.parent_id) ?? []
    arr.push(node)
    byParent.set(l.parent_id, arr)
  }
  function attach(nodes: TreeNode[]): TreeNode[] {
    for (const n of nodes) {
      n.children = byParent.get(n.id) ?? []
      attach(n.children)
    }
    return nodes.sort((a, b) => a.name.localeCompare(b.name))
  }
  return attach(byParent.get(null) ?? [])
}

function TreeRow({
  node, depth, onEdit, locations,
}: { node: TreeNode; depth: number; onEdit: (l: Location) => void; locations: Location[] }) {
  return (
    <>
      <li>
        <button onClick={() => onEdit(node)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-hawk-400 text-left"
          style={{ marginLeft: depth * 16 }}>
          <div className="min-w-0">
            <div className="font-medium truncate">{node.name}</div>
            {node.parent_id == null && node.map_x == null && (
              <div className="text-[11px] text-amber-400">⚠ not placed on map</div>
            )}
          </div>
          <span className="text-xs text-zinc-500 truncate">{locationPath(node.id, locations)}</span>
        </button>
      </li>
      {node.children.map((c) => <TreeRow key={c.id} node={c} depth={depth + 1} onEdit={onEdit} locations={locations} />)}
    </>
  )
}

function LocationForm({
  location, locations, onClose,
}: { location: Location | null; locations: Location[]; onClose: () => void }) {
  const isNew = !location
  const [name, setName] = useState(location?.name ?? '')
  const [parentId, setParentId] = useState<string | ''>(location?.parent_id ?? '')
  const [mapX, setMapX] = useState<string>(location?.map_x?.toString() ?? '')
  const [mapY, setMapY] = useState<string>(location?.map_y?.toString() ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const isTopLevel = parentId === ''

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const payload = {
      name: name.trim(),
      parent_id: parentId || null,
      map_x: isTopLevel && mapX !== '' ? Number(mapX) : null,
      map_y: isTopLevel && mapY !== '' ? Number(mapY) : null,
      notes: null,
    }
    const { error } = isNew
      ? await supabase.from('locations').insert(payload)
      : await supabase.from('locations').update(payload).eq('id', location!.id)
    setBusy(false)
    if (error) setErr(error.message)
    else onClose()
  }

  async function remove() {
    if (!location) return
    if (!confirm(`Delete "${location.name}" and all sub-locations? Items there will become unassigned.`)) return
    setBusy(true)
    const { error } = await supabase.from('locations').delete().eq('id', location.id)
    setBusy(false)
    if (error) setErr(error.message)
    else onClose()
  }

  // Possible parents = anything except self & descendants
  const validParents = useMemo(() => {
    if (!location) return locations
    const blocked = new Set<string>([location.id])
    let changed = true
    while (changed) {
      changed = false
      for (const l of locations) {
        if (l.parent_id && blocked.has(l.parent_id) && !blocked.has(l.id)) {
          blocked.add(l.id); changed = true
        }
      }
    }
    return locations.filter((l) => !blocked.has(l.id))
  }, [locations, location])

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-md bg-zinc-950 border border-zinc-800 rounded-t-2xl md:rounded-2xl p-5">
        <h2 className="text-lg font-bold mb-3">{isNew ? 'New place' : 'Edit place'}</h2>
        <form onSubmit={save} className="space-y-3">
          <Field label="Name">
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Closet, Shelf 2, Bin A" />
          </Field>
          <Field label="Parent (leave empty for top-level room)">
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={inputCls}>
              <option value="">— Top-level room —</option>
              {validParents.map((l) => (
                <option key={l.id} value={l.id}>{locationPath(l.id, locations)}</option>
              ))}
            </select>
          </Field>
          {isTopLevel && (
            <>
              <p className="text-xs text-zinc-500">Top-level rooms can be placed on the map. Coordinates are 0–100 (% across the floorplan).</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Map X (%)">
                  <input type="number" min={0} max={100} step={0.1} value={mapX}
                    onChange={(e) => setMapX(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Map Y (%)">
                  <input type="number" min={0} max={100} step={0.1} value={mapY}
                    onChange={(e) => setMapY(e.target.value)} className={inputCls} />
                </Field>
              </div>
            </>
          )}
          {err && <p className="text-sm text-red-400">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={busy}
              className="flex-1 py-2.5 rounded-lg bg-hawk-400 text-zinc-950 font-semibold disabled:opacity-50">
              {busy ? '…' : isNew ? 'Create' : 'Save'}
            </button>
            {!isNew && (
              <button type="button" onClick={remove} disabled={busy}
                className="px-4 py-2.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30">
                Delete
              </button>
            )}
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-zinc-800 text-zinc-300">
              Cancel
            </button>
          </div>
        </form>
      </div>
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
