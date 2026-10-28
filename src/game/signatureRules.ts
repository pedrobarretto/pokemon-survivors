import * as dm from '../engine/dmath'
import { LUNGE_CONE } from './moveRules'

/**
 * Pure rules of the starter signature moves (`signatureMoves.ts`): who a leap
 * picks, how the HP-scaled moves scale, Petal Dance's tempo, Aqua Step's
 * stacking speed and Snipe Shot's range bonus. Tested in `signatureRules.test.ts`.
 */

type Point = { x: number; y: number }
type Foe = Point & { id: number; dying: number }

/**
 * The foe at the heart of the biggest cluster: among the living foes within
 * `range` of (x, y), the one with the most neighbors within `radius`. Ties go
 * to the nearer one, then the lower id, so every engine picks the same.
 * `ahead` (the stick, while the player walks) keeps only the foes roughly
 * ahead of it (`LUNGE_CONE`), so a leap never yanks the player against the joystick.
 */
export const densestFoe = <T extends Foe>(foes: readonly T[], x: number, y: number, range: number, radius: number, ahead: Point | null = null): T | null => {
  const near: T[] = []
  for (const e of foes) {
    if (e.dying >= 0) continue
    const dx = e.x - x
    const dy = e.y - y
    const d = dm.sq(dx) + dm.sq(dy)
    if (d > range * range) continue
    if (ahead && d > 0 && dx * ahead.x + dy * ahead.y < LUNGE_CONE * dm.hypot(dx, dy)) continue
    near.push(e)
  }
  let best: T | null = null
  let bestCount = -1
  let bestD = Infinity
  for (const e of near) {
    let count = 0
    for (const o of near) if (o !== e && dm.sq(o.x - e.x) + dm.sq(o.y - e.y) <= radius * radius) count++
    const d = dm.sq(e.x - x) + dm.sq(e.y - y)
    if (count > bestCount || (count === bestCount && (d < bestD || (d === bestD && best !== null && e.id < best.id)))) {
      best = e
      bestCount = count
      bestD = d
    }
  }
  return best
}

/** Eruption's damage multiplier at an HP fraction: full power at full HP, never under `ERUPTION_FLOOR`. */
export const ERUPTION_FLOOR = 0.3
export const eruptionScale = (hpFraction: number) => ERUPTION_FLOOR + (1 - ERUPTION_FLOOR) * Math.max(0, Math.min(1, hpFraction))

/** Flame Charge hits harder the bulkier the player: ×1 at 100 max HP, +1 per 100 more, up to `CHARGE_MAX`. */
export const CHARGE_MAX = 2.5
export const chargeScale = (maxHp: number) => Math.max(1, Math.min(CHARGE_MAX, maxHp / 100))

/** Petal Dance: casts in a row before the dancer gets dizzy, and how much faster each one spins. */
export const PETAL_CASTS = 3
export const PETAL_SPEEDUP = 0.45
/** The spin multiplier of the `n`th cast in a row (0-based) and whether it's the one that leaves the player dizzy. */
export const petalTempo = (n: number) => ({ spin: 1 + PETAL_SPEEDUP * (n % PETAL_CASTS), dizzy: n % PETAL_CASTS === PETAL_CASTS - 1 })

/** Aqua Step: speed per dance and the most dances it stacks to. */
export const AQUA_STEP_SPEED = 0.03
export const AQUA_STEP_MAX = 5
/** Dances in a row after one more: they count while the last dance's speed still holds, and start over once it ran out. */
export const aquaStacks = (stacks: number, active: boolean) => (active ? stacks : 0) + 1
/** The speed share `stacks` dances in a row give, capped at `AQUA_STEP_MAX` dances. */
export const aquaSpeed = (stacks: number) => AQUA_STEP_SPEED * Math.min(AQUA_STEP_MAX, stacks)

/** Snipe Shot gains ×1 per `SNIPE_FALLOFF` px flown, up to +`SNIPE_MAX`. */
export const SNIPE_FALLOFF = 160
export const SNIPE_MAX = 1.5
export const snipeScale = (flown: number) => 1 + Math.min(SNIPE_MAX, Math.max(0, flown) / SNIPE_FALLOFF)

/** Wood Hammer's recoil: this share of max HP when the swing connects, never taking the last HP. */
export const HAMMER_RECOIL = 0.04
export const recoilFor = (hp: number, maxHp: number) => Math.max(0, Math.min(hp - 1, dm.round(maxHp * HAMMER_RECOIL)))

/** Rhythm moves (Leaf Blade's crit, Drum Beating's downbeat): the beat after `count` casts, and whether it's the strong one. */
export const beatOf = (count: number, bar: number) => ({ next: (count + 1) % bar, strong: count % bar === bar - 1 })
