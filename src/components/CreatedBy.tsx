import { useProfiles, profileLabel } from '../lib/data'

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

/**
 * Tiny "added by Farhan · May 7" line. Used on item/BOM/location detail screens.
 * Looks up the profile via useProfiles() so it stays live if a user updates their display name.
 */
export function CreatedBy({
  userId, at, verb = 'Added',
}: { userId: string | null; at?: string | null; verb?: string }) {
  const { profiles } = useProfiles()
  const who = profileLabel(profiles, userId)
  const when = at ? dateFmt.format(new Date(at)) : null
  return (
    <p className="text-xs text-zinc-500">
      {verb} by <span className="text-zinc-300 font-medium">{who}</span>
      {when && <span> · {when}</span>}
    </p>
  )
}
