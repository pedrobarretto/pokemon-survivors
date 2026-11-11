import { context2d, createCanvas, fromStrings, type Palette, type PixelSprite } from '../engine/pixelart'
import type { UltraMoveId } from '../game/ultraMoves'
import { art, toIconUrl } from './art'

/**
 * Icons of the Ultra Beasts' moves (`game/ultraMoves.ts`, listed in `art.ts`):
 * a string emblem on a dark disc inside a rim of Ultra Space's prism light,
 * so they read apart from the legendaries' gold medallions at a glance.
 */

const ICON = 17

/** The rim's light, around the disc from the top: Ultra Space's prism. */
const RIM = ['#f8a0d0', '#f8e098', '#a8f0c8', '#98d8f8', '#c8a8f8'] as const

const ultraMedallion = (emblem: PixelSprite, disc = '#140c30') => {
  const canvas = createCanvas(ICON, ICON)
  const ctx = context2d(canvas)
  const c = (ICON - 1) / 2
  for (let y = 0; y < ICON; y++) for (let x = 0; x < ICON; x++) {
    const d = Math.hypot(x - c, y - c)
    if (d > 8.5) continue
    const turn = (Math.atan2(y - c, x - c) / (Math.PI * 2) + 1.25) % 1
    const hue = RIM[Math.floor(turn * RIM.length) % RIM.length]!
    // Light from the top left: the rim burns white there.
    ctx.fillStyle = d > 7.6 ? '#0c0620' : d > 6.4 ? (x + y < 8 ? '#ffffff' : hue) : disc
    ctx.fillRect(x, y, 1, 1)
  }
  ctx.drawImage(emblem, Math.floor((ICON - emblem.width) / 2), Math.floor((ICON - emblem.height) / 2))
  return canvas
}

const icon = (rows: readonly string[], palette: Palette, disc?: string) => () => ultraMedallion(fromStrings(rows, palette), disc)

export const ULTRA_ICONS: Record<UltraMoveId, () => PixelSprite> = {
  // Nihilego's bell dripping acid.
  acidSpray: icon(
    ['...1111...', '..122221..', '.12233221.', '.12222221.', '.11111111.', '..1.1.1...', '..1.1.1.1.', '.4..4..4..', '.4.......4'],
    { 1: '#3878a8', 2: '#a8e8f8', 3: '#ffffff', 4: '#c8f078' },
  ),
  // Buzzwole's red fist.
  powerUpPunch: icon(
    ['.1111111..', '1232323211', '1222222221', '1222222221', '1122222211', '.12222221.', '.12222221.', '..111111..'],
    { 1: '#401010', 2: '#e84838', 3: '#f8a090' },
  ),
  // Pheromosa's streak.
  pheromosaLunge: icon(
    ['.......11', '.....1121', '...112221', '.1122221.', '1222221..', '.1122221.', '...112221', '.....1121', '.......11'],
    { 1: '#8890a8', 2: '#f8f8ff' },
  ),
  // Xurkitree's bolt.
  tailGlow: icon(
    ['....1111.', '...1221..', '..1221...', '.1222111.', '.1112221.', '...1221..', '..1221...', '.1221....', '.111.....'],
    { 1: '#504008', 2: '#f8f060' },
  ),
  // Celesteela's rocket.
  autotomize: icon(
    ['....1....', '...121...', '...121...', '..12321..', '..12321..', '.1123211.', '.1.444.1.', '...454...', '....4....'],
    { 1: '#284c38', 2: '#88f0a8', 3: '#e8fff0', 4: '#f88830', 5: '#f8e060' },
  ),
  // Kartana's crossed cuts.
  guillotine: icon(
    ['1.......1', '21.....12', '.21...12.', '..21.12..', '...212...', '..12.21..', '.12...21.', '12.....21', '1.......1'],
    { 1: '#78a888', 2: '#ffffff' },
  ),
  // Guzzlord's maw.
  belch: icon(
    ['.11111111.', '1323232321', '1222222221', '1244444421', '1244444421', '1222222221', '1323232321', '.11111111.'],
    { 1: '#200c30', 2: '#7040a8', 3: '#ffffff', 4: '#100418' },
  ),
  // Stakataka's wall.
  wideGuard: icon(
    ['1111111111', '1322213221', '1111111111', '2213221322', '1111111111', '1322213221', '1111111111'],
    { 1: '#30343c', 2: '#a8b0b8', 3: '#e8f0f0' },
  ),
  // Blacephalon's head, its fuse lit.
  mindBlown: icon(
    ['......5.5', '.....5.5.', '....1.5..', '..1111...', '.122221..', '12232221.', '12222221.', '12222221.', '.122221..', '..1111...'],
    { 1: '#401830', 2: '#f8f0f8', 3: '#f8a0c8', 5: '#f8d030' },
  ),
  // Naganadel's stinger.
  fellStinger: icon(
    ['........1', '.......12', '......121', '.....121.', '....121..', '...121...', '..121....', '.131.....', '131......', '.1.......'],
    { 1: '#401860', 2: '#c888f8', 3: '#f8f0ff' },
  ),
  // Poipole's needle, venom dripping.
  poipoleJab: icon(
    ['....1....', '...121...', '...121...', '...121...', '..12321..', '..12221..', '...121...', '....1....', '..4...4..', '.444.444.'],
    { 1: '#401848', 2: '#c060c8', 3: '#f8d0f8', 4: '#a8e838' },
  ),
}

/** The Beast Ball as a badge (the partner select's Ultra Beasts, the lobby's beast of the week): blue, its top run through with yellow. */
export const beastBallIcon = () =>
  toIconUrl('ultra:beastBall', () =>
    art(['..1111..', '.142241.', '12422421', '13333331', '14455441', '14444441', '.144441.', '..1111..'], { 1: '#0c1430', 2: '#2c60d8', 3: '#182040', 4: '#f8d030', 5: '#ffffff' }, '#060a18'),
  )
