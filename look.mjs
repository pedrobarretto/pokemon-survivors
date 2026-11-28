import { open } from './common.mjs'
const [port, out] = [+process.argv[2], process.argv[3]]
const { browser, page } = await open(port)
const pick = async () => { if (await page.evaluate(() => { const p = ps.run()?.game?.phase; return p && p !== 'playing' && p !== 'paused' && p !== 'evolving' })) await page.keyboard.press('1') }
await page.evaluate(() => { ps.startRun('charmander') })
await page.waitForFunction(() => ps.run()?.game, null, { timeout: 90000 })
await page.evaluate(() => __god())
for (let i = 0; i < 30; i++) { await page.waitForTimeout(700); await pick() }
await page.evaluate(() => { ps.terrain('cliff'); ps.event('chest'); ps.event('altar', -60, 20); ps.alpha() })
for (let i = 0; i < 8; i++) { await page.waitForTimeout(700); await pick() }
await page.screenshot({ path: out })
await browser.close()
