import type { Dir8 } from '../engine/math'
import type { SeededRng } from '../engine/rng'
import type { Grid } from '../engine/spatial'
import type { HazardVisual } from '../data/bosses'
import type { WorldHazardState } from './hazards'
import type { EnemyId } from '../data/enemies'
import type { BiomeId, WeatherId } from '../data/biomes'
import type { RiftLegend } from '../data/rifts'
import type { BuffId } from '../data/consumables'
import type { BagItem, EvoItemId } from '../data/shop'
import type { ItemId } from '../data/items'
import type { TraitId } from '../data/traits'
import type { PokeType } from '../data/types'
import type { PlayableId } from '../data/hatchlings'
import type { MegaId } from '../data/megas'
import type { AbilityId, HitKind } from '../data/abilities'
import type { BranchId } from '../data/branches'
import type { AbilityState } from './abilities'
import type { LandmarkId } from '../data/landmarks'
import type { LandmarkMoment, LandmarkState, PlayerLandmarks } from './landmarks'
import type { BranchFavor } from './branch'
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
import type { LegendScene } from './legendScene'
import type { PlaceNotice, PlaceState } from './place'
import type { PlaceId, WingId } from '../data/places'
import type { SpecialState } from './special'
import type { Stance } from './stance'
import type { RunTally } from './tally'
import type { PlayerStats, StatDelta } from './stats'
import type { EnemyStatus, StatusSpec } from './status'
import type { WeatherState } from './weather'
import type { TraitState } from './traits'
import type { BossFight } from './bossFight'
import type { ModState } from './mods'
import type { DamageBonus, Ward } from './kitRules'
import type { MoveSound } from './moveVerbs'
import type { TmSource } from './tmRules'
import type { TmState } from './tms'
import type { CurseId } from '../data/curses'
import type { CurseState } from './curses'
import type { LegendaryVisual } from './legendaryMoves'
import type { LegendaryVisual2 } from './legendaryMoves2'
import type { TensionState } from './tension'
import type { AlphaClock, AlphaState } from './alphas'
import type { LegendForm, LegendId } from '../data/legends'
import type { LegendState } from './legend'
import type { CoopState } from './coop'
import type { Training } from './training'
import type { Harm, HarmBy } from './harm'

export type OwnedMove = {
  id: MoveId
  level: number
  cooldown: number
  /** The branch picked at each fork of its upgrades (bit `i` set: the second branch of step `i`; absent means 0, see `moveStats`). */
  path?: number
  /** Counts down to an Echo re-cast (`mods.ts`; absent or ≤ 0: none due). */
  echo?: number
  /** The move's own counter (`MoveDef.stacks` grows and resets it; `fire` reads it). Absent = 0. */
  stacks?: number
  /** `Player.walked` when it last fired, for `walkedSince`. */
  walkedAt?: number
  /** Sketch's painting (`sketch.ts`): the move it copied and the casts it has left. */
  sketch?: { move: MoveId; left: number }
}

/** A move's window on the player (guard, burrow): `left` seconds, and the move whose hook it calls. */
export type MoveWindow = { left: number; move: MoveId }
/** A move's timed effect on the player's stats (Rapid Spin's guard, Petal Dance's dizziness): `recomputeStats` adds `stats` while `left` lasts. */
export type MoveBuff = { move: MoveId; left: number; stats: StatDelta; applied: boolean }
export type OwnedItem = { id: ItemId; level: number }

/**
 * One player of a run: their Pokémon and everything that is theirs (moves,
 * items, picks, the special, the Mega form, the ability, cursed items, the
 * level-up charges). `Game.players` holds them all (one solo); per-player code
 * reads `g.player`, the one acting (`players.ts`).
 */
export type Player = {
  /** Index in `Game.players` (0 solo), whose input drives them and whose hitboxes say so (`Attack.owner`). */
  slot: number
  /** The Pokémon this player plays: a starter or a hatched family. */
  starter: PlayableId
  /** Permanent Poké Mart ranks this player started with. */
  ranks: Ranks
  /** What this player is doing: playing, on a pick screen of theirs, or evolving (`phaseOf`). */
  phase: PlayerPhase
  /** Where this player's screen sits in the world (its top-left), moved at the end of every step; spawns and despawns check it. */
  screen: { x: number; y: number }
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
  /** Seconds standing still (0 while walking). */
  still: number
  /** Guard window (Counter, Protect): the next hit is negated and calls the move's `onGuard` (`hurtPlayer`). */
  guard: MoveWindow | null
  /** Burrowed or out of sight (Dig, Fly): invulnerable, foes lose track; the move's `emerge` runs when it ends. */
  hidden: MoveWindow | null
  /** The last immunity window (guard or burrow) and when it last stood: another move's window waits `WARD_GAP` after it (`wardOpens`). */
  ward: Ward | null
  /** Drain heal budget (`drainRefill`) and the game time it was last spent. */
  drain: { left: number; at: number }
  /** Seconds the player can't walk (Giga Impact's recharge); moves still carry them. */
  rooted: number
  /**
   * Dark Void's sleep (`game/playerSleep.ts`): seconds left asleep (> 0: no
   * walking, moves, special or Mega), or of the drowsy spell after waking (< 0),
   * when nothing puts them back to sleep; 0 awake.
   */
  asleep: number
  /** Moves' timed stat effects on the player (`signatures.ts`). */
  moveBuffs: MoveBuff[]
  special: SpecialState
  /** Mega Stone, Mega form and its recharge (`mega.ts`). */
  mega: MegaState
  /** Level-up rerolls/skips left this run. */
  rerolls: number
  skips: number
  /** Esquecer charges left (`banishOffer`): from the Poké Mart, plus one per boss defeated and per evolution. */
  banishes: number
  /** Moves and items forgotten this run: they never come back as offers. */
  banished: Set<MoveId | ItemId>
  /** Mods of the move being cast right now (`updateMoves`), stamped on every hitbox it spawns; 0 otherwise. */
  castMods: number
  damageByMove: Partial<Record<DamageSource, number>>
  pendingLevelUps: number
  /** Level-ups left in which the moves the last evolution unlocked weigh double (`FRESH_LEVELUPS` in `learnsets.ts`). */
  freshMoves: number
  /** The cards of this player's pick screen (`phase`). */
  offers: Offer[]
  evolution: Evolution | null
  /** Where a branching evolution went (`game/branch.ts`); null until it does, and for the lines that don't branch. */
  branch: BranchId | null
  /** The ability picked at the first evolution and its running state (`game/abilities.ts`). */
  ability: AbilityState
  /** Cursed items taken from locked chests and their clocks (`curses.ts`). */
  curses: CurseState
  /** Revives held (0 or 1). Auto-used on fainting. */
  revives: number
  /** Timed effects of consumables and altars (`consumables.ts`). */
  buffs: Buff[]
  /** TM lessons taken, whether a legendary TM was learned, the TMs armed at the shop still to come, Pay Day's and Thief's loot (`game/tms.ts`). */
  tm: TmState
  /** The level-up on screen is a prize (`openPrizeLevelUp`), and where it came from; its title says so. */
  prize: PrizeSource | null
  /** Bag items this player took into the run (`game/bag.ts`), in catalog order. */
  bag: readonly BagItem[]
  /** The Bag's Max Revive is still unspent: the first faint gets back up (`tryMaxRevive`). */
  maxRevive: boolean
  /** The Bag's Everstone: this player's Pokémon never evolves (`pendingEvolution`) and its form is stronger (`boost`). */
  everstone: boolean
  /** Evolution items this player's save owns (`game/evoItems.ts`): they unlock their branches (`evolutionOffers`). */
  evoItems: readonly EvoItemId[]
  /** Evolution items this player found in the run (`game/evoGate.ts`), which unlock their branches like owned ones until it ends. */
  evoFound: EvoItemId[]
  /** The evolution is due but no branch is open without an item (Scyther, Charcadet): the Pokémon stays in its form, as strong as with an Everstone (`recomputeStats`), until one turns up. */
  evoHeld: boolean
  /** Share every stat grows by: the Pokémon's Bottle Caps and an Everstone (`runBoost`, applied by `recomputeStats`). */
  boost: number
  /** The Legend mode's state (`legend.ts`) when this player plays a legend: its awakenings; null otherwise. */
  legend: LegendState | null
  /** The wings this player picked up in places (`place.ts`, `wingDeltas`). */
  wings: Partial<Record<WingId, number>>
  /** The treasure this player is opening and the tunnel they're stepping into or walking (`landmarks.ts`). */
  landmark: PlayerLandmarks
  /**
   * Co-op: counts this player's pick screens (and every change of their cards).
   * A pick quotes the round it was made on, so one that arrives after the timer
   * or a reroll changed the screen is dropped (`lockstep.ts`).
   */
  round: number
  /** Co-op: seconds left on this player's pick screen before it picks for them (`coop.ts`). */
  pickLeft: number
  /** Co-op: the tab went to the background or the connection dropped: frozen, untargetable, picks for them at once. */
  away: boolean
  /** Co-op: left the run for good (out of play and out of the horde's scaling). */
  gone: boolean
  /** Co-op: seconds a teammate has stood by this fainted player (`COOP.revive`). */
  revive: number
  /** What this player did this run, for the end screen and their missions (`coop.ts`). */
  record: PlayerRecord
  /** The last hits this player took, oldest first (`noteHit`): the end screen's cause of the faint. Bookkeeping: the simulation never reads it. */
  hits: Harm[]
}

/** One player's run stats (damage dealt is `damageByMove`). `tally` counts their own faints only in co-op. */
export type PlayerRecord = {
  kills: number
  /** HP lost to the horde, bosses and hazards. */
  taken: number
  /** Fainted teammates this player got back up. */
  revives: number
  /** Times this player fainted (co-op). */
  faints: number
  tally: RunTally
}

export type EnemyBehavior =
  | { kind: 'chase' }
  /** Flies in a straight line and despawns after `ttl` (swarm events). */
  | { kind: 'flyby'; vx: number; vy: number; ttl: number }
  /** Walks to a field mission's nest at (x, y) and bites the egg there, turning on the player within `aggro` px (`fieldMissions.ts`). */
  | { kind: 'raid'; mission: number; x: number; y: number; aggro: number }

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
  /** Hurled by a move (Circle Throw): while its knockback is fast it hurts the foes it hits, once each. */
  thrown: Thrown | null
  /** An Alpha's charge cycle (`alphas.ts`); null for everyone else. An Alpha is also `boss` to the combat rules. */
  alpha: AlphaState | null
}

/** `by`: slot of the player whose move threw it (its blows are theirs). */
export type Thrown = { damage: number; move: DamageSource; hit: Set<number>; by: number }

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
  /**
   * Flies along (vx, vy) for `out` more seconds, then homes back to the
   * player's current position at `speed` and vanishes on arrival. Its hit list
   * clears at the turn, so it hits on both legs.
   */
  | { kind: 'return'; vx: number; vy: number; out: number; speed: number }
  /** Seeded random walk at `speed`, turning up to `turn` rad/s, steered back when farther than `leash` px from the player. */
  | { kind: 'wander'; heading: number; speed: number; turn: number; leash: number }
  /** Rolls the player along their facing at `speed` px/s on top of their walk (the stick steers), the hitbox on their body (Rollout). */
  | { kind: 'roll'; speed: number }
  /**
   * Rides on `target`'s body and hits only it, every `every` s from `next`
   * seconds of age on (Curse, Foul Play); gone when the target faints.
   * Its attack stays out of the regular collision (`activeFrom: Infinity`).
   */
  | { kind: 'tether'; target: Enemy; every: number; next: number }

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
  /** Lingering ground of a Trail mod, the blast of a Burst mod and the sparks of an Arc mod (`mods.ts`), drawn by `render/modFx.ts`. */
  | 'modTrail' | 'modBurst' | 'modArc'
  /** A delayed strike's warning on the ground (`moveKit.ts`), drawn by `render/kitFx.ts`. */
  | 'telegraph'
  | EvolvedVisual
  | TacticVisual
  | EggMoveVisual
  | EggMove3Visual
  | VerbVisual
  | SignatureVisual
  | TypeEvolvedVisual
  | TmVisual
  | VerbEvolvedVisual
  | EggMove2Visual
  | DuoVisual
  /** Legendary moves (`legendaryMoves.ts`), drawn by `render/legendaryFx.ts`. */
  | LegendaryVisual
  /** Legendary moves, second batch (`legendaryMoves2.ts`), drawn by `render/legendaryFx2.ts`. */
  | LegendaryVisual2

/** What dealt the damage, for the results screen: a move, the special or the ability (Rough Skin, Magic Bounce). */
export type DamageSource = MoveId | 'special' | 'ability'

/** Visuals of evolved moves, drawn by `render/evolved.ts` (casts in `game/evolvedMoves.ts`). */
export type EvolvedVisual =
  | 'flamethrower' | 'flameField' | 'fireBlast' | 'starFlame' | 'hydroPump' | 'pumpSplash' | 'surf' | 'leafStorm'
  | 'powerWhip' | 'triFire' | 'triIce' | 'triBolt' | 'triPrism' | 'wildbolt' | 'wildFork' | 'stormCloud'
  | 'gunkBomb' | 'gunk' | 'toxicCloud' | 'hurricane' | 'infernoRing' | 'icicleFall' | 'blizzard' | 'snowSwirl'
  | 'stoneEdge' | 'megahorn' | 'outrage' | 'outrageRoar' | 'boltStrike'
  /** A bare hit segment that draws nothing (the inner part of Power Whip's vine). */
  | 'hitbox'

/** Moves evolved by the newer type items and generic ones (`typeEvolutions.ts`), drawn by `render/typeEvolved.ts`. */
export type TypeEvolvedVisual =
  | 'jawLock' | 'jawBite' | 'superFist' | 'superJab' | 'fissure' | 'psyVortex' | 'psyBurst' | 'steelBeam'
  | 'parade' | 'phantomVolley' | 'phantomFall' | 'phantomArrow' | 'aquaCutter' | 'searing' | 'searingEmber'
  | 'gigaDrain' | 'jealousySong' | 'jealousy' | 'trailblaze' | 'liquidation' | 'alluring'

/** Lunges, chains, mines and turrets (`moveRules.ts`), drawn by `render/moveFx.ts`. */
export type TacticVisual =
  | 'quick' | 'extremeSpeed' | 'shock' | 'thunderbolt' | 'hex'
  | 'spikes' | 'barbs' | 'spikesBlast' | 'barbsBlast'
  | 'wisp' | 'wispShot' | 'inferno' | 'infernoShot'

/** The egg families' signature moves (`eggMoves.ts`), drawn by `render/eggMoveFx.ts`. */
export type EggMoveVisual =
  | 'hypnosis' | 'dreamBite' | 'forcePalm' | 'auraWave' | 'digMound' | 'digBurst' | 'twister' | 'sandTomb'
  | 'meteorMash' | 'zenHeadbutt' | 'foulPlay' | 'bodySlam' | 'slamWave' | 'dynamicPunch' | 'rollout' | 'iceBall'
  | 'furyCutter' | 'sacredSword' | 'sacredEdge' | 'dragonDart' | 'snarl' | 'gigaImpact' | 'gigaWave' | 'flail'
  | 'boneRush' | 'metronome' | 'echoedVoice' | 'curse' | 'sketch'
/** The third batch of egg signatures (`eggMoves3.ts`), drawn by `render/eggMove3Fx.ts`. */
export type EggMove3Visual =
  | 'fieryDance' | 'overdrive' | 'gigatonHammer' | 'hammerTap' | 'hammerQuake' | 'bitterBlade' | 'leechLife' | 'fireFang'
  | 'furySwipes' | 'heavySlam' | 'heavyQuake' | 'bulldoze' | 'perishWave' | 'perishMark' | 'chargeBeam' | 'moonblast'
  | 'moonBurst' | 'frostBreath' | 'avalanche'
/** The second batch of egg-family signature moves (`eggMoves2.ts`), drawn by `render/eggMove2Fx.ts`. */
export type EggMove2Visual =
  | 'braveBird' | 'weatherBall' | 'accelerock' | 'zapCannon' | 'aerialAce' | 'crossPoison' | 'bubbleBeam' | 'rockBlast'
  | 'cottonSpore' | 'wildCharge' | 'playRough' | 'spore' | 'waterfall' | 'lastResort'
/** The verb moves (`moveVerbs.ts`), drawn by `render/verbFx.ts`. */
export type VerbVisual =
  | 'flameWheel' | 'flameTrail' | 'solarCharge' | 'solarBeam' | 'brine' | 'electroBall' | 'venoshock' | 'selfDestruct'
  | 'roostGust' | 'focusPunch' | 'focusShock' | 'gyroBall' | 'suckerPunch' | 'futureSight' | 'bone' | 'stealthRock'
  | 'uTurn' | 'dragonTail' | 'sheerCold'
/** The verb moves' evolutions (`verbEvolutions.ts`), drawn by `render/verbEvolvedFx.ts`. */
export type VerbEvolvedVisual =
  | 'ragingFury' | 'furyBlaze' | 'furyNova' | 'seedSun' | 'seedFlare' | 'seedBloom' | 'waterSpout' | 'spoutDrop'
  | 'electroDrift' | 'driftLink' | 'sludgeWave' | 'sludgeGeyser' | 'explosion' | 'explosionChain' | 'oblivionWing'
  | 'oblivionBeam' | 'skyUppercut' | 'uppercutShock' | 'gearGrind' | 'kowtowCleave' | 'hyperspaceHole' | 'hyperspaceBurst'
  | 'thousandArrows' | 'stoneAxe' | 'axeSplinter' | 'firstImpression' | 'impressionBurst' | 'breakingSwipe'
  | 'glacialLance' | 'lanceBurst'
/** Starter signature moves (`signatureMoves.ts`), drawn by `render/signatureFx.ts`. */
export type SignatureVisual =
  | 'leechSeed' | 'rapidSpin' | 'petal' | 'eruptionFall' | 'eruption' | 'thrash' | 'thrashBite' | 'kick'
  | 'mudWave' | 'hammer' | 'drill' | 'leafTornado' | 'tornadoLeaf' | 'flameCharge' | 'flameLanding'
  | 'needleArm' | 'needle' | 'psybeam' | 'lariat' | 'bubble' | 'bubblePop' | 'snipeSight' | 'snipeShot'
  | 'flowerTrick' | 'aquaStep' | 'pinShadow' | 'pyroBounce' | 'sonicJab'

/** TM moves (`tmMoves.ts`), drawn by `render/tmFx.ts`. */
export type TmVisual =
  | 'rockSlide' | 'yawn' | 'iceBeam' | 'discharge' | 'heatWave' | 'thunderFang' | 'lavaPlume' | 'lavaPool' | 'auroraBeam'
  | 'meteorRise' | 'meteor' | 'icyWind' | 'ironHead' | 'ironShard' | 'psystrike' | 'psyHover'
  /** The shop-exclusive TMs (`shopTmMoves.ts`), drawn by `render/shopTmFx.ts`. */
  | 'payDay' | 'thief' | 'protect' | 'hyperBeam' | 'hyperCharge'
  /** Their second batch (`shopTmMoves2.ts`), drawn by `render/shopTmFx2.ts`: the called skies' markers and what falls from them, the swords, the fist, the wave, the flight and its landing. */
  | 'rainDance' | 'rainDrop' | 'sunnyDay' | 'sunBeam' | 'swordsDance' | 'drainPunch' | 'thunderWave' | 'flyLift' | 'flySlam'
/** Duo moves (`duoMoves.ts`), drawn by `render/duoFx.ts`. */
export type DuoVisual =
  | 'pledgePillar' | 'seaOfFire' | 'swamp' | 'comet' | 'cometScorch' | 'ionPuddle' | 'freezeDry' | 'nightmare' | 'nightmareSkull'

/** A static attack that shoots at the nearest foe every `every` seconds (Will-O-Wisp). Its shots copy its damage and status. */
export type Turret = { every: number; left: number; amount: number; speed: number; shot: Visual }

/**
 * Drops a lingering patch every `every` px the player walks (`moveKit.trailer`).
 * Patches copy the carrier's move, type and status, at `share` of its damage.
 */
export type Trailer = { every: number; acc: number; walked: number; visual: Visual; r: number; ttl: number; hitInterval: number; share: number }

/** Any damaging hitbox: projectiles, auras, strikes, zones. */
export type Attack = {
  id: number
  /** Slot of the player who cast it: its hits, kills and heals are theirs (`updateAttacks` acts as them). */
  owner: number
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
  /** Behavior mods of the fork branch it was cast with (`mods.ts`), or null. */
  mod: ModState | null
  /** Damage bonuses against some foes (`kitRules.ts`), e.g. Hex's ×1.7 on afflicted ones. */
  bonus: readonly DamageBonus[]
  /** Regular foes left at or under this HP share faint outright (0 = never). */
  execute: number
  /** Share of the damage dealt that heals the player, within the drain budget (0 = none). */
  drain: number
  /** Px/s it pulls the foes it touches toward its center, divided by their mass (bosses resist more). */
  pull: number
  trailer: Trailer | null
  /** Ignores Bronzong wards and resisted matchups (a resisted hit lands as neutral): Sacred Sword, Curse. */
  sure: boolean
  /** Chance that a foe touching it misses its contact hit on the player (Sand Tomb's sand in their eyes). */
  blind: number
  /** A free intensity counter for the move's rules and look (Rollout's streak, Echoed Voice's echo); 0 by default. */
  tier: number
  /** Goes through a Bronzong ward instead of being soaked by it (Darkest Lariat, Snipe Shot). */
  ignoreWards: boolean
  /** A number the move keeps on its hitbox (Thrash's bite timer, Snipe Shot's base damage…), read by `signatures.ts` and the renderer. */
  memo: number
}

/** Enemy-owned hitbox that hurts the player (boss attacks). */
export type Hazard = {
  id: number
  /** strike = telegraphed impact, shot = projectile, zone = lingering patch, beam = a line from (x, y) (`angle`, `len`). */
  kind: 'strike' | 'shot' | 'zone' | 'beam'
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
  /** Thrown by the world rather than a boss (`game/hazards.ts`): its strikes also hurt the foes they land on. */
  world: boolean
  /** Id of the boss that lands with this strike (a `leap`), or -1. A shot with an `armAt` hovers until then (a volley's windup). */
  leaper: number
  /** A beam's direction (rad), length (px) and turn while it burns (rad/s); `r` is half its width. 0 for the rest. */
  angle: number
  len: number
  spin: number
  /**
   * Wind (whirlpools, gusts): while it can hurt, a player within `pullReach`
   * px is drawn toward its center at `pull` px/s (negative: blown away). 0 for the rest.
   */
  pull: number
  pullReach: number
  /** A sweeping beam that stops at the first cover each tick: its full length (`len` follows the cover). 0 for the rest. */
  cover: number
  /** A phantom (`swoop`): the dex of the Pokémon whose see-through copy rides this shot, or 0. */
  phantom: number
  /** Dark Void: seconds of sleep a hit puts the player into (`sleepPlayer`), or 0. */
  sleep: number
  /** Who threw it, for the end screen's cause of a faint (`Harm`); null for the world's own (`world`). */
  by: HarmBy | null
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
  /** Co-op: the slot of the player it's pulled toward (unset solo). */
  to?: number
  /** Co-op: dropped for this slot alone (their Mega Stone, legendary TM, a boss's TM or Poké Ball); unset means anyone's. */
  owner?: number
} & ({ kind: 'xp'; value: number } | { kind: 'coin'; value: number } | { kind: 'berry' } | { kind: 'pokeball' } | { kind: 'megaStone'; mega: MegaId } | { kind: 'consumable'; item: ConsumableId } | { kind: 'tm'; move: MoveId; source: TmSource } | { kind: 'alphaPrize' } | { kind: 'treat' } | { kind: 'evoItem'; item: EvoItemId })

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

/**
 * How lucky a level-up card came out (`rollOffers`): a rare one gives two
 * levels at once, a shiny one doesn't use the level-up up (the player picks again).
 */
export type Rarity = 'rare' | 'shiny'

export type Offer =
  | { kind: 'move'; id: MoveId; level: number; rarity?: Rarity }
  | { kind: 'item'; id: ItemId; level: number; rarity?: Rarity }
  | { kind: 'berry' }
  /** Max level move + its paired held item: the move evolves in place. */
  | { kind: 'evolution'; from: MoveId; to: MoveId }
  /** Where a branching evolution goes (`game/branch.ts`); `favor` says what of the run nudged it forward. */
  | { kind: 'form'; id: BranchId; favor: BranchFavor }
  /** An ability to keep for the run, picked when the first evolution lands (`game/abilities.ts`). */
  | { kind: 'ability'; id: AbilityId; hidden: boolean }
  /** One way of a fork (`moveStats`): raises the move to `level` taking `branch` (0 or 1). */
  | { kind: 'branch'; id: MoveId; level: number; branch: 0 | 1; rarity?: Rarity }
  | TmOffer
  /** The move to forget so a TM's move takes its slot (`game/tms.ts`). */
  | { kind: 'forget'; id: MoveId; tm: TmOffer }
  /** Walks away from a TM (the disc, the lesson or the forgetting) or from a Poké Ball's new move or item. */
  | { kind: 'pass' }
  /** Two maxed moves of a recipe's types fuse into a duo move (`duoRules.ts`): `from[0]`'s slot takes it, `from[1]`'s frees up. */
  | { kind: 'duo'; to: MoveId; from: readonly [MoveId, MoveId] }
  /** A locked chest's cursed item (`curses.ts`): take it, or leave it there. */
  | { kind: 'curse'; id: CurseId; take: boolean }

/** A TM's move to learn (or raise to `level` if owned), from a disc, a Move Tutor (for `price` run ₽) or a rift legendary. */
export type TmOffer = { kind: 'tm'; id: MoveId; level: number; source: TmSource; price: number }

/**
 * `branch`, `ability`, `curse`, `tm` and `pokeball` wait on a pick from `offers`, like `levelup`: where an evolution goes,
 * the ability after the first, whether to take a locked chest's cursed item, a TM's move to learn (and which to forget
 * for it), and whether to take a Poké Ball's new move or item.
 */
/** A player's own phase: playing, one of their pick screens, or their evolution playing. */
export type PlayerPhase = 'playing' | 'levelup' | 'branch' | 'evolving' | 'ability' | 'curse' | 'tm' | 'pokeball'

/** The world's phase: a player's (the world waits on their pick or evolution), or paused or over. */
export type Phase = PlayerPhase | 'paused' | 'gameover' | 'victory'

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
  /**
   * Co-op only (`shakeScreen`): the screen shook `amount` px, the acting player's own doing (`own`), a whole
   * team's moment (`team`) or at a spot in the world (`spot`, at `x`, `y`; 0 otherwise). Each screen shakes its own.
   */
  | { kind: 'shake'; amount: number; from: 'own' | 'team' | 'spot'; x: number; y: number }
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
  /** A branching evolution waits on the player's pick. */
  | { kind: 'branchChoice' }
  /** An evolution item found in the run (`game/evoGate.ts`). */
  | { kind: 'evoItem'; item: EvoItemId }
  /** The evolution waits for one of these items: the run stays in its form, stronger (`Game.evoHeld`). */
  | { kind: 'evoHeld'; items: readonly EvoItemId[] }
  /** The ability was picked, or did something worth a word (Sturdy held, a guard blocked, a weather called). */
  | { kind: 'ability'; id: AbilityId; moment: 'picked' | 'proc' }
  | { kind: 'evolved'; to: number }
  /** A Poké Ball opened: its prize went in on its own (`auto`), or a new move or item was `found` and then `taken` or `left`. */
  | { kind: 'pokeball'; offer: Offer | null; moment: 'auto' | 'found' | 'taken' | 'left' }
  /** A shiny level-up card was picked: the player picks again. */
  | { kind: 'shinyOffer' }
  /** A level-up card was forgotten (Esquecer) and its slot drawn again. */
  | { kind: 'banish' }
  | { kind: 'moveEvolved'; from: MoveId; to: MoveId }
  /** Two moves fused into a duo move. */
  | { kind: 'duoFused'; from: readonly [MoveId, MoveId]; to: MoveId }
  /** A cursed item turned up in a chest, was taken or left, or bit back (Life Orb's recoil, Flame Orb's burn). */
  | { kind: 'curse'; id: CurseId; moment: 'found' | 'taken' | 'left' | 'recoil' }
  /** The run is over: what landed the last hit (the foe's species, none for a hazard, and the kind of hit), for analytics. */
  | { kind: 'gameover'; foe: EnemyId | null; hit: HitKind }
  | { kind: 'consumable'; item: ConsumableId }
  | { kind: 'propBreak' }
  /** A haunted run's candy (a treat, not an Exp. Candy) picked up (`game/halloween.ts`). */
  | { kind: 'treat' }
  /** A jack-o'-lantern cracked open: a treat (`ghost` null) or a trick, a ring of that ghost. */
  | { kind: 'trickOrTreat'; ghost: EnemyId | null }
  /** A haunted run's night boss fell (`HALLOWEEN.bosses`): one for the Caça aos Fantasmas. */
  | { kind: 'nightBoss'; enemy: EnemyId }
  /** A boss's Disguise took a hit and broke (`BOSS_DISGUISE`). */
  | { kind: 'disguise'; enemy: EnemyId }
  | { kind: 'revive' }
  /** The Bag's Max Revive got the player back up. */
  | { kind: 'maxRevive' }
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
  | { kind: 'riftFall'; enemy: RiftLegend }
  | { kind: 'riftExit'; outcome: 'won' | 'collapse' | 'fallen' }
  /** Endless mode: Arceus arrived (`defeats` so far) or fell. */
  | { kind: 'reaper'; defeats: number }
  | { kind: 'reaperDown'; defeats: number }
  /** A boss, chest or rift left an egg; it goes to the incubator when the run is banked. */
  | { kind: 'egg'; tier: EggTier }
  /** A landmark was named, its treasure opened, or the player went into or out of a tunnel (`landmarks.ts`). */
  | { kind: 'landmark'; landmark: LandmarkId; moment: LandmarkMoment }
  /** Something happened at a place: its entrance, the way in and out, what goes on inside (`place.ts`). */
  | { kind: 'place'; place: PlaceId; notice: PlaceNotice }
  /** A foe shattered: an execute, or a frozen foe's ice broken by a hit. */
  | { kind: 'shatter'; cause: 'execute' | 'freeze' }
  /** A guard window negated a hit. */
  | { kind: 'guard' }
  /** Thief stole an Alpha's or a boss's held item (`shopTmMoves.ts`). */
  | { kind: 'stolen' }
  /** A verb move asks for its sound (`moveVerbs.ts`). */
  | { kind: 'moveSound'; sound: MoveSound }
  /** A move with a cast sound fired, or its big moment landed (`ui/castSounds.ts`, then `ui/castSfx.ts`, pick the sound). */
  | { kind: 'cast'; move: MoveId }
  /** A TM's choice opened (a disc touched, a Move Tutor's lesson). */
  | { kind: 'tm'; source: TmSource }
  /** A TM's move was learned (`level` 1) or raised, maybe in place of the move `forgot`. */
  | { kind: 'tmLearned'; move: MoveId; level: number; forgot: MoveId | null; source: TmSource }
  /** A TM disc's move was already mastered: it turned into ₽. */
  | { kind: 'tmMastered'; move: MoveId; coins: number }
  /** An Alpha (`alphas.ts`) came, aimed or started a charge, landed its shockwave, enraged or fell. */
  | { kind: 'alpha'; enemy: EnemyId; moment: 'spawn' | 'aim' | 'charge' | 'shock' | 'enrage' | 'down' }
  /** The Alpha's prize was picked up: a level-up of rare cards opens. */
  | { kind: 'alphaPrize' }
  /** The world struck at the player for the first time this run (`game/hazards.ts`): a one-time explainer toast. */
  | { kind: 'hazardIntro' }
  /** Legend mode (`legend.ts`): an awakening (`n`, 1 or 2) started, or landed, maybe in its `form` (Primal Kyogre). */
  | { kind: 'awaken'; legend: LegendId; n: number }
  | { kind: 'awakened'; legend: LegendId; n: number; form: LegendForm | null }
  /** A legendary boss fell (rift, trio, mythical, Mewtwo, Arceus), once per defeat: the save counts it toward capturing it. */
  | { kind: 'legendBeaten'; legend: EnemyId; shiny: boolean }
  /** A boss with phases moved on to phase `phase` (from 0), or began its ultimate (`move`, the official English name). */
  | { kind: 'bossPhase'; enemy: EnemyId; phase: number }
  | { kind: 'bossUltimate'; enemy: EnemyId; move: string }
  /** Epic rifts (`game/domain.ts`): the omen took the sky, the legendary showed itself (its title card), the capture's ball settled. */
  | { kind: 'riftOmen'; enemy: RiftLegend }
  | { kind: 'riftTitle'; enemy: RiftLegend; shiny: boolean }
  | { kind: 'riftCapture'; enemy: RiftLegend; shiny: boolean }
  /** A moment of a domain's own mechanics the shell calls out (Dialga's time skips): `rifts.domains[enemy].cues[cue]` in `src/i18n`. */
  | { kind: 'domainCue'; enemy: RiftLegend; cue: string }
  /** The acting player fell asleep (Dark Void, `game/playerSleep.ts`). */
  | { kind: 'playerSleep' }
  /** A boss raised its barrier (`guard`), or its last keeper broke (`up: false`). */
  | { kind: 'bossGuard'; enemy: EnemyId; up: boolean }
  /** A linked pair (`game/domainPair.ts`): `enemy` was knocked out and `partner` fights on enraged, or `enemy` revived `partner`. */
  | { kind: 'pairDown'; enemy: EnemyId; partner: EnemyId }
  | { kind: 'pairRevive'; enemy: EnemyId; partner: EnemyId }
  /** A wave legendary on the map (`legendScene.ts`) showed itself (its title card), or its capture's ball settled. */
  | { kind: 'legendTitle'; enemy: EnemyId; shiny: boolean }
  | { kind: 'bossCapture'; enemy: EnemyId; shiny: boolean }
  /** Co-op: a player fainted (their Poké Ball lies there), got back up (`by` the teammate who stood by them), left, went away or came back. */
  | { kind: 'fainted'; slot: number }
  | { kind: 'revived'; slot: number; by: number }
  | { kind: 'left'; slot: number }
  | { kind: 'away'; slot: number; away: boolean }
  /** Co-op: a vote for the endless mode was cast, or the vote ended (`outcome`). */
  | { kind: 'vote'; slot: number; endless: boolean }
  | { kind: 'voted'; outcome: 'endless' | 'over' }

/** A timed player buff (X Attack, X Speed, Max Repel). `left` counts down in seconds. */
export type Buff = { id: BuffId; left: number; total: number }

/** An evolution's scene: dex `from` → `to`. A legend's awakening (`awakening`: 1 or 2) plays it too, landing in its `form` where it takes one. */
export type Evolution = { from: number; to: number; t: number; awakening?: number; form?: LegendForm }

export type Game = {
  /** Multipliers this run plays with (`difficulty.ts`). */
  difficulty: Difficulty
  /** The run's rng; its state is plain data on it (`rng.state`), so snapshots carry it. */
  rng: SeededRng
  /** The run clock, in seconds: it stops inside a rift (`clockRuns`). */
  time: number
  /** What the world is doing: playing, paused, over, or held while players pick or evolve (`setPhase`). */
  phase: Phase
  nextId: number
  /** Everyone in the run, by slot (one solo). */
  players: Player[]
  /** The player acting right now: per-player systems run as each player in turn (`actAs`); the first one otherwise. */
  player: Player
  enemies: Enemy[]
  attacks: Attack[]
  hazards: Hazard[]
  pickups: Pickup[]
  particles: Particle[]
  texts: FloatText[]
  grid: Grid
  view: { w: number; h: number }
  /** Where the screen drawn sits: the first player's (`followPlayers`); a co-op shell aims it at its own player. */
  camera: { x: number; y: number }
  /** The screen shake (px), fading (`updateEffects`); raised with `shakeScreen`. */
  shake: number
  /** Seconds the simulation stays frozen for impact (hit-stop). Solo only: in co-op it counts down without freezing. */
  hitstop: number
  /** World seconds left in which a new hitstop is dropped (`HITSTOP_REST`): back-to-back impacts freeze once. */
  hitstopRest: number
  kills: number
  /** Poké Dollars collected this run (already multiplied by greed). */
  coins: number
  /** This run's wild cast, drawn at the start (`game/roster.ts`), with the day's outbreak in every stage. */
  roster: Roster
  /** The day's outbreak species, or null (`game/outbreak.ts`): its kills count toward missions (`countKill`). */
  outbreak: EnemyId | null
  /** Noite das Bruxas (`game/halloween.ts`): the run is haunted, a run input like the outbreak. */
  halloween: boolean
  /** Candies collected this run (a haunted one), banked into the save's jar at the end. */
  candies: number
  /** Multiplier on wild shiny odds: Shiny Charm ranks and a Lure (`shinyBoost`). */
  shinyBoost: number
  spawnBudget: number
  nextEvent: number
  bossId: number | null
  /** Breakable item sources (item balls, berry trees, tall grass) near the player. */
  props: Prop[]
  /** World cells whose prop was already broken, so it never respawns. */
  brokenProps: Set<number>
  /** Rocks, trees, mountains, towers, lakes and landmarks on the map (`game/terrain.ts`). */
  terrain: TerrainState
  /** The landmarks' treasures taken, names shown and the tunnel being walked (`game/landmarks.ts`). */
  landmarks: LandmarkState
  /** Points of interest placed by the event director (`mapEvents.ts`). */
  mapEvents: MapEventsState
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
  /** Places (`place.ts`): the entrance on the map, the inside the player is in and the wings picked up. */
  place: PlaceState
  /** Move Tutors met this run (their tent's odds, `mapEvents.ts`). */
  tutors: number
  /** Set once the player goes on past Mewtwo (endless mode). */
  endless: EndlessState | null
  /** Species seen, defeated and caught this run, for the Pokédex (`game/dex.ts`). */
  dexLog: DexLog
  /** Eggs found this run (`eggs.ts`). */
  eggs: RunEggs
  /** Counters for missions and achievements (`game/tally.ts`). */
  tally: RunTally
  events: GameEvent[]
  /** The pressure director (`tension.ts`): a dominant player gets a faster, closer, nastier horde. */
  tension: TensionState
  /** When the next Alpha is due (`alphas.ts`). */
  alphas: AlphaClock
  /** The world's own attacks on the player (`game/hazards.ts`). */
  worldHazards: WorldHazardState
  /**
   * Seconds simulated since the run began, never paused. `time` is the run
   * clock, which stops inside a rift; hit cooldowns, ages and animation phases use `now`.
   */
  now: number
  /** A wave legendary's entrance or capture playing on the map, with the world held still (`legendScene.ts`). */
  legendScene: LegendScene | null
  /** Co-op rules state (`coop.ts`): held sticks, the endless vote, pause time. Null solo. */
  coop: CoopState | null
  /** The Dojo (`training.ts`): the run is a training session, with dummies instead of a horde. Null in every other run. */
  training: Training | null
}

/** Where a prize level-up came from: an Alpha's gem or a field mission. */
export type PrizeSource = 'alpha' | 'mission'
