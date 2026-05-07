// Hand-written for now; regenerate later via `supabase gen types typescript` once schema stabilizes.

export type Category = 'tool' | 'robot_part' | 'gear' | 'belt' | 'electronic' | 'fastener' | 'consumable' | 'other'

export interface Location {
  id: string
  name: string
  parent_id: string | null
  // Position on the floorplan as percentages (0–100). Only required for top-level rooms.
  map_x: number | null
  map_y: number | null
  notes: string | null
  created_at: string
  created_by: string | null
}

export interface Item {
  id: string
  name: string
  category: Category
  quantity: number
  location_id: string | null
  notes: string | null
  photo_url: string | null
  /** Number of units currently allocated (0 ≤ in_use ≤ quantity). */
  in_use: number
  created_at: string
  updated_at: string
  created_by: string | null
}

export type BomColor = 'crimson' | 'amber' | 'emerald' | 'sky' | 'violet' | 'zinc'

export interface Bom {
  id: string
  name: string
  description: string | null
  color: BomColor
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface BomItem {
  id: string
  bom_id: string
  item_id: string | null
  label: string | null
  quantity_needed: number
  notes: string | null
  sort_order: number
  created_at: string
  created_by: string | null
}

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  created_at: string
  updated_at: string
}

export interface ItemPhoto {
  id: string
  item_id: string
  url: string
  sort_order: number
  created_at: string
  created_by: string | null
}

