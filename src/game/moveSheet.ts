import { MOVES, moveStats, type CastStats, type MoveDef, type MoveId, type MoveStats } from './moves'
import type { PlayerStats } from './stats'

/**
 * The numbers on a move's card (`ui/moveCard.ts`): read from `MOVES` and the
 * player's stats through `moveStats`, the same call the simulation casts with.
 */

/** Stats the card lists, in display order. `status` is the chance to inflict the move's condition. */
export type SheetStat = 'damage' | 'cooldown' | 'amount' | 'area' | 'duration' | 'pierce' | 'status'

/** A card line; `before` is the value one level down, only when the level changed it. */
export type SheetRow = { stat: SheetStat; value: number; before?: number }

/** When a base value means the move plays with the stat (the defaults in `MOVES` are 1 projectile, ×1 area, 1 s, endless pierce). */
const MEANINGFUL = {
  amount: (v) => v !== 1,
  area: (v) => v !== 1,
  // Short lifetimes (Gust, Earthquake) are animation timing, not something to build for.
  duration: (v) => v > 1,
  pierce: (v) => v !== Infinity,
} as const satisfies Partial<Record<keyof MoveStats, (v: number) => boolean>>

/** Stats a move actually plays with: damage and cooldown always, the rest when its base sets them or an upgrade raises them. */
export const sheetStats = (id: MoveId): SheetStat[] => {
  const def: MoveDef = MOVES[id]
  const optional = (Object.keys(MEANINGFUL) as (keyof typeof MEANINGFUL)[]).filter(
    (stat) => MEANINGFUL[stat](def.base[stat]) || def.upgrades.some((u) => u[stat] !== undefined),
  )
  return ['damage', 'cooldown', ...optional, ...(def.status ? ['status' as const] : [])]
}

const valueOf = (s: CastStats, stat: SheetStat) => (stat === 'status' ? (s.status?.chance ?? 0) : s[stat])

/** The card's lines for `id` at `level` with the player's modifiers; `from` (a lower level, for level-up offers) fills `before`. */
export const moveSheet = (id: MoveId, level: number, player: PlayerStats, from?: number): SheetRow[] => {
  const now = moveStats(id, level, player)
  const prev = from !== undefined ? moveStats(id, from, player) : null
  return sheetStats(id).map((stat) => {
    const value = valueOf(now, stat)
    const before = prev ? valueOf(prev, stat) : value
    return before !== value ? { stat, value, before } : { stat, value }
  })
}
