import { dir8, dirTo, fromAngle, TAU, type Vec } from '../engine/math'
import { chance, pick, range } from '../engine/rng'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { BRANCHES, type BranchDef, type BranchId } from '../data/branches'
import { MEGAS, type MegaId } from '../data/megas'
import { TYPE_COLORS, type PokeType } from '../data/types'
import { burst, shakeScreen } from './effects'
import { recomputeStats } from './leveling'
import { MOVES, moveStats, type MoveDef } from './moves'
import { enemiesInView, inSight, isAlive } from './queries'
import { spawnAttack } from './spawn'
import { firstStance, nextStance, STANCES, STANCE_CYCLES, type Stance, type StanceSpecial } from './stance'
import type { StatusSpec } from './status'
import type { PlayerStats } from './stats'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * The manual special attack (Space / touch button / gamepad A). Each of the 18
 * types has one, as data: a form (`SpecialKind`) tuned by its tiers, plus the
 * type's color and condition. Fire, Water and Grass keep their bespoke forms;
 * the rest share six parametrized ones (bolt, nova, rain, ring, wave, trail).
 * Per-species overrides can win over the type (the agile lines' chain dash,
 * Aegislash's Stance Change). The final evolution stage swaps in the stronger tier,
 * and a Mega form (`data/megas.ts`) swaps in its own special while it lasts.
 */

/**
 * How the special plays out once the charge ends.
 * - dash: flaming charge with a fire trail · beam: aimed jet · roots: rings of roots
 * - nova: shock waves around the player · bolt: strikes from the sky on the nearest foes
 * - rain: projectiles falling around the player · ring: a volley fired all around
 * - wave: an aimed wall sweeping forward · trail: hazard patches left behind while moving
 * - chain: lunges into the nearest foe; each landing opens a short window to jump to the next
 * - stance: swaps Aegislash between Shield and Blade Forme (`stance.ts`), no damage
 */
export type SpecialKind = 'dash' | 'beam' | 'roots' | 'nova' | 'bolt' | 'rain' | 'ring' | 'wave' | 'trail' | 'chain' | 'stance'

type SpecialTier = {
  name: string
  damage: number
  area: number
  /**
   * How many pieces the form makes: rings of roots, shock waves, bolts, falling
   * projectiles, projectiles in the ring, wave segments, trail patches or the
   * jumps a chain dash can make. Dash, beam and stance ignore it.
   */
  count: number
}

export type SpecialDef = {
  type: PokeType
  kind: SpecialKind
  /** Seconds between uses, scaled by the cooldown stat. */
  cooldown: number
  /** Wind-up seconds. The player moves slower meanwhile. */
  charge: number
  base: SpecialTier
  /** Used from the final evolution stage on. */
  final: SpecialTier
  /** The type's condition, rolled on every hit. */
  status?: StatusSpec
  /** Chain dash: a ring of this many of the type's orbs bursts from every landing (Mega Lucario, Sceptile…). */
  orbs?: number
}

export const SPECIALS = {
  blastBurn: {
    type: 'fire', kind: 'dash', cooldown: 10, charge: 0.3,
    base: { name: 'Flare Blitz', damage: 34, area: 1, count: 1 },
    final: { name: 'Blast Burn', damage: 60, area: 1.4, count: 1 },
  },
  hydroCannon: {
    type: 'water', kind: 'beam', cooldown: 12, charge: 0.55,
    base: { name: 'Hydro Pump', damage: 30, area: 1, count: 1 },
    final: { name: 'Hydro Cannon', damage: 52, area: 1.35, count: 1 },
  },
  frenzyPlant: {
    type: 'grass', kind: 'roots', cooldown: 11, charge: 0.4,
    base: { name: 'Grass Knot', damage: 30, area: 1, count: 2 },
    final: { name: 'Frenzy Plant', damage: 54, area: 1.3, count: 3 },
    status: { kind: 'slow', chance: 1, duration: 0.6, power: 0.75 },
  },
  boomburst: {
    type: 'normal', kind: 'nova', cooldown: 9, charge: 0.25,
    base: { name: 'Hyper Voice', damage: 28, area: 1, count: 1 },
    final: { name: 'Boomburst', damage: 48, area: 1.3, count: 2 },
  },
  boltStrike: {
    type: 'electric', kind: 'bolt', cooldown: 9, charge: 0.35,
    base: { name: 'Thunderbolt', damage: 34, area: 1, count: 5 },
    final: { name: 'Bolt Strike', damage: 58, area: 1.25, count: 8 },
    status: { kind: 'paralysis', chance: 0.6, duration: 1.6, power: 0 },
  },
  doomDesire: {
    type: 'steel', kind: 'bolt', cooldown: 10, charge: 0.4,
    base: { name: 'Magnet Bomb', damage: 40, area: 1.15, count: 4 },
    final: { name: 'Doom Desire', damage: 68, area: 1.45, count: 6 },
  },
  lightOfRuin: {
    type: 'fairy', kind: 'bolt', cooldown: 9, charge: 0.35,
    base: { name: 'Dazzling Gleam', damage: 30, area: 1, count: 6 },
    final: { name: 'Light of Ruin', damage: 52, area: 1.2, count: 9 },
    status: { kind: 'sleep', chance: 0.35, duration: 1.5, power: 0 },
  },
  expandingForce: {
    type: 'psychic', kind: 'nova', cooldown: 9, charge: 0.3,
    base: { name: 'Psychic', damage: 30, area: 1, count: 1 },
    final: { name: 'Expanding Force', damage: 50, area: 1.35, count: 2 },
    status: { kind: 'slow', chance: 0.6, duration: 1.2, power: 0.5 },
  },
  nightDaze: {
    type: 'dark', kind: 'nova', cooldown: 9, charge: 0.3,
    base: { name: 'Dark Pulse', damage: 28, area: 1, count: 1 },
    final: { name: 'Night Daze', damage: 48, area: 1.3, count: 2 },
    status: { kind: 'sleep', chance: 0.35, duration: 1.5, power: 0 },
  },
  dracoMeteor: {
    type: 'dragon', kind: 'rain', cooldown: 11, charge: 0.45,
    base: { name: 'Dragon Pulse', damage: 30, area: 1, count: 10 },
    final: { name: 'Draco Meteor', damage: 52, area: 1.3, count: 16 },
    status: { kind: 'burn', chance: 0.3, duration: 2, power: 0.3 },
  },
  diamondStorm: {
    type: 'rock', kind: 'rain', cooldown: 10, charge: 0.4,
    base: { name: 'Rock Slide', damage: 32, area: 1, count: 10 },
    final: { name: 'Diamond Storm', damage: 52, area: 1.25, count: 16 },
  },
  blizzard: {
    type: 'ice', kind: 'rain', cooldown: 10, charge: 0.4,
    base: { name: 'Icicle Crash', damage: 26, area: 1, count: 11 },
    final: { name: 'Blizzard', damage: 42, area: 1.25, count: 18 },
    status: { kind: 'slow', chance: 1, duration: 1.5, power: 0.6 },
  },
  astralBarrage: {
    type: 'ghost', kind: 'ring', cooldown: 9, charge: 0.3,
    base: { name: 'Shadow Ball', damage: 30, area: 1, count: 10 },
    final: { name: 'Astral Barrage', damage: 50, area: 1.25, count: 16 },
    status: { kind: 'paralysis', chance: 0.3, duration: 1.2, power: 0 },
  },
  auraSphere: {
    type: 'fighting', kind: 'ring', cooldown: 9, charge: 0.3,
    base: { name: 'Vacuum Wave', damage: 32, area: 1, count: 10 },
    final: { name: 'Aura Sphere', damage: 54, area: 1.25, count: 16 },
  },
  attackOrder: {
    type: 'bug', kind: 'ring', cooldown: 9, charge: 0.3,
    base: { name: 'Pin Missile', damage: 24, area: 1, count: 12 },
    final: { name: 'Attack Order', damage: 40, area: 1.2, count: 20 },
    status: { kind: 'poison', chance: 0.4, duration: 3, power: 0.25 },
  },
  precipiceBlades: {
    type: 'ground', kind: 'wave', cooldown: 10, charge: 0.35,
    base: { name: 'Bulldoze', damage: 32, area: 1, count: 5 },
    final: { name: 'Precipice Blades', damage: 54, area: 1.3, count: 7 },
    status: { kind: 'slow', chance: 1, duration: 1, power: 0.5 },
  },
  aeroblast: {
    type: 'flying', kind: 'wave', cooldown: 9, charge: 0.3,
    base: { name: 'Air Cutter', damage: 30, area: 1, count: 5 },
    final: { name: 'Aeroblast', damage: 50, area: 1.3, count: 7 },
  },
  malignantChain: {
    type: 'poison', kind: 'trail', cooldown: 11, charge: 0.2,
    base: { name: 'Toxic Spikes', damage: 30, area: 1, count: 18 },
    final: { name: 'Malignant Chain', damage: 50, area: 1.25, count: 26 },
    status: { kind: 'poison', chance: 1, duration: 3, power: 0.3 },
  },
  /* Chain dashes, given per species (`BY_SPECIES`). The cooldown starts when the chain ends. */
  solarBlade: {
    type: 'grass', kind: 'chain', cooldown: 8, charge: 0,
    base: { name: 'Leaf Blade', damage: 24, area: 1, count: 3 },
    final: { name: 'Solar Blade', damage: 40, area: 1.2, count: 4 },
  },
  closeCombat: {
    type: 'fighting', kind: 'chain', cooldown: 8, charge: 0,
    base: { name: 'Force Palm', damage: 24, area: 1, count: 3 },
    final: { name: 'Close Combat', damage: 40, area: 1.2, count: 4 },
  },
  dragonRush: {
    type: 'dragon', kind: 'chain', cooldown: 8, charge: 0,
    base: { name: 'Dual Chop', damage: 26, area: 1, count: 3 },
    final: { name: 'Dragon Rush', damage: 44, area: 1.25, count: 4 },
  },
  braveBird: {
    type: 'flying', kind: 'chain', cooldown: 8, charge: 0,
    base: { name: 'Aerial Ace', damage: 22, area: 1, count: 3 },
    final: { name: 'Brave Bird', damage: 38, area: 1.2, count: 4 },
  },
  ironHead: {
    type: 'steel', kind: 'chain', cooldown: 8, charge: 0,
    base: { name: 'Smart Strike', damage: 24, area: 1, count: 3 },
    final: { name: 'Iron Head', damage: 40, area: 1.2, count: 4 },
  },
  /** Aegislash only: swaps formes on a short, fixed cooldown (the floor doesn't apply). */
  stanceChange: {
    type: 'steel', kind: 'stance', cooldown: 2, charge: 0,
    base: { name: 'Stance Change', damage: 0, area: 1, count: 1 },
    final: { name: 'Stance Change', damage: 0, area: 1, count: 1 },
  },
  /** Deoxys only (Legend mode): cycles Normal, Attack, Defense and Speed Forme, like Stance Change. */
  formeChange: {
    type: 'psychic', kind: 'stance', cooldown: 2, charge: 0,
    base: { name: 'Forme Change', damage: 0, area: 1, count: 1 },
    final: { name: 'Forme Change', damage: 0, area: 1, count: 1 },
  },
  /* Mega forms only (`MEGAS`): one tier, stronger than any final one, on a shorter cooldown. */
  dragonFlare: {
    type: 'dragon', kind: 'dash', cooldown: 8, charge: 0.2,
    base: { name: 'Dragon Flare', damage: 84, area: 1.6, count: 1 },
    final: { name: 'Dragon Flare', damage: 84, area: 1.6, count: 1 },
  },
  psystrike: {
    type: 'psychic', kind: 'nova', cooldown: 7, charge: 0.2,
    base: { name: 'Psystrike', damage: 64, area: 1.6, count: 3 },
    final: { name: 'Psystrike', damage: 64, area: 1.6, count: 3 },
    status: { kind: 'slow', chance: 0.8, duration: 1.5, power: 0.5 },
  },
  poltergeist: {
    type: 'ghost', kind: 'ring', cooldown: 7, charge: 0.2,
    base: { name: 'Poltergeist', damage: 66, area: 1.35, count: 24 },
    final: { name: 'Poltergeist', damage: 66, area: 1.35, count: 24 },
    status: { kind: 'paralysis', chance: 0.4, duration: 1.2, power: 0 },
  },
  moonblast: {
    type: 'fairy', kind: 'bolt', cooldown: 7, charge: 0.25,
    base: { name: 'Moonblast', damage: 66, area: 1.3, count: 12 },
    final: { name: 'Moonblast', damage: 66, area: 1.3, count: 12 },
    status: { kind: 'sleep', chance: 0.35, duration: 1.5, power: 0 },
  },
  auraStorm: {
    type: 'fighting', kind: 'chain', cooldown: 7, charge: 0, orbs: 8,
    base: { name: 'Aura Sphere', damage: 56, area: 1.3, count: 6 },
    final: { name: 'Aura Sphere', damage: 56, area: 1.3, count: 6 },
  },
  stoneEdge: {
    type: 'rock', kind: 'rain', cooldown: 8, charge: 0.3,
    base: { name: 'Stone Edge', damage: 70, area: 1.4, count: 22 },
    final: { name: 'Stone Edge', damage: 70, area: 1.4, count: 22 },
  },
  petalBlizzard: {
    type: 'grass', kind: 'nova', cooldown: 7, charge: 0.25,
    base: { name: 'Petal Blizzard', damage: 64, area: 1.6, count: 3 },
    final: { name: 'Petal Blizzard', damage: 64, area: 1.6, count: 3 },
    status: { kind: 'slow', chance: 1, duration: 0.8, power: 0.6 },
  },
  heatWave: {
    type: 'fire', kind: 'nova', cooldown: 7, charge: 0.2,
    base: { name: 'Heat Wave', damage: 68, area: 1.7, count: 2 },
    final: { name: 'Heat Wave', damage: 68, area: 1.7, count: 2 },
    status: { kind: 'burn', chance: 0.6, duration: 2, power: 0.35 },
  },
  waterPulse: {
    type: 'water', kind: 'nova', cooldown: 7, charge: 0.2,
    base: { name: 'Water Pulse', damage: 60, area: 1.5, count: 4 },
    final: { name: 'Water Pulse', damage: 60, area: 1.5, count: 4 },
    status: { kind: 'slow', chance: 0.6, duration: 1.2, power: 0.5 },
  },
  voltTackle: {
    type: 'electric', kind: 'chain', cooldown: 7, charge: 0, orbs: 6,
    base: { name: 'Volt Tackle', damage: 62, area: 1.3, count: 6 },
    final: { name: 'Volt Tackle', damage: 62, area: 1.3, count: 6 },
  },
  risingVoltage: {
    type: 'electric', kind: 'bolt', cooldown: 7, charge: 0.25,
    base: { name: 'Rising Voltage', damage: 66, area: 1.3, count: 14 },
    final: { name: 'Rising Voltage', damage: 66, area: 1.3, count: 14 },
    status: { kind: 'paralysis', chance: 0.6, duration: 1.6, power: 0 },
  },
  hurricane: {
    type: 'flying', kind: 'wave', cooldown: 7, charge: 0.25,
    base: { name: 'Hurricane', damage: 70, area: 1.5, count: 9 },
    final: { name: 'Hurricane', damage: 70, area: 1.5, count: 9 },
  },
  solarBeam: {
    type: 'grass', kind: 'bolt', cooldown: 7, charge: 0.3,
    base: { name: 'Solar Beam', damage: 68, area: 1.35, count: 12 },
    final: { name: 'Solar Beam', damage: 68, area: 1.35, count: 12 },
  },
  waveCrash: {
    type: 'water', kind: 'chain', cooldown: 7, charge: 0,
    base: { name: 'Wave Crash', damage: 58, area: 1.3, count: 6 },
    final: { name: 'Wave Crash', damage: 58, area: 1.3, count: 6 },
  },
  dragonClaw: {
    type: 'dragon', kind: 'chain', cooldown: 7, charge: 0, orbs: 8,
    base: { name: 'Dragon Claw', damage: 54, area: 1.3, count: 6 },
    final: { name: 'Dragon Claw', damage: 54, area: 1.3, count: 6 },
  },
  blazeKick: {
    type: 'fire', kind: 'chain', cooldown: 7, charge: 0,
    base: { name: 'Blaze Kick', damage: 64, area: 1.3, count: 6 },
    final: { name: 'Blaze Kick', damage: 64, area: 1.3, count: 6 },
    status: { kind: 'burn', chance: 0.5, duration: 2, power: 0.3 },
  },
  muddyWater: {
    type: 'water', kind: 'nova', cooldown: 7, charge: 0.25,
    base: { name: 'Muddy Water', damage: 64, area: 1.6, count: 3 },
    final: { name: 'Muddy Water', damage: 64, area: 1.6, count: 3 },
    status: { kind: 'slow', chance: 1, duration: 1, power: 0.5 },
  },
  meteorMash: {
    type: 'steel', kind: 'rain', cooldown: 7, charge: 0.3,
    base: { name: 'Meteor Mash', damage: 70, area: 1.4, count: 20 },
    final: { name: 'Meteor Mash', damage: 70, area: 1.4, count: 20 },
  },
  skyAttack: {
    type: 'flying', kind: 'chain', cooldown: 7, charge: 0, orbs: 6,
    base: { name: 'Sky Attack', damage: 56, area: 1.3, count: 6 },
    final: { name: 'Sky Attack', damage: 56, area: 1.3, count: 6 },
  },
  earthPower: {
    type: 'ground', kind: 'nova', cooldown: 7, charge: 0.25,
    base: { name: 'Earth Power', damage: 70, area: 1.6, count: 3 },
    final: { name: 'Earth Power', damage: 70, area: 1.6, count: 3 },
    status: { kind: 'slow', chance: 1, duration: 1, power: 0.5 },
  },
  scaleShot: {
    type: 'dragon', kind: 'ring', cooldown: 7, charge: 0.2,
    base: { name: 'Scale Shot', damage: 64, area: 1.3, count: 24 },
    final: { name: 'Scale Shot', damage: 64, area: 1.3, count: 24 },
  },
  focusBlast: {
    type: 'fighting', kind: 'bolt', cooldown: 7, charge: 0.3,
    base: { name: 'Focus Blast', damage: 70, area: 1.4, count: 10 },
    final: { name: 'Focus Blast', damage: 70, area: 1.4, count: 10 },
  },
  heatCrash: {
    type: 'fire', kind: 'bolt', cooldown: 7, charge: 0.3,
    base: { name: 'Heat Crash', damage: 74, area: 1.45, count: 8 },
    final: { name: 'Heat Crash', damage: 74, area: 1.45, count: 8 },
    status: { kind: 'burn', chance: 0.5, duration: 2, power: 0.3 },
  },
  spikyShield: {
    type: 'grass', kind: 'nova', cooldown: 7, charge: 0.2,
    base: { name: 'Spiky Shield', damage: 62, area: 1.4, count: 2 },
    final: { name: 'Spiky Shield', damage: 62, area: 1.4, count: 2 },
  },
  mysticalFire: {
    type: 'fire', kind: 'nova', cooldown: 7, charge: 0.25,
    base: { name: 'Mystical Fire', damage: 66, area: 1.6, count: 3 },
    final: { name: 'Mystical Fire', damage: 66, area: 1.6, count: 3 },
    status: { kind: 'burn', chance: 0.5, duration: 2, power: 0.3 },
  },
  nightSlash: {
    type: 'dark', kind: 'chain', cooldown: 7, charge: 0, orbs: 6,
    base: { name: 'Night Slash', damage: 56, area: 1.3, count: 6 },
    final: { name: 'Night Slash', damage: 56, area: 1.3, count: 6 },
  },
  airSlash: {
    type: 'flying', kind: 'ring', cooldown: 7, charge: 0.2,
    base: { name: 'Air Slash', damage: 62, area: 1.3, count: 24 },
    final: { name: 'Air Slash', damage: 62, area: 1.3, count: 24 },
  },
  waterfall: {
    type: 'water', kind: 'wave', cooldown: 7, charge: 0.25,
    base: { name: 'Waterfall', damage: 72, area: 1.5, count: 9 },
    final: { name: 'Waterfall', damage: 72, area: 1.5, count: 9 },
  },
  zapCannon: {
    type: 'electric', kind: 'nova', cooldown: 7, charge: 0.3,
    base: { name: 'Zap Cannon', damage: 66, area: 1.6, count: 3 },
    final: { name: 'Zap Cannon', damage: 66, area: 1.6, count: 3 },
    status: { kind: 'paralysis', chance: 0.8, duration: 1.6, power: 0 },
  },
  bulletPunch: {
    type: 'steel', kind: 'chain', cooldown: 6, charge: 0, orbs: 6,
    base: { name: 'Bullet Punch', damage: 54, area: 1.3, count: 6 },
    final: { name: 'Bullet Punch', damage: 54, area: 1.3, count: 6 },
  },
  fieryWrath: {
    type: 'dark', kind: 'rain', cooldown: 7, charge: 0.3,
    base: { name: 'Fiery Wrath', damage: 66, area: 1.4, count: 20 },
    final: { name: 'Fiery Wrath', damage: 66, area: 1.4, count: 20 },
    status: { kind: 'burn', chance: 0.5, duration: 2, power: 0.3 },
  },
  heavySlam: {
    type: 'steel', kind: 'bolt', cooldown: 7, charge: 0.35,
    base: { name: 'Heavy Slam', damage: 78, area: 1.5, count: 8 },
    final: { name: 'Heavy Slam', damage: 78, area: 1.5, count: 8 },
  },
  wildCharge: {
    type: 'electric', kind: 'trail', cooldown: 9, charge: 0.1,
    base: { name: 'Wild Charge', damage: 62, area: 1.3, count: 30 },
    final: { name: 'Wild Charge', damage: 62, area: 1.3, count: 30 },
    status: { kind: 'paralysis', chance: 0.5, duration: 1.2, power: 0 },
  },
  hyperVoice: {
    type: 'fairy', kind: 'nova', cooldown: 7, charge: 0.25,
    base: { name: 'Hyper Voice', damage: 64, area: 1.6, count: 3 },
    final: { name: 'Hyper Voice', damage: 64, area: 1.6, count: 3 },
    status: { kind: 'sleep', chance: 0.35, duration: 1.5, power: 0 },
  },
  phantomForce: {
    type: 'ghost', kind: 'chain', cooldown: 7, charge: 0, orbs: 6,
    base: { name: 'Phantom Force', damage: 58, area: 1.3, count: 6 },
    final: { name: 'Phantom Force', damage: 58, area: 1.3, count: 6 },
  },
  sheerCold: {
    type: 'ice', kind: 'nova', cooldown: 7, charge: 0.3,
    base: { name: 'Sheer Cold', damage: 64, area: 1.6, count: 3 },
    final: { name: 'Sheer Cold', damage: 64, area: 1.6, count: 3 },
    status: { kind: 'slow', chance: 1, duration: 1.5, power: 0.7 },
  },
  doubleEdge: {
    type: 'flying', kind: 'bolt', cooldown: 7, charge: 0.25,
    base: { name: 'Double-Edge', damage: 72, area: 1.4, count: 12 },
    final: { name: 'Double-Edge', damage: 72, area: 1.4, count: 12 },
  },
} as const satisfies Record<string, SpecialDef>

export type SpecialId = keyof typeof SPECIALS

export const SPECIAL_IDS = Object.keys(SPECIALS) as SpecialId[]

/** One special per type. A dual type uses its first type. */
const BY_TYPE = {
  normal: 'boomburst', fire: 'blastBurn', water: 'hydroCannon', grass: 'frenzyPlant',
  electric: 'boltStrike', poison: 'malignantChain', flying: 'aeroblast', bug: 'attackOrder',
  rock: 'diamondStorm', ground: 'precipiceBlades', ghost: 'astralBarrage', fighting: 'auraSphere',
  psychic: 'expandingForce', ice: 'blizzard', steel: 'doomDesire', dark: 'nightDaze',
  fairy: 'lightOfRuin', dragon: 'dracoMeteor',
} as const satisfies Record<PokeType, SpecialId>

/**
 * Per-species overrides win over the type table: one special for the whole
 * line, or one per evolution stage (the last entry holds for later stages).
 * The agile lines dash in chains; Aegislash swaps stances instead.
 */
const BY_SPECIES: Partial<Record<PlayableId, SpecialId | readonly SpecialId[]>> = {
  treecko: 'solarBlade',
  sprigatito: 'solarBlade',
  riolu: 'closeCombat',
  gible: 'dragonRush',
  starly: 'braveBird',
  honedge: ['ironHead', 'ironHead', 'stanceChange'],
  // Lines that leave their Normal type behind when they evolve take the new type's special;
  // Pidgey's line is all about wind.
  azurill: ['boomburst', 'hydroCannon'],
  swablu: ['boomburst', 'dracoMeteor'],
  pidgey: 'aeroblast',
  deoxys: 'formeChange',
}

export const specialOfType = (type: PokeType): SpecialId => BY_TYPE[type]

/** Species override at that stage, else the special of its first type. */
export const specialIdFor = (species: PlayableId, types: readonly PokeType[], stage = 0): SpecialId => {
  const own = BY_SPECIES[species]
  const fallback = specialOfType(types[0] ?? 'normal')
  if (own === undefined) return fallback
  return typeof own === 'string' ? own : (own[Math.min(stage, own.length - 1)] ?? fallback)
}

/**
 * The special at an evolution stage; in Mega form (`mega`), the Mega's own.
 * From a branch's stage on (`branch`), the branch's: its own, or its first type's (Vaporeon's Hydro Cannon).
 */
export const resolveSpecial = (starter: PlayableId, stage: number, mega: MegaId | null = null, branch: BranchId | null = null, finalTier?: boolean) => {
  const species = PLAYABLE[starter]
  const b: BranchDef | null = branch && BRANCHES[branch].line === starter && stage >= BRANCHES[branch].stage ? BRANCHES[branch] : null
  const own = mega ? MEGAS[mega].special : b ? (b.special ?? specialOfType(b.types[0] ?? 'normal')) : undefined
  const id: SpecialId = own ?? specialIdFor(starter, species.line[0].types, stage)
  const def: SpecialDef = SPECIALS[id]
  const final = finalTier ?? stage >= species.line.length - 1
  return { id, def, final, tier: final ? def.final : def.base }
}

export type ResolvedSpecial = ReturnType<typeof resolveSpecial>

/** The special the acting player has right now: its stage's, or its Mega form's while that lasts. A legend's turns final at its second awakening. */
export const gameSpecial = (g: Game) => {
  const p = g.player
  return resolveSpecial(p.starter, p.stage, p.mega.active > 0 ? p.mega.stone : null, p.branch, p.legend ? p.legend.awakened >= 2 : undefined)
}

/* ---------------- Timers (pure) ---------------- */

export type SpecialState = {
  /** Seconds until it can be used again. */
  cooldown: number
  /** Cooldown applied on the last use, so the UI can draw the fill ratio. */
  total: number
  /** A press stays queued this long, so pressing slightly early still fires. */
  buffer: number
  /** Wind-up seconds left (> 0 while charging). */
  charge: number
  /** Seconds left of the release phase (dash, beam). */
  active: number
  /** Aim locked at release, in radians. */
  angle: number
  /** Distance dashed (dash, chain) or seconds walked (trail) since the last trail patch or afterimage. */
  trail: number
  /** Chain dash: a chain is running, from its first jump until its cooldown starts. */
  chaining: boolean
  /** Chain dash: jumps left in the running chain. */
  jumps: number
  /** Chain dash: seconds left to press for the next jump (opens when a jump lands on a foe). */
  window: number
  /** Chain dash: px the current jump covers. */
  reach: number
  /** Chain dash: id of the foe the last jump went for (-1 for none), skipped by the next jump. */
  target: number
  /** A stance special's forme (Aegislash's Stance Change, Deoxys's Forme Change); null for every other special. */
  stance: Stance | null
  /** Kills the special made (or made mid-chain) not yet turned into cooldown by Power Herb (`rechargeSpecial`). */
  kills: number
}

export const SPECIAL_BUFFER = 0.25
export const MIN_SPECIAL_COOLDOWN = 4

export const createSpecialState = (): SpecialState => ({
  cooldown: 0, total: 1, buffer: 0, charge: 0, active: 0, angle: 0, trail: 0,
  chaining: false, jumps: 0, window: 0, reach: 0, target: -1, stance: null, kills: 0,
})

type Timers = Pick<SpecialState, 'cooldown' | 'buffer' | 'charge' | 'active'>

export const specialBusy = (s: Timers) => s.charge > 0 || s.active > 0
export const specialReady = (s: Timers) => s.cooldown <= 0 && !specialBusy(s)

/** Seconds of cooldown after a use: scaled by the cooldown stat down to the floor. Stance Change keeps its own short one. */
export const specialCooldown = (def: SpecialDef, stats: PlayerStats) =>
  def.kind === 'stance' ? def.cooldown : Math.max(MIN_SPECIAL_COOLDOWN, def.cooldown * stats.cooldown)

/** Ticks the cooldown and input buffer. True on the tick a (possibly buffered) press should start the special. */
export const triggerSpecial = (s: Timers, pressed: boolean, dt: number) => {
  s.cooldown = Math.max(0, s.cooldown - dt)
  s.buffer = pressed ? SPECIAL_BUFFER : Math.max(0, s.buffer - dt)
  if (s.buffer <= 0 || !specialReady(s)) return false
  s.buffer = 0
  return true
}

/* ---------------- Chain dash timers (pure) ---------------- */

/** After a jump lands on a foe, a press within this many seconds jumps again. */
export const CHAIN_WINDOW = 0.5
/**
 * Invulnerability per jump. Well under the 4 s cooldown floor and under the
 * 0.5 s a hit already grants, so chaining never adds up to permanent i-frames.
 */
export const CHAIN_IFRAMES = 0.3

type ChainTimers = Pick<SpecialState, 'cooldown' | 'total' | 'chaining' | 'jumps' | 'window'>

/** Spends one jump, opening a chain of `count` jumps on its first press. No cooldown yet. */
export const beginJump = (s: ChainTimers, count: number) => {
  if (!s.chaining) {
    s.chaining = true
    s.jumps = count
  }
  s.jumps = Math.max(0, s.jumps - 1)
  s.window = 0
}

/** Ends the chain: only now does the cooldown start. */
export const endChain = (s: ChainTimers, cooldown: number) => {
  s.chaining = false
  s.jumps = 0
  s.window = 0
  s.cooldown = s.total = cooldown
}

/** A jump landed: on a foe with jumps left it opens the window for the next press, otherwise the chain ends. */
export const landJump = (s: ChainTimers, hit: boolean, cooldown: number) => {
  if (hit && s.jumps > 0) s.window = CHAIN_WINDOW
  else endChain(s, cooldown)
}

/** Counts the window down between jumps; the chain ends when it runs out. */
export const tickChain = (s: ChainTimers, dt: number, cooldown: number) => {
  if (s.window <= 0) return
  s.window = Math.max(0, s.window - dt)
  if (s.window <= 0) endChain(s, cooldown)
}

/* ---------------- Power Herb (pure) ---------------- */

type RechargeTimers = Pick<SpecialState, 'cooldown' | 'total' | 'chaining' | 'kills'>

/**
 * Power Herb: each kill the special made cuts `cut` seconds off its cooldown.
 * Kills made mid-chain wait until the chain ends and the cooldown starts. The
 * cut never brings the time from the start of the cooldown to ready below the
 * floor (`MIN_SPECIAL_COOLDOWN`, or a shorter cooldown like Stance Change's);
 * kills while the special is ready go to waste. The total shrinks with the
 * cut, so `total - cooldown` stays the time since the use and every later
 * batch of kills meets the same floor.
 */
export const rechargeSpecial = (s: RechargeTimers, cut: number) => {
  if (s.chaining || s.kills === 0) return
  const kills = s.kills
  s.kills = 0
  if (s.cooldown <= 0 || cut <= 0) return
  const elapsed = s.total - s.cooldown
  const floor = Math.max(0, Math.min(s.total, MIN_SPECIAL_COOLDOWN) - elapsed)
  const left = Math.max(floor, s.cooldown - kills * cut)
  s.total = elapsed + left
  s.cooldown = left
}

/**
 * Player speed multiplier: slower while charging and beaming, 0 while dashing
 * (the dash or lunge moves the player) and a little faster while laying a trail.
 */
export const specialSpeedFactor = (g: Game) => {
  const s = g.player.special
  if (s.charge > 0) return 0.45
  if (s.active <= 0) return 1
  const kind = gameSpecial(g).def.kind
  return kind === 'dash' || kind === 'chain' ? 0 : kind === 'trail' ? TRAIL_SPEED : 0.3
}

/* ---------------- Simulation ---------------- */

const DASH_TIME = 0.3
const DASH_DISTANCE = 130
const TRAIL_STEP = 9
const BEAM_TIME = 0.75
const BEAM_LENGTH = 210
const BEAM_STEP = 9
/** Beam reach speed in px/s: far segments switch on slightly later. */
const BEAM_SPEED = 900
/** Bolts land this long after release, one after another. */
const BOLT_DELAY = 0.14
const BOLT_STAGGER = 0.07
/** Bolts with no foe in view land this far around the player. */
const BOLT_SCATTER = 90
/** Falling projectiles land within RAIN_TIME seconds, inside RAIN_RADIUS px of the player. */
const RAIN_TIME = 1
const RAIN_RADIUS = 105
/** Share of the falling projectiles aimed at foes in that radius. */
const RAIN_AIMED = 0.6
const RING_SPEED = 210
const RING_TTL = 0.85
const WAVE_SPEED = 175
const WAVE_TTL = 0.9
const WAVE_GAP = 12
/** Seconds between trail patches, and the speed boost while laying them. */
const TRAIL_EVERY = 0.09
const TRAIL_SPEED = 1.15
/** How long a strike from the sky (bolt, rain) hurts after landing. */
const IMPACT_WINDOW = 0.1
/** Chain dash: lunge seconds, how far it looks for a foe, how far past it it lands, and the dash with no foe in reach. */
const CHAIN_TIME = 0.1
const CHAIN_RANGE = 170
const CHAIN_OVERSHOOT = 10
const CHAIN_MISS = 70
/** Hitstop (s) a release starts, then a dash's blast where it lands and a chain jump landing on a foe. */
const RELEASE_HITSTOP = 0.07
const BLAST_HITSTOP = 0.05
const LANDING_HITSTOP = 0.03
/** Spacing of the capsule's circles and of the afterimages, in px. */
const CHAIN_STEP = 8
const CHAIN_GHOST = 14
/** Share of the power dealt along the path and by the slash at the landing. */
const CHAIN_PATH = 0.6
const CHAIN_SLASH = 1

const power = (g: Game, r: ResolvedSpecial) => r.tier.damage * g.player.stats.might * (1 + 0.04 * (g.player.level - 1))
const areaOf = (g: Game, r: ResolvedSpecial) => r.tier.area * g.player.stats.area

/** How far an aimed special reaches (dash distance, beam length, wave travel), for the aim preview. 0 when it isn't aimed. */
export const specialReach = (g: Game, r: ResolvedSpecial) => {
  switch (r.def.kind) {
    case 'dash': return DASH_DISTANCE * r.tier.area
    case 'beam': return BEAM_LENGTH * areaOf(g, r)
    case 'wave': return WAVE_SPEED * WAVE_TTL
    default: return 0
  }
}

/** Seconds the release phase lasts (the dash, the beam, the trail); 0 for a special that's done once released. */
const activeTime = (r: ResolvedSpecial) => {
  switch (r.def.kind) {
    case 'dash': return DASH_TIME
    case 'beam': return BEAM_TIME
    case 'trail': return r.tier.count * TRAIL_EVERY
    default: return 0
  }
}

/** One tick of the special's own motion: the aim (`dir`), the move (px) and its length. */
export type SpecialStep = { dir: Vec; dx: number; dy: number; dist: number }

/**
 * A dash's step: `reach` px over `DASH_TIME` along the aim locked at release.
 * Pure, so the simulation (`dashTick`) and co-op's prediction ghost
 * (`predictSpecial`) move the player by the same bits.
 */
export const dashStep = (angle: number, reach: number, dt: number): SpecialStep => {
  const v = reach / DASH_TIME
  const dir = fromAngle(angle)
  return { dir, dx: dir.x * v * dt, dy: dir.y * v * dt, dist: v * dt }
}

/** A chain jump's step: `reach` px over `CHAIN_TIME`, never past the jump's end (`active` seconds left). Pure, like `dashStep`. */
export const jumpStep = (angle: number, reach: number, active: number, dt: number): SpecialStep => {
  const moved = (reach / CHAIN_TIME) * Math.min(dt, active)
  const dir = fromAngle(angle)
  return { dir, dx: dir.x * moved, dy: dir.y * moved, dist: moved }
}

const typeColors = (type: PokeType) => [TYPE_COLORS[type], '#ffffff', '#f8f8c8'] as const

/** Sparks converging on the player while charging. */
const chargeFx = (g: Game, r: ResolvedSpecial) => {
  const p = g.player
  if (!chance(g.rng, 0.8)) return
  const a = range(g.rng, 0, TAU)
  const d = range(g.rng, 18, 28)
  g.particles.push({
    x: p.x + dm.cos(a) * d, y: p.y - 10 + dm.sin(a) * d,
    vx: -dm.cos(a) * d * 4, vy: -dm.sin(a) * d * 4,
    life: 0, ttl: 0.22, color: chance(g.rng, 0.5) ? TYPE_COLORS[r.def.type] : '#ffffff', size: 1, gravity: 0, drag: 0,
  })
}

const fireTrail = (g: Game, r: ResolvedSpecial, area: number, dmg: number) => {
  const p = g.player
  spawnAttack(g, {
    move: 'special', type: r.def.type, visual: 'fireTrail', x: p.x + range(g.rng, -2, 2), y: p.y + range(g.rng, -2, 2),
    shape: { kind: 'circle', r: 8 * area }, motion: { kind: 'static' },
    damage: dmg * 0.3, knockback: 10, hitInterval: 0.3, ttl: range(g.rng, 1.3, 1.7), flip: chance(g.rng, 0.5),
  })
}

const explode = (g: Game, r: ResolvedSpecial, x: number, y: number, radius: number, dmg: number) => {
  spawnAttack(g, {
    move: 'special', type: r.def.type, visual: 'blast', x, y,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' },
    damage: dmg, knockback: 240, ttl: 0.4, activeUntil: 0.25, grow: (radius - 8) / 0.25,
  })
  burst(g, x, y, { colors: ['#fff8c0', '#f8d030', '#f08030', '#c03020'], count: 40, speed: radius * 3, ttl: 0.5, gravity: -40 })
  shakeScreen(g, 7)
  g.hitstop = Math.max(g.hitstop, BLAST_HITSTOP)
}

const release = (g: Game, r: ResolvedSpecial) => {
  const s = g.player.special
  const p = g.player
  const area = areaOf(g, r)
  const dmg = power(g, r)
  s.angle = dm.atan2(p.facing.y, p.facing.x)
  g.hitstop = RELEASE_HITSTOP
  shakeScreen(g, 5)
  g.events.push({ kind: 'special', phase: 'release', name: r.tier.name })
  burst(g, p.x, p.y - 10, { colors: typeColors(r.def.type), count: 24, speed: 120, ttl: 0.35 })
  // The fire dash fires Metronome where it lands; every other charged special right away.
  if (r.def.kind !== 'dash') arrivalCombo(g)

  switch (r.def.kind) {
    case 'dash': {
      s.active = activeTime(r)
      s.trail = TRAIL_STEP
      p.iframes = Math.max(p.iframes, DASH_TIME + 0.25)
      spawnAttack(g, {
        move: 'special', type: r.def.type, visual: 'blitz', x: p.x, y: p.y,
        shape: { kind: 'circle', r: 14 * area }, motion: { kind: 'follow', ox: 0, oy: -8 },
        damage: dmg, knockback: 260, ttl: DASH_TIME,
      })
      return
    }
    case 'beam': {
      s.active = activeTime(r)
      const dir = fromAngle(s.angle)
      const ox = p.x
      const oy = p.y - 8
      for (let d = 12; d < specialReach(g, r); d += BEAM_STEP) {
        spawnAttack(g, {
          move: 'special', type: r.def.type, visual: 'beam', x: ox + dir.x * d, y: oy + dir.y * d,
          shape: { kind: 'circle', r: 9 * area }, motion: { kind: 'static' },
          damage: dmg * 0.22, knockback: 70, hitInterval: 0.14,
          activeFrom: d / BEAM_SPEED, ttl: BEAM_TIME + d / BEAM_SPEED, from: { x: ox, y: oy },
        })
      }
      return
    }
    case 'roots': {
      for (let k = 0; k < r.tier.count; k++) {
        const radius = (26 + k * 24) * area
        const count = dm.round((TAU * radius) / 16)
        for (let j = 0; j < count; j++) {
          const a = (j / count) * TAU + k * 0.4
          spawnAttack(g, {
            move: 'special', type: r.def.type, visual: 'roots', x: p.x + dm.cos(a) * radius, y: p.y + dm.sin(a) * radius,
            shape: { kind: 'circle', r: 9 * area }, motion: { kind: 'static' },
            damage: dmg, knockback: 30, status: r.def.status ?? null, ttl: 0.8, age: -k * 0.13, flip: chance(g.rng, 0.5),
          })
        }
      }
      return
    }
    case 'nova': {
      for (let i = 0; i < r.tier.count; i++) {
        spawnAttack(g, {
          move: 'special', type: r.def.type, visual: 'nova', x: p.x, y: p.y,
          shape: { kind: 'circle', r: 6 }, motion: { kind: 'follow', ox: 0, oy: -8 },
          damage: dmg, knockback: 240, ttl: 0.45, grow: (95 * area) / 0.45, age: -i * 0.18, status: r.def.status ?? null,
        })
      }
      return
    }
    case 'bolt': return releaseBolts(g, r, area, dmg)
    case 'rain': return releaseRain(g, r, area, dmg)
    case 'ring': {
      for (let i = 0; i < r.tier.count; i++) {
        const v = fromAngle(s.angle + (i / r.tier.count) * TAU, RING_SPEED)
        spawnAttack(g, {
          move: 'special', type: r.def.type, visual: 'orb', x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 6 * area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: dmg, knockback: 150, ttl: RING_TTL, status: r.def.status ?? null,
        })
      }
      return
    }
    case 'wave': {
      const dir = fromAngle(s.angle)
      const gap = WAVE_GAP * area
      for (let i = 0; i < r.tier.count; i++) {
        const side = (i - (r.tier.count - 1) / 2) * gap
        // A shallow arc: the outer segments trail slightly behind the middle.
        const back = Math.abs(side) * 0.35
        spawnAttack(g, {
          move: 'special', type: r.def.type, visual: 'wave',
          x: p.x - dir.y * side + dir.x * (10 - back), y: p.y - 8 + dir.x * side + dir.y * (10 - back),
          shape: { kind: 'circle', r: 9 * area }, motion: { kind: 'linear', vx: dir.x * WAVE_SPEED, vy: dir.y * WAVE_SPEED },
          damage: dmg, knockback: 200, ttl: WAVE_TTL, status: r.def.status ?? null,
        })
      }
      return
    }
    case 'trail':
      s.active = activeTime(r)
      s.trail = TRAIL_EVERY
      return
    // Chain and stance never charge: `updateSpecial` runs them on the press.
    case 'chain':
    case 'stance':
      return
  }
}

/** Strikes from the sky on the nearest foes in view, one after another; spares scatter around the player. */
const releaseBolts = (g: Game, r: ResolvedSpecial, area: number, dmg: number) => {
  const p = g.player
  const targets = enemiesInView(g)
    .sort((a, b) => dm.sq(a.x - p.x) + dm.sq(a.y - p.y) - (dm.sq(b.x - p.x) + dm.sq(b.y - p.y)))
    .slice(0, r.tier.count)
  for (let i = 0; i < r.tier.count; i++) {
    const e = targets[i]
    const a = range(g.rng, 0, TAU)
    const d = range(g.rng, 30, BOLT_SCATTER)
    const at = BOLT_DELAY + i * BOLT_STAGGER
    spawnAttack(g, {
      move: 'special', type: r.def.type, visual: 'bolt',
      x: e ? e.x : p.x + dm.cos(a) * d, y: e ? e.y - e.radius : p.y + dm.sin(a) * d * 0.8,
      shape: { kind: 'circle', r: 14 * area }, motion: { kind: 'static' },
      damage: dmg, knockback: 120, status: r.def.status ?? null,
      activeFrom: at, activeUntil: at + IMPACT_WINDOW, ttl: at + 0.4,
    })
  }
}

/** Projectiles raining around the player over RAIN_TIME, most of them on foes. */
const releaseRain = (g: Game, r: ResolvedSpecial, area: number, dmg: number) => {
  const p = g.player
  const near = enemiesInView(g).filter((e) => dm.sq(e.x - p.x) + dm.sq(e.y - p.y) < dm.sq(RAIN_RADIUS))
  for (let i = 0; i < r.tier.count; i++) {
    const e = near.length > 0 && chance(g.rng, RAIN_AIMED) ? pick(g.rng, near) : null
    const a = range(g.rng, 0, TAU)
    const d = Math.sqrt(g.rng()) * RAIN_RADIUS
    const at = 0.15 + (i / r.tier.count) * RAIN_TIME
    spawnAttack(g, {
      move: 'special', type: r.def.type, visual: 'meteor',
      x: e ? e.x : p.x + dm.cos(a) * d, y: e ? e.y : p.y + dm.sin(a) * d * 0.8,
      shape: { kind: 'circle', r: 14 * area }, motion: { kind: 'static' },
      damage: dmg, knockback: 160, status: r.def.status ?? null,
      activeFrom: at, activeUntil: at + IMPACT_WINDOW, ttl: at + 0.35, flip: chance(g.rng, 0.5),
    })
  }
}

const dashTick = (g: Game, r: ResolvedSpecial, dt: number) => {
  const s = g.player.special
  const p = g.player
  const area = areaOf(g, r)
  const { dir, dx, dy, dist } = dashStep(s.angle, specialReach(g, r), dt)
  p.x += dx
  p.y += dy
  p.dir = dir8(dir.x, dir.y)
  s.trail += dist
  for (; s.trail >= TRAIL_STEP; s.trail -= TRAIL_STEP) fireTrail(g, r, area, power(g, r))
  if (s.active <= 0) {
    explode(g, r, p.x + dir.x * 10, p.y - 6 + dir.y * 10, 52 * area, power(g, r) * 1.2)
    arrivalCombo(g)
  }
}

/** Spray along the beam while it fires. */
const beamTick = (g: Game, r: ResolvedSpecial) => {
  const s = g.player.special
  const p = g.player
  const len = specialReach(g, r)
  const dir = fromAngle(s.angle)
  for (let i = 0; i < 3; i++) {
    const d = range(g.rng, 10, len)
    g.particles.push({
      x: p.x + dir.x * d, y: p.y - 8 + dir.y * d,
      vx: range(g.rng, -30, 30) + dir.x * 60, vy: range(g.rng, -40, 10) + dir.y * 60,
      life: 0, ttl: 0.35, color: chance(g.rng, 0.5) ? '#ffffff' : '#a8d0f8', size: 1, gravity: 80, drag: 2,
    })
  }
  burst(g, p.x + dir.x * len, p.y - 8 + dir.y * len, { colors: ['#ffffff', '#a8d0f8', '#6890f0'], count: 2, speed: 90, ttl: 0.3, gravity: 80 })
}

/** Drops a hazard patch at the player's feet every TRAIL_EVERY seconds while the trail lasts. */
const trailTick = (g: Game, r: ResolvedSpecial, dt: number) => {
  const s = g.player.special
  const p = g.player
  const area = areaOf(g, r)
  s.trail += dt
  for (; s.trail >= TRAIL_EVERY; s.trail -= TRAIL_EVERY) {
    spawnAttack(g, {
      move: 'special', type: r.def.type, visual: 'puddle', x: p.x + range(g.rng, -3, 3), y: p.y + range(g.rng, -2, 2),
      shape: { kind: 'circle', r: 10 * area }, motion: { kind: 'static' },
      damage: power(g, r) * 0.3, knockback: 0, hitInterval: 0.4, ttl: range(g.rng, 2, 2.6), status: r.def.status ?? null, flip: chance(g.rng, 0.5),
    })
  }
}

/* ---------------- Metronome ---------------- */

/**
 * How many moves Metronome fires at a landing. A jump with the chain still
 * going fires one at most; the chain's last jump, a lone dash and every other
 * trigger fire all `combo` (2 at max level).
 */
export const comboCasts = (combo: number, chainGoesOn: boolean) => (chainGoesOn ? Math.min(combo, 1) : combo)

/**
 * Metronome: fires `casts` different moves of the loadout (drawn with the
 * run's rng) from where the special landed, which is where the player stands.
 * Every move's `fire` is safe to call off-cycle (Whirlpool only refreshes its aura).
 */
const arrivalCombo = (g: Game, casts = g.player.stats.comboMoves) => {
  const p = g.player
  const n = Math.min(casts, p.moves.length)
  if (n <= 0) return
  const pool = [...p.moves]
  for (let i = 0; i < n; i++) {
    const [owned] = pool.splice(Math.floor(g.rng() * pool.length), 1)
    const def: MoveDef | null = owned ? MOVES[owned.id] : null
    if (owned && def) def.fire(g, moveStats(owned.id, owned.level, p.stats, owned.path), owned)
  }
  burst(g, p.x, p.y - 10, { colors: ['#ffffff', '#f8d030', '#f878a8'], count: 10, speed: 90, ttl: 0.3 })
}

/* ---------------- Chain dash ---------------- */

/** Nearest living foe on screen within reach of a jump, skipping the one the last jump went for. */
const chainTarget = (g: Game, skip: number) => {
  const p = g.player
  let best: Enemy | null = null
  let bestD = dm.sq(CHAIN_RANGE)
  for (const e of g.enemies) {
    if (!isAlive(e) || e.id === skip || !inSight(g, e.x, e.y, -8)) continue
    const d = dm.sq(e.x - p.x) + dm.sq(e.y - p.y)
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best
}

/** Spends a jump and aims it: at the nearest foe in reach (its id kept, to skip next time), or `CHAIN_MISS` px ahead. Returns the aim. */
const aimJump = (g: Game, r: ResolvedSpecial): Vec => {
  const s = g.player.special
  const p = g.player
  beginJump(s, r.tier.count)
  const foe = chainTarget(g, s.target)
  const dir = foe ? dirTo(p.x, p.y, foe.x, foe.y, p.facing) : p.facing
  s.reach = foe ? dm.hypot(foe.x - p.x, foe.y - p.y) + CHAIN_OVERSHOOT : CHAIN_MISS
  s.angle = dm.atan2(dir.y, dir.x)
  s.target = foe ? foe.id : -1
  s.active = CHAIN_TIME
  s.trail = 0
  return dir
}

/**
 * One jump: aims at the nearest foe (or dashes ahead when none is in reach)
 * and lays the capsule along the path, stepped circles that switch on as the
 * player passes and share one hit list, so each foe on the path is hit once.
 */
const startJump = (g: Game, r: ResolvedSpecial) => {
  const s = g.player.special
  const p = g.player
  const first = !s.chaining
  const dir = aimJump(g, r)
  p.iframes = Math.max(p.iframes, CHAIN_IFRAMES)
  if (first) g.events.push({ kind: 'special', phase: 'charge', name: r.tier.name })

  const area = areaOf(g, r)
  const dmg = power(g, r) * CHAIN_PATH
  const hits = new Map<number, number>()
  const speed = s.reach / CHAIN_TIME
  const from = { x: p.x, y: p.y - 8 }
  for (let d = 0; d <= s.reach; d += CHAIN_STEP) {
    const at = d / speed
    spawnAttack(g, {
      move: 'special', type: r.def.type, visual: 'streak', x: from.x + dir.x * d, y: from.y + dir.y * d,
      shape: { kind: 'circle', r: 11 * area }, motion: { kind: 'static' }, hits, from,
      damage: dmg, knockback: 90, status: r.def.status ?? null, activeFrom: at, activeUntil: at + 0.05, ttl: at + 0.25,
    })
  }
  burst(g, p.x, p.y - 10, { colors: typeColors(r.def.type), count: 10, speed: 70, ttl: 0.25 })
}

/** Moves the player one step of the jump (`jumpStep`), leaving afterimages behind (cosmetic: never active). */
const lungeTick = (g: Game, r: ResolvedSpecial, { dir, dx, dy, dist: moved }: SpecialStep) => {
  const s = g.player.special
  const p = g.player
  p.x += dx
  p.y += dy
  p.dir = dir8(dir.x, dir.y)
  s.trail += moved
  for (; s.trail >= CHAIN_GHOST; s.trail -= CHAIN_GHOST) {
    const back = s.trail - CHAIN_GHOST
    spawnAttack(g, {
      move: 'special', type: r.def.type, visual: 'afterimage', x: p.x - dir.x * back, y: p.y - dir.y * back,
      shape: { kind: 'circle', r: 1 }, motion: { kind: 'static' }, damage: 0, activeFrom: Infinity, ttl: 0.3,
    })
  }
}

/** The landing: a slash where the jump ends, a screen kick, then the window for the next jump (or the cooldown). */
const landChain = (g: Game, r: ResolvedSpecial, cooldown: number) => {
  const s = g.player.special
  const p = g.player
  const hit = s.target >= 0
  const area = areaOf(g, r)
  const back = fromAngle(s.angle, 12)
  spawnAttack(g, {
    move: 'special', type: r.def.type, visual: 'slash', x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: 22 * area }, motion: { kind: 'static' }, from: { x: p.x - back.x, y: p.y - 8 - back.y },
    damage: power(g, r) * CHAIN_SLASH, knockback: 220, status: r.def.status ?? null, activeUntil: 0.07, ttl: 0.3, flip: chance(g.rng, 0.5),
  })
  burst(g, p.x, p.y - 8, { colors: typeColors(r.def.type), count: hit ? 18 : 8, speed: hit ? 130 : 80, ttl: 0.3 })
  shakeScreen(g, hit ? 4 : 2)
  if (hit) {
    g.hitstop = Math.max(g.hitstop, LANDING_HITSTOP)
    g.events.push({ kind: 'special', phase: 'release', name: r.tier.name })
  }
  if (r.def.orbs) orbBurst(g, r, r.def.orbs)
  landJump(s, hit, cooldown)
  arrivalCombo(g, comboCasts(g.player.stats.comboMoves, s.chaining))
}

/** Mega Lucario: a ring of `count` orbs from the landing, each at half the jump's power. */
const orbBurst = (g: Game, r: ResolvedSpecial, count: number) => {
  const p = g.player
  for (let i = 0; i < count; i++) {
    const v = fromAngle(g.player.special.angle + (i / count) * TAU, RING_SPEED)
    spawnAttack(g, {
      move: 'special', type: r.def.type, visual: 'orb', x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: 6 * areaOf(g, r) }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: power(g, r) * 0.5, knockback: 150, ttl: RING_TTL * 0.7, status: r.def.status ?? null,
    })
  }
}

/**
 * Chain dash each tick: the window counts down between jumps, a (buffered)
 * press when ready or inside the window jumps, and the lunge runs its course.
 */
const updateChain = (g: Game, r: ResolvedSpecial, pressed: boolean, dt: number) => {
  const s = g.player.special
  // A chain never charges: drop the wind-up of a charged special swapped out mid-charge (Mega Evolving during Hydro Cannon's).
  s.charge = 0
  const cooldown = specialCooldown(r.def, g.player.stats)
  if (s.active <= 0) tickChain(s, dt, cooldown)
  if (triggerSpecial(s, pressed, dt)) startJump(g, r)
  if (s.active <= 0) return
  const step = jumpStep(s.angle, s.reach, s.active, dt)
  s.active = Math.max(0, s.active - dt)
  lungeTick(g, r, step)
  if (s.active <= 0) landChain(g, r, cooldown)
}

/* ---------------- Stance Change ---------------- */

const isStanceSpecial = (id: SpecialId): id is StanceSpecial => id in STANCE_CYCLES

/** Keeps the stance in step with the special: its first forme when it arrives (Aegislash's Shield, Deoxys's Normal), none for anyone else. */
const syncStance = (g: Game, r: ResolvedSpecial) => {
  const id = r.id
  const s = g.player.special
  const now = s.stance
  const cycle: readonly Stance[] = isStanceSpecial(id) ? STANCE_CYCLES[id] : []
  const want = !isStanceSpecial(id) ? null : now && cycle.includes(now) ? now : firstStance(id)
  if (want === s.stance) return
  s.stance = want
  recomputeStats(g)
}

const swapStance = (g: Game) => {
  const s = g.player.special
  const p = g.player
  const stance = nextStance(s.stance ?? 'shield')
  s.stance = stance
  recomputeStats(g)
  g.events.push({ kind: 'stance', stance })
  burst(g, p.x, p.y - 12, { colors: [STANCES[stance].color, '#ffffff', '#f8d030'], count: 24, speed: 110, ttl: 0.35 })
  shakeScreen(g, 2)
  arrivalCombo(g)
}

/** Runs the special each tick: trigger → charge → release → active phase. */
export const updateSpecial = (g: Game, pressed: boolean, dt: number) => {
  const s = g.player.special
  const r = gameSpecial(g)
  syncStance(g, r)
  rechargeSpecial(s, g.player.stats.specialRecharge)
  if (r.def.kind === 'chain') return updateChain(g, r, pressed, dt)
  // An evolution can swap the chain out mid-window.
  if (s.chaining) endChain(s, specialCooldown(r.def, g.player.stats))
  if (triggerSpecial(s, pressed, dt)) {
    s.cooldown = s.total = specialCooldown(r.def, g.player.stats)
    if (r.def.kind === 'stance') return swapStance(g)
    s.charge = r.def.charge
    g.events.push({ kind: 'special', phase: 'charge', name: r.tier.name })
  }
  if (s.charge > 0) {
    s.charge -= dt
    chargeFx(g, r)
    if (s.charge <= 0) {
      s.charge = 0
      release(g, r)
    }
  } else if (s.active > 0) {
    s.active = Math.max(0, s.active - dt)
    if (r.def.kind === 'dash') dashTick(g, r, dt)
    else if (r.def.kind === 'beam') beamTick(g, r)
    else if (r.def.kind === 'trail') trailTick(g, r, dt)
  }
}

/* ---------------- Prediction ---------------- */

/**
 * `updateSpecial` cut down to what moves the acting player: the trigger, the
 * charge, the release's aim and timers, a dash's or a chain jump's motion
 * (`dashStep`, `jumpStep`) and the chain's window. Nothing is spawned, shown,
 * heard or rolled. Co-op's prediction ghost (`coop/predict.ts`) runs it on its
 * copy of the player, from the confirmed state, so a press dashes the drawn
 * sprite at once. It starts the hitstops the real one does (the release, a
 * dash's blast, a jump landing on a foe). Keep it in step with `updateSpecial`.
 */
export const predictSpecial = (g: Game, pressed: boolean, dt: number) => {
  const s = g.player.special
  const p = g.player
  const r = gameSpecial(g)
  if (r.def.kind === 'chain') {
    s.charge = 0
    const cooldown = specialCooldown(r.def, p.stats)
    if (s.active <= 0) tickChain(s, dt, cooldown)
    if (triggerSpecial(s, pressed, dt)) aimJump(g, r)
    if (s.active <= 0) return
    const step = jumpStep(s.angle, s.reach, s.active, dt)
    s.active = Math.max(0, s.active - dt)
    p.x += step.dx
    p.y += step.dy
    p.dir = dir8(step.dir.x, step.dir.y)
    if (s.active > 0) return
    const hit = s.target >= 0
    if (hit) g.hitstop = Math.max(g.hitstop, LANDING_HITSTOP)
    landJump(s, hit, cooldown)
    return
  }
  if (s.chaining) endChain(s, specialCooldown(r.def, p.stats))
  if (triggerSpecial(s, pressed, dt)) {
    s.cooldown = s.total = specialCooldown(r.def, p.stats)
    if (r.def.kind === 'stance') return
    s.charge = r.def.charge
  }
  if (s.charge > 0) {
    s.charge -= dt
    if (s.charge > 0) return
    s.charge = 0
    s.angle = dm.atan2(p.facing.y, p.facing.x)
    g.hitstop = RELEASE_HITSTOP
    s.active = activeTime(r)
    return
  }
  if (s.active <= 0) return
  s.active = Math.max(0, s.active - dt)
  if (r.def.kind !== 'dash') return
  const step = dashStep(s.angle, specialReach(g, r), dt)
  p.x += step.dx
  p.y += step.dy
  p.dir = dir8(step.dir.x, step.dir.y)
  if (s.active <= 0) g.hitstop = Math.max(g.hitstop, BLAST_HITSTOP)
}
