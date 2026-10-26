import type { StatDelta } from '../game/stats'
import type { BiomeId } from './biomes'
import type { Drop } from './consumables'
import type { EnemyId } from './enemies'
import type { ThemeId } from './music'
import type { Ellipse } from './terrain'

/**
 * Places: structures found on the map (a cave mouth, a graveyard gate, an
 * updraft) that lead somewhere the player can step into for a short, different
 * run of play: a dark dungeon, a haunted graveyard, the open sky. The entrance
 * side lives in `game/placeEntrance.ts`, the inside in `game/placeInterior.ts`
 * and each place's rules in its own module (`game/cave.ts`, `game/graveyard.ts`,
 * `game/sky.ts`). Names and lines live in `i18n` (`places`).
 */
export const PLACE_IDS = ['cave', 'graveyard', 'sky'] as const

export type PlaceId = (typeof PLACE_IDS)[number]

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
}

export const PLACES = {
  /** A Mystery Dungeon: dark floors of rooms and corridors, stairs down, a treasure at the bottom. */
  cave: {
    time: 100,
    species: ['zubat', 'diglett', 'geodude', 'roggenrola', 'sableye', 'aron', 'graveler', 'golbat', 'dugtrio', 'golem', 'crobat', 'excadrill'],
    spawn: { rate: 0.9, max: 14 },
    biomes: { cave: 3, meadow: 1.5, desert: 1.5, volcano: 1.5 },
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
    biomes: { beach: 1.5 },
    flyers: true,
    // The whole updraft lifts: walking across its middle is enough.
    door: 22,
    theme: 'snow',
  },
} as const satisfies Record<PlaceId, PlaceDef>

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
export type PlacePiece = 'caveMouth' | 'graveGate' | 'windStone' | 'caveRock' | 'crystal' | 'chest' | 'tombstone' | 'graveCross' | 'deadTree' | 'keystone'

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
}

/** Each entrance's pieces around its door: (piece, dx, dy). The door is where the player stands to step in. */
export const ENTRANCE_PIECES: Record<PlaceId, readonly (readonly [PlacePiece, number, number])[]> = {
  cave: [['caveMouth', 0, -6]],
  graveyard: [['graveGate', 0, -6]],
  sky: [
    ['windStone', -24, -12],
    ['windStone', 24, -12],
    ['windStone', -24, 12],
    ['windStone', 24, 12],
  ],
}
