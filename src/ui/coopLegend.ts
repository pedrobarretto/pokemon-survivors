import type { LegendId } from '../data/legends'
import { canPlay } from '../game/capture'
import { brasiliaDay } from '../game/day'
import { shownLegends } from '../game/festival'
import type { Save } from '../game/meta'
import { today } from './save'

/**
 * The legend this device brings to a co-op Legend room (the room's Modo
 * Lendário), kept apart from the lobby's partner: the partner stays the
 * seat's regular Pokémon, its fallback when the relay doesn't vouch for the
 * legend. A screen preference, not progress, so it stays out of the save.
 */
const KEY = 'ps:coopLegend'

export const loadCoopLegend = (): string | null => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export const saveCoopLegend = (id: LegendId) => {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // Storage blocked: the pick lasts until the page closes.
  }
}

/** The legends `save` can play in a legend room: the captured ones the partner select shows (a festival legend waits for its festival). */
export const capturedLegends = (save: Pick<Save, 'hatched' | 'legends'>): LegendId[] => shownLegends(brasiliaDay(today())).filter((id) => canPlay(save, id))
