import type { CosmeticSlot } from '../data/cosmetics'
import { fromStrings, lazy } from '../engine/pixelart'

/**
 * The gem shop's pixel icons, code-authored: the gem itself (the balance,
 * the packs, prices) and one 12×12 icon per cosmetic slot, drawn white on
 * the item's rarity color. As data URLs, for `<img>`s.
 */

/** Rows mirrored around the middle: a 6-wide half makes a 12-wide icon. */
const sym = (half: readonly string[]) => half.map((row) => row + [...row].reverse().join(''))

const GEM = ['...ooooooo...', '..owllmmmddo.', '.owwllmmmmddo', 'owlllmmmmmddo', '.ollmmmmmddo.', '..olmmmmmdo..', '...olmmmdo...', '....ommmo....', '.....omo.....', '......o......']

const SLOT_ROWS = {
  head: sym(['......', '......', '..oooo', '..owww', '..owww', '..owww', '..oggg', 'oooooo', 'owwwww', 'oooooo', '......', '......']),
  face: sym(['......', '......', '......', '......', '.oooo.', 'owwwwo', 'owggwo', '.oooo.', '......', '......', '......', '......']),
  neck: sym(['......', '......', '......', 'oooooo', 'owwwww', 'owgwgw', 'oooooo', '....ow', '...owg', '...ooo', '......', '......']),
  back: sym(['......', '...ooo', '..owww', '.owwww', '.owwww', 'owwwww', 'owwwww', 'owgwww', 'owwgww', 'owwwgw', 'oooooo', '......']),
  follower: sym(['......', '...oo.', '..owwo', '.o.oo.', 'owo...', 'owo.oo', '.o.oww', '...oww', '..owww', '..owww', '...ooo', '......']),
  trail: sym(['......', '.....o', '....ow', '....ow', '..ooow', 'oowwww', '..ooow', '....ow', '....ow', '.....o', '......', '......']),
  spawn: sym(['.....o', '....ow', '....ow', 'ooooow', '.owwww', '..owww', '..owww', '.owwoo', '.owo..', '.oo...', '......', '......']),
  ko: sym(['......', '.o...o', '..o.ow', '...oww', 'ooowww', '.owwww', '..owwg', '.owwww', 'ooowww', '...oww', '..o.ow', '.o...o']),
  goal: ['oo..........', 'owoooooo....', 'owwwwwwwo...', 'owwggwwwwo..', 'owwggwwwwwo.', 'owwwwwwwwo..', 'owoooooooo..', 'oo..........', 'oo..........', 'oo..........', 'oo..........', 'oooo........'],
  emote: ['..oooooooo..', '.owwwwwwwwo.', 'owwwwooowwwo', 'owwwwooowwwo', 'owwwwooowwwo', 'owwwwwwwwwwo', 'owwwwooowwwo', '.owwwwwwwwo.', '..owooooooo.', '..oo........', '..o.........', '............'],
  title: ['............', '............', 'oooooooooooo', 'owwwwwwwwwwo', 'owgggggggwwo', 'owwwwwwwwwwo', 'owggggggwwwo', 'owwwwwwwwwwo', 'oooooooooooo', 'ooo......ooo', 'oo........oo', '............'],
  plate: ['............', '............', '............', '.oooooooooo.', 'owwwwwwwwwwo', 'owoowoooowwo', 'owwwwwwwwwwo', '.oooooooooo.', '............', '............', '............', '............'],
} as const satisfies Record<CosmeticSlot, readonly string[]>

const SLOT_PALETTE = { o: '#181828', w: '#f8f8f8', g: '#a8b0c8' }

/** The gem, 13×10. */
export const gemIconUrl = lazy(() => fromStrings(GEM, { o: '#3a1858', w: '#ffffff', l: '#f0b8ff', m: '#c860f0', d: '#8030b8' }).toDataURL())

const slotIcons = new Map<CosmeticSlot, string>()

/** A cosmetic slot's icon, 12×12. */
export const slotIconUrl = (slot: CosmeticSlot) => {
  let url = slotIcons.get(slot)
  if (url === undefined) slotIcons.set(slot, (url = fromStrings(SLOT_ROWS[slot], SLOT_PALETTE).toDataURL()))
  return url
}
