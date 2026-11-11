import { blitCentered, context2d } from '../engine/pixelart'
import { playCry, playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { CLEARABLE, clearCount } from '../game/clears'
import { dexCounts, dexStatus, type DexStatus } from '../game/dex'
import { regionDone, regionProgress } from '../game/dexRegions'
import { isLegend } from '../data/legends'
import { DEX_REGIONS, dexRegionOf, NATIONAL_LAST, SHEETLESS, SPRITECOLLAB_URL, type DexRegion } from '../data/nationalDex'
import { gameDex, type DexEntry } from '../site/pokedex'
import { pencilIcon, pencilSprite, PICKUPS, pokeballIcon, sparkleIcon, trophyIcon } from '../render/art'
import { cryUrl, drawPokemon, hasShiny, loadedSprites, loadSpecies, portraitUrl } from '../render/sprites'
import { locale, t } from '../i18n'
import { h, later, rich } from './dom'
import { loadSave } from './save'
import { nationalDex } from '../data/regionalForms'
import { hint, typeBadge, type Screen } from './screens'
import { dexRegionPaths } from '../site/routes'

const DEX_FILTERS = ['all', 'seen', 'caught', 'missing'] as const

type DexFilter = (typeof DEX_FILTERS)[number]

/**
 * One cell of the National Dex: a species the game has (`game`), one
 * SpriteCollab's artists are still drawing (`drawing`, shown as a thank-you
 * with its name), or one that hasn't reached the game yet (`soon`).
 */
type Slot =
  | { kind: 'game'; dex: number; entry: DexEntry; status: DexStatus }
  | { kind: 'drawing'; dex: number; name: string }
  | { kind: 'soon'; dex: number }

const NO_STATUS: DexStatus = { seen: false, defeated: 0, caught: false, shiny: false }

const statusOf = (s: Slot): DexStatus => (s.kind === 'game' ? s.status : NO_STATUS)

/** The game's species pass the filter by their marks; the others only show under `all`. */
const FILTER_TEST = {
  all: () => true,
  seen: (s) => s.kind === 'game' && s.status.seen,
  caught: (s) => s.kind === 'game' && s.status.caught,
  missing: (s) => s.kind === 'game' && !s.status.seen,
} as const satisfies Record<DexFilter, (s: Slot) => boolean>

/** Species the player can knock out: wild ones, plus playable families that also roam the horde. */
const defeatable = (e: DexEntry) => e.source.kind !== 'starter' || e.source.wild !== undefined

const dexNumber = (n: number) => `#${String(nationalDex(n)).padStart(4, '0')}`

/** The game's species and every National Dex number it lacks, in national order (a regional form right after its species). */
const nationalSlots = (entries: readonly DexEntry[], status: readonly DexStatus[]): Slot[] => {
  const game: Slot[] = entries.map((entry, i) => ({ kind: 'game', dex: entry.dex, entry, status: status[i]! }))
  const have = new Set(entries.map((e) => nationalDex(e.dex)))
  const missing = Array.from({ length: NATIONAL_LAST }, (_, i) => i + 1)
    .filter((n) => !have.has(n))
    .map((n): Slot => {
      const name = SHEETLESS.get(n)
      return name ? { kind: 'drawing', dex: n, name } : { kind: 'soon', dex: n }
    })
  return [...game, ...missing].sort((a, b) => nationalDex(a.dex) - nationalDex(b.dex) || a.dex - b.dex)
}

/** Focus zones: the region tabs, the filter tabs, the grid and the footer buttons. ↑/↓ move between them at the grid's edges. */
type Zone = 'regions' | 'tabs' | 'grid' | 'footer'

/**
 * In-game Pokédex: the whole National Dex, one region at a time (Kanto to
 * Paldea, each tab with how much of its goal was seen, `game/dexRegions.ts`),
 * unseen species as "?", with progress counters, a filter and a detail panel
 * (animated sprite, types, defeats, caught and shiny). Species SpriteCollab
 * hasn't drawn yet thank its artists with a pencil and a link; the ones not in
 * the game yet say they're coming. A trophy marks every form of a family that
 * beat Mewtwo (`game/clears.ts`), in the metal of the hardest difficulty.
 * Keyboard and pad: arrows move, Q/E switch region, ↑ from the top row
 * reaches the filter and the regions, Esc/B goes back. Touch: tap a cell.
 */
export const pokedexScreen = (root: HTMLElement, input: Input, onClose: () => void, openPc?: (back: () => void) => Screen): Screen => {
  const m = t().dex
  const levels = t().difficulty.names
  const titles = t().achievements.titles
  const { dex: save, clears } = loadSave()
  const entries = gameDex()
  const status = entries.map((e) => dexStatus(save, e.dex))
  const slots = nationalSlots(entries, status)
  const wild = entries.filter(defeatable)
  const counts = dexCounts(save, entries.map((e) => e.dex))
  const done = DEX_REGIONS.filter((r) => regionDone(save, r))
  /** The hardest difficulty the entry's family (or legend, in the Legend mode) beat Mewtwo on, if it did. */
  const clearOf = (e: DexEntry) => (e.source.kind === 'starter' ? clears[e.source.id] : e.source.kind === 'wild' && isLegend(e.source.id) ? clears[e.source.id] : undefined)

  let filter: DexFilter = 'all'
  let zone: Zone = 'grid'
  /** Index into `slots` of the inspected species (the first one seen, to start). */
  let current = Math.max(0, slots.findIndex((s) => statusOf(s).seen))
  let region: DexRegion = dexRegionOf(slots[current]?.dex ?? 1)
  let footerIndex = 0
  /** Indexes into `slots` in the region that pass the filter, in grid order. */
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
      [m.regionsDone, done.length, DEX_REGIONS.length],
    ].map(([label, n, total]) => h('span', {}, label, h('b', {}, `${n}/${total}`))),
  )

  const regionTabs = DEX_REGIONS.map((r) => {
    const { seen, total } = regionProgress(save, r)
    const complete = done.includes(r)
    return h(
      'button',
      { class: complete ? 'region-tab dex-region done' : 'region-tab dex-region', onclick: () => (setZone('regions'), setRegion(r)) },
      m.regions[r],
      h('small', {}, complete ? `✓ ${total}` : `${seen}/${total}`),
    )
  })
  const tabs = DEX_FILTERS.map((f) => h('button', { class: 'region-tab dex-tab', onclick: () => (setZone('tabs'), setFilter(f)) }, m.filters[f]))

  const goal = h('div', { class: 'dex-goal' })
  const renderGoal = () => {
    const { seen, total } = regionProgress(save, region)
    const title = titles[`${region}Dex`]
    const frame = t().mart.styles.frame.nationalDex
    goal.classList.toggle('done', done.includes(region))
    goal.replaceChildren(
      rich(done.includes(region) ? m.goalDone(title) : m.goal(total - seen, title), { class: 'dex-goal-region' }),
      rich(m.nationalGoal(done.length, DEX_REGIONS.length, frame), { class: 'dex-goal-national' }),
    )
  }

  const cells = slots.map((s, i) => {
    const cell = (() => {
      if (s.kind === 'drawing')
        return h('button', { class: 'dex-cell drawing', 'aria-label': `${dexNumber(s.dex)} ${s.name}, ${m.drawing}` }, h('img', { src: pencilIcon(), alt: '' }), h('small', {}, s.dex))
      if (s.kind === 'soon') return h('button', { class: 'dex-cell soon', 'aria-label': `${dexNumber(s.dex)} ${m.soonTag}` }, h('span', { class: 'dex-unknown' }, '?'), h('small', {}, s.dex))
      const { entry: e, status: st } = s
      const clear = st.seen ? clearOf(e) : undefined
      return h(
        'button',
        { class: st.seen ? 'dex-cell' : 'dex-cell unseen', 'aria-label': st.seen ? (clear ? `${e.name}, ${m.clearedOn(levels[clear])}` : e.name) : `${dexNumber(e.dex)} ???` },
        st.seen ? h('img', { src: portraitUrl(e.dex, st.shiny), alt: '', loading: 'lazy' }) : h('span', { class: 'dex-unknown' }, '?'),
        h('small', {}, e.dex),
        st.caught && h('img', { class: 'dex-mark', src: st.shiny ? sparkleIcon() : pokeballIcon(), alt: '' }),
        clear && h('img', { class: 'dex-clear', src: trophyIcon(clear), alt: '', title: m.clearedOn(levels[clear]) }),
      )
    })()
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
  const site = h('a', { class: 'btn dex-site', href: dexRegionPaths(region)[locale()] }, m.site)
  const footer = [back, ...(pc ? [pc] : []), site]

  /** A caught shiny shows off its shiny form, when the species has one. */
  const shinyForm = (s: Slot) => s.kind === 'game' && s.status.shiny && hasShiny(s.dex)

  /** Columns of the grid as laid out right now (it reflows with the screen). */
  const columns = () => Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length)

  const row = (label: string, ...value: (string | Node)[]) => h('div', { class: 'dex-fact' }, h('span', {}, label), h('b', {}, ...value))

  const renderDetail = () => {
    const s = slots[current]
    if (!s) return
    detail.classList.toggle('unseen', s.kind === 'game' && !s.status.seen)
    detail.classList.toggle('soon', s.kind === 'soon')
    if (s.kind === 'drawing') {
      name.replaceChildren(h('small', {}, dexNumber(s.dex)), s.name)
      types.replaceChildren()
      facts.replaceChildren(
        h('span', { class: 'tag tag-drawing' }, h('img', { src: pencilIcon(), alt: '' }), m.drawing),
        h('p', { class: 'dex-tip' }, m.drawingText),
        h('a', { class: 'btn dex-contribute', href: SPRITECOLLAB_URL, target: '_blank', rel: 'noopener' }, m.contribute),
      )
      return
    }
    if (s.kind === 'soon') {
      name.replaceChildren(h('small', {}, dexNumber(s.dex)), '???')
      types.replaceChildren()
      facts.replaceChildren(h('span', { class: 'tag' }, m.soonTag), h('p', { class: 'dex-tip' }, m.soon))
      return
    }
    const { entry: e, status: st } = s
    void loadSpecies(e.dex, shinyForm(s)).catch(() => {})
    name.replaceChildren(h('small', {}, dexNumber(e.dex)), st.seen ? e.name : '???')
    types.replaceChildren(...(st.seen ? e.types.map(typeBadge) : []))
    const clear = clearOf(e)
    const lines = [
      h('span', { class: 'tag' }, m.roles[e.role]),
      !st.seen && h('p', { class: 'dex-tip' }, m.unseen),
      st.seen && defeatable(e) && row(m.defeated, String(st.defeated)),
      st.seen && row(m.owned, st.caught ? m.yes : m.no),
      st.seen && e.source.kind === 'starter' && (clear ? row(m.clear, h('img', { class: 'dex-clear-icon', src: trophyIcon(clear), alt: '' }), levels[clear]) : row(m.clear, m.no)),
      st.shiny && h('span', { class: 'tag tag-shiny' }, h('img', { src: sparkleIcon(), alt: '' }), m.shiny),
    ]
    facts.replaceChildren(...lines.filter((line) => line !== false))
  }

  const syncFocus = () => {
    regionTabs.forEach((b, i) => b.classList.toggle('selected', DEX_REGIONS[i] === region))
    regionTabs.forEach((b) => b.classList.toggle('focused', zone === 'regions'))
    tabs.forEach((b, i) => b.classList.toggle('selected', DEX_FILTERS[i] === filter))
    tabs.forEach((b) => b.classList.toggle('focused', zone === 'tabs'))
    cells.forEach((c, i) => c.classList.toggle('selected', i === current))
    grid.classList.toggle('focused', zone === 'grid')
    footer.forEach((b, i) => b.classList.toggle('selected', zone === 'footer' && i === footerIndex))
  }

  /** Shows slot `i` in the detail panel. `cry` plays its cry when it's been seen. */
  const inspect = (i: number, cry = false) => {
    const changed = i !== current
    current = i
    renderDetail()
    syncFocus()
    cells[i]?.scrollIntoView({ block: 'nearest' })
    if (changed) playSfx('move')
    const s = slots[i]
    if (cry && s?.kind === 'game' && s.status.seen) playCry(cryUrl(s.dex), 0.3)
  }

  /** Lays out the grid for the region and the filter, keeping the inspected species when it still shows. */
  const refresh = () => {
    visible = slots.flatMap((s, i) => (dexRegionOf(s.dex) === region && FILTER_TEST[filter](s) ? [i] : []))
    const shown = new Set(visible)
    cells.forEach((c, i) => c.classList.toggle('hidden', !shown.has(i)))
    empty.classList.toggle('hidden', visible.length > 0)
    if (visible.length > 0 && !shown.has(current)) current = visible.find((i) => statusOf(slots[i]!).seen) ?? visible[0]!
    if (visible.length === 0 && zone === 'grid') zone = 'tabs'
    grid.scrollTop = 0
    site.href = dexRegionPaths(region)[locale()]
    renderGoal()
    renderDetail()
    syncFocus()
    cells[current]?.scrollIntoView({ block: 'nearest' })
  }

  const setFilter = (next: DexFilter) => {
    if (next !== filter) playSfx('move')
    filter = next
    refresh()
  }

  const setRegion = (next: DexRegion) => {
    if (next !== region) playSfx('move')
    region = next
    refresh()
    regionTabs[DEX_REGIONS.indexOf(region)]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  const setZone = (next: Zone) => {
    if (next === zone) return
    zone = next
    syncFocus()
  }

  const hop = (next: Zone) => (setZone(next), playSfx('move'))

  const cycleFilter = (step: number) => setFilter(DEX_FILTERS[(DEX_FILTERS.indexOf(filter) + step + DEX_FILTERS.length) % DEX_FILTERS.length]!)
  const cycleRegion = (step: number) => setRegion(DEX_REGIONS[(DEX_REGIONS.indexOf(region) + step + DEX_REGIONS.length) % DEX_REGIONS.length]!)

  /** ←/→ walk the visible cells in order; they stop at the ends. */
  const stepGrid = (delta: number) => {
    const next = visible[visible.indexOf(current) + delta]
    if (next !== undefined) inspect(next)
  }

  /** ↑/↓ move a row; past the top row is the filter, past the bottom row the footer. */
  const stepRow = (dir: -1 | 1) => {
    const cols = columns()
    const at = visible.indexOf(current)
    const top = Math.floor(at / cols)
    const lastRow = Math.floor((visible.length - 1) / cols)
    if (dir < 0 && top === 0) return hop('tabs')
    if (dir > 0 && top === lastRow) return hop('footer')
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
    // Q/E (and PageUp/PageDown) switch the region from anywhere.
    if (key === 'KeyQ' || key === 'PageUp') return cycleRegion(-1)
    if (key === 'KeyE' || key === 'PageDown') return cycleRegion(1)
    switch (zone) {
      case 'regions':
        if (left || right) cycleRegion(left ? -1 : 1)
        else if (down || confirm) hop('tabs')
        return
      case 'tabs':
        if (left || right) cycleFilter(left ? -1 : 1)
        else if (up) hop('regions')
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
      case 'grid': {
        if (left || right) stepGrid(left ? -1 : 1)
        else if (up || down) stepRow(up ? -1 : 1)
        else if (confirm) {
          const s = slots[current]
          if (s?.kind === 'game' && s.status.seen) playCry(cryUrl(s.dex), 0.3)
          else if (s?.kind === 'drawing') window.open(SPRITECOLLAB_URL, '_blank', 'noopener')
        }
      }
    }
  })

  const el = h(
    'div',
    { class: 'screen dim dex-screen' },
    h(
      'div',
      { class: 'dialog box pop dex' },
      h('div', { class: 'dex-head' }, h('div', { class: 'dialog-title' }, 'POKéDEX'), progress),
      h('div', { class: 'region-tabs dex-regions', role: 'tablist' }, ...regionTabs),
      h('div', { class: 'dex-bar' }, h('div', { class: 'region-tabs dex-tabs', role: 'tablist' }, ...tabs), goal),
      h('div', { class: 'dex-body' }, h('div', { class: 'dex-list' }, grid, empty), detail),
      h('div', { class: 'buttons' }, ...footer),
      hint(m.hintKeys, m.hintTouch),
    ),
  )
  root.append(el)
  refresh()
  later(() => {
    cells[current]?.scrollIntoView({ block: 'center' })
    regionTabs[DEX_REGIONS.indexOf(region)]?.scrollIntoView({ block: 'nearest', inline: 'center' })
  })

  const tick = (time: number) => {
    if (sub) return sub.tick?.(time)
    const s = slots[current]
    if (!s) return
    const ctx = context2d(sprite)
    ctx.clearRect(0, 0, sprite.width, sprite.height)
    if (s.kind === 'drawing') {
      const pencil = pencilSprite()
      const scale = 3
      ctx.drawImage(pencil, (sprite.width - pencil.width * scale) / 2, (sprite.height - pencil.height * scale) / 2 + Math.round(Math.sin(time * 3) * 2), pencil.width * scale, pencil.height * scale)
      return
    }
    const loaded = s.kind === 'game' ? loadedSprites(s.dex, shinyForm(s)) : null
    // Small Pokémon get doubled (whole pixels) so the panel isn't mostly empty; big legendaries stay 1:1.
    if (loaded) drawPokemon(ctx, loaded, 'Idle', 0, time, sprite.width / 2, sprite.height - 10, { scale: loaded.bodyH * 2 <= sprite.height - 20 ? 2 : 1 })
    else blitCentered(ctx, PICKUPS.pokeball(), sprite.width / 2, sprite.height / 2 + Math.round(Math.sin(time * 6) * 2))
  }

  return { el, tick, dim: 0.5, dispose: () => (sub?.dispose(), off(), el.remove()) }
}
