import { CARAVAN } from '../data/visitors'
import { CARAVAN_FRAME_ID } from './caravan'
import type { DayKey } from './day'
import { festivalGiftsVouched, isFestivalGift, type FestivalTotals } from './festival'
import type { Gift, GiftContent } from './gifts'
import { HALLOWEEN_REWARDS, halloweenGiftId, halloweenGifts, HUNT_REWARDS, huntDone, huntGiftId, PUMPKABOO_GIFT } from './halloween'
import { shopGiftList, shopGifts } from './loyalty'
import type { Save } from './meta'

/**
 * Gifts the game makes itself, for guests too, worked out from the save so
 * they never touch the API: the Noite das Bruxas candy jar's and Caça aos
 * Fantasmas' rewards, and the Kecleon Shop's loyalty card and Department
 * Store rewards. Their ids are the game's own (`isGameGift`), never claimed
 * in the API. A Festival da Praça's gifts are the game's too, but follow the
 * pot the API sums (`festivalGifts` in `game/festival.ts`). Pure; shared with the API.
 */

/** The game's gifts waiting to be opened on `day`. */
export const gameGifts = (save: Save, day: DayKey): Gift[] => [...halloweenGifts(save, day), ...shopGifts(save)]

/** Whether a gift id is one of the game's own (not the API's to claim). */
export const isGameGift = (id: string) => id.startsWith('halloween2026:') || id.startsWith('loyalty:') || id.startsWith('shop:') || isFestivalGift(id)

/**
 * Every id the game gives (or vouches for) and what it brought, for `save`:
 * a candy jar reward only once the jar holds its candies and the hunt's only
 * once every night boss fell, as `halloweenGifts` asks before granting them.
 */
const gameGiftContents = (save: Save): ReadonlyMap<string, GiftContent> =>
  new Map<string, GiftContent>([
    ...HALLOWEEN_REWARDS.flatMap((r, i) => (save.halloween.candies >= r.candies ? [[halloweenGiftId(i), r.content] as const] : [])),
    ...(huntDone(save.halloween) ? HUNT_REWARDS.map((c, i) => [huntGiftId(i), c] as const) : []),
    [PUMPKABOO_GIFT.id, PUMPKABOO_GIFT.content],
    ...shopGiftList().map((g) => [g.id, g.content] as const),
    // Not a gift: the id a caravan purchase leaves to vouch for Meowth's frame, which the style shelf never sells.
    [CARAVAN_FRAME_ID, { kind: 'style', style: { slot: 'frame', id: CARAVAN.frame.id } }],
  ])

/**
 * The game-made gifts the save applied (their ids are in its `gifts`), as
 * `keepGiven` takes them: the API runs `keepGiven` with these besides the
 * player's own gifts, so a title or a frame the game gave (the Pumpkin King,
 * the VIP Customer, the Tycoon, Meowth's frame…) isn't taken for an edit.
 * These rewards follow progress the device reports (candies, night bosses,
 * stamps, the shop's level), which the API trusts the same way. Festival
 * gifts count only with the API's own `festival` totals (`festivalGiftsVouched`).
 */
export const gameGiftsApplied = (save: Save, festival: FestivalTotals = { pots: {}, given: {} }): Pick<Gift, 'id' | 'content'>[] => {
  const contents = gameGiftContents(save)
  return [
    ...save.gifts.flatMap((id) => {
      const content = contents.get(id)
      return content ? [{ id, content }] : []
    }),
    ...festivalGiftsVouched(save, festival),
  ]
}
