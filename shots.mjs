// Usage: node shots.mjs <label>   (before | after) — writes PNGs and a JSON of measurements into .evidence/
import { createRequire } from 'node:module'
import { writeFileSync, readFileSync } from 'node:fs'
const ROOT = '/home/pedro/.t3/worktrees/pokemon-survivors/pedro-wav-16-barra-pret-38a06ac0dd218878'
const require = createRequire(ROOT + '/package.json')
const { chromium } = require('playwright')
const label = process.argv[2]
const OUT = ROOT + '/.evidence/'
const URL = 'http://127.0.0.1:5175/'
const SCREEN = { width: 393, height: 852 } // iPhone 16
const SHORT = 793 // the layout viewport iOS 26 gives a cold-started installed app (852 - 59)
const b = await chromium.launch()

/** Opens the lobby. standalone: navigator.standalone + (display-mode: standalone). */
const open = async (viewport, { standalone, screen = SCREEN, insets = { top: 59, bottom: 34 } }) => {
  const ctx = await b.newContext({ viewport, screen, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await ctx.addInitScript((standalone) => {
    if (!localStorage.getItem('ps:save')) localStorage.setItem('ps:save', JSON.stringify({ version: 1, achievements: { lifetime: { runs: 2 } } }))
    localStorage.setItem('ps:onboarding', 'x')
    localStorage.setItem('ps:installNudge', JSON.stringify({ shown: true }))
    if (standalone) Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true })
  }, standalone)
  const p = await ctx.newPage()
  const cdp = await ctx.newCDPSession(p)
  try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets }) } catch (e) { console.log('no inset override:', e.message) }
  if (standalone) await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] })
  p.on('pageerror', (e) => console.log('ERR', e.message))
  await p.goto(URL, { waitUntil: 'load' })
  await p.waitForTimeout(1500)
  // Chromium can't emulate (display-mode: standalone): switch those rules on by hand, as the installed app matches them.
  if (standalone) console.log('  display-mode rules forced on:', await p.evaluate(() => {
    let n = 0
    for (const sheet of document.styleSheets) {
      try { for (const rule of sheet.cssRules) if (rule.media && /display-mode:\s*standalone/.test(rule.media.mediaText)) { rule.media.mediaText = 'all'; n++ } } catch {}
    }
    dispatchEvent(new Event('resize'))
    return n
  }))
  await p.waitForTimeout(2000)
  await p.mouse.click(viewport.width / 2, viewport.height * 0.7)
  await p.waitForTimeout(3500)
  return { ctx, p }
}

const measure = (p) => p.evaluate(() => {
  const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) } }
  const cs = getComputedStyle(document.documentElement)
  return {
    innerHeight, screenHeight: screen.height, standalone: navigator.standalone === true,
    displayModeStandalone: matchMedia('(display-mode: standalone)').matches,
    launchGap: cs.getPropertyValue('--launch-gap').trim(),
    htmlHeight: Math.round(document.documentElement.getBoundingClientRect().height),
    htmlScrollHeight: document.documentElement.scrollHeight,
    canvas: r('#game'), ui: r('#ui'), tabs: r('.lobby-tabs'),
    tabsPaddingBottom: document.querySelector('.lobby-tabs') && getComputedStyle(document.querySelector('.lobby-tabs')).paddingBottom,
    safeT: cs.getPropertyValue('--safe-t').trim(),
  }
})

/** What the iPhone shows: WebKit paints the page only down to the short edge; the screen below it is the page's background. */
const onPhone = async (png, shortH, file) => {
  const ctx = await b.newContext({ viewport: SCREEN, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  const src = 'data:image/png;base64,' + readFileSync(png).toString('base64')
  await p.setContent(`<body style="margin:0;background:#101820;width:${SCREEN.width}px;height:${SCREEN.height}px;overflow:hidden"><img src="${src}" style="display:block;width:${SCREEN.width}px;height:${shortH}px"></body>`)
  await p.waitForTimeout(200)
  await p.screenshot({ path: file })
  await ctx.close()
}

const report = {}
const shot = async (name, viewport, opts, phone) => {
  const { ctx, p } = await open(viewport, opts)
  report[name] = await measure(p)
  const raw = `${OUT}${label}-${name}-raw.png`
  await p.screenshot({ path: raw })
  if (phone) await onPhone(raw, viewport.height, `${OUT}${label}-${name}.png`)
  await ctx.close()
  console.log(name, JSON.stringify(report[name]))
}

// 1. The cold start iOS 26 gets wrong: layout viewport 59 px short of the screen, installed app.
await shot('ios-standalone-cold-start', { width: 393, height: SHORT }, { standalone: true }, true)
// 2. The same viewport without navigator.standalone (the 24/11 measure doesn't fire): the card's picture.
await shot('ios-short-no-standalone-flag', { width: 393, height: SHORT }, { standalone: false }, true)
// 3. Full screen (what a rotation leaves, and what iOS gives once the document is taller than the short viewport).
await shot('ios-standalone-full', SCREEN, { standalone: true })
// 4. A Safari tab (toolbars take the bottom): nothing may change there.
await shot('safari-tab', { width: 393, height: 659 }, { standalone: false })
// 5. Android installed app: nothing may change there.
await shot('android-standalone', { width: 412, height: 915 }, { standalone: true, screen: { width: 412, height: 915 }, insets: { top: 24, bottom: 0 } })
writeFileSync(`${OUT}${label}-measurements.json`, JSON.stringify(report, null, 2))
await b.close()
