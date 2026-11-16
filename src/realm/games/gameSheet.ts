import { playSfx } from '../../engine/audio'
import { closeIcon } from '../../render/art'
import { h } from '../../ui/dom'

/**
 * The kit's sheet over a canvas mini game (the Escavação, the Máquina de
 * Pelúcias): every word the in-world font can't write, in the arcade sticker
 * look. It sits three ways:
 *   `dock`    beside the scene sideways, under it upright, leaving the part the
 *             game keeps (`Keep`) in view: an entry, a result the scene still shows;
 *   `card`    in the middle, over a scene that waits: a question, a summary;
 *   `banner`  a line at the foot while the scene plays, never in the way of a tap.
 * Its body scrolls when a small phone can't fit it and its buttons stay put.
 */

export type SheetKind = 'dock' | 'card' | 'banner'

/** A button of the sheet: the primary one is the kit's 3D button (a `note` line under its label), the others paper. */
export type SheetAction = { label: string; run: () => void; primary?: boolean; note?: string }

/**
 * What the dock leaves in view, in the game's pixels: the columns left of `x`
 * sideways, the rows above `y` upright. Upright it stands at the stage's foot,
 * or right under those rows with `hug` (a machine whose controls it replaces).
 */
export type Keep = { x: number; y: number; hug?: boolean }

export type Rect = { x: number; y: number; w: number; h: number }

export type Line = HTMLElement | false | null

export type GameSheet = {
  /** `close` puts the kit's round ✕ on the sheet's corner (a sheet looked at, then put away) instead of a row of buttons. */
  show: (kind: SheetKind, lines: readonly Line[], actions?: readonly SheetAction[], close?: { label: string; run: () => void }) => void
  hide: () => void
  /** Keeps the sheet in step with the canvas (the frame refits it when the phone turns): call it every frame. */
  track: () => void
  /** The part of the canvas no sheet covers, in game pixels (above a banner; beside or above a dock). */
  free: () => Rect
  /** Moves what the dock leaves in view (a fluid canvas lays its game out anew). */
  setKeep: (keep: Keep) => void
  dispose: () => void
}

/** A sheet's heading: an optional kicker on a gold tag above the title. */
export const sheetTitle = (title: string, kicker?: string) =>
  h('header', { class: 'mg-title' }, kicker ? h('span', { class: 'mg-kicker' }, kicker) : false, h('h3', {}, title))

/** Someone talking (a keeper, a guide): their portrait and a speech bubble. */
export const speech = (portrait: string, ...words: (HTMLElement | string)[]) =>
  h('div', { class: 'mg-speech' }, h('img', { src: portrait, alt: '', width: 40, height: 40 }), h('p', {}, ...words))

/** A line that matters more than the rest (why no wall can be bought now). */
export const callout = (text: string) => h('p', { class: 'mg-callout' }, text)

export const gameSheet = (stage: HTMLElement, size: { w: number; h: number }, keep: Keep): GameSheet => {
  const body = h('div', { class: 'mg-sheet-body' })
  const foot = h('div', { class: 'mg-sheet-foot' })
  // Which way the canvas is held: asked again as it goes (a fluid canvas turns with the phone).
  const orient = () => `${size.h > size.w ? 'mg-tall' : 'mg-wide'}${keep.hug ? ' mg-hug' : ''}`
  const corner = h('button', { class: 'arc-icon-btn mg-close hidden', type: 'button' }, h('img', { src: closeIcon(), alt: '' }))
  const el = h('div', { class: `mg-sheet ${orient()} hidden` }, body, foot, corner)
  let onClose: (() => void) | null = null
  corner.addEventListener('click', () => (playSfx('select'), onClose?.()))
  const setKeep = (next: Keep) => {
    el.style.setProperty('--keep-x', String(next.x))
    el.style.setProperty('--keep-y', String(next.y))
  }
  setKeep(keep)
  stage.append(el)
  let kind: SheetKind = 'dock'
  let laid = ''
  /** The canvas's place in the stage and its CSS px per game px, as last tracked. */
  let canvas = { l: 0, t: 0, k: 1 }

  const button = (a: SheetAction) =>
    h(
      'button',
      { class: a.primary ? 'arc-btn arc-btn-small mg-go' : 'btn mg-alt', type: 'button', onclick: () => (playSfx('select'), a.run()) },
      a.primary ? h('span', { class: 'arc-outline' }, a.label) : a.label,
      a.primary && a.note ? h('small', {}, a.note) : false,
    )

  const show = (next: SheetKind, lines: readonly Line[], actions: readonly SheetAction[] = [], close?: { label: string; run: () => void }) => {
    kind = next
    const shown = lines.flatMap((l) => (l ? [l] : []))
    el.className = `mg-sheet mg-${next} ${orient()}${shown.length === 0 && actions.length === 0 ? ' hidden' : ''}`
    body.replaceChildren(...shown)
    body.scrollTop = 0
    // The primary button first: it leads the row, and takes a row of its own on a phone held upright.
    foot.replaceChildren(...[...actions].sort((a, b) => Number(b.primary === true) - Number(a.primary === true)).map(button))
    foot.classList.toggle('hidden', actions.length === 0)
    onClose = close?.run ?? null
    corner.classList.toggle('hidden', !close)
    corner.setAttribute('aria-label', close?.label ?? '')
    corner.title = close?.label ?? ''
  }

  const track = () => {
    const c = stage.querySelector('canvas')
    if (!c) return
    const turned = orient()
    if (!el.classList.contains(turned.split(' ')[0]!)) el.className = `mg-sheet mg-${kind} ${turned}${el.classList.contains('hidden') ? ' hidden' : ''}`
    const k = c.clientWidth / size.w
    const key = `${c.offsetLeft}:${c.offsetTop}:${c.clientWidth}:${c.clientHeight}`
    canvas = { l: c.offsetLeft, t: c.offsetTop, k }
    if (key === laid) return
    laid = key
    el.style.setProperty('--cv-l', `${c.offsetLeft}px`)
    el.style.setProperty('--cv-t', `${c.offsetTop}px`)
    el.style.setProperty('--cv-w', `${c.clientWidth}px`)
    el.style.setProperty('--cv-h', `${c.clientHeight}px`)
    el.style.setProperty('--cv-k', String(k))
  }

  const free = (): Rect => {
    const all = { x: 0, y: 0, w: size.w, h: size.h }
    if (el.classList.contains('hidden')) return all
    // A banner covers the stage's foot whichever way it's held.
    if (kind === 'banner') return { ...all, h: Math.max(0, Math.min(size.h, Math.floor((el.offsetTop - canvas.t) / canvas.k))) }
    if (kind !== 'dock') return all
    if (size.h > size.w) return { ...all, h: Math.max(0, Math.min(size.h, Math.floor((el.offsetTop - canvas.t) / canvas.k))) }
    return { ...all, w: Math.max(0, Math.min(size.w, Math.floor((el.offsetLeft - canvas.l) / canvas.k))) }
  }

  return { show, hide: () => show(kind, []), track, free, setKeep, dispose: () => el.remove() }
}
