import { dirTo } from '../engine/math'
import { chance, range } from '../engine/rng'
import { effectiveness, TYPE_COLORS, type PokeType } from '../data/types'
import { ENEMY_BERRY_CHANCE } from '../data/consumables'
import { ENEMIES, type EnemyDef } from '../data/enemies'
import { harmBy, NO_ONE, noteHit, type HarmBy } from './harm'
import type { HitKind } from '../data/abilities'
import { abilityHolds, abilityHurt, abilityImmune, abilityKill, abilityTakes, strikeBonus } from './abilities'
import { enemyDrop, isRepelled, tryMaxRevive, tryRevive } from './consumables'
import { logDefeat } from './dex'
import { runMods } from './legend'
import { burst, damageText, floatText, setScreenShake, shakeScreen } from './effects'
import { bossEggSource } from './eggs'
import { dropBossTm } from './tms'
import { dropEvoItem } from './evoGate'
import { coinDrops } from './meta'
import { modKill } from './mods'
import { awardEgg, dropCoins, dropPickup, dropXp } from './pickups'
import { bustDisguise, faintCandies, nightBossDown } from './halloween'
import { applyStatus, breakOnHit, hitTakenMult, STATUS_RULES, type StatusKind } from './status'
import { bonusMult, drainAmount, drainRefill, executes, nearestFoes, SEED_DECAY, SEED_JUMPS, SEED_MIN_TIME, SEED_REACH } from './kitRules'
import { guardHit, moveEvent, moveHit } from './moveHooks'
import { fallInArena } from './riftArena'
import { domainHarm } from './rift'
import { fallInPlace } from './placeKit'
import { countKill, countLegend } from './tally'
import { noteHarm, noteKill } from './tensionSystem'
import { absorb } from './traits'
import { alphaDown } from './alphas'
import { disguiseTakes, holdsOn, phaseTaken } from './bossFight'
import { legendFell } from './legendScene'
import { hordeGrit } from './horde'
import type { Attack, DamageSource, Enemy, Game } from './types'
import { playerWeatherBoost, weatherHere, weatherPower } from './weather'
import { dropForEach, faint, winRun } from './coop'
import { inPlay } from './players'
import * as dm from '../engine/dmath'

const TEXT_COLORS = { super: '#ffd830', normal: '#ffffff', weak: '#a8a8b8', warded: '#88b8f8' } as const

export const damageEnemy = (g: Game, e: Enemy, attack: Attack) => {
  // A sure hit (Sacred Sword) lands resisted matchups as neutral and cuts through wards.
  const eff = attack.sure ? Math.max(1, effectiveness(attack.type, e.types)) : effectiveness(attack.type, e.types)
  // Conditional bonuses (Hex), a mark and a freeze multiply the hit; without them it's exactly ×1.
  const base = attack.damage * (bonusMult(attack.bonus, e) * hitTakenMult(e.status) * phaseTaken(e))
  const raw = Math.max(1, dm.round(base * eff * playerWeatherBoost(g, attack.type) * strikeBonus(g, e) * range(g.rng, 0.9, 1.1)))
  // A Bronzong ward soaks the hit first, unless the move or the ability (Infiltrator) goes through wards.
  const dmg = attack.sure || attack.ignoreWards || abilityImmune(g, 'wards') ? raw : absorb(e.trait, raw)
  // Mimikyu's Disguise takes the first big hit whole.
  if (disguiseTakes(e, dmg)) return bustDisguise(g, e)
  e.hp -= dmg
  e.flash = 0.16
  g.player.damageByMove[attack.move] = (g.player.damageByMove[attack.move] ?? 0) + dmg
  if (breakOnHit(e.status)) shatter(g, e, 'freeze')

  // Vines push sideways; everything else pushes away from the hitbox center.
  const p = g.player
  const away = attack.shape.kind === 'rect' ? { x: Math.sign(e.x - p.x) || 1, y: 0 } : dirTo(attack.x, attack.y, e.x, e.y, p.facing)
  // The regular horde stiffens with the minutes (`hordeGrit`), so late crowds press through an aura.
  const kb = attack.knockback / (e.boss ? e.mass : e.mass * hordeGrit(g.time, g.difficulty))
  e.kx += away.x * kb
  e.ky += away.y * kb

  const status = attack.status
  if (status && chance(g.rng, status.chance)) {
    const fresh = e.status[status.kind].time <= 0
    applyStatus(e.status, status, base, e.boss, attack.move, g.player.slot)
    if (fresh && status.kind !== 'slow') burst(g, e.x, e.y - e.radius, { colors: [STATUS_RULES[status.kind].color, '#ffffff'], count: 5, speed: 50, ttl: 0.3 })
  }

  const color = dmg < raw ? TEXT_COLORS.warded : eff > 1 ? TEXT_COLORS.super : eff < 1 ? TEXT_COLORS.weak : TEXT_COLORS.normal
  damageText(g, e, dmg, color, eff > 1)
  burst(g, e.x, e.y - e.radius, { colors: [TYPE_COLORS[attack.type], '#ffffff'], count: eff > 1 ? 6 : 3, speed: 70, ttl: 0.25 })
  g.events.push({ kind: 'hit', effective: eff })
  if (attack.drain > 0) drainHeal(g, dmg, attack.drain)
  if (attack.move !== 'special' && attack.move !== 'ability') {
    moveEvent(g, attack.move, 'hit')
    moveHit(g, attack, e)
  }

  if (e.hp > 0 && executes(attack.execute, e.hp, e.maxHp, e.boss)) {
    shatter(g, e, 'execute')
    e.hp = 0
  }
  if (e.hp <= 0) {
    killEnemy(g, e, attack.move)
    if (attack.mod) modKill(g, e, attack)
  }
}

/** Ice shards flying off a foe: a frozen foe's ice broken, or an execute. */
const shatter = (g: Game, e: Enemy, cause: 'execute' | 'freeze') => {
  const colors = cause === 'freeze' ? ['#ffffff', '#c8f0f8', '#78c8f0'] : ['#ffffff', '#f8f8c8', '#f85868']
  burst(g, e.x, e.y - e.radius, { colors, count: 14, speed: 120, ttl: 0.4, gravity: 160, size: 2 })
  g.events.push({ kind: 'shatter', cause })
}

/** Heals `fraction` of `damage` through the drain budget (`kitRules.ts`). Returns the HP restored. */
export const drainHeal = (g: Game, damage: number, fraction: number) => {
  const p = g.player
  const d = p.drain
  d.left = drainRefill(d.left, g.now - d.at, p.stats.maxHp)
  d.at = g.now
  const amount = drainAmount(damage, fraction, d.left)
  if (amount <= 0) return 0
  d.left -= amount
  const healed = healPlayer(g, amount)
  if (healed >= 1 && chance(g.rng, 0.35)) burst(g, p.x, p.y - 12, { colors: ['#78f878', '#d8f8c8'], count: 2, speed: 25, ttl: 0.45, gravity: -50 })
  return healed
}

/**
 * A body blow from the world rather than a hitbox (a thrown foe, a confused
 * one bumping a neighbor): flash, white number, a hit sound, kill credit to `move`.
 */
export const bumpDamage = (g: Game, e: Enemy, amount: number, move: DamageSource | null) => {
  const dmg = Math.max(1, dm.round(amount))
  e.hp -= dmg
  e.flash = 0.16
  if (move) g.player.damageByMove[move] = (g.player.damageByMove[move] ?? 0) + dmg
  damageText(g, e, dmg, TEXT_COLORS.normal)
  g.events.push({ kind: 'hit', effective: 1 })
  if (e.hp <= 0) killEnemy(g, e, move)
}

/** A fainting seeded foe passes its seed to its nearest neighbors, a little weaker, with a hop of green specks. */
const spreadSeed = (g: Game, e: Enemy) => {
  const seed = e.status.seed
  const spec = { kind: 'seed', chance: 1, duration: Math.max(seed.time, SEED_MIN_TIME), power: seed.power * SEED_DECAY } as const
  for (const o of nearestFoes(g.enemies, e, SEED_JUMPS, SEED_REACH, (f) => f.status.seed.time > 0)) {
    applyStatus(o.status, spec, 1, o.boss, seed.move, seed.by)
    const dx = o.x - e.x
    const dy = o.y - o.radius - (e.y - e.radius)
    for (let i = 0; i < 3; i++) {
      const k = 2.2 - i * 0.35
      g.particles.push({ x: e.x, y: e.y - e.radius, vx: dx * k, vy: dy * k - 40, life: 0, ttl: 0.45, color: i ? '#78c850' : '#e0f8a0', size: i ? 1 : 2, gravity: 180, drag: 0 })
    }
  }
}

/** Damage-over-time tick: no knockback or hit sound, number in the status color. */
export const dotDamage = (g: Game, e: Enemy, amount: number, move: DamageSource | null, kind: StatusKind) => {
  const dmg = Math.max(1, dm.round(amount))
  e.hp -= dmg
  if (move) g.player.damageByMove[move] = (g.player.damageByMove[move] ?? 0) + dmg
  damageText(g, e, dmg, STATUS_RULES[kind].color)
  if (e.hp <= 0) killEnemy(g, e, move)
}

/** Faints an enemy. `source` (when known) lets a kill by the special, or any kill mid-chain, feed Power Herb. */
export const killEnemy = (g: Game, e: Enemy, source?: DamageSource | null) => {
  // A boss with phases still to go doesn't faint: it stays up and moves on to its next phase.
  if (holdsOn(e)) {
    e.hp = 1
    return
  }
  if (e.status.seed.time > 0) spreadSeed(g, e)
  e.dying = 0
  e.hp = 0
  g.kills++
  g.player.record.kills++
  noteKill(g, e)
  if (source === 'special' || g.player.special.chaining) g.player.special.kills++
  countKill(g.tally, e, weatherHere(g), g.biome.id, g.outbreak)
  // Co-op: the killer's own count too, for their missions (`coopPayout`).
  if (g.coop !== null) countKill(g.player.record.tally, e, weatherHere(g), g.biome.id, g.outbreak)
  abilityKill(g, e)
  const big = e.boss || e.shiny
  burst(g, e.x, e.y - e.radius, { colors: ['#ffffff', '#f8f8c8', '#c8d8f8'], count: big ? 60 : 8, speed: big ? 160 : 70, ttl: 0.45 })
  g.events.push({ kind: 'kill', boss: e.boss })
  // A defeated shiny is caught: it joins the player's Pokédex as their own.
  // Announced once per species per run; the shell skips ones the save already has.
  const dex = ENEMIES[e.kind].dex
  const fresh = e.shiny && !g.dexLog.shinies.has(dex)
  logDefeat(g.dexLog, dex, e.shiny)
  if (fresh) g.events.push({ kind: 'caught', enemy: e.kind })

  // Under tension a regular's faint gives a share of its loot (`tension.ts`); a boss's never shrinks.
  const share = e.boss ? 1 : g.tension.share
  if (e.xp > 0) dropXp(g, e.x, e.y, e.xp * share)
  dropCoins(g, e.x, e.y, coinDrops(g.rng, e, g.endless !== null))
  faintCandies(g, e, share)
  if (e.shiny) dropPickup(g, e.x + 6, e.y, 'pokeball')
  if (e.alpha) {
    alphaDown(g, e)
  } else if (e.boss) {
    // Every boss defeated earns everyone an Esquecer charge (`banishOffer`).
    for (const p of g.players) p.banishes++
    // A legendary's defeat counts toward capturing it (the save's side, `legendBeaten`).
    const def: EnemyDef = ENEMIES[e.kind]
    if (def.legendary) {
      countLegend(g.tally, e.kind, e.shiny)
      g.events.push({ kind: 'legendBeaten', legend: e.kind, shiny: e.shiny })
    }
    nightBossDown(g, e)
    // Co-op: a Poké Ball, the TM and an evolution item for each player (`dropForEach`); the egg is everyone's.
    dropForEach(g, () => dropPickup(g, e.x, e.y, 'pokeball'))
    awardEgg(g, bossEggSource(e.kind), e.x, e.y)
    dropForEach(g, () => dropBossTm(g, e))
    dropForEach(g, () => dropEvoItem(g, e.x + 10, e.y + 2))
    if (g.bossId === e.id) g.bossId = null
    setScreenShake(g, 6, e)
    // A wave legendary's capture plays where it fell; Mewtwo's victory waits for it.
    const captured = legendFell(g, e)
    // A faint earlier in the tick stands: the run is over, not won.
    if (e.kind === 'mewtwo' && g.phase !== 'gameover') {
      if (captured && g.legendScene) g.legendScene.then = 'victory'
      else winRun(g)
    }
  } else if (chance(g.rng, ENEMY_BERRY_CHANCE * share)) {
    dropPickup(g, e.x + 6, e.y, 'berry')
  } else {
    enemyDrop(g, e, share)
  }
}

/** The most of a hit armor takes off: past it, more armor stops paying, so late hits never shrink to 1. */
export const ARMOR_CAP = 0.5

/** A `raw` hit on the player after `armor`: each point takes 1 off (a negative one adds 1), up to `ARMOR_CAP` of the hit. At least 1. */
export const armored = (raw: number, armor: number) => Math.max(1, dm.round(raw - Math.min(armor, raw * ARMOR_CAP)))

/**
 * Damages the player. `from` (a body that touched them) gets shoved back; hazards pass none.
 * `types` is the attack's typing for the weather (a body attacks with its own types), and
 * `hit` what kind of harm it is, for the abilities (`abilityTakes`): a body, a boss's strike, lava…
 * `by` names who dealt it for the end screen (`Player.hits`; a body names itself); it never changes the outcome.
 */
export const hurtPlayer = (
  g: Game,
  amount: number,
  from?: Enemy,
  types: readonly PokeType[] = from?.types ?? [],
  hit: HitKind = from ? 'body' : 'hazard',
  by: HarmBy | null = null,
) => {
  const p = g.player
  if (p.iframes > 0 || p.hidden || isRepelled(g) || g.phase !== 'playing') return
  // Co-op: fainted, away, gone or mid-evolution players can't be hurt.
  if (g.coop !== null && !inPlay(p)) return
  if (p.guard) return guardHit(g, p.guard, from)
  if (from && blinded(g, from)) return
  const taken = abilityTakes(g, amount, types, hit, from)
  if (taken === null) return
  const mods = runMods(g)
  // Air Lock: the weather boosts no foe's hit.
  const weather = abilityImmune(g, 'weather') ? 1 : weatherPower(weatherHere(g), types)
  const dmg = armored(taken * mods.enemyDamage * weather * domainHarm(g, from !== undefined) * p.stats.damageTaken, p.stats.armor)
  p.hp -= dmg
  p.record.taken += dmg
  noteHit(p, by ?? (from ? harmBy(from) : NO_ONE), hit, dmg)
  p.iframes = mods.iframes
  noteHarm(g, dmg)
  p.hurt = 0.3
  shakeScreen(g, 3)
  floatText(g, p.x, p.y - 28, String(dmg), '#ff5040', true)
  burst(g, p.x, p.y - 10, { colors: ['#ff5040', '#ffffff'], count: 6, speed: 80, ttl: 0.3 })
  g.events.push({ kind: 'hurt' })
  abilityHurt(g)
  moveEvent(g, null, 'hurt')
  // A small shove keeps the player from being body-blocked into a death spiral.
  if (from) {
    const away = dirTo(from.x, from.y, p.x, p.y)
    from.kx -= away.x * 60
    from.ky -= away.y * 60
  }

  if (p.hp > 0) return
  // Falling in a rift arena or a place isn't the end: the rift throws the player back out, a rescue brings them back
  // (in co-op once the last one standing falls; until then they faint).
  if (g.rift.arena && (g.coop === null || !teammateStanding(g))) return fallInArena(g)
  if (g.place.inside && (g.coop === null || !teammateStanding(g))) return fallInPlace(g)
  // Sturdy holds before a Max Revive (the Bag's), which goes before a held Revive.
  if (!abilityHolds(g) && !tryMaxRevive(g) && !tryRevive(g)) {
    if (g.coop !== null) return faint(g, from?.kind ?? null, hit)
    p.hp = 0
    g.phase = 'gameover'
    g.events.push({ kind: 'gameover', foe: from?.kind ?? null, hit })
  }
}

/** Co-op: someone besides the acting player still stands. */
const teammateStanding = (g: Game) => g.players.some((q) => q !== g.player && inPlay(q))

/**
 * Whether `from`'s contact hit misses: it stands in a hitbox with `blind`
 * (Sand Tomb) and the seeded roll says so. A puff of sand marks the miss and
 * a short i-frame keeps the same crowd from rolling again every tick.
 */
const blinded = (g: Game, from: Enemy) => {
  for (const a of g.attacks) {
    if (a.blind <= 0 || a.age < 0 || a.shape.kind !== 'circle') continue
    if (dm.sq(a.x - from.x) + dm.sq(a.y - (from.y - from.radius)) > dm.sq(a.shape.r + from.radius)) continue
    if (!chance(g.rng, a.blind)) return false
    const p = g.player
    p.iframes = Math.max(p.iframes, BLIND_IFRAMES)
    burst(g, (p.x + from.x) / 2, p.y - 8, { colors: ['#e8d098', '#c0a060', '#ffffff'], count: 6, speed: 50, ttl: 0.35, gravity: 40 })
    return true
  }
  return false
}

/** I-frames after a foe's blinded contact misses, so a crowd in the sand rolls once in a while, not every tick. */
const BLIND_IFRAMES = 0.4

/**
 * Heals the player by `amount`, cut or not by the difficulty, up to max HP.
 * Returns the HP actually restored. A fainted co-op player takes no heal: only
 * a teammate gets them back up (`coop.ts`).
 */
export const healPlayer = (g: Game, amount: number) => {
  const p = g.player
  if (g.coop !== null && p.hp <= 0) return 0
  const healed = Math.max(0, Math.min(amount * runMods(g).healing, p.stats.maxHp - p.hp))
  p.hp += healed
  return healed
}
