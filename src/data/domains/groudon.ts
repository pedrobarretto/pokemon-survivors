import { PIN_SHARE } from './kit'
import * as dm from '../../engine/dmath'
import { circle, lane, type Circle, type Pt } from '../arenas'
import type { BossPattern } from '../bosses'
import type { ArenaTransform, LegendDomain } from '../domains'

/**
 * Groudon's domain: a magma tunnel climbed north through five chambers, lava
 * rivers crossed on basalt bridges, while the tunnel collapses behind the
 * player and a wall of lava chases them on (the ceiling drops rocks and the
 * floor spits geysers on the way, `game/domains/groudon.ts`), with Numel,
 * Slugma, Magcargo, Torkoal and Camerupt coming down. Then the magma
 * chamber, where Groudon rises out of a lava lake. Its harsh sun owns the
 * domain (Fire ×1.5, its own fire included).
 *
 * The battle, unlike Kyogre's it walks at the player: (1) it lumbers after
 * them, Precipice Blades in lines that stop on the basalt, magma where it
 * steps, and Eruption, a blast that only spares whoever hugs it; (2) lava
 * rises into channels that split the chamber into islands (cross on the cool
 * stones), it wades back into its lake and leaps out onto the player, and
 * Scorching Sands spares only the far islands; (3) Primal Reversion: the
 * lake swells and three more channels open, it chases again, and Precipice
 * Blades erupts in waves of spokes all around it, the gaps the only way out.
 */

/** Where Groudon rises, arena px: the lava lake north of the chamber's middle. */
const LAKE: Pt = [0, -40]

/** A lava channel from the lake out past the chamber's edge at `deg` degrees (0 east, 90 south). */
const spoke = (deg: number, w = 20) => {
  const a = (deg * Math.PI) / 180
  return lane(LAKE, [LAKE[0] + dm.round(dm.cos(a) * 260), LAKE[1] + dm.round(dm.sin(a) * 260)], w)
}

/** Cool stones across a channel at `deg`, at each distance from the lake: where it's crossed without burning. */
const stones = (deg: number, at: readonly number[]): Circle[] => {
  const a = (deg * Math.PI) / 180
  return at.map((d) => circle(LAKE[0] + dm.round(dm.cos(a) * d), LAKE[1] + dm.round(dm.sin(a) * d), 15))
}

/** Phase 2: three channels (south, north-west, north-east) and the lake spreading around Groudon. */
const RISING: ArenaTransform = {
  kind: 'lava',
  at: 0,
  warn: 3,
  area: [circle(LAKE[0], LAKE[1], 84), spoke(90), spoke(210), spoke(330)],
  spare: [...stones(90, [118, 166]), ...stones(210, [118, 162]), ...stones(330, [118, 162])],
}

/** Phase 3: the lake swells and three more channels open between the first ones; the old stones still stand. */
const SWELLING: ArenaTransform = {
  kind: 'lava',
  at: 0,
  warn: 2.6,
  area: [circle(LAKE[0], LAKE[1], 108), spoke(30), spoke(150), spoke(270)],
  spare: [...RISING.spare, ...stones(30, [136]), ...stones(150, [136]), ...stones(270, [136])],
}

/** Earth Power: the ground bursts right under the player; it only ever hits one who stands still. */
const earthPower: BossPattern = { kind: 'strikes', every: 2.2, target: 'player', count: 1, spread: 0, radius: 20, delay: 1.1, damage: 14, visual: 'rock', share: PIN_SHARE }

/** Precipice Blades: lines of stone blades erupting out of Groudon, `spread` rad apart around the aim (a full circle of spokes for the ultimate). */
const blades = (count: number, spread: number, windup: number, length: number, damage: number, every = 0): BossPattern => ({
  kind: 'beam', every, source: 'boss', count, spread, windup, duration: 0.4, width: 14, length, damage, visual: 'rock', blocked: true,
})

export const GROUDON_DOMAIN: LegendDomain = {
  omen: { weather: 'sun', sky: 'harshSun' },
  backdrop: 'magma',
  entrance: 'rise',
  music: 'groudon',
  hp: 1.6,
  battleTime: 180,
  touch: 0.6,
  lavaBurn: 0.02,
  weatherShare: 0.5,
  crossing: {
    // Five chambers up a narrow, winding tunnel; rivers of lava cut across the second, fourth and the passage between.
    floor: [
      circle(0, 0, 62),
      lane([0, -30], [-50, -220], 66),
      circle(-50, -262, 78),
      lane([-50, -320], [40, -520], 64),
      circle(40, -572, 86),
      lane([40, -640], [-30, -840], 62),
      circle(-30, -890, 80),
      lane([-30, -950], [50, -1150], 64),
      circle(50, -1202, 92),
      lane([50, -1270], [-20, -1470], 62),
      circle(-20, -1512, 80),
      lane([-20, -1572], [0, -1886], 70),
    ],
    holes: [circle(40, -578, 24), circle(-20, -1530, 18)],
    lava: [
      { pts: [[-150, -252], [-50, -268], [40, -254]], w: 16 },
      { pts: [[-120, -742], [120, -738]], w: 18 },
      { pts: [[-60, -1180], [50, -1212], [160, -1190]], w: 15 },
    ],
    bridges: [
      { x: -84, y: -263, w: 22, h: 28 },
      { x: 4, y: -260, w: 22, h: 28 },
      { x: 5, y: -740, w: 24, h: 30 },
      { x: 0, y: -1197, w: 22, h: 28 },
      { x: 108, y: -1200, w: 22, h: 28 },
    ],
    pattern: 'basalt',
    solids: [
      { piece: 'basalt', x: -36, y: 22 },
      { piece: 'basalt', x: -102, y: -300 },
      { piece: 'basalt', x: 0, y: -226 },
      { piece: 'basalt', x: 100, y: -560 },
      { piece: 'basalt', x: -14, y: -612 },
      { piece: 'basalt', x: -76, y: -900 },
      { piece: 'basalt', x: 14, y: -870 },
      { piece: 'basalt', x: 108, y: -1238 },
      { piece: 'basalt', x: -4, y: -1240 },
      { piece: 'basalt', x: 30, y: -1516 },
    ],
    start: [0, 18],
    gate: -1856,
    threat: { kind: 'magma', start: 140, stop: -1800, delay: 2.5, speed: 32, rush: 2.4, gap: 160, damage: 0.05, every: 0.5, push: 36, ground: 'none' },
    retinue: {
      first: 1.5,
      every: 3.4,
      count: 2,
      max: 8,
      members: [
        { id: 'numel', weight: 4, role: 'runner' },
        { id: 'slugma', weight: 3, role: 'runner' },
        { id: 'magcargo', weight: 2, role: 'spitter' },
        { id: 'torkoal', weight: 2, role: 'spitter' },
        { id: 'camerupt', weight: 1, role: 'elite' },
      ],
    },
    theme: 'boss',
  },
  arena: {
    at: [0, -2030],
    // A lumpy magma chamber: a round hall with four bays.
    floor: [circle(0, 0, 176), circle(-104, -70, 70), circle(104, -70, 70), circle(-96, 96, 72), circle(96, 96, 72)],
    holes: [circle(LAKE[0], LAKE[1], 46)],
    pattern: 'basalt',
    solids: [
      { piece: 'basalt', x: -124, y: -6 },
      { piece: 'basalt', x: 124, y: -6 },
      { piece: 'basalt', x: -62, y: 112 },
      { piece: 'basalt', x: 62, y: 112 },
      { piece: 'basalt', x: -118, y: -116 },
      { piece: 'basalt', x: 118, y: -116 },
    ],
    boss: LAKE,
    player: [0, 132],
  },
  phases: [
    {
      below: 1,
      hold: true,
      steer: { kind: 'chase', pace: 0.45 },
      patterns: [
        blades(3, 0.42, 1.3, 300, 13, 5.4),
        earthPower,
        // Bulldoze: a stomp around itself.
        { kind: 'strikes', every: 5.8, target: 'self', count: 1, spread: 0, radius: 46, delay: 1.25, damage: 16, visual: 'slam' },
        // Magma where it steps.
        { kind: 'trail', every: 0.32, ttl: 2.4, radius: 7, damage: 7, visual: 'fire' },
        // Lava Plume.
        { kind: 'ring', every: 6, count: 10, speed: 58, radius: 5, damage: 9, visual: 'fire' },
        { kind: 'summon', every: 14, enemies: ['numel', 'slugma'], count: 1, max: 2, radius: 60, role: 'runner' },
      ],
      ultimate: {
        move: 'Eruption',
        first: 6,
        every: 24,
        steps: [
          // The magma falls all over the chamber but right around Groudon: hug it.
          { at: 0, pattern: { kind: 'blast', every: 0, windup: 3.2, damage: 22, safe: 'near', radius: 74, visual: 'fire' } },
          { at: 0.3, pattern: { kind: 'strikes', every: 0, target: 'player', count: 3, spread: 0, radius: 15, delay: 1.1, damage: 12, visual: 'fire', lead: 1 } },
          { at: 1.6, pattern: { kind: 'strikes', every: 0, target: 'self', count: 7, spread: 210, radius: 16, delay: 1.2, damage: 12, visual: 'fire' } },
        ],
      },
    },
    {
      below: 0.68,
      hold: true,
      shift: 2.4,
      steer: { kind: 'anchor', x: 0, y: 0, drift: 18, pace: 0.5 },
      arena: [RISING],
      patterns: [
        blades(5, 0.36, 1.25, 320, 14, 5.2),
        earthPower,
        // Fire Blast.
        { kind: 'volley', every: 4.6, count: 5, arc: 0.8, speed: 100, windup: 0.9, radius: 5, damage: 10, visual: 'fire' },
        // It leaps out of its lake onto the player, then wades back.
        { kind: 'strikes', every: 9, target: 'player', count: 1, spread: 0, radius: 30, delay: 1.3, damage: 18, visual: 'slam', lead: 1, leap: true },
        { kind: 'ring', every: 6.5, count: 12, speed: 58, radius: 5, damage: 9, visual: 'fire' },
        { kind: 'summon', every: 14, enemies: ['magcargo', 'camerupt'], count: 2, max: 2, radius: 70, role: 'spitter' },
      ],
      ultimate: {
        move: 'Scorching Sands',
        first: 5,
        every: 22,
        steps: [
          // A storm of burning sand around Groudon: only the far islands are out of it.
          { at: 0, pattern: { kind: 'blast', every: 0, windup: 2.8, damage: 26, safe: 'far', radius: 118, visual: 'rock' } },
          { at: 0.4, pattern: { kind: 'ring', every: 0, count: 14, speed: 50, radius: 5, damage: 9, visual: 'rock' } },
        ],
      },
    },
    {
      below: 0.34,
      hold: true,
      shift: 2.8,
      form: 'primal',
      steer: { kind: 'chase', pace: 0.65 },
      arena: [SWELLING],
      patterns: [
        blades(6, Math.PI / 3, 1.25, 260, 15, 6),
        earthPower,
        { kind: 'strikes', every: 6.5, target: 'self', count: 1, spread: 0, radius: 52, delay: 1.2, damage: 18, visual: 'slam' },
        { kind: 'trail', every: 0.28, ttl: 2.4, radius: 7, damage: 8, visual: 'fire' },
        { kind: 'strikes', every: 5, target: 'player', count: 4, spread: 0, radius: 15, delay: 1.1, damage: 12, visual: 'fire', lead: 1 },
        { kind: 'strikes', every: 10, target: 'player', count: 1, spread: 0, radius: 32, delay: 1.3, damage: 20, visual: 'slam', lead: 1, leap: true },
      ],
      ultimate: {
        move: 'Precipice Blades',
        first: 5,
        every: 20,
        steps: [
          // Waves of spokes all around it, each aimed anew: step into a gap, then away before it slams.
          { at: 0, pattern: blades(8, Math.PI / 4, 1.5, 340, 20) },
          { at: 1.8, pattern: blades(8, Math.PI / 4, 1.3, 340, 20) },
          { at: 3.5, pattern: blades(8, Math.PI / 4, 1.2, 340, 20) },
          { at: 5, pattern: { kind: 'strikes', every: 0, target: 'self', count: 1, spread: 0, radius: 66, delay: 1.3, damage: 22, visual: 'slam' } },
        ],
      },
    },
  ],
}
