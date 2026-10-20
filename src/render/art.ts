import { canvasCache, context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'
import type { Medal } from '../data/achievements'
import type { PlatformId } from '../data/creators'
import type { ItemId } from '../data/items'
import type { BagItem } from '../game/bag'
import type { SupporterTier } from '../game/supporters'
import type { EggTier } from '../game/eggs'
import type { Difficulty } from '../game/difficulty'
import type { RibbonTier } from '../game/ribbons'
import type { UpgradeId } from '../game/meta'
import type { MoveId } from '../game/moves'
import { EGG_MOVE_ICONS } from './eggMoveArt'
import { EGG_MOVE_3_ICONS } from './eggMove3Art'
import { EGG_MOVE_2_ICONS } from './eggMove2Art'
import { SIGNATURE_ICONS } from './signatureArt'
import { TM_ICONS } from './tmArt'
import { VERB_EVOLVED_ICONS } from './verbEvolvedArt'
import { cursedIcon, DUO_ICONS } from './duoArt'
import type { CurseId } from '../data/curses'
import type { SocialId } from '../site/routes'
import { LEGENDARY_ICONS } from './legendaryArt'
import * as TE from './typeEvolvedArt'

/**
 * All hand-authored pixel art (projectiles, pickups, icons). Sprites are built
 * lazily on first use because they need a DOM canvas.
 */

/** Adds a 1px outline around opaque pixels so small sprites read on grass. */
export const outlined = (sprite: PixelSprite, color = '#181818'): PixelSprite => {
  const canvas = createCanvas(sprite.width + 2, sprite.height + 2)
  const ctx = context2d(canvas)
  const sil = createCanvas(sprite.width, sprite.height)
  const sctx = context2d(sil)
  sctx.drawImage(sprite, 0, 0)
  sctx.globalCompositeOperation = 'source-in'
  sctx.fillStyle = color
  sctx.fillRect(0, 0, sil.width, sil.height)
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]] as const) ctx.drawImage(sil, dx, dy)
  ctx.drawImage(sprite, 1, 1)
  return canvas
}

export { lazy }

export const art = (rows: readonly string[], palette: Palette, outline?: string) => {
  const sprite = fromStrings(rows, palette)
  return outline ? outlined(sprite, outline) : sprite
}

/* ---------------- Projectiles ---------------- */

const FIREBALL = ['..1221..', '.123321.', '12344321', '23444432', '23444432', '12344321', '.123321.', '..1221..']
const FLAME = [
  '....1....', '...12....', '...121...', '..1221...', '..12321..', '.122321..',
  '.1233321.', '12334321.', '123443321', '123444321', '.1234321.', '..11111..',
]
const DROPLET = ['..11111..', '.1222221.', '122333421', '.1222221.', '..11111..']
const LEAF = ['......111', '....11221', '...122231', '..122321.', '.122321..', '.12321...', '1231.....', '131......', '11.......']
const STAR = ['....1....', '...121...', '111232111', '.1233321.', '..12321..', '..12121..', '.121.121.', '.11...11.']
/** Fist pointing right. */
const FIST = ['..1111..', '.122221.', '12333311', '12333331', '12333321', '.1222221', '..11111.']
const STEEL_ORB = ['..1111..', '.122221.', '12233221', '12344321', '12344321', '12233221', '.122221.', '..1111..']
/** Quill arrow pointing right. */
const ARROW = ['11.......2.', '.1333333322', '11.......2.']
const SHURIKEN = ['...1...', '...1...', '..121..', '1112111', '..121..', '...1...', '...1...']
/** Upper jaw; the lower one is the same rows reversed. */
const JAW = ['.111111111.', '12222222221', '13.3.3.3.31']
const ORB = ['..111..', '.12221.', '1223221', '1233321', '1223221', '.12221.', '..111..']
const HEART = ['.11.11.', '1221221', '1232221', '1222221', '.12221.', '..121..', '...1...']
/** Settings gear and help mark for the menus' top bar (`ui/shell.ts`): one ink color, holes see through to the button. */
const GEAR = ['....1111....', '.11.1111.11.', '.1111111111.', '..11111111..', '11111..11111', '1111....1111', '1111....1111', '11111..11111', '..11111111..', '.1111111111.', '.11.1111.11.', '....1111....']
const HELP = ['.111111.', '11111111', '111..111', '....1111', '...1111.', '..1111..', '..111...', '........', '..111...', '..111...']
const NOTE = ['...11.', '...121', '...1.1', '...1..', '.111..', '1221..', '.11...']
const BLADE = ['.......11', '.....1121', '...11231.', '.11231...', '1231.....', '11.......']

/* Evolved moves */
const FIRE_STAR = [
  '......1......', '.....121.....', '.....121.....', '....12321....', '1111233321111', '.12223432221.',
  '..122343221..', '...1234321...', '...1233321...', '..123212321..', '..1221.1221..', '.1221...1221.', '.111.....111.',
]
const JET = ['......1111111..', '...11122222221.', '.1122233333321.', '122333444443321', '.1122233333321.', '...11122222221.', '......1111111..']
const TRIANGLE = ['....1....', '...121...', '...121...', '..12321..', '..12321..', '.1233321.', '.1222221.', '111111111']
/* Lunges, chains, mines and turrets (`render/moveFx.ts`) */
/** Caltrop: 1 tips, 2 spikes, 3 core. */
const SPIKE = ['....1....', '...121...', '1..121..1', '.1123211.', '..12321..', '.1.121.1.', '1...1...1']
/** A cluster of barbs: 1 tips, 2 spikes, 3 core, 4 shine. */
const BARBS = [
  '1....1....1', '.1...2...1.', '..2.121.2..', '...12321...', '12223432221',
  '...12321...', '..2.121.2..', '.1...2...1.', '1....1....1',
]
/** Ghost flame: 1 rim, 2 body, 3 glow, 4 core. */
const WISP = [
  '......1....', '.....12....', '....121....', '...12321...', '..1223221..', '..1233321..', '.122343221.',
  '.123444321.', '12334443321', '12344444321', '12334443321', '.123333321.', '..1222221..', '...11111...',
]
const WISP_SHOT = ['.111.', '12321', '13431', '12321', '.111.']
/** Speed streak pointing right: 1 trail, 2-4 lighter towards the tip. */
const QUICK = ['......1111.', '11...122221', '....1233321', '111.1234321', '....1233321', '11...122221', '......1111.']
/** Two targets (3) joined by a jagged arc (2). */
const CHAIN = ['33........', '332.......', '..2.......', '..2222....', '.....2....', '.....2222.', '........33', '........33']

/* Gen 3 type moves (`render/draw.ts`, `render/evolved.ts`) */
/** Ice shard pointing right: 1 edge, 2 ice, 3 light, 4 shine. */
const ICE_SHARD = ['..11.....', '.12211...', '1233321..', '123444321', '1233321..', '.12211...', '..11.....']
/** Three crystals stuck in the ground (a shard that stopped). */
const ICICLES = [
  '....1....', '...141...', '.1.131...', '141131.1.', '131131141', '131232131', '123222321', '.1111111.',
]
/** Boulder: 1 rim, 2 stone, 3 light, 4 shade. */
const BOULDER = [
  '...11111....', '..1233321...', '.123332221..', '12333222221.', '123322222241',
  '122222222441', '122222224441', '.1222244441.', '..11111111..',
]
/** Jagged stone pillar, drawn rising out of the ground. */
const PILLAR = [
  '...1...', '...1...', '..131..', '..131..', '..1321.', '.13321.', '.13221.',
  '.132221', '1332221', '1322241', '1322441', '1222441', '1224441', '1111111',
]
/** Needle pointing right: 1 fletching, 2 shaft, 3 tip. */
const NEEDLE = ['11......', '.1222223', '11......']
/** Horn pointing right. */
const HORN = ['111..........', '1221111......', '.1222221111..', '.123333333441', '.1222221111..', '1221111......', '111..........']
/** Gunk Shot's heap of garbage: 1 rim, 2 sludge, 3 shine, 4 slime, 5 junk. */
const TRASH = [
  '.....1111.....', '...11222211...', '..1223322221..', '.122332225221.', '.123222225521.', '12222442222221',
  '12224444222321', '12222442222221', '.122222224421.', '.112222244211.', '...11111111...',
]
/** Blizzard's falling icicle, point down: 1 edge, 2 ice, 3 light, 4 shine. */
const ICICLE = ['.11111.', '1233321', '1234321', '1234321', '.12421.', '.12421.', '.12321.', '..121..', '..121..', '..121..', '...1...', '...1...']
const SNOWFLAKE = ['....1....', '.1..1..1.', '..1.1.1..', '...121...', '111222111', '...121...', '..1.1.1..', '.1..1..1.', '....1....']

const ICE = { 1: '#3878a8', 2: '#98d8f8', 3: '#d8f0ff', 4: '#ffffff' }
const STONE = { 1: '#3a2a18', 2: '#a08048', 3: '#d8c080', 4: '#685028' }
const DRAGON_CONE = { 1: '#2a1070', 2: '#7038f8', 3: '#a070f8', 4: '#f0e0ff' }

const TRI_PALETTES: readonly Palette[] = [
  { 1: '#a02010', 2: '#f06020', 3: '#ffd080' },
  { 1: '#2060a0', 2: '#60c0f0', 3: '#e0f8ff' },
  { 1: '#a07800', 2: '#f8d830', 3: '#fff8c0' },
]

export const FX = {
  ember: lazy(() => [
    art(FIREBALL, { 1: '#a82010', 2: '#e05018', 3: '#f8a030', 4: '#fff0a0' }),
    art(FIREBALL, { 1: '#c03018', 2: '#f07020', 3: '#f8c040', 4: '#ffffff' }),
  ]),
  flame: lazy(() => {
    const pal = { 1: '#c03018', 2: '#f07020', 3: '#f8b830', 4: '#fff8c0' }
    return [fromStrings(FLAME, pal), fromStrings(FLAME, pal, { mirror: true })]
  }),
  /** Mega Charizard X's blue dragon fire (Dragon Flare). */
  dragonFlame: lazy(() => {
    const pal = { 1: '#2830a0', 2: '#3870f0', 3: '#78c8f8', 4: '#e8f8ff' }
    return [fromStrings(FLAME, pal), fromStrings(FLAME, pal, { mirror: true })]
  }),
  water: lazy(() => art(DROPLET, { 1: '#2848b0', 2: '#6890f0', 3: '#a8d0f8', 4: '#ffffff' })),
  leaf: lazy(() => art(LEAF, { 1: '#285820', 2: '#58b838', 3: '#a8e870' })),
  star: lazy(() => art(STAR, { 1: '#c88800', 2: '#f8d830', 3: '#fff8c0' })),
  fireBlast: lazy(() => [
    art(FIRE_STAR, { 1: '#a01810', 2: '#e85018', 3: '#f8b030', 4: '#fff8d0' }, '#401008'),
    art(FIRE_STAR, { 1: '#c03018', 2: '#f87828', 3: '#f8d050', 4: '#ffffff' }, '#401008'),
  ]),
  hydroPump: lazy(() => art(JET, { 1: '#1838a0', 2: '#4878e8', 3: '#a8d8f8', 4: '#ffffff' }, '#102060')),
  leafStorm: lazy(() => art(LEAF, { 1: '#205018', 2: '#70d048', 3: '#e0f8a0' }, '#103010')),
  triAttack: lazy(() => TRI_PALETTES.map((pal) => art(TRIANGLE, pal, '#181818'))),
  fist: lazy(() => art(FIST, { 1: '#601818', 2: '#c03028', 3: '#f89070' }, '#281010')),
  steel: lazy(() => art(STEEL_ORB, { 1: '#404858', 2: '#8890a8', 3: '#c8d0e0', 4: '#ffffff' })),
  arrow: lazy(() => art(ARROW, { 1: '#58b838', 2: '#a070d8', 3: '#e8e0c8' }, '#281838')),
  shuriken: lazy(() => art(SHURIKEN, { 1: '#3068d0', 2: '#d0f0ff' }, '#183060')),
  jaws: lazy(() => {
    const pal = { 1: '#281820', 2: '#705848', 3: '#ffffff' }
    return { top: art(JAW, pal), bottom: art([...JAW].reverse(), pal) }
  }),
  pyro: lazy(() => art(FIREBALL, { 1: '#a82010', 2: '#f07020', 3: '#f8c040', 4: '#ffffff' }, '#401008')),
  psy: lazy(() => [
    art(ORB, { 1: '#a03068', 2: '#f85888', 3: '#ffd0e8' }),
    art(ORB, { 1: '#c04080', 2: '#f888b0', 3: '#ffffff' }),
  ]),
  heart: lazy(() => art(HEART, { 1: '#a02858', 2: '#f878a8', 3: '#ffffff' }, '#401020')),
  note: lazy(() => art(NOTE, { 1: '#c03018', 2: '#f8b030' }, '#401008')),
  blade: lazy(() => art(BLADE, { 1: '#286020', 2: '#78d850', 3: '#f0fff0' }, '#183010')),
  /** Leaf Blade's critical swing. */
  critBlade: lazy(() => art(BLADE, { 1: '#806010', 2: '#f8d030', 3: '#ffffff' }, '#302008')),
  spikes: lazy(() => art(SPIKE, { 1: '#e0b8f0', 2: '#a040c0', 3: '#502060' }, '#201028')),
  barbs: lazy(() => art(BARBS, { 1: '#f0d8f8', 2: '#b058d0', 3: '#6a2a88', 4: '#88c040' }, '#201028')),
  wisp: lazy(() => {
    const pal = { 1: '#3040a0', 2: '#5870e8', 3: '#a8c0ff', 4: '#ffffff' }
    return [outlined(fromStrings(WISP, pal), '#181838'), outlined(fromStrings(WISP, pal, { mirror: true }), '#181838')]
  }),
  wispShot: lazy(() => art(WISP_SHOT, { 1: '#3040a0', 2: '#78a0f8', 3: '#c8d8ff', 4: '#ffffff' })),
  inferno: lazy(() => {
    const pal = { 1: '#801008', 2: '#e03010', 3: '#f88020', 4: '#fff0a0' }
    return [outlined(fromStrings(FLAME, pal), '#300808'), outlined(fromStrings(FLAME, pal, { mirror: true }), '#300808')]
  }),
  iceShard: lazy(() => art(ICE_SHARD, ICE, '#183048')),
  icicles: lazy(() => art(ICICLES, ICE, '#183048')),
  /** Blizzard's shards: whiter, with a frosty outline. */
  blizzardShard: lazy(() => art(ICE_SHARD, { 1: '#78b8e8', 2: '#d8f0ff', 3: '#ffffff', 4: '#ffffff' }, '#3878a8')),
  blizzardIcicles: lazy(() => art(ICICLES, { 1: '#5898c8', 2: '#c8e8ff', 3: '#ffffff', 4: '#ffffff' }, '#183048')),
  boulder: lazy(() => art(BOULDER, STONE, '#181008')),
  pillar: lazy(() => art(PILLAR, STONE, '#181008')),
  pin: lazy(() => art(NEEDLE, { 1: '#587018', 2: '#d8f070', 3: '#ffffff' }, '#203008')),
  horn: lazy(() => art(HORN, { 1: '#585870', 2: '#c8c8d8', 3: '#e8e8f0', 4: '#ffffff' }, '#202030')),
  snowflake: lazy(() => art(SNOWFLAKE, { 1: '#98d8f8', 2: '#ffffff' }, '#183048')),
  gunkBomb: lazy(() => art(TRASH, { 1: '#281830', 2: '#6a3a78', 3: '#b878c8', 4: '#88a038', 5: '#e0e0c8' }, '#100810')),
  icicle: lazy(() => art(ICICLE, { 1: '#5898c8', 2: '#c8e8ff', 3: '#ffffff', 4: '#ffffff' }, '#183048')),
  /** Leaf Storm's second leaf color, so the storm reads as many leaves. */
  leafStormGold: lazy(() => art(LEAF, { 1: '#506010', 2: '#b8d038', 3: '#f8f8b0' }, '#203008')),
}

/* ---------------- Verb moves (`render/verbFx.ts`) ---------------- */

/** A small flame licking up from the ground: 1 rim, 2 flame, 3 light, 4 core. */
const FLAME_LICK = ['...1...', '..12...', '..121..', '.1221..', '.12321.', '1233321', '1234321', '1233321', '.11111.']
/** A ring of fire (Flame Wheel's icon). */
const FIRE_RING = [
  '....1111....', '..11222211..', '.1233333321.', '.123....421.', '123......321', '12........21',
  '12........21', '123......321', '.124....321.', '.1233333321.', '..11222211..', '....1111....',
]
/** The sun gathering into a beam (Solar Beam's icon): 1 rays, 2 leaf green, 3 light, 4 white. */
const SUN_BEAM = [
  '.1..1........', '..1222.......', '1.233321.....', '.23444322222.', '1234444333333',
  '.23444322222.', '1.233321.....', '..1222.......', '.1..1........',
]
/** A ball of brine: 1 rim, 2 sea, 3 light, 4 salt shine. */
const BRINE_BALL = ['..111..', '.12321.', '1234321', '1233421', '1223321', '.12221.', '..111..']
/** Brine's icon: the ball with salt crystals flying off. */
const BRINE_ICON = ['.......5..', '..111.555.', '.12321.5..', '1234321...', '1233421.5.', '1223321...', '.12221..5.', '..111.....']
/** Electro Ball: 1 rim, 2 yellow, 3 light, 4 white, 5 the bolt across it. */
const ELECTRO = ['..11111..', '.1222221.', '122235221', '122355321', '123553321', '123533221', '122532221', '.1222221.', '..11111..']
/** Venoshock's glob, dripping: 1 rim, 2 poison, 3 light, 4 toxic glint. */
const GLOB = ['...111...', '..12221..', '.1233221.', '123342221', '123422221', '122222221', '.1222221.', '..11211..', '...1.1...']
/** Self-Destruct's icon: a blast star. 1 red, 2 orange, 3 yellow, 4 white. */
const BLAST = [
  '.....1.....', '.1...1...1.', '..1.121.1..', '...12321...', '.112343211.', '11234443211',
  '.112343211.', '...12321...', '..1.121.1..', '.1...1...1.', '.....1.....',
]
/** A feather: 1 rim, 2 vane, 3 shine, 4 quill. */
const FEATHER = ['..1..', '.121.', '12321', '12321', '12321', '.121.', '.141.', '..4..', '..4..']
/** Sucker Punch's shadow fist pointing right. */
const SHADOW_FIST = ['..1111..', '.122221.', '12333311', '12333331', '12333321', '.1222221', '..11111.']
/** Future Sight's eye: 1 rim, 2 iris ring, 3 glow, 4 pupil. */
const EYE = ['...11111...', '.112222211.', '12223332221', '12233433221', '12223332221', '.112222211.', '...11111...']
/** A bone: 1 rim, 2 bone, 3 shine. */
const BONE = ['.11.......11.', '1321111111231', '.12222222221.', '1221111111221', '.11.......11.']
/** A floating pointed stone (Stealth Rock): 1 rim, 2 stone, 3 light, 4 shade. */
const POINTED_STONE = ['....1....', '...131...', '...1321..', '..133221.', '..132221.', '.13322241', '132222441', '.1222441.', '..12441..', '...141...', '....1....']
/** U-turn's icon: down, around and back up. */
const U_ARROW = ['.1.....1..', '121...121.', '121..12221', '121....2..', '121....2..', '.121..21..', '..1222...'.padEnd(10, '.'), '...111....']
/** Dragon Tail's icon: a scaled tail curling into a spade tip. */
const TAIL_ICON = [
  '.........11', '........121', '.......1231', '..111..1221', '.12221.121.', '1233221221.',
  '1231.12221.', '121...111..', '.1.........',
]
/** Sheer Cold's icon: a crystal in a ring of frost. */
const CRYSTAL = ['....1....', '...121...', '..12321..', '.1234321.', '123444321', '.1234321.', '..12321..', '...121...', '....1....']
const FROST_RING = [
  '...1.1.1...', '.1.......1.', '...........', '1.........1', '...........', '1.........1',
  '...........', '1.........1', '...........', '.1.......1.', '...1.1.1...',
]

const FIRE = { 1: '#a82010', 2: '#e85818', 3: '#f8b030', 4: '#fff4b0' }
const GRASS_SUN = { 1: '#f8e070', 2: '#58b838', 3: '#c8f088', 4: '#ffffff' }
const BRINE_SEA = { 1: '#183878', 2: '#3868c8', 3: '#88b8f0', 4: '#ffffff', 5: '#ffffff' }
const ELECTRIC = { 1: '#906800', 2: '#f8d030', 3: '#fff8a0', 4: '#ffffff', 5: '#ffffff' }
const POISON = { 1: '#381040', 2: '#9038a0', 3: '#d080e0', 4: '#b8f060' }
const SHADOW = { 1: '#100810', 2: '#382838', 3: '#6a5068' }
const PSYCHIC = { 1: '#801850', 2: '#f85888', 3: '#ffd0e8', 4: '#300818' }
const BONE_WHITE = { 1: '#584830', 2: '#e8e0c8', 3: '#ffffff' }
const STONE_GREY = { 1: '#282420', 2: '#a09888', 3: '#ece4d4', 4: '#666058' }
const BUG = { 1: '#506010', 2: '#a8b820', 3: '#e0f080' }
const DRAGON = { 1: '#200868', 2: '#7038f8', 3: '#b898ff' }

/**
 * A steel gear, `teeth` square teeth around a body with a hub, rotated by `turn`
 * (radians): authored as pixel rows from its shape, so every frame stays crisp.
 * 1 rim, 2 steel, 3 shine (top left), 4 hole, 5 hub.
 */
const gearRows = (size: number, teeth: number, turn: number) => {
  const c = (size - 1) / 2
  const inside = (x: number, y: number) => {
    const d = Math.hypot(x - c, y - c)
    const seg = ((((Math.atan2(y - c, x - c) + turn) / (Math.PI * 2)) * teeth) % 1 + 1) % 1
    return d <= c * 0.7 || (d <= c + 0.4 && seg < 0.45)
  }
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      if (!inside(x, y)) return '.'
      const d = Math.hypot(x - c, y - c)
      if (d < c * 0.2) return '4'
      if (d < c * 0.38) return '5'
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) return '1'
      return x + y < 2 * c - c * 0.5 ? '3' : '2'
    }).join(''),
  )
}

export const VERB_FX = {
  flameLick: lazy(() => [art(FLAME_LICK, FIRE), fromStrings(FLAME_LICK, FIRE, { mirror: true })]),
  brine: lazy(() => art(BRINE_BALL, BRINE_SEA, '#0c1c40')),
  electro: lazy(() => art(ELECTRO, ELECTRIC, '#403000')),
  glob: lazy(() => art(GLOB, POISON, '#200818')),
  feather: lazy(() => art(FEATHER, { 1: '#6858b0', 2: '#e8e0f8', 3: '#ffffff', 4: '#a890f0' })),
  /** Focus Punch's fist: Mach Punch's, hotter, with a glowing rim (drawn ×2). */
  bigFist: lazy(() => art(FIST, { 1: '#701810', 2: '#e04030', 3: '#ffa080' }, '#fff0a0')),
  shadowFist: lazy(() => art(SHADOW_FIST, SHADOW, '#e8e0f0')),
  eye: lazy(() => art(EYE, PSYCHIC, '#200818')),
  bone: lazy(() => art(BONE, BONE_WHITE, '#201810')),
  stones: lazy(() => [art(POINTED_STONE, STONE_GREY, '#181008'), outlined(fromStrings(POINTED_STONE, STONE_GREY, { mirror: true }), '#181008')]),
  /** Four turns of the gear (an eighth of a tooth apart each). */
  gear: lazy(() => [0, 1, 2, 3].map((k) => art(gearRows(15, 8, (k * Math.PI) / 16), { 1: '#505068', 2: '#a0a0b8', 3: '#e0e0f0', 4: '#181820', 5: '#707088' }, '#101018'))),
  crystal: lazy(() => art(CRYSTAL, ICE, '#183048')),
}

/* ---------------- Eggs ---------------- */

/** 1 shade, 2 shell, 3 shine, 4 spots. */
const EGG = [
  '....2222....',
  '...222222...',
  '..23222222..',
  '..32224422..',
  '.2222244422.',
  '.2222224421.',
  '.4422222221.',
  '244422222221',
  '244222222221',
  '222222224421',
  '222222244421',
  '122222224211',
  '.1222222211.',
  '..11111111..',
]
/** The crack that splits the shell, revealed from the middle out as hatching goes on. */
const EGG_CRACK = ['', '', '', '', '1...1...1...', '.1.1.1.1.1.1', '..1...1...1.']

const EGG_PALETTES = {
  common: { 1: '#c8b890', 2: '#f8f0d8', 3: '#ffffff', 4: '#58b858' },
  rare: { 1: '#c8b890', 2: '#f8f0d8', 3: '#ffffff', 4: '#4888e8' },
  ultra: { 1: '#282840', 2: '#45456a', 3: '#9090c0', 4: '#f8c830' },
  friend: { 1: '#d888a0', 2: '#f8d0dc', 3: '#ffffff', 4: '#e84870' },
} as const satisfies Record<EggTier, Palette>

const CRACK_COLORS = { common: '#584830', rare: '#584830', ultra: '#f8f0c0', friend: '#803048' } as const satisfies Record<EggTier, string>

/** Memoized sprite per key (one per tier and crack stage). */
const eggCache = canvasCache<string, PixelSprite>()
const toSprite = (key: string, build: () => PixelSprite) => {
  let s = eggCache.get(key)
  if (!s) eggCache.set(key, (s = build()))
  return s
}

export const eggSprite = (tier: EggTier) => toSprite(`egg:${tier}`, () => art(EGG, EGG_PALETTES[tier], '#181818'))

/**
 * Crack overlay for `stage` 1..3, aligned with `eggSprite` (outline included):
 * each stage opens the crack two pixels further from the middle.
 */
export const eggCrack = (tier: EggTier, stage: number) =>
  toSprite(`crack:${tier}:${stage}`, () => {
    const half = stage * 2
    const rows = EGG_CRACK.map((row) => [...row.padEnd(12, '.')].map((c, x) => (Math.abs(x - 5.5) < half ? c : '.')).join(''))
    const canvas = createCanvas(14, 16)
    context2d(canvas).drawImage(fromStrings(rows, { 1: CRACK_COLORS[tier] }), 1, 1)
    return canvas
  })

export const eggIcon = (tier: EggTier) => toIconUrl(`egg:${tier}`, () => eggSprite(tier))

/* ---------------- Shiny sparkles ---------------- */

/** Classic shiny twinkle: a four-point star in three sizes (small → big). */
const SPARKLES = [
  ['.1.', '121', '.1.'],
  ['..1..', '..1..', '11211', '..1..', '..1..'],
  ['...1...', '...1...', '..121..', '1122211', '..121..', '...1...', '...1...'],
] as const

export const SPARKLE = lazy(() => SPARKLES.map((rows) => fromStrings(rows, { 1: '#f8e070', 2: '#ffffff' })))

/* ---------------- Lobby emotes (render/titleScene.ts) ---------------- */

/** A speech bubble with its tail at the bottom; the 7×7 icon goes at (2, 2). */
const BUBBLE = [
  '..1111111..', '.122222221.', '12222222221', '12222222221', '12222222221', '12222222221', '12222222221',
  '12222222221', '12222222221', '.122222221.', '..1112111..', '....121....', '.....1.....',
]
const EMOTE_ICONS = {
  heart: { rows: ['.11.11.', '1211111', '1111111', '1111111', '.11111.', '..111..', '...1...'], palette: { 1: '#e83850', 2: '#ffb8c8' } },
  note: { rows: ['...11..', '...1.1.', '...1..1', '...1...', '.111...', '1111...', '.11....'], palette: { 1: '#3868d0' } },
  bang: { rows: ['..111..', '..111..', '..111..', '...1...', '.......', '..111..', '..111..'], palette: { 1: '#e83838' } },
  sparkle: { rows: SPARKLES[2], palette: { 1: '#e8a800', 2: '#f8e070' } },
} as const satisfies Record<string, { rows: readonly string[]; palette: Palette }>

export type Emote = keyof typeof EMOTE_ICONS

/** PMD-style emote bubbles the lobby's Pokémon pop over their heads when they meet. */
export const EMOTES = lazy(() => {
  const build = (icon: (typeof EMOTE_ICONS)[Emote]) => {
    const sprite = fromStrings(BUBBLE, { 1: '#283040', 2: '#f8f8f8' })
    context2d(sprite).drawImage(fromStrings(icon.rows, icon.palette), 2, 2)
    return sprite
  }
  const { heart, note, bang, sparkle } = EMOTE_ICONS
  return { heart: build(heart), note: build(note), bang: build(bang), sparkle: build(sparkle) } satisfies Record<Emote, PixelSprite>
})

/* ---------------- Boss hazards ---------------- */

const SHARD = ['....11.', '..1221.', '1123331', '..1221.', '....11.']
const SMALL_ORB = ['.111.', '12221', '12321', '12221', '.111.']
const ROCK = ['..1111..', '.122221.', '12233221', '12232221', '12222211', '.112211.', '..1111..']
/** A pointed shard standing in the ground: Stealth Rock and Toxic Spikes (world hazards). */
const GROUND_SPIKE = ['..1..', '.131.', '.121.', '12321', '12221', '11111']

export const HAZARD_FX = {
  ice: lazy(() => art(SHARD, { 1: '#3878a8', 2: '#98d8f8', 3: '#ffffff' }, '#183048')),
  /** A leaf blade, flown point first like the ice shard. */
  grass: lazy(() => art(SHARD, { 1: '#286820', 2: '#70d048', 3: '#e0f8a0' }, '#103010')),
  psychic: lazy(() => art(SMALL_ORB, { 1: '#a02868', 2: '#f85888', 3: '#ffffff' }, '#401030')),
  rock: lazy(() => art(ROCK, { 1: '#584020', 2: '#a08040', 3: '#d8c080' }, '#181818')),
  water: lazy(() => art(SMALL_ORB, { 1: '#2858b8', 2: '#58a8f8', 3: '#e0f8ff' }, '#102048')),
  dragon: lazy(() => art(SMALL_ORB, { 1: '#4820a8', 2: '#a070f8', 3: '#f0e0ff' }, '#180840')),
  steel: lazy(() => art(SMALL_ORB, { 1: '#4868a8', 2: '#a8c8f0', 3: '#ffffff' }, '#182040')),
  aero: lazy(() => art(SMALL_ORB, { 1: '#7890c0', 2: '#d8e8f8', 3: '#ffffff' }, '#283858')),
  judgment: lazy(() => art(SMALL_ORB, { 1: '#c09020', 2: '#f8e070', 3: '#ffffff' }, '#483008')),
  stealthRock: lazy(() => art(GROUND_SPIKE, { 1: '#584020', 2: '#a08040', 3: '#e0c880' }, '#181818')),
  toxicSpike: lazy(() => art(GROUND_SPIKE, { 1: '#502068', 2: '#a050c8', 3: '#e8b0f8' }, '#200828')),
}

/* ---------------- The horde's spit (`game/spitters.ts`) ---------------- */

/** A small fireball pointing right, its tail behind: flown head first. */
const SPIT_FIREBALL = ['....1111.', '..1122331', '112233441', '..1122331', '....1111.']
/** 3 is the see-through inside of the bubble. */
const SPIT_BUBBLE = ['..111..', '.13331.', '1323331', '1333331', '1333331', '.13331.', '..111..']
const SPIT_SLUDGE = ['..111..', '.12221.', '1223221', '1222221', '.12221.', '..1.1..']
/** A thin zigzag bolt pointing right. */
const SPIT_SPARK = ['..11...11', '.1..1.1..', '1....1...']
const SPIT_SEED = ['.11..', '12231', '.111.']

export const SPIT_FX = {
  fireball: lazy(() => art(SPIT_FIREBALL, { 1: '#a82010', 2: '#f07020', 3: '#f8c040', 4: '#ffffff' }, '#401008')),
  bubble: lazy(() => art(SPIT_BUBBLE, { 1: '#58a8f8', 2: '#ffffff', 3: 'rgba(168,216,248,0.45)' }, '#183870')),
  sludge: lazy(() => art(SPIT_SLUDGE, { 1: '#502060', 2: '#a040a0', 3: '#e0a0f0' }, '#200820')),
  /** Two frames: the bolt flickers between yellow and white. */
  spark: lazy(() => [art(SPIT_SPARK, { 1: '#f8e030' }, '#504010'), art(SPIT_SPARK, { 1: '#ffffff' }, '#a08010')]),
  seed: lazy(() => art(SPIT_SEED, { 1: '#a07838', 2: '#e0c068', 3: '#fff0b0' }, '#281808')),
  orb: lazy(() => art(SMALL_ORB, { 1: '#9898a8', 2: '#e8e8f0', 3: '#ffffff' }, '#383848')),
}

/** The rim every hostile shot wears (the horde's spit, the bosses' and the world's shots). */
const HOSTILE_RIM = '#f81838'
const rimmed = new WeakMap<PixelSprite, PixelSprite>()

/**
 * `sprite` with a 1 px red rim around its opaque pixels (outside its own dark
 * outline), so enemy shots read against the player's effects on a busy screen.
 * Built once per sprite: a frame only looks it up. Hard-edged, as the rim
 * comes from the pixels themselves (a see-through bubble isn't tinted inside).
 */
export const hostile = (sprite: PixelSprite): PixelSprite => {
  const cached = rimmed.get(sprite)
  if (cached) return cached
  const w = sprite.width + 2
  const h = sprite.height + 2
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  ctx.drawImage(sprite, 1, 1)
  const { data } = ctx.getImageData(0, 0, w, h)
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3]! > 0
  ctx.fillStyle = HOSTILE_RIM
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) ctx.fillRect(x, y, 1, 1)
    }
  }
  rimmed.set(sprite, canvas)
  return canvas
}

/* ---------------- Enemy traits ---------------- */

const PLUS = ['..1..', '..1..', '11211', '..1..', '..1..']
/** "!" over an enemy about to strike (fuse lit, beam aiming, leap crouch). */
const ALERT = ['22', '22', '22', '22', '33', '..', '22', '33']
/** Beam cross-sections, one pixel long: stretched along the beam's length when drawn. */
const BEAM = ['1', '2', '2', '3', '3', '3', '2', '2', '1']
const BEAM_TELEGRAPH = ['1', '2', '2', '2', '2', '2', '1']

const beams = canvasCache<string, PixelSprite>()

export const TRAIT_FX = {
  healCross: lazy(() => art(PLUS, { 1: '#58d858', 2: '#ffffff' }, '#184818')),
  alert: lazy(() => art(ALERT, { 2: '#f8e040', 3: '#e07020' }, '#401808')),
  /** Two frames: the edges alternate colors as the telegraph blinks. */
  beamTelegraph: lazy(() => [
    fromStrings(BEAM_TELEGRAPH, { 1: '#f84830', 2: 'rgba(248,72,48,0.32)' }),
    fromStrings(BEAM_TELEGRAPH, { 1: '#f8e040', 2: 'rgba(248,224,64,0.28)' }),
  ]),
  /** The beam itself, colored by the shooter's type (cached per color). */
  beam: (color: string) => {
    let sprite = beams.get(color)
    if (!sprite) beams.set(color, (sprite = fromStrings(BEAM, { 1: '#282018', 2: color, 3: '#ffffff' })))
    return sprite
  },
}

/* ---------------- Pickups ---------------- */

const CANDY = ['..111..', '1122211', '.12321.', '1122211', '..111..']
const CANDY_TIERS: readonly Palette[] = [
  { 1: '#2850a8', 2: '#58a0f8', 3: '#e0f0ff' },
  { 1: '#207830', 2: '#58d058', 3: '#e0ffe0' },
  { 1: '#a83010', 2: '#f87830', 3: '#fff0c0' },
  { 1: '#602890', 2: '#b058e8', 3: '#f8e0ff' },
]
const BERRY = ['....22..', '...22...', '.111111.', '11133111', '11131111', '11111111', '.111111.', '..1111..']
const POKEBALL = ['..1111..', '.125221.', '12222221', '11144111', '13344331', '13333331', '.133331.', '..1111..']

/** Poké Dollar tiers: single coin (₽10), coin stack (₽50), money bag (₽250). */
const COIN = ['.1111.', '123321', '132221', '122221', '122211', '.1111.']
const COIN_STACK = ['.11111.', '1233321', '.11111.', '1222221', '.11111.', '1222221', '.11111.']
const MONEY_BAG = ['.1....1.', '..1111..', '..1221..', '.122221.', '12233221', '12322321', '12233221', '12223221', '.122221.', '..1111..']
const GOLD = { 1: '#a86000', 2: '#f8c830', 3: '#fff8b0' }

export const PICKUPS = {
  coins: lazy(() => [
    art(COIN, GOLD, '#181818'),
    art(COIN_STACK, GOLD, '#181818'),
    art(MONEY_BAG, { 1: '#583010', 2: '#c88848', 3: '#f8d030' }, '#181818'),
  ]),
  candy: lazy(() => CANDY_TIERS.map((pal) => art(CANDY, pal, '#181818'))),
  berry: lazy(() => art(BERRY, { 1: '#3870d8', 2: '#48a838', 3: '#b8d8ff' }, '#181818')),
  pokeball: lazy(() => art(POKEBALL, { 1: '#202028', 2: '#e83838', 3: '#f0f0f0', 4: '#ffffff', 5: '#f8a0a0' }, '#181818')),
}

/* ---------------- Icons (HUD / level-up) ---------------- */

const BOLT = ['...111.', '..121..', '.121...', '1222221', '...121.', '..121..', '.11....']
const SPIRAL = ['.1111...', '1....1..', '1.11..1.', '1.1.1.1.', '1.1..1.1', '1..11..1', '.1....1.', '..1111..']
const VINE = ['.....11.', '....1221', '..11.11.', '.12.....', '.1......', '.12.....', '..121...', '....11..']
const BLOB = ['...11...', '..1221..', '.122221.', '12232221', '12222221', '.122221.', '..1111..']
const WIND = ['.1111...', '1....1..', '.....1..', '11111...', '........', '1111111.', '.......1', '.....11.']
const CRACK = ['22222222', '21222212', '22122122', '22211222', '22212112', '22122221', '21222211', '22222222']
const DRUM = ['.111111.', '12222221', '13333331', '13131331', '13333331', '13313131', '13333331', '.111111.']
const SHELL = ['...11...', '..1221..', '.122221.', '12323231', '12323231', '.111111.']

const CONE = ['......1111', '...1112221', '1112233321', '1223344321', '1112233321', '...1112221', '......1111']
const WAVE = ['...11111..', '..1222221.', '.12233.121', '.1231...1.', '1223......', '12231...11', '1222311121', '.11111111.']
const TORNADO = ['1111111111', '.12222221.', '..111111..', '..1222221.', '...11111..', '...12221..', '....111...', '....121...', '.....1....']
const GUNK = ['...111....', '..12221.1.', '.1224221121', '12222222221', '12232242221', '1222222221', '.11111111.']

/** Layers several sprites on one canvas (cluster icons like Leaf Storm). */
const compose = (w: number, h: number, layers: ReadonlyArray<readonly [PixelSprite, number, number]>) => {
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  for (const [sprite, x, y] of layers) ctx.drawImage(sprite, x, y)
  return canvas
}

const MOVE_ICON_ART: Record<MoveId, () => PixelSprite> = {
  ...SIGNATURE_ICONS,
  ...TM_ICONS,
  ...VERB_EVOLVED_ICONS,
  ...LEGENDARY_ICONS,
  ember: () => FX.ember()[0]!,
  fireSpin: () => FX.flame()[0]!,
  waterGun: () => FX.water(),
  whirlpool: () => art(SPIRAL, { 1: '#3870e0' }, '#a8d0f8'),
  razorLeaf: () => FX.leaf(),
  vineWhip: () => art(VINE, { 1: '#286020', 2: '#78c850' }),
  swift: () => FX.star(),
  thunder: () => art(BOLT, { 1: '#c89000', 2: '#f8e030' }, '#504010'),
  sludgeBomb: () => art(BLOB, { 1: '#502060', 2: '#a040a0', 3: '#e0a0f0' }),
  gust: () => art(WIND, { 1: '#e8f0ff' }, '#58607a'),
  flamethrower: () => art(CONE, { 1: '#a82010', 2: '#f07020', 3: '#f8c040', 4: '#ffffff' }, '#401008'),
  fireBlast: () => FX.fireBlast()[0]!,
  hydroPump: () => FX.hydroPump(),
  surf: () => art(WAVE, { 1: '#2848b0', 2: '#68a0f0', 3: '#ffffff' }, '#102060'),
  leafStorm: () => compose(14, 14, [[FX.leafStorm(), 0, 3], [FX.leafStorm(), 3, 0]]),
  powerWhip: () => art(VINE, { 1: '#183818', 2: '#48a030' }, '#e0f0a0'),
  triAttack: () => compose(14, 14, FX.triAttack().map((tri, i) => [tri, [2, 0, 4][i]!, [0, 4, 4][i]!] as const)),
  wildboltStorm: () => {
    const bolt = art(BOLT, { 1: '#2890c8', 2: '#e0ffff' }, '#103048')
    return compose(13, 11, [[bolt, 0, 0], [bolt, 5, 2]])
  },
  gunkShot: () => art(GUNK, { 1: '#281830', 2: '#6a3a78', 3: '#b878c8', 4: '#88a038' }, '#100810'),
  hurricane: () => art(TORNADO, { 1: '#7880a8', 2: '#f0f4ff' }, '#30384a'),
  machPunch: () => FX.fist(),
  flashCannon: () => outlined(FX.steel()),
  spiritShackle: () => FX.arrow(),
  waterShuriken: () => FX.shuriken(),
  crunch: () => art([...JAW, ...[...JAW].reverse()], { 1: '#281820', 2: '#705848', 3: '#ffffff' }, '#a89888'),
  pyroBall: () => FX.pyro(),
  psyshock: () => outlined(FX.psy()[0]!),
  earthquake: () => art(CRACK, { 1: '#704820', 2: '#e0c068' }),
  drumBeating: () => art(DRUM, { 1: '#402010', 2: '#78c850', 3: '#a87840' }),
  disarmingVoice: () => FX.heart(),
  torchSong: () => FX.note(),
  leafBlade: () => FX.blade(),
  razorShell: () => art(SHELL, { 1: '#284880', 2: '#e8f0f8', 3: '#a8c8e8' }, '#101830'),
  quickAttack: () => art(QUICK, { 1: '#8890b0', 2: '#c8d0e8', 3: '#f0f4ff', 4: '#ffffff' }, '#303850'),
  extremeSpeed: () => art(QUICK, { 1: '#c89000', 2: '#f8d030', 3: '#fff8b0', 4: '#ffffff' }, '#503800'),
  shockWave: () => art(CHAIN, { 2: '#f8e030', 3: '#ffffff' }, '#504010'),
  thunderbolt: () => art(CHAIN, { 2: '#fff8a0', 3: '#f8a030' }, '#a03800'),
  hex: () => art(CHAIN, { 2: '#a070d8', 3: '#f0e0ff' }, '#281838'),
  toxicSpikes: () => FX.spikes(),
  barbBarrage: () => FX.barbs(),
  willOWisp: () => FX.wisp()[0]!,
  inferno: () => FX.inferno()[0]!,
  iceShard: () => FX.iceShard(),
  blizzard: () => FX.snowflake(),
  rockTomb: () => FX.boulder(),
  stoneEdge: () => compose(12, 16, [[FX.pillar(), 0, 0], [FX.pillar(), 4, 2]]),
  pinMissile: () => compose(10, 11, [[FX.pin(), 0, 0], [FX.pin(), 2, 3], [FX.pin(), 0, 6]]),
  megahorn: () => FX.horn(),
  dragonBreath: () => art(CONE, DRAGON_CONE, '#180840'),
  flameWheel: () => art(FIRE_RING, FIRE, '#401008'),
  solarBeam: () => art(SUN_BEAM, GRASS_SUN, '#183810'),
  brine: () => art(BRINE_ICON, BRINE_SEA, '#0c1c40'),
  electroBall: () => VERB_FX.electro(),
  venoshock: () => VERB_FX.glob(),
  selfDestruct: () => art(BLAST, FIRE, '#401008'),
  roost: () => compose(9, 12, [[VERB_FX.feather(), 0, 0], [VERB_FX.feather(), 3, 1]]),
  focusPunch: () => art(FIST, { 1: '#701810', 2: '#e04030', 3: '#ffa080' }, '#f8d030'),
  gyroBall: () => VERB_FX.gear()[0]!,
  suckerPunch: () => VERB_FX.shadowFist(),
  futureSight: () => VERB_FX.eye(),
  bonemerang: () => VERB_FX.bone(),
  stealthRock: () => compose(16, 14, [[VERB_FX.stones()[0]!, 0, 1], [VERB_FX.stones()[1]!, 5, 0]]),
  uTurn: () => art(U_ARROW, BUG, '#283008'),
  dragonTail: () => art(TAIL_ICON, DRAGON, '#100430'),
  sheerCold: () => compose(13, 13, [[art(FROST_RING, { 1: '#d8f0ff' }, '#3878a8'), 0, 0], [VERB_FX.crystal(), 1, 1]]),
  outrage: () => outlined(FX.dragonFlame()[0]!, '#180840'),
  ...EGG_MOVE_ICONS,
  ...EGG_MOVE_3_ICONS,
  jawLock: () => art([...TE.MAW_TOP, ...TE.MAW_BOTTOM], TE.MAW, '#d8c0e8'),
  superpower: () => art(TE.BIG_FIST, TE.FIST_PAL, '#281010'),
  fissure: () => art(...TE.FISSURE_ICON, '#181818'),
  extrasensory: () => art(TE.EYE, TE.EYE_PAL, '#401030'),
  steelBeam: () => art(...TE.BEAM_ICON, '#202838'),
  infernalParade: () => {
    const flame = art(TE.PARADE_FLAME, TE.PARADE_PAL, '#181030')
    return compose(16, 15, [[flame, 0, 1], [flame, 5, 0]])
  },
  phantomForce: () => {
    const arrow = art(TE.SPECTRAL_ARROW, TE.SPECTRAL_PAL, '#181028')
    return compose(13, 16, [[arrow, 0, 1], [arrow, 6, 0]])
  },
  aquaCutter: () => art(TE.PINWHEEL, TE.AQUA, '#102060'),
  searingShot: () => compose(15, 15, [[art(TE.SEARING_BALL, TE.SEARING_PAL, '#401008'), 0, 0], [art(TE.SEARING_EMBER, TE.SEARING_PAL, '#401008'), 8, 8]]),
  gigaDrain: () => art(TE.DRAIN_ORB, TE.DRAIN_PAL, '#103010'),
  burningJealousy: () => art(TE.ENVY_FLAME, TE.ENVY_PAL, '#300818'),
  trailblaze: () => art(TE.GIANT_BLADE, TE.BLADE_PAL, '#103010'),
  liquidation: () => art(TE.CRESCENT, TE.WAVE_PAL, '#102060'),
  alluringVoice: () => compose(15, 15, [[art(TE.heartRing(15), TE.HEART_PAL, '#401020'), 0, 0], [FX.heart(), 3, 3]]),
  ...EGG_MOVE_2_ICONS,
  ...DUO_ICONS,
}

const ITEM_ART: Record<ItemId, readonly [readonly string[], Palette]> = {
  muscleBand: [['.111111.', '12222221', '13333331', '12222221', '.111111.'], { 1: '#803010', 2: '#f08030', 3: '#f8c070' }],
  quickClaw: [['.1....1.', '121..121', '.121121.', '..1221..', '..1221..', '.12..21.', '12....21'], { 1: '#204080', 2: '#78b0f8' }],
  wideLens: [['.1111...', '122221..', '123221..', '122221..', '.11111..', '....111.', '.....111', '......11'], { 1: '#404048', 2: '#a8d8f8', 3: '#ffffff' }],
  lightClay: [['.111111.', '12222221', '12322221', '12222221', '12222221', '.111111.'], { 1: '#806838', 2: '#d8c088', 3: '#f8f0d0' }],
  loadedDice: [['11111111', '12222221', '12322321', '12222221', '12232221', '12222221', '12322321', '11111111'], { 1: '#303030', 2: '#f8f8f8', 3: '#c02020' }],
  leftovers: [['....2...', '...2....', '.111111.', '11331111', '13111111', '11111111', '.111111.', '..1..1..'], { 1: '#c83030', 2: '#58a030', 3: '#f8a0a0' }],
  choiceScarf: [['11111111', '12222221', '11111221', '....1221', '....1221', '...12221', '...1..11'], { 1: '#a03060', 2: '#f878b0' }],
  luckyEgg: [['..111..', '.12221.', '1222221', '1232321', '1222221', '1222221', '.12221.', '..111..'], { 1: '#a07850', 2: '#f8f0d8', 3: '#f87878' }],
  dowsingMachine: [['.1....1.', '.1....1.', '..1..1..', '11111111', '12222221', '12333321', '12222221', '11111111'], { 1: '#404858', 2: '#88a0c0', 3: '#78f8a0' }],
  charcoal: [['..111...', '.12221..', '1222321.', '12222221', '.1222221', '..11111.'], { 1: '#101010', 2: '#383838', 3: '#f08030' }],
  mysticWater: [['...1...', '..121..', '.12221.', '1223221', '1222221', '.12221.', '..111..'], { 1: '#2848b0', 2: '#6890f0', 3: '#ffffff' }],
  miracleSeed: [['...2.2.', '....2..', '..111..', '.13331.', '1333331', '.13331.', '..111..'], { 1: '#704818', 2: '#58c838', 3: '#d8a858' }],
  silkScarf: [['11111111', '12222221', '11111221', '....1221', '....1221', '...12221', '...1..11'], { 1: '#9898a8', 2: '#f8f8f8' }],
  poisonBarb: [['......1', '.....11', '....121', '...121.', '..121..', '.121...', '111....'], { 1: '#502060', 2: '#c060d0' }],
  sharpBeak: [['.111....', '12221...', '122221..', '1222221.', '1111111.', '.12221..', '..111...'], { 1: '#806010', 2: '#f8c030' }],
  neverMeltIce: [['...1...', '..121..', '.12321.', '1233421', '1234421', '.12421.', '..121..', '...1...'], ICE],
  hardStone: [['..1111..', '.122221.', '12233221', '12232221', '12222211', '.112211.', '..1111..'], { 1: '#404040', 2: '#888078', 3: '#c8c0b0' }],
  silverPowder: [['.3...3.', '..1.1..', '.12221.', '1222221', '1232221', '1222221', '.11111.'], { 1: '#686878', 2: '#d8d8e8', 3: '#ffffff' }],
  dragonFang: [['1111111', '1333331', '1222221', '.12221.', '.1221..', '..121..', '..11...'], { 1: '#605838', 2: '#f8f0d0', 3: '#a070f8' }],
  magnet: [['33....44', '33....44', '11....11', '11....11', '11....11', '.11..11.', '..1111..'], { 1: '#808088', 3: '#e83030', 4: '#3060e0' }],
  kingsRock: [['3...3...3', '2...2...2', '22.222.22', '222242222', '211111112', '222222222'], { 1: '#c89000', 2: '#f8d830', 3: '#f8f8c0', 4: '#e83838' }],
  toxicOrb: [['..1111..', '.122221.', '12233221', '12322321', '12232321', '12223321', '.122221.', '..1111..'], { 1: '#502060', 2: '#a040c0', 3: '#e0a0f8' }],
  assaultVest: [['.11..11.', '12211221', '12222221', '.122221.', '.123321.', '.122221.', '.111111.'], { 1: '#5a3018', 2: '#c05838', 3: '#f8d058' }],
  metronome: [['...11...', '...14...', '..1241..', '..1421..', '.122421.', '.124221.', '12422221', '11111111'], { 1: '#583010', 2: '#d89040', 4: '#f8f0d0' }],
  powerHerb: [['.2...2..', '232.232.', '.2...2..', '..1.1...', '...1....', '..11....', '.1......'], { 1: '#386820', 2: '#f8f8f8', 3: '#e83838' }],
  ...TE.TYPE_ITEM_ART,
}

/* ---------------- Poké Mart icons ---------------- */

/** Vitamin bottle: 1 outline, 2 cap, 3 bottle, 4 shine, 5 label. */
const BOTTLE = ['..1111..', '..1221..', '..1111..', '.133331.', '13433331', '14555531', '13555531', '13333331', '.111111.']
const vitamin = (cap: string, body: string): readonly [readonly string[], Palette] => [
  BOTTLE,
  { 1: '#202028', 2: cap, 3: body, 4: '#ffffff', 5: '#f0f0f0' },
]

const UPGRADE_ART: Record<UpgradeId, readonly [readonly string[], Palette]> = {
  hpUp: vitamin('#f8f8f8', '#58c058'),
  protein: vitamin('#f8f8f8', '#e85040'),
  iron: vitamin('#f8f8f8', '#8890a8'),
  carbos: vitamin('#f8f8f8', '#40a8e0'),
  calcium: vitamin('#f8f8f8', '#e8d070'),
  zinc: vitamin('#f8f8f8', '#a070d0'),
  ppUp: vitamin('#f8d030', '#f078b8'),
  expCharm: [['.111111.', '12222221', '12333321', '12344321', '12333321', '12222221', '.111111.', '..1..1..'], { 1: '#283048', 2: '#4880d8', 3: '#a8d0f8', 4: '#f8f8f8' }],
  amuletCoin: [['1......1', '.1....1.', '..1111..', '.122221.', '12233221', '12322321', '12233221', '.122221.', '..1111..'], { 1: '#805000', 2: '#f8c830', 3: '#fff8b0' }],
  abilityCapsule: [['..1111..', '.122221.', '12222221', '12222221', '13333331', '13333331', '13333331', '.133331.', '..1111..'], { 1: '#283048', 2: '#e85878', 3: '#f8f0f8' }],
  escapeRope: [['..1111..', '.12..21.', '12.11.21', '1.1221.1', '1.1..1.1', '12.11.21', '.12..21.', '..1111..'], { 1: '#805828', 2: '#d8a868' }],
  shinyCharm: [['....1....', '...131...', '...121...', '.1122211.', '122232221', '.1122211.', '...121...', '...121...', '....1....'], { 1: '#805000', 2: '#f8c830', 3: '#ffffff' }],
}

/** The bag's items: a Lure spray (pink, like the games') and an Incense jar with its smoke. */
const BAG_ART: Record<BagItem, readonly [readonly string[], Palette]> = {
  lure: [['...11...', '..1221..', '.111111.', '.133331.', '.134431.', '.134431.', '.133331.', '.133331.', '..1111..'], { 1: '#402030', 2: '#f8f8f8', 3: '#f070b0', 4: '#ffe0f0' }],
  incense: [['..2..2..', '.2..2...', '..2..2..', '.111111.', '13333331', '13444431', '13333331', '.133331.', '..1111..'], { 1: '#302018', 2: '#d8d0f0', 3: '#c88848', 4: '#f8d8a0' }],
}

const iconCache = new Map<string, string>()

/** Icon as a data URL, padded to a square so it scales uniformly in the DOM. */
export const toIconUrl = (key: string, build: () => PixelSprite) => {
  const cached = iconCache.get(key)
  if (cached) return cached
  const sprite = build()
  const size = Math.max(sprite.width, sprite.height, 10)
  const canvas = createCanvas(size, size)
  context2d(canvas).drawImage(sprite, Math.floor((size - sprite.width) / 2), Math.floor((size - sprite.height) / 2))
  const url = canvas.toDataURL()
  iconCache.set(key, url)
  return url
}

export const moveIcon = (id: MoveId) => toIconUrl(`move:${id}`, MOVE_ICON_ART[id])

/** Move and held item icons not made yet, for `warmIcon`. */
let unmadeIcons: (() => unknown)[] | null = null

/**
 * Makes one level-up icon (a move's or a held item's) not made yet, so the
 * cards open without encoding their pictures. True if it made one. Called in idle time.
 */
export const warmIcon = () => {
  unmadeIcons ??= [
    ...(Object.keys(MOVE_ICON_ART) as MoveId[]).map((id) => () => moveIcon(id)),
    ...(Object.keys(ITEM_ART) as ItemId[]).map((id) => () => itemIcon(id)),
  ]
  const next = unmadeIcons.pop()
  next?.()
  return next !== undefined
}

const iconSprites = canvasCache<MoveId, PixelSprite>()

/** A move's icon as a sprite for the world (Metronome's bubble shows the move it called). */
export const moveIconSprite = (id: MoveId) => {
  let sprite = iconSprites.get(id)
  if (!sprite) iconSprites.set(id, (sprite = MOVE_ICON_ART[id]()))
  return sprite
}

export const itemIcon = (id: ItemId) =>
  toIconUrl(`item:${id}`, () => {
    const [rows, pal] = ITEM_ART[id]
    return art(rows, pal, '#181818')
  })

/** A cursed item in its purple frame (`render/duoArt.ts`). */
export const curseIcon = (id: CurseId) => toIconUrl(`curse:${id}`, () => cursedIcon(id))

export const bagIcon = (id: BagItem) =>
  toIconUrl(`bag:${id}`, () => {
    const [rows, pal] = BAG_ART[id]
    return art(rows, pal, '#181818')
  })

export const upgradeIcon = (id: UpgradeId) =>
  toIconUrl(`upgrade:${id}`, () => {
    const [rows, pal] = UPGRADE_ART[id]
    return art(rows, pal, '#181818')
  })

export const coinIcon = (tier = 0) => toIconUrl(`coin:${tier}`, () => PICKUPS.coins()[tier]!)
export const candyIcon = (tier: number) => toIconUrl(`candy:${tier}`, () => PICKUPS.candy()[tier]!)
export const berryIcon = () => toIconUrl('berry', PICKUPS.berry)
export const pokeballIcon = () => toIconUrl('pokeball', PICKUPS.pokeball)
export const heartIcon = () => toIconUrl('heart', FX.heart)
export const gearIcon = () => toIconUrl('gear', () => art(GEAR, { 1: '#303040' }))
export const helpIcon = () => toIconUrl('help', () => art(HELP, { 1: '#303040' }))

/** Novidades: a dog-eared page of patch notes. 1 outline, 2 paper, 3 the fold, 4 the red headline, 5 text. */
const NEWS = [
  '11111111...',
  '122222211..',
  '1244442131.',
  '12222221331',
  '12555551111',
  '12222222221',
  '12555555521',
  '12222222221',
  '12555552221',
  '12222222221',
  '12555555521',
  '12222222221',
  '11111111111',
]

export const newsIcon = () => toIconUrl('news', () => art(NEWS, { 1: '#303040', 2: '#f8f8f8', 3: '#c8d0e0', 4: '#e83850', 5: '#9098b8' }))

/** Discord's app icon: the white Clyde on a blurple rounded square. 1 outline, 2 blurple, 3 white. */
const DISCORD = [
  '..11111111111111..',
  '.1222222222222221.',
  '122222222222222221',
  '122233222222332221',
  '122333333333333221',
  '122333333333333221',
  '123333333333333321',
  '123332233332233321',
  '123332233332233321',
  '123332233332233321',
  '123333333333333321',
  '122333322223333221',
  '122233222222332221',
  '.1222222222222221.',
  '..11111111111111..',
]

export const discordIcon = () => toIconUrl('discord', () => art(DISCORD, { 1: '#283070', 2: '#5865f2', 3: '#ffffff' }))

/** TikTok's app icon: the white note on a black rounded square, with its cyan and red echoes. 1 outline, 2 black, 3 white, 4 cyan, 5 red. */
const TIKTOK = [
  '..111111111111..',
  '.12222222222221.',
  '1222222444222221',
  '1222222433322221',
  '1222222433332221',
  '1222222433533221',
  '1222222433523521',
  '1222222433522521',
  '1222444433522221',
  '1224433333522221',
  '1224333333522221',
  '1222333335522221',
  '1222233355222221',
  '1222225552222221',
  '.12222222222221.',
  '..111111111111..',
]

const SOCIAL_ART = {
  tiktok: () => art(TIKTOK, { 1: '#000000', 2: '#161823', 3: '#ffffff', 4: '#25f4ee', 5: '#fe2c55' }),
} as const satisfies Record<SocialId, () => PixelSprite>

/** Each official profile's icon (`SOCIALS` in `site/routes.ts`). */
export const socialIcon = (id: SocialId) => toIconUrl(`social:${id}`, SOCIAL_ART[id])

const PLATFORM_ART = { tiktok: SOCIAL_ART.tiktok } as const satisfies Record<PlatformId, () => PixelSprite>

/** The icon of a platform content creators stream on (`PLATFORMS` in `data/creators.ts`). */
export const platformIcon = (id: PlatformId) => toIconUrl(`social:${id}`, PLATFORM_ART[id])

/** iOS's Share: an arrow leaving an open tray, in iOS blue (the install how-to, `ui/install.ts`). 1 outline, 2 blue. */
const SHARE = [
  '.....1.....',
  '....121....',
  '...12221...',
  '..1222221..',
  '..1112111..',
  '....121....',
  '111.121.111',
  '121.121.121',
  '121.111.121',
  '121.....121',
  '12111111121',
  '12222222221',
  '11111111111',
]

/** iOS's "Add to Home Screen": a white plus on a blue tile. 1 outline, 2 blue, 3 white. */
const ADD_HOME = [
  '.11111111111.',
  '1222222222221',
  '1222223222221',
  '1222223222221',
  '1222223222221',
  '1222223222221',
  '1233333333321',
  '1222223222221',
  '1222223222221',
  '1222223222221',
  '1222223222221',
  '1222222222221',
  '.11111111111.',
]

const IOS_BLUE = { 1: '#303040', 2: '#3878f0', 3: '#ffffff' } as const
export const shareIcon = () => toIconUrl('share', () => art(SHARE, IOS_BLUE))
export const addHomeIcon = () => toIconUrl('addHome', () => art(ADD_HOME, IOS_BLUE))

/** The supporter's badge by their names (`game/supporters.ts`): a rose heart, a gold one for the gold tier. */
export const supporterIcon = (tier: SupporterTier) =>
  tier === 'gold' ? toIconUrl('heart:gold', () => art(HEART, { 1: '#c88a10', 2: '#f8d030', 3: '#fffbe0' }, '#4a3008')) : heartIcon()
export const sparkleIcon = () => toIconUrl('sparkle', () => outlined(SPARKLE()[2]!, '#584010'))

/** PlayStation's face buttons in their colors, the size of a Press Start 2P letter: the pixel fonts have no ✕ ○ □ △ (see `ui/inputLabels.ts`). */
const PAD_GLYPHS = {
  '✕': [['11....11', '111..111', '.111111.', '..1111..', '..1111..', '.111111.', '111..111', '11....11'], '#4a80e0'],
  '○': [['..1111..', '.111111.', '111..111', '11....11', '11....11', '111..111', '.111111.', '..1111..'], '#e04850'],
  '□': [['11111111', '11111111', '11....11', '11....11', '11....11', '11....11', '11111111', '11111111'], '#d058b8'],
  '△': [['...11...', '..1111..', '..1111..', '.11..11.', '.11..11.', '11....11', '11111111', '11111111'], '#28a888'],
} as const satisfies Record<string, readonly [readonly string[], string]>

export type PadGlyph = keyof typeof PAD_GLYPHS
export const isPadGlyph = (text: string): text is PadGlyph => text in PAD_GLYPHS
export const padGlyphIcon = (glyph: PadGlyph) =>
  toIconUrl(`pad:${glyph}`, () => {
    const [rows, color] = PAD_GLYPHS[glyph]
    return art(rows, { 1: color })
  })

/** Presente Misterioso: a wrapped box with a bow. 1 outline, 2 ribbon, 3 paper, 4 paper shade, 5 ribbon shade. */
const GIFT = [
  '..11....11..',
  '.1221..1221.',
  '.1222112221.',
  '..11122111..',
  '133332233331',
  '144442254441',
  '111111111111',
  '.1333223331.',
  '.1333223331.',
  '.1444225441.',
  '.1111111111.',
]

export const giftIcon = () => toIconUrl('gift', () => art(GIFT, { 1: '#301018', 2: '#f8d030', 3: '#e83850', 4: '#a82038', 5: '#c89000' }))

/** Ideias (the idea board): a lit bulb. 1 outline, 2 glass, 3 shine, 4 shade, 5-6 the screw base. */
const BULB = [
  '...11111...',
  '..1322221..',
  '.132222241.',
  '13222222241',
  '13222222241',
  '12222222241',
  '.122222441.',
  '..1224441..',
  '...12241...',
  '...15551...',
  '...16661...',
  '...15551...',
  '....111....',
]

export const bulbIcon = () => toIconUrl('bulb', () => art(BULB, { 1: '#303040', 2: '#f8d030', 3: '#fff8c0', 4: '#c89000', 5: '#c8d0e0', 6: '#7880a0' }))

/* ---------------- Medals ---------------- */

/** Achievement medal: a two-tone ribbon over a disc with a star. 1 outline, 2-3 ribbon, 4 star, 5 rim, 6 face. */
const MEDAL = [
  '.111...111.',
  '.122...331.',
  '..122.331..',
  '...12331...',
  '....121....',
  '...11111...',
  '..1566651..',
  '.156646651.',
  '.154444451.',
  '.156444651.',
  '.156464651.',
  '..1566651..',
  '...11111...',
]

const MEDAL_METAL = {
  bronze: { 4: '#f8c890', 5: '#985028', 6: '#d88848' },
  silver: { 4: '#ffffff', 5: '#788098', 6: '#c8d0e0' },
  gold: { 4: '#fff0a0', 5: '#b07010', 6: '#f8c838' },
} as const satisfies Record<Medal, Palette>

const MEDAL_RIBBON = { 1: '#282830', 2: '#e04848', 3: '#4878e0' } as const

/** Locked medals are a flat silhouette of the same shape. */
const MEDAL_LOCKED = { 1: '#383848', 2: '#686878', 3: '#585868', 4: '#9898a8', 5: '#585868', 6: '#787888' } as const

const MEDAL_SPRITES = canvasCache<string, PixelSprite>()

/** A medal as a sprite (share cards draw it on a canvas), cached. */
export const medalSprite = (medal: Medal, locked = false) => {
  const key = locked ? 'locked' : medal
  let sprite = MEDAL_SPRITES.get(key)
  if (!sprite) MEDAL_SPRITES.set(key, (sprite = art(MEDAL, locked ? MEDAL_LOCKED : { ...MEDAL_RIBBON, ...MEDAL_METAL[medal] })))
  return sprite
}

/* ---------------- Ribbons ---------------- */

/** Desafio do dia ribbon: a pleated rosette with two tails. 1 outline, 2 pleat shade, 3 pleat, 4 pleat light, 5 button, 6 shine. */
const RIBBON = [
  '...11111...',
  '..1343431..',
  '.134444431.',
  '.134555431.',
  '13455655431',
  '13455555431',
  '.134555431.',
  '.134444431.',
  '..1343431..',
  '...12121...',
  '..1221221..',
  '..122.221..',
  '.1221.1221.',
  '.111...111.',
]

const RIBBON_COLORS = {
  gold: { 1: '#584010', 2: '#b07010', 3: '#e0a828', 4: '#f8d860', 5: '#fff0a0', 6: '#ffffff' },
  silver: { 1: '#303848', 2: '#788098', 3: '#a8b0c8', 4: '#d8dce8', 5: '#f0f2f8', 6: '#ffffff' },
  bronze: { 1: '#402010', 2: '#985028', 3: '#c87840', 4: '#e8a868', 5: '#f8d0a0', 6: '#fff0e0' },
} as const satisfies Record<RibbonTier, Palette>

const RIBBON_SPRITES = canvasCache<RibbonTier, PixelSprite>()

/** A ribbon as a sprite (the Trainer Card draws it), cached. */
export const ribbonSprite = (tier: RibbonTier) => {
  let sprite = RIBBON_SPRITES.get(tier)
  if (!sprite) RIBBON_SPRITES.set(tier, (sprite = art(RIBBON, RIBBON_COLORS[tier])))
  return sprite
}

export const ribbonIcon = (tier: RibbonTier) => toIconUrl(`ribbon:${tier}`, () => ribbonSprite(tier))

export const medalIcon = (medal: Medal, locked = false) => toIconUrl(`medal:${locked ? 'locked' : medal}`, () => medalSprite(medal, locked))

/* ---------------- Clears ---------------- */

/** A clear's trophy (`game/clears.ts`), on the Pokédex and the partner select. 1 outline, 2 shade, 3 metal, 4 shine. */
const TROPHY = ['111111111', '1.14321.1', '1.14321.1', '.1143211.', '..14321..', '...131...', '...131...', '..13321..', '..11111..']

/** The hardest difficulty cleared picks the metal: bronze for Normal, silver for Hard, gold for Nightmare, like the medals. */
const TROPHY_METAL = {
  normal: { 1: '#402010', 2: '#985028', 3: '#d88848', 4: '#f8c890' },
  hard: { 1: '#303848', 2: '#788098', 3: '#c8d0e0', 4: '#ffffff' },
  nightmare: { 1: '#584010', 2: '#b07010', 3: '#f8c838', 4: '#fff0a0' },
} as const satisfies Record<Difficulty, Palette>

export const trophyIcon = (d: Difficulty) => toIconUrl(`trophy:${d}`, () => art(TROPHY, TROPHY_METAL[d]))
