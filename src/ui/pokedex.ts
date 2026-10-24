import { blitCentered, context2d } from '../engine/pixelart'
import { playCry, playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { CLEARABLE, clearCount } from '../game/clears'
import { dexCounts, dexStatus, type DexStatus } from '../game/dex'
import { isLegend } from '../data/legends'
import { gameDex, type DexEntry } from '../site/pokedex'
import { PICKUPS, pokeballIcon, sparkleIcon, trophyIcon } from '../render/art'
import { cryUrl, drawPokemon, hasShiny, loadedSprites, loadSpecies, portraitUrl } from '../render/sprites'
import { locale, t } from '../i18n'
import { h, later } from './dom'
import { loadSave } from './save'
import { hint, typeBadge, type Screen } from './screens'
import { ROUTES } from '../site/routes'

const DEX_FILTERS = ['all', 'seen', 'caught', 'missing'] as const

type DexFilter = (typeof DEX_FILTERS)[number]

const FILTER_TEST = {
  all: () => true,
  seen: (s) => s.seen,
  caught: (s) => s.caught,
  missing: (s) => !s.seen,
} as const satisfies Record<DexFilter, (s: DexStatus) => boolean>

/** Species the player can knock out: wild ones, plus playable families that also roam the horde. */
const defeatable = (e: DexEntry) => e.source.kind !== 'starter' || e.source.wild !== undefined

const dexNumber = (n: number) => `#${String(n).padStart(4, '0')}`

/** Focus zones: the filter tabs, the grid and the footer buttons. ↑/↓ move between them at the grid's edges. */
type Zone = 'tabs' | 'grid' | 'footer'

/**
 * In-game Pokédex: every species in the game in national dex order, unseen
 * ones as "?", with progress counters, a filter and a detail panel (animated
 * sprite, types, defeats, caught and shiny). A trophy marks every form of a
 * family that beat Mewtwo (`game/clears.ts`), in the metal of the hardest
 * difficulty. Keyboard and pad: arrows move,
 * ↑ from the top row reaches the filter, Esc/B goes back. Touch: tap a cell.
 */
export const pokedexScreen = (root: HTMLElement, input: Input, onClose: () => void, openPc?: (back: () => void) => Screen): Screen => {
  const m = t().dex
  const levels = t().difficulty.names
  const { dex: save, clears } = loadSave()
  const entries = gameDex()
  const status = entries.map((e) => dexStatus(save, e.dex))
  const wild = entries.filter(defeatable)
  const counts = dexCounts(save, entries.map((e) => e.dex))
  /** The hardest difficulty the entry's family (or legend, in the Legend mode) beat Mewtwo on, if it did. */
  const clearOf = (e: DexEntry) => (e.source.kind === 'starter' ? clears[e.source.id] : e.source.kind === 'wild' && isLegend(e.source.id) ? clears[e.source.id] : undefined)

  let filter: DexFilter = 'all'
  let zone: Zone = 'grid'
  /** Index into `entries` of the inspected species (the first one seen, to start). */
  let current = Math.max(0, status.findIndex((s) => s.seen))
  let footerIndex = 0
  /** Indexes into `entries` that pass the filter, in grid order. */
  let visible: number[] = []

  const close = () => later(onClose)

  const progress = h(
    'div',
    { class: 'dex-progress' },
    ...[
      [m.seen, counts.seen, entries.length],
      [m.defeated, counts.defeated, wild.length],
      [m.caught, counts.caught, entries.length],
      [m.cleared, clearCount(clears), CLEARABLE.length],
    ].map(([label, n, total]) => h('span', {}, label, h('b', {}, `${n}/${total}`))),
  )

  const tabs = DEX_FILTERS.map((f) => h('button', { class: 'region-tab dex-tab', onclick: () => (setZone('tabs'), setFilter(f)) }, m.filters[f]))

  const cells = entries.map((e, i) => {
    const s = status[i]!
    const clear = s.seen ? clearOf(e) : undefined
    const cell = h(
      'button',
      { class: s.seen ? 'dex-cell' : 'dex-cell unseen', 'aria-label': s.seen ? (clear ? `${e.name}, ${m.clearedOn(levels[clear])}` : e.name) : `${dexNumber(e.dex)} ???` },
      s.seen ? h('img', { src: portraitUrl(e.dex, s.shiny), alt: '', loading: 'lazy' }) : h('span', { class: 'dex-unknown' }, '?'),
      h('small', {}, e.dex),
      s.caught && h('img', { class: 'dex-mark', src: s.shiny ? sparkleIcon() : pokeballIcon(), alt: '' }),
      clear && h('img', { class: 'dex-clear', src: trophyIcon(clear), alt: '', title: m.clearedOn(levels[clear]) }),
    )
    cell.addEventListener('click', () => (setZone('grid'), inspect(i, true)))
    return cell
  })
  const grid = h('div', { class: 'dex-grid' }, ...cells)
  const empty = h('p', { class: 'dex-empty hidden' }, m.empty)

  const sprite = h('canvas', { width: 72, height: 72, class: 'inspect-sprite dex-sprite' })
  const name = h('div', { class: 'inspect-name' })
  const types = h('div', { class: 'types' })
  const facts = h('div', { class: 'dex-facts' })
  const detail = h('div', { class: 'dex-detail' }, sprite, h('div', { class: 'inspect-id' }, name, types, facts))

  /** The Caixa do PC, open over the Pokédex until it closes. */
  let sub: Screen | null = null
  const showPc = () => {
    if (!openPc || sub) return
    playSfx('select')
    later(() => {
      el.classList.add('hidden')
      sub = openPc(() => {
        sub = null
        el.classList.remove('hidden')
      })
    })
  }

  const back = h('button', { class: 'btn', onclick: close }, m.back)
  const pc = openPc ? h('button', { class: 'btn dex-pc', onclick: showPc }, h('img', { src: sparkleIcon(), alt: '' }), m.pc, h('span', { class: 'key-hint' }, 'P')) : null
  const site = h('a', { class: 'btn dex-site', href: ROUTES.pokedex[locale()] }, m.site)
  const footer = [back, ...(pc ? [pc] : []), site]

  /** A caught shiny shows off its shiny form, when the species has one. */
  const shinyForm = (i: number) => status[i]!.shiny && hasShiny(entries[i]!.dex)

  /** Columns of the grid as laid out right now (it reflows with the screen). */
  const columns = () => Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length)

  const renderDetail = () => {
    const e: DexEntry | undefined = entries[current]
    const s = status[current]
    if (!e || !s) return
    void loadSpecies(e.dex, shinyForm(current)).catch(() => {})
    detail.classList.toggle('unseen', !s.seen)
    name.replaceChildren(h('small', {}, dexNumber(e.dex)), s.seen ? e.name : '???')
    types.replaceChildren(...(s.seen ? e.types.map(typeBadge) : []))
    const row = (label: string, ...value: (string | Node)[]) => h('div', { class: 'dex-fact' }, h('span', {}, label), h('b', {}, ...value))
    const clear = clearOf(e)
    const lines = [
      h('span', { class: 'tag' }, m.roles[e.role]),
      !s.seen && h('p', { class: 'dex-tip' }, m.unseen),
      s.seen && defeatable(e) && row(m.defeated, String(s.defeated)),
      s.seen && row(m.owned, s.caught ? m.yes : m.no),
      s.seen && e.source.kind === 'starter' && (clear ? row(m.clear, h('img', { class: 'dex-clear-icon', src: trophyIcon(clear), alt: '' }), levels[clear]) : row(m.clear, m.no)),
      s.shiny && h('span', { class: 'tag tag-shiny' }, h('img', { src: sparkleIcon(), alt: '' }), m.shiny),
    ]
    facts.replaceChildren(...lines.filter((line) => line !== false))
  }

  const syncFocus = () => {
    tabs.forEach((b, i) => b.classList.toggle('selected', DEX_FILTERS[i] === filter))
    tabs.forEach((b) => b.classList.toggle('focused', zone === 'tabs'))
    cells.forEach((c, i) => c.classList.toggle('selected', i === current))
    grid.classList.toggle('focused', zone === 'grid')
    footer.forEach((b, i) => b.classList.toggle('selected', zone === 'footer' && i === footerIndex))
  }

  /** Shows species `i` in the detail panel. `cry` plays its cry when it's been seen. */
  const inspect = (i: number, cry = false) => {
    const changed = i !== current
    current = i
    renderDetail()
    syncFocus()
    cells[i]?.scrollIntoView({ block: 'nearest' })
    if (changed) playSfx('move')
    if (cry && status[i]?.seen) playCry(cryUrl(entries[i]!.dex), 0.3)
  }

  const setFilter = (next: DexFilter) => {
    if (next !== filter) playSfx('move')
    filter = next
    visible = entries.flatMap((_, i) => (FILTER_TEST[filter](status[i]!) ? [i] : []))
    cells.forEach((c, i) => c.classList.toggle('hidden', !visible.includes(i)))
    empty.classList.toggle('hidden', visible.length > 0)
    if (visible.length > 0 && !visible.includes(current)) current = visible[0]!
    if (visible.length === 0 && zone === 'grid') zone = 'tabs'
    grid.scrollTop = 0
    renderDetail()
    syncFocus()
    cells[current]?.scrollIntoView({ block: 'nearest' })
  }

  const setZone = (next: Zone) => {
    if (next === zone) return
    zone = next
    syncFocus()
  }

  const hop = (next: Zone) => (setZone(next), playSfx('move'))

  const cycleFilter = (step: number) => setFilter(DEX_FILTERS[(DEX_FILTERS.indexOf(filter) + step + DEX_FILTERS.length) % DEX_FILTERS.length]!)

  /** ←/→ walk the visible cells in order; they stop at the ends. */
  const stepGrid = (delta: number) => {
    const next = visible[visible.indexOf(current) + delta]
    if (next !== undefined) inspect(next)
  }

  /** ↑/↓ move a row; past the top row is the filter, past the bottom row the footer. */
  const stepRow = (dir: -1 | 1) => {
    const cols = columns()
    const at = visible.indexOf(current)
    const row = Math.floor(at / cols)
    const lastRow = Math.floor((visible.length - 1) / cols)
    if (dir < 0 && row === 0) return hop('tabs')
    if (dir > 0 && row === lastRow) return hop('footer')
    inspect(visible[Math.min(visible.length - 1, at + dir * cols)]!)
  }

  const off = input.onKey((key) => {
    if (sub) return
    if (key === 'KeyP') return showPc()
    const left = key === 'ArrowLeft' || key === 'KeyA'
    const right = key === 'ArrowRight' || key === 'KeyD'
    const up = key === 'ArrowUp' || key === 'KeyW'
    const down = key === 'ArrowDown' || key === 'KeyS'
    const confirm = key === 'Enter' || key === 'Space'
    if (key === 'Escape' || key === 'Backspace') return close()
    // Q/E (and PageUp/PageDown) switch the filter from anywhere.
    if (key === 'KeyQ' || key === 'PageUp') return cycleFilter(-1)
    if (key === 'KeyE' || key === 'PageDown') return cycleFilter(1)
    switch (zone) {
      case 'tabs':
        if (left || right) cycleFilter(left ? -1 : 1)
        else if ((down || confirm) && visible.length > 0) hop('grid')
        else if (down) hop('footer')
        return
      case 'footer':
        if (left || right) {
          footerIndex = (footerIndex + 1) % footer.length
          playSfx('move')
          syncFocus()
        } else if (up) hop(visible.length > 0 ? 'grid' : 'tabs')
        else if (confirm) footer[footerIndex]!.click()
        return
      case 'grid':
        if (left || right) stepGrid(left ? -1 : 1)
        else if (up || down) stepRow(up ? -1 : 1)
        else if (confirm && status[current]?.seen) playCry(cryUrl(entries[current]!.dex), 0.3)
    }
  })

  const el = h(
    'div',
    { class: 'screen dim dex-screen' },
    h(
      'div',
      { class: 'dialog box pop dex' },
      h('div', { class: 'dex-head' }, h('div', { class: 'dialog-title' }, 'POKéDEX'), progress),
      h('div', { class: 'region-tabs dex-tabs', role: 'tablist' }, ...tabs),
      h('div', { class: 'dex-body' }, h('div', { class: 'dex-list' }, grid, empty), detail),
      h('div', { class: 'buttons' }, ...footer),
      hint(m.hintKeys, m.hintTouch),
    ),
  )
  root.append(el)
  setFilter('all')
  later(() => cells[current]?.scrollIntoView({ block: 'center' }))

  const tick = (time: number) => {
    if (sub) return sub.tick?.(time)
    const e = entries[current]
    const s = status[current]
    if (!e || !s) return
    const ctx = context2d(sprite)
    ctx.clearRect(0, 0, sprite.width, sprite.height)
    const loaded = loadedSprites(e.dex, shinyForm(current))
    // Small Pokémon get doubled (whole pixels) so the panel isn't mostly empty; big legendaries stay 1:1.
    if (loaded) drawPokemon(ctx, loaded, 'Idle', 0, time, sprite.width / 2, sprite.height - 10, { scale: loaded.bodyH * 2 <= sprite.height - 20 ? 2 : 1 })
    else blitCentered(ctx, PICKUPS.pokeball(), sprite.width / 2, sprite.height / 2 + Math.round(Math.sin(time * 6) * 2))
  }

  return { el, tick, dim: 0.5, dispose: () => (sub?.dispose(), off(), el.remove()) }
}
