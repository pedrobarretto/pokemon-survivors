import { describe, expect, it } from 'vitest'
import type { PlazaStage } from '../data/festivals'
import type { ShopLevel } from '../data/shop'
import { STALL_IDS } from '../data/visitors'
import { OVAL, squarePlan, type Halves, type Pad, type PlazaFestival, type PlazaVisitors } from './plaza'

/** The painted half widths of `shop-lv1.png` … `shop-lv5.png` and `boutique.png`, as `measure` finds them. */
const SHOP_HALVES = { 1: 34, 2: 68, 3: 68, 4: 84, 5: 84 } as const satisfies Record<ShopLevel, number>
const halvesAt = (level: ShopLevel): Halves => ({ shop: SHOP_HALVES[level], lots: { boutique: 53 } })

const LEVELS: readonly ShopLevel[] = [1, 2, 3, 4, 5]
const STAGES: readonly PlazaStage[] = [0, 1, 2, 3, 4]
const VISITORS: readonly PlazaVisitors[] = [false, true].flatMap((caravan) =>
  [null, ...STALL_IDS].flatMap((stall) => [false, true].map((statue) => ({ caravan, stall, statue }))),
)
const FESTIVALS: readonly PlazaFestival[] = [
  { fountain: false, stage: 0, running: false },
  { fountain: true, stage: 0, running: false },
  ...STAGES.map((stage) => ({ fountain: true, stage, running: true })),
]
const STATES = LEVELS.flatMap((level) => VISITORS.flatMap((v) => FESTIVALS.map((f) => ({ level, v, f, plan: squarePlan(level, halvesAt(level), v, f) }))))

/** Whether (x, y) lies `margin` px or more inside the square's curb. */
const onSquare = (x: number, y: number, margin = 0) => ((x - OVAL.x) / (OVAL.rx - margin)) ** 2 + ((y - OVAL.y) / (OVAL.ry - margin)) ** 2 <= 1

/** Whether (x, y) lies inside a footprint, stretched `back` times behind its middle as walkers find it. */
const onPad = (p: Pad, x: number, y: number) => ((x - p.x) / p.rx) ** 2 + ((y - p.y) / (y < p.y ? p.ry * p.back : p.ry)) ** 2 < 1

/** Points round a footprint's edge. */
const rimOf = (p: Pad, n = 48) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return { x: p.x + p.rx * Math.cos(a), y: p.y + Math.sin(a) * (Math.sin(a) < 0 ? p.ry * p.back : p.ry) }
  })

const overlap = (a: Pad, b: Pad) => onPad(a, b.x, b.y) || onPad(b, a.x, a.y) || rimOf(a).some((q) => onPad(b, q.x, q.y))

const name = (s: (typeof STATES)[number]) => `Lv ${s.level} ${JSON.stringify(s.v)} ${JSON.stringify(s.f)}`

describe('squarePlan', () => {
  it('keeps every footprint on the square, the buildings with their fronts on it', () => {
    for (const s of STATES) {
      for (const p of s.plan.pads.slice(0, s.plan.buildings)) expect([p.x - p.rx, p.x + p.rx].every((x) => onSquare(x, p.y)) && onSquare(p.x, p.y + p.ry), name(s)).toBe(true)
      for (const p of s.plan.pads.slice(s.plan.buildings)) expect(rimOf(p).every((q) => onSquare(q.x, q.y, 3)), `${name(s)} ${JSON.stringify(p)}`).toBe(true)
    }
  })

  it('never lets two footprints overlap', () => {
    for (const s of STATES) {
      const pads = s.plan.pads
      for (let i = 0; i < pads.length; i++) for (let j = i + 1; j < pads.length; j++) expect(overlap(pads[i]!, pads[j]!), `${name(s)} ${JSON.stringify([pads[i], pads[j]])}`).toBe(false)
    }
  })

  it('stands every Pokémon and every shopping spot on the open square, clear of the footprints and of each other', () => {
    for (const s of STATES) {
      const stands = [...s.plan.people, ...s.plan.spots]
      for (const p of stands) {
        expect(onSquare(p.x, p.y, 6), `${name(s)} ${JSON.stringify(p)}`).toBe(true)
        expect(s.plan.pads.some((pad) => onPad(pad, p.x, p.y)), `${name(s)} ${JSON.stringify(p)}`).toBe(false)
      }
      for (let i = 0; i < stands.length; i++) for (let j = i + 1; j < stands.length; j++) expect(Math.hypot(stands[i]!.x - stands[j]!.x, stands[i]!.y - stands[j]!.y), name(s)).toBeGreaterThan(16)
    }
  })
})
