// `npm run skins [id...]`: bakes every skin in src/data/skins (or the ones
// named) into public/assets/skins, after a change to the propagation or to a
// species' sheets. The Ateliê bakes a skin on its own when it saves.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runnerImport } from 'vite'
import { ROOT, SKINS_DIR, bakeSkin } from './skinBake.mjs'

const { module: S } = await runnerImport('/src/skins/source.ts', { configFile: false, root: ROOT, logLevel: 'error' })
const wanted = process.argv.slice(2)
const files = (await readdir(SKINS_DIR)).filter((f) => f.endsWith('.json') && (!wanted.length || wanted.includes(f.slice(0, -5))))
for (const file of files) {
  const source = JSON.parse(await readFile(join(SKINS_DIR, file), 'utf8'))
  const t = performance.now()
  const report = await bakeSkin(S, source)
  const doubts = Object.entries(report).map(([k, n]) => `${k}${n ? ` (${n} frames in doubt)` : ''}`)
  console.log(`${source.id}: ${doubts.join(', ')} · ${Math.round(performance.now() - t)} ms`)
}
