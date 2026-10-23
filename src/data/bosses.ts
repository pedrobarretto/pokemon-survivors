import type { Difficulty } from '../game/difficulty'
import { DOMAIN_PHASES, type RetinueRole } from './domains'
import { WAVE_LEGEND_PHASES } from './legendBosses'
import type { EnemyId } from './enemies'

/** How an enemy hazard looks (and sounds when it lands). */
export type HazardVisual =
  | 'rock' | 'slam' | 'thunder' | 'ice' | 'fire' | 'psychic' | 'water' | 'dragon' | 'steel' | 'aero' | 'grass' | 'shadow' | 'judgment'
  /** Toxic Spikes and the like, thrown by the world (`game/hazards.ts`). */
  | 'poison'
  /** The horde's spit shots (`game/spitters.ts`), one look per flavor; `sludge` also names its puddle. */
  | SpitVisual
  /** The Eon duo's colors: Latias's red Mist Ball, Latios's blue Luster Purge (both Psychic). */
  | 'mist' | 'luster'

export type SpitVisual = 'fireball' | 'bubble' | 'sludge' | 'spark' | 'seed' | 'orb'

/**
 * A wave boss fights in two stances it swaps every few seconds (`BOSS_RAGE.stance`):
 * `close` rushes the player with attacks around itself, `ranged` hangs back
 * (`STANCES`) and aims at the player from afar.
 */
export type BossStance = 'close' | 'ranged'

/**
 * When a wave boss's pattern may fire. `stance`: only in that stance (and it
 * only counts down there). `below`: only once the boss is under that share of
 * its HP (the enrage's unlock, a later phase). `from`: only from that
 * difficulty up. `far`: only while the player stands at least that far (px),
 * so keeping away is punished too; it waits, ready, until they do. Rift
 * legendaries and Arceus don't fight in stances and use none of them.
 */
export type PatternGate = { stance?: BossStance; below?: number; from?: Difficulty; far?: number }

/**
 * Boss attack patterns. Each one fires every `every` seconds while the boss is
 * near the player. Damage is contact damage dealt to the player.
 */
export type BossPattern = PatternGate &
  (
    /**
     * Telegraphed circles that land after `delay` seconds, around the player or the boss itself.
     * `lead` (player only) lays them along the player's path instead of scattering them: the
     * first where they stand, the last where they'd be at `lead` × `delay` if they kept going
     * (times the difficulty's `aim`); a single led circle lands at that end.
     * `leap` (one circle on the player): the boss lands there itself as it hits.
     * `share`: each hits for at least that share of the player's max HP (a pin, which only
     * ever finds a player standing still, keeps up with a tougher one).
     */
    | { kind: 'strikes'; every: number; target: 'player' | 'self'; count: number; spread: number; radius: number; delay: number; damage: number; visual: HazardVisual; lead?: number; leap?: true; share?: number }
    /**
     * A ring of projectiles fired outward from the boss. `around` (px) instead
     * closes it on the player: the shots show on a circle that far around them,
     * hover for `windup` s, then fly inward. `gap` (rad) leaves an arc of the
     * ring open at a random angle, the way out.
     */
    | { kind: 'ring'; every: number; count: number; speed: number; radius: number; damage: number; visual: HazardVisual; around?: number; windup?: number; gap?: number }
    /** Lingering zones dropped at the boss's feet as it moves. */
    | { kind: 'trail'; every: number; ttl: number; radius: number; damage: number; visual: HazardVisual }
    /**
     * A fan of `count` projectiles across `arc` radians, aimed where the player
     * stands: they hover by the boss for `windup` seconds, aim lines showing, then fly.
     */
    | { kind: 'volley'; every: number; count: number; arc: number; speed: number; windup: number; radius: number; damage: number; visual: HazardVisual }
    /**
     * Beams (Hydro Pump, Aeroblast, Origin Pulse's lances): `count` lines `width`
     * px wide and `length` long, shown as blinking telegraphs for `windup` s, then
     * burning for `duration` s. `source: 'boss'`: out of the boss, `spread` rad
     * apart around the aim at the player, each sweeping `sweep` rad across its
     * burn (0 or absent: static; a static one stops at the first cover in its way
     * when `blocked`). `source: 'edge'`: parallel lances from past the screen's
     * edge at a random angle, `spread` px apart, the middle one through the
     * player; the gaps between them are the safe lanes. `source: 'lattice'`: two
     * such sets at right angles (the second in `cross`'s look), crossing on the
     * player; the pockets where their gaps meet are the safe spots.
     */
    | { kind: 'beam'; every: number; source: 'boss' | 'edge' | 'lattice'; count: number; spread: number; sweep?: number; windup: number; duration: number; width: number; length: number; damage: number; visual: HazardVisual; blocked?: true; cross?: HazardVisual }
    /** Adds: `count` of `enemies` (taken in turn) come out `radius` px around the boss, while fewer than `max` of them stand; `role` as in a domain's retinue. */
    | { kind: 'summon'; every: number; enemies: readonly EnemyId[]; count: number; max: number; radius: number; role?: RetinueRole }
    /** A charge: the boss marks a lane through the player for `windup` s, then rushes down it at `speed` px/s, `count` times in a row, hurting on contact. */
    | { kind: 'dash'; every: number; windup: number; speed: number; width: number; damage: number; count: number }
    /**
     * A flyer's pass (Extreme Speed, Dragon Ascent): the boss leaves the arena,
     * comes back `reach` px from the player on a random side, marks a lane
     * through them across the arena for `windup` s, then streaks down it at
     * `speed` px/s, `count` times from new sides, hurting on contact; it lands
     * back home after the last.
     */
    | { kind: 'swoop'; every: number; windup: number; speed: number; width: number; damage: number; count: number; reach: number }
    /** The boss goes under (untouchable) for `hide` s while its wake follows the player, then the wake stops and it bursts out there `windup` s later. */
    | { kind: 'dive'; every: number; hide: number; windup: number; radius: number; damage: number; visual: HazardVisual }
    /** The boss vanishes and lands `windup` s later on the spot it marked: on the player, or as far from them as its arena allows, striking around itself. */
    | { kind: 'teleport'; every: number; to: 'player' | 'far'; windup: number; radius: number; damage: number; visual: HazardVisual }
    /**
     * A blast over everything after `windup` s (the screen dims and the safe
     * spots glow) that only spares those in a `safe` spot (`BlastSafe`);
     * `spots` shelters for `safe: 'spots'` (3 when absent).
     */
    | { kind: 'blast'; every: number; windup: number; damage: number; safe: BlastSafe; radius?: number; visual: HazardVisual; spots?: number }
    /**
     * Whirlpools (Lugia's Hurricane): `count` vortices, one on the player
     * (or the boss, `target: 'self'`) and the rest `spread` px around, each
     * showing for `windup` s, then for `ttl` s drawing the player in from
     * `reach` px at `pull` px/s; their eye (`radius`) hurts.
     */
    | { kind: 'whirlpool'; every: number; target: 'player' | 'self'; count: number; spread: number; radius: number; reach: number; pull: number; windup: number; ttl: number; damage: number; visual: HazardVisual }
    /** Gusts (Whirlwind): a fan like a volley whose shots shove a player within `reach` px along their flight at `push` px/s. */
    | { kind: 'gust'; every: number; count: number; arc: number; speed: number; windup: number; radius: number; reach: number; push: number; damage: number; visual: HazardVisual }
    /** Roar of Time: `windup` s after it roars, the player's shots in flight (and those cast meanwhile) hold still for `duration` s, then fly on. */
    | { kind: 'timeStop'; every: number; windup: number; duration: number }
    /**
     * Phantoms (see-through copies of the boss, Double Team, Latias's mirages)
     * streak along lanes through where the player stands: `count` of them, `gap`
     * s apart, each lane marked `windup` s before it rushes at `speed` px/s. They
     * start at the boss (`origin: 'boss'`) or on a ring `radius` px around the player.
     */
    | { kind: 'phantoms'; every: number; origin: 'boss' | 'ring'; count: number; gap: number; windup: number; speed: number; width: number; radius: number; damage: number; visual: HazardVisual }
    /**
     * A barrier (Deoxys's Defense Forme): `count` of `enemies` (taken in turn)
     * stand on posts `radius` px around the boss's home with `hp` times their HP,
     * linked to it; while one stands the boss takes no damage. Raised again
     * `every` s after the last one breaks.
     */
    | { kind: 'guard'; every: number; enemies: readonly EnemyId[]; count: number; radius: number; hp: number }
    /**
     * A cage (Rock Tomb, a wall of fire): `count` lingering zones of `size` px on
     * a circle of `radius` px around the player, shown for `windup` s, then
     * burning until `ttl`: the player is shut in with whatever falls inside.
     */
    | { kind: 'cage'; every: number; radius: number; count: number; size: number; windup: number; ttl: number; damage: number; visual: HazardVisual }
  ) & {
    /** Judgment: the attack takes the type (and look) of the biome's plate instead of its `visual` (`JUDGMENT_PLATE`). */
    plate?: true
    /** Dark Void: what it throws (or its blast) puts a player it hits to sleep for this many seconds (`game/playerSleep.ts`). */
    sleep?: number
  }

/**
 * What a blast spares: `cover`, a player with scenery between them and the
 * boss; `dry`, one out of flood water (an island); `near`/`far`, within or
 * beyond its `radius` of the boss; `spots`, one inside any of the blast's
 * `spots` shelters, circles of `radius` px marked around the player as it
 * charges (the overworld has no arena to hide in).
 */
export type BlastSafe = 'cover' | 'dry' | 'near' | 'far' | 'spots'

/**
 * How a boss with phases walks (`BossPhase.steer`): `chase` at the player (the
 * default), `hold` about `range` px away, `anchor` near its home (where it
 * appeared) plus (x, y), wandering `drift` px, `orbit` its home at
 * `radius`, or `mirror` its linked partner across its home (in tandem, Latios
 * opposite Latias; circling at `radius` while the partner is out); a circling
 * one with `keep` veers off a player closer than that (px), so hugging it doesn't
 * pay. `pace` multiplies its speed.
 */
export type BossSteer =
  | { kind: 'chase'; pace?: number }
  | { kind: 'hold'; range: number; pace?: number }
  | { kind: 'anchor'; x: number; y: number; drift: number; pace?: number }
  | { kind: 'orbit'; radius: number; pace?: number; keep?: number }
  /** Flies across its arena through its home, turning `reach` px out every `every` s on a new heading; drawn aloft over its shadow. */
  | { kind: 'pass'; reach: number; every: number; pace?: number }
  | { kind: 'mirror'; radius: number; pace?: number; keep?: number }

/** A step of an ultimate: `pattern` fires `at` seconds after the ultimate begins. */
export type UltimateStep = { at: number; pattern: BossPattern }

/**
 * A phase's signature attack (Origin Pulse, Precipice Blades): first `first` s
 * into the phase, then every `every` s. Its name (`move`, the official English
 * name) is announced as it begins, its steps fire in turn, and the phase's
 * other patterns hold until the last step's warning has landed.
 */
export type BossUltimate = { move: string; first: number; every: number; steps: readonly UltimateStep[] }

/**
 * A boss with phases (`BOSS_PHASES`) fights with the patterns of the phase its
 * HP is in: a phase starts once it drops under `below` of its HP (the first
 * one's is 1). As one begins the boss roars and holds still, untouchable, for
 * `shift` s (`PHASE_SHIFT` when absent); `form` swaps its sprite (a form key of
 * its species in the sprite manifest, e.g. `primal`); `steer` says how it moves;
 * `taken` scales the damage it takes.
 * The HUD ticks the thresholds on its HP bar.
 *
 * `rebirth` (Ho-Oh's): this phase isn't reached by HP. When the boss would
 * faint in the phase before, it bursts into flames instead and comes back
 * with `rebirth` of its HP (its `below` is ignored); it must be the last
 * phase. `haste`: time runs that many times as fast for the boss in this
 * phase (its walk, its attacks and its hazards; Dialga's last phase).
 */
export type BossPhase = {
  below: number
  patterns: readonly BossPattern[]
  ultimate?: BossUltimate
  steer?: BossSteer
  form?: string
  shift?: number
  /** The boss holds on at the phase's end (and can't fall in the last one) until its ultimate has played once: every phase shows its signature, however fast it's hit. */
  hold?: true
  rebirth?: number
  haste?: number
  /** Multiplies the damage it takes in this phase (Deoxys's frail Attack Forme). */
  taken?: number
  /** After the shift, each pattern waits this share of its `every` before it first fires (0.5 when absent). */
  open?: number
}

/** Seconds a boss holds still and untouchable as a new phase begins. */
export const PHASE_SHIFT = 1.8

/**
 * Bosses that fight in phases, each with its own patterns, ultimate and look:
 * the rift legendaries with a domain (`data/domains.ts`), and any wave boss
 * given phases here.
 */
export const BOSS_PHASES: Partial<Record<EnemyId, readonly BossPhase[]>> = {
  ...DOMAIN_PHASES,
  ...WAVE_LEGEND_PHASES,
}

/** Every attack a boss has, across its phases (ultimates' steps included), for the guide and the Pokédex. */
export const bossKit = (id: EnemyId): readonly BossPattern[] => {
  const phases = BOSS_PHASES[id]
  if (!phases) return BOSS_PATTERNS[id] ?? []
  return [...new Set(phases.flatMap((ph) => [...ph.patterns, ...(ph.ultimate?.steps.map((s) => s.pattern) ?? [])]))]
}

/**
 * Disguise (Mimikyu's): the first hit dealing at least this share of the
 * boss's max HP lands on its disguise instead, which breaks (`disguiseTakes`
 * in `game/bossFight.ts`); smaller hits before it land as usual.
 */
export const BOSS_DISGUISE: Partial<Record<EnemyId, number>> = { mimikyuBoss: 0.025 }

/** How each stance walks: a pace multiplier, and how close `ranged` comes before it stops walking in (px). */
export const STANCES = {
  close: { pace: 1.3, hold: 0 },
  ranged: { pace: 0.7, hold: 80 },
} as const satisfies Record<BossStance, { pace: number; hold: number }>

/**
 * Wave bosses (the ones on the `EVENTS` schedule) swap stance every `stance`
 * seconds (a seeded roll in that range) and enrage under `below` of their HP:
 * `speed` times faster, `wait` times the pause between attacks, and a `chain`
 * chance (Normal's; `BOSS_DIFFICULTY` has each level's) that an attack is
 * followed by another of the same stance `gap` seconds later (telegraphs land
 * ≥ `MIN_TELEGRAPH` after they show, so the pair stays readable). Entering a
 * stance holds its attacks for at least `open` seconds. Patterns gated
 * `below: 0.5` are what the enrage unlocks.
 */
export const BOSS_RAGE = {
  stance: [4, 9],
  below: 0.5,
  speed: 1.15,
  wait: 0.8,
  chain: 0.35,
  gap: 0.55,
  open: 0.8,
} as const

/** The shortest a wave boss's warning (a strike's delay, a volley's windup) gets on any difficulty, in seconds. */
export const MIN_TELEGRAPH = 0.8

/**
 * How each difficulty presses the bosses that fight (in stances or phases; a
 * rift legendary in the old arena keeps its patterns as written): `pace` times
 * the pause between attacks, `more` times the projectiles and circles of a
 * pattern that fires several, `telegraph`
 * times its warning (never under `MIN_TELEGRAPH`), `aim` times how far ahead
 * on the player's path a `lead` pattern lands, and the enrage's `chain`
 * chance. Patterns gated `from` add the rest: one more attack per boss on
 * Nightmare, Mewtwo's leaps and volleys in its last phase from Hard. HP stays
 * out of it, so a harder boss hits more often instead of lasting longer.
 */
export const BOSS_DIFFICULTY = {
  normal: { pace: 1, more: 1, telegraph: 1, aim: 0.75, chain: BOSS_RAGE.chain },
  hard: { pace: 0.92, more: 1.15, telegraph: 0.95, aim: 0.85, chain: 0.5 },
  nightmare: { pace: 0.84, more: 1.25, telegraph: 0.9, aim: 1, chain: 0.65 },
} as const satisfies Record<Difficulty, { pace: number; more: number; telegraph: number; aim: number; chain: number }>

/**
 * Add a legendary by giving it an entry in `ENEMIES`, a place on the schedule
 * (a boss event, a trio in `TRIOS`, `MYTHICALS` or `RIFT_LEGENDS`) and its patterns here,
 * or its phases in `data/legendBosses.ts` (on the map) or `data/domains` (a rift's domain).
 * Trio members share their slot's stats, so their patterns stay close to the
 * slot's damage and pace and differ in shape.
 *
 * Every wave boss has a `ranged` and a `close` set, something aimed where the
 * player stands or is heading (standing still doesn't work), something for a
 * player who keeps away (`far`), an attack its enrage unlocks (`below: 0.5`) and
 * one more on Nightmare (`from: 'nightmare'`).
 */
export const BOSS_PATTERNS: Partial<Record<EnemyId, readonly BossPattern[]>> = {
  /** Onix: Rock Throw along your path, a slam up close, Dig under you from afar, Rock Tomb rings once enraged. */
  onix: [
    { stance: 'ranged', kind: 'strikes', every: 4, target: 'player', count: 3, spread: 50, radius: 12, delay: 1.1, damage: 14, visual: 'rock', lead: 1 },
    { stance: 'close', kind: 'strikes', every: 4.5, target: 'self', count: 1, spread: 0, radius: 36, delay: 1.2, damage: 16, visual: 'slam' },
    { far: 110, kind: 'strikes', every: 7, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.3, damage: 16, visual: 'slam', lead: 1, leap: true },
    { below: 0.5, kind: 'ring', every: 4.5, count: 8, speed: 64, radius: 5, damage: 12, visual: 'rock' },
    { from: 'nightmare', stance: 'ranged', kind: 'volley', every: 5, count: 3, arc: 0.5, speed: 110, windup: 0.9, radius: 5, damage: 14, visual: 'rock' },
  ],
  /** Snorlax: Body Slam on you, a slam up close, Heavy Slam from afar, Rollout along your path once enraged. */
  snorlax: [
    { stance: 'close', kind: 'strikes', every: 5, target: 'self', count: 1, spread: 0, radius: 46, delay: 1.3, damage: 22, visual: 'slam' },
    { stance: 'ranged', kind: 'strikes', every: 4.5, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.3, damage: 20, visual: 'slam' },
    { far: 110, kind: 'strikes', every: 7.5, target: 'player', count: 1, spread: 0, radius: 32, delay: 1.4, damage: 22, visual: 'slam', lead: 1, leap: true },
    { below: 0.5, stance: 'ranged', kind: 'strikes', every: 4, target: 'player', count: 4, spread: 0, radius: 15, delay: 1.2, damage: 18, visual: 'slam', lead: 1 },
    { from: 'nightmare', stance: 'close', kind: 'ring', every: 4.4, count: 10, speed: 70, radius: 5, damage: 16, visual: 'rock' },
  ],
  // The Noite das Bruxas night bosses (`HALLOWEEN.bosses`): Onix's slot (2:30) hits like Onix, Snorlax's (5:00) like Snorlax.
  /** Mimikyu: Shadow Claw up close, Shadow Ball from afar, Shadow Sneak onto you, its rags streaking at you once enraged; its Disguise takes the first big hit (`BOSS_DISGUISE`). */
  mimikyuBoss: [
    { stance: 'close', kind: 'strikes', every: 4.2, target: 'self', count: 1, spread: 0, radius: 34, delay: 1.1, damage: 15, visual: 'shadow' },
    { stance: 'ranged', kind: 'volley', every: 4.2, count: 3, arc: 0.5, speed: 100, windup: 0.9, radius: 5, damage: 13, visual: 'shadow' },
    { far: 110, kind: 'teleport', every: 7, to: 'player', windup: 1.1, radius: 26, damage: 15, visual: 'shadow' },
    { below: 0.5, kind: 'phantoms', every: 6, origin: 'ring', count: 3, gap: 0.5, windup: 0.9, speed: 180, width: 12, radius: 110, damage: 14, visual: 'shadow' },
    { from: 'nightmare', stance: 'close', kind: 'ring', every: 4.6, count: 10, speed: 70, radius: 5, damage: 13, visual: 'mist' },
  ],
  /** Banette: Curse along your path, Shadow Claw up close, its Shuppet from afar, a cage of curses once enraged. */
  banetteBoss: [
    { stance: 'ranged', kind: 'strikes', every: 4, target: 'player', count: 3, spread: 50, radius: 12, delay: 1.1, damage: 14, visual: 'shadow', lead: 1 },
    { stance: 'close', kind: 'strikes', every: 4.5, target: 'self', count: 1, spread: 0, radius: 36, delay: 1.2, damage: 16, visual: 'shadow' },
    { far: 110, kind: 'summon', every: 8, enemies: ['shuppet'], count: 4, max: 8, radius: 40 },
    { below: 0.5, kind: 'cage', every: 7, radius: 46, count: 10, size: 9, windup: 1.1, ttl: 3, damage: 12, visual: 'shadow' },
    { from: 'nightmare', stance: 'ranged', kind: 'volley', every: 5, count: 3, arc: 0.5, speed: 110, windup: 0.9, radius: 5, damage: 14, visual: 'shadow' },
  ],
  /** Sableye: Power Gem along your path, Fake Out lunges up close, Shadow Sneak under you from afar, Confuse Ray rings once enraged. */
  sableyeBoss: [
    { stance: 'ranged', kind: 'strikes', every: 4, target: 'player', count: 3, spread: 50, radius: 11, delay: 1.1, damage: 14, visual: 'rock', lead: 1 },
    { stance: 'close', kind: 'dash', every: 5, windup: 0.75, speed: 220, width: 14, damage: 15, count: 2 },
    { far: 110, kind: 'dive', every: 8, hide: 1.6, windup: 0.9, radius: 26, damage: 16, visual: 'shadow' },
    { below: 0.5, kind: 'ring', every: 4.5, count: 10, speed: 66, radius: 5, damage: 12, visual: 'shadow' },
    { from: 'nightmare', stance: 'ranged', kind: 'volley', every: 5, count: 3, arc: 0.5, speed: 110, windup: 0.9, radius: 5, damage: 14, visual: 'rock' },
  ],
  /** Drifblim: Shadow Ball on you, a burst up close, Drifloon balloons from afar, Ominous Wind once enraged. */
  drifblimBoss: [
    { stance: 'ranged', kind: 'strikes', every: 4.2, target: 'player', count: 1, spread: 0, radius: 22, delay: 1.2, damage: 15, visual: 'shadow', lead: 1 },
    { stance: 'close', kind: 'strikes', every: 4.8, target: 'self', count: 1, spread: 0, radius: 40, delay: 1.2, damage: 16, visual: 'aero' },
    { far: 110, kind: 'summon', every: 8, enemies: ['drifloon'], count: 3, max: 6, radius: 36 },
    { below: 0.5, kind: 'gust', every: 5, count: 3, arc: 0.6, speed: 90, windup: 0.9, radius: 6, reach: 22, push: 120, damage: 12, visual: 'aero' },
    { from: 'nightmare', stance: 'close', kind: 'ring', every: 4.6, count: 10, speed: 66, radius: 5, damage: 12, visual: 'aero' },
  ],
  /** Mismagius: Psybeam fans from afar, Shadow Ball rings up close, it blinks onto you from afar, a closing magic circle once enraged. */
  mismagiusBoss: [
    { stance: 'ranged', kind: 'volley', every: 4.4, count: 5, arc: 0.9, speed: 100, windup: 0.9, radius: 5, damage: 13, visual: 'psychic' },
    { stance: 'close', kind: 'ring', every: 4.2, count: 10, speed: 70, radius: 5, damage: 13, visual: 'shadow' },
    { far: 110, kind: 'teleport', every: 7, to: 'player', windup: 1.1, radius: 28, damage: 15, visual: 'psychic' },
    { below: 0.5, kind: 'ring', every: 5.5, count: 12, speed: 60, radius: 5, damage: 12, visual: 'psychic', around: 90, windup: 1, gap: 0.9 },
    { from: 'nightmare', stance: 'ranged', kind: 'strikes', every: 5, target: 'player', count: 4, spread: 50, radius: 12, delay: 1.1, damage: 13, visual: 'fire' },
  ],
  /** Houndoom: Flamethrower fans from afar, charges up close, a pounce on you from afar, burning tracks once enraged. */
  houndoomBoss: [
    { stance: 'ranged', kind: 'volley', every: 4, count: 3, arc: 0.45, speed: 110, windup: 0.9, radius: 5, damage: 14, visual: 'fire' },
    { stance: 'close', kind: 'dash', every: 5, windup: 0.8, speed: 230, width: 16, damage: 16, count: 2 },
    { far: 110, kind: 'strikes', every: 7, target: 'player', count: 1, spread: 0, radius: 24, delay: 1.2, damage: 16, visual: 'fire', lead: 1, leap: true },
    { below: 0.5, kind: 'trail', every: 0.25, ttl: 2, radius: 6, damage: 10, visual: 'fire' },
    { from: 'nightmare', stance: 'ranged', kind: 'strikes', every: 5, target: 'player', count: 3, spread: 46, radius: 13, delay: 1.1, damage: 14, visual: 'fire' },
  ],
  /** Gengar: Shadow Ball from afar, Hex up close, it fades and comes back on you from afar, Double Team shadows once enraged. */
  gengarBoss: [
    { stance: 'ranged', kind: 'volley', every: 4.2, count: 3, arc: 0.5, speed: 110, windup: 0.9, radius: 6, damage: 18, visual: 'shadow' },
    { stance: 'close', kind: 'strikes', every: 4.8, target: 'self', count: 1, spread: 0, radius: 44, delay: 1.2, damage: 20, visual: 'shadow' },
    { far: 110, kind: 'teleport', every: 7, to: 'player', windup: 1.2, radius: 30, damage: 20, visual: 'shadow' },
    { below: 0.5, kind: 'phantoms', every: 6, origin: 'ring', count: 4, gap: 0.45, windup: 0.9, speed: 190, width: 14, radius: 120, damage: 16, visual: 'shadow' },
    { from: 'nightmare', stance: 'ranged', kind: 'strikes', every: 5, target: 'player', count: 4, spread: 0, radius: 14, delay: 1.2, damage: 16, visual: 'poison', lead: 1 },
  ],
  /** Chandelure: Will-O-Wisp rains on you, flames out of its arms up close, Flamethrower at a player far off, a wall of fire once enraged. */
  chandelureBoss: [
    { stance: 'ranged', kind: 'strikes', every: 4.2, target: 'player', count: 5, spread: 70, radius: 14, delay: 1.1, damage: 18, visual: 'fire' },
    { stance: 'close', kind: 'ring', every: 4.4, count: 12, speed: 72, radius: 5, damage: 16, visual: 'fire' },
    { far: 110, kind: 'beam', every: 7, source: 'boss', count: 1, spread: 0, windup: 1, duration: 0.8, width: 10, length: 260, damage: 18, visual: 'fire' },
    { below: 0.5, kind: 'cage', every: 7.5, radius: 50, count: 12, size: 10, windup: 1.2, ttl: 3, damage: 14, visual: 'fire' },
    { from: 'nightmare', stance: 'ranged', kind: 'ring', every: 5, count: 10, speed: 60, radius: 5, damage: 16, visual: 'shadow', around: 90, windup: 1, gap: 0.9 },
  ],
  /** Gourgeist: Seed Bomb fans from afar, Trick-or-Treat up close, Phantom Force under you from afar, Leech Seed along your path once enraged. */
  gourgeistBoss: [
    { stance: 'ranged', kind: 'volley', every: 4.2, count: 5, arc: 0.8, speed: 105, windup: 0.9, radius: 5, damage: 17, visual: 'seed' },
    { stance: 'close', kind: 'strikes', every: 4.8, target: 'self', count: 1, spread: 0, radius: 44, delay: 1.2, damage: 20, visual: 'grass' },
    { far: 110, kind: 'dive', every: 8, hide: 1.8, windup: 1, radius: 30, damage: 20, visual: 'shadow' },
    { below: 0.5, stance: 'ranged', kind: 'strikes', every: 4.5, target: 'player', count: 5, spread: 0, radius: 14, delay: 1.2, damage: 17, visual: 'grass', lead: 1 },
    { from: 'nightmare', kind: 'trail', every: 0.3, ttl: 2.4, radius: 7, damage: 12, visual: 'grass' },
  ],
  /** Trevenant: roots along your path, a cage of roots up close, roots dragging a player far off back in, Wood Hammer once enraged. */
  trevenantBoss: [
    { stance: 'ranged', kind: 'strikes', every: 4.2, target: 'player', count: 4, spread: 0, radius: 14, delay: 1.2, damage: 18, visual: 'grass', lead: 1 },
    { stance: 'close', kind: 'cage', every: 6.5, radius: 44, count: 10, size: 10, windup: 1.1, ttl: 2.6, damage: 16, visual: 'grass' },
    { far: 120, kind: 'whirlpool', every: 8, target: 'self', count: 1, spread: 0, radius: 16, reach: 200, pull: 40, windup: 1, ttl: 2.5, damage: 18, visual: 'grass' },
    { below: 0.5, stance: 'close', kind: 'strikes', every: 5, target: 'self', count: 1, spread: 0, radius: 52, delay: 1.3, damage: 22, visual: 'grass' },
    { from: 'nightmare', stance: 'ranged', kind: 'ring', every: 4.6, count: 10, speed: 68, radius: 5, damage: 16, visual: 'grass' },
  ],
  /** Honchkrow: Dark Pulse from afar, Night Slash charges up close, a pass at a player far off, calling its Murkrow, Sucker Punch rains once enraged. */
  honchkrowBoss: [
    { stance: 'ranged', kind: 'volley', every: 4.2, count: 3, arc: 0.5, speed: 110, windup: 0.9, radius: 6, damage: 18, visual: 'shadow' },
    { stance: 'close', kind: 'dash', every: 5, windup: 0.75, speed: 240, width: 16, damage: 20, count: 2 },
    { far: 110, kind: 'swoop', every: 8, windup: 0.8, speed: 260, width: 16, damage: 20, count: 2, reach: 150 },
    { kind: 'summon', every: 10, enemies: ['murkrow'], count: 3, max: 6, radius: 40 },
    { below: 0.5, kind: 'strikes', every: 4.5, target: 'player', count: 5, spread: 70, radius: 13, delay: 1.1, damage: 17, visual: 'shadow' },
    { from: 'nightmare', stance: 'close', kind: 'ring', every: 4.6, count: 10, speed: 70, radius: 5, damage: 16, visual: 'shadow' },
  ],
  /** Dusknoir: Shadow Punch along your path, a slam up close, Shadow Sneak onto a player far off, its maw drawing you in once enraged. */
  dusknoirBoss: [
    { stance: 'ranged', kind: 'strikes', every: 4, target: 'player', count: 3, spread: 50, radius: 13, delay: 1.1, damage: 18, visual: 'shadow', lead: 1 },
    { stance: 'close', kind: 'strikes', every: 5, target: 'self', count: 1, spread: 0, radius: 48, delay: 1.3, damage: 22, visual: 'slam' },
    { far: 110, kind: 'teleport', every: 7.5, to: 'player', windup: 1.2, radius: 30, damage: 20, visual: 'shadow' },
    { below: 0.5, kind: 'whirlpool', every: 8, target: 'self', count: 1, spread: 0, radius: 18, reach: 180, pull: 45, windup: 1, ttl: 2.5, damage: 20, visual: 'shadow' },
    { from: 'nightmare', stance: 'ranged', kind: 'volley', every: 5, count: 4, arc: 0.6, speed: 110, windup: 0.9, radius: 5, damage: 18, visual: 'shadow' },
  ],
  // The trios, the mythicals and Mewtwo fight in phases: `data/legendBosses.ts`.
  // Rift legendaries: each leans on its signature move and types.
  /** Aeroblast rings and a Hurricane around itself. */
  lugia: [
    { kind: 'ring', every: 3.2, count: 14, speed: 90, radius: 5, damage: 20, visual: 'aero' },
    { kind: 'strikes', every: 6, target: 'self', count: 1, spread: 0, radius: 54, delay: 1.3, damage: 24, visual: 'aero' },
  ],
  /** Sacred Fire: a burning trail and fire raining on the player. */
  hoOh: [
    { kind: 'trail', every: 0.18, ttl: 3, radius: 7, damage: 16, visual: 'fire' },
    { kind: 'strikes', every: 3.6, target: 'player', count: 5, spread: 70, radius: 14, delay: 1.1, damage: 22, visual: 'fire' },
  ],
  /** Origin Pulse: dense water rings, plus a downpour on the player. */
  kyogre: [
    { kind: 'ring', every: 3.4, count: 18, speed: 70, radius: 5, damage: 20, visual: 'water' },
    { kind: 'strikes', every: 4, target: 'player', count: 4, spread: 60, radius: 16, delay: 1, damage: 20, visual: 'water' },
  ],
  /** Precipice Blades around the player, a ground slam and magma where it walks. */
  groudon: [
    { kind: 'strikes', every: 3.2, target: 'player', count: 6, spread: 80, radius: 13, delay: 1.1, damage: 22, visual: 'rock' },
    { kind: 'strikes', every: 5.5, target: 'self', count: 1, spread: 0, radius: 58, delay: 1.4, damage: 26, visual: 'slam' },
    { kind: 'trail', every: 0.3, ttl: 2.4, radius: 7, damage: 14, visual: 'fire' },
  ],
  /** Fast dragon rings and Draco Meteor. */
  rayquaza: [
    { kind: 'ring', every: 2.2, count: 10, speed: 110, radius: 5, damage: 20, visual: 'dragon' },
    { kind: 'strikes', every: 3.4, target: 'player', count: 3, spread: 50, radius: 20, delay: 0.9, damage: 24, visual: 'dragon' },
  ],
  /** Roar of Time: a huge pulse around itself, slow steel rings and dragon strikes. */
  dialga: [
    { kind: 'strikes', every: 6.5, target: 'self', count: 1, spread: 0, radius: 70, delay: 1.6, damage: 28, visual: 'steel' },
    { kind: 'ring', every: 3.6, count: 20, speed: 56, radius: 5, damage: 18, visual: 'steel' },
    { kind: 'strikes', every: 4.5, target: 'player', count: 2, spread: 40, radius: 18, delay: 1, damage: 22, visual: 'dragon' },
  ],
  /** Latias: Mist Ball rings, a lingering mist where she glides, and Dragon Pulse on the player. */
  latias: [
    { kind: 'ring', every: 3, count: 12, speed: 80, radius: 5, damage: 20, visual: 'psychic' },
    { kind: 'trail', every: 0.24, ttl: 2.6, radius: 7, damage: 14, visual: 'psychic' },
    { kind: 'strikes', every: 3.8, target: 'player', count: 3, spread: 50, radius: 16, delay: 1, damage: 22, visual: 'dragon' },
  ],
  /** Latios: Luster Purge, one wide blast on the player, fast dragon rings and a Dragon Dance slam. */
  latios: [
    { kind: 'strikes', every: 3, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.1, damage: 26, visual: 'psychic' },
    { kind: 'ring', every: 3.4, count: 14, speed: 96, radius: 5, damage: 20, visual: 'dragon' },
    { kind: 'strikes', every: 6, target: 'self', count: 1, spread: 0, radius: 52, delay: 1.3, damage: 24, visual: 'dragon' },
  ],
  /** Deoxys: Psycho Boost bursts, a meteor shower on the player and Cosmic Power around itself. */
  deoxys: [
    { kind: 'ring', every: 3.2, count: 20, speed: 100, radius: 5, damage: 22, visual: 'psychic' },
    { kind: 'strikes', every: 3.6, target: 'player', count: 6, spread: 90, radius: 13, delay: 1.2, damage: 22, visual: 'rock' },
    { kind: 'strikes', every: 6, target: 'self', count: 1, spread: 0, radius: 56, delay: 1.3, damage: 26, visual: 'psychic' },
  ],
  /** Darkrai (its old arena, in co-op): Dark Pulse rings, Dark Void orbs that put a player to sleep, and Nightmare strikes on the player. */
  darkrai: [
    { kind: 'ring', every: 3.4, count: 14, speed: 72, radius: 5, damage: 20, visual: 'shadow' },
    { kind: 'volley', every: 4.4, count: 3, arc: 0.6, speed: 86, windup: 1, radius: 7, damage: 10, visual: 'shadow', sleep: 1.1 },
    { kind: 'strikes', every: 4, target: 'player', count: 4, spread: 60, radius: 15, delay: 1.1, damage: 20, visual: 'shadow' },
  ],
  /** Spiritomb, the graveyard's boss (`data/places.ts`): Shadow Ball rings, Hex on the player and Dark Pulse around itself. */
  spiritomb: [
    { kind: 'ring', every: 3.4, count: 10, speed: 68, radius: 5, damage: 16, visual: 'shadow' },
    { kind: 'strikes', every: 4, target: 'player', count: 3, spread: 46, radius: 14, delay: 1.1, damage: 18, visual: 'shadow' },
    { kind: 'strikes', every: 6, target: 'self', count: 1, spread: 0, radius: 46, delay: 1.3, damage: 20, visual: 'shadow' },
  ],
  // Arceus, the reaper, fights in phases too (`data/legendBosses.ts`).
}
