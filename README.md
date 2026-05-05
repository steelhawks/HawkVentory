# HawkVentory

Inventory tracker for **FRC Team 2601 Steel Hawks** — find any tool or part by browsing the list, searching, or tapping a room on the school minimap.

Stack: Vite + React + TypeScript + Tailwind v4 + Supabase.

## Setup

```bash
npm install
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project settings → API
```

Then in the Supabase dashboard → SQL Editor, paste and run `supabase/migrations/0001_init.sql` once.

## Run

```bash
npm run dev
```

Sign in with any team member's Supabase account.

## How it's organized

- **Inventory** (`/`) — searchable list of every item. Tap one to edit.
- **Map** (`/map`) — pan/zoom floorplan. Each room shows a count badge; tap to see what's stored there, grouped by sub-location (Closet › Shelf 2, etc.).
- **Places** (`/locations`) — manage rooms and nested sub-locations. Top-level rooms get an X/Y coordinate (0–100 %) to place them on the map.

The placeholder floorplan in `src/pages/MapView.tsx` (`<PlaceholderFloorplan/>`) should be swapped for a real image of the school once you have one. Marker positions are stored as percentages, so they survive any image swap.

## Data model

```
locations  ── self-referencing tree (room → closet → shelf → bin)
  └ items  ── each item belongs to one location (or unassigned)
```

Both tables have RLS enabled; any authenticated team member can read and write. Tighten later if you add roles.
