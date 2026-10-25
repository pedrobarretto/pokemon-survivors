import { weightedPick } from '../engine/rng'
import { ENEMIES } from '../data/enemies'
import { stageIndexAt } from '../data/waves'
import { burst, setScreenShake } from './effects'
import { ENDLESS, endlessEventSize, REAPER, reaperDue, reaperHp, reaperSpeed, startEndless, type EndlessState } from './endless'
import { runMods } from './legend'
import { blastHorde, spawnEnemy } from './enemies'
import { dropCoins, dropPickup } from './pickups'
import { hasTrait } from './roster'
import { spawnRing, spawnSwarm } from './spawner'
import { anchorPlayer, nearestPlayer } from './players'
import { coopScale } from './coop'
import { COOP } from '../data/coop'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'
import { roomOf } from './room'
import { legendEntrance } from './legendScene'

/** Extra Poké Balls and ₽ dropped by a defeated Arceus, on top of a boss's usual drop. */
const REAPER_LOOT = { pokeballs: 3, coins: [250, 250, 250, 250] } as const

/** Chosen on the victory screen: the run goes on past Mewtwo, with no end but fainting. */
export const continueEndless = (g: Game) => {
  if (g.phase !== 'victory') return
  g.endless = startEndless(g.time)
  g.phase = 'playing'
}

/** Arceus descends just past the top of a player's screen (`anchorPlayer`) and blasts the horde away. */
const summonReaper = (g: Game, s: EndlessState) => {
  const p = anchorPlayer(g)
  const reaper = spawnEnemy(g, REAPER, p.x, p.y - g.view.h / 2 - 24)
  reaper.hp = reaper.maxHp = dm.round(reaperHp(s.reaperDefeats) * runMods(g).enemyHp * coopScale(g, COOP.scale.bossHp))
  s.reaperId = reaper.id
  s.reaperSince = g.time
  g.bossId = reaper.id
  blastHorde(g, 320)
  g.flash = 1
  setScreenShake(g, 12, 'team')
  g.events.push({ kind: 'reaper', defeats: s.reaperDefeats })
  legendEntrance(g, reaper)
}

const reaperDown = (g: Game, s: EndlessState, reaper: Enemy | undefined) => {
  const x = reaper?.x ?? g.player.x
  const y = reaper?.y ?? g.player.y
  dropCoins(g, x, y, REAPER_LOOT.coins)
  for (let i = 0; i < REAPER_LOOT.pokeballs; i++) dropPickup(g, x - 8 + i * 8, y + 4, 'pokeball')
  burst(g, x, y - 20, { colors: ['#fff0a0', '#f8d030', '#ffffff'], count: 80, speed: 200, ttl: 0.9 })
  s.reaperDefeats++
  s.reaperId = null
  s.reaperAt = g.time + ENDLESS.reaperReturn
  g.events.push({ kind: 'reaperDown', defeats: s.reaperDefeats })
}

/** Arceus speeds up as it hunts the nearest player, and never loses track: past their screen it blinks back to the edge. */
const hunt = (g: Game, s: EndlessState, reaper: Enemy) => {
  reaper.speed = reaperSpeed(ENEMIES[REAPER].speed, g.time - s.reaperSince)
  const p = nearestPlayer(g, reaper.x, reaper.y)
  const far = dm.hypot(g.view.w, g.view.h) * 0.75
  const dx = reaper.x - p.x
  const dy = reaper.y - p.y
  const d = dm.hypot(dx, dy)
  if (d <= far) return
  const edge = dm.hypot(g.view.w, g.view.h) / 2 + 16
  reaper.x = p.x + (dx / d) * edge
  reaper.y = p.y + (dy / d) * edge
}

/** Endless horde events and the reaper. Paused while the player is inside a room (a rift arena, a place). */
export const updateEndless = (g: Game) => {
  const s = g.endless
  if (!s || roomOf(g)) return
  if (g.time >= s.nextEvent) {
    // Trait species stay seasoning: a ring of 40 Nidoqueen would be the whole horde.
    const pool = (g.roster.stages[stageIndexAt(g.time)] ?? []).filter(([id]) => !hasTrait(id))
    const count = endlessEventSize(g.time)
    if (pool.length > 0) (s.events % 2 === 0 ? spawnRing : spawnSwarm)(g, weightedPick(g.rng, pool), count)
    s.events++
    s.nextEvent = g.time + ENDLESS.eventEvery
  }
  if (s.reaperId === null) {
    if (reaperDue(s, g.time)) summonReaper(g, s)
    return
  }
  const reaper = g.enemies.find((e) => e.id === s.reaperId)
  if (!reaper || reaper.dying >= 0) return reaperDown(g, s, reaper)
  hunt(g, s, reaper)
}
