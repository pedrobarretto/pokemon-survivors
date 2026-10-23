import { chance, createRng, hash2, pick, range, seedFrom } from '../engine/rng'
import { HALLOWEEN, NIGHT_BOSSES } from '../data/halloween'
import { ENEMIES, type EnemyDef, type EnemyId } from '../data/enemies'
import { EVENTS, nightCandidates, stageIndexAt, type WaveEvent } from '../data/waves'
import { brasiliaDay, dayNumber, previousDay, type DayKey } from './day'
import { createFight } from './bossFight'
import { burst, shakeScreen } from './effects'
import { spawnEnemy } from './enemies'
import type { Gift, GiftContent } from './gifts'
import type { Save } from './meta'
import { isRecord, wholeNumber } from './parse'
import { isSupporter } from './supporters'
import type { Roster } from './roster'
import { teamLegend } from './legend'
import { nearestPlayer } from './players'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Noite das Bruxas (`data/halloween.ts`): the event's calendar, the haunted
 * run and the candy jar. A run started on an event day is haunted, a run
 * input like the outbreak (`ReplayStart.halloween`, dealt with a ranked
 * run's token by the API's clock and checked with `halloweenFits`): a ghost joins each stage, Ghost-type foes carry
 * candies (`dropCandies`) and some breakables are jack-o'-lanterns
 * (`crackPumpkin`: a treat of candies, or a trick, a ring of ghosts), and
 * night bosses take the regular wave boss slots (`drawNightBosses`). The
 * candies a run collects go into the save's jar (`HalloweenSave`), which
 * pays `HALLOWEEN_REWARDS` as Mystery Gifts opened from the lobby's gift
 * box (`halloweenGifts`); each night boss's first defeat ticks off the Caça
 * aos Fantasmas (`recordHunt`), which pays `HUNT_REWARDS` once complete. Pure.
 */

/* ---------------- Calendar ---------------- */

/** Whether `day` is one of the event's days. */
export const isHalloweenDay = (day: DayKey) => day >= HALLOWEEN.from && day <= HALLOWEEN.to

/** Whether a run starting at `now` is haunted. */
export const halloweenAt = (now: Date) => isHalloweenDay(brasiliaDay(now))

/** Days from `day` until the event starts: positive while the lobby counts down (from `HALLOWEEN.teaser`), else null. */
export const daysToHalloween = (day: DayKey) => (day >= HALLOWEEN.teaser && day < HALLOWEEN.from ? dayNumber(HALLOWEEN.from) - dayNumber(day) : null)

/** Where `day` stands to the event: before it, on one of its days, or after it (an event legend's card, `ui/starterSelect.ts`). */
export const halloweenStanding = (day: DayKey): 'before' | 'on' | 'after' => (day < HALLOWEEN.from ? 'before' : day > HALLOWEEN.to ? 'after' : 'on')

/** Days left in the event from `day` on, today included; null outside it. */
export const halloweenDaysLeft = (day: DayKey) => (isHalloweenDay(day) ? dayNumber(HALLOWEEN.to) - dayNumber(day) + 1 : null)

/** The event's outbreak of `day` (`HALLOWEEN.outbreaks`), or null to keep the drawn one. */
export const halloweenOutbreak = (day: DayKey): EnemyId | null => (HALLOWEEN.outbreaks as Readonly<Record<string, EnemyId>>)[day] ?? null

/** Every event day with its outbreak, in order: the event screen's calendar. */
export const HALLOWEEN_CALENDAR = Object.entries(HALLOWEEN.outbreaks).map(([day, outbreak]) => ({ day, outbreak }))

/**
 * Whether a run that started at `startedAt` may be haunted: an event day, or
 * the day after one (the menus planned it, or the API dealt its ticket, just
 * before midnight; a ticket's day holds less than a day). A run that isn't
 * haunted always fits.
 */
export const halloweenFits = (haunted: boolean, startedAt: Date) => {
  if (!haunted) return true
  const day = brasiliaDay(startedAt)
  return isHalloweenDay(day) || isHalloweenDay(previousDay(day))
}

/* ---------------- The haunted run ---------------- */

/** Odds of the haunt next to the stage's other species: as common as an average one. */
const hauntWeight = (pool: Roster['stages'][number]) => pool.reduce((sum, [, w]) => sum + w, 0) / Math.max(1, pool.length)

/** The ghosts a legend's run meets: the event's evolved ones (tier 4 up), like the rest of its horde (`LEGEND_HORDE`). */
const LEGEND_HAUNTS: readonly EnemyId[] = HALLOWEEN.haunts.filter((id) => {
  const def: EnemyDef = ENEMIES[id]
  return (def.tier ?? 1) >= 4
})

/** The ghost haunting stage `stage` (`HALLOWEEN.haunts`, `LEGEND_HAUNTS` in a legend's run); past the list, its last one. */
export const hauntAt = (stage: number, legend = false): EnemyId => {
  const haunts = legend ? LEGEND_HAUNTS : HALLOWEEN.haunts
  return haunts[Math.min(stage, haunts.length - 1)]!
}

/**
 * The night bosses of a haunted run with `seed`, aligned with `events`: each
 * regular boss slot takes one of its ghosts (`nightCandidates`), never one
 * already drawn; null for every other event. Drawn on an rng of their own
 * (from the seed), so the rest of the roster stays the same and drawing again
 * gives the same bosses.
 */
export const drawNightBosses = (seed: number, events: readonly WaveEvent[] = EVENTS): (EnemyId | null)[] => {
  const rng = createRng(seedFrom(`night:${seed}`))
  const drawn = new Set<EnemyId>()
  return events.map((e) => {
    if (e.kind !== 'boss') return null
    const open = nightCandidates(e).filter((id) => !drawn.has(id))
    if (open.length === 0) return null
    const id = pick(rng, open)
    drawn.add(id)
    return id
  })
}

/**
 * The haunted cast of a run with `seed`: the stage's ghost (`hauntAt`, a
 * legend's own) in each stage and the night bosses in the regular boss slots
 * (`drawNightBosses`). Done after the draw, so the rest of the cast stays the
 * same; doing it again changes nothing.
 */
export const withHaunts = (roster: Roster, haunted: boolean, seed: number, legend = false): Roster => {
  if (!haunted) return roster
  const night = drawNightBosses(seed)
  return {
    ...roster,
    stages: roster.stages.map((pool, i) => {
      const haunt = hauntAt(i, legend)
      return pool.some(([id]) => id === haunt) ? pool : [...pool, [haunt, hauntWeight(pool)] as const]
    }),
    events: roster.events.map((id, i) => night[i] ?? id),
  }
}

const isGhost = (e: Pick<Enemy, 'types'>) => e.types.includes('ghost')

/** How many candies a fainted foe carries: bosses and Alphas always, Ghost types now and then (more for elites and shinies). */
export const candiesOf = (rng: () => number, e: Pick<Enemy, 'types' | 'boss' | 'alpha' | 'elite' | 'shiny'>, share = 1) => {
  const c = HALLOWEEN.candy
  if (e.boss || e.alpha) return c.boss
  if (!isGhost(e)) return 0
  if (e.shiny) return c.shiny
  if (e.elite) return c.elite
  return chance(rng, c.ghost * share) ? 1 : 0
}

/** Scatters `count` candies around (x, y), like coins. */
export const dropCandies = (g: Game, x: number, y: number, count: number) => {
  const spread = count > 1 ? 36 : 12
  for (let i = 0; i < count; i++) {
    g.pickups.push({ id: g.nextId++, x, y, vx: range(g.rng, -spread, spread), vy: range(g.rng, -spread, -6), attracted: false, age: 0, kind: 'treat' })
  }
}

/** A haunted run's candies from a fainted foe (`killEnemy`). `share` is the pressure director's loot share (`tension.ts`). */
export const faintCandies = (g: Game, e: Enemy, share: number) => {
  if (!g.halloween) return
  const n = candiesOf(g.rng, e, share)
  if (n > 0) dropCandies(g, e.x, e.y - 2, n)
}

/** A candy picked up: into the run's jar. */
export const collectCandy = (g: Game) => {
  g.candies++
  g.events.push({ kind: 'treat' })
}

/** Whether a breakable in world cell (cx, cy) of a haunted run is a jack-o'-lantern. Pure, so the map looks the same when revisited. */
export const isPumpkinCell = (cx: number, cy: number) => hash2(cx, cy, 6613) < HALLOWEEN.pumpkin.share

const PUMPKIN_COLORS = ['#f88820', '#ffc040', '#583010', '#40a038'] as const
const TRICK_COLORS = ['#a058e0', '#e0c0ff', '#58f0b0', '#ffffff'] as const

/**
 * A jack-o'-lantern cracked open at (x, y): doces ou travessuras! Mostly a
 * treat, candies spilling out; else a trick, a ring of the stage's ghost
 * closing in on the player nearest to it (and still one candy).
 */
export const crackPumpkin = (g: Game, x: number, y: number) => {
  const p = HALLOWEEN.pumpkin
  const treat = chance(g.rng, p.treat)
  const ghost = treat ? null : hauntAt(stageIndexAt(g.time), teamLegend(g) !== null)
  burst(g, x, y - 6, { colors: PUMPKIN_COLORS, count: 22, speed: 100, ttl: 0.55, gravity: 90 })
  if (!ghost) {
    dropCandies(g, x, y - 4, p.treatCandies)
  } else {
    dropCandies(g, x, y - 4, p.trickCandies)
    const offset = range(g.rng, 0, Math.PI * 2)
    const { x: px, y: py } = nearestPlayer(g, x, y)
    for (let i = 0; i < p.trickGhosts; i++) {
      const a = offset + (i / p.trickGhosts) * Math.PI * 2
      const gx = px + dm.cos(a) * p.trickRadius
      const gy = py + dm.sin(a) * p.trickRadius
      spawnEnemy(g, ghost, gx, gy)
      burst(g, gx, gy - 8, { colors: TRICK_COLORS, count: 8, speed: 50, ttl: 0.6, gravity: -40 })
    }
  }
  g.events.push({ kind: 'trickOrTreat', ghost })
}

/**
 * A boss's Disguise took a hit whole (`disguiseTakes`): it breaks in a puff of
 * rags, and the boss takes hits from now on. A hit before its first tick starts
 * its fight here, as `updateBosses` would.
 */
export const bustDisguise = (g: Game, e: Enemy) => {
  e.fight ??= createFight(g.rng, g.difficulty, { x: e.x, y: e.y })
  e.fight.busted = true
  e.flash = 0.3
  shakeScreen(g, 4, e)
  burst(g, e.x, e.y - e.radius, { colors: ['#f8e078', '#c8a048', '#584020', '#ffffff'], count: 30, speed: 110, ttl: 0.55, gravity: 120 })
  g.events.push({ kind: 'disguise', enemy: e.kind })
}

/** A boss fell (`killEnemy`): in a haunted run, a night boss goes into the run's tally (the save's checklist reads it from the run's results, `recordHunt`) and the shell toasts it. */
export const nightBossDown = (g: Game, e: Enemy) => {
  if (!g.halloween || !NIGHT_BOSSES.includes(e.kind)) return
  g.tally.nightBosses.push(e.kind)
  g.events.push({ kind: 'nightBoss', enemy: e.kind })
}

/** Dex numbers of the event's ghosts, for the shell to warm up before the lobby's haunted meadow wants them. */
export const HAUNT_DEX = [...new Set(HALLOWEEN.haunts.map((id) => ENEMIES[id].dex))]

/* ---------------- The candy jar ---------------- */

/** The save's side of the event: every candy brought home from a haunted run, and the night bosses beaten (the Caça aos Fantasmas, in `NIGHT_BOSSES` order). */
export type HalloweenSave = { candies: number; hunted: readonly EnemyId[] }

export const NO_HALLOWEEN: HalloweenSave = { candies: 0, hunted: [] }

/** The night bosses of a list, once each, in `NIGHT_BOSSES` order (unknown ids dropped). */
const huntOf = (ids: readonly unknown[]) => NIGHT_BOSSES.filter((id) => ids.includes(id))

export const parseHalloween = (raw: unknown): HalloweenSave => {
  const r = isRecord(raw) ? raw : {}
  return { candies: wholeNumber(r.candies), hunted: Array.isArray(r.hunted) ? huntOf(r.hunted) : [] }
}

/** Two devices' sides: the fuller jar (candies brought home on both sides apart aren't added up, like the records) and every night boss either beat. */
export const mergeHalloween = (a: HalloweenSave, b: HalloweenSave): HalloweenSave => ({ candies: Math.max(a.candies, b.candies), hunted: huntOf([...a.hunted, ...b.hunted]) })

/** Banks a run's candies into the jar. */
export const addCandies = (save: Save, candies: number): Save => (candies > 0 ? { ...save, halloween: { ...save.halloween, candies: save.halloween.candies + candies } } : save)

/**
 * Ticks a run's beaten night bosses (`RunSummary.nightBosses`) off the Caça
 * aos Fantasmas: each one new to it pays `HALLOWEEN.hunt.candies` into the
 * jar. Safe to record again: a boss already ticked pays nothing.
 */
export const recordHunt = (h: HalloweenSave, beaten: readonly EnemyId[]): HalloweenSave => {
  const fresh = huntOf(beaten).filter((id) => !h.hunted.includes(id))
  return fresh.length === 0 ? h : { candies: h.candies + fresh.length * HALLOWEEN.hunt.candies, hunted: huntOf([...h.hunted, ...fresh]) }
}

/** Whether every night boss has been beaten. */
export const huntDone = (h: HalloweenSave) => h.hunted.length >= NIGHT_BOSSES.length

/** What the Caça aos Fantasmas pays once every night boss fell: the Exorcista title and the Espectral frame. */
export const HUNT_REWARDS = [
  { kind: 'title', title: 'exorcist' },
  { kind: 'style', style: { slot: 'frame', id: 'spectral' } },
] as const satisfies readonly GiftContent[]

/** The Mystery Gift id of a Caça aos Fantasmas reward (made by the game, like the jar's). */
export const huntGiftId = (index: number) => `halloween2026:hunt${index}`

/**
 * What the jar pays, in order: the Abóbora frame for showing up, then the
 * Noite das Bruxas background, a rare egg, the Casa Assombrada wallpaper,
 * the Rei das Abóboras title and a shiny Gastly.
 */
export const HALLOWEEN_REWARDS = [
  { candies: 0, content: { kind: 'style', style: { slot: 'frame', id: 'pumpkin' } } },
  { candies: 60, content: { kind: 'style', style: { slot: 'background', id: 'halloween' } } },
  { candies: 150, content: { kind: 'egg', tier: 'rare' } },
  { candies: 300, content: { kind: 'style', style: { slot: 'wallpaper', id: 'haunted' } } },
  { candies: 500, content: { kind: 'title', title: 'pumpkinKing' } },
  { candies: 800, content: { kind: 'shinyHatch', family: 'gastly' } },
] as const satisfies readonly { candies: number; content: GiftContent }[]

/** The Mystery Gift id of a reward: the save keeps it once applied, so each lands once (on any device). */
export const halloweenGiftId = (index: number) => `halloween2026:${index}`

/** Whether a gift is one of the jar's, made by the game rather than listed by the API. */
export const isHalloweenGift = (id: string) => id.startsWith('halloween2026:')

/** The supporters' gift: Pumpkaboo, a companion no one else gets (it leaves candy sparkles behind as it walks). */
export const PUMPKABOO_GIFT = { id: 'halloween2026:pumpkaboo', content: { kind: 'companion', id: 'pumpkaboo' }, reason: { kind: 'halloweenSupport' } } as const satisfies Gift

/**
 * The event's gifts waiting to be opened on `day`: every reward the jar's
 * candies reached that the save didn't apply yet (the frame for showing up
 * needs an event day, or a candy already in the jar), the Caça aos Fantasmas
 * rewards once every night boss fell, and Pumpkaboo for a supporter on an
 * event day.
 */
export const halloweenGifts = (save: Save, day: DayKey): Gift[] => [
  ...HALLOWEEN_REWARDS.flatMap((r, i) => {
    const id = halloweenGiftId(i)
    const reached = r.candies === 0 ? isHalloweenDay(day) || save.halloween.candies > 0 : save.halloween.candies >= r.candies
    return reached && !save.gifts.includes(id) ? [{ id, content: r.content, reason: { kind: 'halloween' } } satisfies Gift] : []
  }),
  ...(huntDone(save.halloween)
    ? HUNT_REWARDS.flatMap((content, i) => {
        const id = huntGiftId(i)
        return save.gifts.includes(id) ? [] : [{ id, content, reason: { kind: 'ghostHunt' } } satisfies Gift]
      })
    : []),
  ...(isSupporter(save) && isHalloweenDay(day) && !save.gifts.includes(PUMPKABOO_GIFT.id) ? [PUMPKABOO_GIFT] : []),
]

/** The next reward the jar fills toward, or null once every one is reached. */
export const nextHalloweenReward = (candies: number) => HALLOWEEN_REWARDS.find((r) => r.candies > candies) ?? null

/* ---------------- The supporters' jack-o'-lantern ---------------- */

/**
 * Whether a supporter since `since` (ISO, as the API sends it) wears the
 * Noite das Bruxas badge at `now`: a jack-o'-lantern with a heart carved in,
 * instead of the heart. Anyone who supported the game by the event's last
 * day, from its first day on and for good.
 */
export const pumpkinSupporter = (since: string | null | undefined, now: Date) => {
  const at = since ? Date.parse(since) : Number.NaN
  return Number.isFinite(at) && brasiliaDay(new Date(at)) <= HALLOWEEN.to && brasiliaDay(now) >= HALLOWEEN.from
}

/** Whether a supporter since `since` gets the candle-lit ranking row at `now`: the badge's supporters, only while the event is on. */
export const pumpkinRow = (since: string | null | undefined, now: Date) => halloweenAt(now) && pumpkinSupporter(since, now)

/** Whether becoming a supporter on `day` still earns the jack-o'-lantern: the lobby offers it from the countdown to the event's last day. */
export const pumpkinOfferOpen = (day: DayKey) => day >= HALLOWEEN.teaser && day <= HALLOWEEN.to
