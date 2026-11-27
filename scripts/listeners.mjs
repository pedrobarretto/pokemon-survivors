// WAV-17 diagnosis: which call sites add event listeners (and DOM nodes) that stay during a run.
//   node listeners.mjs [gameMinutes=4] [speed=3]
import { chromium, devices } from '/home/pedro/.t3/worktrees/pokemon-survivors/pedro-wav-17-jogo-fecha-88b89e9cc5c49007/node_modules/playwright/index.mjs'

const MINUTES = Number(process.argv[2] ?? 4)
const SPEED = Number(process.argv[3] ?? 3)
const browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] })
const ctx = await browser.newContext({ ...devices['Pixel 7'] })
await ctx.addInitScript((speed) => {
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => raf((t) => cb(t * speed))
  const now = performance.now.bind(performance)
  performance.now = () => now() * speed
  // Live listeners by call site: a WeakRef per target, so collected targets drop out.
  const live = new Map()
  window.__listeners = live
  const add = EventTarget.prototype.addEventListener
  const remove = EventTarget.prototype.removeEventListener
  const key = (t, type, fn) => `${type}`
  const regs = []
  window.__regs = regs
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    const stack = (new Error().stack ?? '').split('\n').slice(2, 5).map((l) => l.trim().replace(/https?:\/\/localhost:\d+\//, '').replace(/\?[^:]*/, '')).join(' < ')
    regs.push({ target: new WeakRef(this), type, fn: new WeakRef(fn), site: `${type} @ ${stack}`, node: this.constructor?.name, gone: false })
    return add.call(this, type, fn, opts)
  }
  EventTarget.prototype.removeEventListener = function (type, fn, opts) {
    for (const r of regs) if (!r.gone && r.type === type && r.target.deref() === this && r.fn.deref() === fn) { r.gone = true; break }
    return remove.call(this, type, fn, opts)
  }
}, SPEED)
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 200)))
await page.goto('http://localhost:5175/', { waitUntil: 'load' })
await page.waitForFunction(() => window.ps, null, { timeout: 60000 })
await page.waitForTimeout(2000)
await page.evaluate(() => window.ps.startRun('charmander'))
await page.waitForFunction(() => window.ps.run()?.game, null, { timeout: 60000 })

const report = async (label) => {
  await page.evaluate(() => window.gc?.())
  await page.waitForTimeout(200)
  await page.evaluate(() => window.gc?.())
  const r = await page.evaluate(() => {
    const by = new Map()
    let alive = 0
    for (const r of window.__regs) {
      if (r.gone) continue
      const t = r.target.deref()
      if (!t) continue
      const connected = t === window || t === document || !(t instanceof Node) || t.isConnected
      alive++
      const k = `${connected ? 'attached' : 'DETACHED'} ${r.node} ${r.site}`
      by.set(k, (by.get(k) ?? 0) + 1)
    }
    const nodes = document.getElementsByTagName('*').length
    return { alive, nodes, top: [...by].sort((a, b) => b[1] - a[1]).slice(0, 25) }
  })
  console.log(`== ${label}: ${r.alive} live listeners, ${r.nodes} attached elements`)
  for (const [k, n] of r.top) console.log(String(n).padStart(5), k.slice(0, 260))
  return r
}

await report('start')
let picks = 0
for (;;) {
  const s = await page.evaluate(() => {
    const g = window.ps.run()?.game
    if (!g) return null
    g.player.hp = g.player.stats.maxHp
    g.player.iframes = 5
    return { t: g.time, phase: g.phase }
  })
  if (!s || s.t > MINUTES * 60) break
  if (s.phase !== 'playing' && s.phase !== 'evolving') { picks++; await page.keyboard.press('Enter') }
  await page.waitForTimeout(150)
}
console.log('picks', picks)
await report(`after ${MINUTES} game min`)
await browser.close()
