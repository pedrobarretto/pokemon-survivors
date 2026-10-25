import type { MoveTag } from '../game/moves'
import type { StatDelta } from '../game/stats'
import type { StatusSpec } from '../game/status'
import type { WeatherId } from './biomes'
import type { BranchId } from './branches'
import type { PlayableId } from './hatchlings'
import type { PokeType } from './types'

/**
 * Abilities, as in the main series: each family offers two regular abilities
 * and a Hidden one, and the player picks one when the run's first evolution
 * lands (`game/abilities.ts`). Names stay official English; what each one does
 * lives in `i18n` (`abilities`). An ability is a list of small effects, so most
 * are one line of data. While a Mega form lasts, its own ability (`MegaDef`)
 * replaces the family's.
 */

/**
 * What hurt the player (`hurtPlayer`): a body, a boss strike or shot, a blast,
 * a beam, lava, a trap or a lingering patch on the ground (`zone`: a spitter's
 * puddle, the world's Stealth Rock, a boss's field).
 */
export type HitKind = 'body' | 'hazard' | 'shot' | 'blast' | 'beam' | 'lava' | 'trap' | 'zone'

/**
 * Harm an ability shrugs off: hits of a kind (lava, traps, blasts, lingering
 * patches), the weather's wear (`chip`), HP lost to no hit at all (`drain`:
 * a cursed item's bite, Bad Dreams), terrain that slows (water, ice) and the
 * wards allies put on wild Pokémon (`wards`, which hits go through).
 */
export type Immunity = 'lava' | 'trap' | 'blast' | 'zone' | 'chip' | 'drain' | 'terrain' | 'wards'
  /** The weather's boost to foes' hits and the world's attacks (`game/hazards.ts`): Air Lock. */
  | 'weather'

export type AbilityEffect =
  /** Always on. */
  | { kind: 'stats'; stats: StatDelta }
  /** Moves of `type` hit `bonus` harder under a third of max HP (Blaze, Torrent, Overgrow, Swarm). */
  | { kind: 'pinch'; type: PokeType; bonus: number }
  /** While `weather` is on where the player stands (Swift Swim, Chlorophyll, Rain Dish…). */
  | { kind: 'weather'; weather: WeatherId; stats: StatDelta }
  /** Calls `weather` when picked and at every new biome, outside rift arenas (Drought, Sand Stream). */
  | { kind: 'summon'; weather: WeatherId }
  /** Under half HP (Guts, Marvel Scale, Quick Feet). */
  | { kind: 'lowHp'; stats: StatDelta }
  /** At full HP (Multiscale). */
  | { kind: 'fullHp'; stats: StatDelta }
  /**
   * Every `ABILITY.contactEvery` s, each foe touching the player may get one of
   * `status` (drawn at random) and takes `damage` × the contact power (Static, Rough Skin).
   */
  | { kind: 'contact'; status: readonly StatusSpec[]; damage: number }
  /** Every `every` s, foes within `radius` px get `status` (Unnerve). */
  | { kind: 'aura'; radius: number; every: number; status: StatusSpec }
  /**
   * Every `every` s (on the never-paused clock, so it keeps no state), each
   * sleeping foe within `radius` px takes `damage` × the contact power, and
   * stays asleep (Darkrai's Bad Dreams).
   */
  | { kind: 'nightmare'; radius: number; every: number; damage: number }
  /**
   * Damage the player takes, ×`factor`, from attacks of these `types`, hits of
   * these `hits` kinds or (`boss`) bosses and elites; `absorb` turns it into healing (Water Absorb).
   */
  | { kind: 'resist'; types?: readonly PokeType[]; hits?: readonly HitKind[]; boss?: true; factor: number; absorb?: true }
  /** Harm the player never takes (Levitate, Magic Guard, Damp). */
  | { kind: 'immune'; to: readonly Immunity[] }
  /** Moves of a kind hit `bonus` harder (Iron Fist, Strong Jaw, Sharpness, Technician, Sheer Force). */
  | { kind: 'tag'; tag: MoveTag; bonus: number }
  /** Moves of the player's own types (Adaptability), or of every other type (Protean, Libero), hit `bonus` harder. */
  | { kind: 'ownType' | 'offType'; bonus: number }
  /** Hits on bosses and elites `bonus` harder (Sniper, Mold Breaker). */
  | { kind: 'bossHunter'; bonus: number }
  /**
   * Every `per` kills one more stack of `stats`, up to `max`. With `decay`,
   * a stack wears off every `decay` s (Moxie); without it they stay (Battle Bond).
   */
  | { kind: 'onKill'; per: number; max: number; stats: StatDelta; decay?: number }
  /** A kill may drop something more (Pickup, Magician, Frisk). */
  | { kind: 'drop'; chance: number; drop: 'berry' | 'coin' | 'xp' }
  /** Every `every` s one more stack of `stats`, up to `max` (Speed Boost). */
  | { kind: 'timer'; every: number; max: number; stats: StatDelta }
  /** Every `every` s, heals `heal` of max HP (Shed Skin). */
  | { kind: 'heal'; every: number; heal: number }
  /** Each hit taken adds a stack of `stats` (up to `max`) lasting `seconds` after the last hit; Infinity keeps them (Competitive, Contrary). */
  | { kind: 'onHurt'; seconds: number; max: number; stats: StatDelta }
  /** Every `every` s one of `options`, drawn at random, holds until the next draw (Moody). */
  | { kind: 'moody'; every: number; options: readonly StatDelta[] }
  /** Blocks a hit every `every` s; `reflect` throws it back at the foe that touched (Illusion, Magic Bounce). */
  | { kind: 'guard'; every: number; reflect?: true }
  /** The first hit that would faint the player leaves 1 HP instead, once a run (Sturdy). */
  | { kind: 'sturdy' }
  /** `stats` per empty held item slot (Unburden). */
  | { kind: 'unburden'; stats: StatDelta }
  /** Lucky level-up cards: `rare` more odds of a rare card, shiny odds ×`shiny` (Jirachi's Serene Grace, `data/legends.ts`). */
  | { kind: 'luck'; rare: number; shiny: number }

export type AbilityDef = { name: string; effects: readonly AbilityEffect[] }

/** Thresholds and timings shared by the abilities. */
export const ABILITY = {
  /** The pinch abilities wake under this share of max HP (Blaze, Torrent…). */
  pinch: 1 / 3,
  /** Guts, Marvel Scale and Quick Feet wake under this share. */
  lowHp: 0.5,
  /** Multiscale holds from this share up. */
  fullHp: 0.995,
  /** Seconds between contact pulses (Static, Rough Skin…). */
  contactEvery: 0.5,
  /** How far past touching a foe still counts as in contact, in px. */
  contactReach: 4,
  /** Contact power at Lv 1, before the damage stat; it grows 4% per level like the special. */
  contactPower: 10,
  /** Share of a hit an absorbing ability heals (Water Absorb, Volt Absorb, Lightning Rod). */
  absorbHeal: 0.5,
  /** Invulnerability after a hit is blocked, guarded or absorbed. */
  guardIframes: 0.6,
  /** Invulnerability after Sturdy holds. */
  sturdyIframes: 1.5,
} as const

const para = { kind: 'paralysis', chance: 0.3, duration: 1.5, power: 0 } as const satisfies StatusSpec
const burn = { kind: 'burn', chance: 0.3, duration: 3, power: 0.35 } as const satisfies StatusSpec
const poison = { kind: 'poison', chance: 0.3, duration: 4, power: 0.25 } as const satisfies StatusSpec
const sleep = { kind: 'sleep', chance: 0.25, duration: 2, power: 0 } as const satisfies StatusSpec
const curse = { kind: 'slow', chance: 0.35, duration: 2, power: 0.5 } as const satisfies StatusSpec

const stats = (s: StatDelta): AbilityEffect => ({ kind: 'stats', stats: s })
const pinch = (type: PokeType): AbilityEffect => ({ kind: 'pinch', type, bonus: 0.5 })
const rush = (weather: WeatherId): AbilityEffect => ({ kind: 'weather', weather, stats: { speed: 18, cooldown: -0.08 } })
const veil = (weather: WeatherId): readonly AbilityEffect[] => [{ kind: 'weather', weather, stats: { damageTaken: -0.25 } }, { kind: 'immune', to: ['chip'] }]
const absorb = (type: PokeType): AbilityEffect => ({ kind: 'resist', types: [type], factor: 0, absorb: true })

/** Every ability by id, in roughly the order the families meet them. */
export const ABILITIES = {
  /* ---------- Pinch: the starters' own ---------- */
  overgrow: { name: 'Overgrow', effects: [pinch('grass')] },
  blaze: { name: 'Blaze', effects: [pinch('fire')] },
  torrent: { name: 'Torrent', effects: [pinch('water')] },
  swarm: { name: 'Swarm', effects: [pinch('bug')] },

  /* ---------- Weather ---------- */
  swiftSwim: { name: 'Swift Swim', effects: [rush('rain')] },
  chlorophyll: { name: 'Chlorophyll', effects: [rush('sun')] },
  sandRush: { name: 'Sand Rush', effects: [rush('sand'), { kind: 'immune', to: ['chip'] }] },
  slushRush: { name: 'Slush Rush', effects: [rush('snow'), { kind: 'immune', to: ['chip'] }] },
  solarPower: { name: 'Solar Power', effects: [{ kind: 'weather', weather: 'sun', stats: { might: 0.3, damageTaken: 0.1 } }] },
  rainDish: { name: 'Rain Dish', effects: [{ kind: 'weather', weather: 'rain', stats: { regen: 1.5 } }] },
  hydration: { name: 'Hydration', effects: [{ kind: 'weather', weather: 'rain', stats: { regen: 0.6, damageTaken: -0.15 } }] },
  iceBody: { name: 'Ice Body', effects: [{ kind: 'weather', weather: 'snow', stats: { regen: 1.5 } }, { kind: 'immune', to: ['chip'] }] },
  sandVeil: { name: 'Sand Veil', effects: veil('sand') },
  snowCloak: { name: 'Snow Cloak', effects: veil('snow') },
  leafGuard: { name: 'Leaf Guard', effects: [{ kind: 'weather', weather: 'sun', stats: { damageTaken: -0.3, regen: 0.5 } }] },
  drought: { name: 'Drought', effects: [{ kind: 'summon', weather: 'sun' }] },
  sandStream: { name: 'Sand Stream', effects: [{ kind: 'summon', weather: 'sand' }, { kind: 'immune', to: ['chip'] }] },

  /* ---------- Contact: foes that touch you pay for it ---------- */
  static: { name: 'Static', effects: [{ kind: 'contact', status: [para], damage: 0 }] },
  flameBody: { name: 'Flame Body', effects: [{ kind: 'contact', status: [burn], damage: 0 }] },
  poisonPoint: { name: 'Poison Point', effects: [{ kind: 'contact', status: [poison], damage: 0 }] },
  effectSpore: { name: 'Effect Spore', effects: [{ kind: 'contact', status: [poison, para, sleep], damage: 0 }] },
  cursedBody: { name: 'Cursed Body', effects: [{ kind: 'contact', status: [curse], damage: 0 }] },
  cuteCharm: { name: 'Cute Charm', effects: [{ kind: 'contact', status: [sleep], damage: 0 }] },
  roughSkin: { name: 'Rough Skin', effects: [{ kind: 'contact', status: [], damage: 1 }] },

  /* ---------- Presence ---------- */
  intimidate: { name: 'Intimidate', effects: [{ kind: 'resist', hits: ['body'], factor: 0.75 }] },
  unnerve: { name: 'Unnerve', effects: [{ kind: 'aura', radius: 70, every: 1, status: { kind: 'slow', chance: 1, duration: 1.2, power: 0.25 } }] },
  unaware: { name: 'Unaware', effects: [{ kind: 'resist', boss: true, factor: 0.7 }] },

  /* ---------- Taking hits ---------- */
  thickFat: { name: 'Thick Fat', effects: [{ kind: 'resist', types: ['fire', 'ice'], factor: 0.5 }] },
  flashFire: { name: 'Flash Fire', effects: [{ kind: 'resist', types: ['fire'], factor: 0.4 }, stats({ typeDamage: { fire: 0.15 } })] },
  waterAbsorb: { name: 'Water Absorb', effects: [absorb('water')] },
  voltAbsorb: { name: 'Volt Absorb', effects: [absorb('electric')] },
  lightningRod: { name: 'Lightning Rod', effects: [absorb('electric'), stats({ typeDamage: { electric: 0.15 } })] },
  bulletproof: { name: 'Bulletproof', effects: [{ kind: 'resist', hits: ['shot', 'blast'], factor: 0.4 }] },
  levitate: { name: 'Levitate', effects: [{ kind: 'immune', to: ['lava', 'trap', 'terrain'] }] },
  magicGuard: { name: 'Magic Guard', effects: [{ kind: 'immune', to: ['lava', 'trap', 'blast', 'zone', 'chip', 'drain'] }] },
  magicBounce: { name: 'Magic Bounce', effects: [{ kind: 'guard', every: 12, reflect: true }] },
  illusion: { name: 'Illusion', effects: [{ kind: 'guard', every: 10 }] },
  damp: { name: 'Damp', effects: [{ kind: 'immune', to: ['blast'] }, stats({ typeDamage: { water: 0.1 } })] },
  clearBody: { name: 'Clear Body', effects: [{ kind: 'immune', to: ['terrain'] }, stats({ damageTaken: -0.1 })] },
  shellArmor: { name: 'Shell Armor', effects: [stats({ armor: 2 })] },
  rockHead: { name: 'Rock Head', effects: [stats({ armor: 1, might: 0.1 })] },
  heavyMetal: { name: 'Heavy Metal', effects: [stats({ armor: 3, maxHp: 20, speed: -6 })] },
  lightMetal: { name: 'Light Metal', effects: [stats({ speed: 10, cooldown: -0.05, armor: -1 })] },
  sturdy: { name: 'Sturdy', effects: [{ kind: 'sturdy' }] },
  multiscale: { name: 'Multiscale', effects: [{ kind: 'fullHp', stats: { damageTaken: -0.5 } }] },
  marvelScale: { name: 'Marvel Scale', effects: [{ kind: 'lowHp', stats: { damageTaken: -0.3 } }] },
  shedSkin: { name: 'Shed Skin', effects: [{ kind: 'heal', every: 10, heal: 0.06 }] },
  naturalCure: { name: 'Natural Cure', effects: [stats({ regen: 0.6 })] },
  gluttony: { name: 'Gluttony', effects: [stats({ regen: 0.8, maxHp: 20 })] },

  /* ---------- Hitting harder ---------- */
  guts: { name: 'Guts', effects: [{ kind: 'lowHp', stats: { might: 0.35 } }] },
  quickFeet: { name: 'Quick Feet', effects: [{ kind: 'lowHp', stats: { speed: 16, cooldown: -0.1 } }] },
  hugePower: { name: 'Huge Power', effects: [stats({ might: 0.3, maxHp: -10 })] },
  hustle: { name: 'Hustle', effects: [stats({ might: 0.3, area: -0.1 })] },
  truant: { name: 'Truant', effects: [stats({ might: 0.4, cooldown: 0.15 })] },
  noGuard: { name: 'No Guard', effects: [stats({ area: 0.2, damageTaken: 0.1 })] },
  reckless: { name: 'Reckless', effects: [stats({ might: 0.25, damageTaken: 0.1 })] },
  technician: { name: 'Technician', effects: [{ kind: 'tag', tag: 'weak', bonus: 0.4 }] },
  ironFist: { name: 'Iron Fist', effects: [{ kind: 'tag', tag: 'punch', bonus: 0.35 }] },
  strongJaw: { name: 'Strong Jaw', effects: [{ kind: 'tag', tag: 'bite', bonus: 0.4 }] },
  sharpness: { name: 'Sharpness', effects: [{ kind: 'tag', tag: 'slice', bonus: 0.35 }] },
  sheerForce: { name: 'Sheer Force', effects: [{ kind: 'tag', tag: 'status', bonus: 0.25 }] },
  liquidVoice: { name: 'Liquid Voice', effects: [{ kind: 'tag', tag: 'sound', bonus: 0.3 }, stats({ typeDamage: { water: 0.1 } })] },
  punkRock: { name: 'Punk Rock', effects: [{ kind: 'tag', tag: 'sound', bonus: 0.35 }, stats({ damageTaken: -0.05 })] },
  adaptability: { name: 'Adaptability', effects: [{ kind: 'ownType', bonus: 0.25 }] },
  protean: { name: 'Protean', effects: [{ kind: 'offType', bonus: 0.2 }] },
  libero: { name: 'Libero', effects: [{ kind: 'offType', bonus: 0.2 }] },
  pixilate: { name: 'Pixilate', effects: [stats({ typeDamage: { normal: 0.3, fairy: 0.15 } })] },
  grassySurge: { name: 'Grassy Surge', effects: [stats({ regen: 0.8, typeDamage: { grass: 0.1 } })] },
  sniper: { name: 'Sniper', effects: [{ kind: 'bossHunter', bonus: 0.25 }] },
  moldBreaker: { name: 'Mold Breaker', effects: [{ kind: 'immune', to: ['wards'] }, { kind: 'bossHunter', bonus: 0.15 }] },
  infiltrator: { name: 'Infiltrator', effects: [{ kind: 'immune', to: ['wards'] }, stats({ might: 0.1 })] },

  /* ---------- Momentum ---------- */
  moxie: { name: 'Moxie', effects: [{ kind: 'onKill', per: 1, max: 30, stats: { might: 0.01 }, decay: 1 }] },
  battleBond: { name: 'Battle Bond', effects: [{ kind: 'onKill', per: 200, max: 3, stats: { might: 0.08, speed: 3 } }] },
  speedBoost: { name: 'Speed Boost', effects: [{ kind: 'timer', every: 20, max: 10, stats: { speed: 3 } }] },
  competitive: { name: 'Competitive', effects: [{ kind: 'onHurt', seconds: 4, max: 1, stats: { might: 0.25 } }] },
  steadfast: { name: 'Steadfast', effects: [{ kind: 'onHurt', seconds: 3, max: 1, stats: { speed: 14 } }] },
  weakArmor: { name: 'Weak Armor', effects: [{ kind: 'onHurt', seconds: 3, max: 1, stats: { speed: 12, cooldown: -0.1, damageTaken: 0.05 } }] },
  contrary: { name: 'Contrary', effects: [{ kind: 'onHurt', seconds: Infinity, max: 15, stats: { might: 0.02 } }] },
  moody: {
    name: 'Moody',
    effects: [{ kind: 'moody', every: 15, options: [{ might: 0.3 }, { speed: 20 }, { area: 0.3 }, { cooldown: -0.2 }, { damageTaken: -0.3 }] }],
  },
  unburden: { name: 'Unburden', effects: [{ kind: 'unburden', stats: { speed: 4, cooldown: -0.02 } }] },

  /* ---------- Finds ---------- */
  pickup: { name: 'Pickup', effects: [{ kind: 'drop', chance: 0.025, drop: 'berry' }] },
  magician: { name: 'Magician', effects: [{ kind: 'drop', chance: 0.05, drop: 'xp' }] },
  frisk: { name: 'Frisk', effects: [{ kind: 'drop', chance: 0.06, drop: 'coin' }] },

  /* ---------- Steady ---------- */
  synchronize: { name: 'Synchronize', effects: [stats({ statusChance: 0.06, statusDamage: 0.2 })] },
  sereneGrace: { name: 'Serene Grace', effects: [stats({ statusChance: 0.1 })] },
  keenEye: { name: 'Keen Eye', effects: [stats({ magnet: 25, projectileSpeed: 0.15 })] },
  longReach: { name: 'Long Reach', effects: [stats({ area: 0.1, projectileSpeed: 0.2 })] },
  vitalSpirit: { name: 'Vital Spirit', effects: [stats({ speed: 8, cooldown: -0.05 })] },
  insomnia: { name: 'Insomnia', effects: [stats({ speed: 5, regen: 0.3 })] },
  innerFocus: { name: 'Inner Focus', effects: [stats({ specialRecharge: 0.25 })] },
  /** Aegislash's: what it does is the special (`game/stance.ts`), so Honedge's line has nothing to pick. */
  stanceChange: { name: 'Stance Change', effects: [] },

  /* ---------- The legends' innates (`data/legends.ts`) ---------- */
  pressure: { name: 'Pressure', effects: [{ kind: 'aura', radius: 64, every: 1, status: { kind: 'slow', chance: 1, duration: 1.2, power: 0.2 } }] },
  regenerator: { name: 'Regenerator', effects: [{ kind: 'heal', every: 8, heal: 0.05 }] },
  drizzle: { name: 'Drizzle', effects: [{ kind: 'summon', weather: 'rain' }] },
  airLock: { name: 'Air Lock', effects: [{ kind: 'immune', to: ['chip', 'weather'] }] },
  /** Arceus's type follows the biome (`game/legend.ts`), and its moves of that type hit harder. */
  multitype: { name: 'Multitype', effects: [{ kind: 'ownType', bonus: 0.2 }] },
  /** Darkrai's: the foes its Dark Void put to sleep (or anything else did) suffer in their dreams. */
  badDreams: { name: 'Bad Dreams', effects: [{ kind: 'nightmare', radius: 120, every: 0.5, damage: 1 }] },
} as const satisfies Record<string, AbilityDef>

export type AbilityId = keyof typeof ABILITIES

export const ABILITY_IDS = Object.keys(ABILITIES) as AbilityId[]

/** Two regular abilities and a Hidden one; Honedge's line has Stance Change alone. */
export type AbilitySet = readonly [AbilityId, AbilityId, AbilityId] | readonly [AbilityId]

/**
 * Each family's abilities, taken from the main series where they fit a
 * survivors run. A family that branches at its first evolution (Eevee,
 * Snorunt, Scyther, Charcadet) takes them from the branch picked
 * (`BRANCH_ABILITIES`), so its entry here only shows on the select screen.
 */
export const FAMILY_ABILITIES = {
  /* Starters */
  bulbasaur: ['overgrow', 'chlorophyll', 'leafGuard'],
  charmander: ['blaze', 'flashFire', 'solarPower'],
  squirtle: ['torrent', 'shellArmor', 'rainDish'],
  chikorita: ['overgrow', 'naturalCure', 'leafGuard'],
  cyndaquil: ['blaze', 'flameBody', 'flashFire'],
  totodile: ['torrent', 'strongJaw', 'sheerForce'],
  treecko: ['overgrow', 'sharpness', 'unburden'],
  torchic: ['blaze', 'reckless', 'speedBoost'],
  mudkip: ['torrent', 'swiftSwim', 'damp'],
  turtwig: ['overgrow', 'heavyMetal', 'shellArmor'],
  chimchar: ['blaze', 'vitalSpirit', 'ironFist'],
  piplup: ['torrent', 'swiftSwim', 'competitive'],
  snivy: ['overgrow', 'chlorophyll', 'contrary'],
  tepig: ['blaze', 'thickFat', 'reckless'],
  oshawott: ['torrent', 'shellArmor', 'sharpness'],
  chespin: ['overgrow', 'roughSkin', 'bulletproof'],
  fennekin: ['blaze', 'synchronize', 'magician'],
  froakie: ['torrent', 'protean', 'battleBond'],
  rowlet: ['overgrow', 'keenEye', 'longReach'],
  litten: ['blaze', 'flameBody', 'intimidate'],
  popplio: ['torrent', 'cuteCharm', 'liquidVoice'],
  grookey: ['overgrow', 'naturalCure', 'grassySurge'],
  scorbunny: ['blaze', 'vitalSpirit', 'libero'],
  sobble: ['torrent', 'swiftSwim', 'sniper'],
  sprigatito: ['overgrow', 'technician', 'protean'],
  fuecoco: ['blaze', 'cursedBody', 'unaware'],
  quaxly: ['torrent', 'steadfast', 'moxie'],
  /* Common eggs */
  pichu: ['static', 'vitalSpirit', 'lightningRod'],
  machop: ['guts', 'noGuard', 'steadfast'],
  eevee: ['adaptability', 'synchronize', 'pickup'],
  togepi: ['sereneGrace', 'hustle', 'naturalCure'],
  spheal: ['thickFat', 'iceBody', 'unaware'],
  starly: ['keenEye', 'intimidate', 'reckless'],
  budew: ['naturalCure', 'poisonPoint', 'leafGuard'],
  rockruff: ['keenEye', 'vitalSpirit', 'steadfast'],
  grubbin: ['swarm', 'levitate', 'lightningRod'],
  pidgey: ['keenEye', 'steadfast', 'longReach'],
  zubat: ['innerFocus', 'unnerve', 'infiltrator'],
  poliwag: ['waterAbsorb', 'damp', 'swiftSwim'],
  geodude: ['rockHead', 'sturdy', 'sandVeil'],
  roggenrola: ['sturdy', 'sandStream', 'rockHead'],
  mareep: ['static', 'voltAbsorb', 'lightningRod'],
  shinx: ['intimidate', 'strongJaw', 'guts'],
  azurill: ['thickFat', 'cuteCharm', 'hugePower'],
  shroomish: ['effectSpore', 'ironFist', 'technician'],
  swinub: ['snowCloak', 'slushRush', 'thickFat'],
  snorunt: ['innerFocus', 'iceBody', 'moody'],
  /* Rare eggs */
  gastly: ['levitate', 'unnerve', 'cursedBody'],
  abra: ['synchronize', 'innerFocus', 'magicGuard'],
  ralts: ['synchronize', 'steadfast', 'sharpness'],
  riolu: ['steadfast', 'innerFocus', 'adaptability'],
  zorua: ['illusion', 'unnerve', 'infiltrator'],
  larvesta: ['flameBody', 'swarm', 'drought'],
  noibat: ['infiltrator', 'unnerve', 'liquidVoice'],
  honedge: ['stanceChange'],
  toxel: ['static', 'poisonPoint', 'punkRock'],
  tinkatink: ['moldBreaker', 'hustle', 'pickup'],
  charcadet: ['flashFire', 'magicGuard', 'weakArmor'],
  growlithe: ['intimidate', 'flashFire', 'strongJaw'],
  vulpix: ['flashFire', 'cursedBody', 'drought'],
  cubone: ['rockHead', 'lightningRod', 'hugePower'],
  scyther: ['swarm', 'technician', 'steadfast'],
  magikarp: ['swiftSwim', 'intimidate', 'moxie'],
  horsea: ['swiftSwim', 'sniper', 'damp'],
  kabuto: ['swiftSwim', 'shellArmor', 'weakArmor'],
  houndour: ['flashFire', 'solarPower', 'unnerve'],
  teddiursa: ['pickup', 'guts', 'quickFeet'],
  aron: ['sturdy', 'rockHead', 'heavyMetal'],
  trapinch: ['levitate', 'sandVeil', 'sheerForce'],
  swablu: ['naturalCure', 'cuteCharm', 'pixilate'],
  electrike: ['static', 'lightningRod', 'intimidate'],
  shuppet: ['insomnia', 'frisk', 'cursedBody'],
  /* Ultra rare eggs */
  dratini: ['shedSkin', 'marvelScale', 'multiscale'],
  larvitar: ['guts', 'sandStream', 'unnerve'],
  beldum: ['clearBody', 'ironFist', 'lightMetal'],
  gible: ['sandVeil', 'sandRush', 'roughSkin'],
  dreepy: ['clearBody', 'infiltrator', 'cursedBody'],
  bagon: ['rockHead', 'intimidate', 'sheerForce'],
  slakoth: ['truant', 'vitalSpirit', 'guts'],
  feebas: ['marvelScale', 'competitive', 'cuteCharm'],
  deino: ['hustle', 'levitate', 'strongJaw'],
  /* Friendship Egg */
  munchlax: ['pickup', 'thickFat', 'gluttony'],
  /* Haunted Egg (where the games' ability isn't here: Phantump's Harvest grows back as Regenerator, Drifloon's Aftermath and Flare Boost as Levitate and Cursed Body, Sandygast's Water Compaction as Sturdy) */
  litwick: ['flashFire', 'flameBody', 'infiltrator'],
  phantump: ['naturalCure', 'frisk', 'regenerator'],
  drifloon: ['unburden', 'levitate', 'cursedBody'],
  sandygast: ['sandVeil', 'sturdy', 'sandStream'],
  /* Kecleon Egg (where the games' ability isn't here: Porygon's Download as Technician and Analytic as Sniper, Exeggcute's Harvest as Regenerator, Smeargle's Own Tempo as Inner Focus) */
  porygon: ['adaptability', 'technician', 'sniper'],
  exeggcute: ['chlorophyll', 'regenerator', 'frisk'],
  scraggy: ['shedSkin', 'moxie', 'intimidate'],
  smeargle: ['technician', 'innerFocus', 'moody'],
  /* Legends: picked at the first awakening, on top of the innate (`data/legends.ts`), never sharing its running state's kind */
  articuno: ['iceBody', 'keenEye', 'sniper'],
  zapdos: ['lightningRod', 'keenEye', 'sniper'],
  moltres: ['flashFire', 'solarPower', 'infiltrator'],
  raikou: ['voltAbsorb', 'quickFeet', 'speedBoost'],
  entei: ['flashFire', 'intimidate', 'guts'],
  suicune: ['waterAbsorb', 'hydration', 'marvelScale'],
  regirock: ['sturdy', 'rockHead', 'ironFist'],
  regice: ['iceBody', 'sturdy', 'slushRush'],
  registeel: ['heavyMetal', 'sturdy', 'lightMetal'],
  mew: ['protean', 'adaptability', 'magicGuard'],
  celebi: ['leafGuard', 'grassySurge', 'magicBounce'],
  jirachi: ['frisk', 'technician', 'magicGuard'],
  mewtwo: ['magicGuard', 'moldBreaker', 'adaptability'],
  lugia: ['magicBounce', 'keenEye', 'damp'],
  hoOh: ['flashFire', 'solarPower', 'magicGuard'],
  kyogre: ['swiftSwim', 'rainDish', 'liquidVoice'],
  groudon: ['solarPower', 'leafGuard', 'roughSkin'],
  rayquaza: ['moxie', 'infiltrator', 'speedBoost'],
  dialga: ['heavyMetal', 'sniper', 'unaware'],
  latias: ['magicBounce', 'naturalCure', 'competitive'],
  latios: ['sniper', 'infiltrator', 'adaptability'],
  deoxys: ['sniper', 'moxie', 'adaptability'],
  arceus: ['moldBreaker', 'magicGuard', 'sturdy'],
  darkrai: ['insomnia', 'unnerve', 'infiltrator'],
  cresselia: ['naturalCure', 'magicGuard', 'synchronize'],
} as const satisfies Record<PlayableId, AbilitySet>

/** The abilities of a branch picked at the family's first evolution (`data/branches.ts`). */
export const BRANCH_ABILITIES = {
  vaporeon: ['waterAbsorb', 'rainDish', 'hydration'],
  jolteon: ['voltAbsorb', 'static', 'quickFeet'],
  flareon: ['flashFire', 'flameBody', 'guts'],
  espeon: ['synchronize', 'sereneGrace', 'magicBounce'],
  umbreon: ['synchronize', 'unnerve', 'innerFocus'],
  leafeon: ['leafGuard', 'sharpness', 'chlorophyll'],
  glaceon: ['snowCloak', 'slushRush', 'iceBody'],
  sylveon: ['cuteCharm', 'naturalCure', 'pixilate'],
  glalie: ['innerFocus', 'iceBody', 'moody'],
  froslass: ['snowCloak', 'iceBody', 'cursedBody'],
  scizor: ['swarm', 'technician', 'lightMetal'],
  kleavor: ['swarm', 'sheerForce', 'sharpness'],
  armarouge: ['flashFire', 'magicGuard', 'weakArmor'],
  ceruledge: ['flashFire', 'cursedBody', 'sharpness'],
} as const satisfies Partial<Record<BranchId, AbilitySet>>

/** The Hidden Ability of a set: the last of three (a lone ability is no Hidden one). */
export const isHidden = (set: AbilitySet, index: number) => set.length === 3 && index === 2
