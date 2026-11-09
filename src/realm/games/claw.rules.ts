/**
 * The Máquina de Pelúcias' rules (`MINIGAMES.claw`): pure and import-free,
 * shared by the API, which decides every drop, and the client, which only
 * draws what the API answered.
 *
 * Nothing here rolls odds. A credit's seed only shakes the plushes a little
 * where everyone can see them (so no spot is worth memorizing); whether a drop
 * wins is how centered the claw is against what that plush still needs, and
 * each miss lowers that need and moves the plush toward the chute. The tenth
 * credit on a plush wins wherever the claw comes down.
 *
 * The pit's units are the game's own pixels: x left to right, y back to front.
 */

export const CLAW = {
  /** The pit's floor. */
  pit: { w: 160, h: 110 },
  /** The prize chute, in the front right corner: where a nudged plush heads. */
  chute: { x: 146, y: 100 },
  /** Plushes in the machine each week. */
  prizes: 6,
  /** Credits on one plush that guarantee it. */
  guarantee: 10,
  /** How far off center (units) the claw still touches a plush. */
  reach: 22,
  /** The grip (0..1) a plush nobody has missed yet asks for. */
  firstNeed: 0.92,
  /** Share of the way to the chute a plush has come by its last miss. */
  nudge: 0.7,
  /** The week's own scatter around a slot, and a credit's on top of it (units either way). */
  scatter: 6,
  shake: 3,
  /** Seconds to aim before the claw drops by itself. */
  seconds: 20,
  /** Credits a Brasília day: the first ones free, the rest for `price` ₽, `dailyCap` in all. */
  free: 1,
  price: 2000,
  dailyCap: 10,
} as const

/** A point on the pit's floor. */
export type PitPoint = { x: number; y: number }

/** The places plushes stand in, before the week's scatter: three across, two deep, clear of the chute. */
const SLOTS: readonly PitPoint[] = [
  { x: 26, y: 32 },
  { x: 70, y: 32 },
  { x: 114, y: 32 },
  { x: 26, y: 70 },
  { x: 70, y: 70 },
  { x: 114, y: 70 },
]

/** A text's 32-bit hash (FNV-1a). */
const hashText = (text: string) => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** A small seeded generator (mulberry32): the next number in 0..1 each call. */
const rngFrom = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `list` in the order `next` shuffles it to. */
const shuffled = <T>(list: readonly T[], next: () => number): T[] => {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    const a = out[i]!
    out[i] = out[j]!
    out[j] = a
  }
  return out
}

/** Whole weeks since the epoch of a week's Monday (`YYYY-MM-DD`). */
const weekNumber = (week: string) => Math.floor(Date.parse(`${week}T00:00:00Z`) / (7 * 86_400_000))

/**
 * The week's plushes, in the order they stand: one of `exclusives`, taking
 * turns week by week so none waits long, and the rest drawn from `pool`.
 * The same for every player, from the Brasília week's Monday alone.
 */
export const weeklyPrizes = <F extends string>(week: string, pool: readonly F[], exclusives: readonly F[]): F[] => {
  const next = rngFrom(hashText(`prizes:${week}`))
  const rest = shuffled(pool.filter((f) => !exclusives.includes(f)), next).slice(0, CLAW.prizes - 1)
  const turn = ((weekNumber(week) % exclusives.length) + exclusives.length) % exclusives.length
  return shuffled([exclusives[turn]!, ...rest], next)
}

/**
 * Where each plush stands for a credit: its slot, the week's scatter, as far
 * toward the chute as its `misses` brought it, and the credit's own shake
 * (`seed`; 0 shows the machine before a credit goes in, unshaken).
 */
export const pitLayout = (week: string, misses: readonly number[], seed: number): PitPoint[] => {
  const weekly = rngFrom(hashText(`pit:${week}`))
  const slots = shuffled(SLOTS, weekly).map((s) => ({ x: s.x + (weekly() * 2 - 1) * CLAW.scatter, y: s.y + (weekly() * 2 - 1) * CLAW.scatter }))
  const shake = rngFrom(seed)
  return slots.map((s, i) => {
    const share = (Math.min(misses[i] ?? 0, CLAW.guarantee - 1) / (CLAW.guarantee - 1)) * CLAW.nudge
    const dx = seed === 0 ? 0 : (shake() * 2 - 1) * CLAW.shake
    const dy = seed === 0 ? 0 : (shake() * 2 - 1) * CLAW.shake
    return { x: s.x + (CLAW.chute.x - s.x) * share + dx, y: s.y + (CLAW.chute.y - s.y) * share + dy }
  })
}

/** How centered the claw is on a plush standing at `at`: 1 dead on, 0 at `CLAW.reach` or further. */
export const gripOn = (claw: PitPoint, at: PitPoint) => Math.max(0, 1 - Math.hypot(claw.x - at.x, claw.y - at.y) / CLAW.reach)

/** The grip a plush asks for after `misses`: down a step each miss, nothing at all on the last credit. */
export const gripNeeded = (misses: number) => CLAW.firstNeed * Math.max(0, 1 - misses / (CLAW.guarantee - 1))

/** What a drop came to: which plush it went for (always the nearest, so even a drop on bare floor counts toward one), the grip, and whether it held. */
export type DropResult = { target: number; grip: number; won: boolean }

/** Decides a drop at `claw` over the plushes at `layout`, each with its `misses` so far. */
export const resolveDrop = (claw: PitPoint, layout: readonly PitPoint[], misses: readonly number[]): DropResult => {
  let target = 0
  for (let i = 1; i < layout.length; i++) {
    if (Math.hypot(claw.x - layout[i]!.x, claw.y - layout[i]!.y) < Math.hypot(claw.x - layout[target]!.x, claw.y - layout[target]!.y)) target = i
  }
  const grip = gripOn(claw, layout[target]!)
  return { target, grip, won: grip >= gripNeeded(misses[target] ?? 0) }
}

/** The claw held inside the pit. */
export const clampToPit = (p: PitPoint): PitPoint => ({ x: Math.min(CLAW.pit.w, Math.max(0, p.x)), y: Math.min(CLAW.pit.h, Math.max(0, p.y)) })

/** What the next credit costs after `used` today: free, ₽, or null past the day's cap. */
export const creditPrice = (used: number): number | null => (used >= CLAW.dailyCap ? null : used < CLAW.free ? 0 : CLAW.price)
