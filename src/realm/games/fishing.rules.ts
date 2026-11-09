/**
 * Fishing off the pier (`MINIGAMES.fishing`): the pure rules the screen
 * (`fishing.ts`) plays by, apart from drawing so they can be tested. A cast
 * lands somewhere between the dock and the open sea (`zoneOf`); what bites
 * is rolled from that stretch of water (`rollCatch`, rarer and worth more
 * further out); the fight (`fightStep`) keeps the fish inside the reel's
 * zone by holding and letting go while the line's tension may snap it.
 *
 * Randomness comes in as a function (`Rng`): the screen passes
 * `Math.random` (a solo mini game isn't the simulation), tests a seeded one.
 */

export type Rng = () => number

/** A round's length (s). */
export const ROUND_SECONDS = 90

/** The stretches of water a cast can land in, from the dock out. */
export const ZONES = ['near', 'mid', 'far'] as const
export type Zone = (typeof ZONES)[number]

/** Which stretch a cast of `power` (0..1, how long the button was held) lands in. */
export const zoneOf = (power: number): Zone => (power < 0.38 ? 'near' : power < 0.72 ? 'mid' : 'far')

/** Junk that bites a hook too: drawn in code (`fishingArt.ts`), named in i18n `minigames.fishing.junk`. */
export type JunkId = 'boot' | 'can' | 'seaweed'

/**
 * What can come up: a Pokémon (its name and dex; `shiny` for the shiny Gyarados) or
 * junk; its value in points; how hard it fights (0..1: the reel's zone
 * narrows, the fish darts and runs more); its shadow's size under the water
 * (0 small, 1 medium, 2 big); and how likely it bites in each stretch
 * (relative weights, 0: never there).
 */
export type CatchDef = {
  /** A Pokémon's name (official, in English in every language); junk is named in i18n. */
  name?: string
  dex: number | null
  shiny?: true
  junk?: JunkId
  value: number
  fight: number
  size: 0 | 1 | 2
  weight: Readonly<Record<Zone, number>>
}

export const CATCHES = {
  magikarp: { name: 'Magikarp', dex: 129, value: 8, fight: 0.08, size: 1, weight: { near: 30, mid: 12, far: 5 } },
  goldeen: { name: 'Goldeen', dex: 118, value: 15, fight: 0.22, size: 1, weight: { near: 18, mid: 10, far: 0 } },
  horsea: { name: 'Horsea', dex: 116, value: 18, fight: 0.28, size: 0, weight: { near: 14, mid: 9, far: 0 } },
  tentacool: { name: 'Tentacool', dex: 72, value: 16, fight: 0.32, size: 1, weight: { near: 7, mid: 12, far: 6 } },
  corsola: { name: 'Corsola', dex: 222, value: 26, fight: 0.34, size: 1, weight: { near: 8, mid: 6, far: 3 } },
  remoraid: { name: 'Remoraid', dex: 223, value: 22, fight: 0.4, size: 0, weight: { near: 0, mid: 12, far: 10 } },
  luvdisc: { name: 'Luvdisc', dex: 370, value: 30, fight: 0.38, size: 0, weight: { near: 0, mid: 9, far: 8 } },
  staryu: { name: 'Staryu', dex: 120, value: 28, fight: 0.44, size: 1, weight: { near: 0, mid: 10, far: 12 } },
  qwilfish: { name: 'Qwilfish', dex: 211, value: 36, fight: 0.6, size: 1, weight: { near: 0, mid: 5, far: 12 } },
  wailmer: { name: 'Wailmer', dex: 320, value: 48, fight: 0.66, size: 2, weight: { near: 0, mid: 3, far: 14 } },
  feebas: { name: 'Feebas', dex: 349, value: 120, fight: 0.55, size: 1, weight: { near: 0, mid: 0.8, far: 2.6 } },
  shinyGyarados: { name: 'Gyarados', dex: 130, shiny: true, value: 400, fight: 0.85, size: 2, weight: { near: 0, mid: 0, far: 0.5 } },
  boot: { dex: null, junk: 'boot', value: 2, fight: 0.04, size: 1, weight: { near: 5, mid: 2, far: 1 } },
  can: { dex: null, junk: 'can', value: 2, fight: 0.04, size: 0, weight: { near: 5, mid: 2, far: 0.5 } },
  seaweed: { dex: null, junk: 'seaweed', value: 1, fight: 0.02, size: 0, weight: { near: 6, mid: 1.5, far: 0.5 } },
} as const satisfies Record<string, CatchDef>

export type CatchId = keyof typeof CATCHES

export const CATCH_IDS = Object.keys(CATCHES) as CatchId[]

export const isCatchId = (v: unknown): v is CatchId => typeof v === 'string' && Object.hasOwn(CATCHES, v)

/** The Pokémon among the catches (the screen loads their sprites when a round starts). */
export const CATCH_DEX: readonly { dex: number; shiny: boolean }[] = CATCH_IDS.flatMap((id) => {
  const c: CatchDef = CATCHES[id]
  return c.dex === null ? [] : [{ dex: c.dex, shiny: c.shiny === true }]
})

/** How much likelier the rarest bite during the Hora do Realm's high tide (`realmEvents.ts`): their values, and so the pay, don't change. */
export const TIDE_ODDS: Readonly<Partial<Record<CatchId, number>>> = { wailmer: 1.5, qwilfish: 1.5, feebas: 3, shinyGyarados: 3 }

/** What bites a hook that landed in `zone`, rolled from the stretch's weights (`tide`: the high tide's, `TIDE_ODDS`). */
export const rollCatch = (zone: Zone, rng: Rng, tide = false): CatchId => {
  const weight = (id: CatchId) => CATCHES[id].weight[zone] * (tide ? (TIDE_ODDS[id] ?? 1) : 1)
  const total = CATCH_IDS.reduce((sum, id) => sum + weight(id), 0)
  let roll = rng() * total
  for (const id of CATCH_IDS) {
    roll -= weight(id)
    if (roll < 0) return id
  }
  return 'magikarp'
}

/** How long (s) the "!" stays up for a tap to hook it: a tougher fish lets go sooner. */
export const biteWindow = (id: CatchId) => 0.85 - 0.35 * CATCHES[id].fight

/* ---------------- The fight ---------------- */

/**
 * The reel, as a bar from 0 (slack, toward the sea) to 1: the fish's place
 * on it (`fish`), the player's zone (`zone`, its left edge; it's
 * `zoneWidth` wide) and the zone's speed, how far the catch has come
 * (`progress`, 1 landed, 0 got away), the line's `tension` (1 snaps it) and
 * the fish's own plans: where it's swimming to and, while it `runs`, a dash
 * that tugs hard on the line.
 */
export type Fight = {
  catchId: CatchId
  fish: number
  target: number
  retarget: number
  runs: number
  zone: number
  speed: number
  progress: number
  tension: number
  /** Seconds fought, for the screen's shakes. */
  time: number
}

export type FightEnd = 'landed' | 'escaped' | 'snapped'

/** The numbers of the fight; tune here. */
export const FIGHT = {
  /** The zone's width on the bar for the easiest fish, and how much the toughest narrows it. */
  zoneWidth: 0.42,
  zoneNarrow: 0.2,
  /** Holding pushes the zone toward the dock this fast (bar/s²); letting go lets it fall back. */
  lift: 3.2,
  fall: 2.6,
  maxSpeed: 1.6,
  /** A wall stops the zone dead, bouncing a little. */
  bounce: 0.3,
  /** Progress a second with the fish in the zone, and lost out of it (plus `slip` × toughness). */
  gain: 0.38,
  lose: 0.08,
  slip: 0.1,
  start: 0.3,
  /** How fast the fish swims (bar/s), and on a run. */
  swim: 0.22,
  swimFight: 0.3,
  run: 1.1,
  /** Run chance a second, for the easiest fish and added for the toughest. */
  runChance: 0.05,
  runFight: 0.42,
  /** Tension a second: holding during a run, holding against the end of the bar, holding otherwise, and letting go. */
  strain: 1.15,
  pinned: 0.55,
  hold: 0.05,
  ease: 0.7,
  /** The fish starts to tire after this many seconds of fight, and is spent this many seconds later. */
  tires: 8,
  spent: 10,
  /** How much wider the zone gets on a spent fish. */
  widen: 0.18,
} as const

export const zoneWidth = (id: CatchId) => FIGHT.zoneWidth - FIGHT.zoneNarrow * CATCHES[id].fight

/** How tired the fish is (0 fresh … 1 spent): past `FIGHT.tires` s it slows, stops running and the zone widens, so every fight ends. */
export const fatigue = (f: Fight) => Math.min(1, Math.max(0, (f.time - FIGHT.tires) / FIGHT.spent))

/** The zone's width now: the catch's, widened as the fish tires. */
export const widthOf = (f: Fight) => zoneWidth(f.catchId) + FIGHT.widen * fatigue(f)

/** A fight with `id` just hooked: the fish mid-bar, the zone under it. */
export const startFight = (id: CatchId): Fight => {
  const w = zoneWidth(id)
  return { catchId: id, fish: 0.6, target: 0.6, retarget: 0.6, runs: 0, zone: 0.6 - w / 2, speed: 0, progress: FIGHT.start, tension: 0, time: 0 }
}

/** The fish keeps to the bar from here up, clear of where the zone rests when let go: idling never lands it (the zone widened on a spent fish may reach it: by then the fight has been fought). */
const SWIMS = 0.44

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Whether the fish is inside the zone now. */
export const inZone = (f: Fight) => f.fish >= f.zone && f.fish <= f.zone + widthOf(f)

/**
 * One step of the fight (`dt` s) with the button `holding` or not; mutates
 * `f` and answers how it ended, or null while it goes on. Holding reels the
 * zone toward the dock, letting go lets it slide back; the catch comes in
 * while the fish is inside the zone and slips away outside it. Holding while
 * the fish runs (or against the end of the bar) strains the line.
 */
export const fightStep = (f: Fight, holding: boolean, dt: number, rng: Rng): FightEnd | null => {
  const d = CATCHES[f.catchId].fight
  f.time += dt
  const w = widthOf(f)
  const tired = fatigue(f)
  // The fish: swims toward a spot it picks now and then, sometimes runs.
  if (f.runs > 0) f.runs = Math.max(0, f.runs - dt)
  else if (rng() < (FIGHT.runChance + FIGHT.runFight * d) * (1 - tired) * dt) {
    f.runs = 0.45 + rng() * 0.45
    f.target = f.fish < 0.7 ? 0.88 + rng() * 0.12 : SWIMS + rng() * 0.08
  }
  f.retarget -= dt
  if (f.runs === 0 && f.retarget <= 0) {
    f.retarget = 0.35 + rng() * (1.1 - 0.6 * d)
    f.target = SWIMS + rng() * (1 - SWIMS)
  }
  const pace = (f.runs > 0 ? FIGHT.run : FIGHT.swim + FIGHT.swimFight * d) * (1 - 0.7 * tired)
  const gap = f.target - f.fish
  f.fish = clamp01(f.fish + Math.sign(gap) * Math.min(Math.abs(gap), pace * dt))

  // The zone: lifted while holding, falling back when let go, stopped by the bar's ends.
  f.speed = Math.max(-FIGHT.maxSpeed, Math.min(FIGHT.maxSpeed, f.speed + (holding ? FIGHT.lift : -FIGHT.fall) * dt))
  f.zone += f.speed * dt
  const pinned = f.zone >= 1 - w
  if (f.zone <= 0) {
    f.zone = 0
    f.speed = Math.abs(f.speed) * FIGHT.bounce
  } else if (pinned) {
    f.zone = 1 - w
    f.speed = -Math.abs(f.speed) * FIGHT.bounce
  }

  // The line: strained by holding against a run or the bar's end, easing when let go.
  const strain = !holding ? -FIGHT.ease : f.runs > 0 ? FIGHT.strain : pinned ? FIGHT.pinned : FIGHT.hold
  f.tension = clamp01(f.tension + strain * dt)
  if (f.tension >= 1) return 'snapped'

  f.progress = clamp01(f.progress + (inZone(f) ? FIGHT.gain : -(FIGHT.lose + FIGHT.slip * d)) * dt)
  if (f.progress >= 1) return 'landed'
  if (f.progress <= 0) return 'escaped'
  return null
}

/* ---------------- A round ---------------- */

/** What a round caught, in order. */
export type Haul = readonly CatchId[]

/** A haul's score: the sum of its values. */
export const scoreOf = (haul: Haul) => haul.reduce((sum, id) => sum + CATCHES[id].value, 0)

/** The score that makes a round a `bigHaul`. */
export const BIG_HAUL = 300

/**
 * The feats (`MINIGAMES.fishing.feats`) a haul hit: hooking a Feebas, the
 * shiny Gyarados, a round worth `BIG_HAUL`.
 */
export const featsOf = (haul: Haul): string[] => [
  ...(haul.includes('feebas') ? ['feebas'] : []),
  ...(haul.includes('shinyGyarados') ? ['shinyGyarados'] : []),
  ...(scoreOf(haul) >= BIG_HAUL ? ['bigHaul'] : []),
]

/** A fishing log: each kind caught, how many and what they were worth, the best first. */
export const logOf = (haul: Haul): { id: CatchId; count: number; points: number }[] => {
  const counts = new Map<CatchId, number>()
  for (const id of haul) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts].map(([id, count]) => ({ id, count, points: count * CATCHES[id].value })).sort((a, b) => CATCHES[b.id].value - CATCHES[a.id].value)
}
