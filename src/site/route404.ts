import type { Sheet } from './pokedex'

/**
 * Rota 404, the 404 page's mini game: a tiny survivors on a grass route. The
 * player walks (keys or touch), Ember fires at the nearest Zubat on its own,
 * and the route's signs are the page's own links: standing on one offers its
 * page. Its own little engine, since the site never loads the game's bundle.
 * Nothing moves until the player does, which also keeps it still for
 * `prefers-reduced-motion` until asked.
 */

export type SignIcon = 'ball' | 'dex' | 'book' | 'mystery'

/** A sign on the route: where it leads and how it looks (`gold` for the page the URL most likely meant). */
export type Exit = { href: string; label: string; icon: SignIcon; gold: boolean }

export type Walker = { src: string; sheet: Sheet }

export type RouteSetup = { player: Walker & { name: string }; foe: Walker; exits: readonly Exit[] }

/** Internal height of the route, in art pixels; the width follows the box. */
const HEIGHT = 136
const STEP = 1000 / 60
const HEARTS = 5
/** Highest the player's feet go, so the HUD stays readable above its head. */
const TOP = 22
const BEST_KEY = 'ps:route404'

const MOVE: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  // Physical keys, so ZQSD on a French keyboard walks the same.
  KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0],
}

const PALETTE: Readonly<Record<string, string>> = { K: '#303040', R: '#e83838', W: '#f8f8f8', B: '#2a5aa8', Y: '#ffcb05', G: '#a8b0c8' }

/** 7×7 sign icons, one string per row (`.` is clear). */
const ICONS: Readonly<Record<SignIcon, readonly string[]>> = {
  ball: ['..KKK..', '.KRRRK.', 'KRRRRRK', 'KKKWKKK', 'KWWWWWK', '.KWWWK.', '..KKK..'],
  dex: ['KKKKKK.', 'KRRRRKK', 'KRBBRRK', 'KRBBRRK', 'KRRRRRK', 'KRGRGRK', 'KKKKKKK'],
  book: ['.KKKKK.', 'KBBBBWK', 'KBYBBWK', 'KBBBBWK', 'KBBBBWK', 'KBBBBWK', '.KKKKK.'],
  mystery: ['..KKK..', '.K...K.', '.....K.', '...KK..', '...K...', '.......', '...K...'],
}

const HEART = ['.RR.RR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...']
const HEART_EMPTY = ['.KK.KK.', 'K..K..K', 'K.....K', '.K...K.', '..K.K..', '...K...']

/** 3×5 digits and the few letters the HUD needs (Press Start 2P blurs below 8 px). */
const GLYPHS: Readonly<Record<string, string>> = {
  '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001',
  '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110',
  ':': '000010000010000', K: '101110100110101', O: '010101101101010', ' ': '000000000000000',
}

type Ctx = CanvasRenderingContext2D

const pixels = (ctx: Ctx, rows: readonly string[], x: number, y: number) =>
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const color = PALETTE[row[i]!]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x + i, y + j, 1, 1)
    }
  })

/** HUD text, top-left at (x, y), with a 1 px shadow. */
const text = (ctx: Ctx, value: string, x: number, y: number) => {
  for (const [dx, color] of [[1, '#000000'], [0, '#ffffff']] as const) {
    ctx.fillStyle = color
    ;[...value].forEach((ch, i) => {
      const glyph = GLYPHS[ch] ?? GLYPHS[' ']!
      for (let b = 0; b < 15; b++) if (glyph[b] === '1') ctx.fillRect(x + i * 4 + (b % 3) + dx, y + Math.floor(b / 3) + dx, 1, 1)
    })
  }
}

const textWidth = (value: string) => value.length * 4 - 1

const clock = (ticks: number) => {
  const s = Math.floor(ticks / 60)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Column of a looping PMD animation at tick `t` (durations in 1/60 s). */
const frameAt = (sheet: Sheet, t: number) => {
  const total = sheet.durations.reduce((a, b) => a + b, 0)
  let at = t % total
  for (let i = 0; i < sheet.durations.length; i++) {
    const d = sheet.durations[i]!
    if (at < d) return i
    at -= d
  }
  return 0
}

/** PMD sheet row facing (dx, dy): 0 down, 2 right, 4 up, 6 left, diagonals between. */
const rowOf = (dx: number, dy: number) => [2, 1, 0, 7, 6, 5, 4, 3][(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8]!

/** The sheet in solid white, for the hit flash. */
const silhouette = (img: HTMLImageElement) => {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const g = c.getContext('2d')!
  g.drawImage(img, 0, 0)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, c.width, c.height)
  return c
}

/** Seeded generator for the grass, so the route looks the same at every size. */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2 ** 32
}

type Foe = { x: number; y: number; hp: number; hurt: number; row: number; phase: number }
type Shot = { x: number; y: number; vx: number; vy: number; life: number }
type Puff = { x: number; y: number; t: number }
type Sign = Exit & { x: number; y: number }

type State = {
  phase: 'idle' | 'run' | 'over'
  t: number
  x: number
  y: number
  row: number
  moving: boolean
  hp: number
  inv: number
  ko: number
  foes: Foe[]
  shots: Shot[]
  puffs: Puff[]
}

const readBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

const load = (src: string) =>
  new Promise<HTMLImageElement>((done, fail) => {
    const img = new Image()
    img.src = src
    img.onload = () => done(img)
    img.onerror = fail
  })

/** Starts the mini game in `box` (`.nf-game`, with its canvas, start hint, sign link and game-over card). */
export const startRoute404 = async (box: HTMLElement, setup: RouteSetup) => {
  const canvas = box.querySelector('canvas')
  const ctx = canvas?.getContext('2d')
  const start = box.querySelector<HTMLElement>('.nf-start')
  const go = box.querySelector<HTMLAnchorElement>('.nf-go')
  const over = box.querySelector<HTMLElement>('.nf-over')
  if (!canvas || !ctx || !start || !go || !over) return
  const [player, foe] = await Promise.all([load(setup.player.src), load(setup.foe.src)])
  const foeWhite = silhouette(foe)
  const ps = setup.player.sheet
  const fs = setup.foe.sheet

  let width = 0
  let grass: HTMLCanvasElement | null = null
  let signs: Sign[] = []
  let near: Sign | null = null
  let best = readBest()

  const fresh = (): State => ({ phase: 'idle', t: 0, x: width / 2, y: HEIGHT / 2 + 12, row: 0, moving: false, hp: HEARTS, inv: 0, ko: 0, foes: [], shots: [], puffs: [] })
  let s = fresh()

  const keys = new Set<string>()
  let aim: { x: number; y: number } | null = null

  /** The route's grass and dirt path, baked once per size. */
  const bake = () => {
    const c = document.createElement('canvas')
    c.width = width
    c.height = HEIGHT
    const g = c.getContext('2d')!
    const r = rng(404)
    g.fillStyle = '#70b850'
    g.fillRect(0, 0, width, HEIGHT)
    for (let i = 0; i < (width * HEIGHT) / 14; i++) {
      g.fillStyle = r() > 0.5 ? '#80c860' : '#60a040'
      g.fillRect(Math.floor(r() * width), Math.floor(r() * HEIGHT), 1, 1)
    }
    g.fillStyle = '#4a8a30'
    for (let i = 0; i < (width * HEIGHT) / 260; i++) {
      const x = Math.floor(r() * width)
      const y = Math.floor(r() * HEIGHT)
      g.fillRect(x, y, 1, 2)
      g.fillRect(x + 2, y - 1, 1, 3)
      g.fillRect(x + 4, y, 1, 2)
    }
    const mid = Math.round(width / 2) - 10
    g.fillStyle = '#d8c088'
    g.fillRect(mid, 0, 20, HEIGHT)
    g.fillStyle = '#c8b078'
    for (let y = 0; y < HEIGHT; y += 5) g.fillRect(mid + ((y * 13) % 18), y, 2, 1)
    return c
  }

  /** Signs in the corners (three: the third at the bottom of the path). */
  const place = (): Sign[] => {
    const left = 18
    const right = width - 18
    const top = 36
    const bottom = HEIGHT - 8
    const spots = setup.exits.length > 3 ? [[left, top], [right, top], [left, bottom], [right, bottom]] : [[left, top], [right, top], [Math.round(width / 2), bottom]]
    return setup.exits.slice(0, spots.length).map((exit, i) => ({ ...exit, x: spots[i]![0]!, y: spots[i]![1]! }))
  }

  /** Integer zoom that fits the box (3× on wide screens, 2× on phones); the route's width follows. */
  const fit = () => {
    const zoom = box.clientWidth >= 640 ? 3 : 2
    width = Math.max(120, Math.floor(box.clientWidth / zoom))
    canvas.width = width
    canvas.height = HEIGHT
    canvas.style.width = `${width * zoom}px`
    canvas.style.height = `${HEIGHT * zoom}px`
    grass = bake()
    signs = place()
    s.x = Math.min(Math.max(s.x, 8), width - 8)
    if (s.phase === 'idle') s.x = width / 2
  }

  const spawn = () => {
    for (let tries = 0; tries < 6; tries++) {
      const side = Math.floor(Math.random() * 4)
      const x = side === 0 ? -10 : side === 1 ? width + 10 : Math.random() * width
      const y = side === 2 ? -12 : side === 3 ? HEIGHT + 12 : Math.random() * HEIGHT
      if (Math.hypot(x - s.x, y - s.y) < 60) continue
      s.foes.push({ x, y, hp: 2, hurt: 0, row: 0, phase: Math.random() * 60 })
      return
    }
  }

  const faint = () => {
    s.phase = 'over'
    const seconds = Math.floor(s.t / 60)
    if (seconds > best) {
      best = seconds
      try {
        localStorage.setItem(BEST_KEY, String(best))
      } catch {
        // Storage blocked: the record lasts this visit.
      }
    }
    const title = over.querySelector('.nf-over-title')
    if (title) title.textContent = (box.dataset.over ?? '').replace('{name}', setup.player.name)
    const stat = (name: string, value: string) => {
      const el = over.querySelector(`[data-stat="${name}"]`)
      if (el) el.textContent = value
    }
    stat('time', clock(s.t))
    stat('ko', String(s.ko))
    stat('best', clock(best * 60))
    near = null
    go.hidden = true
    over.hidden = false
    over.querySelector('button')?.focus({ preventScroll: true })
  }

  const step = () => {
    let mx = 0
    let my = 0
    for (const key of keys) {
      const dir = MOVE[key]
      if (!dir) continue
      mx += dir[0]
      my += dir[1]
    }
    if (aim) {
      const dx = aim.x - s.x
      const dy = aim.y - s.y
      if (Math.hypot(dx, dy) > 3) {
        mx = dx
        my = dy
      }
    }
    const len = Math.hypot(mx, my)
    s.moving = len > 0
    if (s.moving && s.phase === 'idle') {
      s.phase = 'run'
      start.hidden = true
    }
    if (s.phase !== 'run') return
    s.t++
    if (len > 0) {
      s.x = Math.min(Math.max(s.x + (mx / len) * 1.1, 8), width - 8)
      s.y = Math.min(Math.max(s.y + (my / len) * 1.1, TOP), HEIGHT - 2)
      s.row = rowOf(mx, my)
    }

    // The horde: Zubat from the edges, more and faster as the clock runs.
    if (s.t % Math.max(18, 60 - Math.floor(s.t / 120)) === 0) spawn()
    const speed = 0.45 + Math.min(0.35, s.t / 6000)
    for (const f of s.foes) {
      const dx = s.x - f.x
      const dy = s.y - 8 - f.y
      const d = Math.hypot(dx, dy) || 1
      f.x += (dx / d) * speed
      f.y += (dy / d) * speed + Math.sin((s.t + f.phase) / 9) * 0.25
      f.row = rowOf(dx, dy)
      if (f.hurt > 0) f.hurt--
      if (d < 10 && s.inv === 0) {
        s.hp--
        s.inv = 70
        if (s.hp <= 0) return faint()
      }
    }
    if (s.inv > 0) s.inv--

    // Ember: every 26 ticks at the nearest Zubat in range.
    if (s.t % 26 === 0) {
      let target: Foe | null = null
      let dist = 110
      for (const f of s.foes) {
        const d = Math.hypot(f.x - s.x, f.y - s.y)
        if (d >= dist) continue
        dist = d
        target = f
      }
      if (target) {
        const dx = target.x - s.x
        const dy = target.y - (s.y - 10)
        const d = Math.hypot(dx, dy) || 1
        s.shots.push({ x: s.x, y: s.y - 10, vx: (dx / d) * 2.4, vy: (dy / d) * 2.4, life: 50 })
      }
    }
    for (const shot of s.shots) {
      shot.x += shot.vx
      shot.y += shot.vy
      shot.life--
      const hit = s.foes.find((f) => f.hp > 0 && Math.abs(f.x - shot.x) < 7 && Math.abs(f.y - shot.y) < 7)
      if (!hit) continue
      hit.hp--
      hit.hurt = 8
      shot.life = 0
      if (hit.hp > 0) continue
      s.ko++
      s.puffs.push({ x: hit.x, y: hit.y, t: 0 })
    }
    s.shots = s.shots.filter((shot) => shot.life > 0)
    s.foes = s.foes.filter((f) => f.hp > 0)
    s.puffs = s.puffs.filter((p) => ++p.t < 14)
  }

  /** Standing on a sign offers its page (the link above the route; Enter follows it). */
  const checkSign = () => {
    // On the sign: feet from its board down to just below its post.
    const on = s.phase === 'over' ? null : (signs.find((sign) => Math.abs(sign.x - s.x) < 12 && s.y > sign.y - 22 && s.y < sign.y + 8) ?? null)
    if (on === near) return
    near = on
    go.hidden = !on
    if (!on) return
    go.href = on.href
    const label = go.querySelector('b')
    if (label) label.textContent = on.label
  }

  const drawSign = (sign: Sign) => {
    const x = Math.round(sign.x)
    const y = Math.round(sign.y)
    ctx.fillStyle = 'rgba(0,0,0,.2)'
    ctx.fillRect(x - 3, y, 6, 2)
    ctx.fillStyle = '#6a4424'
    ctx.fillRect(x - 1, y - 9, 2, 9)
    ctx.fillRect(x - 6, y - 20, 13, 12)
    ctx.fillStyle = sign.gold ? '#ffcb05' : '#f8f0d8'
    ctx.fillRect(x - 5, y - 19, 11, 10)
    pixels(ctx, ICONS[sign.icon], x - 3, y - 18)
  }

  const draw = () => {
    if (!grass) return
    ctx.drawImage(grass, 0, 0)
    signs.forEach(drawSign)
    // Back to front: the player and the Zubat sorted by their feet.
    const order = [...s.foes.map((f) => ({ y: f.y + 6, f })), { y: s.y, f: null }].sort((a, b) => a.y - b.y)
    for (const { f } of order) {
      if (f) {
        const x = Math.round(f.x)
        const y = Math.round(f.y)
        ctx.fillStyle = 'rgba(0,0,0,.18)'
        ctx.fillRect(x - 5, y + 10, 10, 2)
        const sx = frameAt(fs, s.t + Math.floor(f.phase)) * fs.frameWidth
        const sy = f.row * fs.frameHeight
        const dx = x - fs.frameWidth / 2
        const dy = y + 20 - fs.frameHeight
        ctx.drawImage(f.hurt > 0 ? foeWhite : foe, sx, sy, fs.frameWidth, fs.frameHeight, Math.round(dx), dy, fs.frameWidth, fs.frameHeight)
        continue
      }
      const x = Math.round(s.x)
      const y = Math.round(s.y)
      ctx.fillStyle = 'rgba(0,0,0,.22)'
      ctx.fillRect(x - 6, y - 2, 12, 3)
      if (s.inv > 0 && Math.floor(s.inv / 4) % 2 === 1) continue
      const column = s.moving ? frameAt(ps, s.t) : 0
      ctx.drawImage(player, column * ps.frameWidth, s.row * ps.frameHeight, ps.frameWidth, ps.frameHeight, Math.round(x - ps.frameWidth / 2), y + 2 - ps.frameHeight, ps.frameWidth, ps.frameHeight)
    }
    for (const shot of s.shots) {
      const x = Math.round(shot.x)
      const y = Math.round(shot.y)
      ctx.fillStyle = '#f85808'
      ctx.fillRect(x - 1, y - 1, 3, 3)
      ctx.fillStyle = '#ffd040'
      ctx.fillRect(x, y, 1, 1)
    }
    ctx.fillStyle = '#ffffff'
    for (const p of s.puffs) {
      const r = 2 + p.t / 2
      for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(p.x + Math.cos((i / 6) * Math.PI * 2) * r), Math.round(p.y + Math.sin((i / 6) * Math.PI * 2) * r), 1, 1)
    }
    // HUD: clock, hearts, KOs.
    text(ctx, clock(s.t), 3, 3)
    const hearts = Math.round(width / 2 - (HEARTS * 8 - 1) / 2)
    for (let i = 0; i < HEARTS; i++) pixels(ctx, i < s.hp ? HEART : HEART_EMPTY, hearts + i * 8, 3)
    const ko = `KO ${s.ko}`
    text(ctx, ko, width - 3 - textWidth(ko), 3)
  }

  // Fixed 60 Hz steps, so a 120 Hz screen plays at the same speed; paused while off screen or in a hidden tab.
  let visible = true
  let frame = 0
  let last = 0
  let lag = 0
  const loop = (now: number) => {
    lag = Math.min(lag + (last ? now - last : STEP), STEP * 5)
    last = now
    while (lag >= STEP) {
      step()
      lag -= STEP
    }
    checkSign()
    draw()
    frame = requestAnimationFrame(loop)
  }
  const run = () => {
    cancelAnimationFrame(frame)
    if (!visible || document.hidden) return
    last = 0
    frame = requestAnimationFrame(loop)
  }
  new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true
    run()
  }).observe(box)
  document.addEventListener('visibilitychange', () => {
    keys.clear()
    run()
  })

  const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  window.addEventListener('keydown', (e) => {
    if (!visible || typing(e.target) || e.altKey || e.ctrlKey || e.metaKey) return
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && near && s.phase !== 'over') {
      location.href = near.href
      return
    }
    if (!MOVE[e.code] || s.phase === 'over') return
    e.preventDefault()
    keys.add(e.code)
  })
  window.addEventListener('keyup', (e) => keys.delete(e.code))
  window.addEventListener('blur', () => keys.clear())

  const toRoute = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * width, y: ((e.clientY - rect.top) / rect.height) * HEIGHT }
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (s.phase === 'over') return
    aim = toRoute(e)
    canvas.setPointerCapture(e.pointerId)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (aim) aim = toRoute(e)
  })
  const release = () => {
    aim = null
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())

  over.querySelector('button')?.addEventListener('click', () => {
    s = fresh()
    over.hidden = true
    start.hidden = false
  })

  new ResizeObserver(() => fit()).observe(box)
  fit()
  box.classList.add('is-ready')
  run()
}
