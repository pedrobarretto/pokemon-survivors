// WAV-17 diagnosis: Chromium memory-infra dumps of the renderer during a run, by allocator.
//   URL=http://localhost:5176/ node memdump.mjs <label> [minutes=6] [speed=3]
import { writeFileSync } from 'node:fs'
import { chromium, devices } from '/home/pedro/.t3/worktrees/pokemon-survivors/pedro-wav-17-jogo-fecha-88b89e9cc5c49007/node_modules/playwright/index.mjs'

const label = process.argv[2] ?? 'dump'
const MINUTES = Number(process.argv[3] ?? 6)
const SPEED = Number(process.argv[4] ?? 3)
const browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] })
const ctx = await browser.newContext({ ...devices['Pixel 7'] })
await ctx.addInitScript((speed) => {
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => raf((t) => cb(t * speed))
  const now = performance.now.bind(performance)
  performance.now = () => now() * speed
}, SPEED)
const page = await ctx.newPage()
const bcdp = await browser.newBrowserCDPSession()

/** One memory-infra dump: each process's allocators (top-level and a level below), MB. */
const dump = async () => {
  const events = []
  bcdp.on('Tracing.dataCollected', (e) => events.push(...e.value))
  await bcdp.send('Tracing.start', {
    traceConfig: { includedCategories: ['disabled-by-default-memory-infra'], excludedCategories: ['*'], memoryDumpConfig: { triggers: [] } },
    transferMode: 'ReportEvents',
  })
  const r = await bcdp.send('Tracing.requestMemoryDump', { deterministic: true, levelOfDetail: 'detailed' })
  const done = new Promise((res) => bcdp.once('Tracing.tracingComplete', res))
  await bcdp.send('Tracing.end')
  await done
  bcdp.removeAllListeners('Tracing.dataCollected')
  const procs = new Map()
  for (const e of events) if (e.ph === 'M' && e.name === 'process_name') procs.set(e.pid, e.args.name)
  const out = {}
  for (const e of events) {
    if (e.ph !== 'v' || !e.args?.dumps?.allocators) continue
    const name = procs.get(e.pid) ?? String(e.pid)
    const a = e.args.dumps.allocators
    const sizes = {}
    for (const [k, v] of Object.entries(a)) {
      const depth = k.split('/').length
      if (k.startsWith('cc/image_memory/') && depth > 2) {
        const s = v.attrs?.size?.value
        ;(out.__cc ??= []).push([k, s ? parseInt(s, 16) : 0, JSON.stringify(v.attrs).slice(0, 300)])
        continue
      }
      if (depth > 2) continue
      const s = v.attrs?.effective_size?.value ?? v.attrs?.size?.value
      if (!s) continue
      sizes[k] = +(parseInt(s, 16) / 1048576).toFixed(1)
    }
    const pss = e.args.dumps.process_totals?.private_footprint_bytes
    out[`${name}:${e.pid}`] = { footprintMb: pss ? +(parseInt(pss, 16) / 1048576).toFixed(1) : null, sizes }
  }
  return { ok: r.success, out }
}

await page.goto(process.env.URL ?? 'http://localhost:5175/', { waitUntil: 'load' })
await page.waitForFunction(() => window.ps, null, { timeout: 60000 })
await page.waitForTimeout(2000)
await page.evaluate(() => window.ps.startRun('charmander'))
await page.waitForFunction(() => window.ps.run()?.game, null, { timeout: 60000 })

const dumps = []
const take = async (at) => {
  await page.evaluate(() => window.gc?.())
  const d = await dump()
  dumps.push({ at, ...d })
  for (const [p, v] of Object.entries(d.out)) {
    if (!p.startsWith('Renderer')) continue
    const top = Object.entries(v.sizes).filter(([k]) => !k.includes('/')).sort((a, b) => b[1] - a[1]).slice(0, 12)
    console.log(`@${at}s ${p} footprint ${v.footprintMb}MB :: ${top.map(([k, s]) => `${k} ${s}`).join(' | ')}`)
  }
}
const TRIPS = [{ at: 120, biome: 'cave' }, { at: 200, biome: 'snow' }, { at: 280, biome: 'tower' }]
const marks = [30, ...Array.from({ length: Math.floor(MINUTES) }, (_, i) => (i + 1) * 60)]
for (;;) {
  const s = await page.evaluate(() => {
    const g = window.ps.run()?.game
    if (!g) return null
    g.player.hp = g.player.stats.maxHp
    g.player.iframes = 5
    return { c: g.now, phase: g.phase }
  })
  if (!s) break
  if (s.phase !== 'playing' && s.phase !== 'evolving') await page.keyboard.press('Enter')
  for (const b of TRIPS) if (!b.done && s.c >= b.at) { b.done = true; await page.evaluate((x) => window.ps.biome(x), b.biome) }
  if (marks.length && s.c >= marks[0]) await take(marks.shift())
  if (s.c > MINUTES * 60 + 5) break
  await page.waitForTimeout(200)
}
writeFileSync(`${label}.json`, JSON.stringify(dumps, null, 1))
await browser.close()
