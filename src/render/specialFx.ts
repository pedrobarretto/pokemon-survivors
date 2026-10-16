import { blitCentered, blitRotated, context2d, createCanvas, ellipse, fromStrings, type PixelSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { TYPE_COLORS, type PokeType } from '../data/types'
import { gameSpecial, SPECIALS, specialOfType, specialReach, type SpecialId } from '../game/special'
import { STANCES, type Stance } from '../game/stance'
import type { Attack, Game } from '../game/types'
import { FX, outlined, toIconUrl } from './art'
import type { Form } from './sprites'

/** Code-drawn pixel art for the special attacks (`game/special.ts`). */

type Ctx = CanvasRenderingContext2D

const lazy = <T>(build: () => T) => {
  let value: T | undefined
  return () => (value ??= build())
}

const ROOT = [
  '....1....', '...151...', '...121...', '..1231...', '..12321..', '.512321..', '1.12321..',
  '..1233215', '..12321.1', '.1233321.', '.1243321.', '12344321.', '123443321', '124444421',
]
const ROOT_PALETTE = { 1: '#20140c', 2: '#6a4020', 3: '#a87038', 4: '#58a838', 5: '#a8e870' }

const ROOTS = lazy(() => [fromStrings(ROOT, ROOT_PALETTE), fromStrings(ROOT, ROOT_PALETTE, { mirror: true })])

/** Hard-edged circle outline plotted point by point (cheap for big, growing rings). */
const pixelRing = (ctx: Ctx, x: number, y: number, r: number, thickness: number, color: string) => {
  ctx.fillStyle = color
  for (let k = 0; k < thickness; k++) {
    const rr = r - k
    if (rr <= 0) return
    const steps = Math.max(8, Math.ceil(rr * TAU))
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TAU
      ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 1, 1)
    }
  }
}

const slabCache = new Map<string, PixelSprite>()

/** One slice of the water beam: blue edges, white core, with flowing streaks (2 frames). */
const beamSlab = (width: number, frame: number) => {
  const key = `${width}|${frame}`
  const cached = slabCache.get(key)
  if (cached) return cached
  const len = 11
  const canvas = createCanvas(len, width)
  const ctx = context2d(canvas)
  const half = width / 2
  for (let y = 0; y < width; y++) {
    const d = Math.abs(y + 0.5 - half) / half
    for (let x = 0; x < len; x++) {
      const streak = d > 0.25 && d < 0.6 && (x + frame * 2 + y * 3) % 6 === 0
      ctx.fillStyle = streak ? '#ffffff' : d > 0.8 ? '#2848b0' : d > 0.52 ? '#6890f0' : d > 0.24 ? '#a8d0f8' : '#ffffff'
      ctx.fillRect(x, y, 1, 1)
    }
  }
  slabCache.set(key, canvas)
  return canvas
}

const radius = (a: Attack) => (a.shape.kind === 'circle' ? a.shape.r : 0)

/* ---------------- Shared forms (bolt, rain, ring, wave, trail) ---------------- */

/** Per type: shade, base (the type color), light, highlight. Glyph rows index them as 1-4. */
const PALETTES: Record<PokeType, readonly [string, string, string, string]> = {
  normal: ['#605838', TYPE_COLORS.normal, '#d8d8b8', '#ffffff'],
  fire: ['#a82010', TYPE_COLORS.fire, '#f8d030', '#fff0a0'],
  water: ['#2848b0', TYPE_COLORS.water, '#a8d0f8', '#ffffff'],
  grass: ['#386820', TYPE_COLORS.grass, '#a8e870', '#ffffff'],
  electric: ['#a07810', TYPE_COLORS.electric, '#f8f088', '#ffffff'],
  poison: ['#481858', TYPE_COLORS.poison, '#d088d8', '#f8e0f8'],
  flying: ['#5848a8', TYPE_COLORS.flying, '#d8d0f8', '#ffffff'],
  bug: ['#506010', TYPE_COLORS.bug, '#d8e870', '#ffffff'],
  rock: ['#584818', TYPE_COLORS.rock, '#e0d088', '#fff8d8'],
  ground: ['#685020', TYPE_COLORS.ground, '#f0e0a8', '#fff8e0'],
  ghost: ['#302048', TYPE_COLORS.ghost, '#a890d0', '#f0e0ff'],
  fighting: ['#601810', TYPE_COLORS.fighting, '#f87858', '#fff0e0'],
  psychic: ['#a02858', TYPE_COLORS.psychic, '#f8b0c8', '#ffffff'],
  ice: ['#3878a8', TYPE_COLORS.ice, '#d0f0f0', '#ffffff'],
  steel: ['#585870', TYPE_COLORS.steel, '#e0e0f0', '#ffffff'],
  dark: ['#281c20', TYPE_COLORS.dark, '#b098a0', '#e8d8e0'],
  fairy: ['#a84868', TYPE_COLORS.fairy, '#f8d0e0', '#ffffff'],
  dragon: ['#301888', TYPE_COLORS.dragon, '#b090f8', '#f0e8ff'],
}

/** Chain dashes and Stance Change: their icons come from the slash and the stance art below. */
type OwnArtSpecial = { [K in SpecialId]: (typeof SPECIALS)[K]['kind'] extends 'chain' | 'stance' ? K : never }[SpecialId]

/** Specials drawn by the shared forms; the bespoke ones keep their own art below. */
type FormSpecial = Exclude<SpecialId, 'blastBurn' | 'dragonFlare' | 'hydroCannon' | 'frenzyPlant' | 'boomburst' | OwnArtSpecial>

/**
 * Each shared-form special's piece (meteor, orb, blade…), also its icon. `turn`
 * pieces rotate to face where they fly; the others stay upright.
 */
const GLYPHS: Record<FormSpecial, { rows: readonly string[]; turn?: boolean }> = {
  boltStrike: { rows: ['...111.', '..1331.', '..131..', '.1331..', '.133111', '1333331', '1113331', '..1331.', '..131..', '.131...', '.11....'] },
  doomDesire: { rows: ['....1....', '...121...', '...131...', '111343111', '.1234321.', '..13431..', '.1321231.', '.121.121.', '.11...11.'] },
  lightOfRuin: { rows: ['..111....', '.1331..4.', '1331..444', '1331...4.', '1331.....', '13331...1', '.1333311.', '..11111..'] },
  expandingForce: { rows: ['...111...', '.1122211.', '122333221', '123414321', '122333221', '.1122211.', '...111...'] },
  nightDaze: { rows: ['1...1...1', '.1..2..1.', '..12321..', '..23332..', '123343321', '..23332..', '..12321..', '.1..2..1.', '1...1...1'] },
  dracoMeteor: { rows: ['...3...', '..3.3..', '..232..', '.12321.', '.23432.', '1234321', '1234321', '.12321.', '..111..'] },
  diamondStorm: { rows: ['..1111..', '.122341.', '12223431', '12222341', '11222221', '.112221.', '..1111..'] },
  blizzard: { rows: ['12341', '12341', '.234.', '.234.', '.23..', '..3..', '..3..'] },
  astralBarrage: { rows: ['..1111..', '.122221.', '12233221', '12334321', '12334321', '12233221', '.122221.', '..1111..'] },
  auraSphere: { rows: ['..2222..', '.233332.', '23344332', '23444432', '23444432', '23344332', '.233332.', '..2222..'] },
  attackOrder: { rows: ['1........', '11.......', '122233334', '11.......', '1........'], turn: true },
  precipiceBlades: { rows: ['...4...', '...3...', '..434..', '..323..', '.12321.', '.12221.', '1222221', '1122211', '.11111.'] },
  aeroblast: { rows: ['11....', '.22...', '..23..', '..234.', '..234.', '..234.', '..23..', '.22...', '11....'], turn: true },
  malignantChain: { rows: ['...1...', '...1...', '..121..', '..131..', '.12331.', '1233431', '1233331', '.12221.', '..111..'] },
  /* Mega specials: their icons (in the world, pieces follow the type like every other special). */
  psystrike: { rows: ['..1...1..', '.121.121.', '.1232321.', '..13431..', '.1234321.', '..13431..', '.1232321.', '.121.121.', '..1...1..'] },
  poltergeist: { rows: ['...111...', '..12221..', '.1233321.', '.1341431.', '.1233321.', '.1233321.', '.123.321.', '.12...21.', '.1.....1.'] },
  moonblast: { rows: ['...1111..', '..12331..', '.1234.1..', '.1234....', '.1234....', '.12334.1.', '..1233321', '...11111.'] },
  stoneEdge: { rows: ['....1....', '...141...', '...131...', '..13431..', '..12321..', '.1233321.', '.1222221.', '122222221', '111111111'] },
  petalBlizzard: { rows: ['..11.....', '.1221..1.', '.1232.121', '..121..1.', '....1....', '.1....11.', '121..1221', '.1..12321', '.....111.'] },
  heatWave: { rows: ['.1..1..1.', '121121121', '232232232', '.32.32.32', '34.34.34.', '43.43.43.', '.34.34.34', '232232232', '121121121'] },
  waterPulse: { rows: ['..11111..', '.1.....1.', '1..222..1', '1.2.3.2.1', '1.23432.1', '1.2.3.2.1', '1..222..1', '.1.....1.', '..11111..'] },
  risingVoltage: { rows: ['.....11..', '....131..', '...1341..', '..13331..', '.133331..', '...1331..', '..1331...', '..131....', '111111111'] },
  hurricane: { rows: ['123333321', '.1233321.', '..12321..', '...1221..', '..1221...', '...121...', '....11...', '...11....', '....1....'] },
  solarBeam: { rows: ['1...1...1', '.1.121.1.', '..12321..', '.1234321.', '123444321', '.1234321.', '..12321..', '.1.121.1.', '1...1...1'] },
  muddyWater: { rows: ['....1111.', '...12221.', '..123.31.', '.1234..1.', '1234.....', '12341..11', '123341121', '122233321', '111111111'] },
  meteorMash: { rows: ['1........', '.1.......', '..1.111..', '...12221.', '..1233421', '..1234421', '..1233321', '...12221.', '....111..'] },
  earthPower: { rows: ['...1.1...', '..13.31..', '...141...', '..13431..', '.1233321.', '.1222221.', '122222221', '111111111'] },
  scaleShot: { rows: ['...111...', '..12221..', '.1233321.', '.1234321.', '.1234321.', '.1233321.', '..12221..', '...121...', '....1....'] },
  focusBlast: { rows: ['1..111..1', '.1122211.', '.1233321.', '.1234321.', '.1234321.', '.1233321.', '.1122211.', '1..111..1'] },
  heatCrash: { rows: ['..11111..', '.1222221.', '.1233321.', '.1234321.', '..12321..', '...121...', '1.1.1.1.1', '.1.1.1.1.', '111111111'] },
  spikyShield: { rows: ['1.1.1.1.1', '.1111111.', '112222211', '.1233321.', '112344211', '.1233321.', '..12321..', '...121...', '....1....'] },
  mysticalFire: { rows: ['....1....', '...121...', '..12321..', '.1234321.', '.1234321.', '123444321', '123444321', '.1234321.', '..11111..'] },
}

const glyphCache = new Map<FormSpecial, PixelSprite>()

/** A special's piece, outlined so it reads on any biome. */
const glyph = (id: FormSpecial) => {
  const cached = glyphCache.get(id)
  if (cached) return cached
  const [c1, c2, c3, c4] = PALETTES[SPECIALS[id].type]
  const sprite = outlined(fromStrings(GLYPHS[id].rows, { 1: c1, 2: c2, 3: c3, 4: c4 }))
  glyphCache.set(id, sprite)
  return sprite
}

const isForm = (id: SpecialId): id is FormSpecial => id in GLYPHS

/** The piece for an attack: specials follow their type (see `specialOfType`). */
const pieceOf = (a: Attack) => {
  const id = specialOfType(a.type)
  return isForm(id) ? { sprite: glyph(id), turn: GLYPHS[id].turn === true } : null
}

/** Integer scale for pieces that should read from across a phone screen. */
const BIG = 2

/** Sky strikes: telegraph blink, then a column that crashes down and an impact ring. Electric bolts zigzag. */
const drawBolt = (ctx: Ctx, a: Attack, t: number) => {
  const r = radius(a)
  const [, mid, light, white] = PALETTES[a.type]
  if (a.age < a.activeFrom) {
    if (Math.floor(a.age * 30) % 2 === 0) pixelRing(ctx, a.x, a.y, Math.round(r * 0.6), 1, light)
    return
  }
  const k = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
  if (k < 0.45) {
    const w = 2 * Math.round(r * 0.15) + 1
    const jag = a.type === 'electric' ? 3 : 0
    const frame = Math.floor(t * 30)
    for (let seg = 0, y = a.y - 120; y < a.y; seg++, y += 6) {
      const off = jag * (((seg * 73 + a.id * 31 + frame * 17) % 3) - 1)
      const x = Math.round(a.x + off - w / 2)
      ctx.fillStyle = mid
      ctx.fillRect(x, Math.round(y), w, 6)
      ctx.fillStyle = light
      ctx.fillRect(x + 1, Math.round(y), w - 2, 6)
      ctx.fillStyle = white
      ctx.fillRect(x + (w >> 1), Math.round(y), 1, 6)
    }
    if (k < 0.2) blitCentered(ctx, ellipse(Math.round(r * 0.8), Math.max(1, Math.round(r * 0.4)), light), a.x, a.y)
  }
  ctx.globalAlpha = Math.max(0, 1 - k)
  pixelRing(ctx, a.x, a.y, Math.round(r * (0.7 + 0.6 * k)), 2, mid)
  ctx.globalAlpha = 1
}

/** Seconds a falling piece is visible before it lands, and how fast it falls (px/s). */
const FALL_TIME = 0.4
const FALL_SPEED = 280
const FALL_SLANT = 0.35

/** Rain: the piece falls on a slant, then a splash ring where it lands. */
const drawMeteor = (ctx: Ctx, a: Attack) => {
  const fall = a.activeFrom - a.age
  const piece = pieceOf(a)
  if (fall > 0) {
    if (fall > FALL_TIME || !piece) return
    const h = fall * FALL_SPEED
    const side = a.flip ? -1 : 1
    blitRotated(ctx, piece.sprite, a.x + side * h * FALL_SLANT, a.y - h, Math.atan2(1, -side * FALL_SLANT) - Math.PI / 2, BIG)
    return
  }
  const r = radius(a)
  const [, mid, light] = PALETTES[a.type]
  const k = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
  ctx.globalAlpha = Math.max(0, 1 - k)
  if (k < 0.35) blitCentered(ctx, ellipse(Math.round(r), Math.max(1, Math.round(r * 0.55)), light), a.x, a.y)
  pixelRing(ctx, a.x, a.y, Math.round(r * (0.8 + 0.5 * k)), 2, mid)
  ctx.globalAlpha = 1
}

/** Ring volleys: the piece, turned along its flight when it has a point. */
const drawOrb = (ctx: Ctx, a: Attack) => {
  const piece = pieceOf(a)
  if (!piece || a.motion.kind !== 'linear') return
  ctx.globalAlpha = Math.min(1, (a.ttl - a.age) / 0.15)
  if (piece.turn) blitRotated(ctx, piece.sprite, a.x, a.y, Math.atan2(a.motion.vy, a.motion.vx))
  else blitCentered(ctx, piece.sprite, a.x, a.y)
  ctx.globalAlpha = 1
}

/** Wave segments at double size: wind turns to face its way, stone blades stand upright. */
const drawWave = (ctx: Ctx, a: Attack) => {
  const piece = pieceOf(a)
  if (!piece || a.motion.kind !== 'linear') return
  ctx.globalAlpha = Math.min(1, (a.ttl - a.age) / 0.2)
  if (piece.turn) blitRotated(ctx, piece.sprite, a.x, a.y, Math.atan2(a.motion.vy, a.motion.vx), BIG)
  else {
    const w = piece.sprite.width * BIG
    const h = piece.sprite.height * BIG
    ctx.drawImage(piece.sprite, Math.round(a.x - w / 2), Math.round(a.y + 8 - h), w, h)
  }
  ctx.globalAlpha = 1
}

/* ---------------- Chain dash ---------------- */

/** A crescent cut, convex side up; turned to face the lunge. Also the chain dash icon. */
const SLASH = [
  '.....1111111.....',
  '...11223333211...',
  '..1234444444321..',
  '.124.........421.',
  '.13...........31.',
  '1.1...........1.1',
]

const slashCache = new Map<PokeType, PixelSprite>()

const slashSprite = (type: PokeType) => {
  const cached = slashCache.get(type)
  if (cached) return cached
  const [c1, c2, c3, c4] = PALETTES[type]
  const sprite = fromStrings(SLASH, { 1: c1, 2: c2, 3: c3, 4: c4 })
  slashCache.set(type, sprite)
  return sprite
}

const streakCache = new Map<PokeType, PixelSprite>()

/** One 10 px slice of the speed line the lunge leaves: type-colored edges, white core. */
const streakSprite = (type: PokeType) => {
  const cached = streakCache.get(type)
  if (cached) return cached
  const [, mid, light] = PALETTES[type]
  const sprite = fromStrings(['2222222222', '4444444444', '3333333333'], { 2: mid, 3: light, 4: '#ffffff' })
  streakCache.set(type, sprite)
  return sprite
}

/** The capsule's speed line: each slice lights up as the player passes, then fades. */
const drawStreak = (ctx: Ctx, a: Attack) => {
  if (a.age < a.activeFrom) return
  const k = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
  ctx.globalAlpha = Math.max(0, 1 - k)
  blitRotated(ctx, streakSprite(a.type), a.x, a.y, Math.atan2(a.y - a.from.y, a.x - a.from.x))
  ctx.globalAlpha = 1
}

/** The landing cut: a crescent swept across the foe, growing and fading, with a white flash first. */
const drawSlash = (ctx: Ctx, a: Attack) => {
  const k = a.age / a.ttl
  const angle = Math.atan2(a.y - a.from.y, a.x - a.from.x) + Math.PI / 2 + (a.flip ? 0.5 : -0.5)
  const scale = k < 0.15 ? 2 : 3
  ctx.globalAlpha = Math.max(0, 1 - k * k)
  blitRotated(ctx, slashSprite(a.type), a.x, a.y, angle, scale)
  if (k < 0.12) blitCentered(ctx, ellipse(Math.round(radius(a) * 0.25), Math.round(radius(a) * 0.25), '#ffffff'), a.x, a.y)
  ctx.globalAlpha = 1
}

/* ---------------- Stance Change ---------------- */

const SHIELD = ['.1111111.', '122222221', '123343321', '123444321', '123343321', '.1233321.', '.1223221.', '..12221..', '...121...', '....1....']
const SWORD = ['...1...', '..141..', '..131..', '..131..', '..131..', '..131..', '..131..', '..131..', '1122211', '1222221', '..151..', '..151..', '..111..']

/** Aegislash's forme as a small icon: a gold shield or its sword, in the stance color. */
const STANCE_ART = {
  shield: lazy(() => outlined(fromStrings(SHIELD, { 1: '#584010', 2: '#f8d030', 3: STANCES.shield.color, 4: '#ffffff' }))),
  blade: lazy(() => outlined(fromStrings(SWORD, { 1: '#282838', 2: STANCES.blade.color, 3: '#c8d0e0', 4: '#ffffff', 5: '#584010' }))),
} as const satisfies Record<Stance, () => PixelSprite>

export const stanceIcon = (stance: Stance) => toIconUrl(`stance:${stance}`, STANCE_ART[stance])

/** Ground ring in the stance color under Aegislash, so the forme reads at a glance. */
const drawStanceRing = (ctx: Ctx, g: Game, t: number) => {
  const stance = g.player.special.stance
  if (!stance) return
  const p = g.player
  ctx.fillStyle = STANCES[stance].color
  const rx = 13
  const ry = 5
  const spin = stance === 'blade' ? t * 3 : 0
  for (let i = 0; i < 24; i++) {
    if (stance === 'blade' && i % 3 === 0) continue
    const a = (i / 24) * TAU + spin
    ctx.fillRect(Math.round(p.x + Math.cos(a) * rx), Math.round(p.y + 1 + Math.sin(a) * ry), 1, 1)
  }
}

/** The sprite form Aegislash wears in each stance, like in the games: Shield is its normal sprite. */
export const STANCE_FORMS = { shield: undefined, blade: 'blade' } as const satisfies Record<Stance, Form | undefined>

/**
 * The fire dash's look: orange flames, or Mega Charizard X's blue dragon fire
 * (Dragon Flare). `ball` runs from the fireball's rim to its pale core.
 */
const FLARES = {
  fire: { frames: FX.flame, ball: ['#c03020', '#f08030', '#f8d030', '#fff8c0'], body: 'rgba(248,160,48,0.35)', glow: 'rgba(248,128,48,0.4)', scorch: 'rgba(56,16,8,0.4)' },
  dragon: { frames: FX.dragonFlame, ball: ['#2028a0', '#3870f0', '#78c8f8', '#e8f8ff'], body: 'rgba(72,136,248,0.35)', glow: 'rgba(72,120,248,0.4)', scorch: 'rgba(8,16,56,0.4)' },
} as const

const flareOf = (a: Attack) => (a.type === 'dragon' ? FLARES.dragon : FLARES.fire)

/** Ground layer (under entities): scorch marks, cracks, glows. */
export const drawSpecialGround = (ctx: Ctx, a: Attack) => {
  const r = Math.round(radius(a))
  switch (a.visual) {
    case 'fireTrail': {
      ctx.globalAlpha = Math.min(1, (a.ttl - a.age) / 0.4)
      blitCentered(ctx, ellipse(r, Math.max(1, Math.round(r * 0.5)), flareOf(a).scorch), a.x, a.y + 2)
      ctx.globalAlpha = 1
      return
    }
    case 'blitz':
      return blitCentered(ctx, ellipse(r + 4, Math.round((r + 4) * 0.5), flareOf(a).glow), a.x, a.y + 8)
    case 'roots':
      return blitCentered(ctx, ellipse(Math.round(r * 0.8), Math.max(1, Math.round(r * 0.35)), 'rgba(40,24,8,0.5)'), a.x, a.y)
    case 'meteor': {
      // The landing shadow grows as the piece comes down.
      const fall = a.activeFrom - a.age
      if (fall <= 0 || fall > FALL_TIME) return
      const k = 1 - (fall / FALL_TIME) * 0.6
      return blitCentered(ctx, ellipse(Math.max(1, Math.round(r * k)), Math.max(1, Math.round(r * k * 0.45)), 'rgba(16,8,24,0.35)'), a.x, a.y)
    }
    case 'wave':
      if (a.type === 'flying') return
      return blitCentered(ctx, ellipse(Math.round(r), Math.max(1, Math.round(r * 0.4)), 'rgba(56,40,16,0.35)'), a.x, a.y + 8)
    case 'puddle': {
      ctx.globalAlpha = 0.6 * Math.min(1, (a.ttl - a.age) / 0.4, a.age / 0.1)
      blitCentered(ctx, ellipse(Math.round(r), Math.max(1, Math.round(r * 0.5)), PALETTES[a.type][1]), a.x, a.y)
      blitCentered(ctx, ellipse(Math.round(r * 0.6), Math.max(1, Math.round(r * 0.3)), PALETTES[a.type][2]), a.x - 1, a.y - 1)
      ctx.globalAlpha = 1
      return
    }
  }
}

/** Effect layer (above entities). */
export const drawSpecialAttack = (ctx: Ctx, a: Attack, t: number) => {
  const r = radius(a)
  switch (a.visual) {
    case 'fireTrail': {
      const left = a.ttl - a.age
      if (left < 0.3 && Math.floor(left * 30) % 2 === 0) return
      const frames = flareOf(a).frames()
      return blitCentered(ctx, frames[(Math.floor((t + a.id * 0.37) * 10) + (a.flip ? 1 : 0)) % 2]!, a.x, a.y - 4)
    }
    case 'blitz': {
      const f = flareOf(a)
      blitCentered(ctx, ellipse(Math.round(r), Math.round(r), f.body), a.x, a.y)
      pixelRing(ctx, a.x, a.y, Math.round(r), 2, Math.floor(t * 20) % 2 ? f.ball[2] : f.ball[3])
      const frames = f.frames()
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + a.age * 18
        blitCentered(ctx, frames[i % 2]!, a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r * 0.8)
      }
      return
    }
    case 'blast': {
      const R = Math.round(r)
      const [deep, mid, light, pale] = flareOf(a).ball
      // Translucent fireball while it deals damage, then a fading shock ring.
      if (a.age > a.activeUntil) {
        const k = (a.age - a.activeUntil) / (a.ttl - a.activeUntil)
        ctx.globalAlpha = Math.max(0, 1 - k)
        pixelRing(ctx, a.x, a.y, R + Math.round(k * 10), 3, mid)
        pixelRing(ctx, a.x, a.y, R + Math.round(k * 10) - 3, 1, pale)
        ctx.globalAlpha = 1
        return
      }
      ctx.globalAlpha = 0.8
      blitCentered(ctx, ellipse(R, R, deep), a.x, a.y)
      blitCentered(ctx, ellipse(Math.round(R * 0.78), Math.round(R * 0.78), mid), a.x, a.y)
      blitCentered(ctx, ellipse(Math.round(R * 0.52), Math.round(R * 0.52), light), a.x, a.y)
      blitCentered(ctx, ellipse(Math.round(R * 0.26), Math.round(R * 0.26), '#ffffff'), a.x, a.y)
      pixelRing(ctx, a.x, a.y, R + 3, 1, pale)
      ctx.globalAlpha = 1
      return
    }
    case 'beam': {
      if (a.age < a.activeFrom) return
      const on = a.age - a.activeFrom
      const left = a.ttl - a.age
      const swell = Math.min(1, on / 0.06) * Math.min(1, left / 0.15)
      const width = Math.max(2, Math.round(r * 2 * swell * (0.88 + 0.12 * Math.sin(t * 50))))
      const angle = Math.atan2(a.y - a.from.y, a.x - a.from.x)
      blitRotated(ctx, beamSlab(width, Math.floor(t * 20) % 2), a.x, a.y, angle)
      // Muzzle splash on the first segment.
      if ((a.x - a.from.x) ** 2 + (a.y - a.from.y) ** 2 < 15 ** 2) {
        const m = Math.round(width * 0.6)
        blitCentered(ctx, ellipse(m, m, '#a8d0f8'), a.from.x, a.from.y)
        blitCentered(ctx, ellipse(Math.round(m * 0.6), Math.round(m * 0.6), '#ffffff'), a.from.x, a.from.y)
      }
      return
    }
    case 'roots': {
      const sprite = ROOTS()[a.flip ? 1 : 0]!
      const scale = Math.max(1, Math.round(r / 7))
      const grow = Math.min(1, a.age / 0.08) * Math.min(1, (a.ttl - a.age) / 0.2)
      const rows = Math.round(sprite.height * grow)
      if (rows <= 0) return
      const w = sprite.width * scale
      ctx.drawImage(sprite, 0, 0, sprite.width, rows, Math.round(a.x - w / 2), Math.round(a.y + 2 - rows * scale), w, rows * scale)
      return
    }
    case 'nova': {
      const R = Math.round(r)
      ctx.globalAlpha = Math.max(0, 1 - a.age / a.ttl)
      pixelRing(ctx, a.x, a.y, R, 3, TYPE_COLORS[a.type])
      pixelRing(ctx, a.x, a.y, R - 4, 1, '#ffffff')
      pixelRing(ctx, a.x, a.y, Math.round(R * 0.7), 1, PALETTES[a.type][2])
      ctx.globalAlpha = 1
      return
    }
    case 'bolt':
      return drawBolt(ctx, a, t)
    case 'meteor':
      return drawMeteor(ctx, a)
    case 'orb':
      return drawOrb(ctx, a)
    case 'wave':
      return drawWave(ctx, a)
    case 'streak':
      return drawStreak(ctx, a)
    case 'slash':
      return drawSlash(ctx, a)
    case 'puddle': {
      // A bubble pops now and then on each patch.
      const phase = (t * 2 + a.id * 0.37) % 1
      if (phase > 0.35 || a.ttl - a.age < 0.4) return
      ctx.fillStyle = PALETTES[a.type][3]
      const bx = Math.round(a.x + ((a.id * 7) % 9) - 4)
      const by = Math.round(a.y - 1 - phase * 6)
      ctx.fillRect(bx, by, phase < 0.25 ? 1 : 2, 1)
      return
    }
  }
}

/** Ground aura: Aegislash's stance ring, and while charging a shrinking type-colored ring plus, for aimed specials, a dotted aim line. */
export const drawSpecialAura = (ctx: Ctx, g: Game, t: number) => {
  const s = g.player.special
  drawStanceRing(ctx, g, t)
  if (s.charge <= 0) return
  const p = g.player
  const r = gameSpecial(g)
  const { def } = r
  const k = s.charge / def.charge
  const color = TYPE_COLORS[def.type]
  pixelRing(ctx, p.x, p.y - 10, Math.round(8 + k * 20), 2, Math.floor(t * 24) % 2 ? color : '#ffffff')
  const reach = specialReach(g, r) * (1 - k * 0.5)
  ctx.fillStyle = color
  for (let d = 14; d < reach; d += 6) {
    if (Math.floor(d / 6 - t * 20) % 3 === 0) continue
    ctx.fillRect(Math.round(p.x + p.facing.x * d), Math.round(p.y - 8 + p.facing.y * d), 2, 2)
  }
}

/* ---------------- Icons ---------------- */

const FIRE = { 1: '#a82010', 2: '#e05018', 3: '#f8a030', 4: '#fff0a0' }
const BESPOKE_ICONS: Record<Exclude<SpecialId, FormSpecial>, () => PixelSprite> = {
  blastBurn: () =>
    outlined(fromStrings(
      ['.....1.....', '.1...21..1.', '.21.1321.2.', '..1123321..', '.112344321.', '12344443211', '.123444321.', '..1234321..', '.1.12321.1.', '.2..121..2.', '.....1.....'],
      FIRE,
    )),
  hydroCannon: () =>
    outlined(fromStrings(
      ['....11111...', '..112344411.', '.12344...41.', '12344.....1.', '1234........', '12341.......', '123341...11.', '1223341.1331', '.12223322221', '..1111111111'],
      { 1: '#2848b0', 2: '#6890f0', 3: '#a8d0f8', 4: '#ffffff' },
    )),
  frenzyPlant: () => ROOTS()[0]!,
  boomburst: () =>
    outlined(fromStrings(
      ['......1...', '...1...1..', '.1..1...1.', '121..1..1.', '1221.1..1.', '121..1..1.', '.1..1...1.', '...1...1..', '......1...'],
      { 1: '#f8f0d0', 2: '#a8a878' },
    ), '#383028'),
  solarBlade: () => outlined(slashSprite('grass')),
  closeCombat: () => outlined(slashSprite('fighting')),
  dragonRush: () => outlined(slashSprite('dragon')),
  braveBird: () => outlined(slashSprite('flying')),
  ironHead: () => outlined(slashSprite('steel')),
  stanceChange: STANCE_ART.shield,
  dragonFlare: () =>
    outlined(fromStrings(
      ['.....1.....', '.1...21..1.', '.21.1321.2.', '..1123321..', '.112344321.', '12344443211', '.123444321.', '..1234321..', '.1.12321.1.', '.2..121..2.', '.....1.....'],
      { 1: '#2028a0', 2: '#3870f0', 3: '#78c8f8', 4: '#e8f8ff' },
    )),
  voltTackle: () => outlined(slashSprite('electric')),
  waveCrash: () => outlined(slashSprite('water')),
  dragonClaw: () => outlined(slashSprite('dragon')),
  blazeKick: () => outlined(slashSprite('fire')),
  skyAttack: () => outlined(slashSprite('flying')),
  nightSlash: () => outlined(slashSprite('dark')),
  auraStorm: () =>
    outlined(fromStrings(
      ['1..2222..1', '.1233332.1', '.23344332.', '2344444432', '2344444432', '.23344332.', '1.233332.1', '1..2222..1'],
      { 1: PALETTES.fighting[2], 2: PALETTES.fighting[1], 3: PALETTES.fighting[2], 4: '#ffffff' },
    )),
}

export const specialIcon = (id: SpecialId) => toIconUrl(`special:${id}`, isForm(id) ? () => glyph(id) : BESPOKE_ICONS[id])
