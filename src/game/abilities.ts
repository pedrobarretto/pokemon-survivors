import { chance, pick } from '../engine/rng'
import * as dm from '../engine/dmath'
import { ABILITIES, ABILITY, BRANCH_ABILITIES, FAMILY_ABILITIES, type AbilityEffect, type AbilityId, type AbilitySet, type HitKind, type Immunity } from '../data/abilities'
import type { BiomeId } from '../data/biomes'
import type { BranchId } from '../data/branches'
import type { PlayableId } from '../data/hatchlings'
import { POKE_TYPES, type PokeType } from '../data/types'
import { playerForm } from './branch'
import { healPlayer, killEnemy } from './combat'
import { burst, damageText, floatText, shakeScreen } from './effects'
import { dropCoins, dropPickup, dropXp } from './pickups'
import { isAlive } from './queries'
import type { StatDelta } from './stats'
import { applyStatus, isAsleep } from './status'
import type { Enemy, Game } from './types'
import { setWeather, weatherHere } from './weather'
import { roomOf } from './room'
import { innateAbility, innateEffects } from './legend'

/**
 * Abilities in a run (`data/abilities.ts`): picked when the first evolution
 * lands, played by the simulation. Most effects are stats that hold while a
 * condition does (`abilityDeltas`, rebuilt by `recomputeStats` whenever
 * `abilityKey` changes); the rest hook into a hit taken (`abilityTakes`,
 * `abilityHurt`, `abilityHolds`), a hit landed (`strikeBonus`), a kill
 * (`abilityKill`) or tick on their own (`updateAbility`).
 */

export type AbilityState = {
  /** The ability picked (null until the first evolution). */
  id: AbilityId | null
  /** `abilityKey` when the stats were last built; a change rebuilds them. */
  key: number
  /** Stacks of an onKill, timer or onHurt ability (whole stacks count; Moxie's wear off bit by bit). */
  stacks: number
  /** Seconds toward the next timer, heal or Moody tick, or left on onHurt stacks. */
  clock: number
  /** Seconds to the next contact or aura pulse. */
  pulse: number
  /** Seconds until a guard is up again (0: up). */
  guard: number
  /** Kills toward the next onKill stack. */
  kills: number
  /** Sturdy already held this run. */
  spent: boolean
  /** Moody's current boost, an index into its options (-1: none yet). */
  mood: number
  /** The biome a summoning ability last called its weather in. */
  biome: BiomeId | null
}

export const createAbilityState = (): AbilityState => ({
  id: null, key: -1, stacks: 0, clock: 0, pulse: 0, guard: 0, kills: 0, spent: false, mood: -1, biome: null,
})

/** The abilities a run picks from: the branch's own when the first evolution branched (Eevee), else the family's. */
export const abilitySet = (starter: PlayableId, branch: BranchId | null): AbilitySet => {
  const own: Partial<Record<BranchId, AbilitySet>> = BRANCH_ABILITIES
  return (branch && own[branch]) || FAMILY_ABILITIES[starter]
}

/** The ability in play: none while a Mega form lasts, whose own ability replaces it. */
export const activeAbility = (g: Game): AbilityId | null => (g.player.mega.active > 0 ? null : g.player.ability.id)

const NONE: readonly AbilityEffect[] = []
const joined = new Map<string, readonly AbilityEffect[]>()

/**
 * The effects in play: a legend's innate (`legend.ts`, always on) and the
 * ability picked. Cached per pair, since the hits and ticks ask all the time.
 */
const effectsOf = (g: Game): readonly AbilityEffect[] => {
  const id = activeAbility(g)
  const innate = innateEffects(g.player.starter)
  if (innate.length === 0) return id ? ABILITIES[id].effects : NONE
  if (!id) return innate
  const key = `${g.player.starter}|${id}`
  let effects = joined.get(key)
  if (!effects) joined.set(key, (effects = [...innate, ...ABILITIES[id].effects]))
  return effects
}

/** Tells the shell an effect did something, under the ability it belongs to: the one picked, else the innate. */
const proc = (g: Game, e: AbilityEffect) => {
  const id = activeAbility(g)
  const own: readonly AbilityEffect[] = id ? ABILITIES[id].effects : NONE
  const owner = id && own.includes(e) ? id : innateAbility(g.player.starter)
  if (owner) g.events.push({ kind: 'ability', id: owner, moment: 'proc' })
}

/** How lucky the level-up cards come out (a `luck` effect: Jirachi's Serene Grace): extra rare odds and a shiny multiplier. */
export const abilityLuck = (g: Game) => {
  const e = effectOf(g, 'luck')
  return e ? { rare: e.rare, shiny: e.shiny } : { rare: 0, shiny: 1 }
}

/** The ability's effect of a kind, if it has one. */
const effectOf = <K extends AbilityEffect['kind']>(g: Game, kind: K) =>
  effectsOf(g).find((e): e is Extract<AbilityEffect, { kind: K }> => e.kind === kind)

/** Picks the ability: fresh state, and any summoned weather comes on the next tick. The caller rebuilds the stats. */
export const grantAbility = (g: Game, id: AbilityId) => {
  g.player.ability = { ...createAbilityState(), id }
  g.events.push({ kind: 'ability', id, moment: 'picked' })
}

/* ---------------- Stats (pure given the game) ---------------- */

const hpShare = (g: Game) => g.player.hp / g.player.stats.maxHp

const scaled = (d: StatDelta, n: number): StatDelta => {
  const { typeDamage, tagDamage, ...flat } = d
  const out: Record<string, unknown> = Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, (v ?? 0) * n]))
  if (typeDamage) out.typeDamage = Object.fromEntries(Object.entries(typeDamage).map(([k, v]) => [k, (v ?? 0) * n]))
  if (tagDamage) out.tagDamage = Object.fromEntries(Object.entries(tagDamage).map(([k, v]) => [k, (v ?? 0) * n]))
  return out as StatDelta
}

const typeBonus = (types: readonly PokeType[], bonus: number): StatDelta => ({ typeDamage: Object.fromEntries(types.map((type) => [type, bonus])) })

/** Whether a conditional effect is on right now. */
const effectOn = (g: Game, e: AbilityEffect) => {
  switch (e.kind) {
    case 'pinch':
      return hpShare(g) < ABILITY.pinch
    case 'weather':
      return weatherHere(g) === e.weather
    case 'lowHp':
      return hpShare(g) < ABILITY.lowHp
    case 'fullHp':
      return hpShare(g) >= ABILITY.fullHp
    default:
      return false
  }
}

/** Whole stacks the ability holds (onKill, timer, onHurt). */
export const abilityStacks = (g: Game) => Math.floor(g.player.ability.stacks)

/**
 * What the ability adds to the stats right now. `emptySlots` are the held
 * item slots left (Unburden). Used by `recomputeStats`.
 */
export const abilityDeltas = (g: Game, emptySlots: number): StatDelta[] =>
  effectsOf(g).flatMap((e): StatDelta[] => {
    switch (e.kind) {
      case 'stats':
        return [e.stats]
      case 'pinch':
        return effectOn(g, e) ? [typeBonus([e.type], e.bonus)] : []
      case 'weather':
      case 'lowHp':
      case 'fullHp':
        return effectOn(g, e) ? [e.stats] : []
      case 'tag':
        return [{ tagDamage: { [e.tag]: e.bonus } }]
      case 'ownType':
        return [typeBonus(playerForm(g).types, e.bonus)]
      case 'offType': {
        const own = playerForm(g).types
        return [typeBonus(POKE_TYPES.filter((type) => !own.includes(type)), e.bonus)]
      }
      case 'onKill':
      case 'timer':
      case 'onHurt':
        return abilityStacks(g) > 0 ? [scaled(e.stats, abilityStacks(g))] : []
      case 'moody':
        return g.player.ability.mood >= 0 && e.options[g.player.ability.mood] ? [e.options[g.player.ability.mood]!] : []
      case 'unburden':
        return emptySlots > 0 ? [scaled(e.stats, emptySlots)] : []
      default:
        return []
    }
  })

/** The conditions `abilityDeltas` reads, as one number: when it changes, the stats need rebuilding. */
export const abilityKey = (g: Game) => {
  let bits = 0
  effectsOf(g).forEach((e, i) => {
    if (effectOn(g, e)) bits |= 1 << i
  })
  return bits + 256 * (abilityStacks(g) + 64 * (g.player.ability.mood + 1))
}

/** Whether the ability is doing something right now, for the HUD: a condition met, stacks held, a guard or Sturdy waiting. */
export const abilityLit = (g: Game) =>
  effectsOf(g).some((e) =>
    e.kind === 'guard' ? g.player.ability.guard <= 0
    : e.kind === 'sturdy' ? !g.player.ability.spent
    : e.kind === 'onKill' || e.kind === 'timer' || e.kind === 'onHurt' ? abilityStacks(g) > 0
    : e.kind === 'moody' ? g.player.ability.mood >= 0
    : effectOn(g, e),
  )

/* ---------------- Hits taken ---------------- */

/** Hits that count as a boss's: its strikes and shots, and the bodies of bosses and elites. */
const bossHit = (hit: HitKind, from?: Enemy) => hit === 'hazard' || hit === 'zone' || hit === 'shot' || (hit === 'body' && from !== undefined && (from.boss || from.elite))

const IMMUNE_TO: Partial<Record<HitKind, Immunity>> = { lava: 'lava', trap: 'trap', blast: 'blast', zone: 'zone' }

/** Whether the ability spares the player a kind of harm (the weather's wear, slow terrain, wards…). */
export const abilityImmune = (g: Game, what: Immunity) => effectsOf(g).some((e) => e.kind === 'immune' && e.to.includes(what))

/** The ability's power for contact damage, reflected hits and statuses: grows with the damage stat and the level, like the special. */
export const contactPower = (g: Game) => ABILITY.contactPower * g.player.stats.might * (1 + 0.04 * (g.player.level - 1))

/** Ability damage on a foe: a number, the results' "ability" row, and the kill. */
const strike = (g: Game, e: Enemy, amount: number) => {
  const dmg = Math.max(1, Math.round(amount))
  e.hp -= dmg
  e.flash = 0.12
  g.player.damageByMove.ability = (g.player.damageByMove.ability ?? 0) + dmg
  damageText(g, e, dmg, '#f8e8b0')
  if (e.hp <= 0) killEnemy(g, e, 'ability')
}

/**
 * What the ability makes of a hit before it lands: null when it never hurts
 * (immune, guarded, absorbed: the player gets a short invulnerability, as
 * from a hit), else the damage left to take.
 */
export const abilityTakes = (g: Game, amount: number, types: readonly PokeType[], hit: HitKind, from?: Enemy): number | null => {
  const effects = effectsOf(g)
  if (effects.length === 0) return amount
  const p = g.player
  const immune = IMMUNE_TO[hit]
  let taken = amount
  for (const e of effects) {
    if (e.kind === 'immune' && immune && e.to.includes(immune)) return null
    if (e.kind === 'resist' && (e.types?.some((t) => types.includes(t)) || e.hits?.includes(hit) || (e.boss && bossHit(hit, from)))) {
      if (!e.absorb) {
        taken *= e.factor
        continue
      }
      const healed = healPlayer(g, amount * ABILITY.absorbHeal)
      if (healed >= 1) floatText(g, p.x, p.y - 28, `+${Math.round(healed)}`, '#58d878')
      p.iframes = Math.max(p.iframes, ABILITY.guardIframes)
      return null
    }
    if (e.kind === 'guard' && g.player.ability.guard <= 0) {
      g.player.ability.guard = e.every
      p.iframes = Math.max(p.iframes, ABILITY.guardIframes)
      burst(g, p.x, p.y - 12, { colors: ['#f8f8ff', '#b8a8f8', '#8878d8'], count: 18, speed: 90, ttl: 0.4 })
      if (e.reflect && from && isAlive(from)) strike(g, from, amount * 2 + contactPower(g))
      proc(g, e)
      return null
    }
  }
  return taken
}

/** A hit landed: onHurt abilities stack up (Competitive, Steadfast, Contrary). */
export const abilityHurt = (g: Game) => {
  const e = effectOf(g, 'onHurt')
  if (!e) return
  g.player.ability.stacks = Math.min(e.max, Math.floor(g.player.ability.stacks) + 1)
  g.player.ability.clock = e.seconds
}

/** The player would faint: Sturdy holds once, at 1 HP. True when it held. */
export const abilityHolds = (g: Game) => {
  const sturdy = effectOf(g, 'sturdy')
  if (g.player.ability.spent || !sturdy) return false
  const p = g.player
  g.player.ability.spent = true
  p.hp = 1
  p.iframes = Math.max(p.iframes, ABILITY.sturdyIframes)
  burst(g, p.x, p.y - 12, { colors: ['#f8d030', '#ffffff', '#b89848'], count: 40, speed: 140, ttl: 0.6, size: 2 })
  shakeScreen(g, 6)
  proc(g, sturdy)
  return true
}

/* ---------------- Hits landed and kills ---------------- */

/** Extra damage a hit on `e` gets (Sniper, Mold Breaker on bosses and elites). */
export const strikeBonus = (g: Game, e: Enemy) => {
  const hunter = effectOf(g, 'bossHunter')
  return hunter && (e.boss || e.elite) ? 1 + hunter.bonus : 1
}

/** A foe fainted: onKill stacks (Moxie, Battle Bond) and drops (Pickup, Magician, Frisk). */
export const abilityKill = (g: Game, e: Enemy) => {
  for (const effect of effectsOf(g)) {
    if (effect.kind === 'onKill') {
      const s = g.player.ability
      if (++s.kills < effect.per) continue
      s.kills = 0
      if (s.stacks >= effect.max) continue
      s.stacks = Math.min(effect.max, s.stacks + 1)
      // A milestone (Battle Bond's) is news; Moxie's one-kill stacks just show on the HUD.
      if (effect.per > 1) proc(g, effect)
    } else if (effect.kind === 'drop' && chance(g.rng, effect.chance)) {
      if (effect.drop === 'berry') dropPickup(g, e.x + 4, e.y, 'berry')
      else if (effect.drop === 'coin') dropCoins(g, e.x, e.y, [10])
      else dropXp(g, e.x, e.y, Math.max(3, e.xp * 3))
    }
  }
}

/* ---------------- Ticking ---------------- */

/** Every foe touching the player gets the contact effect. */
const contactPulse = (g: Game, e: Extract<AbilityEffect, { kind: 'contact' }>) => {
  const p = g.player
  const power = contactPower(g)
  for (const foe of g.enemies) {
    if (!isAlive(foe)) continue
    const reach = foe.radius + p.radius + ABILITY.contactReach
    if (dm.sq(foe.x - p.x) + dm.sq(foe.y - p.y) > reach * reach) continue
    const spec = e.status.length === 0 ? null : e.status.length === 1 ? e.status[0]! : pick(g.rng, e.status)
    if (spec && chance(g.rng, spec.chance)) {
      applyStatus(foe.status, spec, power, foe.boss, 'ability', g.player.slot)
      burst(g, foe.x, foe.y - foe.radius, { colors: ['#ffffff', '#f8e8b0'], count: 4, speed: 50, ttl: 0.3 })
    }
    if (e.damage > 0) strike(g, foe, power * e.damage)
  }
}

/** Foes in reach get the aura's status (Unnerve). */
const auraPulse = (g: Game, e: Extract<AbilityEffect, { kind: 'aura' }>) => {
  const p = g.player
  const reach = e.radius * e.radius
  for (const foe of g.enemies) {
    if (isAlive(foe) && dm.sq(foe.x - p.x) + dm.sq(foe.y - p.y) < reach) applyStatus(foe.status, e.status, 0, foe.boss, null, g.player.slot)
  }
}

/** Sleeping foes in reach suffer their bad dreams: ability damage, which never wakes them (Bad Dreams). */
const nightmarePulse = (g: Game, e: Extract<AbilityEffect, { kind: 'nightmare' }>) => {
  const p = g.player
  const reach = e.radius * e.radius
  const power = contactPower(g) * e.damage
  for (const foe of g.enemies) {
    if (!isAlive(foe) || !isAsleep(foe.status) || dm.sq(foe.x - p.x) + dm.sq(foe.y - p.y) >= reach) continue
    burst(g, foe.x, foe.y - foe.radius, { colors: ['#281838', '#5838a0', '#c83858'], count: 3, speed: 30, ttl: 0.45, gravity: -40 })
    strike(g, foe, power)
  }
}

/** Whether a beat of `every` s on the never-paused clock fell in this tick: a pulse without a timer of its own. */
const beat = (g: Game, dt: number, every: number) => Math.floor(g.now / every) !== Math.floor((g.now - dt) / every)

/**
 * Ticks the ability: pulses, timers, stacks wearing off, a summoned weather.
 * True when its conditions changed, so the caller rebuilds the stats.
 */
export const updateAbility = (g: Game, dt: number) => {
  const s = g.player.ability
  for (const e of effectsOf(g)) {
    switch (e.kind) {
      case 'summon':
        // The weather lives outside: a room (rift arena, place) waits until the player is back.
        if (s.biome !== g.biome.id && !roomOf(g)) {
          s.biome = g.biome.id
          setWeather(g, e.weather)
          proc(g, e)
        }
        break
      case 'contact':
        s.pulse -= dt
        if (s.pulse <= 0) {
          s.pulse += ABILITY.contactEvery
          contactPulse(g, e)
        }
        break
      case 'aura':
        s.pulse -= dt
        if (s.pulse <= 0) {
          s.pulse += e.every
          auraPulse(g, e)
        }
        break
      case 'nightmare':
        if (beat(g, dt, e.every)) nightmarePulse(g, e)
        break
      case 'timer':
        if (s.stacks >= e.max) break
        s.clock += dt
        if (s.clock >= e.every) {
          s.clock -= e.every
          s.stacks = Math.min(e.max, s.stacks + 1)
          proc(g, e)
        }
        break
      case 'heal':
        s.clock += dt
        if (s.clock >= e.every) {
          s.clock -= e.every
          const healed = healPlayer(g, g.player.stats.maxHp * e.heal)
          if (healed >= 1) floatText(g, g.player.x, g.player.y - 28, `+${Math.round(healed)}`, '#58d878')
        }
        break
      case 'onHurt':
        if (s.stacks > 0 && e.seconds !== Infinity) {
          s.clock -= dt
          if (s.clock <= 0) s.stacks = 0
        }
        break
      case 'onKill':
        if (e.decay && s.stacks > 0) s.stacks = Math.max(0, s.stacks - dt / e.decay)
        break
      case 'moody':
        s.clock -= dt
        if (s.clock <= 0) {
          s.clock += e.every
          // Never the same boost twice in a row.
          const next = Math.floor(g.rng() * (e.options.length - (s.mood >= 0 ? 1 : 0)))
          s.mood = s.mood >= 0 && next >= s.mood ? next + 1 : next
          proc(g, e)
        }
        break
      case 'guard':
        if (s.guard > 0) s.guard = Math.max(0, s.guard - dt)
        break
    }
  }
  const key = abilityKey(g)
  if (key === s.key) return false
  s.key = key
  return true
}
