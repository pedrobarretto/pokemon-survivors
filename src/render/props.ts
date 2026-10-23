import { blitCentered, blitEllipse, blitRing, canvasCache, fromStrings, type Palette, type PixelSprite } from '../engine/pixelart'
import type { BiomeId } from '../data/biomes'
import { REPEL_RADIUS } from '../data/consumables'
import type { ConsumableId } from '../game/consumables'
import { isAsleep } from '../game/status'
import type { Prop } from '../game/props'
import type { Game } from '../game/types'
import { art, itemArt, lazy } from './art'
import { drawJack } from './halloweenArt'
import { localPlayer } from '../game/players'

/**
 * Pixel art and drawing for item sources (props), consumables on the floor,
 * and their world effects (Zzz, Max Repel aura, Explosion flash).
 */

type Ctx = CanvasRenderingContext2D

/* ---------------- Consumables ---------------- */

const BOTTLE = ['..111..', '..121..', '..343..', '.34443.', '3544443', '3566663', '3544443', '3444443', '.33333.']
const bottle = (dark: string, liquid: string, light: string, label = '#f8f8f8', cap = '#606070'): Palette => ({
  1: cap, 2: '#c8c8d8', 3: dark, 4: liquid, 5: light, 6: label,
})

const CONSUMABLE_ART: Record<ConsumableId, readonly [readonly string[], Palette]> = {
  potion: [BOTTLE, bottle('#602890', '#a048d8', '#e0b0ff')],
  superPotion: [BOTTLE, bottle('#a04810', '#f89830', '#ffe0a0')],
  maxRepel: [BOTTLE, bottle('#206828', '#48b848', '#b0f0a0')],
  xAttack: [BOTTLE, bottle('#901818', '#e83838', '#ffa0a0', '#f8e030', '#f8e030')],
  xSpeed: [BOTTLE, bottle('#184890', '#3880f0', '#a8d0ff', '#f8e030', '#f8e030')],
  rareCandy: [['1..222..1', '132422231', '132222231', '132222231', '1..222..1'], { 1: '#2850a8', 2: '#4878e0', 3: '#78a8f8', 4: '#ffffff' }],
  expShare: [['.....1.', '.....1.', '1111111', '1222221', '1233321', '1233321', '1222221', '1111111'], { 1: '#383848', 2: '#e84848', 3: '#f0f0f8' }],
  pokeFlute: [['11111111111', '14444444441', '12232323221', '11111111111'], { 1: '#204890', 2: '#78b0f8', 3: '#102040', 4: '#c8e0ff' }],
  explosion: [
    ['..11111..', '.1611111.', '161111111', '114515411', '111111111', '222222222', '333333333', '.3333333.', '..33333..'],
    { 1: '#e83030', 2: '#802020', 3: '#f0f0f0', 4: '#ffffff', 5: '#181818', 6: '#f8a0a0' },
  ],
  revive: [['...1...', '..121..', '.12321.', '1233321', '.12321.', '..121..', '...1...'], { 1: '#c08800', 2: '#f8d030', 3: '#fff8c8' }],
}

const consumableSprites = canvasCache<ConsumableId, PixelSprite>()

export const consumableSprite = (id: ConsumableId) => {
  let sprite = consumableSprites.get(id)
  if (!sprite) consumableSprites.set(id, (sprite = art(...CONSUMABLE_ART[id], '#181818')))
  return sprite
}

export const consumableIcon = (id: ConsumableId) => itemArt(id)

/* ---------------- Props ---------------- */

const ITEM_BALL = [
  '...1111...', '.11222211.', '.12522221.', '1252222221', '1111331111',
  '1444334441', '1444444461', '.14444461.', '.11446611.', '...1111...',
]
const BERRY_TREE = [
  '....11111....', '..112222211..', '.12223222221.', '.12242222421.', '1222222232221', '1224222222421',
  '1222223222221', '.12422222241.', '.11222222211.', '...1115111...', '.....565.....', '.....565.....', '....55655....',
]
const GRASS_BASE = ['1221222112221', '1222222222221', '2222322223222', '2222222222222', '.22222222222.']
const GRASS_REST = ['.1...1....1..', '.12..21..121.', '121.1221.1221', ...GRASS_BASE]
const GRASS_RUSTLE = ['..1...1....1.', '..12..21..121', '.121.1221.122', ...GRASS_BASE]
/** Cave stand-ins: a cracked rock to smash instead of tall grass, a giant mushroom instead of a berry tree. */
const SMASH_ROCK = ['...11111...', '..1223321..', '.122233221.', '12224222321', '12242222221', '12222242221', '.111111111.']
const SMASH_ROCK_SHAKE = ['....11111..', '...1223321.', '..122233221', '.12224222321', '.12242222221', '.12222242221', '..111111111.']
const MUSHROOM = [
  '....111111....', '..1122222211..', '.122332222321.', '12223322222221', '12222222233221', '11111111111111',
  '....145541....', '....145541....', '....145541....', '...11455411...',
]

type PropSkin = { berryTree: PixelSprite; grass: readonly [PixelSprite, PixelSprite] }

const grass = (pal: Palette, outline: string) => [art(GRASS_REST, pal, outline), art(GRASS_RUSTLE, pal, outline)] as const
const tree = (leaves: string, mid: string, light: string, outline: string, trunk = '#604020', bark = '#a06838') =>
  art(BERRY_TREE, { 1: leaves, 2: mid, 3: light, 4: '#3870d8', 5: trunk, 6: bark }, outline)

/** Berry trees and tall grass dressed for each biome (item balls look the same everywhere). */
const PROP_SKINS = lazy((): Record<BiomeId, PropSkin> => ({
  meadow: { berryTree: tree('#205828', '#48a038', '#88d058', '#142c14'), grass: grass({ 1: '#2a6e34', 2: '#4f9e48', 3: '#78c060' }, '#1a4420') },
  forest: { berryTree: tree('#163c1c', '#2f7a30', '#58a040', '#0c200e'), grass: grass({ 1: '#1c4c24', 2: '#3a7a38', 3: '#5aa048' }, '#0e2a12') },
  cave: {
    berryTree: art(MUSHROOM, { 1: '#402818', 2: '#c04830', 3: '#f8e8d0', 4: '#c8b898', 5: '#e8d8c0' }, '#201410'),
    grass: [
      art(SMASH_ROCK, { 1: '#3c3028', 2: '#988870', 3: '#c8b8a0', 4: '#4a3e34' }, '#201810'),
      art(SMASH_ROCK_SHAKE, { 1: '#3c3028', 2: '#988870', 3: '#c8b8a0', 4: '#4a3e34' }, '#201810'),
    ],
  },
  snow: { berryTree: tree('#1c3c34', '#2f6a50', '#f0f8ff', '#102420'), grass: grass({ 1: '#587890', 2: '#98b8d0', 3: '#ffffff' }, '#304458') },
  tower: {
    berryTree: tree('#2c2038', '#584870', '#8070a0', '#160f1e', '#3c2c28', '#6c5048'),
    grass: grass({ 1: '#3c3448', 2: '#6c6080', 3: '#9890a8' }, '#1e1a28'),
  },
}))

const ITEM_BALL_ART = lazy(() =>
  fromStrings(ITEM_BALL, { 1: '#202028', 2: '#e83838', 3: '#ffffff', 4: '#f0f0f0', 5: '#f8a8a8', 6: '#b8b8c8' }),
)

const SPARKLE = lazy(() => fromStrings(['.1.', '121', '.1.'], { 1: '#fff8c0', 2: '#ffffff' }))

const drawProp = (ctx: Ctx, prop: Prop, t: number, skin: PropSkin) => {
  const wobble = prop.shake > 0 ? (Math.floor(prop.shake * 40) % 2 ? 1 : -1) : 0
  const x = prop.x + wobble
  switch (prop.kind) {
    case 'itemBall': {
      blitEllipse(ctx, 5, 1, 'rgba(16,40,16,0.3)', prop.x, prop.y)
      blitCentered(ctx, ITEM_BALL_ART(), x, prop.y - 5)
      if ((t + prop.id * 0.29) % 1.6 < 0.2) blitCentered(ctx, SPARKLE(), x - 3, prop.y - 8)
      return
    }
    case 'berryTree': {
      blitEllipse(ctx, 7, 2, 'rgba(16,40,16,0.3)', prop.x, prop.y)
      const s = skin.berryTree
      return ctx.drawImage(s, Math.round(x - s.width / 2), Math.round(prop.y - s.height + 1))
    }
    case 'tallGrass': {
      // Rustles in short bursts, like grass hiding a wild Pokémon.
      const rustling = prop.shake > 0 || (t + prop.id * 0.37) % 2.2 < 0.5
      const s = skin.grass[rustling && Math.floor(t * 10) % 2 ? 1 : 0]
      return ctx.drawImage(s, Math.round(x - s.width / 2), Math.round(prop.y - s.height + 1))
    }
    case 'pumpkin':
      return drawJack(ctx, x, prop.y, prop.id, t)
  }
}

const near = (g: Game, x: number, y: number, m = 32) =>
  x > g.camera.x - m && x < g.camera.x + g.view.w + m && y > g.camera.y - m && y < g.camera.y + g.view.h + m * 2

/** Ground layer: item sources, dressed for `biome`, and the Max Repel aura. */
export const drawProps = (ctx: Ctx, g: Game, t: number, biome: BiomeId) => {
  const skin = PROP_SKINS()[biome]
  for (const prop of g.props) if (near(g, prop.x, prop.y)) drawProp(ctx, prop, t, skin)

  const repel = localPlayer(g).buffs.find((b) => b.id === 'maxRepel')
  if (repel && (repel.left > 1.5 || Math.floor(t * 8) % 2 === 0)) {
    const p = localPlayer(g)
    ctx.globalAlpha = 0.7 + Math.sin(t * 6) * 0.2
    blitEllipse(ctx, REPEL_RADIUS, Math.round(REPEL_RADIUS * 0.5), 'rgba(88,216,120,0.3)', p.x, p.y)
    blitRing(ctx, REPEL_RADIUS - 4 + Math.round(Math.sin(t * 4) * 2), 1, '#b0f0a0', p.x, p.y - 8)
    ctx.globalAlpha = 1
  }
}

/** A consumable lying on the floor, with a twinkle so it stands out from Exp. Candies. */
export const drawConsumable = (ctx: Ctx, id: ConsumableId, x: number, y: number, seed: number, t: number) => {
  blitCentered(ctx, consumableSprite(id), x, y)
  if ((t * 1.3 + seed * 0.17) % 1 < 0.15) blitCentered(ctx, SPARKLE(), x + 4, y - 4)
}

/* ---------------- Effects ---------------- */

/** A big and a small "Z", floated over whoever sleeps. */
export const ZZZ = lazy(() => [
  art(['1111', '..1.', '.1..', '1111'], { 1: '#ffffff' }, '#283868'),
  art(['111', '.1.', '111'], { 1: '#c8d8ff' }, '#283868'),
])

/** Floating "Zzz" over every visible sleeping enemy (Poké Flute). */
export const drawSleep = (ctx: Ctx, g: Game, t: number) => {
  const [big, small] = ZZZ()
  for (const e of g.enemies) {
    if (e.dying >= 0 || !isAsleep(e.status) || !near(g, e.x, e.y, 0)) continue
    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.7 + e.id * 0.31 + k * 0.5) % 1
      ctx.globalAlpha = Math.min(1, (1 - ph) * 2)
      blitCentered(ctx, k ? small! : big!, e.x + e.radius + ph * 6 + Math.sin(ph * 6) * 2, e.y - e.radius * 2 - 2 - ph * 12)
    }
  }
  ctx.globalAlpha = 1
}

/** Full-screen white flash (Explosion). Drawn in screen space. */
export const drawFlash = (ctx: Ctx, g: Game) => {
  if (g.flash <= 0) return
  ctx.fillStyle = `rgba(255,255,255,${Math.min(1, g.flash).toFixed(2)})`
  ctx.fillRect(0, 0, g.view.w, g.view.h)
}
