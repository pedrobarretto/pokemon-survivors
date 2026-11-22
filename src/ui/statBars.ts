import type { PlayerStats } from '../game/stats'

/**
 * Stat bars of a starter sheet (the inspect panel and the site's Pokédex): label key,
 * value getter and the range mapped to an empty/full bar. Pure, so both can share it.
 */
export const STAT_BARS = [
  { label: 'hp', get: (s: PlayerStats) => s.maxHp, min: 50, max: 260, fmt: (v: number) => `${Math.round(v)}` },
  { label: 'attack', get: (s: PlayerStats) => s.might, min: 0.8, max: 1.5, fmt: (v: number) => `x${v.toFixed(2)}` },
  { label: 'defense', get: (s: PlayerStats) => s.armor, min: 0, max: 5, fmt: (v: number) => `${v}` },
  { label: 'speed', get: (s: PlayerStats) => s.speed, min: 50, max: 95, fmt: (v: number) => `${Math.round(v)}` },
  { label: 'cooldown', get: (s: PlayerStats) => 1 / s.cooldown, min: 0.9, max: 1.2, fmt: (v: number) => `x${(1 / v).toFixed(2)}` },
  { label: 'area', get: (s: PlayerStats) => s.area, min: 0.9, max: 1.45, fmt: (v: number) => `x${v.toFixed(2)}` },
  { label: 'regen', get: (s: PlayerStats) => s.regen, min: 0, max: 1.5, fmt: (v: number) => `${v.toFixed(1)}/s` },
] as const

/** How full a bar is (0.03..1), so even the lowest value shows a sliver. */
export const statRatio = (v: number, min: number, max: number) => Math.max(0.03, Math.min(1, (v - min) / (max - min)))

/**
 * The stats the bars leave out that a family's line can still raise, each with
 * the factor to its display unit, a whole number: a share in % (×100), a count
 * or px (×1), the special's recharge per KO in tenths of a second (×10).
 * Typed damage and kinds of moves stay out: no line raises them.
 */
export const OTHER_STATS = {
  amount: 1,
  projectileSpeed: 100,
  duration: 100,
  magnet: 1,
  growth: 100,
  greed: 100,
  statusChance: 100,
  statusDamage: 100,
  specialRecharge: 10,
} as const satisfies Partial<Record<keyof PlayerStats, number>>

export type OtherStat = keyof typeof OTHER_STATS

/**
 * "Outros bônus": what `stats` has over `base` (a plain Pokémon's, `BASE_STATS`)
 * in the stats the bars leave out, in display units (`OTHER_STATS`). Empty
 * when the line raises none of them.
 */
export const otherBonuses = (stats: PlayerStats, base: PlayerStats) =>
  (Object.keys(OTHER_STATS) as OtherStat[]).flatMap((key) => {
    const value = Math.round((stats[key] - base[key]) * OTHER_STATS[key])
    return value === 0 ? [] : [{ key, value }]
  })
