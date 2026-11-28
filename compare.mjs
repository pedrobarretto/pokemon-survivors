import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const ROOT = '/home/pedro/.t3/worktrees/pokemon-survivors/pedro-wav-16-barra-pret-38a06ac0dd218878'
const { chromium } = createRequire(ROOT + '/package.json')('playwright')
const E = ROOT + '/.evidence/'
const img = (f) => 'data:image/png;base64,' + readFileSync(E + f).toString('base64')
const cols = [
  ['before-ios-short-no-standalone-flag.png', 'ANTES (como no card)', 'viewport 793 numa tela 852: barra preta sob as abas'],
  ['before-ios-standalone-cold-start.png', 'ANTES (com a tentativa de 24/11)', 'camadas esticadas 59 px: o iOS não pinta abaixo de 793, as abas são cortadas'],
  ['after-ios-standalone-full-raw.png', 'DEPOIS', 'documento ≥ 100lvh: o iOS entrega a tela inteira, abas até a borda'],
]
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 3 * 393 + 4 * 16, height: 852 + 120 }, deviceScaleFactor: 1 })
await p.setContent(`<body style="margin:0;background:#2a2f3a;font:15px system-ui;color:#fff;display:flex;gap:16px;padding:16px">${cols.map(([f, t, s]) => `<figure style="margin:0;width:393px"><figcaption style="height:78px"><b style="font-size:18px">${t}</b><br>${s}</figcaption><img src="${img(f)}" style="width:393px;height:852px;display:block;outline:2px solid #000"></figure>`).join('')}</body>`)
await p.waitForTimeout(300)
await p.screenshot({ path: E + 'comparison.png', fullPage: true })
await b.close()
