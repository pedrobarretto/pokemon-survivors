import { ABILITIES } from '../data/abilities'
import { LEGENDS, type LegendId } from '../data/legends'
import type { Messages } from '../i18n'

/**
 * What a legend's innate does, in words: its ability's own text, then what the
 * Legend mode adds to it (`legend.innateExtra`, for the innates with an `extra`).
 * Takes the messages so the site's pages (any locale) and the game (`t()`) share it.
 */
export const innateText = (m: Messages, id: LegendId) => {
  const ability = LEGENDS[id].innate.ability
  const extras: Partial<Record<LegendId, string>> = m.legend.innateExtra
  const extra = extras[id]
  return { ability, name: ABILITIES[ability].name, text: extra ? `${m.abilities[ability]} ${extra}` : m.abilities[ability] }
}
