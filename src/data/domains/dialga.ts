import { PIN_SHARE } from './kit'
import { circle, lane, poly } from '../arenas'
import type { BossPattern } from '../bosses'
import type { LegendDomain } from '../domains'

/**
 * Dialga's domain: Spear Pillar, where time comes apart. The crossing runs
 * north along a marble causeway through broken colonnades, ahead of time
 * itself unravelling behind the player; every few seconds time skips
 * (`game/dialgaDomain.ts`): it stops (the retinue freezes, free hits), skips
 * forward (the unravelling surges and a wave arrives at once) or rewinds (the
 * front falls back and the retinue is thrown back where it came from).
 * Bronzor, Baltoy, Claydol and Bronzong guard the way. Then the altar: a
 * marble nave with an apse, colonnades for cover; time stops as Dialga
 * appears. Clear skies: Dialga needs no weather.
 *
 * The battle: (1) from the apse, Flash Cannon beams that stop on the columns,
 * marks of the future that land seconds later, and a Flash Cannon barrage of
 * three beam fans whose gaps and columns are safe; (2) it skips through time
 * (teleports), the marks thicken, and Roar of Time stops the player's shots
 * mid-air while marks bloom everywhere and the roar spares only those behind
 * a column, then lets the shots fly on; (3) time itself speeds up
 * (`BossPhase.haste`): tears open in the floor, it warps onto the player,
 * and Roar of Time spares only those far from it. On Nightmare that last
 * phase is Primal Dialga's (`nightmareForm`, the PMD Explorers' last boss):
 * time collapses, marks of the future fall everywhere and its rings close in.
 */

/** Columns along the nave and in the apse: cover from Flash Cannon and the first Roar of Time. */
const COLUMNS = [
  [-124, -36],
  [124, -36],
  [-124, 44],
  [124, 44],
  [-124, 120],
  [124, 120],
  [-58, -132],
  [58, -132],
  [0, 64],
] as const

/** Marks of the future: circles that land seconds after they show, on the player and around them. */
const marks = (every: number, count: number, spread: number, delay = 2.6): BossPattern => ({
  kind: 'strikes', every, target: 'player', count, spread, radius: 18, delay, damage: 18, visual: 'dragon',
})

/** Iron Head on the spot the player stands on, a beat later: harmless to a moving player, deadly to one standing still. */
const pin = (every: number): BossPattern => ({ kind: 'strikes', every, target: 'player', count: 1, spread: 0, radius: 14, delay: 0.95, damage: 15, visual: 'steel', share: PIN_SHARE })

/** Flash Cannon: a fan of steel beams that stop on the columns. */
const cannon = (every: number, count: number, spread: number, windup = 1.1, damage = 18): BossPattern => ({
  kind: 'beam', every, source: 'boss', count, spread, windup, duration: 0.55, width: 13, length: 400, damage, visual: 'steel', blocked: true,
})

export const DIALGA_DOMAIN: LegendDomain = {
  omen: { weather: 'clear', sky: 'timeWarp' },
  backdrop: 'space',
  entrance: 'warp',
  music: 'dialga',
  hp: 1.3,
  battleTime: 180,
  crossing: {
    // Plazas along a causeway climbing north.
    floor: [
      circle(0, 0, 74),
      lane([0, -40], [0, -300], 96),
      circle(0, -360, 98),
      lane([0, -420], [-70, -660], 90),
      circle(-70, -720, 92),
      lane([-70, -780], [50, -1030], 90),
      circle(50, -1090, 96),
      lane([50, -1150], [-30, -1400], 90),
      circle(-30, -1460, 94),
      lane([-30, -1520], [0, -1890], 84),
    ],
    holes: [circle(46, -720, 20), circle(-60, -1104, 18)],
    pattern: 'slabs',
    solids: [
      { piece: 'column', x: -40, y: -120 },
      { piece: 'column', x: 40, y: -210 },
      { piece: 'marbleStump', x: -54, y: -350 },
      { piece: 'column', x: 50, y: -380 },
      { piece: 'column', x: -20, y: -560 },
      { piece: 'marbleStump', x: -110, y: -700 },
      { piece: 'column', x: -30, y: -750 },
      { piece: 'column', x: 0, y: -900 },
      { piece: 'column', x: 90, y: -1070 },
      { piece: 'marbleStump', x: 10, y: -1110 },
      { piece: 'column', x: 20, y: -1280 },
      { piece: 'column', x: -70, y: -1440 },
      { piece: 'marbleStump', x: 20, y: -1480 },
      { piece: 'column', x: -36, y: -1700 },
      { piece: 'column', x: 36, y: -1700 },
    ],
    start: [0, 22],
    gate: -1856,
    threat: { kind: 'time', start: 150, stop: -1800, delay: 2.5, speed: 30, rush: 2.4, gap: 170, damage: 0.05, every: 0.5, push: 34 },
    retinue: {
      first: 1.5,
      every: 2.6,
      count: 1,
      max: 5,
      members: [
        { id: 'baltoy', weight: 4, role: 'runner' },
        { id: 'bronzor', weight: 3, role: 'runner' },
        { id: 'claydol', weight: 2, role: 'spitter' },
        { id: 'bronzong', weight: 1, role: 'elite' },
      ],
    },
    theme: 'snow',
  },
  arena: {
    at: [0, -2040],
    floor: [poly([-170, -60], [170, -60], [170, 150], [-170, 150]), circle(0, -60, 112)],
    pattern: 'slabs',
    solids: COLUMNS.map(([x, y], i) => ({ piece: i === 8 ? ('marbleStump' as const) : ('column' as const), x, y })),
    boss: [0, -96],
    player: [0, 104],
  },
  phases: [
    {
      below: 1,
      steer: { kind: 'anchor', x: 0, y: 0, drift: 22, pace: 0.5 },
      patterns: [
        pin(2.6),
        cannon(6.2, 1, 0),
        marks(6.9, 3, 54),
        { kind: 'ring', every: 5.8, count: 14, speed: 54, radius: 5, damage: 14, visual: 'steel' },
        { kind: 'summon', every: 13, enemies: ['bronzor'], count: 1, max: 2, radius: 70 },
      ],
      ultimate: {
        move: 'Flash Cannon',
        first: 8,
        every: 22,
        steps: [
          { at: 0, pattern: cannon(0, 5, 0.38, 1.4, 22) },
          { at: 1.7, pattern: cannon(0, 4, 0.38, 1.3, 22) },
          { at: 3.4, pattern: cannon(0, 5, 0.38, 1.2, 22) },
        ],
      },
    },
    {
      below: 0.66,
      shift: 2.2,
      steer: { kind: 'hold', range: 110, pace: 0.55 },
      patterns: [
        pin(2.6),
        { kind: 'teleport', every: 9.2, to: 'far', windup: 1.1, radius: 30, damage: 20, visual: 'steel' },
        marks(5.3, 5, 80, 2.8),
        { kind: 'beam', every: 8, source: 'boss', count: 1, spread: 0, sweep: 1.4, windup: 1.1, duration: 1.4, width: 12, length: 380, damage: 18, visual: 'steel', blocked: true },
        { kind: 'ring', every: 6.2, count: 16, speed: 50, radius: 5, damage: 14, visual: 'dragon' },
      ],
      ultimate: {
        move: 'Roar of Time',
        first: 6,
        every: 21,
        steps: [
          { at: 0, pattern: { kind: 'timeStop', every: 0, windup: 1.2, duration: 3.6 } },
          { at: 0.4, pattern: marks(0, 6, 100, 3) },
          { at: 1.2, pattern: { kind: 'blast', every: 0, windup: 2.8, damage: 28, safe: 'cover', visual: 'dragon' } },
        ],
      },
    },
    {
      below: 0.33,
      shift: 2.6,
      haste: 1.3,
      nightmareForm: 'primal',
      steer: { kind: 'chase', pace: 0.55 },
      // Space-time tears open in the nave.
      arena: [{ kind: 'crumble', at: 0, warn: 2.6, area: [], spare: [circle(-80, 10, 18), circle(84, 0, 18), circle(-40, 112, 16), circle(60, 104, 16)] }],
      patterns: [
        pin(2.6),
        marks(5.3, 5, 90),
        cannon(6.9, 2, 0.5),
        { kind: 'ring', every: 5.8, count: 18, speed: 52, radius: 5, damage: 14, visual: 'steel' },
        { kind: 'teleport', every: 10.3, to: 'player', windup: 1.25, radius: 30, damage: 22, visual: 'dragon' },
        // Primal Dialga (Nightmare): time's collapse, the future landing all over the nave and rings of it closing in.
        { from: 'nightmare', ...marks(7.4, 8, 140, 2.4) },
        { from: 'nightmare', kind: 'ring', every: 8.2, count: 22, speed: 50, radius: 6, damage: 16, visual: 'dragon', around: 130, windup: 1, gap: 0.8 },
      ],
      ultimate: {
        move: 'Roar of Time',
        first: 5,
        every: 19,
        steps: [
          { at: 0, pattern: { kind: 'timeStop', every: 0, windup: 1, duration: 4 } },
          { at: 0.3, pattern: marks(0, 7, 110, 2.8) },
          { at: 1, pattern: { kind: 'blast', every: 0, windup: 2.7, damage: 30, safe: 'far', radius: 110, visual: 'dragon' } },
          { at: 4, pattern: { kind: 'ring', every: 0, count: 24, speed: 58, radius: 5, damage: 15, visual: 'steel' } },
        ],
      },
    },
  ],
}
