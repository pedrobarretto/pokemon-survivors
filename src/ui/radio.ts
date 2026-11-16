import { ENEMIES } from '../data/enemies'
import { RADIO_GROUPS, RADIO_TRACKS, type RadioEntry, type RadioThemeId } from '../data/radio'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { musicLevels } from '../engine/music'
import { context2d } from '../engine/pixelart'
import { LOCALES, locale, t } from '../i18n'
import { onRadio, openTracks, radio, radioSounding, radioUnlocks, setRadio } from '../radio'
import { cycleRepeat, dequeue, enqueue, isUnlocked, moveInQueue, nowPlaying, playList, playNow, previous, RADIO_WHERE, skip, toggleFavorite, type RadioState } from '../radioRules'
import { lockIcon, radioIcon, radioKitIcon, radioStarIcon, type RadioKitIcon } from '../render/art'
import { portraitUrl } from '../render/sprites'
import { h, later, setText } from './dom'
import { hint, type Screen } from './screens'
import { segmented } from './shell'
import './radio.css'

/**
 * The Rádio's sheet (`openRadio`), its lobby button (`radioButton`) and the
 * pause menu's now-playing pill (`radioPill`). The state and who plays what
 * are `src/radio.ts`; the rules `src/radioRules.ts`; the catalog `data/radio.ts`.
 */

/** Rotom hosts the radio (its SpriteCollab portrait). */
const HOST_DEX = 479

/* ---------------- The equalizer ---------------- */

/** Five bars, a pixel wide with a pixel between them, on a canvas the CSS scales by whole steps. */
const EQ_W = 9
const EQ_H = 7
/** The meter's bins (750 Hz each at 48 kHz) each bar reads, low to high. */
const BANDS = [
  [1, 1],
  [2, 2],
  [3, 4],
  [5, 7],
  [8, 12],
] as const
/** The bars redraw this often (ms): a frame in three at 60 Hz. */
const EQ_EVERY = 50

/**
 * A tiny pixel equalizer that follows the music's real spectrum (`musicLevels`),
 * flat while nothing sounds. It animates itself while on the page and stops
 * once taken off it; `onFrame` rides along (a pill's name and visibility).
 */
const equalizer = (onFrame?: () => void) => {
  const canvas = h('canvas', { class: 'radio-eq', width: EQ_W, height: EQ_H, 'aria-hidden': 'true' })
  const ctx = context2d(canvas)
  let last = 0
  let waited = 0
  const draw = (now: number) => {
    if (!canvas.isConnected) {
      // Built before it's put on the page: give it a moment, then let go.
      if (++waited > 120) return
      return void requestAnimationFrame(draw)
    }
    waited = 121
    requestAnimationFrame(draw)
    if (now - last < EQ_EVERY) return
    last = now
    onFrame?.()
    const levels = radioSounding() ? musicLevels() : null
    ctx.clearRect(0, 0, EQ_W, EQ_H)
    ctx.fillStyle = '#f8d030'
    BANDS.forEach(([from, to], i) => {
      let peak = 0
      if (levels) for (let b = from; b <= to; b++) peak = Math.max(peak, levels[b] ?? 0)
      const tall = Math.max(1, Math.round((peak / 255) * EQ_H))
      ctx.fillRect(i * 2, EQ_H - tall, 1, tall)
    })
  }
  requestAnimationFrame(draw)
  return canvas
}

/** The name of the radio's track while it's the one sounding, else null. */
const soundingName = () => {
  const id = radioSounding() ? nowPlaying(radio()) : null
  return id ? t().radio.tracks[id] : null
}

/**
 * The lobby's top-bar button: the radio set; while the radio plays, its
 * equalizer and track name too (the now-playing pill). Opens the sheet.
 */
export const radioButton = (onOpen: () => void, key?: string) => {
  const m = t().radio
  const name = h('span', { class: 'radio-chip-name' })
  const now = h('span', { class: 'radio-chip-now', hidden: true })
  const button = h(
    'button',
    { class: 'shell-btn radio-chip box', type: 'button', 'aria-label': m.open, title: m.open, onclick: onOpen },
    h('img', { src: radioIcon(), alt: '' }),
    now,
    key ? h('span', { class: 'key-hint' }, key) : null,
  )
  const follow = () => {
    const track = soundingName()
    now.hidden = track === null
    button.classList.toggle('on', track !== null)
    if (track) setText(name, track)
    button.setAttribute('aria-label', track ? `${m.open}: ${m.nowPlaying} ${track}` : m.open)
  }
  now.append(equalizer(follow), name)
  return button
}

/**
 * The now-playing pill: the track and its equalizer, shown only while the
 * radio is what plays. The pause menu's is text; `button` makes it a pill
 * the lobby presses to open the sheet: an upright phone's, whose top bar has
 * no room for the radio set, shows it among the mode's pills.
 */
export const radioPill = (button = false) => {
  const name = h('span', { class: 'radio-pill-name' })
  const pill = button ? h('button', { class: 'lobby-pill lobby-pill-go radio-pill', type: 'button', hidden: true }) : h('p', { class: 'radio-pill', hidden: true })
  const follow = () => {
    const track = soundingName()
    pill.hidden = track === null
    if (track) setText(name, button ? track : `${t().radio.nowPlaying}: ${track}`)
    if (track && button) pill.setAttribute('aria-label', `${t().radio.open}: ${t().radio.nowPlaying} ${track}`)
  }
  pill.append(equalizer(follow), name)
  return pill
}

/* ---------------- The sheet ---------------- */

const TABS = ['queue', 'library', 'favorites'] as const
type Tab = (typeof TABS)[number]

/** The tab the sheet opened on last. */
let lastTab: Tab = 'library'

const kitIcon = (id: RadioKitIcon) => h('img', { class: 'ink-icon', src: radioKitIcon(id), alt: '' })

/** A square icon button with its label for screen readers and a tooltip. */
const iconBtn = (icon: Node, label: string, onClick: () => void, opts: { cls?: string; disabled?: boolean } = {}) =>
  h(
    'button',
    { class: opts.cls ? `btn radio-icon-btn ${opts.cls}` : 'btn radio-icon-btn', type: 'button', 'aria-label': label, title: label, disabled: opts.disabled, onclick: (e: Event) => (e.stopPropagation(), onClick()) },
    icon,
  )

/** A locked track's way in, in the player's words. */
const lockLine = (track: RadioEntry) => {
  const m = t().radio
  const un = track.unlock
  if (un.kind === 'biome') return m.lockBiome(t().world.biomes[un.biome])
  if (un.kind !== 'legend') return m.lockHeard
  const names = un.ids.map((id) => ENEMIES[id].name)
  const shown = names.length > 4 ? [...names.slice(0, 3), '…'] : names
  return m.lockLegend(new Intl.ListFormat(LOCALES[locale()].tag, { type: 'disjunction' }).format(shown))
}

/**
 * Opens the Rádio over whatever is on screen (the lobby, Settings' Som row):
 * Rotom and what plays, the controls (previous, play or stop, next, shuffle,
 * repeat), where it plays, and three pages: the queue (reorder with ▲ ▼, take
 * out with ✕), every track by group (locked ones say how they open) and the
 * favorites. Laid out as the shop's sheet (`.shop-sheet`). Esc, Backspace,
 * ◀ or a tap outside close it; `onClose` runs after that dispatch.
 */
export const openRadio = (root: HTMLElement, input: Input, onClose: () => void): Screen => {
  const m = t().radio
  let tab: Tab = lastTab
  let closed = false

  const change = (next: RadioState, sound: Parameters<typeof playSfx>[0] = 'select') => {
    playSfx(sound)
    setRadio(next)
  }

  /* The deck: Rotom, what plays, the controls. */
  const nowName = h('b', { class: 'radio-now-name' })
  const nowLine = h('small', { class: 'radio-now-line' })
  const playBtn = iconBtn(kitIcon('play'), m.play, () => togglePlay(), { cls: 'radio-play' })
  const shuffleBtn = iconBtn(kitIcon('shuffle'), m.shuffle, () => change({ ...radio(), shuffle: !radio().shuffle }, 'move'))
  const repeatBtn = iconBtn(kitIcon('repeat'), m.repeat.all, () => change({ ...radio(), repeat: cycleRepeat(radio().repeat) }, 'move'))
  const deck = h(
    'div',
    { class: 'radio-deck' },
    h('img', { class: 'radio-host', src: portraitUrl(HOST_DEX), alt: '', width: 40, height: 40 }),
    h('div', { class: 'radio-now' }, nowName, nowLine),
    equalizer(),
  )
  const controls = h(
    'div',
    { class: 'radio-controls' },
    iconBtn(kitIcon('prev'), m.prev, () => change({ ...previous(radio()), on: true }, 'move')),
    playBtn,
    iconBtn(kitIcon('next'), m.next, () => next()),
    shuffleBtn,
    repeatBtn,
  )

  /* Where it plays. */
  const where = segmented(
    RADIO_WHERE.map((id) => ({ id, label: m.places[id] })),
    radio().where,
    (id) => change({ ...radio(), where: id }, 'move'),
  )
  const fights = h('button', { class: 'btn radio-toggle', type: 'button', onclick: () => change({ ...radio(), fights: !radio().fights }, 'move') }, h('span', { class: 'radio-box' }), m.fights)
  const whereRow = h('div', { class: 'radio-where' }, h('span', { class: 'radio-where-label' }, m.where), where.el, fights)

  const tabs = TABS.map((id) => h('button', { class: 'shop-tab radio-tab', type: 'button', role: 'tab', onclick: () => showTab(id) }, m.tabs[id]))
  const body = h('div', { class: 'radio-body', tabIndex: -1 })
  const back = h('button', { class: 'btn shop-back', type: 'button', 'aria-label': t().mart.back, onclick: () => close() }, '◀', h('span', { class: 'shop-back-label' }, ` ${t().mart.back}`))
  const sheet = h(
    'section',
    { class: 'shop-sheet box radio-sheet', 'aria-label': m.title },
    h('header', { class: 'shop-head' }, back, h('h2', { class: 'shop-title' }, m.title)),
    deck,
    controls,
    whereRow,
    h('nav', { class: 'shop-tabs', role: 'tablist' }, ...tabs),
    body,
    h('footer', { class: 'shop-foot' }, hint(m.hintKeys, m.hintTouch)),
  )
  const el = h('div', { class: 'shop-layer radio-layer' }, sheet)
  el.addEventListener('click', (e) => e.target === el && close())

  function togglePlay() {
    const s = radio()
    if (s.on && nowPlaying(s)) return change({ ...s, on: false })
    if (s.queue.length === 0) return change(playList(s, openTracks()))
    change({ ...s, on: true, at: s.at ?? 0 })
  }

  function next() {
    change({ ...skip(radio(), true, Math.random), on: true }, 'move')
  }

  /* ---------- Rows ---------- */

  const trackRow = (track: RadioEntry, open: boolean, s: RadioState) => {
    const id = track.theme
    const name = m.tracks[id]
    const playing = s.on && nowPlaying(s) === id
    if (!open)
      return h(
        'div',
        { class: 'radio-row locked', 'aria-label': `${name}: ${m.locked}` },
        h('img', { class: 'radio-row-lock', src: lockIcon(), alt: '' }),
        h('span', { class: 'radio-row-text' }, h('b', {}, name), h('small', {}, lockLine(track))),
      )
    const fav = s.favorites.includes(id)
    const queued = s.queue.includes(id)
    return h(
      'div',
      { class: playing ? 'radio-row playing' : 'radio-row' },
      iconBtn(h('img', { src: radioStarIcon(fav), alt: '' }), fav ? m.unfavorite : m.favorite, () => change(toggleFavorite(radio(), id), 'move'), { cls: 'radio-star' }),
      h('button', { class: 'radio-row-text', type: 'button', title: m.playNow, onclick: () => change(playNow(radio(), id)) }, h('b', {}, name), h('small', {}, playing ? m.nowPlaying : m.groups[track.group])),
      queued ? h('span', { class: 'radio-queued', title: m.queued }, '✓') : iconBtn(kitIcon('add'), m.add, () => change(enqueue(radio(), id), 'move')),
    )
  }

  const queueRow = (id: RadioThemeId, index: number, s: RadioState) => {
    const playing = s.at === index
    return h(
      'div',
      { class: playing ? 'radio-row playing' : 'radio-row' },
      h('span', { class: 'radio-index' }, playing ? '▶' : String(index + 1)),
      h('button', { class: 'radio-row-text', type: 'button', title: m.playNow, onclick: () => change({ ...radio(), on: true, at: index }) }, h('b', {}, m.tracks[id]), playing ? h('small', {}, m.nowPlaying) : null),
      iconBtn(kitIcon('up'), m.up, () => change(moveInQueue(radio(), index, -1), 'move'), { disabled: index === 0 }),
      iconBtn(kitIcon('down'), m.down, () => change(moveInQueue(radio(), index, 1), 'move'), { disabled: index === s.queue.length - 1 }),
      iconBtn(h('span', { class: 'radio-x' }, '✕'), m.remove, () => change(dequeue(radio(), index), 'move')),
    )
  }

  const listButton = (label: string, ids: readonly RadioThemeId[]) =>
    h('button', { class: 'btn radio-list-btn', type: 'button', disabled: ids.length === 0, onclick: () => change(playList(radio(), ids)) }, kitIcon('play'), label)

  const bodyRows = (s: RadioState): Node[] => {
    const u = radioUnlocks()
    const open = new Set(RADIO_TRACKS.filter((tr) => isUnlocked(tr, u)).map((tr) => tr.theme))
    if (tab === 'queue') return s.queue.length === 0 ? [h('p', { class: 'radio-empty' }, m.queueEmpty)] : s.queue.map((id, i) => queueRow(id, i, s))
    if (tab === 'favorites') {
      const favs = RADIO_TRACKS.filter((tr) => s.favorites.includes(tr.theme) && open.has(tr.theme))
      if (favs.length === 0) return [h('p', { class: 'radio-empty' }, m.favoritesEmpty)]
      return [listButton(m.playFavorites, favs.map((tr) => tr.theme)), ...favs.map((tr) => trackRow(tr, true, s))]
    }
    return [
      listButton(m.playAll, [...open]),
      ...RADIO_GROUPS.flatMap((group) => [
        h('h3', { class: 'radio-group' }, m.groups[group]),
        ...RADIO_TRACKS.filter((tr) => tr.group === group).map((tr) => trackRow(tr, open.has(tr.theme), s)),
      ]),
    ]
  }

  /* ---------- Painting ---------- */

  const paint = () => {
    if (closed) return
    const s = radio()
    const id = s.on ? nowPlaying(s) : null
    setText(nowName, id ? m.tracks[id] : m.title)
    setText(nowLine, id ? m.groups[RADIO_TRACKS.find((tr) => tr.theme === id)!.group] : s.on ? m.idle : m.host)
    const on = s.on && id !== null
    playBtn.replaceChildren(kitIcon(on ? 'stop' : 'play'))
    playBtn.setAttribute('aria-label', on ? m.stop : m.play)
    playBtn.title = on ? m.stop : m.play
    playBtn.classList.toggle('on', on)
    shuffleBtn.classList.toggle('on', s.shuffle)
    shuffleBtn.setAttribute('aria-pressed', String(s.shuffle))
    repeatBtn.replaceChildren(kitIcon(s.repeat === 'one' ? 'repeatOne' : 'repeat'))
    repeatBtn.classList.toggle('on', s.repeat !== 'off')
    repeatBtn.title = m.repeat[s.repeat]
    repeatBtn.setAttribute('aria-label', m.repeat[s.repeat])
    where.set(s.where)
    fights.hidden = s.where !== 'everywhere'
    fights.classList.toggle('on', s.fights)
    fights.setAttribute('aria-pressed', String(s.fights))
    tabs.forEach((b, i) => {
      const here = TABS[i] === tab
      b.classList.toggle('on', here)
      b.setAttribute('aria-selected', String(here))
    })
    const scroll = body.scrollTop
    body.replaceChildren(...bodyRows(s))
    body.scrollTop = scroll
  }

  function showTab(id: Tab) {
    if (id === tab) return
    playSfx('move')
    tab = lastTab = id
    body.scrollTop = 0
    paint()
  }

  const off = input.onKey((key) => {
    if (closed) return
    const at = TABS.indexOf(tab)
    if (key === 'Escape' || key === 'Backspace') close()
    else if (key === 'KeyQ' || key === 'ArrowLeft') showTab(TABS[(at + TABS.length - 1) % TABS.length]!)
    else if (key === 'KeyE' || key === 'ArrowRight') showTab(TABS[(at + 1) % TABS.length]!)
    else if (key === 'ArrowUp' || key === 'ArrowDown') body.scrollBy({ top: key === 'ArrowUp' ? -80 : 80 })
    else if (key === 'KeyN') next()
    else if (key === 'Space' || key === 'Enter') togglePlay()
  })
  const offRadio = onRadio(paint)

  function dispose() {
    if (closed) return
    closed = true
    off()
    offRadio()
    el.remove()
  }

  function close() {
    if (closed) return
    playSfx('select')
    dispose()
    later(onClose)
  }

  paint()
  root.append(el)
  return { el, dispose }
}
