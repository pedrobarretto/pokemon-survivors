import { range, type Rng } from '../engine/rng'
import {
  BOSS_DIFFICULTY, BOSS_DISGUISE, BOSS_PATTERNS, BOSS_PHASES, BOSS_RAGE, MIN_TELEGRAPH, STANCES,
  type BlastSafe, type BossPattern, type BossPhase, type BossStance, type HazardVisual,
} from '../data/bosses'
import type { EnemyId } from '../data/enemies'
import { bossWaveAt } from '../data/waves'
import { DIFFICULTY_IDS, type Difficulty } from './difficulty'
import * as dm from '../engine/dmath'

/**
 * A boss moving on its own script instead of walking (`game/bosses.ts`):
 * a `dash` marks its lane for `wait` s then rushes (vx, vy) for `left` s,
 * `more` times again (a `swoop` one, `reach` > 0, comes in from that far off
 * on a new side each time); a `dive` is under, untouchable, for `left` s, its wake at
 * (x, y) following the player until `lock` s are left (then its strike shows);
 * `away` is a teleport waiting for its landing.
 */
export type BossMotion =
  | { kind: 'dash'; wait: number; left: number; vx: number; vy: number; more: number; speed: number; width: number; damage: number; windup: number; hit: boolean; reach: number }
  | { kind: 'dive'; left: number; lock: number; x: number; y: number; windup: number; radius: number; damage: number; visual: HazardVisual }
  | { kind: 'away'; left: number }

/**
 * A blast charging (`left` of `total` s) from (x, y): when it lands it hurts
 * the player unless they stand somewhere `safe` (for `spots`, within `radius`
 * of one of its `spots`).
 */
export type BossBlast = { left: number; total: number; x: number; y: number; damage: number; safe: BlastSafe; radius: number; visual: HazardVisual; spots: readonly { x: number; y: number }[] }

/** A time stop (`timeStop` pattern): `wait` s until it takes hold, then the player's shots hold still for `left` of `total` s. */
export type TimeStop = { wait: number; left: number; total: number }

/**
 * A boss's fight state: the stance it's in (`BossStance`), seconds until
 * it swaps, whether it has enraged, the share of HP it has left (`share`, kept
 * fresh by `updateBosses`) and the run's difficulty. Bosses with phases
 * (`BOSS_PHASES`) also keep the phase they're in (`phase`, `phaseAge`, the
 * `shift` left on its opening), their ultimate (`ult` while it plays,
 * `ultLeft` until the next), their scripted `motion`, a charging `blast`,
 * a `timeStop` holding the player's shots, and `home`, where they appeared.
 * Pure rules; `updateBosses` drives them.
 *
 * Two legendaries fighting as one (a domain's `partner`, Latias and Latios)
 * are `link`ed (each holds the other's id): they share one pool of HP, so they
 * move through their phases together, and neither faints alone (`holdsOn`);
 * one knocked out is `down`, out of play until its partner revives it or falls
 * too (`game/domainPair.ts`). `held` is the HP a linked boss holds through its
 * phase's opening. `guards` are the ids of the barrier keepers (`guard`) that
 * stand for it now. `busted`: its Disguise (`BOSS_DISGUISE`) took its hit.
 */
export type BossFight = {
  stance: BossStance
  stanceLeft: number
  enraged: boolean
  share: number
  difficulty: Difficulty
  phase: number
  phaseAge: number
  shift: number
  ult: { t: number; step: number } | null
  ultLeft: number
  /** Whether this phase's ultimate has played yet (a `hold` phase waits on it). */
  ultDone: boolean
  motion: BossMotion | null
  blast: BossBlast | null
  home: { x: number; y: number }
  timeStop: TimeStop | null
  link: number
  down: boolean
  held: number
  guards: number[]
  busted: boolean
}

/** The phases of a boss that fights in phases, or null. */
export const phasesOf = (kind: EnemyId): readonly BossPhase[] | null => BOSS_PHASES[kind] ?? null

/** The phase a boss with `share` of its HP left is in: the last one whose threshold it fell under (a `rebirth` phase is never reached this way). */
export const phaseAt = (phases: readonly BossPhase[], share: number) => {
  let at = 0
  for (let i = 1; i < phases.length && phases[i]!.rebirth === undefined; i++) if (share < phases[i]!.below) at = i
  return at
}

/** The phase a boss moves on to now: the next one if it's a rebirth and the boss is down to its last HP (`holdsOn` kept it at 1), else by HP. */
export const nextPhase = (phases: readonly BossPhase[], current: number, hp: number, maxHp: number) =>
  phases[current + 1]?.rebirth !== undefined ? (hp <= 1 ? current + 1 : current) : phaseAt(phases, hp / maxHp)

/** How many times as fast time runs for a boss in its phase (`BossPhase.haste`): 1 for the rest. */
export const hasteOf = (kind: EnemyId, fight: BossFight | null) => (fight ? (phasesOf(kind)?.[fight.phase]?.haste ?? 1) : 1)

/** Whether a boss's time stop holds the player's shots still now. */
export const holdsShots = (fight: BossFight | null) => fight?.timeStop != null && fight.timeStop.wait <= 0

/** The patterns a boss fights with now: its phase's, or its flat list. */
export const patternsOf = (kind: EnemyId, fight: BossFight | null): readonly BossPattern[] | undefined => {
  const phases = phasesOf(kind)
  return phases ? phases[fight?.phase ?? 0]!.patterns : BOSS_PATTERNS[kind]
}

/** Whether a boss's script holds it still and untouchable for now: a phase's opening, a dive or a teleport. */
export const bossAway = (fight: BossFight | null) => fight !== null && (fight.motion?.kind === 'dive' || fight.motion?.kind === 'away')

/**
 * The seconds an ultimate keeps the rest of the phase's patterns waiting: its
 * last step's time plus that step's warning and a beat to breathe.
 */
export const ultimateLength = (steps: readonly { at: number; pattern: BossPattern }[]) =>
  steps.reduce((end, s) => Math.max(end, s.at + warningOf(s.pattern)), 0) + 0.8

/** How long a pattern warns before it lands (0 for the ones that land at once). */
export const warningOf = (p: BossPattern) => {
  switch (p.kind) {
    case 'strikes': return p.delay
    case 'volley': return p.windup
    case 'beam': return p.windup + p.duration
    case 'dash': return p.windup * p.count + 1
    case 'swoop': return (p.windup + (p.reach * 2) / p.speed) * p.count
    case 'dive': return p.hide + p.windup
    case 'teleport': case 'blast': case 'whirlpool': case 'gust': case 'timeStop': return p.windup
    case 'phantoms': return p.windup + p.gap * (p.count - 1) + (p.radius * 2) / p.speed
    case 'ring': return p.windup ?? 0
    case 'cage': return p.ttl
    default: return 0
  }
}

/**
 * Wave bosses fight in stances and enrage. Rift legendaries and Arceus don't:
 * a rift is already a timed duel and the reaper is meant to be outlasted, not
 * read (their phases carry the fight instead).
 */
export const fightsInStances = (kind: EnemyId) =>
  bossWaveAt(kind) !== null && (BOSS_PATTERNS[kind] ?? BOSS_PHASES[kind]?.flatMap((ph) => ph.patterns) ?? []).some((p) => p.stance !== undefined)

const stanceTime = (rng: Rng) => range(rng, BOSS_RAGE.stance[0], BOSS_RAGE.stance[1])

/** Bosses arrive rushing in (`close`), so the first stance shows up on screen soon. */
export const createFight = (rng: Rng, difficulty: Difficulty, home = { x: 0, y: 0 }): BossFight => ({
  stance: 'close',
  stanceLeft: stanceTime(rng),
  enraged: false,
  share: 1,
  difficulty,
  phase: 0,
  phaseAge: 0,
  shift: 0,
  ult: null,
  ultLeft: Infinity,
  ultDone: false,
  motion: null,
  blast: null,
  home,
  timeStop: null,
  link: -1,
  down: false,
  held: 0,
  guards: [],
  busted: false,
})

/** Counts the stance down; returns true on the tick it swaps (with a fresh seeded duration). */
export const tickStance = (fight: BossFight, dt: number, rng: Rng) => {
  fight.stanceLeft -= dt
  if (fight.stanceLeft > 0) return false
  fight.stance = fight.stance === 'close' ? 'ranged' : 'close'
  fight.stanceLeft += stanceTime(rng)
  return true
}

/** Whether a pattern fires in this fight now: its stance, HP and difficulty gates (`PatternGate`; `far` is checked as it fires). */
export const patternLive = (p: BossPattern, fight: BossFight) =>
  (p.stance === undefined || p.stance === fight.stance) &&
  (p.below === undefined || fight.share < p.below) &&
  (p.from === undefined || DIFFICULTY_IDS.indexOf(fight.difficulty) >= DIFFICULTY_IDS.indexOf(p.from))

/** True on the tick a boss crosses under `BOSS_RAGE.below` of its HP. */
export const shouldEnrage = (fight: BossFight, hp: number, maxHp: number) => !fight.enraged && hp < maxHp * BOSS_RAGE.below

/** Walking pace multiplier of a boss in a fight. */
export const fightPace = (fight: BossFight) => STANCES[fight.stance].pace * (fight.enraged ? BOSS_RAGE.speed : 1)

/** Seconds until a pattern that just fired fires again: the difficulty's pace and the enrage press it (a trail keeps its drip). */
export const attackWait = (p: BossPattern, fight: BossFight | null) => {
  if (!fight || p.kind === 'trail') return p.every
  return p.every * BOSS_DIFFICULTY[fight.difficulty].pace * (fight.enraged ? BOSS_RAGE.wait : 1)
}

/** How many projectiles or circles a pattern fires in this fight: a single one stays single, several grow with the difficulty. */
export const attackCount = (count: number, fight: BossFight | null) => (fight && count > 1 ? Math.round(count * BOSS_DIFFICULTY[fight.difficulty].more) : count)

/** A warning's length in this fight: shortened by the difficulty, never under `MIN_TELEGRAPH` (nor lengthened when written shorter). */
export const telegraph = (seconds: number, fight: BossFight | null) =>
  fight ? Math.max(Math.min(seconds, MIN_TELEGRAPH), seconds * BOSS_DIFFICULTY[fight.difficulty].telegraph) : seconds

/** How many seconds of the player's path a `lead` pattern reaches ahead: `lead` of its warning, times the difficulty's `aim`. */
export const leadTime = (lead: number, delay: number, fight: BossFight | null) => lead * delay * (fight ? BOSS_DIFFICULTY[fight.difficulty].aim : 1)

/** The chance an enraged boss chains a second attack, by difficulty. */
export const chainChance = (fight: BossFight) => BOSS_DIFFICULTY[fight.difficulty].chain

/**
 * Which pattern an enraged boss chains after firing `fired`: the first other
 * live pattern, else `fired` itself; never a trail (those drip every few
 * ticks). -1 when there's nothing to chain.
 */
export const chainTarget = (patterns: readonly BossPattern[], fight: BossFight, fired: number) => {
  let self = -1
  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i]!
    if (p.kind === 'trail' || !patternLive(p, fight)) continue
    if (i !== fired) return i
    self = i
  }
  return self
}

/** Where a boss with phases heads this tick and at what share of its pace (0: it stays put). */
export type Steering = { x: number; y: number; pace: number }

/**
 * Where a boss in a fight with phases walks (`BossSteer`): nowhere during a
 * phase's opening or a scripted motion; otherwise at the player, holding a
 * range, wandering around its anchor, circling its home, or across it from
 * its linked partner (`mate`, null while that one is out of play). `now`
 * drives the wandering, so it stays deterministic. False when its phase doesn't steer.
 */
export const steerBoss = (
  fight: BossFight,
  kind: EnemyId,
  e: { x: number; y: number; id: number },
  p: { x: number; y: number },
  now: number,
  out: Steering,
  mate: { x: number; y: number } | null = null,
) => {
  const steer = phasesOf(kind)?.[fight.phase]?.steer
  if (!steer) return false
  out.x = p.x
  out.y = p.y
  out.pace = fight.shift > 0 || fight.motion !== null ? 0 : (steer.pace ?? 1) * hasteOf(kind, fight)
  switch (steer.kind) {
    case 'chase':
      return true
    case 'hold':
      if ((p.x - e.x) * (p.x - e.x) + (p.y - e.y) * (p.y - e.y) < steer.range * steer.range) out.pace = 0
      return true
    case 'anchor': {
      const a = now * 0.5 + e.id
      out.x = fight.home.x + steer.x + dm.cos(a) * steer.drift
      out.y = fight.home.y + steer.y + dm.sin(a * 1.3) * steer.drift * 0.7
      return true
    }
    case 'mirror':
    case 'orbit': {
      if (steer.kind === 'mirror' && mate) {
        out.x = fight.home.x * 2 - mate.x
        out.y = fight.home.y * 2 - mate.y
        return veer(steer.keep, e, p, out)
      }
      // Alone, a mirroring boss circles too.
      const a = dm.atan2(e.y - fight.home.y, e.x - fight.home.x) + 0.6
      out.x = fight.home.x + dm.cos(a) * steer.radius
      out.y = fight.home.y + dm.sin(a) * steer.radius
      return veer(steer.keep, e, p, out)
    }
    case 'pass': {
      // Each pass heads for the far side of its home on a fresh heading (a golden-angle turn), so it crosses the arena every time.
      const pass = Math.floor(now / steer.every)
      const a = pass * 2.4 + e.id
      const side = pass % 2 === 0 ? 1 : -1
      out.x = fight.home.x + dm.cos(a) * steer.reach * side
      out.y = fight.home.y + dm.sin(a) * steer.reach * side * 0.8
      return true
    }
  }
}

/** A circling boss that comes within `keep` px of the player heads straight away from them instead. True, for `steerBoss`. */
const veer = (keep: number | undefined, e: { x: number; y: number }, p: { x: number; y: number }, out: Steering) => {
  if (keep === undefined) return true
  const dx = e.x - p.x
  const dy = e.y - p.y
  const d = dm.hypot(dx, dy)
  if (d >= keep || d === 0) return true
  out.x = e.x + (dx / d) * 40
  out.y = e.y + (dy / d) * 40
  return true
}

/**
 * Whether a boss's faint waits: one with phases still to go (or in a phase's
 * opening, or owing its `hold` phase the ultimate) stays up at 1 HP and moves
 * on to its next phase instead (`killEnemy`); so does a linked one, whose
 * partner decides when they fall (`domainPair.ts`).
 */
export const holdsOn = (e: { kind: EnemyId; fight: BossFight | null }) => {
  const phases = phasesOf(e.kind)
  return phases !== null && e.fight !== null && (e.fight.phase < phases.length - 1 || e.fight.shift > 0 || e.fight.link >= 0 || waitsOnUltimate(phases, e.fight))
}

/** Whether a boss in a `hold` phase still owes it its ultimate (it holds on until it has played once). */
export const waitsOnUltimate = (phases: readonly BossPhase[], fight: BossFight) => phases[fight.phase]?.hold === true && !fight.ultDone

/** The least HP a boss keeps while its phase waits on its ultimate: the next phase's threshold, or 1 in the last. */
export const holdFloor = (phases: readonly BossPhase[], fight: BossFight, maxHp: number) => {
  const next = phases[fight.phase + 1]
  return next ? Math.ceil(next.below * maxHp) + 1 : 1
}

/** The most seconds a boss hit down to its `hold` gate still waits for its ultimate: there, it plays it at once. */
export const GATE_WAIT = 1

/**
 * When a boss's ultimate comes due: on its clock, or within `GATE_WAIT` once
 * its `hold` phase pins it at the gate (`holdFloor`), so a fast fight never
 * stands around waiting on it.
 */
export const ultimateDue = (phases: readonly BossPhase[], fight: BossFight, hp: number, maxHp: number) =>
  waitsOnUltimate(phases, fight) && hp <= holdFloor(phases, fight, maxHp) ? Math.min(fight.ultLeft, GATE_WAIT) : fight.ultLeft

/**
 * Whether a stun, sleep or freeze (`held`) stops a boss's script now. Not
 * while it owes its `hold` phase the ultimate, nor while one plays: those go
 * through, so no condition can pin a boss at its gate forever.
 */
export const statusStops = (phases: readonly BossPhase[] | null, fight: BossFight | null, held: boolean) =>
  held && !(fight !== null && (fight.ult !== null || (phases !== null && waitsOnUltimate(phases, fight))))

/** How much more (or less) damage a boss with phases takes in the phase it's in (`BossPhase.taken`). */
export const phaseTaken = (e: { kind: EnemyId; fight: BossFight | null }) => (e.fight ? (phasesOf(e.kind)?.[e.fight.phase]?.taken ?? 1) : 1)

/** The share of HP a pair of linked bosses has left together (one pool). */
export const pooledShare = (a: { hp: number; maxHp: number }, b: { hp: number; maxHp: number } | undefined) =>
  b ? (Math.max(0, a.hp) + Math.max(0, b.hp)) / (a.maxHp + b.maxHp) : a.hp / a.maxHp

/** Whether a hit of `damage` lands on a boss's Disguise (`BOSS_DISGUISE`): the first one big enough, while the disguise is still up (from its spawn on). */
export const disguiseTakes = (e: { kind: EnemyId; maxHp: number; fight: BossFight | null }, damage: number) => {
  const share = BOSS_DISGUISE[e.kind]
  return share !== undefined && e.fight?.busted !== true && damage >= e.maxHp * share
}
