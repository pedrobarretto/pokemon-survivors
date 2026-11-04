import manifest from '../data/sprites.generated.json'
import { DOUBT, type Grid } from '../skins/propagate'
import {
  CLEAR,
  KEEP,
  LETTERS,
  MIRROR_ROW,
  SKIN_ANIMS,
  bakeVariant,
  colorId,
  newColors,
  paletteFor,
  sameFrame,
  sheetGrids,
  textFromGrid,
  type Baked,
  type Colors,
  type FixSource,
  type FrameRef,
  type KeySource,
  type SheetGrids,
  type SkinAnim,
  type SkinSource,
  type VariantSource,
} from '../skins/source'

/**
 * The Ateliê (`/atelier/`, dev only): where skins are drawn. A skin is a
 * variant's sheets redrawn; the artist draws a few frames whole (keyframes,
 * ★) and the propagation (`src/skins`) dresses the rest by following the
 * sprite's motion. A frame it got wrong is touched up by hand (a fix, ✎) or
 * made a keyframe of its own (for a pose too far from the others: a jump, a
 * crouch). Pixels the propagation wasn't sure of glow pink. Saving writes the
 * source to `src/data/skins/<id>.json` and bakes its sheets
 * (`public/assets/skins/<id>/`), through the dev server (`vite.config.ts`).
 */

type ManifestAnim = { frameWidth: number; frameHeight: number; durations: number[] }
type ManifestVariant = { anims: Partial<Record<string, ManifestAnim>> }
type ManifestEntry = ManifestVariant & { forms?: Record<string, ManifestVariant> }
const MANIFEST = manifest as unknown as Record<string, ManifestEntry>

type Tool = 'pencil' | 'eraser' | 'picker' | 'fill' | 'restore'

/** A variant's sheets, original and baked, each frame as a small canvas for the strip and the preview. */
type Loaded = {
  key: string
  sheets: Record<SkinAnim, SheetGrids>
  durations: Record<SkinAnim, number[]>
  colors: Colors
  baked: Baked
  art: Record<SkinAnim, HTMLCanvasElement[][]>
  original: Record<SkinAnim, HTMLCanvasElement[][]>
}

const DIRS = ['↓', '↘', '→', '↗', '↑', '↖', '←', '↙'] as const
const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'pencil', label: 'Lápis', key: 'B' },
  { id: 'eraser', label: 'Borracha', key: 'E' },
  { id: 'fill', label: 'Balde', key: 'G' },
  { id: 'picker', label: 'Conta-gotas', key: 'I' },
  { id: 'restore', label: 'Restaurar', key: 'R' },
]

const state = {
  skins: [] as SkinSource[],
  skin: null as SkinSource | null,
  variant: '',
  loaded: null as Loaded | null,
  sel: { anim: 'Walk', row: 0, frame: 0 } as FrameRef,
  tool: 'pencil' as Tool,
  letter: '',
  view: { original: false, doubts: true, changes: false, compare: false },
  undo: [] as string[],
  redo: [] as string[],
  dirty: false,
  message: '',
  /** Set while a stroke paints, so the bake waits for the pointer to lift. */
  stroke: false,
}

const root = document.getElementById('atelier')!

/* ---------------- Sources ---------------- */

const vsrc = (): VariantSource => state.skin!.variants[state.variant]!
const keyAt = (f: FrameRef) => vsrc().keys.find((k) => sameFrame(k, f))
const fixAt = (f: FrameRef) => vsrc().fixes.find((k) => sameFrame(k, f))
const sheet = (anim: SkinAnim) => state.loaded!.sheets[anim]
const frameCount = (anim: SkinAnim) => sheet(anim).frames[0]!.length

const setChar = (lines: string[], x: number, y: number, ch: string) => {
  const line = lines[y]!
  lines[y] = line.slice(0, x) + ch + line.slice(x + 1)
}

/** The letter for a color, added to the palette when it isn't there yet. */
const letterFor = (hex: string) => {
  const palette = vsrc().palette
  const found = Object.entries(palette).find(([, v]) => v === hex)
  if (found) return found[0]
  const ch = [...LETTERS].find((l) => !(l in palette))
  if (!ch) throw new Error('a paleta está cheia')
  palette[ch] = hex
  return ch
}

/* ---------------- Loading and baking ---------------- */

const variantParts = (key: string) => {
  const [dex = '', form] = key.split(':')
  return { dex, form }
}

const animMeta = (key: string, anim: SkinAnim) => {
  const { dex, form } = variantParts(key)
  const entry = form ? MANIFEST[dex]?.forms?.[form] : MANIFEST[dex]
  if (!entry) throw new Error(`sem sprites para ${key}`)
  const file = entry.anims[anim] ? anim : 'Walk'
  return { file, meta: entry.anims[file]! }
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`não carregou ${url}`))
    img.src = url
  })

const rgbaOf = (img: HTMLImageElement) => {
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const g = c.getContext('2d')!
  g.drawImage(img, 0, 0)
  return g.getImageData(0, 0, img.width, img.height).data
}

const gridCanvas = (g: Grid, colors: Colors) => {
  const c = document.createElement('canvas')
  c.width = g.w
  c.height = g.h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(g.w, g.h)
  for (let i = 0; i < g.px.length; i++) {
    const id = g.px[i]!
    if (!id) continue
    const hex = colors.hex[id]!
    img.data[i * 4] = parseInt(hex.slice(0, 2), 16)
    img.data[i * 4 + 1] = parseInt(hex.slice(2, 4), 16)
    img.data[i * 4 + 2] = parseInt(hex.slice(4, 6), 16)
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c
}

const loadVariant = async (key: string): Promise<Omit<Loaded, 'baked' | 'art'>> => {
  const { dex, form } = variantParts(key)
  const colors = newColors()
  const sheets = {} as Record<SkinAnim, SheetGrids>
  const durations = {} as Record<SkinAnim, number[]>
  for (const anim of SKIN_ANIMS) {
    const { file, meta } = animMeta(key, anim)
    const img = await loadImage(`/assets/pokemon/${dex}${form ? `/${form}` : ''}/${file}.png`)
    sheets[anim] = sheetGrids(rgbaOf(img), img.width, meta.frameWidth, meta.frameHeight, meta.durations.length, colors)
    durations[anim] = meta.durations
  }
  const original = {} as Record<SkinAnim, HTMLCanvasElement[][]>
  for (const anim of SKIN_ANIMS) original[anim] = sheets[anim].frames.map((row) => row.map((g) => gridCanvas(g, colors)))
  return { key, sheets, durations, colors, original }
}

/** Bakes the open variant again: every frame, or only those `only` names (what an edit could have changed). */
const rebake = (only?: (f: FrameRef) => boolean) => {
  const l = state.loaded
  if (!l) return
  const t = performance.now()
  l.baked = bakeVariant(l.sheets, vsrc(), l.colors, only, only ? l.baked : undefined)
  for (const anim of SKIN_ANIMS) {
    l.art[anim] = l.baked[anim].map((row, r) => row.map((f, c) => (!only || only({ anim, row: r, frame: c }) || !l.art[anim]?.[r]?.[c] ? gridCanvas(f.grid, l.colors) : l.art[anim][r]![c]!)))
  }
  state.message = `bake ${Math.round(performance.now() - t)} ms`
}

/** The frames a keyframe in `row` can reach: its direction and the mirror across. */
const rowOf = (row: number) => (f: FrameRef) => f.row === row || f.row === MIRROR_ROW[row]

const openVariant = async (key: string) => {
  state.variant = key
  state.message = 'carregando…'
  render()
  const base = await loadVariant(key)
  const src = vsrc()
  paletteFor(base.sheets, base.colors, src.palette)
  state.loaded = { ...base, baked: {} as Baked, art: {} as Loaded['art'] }
  rebake()
  state.sel = { anim: 'Walk', row: 0, frame: 0 }
  state.undo = []
  state.redo = []
  state.letter = Object.keys(src.palette)[0] ?? ''
  render()
}

/* ---------------- Editing ---------------- */

const snapshot = () => {
  state.undo.push(JSON.stringify(vsrc()))
  if (state.undo.length > 200) state.undo.shift()
  state.redo = []
}

const restoreFrom = (from: string[], to: string[]) => {
  const prev = from.pop()
  if (!prev) return
  to.push(JSON.stringify(vsrc()))
  state.skin!.variants[state.variant] = JSON.parse(prev) as VariantSource
  state.dirty = true
  rebake()
  render()
}

const ensureFix = (f: FrameRef): FixSource => {
  let fix = fixAt(f)
  if (!fix) {
    const s = sheet(f.anim)
    fix = { ...f, grid: Array.from({ length: s.fh }, () => KEEP.repeat(s.fw)) }
    vsrc().fixes.push(fix)
  }
  return fix
}

const current = () => state.loaded!.baked[state.sel.anim][state.sel.row]![state.sel.frame]!

/** Paints one pixel of the selected frame: into its keyframe, or into its fixes. `ch` is a letter, `.` clear, or null to restore. */
const paint = (x: number, y: number, ch: string | null) => {
  const f = state.sel
  const l = state.loaded!
  const shown = current().grid
  const key = keyAt(f)
  const original = l.sheets[f.anim].frames[f.row]![f.frame]!
  if (key) {
    const put = ch ?? (original.px[y * original.w + x] ? letterFor(l.colors.hex[original.px[y * original.w + x]!]!) : CLEAR)
    setChar(key.grid, x, y, put)
    shown.px[y * shown.w + x] = put === CLEAR ? 0 : colorId(l.colors, vsrc().palette[put]!)
  } else {
    const fix = ensureFix(f)
    setChar(fix.grid, x, y, ch ?? KEEP)
    if (ch !== null) shown.px[y * shown.w + x] = ch === CLEAR ? 0 : colorId(l.colors, vsrc().palette[ch]!)
  }
  state.dirty = true
}

/** Settles an edit: a keyframe's change re-bakes its direction and the mirror; a fix only its frame. */
const commit = () => {
  const f = { ...state.sel }
  const fix = fixAt(f)
  if (fix && fix.grid.every((l) => /^-*$/.test(l))) vsrc().fixes.splice(vsrc().fixes.indexOf(fix), 1)
  rebake(keyAt(f) ? rowOf(f.row) : (g) => sameFrame(g, f))
  render()
}

const fill = (x: number, y: number, ch: string) => {
  const g = current().grid
  const from = g.px[y * g.w + x]!
  const seen = new Uint8Array(g.w * g.h)
  const stack = [[x, y] as const]
  while (stack.length) {
    const [px, py] = stack.pop()!
    if (px < 0 || py < 0 || px >= g.w || py >= g.h) continue
    const i = py * g.w + px
    if (seen[i] || g.px[i] !== from) continue
    seen[i] = 1
    paint(px, py, ch)
    stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1])
  }
}

const pick = (x: number, y: number) => {
  const g = current().grid
  const id = g.px[y * g.w + x]!
  if (!id) return
  state.letter = letterFor(state.loaded!.colors.hex[id]!)
  state.tool = 'pencil'
}

/** Makes the selected frame a keyframe, as it's drawn now (its fixes fold in). */
const makeKey = () => {
  const f = { ...state.sel }
  if (keyAt(f)) return
  snapshot()
  const grid = textFromGrid(current().grid, vsrc().palette, state.loaded!.colors)
  vsrc().keys.push({ ...f, grid } satisfies KeySource)
  const fix = fixAt(f)
  if (fix) vsrc().fixes.splice(vsrc().fixes.indexOf(fix), 1)
  state.dirty = true
  rebake(rowOf(f.row))
  render()
}

const dropKey = () => {
  const key = keyAt(state.sel)
  if (!key || !confirm('Apagar este quadro-chave? O desenho dele se perde.')) return
  snapshot()
  vsrc().keys.splice(vsrc().keys.indexOf(key), 1)
  state.dirty = true
  rebake(rowOf(state.sel.row))
  render()
}

const dropFix = () => {
  const fix = fixAt(state.sel)
  if (!fix) return
  snapshot()
  vsrc().fixes.splice(vsrc().fixes.indexOf(fix), 1)
  state.dirty = true
  commit()
}

/* ---------------- Files ---------------- */

const fetchSkins = async () => {
  const res = await fetch('/__atelier/skins')
  state.skins = (await res.json()) as SkinSource[]
}

const save = async () => {
  if (!state.skin) return
  state.message = 'salvando…'
  render()
  const res = await fetch(`/__atelier/skin/${state.skin.id}`, { method: 'POST', body: JSON.stringify(state.skin) })
  const body = (await res.json()) as { doubts?: Record<string, number>; error?: string }
  if (!res.ok) {
    state.message = `erro: ${body.error}`
  } else {
    state.dirty = false
    state.message = `salvo · ${Object.entries(body.doubts ?? {})
      .map(([k, n]) => `#${k}: ${n} quadros com dúvida`)
      .join(' · ')}`
  }
  render()
}

const newSkin = async () => {
  const id = prompt('Id da skin (ex.: squirtleNinja)')?.trim()
  if (!id) return
  if (!/^[A-Za-z0-9_-]+$/.test(id) || state.skins.some((s) => s.id === id)) return alert('Id inválido ou já usado.')
  const variant = prompt('Primeira variante (nº da Pokédex, ou dex:forma)')?.trim()
  if (!variant) return
  const skin: SkinSource = { id, variants: { [variant]: { palette: {}, keys: [], fixes: [] } } }
  state.skins.push(skin)
  state.skin = skin
  state.dirty = true
  await openVariant(variant)
}

const newVariant = async () => {
  if (!state.skin) return
  const variant = prompt('Variante (nº da Pokédex, ou dex:forma)')?.trim()
  if (!variant || state.skin.variants[variant]) return
  if (!MANIFEST[variantParts(variant).dex]) return alert('Esse Pokémon não tem sprites.')
  state.skin.variants[variant] = { palette: {}, keys: [], fixes: [] }
  state.dirty = true
  await openVariant(variant)
}

/* ---------------- Drawing the screen ---------------- */

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Omit<Partial<HTMLElementTagNameMap[K]>, 'style'> & { class?: string; style?: string } = {} as never, ...kids: (Node | string)[]) => {
  const el = document.createElement(tag)
  const { class: cls, style, ...rest } = props
  Object.assign(el, rest)
  if (cls) el.className = cls
  if (style) el.setAttribute('style', style)
  el.append(...kids)
  return el
}

const button = (label: string, onclick: () => void, opts: { on?: boolean; disabled?: boolean; title?: string } = {}) =>
  h('button', { onclick, disabled: opts.disabled ?? false, title: opts.title ?? '', class: opts.on ? 'on' : '' }, label)

let editor: HTMLCanvasElement | null = null

const drawEditor = () => {
  const l = state.loaded
  if (!editor || !l) return
  const stage = editor.parentElement!
  const f = state.sel
  const shown = state.view.original ? l.sheets[f.anim].frames[f.row]![f.frame]! : current().grid
  const z = Math.max(4, Math.min(28, Math.floor(Math.min((stage.clientWidth - 20) / shown.w, (stage.clientHeight - 20) / shown.h))))
  editor.width = shown.w * z
  editor.height = shown.h * z
  const g = editor.getContext('2d')!
  for (let y = 0; y < shown.h; y++) {
    for (let x = 0; x < shown.w; x++) {
      g.fillStyle = (x + y) % 2 ? '#2a2d38' : '#30333f'
      g.fillRect(x * z, y * z, z, z)
      const id = shown.px[y * shown.w + x]!
      if (id) {
        g.fillStyle = `#${l.colors.hex[id]}`
        g.fillRect(x * z, y * z, z, z)
      }
    }
  }
  const original = l.sheets[f.anim].frames[f.row]![f.frame]!
  const frame = current()
  if (!state.view.original) {
    for (let i = 0; i < shown.px.length; i++) {
      const x = (i % shown.w) * z
      const y = Math.floor(i / shown.w) * z
      if (state.view.changes && shown.px[i] !== original.px[i]) {
        g.fillStyle = '#5ec4ffcc'
        g.fillRect(x + z / 2 - 1, y + z / 2 - 1, 3, 3)
      }
      if (state.view.doubts && !frame.own && frame.doubt[i] !== DOUBT.none) {
        g.strokeStyle = frame.doubt[i] === DOUBT.match ? '#ff4fd8' : '#ff4fd888'
        g.lineWidth = 2
        g.strokeRect(x + 1, y + 1, z - 2, z - 2)
      }
    }
  }
  if (z >= 10) {
    g.strokeStyle = '#ffffff10'
    g.lineWidth = 1
    for (let x = 0; x <= shown.w; x++) {
      g.beginPath()
      g.moveTo(x * z + 0.5, 0)
      g.lineTo(x * z + 0.5, shown.h * z)
      g.stroke()
    }
    for (let y = 0; y <= shown.h; y++) {
      g.beginPath()
      g.moveTo(0, y * z + 0.5)
      g.lineTo(shown.w * z, y * z + 0.5)
      g.stroke()
    }
  }
}

const pixelAt = (e: PointerEvent) => {
  const r = editor!.getBoundingClientRect()
  const g = current().grid
  const x = Math.floor(((e.clientX - r.left) / r.width) * g.w)
  const y = Math.floor(((e.clientY - r.top) / r.height) * g.h)
  return x >= 0 && y >= 0 && x < g.w && y < g.h ? { x, y } : null
}

const apply = (e: PointerEvent) => {
  const p = pixelAt(e)
  if (!p) return
  if (e.button === 2 || state.tool === 'picker') return pick(p.x, p.y)
  if (state.tool === 'pencil' && state.letter) paint(p.x, p.y, state.letter)
  else if (state.tool === 'eraser') paint(p.x, p.y, CLEAR)
  else if (state.tool === 'restore') paint(p.x, p.y, null)
  else if (state.tool === 'fill' && state.letter) fill(p.x, p.y, state.letter)
  drawEditor()
}

const editorCanvas = () => {
  const c = h('canvas')
  c.oncontextmenu = (e) => e.preventDefault()
  c.onpointerdown = (e) => {
    if (state.view.original) return
    c.setPointerCapture(e.pointerId)
    const picking = e.button === 2 || state.tool === 'picker'
    if (!picking) {
      snapshot()
      state.stroke = true
    }
    apply(e)
    if (picking) render()
  }
  c.onpointermove = (e) => {
    if (state.stroke && (state.tool === 'pencil' || state.tool === 'eraser' || state.tool === 'restore')) apply(e)
  }
  c.onpointerup = () => {
    if (!state.stroke) return
    state.stroke = false
    commit()
  }
  return c
}

const describe = () => {
  const f = state.sel
  const b = current()
  const base = `${f.anim} ${DIRS[f.row]} quadro ${f.frame + 1}/${frameCount(f.anim)}`
  if (b.own) return `${base} · ★ quadro-chave`
  const from = vsrc().keys[b.key]
  const follows = from ? `segue ★ ${from.anim} ${DIRS[from.row]} q${from.frame + 1}` : 'sem quadro-chave nesta direção'
  const doubts = b.doubt.reduce((n, d) => n + (d === DOUBT.none ? 0 : 1), 0)
  return `${base} · ${follows}${doubts ? ` · ${doubts} px em dúvida` : ''}${b.fixed ? ' · ✎ retocado' : ''}`
}

const thumb = (f: FrameRef) => {
  const l = state.loaded!
  const art = (state.view.original ? l.original : l.art)[f.anim][f.row]![f.frame]!
  const s = sheet(f.anim)
  const scale = s.fw > 40 ? 1 : 2
  const c = h('canvas', { width: s.fw * scale, height: s.fh * scale })
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.drawImage(art, 0, 0, s.fw * scale, s.fh * scale)
  const b = l.baked[f.anim][f.row]![f.frame]!
  const selKey = keyAt(state.sel)
  const cls = ['thumb', sameFrame(f, state.sel) ? 'on' : '', selKey && !b.own && b.key === vsrc().keys.indexOf(selKey) ? 'follows' : ''].join(' ')
  const el = h('div', { class: cls, onclick: () => select(f), title: `${f.anim} ${DIRS[f.row]} q${f.frame + 1}` }, c)
  if (b.own) el.append(h('span', { class: 'mark key' }, '★'))
  else if (b.fixed) el.append(h('span', { class: 'mark fix' }, '✎'))
  const doubts = b.own || b.fixed ? 0 : b.doubt.reduce((n, d) => n + (d === DOUBT.match ? 1 : 0), 0)
  if (doubts) el.append(h('span', { class: 'mark doubt' }, String(doubts)))
  return el
}

const select = (f: FrameRef) => {
  state.sel = { ...f }
  render()
}

const move = (dRow: number, dFrame: number) => {
  const n = frameCount(state.sel.anim)
  select({ ...state.sel, row: (state.sel.row + dRow + 8) % 8, frame: (state.sel.frame + dFrame + n) % n })
}

const setAnim = (anim: SkinAnim) => select({ anim, row: state.sel.row, frame: Math.min(state.sel.frame, frameCount(anim) - 1) })

const previews: { c: HTMLCanvasElement; row: number; original: boolean }[] = []

const render = () => {
  root.replaceChildren()
  previews.length = 0
  const top = h(
    'div',
    { class: 'top' },
    h('h1', {}, 'Ateliê'),
    (() => {
      const s = h('select', {
        onchange: () => {
          if (state.dirty && !confirm('Há mudanças não salvas. Trocar mesmo assim?')) return render()
          state.skin = state.skins.find((x) => x.id === s.value) ?? null
          state.dirty = false
          const first = state.skin && Object.keys(state.skin.variants)[0]
          if (first) void openVariant(first)
          else render()
        },
      })
      s.append(h('option', { value: '', textContent: '— skin —' }), ...state.skins.map((x) => h('option', { value: x.id, textContent: x.id, selected: x.id === state.skin?.id })))
      return s
    })(),
    button('+ Skin', () => void newSkin()),
    ...(state.skin
      ? [
          (() => {
            const s = h('select', { onchange: () => void openVariant(s.value) })
            s.append(...Object.keys(state.skin.variants).map((k) => h('option', { value: k, textContent: `#${k}`, selected: k === state.variant })))
            return s
          })(),
          button('+ Variante', () => void newVariant(), { title: 'Outro estágio da linha (outro nº da Pokédex)' }),
        ]
      : []),
    h('span', { class: 'grow' }),
    h('span', { class: `status ${state.dirty ? 'dirty' : ''}` }, `${state.dirty ? '● não salvo · ' : ''}${state.message}`),
    button('Salvar (⌘S)', () => void save(), { disabled: !state.skin }),
  )
  if (!state.skin || !state.loaded || state.loaded.key !== state.variant) {
    root.append(h('div', { class: 'app' }, top, h('div', { class: 'empty', style: 'grid-column:1/-1' }, state.skin ? 'carregando…' : 'Escolha uma skin ou crie uma (+ Skin).')))
    return
  }
  const src = vsrc()

  const tools = h('div', { class: 'tools' }, ...TOOLS.map((t) => button(`${t.label} ${t.key}`, () => ((state.tool = t.id), render()), { on: state.tool === t.id })))
  const palette = h(
    'div',
    { class: 'palette' },
    ...Object.entries(src.palette).map(([ch, hex]) =>
      h('div', { class: `swatch ${ch === state.letter ? 'on' : ''}`, style: `background:#${hex}`, title: `${ch} #${hex}`, onclick: () => ((state.letter = ch), state.tool === 'eraser' && (state.tool = 'pencil'), render()) }, h('span', {}, ch)),
    ),
    h('div', { class: 'swatch clear', title: 'Transparente (borracha)', onclick: () => ((state.tool = 'eraser'), render()) }),
  )
  const colorInput = h('input', { type: 'color', value: `#${src.palette[state.letter] ?? '000000'}` })
  colorInput.onchange = () => {
    if (!state.letter) return
    snapshot()
    src.palette[state.letter] = colorInput.value.slice(1)
    state.dirty = true
    rebake()
    render()
  }
  const side = h(
    'div',
    { class: 'side' },
    h('h2', {}, 'Ferramentas'),
    tools,
    h('h2', {}, 'Paleta'),
    palette,
    h(
      'div',
      { class: 'current' },
      colorInput,
      h('span', { class: 'legend' }, state.letter ? `“${state.letter}” #${src.palette[state.letter]}` : ''),
    ),
    h(
      'div',
      { class: 'current' },
      button(
        '+ Cor',
        () => {
          // A new letter, grey until the picker gives it its color.
          let v = 0x808080
          while (Object.values(src.palette).includes(v.toString(16))) v++
          state.letter = letterFor(v.toString(16))
          state.dirty = true
          render()
        },
        { title: 'Nova cor na paleta: escolha o tom no seletor ao lado' },
      ),
    ),
    h('p', { class: 'legend' }, 'Mudar a cor de uma letra repinta tudo que a usa, nos quadros-chave e nos retoques.'),
    h('h2', {}, 'Ver'),
    ...([
      ['original', 'Original (O)'],
      ['doubts', 'Dúvidas (D)'],
      ['changes', 'Pixels mudados (C)'],
    ] as const).map(([k, label]) => {
      const input = h('input', { type: 'checkbox', checked: state.view[k], onchange: () => ((state.view[k] = input.checked), render()) })
      return h('label', { class: 'check' }, input, label)
    }),
    h('h2', {}, 'Atalhos'),
    h(
      'div',
      { class: 'legend' },
      ...['<kbd>←</kbd><kbd>→</kbd> quadro · <kbd>↑</kbd><kbd>↓</kbd> direção', '<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Walk, Idle, Hurt', '<kbd>K</kbd> virar quadro-chave', '<kbd>Z</kbd> desfazer · <kbd>⇧Z</kbd> refazer', 'botão direito: conta-gotas'].map((t) => {
        const d = h('div')
        d.innerHTML = t
        return d
      }),
    ),
  )

  const b = current()
  const frameBar = h(
    'div',
    { class: 'frame-bar' },
    h('span', { class: 'info' }, describe()),
    b.own ? button('Apagar quadro-chave', dropKey) : button('Virar quadro-chave (K)', makeKey, { title: 'Para uma pose que a propagação não acerta: desenhe este quadro inteiro' }),
    button('Limpar retoques', dropFix, { disabled: !b.fixed }),
  )
  editor = editorCanvas()
  const stage = h('div', { class: 'stage' }, editor)

  const anims = h('div', { class: 'anims' }, ...SKIN_ANIMS.map((a, i) => button(`${a} ${i + 1}`, () => setAnim(a), { on: a === state.sel.anim })))
  const s = sheet(state.sel.anim)
  const grid = h('div', { class: 'sheet', style: `grid-template-columns: 20px repeat(${s.frames[0]!.length}, max-content)` })
  for (let row = 0; row < 8; row++) {
    grid.append(h('div', { class: 'dir' }, DIRS[row]!))
    for (let frame = 0; frame < s.frames[row]!.length; frame++) grid.append(thumb({ anim: state.sel.anim, row, frame }))
  }
  const strip = h('div', { class: 'strip' }, anims, grid)
  const center = h('div', { class: 'center' }, frameBar, stage, strip)

  const compare = h('input', { type: 'checkbox', checked: state.view.compare, onchange: () => ((state.view.compare = compare.checked), render()) })
  const preview = h('div', { class: 'preview' })
  for (let row = 0; row < 8; row++) {
    for (const original of state.view.compare ? [true, false] : [false]) {
      const c = h('canvas', { width: s.fw, height: s.fh, title: `${DIRS[row]}${original ? ' original' : ''}` })
      previews.push({ c, row, original })
      preview.append(c)
    }
  }
  const right = h(
    'div',
    { class: 'right' },
    h('h2', {}, `Prévia · ${state.sel.anim}`),
    h('label', { class: 'check' }, compare, 'Comparar com o original'),
    preview,
    h('h2', {}, 'Como funciona'),
    h(
      'div',
      { class: 'legend' },
      ...[
        '<b>★ quadro-chave</b>: desenhado inteiro. Os outros quadros da mesma direção (e o espelho dela) seguem o que tiver a pose mais parecida.',
        '<b>✎ retoque</b>: pintar num quadro que não é chave guarda só os pixels pintados por cima da propagação. Restaurar (R) devolve o pixel à propagação.',
        '<b>rosa</b>: pixels em que a propagação não teve certeza. O número no quadro conta quantos.',
        'Pose muito diferente (pulo, agachar)? Vire o quadro em chave e desenhe.',
      ].map((t) => {
        const d = h('p')
        d.innerHTML = t
        return d
      }),
    ),
  )
  root.append(h('div', { class: 'app' }, top, side, center, right))
  requestAnimationFrame(drawEditor)
}

/* ---------------- Preview loop ---------------- */

const t0 = performance.now()
const tick = () => {
  const l = state.loaded
  if (l && previews.length) {
    const anim = state.sel.anim
    const d = l.durations[anim]
    const total = d.reduce((a, b) => a + b, 0)
    let t = (((performance.now() - t0) / 1000) * 60) % total
    let frame = 0
    while (frame < d.length - 1 && t >= d[frame]!) t -= d[frame++]!
    for (const p of previews) {
      const art = (p.original ? l.original : l.art)[anim][p.row]?.[frame]
      if (!art) continue
      const g = p.c.getContext('2d')!
      g.clearRect(0, 0, p.c.width, p.c.height)
      g.drawImage(art, 0, 0)
    }
  }
  requestAnimationFrame(tick)
}

/* ---------------- Keys ---------------- */

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox') return
  if (!state.loaded) return
  const k = e.key.toLowerCase()
  if ((e.metaKey || e.ctrlKey) && k === 's') {
    e.preventDefault()
    return void save()
  }
  if ((e.metaKey || e.ctrlKey) && k === 'z') {
    e.preventDefault()
    return e.shiftKey ? restoreFrom(state.redo, state.undo) : restoreFrom(state.undo, state.redo)
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const tool = TOOLS.find((t) => t.key.toLowerCase() === k)
  if (tool) return ((state.tool = tool.id), render())
  if (k === 'z') return e.shiftKey ? restoreFrom(state.redo, state.undo) : restoreFrom(state.undo, state.redo)
  if (k === 'arrowleft') return (e.preventDefault(), move(0, -1))
  if (k === 'arrowright') return (e.preventDefault(), move(0, 1))
  if (k === 'arrowup') return (e.preventDefault(), move(-1, 0))
  if (k === 'arrowdown') return (e.preventDefault(), move(1, 0))
  if (k === '1' || k === '2' || k === '3') return setAnim(SKIN_ANIMS[Number(k) - 1]!)
  if (k === 'k') return makeKey()
  if (k === 'o') return ((state.view.original = !state.view.original), render())
  if (k === 'd') return ((state.view.doubts = !state.view.doubts), render())
  if (k === 'c') return ((state.view.changes = !state.view.changes), render())
})
addEventListener('resize', () => drawEditor())
addEventListener('beforeunload', (e) => {
  if (state.dirty) e.preventDefault()
})

/* ---------------- Start ---------------- */

const start = async () => {
  await fetchSkins()
  const want = new URLSearchParams(location.search)
  state.skin = state.skins.find((s) => s.id === want.get('skin')) ?? state.skins[0] ?? null
  const variant = want.get('v') ?? (state.skin ? Object.keys(state.skin.variants)[0] : undefined)
  render()
  if (state.skin && variant && state.skin.variants[variant]) await openVariant(variant)
  tick()
}

void start()
