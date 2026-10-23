import { pin, PIN_EVERY } from './kit'
import { circle, lane, type Pt } from '../arenas'
import type { BossPattern } from '../bosses'
import type { LegendDomain } from '../domains'
import type { EnemyId } from '../enemies'

/**
 * Darkrai's domain, the Nightmare (Noite das Bruxas' event rift,
 * `EVENT_RIFTS`): slabs of a dream gone dark adrift in a black void, crossed
 * north in the dark (only a ring of light around the player; jack-o'-lanterns
 * along the way widen it once lit) as the dream crumbles behind, with Gastly,
 * Haunter, Misdreavus and Murkrow coming out of the dark. Then the heart of
 * the nightmare, where Darkrai seeps out of the shadows.
 *
 * The battle (the mechanics the data can't say are `game/darkraiDomain.ts`'s):
 * (1) Darkness: the arena goes black, Darkrai fades into the dark and strikes
 *     out of it; the lanterns on the floor are the light to fight by, and
 *     Dark Pulse rings with a gap to slip through are its signature;
 * (2) Dark Void: slow dark orbs that put the player they hit to sleep for a
 *     moment (no walking, no attacks), and Bad Dreams drains whoever sleeps;
 *     Hypnosis closes a ring of them on the player, its gap the way out;
 * (3) the full Nightmare: shadow clones walk out of it (only the real one has
 *     the HP bar; a clone vanishes at a hit), and the ultimate Dark Void covers
 *     the whole arena but for a few circles of light.
 * At the capture Cresselia crosses the sky and breaks the nightmare with Lunar
 * Wing, and the light comes back (`render/darkrai.ts`).
 */

const R = 190

/** Spires of black crystal around the heart of the nightmare: cover from Dark Pulse's rings and the dash out of the dark. */
const SPIRES = [
  [-118, -58],
  [118, -58],
  [-130, 70],
  [130, 70],
  [0, -150],
] as const

/** Jack-o'-lanterns (domain px, the arena's around `arena.at`): passing one lights it, and its light and the player's grow for a while (`NIGHTMARE.lantern`). */
const CROSSING_LANTERNS: readonly Pt[] = [
  [30, -110], [54, -300], [-10, -440], [-60, -620], [20, -760], [40, -930], [-50, -1080], [-30, -1240], [24, -1420], [8, -1640],
]
const ARENA_LANTERNS: readonly Pt[] = [
  [0, 0], [-92, -2], [92, -2], [-46, -112], [46, -112], [-62, 104], [62, 104],
]

/** The shadow clones' species: Darkrai's look, none of its rules (`ENEMIES.darkraiShade`). */
const NIGHTMARE_CLONE = 'darkraiShade' satisfies EnemyId

/** Where the darkness (and the lanterns) of Darkrai's domain sit, how far the light goes and what its sleep costs. */
export const NIGHTMARE = {
  lanterns: { crossing: CROSSING_LANTERNS, arena: ARENA_LANTERNS },
  lantern: {
    /** Px from a lantern a player lights it at. */
    reach: 16,
    /** Seconds a lit lantern burns, and the player's light stays wider after passing one. */
    burn: 10,
    glow: 6,
  },
  /**
   * The dark by act and battle phase: `shade` how much of the view it hides
   * (0..1) and `light` the player's light radius, px (`glow` adds to it after a
   * lantern). The encounter goes from the crossing's to the first phase's.
   */
  dark: {
    crossing: { shade: 0.9, light: 82 },
    phases: [
      { shade: 0.95, light: 60 },
      { shade: 0.6, light: 118 },
      { shade: 0.84, light: 84 },
    ],
    glow: 42,
    lanternLight: 46,
  },
  /** Bad Dreams: share of max HP a sleeping player loses per second in here (never the last HP), in chunks `every` s apart. */
  badDreams: { share: 0.08, every: 0.3 },
  /** The full Nightmare's shadow clones: `count` walk out `radius` px around Darkrai, a new wave `every` s after the last one vanished; they touch for `touch` of its contact damage. */
  clones: { id: NIGHTMARE_CLONE, count: 3, radius: 80, every: 9, touch: 0.5 },
} as const

/** Dark Pulse: a ring out of Darkrai with an arc open, the way through. */
const pulse = (count: number, speed: number): BossPattern => ({ kind: 'ring', every: 0, count, speed, radius: 5, damage: 15, visual: 'shadow', gap: 0.9 })

/** Dark Void's orbs: slow, big, and a hit puts the player to sleep. */
const VOID = { radius: 7, damage: 8, sleep: 1.2 } as const

export const DARKRAI_DOMAIN: LegendDomain = {
  omen: { weather: 'clear', sky: 'newMoon' },
  backdrop: 'space',
  entrance: 'materialize',
  music: 'boss',
  hp: 1.25,
  battleTime: 200,
  touch: 0.8,
  cameo: { dex: 488, name: 'Cresselia', types: ['psychic'] },
  cast: [NIGHTMARE_CLONE],
  crossing: {
    // Dream slabs adrift in the dark, joined by narrow paths, climbing north; a few gaps to walk around.
    floor: [
      circle(0, 0, 70),
      lane([0, -40], [50, -250], 62),
      circle(54, -292, 80),
      lane([54, -350], [-50, -560], 58),
      circle(-58, -610, 88),
      lane([-58, -670], [30, -880], 60),
      circle(36, -924, 80),
      lane([36, -980], [-40, -1180], 56),
      circle(-44, -1230, 94),
      lane([-44, -1300], [24, -1480], 60),
      circle(26, -1520, 82),
      lane([26, -1580], [0, -1890], 62),
    ],
    holes: [circle(-30, -600, 22), circle(-12, -1236, 20), circle(70, -300, 14)],
    pattern: 'slabs',
    solids: [
      { piece: 'nightSpire', x: -40, y: 20 },
      { piece: 'nightSpire', x: 104, y: -310 },
      { piece: 'nightSpire', x: -112, y: -600 },
      { piece: 'nightSpire', x: 12, y: -580 },
      { piece: 'nightSpire', x: 78, y: -940 },
      { piece: 'nightSpire', x: -100, y: -1220 },
      { piece: 'nightSpire', x: 40, y: -1250 },
      { piece: 'nightSpire', x: -20, y: -1500 },
    ],
    start: [0, 18],
    gate: -1856,
    threat: { kind: 'void', start: 150, stop: -1800, delay: 3, speed: 28, rush: 2.4, gap: 170, damage: 0.05, every: 0.5, push: 34, ground: 'none' },
    retinue: {
      first: 2,
      every: 3.4,
      count: 2,
      max: 8,
      members: [
        { id: 'gastly', weight: 5, role: 'runner' },
        { id: 'haunter', weight: 2 },
        { id: 'misdreavus', weight: 2, role: 'spitter' },
        { id: 'murkrow', weight: 2, role: 'runner' },
      ],
    },
    theme: 'cave',
  },
  arena: {
    at: [0, -2040],
    floor: [circle(0, 0, R)],
    holes: [circle(-150, -110, 16), circle(152, -104, 14)],
    pattern: 'slabs',
    solids: SPIRES.map(([x, y]) => ({ piece: 'nightSpire', x, y })),
    boss: [0, -40],
    player: [0, 118],
  },
  phases: [
    {
      below: 1,
      steer: { kind: 'anchor', x: 0, y: -10, drift: 70, pace: 0.6 },
      patterns: [
        pin('shadow', 11, PIN_EVERY),
        // Feint Attack: it fades into the dark and lands where the player stands.
        { kind: 'teleport', every: 6.5, to: 'player', windup: 1.2, radius: 26, damage: 16, visual: 'shadow' },
        { kind: 'ring', every: 4.8, count: 12, speed: 56, radius: 5, damage: 13, visual: 'shadow' },
        { kind: 'strikes', every: 5.2, target: 'player', count: 3, spread: 0, radius: 15, delay: 1.1, damage: 13, visual: 'shadow', lead: 1 },
        { kind: 'summon', every: 13, enemies: ['gastly'], count: 2, max: 3, radius: 70, role: 'runner' },
        { from: 'hard', kind: 'volley', every: 6, count: 3, arc: 0.5, speed: 100, windup: 0.9, radius: 5, damage: 13, visual: 'shadow' },
      ],
      ultimate: {
        move: 'Dark Pulse',
        first: 10,
        every: 24,
        steps: [
          { at: 0, pattern: pulse(18, 66) },
          { at: 1.3, pattern: pulse(18, 70) },
          { at: 2.6, pattern: pulse(22, 74) },
        ],
      },
    },
    {
      below: 0.66,
      shift: 2.2,
      steer: { kind: 'orbit', radius: 120, pace: 0.6, keep: 70 },
      patterns: [
        pin('shadow', 11, 3),
        { kind: 'volley', every: 4.2, count: 3, arc: 0.6, speed: 82, windup: 1, ...VOID, visual: 'shadow' },
        { kind: 'ring', every: 6.5, count: 10, speed: 50, ...VOID, visual: 'shadow', gap: 1.2 },
        { kind: 'strikes', every: 5.5, target: 'self', count: 1, spread: 0, radius: 44, delay: 1.2, damage: 16, visual: 'shadow' },
        { kind: 'teleport', every: 9, to: 'far', windup: 0.9, radius: 24, damage: 14, visual: 'shadow' },
        { from: 'hard', kind: 'strikes', every: 5, target: 'player', count: 3, spread: 0, radius: 14, delay: 1.1, damage: 13, visual: 'shadow', lead: 1 },
      ],
      // Hypnosis: a ring of Dark Void orbs closing on the player, an arc open.
      ultimate: {
        move: 'Hypnosis',
        first: 7,
        every: 20,
        steps: [
          { at: 0, pattern: { kind: 'ring', every: 0, count: 16, speed: 60, ...VOID, visual: 'shadow', around: 120, windup: 1.3, gap: 1.1, sleep: 1.4 } },
          { at: 2.4, pattern: { kind: 'ring', every: 0, count: 18, speed: 64, ...VOID, visual: 'shadow', around: 120, windup: 1.1, gap: 1, sleep: 1.4 } },
        ],
      },
    },
    {
      below: 0.33,
      shift: 2.6,
      steer: { kind: 'hold', range: 110, pace: 0.8 },
      patterns: [
        pin('shadow', 11, PIN_EVERY),
        { kind: 'volley', every: 4.6, count: 4, arc: 0.8, speed: 90, windup: 0.9, ...VOID, sleep: 1.1, visual: 'shadow' },
        // Shadows of Darkrai streaking through the player's spot.
        { kind: 'phantoms', every: 7, origin: 'ring', count: 3, gap: 0.5, windup: 1, speed: 190, width: 14, radius: 120, damage: 15, visual: 'shadow' },
        { kind: 'teleport', every: 7.5, to: 'player', windup: 1.1, radius: 26, damage: 17, visual: 'shadow' },
        { kind: 'ring', every: 5, count: 14, speed: 64, radius: 5, damage: 13, visual: 'shadow' },
      ],
      // Dark Void over the whole arena: only the circles of light around the player are safe.
      ultimate: {
        move: 'Dark Void',
        first: 6,
        every: 22,
        steps: [
          { at: 0, pattern: { kind: 'blast', every: 0, windup: 2.8, damage: 24, safe: 'spots', spots: 3, visual: 'shadow', sleep: 1.6 } },
          { at: 3.2, pattern: pulse(20, 70) },
        ],
      },
    },
  ],
}
