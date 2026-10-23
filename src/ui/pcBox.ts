import { playCry, playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { context2d } from '../engine/pixelart'
import { ENEMIES, type EnemyDef } from '../data/enemies'
import { isRiftLegend } from '../data/rifts'
import { GRAVEYARD } from '../data/places'
import { dexStatus, type Pokedex } from '../game/dex'
import { gameDex, type DexEntry } from '../site/pokedex'
import { sparkleIcon } from '../render/art'
import type { WallpaperId } from '../data/style'
import { wallpaperUrl } from '../render/cosmetics'
import { cryUrl, drawPokemon, loadedSprites, loadSpecies } from '../render/sprites'
import { t } from '../i18n'
import { h, later } from './dom'
import { loadSave } from './save'
import { hint, typeBadge, type Screen } from './screens'

/** Slots per box, as in the games' PC: 6 columns, 5 rows. Keep in sync with `.pc-grid` in CSS. */
export const BOX = { cols: 6, rows: 5 } as const

const BOX_SLOTS = BOX.cols * BOX.rows

/**
 * Can this species be caught shiny? Playable lines can (the 1/64 roll, a
 * shiny hatch), and so can the wild horde, the rift legendaries and
 * Spiritomb; wave bosses and event Pokémon never are. Only species with shiny
 * sprites count.
 */
const shinyCatchable = (e: DexEntry) => {
  if (!e.sprites.shiny) return false
  if (e.source.kind === 'starter') return true
  if (e.source.kind !== 'wild') return false
  const wild = e.source.id
  const def: EnemyDef = ENEMIES[wild]
  return def.tier !== undefined || isRiftLegend(wild) || wild === GRAVEYARD.boss
}

/** Every species the Caixa do PC has room for, in national dex order. */
export const boxSpecies = () => gameDex().filter(shinyCatchable)

/** The shinies a Pokédex holds, packed in dex order like a PC box. */
export const caughtShinies = (dex: Pokedex, species: readonly DexEntry[] = boxSpecies()) => species.filter((e) => dexStatus(dex, e.dex).shiny)

/** Focus zones: the box switcher, the slots and the footer buttons. */
type Zone = 'nav' | 'grid' | 'footer'

/** `trainerCard` opens the Trainer Card's share preview over the box, calling `back` when it closes. */
type PcActions = { trainerCard: (back: () => void) => Screen; onClose: () => void }

/**
 * The Caixa do PC: every shiny caught, packed in boxes of 30 like the games'
 * PC, each slot with its Idle sprite moving, and a "N / total" counter. A slot
 * shows its name and types below; ◀ ▶ (or Q/E, or the arrows past an edge)
 * switch boxes. The footer opens the Trainer Card. Esc/Backspace close it.
 */
export const pcBoxScreen = (root: HTMLElement, input: Input, actions: PcActions, wallpaper?: WallpaperId): Screen => {
  const m = t().pc
  const species = boxSpecies()
  const shinies = caughtShinies(loadSave().dex, species)
  const boxes = Math.max(1, Math.ceil(species.length / BOX_SLOTS))
  let box = 0
  let slot = 0
  let zone: Zone = 'grid'
  let footerIndex = 0
  /** The Trainer Card's preview, open over the box. */
  let sub: Screen | null = null
  let closed = false

  const label = h('div', { class: 'pc-box-name' })
  const prev = h('button', { class: 'pc-arrow', 'aria-label': m.prev, onclick: () => (setZone('nav'), switchBox(-1)) }, '◀')
  const next = h('button', { class: 'pc-arrow', 'aria-label': m.next, onclick: () => (setZone('nav'), switchBox(1)) }, '▶')
  const nav = h('div', { class: 'pc-nav' }, prev, label, next)

  const canvases = Array.from({ length: BOX_SLOTS }, () => h('canvas', { width: 48, height: 48, class: 'pc-sprite' }))
  const marks = Array.from({ length: BOX_SLOTS }, () => h('img', { class: 'pc-mark hidden', src: sparkleIcon(), alt: '' }))
  const slots = canvases.map((canvas, i) => {
    const el = h('button', { class: 'pc-slot' }, canvas, marks[i]!)
    el.addEventListener('click', () => {
      setZone('grid')
      select(i, true)
    })
    return el
  })
  const grid = h('div', { class: 'pc-grid', style: `--wallpaper:url(${wallpaperUrl(wallpaper)})` }, ...slots)

  const name = h('div', { class: 'pc-name' })
  const types = h('div', { class: 'types' })
  const detail = h('div', { class: 'pc-detail' }, name, types)

  const back = h('button', { class: 'btn', onclick: close }, m.back)
  const openCard = () => {
    if (sub) return
    playSfx('select')
    later(() => {
      el.classList.add('hidden')
      sub = actions.trainerCard(() => {
        sub = null
        el.classList.remove('hidden')
      })
    })
  }
  const card = h('button', { class: 'btn', onclick: openCard }, m.trainer)
  const footer = [back, card]

  const at = (i: number): DexEntry | undefined => shinies[box * BOX_SLOTS + i]

  const renderDetail = () => {
    const e = at(slot)
    if (!e) {
      name.replaceChildren(shinies.length === 0 ? m.none : m.empty)
      name.classList.add('empty')
      types.replaceChildren()
      return
    }
    name.classList.remove('empty')
    name.replaceChildren(h('small', {}, `#${String(e.dex).padStart(4, '0')}`), e.name, h('img', { src: sparkleIcon(), alt: 'Shiny' }))
    types.replaceChildren(...e.types.map(typeBadge))
  }

  const renderBox = () => {
    label.textContent = m.box(box + 1, boxes)
    slots.forEach((el, i) => {
      const e = at(i)
      el.classList.toggle('filled', e !== undefined)
      el.setAttribute('aria-label', e ? e.name : m.empty)
      marks[i]!.classList.toggle('hidden', e === undefined)
      if (e) void loadSpecies(e.dex, true).catch(() => {})
      if (!e) context2d(canvases[i]!).clearRect(0, 0, 48, 48)
    })
  }

  const syncFocus = () => {
    slots.forEach((el, i) => el.classList.toggle('selected', i === slot))
    grid.classList.toggle('focused', zone === 'grid')
    nav.classList.toggle('focused', zone === 'nav')
    footer.forEach((b, i) => b.classList.toggle('selected', zone === 'footer' && i === footerIndex))
  }

  const select = (i: number, cry = false) => {
    if (i !== slot) playSfx('move')
    slot = i
    renderDetail()
    syncFocus()
    const e = at(i)
    if (cry && e) playCry(cryUrl(e.dex), 0.3)
  }

  const switchBox = (delta: number) => {
    box = (box + delta + boxes) % boxes
    playSfx('move')
    renderBox()
    renderDetail()
    syncFocus()
  }

  const setZone = (next: Zone) => {
    zone = next
    syncFocus()
  }

  const hop = (next: Zone) => (setZone(next), playSfx('move'))

  /** ←/→ inside a row; past the edge, the box next door (like the games). */
  const stepCol = (dir: -1 | 1) => {
    const col = slot % BOX.cols
    if ((dir < 0 && col === 0) || (dir > 0 && col === BOX.cols - 1)) {
      slot += dir < 0 ? BOX.cols - 1 : -(BOX.cols - 1)
      return switchBox(dir)
    }
    select(slot + dir)
  }

  const stepRow = (dir: -1 | 1) => {
    const row = Math.floor(slot / BOX.cols)
    if (dir < 0 && row === 0) return hop('nav')
    if (dir > 0 && row === BOX.rows - 1) return hop('footer')
    select(slot + dir * BOX.cols)
  }

  const off = input.onKey((key) => {
    if (sub) return
    const left = key === 'ArrowLeft' || key === 'KeyA'
    const right = key === 'ArrowRight' || key === 'KeyD'
    const up = key === 'ArrowUp' || key === 'KeyW'
    const down = key === 'ArrowDown' || key === 'KeyS'
    const confirm = key === 'Enter' || key === 'Space'
    if (key === 'Escape' || key === 'Backspace') return close()
    if (key === 'KeyQ' || key === 'PageUp') return switchBox(-1)
    if (key === 'KeyE' || key === 'PageDown') return switchBox(1)
    switch (zone) {
      case 'nav':
        if (left || right) switchBox(left ? -1 : 1)
        else if (down || confirm) hop('grid')
        return
      case 'footer':
        if (left || right) {
          footerIndex = (footerIndex + 1) % footer.length
          playSfx('move')
          syncFocus()
        } else if (up) hop('grid')
        else if (confirm) footer[footerIndex]!.click()
        return
      case 'grid':
        if (left || right) stepCol(left ? -1 : 1)
        else if (up || down) stepRow(up ? -1 : 1)
        else if (confirm) {
          const e = at(slot)
          if (e) playCry(cryUrl(e.dex), 0.3)
        }
    }
  })

  const el = h(
    'div',
    { class: 'screen dim pc-screen' },
    h(
      'div',
      { class: 'dialog box pop pc' },
      h(
        'div',
        { class: 'pc-head' },
        h('div', { class: 'dialog-title' }, m.title),
        h('span', { class: 'pc-count' }, h('img', { src: sparkleIcon(), alt: '' }), h('b', {}, `${shinies.length} / ${species.length}`)),
      ),
      nav,
      grid,
      detail,
      h('div', { class: 'buttons' }, back, card),
      hint(m.hintKeys, m.hintTouch),
    ),
  )
  root.append(el)
  renderBox()
  renderDetail()
  syncFocus()

  const tick = (time: number) => {
    for (let i = 0; i < BOX_SLOTS; i++) {
      const e = at(i)
      if (!e) continue
      const canvas = canvases[i]!
      const ctx = context2d(canvas)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const s = loadedSprites(e.dex, true)
      // Every slot breathes on its own beat, like the boxes in the games.
      if (s) drawPokemon(ctx, s, 'Idle', 0, time + i * 0.37, canvas.width / 2, canvas.height - 6)
    }
  }

  const dispose = () => {
    sub?.dispose()
    off()
    el.remove()
  }

  /** Closes the box for good (its keys too) before handing back, as the screens it opens over don't dispose it. */
  function close() {
    if (closed) return
    closed = true
    playSfx('select')
    dispose()
    later(actions.onClose)
  }

  return { el, tick, dim: 0.5, dispose }
}
