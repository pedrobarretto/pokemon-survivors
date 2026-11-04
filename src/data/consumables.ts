import { clamp } from '../engine/math'
import type { Rng } from '../engine/rng'
import type { ConsumableId } from '../game/consumables'
import type { StatDelta } from '../game/stats'

/** Something a breakable source or enemy can leave on the floor. */
export type Drop = ConsumableId | 'oranBerry'

/** Drop weight lerps from `early` (0:00) to `late` (RAMP_TIME), so stronger items show up later in the run. */
export type DropEntry = { drop: Drop; early: number; late: number }

export const RAMP_TIME = 15 * 60

const entry = (drop: Drop, early: number, late = early): DropEntry => ({ drop, early, late })

/** Drop tables by source. Breakables always drop one thing; enemies roll `ENEMY_DROP_CHANCE` first. */
export const DROP_TABLES = {
  itemBall: [
    entry('potion', 8, 3),
    entry('superPotion', 0, 5),
    entry('rareCandy', 3),
    entry('expShare', 3),
    entry('coinCase', 2),
    entry('superRod', 1.5),
    entry('berryPouch', 1, 1.5),
    entry('pokeFlute', 2, 3),
    entry('maxRepel', 2, 3),
    entry('explosion', 2, 3),
    entry('xAttack', 3),
    entry('xSpeed', 3),
    entry('revive', 0.3, 0.8),
  ],
  berryTree: [
    entry('oranBerry', 10),
    entry('potion', 3, 2),
    entry('superPotion', 0, 2),
    entry('rareCandy', 1),
    entry('berryPouch', 1.5),
  ],
  tallGrass: [
    entry('oranBerry', 3, 2),
    entry('potion', 3, 2),
    entry('expShare', 3),
    entry('coinCase', 1.5),
    entry('berryPouch', 1),
    entry('pokeFlute', 2, 3),
    entry('explosion', 2, 3),
    entry('xSpeed', 2),
    entry('maxRepel', 1, 2),
  ],
  enemy: [
    entry('potion', 5, 3),
    entry('superPotion', 0, 3),
    entry('rareCandy', 2),
    entry('expShare', 2),
    entry('coinCase', 1),
    entry('superRod', 0.5),
    entry('pokeFlute', 1),
    entry('explosion', 1),
    entry('xAttack', 1),
    entry('xSpeed', 1),
    entry('revive', 0.5),
  ],
} as const satisfies Record<string, readonly DropEntry[]>

export type DropSource = keyof typeof DROP_TABLES

/** Very rare floor drop from regular (non-boss) enemies. */
export const ENEMY_DROP_CHANCE = 0.004

/** Chance a fainted regular enemy drops an Oran Berry (rolled before `ENEMY_DROP_CHANCE`). */
export const ENEMY_BERRY_CHANCE = 0.012

/** Current weight of every entry in a table, at run time `time` (seconds). */
export const dropWeights = (table: readonly DropEntry[], time: number) => {
  const k = clamp(time / RAMP_TIME, 0, 1)
  return table.map((e) => [e.drop, e.early + (e.late - e.early) * k] as const)
}

/** Weighted roll on a drop table. Entries with zero weight can never be picked. */
export const rollDrop = (table: readonly DropEntry[], time: number, rng: Rng): Drop => {
  const weights = dropWeights(table, time).filter(([, w]) => w > 0)
  const total = weights.reduce((sum, [, w]) => sum + w, 0)
  let roll = rng() * total
  for (const [drop, w] of weights) if ((roll -= w) < 0) return drop
  return weights[weights.length - 1]![0]
}

/* ---------------- Breakable item sources ---------------- */

export type PropDef = {
  name: string
  /** Hits needed to break it. */
  hp: number
  radius: number
  /** Relative spawn frequency among props. */
  weight: number
  table: DropSource
}

export const PROPS = {
  itemBall: { name: 'Item Ball', hp: 1, radius: 6, weight: 4, table: 'itemBall' },
  berryTree: { name: 'Berry Tree', hp: 3, radius: 8, weight: 2.5, table: 'berryTree' },
  tallGrass: { name: 'Tall Grass', hp: 1, radius: 8, weight: 3.5, table: 'tallGrass' },
  /** Noite das Bruxas only (`game/halloween.ts`): never drawn by weight, it takes a breakable's place in a haunted run. */
  pumpkin: { name: "Jack-o'-lantern", hp: 2, radius: 7, weight: 0, table: 'itemBall' },
} as const satisfies Record<string, PropDef>

export type PropKind = keyof typeof PROPS

/* ---------------- Timed buffs ---------------- */

export type BuffDef = { name: string; duration: number; stats: StatDelta }

/** Buff ids double as the consumable ids that grant them (the HUD shows the item icon). */
export const BUFFS = {
  xAttack: { name: 'X Attack', duration: 20, stats: { might: 0.5 } },
  xSpeed: { name: 'X Speed', duration: 20, stats: { speed: 30, cooldown: -0.15 } },
  maxRepel: { name: 'Max Repel', duration: 6, stats: {} },
} as const satisfies Record<string, BuffDef>

export type BuffId = keyof typeof BUFFS

/** Seconds the Poké Flute keeps on-screen enemies asleep. */
export const FLUTE_SLEEP = 6
/** Max Repel pushes enemies out of this radius around the player. */
export const REPEL_RADIUS = 56
