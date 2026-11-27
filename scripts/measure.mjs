// WAV-17: plays a long run on an emulated phone and samples memory as it goes.
//   node measure.mjs <label> [minutes=16.5] [speed=3]
// Game clock sped up by scaling requestAnimationFrame's timestamps (the shell's dt follows them).
// Bot: invulnerable (hp refilled), picks the first card with Enter, walks in long straight legs
// (crosses biomes). Rifts forced with ps.rift at 6:00, 10:00 and 13:00, each played through
// battle 2 and capture. Natural waves bring the bosses (2:30, 5:00, 7:00, 9:30, 12:00, 15:00) and the rings.
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium, devices } from '/home/pedro/.t3/worktrees/pokemon-survivors/pedro-wav-17-jogo-fecha-88b89e9cc5c49007/node_modules/playwright/index.mjs'

const label = process.argv[2] ?? 'run'
const MINUTES = Number(process.argv[3] ?? 16.5)
const SPEED = Number(process.argv[4] ?? 3)
const out = `/home/pedro/.t3/worktrees/pokemon-survivors/pedro-wav-17-jogo-fecha-88b89e9cc5c49007/.evidence/${label}`
mkdirSync(out, { recursive: true })
const TAG = `wav17tag${label}`

const browser = await chromium.launch({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc', `--${TAG}`] })
const ctx = await browser.newContext({ ...devices['Pixel 7'], recordVideo: process.env.VIDEO ? { dir: out, size: { width: 412, height: 915 } } : undefined })
await ctx.addInitScript((speed) => {
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => raf((t) => cb(t * speed))
  const now = performance.now.bind(performance)
  // The shell compares rAF stamps with performance.now in places: scale both.
  performance.now = () => now() * speed
}, SPEED)
if (process.env.DIAG) await ctx.addInitScript(() => {
  // Every canvas and image made, by call site, held weakly: what's alive after a GC is what something keeps.
  const made = []
  window.__made = made
  const site = () => (new Error().stack ?? '').split('\n').slice(3, 6).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/localhost:\d+\//, '').replace(/\?[^:]*/, '')).join(' < ')
  const ce = Document.prototype.createElement
  Document.prototype.createElement = function (tag, o) {
    const el = ce.call(this, tag, o)
    if (String(tag).toLowerCase() === 'canvas') made.push({ ref: new WeakRef(el), site: site(), kind: 'canvas' })
    return el
  }
  const OrigImage = window.Image
  window.Image = function (w, h) { const img = new OrigImage(w, h); made.push({ ref: new WeakRef(img), site: site(), kind: 'img' }); return img }
  window.Image.prototype = OrigImage.prototype
  window.__alive = () => {
    const by = new Map()
    let cb = 0, cn = 0, ib = 0, inn = 0
    for (let i = made.length - 1; i >= 0; i--) {
      const m = made[i]
      const el = m.ref.deref()
      if (!el) { made.splice(i, 1); continue }
      const w = m.kind === 'canvas' ? el.width : el.naturalWidth, h = m.kind === 'canvas' ? el.height : el.naturalHeight
      const bytes = w * h * 4
      if (m.kind === 'canvas') { cb += bytes; cn++ } else { ib += bytes; inn++ }
      const k = `${m.kind} ${m.kind === 'img' ? (el.src || '').replace(/^.*\/assets\//, '').replace(/\/[^/]*$/, '/*').replace(/pokemon\/\d+.*/, 'pokemon/<dex>/*') : m.site}`
      const e = by.get(k) ?? { n: 0, bytes: 0 }
      e.n++; e.bytes += bytes
      by.set(k, e)
    }
    return { canvases: cn, canvasMb: +(cb / 1048576).toFixed(1), images: inn, imageMb: +(ib / 1048576).toFixed(1), top: [...by].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 12).map(([k, v]) => `${(v.bytes / 1048576).toFixed(1)}MB ${v.n}x ${k}`) }
  }
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => { errors.push(e.message); console.log('pageerror', e.message.slice(0, 300)) })
page.on('crash', () => { errors.push('PAGE CRASHED'); console.log('PAGE CRASHED') })
const cdp = await ctx.newCDPSession(page)
await cdp.send('Performance.enable')

/** PSS (MB) of the browser's process tree, by process type. */
const pss = () => {
  const main = execSync(`pgrep -f -- '--${TAG}' | head -1`).toString().trim()
  const tree = execSync(`ps -e -o pid=,ppid=,args=`).toString().trim().split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
  const kids = new Map()
  for (const [, pid, ppid] of tree) (kids.get(ppid) ?? kids.set(ppid, []).get(ppid)).push(pid)
  const all = []
  const walk = (p) => { all.push(p); for (const k of kids.get(p) ?? []) walk(k) }
  walk(main)
  const by = { renderer: 0, gpu: 0, other: 0 }
  for (const pid of all) {
    const args = tree.find((t) => t[1] === pid)?.[3] ?? ''
    let kb = 0
    try { kb = Number(readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8').match(/^Pss:\s+(\d+)/m)?.[1] ?? 0) } catch {}
    const type = args.includes('--type=renderer') ? 'renderer' : args.includes('--type=gpu-process') ? 'gpu' : 'other'
    by[type] += kb / 1024
  }
  return { renderer: Math.round(by.renderer), gpu: Math.round(by.gpu), total: Math.round(by.renderer + by.gpu + by.other) }
}

await page.goto(process.env.URL ?? 'http://localhost:5175/', { waitUntil: 'load' })
await page.waitForFunction(() => window.ps, null, { timeout: 60000 })
await page.waitForTimeout(2000)
await page.evaluate(() => { localStorage.setItem('ps:safe', 'off'); window.ps.quality('full') })
await page.evaluate(() => window.ps.startRun('charmander'))
await page.waitForFunction(() => window.ps.run()?.game, null, { timeout: 60000 })

const state = () => page.evaluate(() => {
  const r = window.ps.run()
  const g = r?.game
  if (!g) return null
  g.player.hp = g.player.stats.maxHp; g.player.iframes = 5
  return { c: g.now, t: g.time, phase: g.phase, rift: g.rift.arena ? g.rift.arena.legend : null, place: g.place.inside?.id ?? null, biome: g.player.biome, enemies: g.enemies.length, level: g.player.level }
})

const sample = async () => {
  await page.evaluate(() => window.gc?.())
  const m = await page.evaluate(() => {
    const c = window.ps.canvases()
    const s = window.ps.sprites()
    const mem = performance.memory
    const alive = window.__alive?.() ?? null
    return { alive, canvases: c.total.canvases, canvasMb: +(c.total.bytes / 1048576).toFixed(1), by: c.by.slice(0, 6), sheets: s, heapMb: mem ? +(mem.usedJSHeapSize / 1048576).toFixed(1) : null }
  })
  const dom = await cdp.send('Memory.getDOMCounters')
  return { ...m, nodes: dom.nodes, listeners: dom.jsEventListeners, pss: pss() }
}

const DIRS = [['ArrowUp'], ['ArrowRight'], ['ArrowDown'], ['ArrowLeft'], ['ArrowUp', 'ArrowRight'], ['ArrowDown', 'ArrowLeft']]
let held = []
let leg = 0
const steer = async () => {
  for (const k of held) await page.keyboard.up(k)
  held = DIRS[leg++ % DIRS.length]
  for (const k of held) await page.keyboard.down(k)
}

const RIFTS = [
  { at: 360, legend: 'kyogre' },
  { at: 600, legend: 'lugia' },
  { at: 780, legend: 'palkia' },
]
const TRIPS = [{ at: 230, biome: 'cave' }, { at: 470, biome: 'snow' }, { at: 700, biome: 'tower' }, { at: 880, biome: 'desert' }]
const rows = []
let nextSample = 0
let nextSteer = 0
const startedAt = Date.now()
let lastT = -1
let stuck = 0
for (;;) {
  const s = await state().catch((e) => (errors.push(String(e)), null))
  if (!s) break
  if (s.c >= MINUTES * 60) break
  if (s.phase !== 'playing' && s.phase !== 'evolving') await page.keyboard.press('Enter')
  if (s.phase === 'gameover' || s.phase === 'victory') { console.log('ended', s.phase); break }
  for (const r of RIFTS) {
    if (!r.entered && s.c >= r.at && !s.rift) { r.entered = s.c; await page.evaluate((l) => window.ps.rift(l), r.legend); console.log('rift', r.legend, s.c) }
    if (r.entered && !r.b2 && s.c >= r.entered + 25) { r.b2 = true; await page.evaluate(() => window.ps.riftAct('battle', 2)).catch(() => {}) }
    if (r.entered && !r.cap && s.c >= r.entered + 50) { r.cap = true; await page.evaluate(() => window.ps.riftAct('capture')).catch(() => {}) }
  }
  for (const b of TRIPS) if (!b.done && s.c >= b.at && !s.rift) { b.done = true; await page.evaluate((x) => window.ps.biome(x), b.biome); console.log('trip', b.biome, s.c) }
  if (s.c >= nextSteer) { nextSteer = s.c + 20; await steer() }
  if (s.c >= nextSample) {
    nextSample = s.c + 15
    const m = await sample()
    const row = { real: Math.round((Date.now() - startedAt) / 1000), ...s, ...m }
    rows.push(row)
    console.log(`clock ${(s.c / 60).toFixed(2)} run ${(s.t / 60).toFixed(2)}min ${s.phase} rift=${s.rift} place=${s.place} biome=${s.biome} enem=${s.enemies} | canv ${m.canvases} ${m.canvasMb}MB | sheets ${m.sheets.variants}v ${m.sheets.MB}MB sil ${m.sheets.overlays?.MB}MB | heap ${m.heapMb} | renderer ${m.pss.renderer} gpu ${m.pss.gpu} total ${m.pss.total} | nodes ${m.nodes} lst ${m.listeners}${m.alive ? ` | ALIVE canv ${m.alive.canvases} ${m.alive.canvasMb}MB img ${m.alive.images} ${m.alive.imageMb}MB` : ''}`)
    if (m.alive && Math.round(s.c) % 60 < 15) for (const l of m.alive.top) console.log('   ', l)
    if (Math.round(s.c) % 120 < 15) await page.screenshot({ path: `${out}/c${Math.round(s.c)}.png` })
  }
  if (s.c === lastT && s.phase === 'playing') { if (++stuck > 50) { console.log('stuck'); break } } else stuck = 0
  lastT = s.c
  await page.waitForTimeout(150)
}
await page.screenshot({ path: `${out}/end.png` })
writeFileSync(`${out}/samples.json`, JSON.stringify({ label, speed: SPEED, device: 'Pixel 7 (Playwright emulation, Chromium headless)', errors, rows }, null, 1))
await ctx.close()
await browser.close()
console.log('done', rows.length, 'samples', errors.length, 'errors')
