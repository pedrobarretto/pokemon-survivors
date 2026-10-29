import { blitCentered, fromStrings, lazy, type PixelSprite } from '../engine/pixelart'
import { VERSUS } from '../data/versus'
import { localPlayer } from '../game/players'
import type { Game } from '../game/types'
import { PING_KINDS, type Ping, type PingKind } from '../game/versusSocial'

/**
 * The Arena's pings (`game/versusSocial.ts`) on the field: a pin in the
 * ping's color with its sign (attack, danger, on my way, objective), bobbing
 * over the spot, with a ring that spreads as it lands and a blink as it
 * fades. Only the pinger's team sees them (`seesPing`). The mini map draws
 * them too (`render/minimap.ts`), and the shell's wheel shows the same
 * signs (`pingIconUrl`).
 */

/** Each ping's color. */
export const PING_COLORS = { attack: '#f85838', danger: '#f8d030', omw: '#58c8f8', objective: '#c078f8' } as const satisfies Record<PingKind, string>

/** Each ping's sign, 5×5 in white on its pin. */
const SIGNS = {
  attack: ['w...w', '.w.w.', '..w..', '.w.w.', 'w...w'],
  danger: ['..w..', '..w..', '..w..', '.....', '..w..'],
  omw: ['w.w..', '.w.w.', '..w.w', '.w.w.', 'w.w..'],
  objective: ['..w..', 'wwwww', '.www.', '.w.w.', 'w...w'],
} as const satisfies Record<PingKind, readonly string[]>

/** The pin, 11×14: a round head (its sign goes in the middle, `pinOf`), shaded on its right, its point on the spot. */
const PIN = [
  '...ooooo...',
  '.oocccccoo.',
  '.occcccccd.',
  'occcccccccd',
  'occcccccccd',
  'occcccccccd',
  'occcccccccd',
  'occcccccccd',
  '.occcccccd.',
  '.oodccccdo.',
  '...odccdo..',
  '....ocdo...',
  '....ocdo...',
  '.....oo....',
]

/** The pin of `kind` with its sign stamped on its head. */
const pinOf = (kind: PingKind) => {
  const rows = PIN.map((row) => [...row])
  SIGNS[kind].forEach((line, y) => [...line].forEach((cell, x) => cell === 'w' && (rows[3 + y]![3 + x] = 'w')))
  return fromStrings(
    rows.map((r) => r.join('')),
    { o: '#181018', c: PING_COLORS[kind], d: shade(PING_COLORS[kind]), w: '#ffffff' },
  )
}

/** A color a third darker, for the pin's shaded side. */
const shade = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16)
  const ch = (k: number) => Math.round(((n >> k) & 0xff) * 0.66)
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}

const PINS = lazy(() => Object.fromEntries(PING_KINDS.map((kind) => [kind, pinOf(kind)])) as Record<PingKind, PixelSprite>)

/** The pin of `kind` as an image URL, for the shell's ping wheel and feed. */
export const pingIconUrl = (kind: PingKind) => PINS()[kind].toDataURL()

/** Whether this screen's player sees `ping`: it's their team's. */
export const seesPing = (g: Game, ping: Ping) => g.players[ping.slot]?.versus?.team === localPlayer(g).versus?.team

/** Seconds a ping spends landing (its ring spreads) and fading (it blinks). */
const LAND = 0.5
const FADE = 1.2

/** The pings this screen's team made, over everyone, in world space. */
export const drawValePings = (ctx: CanvasRenderingContext2D, g: Game, t: number) => {
  const s = g.versus
  if (!s || s.pings.length === 0) return
  const pins = PINS()
  for (const ping of s.pings) {
    if (!seesPing(g, ping)) continue
    const age = g.now - ping.at
    const left = VERSUS.ping.keep - age
    if (left < FADE && Math.floor(t * 8) % 2 === 0) continue
    const x = Math.round(ping.x)
    const y = Math.round(ping.y)
    if (age < LAND) {
      const k = age / LAND
      ctx.globalAlpha = 1 - k
      ctx.strokeStyle = PING_COLORS[ping.kind]
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(x + 0.5, y + 0.5, 4 + k * 22, 2 + k * 11, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    // A shadow on the spot, the pin over it.
    ctx.fillStyle = 'rgba(16,16,24,0.35)'
    ctx.fillRect(x - 2, y, 5, 1)
    const bob = Math.round(Math.sin(t * 5 + ping.at) * 1.5)
    const drop = age < LAND ? Math.round((1 - age / LAND) * -10) : 0
    blitCentered(ctx, pins[ping.kind], x, y - 7 + bob + drop)
  }
}
