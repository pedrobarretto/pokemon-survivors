import { ITEMS, type ItemId } from '../data/items'
import type { PokeType } from '../data/types'
import { BASE_STATS, type PlayerStats } from './stats'

/** Every stat the pause screen lists; `typeDamage` gets one row per boosted type instead. */
export type SheetStat = Exclude<keyof PlayerStats, 'typeDamage'>

/**
 * Every stat in listing order: `core` ones always show, `extra` ones only once
 * something moved them (`statSheet`), so a fresh run isn't a wall of zeros.
 * A new `PlayerStats` field won't compile until it gets a place here.
 */
const SHEET = {
  maxHp: 'core',
  might: 'core',
  cooldown: 'core',
  area: 'core',
  duration: 'core',
  amount: 'core',
  speed: 'core',
  armor: 'core',
  regen: 'core',
  magnet: 'core',
  growth: 'core',
  greed: 'extra',
  projectileSpeed: 'extra',
  statusChance: 'extra',
  statusDamage: 'extra',
  damageTaken: 'extra',
  comboMoves: 'extra',
  specialRecharge: 'extra',
} as const satisfies Record<SheetStat, 'core' | 'extra'>

const SHEET_STATS = Object.keys(SHEET) as SheetStat[]

export type SheetRow = { stat: SheetStat; value: number; cards: number } | { stat: 'typeDamage'; type: PokeType; value: number; cards: number }

type HeldItem = { id: ItemId; level: number }

/**
 * Upgrade cards taken per stat, derived from the held items: an item at level 3
 * is three cards, counted for every stat its levels touch (Assault Vest counts
 * for HP and Defense). Chest upgrades raise the same levels, so they count too.
 */
export const upgradeCards = (items: readonly HeldItem[]) => {
  const stats: Partial<Record<SheetStat, number>> = {}
  const types: Partial<Record<PokeType, number>> = {}
  for (const { id, level } of items) {
    for (const { typeDamage, ...delta } of ITEMS[id].levels.slice(0, level)) {
      for (const k of Object.keys(delta) as SheetStat[]) stats[k] = (stats[k] ?? 0) + 1
      for (const type of Object.keys(typeDamage ?? {}) as PokeType[]) types[type] = (types[type] ?? 0) + 1
    }
  }
  return { stats, types }
}

/** The pause screen's stat rows: the core stats, then any other stat or type bonus that isn't at its base value or got a card. */
export const statSheet = (stats: PlayerStats, items: readonly HeldItem[]): SheetRow[] => {
  const cards = upgradeCards(items)
  const row = (stat: SheetStat) => ({ stat, value: stats[stat], cards: cards.stats[stat] ?? 0 })
  const types = Object.entries(stats.typeDamage) as Array<[PokeType, number]>
  return [
    ...SHEET_STATS.map(row).filter((r) => SHEET[r.stat] === 'core' || r.value !== BASE_STATS[r.stat] || r.cards > 0),
    ...types.filter(([type, v]) => v !== 0 || cards.types[type]).map(([type, value]) => ({ stat: 'typeDamage' as const, type, value, cards: cards.types[type] ?? 0 })),
  ]
}
