// Prints and a short video of a boss wave and a raid with the canvas counter on screen.
// Usage: node prints.mjs <port> <label> <outdir>
import { chromium } from '/home/pedro/.t3/worktrees/pokemon-survivors/pedro-wav-154-canvases--d14516d1fcba06e4/node_modules/playwright/index.mjs'
import fs from 'node:fs'
const [port, label, out] = [+process.argv[2], process.argv[3], process.argv[4]]
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] })
const ctx = await browser.newContext({
  viewport: { width: 430, height: 739 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
  recordVideo: { dir: out, size: { width: 430, height: 739 } },
})
await ctx.addInitScript(() => { const real = Date.now.bind(Date); let fixed = true; Date.now = () => (fixed ? 1764338400000 : real()); window.__unfixDate = () => { fixed = false } })
const page = await ctx.newPage()
await page.goto(`http://localhost:${port}/`)
await page.waitForFunction(() => window.ps, null, { timeout: 90000 })
await page.evaluate(() => window.__unfixDate())
await page.waitForTimeout(3000)
await page.evaluate((label) => {
  const box = document.createElement('div')
  box.style.cssText = 'position:fixed;left:4px;top:120px;z-index:99999;background:rgba(0,0,0,.78);color:#7f7;font:12px/1.3 monospace;padding:4px 6px;border-radius:4px;pointer-events:none;white-space:pre'
  document.body.appendChild(box)
  let peak = 0, peakMb = 0
  setInterval(() => {
    const t = ps.canvases().total; const mb = t.bytes / 1048576
    peak = Math.max(peak, t.canvases); peakMb = Math.max(peakMb, mb)
    const g = ps.run()?.game
    const boss = g ? (g.enemies.find((e) => e.id === g.bossId)?.kind ?? '-') : '-'
    box.textContent = `${label}\ncanvas: ${t.canvases} (${mb.toFixed(1)} MB, peak ${peakMb.toFixed(1)} MB / ${peak})\nt ${g ? Math.floor(g.time / 60) + ':' + String(Math.floor(g.time % 60)).padStart(2, '0') : '-'} · boss ${boss}${g?.raid.arena ? ' · raid' : ''}${g?.rift.arena ? ' · rift' : ''}\nfoes ${g?.enemies.length ?? 0} · shots ${g?.attacks.length ?? 0}`
  }, 500)
}, label)
const pick = async () => { if (await page.evaluate(() => { const p = ps.run()?.game?.phase; return p && p !== 'playing' && p !== 'paused' && p !== 'evolving' })) await page.keyboard.press('1') }
await page.evaluate(() => { ps.captureAll(); ps.legend('rayquaza') })
await page.waitForFunction(() => ps.run()?.game, null, { timeout: 90000 })
for (let i = 0; i < 15; i++) { await page.waitForTimeout(600); await pick() }
await page.evaluate(() => { setInterval(() => { const g = ps.run()?.game; if (g) for (const p of g.players) { p.stats.damageTaken = 0; p.hp = p.stats.maxHp } }, 100); ps.awaken(); ps.awaken() })
for (let i = 0; i < 8; i++) { await page.waitForTimeout(600); await pick() }
await page.evaluate(() => { for (const m of ['dragonAscent','swift','thunder','flamethrower','iceBeam','hyperBeam']) try { ps.learn(m, 8) } catch {} })
await page.evaluate(() => ps.endless(19.5))
const tick = async (ms) => { for (let t = 0; t < ms; t += 700) { await page.waitForTimeout(700); await pick() } }
await tick(5000)
await page.evaluate(() => ps.reaper())
await tick(40000)
await page.screenshot({ path: `${out}/${label}-boss-arceus.png` })
await page.evaluate(() => ps.tera('enter', 'raidCharizard', 'fire', 6))
await tick(25000)
await page.screenshot({ path: `${out}/${label}-raid.png` })
await page.evaluate(() => ps.tera('shield'))
await tick(20000)
await page.screenshot({ path: `${out}/${label}-after-raid.png` })
const video = page.video()
await ctx.close()
fs.renameSync(await video.path(), `${out}/${label}-boss-raid.webm`)
await browser.close()
