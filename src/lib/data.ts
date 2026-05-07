import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import type { Item, Location, Category, Bom, BomItem, BomColor, Profile, ItemPhoto, ItemStock } from './database.types'

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'tool',        label: 'Tool' },
  { value: 'robot_part',  label: 'Robot Part' },
  { value: 'gear',        label: 'Gear' },
  { value: 'belt',        label: 'Belt' },
  { value: 'electronic',  label: 'Electronic' },
  { value: 'fastener',    label: 'Fastener' },
  { value: 'consumable',  label: 'Consumable' },
  { value: 'other',       label: 'Other' },
]

export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.value === c)?.label ?? c

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('locations').select('*').order('name')
    if (!error && data) setLocations(data)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const ch = supabase
      .channel('locations-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [refresh])

  return { locations, loading, refresh }
}

export function useItems() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('items').select('*').order('name')
    if (!error && data) setItems(data)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const ch = supabase
      .channel('items-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [refresh])

  return { items, loading, refresh }
}

/** Build a "Lab › Closet › Shelf 2" path for a location id. */
export function locationPath(id: string | null, all: Location[]): string {
  if (!id) return 'Unassigned'
  const byId = new Map(all.map((l) => [l.id, l]))
  const parts: string[] = []
  let cur = byId.get(id)
  let safety = 0
  while (cur && safety++ < 20) {
    parts.unshift(cur.name)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  return parts.join(' › ')
}

/** Walk up to the root (top-level room) for a given location id. */
export function rootLocation(id: string | null, all: Location[]): Location | null {
  if (!id) return null
  const byId = new Map(all.map((l) => [l.id, l]))
  let cur = byId.get(id)
  let safety = 0
  while (cur && cur.parent_id && safety++ < 20) cur = byId.get(cur.parent_id)
  return cur ?? null
}

/* -------------------------------- BOMs --------------------------------- */

export const BOM_COLORS: { value: BomColor; label: string; chip: string; ring: string }[] = [
  { value: 'crimson', label: 'Crimson', chip: 'bg-hawk-500/20 text-hawk-300 border-hawk-500/40',     ring: 'ring-hawk-500/50' },
  { value: 'amber',   label: 'Amber',   chip: 'bg-amber-500/20 text-amber-300 border-amber-500/40',  ring: 'ring-amber-500/50' },
  { value: 'emerald', label: 'Emerald', chip: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', ring: 'ring-emerald-500/50' },
  { value: 'sky',     label: 'Sky',     chip: 'bg-sky-500/20 text-sky-300 border-sky-500/40',        ring: 'ring-sky-500/50' },
  { value: 'violet',  label: 'Violet',  chip: 'bg-violet-500/20 text-violet-300 border-violet-500/40', ring: 'ring-violet-500/50' },
  { value: 'zinc',    label: 'Steel',   chip: 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40',     ring: 'ring-zinc-500/50' },
]

export const bomColorChip = (c: BomColor) => BOM_COLORS.find((x) => x.value === c)?.chip ?? BOM_COLORS[0].chip
export const bomColorRing = (c: BomColor) => BOM_COLORS.find((x) => x.value === c)?.ring ?? BOM_COLORS[0].ring

export function useBoms() {
  const [boms, setBoms] = useState<Bom[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('boms').select('*').order('name')
    if (!error && data) setBoms(data)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const ch = supabase
      .channel('boms-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boms' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [refresh])

  return { boms, loading, refresh }
}

export function useBomItems(bomId: string | null) {
  const [bomItems, setBomItems] = useState<BomItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!bomId) { setBomItems([]); setLoading(false); return }
    const { data, error } = await supabase
      .from('bom_items').select('*').eq('bom_id', bomId).order('sort_order').order('created_at')
    if (!error && data) setBomItems(data)
    setLoading(false)
  }, [bomId])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!bomId) return
    const ch = supabase
      .channel(`bom-items-${bomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bom_items', filter: `bom_id=eq.${bomId}` }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [bomId, refresh])

  return { bomItems, loading, refresh }
}

/* --------------------------- Item stocks --------------------------- */

export function useAllItemStocks() {
  const [stocks, setStocks] = useState<ItemStock[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('item_stocks').select('*')
    if (!error && data) setStocks(data)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const ch = supabase
      .channel('item-stocks-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_stocks' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [refresh])

  return { stocks, loading, refresh }
}

export function useItemStocks(itemId: string | null) {
  const [stocks, setStocks] = useState<ItemStock[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!itemId) { setStocks([]); setLoading(false); return }
    const { data, error } = await supabase
      .from('item_stocks').select('*').eq('item_id', itemId).order('created_at')
    if (!error && data) setStocks(data)
    setLoading(false)
  }, [itemId])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!itemId) return
    const ch = supabase
      .channel(`item-stocks-${itemId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_stocks', filter: `item_id=eq.${itemId}` }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [itemId, refresh])

  return { stocks, loading, refresh }
}

/** Bump the in-use count by `delta` across stocks for an item. Increments fill the
 *  first stock that has capacity; decrements drain the first stock with in_use > 0. */
export async function adjustItemInUse(stocks: ItemStock[], delta: number): Promise<void> {
  if (delta === 0) return
  const ordered = [...stocks].sort((a, b) => a.created_at.localeCompare(b.created_at))
  if (delta > 0) {
    for (const s of ordered) {
      const room = s.quantity - s.in_use
      if (room <= 0) continue
      const take = Math.min(room, delta)
      await supabase.from('item_stocks').update({ in_use: s.in_use + take }).eq('id', s.id)
      delta -= take
      if (delta === 0) return
    }
  } else {
    let need = -delta
    for (const s of ordered) {
      if (s.in_use <= 0) continue
      const take = Math.min(s.in_use, need)
      await supabase.from('item_stocks').update({ in_use: s.in_use - take }).eq('id', s.id)
      need -= take
      if (need === 0) return
    }
  }
}

/* --------------------------- Item photos --------------------------- */

export function useItemPhotos(itemId: string | null) {
  const [photos, setPhotos] = useState<ItemPhoto[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!itemId) { setPhotos([]); setLoading(false); return }
    const { data, error } = await supabase
      .from('item_photos').select('*').eq('item_id', itemId).order('sort_order').order('created_at')
    if (!error && data) setPhotos(data)
    setLoading(false)
  }, [itemId])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!itemId) return
    const ch = supabase
      .channel(`item-photos-${itemId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_photos', filter: `item_id=eq.${itemId}` }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [itemId, refresh])

  return { photos, loading, refresh }
}

/* ------------------------------ Profiles ------------------------------- */

export function useProfiles() {
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*')
    if (!error && data) setProfiles(new Map(data.map((p: Profile) => [p.id, p])))
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const ch = supabase
      .channel('profiles-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [refresh])

  return { profiles, loading, refresh }
}

export function profileLabel(profiles: Map<string, Profile>, id: string | null | undefined): string {
  if (!id) return 'Unknown'
  const p = profiles.get(id)
  if (!p) return 'Unknown'
  return p.display_name || (p.email ? p.email.split('@')[0] : 'Unknown')
}

/** All bom_items across all BOMs — used to compute "which BOMs is this item in?" */
export function useAllBomItems() {
  const [bomItems, setBomItems] = useState<BomItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('bom_items').select('*')
    if (!error && data) setBomItems(data)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const ch = supabase
      .channel('bom-items-all-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bom_items' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [refresh])

  return { bomItems, loading, refresh }
}
