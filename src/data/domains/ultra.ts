import { pin, PIN_EVERY } from './kit'
import { circle, lane, type Circle } from '../arenas'
import type { BossPattern, HazardVisual } from '../bosses'
import type { DomainPhase, DomainSolid, LegendDomain, Retinue } from '../domains'
import type { EnemyId } from '../enemies'
import type { UltraBeast } from '../ultraBeasts'

/**
 * The Ultra Beasts' domains (`data/ultraBeasts.ts`): Ultra Space behind an
 * Ultra Wormhole, all on one plan and shorter than a legendary's. The
 * crossing is three islands of prism glass joined by bridges of light, north
 * ahead of the wormhole closing behind (`ultra` threat), with the beast's own
 * world coming at the player (each retinue is the Pokémon of the world it
 * comes from); then a disc of glass ringed by crystals, where the beast drops
 * out of a small wormhole (`wormhole` entrance). Two phases, each with its
 * ultimate, and each beast fights in its own style:
 * - Nihilego's neurotoxin: its venom numbs (a hit puts the player to sleep
 *   for a moment), its tentacles drag, Power Gem lattices;
 * - Buzzwole's muscle pump: it flexes between rounds and hits harder and
 *   faster each time (`game/ultraHooks.ts`), lunges, leaps and Superpower;
 * - Pheromosa's speed: dashes, afterimages and, in its second phase, its time
 *   runs faster (`haste`);
 * - Xurkitree's wires: power lines strung across the arena (edge lances and
 *   lattices), then Zap Cannon only cover survives;
 * - Celesteela's launch: it rockets off and crashes down where the player
 *   stands, then flies over the arena trailing its exhaust;
 * - Kartana's blades: paper-thin cuts across the arena, crossing in lattices;
 * - Guzzlord's devouring: its maw drags the player in, and in its second
 *   phase it eats whole bites out of the floor (`crumble`);
 * - Stakataka's wall: walls of stone shut the player in, it takes hits like
 *   one, and its Trick Room holds the player's shots still;
 * - Blacephalon's head bombs: its head lands along the player's path and
 *   blows, and Mind Blown spares only those far from it;
 * - Naganadel's needles: volleys of venom, passes over the arena, Dragon Pulse.
 * Every number here is tuned off Kyogre's (`kyogre.ts`), a phase shorter.
 */

const R = 176

/** Crystals ringing the arena (arena px): cover from beams and blasts. */
const CRYSTALS = [
  [-104, -56],
  [104, -56],
  [-116, 66],
  [116, 66],
  [0, 140],
] as const

/** The crossing's crystals (domain px), along the islands. */
const CROSSING_CRYSTALS: readonly DomainSolid[] = [
  { piece: 'ultraCrystal', x: -42, y: 18 },
  { piece: 'ultraCrystal', x: 48, y: -14 },
  { piece: 'ultraCrystal', x: 104, y: -280 },
  { piece: 'ultraCrystal', x: 10, y: -250 },
  { piece: 'ultraCrystal', x: -108, y: -560 },
  { piece: 'ultraCrystal', x: 4, y: -540 },
]

/** The beast's world in the crossing: two of its own and an elite. */
const retinue = (runner: EnemyId, spitter: EnemyId, elite: EnemyId): Retinue => ({
  first: 1.5,
  every: 3.4,
  count: 2,
  max: 7,
  members: [
    { id: runner, weight: 5, role: 'runner' },
    { id: spitter, weight: 3, role: 'spitter' },
    { id: elite, weight: 1, role: 'elite' },
  ],
})

type Fight = {
  phases: readonly DomainPhase[]
  retinue: Retinue
  /** Multiplies its HP, on top of `riftScale` (a legendary's domain is about 1.2 to 1.9 over three phases). */
  hp: number
  /** Multiplies its contact damage (a flyer brushing past). */
  touch?: number
}

/** A beast's domain: Ultra Space's crossing and arena around its fight. */
const ultra = (f: Fight): LegendDomain => ({
  omen: { weather: 'clear', sky: 'ultraSpace' },
  backdrop: 'ultra',
  entrance: 'wormhole',
  music: 'ultraSpace',
  hp: f.hp,
  battleTime: 150,
  ...(f.touch !== undefined && { touch: f.touch }),
  crossing: {
    // Three islands of glass adrift, joined by bridges of light, climbing north.
    floor: [
      circle(0, 0, 70),
      lane([0, -40], [52, -232], 58),
      circle(56, -272, 84),
      lane([56, -332], [-44, -516], 56),
      circle(-50, -562, 90),
      lane([-50, -628], [0, -880], 58),
    ],
    holes: [circle(-30, -572, 20), circle(70, -282, 14)],
    pattern: 'prism',
    solids: CROSSING_CRYSTALS,
    start: [0, 18],
    gate: -850,
    threat: { kind: 'ultra', start: 150, stop: -800, delay: 2.5, speed: 30, rush: 2.4, gap: 160, damage: 0.05, every: 0.5, push: 34, ground: 'none' },
    retinue: f.retinue,
    theme: 'ultraSpace',
  },
  arena: {
    at: [0, -1000],
    floor: [circle(0, 0, R)],
    holes: [circle(-146, -98, 14), circle(148, -94, 12)],
    pattern: 'prism',
    solids: CRYSTALS.map(([x, y]) => ({ piece: 'ultraCrystal', x, y })),
    boss: [0, -30],
    player: [0, 112],
  },
  phases: f.phases,
})

/* ---------------- Pattern helpers ---------------- */

/** Edge lances: `count` parallel lines from past the screen, the gaps between them the safe lanes (power lines, blade cuts, walls). */
const lances = (visual: HazardVisual, count: number, spread: number, width: number, windup: number, damage: number, every = 0): BossPattern => ({
  kind: 'beam', every, source: 'edge', count, spread, windup, duration: 0.4, width, length: 540, damage, visual,
})

/** Two sets of lances crossing on the player: the pockets where their gaps meet are safe. */
const lattice = (visual: HazardVisual, cross: HazardVisual, count: number, spread: number, width: number, windup: number, damage: number, every = 0): BossPattern => ({
  kind: 'beam', every, source: 'lattice', count, spread, windup, duration: 0.45, width, length: 540, damage, visual, cross,
})

/** A ring out of the beast, `gap` open (the way through) when given. */
const ring = (visual: HazardVisual, count: number, speed: number, damage: number, every = 0, gap?: number): BossPattern => ({
  kind: 'ring', every, count, speed, radius: 5, damage, visual, ...(gap !== undefined && { gap }),
})

/** Circles along the player's path, the last where they'd be. */
const along = (visual: HazardVisual, count: number, radius: number, delay: number, damage: number, every: number): BossPattern => ({
  kind: 'strikes', every, target: 'player', count, spread: 0, radius, delay, damage, visual, lead: 1,
})

/** A blow around the beast itself. */
const slam = (visual: HazardVisual, radius: number, delay: number, damage: number, every: number): BossPattern => ({
  kind: 'strikes', every, target: 'self', count: 1, spread: 0, radius, delay, damage, visual,
})

/** A fan aimed at the player. */
const fan = (visual: HazardVisual, count: number, arc: number, speed: number, damage: number, every: number, extra: Partial<{ radius: number; windup: number; sleep: number }> = {}): BossPattern => ({
  kind: 'volley', every, count, arc, speed, windup: extra.windup ?? 0.9, radius: extra.radius ?? 5, damage, visual, ...(extra.sleep !== undefined && { sleep: extra.sleep }),
})

/** Guzzlord's bites out of its arena's edge (crumbled away in its second phase). */
const BITES: readonly Circle[] = [circle(-126, -10, 40), circle(120, 4, 38), circle(40, -142, 34), circle(-70, 128, 30), circle(80, 124, 28)]

/* ---------------- The beasts ---------------- */

/** Nihilego's venom numbs: a hit puts the player to sleep for this long (the neurotoxin). */
const NEUROTOXIN = 0.7

const nihilego = ultra({
  hp: 1,
  retinue: retinue('tentacool', 'qwilfish', 'tentacruel'),
  phases: [
    {
      below: 1,
      steer: { kind: 'anchor', x: 0, y: 0, drift: 64, pace: 0.5 },
      patterns: [
        pin('poison', 11, PIN_EVERY),
        // Acid Spray: a fan of venom.
        fan('poison', 5, 0.9, 95, 12, 4.6),
        // Power Gem: a beam of crystal light the crystals stop.
        { kind: 'beam', every: 5.8, source: 'boss', count: 1, spread: 0, windup: 1.1, duration: 0.5, width: 10, length: 320, damage: 16, visual: 'rock', blocked: true },
        // Toxic Spikes where it drifts.
        { kind: 'trail', every: 0.32, ttl: 3, radius: 7, damage: 9, visual: 'poison' },
        // The neurotoxin: slow orbs with a way through; one hit numbs.
        { kind: 'ring', every: 6.4, count: 10, speed: 46, radius: 7, damage: 8, visual: 'poison', gap: 1, sleep: NEUROTOXIN },
      ],
      ultimate: {
        move: 'Power Gem',
        first: 9,
        every: 22,
        steps: [
          { at: 0, pattern: lattice('rock', 'poison', 4, 54, 13, 1.4, 22) },
          { at: 2, pattern: lattice('rock', 'poison', 4, 54, 13, 1.2, 22) },
        ],
      },
    },
    {
      below: 0.5,
      shift: 2.2,
      steer: { kind: 'orbit', radius: 110, pace: 0.6, keep: 60 },
      patterns: [
        pin('poison', 11, PIN_EVERY),
        // Its tentacles reach for the player and drag them in.
        { kind: 'whirlpool', every: 7, target: 'player', count: 1, spread: 0, radius: 14, reach: 64, pull: 42, windup: 1, ttl: 2, damage: 12, visual: 'poison' },
        fan('poison', 3, 0.5, 100, 10, 4.6, { radius: 6, sleep: NEUROTOXIN }),
        { kind: 'cage', every: 8.5, radius: 50, count: 12, size: 9, windup: 1.2, ttl: 3, damage: 12, visual: 'poison' },
        { kind: 'trail', every: 0.28, ttl: 3, radius: 7, damage: 9, visual: 'poison' },
      ],
      ultimate: {
        move: 'Head Smash',
        first: 6,
        every: 20,
        steps: [
          { at: 0, pattern: { kind: 'dash', every: 0, windup: 0.9, speed: 260, width: 22, damage: 24, count: 3 } },
          { at: 4, pattern: ring('poison', 18, 62, 14) },
        ],
      },
    },
  ],
})

const buzzwole = ultra({
  hp: 1.05,
  retinue: retinue('crabrawler', 'heracross', 'pinsir'),
  phases: [
    {
      below: 1,
      steer: { kind: 'chase', pace: 0.8 },
      patterns: [
        pin('slam', 11, PIN_EVERY),
        // Lunge.
        { kind: 'dash', every: 5.5, windup: 0.8, speed: 240, width: 18, damage: 18, count: 1 },
        // Hammer Arm.
        slam('slam', 44, 1.2, 18, 5),
        // Superpower's leap, onto the player.
        { kind: 'strikes', every: 7, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.2, damage: 18, visual: 'slam', lead: 1, leap: true },
        // The ground's shards flying off its blows.
        ring('rock', 10, 60, 13, 6),
      ],
      ultimate: {
        move: 'Power-Up Punch',
        first: 10,
        every: 22,
        steps: [
          { at: 0, pattern: { kind: 'strikes', every: 0, target: 'player', count: 1, spread: 0, radius: 30, delay: 1.1, damage: 22, visual: 'slam', leap: true } },
          { at: 1.5, pattern: { kind: 'strikes', every: 0, target: 'player', count: 1, spread: 0, radius: 30, delay: 1, damage: 22, visual: 'slam', leap: true } },
          { at: 2.9, pattern: { kind: 'strikes', every: 0, target: 'player', count: 1, spread: 0, radius: 34, delay: 1, damage: 24, visual: 'slam', leap: true } },
          { at: 4, pattern: ring('slam', 16, 70, 14) },
        ],
      },
    },
    {
      below: 0.5,
      shift: 2.2,
      steer: { kind: 'chase', pace: 1 },
      patterns: [
        pin('slam', 11, PIN_EVERY),
        { kind: 'dash', every: 5, windup: 0.75, speed: 260, width: 18, damage: 19, count: 2 },
        slam('slam', 50, 1.1, 20, 5.4),
        // Fists closing on the player, a way out.
        { kind: 'ring', every: 6.5, count: 12, speed: 62, radius: 6, damage: 14, visual: 'slam', around: 100, windup: 1, gap: 0.9 },
        along('slam', 3, 15, 1.1, 14, 5),
      ],
      ultimate: {
        move: 'Superpower',
        first: 6,
        every: 20,
        steps: [
          { at: 0, pattern: { kind: 'blast', every: 0, windup: 2.4, damage: 28, safe: 'far', radius: 92, visual: 'slam' } },
          { at: 2.8, pattern: { kind: 'dash', every: 0, windup: 0.8, speed: 280, width: 20, damage: 20, count: 2 } },
        ],
      },
    },
  ],
})

const pheromosa = ultra({
  hp: 0.9,
  retinue: retinue('sandile', 'cacnea', 'krookodile'),
  phases: [
    {
      below: 1,
      steer: { kind: 'hold', range: 120, pace: 1.2 },
      patterns: [
        pin('aero', 11, PIN_EVERY),
        // Lunge, twice in a blink.
        { kind: 'dash', every: 4.2, windup: 0.65, speed: 300, width: 14, damage: 15, count: 2 },
        // Its afterimages streak through where the player stands.
        { kind: 'phantoms', every: 6, origin: 'ring', count: 3, gap: 0.4, windup: 0.8, speed: 220, width: 12, radius: 120, damage: 14, visual: 'aero' },
        // Silver Wind.
        fan('aero', 5, 0.8, 120, 12, 4.8, { windup: 0.8 }),
        // High Jump Kick, out of nowhere.
        { kind: 'teleport', every: 8, to: 'player', windup: 0.9, radius: 24, damage: 15, visual: 'slam' },
      ],
      ultimate: {
        move: 'Lunge',
        first: 9,
        every: 22,
        steps: [{ at: 0, pattern: { kind: 'swoop', every: 0, windup: 0.7, speed: 320, width: 16, damage: 20, count: 4, reach: 150 } }],
      },
    },
    {
      below: 0.5,
      shift: 2,
      // Quiver Dance: its time runs faster.
      haste: 1.25,
      steer: { kind: 'hold', range: 100, pace: 1.4 },
      patterns: [
        pin('aero', 11, PIN_EVERY),
        { kind: 'dash', every: 4.4, windup: 0.65, speed: 320, width: 14, damage: 15, count: 3 },
        { kind: 'phantoms', every: 6.5, origin: 'ring', count: 4, gap: 0.35, windup: 0.8, speed: 230, width: 12, radius: 120, damage: 14, visual: 'aero' },
        along('slam', 3, 14, 1, 13, 4.8),
        fan('aero', 5, 0.9, 125, 12, 5.4, { windup: 0.8 }),
      ],
      ultimate: {
        move: 'High Jump Kick',
        first: 6,
        every: 20,
        steps: [
          { at: 0, pattern: { kind: 'teleport', every: 0, to: 'player', windup: 1, radius: 28, damage: 20, visual: 'slam' } },
          { at: 1.6, pattern: { kind: 'teleport', every: 0, to: 'player', windup: 0.9, radius: 28, damage: 20, visual: 'slam' } },
          { at: 3.1, pattern: { kind: 'teleport', every: 0, to: 'player', windup: 0.9, radius: 32, damage: 22, visual: 'slam' } },
          { at: 4.2, pattern: ring('aero', 16, 74, 14) },
        ],
      },
    },
  ],
})

const xurkitree = ultra({
  hp: 1,
  retinue: retinue('electrike', 'magneton', 'manectric'),
  phases: [
    {
      below: 1,
      steer: { kind: 'anchor', x: 0, y: 0, drift: 40, pace: 0.5 },
      patterns: [
        pin('thunder', 11, PIN_EVERY),
        // Its wires strung across the arena: the gaps between the lines are safe.
        lances('thunder', 3, 60, 8, 1.2, 15, 6),
        along('thunder', 3, 14, 1.1, 13, 5),
        ring('thunder', 12, 60, 13, 5.2),
        { kind: 'summon', every: 13, enemies: ['electrike'], count: 2, max: 3, radius: 70, role: 'runner' },
      ],
      ultimate: {
        move: 'Discharge',
        first: 9,
        every: 22,
        steps: [
          { at: 0, pattern: lattice('thunder', 'thunder', 4, 50, 9, 1.5, 22) },
          { at: 2.1, pattern: lattice('thunder', 'thunder', 4, 50, 9, 1.3, 22) },
        ],
      },
    },
    {
      below: 0.5,
      shift: 2.2,
      steer: { kind: 'orbit', radius: 100, pace: 0.55, keep: 60 },
      patterns: [
        pin('thunder', 11, PIN_EVERY),
        // A live wire swinging across.
        { kind: 'beam', every: 9, source: 'boss', count: 1, spread: 0, sweep: 1.6, windup: 1.2, duration: 1.6, width: 11, length: 300, damage: 16, visual: 'thunder' },
        lattice('thunder', 'thunder', 3, 58, 8, 1.3, 16, 8),
        along('thunder', 4, 13, 1.1, 13, 5),
        ring('thunder', 14, 64, 13, 5),
      ],
      ultimate: {
        move: 'Zap Cannon',
        first: 6,
        every: 20,
        steps: [
          { at: 0, pattern: { kind: 'blast', every: 0, windup: 2.5, damage: 28, safe: 'cover', visual: 'thunder' } },
          { at: 3, pattern: ring('thunder', 20, 70, 14) },
        ],
      },
    },
  ],
})

const celesteela = ultra({
  hp: 1.05,
  touch: 0.85,
  retinue: retinue('skarmory', 'bronzor', 'solrock'),
  phases: [
    {
      below: 1,
      steer: { kind: 'anchor', x: 0, y: -10, drift: 30, pace: 0.4 },
      patterns: [
        pin('steel', 11, PIN_EVERY),
        // Flamethrower out of its arms, stopped by the crystals.
        { kind: 'beam', every: 5.6, source: 'boss', count: 1, spread: 0, windup: 1, duration: 0.7, width: 10, length: 280, damage: 15, visual: 'fire', blocked: true },
        // Seed Bomb.
        { kind: 'strikes', every: 4.8, target: 'player', count: 4, spread: 50, radius: 12, delay: 1.1, damage: 13, visual: 'grass' },
        // The launch: it rockets off, its shadow follows the player, and it crashes down there.
        { kind: 'dive', every: 8, hide: 1.6, windup: 1, radius: 32, damage: 20, visual: 'steel' },
        ring('steel', 12, 56, 13, 6),
      ],
      ultimate: {
        move: 'Heavy Slam',
        first: 10,
        every: 24,
        steps: [
          { at: 0, pattern: { kind: 'dive', every: 0, hide: 1.4, windup: 0.9, radius: 40, damage: 24, visual: 'steel' } },
          { at: 3.2, pattern: { kind: 'dive', every: 0, hide: 1.2, windup: 0.9, radius: 40, damage: 24, visual: 'steel' } },
          { at: 6, pattern: ring('fire', 18, 64, 14) },
        ],
      },
    },
    {
      below: 0.5,
      shift: 2.2,
      // Airborne: it flies across the arena trailing its exhaust.
      steer: { kind: 'pass', reach: 140, every: 3.2, pace: 1 },
      patterns: [
        pin('steel', 11, PIN_EVERY),
        { kind: 'trail', every: 0.18, ttl: 2.6, radius: 7, damage: 10, visual: 'fire' },
        fan('steel', 3, 0.5, 110, 14, 4.6),
        { kind: 'strikes', every: 5.2, target: 'player', count: 4, spread: 50, radius: 12, delay: 1.1, damage: 13, visual: 'grass' },
        { kind: 'dive', every: 9, hide: 1.5, windup: 1, radius: 34, damage: 20, visual: 'steel' },
      ],
      ultimate: {
        move: 'Autotomize',
        first: 6,
        every: 20,
        steps: [{ at: 0, pattern: { kind: 'swoop', every: 0, windup: 0.8, speed: 300, width: 22, damage: 22, count: 3, reach: 160 } }],
      },
    },
  ],
})

const kartana = ultra({
  hp: 0.9,
  retinue: retinue('fomantis', 'honedge', 'scyther'),
  phases: [
    {
      below: 1,
      steer: { kind: 'hold', range: 100, pace: 1 },
      patterns: [
        pin('steel', 11, PIN_EVERY),
        // Leaf Blade, twice.
        { kind: 'dash', every: 4.6, windup: 0.7, speed: 280, width: 10, damage: 17, count: 2 },
        // Razor Leaf.
        fan('grass', 5, 1, 120, 12, 4.4, { radius: 4, windup: 0.8 }),
        // Paper-thin cuts across the arena.
        lances('steel', 2, 70, 6, 1, 17, 5.6),
        along('grass', 3, 13, 1, 12, 5.4),
      ],
      ultimate: {
        move: 'Sacred Sword',
        first: 9,
        every: 22,
        steps: [
          { at: 0, pattern: lattice('steel', 'grass', 3, 58, 6, 1.3, 22) },
          { at: 1.6, pattern: lattice('steel', 'grass', 3, 58, 6, 1.1, 22) },
          { at: 3.2, pattern: lattice('steel', 'grass', 4, 50, 6, 1, 22) },
        ],
      },
    },
    {
      below: 0.5,
      shift: 2,
      haste: 1.15,
      steer: { kind: 'hold', range: 90, pace: 1.3 },
      patterns: [
        pin('steel', 11, PIN_EVERY),
        { kind: 'dash', every: 4.6, windup: 0.65, speed: 300, width: 10, damage: 17, count: 3 },
        { kind: 'phantoms', every: 6.4, origin: 'ring', count: 4, gap: 0.35, windup: 0.8, speed: 240, width: 10, radius: 120, damage: 15, visual: 'steel' },
        lances('steel', 3, 60, 6, 1, 17, 6),
        fan('grass', 6, 1.1, 125, 12, 5, { radius: 4, windup: 0.8 }),
      ],
      ultimate: {
        move: 'Leaf Blade',
        first: 6,
        every: 20,
        steps: [
          { at: 0, pattern: { kind: 'phantoms', every: 0, origin: 'ring', count: 6, gap: 0.3, windup: 0.8, speed: 260, width: 12, radius: 130, damage: 20, visual: 'grass' } },
          { at: 3, pattern: lances('steel', 4, 52, 7, 1, 20) },
        ],
      },
    },
  ],
})

const guzzlord = ultra({
  hp: 1.1,
  retinue: retinue('gulpin', 'stunky', 'swalot'),
  phases: [
    {
      below: 1,
      steer: { kind: 'chase', pace: 0.6 },
      patterns: [
        pin('shadow', 11, PIN_EVERY),
        // Crunch, where the player is heading.
        { kind: 'strikes', every: 4.5, target: 'player', count: 1, spread: 0, radius: 22, delay: 1.1, damage: 18, visual: 'shadow', lead: 1 },
        // Its maw opens and drags the player in.
        { kind: 'whirlpool', every: 9, target: 'self', count: 1, spread: 0, radius: 22, reach: 220, pull: 46, windup: 1, ttl: 2.4, damage: 20, visual: 'shadow' },
        ring('dragon', 12, 58, 13, 5),
        slam('slam', 48, 1.3, 20, 6.5),
      ],
      ultimate: {
        move: 'Stockpile',
        first: 10,
        every: 24,
        steps: [
          { at: 0, pattern: { kind: 'whirlpool', every: 0, target: 'self', count: 1, spread: 0, radius: 26, reach: 420, pull: 62, windup: 1, ttl: 3, damage: 22, visual: 'shadow' } },
          { at: 3.4, pattern: slam('shadow', 64, 1.1, 28, 0) },
          { at: 4.6, pattern: ring('dragon', 20, 66, 14) },
        ],
      },
    },
    {
      below: 0.5,
      shift: 2.4,
      steer: { kind: 'chase', pace: 0.7 },
      // It devours the floor itself: bites out of the arena's edge, gone for good.
      arena: [{ kind: 'crumble', at: 0, warn: 2.8, area: [], spare: BITES }],
      patterns: [
        pin('shadow', 11, PIN_EVERY),
        { kind: 'strikes', every: 4.2, target: 'player', count: 2, spread: 30, radius: 20, delay: 1.1, damage: 18, visual: 'shadow', lead: 1 },
        // Maws opening under the player.
        { kind: 'whirlpool', every: 8, target: 'player', count: 2, spread: 60, radius: 16, reach: 70, pull: 40, windup: 1.1, ttl: 2, damage: 16, visual: 'shadow' },
        ring('dragon', 14, 62, 13, 5),
        slam('slam', 52, 1.2, 20, 6),
      ],
      ultimate: {
        move: 'Hyper Beam',
        first: 6,
        every: 20,
        steps: [
          { at: 0, pattern: { kind: 'beam', every: 0, source: 'boss', count: 1, spread: 0, windup: 1.6, duration: 0.8, width: 28, length: 420, damage: 30, visual: 'dragon', blocked: true } },
          { at: 2.8, pattern: { kind: 'whirlpool', every: 0, target: 'self', count: 1, spread: 0, radius: 24, reach: 300, pull: 50, windup: 0.8, ttl: 2, damage: 20, visual: 'shadow' } },
        ],
      },
    },
  ],
})

const stakataka = ultra({
  hp: 1.1,
  retinue: retinue('roggenrola', 'nosepass', 'boldore'),
  phases: [
    {
      below: 1,
      steer: { kind: 'anchor', x: 0, y: 0, drift: 24, pace: 0.35 },
      // A wall of stones: hits land lighter.
      taken: 0.75,
      patterns: [
        pin('rock', 11, PIN_EVERY),
        // Rock Slide along the player's way.
        { kind: 'strikes', every: 4.4, target: 'player', count: 5, spread: 60, radius: 12, delay: 1.2, damage: 13, visual: 'rock' },
        // A wall of stones around the player.
        { kind: 'cage', every: 7, radius: 52, count: 12, size: 10, windup: 1.2, ttl: 3.2, damage: 12, visual: 'rock' },
        // Walls sweeping in with gaps to stand in.
        lances('rock', 4, 40, 16, 1.4, 16, 7.5),
        // Iron Head, a slow heavy charge.
        { kind: 'dash', every: 8, windup: 1.1, speed: 180, width: 26, damage: 20, count: 1 },
      ],
      ultimate: {
        move: 'Rock Slide',
        first: 10,
        every: 24,
        steps: [
          { at: 0, pattern: { kind: 'blast', every: 0, windup: 2.6, damage: 28, safe: 'cover', visual: 'rock' } },
          { at: 3, pattern: { kind: 'cage', every: 0, radius: 56, count: 14, size: 10, windup: 1, ttl: 2.6, damage: 14, visual: 'rock' } },
        ],
      },
    },
    {
      below: 0.5,
      shift: 2.4,
      // Its stones come loose and it hurries.
      taken: 1.1,
      haste: 1.2,
      steer: { kind: 'chase', pace: 0.6 },
      patterns: [
        pin('rock', 11, PIN_EVERY),
        { kind: 'cage', every: 7.5, radius: 50, count: 12, size: 10, windup: 1.1, ttl: 3, damage: 13, visual: 'rock' },
        { kind: 'strikes', every: 4.6, target: 'player', count: 5, spread: 60, radius: 12, delay: 1.1, damage: 13, visual: 'rock' },
        ring('steel', 14, 60, 13, 5.2),
        { kind: 'dash', every: 7, windup: 1, speed: 200, width: 26, damage: 20, count: 2 },
      ],
      ultimate: {
        move: 'Trick Room',
        first: 6,
        every: 22,
        steps: [
          // The player's shots hold still in the warped room while the walls close in.
          { at: 0, pattern: { kind: 'timeStop', every: 0, windup: 1, duration: 2.6 } },
          { at: 1, pattern: { kind: 'cage', every: 0, radius: 54, count: 14, size: 10, windup: 1, ttl: 2.6, damage: 14, visual: 'rock' } },
          { at: 2.6, pattern: { kind: 'ring', every: 0, count: 14, speed: 60, radius: 6, damage: 14, visual: 'rock', around: 110, windup: 1, gap: 0.8 } },
        ],
      },
    },
  ],
})

/** Blacephalon's head: one lands where the player is heading and blows. */
const head = (count: number, radius: number, delay: number, damage: number, every: number): BossPattern => ({
  kind: 'strikes', every, target: 'player', count, spread: count > 1 ? 60 : 0, radius, delay, damage, visual: 'fire', lead: 1,
})

const blacephalon = ultra({
  hp: 0.95,
  retinue: retinue('litwick', 'slugma', 'lampent'),
  phases: [
    {
      below: 1,
      steer: { kind: 'hold', range: 110, pace: 0.8 },
      patterns: [
        pin('fire', 11, PIN_EVERY),
        head(1, 30, 1.4, 20, 5.2),
        fan('fire', 3, 0.5, 110, 13, 4.4, { radius: 6 }),
        ring('shadow', 10, 62, 13, 5.6),
        // Astonish: it pops up on the far side.
        { kind: 'teleport', every: 9, to: 'far', windup: 0.9, radius: 22, damage: 14, visual: 'shadow' },
      ],
      ultimate: {
        move: 'Mind Blown',
        first: 9,
        every: 22,
        steps: [
          { at: 0, pattern: head(5, 16, 1.4, 18, 0) },
          { at: 1.6, pattern: { kind: 'blast', every: 0, windup: 2.2, damage: 30, safe: 'far', radius: 84, visual: 'fire' } },
        ],
      },
    },
    {
      below: 0.5,
      shift: 2.2,
      steer: { kind: 'orbit', radius: 110, pace: 0.8, keep: 60 },
      patterns: [
        pin('fire', 11, PIN_EVERY),
        head(3, 22, 1.3, 18, 5),
        // Its clown spirits streak through the player's spot.
        { kind: 'phantoms', every: 7, origin: 'ring', count: 3, gap: 0.5, windup: 0.9, speed: 200, width: 14, radius: 120, damage: 15, visual: 'shadow' },
        fan('fire', 4, 0.7, 110, 13, 4.8, { radius: 6 }),
        { kind: 'ring', every: 6.5, count: 12, speed: 60, radius: 5, damage: 13, visual: 'fire', around: 92, windup: 1, gap: 0.9 },
      ],
      ultimate: {
        move: 'Mind Blown',
        first: 6,
        every: 20,
        steps: [
          { at: 0, pattern: head(6, 16, 1.3, 18, 0) },
          { at: 1.5, pattern: { kind: 'blast', every: 0, windup: 2, damage: 30, safe: 'far', radius: 84, visual: 'fire' } },
          { at: 4, pattern: head(6, 16, 1.2, 18, 0) },
          { at: 5.2, pattern: ring('fire', 20, 70, 14) },
        ],
      },
    },
  ],
})

/** Naganadel's needles: a quick fan of venom. */
const needles = (count: number, arc: number, every: number): BossPattern => fan('poison', count, arc, 130, 12, every, { radius: 4, windup: 0.8 })

const naganadel = ultra({
  hp: 1,
  touch: 0.85,
  retinue: retinue('noibat', 'skorupi', 'seviper'),
  phases: [
    {
      below: 1,
      steer: { kind: 'pass', reach: 130, every: 3.4, pace: 0.9 },
      patterns: [
        pin('poison', 11, PIN_EVERY),
        needles(5, 0.7, 4.2),
        ring('dragon', 12, 62, 13, 5),
        // Venom dripping where it flies.
        { kind: 'trail', every: 0.26, ttl: 2.4, radius: 6, damage: 9, visual: 'poison' },
        along('dragon', 3, 14, 1.1, 13, 5.6),
      ],
      ultimate: {
        move: 'Dragon Pulse',
        first: 9,
        every: 22,
        steps: [
          { at: 0, pattern: { kind: 'beam', every: 0, source: 'boss', count: 3, spread: 0.5, windup: 1.2, duration: 0.5, width: 12, length: 380, damage: 22, visual: 'dragon' } },
          { at: 1.6, pattern: ring('dragon', 18, 66, 14) },
          { at: 2.6, pattern: { kind: 'beam', every: 0, source: 'boss', count: 3, spread: 0.5, windup: 1.1, duration: 0.5, width: 12, length: 380, damage: 22, visual: 'dragon' } },
        ],
      },
    },
    {
      below: 0.5,
      shift: 2.2,
      steer: { kind: 'hold', range: 120, pace: 1.1 },
      patterns: [
        pin('poison', 11, PIN_EVERY),
        { kind: 'swoop', every: 8, windup: 0.8, speed: 280, width: 16, damage: 20, count: 2, reach: 150 },
        needles(7, 1, 4.4),
        { kind: 'trail', every: 0.26, ttl: 2.4, radius: 6, damage: 9, visual: 'poison' },
        ring('dragon', 14, 64, 13, 5.4),
      ],
      ultimate: {
        move: 'Toxic',
        first: 6,
        every: 20,
        steps: [
          { at: 0, pattern: { kind: 'blast', every: 0, windup: 2.6, damage: 26, safe: 'spots', spots: 3, visual: 'poison' } },
          { at: 3, pattern: needles(9, 1.4, 0) },
        ],
      },
    },
  ],
})

export const ULTRA_DOMAINS: Record<UltraBeast, LegendDomain> = {
  nihilego, buzzwole, pheromosa, xurkitree, celesteela, kartana, guzzlord, stakataka, blacephalon, naganadel,
}
