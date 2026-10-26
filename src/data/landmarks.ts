import type { Drop, DropSource } from './consumables'

/**
 * Landmarks: the map's points of interest. Each stands in a terrain cell the
 * way a mountain or a lake does (`game/terrain.ts` places them from the run's
 * seed, so the replay rebuilds the same map) and wears the biome's skin: an
 * abandoned cottage to walk into, a tunnel through a ridge, a hedge maze,
 * Unown ruins and an abandoned camp, and a few nods to the games: a Snorlax
 * asleep across a path, a Pokémon Center, Team Rocket's hideout, the truck by
 * the pier (the Mew rumor) and MissingNo.'s glitched coast. Most keep a small
 * treasure; the tunnel takes whoever steps in out of its other mouth. Layouts
 * are built in `game/landmarkLayout.ts`, the rules in `game/landmarks.ts` and
 * the art in `render/landmarkPieces.ts`. Names and lines live in `i18n` (`landmarks`).
 */
export const LANDMARK_IDS = ['cottage', 'tunnel', 'maze', 'ruins', 'camp', 'snorlax', 'center', 'rocket', 'truck', 'glitch'] as const

export type LandmarkId = (typeof LANDMARK_IDS)[number]

export const LANDMARK = {
  /** At most one landmark per block of `block`×`block` terrain cells, in one of its cells drawn from the seed: they never crowd. */
  block: 3,
  /** Odds a block holds one. */
  odds: 0.8,
  /** Relative odds of each landmark: the truck and the glitched coast are secrets a run rarely meets. */
  weights: { cottage: 3, tunnel: 2, maze: 2, ruins: 2, camp: 3, snorlax: 1.5, center: 1.5, rocket: 1.2, truck: 0.6, glitch: 0.3 } satisfies Record<LandmarkId, number>,
  /** Standing this close to a treasure for its `open` seconds (`openTime` without) opens it. */
  treasureRadius: 20,
  openTime: 0.6,
  /** Coming this close to a landmark names it on screen, once per landmark. */
  spotRadius: 150,
  /** Secrets: the mini map leaves them out until they're named. */
  secret: { truck: true, glitch: true } satisfies Partial<Record<LandmarkId, true>>,
} as const

/** The tunnel: stand in one mouth to come out of the other, the horde left behind the ridge. */
export const TUNNEL = {
  /** Radius of a mouth's door (px) and the seconds standing in it to step in. */
  mouth: 12,
  enterTime: 0.4,
  /** Seconds underground. */
  travel: 1.3,
  /** Px south of the far mouth where the player comes out. */
  exitStep: 14,
} as const

/**
 * What each landmark's treasure holds: ₽ coins (of `COIN_VALUES[1]`), item
 * rolls, Oran Berries, Exp. Candy (in levels' worth) and an egg's chance, and
 * what the games' nods do instead of (or on top of) a chest.
 */
export type LandmarkLoot = {
  coins: number
  drops: readonly DropSource[]
  berries?: number
  xp?: number
  egg?: true
  /** Seconds standing at it to open it (`LANDMARK.openTime` without). */
  open?: number
  /** Share of max HP it heals (the Pokémon Center). */
  heal?: number
  /** Each item roll drops this many times (MissingNo.'s item duplication). */
  copies?: number
  /** It's asleep: opening it wakes it, and it fights as an Alpha (`SNORLAX`). */
  wakes?: true
  /** The rumor: odds Mew shows up from under it, nothing otherwise (`TRUCK`). */
  rumor?: number
}

export const LANDMARK_LOOT = {
  /** An old crate in the cottage's corner. */
  cottage: { coins: 2, drops: ['itemBall'] },
  /** The chest at the heart of the maze: the long way in pays more. */
  maze: { coins: 5, drops: ['itemBall', 'itemBall'], egg: true },
  /** The ruins' altar: the Unown's glyphs light up and spill Exp. Candy. */
  ruins: { coins: 1, drops: [], xp: 0.6 },
  /** A backpack someone left by the fire. */
  camp: { coins: 1, drops: ['berryTree'], berries: 2 },
  /** Poked long enough, the Snorlax across the path wakes up grumpy, the Oran Berries it hoarded spilling around it. */
  snorlax: { coins: 0, drops: [], berries: 3, open: 3, wakes: true },
  /** The Pokémon Center's door: Nurse Joy heals the Pokémon back to full, once. */
  center: { coins: 0, drops: [], open: 1, heal: 1 },
  /** The Meowth balloon tied by the tent: Pay Day spills as it blasts off again. */
  rocket: { coins: 8, drops: ['itemBall'], open: 0.8 },
  /** The truck by the pier: they say Mew hides under it. */
  truck: { coins: 0, drops: [], open: 4, rumor: 1 / 20 },
  /** MissingNo. on the glitched shore: the item it gives comes out twice. */
  glitch: { coins: 3, drops: ['itemBall'], copies: 2, open: 1.5 },
} as const satisfies Partial<Record<LandmarkId, LandmarkLoot>>

export type TreasureLandmark = keyof typeof LANDMARK_LOOT

/** The Snorlax across the path, woken: an Alpha whose HP is a share of the 5:00 boss's (`early` up to `ramp[0]` s, `late` from `ramp[1]` s) and whose hits land softer. */
export const SNORLAX = {
  hp: { early: 0.12, late: 0.5, ramp: [60, 600] as const },
  damage: 0.6,
  /** Seconds it yawns and stretches before it moves, and the waker's grace. */
  yawn: 1.2,
} as const

/** The truck's rumor: what Mew leaves behind when it shows. The odds are its loot's `rumor`, drawn from the run's seed per truck. */
export const TRUCK = { gift: 'rareCandy' } as const satisfies { gift: Drop }

/**
 * Pieces of landmarks, sculpted per biome. `wallN`, `wallW`, `wallE` and
 * `wallS` are the cottage's walls (`wallS` in two halves around the door),
 * `hedge` one row of the maze, `ridge` the tunnel's mountain. The treasure
 * pieces (`crate`, `chest`, `altar`, `pack`, `center`, `balloon`, `truck`,
 * `missingno`) show open once looted; the `snorlax` is gone once woken (its
 * piece is `gone`, `game/landmarkLayout.ts`), and its bed shows in the ground.
 */
export type LandmarkPiece =
  | 'wallN' | 'wallW' | 'wallE' | 'wallS' | 'well' | 'fence' | 'crate' | 'table' | 'bed'
  | 'ridge' | 'cart'
  | 'hedge' | 'chest'
  | 'menhir' | 'altar' | 'column'
  | 'tent' | 'campfire' | 'log' | 'pack'
  | 'snorlax'
  | 'center'
  | 'rocketTent' | 'balloon'
  | 'truck' | 'ship' | 'bollard'
  | 'missingno'

/** Flat art under a landmark (floors, paths, a plaza), drawn with the ground like a lake. */
export type LandmarkGround = 'floor' | 'rails' | 'gravel' | 'plaza' | 'camp' | 'route' | 'court' | 'hideout' | 'pier' | 'glitch'

/** The hedge maze: `size`×`size` corridors of `cell` px, entered from the middle of its south side, the chest at its heart. */
export const MAZE = {
  size: 5,
  cell: 32,
  /** Half the thickness of a hedge (px). */
  wall: 5,
  /** Distinct mazes: each run's mazes come from these, so their art is built once. */
  patterns: 6,
} as const
