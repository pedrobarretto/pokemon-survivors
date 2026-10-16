import type { Sfx } from '../engine/audio'
import { dirTo } from '../engine/math'
import { chance, range } from '../engine/rng'
import { query } from '../engine/spatial'
import { BUFFS, DROP_TABLES, ENEMY_DROP_CHANCE, FLUTE_SLEEP, REPEL_RADIUS, rollDrop, type BuffId, type Drop } from '../data/consumables'
import { addBuff, hasBuff, tickBuffs } from './buffs'
import { healPlayer, killEnemy } from './combat'
import { burst, damageText, floatText } from './effects'
import { gainXp, recomputeTeam } from './leveling'
import { inPlay } from './players'
import { dropPickup } from './pickups'
import { inView, isAlive } from './queries'
import { applyStatus, type StatusSpec } from './status'
import type { Enemy, Game, Player } from './types'
import * as dm from '../engine/dmath'

/**
 * Consumables are one-shot floor items (Vampire Survivors' chicken, vacuum,
 * clock, rosary…). Each definition is data plus an `apply` effect that runs
 * when the player picks it up.
 */
export type ConsumableDef = {
  /** Official English name; the pickup toast line lives in `i18n`. */
  name: string
  sfx: Sfx
  apply: (g: Game) => void
}

const heal = (g: Game, amount: number) => {
  const p = g.player
  const healed = Math.round(healPlayer(g, amount))
  floatText(g, p.x, p.y - 30, `+${healed}`, '#58e858')
  burst(g, p.x, p.y - 10, { colors: ['#58e858', '#c8f8c8', '#ffffff'], count: 16, speed: 60, ttl: 0.6, gravity: -40 })
}

/** A timed buff for the whole team, with a puff around whoever picked it up. */
const buff = (id: BuffId) => (g: Game) => {
  addBuff(g.buffs, id, BUFFS[id].duration)
  recomputeTeam(g)
  const colors = id === 'xAttack' ? ['#f85838', '#ffd0a0'] : id === 'xSpeed' ? ['#58a0f8', '#d0e8ff'] : ['#58d878', '#e0ffe0']
  burst(g, g.player.x, g.player.y - 10, { colors, count: 20, speed: 90, ttl: 0.6, gravity: -60 })
}

const FLUTE: StatusSpec = { kind: 'sleep', chance: 1, duration: FLUTE_SLEEP, power: 0 }

const sleepOnScreen = (g: Game) => {
  for (const e of g.enemies) {
    if (!isAlive(e) || !inView(g, e.x, e.y, 16)) continue
    applyStatus(e.status, FLUTE, 0, e.boss, null)
    e.kx = 0
    e.ky = 0
  }
  burst(g, g.player.x, g.player.y - 14, { colors: ['#a8c8f8', '#ffffff', '#f8d8f8'], count: 24, speed: 50, ttl: 0.9, gravity: -30, drag: 2 })
}

/** Voltorb's Explosion: faints every regular enemy on screen and chunks bosses for 10% of their HP. */
const explode = (g: Game) => {
  for (const e of g.enemies) {
    if (!isAlive(e) || !inView(g, e.x, e.y, 16)) continue
    const dmg = e.boss ? Math.round(e.maxHp * 0.1) : Math.ceil(e.hp)
    e.hp -= dmg
    e.flash = 0.3
    damageText(g, e, dmg, '#ffd830', true)
    burst(g, e.x, e.y - e.radius, { colors: ['#ffffff', '#f8e858', '#f87830'], count: 5, speed: 90, ttl: 0.4 })
    if (e.hp <= 0) killEnemy(g, e)
  }
  const p = g.player
  burst(g, p.x, p.y - 10, { colors: ['#ffffff', '#f8e858', '#f87830', '#e83030'], count: 60, speed: 200, ttl: 0.7 })
  g.flash = 1
  g.shake = 8
}

export const CONSUMABLES = {
  potion: { name: 'Potion', sfx: 'heal', apply: (g) => heal(g, 30) },
  superPotion: { name: 'Super Potion', sfx: 'heal', apply: (g) => heal(g, 60) },
  rareCandy: {
    name: 'Rare Candy',
    sfx: 'levelUp',
    apply: (g) => {
      // The team shares one level in co-op, so the candy levels everyone up.
      for (const p of g.coop ? g.players : [g.player]) if (!p.gone) p.xp = p.xpNext
      gainXp(g, 0)
    },
  },
  expShare: {
    name: 'Exp. Share',
    sfx: 'item',
    apply: (g) => {
      for (const k of g.pickups) if (k.kind === 'xp') k.attracted = true
    },
  },
  pokeFlute: { name: 'Poké Flute', sfx: 'flute', apply: sleepOnScreen },
  maxRepel: { name: 'Max Repel', sfx: 'item', apply: buff('maxRepel') },
  explosion: { name: 'Voltorb', sfx: 'explosion', apply: explode },
  xAttack: { name: 'X Attack', sfx: 'item', apply: buff('xAttack') },
  xSpeed: { name: 'X Speed', sfx: 'item', apply: buff('xSpeed') },
  revive: {
    name: 'Revive',
    sfx: 'item',
    apply: (g) => {
      if (g.revives > 0) heal(g, g.player.stats.maxHp * 0.5)
      else g.revives = 1
    },
  },
} as const satisfies Record<string, ConsumableDef>

export type ConsumableId = keyof typeof CONSUMABLES

/** Puts a drop on the floor with a small pop. */
export const dropItem = (g: Game, x: number, y: number, drop: Drop) => {
  if (drop === 'oranBerry') return dropPickup(g, x, y, 'berry')
  g.pickups.push({ id: g.nextId++, x, y, vx: range(g.rng, -25, 25), vy: range(g.rng, -40, -20), attracted: false, age: 0, kind: 'consumable', item: drop })
}

/** Very rare consumable drop from a fainted regular enemy. */
export const enemyDrop = (g: Game, e: Enemy) => {
  if (chance(g.rng, ENEMY_DROP_CHANCE)) dropItem(g, e.x - 6, e.y, rollDrop(DROP_TABLES.enemy, g.time, g.rng))
}

export const useConsumable = (g: Game, id: ConsumableId) => {
  CONSUMABLES[id].apply(g)
  g.events.push({ kind: 'consumable', item: id })
}

/** Called when HP hits 0: spends a held Revive to get back up at 50% HP. */
export const tryRevive = (g: Game) => {
  if (g.revives <= 0) return false
  const p = g.player
  g.revives--
  p.hp = Math.round(p.stats.maxHp * 0.5)
  p.iframes = 2
  burst(g, p.x, p.y - 10, { colors: ['#f8d830', '#fff8c0', '#ffffff'], count: 40, speed: 120, ttl: 0.8, gravity: -40 })
  g.events.push({ kind: 'revive' })
  return true
}

const neighbors: number[] = []

/** Max Repel: shoves every enemy inside the radius around each player back out. */
const repel = (g: Game, p: Player) => {
  for (const i of query(g.grid, p.x, p.y, REPEL_RADIUS + 16, neighbors)) {
    const e = g.enemies[i]
    if (!e || !isAlive(e) || dm.sq(e.x - p.x) + dm.sq(e.y - p.y) > dm.sq(REPEL_RADIUS)) continue
    const d = dirTo(p.x, p.y, e.x, e.y)
    const push = e.boss ? 90 : 240
    e.kx = d.x * push
    e.ky = d.y * push
  }
}

/** Per-tick upkeep: buff timers, Max Repel and the screen flash. */
export const updateConsumables = (g: Game, dt: number) => {
  if (tickBuffs(g.buffs, dt).length > 0) recomputeTeam(g)
  if (hasBuff(g.buffs, 'maxRepel')) for (const p of g.players) if (inPlay(p)) repel(g, p)
  g.flash = Math.max(0, g.flash - dt * 2.5)
}

/** Max Repel makes the team untouchable while it lasts. */
export const isRepelled = (g: Game) => hasBuff(g.buffs, 'maxRepel')
