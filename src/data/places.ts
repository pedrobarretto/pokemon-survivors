import type { StatDelta } from '../game/stats'
import type { BiomeId } from './biomes'
import type { Drop } from './consumables'
import type { EnemyId } from './enemies'
import type { ThemeId } from './music'
import { SOLID_FOOT, type Ellipse } from './terrain'

/**
 * Places: structures found on the map (a cave mouth, a graveyard gate, an
 * updraft) that lead somewhere the player can step into for a short, different
 * run of play: a dark dungeon, a haunted graveyard, the open sky. The entrance
 * side lives in `game/placeEntrance.ts`, the inside in `game/placeInterior.ts`
 * and each place's rules in its own module (`game/cave.ts`, `game/graveyard.ts`,
 * `game/sky.ts`). Names and lines live in `i18n` (`places`).
 *
 * Hidden zones (`hidden` below: the Hidden Grotto, the Underground) are places
 * too, the other way round: no arrow and no news. At most one a run, from the
 * run's seed (`game/hidden.ts`), its entrance shows up just ahead of the player
 * looking like scenery with a tell (rustling leaves, a glint), and only
 * walking up to it finds it.
 */
export const PLACE_IDS = ['cave', 'graveyard', 'sky', 'grotto', 'underground'] as const

export type PlaceId = (typeof PLACE_IDS)[number]

/** A hidden zone's lucky Pokémon: [species, weight, base EXP]. Shy, they pop out of the zone's spots and are worth far more than the horde (`luckyXp`). */
export type LuckyEntry = readonly [EnemyId, number, number]

/** What makes a place a hidden zone: who pops out of its spots, and its rare dweller, found nowhere else. */
export type HiddenDef = { lucky: readonly LuckyEntry[]; rare: EnemyId }

export type PlaceDef = {
  /** Seconds inside before the place throws the player back out (the wind, the dawn, the calm). */
  time: number
  /** Who lives there, weak to strong: the run's current stage picks the tiers that come out (`placePool`). */
  species: readonly EnemyId[]
  /** Spawns per second and how many may be alive at once. */
  spawn: { rate: number; max: number }
  /** Odds of this place while the run is in each biome (missing = 1). */
  biomes: Partial<Record<BiomeId, number>>
  /** Only a Flying type can go (the sky): the director never offers it to anyone else. */
  flyers?: true
  /** Radius of the entrance's door (px): standing in it for `PLACE.enterTime` steps in. */
  door: number
  /** Music while inside. */
  theme: ThemeId
  /** A hidden zone (`game/hidden.ts`): never on the schedule, never announced. */
  hidden?: HiddenDef
}

export const PLACES = {
  /** A Mystery Dungeon: dark floors of rooms and corridors, stairs down, a treasure at the bottom. */
  cave: {
    time: 100,
    species: ['zubat', 'diglett', 'geodude', 'roggenrola', 'sableye', 'aron', 'graveler', 'golbat', 'dugtrio', 'golem', 'crobat', 'excadrill'],
    spawn: { rate: 0.9, max: 14 },
    biomes: { cave: 3, meadow: 1.5 },
    door: 12,
    theme: 'cave',
  },
  /** A graveyard in the fog: ghosts rise from the graves, their spirits wake the Odd Keystone and Spiritomb. */
  graveyard: {
    time: 90,
    species: ['gastly', 'duskull', 'shuppet', 'litwick', 'sableye', 'drifloon', 'lampent', 'haunter', 'misdreavus', 'dusclops', 'banette', 'gengar', 'chandelure'],
    spawn: { rate: 1.7, max: 24 },
    biomes: { tower: 3, forest: 1.5 },
    door: 12,
    theme: 'tower',
  },
  /** Above the clouds, for Flying types only: flocks cross the sky and wings drift on the wind. */
  sky: {
    time: 50,
    species: ['pidgey', 'spearow', 'starly', 'taillow', 'swablu', 'staravia', 'pidgeotto', 'swellow', 'fearow', 'skarmory', 'staraptor', 'pidgeot', 'altaria'],
    spawn: { rate: 1.1, max: 14 },
    biomes: {},
    flyers: true,
    // The whole updraft lifts: walking across its middle is enough.
    door: 22,
    theme: 'snow',
  },
  /**
   * Black 2 and White 2's Hidden Grotto: a gap in a thicket opens on a
   * clearing where Audino pop out of shaking grass (Black and White's best
   * EXP), an item lies in the grass and, now and then, Shaymin walks among the
   * Gracidea.
   */
  grotto: {
    time: 45,
    species: ['sunkern', 'hoppip', 'seedot', 'oddish', 'paras', 'shroomish', 'skiploom', 'gloom', 'nuzleaf', 'breloom', 'jumpluff', 'vileplume', 'shiftry'],
    spawn: { rate: 0.45, max: 6 },
    biomes: { meadow: 3, forest: 3, snow: 1, tower: 0.6, cave: 0.3 },
    door: 10,
    theme: 'forest',
    hidden: {
      lucky: [
        ['audino', 80, 12],
        ['chansey', 15, 24],
        ['blissey', 5, 40],
      ],
      rare: 'shaymin',
    },
  },
  /**
   * Diamond and Pearl's Underground: a crack in a boulder leads down to a dig
   * site where glints in the walls hide spheres, candies, evolution stones and
   * Old Amber, Diglett pop up out of their holes, and the walls crack with
   * every dig. Deep inside, Diancie sparkles now and then.
   */
  underground: {
    time: 45,
    species: ['sandshrew', 'geodude', 'trapinch', 'cubone', 'nosepass', 'mawile', 'sableye', 'graveler', 'marowak', 'sandslash', 'sudowoodo', 'golem', 'shuckle'],
    spawn: { rate: 0.5, max: 6 },
    biomes: { cave: 4, snow: 1.2, tower: 1, meadow: 0.5, forest: 0.5 },
    door: 10,
    theme: 'cave',
    hidden: {
      lucky: [
        ['diglett', 75, 8],
        ['dugtrio', 25, 20],
      ],
      rare: 'diancie',
    },
  },
} as const satisfies Record<PlaceId, PlaceDef>

/** The places on the schedule (`placeDue`, `pickPlace`), with an arrow and their news. */
export const REGULAR_PLACE_IDS = PLACE_IDS.filter((id) => {
  const def: PlaceDef = PLACES[id]
  return def.hidden === undefined
})

/** The hidden zones' ids: the places with a `hidden`. */
export type HiddenPlaceId = { [K in PlaceId]: (typeof PLACES)[K] extends { hidden: HiddenDef } ? K : never }[PlaceId]

export const isHiddenPlace = (id: PlaceId): id is HiddenPlaceId => {
  const def: PlaceDef = PLACES[id]
  return def.hidden !== undefined
}

/** The hidden zones. */
export const HIDDEN_PLACE_IDS = PLACE_IDS.filter(isHiddenPlace)

/** A hidden zone's definition, or undefined for a regular place. */
export const hiddenOf = (id: PlaceId): HiddenDef | undefined => {
  const def: PlaceDef = PLACES[id]
  return def.hidden
}

/** A hidden zone's own Pokémon: its lucky ones and its rare dweller (none for a regular place). */
export const hiddenCast = (id: PlaceId): EnemyId[] => {
  const h = hiddenOf(id)
  return h ? [...h.lucky.map(([e]) => e), h.rare] : []
}

/**
 * Hidden zones' timing, odds and payouts, in seconds and world px.
 */
export const HIDDEN = {
  /**
   * Share of runs that roll a hidden zone (from the seed). In 40 bot runs that
   * lived to 11:30, every roll found its clear moment (opening from 3:00 to
   * 9:00, most around 5:00 to 8:30); runs that end earlier see fewer, so about
   * a third of all runs see one.
   */
  odds: 0.45,
  /** It's due at a time drawn in [from, until), then waits for a clear moment, but never opens past `last`. */
  from: 170,
  until: 560,
  last: 690,
  /** No wave boss nor rift omen may be due this soon when it opens. */
  clear: 35,
  /** How long the entrance stays open on the map. */
  openTime: 80,
  /** A player this close to its door (px) finds it: the "!" and the news. */
  reveal: 60,
  /** Seconds the title card holds the zone still on the way in. */
  card: 1.4,
  /** A lucky one's EXP grows with the run clock: base × (1 + time / ramp). */
  xpRamp: 150,
  /** Shiny odds inside are this many times the horde's. */
  shinyBoost: 4,
  /** The rare dweller: chance per visit, when it shows up (place age, drawn in [at0, at1]), how long it stays and its EXP (ramped like the lucky ones). */
  rare: { chance: 0.4, at: [7, 17], stay: 15, xp: 70 },
} as const

/** The Hidden Grotto: its shaking grass and Audino. */
export const GROTTO = {
  /** The first patch shakes after `first` s, then one every `every` s; it shakes for `warn` s before its Pokémon pops out, which stays `stay` s. */
  first: 1.5,
  every: 3.6,
  warn: 1.2,
  stay: 7,
} as const

/** The Underground: its holes and Diglett, its glints and the wall. */
export const UNDERGROUND = {
  first: 1.2,
  every: 2.4,
  warn: 0.9,
  /** A Diglett ducks back into its hole after this long: whack it first. */
  stay: 3.2,
  /** Glints in the walls; standing within `digRadius` px of one for `digTime` s digs it, and costs the wall `crack` s. */
  glints: 6,
  digRadius: 16,
  digTime: 1.1,
  crack: 2,
} as const

/** What a glint gives (Diamond and Pearl's Underground): weights of each find. `stone` needs an item the player lacks; `fossil` (Old Amber, an egg inside) comes once a visit. */
export const DIG_FINDS = { expCandy: 40, sphere: 28, rareCandy: 12, stone: 12, fossil: 8 } as const

export type DigFind = keyof typeof DIG_FINDS

/** Timing and size of places, in seconds and world px. */
export const PLACE = {
  /** The first entrance shows up at 1:40, then one every `every ± jitter`. */
  firstAt: 100,
  every: 250,
  jitter: 20,
  /** An entrance due during a boss fight waits for the boss to fall, but no longer than this. */
  bossWait: 45,
  /** How long an entrance stays open on the map. */
  openTime: 45,
  /** Seconds standing in the doorway to step in. */
  enterTime: 0.6,
  /** Seconds to grab the loot once a place's goal is reached, before heading back out. */
  lootTime: 3,
  /** Fainting inside doesn't end the run: after `fallTime` seconds the player is rescued back to the door with `fallHp` of their HP. */
  fallTime: 2,
  fallHp: 0.3,
} as const

/** The Mystery Dungeon: floors, light and the PMD wind that blows explorers out. */
export const CAVE = {
  /** Floors with stairs; the one after them is the treasure chamber. */
  floors: 2,
  /** Seconds the floor's title card holds the dungeon still ("Dark Cave B1F"). */
  card: 1.5,
  /** Radius of the light around the player; Fire types carry a flame, Electric types Flash. */
  light: 72,
  fireLight: 104,
  electricLight: 96,
  stairsRadius: 10,
  /** Seconds left when the wind warns ("Something's stirring…", "It's getting closer!", "It's right nearby!"). */
  wind: [40, 20, 8],
  /** The treasure chamber's Monster House: this many wild Pokémon, plus one per two minutes played. */
  monsterHouse: 6,
  /** Standing this close to the chest for `chestTime` seconds opens it. */
  chestRadius: 24,
  chestTime: 1.5,
} as const

/** The graveyard: how many spirits wake the Odd Keystone, and Spiritomb. */
export const GRAVEYARD = {
  spirits: 20,
  /** Seconds a spirit takes to fly from a fainted ghost into the keystone. */
  spiritFlight: 0.7,
  /** Ghosts keep rising at this share of the rate while Spiritomb fights. */
  fightRate: 0.35,
  boss: 'spiritomb',
  shinyOdds: 1 / 8,
} as const satisfies { boss: EnemyId } & Record<string, unknown>

/** Above the clouds: the sky's size, the tailwind and the wings drifting by. */
export const SKY = {
  /** The wind pushes back past this radius. */
  radius: 240,
  /** Flying with the wind: player speed multiplier. */
  tailwind: 1.15,
  /** A wing drifts in every `every` seconds (the first after `first`), at `speed` px/s. */
  wings: { first: 1.5, every: 4, speed: 26, radius: 10 },
  /** A flock crosses the sky every `every` seconds. */
  flock: { first: 6, every: 9, count: 9 },
} as const

/**
 * Wings (Gen V's feathers) drifting in the sky: each one picked up raises a
 * stat for the rest of the run, except the Pretty Wing, which is worth ₽.
 */
export const WINGS = {
  healthWing: { name: 'Health Wing', weight: 3, stats: { maxHp: 6 } },
  muscleWing: { name: 'Muscle Wing', weight: 3, stats: { might: 0.03 } },
  resistWing: { name: 'Resist Wing', weight: 2, stats: { armor: 0.5 } },
  swiftWing: { name: 'Swift Wing', weight: 2, stats: { speed: 2 } },
  prettyWing: { name: 'Pretty Wing', weight: 2, stats: {} },
} as const satisfies Record<string, { name: string; weight: number; stats: StatDelta }>

export type WingId = keyof typeof WINGS

export const WING_IDS = Object.keys(WINGS) as WingId[]

/** Poké Dollars a Pretty Wing is worth. */
export const PRETTY_WING_COINS = 100

/** What the cave's chest and Spiritomb leave besides ₽ and a Poké Ball. */
export const PLACE_LOOT = {
  cave: ['rareCandy', 'superPotion'],
  graveyard: ['rareCandy', 'superPotion'],
} as const satisfies Partial<Record<PlaceId, readonly Drop[]>>

/**
 * Scenery of places: each entrance on the map and what stands inside. Feet
 * are unions of ellipses around the piece's anchor, like the map's terrain;
 * the art lives in `render/placePieces.ts`.
 */
export type PlacePiece =
  | 'caveMouth' | 'graveGate' | 'windStone' | 'caveRock' | 'crystal' | 'chest' | 'tombstone' | 'graveCross' | 'deadTree' | 'keystone'
  | 'grottoHollow' | 'crackedRock'

export const PLACE_FEET: Record<PlacePiece, readonly Ellipse[]> = {
  // The rocky hill around the cave's mouth (anchored at the arch's foot): its flanks and back, open at the arch.
  caveMouth: [
    { x: -36, y: -4, rx: 22, ry: 12 },
    { x: 36, y: -4, rx: 22, ry: 12 },
    { x: 0, y: -18, rx: 46, ry: 16 },
  ],
  // The gate's pillars, the fence running off both sides and the graveyard behind it.
  graveGate: [
    { x: -20, y: 0, rx: 6, ry: 4 },
    { x: 20, y: 0, rx: 6, ry: 4 },
    { x: -52, y: 0, rx: 30, ry: 3 },
    { x: 52, y: 0, rx: 30, ry: 3 },
    { x: 0, y: -18, rx: 70, ry: 16 },
  ],
  windStone: [{ x: 0, y: -1, rx: 4, ry: 3 }],
  caveRock: [{ x: 0, y: -1, rx: 8, ry: 4 }],
  crystal: [{ x: 0, y: -1, rx: 6, ry: 3 }],
  chest: [{ x: 0, y: -2, rx: 11, ry: 5 }],
  tombstone: [{ x: 0, y: -1, rx: 7, ry: 3 }],
  graveCross: [{ x: 0, y: -1, rx: 5, ry: 3 }],
  deadTree: [{ x: 0, y: -1, rx: 6, ry: 3 }],
  keystone: [{ x: 0, y: -2, rx: 12, ry: 6 }],
  // The grotto's hollow: a mound of roots and leaves, open at the front where the dark goes down.
  grottoHollow: [
    { x: -14, y: -6, rx: 9, ry: 6 },
    { x: 14, y: -6, rx: 9, ry: 6 },
    { x: 0, y: -12, rx: 16, ry: 6 },
  ],
  // The boulder with the crack in its face (the Underground's way down at its foot).
  crackedRock: [{ x: 0, y: -8, rx: 20, ry: 8 }],
}

/** What an entrance is built of: its own pieces, or the map's trees, bushes and rocks (a hidden zone's, dressed as scenery). */
export type EntrancePiece = PlacePiece | 'tree' | 'bush' | 'rock'

/** Each entrance's pieces around its door: (piece, dx, dy). The door is where the player stands to step in. */
export const ENTRANCE_PIECES: Record<PlaceId, readonly (readonly [EntrancePiece, number, number])[]> = {
  cave: [['caveMouth', 0, -6]],
  graveyard: [['graveGate', 0, -6]],
  sky: [
    ['windStone', -24, -12],
    ['windStone', 24, -12],
    ['windStone', -24, 12],
    ['windStone', 24, 12],
  ],
  // A thicket with a gap: trees behind and beside the hollow, bushes closing the flanks.
  grotto: [
    ['tree', -30, -22],
    ['tree', 2, -30],
    ['tree', 32, -20],
    ['grottoHollow', 0, -6],
    ['bush', -36, -2],
    ['bush', 38, 0],
  ],
  // A boulder with a crack, a rock leaning on each side.
  underground: [
    ['crackedRock', 0, -8],
    ['rock', -32, -6],
    ['rock', 30, -4],
  ],
}

/** The ellipses an entrance's piece stands on. */
export const entranceFeet = (piece: EntrancePiece): readonly Ellipse[] =>
  piece === 'tree' || piece === 'bush' || piece === 'rock' ? [SOLID_FOOT[piece]] : PLACE_FEET[piece]
