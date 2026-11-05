/**
 * The arcade games' numbers and pure rules (Berry Rain, `berryCatch.ts`;
 * Whack-a-Diglett, `whackDiglett.ts`): what each thing is worth, how a combo
 * multiplies, how the pace ramps through a round and when a round earns a
 * feat. The screens only move things around and call these, so the scoring
 * is tested here (`arcadeRules.test.ts`).
 */

/** A round's length (s) after the count in. */
export const BERRY_ROUND = 90
export const WHACK_ROUND = 60

/** Berry Rain's lives: a Voltorb that hits the partner takes one. */
export const BERRY_LIVES = 3

/** The falling berries, what each is worth before the combo, and how often each comes (weights). Golden is the bonus. */
export const BERRIES = {
  oran: { points: 5, weight: 34 },
  pecha: { points: 5, weight: 30 },
  razz: { points: 10, weight: 22 },
  sitrus: { points: 15, weight: 14 },
  golden: { points: 50, weight: 0 },
} as const

export type BerryKind = keyof typeof BERRIES

/** Picks a regular berry (not golden) from a roll in [0, 1). */
export const pickBerry = (roll: number): BerryKind => {
  const kinds = (Object.keys(BERRIES) as BerryKind[]).filter((k) => BERRIES[k].weight > 0)
  const total = kinds.reduce((s, k) => s + BERRIES[k].weight, 0)
  let r = roll * total
  for (const k of kinds) {
    r -= BERRIES[k].weight
    if (r < 0) return k
  }
  return kinds[kinds.length - 1]!
}

/** The combo's multiplier: ×1, then one more every `step` catches in a row, up to `max`. */
export const comboMult = (combo: number, step = 10, max = 4) => Math.min(max, 1 + Math.floor(Math.max(0, combo) / step))

/** How far through a round `t` s is, 0..1. */
const progress = (t: number, length: number) => Math.min(1, Math.max(0, t / length))

/**
 * Berry Rain's pace `t` s into the round: seconds between drops, how fast
 * things fall (screen heights a second), the share of drops that are Voltorb.
 * Starts gentle and ends a rush.
 */
export const berryPace = (t: number) => {
  const k = progress(t, BERRY_ROUND)
  return { every: 0.85 - 0.55 * k, fall: 0.22 + 0.33 * k, voltorb: 0.1 + 0.22 * k }
}

/** A box on a cabinet's screen (game px). */
export type Rect = { x: number; y: number; w: number; h: number }

/** Berry Rain's touch pads: the columns either side of a sideways field (px wide), the soil under an upright one (px deep). */
export const BERRY_PADS = { side: 32, soil: 46 } as const

/** How deep the soil under the field is without pads (px). */
const SOIL = 18

/**
 * Where Berry Rain's field and its ← → pads sit on a screen whose field is
 * `field`: the screen's size, the field's left edge and width, the ground's
 * height and the pads (null without a touch screen: the field is the whole
 * screen and the keys or the pointer steer). Upright, the pads sit in a
 * deeper soil under the field, a half each; sideways, in columns either side
 * of it, so the screen grows by them and the field keeps its width.
 */
export const berryLayout = (field: { w: number; h: number }, touch: boolean) => {
  if (!touch) return { w: field.w, h: field.h, field: { x: 0, w: field.w }, ground: field.h - SOIL, pads: null }
  if (field.h > field.w) {
    const ground = field.h - BERRY_PADS.soil
    const half = Math.floor(field.w / 2)
    const band = { y: ground, h: field.h - ground }
    return { w: field.w, h: field.h, field: { x: 0, w: field.w }, ground, pads: { left: { x: 0, w: half, ...band }, right: { x: half, w: field.w - half, ...band } } }
  }
  const side = BERRY_PADS.side
  const col = { y: 0, w: side, h: field.h }
  return { w: field.w + side * 2, h: field.h, field: { x: side, w: field.w }, ground: field.h - SOIL, pads: { left: { x: 0, ...col }, right: { x: side + field.w, ...col } } }
}

export type BerryLayout = ReturnType<typeof berryLayout>
export type BerryPads = NonNullable<BerryLayout['pads']>

/** Whether (x, y) falls in a box. */
export const inRect = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h

/** Which way the pads steer from the pointers pressed now (oldest first): the newest one on a pad wins, -1 left, 1 right, 0 neither. */
export const padSteer = (pointers: readonly { x: number; y: number }[], pads: BerryPads): -1 | 0 | 1 => {
  for (let i = pointers.length - 1; i >= 0; i--) {
    const p = pointers[i]!
    if (inRect(pads.left, p.x, p.y)) return -1
    if (inRect(pads.right, p.x, p.y)) return 1
  }
  return 0
}

/** Seconds between golden berries: one in a while, sooner as the round goes. */
export const GOLDEN_EVERY = { from: 16, to: 9 } as const
export const goldenGap = (t: number) => GOLDEN_EVERY.from - (GOLDEN_EVERY.from - GOLDEN_EVERY.to) * progress(t, BERRY_ROUND)

/** Whack-a-Diglett's pace `t` s in: seconds between pop-ups, how long one stays up, how many at once, the share of Voltorb and of Dugtrio. */
export const whackPace = (t: number) => {
  const k = progress(t, WHACK_ROUND)
  return { every: 0.8 - 0.45 * k, up: 1.35 - 0.75 * k, most: 1 + Math.floor(k * 3.2), voltorb: 0.08 + 0.14 * k, dugtrio: 0.07 }
}

/** What a whack is worth: a Diglett 10, a Dugtrio 40 (it's quick), times the combo (every 5 in a row, up to ×5). */
export const WHACK_POINTS = { diglett: 10, dugtrio: 40 } as const
export const whackScore = (kind: keyof typeof WHACK_POINTS, combo: number) => WHACK_POINTS[kind] * comboMult(combo, 5, 5)

/** Whacking a Voltorb costs this much (never below zero) and the combo. */
export const VOLTORB_FINE = 50

/** Berry Rain's feats: a whole round without losing a life, three golden berries, a 50 combo. */
export const BERRY_FEATS = { flawless: 'flawless', goldRush: 'goldRush', combo50: 'combo50' } as const

/** Whack-a-Diglett's feats: a 30 combo, five Dugtrio in a round. */
export const WHACK_FEATS = { combo30: 'combo30', dugtrio: 'dugtrio' } as const

/** The feats a finished Berry Rain round earned. */
export const berryFeats = (r: { livesLost: number; finished: boolean; goldens: number; bestCombo: number }): string[] => [
  ...(r.finished && r.livesLost === 0 ? [BERRY_FEATS.flawless] : []),
  ...(r.goldens >= 3 ? [BERRY_FEATS.goldRush] : []),
  ...(r.bestCombo >= 50 ? [BERRY_FEATS.combo50] : []),
]

/** The feats a finished Whack-a-Diglett round earned. */
export const whackFeats = (r: { bestCombo: number; dugtrios: number }): string[] => [
  ...(r.bestCombo >= 30 ? [WHACK_FEATS.combo30] : []),
  ...(r.dugtrios >= 5 ? [WHACK_FEATS.dugtrio] : []),
]
