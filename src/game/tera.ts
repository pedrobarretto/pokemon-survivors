import { TERA, TERA_TYPES, type TeraType } from '../data/tera'
import { effectiveness, POKE_TYPES, type PokeType } from '../data/types'
import { pick } from '../engine/rng'
import { burst, floatText, shakeScreen } from './effects'
import { spawnAttack } from './spawn'
import { playerTypes } from './terrain'
import type { Game, Player } from './types'
import { dropForEach } from './coop'

/**
 * Terastal in a run. Tera Shards set the run's Tera type: every boss leaves a
 * choice of two (its own type and one of the Pokémon's), touched, never
 * pulled, so walking to one is the call; a Tera Raid leaves its type's. The
 * Tera Orb fills with KOs and with time; once full, a press (the TERA button,
 * R, gamepad X; `StepInput.tera`, so replays and co-op re-simulate it)
 * plays the transformation, and for `TERA.duration` seconds the Pokémon's
 * moves of its Tera type hit harder (more when it's one of its own types:
 * Tera STAB), its special turns to the Tera type's, and it takes hits as that
 * type (`teraGuard`). Stellar (Terapagos's) boosts each move type once, big.
 * Never in the Arena.
 */

export type TeraState = {
  /** The run's Tera type, from the last shard picked up (null: none yet). */
  type: TeraType | null
  /** The Tera Orb's charge, 0..1: full lets the next press Terastallize. */
  orb: number
  /** Seconds left Terastallized (0: not). */
  active: number
  /** Seconds left of the transformation; the world waits meanwhile, solo (`updateTeraIntros`). */
  intro: number
  /** The type it Terastallized into, held while it lasts (a shard picked up meanwhile is the next one's). */
  form: TeraType | null
  /** Stellar: the move types whose once-only boost was spent this time. */
  spent: PokeType[]
  /** Times it Terastallized this run (missions, achievements, the end screen). */
  count: number
}

export const createTeraState = (type: TeraType | null = null): TeraState => ({ type, orb: 0, active: 0, intro: 0, form: null, spent: [], count: 0 })

/** What the TERA button shows: nothing (no type yet), the orb filling, ready, or Terastallized. */
export type TeraPhase = 'none' | 'charging' | 'ready' | 'active'

export const teraPhase = (s: TeraState): TeraPhase =>
  s.active > 0 || s.intro > 0 ? 'active' : s.type === null ? 'none' : s.orb >= 1 ? 'ready' : 'charging'

/** Whether a player is Terastallized or transforming (a Mega waits for it, and the other way round). */
export const teraBusy = (p: Pick<Player, 'tera'>) => p.tera.active > 0 || p.tera.intro > 0

/** Whether a run plays Terastal at all: never in the Arena or the Dojo. */
export const teraPlays = (g: Pick<Game, 'versus' | 'training'>) => !g.versus && g.training === null

/** Terapagos's Stellar is its own: shards never change it. */
const fixedType = (p: Player) => p.legend?.id === 'terapagos'

/** Fills a player's orb by `share` (not while it's spent: Terastallized or transforming). True when it just filled. */
export const chargeOrb = (p: Player, share: number) => {
  const s = p.tera
  if (teraBusy(p) || s.orb >= 1) return false
  s.orb = Math.min(1, s.orb + share)
  return s.orb >= 1
}

/** A foe the acting player knocked out fills their orb: one of `TERA.orbKos`, a boss `TERA.bossKo`. */
export const teraKill = (g: Game, boss: boolean) => {
  if (!teraPlays(g)) return
  if (chargeOrb(g.player, boss ? TERA.bossKo : 1 / TERA.orbKos) && g.player.tera.type !== null) g.events.push({ kind: 'teraReady' })
}

/**
 * The damage multiplier of an acting player's hit of `type` while
 * Terastallized: the Tera type's moves `TERA.power`, `TERA.stab` when it's one
 * of the Pokémon's own types too; Stellar boosts each type's first hit
 * `TERA.stellarFirst` (once per type each time) and every other `TERA.stellarRest`.
 * Exactly 1 otherwise.
 */
export const teraPower = (g: Game, type: PokeType) => {
  const s = g.player.tera
  if (s.active <= 0 || s.form === null) return 1
  if (s.form === 'stellar') {
    if (s.spent.includes(type)) return TERA.stellarRest
    s.spent.push(type)
    g.events.push({ kind: 'stellarStrike', type })
    return TERA.stellarFirst
  }
  if (type !== s.form) return 1
  return playerTypes(g).includes(type) ? TERA.stab : TERA.power
}

/**
 * What a hit of `types` does to the acting player while Terastallized: it
 * defends as its Tera type, `TERA.guard` of the softened chart (the strongest
 * of a body's types counts). Stellar keeps the Pokémon's own types. 1 otherwise.
 */
export const teraGuard = (g: Game, types: readonly PokeType[]) => {
  const s = g.player.tera
  if (s.active <= 0 || s.form === null || s.form === 'stellar' || types.length === 0) return 1
  let worst = 0
  for (const t of types) worst = Math.max(worst, effectiveness(t, [s.form]))
  return 1 + (worst - 1) * TERA.guard
}

/** The type the acting player's special takes while Terastallized (Tera Blast), or null; Aegislash keeps its Stance Change. */
export const teraSpecialType = (p: Pick<Player, 'tera' | 'special'>): PokeType | null =>
  p.tera.active > 0 && p.tera.form !== null && p.tera.form !== 'stellar' && p.special.stance === null ? p.tera.form : null

/* ---------------- Shards ---------------- */

/**
 * The second shard of a boss's choice: one of the Pokémon's own types (Tera
 * STAB) other than the boss's, else any other type, drawn from the run's rng.
 */
const ownShard = (g: Game, boss: TeraType): TeraType => {
  const own = playerTypes(g).filter((t) => t !== boss)
  return own.length > 0 ? pick(g.rng, own) : pick(g.rng, POKE_TYPES.filter((t) => t !== boss))
}

/** Drops a shard of `type` at (x, y); shards of one `pair` are a choice (taking one crumbles the rest). */
export const dropShard = (g: Game, x: number, y: number, tera: TeraType, pair: number) => {
  g.pickups.push({ id: g.nextId++, x, y, vx: 0, vy: 0, attracted: false, age: 0, kind: 'teraShard', tera, pair })
}

/**
 * A boss fell at (x, y): each player gets a choice of two Tera Shards, the
 * boss's type (`bossType`) and one of their Pokémon's own. Not for
 * Terapagos, whose Stellar is its own, nor in the Arena or the Dojo.
 */
export const dropBossShards = (g: Game, x: number, y: number, bossType: PokeType) => {
  if (!teraPlays(g)) return
  dropForEach(g, () => {
    if (fixedType(g.player)) return
    const pair = g.nextId
    const other = ownShard(g, bossType)
    dropShard(g, x - TERA.shardGap / 2, y + 12, bossType, pair)
    dropShard(g, x + TERA.shardGap / 2, y + 12, other, pair)
  })
  g.events.push({ kind: 'teraShards' })
}

/** The acting player touched a Tera Shard: it sets their Tera type; the rest of its choice crumbles. */
export const collectShard = (g: Game, tera: TeraType, pair: number) => {
  const p = g.player
  for (const k of g.pickups) {
    if (k.kind !== 'teraShard' || k.pair !== pair || k.age < 0 || (k.owner !== undefined && k.owner !== p.slot)) continue
    if (k.tera === tera) continue
    burst(g, k.x, k.y, { colors: ['#a8a0b8', '#686078', '#ffffff'], count: 12, speed: 60, ttl: 0.45, gravity: 60 })
    k.age = -1
  }
  if (fixedType(p)) return
  const from = p.tera.type
  p.tera.type = tera
  burst(g, p.x, p.y - 12, { colors: ['#ffffff', '#c8f0ff', '#f8c8f8'], count: 28, speed: 110, ttl: 0.6, gravity: -30 })
  g.events.push({ kind: 'teraShard', tera, from })
}

/* ---------------- The transformation ---------------- */

const startIntro = (g: Game) => {
  const s = g.player.tera
  s.intro = TERA.intro
  s.form = s.type
  g.events.push({ kind: 'teraStart', tera: s.type! })
}

/** The crystal shatters: the Tera form lands, with a shockwave, a fresh special and a moment of invulnerability. */
const transform = (g: Game) => {
  const p = g.player
  const s = p.tera
  s.intro = 0
  s.active = TERA.duration
  s.orb = 0
  s.spent = []
  s.count++
  p.special.cooldown = 0
  p.iframes = Math.max(p.iframes, TERA.iframes)
  const { radius, power, knockback } = TERA.wave
  const type = teraSpecialType(p) ?? playerTypes(g)[0] ?? 'normal'
  spawnAttack(g, {
    move: 'special', type, visual: 'teraWave', x: p.x, y: p.y,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'follow', ox: 0, oy: -8 },
    damage: power * p.stats.might * (1 + 0.04 * (p.level - 1)), knockback, ttl: 0.5, activeUntil: 0.28, grow: (radius - 8) / 0.28,
    // The renderer draws the wave in the Tera type's crystal (`render/teraFx.ts`).
    memo: TERA_TYPES.indexOf(s.form!),
  })
  shakeScreen(g, 8)
  g.flash = Math.max(g.flash, 0.25)
  // The shatter lands with a beat of hitstop: the world holds on the flash before the shards fly.
  g.hitstop = Math.max(g.hitstop, TERA.hitstop)
  g.events.push({ kind: 'tera', tera: s.form! })
}

/** The Tera form ran out: the crystal falls away and the orb starts over. Terapagos's Stellar Form never does: it shines anew. */
const revert = (g: Game) => {
  const p = g.player
  const s = p.tera
  if (p.legend?.id === 'terapagos' && p.legend.awakened >= 2) {
    s.active = TERA.duration
    s.spent = []
    g.events.push({ kind: 'stellarPulse' })
    return
  }
  s.form = null
  s.spent = []
  burst(g, p.x, p.y - 12, { colors: ['#ffffff', '#c8e8f8', '#e8c8f8'], count: 26, speed: 90, ttl: 0.5, gravity: 80 })
  g.events.push({ kind: 'teraEnd' })
}

/** Runs the acting player's transformation while the world waits. True while it still plays. */
export const updateTeraIntro = (g: Game, dt: number) => {
  const s = g.player.tera
  if (s.intro <= 0) return false
  s.intro -= dt
  if (s.intro <= 0) transform(g)
  return true
}

/**
 * Each tick: a press with the orb full (and a type, and no Mega Evolution
 * under way) starts the transformation; otherwise the form runs down and the
 * orb fills with time.
 */
export const updateTera = (g: Game, pressed: boolean, dt: number) => {
  if (!teraPlays(g)) return
  const p = g.player
  const s = p.tera
  if (s.intro > 0) return
  if (s.active > 0) {
    s.active = Math.max(0, s.active - dt)
    if (s.active <= 0) revert(g)
    return
  }
  if (pressed && s.type !== null && s.orb >= 1 && p.mega.intro <= 0 && p.mega.active <= 0) return startIntro(g)
  if (chargeOrb(p, dt / TERA.orbTime) && s.type !== null) g.events.push({ kind: 'teraReady' })
}

/**
 * Terapagos's second awakening: its Stellar Form is Terastallized for good
 * (`revert` starts it over instead of ending it), no orb needed.
 */
export const stellarForm = (g: Game) => {
  const p = g.player
  const s = p.tera
  s.type = 'stellar'
  s.form = 'stellar'
  s.active = TERA.duration
  s.spent = []
  s.orb = 0
  floatText(g, p.x, p.y - 34, '✦', '#f8f0ff')
}

/** A Stellar strike landed on a foe at (x, y): a burst of the seven-colored stars. */
export const stellarBurst = (g: Game, x: number, y: number) =>
  burst(g, x, y, { colors: ['#f85858', '#f8e858', '#58e8a8', '#58a8f8', '#c878f8', '#ffffff'], count: 16, speed: 120, ttl: 0.5, size: 2 })
