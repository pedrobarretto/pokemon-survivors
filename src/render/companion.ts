import { dir8, retain, type Dir8 } from '../engine/math'
import { CANDY_SPARK_LIFE, drawCandySpark } from './halloweenArt'
import { drawPokemon, sprites } from './sprites'

/**
 * The supporter's companion (`game/supporters.ts`): a Pokémon that trots
 * after the player (a look's followers walk the same way, `render/arenaFx.ts`, and stay home while it does). It lives only here, in the presentation: the simulation
 * never sees it, so it can't touch a run or its replay. One with `sparkles`
 * (`data/companions.ts`) leaves candy sparkles behind as it walks.
 */
export type CompanionView = {
  dex: number
  shiny: boolean
  x: number
  y: number
  dir: Dir8
  walk: number
  moving: boolean
  sparkles: 'candy' | null
  /** Its sparkles, `age` seconds old, in a candy color by index. */
  sparks: { x: number; y: number; age: number; color: number }[]
  /** Seconds until it leaves the next one. */
  sparkIn: number
}

/** How far behind it keeps, how fast it closes the gap, and past what distance it just appears there (a rift's arena). */
const FOLLOW = { gap: 22, catchUp: 5, minSpeed: 40, teleport: 220 } as const

/** Seconds between two sparkles while it walks, at most, and how many float at once. */
const SPARKS = { every: [0.07, 0.15], max: 14 } as const

/** A companion standing just behind (south of) `at`. */
export const createCompanion = (dex: number, shiny: boolean, at: { x: number; y: number }, sparkles: CompanionView['sparkles'] = null): CompanionView => ({
  dex,
  shiny,
  x: at.x,
  y: at.y + FOLLOW.gap,
  dir: 0,
  walk: 0,
  moving: false,
  sparkles,
  sparks: [],
  sparkIn: 0,
})

/** Ages the sparkles and, while it walks, leaves a new one around its feet now and then (the clock and `Math.random`: presentation only). */
const stepSparks = (c: CompanionView, dt: number) => {
  for (const s of c.sparks) s.age += dt
  retain(c.sparks, (s) => s.age < CANDY_SPARK_LIFE)
  if (!c.sparkles || !c.moving || (c.sparkIn -= dt) > 0 || c.sparks.length >= SPARKS.max) return
  const [min, max] = SPARKS.every
  c.sparkIn = min + Math.random() * (max - min)
  c.sparks.push({ x: c.x + (Math.random() - 0.5) * 12, y: c.y - 2 - Math.random() * 10, age: 0, color: Math.floor(Math.random() * 3) })
}

/** Moves the companion towards `target` (the player) by `dt` seconds, keeping its gap. */
export const stepCompanion = (c: CompanionView, target: { x: number; y: number }, dt: number) => {
  stepSparks(c, dt)
  const dx = target.x - c.x
  const dy = target.y - c.y
  const dist = Math.hypot(dx, dy)
  if (dist > FOLLOW.teleport) return Object.assign(c, createCompanion(c.dex, c.shiny, target, c.sparkles))
  c.moving = dist > FOLLOW.gap
  if (!c.moving) return c
  const speed = Math.max(FOLLOW.minSpeed, (dist - FOLLOW.gap) * FOLLOW.catchUp)
  const step = Math.min(dist - FOLLOW.gap, speed * dt)
  c.x += (dx / dist) * step
  c.y += (dy / dist) * step
  c.dir = dir8(dx, dy)
  c.walk += dt
  return c
}

/** Draws the companion at its feet, walking or idle, over the sparkles it left; `lift` px up (a floating one: the Arena's Mew), at `alpha`. */
export const drawCompanion = (ctx: CanvasRenderingContext2D, c: CompanionView, t: number, lift = 0, alpha = 1) => {
  for (const s of c.sparks) drawCandySpark(ctx, s.x, s.y, s.age, s.color)
  drawPokemon(ctx, sprites(c.dex, c.shiny), c.moving ? 'Walk' : 'Idle', c.dir, c.moving ? c.walk : t, c.x, c.y - lift, { alpha })
}
