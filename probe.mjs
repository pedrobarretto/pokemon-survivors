import { open } from './common.mjs'
const { browser, page } = await open(+process.argv[2])
const pick = async () => { if (await page.evaluate(() => { const p = ps.run()?.game?.phase; return p && p !== 'playing' && p !== 'paused' && p !== 'evolving' })) await page.keyboard.press('1') }
await page.evaluate(() => { ps.captureAll(); ps.legend('rayquaza') })
await page.waitForFunction(() => ps.run()?.game, null, { timeout: 90000 })
for (let i = 0; i < 15; i++) { await page.waitForTimeout(600); await pick() }
await page.evaluate(() => { __god(); ps.awaken(); ps.awaken() })
for (let i = 0; i < 8; i++) { await page.waitForTimeout(600); await pick() }
await page.evaluate(() => { for (const m of ['dragonAscent','swift','thunder','flamethrower','iceBeam','hyperBeam']) try { ps.learn(m, 8) } catch {} ; ps.endless(19.5) })
for (let i = 0; i < 20; i++) { await page.waitForTimeout(700); await pick() }
await page.evaluate(() => ps.reaper())
for (let i = 0; i < 200; i++) { await page.waitForTimeout(700); await pick() }
const s = await page.evaluate(() => __snap('probe', true))
console.log(s.canvases, s.mb)
const all = await page.evaluate(async () => { const c = ps.canvases(); return Promise.all(c.by.sort((a, b) => b.canvases - a.canvases).map(async (b) => `${b.canvases} ${(b.bytes / 1048576).toFixed(2)} ${(await __site(b.at)).replace(/\?t=\d+/, '')}`)) })
console.log(all.join('\n'))
await browser.close()
