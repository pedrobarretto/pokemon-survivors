import type { SpecialId } from '../game/special'
import type { StatDelta } from '../game/stats'
import type { StatusSpec } from '../game/status'
import type { WeatherId } from './biomes'
import type { PlayableId } from './hatchlings'

/**
 * Mega Evolutions: the final stage of a line with a Mega can Mega Evolve once
 * the run finds its Mega Stone (beating a rift legendary drops it; a line with
 * two Megas gets both stones and keeps the one it picks up). The Mega form lasts
 * `MEGA.duration` seconds, then needs `MEGA.recharge` seconds before the next
 * one. While it lasts the form adds its `stats`, swaps the special for its own
 * and plays its ability. Rules in `game/mega.ts`; names stay in English
 * (official), what the ability does lives in `i18n` (`megas`).
 */

/** Asset folder of a Mega form. X/Y and Z tell apart the lines with two Megas. */
export type MegaForm = 'mega' | 'megaX' | 'megaY' | 'megaZ'

/** What a Mega's ability does beyond its stats. */
export type MegaEffect =
  /** The stats carry it (Tough Claws, Trace, Pixilate, Adaptability). */
  | { kind: 'stats' }
  /** Every `every` seconds, foes within `radius` px of the player get `status` (Shadow Tag). */
  | { kind: 'aura'; radius: number; every: number; status: StatusSpec }
  /** Mega Evolving outside a rift arena starts this weather (Sand Stream, Drought, Swift Swim's rain). */
  | { kind: 'weather'; weather: WeatherId }

export type MegaDef = {
  line: PlayableId
  name: string
  /** Its Mega Stone, dropped by the first rift legendary the run beats. */
  stone: string
  /**
   * Where the form's assets live (`<dex>/<form>/`): its sheets once SpriteCollab
   * has them (`FORMS` in scripts/dex.mjs) or once drawn for the game
   * (`LOCAL_FORMS`; until then the final stage wears a rainbow outline) and its
   * cry (`FORM_CRIES`).
   */
  form: MegaForm
  /** The stone's look: shell, shine and the helix inside. */
  colors: readonly [shell: string, shine: string, helix: string]
  ability: string
  effect: MegaEffect
  /** Added on top of every other stat source while the Mega form lasts. */
  stats: StatDelta
  /** The special while the Mega form lasts (`SPECIALS`). */
  special: SpecialId
}

/** Mega Evolutions by id, in Pokédex order. To add one: its entry here, its cry (and sprite, once SpriteCollab has it or one is drawn for the game) in `scripts/dex.mjs`, its special and i18n lines. */
export const MEGAS = {
  venusaur: {
    line: 'bulbasaur',
    name: 'Mega Venusaur',
    stone: 'Venusaurite',
    form: 'mega',
    colors: ['#386838', '#90d080', '#f07888'],
    ability: 'Thick Fat',
    effect: { kind: 'stats' },
    stats: { maxHp: 50, armor: 3, regen: 1 },
    special: 'petalBlizzard',
  },
  charizardX: {
    line: 'charmander',
    name: 'Mega Charizard X',
    stone: 'Charizardite X',
    form: 'megaX',
    colors: ['#282c40', '#7080a8', '#48a0f8'],
    ability: 'Tough Claws',
    effect: { kind: 'stats' },
    stats: { might: 0.3, speed: 8, armor: 1 },
    special: 'dragonFlare',
  },
  charizardY: {
    line: 'charmander',
    name: 'Mega Charizard Y',
    stone: 'Charizardite Y',
    form: 'megaY',
    colors: ['#c05020', '#f8b058', '#f8e070'],
    ability: 'Drought',
    effect: { kind: 'weather', weather: 'sun' },
    stats: { might: 0.25, area: 0.15 },
    special: 'heatWave',
  },
  blastoise: {
    line: 'squirtle',
    name: 'Mega Blastoise',
    stone: 'Blastoisinite',
    form: 'mega',
    colors: ['#2850a0', '#90c0f0', '#a87838'],
    ability: 'Mega Launcher',
    effect: { kind: 'stats' },
    stats: { amount: 1, projectileSpeed: 0.3, armor: 2 },
    special: 'waterPulse',
  },
  pidgeot: {
    line: 'pidgey',
    name: 'Mega Pidgeot',
    stone: 'Pidgeotite',
    form: 'mega',
    colors: ['#a87840', '#f0d8a0', '#e85838'],
    ability: 'No Guard',
    effect: { kind: 'stats' },
    stats: { area: 0.2, projectileSpeed: 0.3, speed: 10, might: 0.2 },
    special: 'airSlash',
  },
  raichuX: {
    line: 'pichu',
    name: 'Mega Raichu X',
    stone: 'Raichunite X',
    form: 'megaX',
    colors: ['#c87828', '#f8d060', '#3858c0'],
    ability: 'Electric Surge',
    effect: { kind: 'aura', radius: 70, every: 0.5, status: { kind: 'paralysis', chance: 0.2, duration: 0.8, power: 0 } },
    stats: { might: 0.3, typeDamage: { electric: 0.25 } },
    special: 'voltTackle',
  },
  raichuY: {
    line: 'pichu',
    name: 'Mega Raichu Y',
    stone: 'Raichunite Y',
    form: 'megaY',
    colors: ['#d89830', '#f8e888', '#e85840'],
    ability: 'No Guard',
    effect: { kind: 'stats' },
    stats: { area: 0.25, projectileSpeed: 0.3, cooldown: -0.1, speed: 8 },
    special: 'risingVoltage',
  },
  alakazam: {
    line: 'abra',
    name: 'Mega Alakazam',
    stone: 'Alakazite',
    form: 'mega',
    colors: ['#b88828', '#f8e898', '#c03828'],
    ability: 'Trace',
    effect: { kind: 'stats' },
    stats: { comboMoves: 2, cooldown: -0.15, might: 0.1 },
    special: 'psystrike',
  },
  gengar: {
    line: 'gastly',
    name: 'Mega Gengar',
    stone: 'Gengarite',
    form: 'mega',
    colors: ['#482c68', '#a888d0', '#f04060'],
    ability: 'Shadow Tag',
    effect: { kind: 'aura', radius: 90, every: 0.25, status: { kind: 'slow', chance: 1, duration: 0.4, power: 0.45 } },
    stats: { might: 0.25, cooldown: -0.1 },
    special: 'poltergeist',
  },
  gyarados: {
    line: 'magikarp',
    name: 'Mega Gyarados',
    stone: 'Gyaradosite',
    form: 'mega',
    colors: ['#2858a8', '#88b8f0', '#e8c040'],
    ability: 'Mold Breaker',
    effect: { kind: 'stats' },
    stats: { might: 0.35, armor: 2, typeDamage: { dark: 0.3 } },
    special: 'waterfall',
  },
  dragonite: {
    line: 'dratini',
    name: 'Mega Dragonite',
    stone: 'Dragoninite',
    form: 'mega',
    colors: ['#d88838', '#f8d898', '#3868b0'],
    ability: 'Multiscale',
    effect: { kind: 'stats' },
    stats: { damageTaken: -0.25, might: 0.25, speed: 6 },
    special: 'hurricane',
  },
  mewtwoY: {
    line: 'mewtwo',
    name: 'Mega Mewtwo Y',
    stone: 'Mewtwonite Y',
    form: 'megaY',
    colors: ['#7858a8', '#d0b8f0', '#f8f8f8'],
    ability: 'Insomnia',
    effect: { kind: 'stats' },
    stats: { might: 0.4, cooldown: -0.15, area: 0.15 },
    special: 'psystrike',
  },
  meganium: {
    line: 'chikorita',
    name: 'Mega Meganium',
    stone: 'Meganiumite',
    form: 'mega',
    colors: ['#48a048', '#b8f098', '#f878b0'],
    ability: 'Mega Sol',
    effect: { kind: 'stats' },
    stats: { maxHp: 40, regen: 2, typeDamage: { grass: 0.3, fairy: 0.3 } },
    special: 'solarBeam',
  },
  feraligatr: {
    line: 'totodile',
    name: 'Mega Feraligatr',
    stone: 'Feraligite',
    form: 'mega',
    colors: ['#2878a0', '#88d0e8', '#c83838'],
    ability: 'Dragonize',
    effect: { kind: 'stats' },
    stats: { might: 0.25, typeDamage: { water: 0.2, dragon: 0.35 }, armor: 1 },
    special: 'waveCrash',
  },
  ampharos: {
    line: 'mareep',
    name: 'Mega Ampharos',
    stone: 'Ampharosite',
    form: 'mega',
    colors: ['#d8a828', '#f8e888', '#e84848'],
    ability: 'Mold Breaker',
    effect: { kind: 'stats' },
    stats: { might: 0.25, maxHp: 30, typeDamage: { electric: 0.2, dragon: 0.35 } },
    special: 'zapCannon',
  },
  scizor: {
    line: 'scyther',
    name: 'Mega Scizor',
    stone: 'Scizorite',
    form: 'mega',
    colors: ['#b02828', '#f08870', '#c0c0c8'],
    ability: 'Technician',
    effect: { kind: 'stats' },
    stats: { might: 0.25, cooldown: -0.15, armor: 1 },
    special: 'bulletPunch',
  },
  houndoom: {
    line: 'houndour',
    name: 'Mega Houndoom',
    stone: 'Houndoominite',
    form: 'mega',
    colors: ['#383038', '#a8a0a0', '#e86028'],
    ability: 'Solar Power',
    effect: { kind: 'stats' },
    stats: { might: 0.35, typeDamage: { fire: 0.2 }, statusDamage: 0.2 },
    special: 'fieryWrath',
  },
  tyranitar: {
    line: 'larvitar',
    name: 'Mega Tyranitar',
    stone: 'Tyranitarite',
    form: 'mega',
    colors: ['#4c6c38', '#b0d080', '#e8e0b0'],
    ability: 'Sand Stream',
    effect: { kind: 'weather', weather: 'sand' },
    stats: { maxHp: 60, armor: 3, might: 0.2 },
    special: 'stoneEdge',
  },
  sceptile: {
    line: 'treecko',
    name: 'Mega Sceptile',
    stone: 'Sceptilite',
    form: 'mega',
    colors: ['#287838', '#88d068', '#d83838'],
    ability: 'Lightning Rod',
    effect: { kind: 'stats' },
    stats: { speed: 12, might: 0.2, typeDamage: { grass: 0.2, dragon: 0.2 } },
    special: 'dragonClaw',
  },
  blaziken: {
    line: 'torchic',
    name: 'Mega Blaziken',
    stone: 'Blazikenite',
    form: 'mega',
    colors: ['#b82820', '#f89058', '#f8d860'],
    ability: 'Speed Boost',
    effect: { kind: 'stats' },
    stats: { speed: 16, might: 0.25, cooldown: -0.1 },
    special: 'blazeKick',
  },
  swampert: {
    line: 'mudkip',
    name: 'Mega Swampert',
    stone: 'Swampertite',
    form: 'mega',
    colors: ['#3868b0', '#98c8f0', '#f08838'],
    ability: 'Swift Swim',
    effect: { kind: 'weather', weather: 'rain' },
    stats: { maxHp: 50, might: 0.25, speed: 8 },
    special: 'muddyWater',
  },
  gardevoir: {
    line: 'ralts',
    name: 'Mega Gardevoir',
    stone: 'Gardevoirite',
    form: 'mega',
    colors: ['#38985a', '#b8f0c8', '#f06888'],
    ability: 'Pixilate',
    effect: { kind: 'stats' },
    stats: { might: 0.15, typeDamage: { normal: 0.3, fairy: 0.3 }, regen: 1.5 },
    special: 'moonblast',
  },
  /** Only for the runs that took Kirlia to Gallade (`MEGA_BRANCH` in `data/branches.ts`); Mega Gardevoir is the other branch's. */
  gallade: {
    line: 'ralts',
    name: 'Mega Gallade',
    stone: 'Galladite',
    form: 'mega',
    colors: ['#3a8a5a', '#d8f0e0', '#e84848'],
    ability: 'Inner Focus',
    effect: { kind: 'stats' },
    stats: { might: 0.3, speed: 8, typeDamage: { fighting: 0.25 } },
    special: 'auraStorm',
  },
  aggron: {
    line: 'aron',
    name: 'Mega Aggron',
    stone: 'Aggronite',
    form: 'mega',
    colors: ['#606878', '#c8d0d8', '#3858a8'],
    ability: 'Filter',
    effect: { kind: 'stats' },
    stats: { damageTaken: -0.25, armor: 3, might: 0.15 },
    special: 'heavySlam',
  },
  manectric: {
    line: 'electrike',
    name: 'Mega Manectric',
    stone: 'Manectite',
    form: 'mega',
    colors: ['#3878a0', '#90d0e8', '#f8d838'],
    ability: 'Intimidate',
    effect: { kind: 'aura', radius: 80, every: 0.5, status: { kind: 'slow', chance: 1, duration: 0.6, power: 0.3 } },
    stats: { speed: 12, might: 0.2, cooldown: -0.05 },
    special: 'wildCharge',
  },
  altaria: {
    line: 'swablu',
    name: 'Mega Altaria',
    stone: 'Altarianite',
    form: 'mega',
    colors: ['#58a8e0', '#e8f8ff', '#f878a8'],
    ability: 'Pixilate',
    effect: { kind: 'stats' },
    stats: { maxHp: 30, regen: 1, typeDamage: { normal: 0.3, fairy: 0.3, dragon: 0.2 } },
    special: 'hyperVoice',
  },
  banette: {
    line: 'shuppet',
    name: 'Mega Banette',
    stone: 'Banettite',
    form: 'mega',
    colors: ['#383048', '#a090b8', '#f8d040'],
    ability: 'Prankster',
    effect: { kind: 'stats' },
    stats: { cooldown: -0.2, statusChance: 0.1, might: 0.15 },
    special: 'phantomForce',
  },
  glalie: {
    line: 'snorunt',
    name: 'Mega Glalie',
    stone: 'Glalitite',
    form: 'mega',
    colors: ['#5888b0', '#d0f0f8', '#283848'],
    ability: 'Refrigerate',
    effect: { kind: 'stats' },
    stats: { might: 0.25, typeDamage: { normal: 0.3, ice: 0.3 } },
    special: 'sheerCold',
  },
  salamence: {
    line: 'bagon',
    name: 'Mega Salamence',
    stone: 'Salamencite',
    form: 'mega',
    colors: ['#2860a0', '#88b8e8', '#e03838'],
    ability: 'Aerilate',
    effect: { kind: 'stats' },
    stats: { speed: 12, might: 0.25, typeDamage: { normal: 0.3, flying: 0.3 } },
    special: 'doubleEdge',
  },
  metagross: {
    line: 'beldum',
    name: 'Mega Metagross',
    stone: 'Metagrossite',
    form: 'mega',
    colors: ['#385890', '#a8c0e0', '#e8e8f0'],
    ability: 'Tough Claws',
    effect: { kind: 'stats' },
    stats: { might: 0.3, armor: 2, speed: 6 },
    special: 'meteorMash',
  },
  latias: {
    line: 'latias',
    name: 'Mega Latias',
    stone: 'Latiasite',
    form: 'mega',
    colors: ['#c83848', '#f8a8b8', '#f8f8f8'],
    ability: 'Levitate',
    effect: { kind: 'stats' },
    stats: { maxHp: 30, damageTaken: -0.15, might: 0.25 },
    special: 'scaleShot',
  },
  latios: {
    line: 'latios',
    name: 'Mega Latios',
    stone: 'Latiosite',
    form: 'mega',
    colors: ['#3858b8', '#a8c0f8', '#f8f8f8'],
    ability: 'Levitate',
    effect: { kind: 'stats' },
    stats: { might: 0.35, speed: 8, projectileSpeed: 0.2 },
    special: 'dragonClaw',
  },
  staraptor: {
    line: 'starly',
    name: 'Mega Staraptor',
    stone: 'Staraptite',
    form: 'mega',
    colors: ['#504848', '#b0a8a0', '#e84030'],
    ability: 'Contrary',
    effect: { kind: 'stats' },
    stats: { might: 0.3, speed: 10 },
    special: 'skyAttack',
  },
  garchomp: {
    line: 'gible',
    name: 'Mega Garchomp',
    stone: 'Garchompite',
    form: 'mega',
    colors: ['#384878', '#8898d0', '#e84838'],
    ability: 'Sand Force',
    effect: { kind: 'stats' },
    stats: { might: 0.3, armor: 1, typeDamage: { ground: 0.3, rock: 0.3, steel: 0.3 } },
    special: 'earthPower',
  },
  garchompZ: {
    line: 'gible',
    name: 'Mega Garchomp Z',
    stone: 'Garchompite Z',
    form: 'megaZ',
    colors: ['#283058', '#6878b8', '#f8c040'],
    ability: 'Levitate',
    effect: { kind: 'stats' },
    stats: { speed: 14, cooldown: -0.15, might: 0.15 },
    special: 'scaleShot',
  },
  lucario: {
    line: 'riolu',
    name: 'Mega Lucario',
    stone: 'Lucarionite',
    form: 'mega',
    colors: ['#2858a0', '#a8c8f8', '#202028'],
    ability: 'Adaptability',
    effect: { kind: 'stats' },
    stats: { speed: 10, typeDamage: { fighting: 0.35, steel: 0.35 } },
    special: 'auraStorm',
  },
  lucarioZ: {
    line: 'riolu',
    name: 'Mega Lucario Z',
    stone: 'Lucarionite Z',
    form: 'megaZ',
    colors: ['#203868', '#7898d8', '#f8d848'],
    ability: 'Aura Guard',
    effect: { kind: 'stats' },
    stats: { armor: 2, damageTaken: -0.2, typeDamage: { fighting: 0.25, steel: 0.25 } },
    special: 'focusBlast',
  },
  emboar: {
    line: 'tepig',
    name: 'Mega Emboar',
    stone: 'Emboarite',
    form: 'mega',
    colors: ['#a02818', '#f08848', '#282020'],
    ability: 'Mold Breaker',
    effect: { kind: 'stats' },
    stats: { might: 0.35, maxHp: 40 },
    special: 'heatCrash',
  },
  chesnaught: {
    line: 'chespin',
    name: 'Mega Chesnaught',
    stone: 'Chesnaughtite',
    form: 'mega',
    colors: ['#587038', '#c0d890', '#a86838'],
    ability: 'Bulletproof',
    effect: { kind: 'stats' },
    stats: { damageTaken: -0.3, armor: 2, maxHp: 50 },
    special: 'spikyShield',
  },
  delphox: {
    line: 'fennekin',
    name: 'Mega Delphox',
    stone: 'Delphoxite',
    form: 'mega',
    colors: ['#b83830', '#f8a868', '#f8e068'],
    ability: 'Levitate',
    effect: { kind: 'stats' },
    stats: { cooldown: -0.15, might: 0.2, area: 0.15 },
    special: 'mysticalFire',
  },
  greninja: {
    line: 'froakie',
    name: 'Mega Greninja',
    stone: 'Greninjite',
    form: 'mega',
    colors: ['#204878', '#78a8e0', '#f070a0'],
    ability: 'Protean',
    effect: { kind: 'stats' },
    stats: { might: 0.3, speed: 8, cooldown: -0.1 },
    special: 'nightSlash',
  },
} as const satisfies Record<string, MegaDef>

export type MegaId = keyof typeof MEGAS

export const MEGA_IDS = Object.keys(MEGAS) as MegaId[]

/** The lines with a Mega Evolution. */
export type MegaLine = (typeof MEGAS)[MegaId]['line']

export const MEGA_LINES = [...new Set(MEGA_IDS.map((id) => MEGAS[id].line))]

/** The Mega Evolutions of a line, in data order (empty for the lines without one). Charizard, Raichu, Garchomp and Lucario have two. */
export const megasOf = (line: PlayableId): readonly MegaId[] => MEGA_IDS.filter((id) => MEGAS[id].line === line)

/** Timing and the burst of a Mega Evolution, in seconds and world px. */
export const MEGA = {
  /** How long the Mega form lasts. */
  duration: 20,
  /** Seconds after it ends before the next Mega Evolution (the cooldown stat doesn't touch it). */
  recharge: 60,
  /** The transformation: the simulation waits this long while the keystone energy wraps the Pokémon. */
  intro: 1.1,
  /** Invulnerability once it lands, so the horde doesn't eat the moment. */
  iframes: 1.5,
  /** The rainbow burst at the end of the transformation: reach, power (scaled like the special) and push. */
  wave: { radius: 100, power: 50, knockback: 320 },
} as const
