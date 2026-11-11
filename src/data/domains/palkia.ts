import { pin, PIN_EVERY } from './kit'
import { circle, lane, poly, type Pt } from '../arenas'
import type { BossPattern } from '../bosses'
import type { LegendDomain } from '../domains'

/**
 * Palkia's domain, Folded Space (Dialga's twin: space where Dialga's is
 * time). Slabs of pearl adrift in a pink void, broken apart: the way north
 * crosses the gaps only through twin portals, a mouth on the near rim and its
 * twin across. Every few seconds space twists (`game/palkiaDomain.ts`): for a
 * moment the mouths lead back one slab instead, while the fold behind keeps
 * coming. Clamperl, Staryu, Starmie and Gabite guard the way. Then the pearl
 * hall, a wide floor with pearl spires for cover, where Palkia tears in.
 *
 * The battle: (1) from its dais, Spacial Rend tears straight lines across the
 * whole hall (the gaps between them are the safe lanes), Aqua Tail rings and a
 * Hydro Pump the spires stop; (2) space wraps (the hall's east and west edges
 * join: walk off one, come in on the other, and so do its shots) and Palkia
 * swaps places with the player down a tether it warns of; its Spacial Rend
 * crosses tears into a lattice; (3) Origin Forme: space folds in (the hall
 * narrows and widens again), tears open in the floor, and its Spacial Rend
 * draws space in toward it before it bursts, sparing only those who pulled
 * away.
 */

/** Half the pearl hall's width: its east and west edges are where space wraps in the second phase. */
export const HALL = { half: 176, top: -96, bottom: 132 } as const

/**
 * The crossing's twin portals (`Crossing.portals`), domain px: `from` on the
 * near rim of a gap, `to` across it. Stepping into `from` comes out at `to`;
 * while space is twisted it throws the player back where they last landed
 * instead (`gateExit` in `game/palkiaDomain.ts`).
 */
export const GATES: readonly { from: Pt; to: Pt }[] = [
  { from: [0, -232], to: [0, -360] },
  { from: [-74, -682], to: [-80, -816] },
  { from: [51, -1134], to: [60, -1266] },
  { from: [-14, -1583], to: [-20, -1716] },
]

/** Pearl spires in the hall: cover from Hydro Pump and the first phase's blast. */
const SPIRES = [
  [-118, -40],
  [118, -40],
  [-62, 52],
  [62, 52],
  [-132, 104],
  [132, 104],
] as const

/** Spacial Rend: parallel tears across the hall from past the screen's edge, `spread` px apart (the gaps are safe), the middle one through the player. */
const rend = (every: number, count: number, spread: number, windup = 1.2, damage = 20): BossPattern => ({
  kind: 'beam', every, source: 'edge', count, spread, windup, duration: 0.45, width: 11, length: 520, damage, visual: 'space',
})

/** Spacial Rend crossed: two sets of tears at right angles; the pockets where their gaps meet are safe. */
const lattice = (count: number, spread: number, windup = 1.3, damage = 22): BossPattern => ({
  kind: 'beam', every: 0, source: 'lattice', count, spread, windup, duration: 0.45, width: 11, length: 520, damage, visual: 'space', cross: 'water',
})

/** Hydro Pump out of Palkia, stopped by the spires. */
const pump = (every: number, count: number, spread: number): BossPattern => ({
  kind: 'beam', every, source: 'boss', count, spread, windup: 1.1, duration: 0.6, width: 13, length: 380, damage: 18, visual: 'water', blocked: true,
})

/** Aqua Tail: a ring of water around Palkia, its gap the way through. */
const aquaTail = (every: number, count: number, gap?: number): BossPattern => ({ kind: 'ring', every, count, speed: 56, radius: 5, damage: 15, visual: 'water', ...(gap ? { gap } : {}) })

export const PALKIA_DOMAIN: LegendDomain = {
  omen: { weather: 'clear', sky: 'foldedSpace' },
  backdrop: 'space',
  entrance: 'rend',
  music: 'palkia',
  hp: 1.3,
  battleTime: 180,
  crossing: {
    // Pearl slabs drifting north, each cut off from the next: only the twin portals (`GATES`) cross the gaps.
    floor: [
      circle(0, 0, 78),
      lane([0, -40], [0, -244], 96),
      circle(0, -430, 96),
      lane([0, -480], [-80, -698], 90),
      circle(-80, -870, 92),
      lane([-80, -930], [60, -1148], 90),
      circle(60, -1320, 94),
      lane([60, -1380], [-20, -1598], 90),
      circle(-20, -1770, 90),
      lane([-20, -1830], [0, -2066], 84),
    ],
    holes: [circle(-36, -904, 16), circle(96, -1300, 15)],
    pattern: 'pearl',
    solids: [
      { piece: 'pearlSpire', x: -34, y: -130 },
      { piece: 'pearlSpire', x: 52, y: -440 },
      { piece: 'pearlPillar', x: -40, y: -560 },
      { piece: 'pearlSpire', x: -120, y: -880 },
      { piece: 'pearlPillar', x: 0, y: -1020 },
      { piece: 'pearlSpire', x: 100, y: -1310 },
      { piece: 'pearlPillar', x: 20, y: -1480 },
      { piece: 'pearlSpire', x: -60, y: -1760 },
      { piece: 'pearlPillar', x: -36, y: -1964 },
      { piece: 'pearlPillar', x: 18, y: -1964 },
    ],
    start: [0, 22],
    gate: -2030,
    portals: GATES,
    threat: { kind: 'fold', start: 150, stop: -1920, delay: 2.5, speed: 28, rush: 2.4, gap: 170, damage: 0.05, every: 0.5, push: 34, ground: 'none' },
    retinue: {
      first: 1.5,
      every: 2.6,
      count: 1,
      max: 5,
      members: [
        { id: 'clamperl', weight: 4, role: 'runner' },
        { id: 'staryu', weight: 3, role: 'runner' },
        { id: 'starmie', weight: 2, role: 'spitter' },
        { id: 'gabite', weight: 1, role: 'elite' },
      ],
    },
    theme: 'snow',
  },
  arena: {
    at: [0, -2190],
    floor: [poly([-HALL.half, HALL.top], [HALL.half, HALL.top], [HALL.half, HALL.bottom], [-HALL.half, HALL.bottom]), circle(0, HALL.top, 74)],
    pattern: 'pearl',
    solids: SPIRES.map(([x, y], i) => ({ piece: i < 2 ? ('pearlPillar' as const) : ('pearlSpire' as const), x, y })),
    boss: [0, -110],
    player: [0, 104],
  },
  phases: [
    {
      below: 1,
      steer: { kind: 'anchor', x: 0, y: -10, drift: 26, pace: 0.5 },
      patterns: [
        pin('space', 15, PIN_EVERY),
        rend(6.4, 3, 64),
        aquaTail(5.6, 14),
        pump(7.4, 1, 0),
        { kind: 'summon', every: 14, enemies: ['staryu'], count: 2, max: 3, radius: 70 },
      ],
      ultimate: {
        move: 'Spacial Rend',
        first: 8,
        every: 22,
        steps: [
          { at: 0, pattern: rend(0, 5, 52, 1.5, 24) },
          { at: 1.7, pattern: rend(0, 5, 52, 1.3, 24) },
          { at: 3.4, pattern: rend(0, 5, 52, 1.2, 24) },
        ],
      },
    },
    {
      below: 0.66,
      shift: 2.2,
      steer: { kind: 'hold', range: 120, pace: 0.6 },
      patterns: [
        pin('space', 15, PIN_EVERY),
        rend(5.6, 4, 60),
        aquaTail(6, 18, 0.9),
        { kind: 'teleport', every: 9.6, to: 'far', windup: 1.1, radius: 30, damage: 20, visual: 'space' },
        { kind: 'strikes', every: 5.2, target: 'player', count: 4, spread: 70, radius: 16, delay: 1.2, damage: 18, visual: 'water', lead: 1 },
      ],
      ultimate: {
        move: 'Spacial Rend',
        first: 6,
        every: 21,
        steps: [
          { at: 0, pattern: lattice(4, 66, 1.6) },
          { at: 2, pattern: aquaTail(0, 22, 0.8) },
          { at: 2.6, pattern: lattice(4, 66, 1.3) },
        ],
      },
    },
    {
      below: 0.33,
      shift: 2.6,
      form: 'origin',
      haste: 1.2,
      steer: { kind: 'chase', pace: 0.55 },
      // Tears open in the hall's floor.
      arena: [{ kind: 'crumble', at: 0, warn: 2.6, area: [], spare: [circle(-96, 16, 18), circle(96, 8, 18), circle(-20, 120, 15), circle(36, -40, 14)] }],
      patterns: [
        pin('space', 16, PIN_EVERY),
        rend(5.2, 4, 58),
        aquaTail(5.8, 20, 0.8),
        pump(7, 3, 0.45),
        { kind: 'teleport', every: 10.4, to: 'player', windup: 1.25, radius: 30, damage: 22, visual: 'space' },
      ],
      ultimate: {
        move: 'Spacial Rend',
        first: 5,
        every: 19,
        steps: [
          // Space folds in toward Palkia (pull away from it), then bursts: only those far from it are spared; then the lattice.
          { at: 0, pattern: { kind: 'whirlpool', every: 0, target: 'self', count: 1, spread: 0, radius: 22, reach: 320, pull: 46, windup: 0.6, ttl: 3.6, damage: 18, visual: 'space' } },
          { at: 0.6, pattern: { kind: 'blast', every: 0, windup: 3.2, damage: 30, safe: 'far', radius: 116, visual: 'space' } },
          { at: 4.2, pattern: lattice(5, 60, 1.2, 22) },
        ],
      },
    },
  ],
}
