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

export const isUltraGift = (id: string) => id.startsWith('ultra:')

/** How many of the Ultra Wormholes' beasts the save has captured. */
export const ultraCaptured = (save: Pick<Save, 'legends'>) => ULTRA_BEASTS.filter((b) => isCaptured(save.legends, b)).length

/** Poipole's gift once every beast is captured, applied or not. */
export const ultraGiftList = (save: Save): Gift[] =>
  ultraCaptured(save) === ULTRA_BEASTS.length ? [{ ...POIPOLE_GIFT, reason: { kind: 'ultraBeasts' } }] : []

/** Poipole's gift waiting to be opened. */
export const ultraGifts = (save: Save): Gift[] => ultraGiftList(save).filter((g) => !save.gifts.includes(g.id))
