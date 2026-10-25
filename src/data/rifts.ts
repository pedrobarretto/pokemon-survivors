import type { Drop } from './consumables'
import type { EnemyId } from './enemies'

/**
 * Legendary rifts: portals that open on the map a few times per run and lead
 * to a closed arena with a legendary from another generation. Each one has
 * its entry in `ENEMIES`, its patterns in `data/bosses.ts`, its colors here and its
 * floor plan in `data/arenas.ts`.
 */
export const RIFT_LEGENDS = ['lugia', 'hoOh', 'kyogre', 'groudon', 'rayquaza', 'dialga', 'latias', 'latios', 'deoxys'] as const satisfies readonly EnemyId[]

/**
 * Event rifts: legendaries a rift brings only during an event, in place of
 * the one it drew (`EVENT_RIFT`), kept out of `RIFT_LEGENDS` (the "every
 * legend" achievement and the Pokédex's rift list count those). Darkrai's
 * nightmare comes in a haunted run (Noite das Bruxas).
 */
export const EVENT_RIFTS = ['darkrai'] as const satisfies readonly EnemyId[]

export type EventRift = (typeof EVENT_RIFTS)[number]

/** Every legendary a rift can lead to: the regular ones and the event ones. */
export type RiftLegend = (typeof RIFT_LEGENDS)[number] | EventRift

/**
 * How an event rift takes a rift's place: in a haunted run each omen is
 * Darkrai's with `odds` (rolled on the run's rng, and only in a haunted run,
 * so any other run plays as before).
 */
export const EVENT_RIFT = { odds: 0.35 } as const

/** The legendaries a rift draws: Latios never comes alone, he fights beside Latias in her domain (`partner`, `data/domains/latis.ts`). */
export const RIFT_DRAWS = RIFT_LEGENDS.filter((l): l is Exclude<(typeof RIFT_LEGENDS)[number], 'latios'> => l !== 'latios')

/** How an arena looks: floor tiles (base, alternate, grout), the wall ring (light, dark), the void past it and its floating motes. */
export type ArenaTheme = {
  floor: readonly [string, string, string]
  wall: readonly [string, string]
  void: string
  motes: string
}

export const ARENAS: Record<RiftLegend, ArenaTheme> = {
  /** Whirl Islands: deep-sea stone. */
  lugia: { floor: ['#506890', '#5c78a0', '#2c3c5c'], wall: ['#d8e8f8', '#7890b8'], void: '#0c1428', motes: '#a8c8f8' },
  /** Bell Tower: lacquered gold and red. */
  hoOh: { floor: ['#a85030', '#b86038', '#5c2418'], wall: ['#f8d060', '#b07820'], void: '#200c08', motes: '#f8a040' },
  /** Seafloor Cavern: wet teal rock. */
  kyogre: { floor: ['#286878', '#307888', '#143840'], wall: ['#78d0e8', '#287890'], void: '#04141c', motes: '#58b8f8' },
  /** Magma core: cooled basalt over lava. */
  groudon: { floor: ['#583830', '#644038', '#e05818'], wall: ['#f89038', '#a03810'], void: '#180804', motes: '#f86820' },
  /** Sky Pillar: green tiles at the edge of space. */
  rayquaza: { floor: ['#3c6848', '#467654', '#1c3424'], wall: ['#f8e070', '#589860'], void: '#040818', motes: '#f8f0a0' },
  /** Spear Pillar: pale marble in frozen time. */
  dialga: { floor: ['#8890a8', '#949cb4', '#485070'], wall: ['#a8f0f8', '#4868a8'], void: '#080c20', motes: '#78e0f8' },
  /** Southern Island: warm sand ringed by palms over the open sea, with Latias's red glints. */
  latias: { floor: ['#d0b880', '#dcc490', '#907450'], wall: ['#88d868', '#2c7838'], void: '#0c3850', motes: '#f88898' },
  /** Southern Island at dusk, with Latios's blue glints. */
  latios: { floor: ['#b8a078', '#c4ac84', '#786040'], wall: ['#78c060', '#245c34'], void: '#0c1c40', motes: '#78a8f8' },
  /** A meteorite adrift in space: dark crystal rock, Deoxys's orange core, stars all around. */
  deoxys: { floor: ['#484058', '#544c68', '#201830'], wall: ['#f89850', '#a84020'], void: '#020208', motes: '#f8f8ff' },
  /** The Nightmare: slabs of a dream gone dark adrift in a black void, cyan eyes and embers glinting all around. */
  darkrai: { floor: ['#2c2440', '#342a4c', '#140e20'], wall: ['#58e8f0', '#5c3c8c'], void: '#04020a', motes: '#58e8f0' },
}

/** Timing and size of rifts, in seconds and world px. */
export const RIFT = {
  /**
   * Two portals per run, around 4:00 and 10:20 (± `jitter`), clear of the
   * trio's slots at 7:00, 9:30 and 12:00. Each opens `omenTime` s after its
   * omen starts (`game/riftPortal.ts`). In endless mode one comes every
   * `every ± jitter` s, the first `endlessFirst` s in.
   */
  slots: [240, 620],
  jitter: 10,
  omenTime: 20,
  every: 240,
  endlessFirst: 60,
  /**
   * A portal that comes due during a boss fight waits for the boss to fall,
   * but no longer than this, so slow fights don't cost the run its rifts.
   */
  bossWait: 45,
  /** How long a portal waits on the map before closing. */
  portalTime: 40,
  /** Seconds the player must stand inside the portal to step in. */
  enterTime: 1,
  portalRadius: 18,
  /** A domain's portal is a huge tear: the player steps in anywhere within this radius. */
  tearRadius: 24,
  /** Seconds before the arena collapses and throws the player back. */
  arenaTime: 60,
  /** Seconds to grab the loot after the legendary falls. */
  lootTime: 3,
  /** Seconds the defeat plays (the player faints and the rift spits them out) before they land back outside. */
  fallTime: 2.4,
  /** Share of max HP the player lands back outside with after falling in the arena. */
  fallHp: 0.3,
  /** Chance the legendary behind a rift is shiny (double ₽, an extra Poké Ball). */
  shinyOdds: 1 / 8,
} as const

/** Items always dropped by a beaten rift legendary, on top of its ₽ and Poké Balls. */
export const RIFT_ITEMS: readonly Drop[] = ['rareCandy', 'superPotion']

/** Whether a species is one of the rift legendaries (an event rift's included). */
export const isRiftLegend = (id: EnemyId): id is RiftLegend => RIFT_LEGENDS.some((l) => l === id) || isEventRift(id)

/** Whether a species is an event rift's legendary (`EVENT_RIFTS`). */
export const isEventRift = (id: string): id is EventRift => EVENT_RIFTS.some((l) => l === id)
