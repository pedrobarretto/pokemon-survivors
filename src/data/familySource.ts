import { HATCHLINGS, type HatchlingId } from './hatchlings'
import { CORNER_PRIZES } from './rocketCorner'
import { SAFARI_ONLY } from './safari'

const CORNER_FAMILIES: ReadonlySet<HatchlingId> = new Set(Object.values(CORNER_PRIZES).flatMap((p) => (p.kind === 'family' ? [p.family] : [])))

/**
 * Where a family is first had, for the pages that name it (the site's Pokédex):
 * the Safári's grass for its exclusives, the Game Corner's counter for its
 * prizes, else the egg it hatches from.
 */
export const familySource = (id: HatchlingId) => (SAFARI_ONLY.includes(id) ? 'safari' : CORNER_FAMILIES.has(id) ? 'corner' : HATCHLINGS[id].egg)
