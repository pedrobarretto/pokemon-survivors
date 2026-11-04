import { detail } from '../render/quality'

/** Gem purples, gold and the shop's bright accents. */
const COLORS = ['#a855f7', '#6a30a8', '#e9c46a', '#f4a261', '#4cc9f0', '#f72585', '#80ed99', '#ffffff'] as const

/** Screen pixels per confetti pixel: the burst is drawn small and upscaled, hard-edged like the game. */
const SCALE = 3
const LIFE = 2.4

type Bit = { x: number; y: number; vx: number; vy: number; w: number; h: number; color: string; spin: number; phase: number }

const prefersCalm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A pixel confetti burst over the whole page: two cannons from the bottom
 * corners and a shower from the top, gone after a couple of seconds. Purely
 * decorative (no clicks, no focus); skipped for reduced motion, halved on a
 * lean frame.
 */
export const celebrate = () => {
  if (prefersCalm()) return
  const w = Math.ceil(innerWidth / SCALE)
  const ht = Math.ceil(innerHeight / SCALE)
  const canvas = document.createElement('canvas')
  canvas.className = 'confetti'
  canvas.width = w
  canvas.height = ht
  canvas.setAttribute('aria-hidden', 'true')
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  document.body.append(canvas)

  const count = detail.lean || detail.safe > 0 ? 60 : 130
  const bit = (x: number, y: number, vx: number, vy: number): Bit => ({
    x,
    y,
    vx,
    vy,
    w: 1 + Math.floor(Math.random() * 2),
    h: 1 + Math.floor(Math.random() * 3),
    color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[0],
    spin: 6 + Math.random() * 10,
    phase: Math.random() * Math.PI * 2,
  })
  const bits: Bit[] = Array.from({ length: count }, (_, i) => {
    const kind = i % 3
    if (kind === 2) return bit(Math.random() * w, -Math.random() * ht * 0.4, (Math.random() - 0.5) * 20, Math.random() * 20)
    const side = kind === 0 ? 1 : -1
    const speed = ht * (0.9 + Math.random() * 0.6)
    const angle = (Math.PI / 180) * (60 + Math.random() * 25)
    return bit(kind === 0 ? 0 : w, ht, side * Math.cos(angle) * speed, -Math.sin(angle) * speed)
  })

  const gravity = ht * 0.9
  let last = performance.now()
  let age = 0
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    age += dt
    ctx.clearRect(0, 0, w, ht)
    ctx.globalAlpha = Math.min(1, (LIFE - age) / 0.5)
    for (const b of bits) {
      b.vy += gravity * dt
      b.vx *= 1 - 1.5 * dt
      if (b.vy > 0) b.vy = Math.min(b.vy, 40 + b.spin * 2)
      b.x += (b.vx + Math.sin(age * b.spin * 0.5 + b.phase) * 8) * dt
      b.y += b.vy * dt
      // A flat bit turning over: its width flickers between full and one pixel.
      const flip = Math.abs(Math.sin(age * b.spin + b.phase)) > 0.4
      ctx.fillStyle = b.color
      ctx.fillRect(Math.round(b.x), Math.round(b.y), flip ? b.w : 1, b.h)
    }
    if (age < LIFE && canvas.isConnected) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
