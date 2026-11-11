import { evolutionOf } from '../data/evolutions'
import { ITEM_IDS, ITEMS, type ItemDef, type ItemId } from '../data/items'
import { MAX_ITEMS, recomputeStats } from './leveling'
import type { Game } from './types'

/**
 * Dev-console helper for Largar item: `ps.hold('full')` fills the running
 * game's six slots with items none of its moves pair with (so a maxed move's
 * pair comes as a swap card), `ps.hold(['charcoal', 'leftovers'], 3)` holds
 * those at that level. Wired in `main.ts` for dev builds only.
 */
export const itemDropDevTools = (game: () => Game | undefined) => ({
  hold: (ids: readonly ItemId[] | 'full' = 'full', level = 3) => {
    const g = game()
    if (!g) return console.warn('ps: start a run first')
    const pairs = new Set(g.player.moves.flatMap((m) => evolutionOf(m.id)?.item ?? []))
    const list = ids === 'full' ? ITEM_IDS.filter((id) => {
            const def: ItemDef = ITEMS[id]
            return !pairs.has(id) && !def.boosts
          }).slice(0, MAX_ITEMS) : ids.slice(0, MAX_ITEMS)
    g.player.items = list.map((id) => ({ id, level: Math.max(1, Math.min(ITEMS[id].levels.length, Math.round(level))) }))
    recomputeStats(g)
    return g.player.items.map((i) => `${i.id}:${i.level}`)
  },
})
