import { FURNITURE, footprint, type FurnitureCounts, type FurnitureId, type FurnitureKind } from '../data/furniture'
import { BASE_GRID, BASE_ROOM } from '../data/realmMap'
import { BASE_EXTERIORS, BASE_MAX_ITEMS, BASE_VISIBILITY, EMPTY_BASE, checkLayout, type BaseLayout, type BaseVisibility, type LayoutError, type Placed } from '../data/secretBases'
import { context2d } from '../engine/pixelart'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { t } from '../i18n'
import type { BaseView } from '../net/realmApi'
import { fetchMe, isFailure, saveBase } from '../realm/api'
import { pieceName } from '../realm/furniture'
import { clampSpot, firstSpot, fitsAt, trayCounts } from '../realm/placement'
import { drawBaseRoom, exteriorSwatch, pieceIcon, type BaseOverlay } from '../render/base'
import { h, later, setText } from './dom'
import { confirmDialog, hint, type Screen } from './screens'

/**
 * The secret base's editor (`openBaseEditor`): the room on a grid, the
 * furniture the account owns in a tray (owned minus placed, by kind), and the
 * room's look (the exterior, a wallpaper, a flooring) and who may come in.
 * Made for touch first: a tap on a tray piece puts it in the first free spot
 * and selects it, dragging moves it (mice can drag straight from the tray),
 * and the tools turn, put away and undo. Every change runs `checkLayout`
 * (the API runs the same on save): the piece it refuses shows in red with
 * why, and Save waits until nothing's wrong. Keys: arrows nudge the selected
 * piece, R turns it, Delete puts it away, Z undoes, Esc leaves (asking first
 * when there's something unsaved).
 */

/** The tray's tabs: a kind of piece each, and the room's look. */
const TRAY_TABS = ['floor', 'rug', 'top', 'wall', 'style'] as const
type TrayTab = (typeof TRAY_TABS)[number]

const tabOf = (kind: FurnitureKind): TrayTab => (kind === 'wallpaper' || kind === 'flooring' ? 'style' : kind)

/** `close`: back where it opened from. `saved`: the base as the API stored it, for the realm to draw the room again. */
export type BaseEditorOpts = { close: () => void; saved?: (view: BaseView) => void }

/** How many layouts Undo goes back through. */
const UNDO_DEPTH = 50

/** A pointer drag in progress: a new piece from the tray, or a placed one (`index`) being moved; `grab` is the tile offset it's held by. */
type Drag = { from: 'tray' | 'room'; id: FurnitureId; turned: boolean; index: number; grab: { x: number; y: number }; startX: number; startY: number; moved: boolean; at: { x: number; y: number } | null }

/** How far (CSS px) a press travels before it's a drag rather than a tap. */
const DRAG_PX = 8

const sameLayout = (a: BaseLayout, b: BaseLayout) => JSON.stringify(a) === JSON.stringify(b)

export const openBaseEditor = (root: HTMLElement, input: Input, opts: BaseEditorOpts): Screen => {
  const m = t().bases.editor
  const el = h('div', { class: 'screen dim base-editor' })
  root.append(el)

  let owned: FurnitureCounts = {}
  let layout: BaseLayout = EMPTY_BASE
  let visibility: BaseVisibility = 'public'
  /** What the API holds: Save lights up when the editor differs from it. */
  type Saved = { layout: BaseLayout; visibility: BaseVisibility }
  let stored: Saved = { layout, visibility }
  const undo: Saved[] = []
  let selected: number | null = null
  let tab: TrayTab = 'floor'
  let drag: Drag | null = null
  let busy = false
  let loaded = false
  let note: { text: string; kind: 'ok' | 'bad' } | null = null
  let error: LayoutError | null = null
  let sub: Screen | null = null
  let closed = false

  const canvas = h('canvas', { class: 'base-canvas', width: BASE_ROOM.w, height: BASE_ROOM.h, 'aria-label': m.title })
  const ctx = context2d(canvas)
  const stage = h('div', { class: 'base-stage' }, canvas)
  const status = h('p', { class: 'base-status', role: 'status' })
  const pieceLabel = h('span', { class: 'base-piece' })
  const back = h('button', { class: 'btn shop-back', type: 'button', 'aria-label': t().mart.back, onclick: () => leave() }, '◀', h('span', { class: 'shop-back-label' }, ` ${t().mart.back}`))
  const visBtn = h('button', { class: 'btn base-visibility', type: 'button', onclick: () => cycleVisibility() })
  const saveBtn = h('button', { class: 'btn confirm base-save', type: 'button', onclick: () => void save() }, m.save)
  const rotateBtn = h('button', { class: 'btn base-tool', type: 'button', onclick: () => rotate() }, '⟳ ', m.rotate)
  const removeBtn = h('button', { class: 'btn base-tool', type: 'button', onclick: () => remove() }, '✕ ', m.remove)
  const undoBtn = h('button', { class: 'btn base-tool', type: 'button', onclick: () => stepBack() }, '↶ ', m.undo)
  const count = h('span', { class: 'base-count' })
  const tabs = TRAY_TABS.map((id) => h('button', { class: `shop-tab base-tab ${id}`, type: 'button', role: 'tab', onclick: () => switchTab(id) }, m.tabs[id]))
  const tray = h('div', { class: 'base-tray', role: 'list' })

  el.append(
    h(
      'section',
      { class: 'base-panel box', 'aria-label': m.title },
      h('header', { class: 'shop-head base-head' }, back, h('h2', { class: 'shop-title' }, m.title), visBtn, saveBtn),
      h(
        'div',
        { class: 'base-main' },
        stage,
        h(
          'div',
          { class: 'base-side' },
          h('div', { class: 'base-tools' }, pieceLabel, rotateBtn, removeBtn, undoBtn, count),
          status,
          h('nav', { class: 'shop-tabs base-tabs', role: 'tablist' }, ...tabs),
          tray,
        ),
      ),
      h('footer', { class: 'shop-foot' }, hint(m.hintKeys, m.hintTouch)),
    ),
  )

  /* ---------- State changes ---------- */

  const dirty = () => !sameLayout(layout, stored.layout) || visibility !== stored.visibility

  /** Makes a change Undo can take back. */
  const change = (next: BaseLayout, nextVisibility = visibility) => {
    if (sameLayout(next, layout) && nextVisibility === visibility) return
    undo.push({ layout, visibility })
    if (undo.length > UNDO_DEPTH) undo.shift()
    layout = next
    visibility = nextVisibility
    note = null
    paint()
  }

  const setItems = (items: readonly Placed[]) => change({ ...layout, items })

  const stepBack = () => {
    const prev = undo.pop()
    if (!prev) return
    playSfx('move')
    layout = prev.layout
    visibility = prev.visibility
    if (selected !== null && selected >= layout.items.length) selected = null
    note = null
    paint()
  }

  const place = (id: FurnitureId) => {
    if (layout.items.length >= BASE_MAX_ITEMS) {
      playSfx('denied')
      note = { text: m.errors.tooMany(BASE_MAX_ITEMS), kind: 'bad' }
      return paint()
    }
    playSfx('select')
    setItems([...layout.items, firstSpot(layout, owned, id)])
    selected = layout.items.length - 1
    paint()
  }

  const setStyle = (patch: Partial<Pick<BaseLayout, 'exterior' | 'wallpaper' | 'flooring'>>) => {
    playSfx('select')
    change({ ...layout, ...patch })
  }

  const rotate = () => {
    if (selected === null) return
    const p = layout.items[selected]!
    if (FURNITURE[p.id].turns !== true) return
    playSfx('move')
    const turned = !p.turned
    const at = clampSpot(p.id, turned, p.x, p.y)
    setItems(layout.items.map((q, i) => (i === selected ? { ...q, ...at, turned } : q)))
  }

  const remove = () => {
    if (selected === null) return
    playSfx('move')
    const gone = selected
    selected = null
    setItems(layout.items.filter((_, i) => i !== gone))
  }

  const nudge = (dx: number, dy: number) => {
    if (selected === null) return
    const p = layout.items[selected]!
    const at = clampSpot(p.id, p.turned, p.x + dx, p.y + dy)
    if (at.x === p.x && at.y === p.y) return
    playSfx('move')
    setItems(layout.items.map((q, i) => (i === selected ? { ...q, ...at } : q)))
  }

  const cycleVisibility = () => {
    playSfx('select')
    change(layout, BASE_VISIBILITY[(BASE_VISIBILITY.indexOf(visibility) + 1) % BASE_VISIBILITY.length]!)
  }

  function switchTab(id: TrayTab) {
    if (id === tab) return
    playSfx('move')
    tab = id
    tray.scrollLeft = 0
    tray.scrollTop = 0
    paint()
  }

  /* ---------- Painting ---------- */

  /** Tray icons still waiting on their art, painted again as it lands. */
  const pending = new Map<HTMLElement, FurnitureId>()

  const iconFor = (id: FurnitureId) => {
    const icon = pieceIcon(id)
    icon.canvas.classList.add('base-icon')
    if (!icon.ready) pending.set(icon.canvas, id)
    return icon.canvas
  }

  const trayItem = (id: FurnitureId, left: number) => {
    const b = h('button', { class: 'base-item', type: 'button', role: 'listitem', title: pieceName(id) }, iconFor(id), h('span', { class: 'base-item-name' }, pieceName(id)), h('em', { class: 'base-item-count' }, `×${left}`))
    b.addEventListener('pointerdown', (e) => startTrayDrag(e, id))
    // A tap (or Enter) puts it in the room; a drag from the tray is handled by the drag.
    b.addEventListener('click', () => !drag && place(id))
    return b
  }

  const swatch = (art: HTMLCanvasElement, label: string, on: boolean, pick: () => void) =>
    h('button', { class: `base-swatch${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on), onclick: pick }, art, h('span', {}, label))

  const styleRows = () => {
    const left = trayCounts(owned, layout)
    const styles = (kind: 'wallpaper' | 'flooring') => [...left.keys()].filter((id) => FURNITURE[id].kind === kind)
    const none = () => {
      const c = exteriorSwatch(layout.exterior)
      c.classList.add('base-icon')
      return c
    }
    return [
      h('h3', { class: 'base-row-title' }, m.exterior),
      h('div', { class: 'base-row' }, ...BASE_EXTERIORS.map((x) => swatch(exteriorSwatch(x), m.exteriors[x], layout.exterior === x, () => setStyle({ exterior: x })))),
      h('h3', { class: 'base-row-title' }, m.wallpaper),
      h('div', { class: 'base-row' }, swatch(none(), m.none, layout.wallpaper === null, () => setStyle({ wallpaper: null })), ...styles('wallpaper').map((id) => swatch(iconFor(id), pieceName(id), layout.wallpaper === id, () => setStyle({ wallpaper: id })))),
      h('h3', { class: 'base-row-title' }, m.flooring),
      h('div', { class: 'base-row' }, swatch(none(), m.none, layout.flooring === null, () => setStyle({ flooring: null })), ...styles('flooring').map((id) => swatch(iconFor(id), pieceName(id), layout.flooring === id, () => setStyle({ flooring: id })))),
    ]
  }

  const paintTray = () => {
    pending.clear()
    tray.classList.toggle('style', tab === 'style')
    if (!loaded) return tray.replaceChildren(h('p', { class: 'base-empty' }, m.loading))
    if (tab === 'style') return tray.replaceChildren(...styleRows())
    const items = [...trayCounts(owned, layout)].filter(([id]) => tabOf(FURNITURE[id].kind) === tab)
    tray.replaceChildren(...(items.length > 0 ? items.map(([id, left]) => trayItem(id, left)) : [h('p', { class: 'base-empty' }, m.empty)]))
  }

  const errorText = (e: LayoutError) => {
    if (!('item' in e)) return e.error === 'tooMany' ? m.errors.tooMany(BASE_MAX_ITEMS) : m.errors.style
    const name = pieceName(layout.items[e.item]?.id ?? 'woodChair')
    return e.error === 'unknown' || e.error === 'kind' ? m.errors.unknown : m.errors[e.error](name)
  }

  /** Paints everything but the room (which the frame loop draws). */
  const paint = () => {
    if (closed) return
    error = loaded ? checkLayout(layout, owned) : null
    tabs.forEach((b, i) => {
      const on = TRAY_TABS[i] === tab
      b.classList.toggle('on', on)
      b.setAttribute('aria-selected', String(on))
    })
    paintTray()
    const piece = selected !== null ? layout.items[selected] : undefined
    setText(pieceLabel, piece ? pieceName(piece.id) : m.pick)
    rotateBtn.toggleAttribute('disabled', !piece || FURNITURE[piece.id].turns !== true)
    removeBtn.toggleAttribute('disabled', !piece)
    undoBtn.toggleAttribute('disabled', undo.length === 0)
    setText(count, m.count(layout.items.length, BASE_MAX_ITEMS))
    setText(visBtn, `${VIS_ICON[visibility]} ${m.visibility[visibility]}`)
    visBtn.title = m.visibilityHint[visibility]
    saveBtn.toggleAttribute('disabled', busy || !loaded || error !== null || !dirty())
    setText(saveBtn, busy ? m.saving : m.save)
    const shown = note ?? (error ? { text: errorText(error), kind: 'bad' as const } : loaded ? { text: dirty() ? m.ok : m.clean, kind: 'ok' as const } : null)
    setText(status, shown?.text ?? '')
    status.classList.toggle('bad', shown?.kind === 'bad')
  }

  /* ---------- The room: pointer ---------- */

  /** The tile under a client point, or null off the room. */
  const tileAt = (cx: number, cy: number) => {
    const r = canvas.getBoundingClientRect()
    if (cx < r.left || cy < r.top || cx >= r.right || cy >= r.bottom) return null
    return { x: Math.floor(((cx - r.left) / r.width) * BASE_GRID.cols), y: Math.floor(((cy - r.top) / r.height) * BASE_GRID.rows) }
  }

  /** The piece on top at a tile: what sits on a table, then what stands, then the wall's, then rugs. */
  const pieceAt = (tile: { x: number; y: number }) => {
    const order: readonly FurnitureKind[] = ['top', 'floor', 'wall', 'rug']
    for (const kind of order)
      for (let i = layout.items.length - 1; i >= 0; i--) {
        const p = layout.items[i]!
        if (FURNITURE[p.id].kind !== kind) continue
        const [w, hh] = footprint(p.id, p.turned)
        if (tile.x >= p.x && tile.x < p.x + w && tile.y >= p.y && tile.y < p.y + hh) return i
      }
    return null
  }

  /** Where the dragged piece would land for a pointer at a client point. */
  const dropAt = (d: Drag, cx: number, cy: number) => {
    const tile = tileAt(cx, cy)
    return tile && clampSpot(d.id, d.turned, tile.x - d.grab.x, tile.y - d.grab.y)
  }

  const onMove = (e: PointerEvent) => {
    const d = drag
    if (!d) return
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_PX) return
    d.moved = true
    d.at = dropAt(d, e.clientX, e.clientY)
  }

  const onUp = (e: PointerEvent) => {
    const d = drag
    if (!d) return
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    // The click that follows a drag from the tray must not place a second one.
    later(() => (drag = null))
    if (!d.moved) {
      if (d.from === 'tray') drag = null
      return
    }
    const at = e.type === 'pointercancel' ? null : dropAt(d, e.clientX, e.clientY)
    if (!at) return paint()
    playSfx('select')
    if (d.from === 'tray') {
      if (layout.items.length >= BASE_MAX_ITEMS) return paint()
      setItems([...layout.items, { id: d.id, ...at, turned: false }])
      selected = layout.items.length - 1
    } else {
      setItems(layout.items.map((q, i) => (i === d.index ? { ...q, ...at } : q)))
      selected = d.index
    }
    paint()
  }

  const follow = () => {
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function startTrayDrag(e: PointerEvent, id: FurnitureId) {
    if (drag || busy || e.button !== 0) return
    const [w, hh] = footprint(id, false)
    drag = { from: 'tray', id, turned: false, index: -1, grab: { x: Math.floor((w - 1) / 2), y: Math.floor((hh - 1) / 2) }, startX: e.clientX, startY: e.clientY, moved: false, at: null }
    follow()
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (drag || busy || !loaded || e.button !== 0) return
    const tile = tileAt(e.clientX, e.clientY)
    const i = tile && pieceAt(tile)
    if (i === null || !tile) {
      selected = null
      return paint()
    }
    e.preventDefault()
    const p = layout.items[i]!
    if (selected !== i) playSfx('move')
    selected = i
    drag = { from: 'room', id: p.id, turned: p.turned, index: i, grab: { x: tile.x - p.x, y: tile.y - p.y }, startX: e.clientX, startY: e.clientY, moved: false, at: null }
    follow()
    paint()
  })

  /* ---------- The frame loop ---------- */

  const markOf = () => (error && 'item' in error ? error.item : null)

  /** The room as it would be with the drag dropped, and whether the dragged piece would be fine there. */
  const ghostOf = (d: Drag): BaseOverlay['ghost'] => {
    if (!d.moved || !d.at) return null
    const piece: Placed = { id: d.id, ...d.at, turned: d.turned }
    const items = d.from === 'tray' ? [...layout.items, piece] : layout.items.map((q, i) => (i === d.index ? piece : q))
    const index = d.from === 'tray' ? items.length - 1 : d.index
    return { piece, ok: fitsAt({ ...layout, items }, owned, index) }
  }

  let raf = 0
  const frame = (now: number) => {
    if (closed) return
    const time = now / 1000
    const d = drag
    const ghost = d ? ghostOf(d) : null
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawBaseRoom(ctx, { layout }, 0, 0, time, { grid: true, selected: ghost ? null : selected, mark: ghost ? null : markOf(), skip: ghost && d?.from === 'room' ? d.index : null, ghost })
    // Icons whose art landed meanwhile are painted again.
    for (const [c, id] of pending) {
      const icon = pieceIcon(id, time)
      if (!icon.ready) continue
      icon.canvas.className = c.className
      c.replaceWith(icon.canvas)
      pending.delete(c)
    }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  /** The room at the biggest scale that fits its stage: whole pixels from 2× up. */
  const fit = () => {
    const w = stage.clientWidth
    const hh = stage.clientHeight
    if (w === 0 || hh === 0) return
    const k = Math.min(w / BASE_ROOM.w, hh / BASE_ROOM.h)
    const scale = k >= 2 ? Math.floor(k) : k
    canvas.style.width = `${Math.floor(BASE_ROOM.w * scale)}px`
    canvas.style.height = `${Math.floor(BASE_ROOM.h * scale)}px`
  }
  const resize = new ResizeObserver(fit)
  resize.observe(stage)

  /* ---------- Saving and leaving ---------- */

  async function save() {
    if (busy || error !== null || !dirty()) return
    busy = true
    playSfx('select')
    paint()
    const sent = { layout, visibility }
    const done = await saveBase(sent)
    busy = false
    if (closed) return
    if (isFailure(done)) {
      playSfx('denied')
      note = { text: done.status === 429 ? m.failed.rate : done.error === 'profile' ? m.failed.profile : m.failed.offline, kind: 'bad' }
    } else {
      playSfx('buy')
      stored = { layout: sent.layout, visibility: sent.visibility }
      note = { text: m.saved, kind: 'ok' }
      opts.saved?.(done)
    }
    paint()
  }

  function leave() {
    if (closed || sub || busy) return
    if (!dirty()) return close()
    sub = confirmDialog(root, input, m.leave, (yes) => {
      sub?.dispose()
      sub = null
      if (yes) close()
    }, { class: 'shop-confirm' })
  }

  function close() {
    if (closed) return
    playSfx('move')
    dispose()
    later(opts.close)
  }

  const off = input.onKey((key) => {
    if (closed || sub || busy) return
    if (key === 'Escape' || key === 'Backspace') {
      if (selected !== null) {
        selected = null
        paint()
      } else leave()
    } else if (key === 'ArrowLeft' || key === 'KeyA') nudge(-1, 0)
    else if (key === 'ArrowRight' || key === 'KeyD') nudge(1, 0)
    else if (key === 'ArrowUp' || key === 'KeyW') nudge(0, -1)
    else if (key === 'ArrowDown' || key === 'KeyS') nudge(0, 1)
    else if (key === 'KeyR') rotate()
    else if (key === 'Delete' || key === 'KeyX') remove()
    else if (key === 'KeyZ') stepBack()
    else if (key === 'KeyQ' || key === 'KeyE') switchTab(TRAY_TABS[(TRAY_TABS.indexOf(tab) + (key === 'KeyE' ? 1 : TRAY_TABS.length - 1)) % TRAY_TABS.length]!)
  })

  function dispose() {
    if (closed) return
    closed = true
    cancelAnimationFrame(raf)
    resize.disconnect()
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    off()
    sub?.dispose()
    el.remove()
  }

  paint()
  void fetchMe().then((me) => {
    if (closed) return
    if (isFailure(me)) {
      note = { text: me.error === 'profile' ? m.failed.profile : m.loadFailed, kind: 'bad' }
      return paint()
    }
    owned = me.furniture
    if (me.base) {
      layout = me.base.layout
      visibility = me.base.visibility
    }
    stored = { layout, visibility }
    loaded = true
    paint()
  })

  return { el, dispose }
}

const VIS_ICON = { public: '◉', friends: '♥', private: '🔒' } as const satisfies Record<BaseVisibility, string>
