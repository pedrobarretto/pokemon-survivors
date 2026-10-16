import type { Dir8 } from '../engine/math'
import type { Rng } from '../engine/rng'
import type { Grid } from '../engine/spatial'
import type { HazardVisual } from '../data/bosses'
import type { EnemyId } from '../data/enemies'
import type { BiomeId, WeatherId } from '../data/biomes'
import type { RiftLegend } from '../data/rifts'
import type { BuffId } from '../data/consumables'
import type { ItemId } from '../data/items'
import type { TraitId } from '../data/traits'
import type { PokeType } from '../data/types'
import type { PlayableId } from '../data/hatchlings'
import type { MegaId } from '../data/megas'
import type { BiomeState } from './biomes'
import type { Ranks } from './meta'
import type { ConsumableId } from './consumables'
import type { DexLog } from './dex'
import type { Difficulty } from './difficulty'
import type { EggTier, RunEggs } from './eggs'
import type { EndlessState } from './endless'
import type { MoveId } from './moves'
import type { MapEventNotice, MapEventsState } from './mapEvents'
import type { MegaState } from './mega'
import type { Prop } from './props'
import type { TerrainState } from './terrain'
import type { Roster } from './roster'
import type { RiftState } from './rift'
import type { SpecialState } from './special'
import type { Stance } from './stance'
import type { RunTally } from './tally'
import type { PlayerStats } from './stats'
import type { EnemyStatus, StatusSpec } from './status'
import type { WeatherState } from './weather'
import type { TraitState } from './traits'
import type { BossFight } from './bossFight'
import type { CoopState } from './coop'

export type OwnedMove = { id: MoveId; level: number; cooldown: number }
export type OwnedItem = { id: ItemId; level: number }

/**
 * One Pokémon in the run. Solo runs have one; co-op runs up to four, one per
 * room slot. Everything a player owns lives here: their line, moves, items,
 * special, Mega Stone and level-up picks.
 */
export type Player = {
  /** Index in `Game.players` (the room slot in co-op). */
  slot: number
  /** The Pokémon this player plays: a starter or a hatched family. */
  starter: PlayableId
  /** Permanent Poké Mart ranks this player started with. */
  ranks: Ranks
  x: number
  y: number
  /** Last non-zero movement direction (unit vector). Aimed moves use it. */
  facing: { x: number; y: number }
  /** Walking velocity this tick, px/s (0 while still or dashing). Runners lead their aim with it. */
  vx: number
  vy: number
  dir: Dir8
  moving: boolean
  hp: number
  level: number
  xp: number
  xpNext: number
  /** Seconds of invulnerability left after being hit. */
  iframes: number
  hurt: number
  /** Index into the starter's evolution line. */
  stage: number
  moves: OwnedMove[]
  items: OwnedItem[]
  stats: PlayerStats
  radius: number
  animTime: number
  /** Rolled once per run, or picked (a shiny hatch, a shiny starter unlocked before); the whole evolution line uses shiny sprites. */
  shiny: boolean
  /** The run's 1/64 roll hit: the only shiny the `shinyStarter` medal counts, and what unlocks the shiny starter for good. */
  luckyShiny: boolean
  /** Distance walked this run, in world px. Hatches the incubator's eggs (`eggs.ts`). */
  walked: number
  special: SpecialState
  /** Mega Stone, Mega form and its recharge (`mega.ts`). */
  mega: MegaState
  /** Level-up rerolls/skips left this run. */
  rerolls: number
  skips: number
  /** Level-ups waiting for a pick, the offers on the table and how many picks were offered so far (`round`, co-op picks quote it). */
  pendingLevelUps: number
  offers: Offer[]
  round: number
  evolution: Evolution | null
  damageByMove: Partial<Record<DamageSource, number>>
  /** Co-op: fainted, with how far a teammate got reviving them (seconds); null while standing. */
  down: { revive: number } | null
  /** Co-op: left the room for good. Out of play, kept so slots never shift. */
  gone: boolean
  /** Top-left of their screen as of the last step (`followPlayers`): what's on screen and what's safely off it. */
  screen: { x: number; y: number }
  /** Co-op: their tab is hidden or their connection dropped (the stick reads still). */
  away: boolean
}

export type EnemyBehavior =
  | { kind: 'chase' }
  /** Flies in a straight line and despawns after `ttl` (swarm events). */
  | { kind: 'flyby'; vx: number; vy: number; ttl: number }

export type Enemy = {
  id: number
  kind: EnemyId
  types: readonly PokeType[]
  x: number
  y: number
  /** Knockback velocity, decays every tick. */
  kx: number
  ky: number
  hp: number
  maxHp: number
  damage: number
  speed: number
  mass: number
  radius: number
  xp: number
  boss: boolean
  /** Shiny elite: more HP and EXP, drops a Poké Ball. */
  shiny: boolean
  /** Spawned while the horde was nearly full (`ELITE`): tougher, worth more, outlined. */
  elite: boolean
  /** Fast and frail, aims ahead of the player (`RUNNER`). */
  runner: boolean
  /** A wave boss's stance and rage (`bossFight.ts`); null for everyone else until `updateBosses` starts it. */
  fight: BossFight | null
  /** Game time it spawned at (sparkle timing). */
  bornAt: number
  /** Seconds until each boss pattern fires, indexed like `BOSS_PATTERNS[kind]`. */
  cooldowns: number[]
  behavior: EnemyBehavior
  dir: Dir8
  animTime: number
  flash: number
  /** Status conditions (burn, poison, paralysis, slow). */
  status: EnemyStatus
  /** Behavior trait (healer, kamikaze…) and the wards/heals it gets from allies. */
  trait: TraitState
  /** -1 while alive; otherwise seconds since fainting (or since fleeing). */
  dying: number
  /**
   * A wave boss that ran off when the next one arrived (`fleesFrom`): out of
   * play like a fainted one, gliding away along its knockback, with no reward.
   */
  fled: boolean
}

export type Shape = { kind: 'circle'; r: number } | { kind: 'rect'; w: number; h: number }

export type Motion =
  | { kind: 'linear'; vx: number; vy: number }
  | { kind: 'homing'; vx: number; vy: number; speed: number; turn: number; target: Enemy | null }
  | { kind: 'orbit'; angle: number; spin: number; radius: number }
  /** Flies out along (vx, vy) and gets pulled back by (ax, ay). */
  | { kind: 'boomerang'; vx: number; vy: number; ax: number; ay: number }
  /** Stays glued to the player at an offset. */
  | { kind: 'follow'; ox: number; oy: number }
  | { kind: 'static' }
  /** Carries the player along (vx, vy) for `left` more seconds (Quick Attack); the hitbox rides at body height. */
  | { kind: 'lunge'; vx: number; vy: number; left: number }
  /** Flies along (vx, vy) losing `drag` of its speed per second until it stops and stays put (Ice Shard). */
  | { kind: 'drift'; vx: number; vy: number; drag: number }

export type Visual =
  | 'ember' | 'flame' | 'water' | 'leaf' | 'star' | 'thunder' | 'whirlpool' | 'vine' | 'sludge' | 'gust'
  | 'fist' | 'steel' | 'arrow' | 'shuriken' | 'jaws' | 'pyro' | 'psy' | 'quake' | 'drumRoots' | 'heart' | 'note' | 'blade' | 'shell'
  | 'iceShard' | 'rockTomb' | 'pin' | 'dragonBreath'
  /** Special attacks (`special.ts`), drawn by `render/specialFx.ts`. */
  | 'blitz' | 'fireTrail' | 'blast' | 'beam' | 'roots' | 'nova' | 'bolt' | 'meteor' | 'orb' | 'wave' | 'puddle'
  /** Chain dash: the capsule along the path, the slash at the landing and the player's afterimages (drawn by `render/draw.ts`). */
  | 'streak' | 'slash' | 'afterimage'
  /** The rainbow burst that ends a Mega Evolution (`mega.ts`), drawn by `render/megaFx.ts`. */
  | 'megaWave'
  | EvolvedVisual
  | TacticVisual

/** What dealt the damage, for the results screen. */
export type DamageSource = MoveId | 'special'

/** Visuals of evolved moves, drawn by `render/evolved.ts`. */
export type EvolvedVisual =
  | 'flamethrower' | 'fireBlast' | 'hydroPump' | 'surf' | 'leafStorm'
  | 'powerWhip' | 'triAttack' | 'wildbolt' | 'gunk' | 'hurricane'
  | 'blizzard' | 'stoneEdge' | 'megahorn' | 'outrage'

/** Lunges, chains, mines and turrets (`moveRules.ts`), drawn by `render/moveFx.ts`. */
export type TacticVisual =
  | 'quick' | 'extremeSpeed' | 'shock' | 'thunderbolt' | 'hex'
  | 'spikes' | 'barbs' | 'spikesBlast' | 'barbsBlast'
  | 'wisp' | 'wispShot' | 'inferno' | 'infernoShot'

/** A static attack that shoots at the nearest foe every `every` seconds (Will-O-Wisp). Its shots copy its damage and status. */
export type Turret = { every: number; left: number; amount: number; speed: number; shot: Visual }

/** Any damaging hitbox: projectiles, auras, strikes, zones. */
export type Attack = {
  id: number
  move: DamageSource
  type: PokeType
  visual: Visual
  x: number
  y: number
  shape: Shape
  motion: Motion
  damage: number
  knockback: number
  /** Remaining enemies it can hit before vanishing. */
  pierce: number
  /** Seconds before the same enemy can be hit again (Infinity = once). */
  hitInterval: number
  hits: Map<number, number>
  age: number
  ttl: number
  /** Damage window, in seconds of age. */
  activeFrom: number
  activeUntil: number
  /** Radius growth per second (expanding rings). */
  grow: number
  /** Condition this hitbox may inflict on hit. */
  status: StatusSpec | null
  /** Where it was launched from (lobbed attacks animate from here). */
  from: { x: number; y: number }
  flip: boolean
  /** Mines: blast radius when a foe steps on it, or half damage when it expires (0 = not a mine). */
  blast: number
  /** Blast visual of a mine. */
  blastVisual: Visual
  turret: Turret | null
  /** The player whose move or special made it: it follows them, and their hits count as theirs. */
  owner: Player
}

/** Enemy-owned hitbox that hurts the player (boss attacks). */
export type Hazard = {
  id: number
  /** strike = telegraphed impact, shot = projectile, zone = lingering patch. */
  kind: 'strike' | 'shot' | 'zone'
  visual: HazardVisual
  x: number
  y: number
  vx: number
  vy: number
  r: number
  damage: number
  age: number
  /** Harmless telegraph until `armAt`; can hurt until `disarmAt`. */
  armAt: number
  disarmAt: number
  ttl: number
  /** Projectiles vanish on hit; zones linger. */
  vanishOnHit: boolean
}

export type Pickup = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  /** True once it's being pulled into the player. */
  attracted: boolean
  age: number
} & ({ kind: 'xp'; value: number } | { kind: 'coin'; value: number } | { kind: 'berry' } | { kind: 'pokeball' } | { kind: 'megaStone'; mega: MegaId } | { kind: 'consumable'; item: ConsumableId })

export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  ttl: number
  color: string
  size: number
  gravity: number
  drag: number
}

/**
 * `damage` marks damage numbers, which the settings can hide (heals and ₽ always show).
 * Numbers over an enemy carry its id as `target` (-1 otherwise), their running
 * `amount` and the `slot` they hold over it (see `damageText.ts`).
 */
export type FloatText = {
  x: number
  y: number
  vy: number
  life: number
  text: string
  color: string
  damage: boolean
  target: number
  amount: number
  slot: number
}

export type Offer =
  | { kind: 'move'; id: MoveId; level: number }
  | { kind: 'item'; id: ItemId; level: number }
  | { kind: 'berry' }
  /** Max level move + its paired held item: the move evolves in place. */
  | { kind: 'evolution'; from: MoveId; to: MoveId }

export type Phase = 'playing' | 'levelup' | 'evolving' | 'paused' | 'gameover' | 'victory'

/** Fire-and-forget notifications for audio/UI. Drained by the shell every frame. */
export type GameEvent =
  | { kind: 'hit'; effective: number }
  | { kind: 'kill'; boss: boolean }
  | { kind: 'pickup' }
  | { kind: 'coin' }
  | { kind: 'heal' }
  | { kind: 'hurt' }
  | { kind: 'levelup' }
  | { kind: 'boss'; enemy: EnemyId }
  /** A wave boss ran off because the next wave's boss arrived (`chaseOffBosses`). */
  | { kind: 'bossFled'; enemy: EnemyId }
  /** A wave boss fell under half HP and enraged. */
  | { kind: 'enrage'; enemy: EnemyId }
  | { kind: 'shiny'; enemy: EnemyId }
  | { kind: 'shinyPlayer' }
  /** First shiny of a species defeated this run; the shell toasts it only when the Pokédex didn't have it yet. */
  | { kind: 'caught'; enemy: EnemyId }
  | { kind: 'thunder' }
  | { kind: 'quake' }
  /** The special attack started charging or was unleashed. */
  | { kind: 'special'; phase: 'charge' | 'release'; name: string }
  /** Aegislash swapped formes (Stance Change). */
  | { kind: 'stance'; stance: Stance }
  /** Mega Evolution (`mega.ts`): two stones to choose from dropped, the stone was found, the transformation started, the form landed, ran out, or can come back. */
  | { kind: 'megaChoice' }
  | { kind: 'megaStone' }
  | { kind: 'megaStart' }
  | { kind: 'mega'; name: string }
  | { kind: 'megaEnd' }
  | { kind: 'megaReady' }
  | { kind: 'evolve'; from: number; to: number }
  | { kind: 'evolved'; to: number }
  | { kind: 'pokeball'; offer: Offer | null }
  | { kind: 'moveEvolved'; from: MoveId; to: MoveId }
  | { kind: 'gameover' }
  | { kind: 'consumable'; item: ConsumableId }
  | { kind: 'propBreak' }
  | { kind: 'revive' }
  | { kind: 'victory' }
  /** The run walked into another biome. */
  | { kind: 'biome'; biome: BiomeId }
  | { kind: 'weather'; weather: WeatherId; prev: WeatherId }
  /** An enemy trait warned (fuse lit, beam aimed, leap started) or went off. */
  | { kind: 'trait'; trait: TraitId; phase: 'warn' | 'fire' }
  /** First time a trait shows up on screen this run (one-time explainer toast). */
  | { kind: 'traitIntro'; enemy: EnemyId; trait: TraitId }
  /** Something happened at a map event (altar, chest, Meowth…). */
  | { kind: 'mapEvent'; notice: MapEventNotice }
  /** Legendary rifts: a portal opened or closed unused, the player stepped in, won, or came back. */
  | { kind: 'riftOpen' }
  | { kind: 'riftClosed' }
  | { kind: 'riftEnter'; enemy: RiftLegend; shiny: boolean }
  | { kind: 'riftCleared'; enemy: RiftLegend; shiny: boolean }
  | { kind: 'riftExit'; outcome: 'won' | 'collapse' }
  /** Endless mode: Arceus arrived (`defeats` so far) or fell. */
  | { kind: 'reaper'; defeats: number }
  | { kind: 'reaperDown'; defeats: number }
  /** A boss, chest or rift left an egg; it goes to the incubator when the run is banked. */
  | { kind: 'egg'; tier: EggTier }
  /** Co-op: a player fainted and waits for a teammate, got back up, or left the room. */
  | { kind: 'fainted' }
  | { kind: 'revived' }
  | { kind: 'left' }

/**
 * A `GameEvent` as the run queues it. `slot` names the player it happened to
 * (stamped by `actAs`); events without one belong to the whole run.
 */
export type RunEvent = GameEvent & { slot?: number }

/** A timed player buff (X Attack, X Speed, Max Repel). `left` counts down in seconds. */
export type Buff = { id: BuffId; left: number; total: number }

export type Evolution = { from: number; to: number; t: number }

export type Game = {
  /** Multipliers this run plays with (`difficulty.ts`). */
  difficulty: Difficulty
  rng: Rng
  time: number
  phase: Phase
  nextId: number
  /** Everyone in the run, by slot. */
  players: Player[]
  /**
   * The acting player: the one a per-player system is running for (their moves,
   * special, a pickup they touched). Solo, always the only player. World systems
   * must not assume it: they go through `players` (see `players.ts`).
   */
  player: Player
  /** Co-op rules (`coop.ts`), null in solo runs. */
  coop: CoopState | null
  enemies: Enemy[]
  attacks: Attack[]
  hazards: Hazard[]
  pickups: Pickup[]
  particles: Particle[]
  texts: FloatText[]
  grid: Grid
  /** World px a screen shows: spawns and despawns are placed just outside it. */
  view: { w: number; h: number }
  /** Top-left of the screen being drawn. The shell sets it before rendering; the simulation never reads it. */
  camera: { x: number; y: number }
  shake: number
  /** Seconds the simulation stays frozen for impact (hit-stop). */
  hitstop: number
  kills: number
  /** Poké Dollars collected this run, by the whole team (already multiplied by greed). */
  coins: number
  /** This run's wild cast, drawn at the start (`game/roster.ts`), with the day's outbreak in every stage. */
  roster: Roster
  /** The day's outbreak species, or null (`game/outbreak.ts`): its kills count toward missions (`countKill`). */
  outbreak: EnemyId | null
  /** Multiplier on wild shiny odds: Shiny Charm ranks and a Lure (`shinyBoost`). */
  shinyBoost: number
  spawnBudget: number
  nextEvent: number
  bossId: number | null
  /** Breakable item sources (item balls, berry trees, tall grass) near the player. */
  props: Prop[]
  /** World cells whose prop was already broken, so it never respawns. */
  brokenProps: Set<number>
  /** Rocks, trees, mountains, towers and lakes on the map (`game/terrain.ts`). */
  terrain: TerrainState
  buffs: Buff[]
  /** Points of interest placed by the event director (`mapEvents.ts`). */
  mapEvents: MapEventsState
  /** Revives held (0 or 1), shared by the team. Auto-used on fainting. */
  revives: number
  /** Full-screen white flash strength (Explosion), decays to 0. */
  flash: number
  /** Biome the run is in (`game/biomes.ts`). */
  biome: BiomeState
  /** Weather in play (`game/weather.ts`). */
  weather: WeatherState
  /** Enemy traits already introduced this run (each gets one explainer toast), and the game time the next one may show. */
  traits: { seen: Set<TraitId>; nextIntro: number }
  /** Legendary rifts: the portal on the map, the arena and what was met this run. */
  rift: RiftState
  /** Set once the player goes on past Mewtwo (endless mode). */
  endless: EndlessState | null
  /** Species seen, defeated and caught this run, for the Pokédex (`game/dex.ts`). */
  dexLog: DexLog
  /** Eggs found this run (`eggs.ts`). */
  eggs: RunEggs
  /** Counters for missions and achievements (`game/tally.ts`). */
  tally: RunTally
  events: RunEvent[]
}
