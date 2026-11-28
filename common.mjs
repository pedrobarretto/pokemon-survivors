import { chromium } from '/home/pedro/.t3/worktrees/pokemon-survivors/pedro-wav-154-canvases--d14516d1fcba06e4/node_modules/playwright/index.mjs'
export const open = async (port = 5175) => {
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] })
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 739 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
  })
  // The next run's seed is Date.now() as the game's main module loads (planRun): held at a fixed
  // instant until the game is up, so every measured run plays the same map, cast and biomes.
  await ctx.addInitScript(() => {
    const real = Date.now.bind(Date)
    let fixed = true
    Date.now = () => (fixed ? 1764338400000 : real())
    window.__unfixDate = () => { fixed = false }
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)) })
  await page.goto(`http://localhost:${port}/`)
  await page.waitForFunction(() => window.ps, null, { timeout: 90000 })
  await page.evaluate(() => window.__unfixDate())
  await page.waitForTimeout(4000)
  await page.evaluate(() => {
    // resolve "at http://.../x.ts:L:C" to the transformed source line
    const cache = new Map()
    window.__site = async (at) => {
      const m = /(http:\/\/[^ )]+?):(\d+):(\d+)/.exec(at); if (!m) return at
      let src = cache.get(m[1]); if (!src) { src = (await (await fetch(m[1])).text()).split('\n'); cache.set(m[1], src) }
      return m[1].replace(/.*\/src\//, '') + ':' + m[2] + ' ' + (src[+m[2] - 1] ?? '').trim().slice(0, 90)
    }
    window.__snap = async (label, full) => {
      const c = ps.canvases(); const g = ps.run()?.game
      const by = await Promise.all(c.by.sort((a, b) => b.canvases - a.canvases).slice(0, full ? 40 : 10).map(async (b) => `${b.canvases} ${(b.bytes / 1048576).toFixed(1)}MB ${await __site(b.at)}`))
      return { label, t: g ? Math.round(g.time) : null, canvases: c.total.canvases, mb: +(c.total.bytes / 1048576).toFixed(1), heap: +((performance.memory?.usedJSHeapSize ?? 0) / 1048576).toFixed(1), enemies: g?.enemies.length, attacks: g?.attacks.length, boss: g ? (g.enemies.find((e) => e.id === g.bossId)?.kind ?? null) : null, by }
    }
    window.__god = () => setInterval(() => { const g = ps.run()?.game; if (g) for (const p of g.players) { p.stats.damageTaken = 0; p.hp = p.stats.maxHp } }, 100)
  })
  return { browser, page }
}
