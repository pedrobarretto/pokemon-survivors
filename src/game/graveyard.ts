import { TAU } from '../engine/math'
import { hash2, range } from '../engine/rng'
import type { Circle, Pt } from '../data/arenas'
import { ENEMIES } from '../data/enemies'
import { GRAVEYARD, PLACE_FEET, PLACE_LOOT } from '../data/places'
import { healPlayer } from './combat'
import { dropItem } from './consumables'
import { burst, floatText, shakeScreen } from './effects'
import { despawnEnemy, spawnEnemy } from './enemies'
import { COIN_VALUES } from './meta'
import { dropCoins } from './pickups'
import { placeBossScale, type PlaceInteriorOf } from './place'
import { notifyPlace, solidAt, spawnInPlace, startLoot } from './placeKit'
import { rollShiny } from './shiny'
import type { Solid } from './terrain'
import { actAs, anchorPlayer } from './players'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * The graveyard: a fenced field of graves in the fog where only ghosts live.
 * They rise from the graves, and each one that faints sends its spirit into
 * the Odd Keystone in the middle; with enough of them Spiritomb breaks out.
 * Beat it before the dawn sends every ghost back to sleep.
 */

export type GraveyardState = {
  /** Spirits the keystone holds, up to `GRAVEYARD.spirits`. */
  spirits: number
  /** Fainted ghosts already turned into spirits. */
  counted: Set<number>
  /** Graves in room px: ghosts rise in front of them. */
  graves: readonly Pt[]
  keystone: Pt
  /** Place age at which the keystone wakes, once the last spirit is on its way. */
  wakeAt: number | null
  bossId: number | null
  shiny: boolean
  warned: boolean
}

type GraveInside = PlaceInteriorOf<'graveyard'>

/** The fence's radius, the keystone, where the player comes in, and the graves' grid. */
const FIELD = { r: 160, keystone: [0, -8] as Pt, start: [0, 124] as Pt, cols: [-120, -84, -48, 48, 84, 120], rows: [-112, -78, -44, 30, 64, 98] } as const

const SPIRIT_COLORS = ['#d8c8f8', '#a890e8', '#ffffff'] as const

/** Lays out the graves (gaps here and there), two dead trees and the keystone. */
export const buildGraveyard = (g: Game, x: number, y: number) => {
  const salt = Math.floor(g.rng() * 1e6)
  const graves: Pt[] = []
  for (const gy of FIELD.rows) {
    for (const gx of FIELD.cols) {
      const jx = gx + dm.round((hash2(gx, gy, salt) - 0.5) * 10)
      const jy = gy + dm.round((hash2(gy, gx, salt) - 0.5) * 6)
      if (jx * jx + jy * jy > (FIELD.r - 22) * (FIELD.r - 22) || hash2(gx, gy, salt + 1) < 0.18) continue
      graves.push([jx, jy])
    }
  }
  const trees: Pt[] = [[-136, 6], [134, -28]]
  const solids: Solid[] = [
    ...graves.map(([gx, gy], i) => solidAt(hash2(i, 3, salt) < 0.3 ? 'graveCross' : 'tombstone', hash2(i, 3, salt) < 0.3 ? PLACE_FEET.graveCross : PLACE_FEET.tombstone, x + gx, y + gy, i)),
    ...trees.map(([tx, ty], i) => solidAt('deadTree', PLACE_FEET.deadTree, x + tx, y + ty, i)),
    solidAt('keystone', PLACE_FEET.keystone, x + FIELD.keystone[0], y + FIELD.keystone[1]),
  ]
  const floor: Circle = { kind: 'circle', x: 0, y: 0, r: FIELD.r }
  const state: GraveyardState = { spirits: 0, counted: new Set(), graves, keystone: FIELD.keystone, wakeAt: null, bossId: null, shiny: false, warned: false }
  return { layout: { floor: [floor] }, solids, start: FIELD.start, state }
}

/** A spirit flies from (x, y) into (tx, ty): a few motes that arrive together in `GRAVEYARD.spiritFlight` seconds. */
const spiritFlight = (g: Game, x: number, y: number, tx: number, ty: number) => {
  const t = GRAVEYARD.spiritFlight
  for (let i = 0; i < 4; i++) {
    const lag = i * 0.06
    g.particles.push({ x: x + range(g.rng, -3, 3), y: y + range(g.rng, -3, 3), vx: (tx - x) / (t - lag), vy: (ty - y) / (t - lag), life: 0, ttl: t - lag, color: SPIRIT_COLORS[i % 3]!, size: i === 0 ? 2 : 1, gravity: 0, drag: 0 })
  }
}

/** A grave far enough from a player (they take turns, `anchorPlayer`) for a ghost to rise in front of it. */
const graveSpot = (inside: GraveInside) => (g: Game) => {
  const { graves } = inside.state
  const p = anchorPlayer(g)
  for (let i = 0; i < 4; i++) {
    const [gx, gy] = graves[Math.floor(g.rng() * graves.length)]!
    const x = inside.x + gx
    const y = inside.y + gy + 6
    const d2 = dm.sq(x - p.x) + dm.sq(y - p.y)
    if (d2 > 70 * 70 && d2 < 320 * 320) return { x, y }
  }
  return null
}

/** A ghost rises out of its grave in a puff of fog. */
const rise = (g: Game) => (e: Enemy) => burst(g, e.x, e.y - 4, { colors: ['#6c5c8c', '#9c8cc0', '#3c3050'], count: 10, speed: 30, ttl: 0.6, gravity: -30 })

/** Enough spirits: the keystone cracks and Spiritomb breaks out, pulling every ghost on the field into it. */
const wake = (g: Game, inside: GraveInside) => {
  const s = inside.state
  const x = inside.x + s.keystone[0]
  const y = inside.y + s.keystone[1] + 10
  const boss = spawnEnemy(g, GRAVEYARD.boss, x, y)
  const scale = placeBossScale(g.time)
  boss.hp = boss.maxHp = dm.round(boss.maxHp * scale.hp)
  boss.damage *= scale.damage
  boss.xp = dm.round(60 + (g.time / 60) * 20)
  boss.shiny = rollShiny(g.rng, GRAVEYARD.shinyOdds)
  s.bossId = boss.id
  s.shiny = boss.shiny
  g.bossId = boss.id
  // The keystone's art shows it split open.
  for (const solid of inside.terrain.solids) if (solid.kind === 'keystone') solid.variant = 1
  for (const e of g.enemies) {
    if (e.boss || e.dying >= 0) continue
    spiritFlight(g, e.x, e.y - e.radius, x, y - 10)
    despawnEnemy(e)
  }
  burst(g, x, y - 10, { colors: ['#302040', '#7860a8', '#d8c8f8', '#ffffff'], count: 70, speed: 170, ttl: 0.8 })
  shakeScreen(g, 9, { x, y })
  g.flash = 0.5
  notifyPlace(g, 'graveyard', { kind: 'keystone', shiny: boss.shiny })
}

/** Spiritomb fell: ₽, items and a heal for the team (its Poké Ball and egg roll come with any boss), the ghosts fade, then the way out. */
const win = (g: Game, inside: GraveInside, boss: Enemy | undefined) => {
  const s = inside.state
  const x = boss?.x ?? inside.x
  const y = boss?.y ?? inside.y
  const coins = [COIN_VALUES[2]]
  dropCoins(g, x, y, s.shiny ? [...coins, ...coins] : coins)
  PLACE_LOOT.graveyard.forEach((item, i) => dropItem(g, x + 10 + i * 6, y, item))
  for (const p of g.players) {
    const before = actAs(g, p)
    const heal = dm.round(healPlayer(g, p.stats.maxHp * 0.3))
    if (heal > 0) floatText(g, p.x, p.y - 30, `+${heal}`, '#58e858')
    actAs(g, before)
  }
  for (const e of g.enemies) {
    if (e.dying >= 0) continue
    burst(g, e.x, e.y - e.radius, { colors: ['#9c8cc0', '#d8c8f8'], count: 8, speed: 40, ttl: 0.5, gravity: -30 })
    despawnEnemy(e)
  }
  g.hazards.length = 0
  notifyPlace(g, 'graveyard', { kind: 'spiritomb', shiny: s.shiny })
  startLoot(g, inside)
}

/** Every tick in the graveyard: ghosts rise, fainted ones feed the keystone, Spiritomb wakes and falls, the dawn nears. */
export const updateGraveyard = (g: Game, inside: GraveInside, dt: number) => {
  const s = inside.state
  if (!s.warned && inside.left <= 10) {
    s.warned = true
    notifyPlace(g, 'graveyard', { kind: 'warn' })
  }
  if (s.bossId !== null) {
    const boss = g.enemies.find((e) => e.id === s.bossId)
    if (!boss || boss.dying >= 0) return win(g, inside, boss)
  }
  const kx = inside.x + s.keystone[0]
  const ky = inside.y + s.keystone[1] - 8
  for (const e of g.enemies) {
    if (e.dying < 0 || e.fled || e.boss || e.hp > 0 || s.counted.has(e.id)) continue
    s.counted.add(e.id)
    if (s.spirits >= GRAVEYARD.spirits) continue
    s.spirits++
    spiritFlight(g, e.x, e.y - e.radius, kx, ky)
    notifyPlace(g, 'graveyard', { kind: 'spirit', count: s.spirits })
    if (s.spirits >= GRAVEYARD.spirits) s.wakeAt = inside.age + GRAVEYARD.spiritFlight
  }
  if (s.wakeAt !== null && s.bossId === null && inside.age >= s.wakeAt) wake(g, inside)
  // The keystone breathes out a wisp now and then, more as it fills.
  if (s.bossId === null && g.rng() < 0.02 + (s.spirits / GRAVEYARD.spirits) * 0.2) {
    const a = range(g.rng, 0, TAU)
    burst(g, kx + dm.cos(a) * 6, ky, { colors: SPIRIT_COLORS, count: 1, speed: 10, ttl: 0.9, gravity: -40, drag: 0 })
  }
  spawnInPlace(g, inside, dt, graveSpot(inside), s.bossId === null ? 1 : GRAVEYARD.fightRate, rise(g))
}

/** Dex number of the graveyard's boss, for the shell (its cry, its portrait). */
export const GRAVEYARD_BOSS_DEX = ENEMIES[GRAVEYARD.boss].dex
