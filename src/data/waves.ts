import type { EnemyId } from './enemies'
import { HALLOWEEN } from './halloween'
import type { Tier } from './roster'

/**
 * Spawn director timeline. A stage is active until `until` seconds; `rate`
 * is spawns per second and `max` caps how many regular enemies live at once.
 * Its species are drawn when the run starts (`game/roster.ts`): one per slot
 * in `cast`, from that slot's tier. Only `fresh` slots bring species new to the
 * run; the others keep the newest species of the previous stage when the tiers
 * match, so each stage introduces a couple of faces instead of a whole new horde.
 */
export type WaveStage = {
  until: number
  rate: number
  max: number
  cast: readonly Tier[]
  fresh: number
}

/**
 * The legendary trios. Each run draws one with the roster (`game/roster.ts`)
 * and its members take the trio slots at 7:00, 9:30 and 12:00, in dex order.
 * A slot's stats belong to the slot (`TRIO_SLOTS` in `data/enemies.ts`), so no
 * draw is easier than another; each member brings its own patterns.
 */
export const TRIOS = {
  birds: ['articuno', 'zapdos', 'moltres'],
  beasts: ['raikou', 'entei', 'suicune'],
  regis: ['regirock', 'regice', 'registeel'],
} as const satisfies Record<string, readonly [EnemyId, EnemyId, EnemyId]>

export type TrioId = keyof typeof TRIOS
export const TRIO_IDS = Object.keys(TRIOS) as TrioId[]
export type TrioSlot = 0 | 1 | 2

/** The rare finale guest: each run draws one of these, which may join Mewtwo (its event's `chance`). */
export const MYTHICALS = ['mew', 'celebi', 'jirachi'] as const satisfies readonly EnemyId[]
export type Mythical = (typeof MYTHICALS)[number]

/**
 * The mythicals' bad-luck protection (`game/mythicalHunt.ts`), counted in finales
 * since one last fell: the slot's own `chance` up to `free`, `step` more for each
 * one past it, and certain at `sure`.
 */
export const MYTHICAL_PITY = { free: 5, step: 0.06, sure: 20 } as const

/**
 * Who a boss event brings: a fixed `enemy`, the run's trio member for `trio`
 * slot, or the run's `mythical`. `chance` (0..1) makes the boss a rare
 * appearance; omitted = always. `finale`: the climax (Mewtwo). It blasts the
 * horde back on arrival and thins the regular spawns while it lives
 * (`FINALE`), so the fight is about its attacks.
 */
export type BossEvent = { at: number; kind: 'boss'; chance?: number; finale?: true } & ({ enemy: EnemyId } | { trio: TrioSlot } | { mythical: true })

export type WaveEvent =
  | BossEvent
  /** A flock crossing the screen in a straight line: a flyer of `tier` from the run's horde. */
  | { at: number; kind: 'swarm'; tier: Tier; count: number }
  /** A closing circle around the player: a species of `tier` from the run's horde. */
  | { at: number; kind: 'ring'; tier: Tier; count: number }
  /** A closing circle of one fixed species, drawn or not (the Voltorb ring). */
  | { at: number; kind: 'ring'; enemy: EnemyId; count: number }

export const RUN_LENGTH = 15 * 60

export const STAGES: readonly WaveStage[] = [
  { until: 60, rate: 1.4, max: 40, cast: [1, 1, 1], fresh: 3 },
  { until: 120, rate: 2.2, max: 70, cast: [1, 1, 1, 2], fresh: 2 },
  { until: 180, rate: 3, max: 100, cast: [1, 2, 2, 2], fresh: 2 },
  { until: 300, rate: 3.6, max: 130, cast: [1, 2, 2, 2, 3], fresh: 2 },
  { until: 420, rate: 4.2, max: 160, cast: [2, 3, 3, 3, 3], fresh: 3 },
  { until: 600, rate: 5, max: 200, cast: [3, 3, 4, 4], fresh: 2 },
  { until: 780, rate: 7, max: 250, cast: [3, 4, 4, 4, 5], fresh: 2 },
  { until: Infinity, rate: 9, max: 300, cast: [4, 4, 5, 5], fresh: 2 },
]

/** Sorted by `at`. Events sharing a time run in list order (the last boss gets the HP bar). */
export const EVENTS: readonly WaveEvent[] = [
  { at: 75, kind: 'swarm', tier: 1, count: 16 },
  { at: 150, kind: 'boss', enemy: 'onix' },
  { at: 165, kind: 'swarm', tier: 1, count: 24 },
  { at: 240, kind: 'ring', tier: 2, count: 28 },
  { at: 270, kind: 'ring', enemy: 'voltorb', count: 10 },
  { at: 300, kind: 'boss', enemy: 'snorlax' },
  { at: 390, kind: 'swarm', tier: 1, count: 36 },
  { at: 420, kind: 'boss', trio: 0 },
  { at: 480, kind: 'ring', tier: 3, count: 30 },
  { at: 540, kind: 'swarm', tier: 1, count: 40 },
  { at: 570, kind: 'boss', trio: 1 },
  { at: 660, kind: 'ring', tier: 3, count: 40 },
  { at: 720, kind: 'boss', trio: 2 },
  { at: 810, kind: 'swarm', tier: 1, count: 60 },
  { at: RUN_LENGTH, kind: 'boss', mythical: true, chance: 0.1 },
  { at: RUN_LENGTH, kind: 'boss', enemy: 'mewtwo', finale: true },
]

/**
 * While the finale boss lives in the regular run, regular spawns run at `rate`
 * of the stage's and the horde is capped at `max` of its usual size. `push` is
 * the knockback its arrival gives every regular enemy.
 */
export const FINALE = { rate: 0.2, max: 0.25, push: 1100 } as const

/**
 * For the first `duration` seconds of any other wave boss, while it's close
 * enough to attack, regular spawns run at `rate` of the stage's (the cap
 * stays): the boss gets a minute to itself while the horde on the field thins
 * out, then the horde comes back, so a boss left standing gets crowded.
 */
export const BOSS_FIGHT = { rate: 0.3, max: 1, duration: 60 } as const

/**
 * Elites: once the regular horde passes `fill` of its effective cap (stage ×
 * difficulty × pressure), every new regular spawn is an elite, with `hp`, `xp`
 * and `damage` multipliers and a body `size` times wider, as long as elites
 * stay under `share` of the cap. With the horde renewing at the cap
 * (`game/renewal.ts`) a full horde turns partly elite, but never into a wall
 * of them (measured: without `share` a struggling Nightmare run hit ~300).
 * None spawn while the finale boss lives: the last fight stays a duel.
 */
export const ELITE = { fill: 0.9, share: 0.3, hp: 1.6, xp: 1.6, damage: 1.25, size: 1.15 } as const

/**
 * The endless horde's ceiling. The endless pressure grows the regular cap
 * every minute (`endlessPressure`), past 4000 live foes by 150:00 on Normal,
 * and the frame's cost follows the count (drawing, collisions, memory). Past
 * `ceiling` the horde stops growing in bodies and grows in weight instead:
 * each regular spawn stands for `weight` = asked cap / `ceiling` foes
 * (`hordeWeight`), so spawns and endless events come `weight` times fewer,
 * with `weight` times the HP and `weight` ^ `damage` times the damage, and
 * each pays as `weight` foes: shiny `weight` times as often, `weight` times
 * the EXP, its drops (₽, berries, items, an Ability's) `weight` times as
 * likely and as many kills to the run bonus. The HP and the spawns cancel
 * out (the same horde HP comes at the player every second) and the damage
 * leans harder, so the capped run never plays easier; the late bench's bot
 * ends 150:00 within a few % of its uncapped level and ₽. An endless event
 * keeps at least `minEvent` foes. 1200 from measuring a full horde at 150:00: about
 * 1 ms per tick and 8 ms to draw on a 4×-throttled phone, against 6 ms and
 * 60 ms uncapped; it binds from about 52:00 on Normal. Bosses, Alphas, rift
 * and mission spawns are none of it.
 */
export const ENDLESS_HORDE = { ceiling: 1200, damage: 0.25, minEvent: 12 } as const

/**
 * Runners: from stage `from` on, one of each stage's new species (drawn with the
 * roster) spawns as runners, with spawn `weight` (a fresh species has 4), so
 * about one spawn in eight: `speed` times faster (never above `maxSpeed` px/s,
 * under the player's base 68), `hp` times the HP, and they aim where the player
 * will be, leading by up to `lead` seconds of the player's velocity.
 */
export const RUNNER = { from: 1, weight: 2, speed: 1.6, maxSpeed: 62, hp: 0.7, lead: 1 } as const

/** Every boss a boss event may bring: its fixed enemy, its slot's member of each trio, or every mythical. */
export const bossCandidates = (e: BossEvent): readonly EnemyId[] =>
  'enemy' in e ? [e.enemy] : 'trio' in e ? TRIO_IDS.map((id) => TRIOS[id][e.trio]) : MYTHICALS

/** Who a boss event brings in a run that drew `trio` and `mythical`. */
export const bossOf = (e: BossEvent, trio: TrioId, mythical: Mythical): EnemyId =>
  'enemy' in e ? e.enemy : 'trio' in e ? TRIOS[trio][e.trio] : mythical

/** The Noite das Bruxas night bosses that may take a boss event's slot in a haunted run (`HALLOWEEN.bosses`): the ghosts standing in for its fixed enemy. */
export const nightCandidates = (e: BossEvent): readonly EnemyId[] =>
  'enemy' in e ? ((HALLOWEEN.bosses as Partial<Record<EnemyId, readonly EnemyId[]>>)[e.enemy] ?? []) : []

/** `bossWaveAt` by species, worked out once: the boss system asks it of every foe on every tick. */
const waveOfBoss = new Map<EnemyId, number | null>()

/** When the wave a boss belongs to arrives (its scheduled event, a night boss's slot included), or null for bosses off the schedule (rifts, Arceus). */
export const bossWaveAt = (enemy: EnemyId) => {
  let at = waveOfBoss.get(enemy)
  if (at === undefined) {
    at = EVENTS.find((e) => e.kind === 'boss' && (bossCandidates(e).includes(enemy) || nightCandidates(e).includes(enemy)))?.at ?? null
    waveOfBoss.set(enemy, at)
  }
  return at
}


/**
 * Each wave boss has until the next one: when a boss of the wave at `at`
 * arrives, an earlier wave's boss still around flees. Bosses of the same wave
 * (Mew and Mewtwo) stay together, and bosses off the schedule never flee.
 */
export const fleesFrom = (enemy: EnemyId, at: number) => {
  const own = bossWaveAt(enemy)
  return own !== null && own < at
}

/** Index into `STAGES` of the stage active at `time`. */
export const stageIndexAt = (time: number) => {
  const i = STAGES.findIndex((s) => time < s.until)
  return i < 0 ? STAGES.length - 1 : i
}

/** Run time (seconds) a stage starts at. */
export const stageStart = (index: number) => STAGES[index - 1]?.until ?? 0

export const stageAt = (time: number) => STAGES[stageIndexAt(time)]!

/**
 * Regular enemies get tougher every minute; bosses keep their base stats.
 * HP climbs faster after 8:00, when evolved moves sweep the screen, but only
 * so far that a horde sized for the minute still dies to them: late pressure
 * comes from spawn density, not sponges. Damage steepens after 8:00 too, so
 * late contact (and every trait hit, which scale off it) still hurts a
 * built-up player. `ramp` steepens both slopes (the difficulty's `ramp`).
 */
export const scaling = (time: number, ramp = 1) => {
  const minutes = time / 60
  const late = Math.max(0, minutes - 8)
  return { hp: 1 + (minutes * 0.24 + late * 0.6) * ramp, damage: 1 + (minutes * 0.07 + late * 0.12) * ramp }
}
