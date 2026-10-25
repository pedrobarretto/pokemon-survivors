import type { CurseId } from '../data/curses'
import { abilityImmune } from './abilities'
import { chestCurse, CURSE, curseDrain } from './curses'
import { burst, floatText, shakeScreen } from './effects'
import { recomputeStats } from './leveling'
import { setPhase } from './players'
import type { Game } from './types'
import * as dm from '../engine/dmath'

/** Purple of everything cursed: the frame, the sparks, the HP it takes. */
export const CURSE_COLORS = ['#a050e0', '#e0b0ff', '#401060'] as const

/**
 * A locked chest just opened: maybe it holds a cursed item. If so the run
 * waits on the player (phase `curse`): take it or leave it, two cards picked
 * like a level-up (`chooseOffer`), so the replay records the choice.
 */
export const openCursedChest = (g: Game, x: number, y: number) => {
  const id = chestCurse(g.player.curses.held, g.time, g.rng)
  if (!id) return
  burst(g, x, y - 10, { colors: [...CURSE_COLORS, '#ffffff'], count: 36, speed: 90, ttl: 0.9, gravity: -40 })
  setPhase(g, 'curse')
  g.player.offers = [{ kind: 'curse', id, take: true }, { kind: 'curse', id, take: false }]
  g.events.push({ kind: 'curse', id, moment: 'found' })
}

/** The player's call on a chest's cursed item. */
export const decideCurse = (g: Game, id: CurseId, take: boolean) => {
  const p = g.player
  if (take && !g.player.curses.held.includes(id)) {
    g.player.curses.held.push(id)
    recomputeStats(g)
    burst(g, p.x, p.y - 12, { colors: [...CURSE_COLORS, '#ffffff'], count: 46, speed: 120, ttl: 0.8, gravity: -30 })
    shakeScreen(g, 3)
  }
  g.events.push({ kind: 'curse', id, moment: take ? 'taken' : 'left' })
}

/** A cursed item takes `share` of max HP: a purple number over the player, never fainting them. Magic Guard (`drain`) spares them. */
const bite = (g: Game, id: CurseId, share: number) => {
  if (abilityImmune(g, 'drain')) return
  const p = g.player
  const before = p.hp
  p.hp = curseDrain(p.hp, p.stats.maxHp, share)
  const lost = before - p.hp
  if (lost <= 0) return
  if (lost >= 1) floatText(g, p.x + 6, p.y - 26, String(dm.round(lost)), CURSE_COLORS[1], true)
  g.events.push({ kind: 'curse', id, moment: 'recoil' })
}

/** Life Orb: a move went off, and that costs HP (at most once every `CURSE.lifeOrb.gap` seconds). */
export const curseCast = (g: Game) => {
  const c = g.player.curses
  if (!c.held.includes('lifeOrb') || g.now < c.recoilAt) return
  c.recoilAt = g.now + CURSE.lifeOrb.gap
  bite(g, 'lifeOrb', CURSE.lifeOrb.cost)
  const p = g.player
  burst(g, p.x, p.y - 12, { colors: ['#f05878', '#a050e0'], count: 4, speed: 40, ttl: 0.35 })
}

/** Flame Orb's burn, every tick of it: some HP and a few embers off the player. */
export const updateCurses = (g: Game) => {
  const c = g.player.curses
  if (!c.held.includes('flameOrb') || g.now < c.burnAt) return
  c.burnAt = g.now + CURSE.flameOrb.tick
  bite(g, 'flameOrb', CURSE.flameOrb.perSecond * CURSE.flameOrb.tick)
  const p = g.player
  burst(g, p.x, p.y - 8, { colors: ['#f8a030', '#f85818', '#fff0a0'], count: 3, speed: 25, ttl: 0.5, gravity: -70 })
}
