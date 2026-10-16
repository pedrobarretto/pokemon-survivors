import { dirTo } from '../engine/math'
import { chance, range } from '../engine/rng'
import { effectiveness, TYPE_COLORS, type PokeType } from '../data/types'
import { ENEMY_BERRY_CHANCE } from '../data/consumables'
import { ENEMIES } from '../data/enemies'
import { enemyDrop, isRepelled, tryRevive } from './consumables'
import { logDefeat } from './dex'
import { DIFFICULTIES } from './difficulty'
import { burst, damageText, floatText } from './effects'
import { bossEggSource } from './eggs'
import { coinDrops } from './meta'
import { awardEgg, dropCoins, dropPickup, dropXp } from './pickups'
import { applyStatus, STATUS_RULES, type StatusKind } from './status'
import { countKill } from './tally'
import { absorb } from './traits'
import { faint } from './coop'
import { actAs, inPlay } from './players'
import type { Attack, DamageSource, Enemy, Game, Player } from './types'
import { weatherBoost, weatherHere, weatherPower } from './weather'

const TEXT_COLORS = { super: '#ffd830', normal: '#ffffff', weak: '#a8a8b8', warded: '#88b8f8' } as const

export const damageEnemy = (g: Game, e: Enemy, attack: Attack) => {
  const eff = effectiveness(attack.type, e.types)
  const raw = Math.max(1, Math.round(attack.damage * eff * weatherBoost(weatherHere(g), attack.type) * range(g.rng, 0.9, 1.1)))
  // A Bronzong ward soaks the hit first.
  const dmg = absorb(e.trait, raw)
  e.hp -= dmg
  e.flash = 0.16
  g.player.damageByMove[attack.move] = (g.player.damageByMove[attack.move] ?? 0) + dmg

  // Vines push sideways; everything else pushes away from the hitbox center.
  const p = g.player
  const away = attack.shape.kind === 'rect' ? { x: Math.sign(e.x - p.x) || 1, y: 0 } : dirTo(attack.x, attack.y, e.x, e.y, p.facing)
  const kb = attack.knockback / e.mass
  e.kx += away.x * kb
  e.ky += away.y * kb

  const status = attack.status
  if (status && chance(g.rng, status.chance)) {
    const fresh = e.status[status.kind].time <= 0
    applyStatus(e.status, status, attack.damage, e.boss, attack.move, g.player.slot)
    if (fresh && status.kind !== 'slow') burst(g, e.x, e.y - e.radius, { colors: [STATUS_RULES[status.kind].color, '#ffffff'], count: 5, speed: 50, ttl: 0.3 })
  }

  const color = dmg < raw ? TEXT_COLORS.warded : eff > 1 ? TEXT_COLORS.super : eff < 1 ? TEXT_COLORS.weak : TEXT_COLORS.normal
  damageText(g, e, dmg, color, eff > 1)
  burst(g, e.x, e.y - e.radius, { colors: [TYPE_COLORS[attack.type], '#ffffff'], count: eff > 1 ? 6 : 3, speed: 70, ttl: 0.25 })
  g.events.push({ kind: 'hit', effective: eff })

  if (e.hp <= 0) killEnemy(g, e, attack.move)
}

/** Damage-over-time tick: no knockback or hit sound, number in the status color. Counts for player `by`, who inflicted it. */
export const dotDamage = (g: Game, e: Enemy, amount: number, move: DamageSource | null, kind: StatusKind, by = 0) => {
  const dmg = Math.max(1, Math.round(amount))
  const owner = g.players[by] ?? g.player
  e.hp -= dmg
  if (move) owner.damageByMove[move] = (owner.damageByMove[move] ?? 0) + dmg
  damageText(g, e, dmg, STATUS_RULES[kind].color)
  if (e.hp <= 0) actAs(g, owner, () => killEnemy(g, e, move))
}

/** Faints an enemy. `source` (when known) lets a kill by the special, or any kill mid-chain, feed Power Herb. */
export const killEnemy = (g: Game, e: Enemy, source?: DamageSource | null) => {
  e.dying = 0
  e.hp = 0
  g.kills++
  if (source === 'special' || g.player.special.chaining) g.player.special.kills++
  countKill(g.tally, e, weatherHere(g), g.biome.id, g.outbreak)
  const big = e.boss || e.shiny
  burst(g, e.x, e.y - e.radius, { colors: ['#ffffff', '#f8f8c8', '#c8d8f8'], count: big ? 60 : 8, speed: big ? 160 : 70, ttl: 0.45 })
  g.events.push({ kind: 'kill', boss: e.boss })
  // A defeated shiny is caught: it joins the player's Pokédex as their own.
  // Announced once per species per run; the shell skips ones the save already has.
  const dex = ENEMIES[e.kind].dex
  const fresh = e.shiny && !g.dexLog.shinies.has(dex)
  logDefeat(g.dexLog, dex, e.shiny)
  if (fresh) g.events.push({ kind: 'caught', enemy: e.kind })

  if (e.xp > 0) dropXp(g, e.x, e.y, e.xp)
  dropCoins(g, e.x, e.y, coinDrops(g.rng, e))
  if (e.shiny) dropPickup(g, e.x + 6, e.y, 'pokeball')
  if (e.boss) {
    dropPickup(g, e.x, e.y, 'pokeball')
    awardEgg(g, bossEggSource(e.kind), e.x, e.y)
    if (g.bossId === e.id) g.bossId = null
    g.shake = 6
    if (e.kind === 'mewtwo') {
      g.phase = 'victory'
      g.events.push({ kind: 'victory' })
    }
  } else if (chance(g.rng, ENEMY_BERRY_CHANCE)) {
    dropPickup(g, e.x + 6, e.y, 'berry')
  } else {
    enemyDrop(g, e)
  }
}

/**
 * Damages the acting player (world systems hurt a target through `hurtPlayers`
 * or `actAs`). `from` (a body that touched them) gets shoved back; hazards pass
 * none. `types` is the attack's typing for the weather (a body attacks with its own types).
 */
export const hurtPlayer = (g: Game, amount: number, from?: Enemy, types: readonly PokeType[] = from?.types ?? []) => {
  const p = g.player
  if (p.iframes > 0 || isRepelled(g) || g.phase !== 'playing' || !inPlay(p)) return
  const dmg = Math.max(1, Math.round(amount * DIFFICULTIES[g.difficulty].enemyDamage * weatherPower(weatherHere(g), types) * p.stats.damageTaken - p.stats.armor))
  p.hp -= dmg
  p.iframes = 0.5
  p.hurt = 0.3
  g.shake = Math.max(g.shake, 3)
  floatText(g, p.x, p.y - 28, String(dmg), '#ff5040', true)
  burst(g, p.x, p.y - 10, { colors: ['#ff5040', '#ffffff'], count: 6, speed: 80, ttl: 0.3 })
  g.events.push({ kind: 'hurt' })
  // A small shove keeps the player from being body-blocked into a death spiral.
  if (from) {
    const away = dirTo(from.x, from.y, p.x, p.y)
    from.kx -= away.x * 60
    from.ky -= away.y * 60
  }

  if (p.hp <= 0 && !tryRevive(g)) {
    if (g.coop) return faint(g, p)
    p.hp = 0
    g.phase = 'gameover'
    g.events.push({ kind: 'gameover' })
  }
}

/** Hurts every player in play that `hits`, each by `amount(p)` (a share of their own HP, say), acting as them. */
export const hurtPlayers = (g: Game, hits: (p: Player) => boolean, amount: (p: Player) => number, from?: Enemy, types?: readonly PokeType[]) => {
  for (const p of g.players) if (inPlay(p) && hits(p)) actAs(g, p, () => hurtPlayer(g, amount(p), from, types))
}

/** Heals the player by `amount`, cut or not by the difficulty, up to max HP. Returns the HP actually restored. */
export const healPlayer = (g: Game, amount: number) => {
  const p = g.player
  const healed = Math.max(0, Math.min(amount * DIFFICULTIES[g.difficulty].healing, p.stats.maxHp - p.hp))
  p.hp += healed
  return healed
}
