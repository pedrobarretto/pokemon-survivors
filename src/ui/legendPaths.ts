import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { context2d, createCanvas } from '../engine/pixelart'
import { COSMOG, COSMOG_DEX, FLOORS, MELTAN, REGIGIGAS, TOWERS, TRIALS, ZYGARDE, type PathId, type TrialDef, type TrialId } from '../data/legendPaths'
import { LEGENDS } from '../data/legends'
import { MOVES } from '../game/moves'
import { isCaptured } from '../game/capture'
import { cosmogHere, cosmogLean, cosmogStage, cubePieces, kubfuJoined, sunHour, towerOf, trialOpen } from '../game/legendPaths'
import type { Save } from '../game/meta'
import { formatNumber, t } from '../i18n'
import { closeIcon } from '../render/art'
import { portraitUrl } from '../render/sprites'
import { emotionUrl } from './dialogue'
import { h, later, rich } from './dom'
import { cellIcon, coreIcon, nutIcon } from './pathRun'
import { loadSave } from './save'
import type { Screen } from './screens'
import './legendPaths.css'

/**
 * The legend paths' sheets (`data/legendPaths.ts`): one per path, opened from
 * a locked path legend on the partner select, the lobby's Cosmog and the
 * Dojo's Torre. Each starts with what its Pokémon in the lobby tells of it
 * (`paths.intro`), then where the path stands: the Zygarde Cube, Cosmog's
 * growth, the Torre's trials (startable from the Dojo), Meltan's Hex Nuts or
 * the Regi trio that wakes Regigigas.
 */

/** Who tells of each path, by dex (its emotion portraits come with `EMOTIONS` in scripts/dex.mjs). */
export const PATH_NPC = { zygarde: 185, cosmog: 171, kubfu: 67, meltan: 352, regigigas: 291 } as const satisfies Record<PathId, number>

/** The path behind a legend (Regigigas's temple counts as its own). */
export const pathOfLegend = (id: string): PathId | null =>
  id === 'zygarde' ? 'zygarde' : id === 'solgaleo' || id === 'lunala' ? 'cosmog' : id === 'kubfu' ? 'kubfu' : id === 'meltan' ? 'meltan' : id === 'regigigas' ? 'regigigas' : null

/* ---------------- The Zygarde Cube ---------------- */

const CUBE = 64

/**
 * The Zygarde Cube in pixel art, 64 × 64: an isometric cube whose two front
 * faces hold the 95 Cells (lit green as they come, left face first) and whose
 * top holds the 5 Cores (red) around a Z.
 */
export const cubeArt = (cells: number, cores: number): HTMLCanvasElement => {
  const canvas = createCanvas(CUBE, CUBE)
  const ctx = context2d(canvas)
  const px = (x: number, y: number, c: string, w = 1, hh = 1) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(x), Math.round(y), w, hh)
  }
  // The faces, one row of pixels at a time: the top rhombus, then the left and right walls.
  for (let y = 0; y < 26; y++) {
    const half = y <= 13 ? y * 2 : (26 - y) * 2
    px(32 - half, 4 + y, '#3a4a40', half * 2, 1)
  }
  for (let x = 0; x < 26; x++) {
    px(6 + x, 17 + x / 2, '#22302a', 1, 30)
    px(32 + x, 30 - x / 2, '#151e1a', 1, 30)
  }
  // Edges: dark outline, a light rim where the light hits.
  for (let x = 0; x <= 26; x++) {
    px(6 + x, 17 - x / 2, '#a8c8b0')
    px(32 + x, 4 + x / 2, '#6a8a74')
    px(6 + x, 17 + x / 2, '#0a100c')
    px(32 + x, 30 - x / 2, '#0a100c')
    px(6 + x, 47 + x / 2, '#0a100c')
    px(32 + x, 60 - x / 2, '#0a100c')
  }
  px(6, 17, '#0a100c', 1, 31)
  px(32, 30, '#0a100c', 1, 31)
  px(58, 17, '#0a100c', 1, 31)
  // The Cells: 5 × 10 on the left wall, 5 × 9 on the right, lit in order.
  const slot = (x: number, y: number, on: boolean) => {
    px(x, y, on ? '#4cc068' : '#2e443a', 3, 2)
    if (on) px(x, y, '#b8f8c8')
  }
  let n = 0
  for (let i = 0; i < 5; i++) for (let j = 0; j < 10; j++) slot(8 + i * 5, 19 + i * 2.5 + j * 2.8, n++ < cells)
  for (let i = 0; i < 5; i++) for (let j = 0; j < 9; j++) slot(35 + i * 5, 29 - i * 2.5 + j * 3.1, n++ < cells)
  // The top: a Z of light, the Cores around it.
  for (let i = 0; i < 9; i++) px(27 + i, 11, '#78e098')
  for (let i = 0; i < 9; i++) px(35 - i, 12 + i, '#78e098')
  for (let i = 0; i < 9; i++) px(27 + i, 21, '#78e098')
  const corePlaces = [[19, 16], [45, 16], [32, 7], [24, 23], [40, 23]] as const
  corePlaces.forEach(([x, y], i) => {
    const on = i < cores
    px(x - 1, y - 1, '#0a100c', 4, 4)
    px(x, y, on ? '#e84830' : '#4a3430', 2, 2)
    if (on) px(x, y, '#ffd0a0')
  })
  return canvas
}

/* ---------------- The sheet ---------------- */

const bar = (k: number, tone: string) => h('span', { class: `path-bar ${tone}` }, h('i', { style: `width:${Math.round(Math.max(0, Math.min(1, k)) * 100)}%` }))

const row = (icon: string | null, label: string, value: Node | string, done = false) =>
  h('div', { class: `path-row${done ? ' done' : ''}` }, icon ? h('img', { src: icon, alt: '' }) : null, h('span', { class: 'path-row-label' }, rich(label)), h('span', { class: 'path-row-value' }, value))

const zygardeBody = (save: Save) => {
  const m = t().paths.cube
  const pieces = cubePieces(save.paths)
  const cells = Math.min(save.paths.cells, ZYGARDE.cells)
  const cores = Math.min(save.paths.cores, ZYGARDE.cores)
  const art = cubeArt(cells, cores)
  art.classList.add('path-cube')
  const forme = (name: string, need: number, coresToo: boolean) => {
    const open = pieces >= need
    // With every Cell in, only the Cores can still be missing.
    const missing = coresToo && cells >= ZYGARDE.cells ? m.needCores(String(ZYGARDE.cores - cores)) : m.need(formatNumber(need - pieces))
    return row(null, name, open ? m.open : missing, open)
  }
  return [
    h('div', { class: 'path-cube-box' }, art, h('div', { class: 'path-cube-numbers' }, h('b', { class: 'arc-outline' }, m.pieces(String(pieces))), row(cellIcon(), m.cells(String(cells), String(ZYGARDE.cells)), ''), row(coreIcon(), m.cores(String(cores), String(ZYGARDE.cores)), ''))),
    forme(m.forms.ten, ZYGARDE.formes.ten, false),
    forme(m.forms.fifty, ZYGARDE.formes.fifty, false),
    forme(m.forms.complete, ZYGARDE.formes.complete, true),
    h('p', { class: 'path-note' }, rich(m.hint)),
  ]
}

const cosmogBody = (save: Save) => {
  const m = t().paths.cosmog
  const c = save.paths.cosmog
  const stage = cosmogStage(c)
  const steps = COSMOG.research.map((s) => row(null, m.steps[s], c.research.includes(s) ? '✓' : '', c.research.includes(s)))
  const raised = c.raised.length > 0 ? [h('p', { class: 'path-note' }, m.raised(c.raised.map((l) => LEGENDS[l].name).join(', ')))] : []
  if (!stage || !cosmogHere(c)) return [h('h3', { class: 'path-sub' }, m.researchHead), ...steps, h('p', { class: 'path-note' }, rich(c.research.length < COSMOG.research.length ? m.researchNote : m.none)), ...raised]
  const missing = c.raised.length === 1
  const lean = cosmogLean(c, sunHour(new Date().getHours()))
  const toNext = stage === 'cosmog' ? m.toCosmoem(COSMOG.cosmoem - c.runs) : m.toLegend(COSMOG.evolve - c.runs)
  const total = Math.max(1, c.sun + c.moon)
  return [
    h('div', { class: 'path-cosmog' }, h('img', { class: 'path-cosmog-face', src: portraitUrl(COSMOG_DEX[stage]), alt: '' }), h('div', {}, h('b', { class: 'path-cosmog-name' }, stage === 'cosmog' ? 'Cosmog' : 'Cosmoem'), h('p', { class: 'path-row-label' }, m.runs(String(c.runs), String(COSMOG.evolve))), bar(c.runs / COSMOG.evolve, 'green'), h('p', { class: 'path-note' }, toNext))),
    h('div', { class: 'path-sky' }, h('span', { class: 'path-sky-label sun' }, `☀ ${m.sun} ${c.sun}`), bar(c.sun / total, 'sun'), h('span', { class: 'path-sky-label moon' }, `☾ ${m.moon} ${c.moon}`), bar(c.moon / total, 'moon')),
    h('p', { class: 'path-lean' }, rich(missing ? m.leanMissing(LEGENDS[lean].name) : m.lean(LEGENDS[lean].name))),
    h('p', { class: 'path-note' }, rich(m.how)),
    ...raised,
  ]
}

const trialGoal = (def: TrialDef) => {
  const g = t().paths.tower.goal
  return def.goal.kind === 'damage' ? g.damage(formatNumber(def.goal.need), def.time) : def.goal.kind === 'hits' ? g.hits(formatNumber(def.goal.need), def.time) : g.knockouts(formatNumber(def.goal.need), def.time)
}

/** The loadout line of a trial: who plays it and with which moves. */
export const trialLoadout = (def: TrialDef) => t().paths.tower.loadout(def.starter === 'kubfu' ? 'Kubfu' : 'Machop', def.moves.map((mv) => MOVES[mv.id].name).join(' · '))

/**
 * The Torre's body: Machoke's words and the notes beside (`info`), the trial
 * cards in a list of their own (`list`), so a phone held sideways shows them
 * as two columns, the cards scrolling on their own.
 */
const kubfuBody = (save: Save, intro: HTMLElement, start: ((id: TrialId) => void) | null, close: () => void) => {
  const m = t().paths.tower
  const trials = save.paths.trials
  const tower = towerOf(trials)
  const card = (id: TrialId) => {
    const def: TrialDef = TRIALS[id]
    const cleared = trials.includes(id)
    const open = trialOpen(trials, id)
    const closedTower = TOWERS.some((tw) => tw === id) && tower !== null && tower !== id
    const status = cleared ? (TOWERS.some((tw) => tw === id) ? m.chosen : m.cleared) : closedTower ? m.closed : open ? '' : m.locked
    const text = m.floors[id]
    return h(
      'div',
      { class: `path-trial${cleared ? ' done' : ''}${open && !cleared ? ' open' : ''}${id === 'dark' ? ' dark' : id === 'water' ? ' water' : ''}` },
      h('div', { class: 'path-trial-head' }, h('b', {}, text.name), status && h('span', { class: 'arc-tag' }, status)),
      h('p', { class: 'path-trial-desc' }, text.desc),
      h('p', { class: 'path-trial-goal' }, trialGoal(def)),
      h('p', { class: 'path-trial-load' }, trialLoadout(def)),
      open && !cleared && start && h('button', { class: 'arc-btn arc-btn-small path-trial-go', type: 'button', onclick: () => (playSfx('select'), close(), later(() => start(id))) }, h('span', { class: 'arc-outline' }, m.start)),
    )
  }
  const styleLine = tower ? [h('p', { class: 'path-lean' }, rich(m.urshifu(m.styles[tower])))] : []
  const towers = [h('h3', { class: 'path-sub' }, LEGENDS.kubfu.name, ' → Urshifu'), h('div', { class: 'path-towers' }, ...TOWERS.map(card))]
  const floors = [h('h3', { class: 'path-sub' }, m.floorsHead), ...FLOORS.map(card)]
  const info = h('div', { class: 'path-tower-info' }, intro, h('p', { class: 'path-note' }, m.intro), h('p', { class: 'path-note' }, m.chooseNote), ...styleLine)
  // With every floor cleared, the towers come first: they're what's left.
  const list = h('div', { class: 'path-tower-list' }, ...(kubfuJoined(trials) ? [...towers, ...floors] : [...floors, ...towers]))
  return [h('div', { class: 'path-tower' }, info, list)]
}

const meltanBody = (save: Save) => {
  const m = t().paths.meltan
  const owned = isCaptured(save.legends, 'meltan')
  const nuts = save.paths.nuts
  return [
    row(nutIcon(), m.box, owned ? '✓' : '', owned),
    owned ? null : h('p', { class: 'path-note' }, m.boxHint),
    row(nutIcon(), m.nuts(formatNumber(Math.min(nuts, MELTAN.nuts)), formatNumber(MELTAN.nuts)), '', nuts >= MELTAN.nuts),
    bar(nuts / MELTAN.nuts, 'steel'),
    nuts >= MELTAN.nuts ? h('p', { class: 'path-lean' }, rich(m.ready)) : null,
    h('p', { class: 'path-note' }, m.note),
  ]
}

const regiBody = (save: Save) => {
  const m = t().paths.regi
  const caught = REGIGIGAS.wakers.filter((id) => isCaptured(save.legends, id))
  return [
    h('div', { class: 'path-trio' }, ...REGIGIGAS.wakers.map((id) => h('span', { class: `path-trio-face${caught.includes(id) ? ' on' : ''}` }, h('img', { src: portraitUrl(LEGENDS[id].line[0].dex), alt: LEGENDS[id].name }), h('small', {}, LEGENDS[id].name)))),
    row(null, m.wakers(caught.length), '', caught.length === REGIGIGAS.wakers.length),
    caught.length === REGIGIGAS.wakers.length ? h('p', { class: 'path-lean' }, m.awake) : null,
    h('p', { class: 'path-note' }, m.note),
  ]
}

/** What the path's Pokémon says: all of it the first time; once Cosmog came, only how it grows; once a Torre trial is cleared, only its first line. */
const introLines = (path: PathId, save: Save): readonly string[] => {
  const lines = t().paths.intro[path]
  if (path === 'cosmog' && cosmogHere(save.paths.cosmog)) return lines.slice(-1)
  return path === 'kubfu' && save.paths.trials.length > 0 ? lines.slice(0, 1) : lines
}

/**
 * Opens the sheet of `path`. `start`: the Torre's trials can be started from
 * it (the Dojo passes it; elsewhere the sheet only shows where they stand).
 * Esc, a tap outside or the ✕ close it.
 */
export const pathSheet = (root: HTMLElement, input: Input, path: PathId, opts: { close: () => void; start?: (id: TrialId) => void }): Screen => {
  const m = t().paths
  const save = loadSave()
  let closed = false
  const dispose = () => {
    closed = true
    off()
    el.remove()
  }
  const close = () => {
    if (closed) return
    dispose()
    later(opts.close)
  }
  const npc = PATH_NPC[path]
  const intro = h(
    'div',
    { class: 'path-npc' },
    h('img', { class: 'path-npc-face', src: emotionUrl(npc, 'Normal'), alt: '' }),
    h('div', { class: 'path-npc-text' }, h('b', { class: 'path-npc-name' }, m.npc[path]), ...introLines(path, save).map((line) => h('p', {}, rich(line)))),
  )
  const body = path === 'zygarde' ? [intro, ...zygardeBody(save)] : path === 'cosmog' ? [intro, ...cosmogBody(save)] : path === 'kubfu' ? kubfuBody(save, intro, opts.start ?? null, dispose) : path === 'meltan' ? [intro, ...meltanBody(save)] : [intro, ...regiBody(save)]
  const closeButton = h('button', { class: 'arc-icon-btn', type: 'button', 'aria-label': m.close, title: m.close, onclick: () => (playSfx('select'), close()) }, h('img', { class: 'ink-icon', src: closeIcon(), alt: '' }))
  const panel = h(
    'div',
    { class: `lobby-sheet-panel path-sheet path-sheet-${path}`, role: 'dialog', 'aria-label': m.names[path] },
    h('header', { class: 'lobby-sheet-head' }, h('h2', { class: 'arc-outline' }, m.names[path]), closeButton),
    h('div', { class: 'path-body' }, ...body),
  )
  const el = h('div', { class: 'screen lobby-sheet' }, panel)
  el.addEventListener('click', (e) => e.target === el && (playSfx('select'), close()))
  const off = input.onKey((key) => {
    if (key === 'Escape' || key === 'Backspace') {
      playSfx('select')
      close()
    }
  })
  root.append(el)
  return { el, dispose, dim: 0 }
}
