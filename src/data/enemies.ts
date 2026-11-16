import { ROSTER, type Tier } from './roster'
import { HIDEOUT_BOSSES } from './rocketHideoutFoes'
import type { TraitId } from './traits'
import type { PokeType } from './types'

export type EnemyDef = {
  dex: number
  name: string
  types: readonly PokeType[]
  hp: number
  /** px/s */
  speed: number
  /** contact damage */
  damage: number
  xp: number
  /** knockback resistance; 1 = normal */
  mass: number
  boss?: boolean
  /** Legendary bosses get the big entrance (flash, banner) and attack patterns from `data/bosses.ts`. */
  legendary?: boolean
  /** Wild species with a tier can be drawn into a run's horde (see `game/roster.ts`); bosses have none. */
  tier?: Tier
  /** Behavior on top of chasing (healer, shield, summoner, kamikaze, beam, leaper). See `data/traits.ts`. */
  trait?: TraitId
  /** Integer draw scale (and body size) for Pokémon that must loom over the rest, like the reaper. */
  scale?: number
  /**
   * Relative odds (0..1] of being drawn into a run's cast against the rest of its tier (`drawRoster`),
   * from the species' capture rate (`rarityOf` in `data/roster.ts`): Rattata 1, Dratini 0.35. Missing = 1.
   */
  rarity?: number
}

/**
 * Stats of the three legendary trio slots (7:00, 9:30, 12:00). They belong to
 * the slot, not the species: whichever trio a run draws fights at the same strength.
 */
const TRIO_SLOTS = [
  { hp: 5200, speed: 46, damage: 26, xp: 150, mass: 30, boss: true, legendary: true },
  { hp: 8000, speed: 50, damage: 30, xp: 200, mass: 30, boss: true, legendary: true },
  { hp: 11500, speed: 54, damage: 34, xp: 250, mass: 30, boss: true, legendary: true },
] as const

/**
 * Stats of the Noite das Bruxas night boss slots (`HALLOWEEN.bosses`): Onix's
 * at 2:30 and Snorlax's at 5:00, as strong as the boss they stand in for. Like
 * the trio slots, they belong to the slot: only the pace is the species'.
 */
const NIGHT_SLOTS = [
  { hp: 1100, damage: 18, xp: 50, mass: 20, boss: true },
  { hp: 2800, damage: 24, xp: 90, mass: 30, boss: true },
] as const

/** A Tera Raid's giant (`data/tera.ts`), before its stars and the run clock: slow, heavy and twice the size. */
const RAID_GIANT = { hp: 14000, speed: 20, damage: 24, xp: 0, mass: 60, boss: true, scale: 2 } as const

/** Stats of the rare mythical that may join Mewtwo at the end. */
const MYTHICAL = { hp: 9000, speed: 70, damage: 30, xp: 300, mass: 40, boss: true, legendary: true } as const

/**
 * Every enemy: the generated wild roster (`data/roster.ts`) plus the hand-tuned
 * bosses. An entry here with the same key as a roster species replaces it, and
 * any entry with a `tier` joins the horde draw.
 */
export const ENEMIES = {
  ...ROSTER,
  // Species with a behavior trait (`data/traits.ts`): hand-tuned, with the tier matching when they used to show up.
  voltorb: { dex: 100, name: 'Voltorb', types: ['electric'], hp: 20, speed: 50, damage: 9, xp: 2, mass: 0.9, trait: 'kamikaze', tier: 2 },
  electrode: { dex: 101, name: 'Electrode', types: ['electric'], hp: 42, speed: 62, damage: 12, xp: 4, mass: 1, trait: 'kamikaze', tier: 5 },
  magnemite: { dex: 81, name: 'Magnemite', types: ['electric', 'steel'], hp: 26, speed: 34, damage: 8, xp: 3, mass: 1, trait: 'beam', tier: 2 },
  chansey: { dex: 113, name: 'Chansey', types: ['normal'], hp: 70, speed: 26, damage: 6, xp: 5, mass: 1.8, trait: 'healer', tier: 3 },
  hitmonlee: { dex: 106, name: 'Hitmonlee', types: ['fighting'], hp: 50, speed: 40, damage: 12, xp: 4, mass: 1.4, trait: 'leaper', tier: 3 },
  bronzong: { dex: 437, name: 'Bronzong', types: ['steel', 'psychic'], hp: 80, speed: 24, damage: 10, xp: 6, mass: 2.8, trait: 'shield', tier: 4 },
  nidoqueen: { dex: 31, name: 'Nidoqueen', types: ['poison', 'ground'], hp: 110, speed: 28, damage: 14, xp: 8, mass: 2.4, trait: 'summoner', tier: 5 },
  // Roster species whose look fits a trait keep their derived stats.
  bronzor: { ...ROSTER.bronzor, trait: 'shield' },
  drifloon: { ...ROSTER.drifloon, trait: 'kamikaze' },
  lokix: { ...ROSTER.lokix, trait: 'leaper' },
  vikavolt: { ...ROSTER.vikavolt, trait: 'beam' },
  nidoranF: { dex: 29, name: 'Nidoran♀', types: ['poison'], hp: 16, speed: 46, damage: 6, xp: 1, mass: 0.9 },
  nidoranM: { dex: 32, name: 'Nidoran♂', types: ['poison'], hp: 16, speed: 48, damage: 7, xp: 1, mass: 0.9 },
  onix: { dex: 95, name: 'Onix', types: ['rock', 'ground'], hp: 1100, speed: 36, damage: 18, xp: 50, mass: 20, boss: true },
  snorlax: { dex: 143, name: 'Snorlax', types: ['normal'], hp: 2800, speed: 30, damage: 24, xp: 90, mass: 30, boss: true },
  // The legendary trios (`TRIOS` in `data/waves.ts`): each member wears its slot's stats, so every draw is as hard.
  articuno: { dex: 144, name: 'Articuno', types: ['ice', 'flying'], ...TRIO_SLOTS[0] },
  zapdos: { dex: 145, name: 'Zapdos', types: ['electric', 'flying'], ...TRIO_SLOTS[1] },
  moltres: { dex: 146, name: 'Moltres', types: ['fire', 'flying'], ...TRIO_SLOTS[2] },
  raikou: { dex: 243, name: 'Raikou', types: ['electric'], ...TRIO_SLOTS[0] },
  entei: { dex: 244, name: 'Entei', types: ['fire'], ...TRIO_SLOTS[1] },
  suicune: { dex: 245, name: 'Suicune', types: ['water'], ...TRIO_SLOTS[2] },
  regirock: { dex: 377, name: 'Regirock', types: ['rock'], ...TRIO_SLOTS[0] },
  regice: { dex: 378, name: 'Regice', types: ['ice'], ...TRIO_SLOTS[1] },
  registeel: { dex: 379, name: 'Registeel', types: ['steel'], ...TRIO_SLOTS[2] },
  // The rare finale guests (`MYTHICALS` in `data/waves.ts`), all on the same stats.
  mew: { dex: 151, name: 'Mew', types: ['psychic'], ...MYTHICAL },
  celebi: { dex: 251, name: 'Celebi', types: ['psychic', 'grass'], ...MYTHICAL },
  jirachi: { dex: 385, name: 'Jirachi', types: ['steel', 'psychic'], ...MYTHICAL },
  mewtwo: { dex: 150, name: 'Mewtwo', types: ['psychic'], hp: 22000, speed: 62, damage: 45, xp: 0, mass: 50, boss: true, legendary: true },
  // The Regi trio's maker, out of its temple (`game/pathRun.ts`): above the last trio slot, as it wakes from 4:00 on.
  regigigas: { dex: 486, name: 'Regigigas', types: ['normal'], hp: 13000, speed: 44, damage: 34, xp: 300, mass: 60, boss: true, legendary: true },
  // Rift legendaries (`data/rifts.ts`): HP and contact damage are their 3:30 values, scaled by `riftScale`.
  lugia: { dex: 249, name: 'Lugia', types: ['psychic', 'flying'], hp: 3400, speed: 56, damage: 28, xp: 0, mass: 40, boss: true, legendary: true },
  hoOh: { dex: 250, name: 'Ho-Oh', types: ['fire', 'flying'], hp: 3400, speed: 56, damage: 30, xp: 0, mass: 40, boss: true, legendary: true },
  kyogre: { dex: 382, name: 'Kyogre', types: ['water'], hp: 3800, speed: 44, damage: 28, xp: 0, mass: 40, boss: true, legendary: true },
  groudon: { dex: 383, name: 'Groudon', types: ['ground'], hp: 4200, speed: 38, damage: 32, xp: 0, mass: 40, boss: true, legendary: true },
  rayquaza: { dex: 384, name: 'Rayquaza', types: ['dragon', 'flying'], hp: 3000, speed: 66, damage: 30, xp: 0, mass: 40, boss: true, legendary: true },
  dialga: { dex: 483, name: 'Dialga', types: ['steel', 'dragon'], hp: 3600, speed: 46, damage: 30, xp: 0, mass: 40, boss: true, legendary: true },
  latias: { dex: 380, name: 'Latias', types: ['dragon', 'psychic'], hp: 3200, speed: 64, damage: 28, xp: 0, mass: 40, boss: true, legendary: true },
  latios: { dex: 381, name: 'Latios', types: ['dragon', 'psychic'], hp: 3200, speed: 66, damage: 30, xp: 0, mass: 40, boss: true, legendary: true },
  deoxys: { dex: 386, name: 'Deoxys', types: ['psychic'], hp: 2800, speed: 70, damage: 32, xp: 0, mass: 40, boss: true, legendary: true },
  palkia: { dex: 484, name: 'Palkia', types: ['water', 'dragon'], hp: 3600, speed: 50, damage: 30, xp: 0, mass: 40, boss: true, legendary: true },
  // The roaming lake trio (`game/roamers.ts`): HP at 3:30, scaled by `riftScale` as each visit starts; the share left carries from run to run.
  uxie: { dex: 480, name: 'Uxie', types: ['psychic'], hp: 2600, speed: 66, damage: 22, xp: 0, mass: 30, boss: true, legendary: true },
  mesprit: { dex: 481, name: 'Mesprit', types: ['psychic'], hp: 2600, speed: 70, damage: 22, xp: 0, mass: 30, boss: true, legendary: true },
  azelf: { dex: 482, name: 'Azelf', types: ['psychic'], hp: 2600, speed: 64, damage: 26, xp: 0, mass: 30, boss: true, legendary: true },
  // The Swords of Justice, in their duels (`game/duels.ts`), and Keldeo (only Hoopa's rings bring it back to fight).
  cobalion: { dex: 638, name: 'Cobalion', types: ['steel', 'fighting'], hp: 3400, speed: 52, damage: 26, xp: 0, mass: 36, boss: true, legendary: true },
  terrakion: { dex: 639, name: 'Terrakion', types: ['rock', 'fighting'], hp: 3000, speed: 50, damage: 30, xp: 0, mass: 38, boss: true, legendary: true },
  virizion: { dex: 640, name: 'Virizion', types: ['grass', 'fighting'], hp: 2600, speed: 70, damage: 26, xp: 0, mass: 32, boss: true, legendary: true },
  keldeo: { dex: 647, name: 'Keldeo', types: ['water', 'fighting'], hp: 2800, speed: 62, damage: 28, xp: 0, mass: 30, boss: true, legendary: true },
  // Hoopa, the last of its own rings (`game/rush.ts`).
  hoopa: { dex: 720, name: 'Hoopa', types: ['psychic', 'ghost'], hp: 4200, speed: 54, damage: 30, xp: 0, mass: 40, boss: true, legendary: true },
  // The Ruínas da Decisão's Regis (`game/splitRuins.ts`): about Regigigas's size, as they wake from the same times; Regieleki fast and frail, Regidrago slow and huge.
  regieleki: { dex: 894, name: 'Regieleki', types: ['electric'], hp: 10000, speed: 74, damage: 30, xp: 300, mass: 50, boss: true, legendary: true },
  regidrago: { dex: 895, name: 'Regidrago', types: ['dragon'], hp: 14500, speed: 36, damage: 36, xp: 300, mass: 60, boss: true, legendary: true },
  // The Forces of Nature, roaming with their weather (`data/forces.ts`): like the lake trio, HP at 3:30 scaled by `riftScale` as each visit starts.
  tornadus: { dex: 641, name: 'Tornadus', types: ['flying'], hp: 2800, speed: 76, damage: 24, xp: 0, mass: 32, boss: true, legendary: true },
  thundurus: { dex: 642, name: 'Thundurus', types: ['electric', 'flying'], hp: 2800, speed: 68, damage: 26, xp: 0, mass: 32, boss: true, legendary: true },
  landorus: { dex: 645, name: 'Landorus', types: ['ground', 'flying'], hp: 3200, speed: 58, damage: 30, xp: 0, mass: 36, boss: true, legendary: true },
  enamorus: { dex: 905, name: 'Enamorus', types: ['fairy', 'flying'], hp: 3000, speed: 70, damage: 26, xp: 0, mass: 32, boss: true, legendary: true },
  // The Noite das Bruxas' event rift (`EVENT_RIFTS`): Darkrai, and the shadow clones of its Nightmare (`game/darkraiDomain.ts`), which vanish at a hit and give nothing.
  darkrai: { dex: 491, name: 'Darkrai', types: ['dark'], hp: 3400, speed: 58, damage: 30, xp: 0, mass: 40, boss: true, legendary: true },
  darkraiShade: { dex: 491, name: 'Darkrai', types: ['dark'], hp: 1, speed: 46, damage: 16, xp: 0, mass: 40 },
  // The Ultra Wormholes' beasts (`data/ultraBeasts.ts`), fought in their Ultra Space domains (`data/domains/ultra.ts`).
  nihilego: { dex: 793, name: 'Nihilego', types: ['rock', 'poison'], hp: 2000, speed: 44, damage: 26, xp: 0, mass: 40, boss: true, legendary: true },
  buzzwole: { dex: 794, name: 'Buzzwole', types: ['bug', 'fighting'], hp: 2200, speed: 50, damage: 30, xp: 0, mass: 40, boss: true, legendary: true },
  pheromosa: { dex: 795, name: 'Pheromosa', types: ['bug', 'fighting'], hp: 1700, speed: 76, damage: 26, xp: 0, mass: 40, boss: true, legendary: true },
  xurkitree: { dex: 796, name: 'Xurkitree', types: ['electric'], hp: 1900, speed: 44, damage: 26, xp: 0, mass: 40, boss: true, legendary: true },
  celesteela: { dex: 797, name: 'Celesteela', types: ['steel', 'flying'], hp: 2300, speed: 48, damage: 28, xp: 0, mass: 40, boss: true, legendary: true },
  kartana: { dex: 798, name: 'Kartana', types: ['grass', 'steel'], hp: 1700, speed: 70, damage: 30, xp: 0, mass: 40, boss: true, legendary: true },
  guzzlord: { dex: 799, name: 'Guzzlord', types: ['dark', 'dragon'], hp: 2600, speed: 36, damage: 30, xp: 0, mass: 40, boss: true, legendary: true },
  stakataka: { dex: 805, name: 'Stakataka', types: ['rock', 'steel'], hp: 2400, speed: 30, damage: 28, xp: 0, mass: 40, boss: true, legendary: true },
  blacephalon: { dex: 806, name: 'Blacephalon', types: ['fire', 'ghost'], hp: 1800, speed: 56, damage: 28, xp: 0, mass: 40, boss: true, legendary: true },
  naganadel: { dex: 804, name: 'Naganadel', types: ['poison', 'dragon'], hp: 2000, speed: 64, damage: 28, xp: 0, mass: 40, boss: true, legendary: true },
  // Deoxys's retinue in its domain (`data/domains/deoxys.ts`), never in the horde (no tier).
  beldum: { dex: 374, name: 'Beldum', types: ['steel', 'psychic'], hp: 20, speed: 44, damage: 10, xp: 2, mass: 1.8 },
  metang: { dex: 375, name: 'Metang', types: ['steel', 'psychic'], hp: 60, speed: 40, damage: 13, xp: 5, mass: 2.6 },
  // A place's boss (`data/places.ts`): HP and contact damage are its 1:30 values, scaled by `placeBossScale`.
  // The Rocket Hideout's lair (`data/rocketHideout.ts`): Giovanni's Persian and Shadow Mewtwo, place bosses scaled by `placeBossScale`.
  ...HIDEOUT_BOSSES,
  spiritomb: { dex: 442, name: 'Spiritomb', types: ['ghost', 'dark'], hp: 1100, speed: 34, damage: 18, xp: 0, mass: 30, boss: true },
  // The hidden zones' own (`hidden` in `data/places.ts`), never in the horde (no tier): Audino out of the grotto's
  // shaking grass, shy and gone in a while. Its EXP is set as it comes out (`luckyXp`).
  audino: { dex: 531, name: 'Audino', types: ['normal'], hp: 60, speed: 34, damage: 4, xp: 0, mass: 1.6 },
  // The Noite das Bruxas night bosses (`HALLOWEEN.bosses` in `data/halloween.ts`), apart from the horde's own of the species: one per slot each haunted run.
  mimikyuBoss: { dex: 778, name: 'Mimikyu', types: ['ghost', 'fairy'], speed: 40, ...NIGHT_SLOTS[0] },
  banetteBoss: { dex: 354, name: 'Banette', types: ['ghost'], speed: 38, ...NIGHT_SLOTS[0] },
  sableyeBoss: { dex: 302, name: 'Sableye', types: ['dark', 'ghost'], speed: 40, ...NIGHT_SLOTS[0] },
  drifblimBoss: { dex: 426, name: 'Drifblim', types: ['ghost', 'flying'], speed: 30, ...NIGHT_SLOTS[0] },
  mismagiusBoss: { dex: 429, name: 'Mismagius', types: ['ghost'], speed: 38, ...NIGHT_SLOTS[0] },
  houndoomBoss: { dex: 229, name: 'Houndoom', types: ['dark', 'fire'], speed: 44, ...NIGHT_SLOTS[0] },
  gengarBoss: { dex: 94, name: 'Gengar', types: ['ghost', 'poison'], speed: 36, ...NIGHT_SLOTS[1] },
  chandelureBoss: { dex: 609, name: 'Chandelure', types: ['ghost', 'fire'], speed: 30, ...NIGHT_SLOTS[1] },
  gourgeistBoss: { dex: 711, name: 'Gourgeist', types: ['ghost', 'grass'], speed: 30, ...NIGHT_SLOTS[1] },
  trevenantBoss: { dex: 709, name: 'Trevenant', types: ['ghost', 'grass'], speed: 28, ...NIGHT_SLOTS[1] },
  honchkrowBoss: { dex: 430, name: 'Honchkrow', types: ['dark', 'flying'], speed: 38, ...NIGHT_SLOTS[1] },
  dusknoirBoss: { dex: 477, name: 'Dusknoir', types: ['ghost'], speed: 30, ...NIGHT_SLOTS[1] },
  // The Tera Raids' giants (`RAID_BOSSES` in `data/tera.ts`): drawn twice the size in crystal, their Tera type set as they come
  // out (`game/teraRaid.ts`), stats tuned for a 4★ den at 8:10 and scaled by the stars and the run clock (`raidScale`).
  raidCharizard: { dex: 6, name: 'Charizard', types: ['fire', 'flying'], ...RAID_GIANT },
  raidBlastoise: { dex: 9, name: 'Blastoise', types: ['water'], ...RAID_GIANT },
  raidVenusaur: { dex: 3, name: 'Venusaur', types: ['grass', 'poison'], ...RAID_GIANT },
  raidGengar: { dex: 94, name: 'Gengar', types: ['ghost', 'poison'], ...RAID_GIANT },
  raidGyarados: { dex: 130, name: 'Gyarados', types: ['water', 'flying'], ...RAID_GIANT },
  raidDragonite: { dex: 149, name: 'Dragonite', types: ['dragon', 'flying'], ...RAID_GIANT },
  raidTyranitar: { dex: 248, name: 'Tyranitar', types: ['rock', 'dark'], ...RAID_GIANT },
  raidGardevoir: { dex: 282, name: 'Gardevoir', types: ['psychic', 'fairy'], ...RAID_GIANT },
  raidMetagross: { dex: 376, name: 'Metagross', types: ['steel', 'psychic'], ...RAID_GIANT },
  raidGarchomp: { dex: 445, name: 'Garchomp', types: ['dragon', 'ground'], ...RAID_GIANT },
  raidLucario: { dex: 448, name: 'Lucario', types: ['fighting', 'steel'], ...RAID_GIANT },
  raidHydreigon: { dex: 635, name: 'Hydreigon', types: ['dark', 'dragon'], ...RAID_GIANT },
  raidVolcarona: { dex: 637, name: 'Volcarona', types: ['bug', 'fire'], ...RAID_GIANT },
  raidDragapult: { dex: 887, name: 'Dragapult', types: ['dragon', 'ghost'], ...RAID_GIANT },
  raidTinkaton: { dex: 959, name: 'Tinkaton', types: ['fairy', 'steel'], ...RAID_GIANT },
  // The 7★ Stellar raid's giant, captured by beating it once (`LEGENDS.terapagos`).
  terapagos: { dex: 1024, name: 'Terapagos', types: ['normal'], ...RAID_GIANT, hp: 16000, damage: 30, legendary: true },
  // The Grande Atualização's mythicals (`data/mythicals.ts`): Ogerpon's own Tera Raid (in the mask of the run's Tera type),
  // and Zeraora, out of the Power Plant's storm. Each captured with one win.
  ogerpon: { dex: 1017, name: 'Ogerpon', types: ['grass'], ...RAID_GIANT, hp: 14000, damage: 26, legendary: true },
  zeraora: { dex: 807, name: 'Zeraora', types: ['electric'], hp: 4000, speed: 64, damage: 28, xp: 200, mass: 30, boss: true, legendary: true },
  // The endless mode's reaper (`game/endless.ts`): it hunts the player from 20:00.
  arceus: { dex: 493, name: 'Arceus', types: ['normal'], hp: 300000, speed: 60, damage: 90, xp: 0, mass: 999, boss: true, legendary: true, scale: 2 },
} as const satisfies Record<string, EnemyDef>

export type EnemyId = keyof typeof ENEMIES
