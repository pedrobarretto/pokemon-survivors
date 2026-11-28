import { chromium } from '/home/pedro/.t3/worktrees/pokemon-survivors/pedro-wav-154-canvases--d14516d1fcba06e4/node_modules/playwright/index.mjs'
const [src, out] = process.argv.slice(2)
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 620 }, deviceScaleFactor: 2 })
await p.goto('file://' + src); await p.screenshot({ path: out }); await b.close()
