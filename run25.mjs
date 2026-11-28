// 25-minute legend run, iPhone emulation. Usage: node run25.mjs <out.jsonl> [minutes]
import { open } from './common.mjs'
import fs from 'node:fs'
const out = process.argv[2]; const MIN = +(process.argv[3] ?? 25); const PORT = +(process.argv[4] ?? 5175)
fs.writeFileSync(out, '')
const { browser, page } = await open(PORT)
const write = (o) => fs.appendFileSync(out, JSON.stringify(o) + '\n')
const snap = async (l, full) => { const s = await page.evaluate(([l, f]) => __snap(l, f), [l, full]); s.wall = Math.round((Date.now() - t0) / 1000); write(s); console.log(s.wall, s.label, s.t, s.canvases, s.mb, s.heap, s.enemies, s.attacks, s.boss) }
let t0 = Date.now()
await snap('title', true)
await page.evaluate(() => { ps.captureAll(); ps.legend('rayquaza') })
await page.waitForFunction(() => ps.run()?.game, null, { timeout: 90000 })
for (let i = 0; i < 20; i++) { await page.waitForTimeout(700); if (await page.evaluate(() => ps.run().game.phase !== 'playing')) await page.keyboard.press('1') }
t0 = Date.now()
await page.evaluate(() => { __god(); ps.awaken(); ps.awaken() })
const PICK = new Set(['levelup', 'branch', 'ability', 'curse', 'tm', 'pokeball'])
const script = [ // wall-clock minute -> action
  [1, "for (const m of ['dragonAscent','swift','thunder','flamethrower','iceBeam','hyperBeam']) try { ps.learn(m, 8) } catch {}"],
  [3, "ps.boss('entei')"],
  [6, "ps.tera('enter', 'raidCharizard', 'fire', 6)"],
  [9, "ps.boss('raikou')"],
  [11, "ps.rift('kyogre')"],
  [12, "ps.riftAct('battle', 2)"],
  [13.5, "ps.riftAct('capture')"],
  [15, "ps.tera('enter', 'raidDragonite', 'dragon', 6)"],
  [17, "ps.boss('suicune')"],
  [19, "ps.victory()"],
  [21, "ps.reaper()"],
]
let done = 0, lastMin = -1, lastHalf = -1
while (true) {
  await page.waitForTimeout(700)
  const st = await page.evaluate(() => { const g = ps.run()?.game; return g ? { t: g.time, phase: g.phase, raid: !!g.raid?.arena, endless: !!g.endless, inDomain: !!g.rift?.arena } : null }).catch(() => null)
  if (!st) continue
  if (PICK.has(st.phase)) { await page.keyboard.press('1'); continue }
  if (st.phase === 'victory') { await page.evaluate(() => ps.endless(ps.run().game.time / 60)); write({ label: 'endless', t: st.t }); continue }
  if (st.phase === 'gameover') { write({ label: 'GAMEOVER', t: st.t }); console.log('GAMEOVER'); break }
  const wallMin = (Date.now() - t0) / 60000
  while (done < script.length && wallMin >= script[done][0]) { const code = script[done][1]; await page.evaluate(code).catch((e) => console.log('ERR', code, e.message)); write({ label: 'act', code, t: st.t, wall: Math.round(wallMin * 60) }); console.log('act', code); done++ }
  const half = Math.floor(wallMin * 2)
  if (half !== lastHalf) { lastHalf = half; const full = Math.floor(wallMin) !== lastMin; lastMin = Math.floor(wallMin); await snap(`m${(half / 2).toFixed(1)}${st.raid ? ' raid' : ''}${st.inDomain ? ' rift' : ''}${st.endless ? ' endless' : ''}`, full) }
  if (wallMin >= MIN) break
}
await page.screenshot({ path: out.replace('.jsonl', '.png') })
await browser.close()
