// WAV-17: builds .evidence/comparison.html (+ comparison.md) from the before/after samples and memory dumps.
import { readFileSync, writeFileSync } from 'node:fs'

const EV = '/home/pedro/.t3/worktrees/pokemon-survivors/pedro-wav-17-jogo-fecha-88b89e9cc5c49007/.evidence'
const HERE = '/tmp/claude-1001/-home-pedro--t3-worktrees-pokemon-survivors-pedro-wav-17-jogo-fecha-88b89e9cc5c49007/63d19790-859c-4a12-8623-135c6ea0903f/scratchpad/m'
const runs = { before: JSON.parse(readFileSync(`${EV}/before/samples.json`, 'utf8')), after: JSON.parse(readFileSync(`${EV}/after/samples.json`, 'utf8')) }
const dumps = { before: JSON.parse(readFileSync(`${HERE}/dump-before.json`, 'utf8')), after: JSON.parse(readFileSync(`${HERE}/dump-after.json`, 'utf8')) }

/** Per clock minute: the peak of each metric over that minute's samples. */
const perMinute = (rows, pick) => {
  const by = new Map()
  for (const r of rows) {
    const m = Math.floor(r.c / 60)
    by.set(m, Math.max(by.get(m) ?? -Infinity, pick(r)))
  }
  return [...by].sort((a, b) => a[0] - b[0])
}
const METRICS = [
  { key: 'canvasMb', title: 'Memória de canvas (pico por minuto, MB)', unit: 'MB', pick: (r) => r.canvasMb },
  { key: 'canvases', title: 'Canvases vivos (pico por minuto)', unit: '', pick: (r) => r.canvases },
  { key: 'renderer', title: 'Memória do processo da aba (PSS do renderer, pico por minuto, MB)', unit: 'MB', pick: (r) => r.pss.renderer },
  { key: 'heap', title: 'Heap JS (performance.memory, pico por minuto, MB)', unit: 'MB', pick: (r) => r.heapMb },
  { key: 'sheets', title: 'Folhas de sprite seguras pelo jogo (MB)', unit: 'MB', pick: (r) => r.sheets.MB },
]
const ccSeries = (d) => d.map((x) => [x.at / 60, Object.entries(x.out).find(([k]) => k.startsWith('Renderer'))[1].sizes.cc ?? 0])

const series = METRICS.map((m) => ({ ...m, before: perMinute(runs.before.rows, m.pick), after: perMinute(runs.after.rows, m.pick) }))
series.push({ key: 'cc', title: 'Cache de imagens decodificadas do Chromium (cc/image_memory, MB) — dump memory-infra', unit: 'MB', before: ccSeries(dumps.before), after: ccSeries(dumps.after) })

const peak = (s) => Math.max(...s.map(([, v]) => v))
const last = (s) => s[s.length - 1][1]
const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

/** One small line chart (inline SVG), both runs on one y scale. */
const chart = (s) => {
  const W = 560, H = 220, L = 44, R = 64, T = 12, B = 28
  const all = [...s.before, ...s.after]
  const xMax = Math.max(...all.map(([x]) => x))
  const yMax = Math.max(...all.map(([, y]) => y)) * 1.1 || 1
  const x = (v) => L + (v / xMax) * (W - L - R)
  const y = (v) => T + (1 - v / yMax) * (H - T - B)
  const path = (pts) => pts.map(([a, b], i) => `${i ? 'L' : 'M'}${x(a).toFixed(1)},${y(b).toFixed(1)}`).join('')
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => yMax / 1.1 * k)
  const grid = ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 6}" y="${y(t) + 4}" class="tick" text-anchor="end">${fmt(Math.round(t))}</text>`).join('')
  const xt = Array.from({ length: Math.floor(xMax / 2) + 1 }, (_, i) => i * 2).map((m) => `<text x="${x(m)}" y="${H - 8}" class="tick" text-anchor="middle">${m}</text>`).join('')
  const dots = (pts, cls, who) => pts.map(([a, b]) => `<circle cx="${x(a)}" cy="${y(b)}" r="9" class="hit" data-tip="${who} · min ${fmt(a)}: ${fmt(b)} ${s.unit}"/><circle cx="${x(a)}" cy="${y(b)}" r="2.5" class="dot ${cls}"/>`).join('')
  const lab = (pts, cls, text) => { const [a, b] = pts[pts.length - 1]; return `<text x="${x(a) + 6}" y="${y(b) + 4}" class="lab">${text}</text>` }
  return `<figure><figcaption>${s.title}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${s.title}">
  ${grid}${xt}<text x="${W - R}" y="${H - 8}" class="tick" text-anchor="start" dx="4">min</text>
  <path d="${path(s.before)}" class="line before"/><path d="${path(s.after)}" class="line after"/>
  ${dots(s.before, 'before', 'Antes')}${dots(s.after, 'after', 'Depois')}
  ${lab(s.before, 'before', 'antes')}${lab(s.after, 'after', 'depois')}</svg></figure>`
}

const rows = series.map((s) => `<tr><td>${s.title}</td><td>${fmt(peak(s.before))}</td><td>${fmt(peak(s.after))}</td><td>${fmt(last(s.before))}</td><td>${fmt(last(s.after))}</td></tr>`).join('')
const minuteRows = (key) => {
  const s = series.find((x) => x.key === key)
  const mins = [...new Set([...s.before, ...s.after].map(([m]) => m))].sort((a, b) => a - b)
  return mins.map((m) => [m, s.before.find(([a]) => a === m)?.[1] ?? '', s.after.find(([a]) => a === m)?.[1] ?? ''])
}
const perMinTable = minuteRows('canvasMb').map(([m, b, a], i) => {
  const cb = minuteRows('canvases')[i]
  return `<tr><td>${m}</td><td>${b === '' ? '' : fmt(b)}</td><td>${a === '' ? '' : fmt(a)}</td><td>${cb[1]}</td><td>${cb[2]}</td></tr>`
}).join('')

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WAV-17 memória</title>
<style>
:root{--surface:#ffffff;--text:#191919;--text2:#666666;--grid:#e6e6e6;--before:#f47230;--after:#257de0}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--surface:#191919;--text:#efefef;--text2:#9c9c9c;--grid:#333333;--before:#e76624;--after:#338ced}}
:root[data-theme="dark"]{--surface:#191919;--text:#efefef;--text2:#9c9c9c;--grid:#333333;--before:#e76624;--after:#338ced}
body{background:var(--surface);color:var(--text);font:14px/1.45 system-ui,sans-serif;margin:0;padding:16px;max-width:1200px}
h1{font-size:20px;margin:0 0 4px}p{color:var(--text2);margin:4px 0 12px}
.grid-wrap{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
figure{margin:0}figcaption{font-weight:600;font-size:13px;margin-bottom:4px}svg{width:100%;height:auto;overflow:visible}
.grid{stroke:var(--grid);stroke-width:1}.tick{fill:var(--text2);font-size:11px}.lab{fill:var(--text);font-size:11px}
.line{fill:none;stroke-width:2;stroke-linejoin:round}.line.before{stroke:var(--before);stroke-dasharray:5 3}.line.after{stroke:var(--after)}
.dot.before{fill:var(--before)}.dot.after{fill:var(--after)}.hit{fill:transparent;cursor:crosshair}
.legend{display:flex;gap:16px;margin:8px 0 16px;color:var(--text)}.sw{display:inline-block;width:22px;height:0;border-top:2px solid;vertical-align:middle;margin-right:6px}
table{border-collapse:collapse;margin:8px 0 20px;font-variant-numeric:tabular-nums}td,th{border-bottom:1px solid var(--grid);padding:4px 10px;text-align:right}td:first-child,th:first-child{text-align:left}
#tip{position:fixed;pointer-events:none;background:var(--text);color:var(--surface);padding:3px 7px;border-radius:4px;font-size:12px;display:none}
</style></head><body>
<h1>WAV-17 — memória numa partida longa, antes e depois</h1>
<p>Chromium headless (Playwright), emulação Pixel 7, relógio do jogo 3× pelos timestamps do rAF. Partida de Charmander de 20 min de relógio (g.now): ondas naturais (chefes 2:30, 5:00, 7:00, 9:30, 12:00, Mewtwo 15:00; anéis 4:00, 4:30, 8:00, 11:00), fendas forçadas (Kyogre 6:00, Lugia 10:00, Palkia 13:00, com ps.rift / ps.riftAct), viagens de bioma (ps.biome: caverna, neve, torre, deserto). Antes = HEAD ${'995c13d'} servido de uma cópia isolada; depois = esta branch. Amostras a cada 15 s de jogo, depois de forçar GC. O gráfico do cache do Chromium vem de dumps memory-infra numa partida de 6 min (mesmo bot).</p>
<div class="legend"><span><span class="sw" style="border-color:var(--before);border-top-style:dashed"></span>antes</span><span><span class="sw" style="border-color:var(--after)"></span>depois</span></div>
<div class="grid-wrap">${series.map(chart).join('')}</div>
<h2 style="font-size:16px">Resumo</h2>
<table><thead><tr><th>Métrica</th><th>Pico antes</th><th>Pico depois</th><th>Final antes</th><th>Final depois</th></tr></thead><tbody>${rows}</tbody></table>
<h2 style="font-size:16px">Canvas por minuto (pico)</h2>
<table><thead><tr><th>Minuto (relógio)</th><th>MB antes</th><th>MB depois</th><th>Canvases antes</th><th>Canvases depois</th></tr></thead><tbody>${perMinTable}</tbody></table>
<div id="tip"></div>
<script>const tip=document.getElementById('tip');document.addEventListener('pointermove',e=>{const t=e.target.closest&&e.target.closest('[data-tip]');if(!t){tip.style.display='none';return}tip.textContent=t.dataset.tip;tip.style.display='block';tip.style.left=(e.clientX+12)+'px';tip.style.top=(e.clientY+12)+'px'})</script>
</body></html>`
writeFileSync(`${EV}/comparison.html`, html)

const md = ['| Métrica | Pico antes | Pico depois | Final antes | Final depois |', '|---|---|---|---|---|', ...series.map((s) => `| ${s.title} | ${fmt(peak(s.before))} | ${fmt(peak(s.after))} | ${fmt(last(s.before))} | ${fmt(last(s.after))} |`), '', '| Minuto | Canvas MB antes | Canvas MB depois | Canvases antes | Canvases depois |', '|---|---|---|---|---|', ...minuteRows('canvasMb').map(([m, b, a], i) => { const c = minuteRows('canvases')[i]; return `| ${m} | ${b === '' ? '' : fmt(b)} | ${a === '' ? '' : fmt(a)} | ${c[1]} | ${c[2]} |` })].join('\n')
writeFileSync(`${EV}/comparison.md`, md + '\n')
console.log(md)
