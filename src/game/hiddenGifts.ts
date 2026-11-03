import { HIDDEN_PLACE_IDS, type HiddenPlaceId } from '../data/places'
import type { Gift, GiftContent } from './gifts'
import type { Save } from './meta'

/**
 * What finding a hidden zone brings home, once per save: a look found
 * nowhere else, as a game-made Mystery Gift (`game/gameGifts.ts`). The
 * Hidden Grotto gives its frame, the Underground the Secret Base wallpaper
 * (Diamond and Pearl's bases were dug there). Earned from the lifetime
 * records (`Lifetime.places`, which a zone joins once entered), so a run
 * banks nothing new. Pure; shared with the API.
 */
export const HIDDEN_REWARDS = {
  grotto: { kind: 'style', style: { slot: 'frame', id: 'grotto' } },
  underground: { kind: 'style', style: { slot: 'wallpaper', id: 'secretBase' } },
} as const satisfies Record<HiddenPlaceId, GiftContent>

const PREFIX = 'hidden:'

/** The Mystery Gift id of a hidden zone's reward. */
export const hiddenGiftId = (zone: HiddenPlaceId) => `${PREFIX}${zone}`

export const isHiddenGift = (id: string) => id.startsWith(PREFIX)

/** Every hidden zone's reward the save earned (its zone entered at least once), applied or not. */
export const hiddenGiftList = (save: Save): Gift[] =>
  HIDDEN_PLACE_IDS.flatMap((zone) =>
    save.achievements.lifetime.places.includes(zone) ? [{ id: hiddenGiftId(zone), content: HIDDEN_REWARDS[zone], reason: { kind: 'hiddenZone', zone } } satisfies Gift] : [],
  )

/** The hidden zones' gifts waiting to be opened. */
export const hiddenGifts = (save: Save): Gift[] => hiddenGiftList(save).filter((g) => !save.gifts.includes(g.id))
