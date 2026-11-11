import { DIFFICULTY_IDS, type Difficulty } from './difficulty'
import type { Game } from './types'

/**
 * Dev console helpers for Hoopa's Rings (`rush.ts`): `ps.rush('hard')` starts
 * a rush at that level with the partner (the save needs 3 captured legends:
 * `ps.captureAll()` first), `ps.rush('select')` opens the partner select on
 * its Lendários tab (the rings' banner), `ps.rushRing(5)` jumps to ring 5 (its
 * legend comes through at once; the last ring is Hoopa).
 */
export const rushDevTools = (game: () => Game | undefined, start: (difficulty: Difficulty) => void, select: () => void) => ({
  rush: (difficulty: Difficulty | 'select' = 'normal') =>
    difficulty === 'select' ? select() : DIFFICULTY_IDS.includes(difficulty) ? start(difficulty) : `Levels: ${DIFFICULTY_IDS.join(', ')}, or 'select'`,
  rushRing: (n: number) => {
    const g = game()
    const r = g?.rush
    if (!g || !r) return 'Start a rush first: ps.rush()'
    const boss = g.enemies.find((e) => e.id === r.bossId)
    if (boss) boss.dying = 99
    g.bossId = null
    g.hazards.length = 0
    r.ring = Math.max(0, Math.min(r.lineup.length - 1, Math.round(n) - 1))
    r.stage = 'gate'
    r.clock = 0
    return `Ring ${r.ring + 1}/${r.lineup.length}: ${r.lineup[r.ring]}`
  },
})
