import { ROAMER_IDS, SWORDS, type RoamerId, type SwordId } from '../data/legends'
import { SWORD_DUELS } from '../data/quests'
import { createDuel } from './duels'
import { createRoam, roamerBody } from './roamers'
import type { Game } from './types'

/**
 * Dev console helpers for the open map's legends (`quests.ts`):
 * `ps.roam('uxie', 0.4)` brings a roaming legend (a lake legend or a Force of
 * Nature: `ps.roam('thundurus', 0.5)`, its weather and, on its first visit,
 * its entrance) with 40% of its HP now,
 * `ps.duel('cobalion')` puts a Sword waiting 70 px ahead of the player (whatever
 * the biome), `ps.duel('cobalion', 'now')` starts its duel at once, and
 * `ps.quests()` prints the run's roamer and duel.
 */
export const questDevTools = (game: () => Game | undefined) => {
  const playing = (fn: (g: Game) => unknown) => () => {
    const g = game()
    if (!g || g.phase !== 'playing') return 'ps: start a run (and close menus) first'
    return fn(g)
  }
  return {
    roam: (legend: RoamerId = 'uxie', left = 1) => {
      if (!ROAMER_IDS.includes(legend)) return `Roamers: ${ROAMER_IDS.join(', ')}`
      return playing((g) => {
        const body = roamerBody(g)
        if (body) body.hp = 0
        g.quests.roam = { ...createRoam(g.terrain.seed, legend, Math.min(1, Math.max(0.01, left))), next: g.time }
        return `${legend} comes now with ${Math.round(left * 100)}% of its HP`
      })()
    },
    duel: (sword: SwordId = 'cobalion', when?: 'now') => {
      if (!SWORDS.includes(sword)) return `Swords: ${SWORDS.join(', ')}`
      return playing((g) => {
        const p = g.player
        g.quests.duel = { ...createDuel(sword), stage: 'waiting', x: Math.round(p.x + 70), y: Math.round(p.y), left: 40, stand: when === 'now' ? 99 : 0 }
        return `${sword} waits (${SWORD_DUELS[sword].test.kind} test)${when === 'now' ? ': the duel starts' : ''}`
      })()
    },
    quests: playing((g) => g.quests),
  }
}
