import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import type { Item, Location, Category } from './database.types'

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
