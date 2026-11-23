import { ULTRA_BEASTS } from '../data/ultraBeasts'
import { isCaptured } from './capture'
import type { Gift, GiftContent } from './gifts'
import type { Save } from './meta'

/**
 * Poipole, the Ultra Beasts' reward: once the save holds every Ultra
 * Wormhole's beast captured (`ULTRA_BEASTS`, a win each), Poipole comes as a
 * game-made Mystery Gift (`game/gameGifts.ts`), once. It's earned from the
 * save's own captures, so the API vouches for it the same way it trusts them
 * (`keepGiven` keeps a gift legend only with its gift). Pure; shared with the API.
 */
export const POIPOLE_GIFT = { id: 'ultra:poipole', content: { kind: 'legend', legend: 'poipole' } } as const satisfies { id: string; content: GiftContent }

/**
 * Poipole's shiny, the hunt after it: never fought, it can't be met shiny, so
 * `ULTRA_SHINY.need` of the beasts' shinies (each unlocked by beating it shiny,
 * `capture.ts`) bring it as a second gift once Poipole's own is due too
 * (every beast captured), so it never brings Poipole early.
 */
export const ULTRA_SHINY = { need: 3 } as const

export const POIPOLE_SHINY_GIFT = { id: 'ultra:poipoleShiny', content: { kind: 'legend', legend: 'poipole', shiny: true } } as const satisfies { id: string; content: GiftContent }

export const isUltraGift = (id: string) => id.startsWith('ultra:')

/** How many of the Ultra Wormholes' beasts the save has captured. */
export const ultraCaptured = (save: Pick<Save, 'legends'>) => ULTRA_BEASTS.filter((b) => isCaptured(save.legends, b)).length

/** How many of the beasts' shinies the save owns. */
export const ultraShinies = (save: Pick<Save, 'shinyStarters'>) => ULTRA_BEASTS.filter((b) => b in save.shinyStarters).length

/** Poipole's gift once every beast is captured, and its shiny's too once `ULTRA_SHINY.need` of their shinies are owned, applied or not. */
export const ultraGiftList = (save: Save): Gift[] =>
  ultraCaptured(save) < ULTRA_BEASTS.length
    ? []
    : [
        { ...POIPOLE_GIFT, reason: { kind: 'ultraBeasts' } },
        ...(ultraShinies(save) >= ULTRA_SHINY.need ? [{ ...POIPOLE_SHINY_GIFT, reason: { kind: 'ultraBeasts' } } satisfies Gift] : []),
      ]

/** Poipole's gifts waiting to be opened. */
export const ultraGifts = (save: Save): Gift[] => ultraGiftList(save).filter((g) => !save.gifts.includes(g.id))
