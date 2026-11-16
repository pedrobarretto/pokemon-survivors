import { HATCHLINGS } from '../data/hatchlings'
import { isRegion, REGION_IDS, type RegionId } from '../data/regionalForms'
import { brasiliaDay, type DayKey } from '../game/day'
import { nextTrip, regionFamilies, regionOfWeek } from '../game/travel'
import { loadSave } from './save'

/** Dev: the region the Vitrine's Ovo de Viagem card sells instead of the week's, until a reload (`ps.travel`). */
let forced: RegionId | null = null

/** The region the Vitrine's travel card sells on `day`: the week's, or the dev's pick. */
export const tripOf = (day: DayKey): RegionId => forced ?? regionOfWeek(day)

/**
 * `ps.travel()` prints the trip: this week's region, the next one, and each
 * region's families with ✓ on the ones this save hatched. `ps.travel('hisui')`
 * makes the Vitrine's card sell that region's egg until a reload
 * (`ps.travel(null)` back to the week's); `ps.egg('hisui')` puts one straight in the incubator.
 */
export const travelDevTools = () => ({
  travel: (region?: RegionId | null) => {
    if (region !== undefined) forced = isRegion(region) ? region : null
    const day = brasiliaDay(new Date())
    const hatched = loadSave().hatched
    const next = nextTrip(day)
    console.log(`Trip of the week: ${tripOf(day)}${forced ? ' (forced)' : ''} · next: ${next.region} on ${next.day}`)
    for (const r of REGION_IDS) console.log(`  ${r}: ${regionFamilies(r).map((id) => `${HATCHLINGS[id].name}${hatched[id] ? ' ✓' : ''}`).join(', ')}`)
    return tripOf(day)
  },
})
