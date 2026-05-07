import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useItems, useLocations, useAllItemStocks, locationPath, rootLocation, categoryLabel } from '../lib/data'
import type { Location } from '../lib/database.types'

/**
 * Real Team 2601 floorplan lives at /floorplan.svg in public/. Markers are absolutely
 * positioned by percent coords so they survive any future image swap.
 */
export default function MapView() {
  const { locations } = useLocations()
  const { items } = useItems()
  const { stocks } = useAllItemStocks()
  const [selectedRoot, setSelectedRoot] = useState<Location | null>(null)

  // Top-level rooms (parent_id null) with map coords are the placeable markers.
  const rooms = useMemo(
    () => locations.filter((l) => !l.parent_id && l.map_x != null && l.map_y != null),
    [locations],
  )

  // Items grouped by their root location, derived from stocks (so an item with
  // 2 in Lab and 3 in Closet appears under both rooms).
  const itemsByRoot = useMemo(() => {
    const itemById = new Map(items.map((i) => [i.id, i]))
    const m = new Map<string, { item: typeof items[number]; stockLocId: string | null }[]>()
    const seen = new Set<string>()  // dedupe (rootId, itemId, stockLocId)
    for (const s of stocks) {
      if (!s.location_id) continue
      const root = rootLocation(s.location_id, locations)
      if (!root) continue
      const it = itemById.get(s.item_id)
      if (!it) continue
      const key = `${root.id}|${it.id}|${s.location_id}`
      if (seen.has(key)) continue
      seen.add(key)
      const arr = m.get(root.id) ?? []
      arr.push({ item: it, stockLocId: s.location_id })
      m.set(root.id, arr)
    }
    return m
  }, [items, locations, stocks])

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-6xl">
      <h1 className="text-2xl md:text-3xl font-bold mb-1">Map</h1>
      <p className="text-sm text-zinc-500 mb-4">
        Tap a room to see what's stored there. Pinch to zoom, drag to pan.
      </p>

      <div className="rounded-3xl overflow-hidden border border-zinc-800 bg-zinc-900 aspect-[1466/826] relative">
        <TransformWrapper minScale={0.6} maxScale={5} doubleClick={{ mode: 'toggle' }}>
          <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
            <div className="relative w-full h-full">
              <img
                src={`${import.meta.env.BASE_URL}floorplan.svg`}
                alt="Team 2601 floorplan"
                className="absolute inset-0 w-full h-full select-none pointer-events-none"
                draggable={false}
              />
              {rooms.map((r) => {
                const count = itemsByRoot.get(r.id)?.length ?? 0
                const active = selectedRoot?.id === r.id
                return (
                  <button
                    key={r.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedRoot(active ? null : r) }}
                    style={{ left: `${r.map_x}%`, top: `${r.map_y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 group flex flex-col items-center`}
                  >
                    <span className={`w-8 h-8 rounded-full grid place-items-center font-bold text-xs shadow-lg shadow-hawk-900/40 transition
                      ${active
                        ? 'bg-hawk-400 text-white ring-4 ring-hawk-400/40 scale-110'
                        : 'bg-hawk-500 text-white ring-1 ring-hawk-400/40'}`}>
                      {count}
                    </span>
                    <span className="mt-1 px-1.5 py-0.5 text-[10px] rounded bg-zinc-950/80 text-zinc-100 whitespace-nowrap">
                      {r.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      {rooms.length === 0 && (
        <div className="mt-4 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-400">
          No rooms placed on the map yet. Go to{' '}
          <Link to="/locations" className="text-hawk-400 underline">Places</Link>{' '}
          and add the three rooms with these coordinates so markers line up with the floorplan:
          <ul className="mt-2 ml-4 list-disc text-xs text-zinc-500 space-y-0.5">
            <li><span className="text-zinc-300 font-medium">Hallway</span> — X 50, Y 49</li>
            <li><span className="text-zinc-300 font-medium">Bathroom</span> — X 38, Y 30</li>
            <li><span className="text-zinc-300 font-medium">Lab</span> — X 50, Y 71</li>
          </ul>
        </div>
      )}

      {selectedRoot && (
        <RoomDetail
          root={selectedRoot}
          locations={locations}
          items={itemsByRoot.get(selectedRoot.id) ?? []}
          onClose={() => setSelectedRoot(null)}
        />
      )}
    </div>
  )
}

function RoomDetail({
  root, locations, items, onClose,
}: {
  root: Location
  locations: Location[]
  items: { item: import('../lib/database.types').Item; stockLocId: string | null }[]
  onClose: () => void
}) {
  // Group items by sub-location path within this room (each stock counts once
  // per its specific sub-location).
  const groups = useMemo(() => {
    const map = new Map<string, typeof items[number]['item'][]>()
    for (const { item, stockLocId } of items) {
      const key = locationPath(stockLocId, locations)
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [items, locations])

  return (
    <div className="mt-4 rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div>
          <div className="font-bold">{root.name}</div>
          <div className="text-xs text-zinc-500">{items.length} item{items.length === 1 ? '' : 's'}</div>
        </div>
        <button onClick={onClose} className="text-zinc-400 text-sm">Close</button>
      </div>
      {items.length === 0 ? (
        <p className="p-6 text-sm text-zinc-500 text-center">Nothing stored here yet.</p>
      ) : (
        <div className="divide-y divide-zinc-800">
          {groups.map(([path, list]) => (
            <div key={path} className="p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{path}</div>
              <ul className="grid sm:grid-cols-2 gap-2">
                {list.map((it) => (
                  <li key={it.id}>
                    <Link to={`/item/${it.id}`}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-hawk-400">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{it.name}</div>
                        <div className="text-[11px] text-zinc-500">{categoryLabel(it.category)}</div>
                      </div>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800">×{it.quantity}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

