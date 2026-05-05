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
}

export interface Item {
  id: string
  name: string
  category: Category
  quantity: number
  location_id: string | null
  notes: string | null
  photo_url: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

