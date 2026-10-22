#!/usr/bin/env node
/**
 * Cross-engine determinism: plays the same scripted solo runs
 * (`src/determinism/harness.ts`) in Node and in Chromium, Firefox and WebKit
 * (Playwright), hashing the full state every 60 ticks, and fails on the first
 * tick where an engine parts from Node, printing where the two states differ.
 *
 *   npm run determinism                         every engine, every run
 *   npm run determinism -- --engines=webkit     some engines (node is the reference, always)
 *   npm run determinism -- --runs=gible --minutes=3
 *   npm run determinism -- --shard=2/4          a quarter of the runs (CI plays the four side by side)
 *   npm run determinism -- diff a.bin b.bin     diff two saved snapshots
 *   npm run determinism -- bench               snapshot sizes and costs at minutes 5, 10, 15 and 25 (Node; --engines=… for browsers)
 *
 * On a mismatch both snapshots of the first differing tick land in
 * `determinism-out/` (`npm run determinism -- diff` reads them back).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import { build } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'node_modules', '.cache', 'determinism')
const bundlePath = join(outDir, 'harness.js')
const dumpDir = join(root, 'determinism-out')

const args = process.argv.slice(2)
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const ENGINES = ['chromium', 'firefox', 'webkit']

/** Bundles the harness once, so every engine runs the very same JavaScript. */
const bundle = async () => {
  await build({
    configFile: false,
    logLevel: 'warn',
    root,
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      target: 'es2022',
      lib: { entry: join(root, 'src/determinism/harness.ts'), formats: ['es'], fileName: () => 'harness.js' },
    },
  })
  return readFileSync(bundlePath, 'utf8')
}

const loadHarness = () => import(pathToFileURL(bundlePath).href)

/* ---------------- Engines ---------------- */

/** Node runs in a worker thread, so it plays alongside the browsers. */
const nodeEngine = () => {
  const worker = new Worker(
    `const { parentPort } = require('node:worker_threads');
     import(${JSON.stringify(pathToFileURL(bundlePath).href)}).then((H) => {
       parentPort.on('message', ({ id, fn, args }) => {
         try { parentPort.postMessage({ id, ok: H[fn](...args) }) } catch (e) { parentPort.postMessage({ id, error: String(e && e.stack || e) }) }
       })
       parentPort.postMessage({ ready: true })
     })`,
    { eval: true, resourceLimits: { maxYoungGenerationSizeMb: 64 } },
  )
  let next = 0
  const waiting = new Map()
  const ready = new Promise((resolve) => worker.once('message', resolve))
  worker.on('message', (m) => {
    if (m.ready) return
    const w = waiting.get(m.id)
    waiting.delete(m.id)
    if (m.error) w.reject(new Error(m.error))
    else w.resolve(m.ok)
  })
  return {
    name: 'node',
    version: process.version,
    call: async (fn, ...callArgs) => {
      await ready
      return new Promise((resolve, reject) => {
        const id = next++
        waiting.set(id, { resolve, reject })
        worker.postMessage({ id, fn, args: callArgs })
      })
    },
    close: () => worker.terminate(),
  }
}

/** A headless browser with the bundle loaded on a page of its own origin. */
const browserEngine = async (name, code) => {
  const playwright = await import('playwright')
  const browser = await playwright[name].launch()
  const page = await browser.newPage()
  await page.route('http://determinism.test/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/harness.js') return route.fulfill({ contentType: 'text/javascript', body: code })
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><script type="module">import * as H from '/harness.js'; window.H = H; window.ready = true</script>`,
    })
  })
  page.on('pageerror', (e) => console.error(`[${name}] ${e.message}`))
  await page.goto('http://determinism.test/')
  await page.waitForFunction(() => window.ready === true)
  return {
    name,
    version: browser.version(),
    call: (fn, ...callArgs) => page.evaluate(([f, a]) => window.H[f](...a), [fn, callArgs]),
    close: () => browser.close(),
  }
}

/* ---------------- Comparing ---------------- */

const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`

/**
 * Keeps shard `k` of `n` (`--shard=k/n`, 1-based): the runs go, heaviest first,
 * to the lightest shard so far (a run weighs its ticks times its players), and
 * keep their order within a shard.
 */
const shardOf = (runs, spec) => {
  if (spec === undefined) return runs
  const [k, n] = spec.split('/').map(Number)
  if (!Number.isInteger(k) || !Number.isInteger(n) || k < 1 || k > n) throw new Error(`bad --shard=${spec}, want k/n with 1 ≤ k ≤ n`)
  const weight = (run) => run.ticks * ('team' in run.scenario ? run.scenario.team.length : 1)
  const load = Array.from({ length: n }, () => 0)
  const shard = new Map()
  for (const i of [...runs.keys()].sort((a, b) => weight(runs[b]) - weight(runs[a]) || a - b)) {
    const lightest = load.indexOf(Math.min(...load))
    load[lightest] += weight(runs[i])
    shard.set(i, lightest + 1)
  }
  return runs.filter((_, i) => shard.get(i) === k)
}

/**
 * Finds the first tick where `engine` parts from `ref` inside (from, to],
 * saves both snapshots of it and prints where the states differ.
 */
const explain = async (H, ref, engine, run, from, to) => {
  const [a, b] = await Promise.all([ref.call('hashesBetween', run.scenario, from, to), engine.call('hashesBetween', run.scenario, from, to)])
  const i = a.findIndex(([, h], k) => b[k]?.[1] !== h)
  const tick = (a[i] ?? b[i] ?? a.at(-1))[0]
  const [sa, sb] = await Promise.all([ref.call('snapshotAt', run.scenario, tick), engine.call('snapshotAt', run.scenario, tick)])
  mkdirSync(dumpDir, { recursive: true })
  const fa = join(dumpDir, `${run.name}-${tick}-${ref.name}.bin`)
  const fb = join(dumpDir, `${run.name}-${tick}-${engine.name}.bin`)
  writeFileSync(fa, H.fromBase64(sa))
  writeFileSync(fb, H.fromBase64(sb))
  console.error(`\n✗ ${engine.name} parts from ${ref.name} in ${run.name} at tick ${tick} (${(tick / 3600).toFixed(2)} min); the tick before agrees.`)
  console.error(`  snapshots: ${fa}\n             ${fb}`)
  console.error(`  ${ref.name} ≠ ${engine.name}:`)
  for (const line of H.diffSnapshots(H.fromBase64(sa), H.fromBase64(sb))) console.error(`    ${line}`)
}

const check = async () => {
  const wanted = (flag('engines') ?? ENGINES.join(',')).split(',').filter((e) => e !== 'node')
  const unknown = wanted.filter((e) => !ENGINES.includes(e))
  if (unknown.length > 0) throw new Error(`unknown engines: ${unknown.join(', ')}`)
  const started = Date.now()
  const code = await bundle()
  const H = await loadHarness()
  const only = flag('runs')?.split(',')
  const minutes = flag('minutes') === undefined ? null : Number(flag('minutes'))
  const runs = shardOf(
    H.HARNESS_SCENARIOS.filter((r) => !only || only.some((o) => r.name.includes(o))).map((r) => ({ ...r, ticks: Math.round((minutes ?? r.minutes) * 3600) })),
    flag('shard'),
  )

  const ref = nodeEngine()
  const engines = await Promise.all(wanted.map((name) => browserEngine(name, code)))
  console.log(`engines: ${[ref, ...engines].map((e) => `${e.name} ${e.version}`).join(', ')}`)

  // Each engine plays every run on its own (the slowest sets the pace), then the results are compared run by run.
  const all = [ref, ...engines]
  const timings = new Map()
  let results
  try {
    results = await Promise.all(
      all.map(async (e) => {
        const t = Date.now()
        const out = []
        for (const run of runs) out.push(await e.call('runHashes', run.scenario, run.ticks))
        timings.set(e.name, Date.now() - t)
        return out
      }),
    )
    for (const [i, run] of runs.entries()) {
      const base = results[0][i]
      const { end } = base
      const parted = engines.flatMap((e, k) => {
        const r = results[k + 1][i]
        const at = base.hashes.findIndex(([tick, h], j) => r.hashes[j]?.[0] !== tick || r.hashes[j]?.[1] !== h)
        return at === -1 && r.hashes.length === base.hashes.length ? [] : [{ e, at: at === -1 ? base.hashes.length : at }]
      })
      console.log(
        `${parted.length > 0 ? '✗' : '✓'} ${run.name}: ${end.tick} ticks, ${base.hashes.length} hashes (${(end.time / 60).toFixed(1)} game min, ${end.phase}${end.endless ? ', endless' : ''}), ` +
          `level ${end.level}, stage ${end.stage}${end.branch ? ` (${end.branch})` : ''}${end.megas ? `, ${end.megas} Megas` : ''}, ${end.kills} kills, up to ${base.busiest} foes, ${end.biome}, ${end.rifts} rifts`,
      )
      for (const { e, at } of parted) await explain(H, ref, e, run, at === 0 ? 0 : base.hashes[at - 1][0], (base.hashes[at] ?? base.hashes.at(-1))[0])
      if (parted.length > 0) {
        console.log(`✗ mismatch in ${run.name}`)
        process.exitCode = 1
        return
      }
    }
  } finally {
    await Promise.all(all.map((e) => e.close()))
  }
  const hashes = results[0].reduce((n, r) => n + r.hashes.length, 0)
  const ticks = results[0].reduce((n, r) => n + r.end.tick, 0)
  const times = [...timings].map(([name, ms]) => `${name} ${seconds(ms)}`).join(', ')
  console.log(`✓ deterministic: ${runs.length} runs, ${ticks} ticks, ${hashes} hashes each, the same in ${all.map((e) => e.name).join(', ')} (${times}; ${seconds(Date.now() - started)} in all)`)
}

const diff = async ([a, b]) => {
  if (!a || !b) throw new Error('usage: npm run determinism -- diff a.bin b.bin')
  await bundle()
  const H = await loadHarness()
  const lines = H.diffSnapshots(new Uint8Array(readFileSync(a)), new Uint8Array(readFileSync(b)), 200)
  console.log(lines.length === 0 ? 'the same state' : lines.join('\n'))
}

const benchmark = async () => {
  const code = await bundle()
  const H = await loadHarness()
  const engines = [nodeEngine(), ...(await Promise.all((flag('engines')?.split(',') ?? []).filter((e) => e !== 'node').map((name) => browserEngine(name, code))))]
  const run = H.HARNESS_SCENARIOS.find((r) => !('team' in r.scenario))
  for (const e of engines) {
    const rows = await e.call('bench', run.scenario, [5, 10, 15, 25])
    console.log(`${e.name} ${e.version}, ${run.name}:`)
    console.table(rows.map((r) => ({ ...r, snapshotMs: +r.snapshotMs.toFixed(2), restoreMs: +r.restoreMs.toFixed(2), hashMs: +r.hashMs.toFixed(2) })))
  }
  await Promise.all(engines.map((e) => e.close()))
}

await (args[0] === 'diff' ? diff(args.slice(1)) : args[0] === 'bench' ? benchmark() : check())
