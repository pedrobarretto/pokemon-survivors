import { SWORDS } from '../data/legends'
import { isCaptured } from './capture'
import type { Gift, GiftContent, GiftReason } from './gifts'
import type { Save } from './meta'

/**
 * The game's gifts for the legends with a road of their own, worked out from
 * the save so guests get them too (`game/gameGifts.ts`): Keldeo, once the
 * three Swords of Justice are captured, and the Mestre do Tempo e do Espaço
 * title, once Dialga and Palkia both are. Their ids are the game's own; the
 * API vouches for them from the save's captures like the others. Pure.
 */

const PREFIX = 'quest:'

type QuestGift = { content: GiftContent; reason: GiftReason; due: (save: Pick<Save, 'legends'>) => boolean }

const QUEST_GIFTS = {
  keldeo: { content: { kind: 'legend', legend: 'keldeo' }, reason: { kind: 'quest', way: 'swords' }, due: (save) => SWORDS.every((id) => isCaptured(save.legends, id)) },
  spaceTime: { content: { kind: 'title', title: 'spaceTime' }, reason: { kind: 'quest', way: 'creation' }, due: (save) => isCaptured(save.legends, 'dialga') && isCaptured(save.legends, 'palkia') },
} as const satisfies Record<string, QuestGift>

export const isQuestGift = (id: string) => id.startsWith(PREFIX)

/** Every quest gift the save has earned, opened or not. */
export const questGiftList = (save: Pick<Save, 'legends'>): Gift[] =>
  Object.entries(QUEST_GIFTS).flatMap(([key, g]: [string, QuestGift]) => (g.due(save) ? [{ id: `${PREFIX}${key}`, content: g.content, reason: g.reason }] : []))

/** The ones still waiting in the gift box. */
export const questGifts = (save: Pick<Save, 'legends' | 'gifts'>): Gift[] => questGiftList(save).filter((g) => !save.gifts.includes(g.id))
