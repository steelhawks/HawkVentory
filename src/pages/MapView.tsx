import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useItems, useLocations, locationPath, rootLocation, categoryLabel } from '../lib/data'
import type { Location } from '../lib/database.types'

/**
 * Placeholder floorplan: a stylized SVG with a few rooms.
 * Swap the <PlaceholderFloorplan/> for an <img src="/floorplan.png" /> when the user provides one;
 * the marker overlay (positioned by % coords) keeps working unchanged.
 */
export default function MapView() {
  const { locations } = useLocations()
  const { items } = useItems()
  const [selectedRoot, setSelectedRoot] = useState<Location | null>(null)

  // Top-level rooms (parent_id null) with map coords are the placeable markers.
  const rooms = useMemo(
    () => locations.filter((l) => !l.parent_id && l.map_x != null && l.map_y != null),
    [locations],
  )

  // Items grouped by their root location (the room).
  const itemsByRoot = useMemo(() => {
    const m = new Map<string, typeof items>()
    for (const it of items) {
      const root = rootLocation(it.location_id, locations)
      if (!root) continue
      const arr = m.get(root.id) ?? []
      arr.push(it)
      m.set(root.id, arr)
    }
    return m
  }, [items, locations])

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-6xl">
      <h1 className="text-2xl md:text-3xl font-bold mb-1">Map</h1>
      <p className="text-sm text-zinc-500 mb-4">
        Tap a room to see what's stored there. Pinch to zoom, drag to pan.
      </p>

      <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 aspect-[4/3] md:aspect-[16/9] relative">
        <TransformWrapper minScale={0.6} maxScale={5} doubleClick={{ mode: 'toggle' }}>
          <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
            <div className="relative w-full h-full">
              <PlaceholderFloorplan />
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
                    <span className={`w-7 h-7 rounded-full grid place-items-center font-bold text-xs shadow-lg
                      ${active ? 'bg-hawk-400 text-zinc-950 ring-4 ring-hawk-400/30' : 'bg-hawk-500 text-zinc-950'}`}>
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
        <div className="mt-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-400">
          No rooms placed on the map yet. Go to{' '}
          <Link to="/locations" className="text-hawk-400 underline">Places</Link>{' '}
          to add rooms (Lab, Closet, etc.) and set their map coordinates.
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
  items: ReturnType<typeof useItems>['items']
  onClose: () => void
}) {
  // Group items by their immediate sub-location path within this room.
  const groups = useMemo(() => {
    const map = new Map<string, typeof items>()
    for (const it of items) {
      const key = locationPath(it.location_id, locations)
      const arr = map.get(key) ?? []
      arr.push(it)
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

/** Stylized placeholder until the real school floorplan image is dropped in. */
function PlaceholderFloorplan() {
  return (
    <svg viewBox="0 0 1600 900" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#27272a" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1600" height="900" fill="#18181b" />
      <rect width="1600" height="900" fill="url(#grid)" />
      {/* Outer wall */}
      <rect x="60" y="60" width="1480" height="780" fill="none" stroke="#3f3f46" strokeWidth="6" rx="8" />
      {/* Rough rooms */}
      <rect x="80" y="80" width="500" height="380" fill="#1f1f23" stroke="#3f3f46" strokeWidth="3" />
      <text x="330" y="280" textAnchor="middle" fill="#52525b" fontSize="28" fontFamily="ui-sans-serif">Lab</text>
      <rect x="600" y="80" width="320" height="240" fill="#1f1f23" stroke="#3f3f46" strokeWidth="3" />
      <text x="760" y="210" textAnchor="middle" fill="#52525b" fontSize="22" fontFamily="ui-sans-serif">Closet</text>
      <rect x="940" y="80" width="240" height="240" fill="#1f1f23" stroke="#3f3f46" strokeWidth="3" />
      <text x="1060" y="210" textAnchor="middle" fill="#52525b" fontSize="22" fontFamily="ui-sans-serif">Bathroom</text>
      <rect x="1200" y="80" width="320" height="380" fill="#1f1f23" stroke="#3f3f46" strokeWidth="3" />
      <text x="1360" y="280" textAnchor="middle" fill="#52525b" fontSize="22" fontFamily="ui-sans-serif">Workshop</text>
      <rect x="80" y="480" width="900" height="340" fill="#1f1f23" stroke="#3f3f46" strokeWidth="3" />
      <text x="530" y="660" textAnchor="middle" fill="#52525b" fontSize="28" fontFamily="ui-sans-serif">Hallway</text>
      <rect x="1000" y="480" width="520" height="340" fill="#1f1f23" stroke="#3f3f46" strokeWidth="3" />
      <text x="1260" y="660" textAnchor="middle" fill="#52525b" fontSize="22" fontFamily="ui-sans-serif">Pit Area</text>
      <text x="800" y="870" textAnchor="middle" fill="#3f3f46" fontSize="14" fontFamily="ui-monospace">
        placeholder floorplan — replace with team 2601's actual map
      </text>
    </svg>
  )
}
