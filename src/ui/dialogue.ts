import { assetUrl } from '../assets'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { t } from '../i18n'
import type { Dex } from '../render/sprites'
import { h } from './dom'
import { uiDpr } from './uiScale'
import type { Screen } from './screens'

/**
 * A Mystery Dungeon–style dialogue box: the speaker's portrait (with its
 * emotion), the name, and the line typed out letter by letter. A tap, Enter,
 * Space or E (A on a gamepad) finishes the line, then moves to the next;
 * Esc or Backspace (B) skips to the end. Its owner calls `tick` every frame.
 */

/** SpriteCollab's portrait emotions the game downloads for talking species (`EMOTIONS` in scripts/dex.mjs). */
export const EMOTIONS = ['Normal', 'Happy', 'Joyous', 'Surprised', 'Sigh', 'Inspired', 'Angry'] as const
export type Emotion = (typeof EMOTIONS)[number]

export type DialogueLine = { text: string; emotion?: Emotion }

/** Who talks: a name over the text (in `color`) and a portrait per emotion (an `<img>`, or a recolored canvas). */
export type Speaker = { name: string; color: string; portrait: (emotion: Emotion) => HTMLElement }

/** A talking species' emotion portrait (`public/assets/pokemon/<dex>/portraits/<Emotion>.png`). */
export const emotionUrl = (dex: Dex, emotion: Emotion) => assetUrl(`pokemon/${dex}/portraits/${emotion}.png`)

/** Letters per second of the typewriter. */
const CPS = 45
/** Portrait art px (SpriteCollab's), and about how tall (CSS px) it shows on big screens and on phones. */
const PORTRAIT = { art: 40, wide: 64, narrow: 48 }

/** Sizes a portrait to whole device pixels per art pixel, near its CSS size for the screen. */
const fitPortrait = (portrait: HTMLElement) => {
  const dpr = uiDpr()
  const want = matchMedia('(max-width: 759px), (max-height: 500px)').matches ? PORTRAIT.narrow : PORTRAIT.wide
  const k = Math.max(1, Math.round((want * dpr) / PORTRAIT.art))
  const css = `${(PORTRAIT.art * k) / dpr}px`
  portrait.style.width = css
  portrait.style.height = css
  return portrait
}

export type Dialogue = Screen & {
  /** Says more in the same box (another speaker, if given); `onDone` runs again once these are read. */
  say: (lines: readonly DialogueLine[], speaker?: Speaker) => void
}

/**
 * Opens the box in `root` and types `lines` one after the other; after the
 * last, `onDone` (the box stays until its owner disposes it). `className`
 * adds a placement (`.dialogue` sits at the bottom of the screen by default).
 * `passive`: the box only talks (the shop's keeper beside its panel): no keys,
 * no "next" arrow, and a tap just finishes the line, so the presses stay the panel's.
 */
export const dialogue = (
  root: HTMLElement,
  input: Input,
  opts: { speaker: Speaker; lines: readonly DialogueLine[]; onDone: () => void; className?: string; passive?: boolean },
): Dialogue => {
  let speaker = opts.speaker
  let lines = opts.lines
  let index = 0
  /** When the current line started typing (ms), and how many letters show. */
  let startedAt = performance.now()
  let shown = 0
  let done = false

  const frame = h('span', { class: 'dialogue-portrait' })
  const name = h('b', { class: 'dialogue-name' })
  const typed = h('span', {})
  const rest = h('span', { class: 'dialogue-rest', 'aria-hidden': 'true' })
  const text = h('p', { class: 'dialogue-text', 'aria-live': 'polite' }, typed, rest)
  const next = h('span', { class: 'dialogue-next blink', 'aria-label': t().plaza.next }, '▼')
  const box = h('div', { class: 'dialogue box pop', role: 'dialog' }, frame, h('div', { class: 'dialogue-body' }, name, text), next)
  const el = h('div', { class: `dialogue-layer${opts.className ? ` ${opts.className}` : ''}` }, box)

  const line = () => lines[index]!
  const letters = () => [...line().text]

  /** Shows the current line's speaker and portrait, with nothing typed yet. */
  const begin = () => {
    name.textContent = speaker.name
    name.style.color = speaker.color
    frame.replaceChildren(fitPortrait(speaker.portrait(line().emotion ?? 'Normal')))
    startedAt = performance.now()
    shown = 0
    paint()
  }

  const paint = () => {
    const all = letters()
    typed.textContent = all.slice(0, shown).join('')
    // The untyped rest keeps its room, so the box never grows as the line types.
    rest.textContent = all.slice(shown).join('')
    next.classList.toggle('hidden', opts.passive === true || shown < all.length)
  }

  /** A press: finishes the line being typed, else moves on (or ends). */
  const advance = () => {
    if (done) return
    const total = letters().length
    if (shown < total) {
      shown = total
      startedAt = -Infinity
      return paint()
    }
    playSfx('select')
    if (index + 1 < lines.length) {
      index++
      return begin()
    }
    done = true
    opts.onDone()
  }

  const skip = () => {
    if (done) return
    done = true
    opts.onDone()
  }

  const off = opts.passive
    ? () => {}
    : input.onKey((key) => {
        if (key === 'Enter' || key === 'Space' || key === 'KeyE') advance()
        else if (key === 'Escape' || key === 'Backspace') skip()
      })
  box.addEventListener('click', () => (opts.passive ? shown < letters().length && advance() : advance()))

  root.append(el)
  begin()

  return {
    el,
    tick: () => {
      if (done) return
      const total = letters().length
      if (shown >= total) return
      const now = Math.min(total, Math.floor(((performance.now() - startedAt) / 1000) * CPS))
      if (now === shown) return
      if (now % 2 === 0) playSfx('talk', 50)
      shown = now
      paint()
    },
    say: (more, who) => {
      if (who) speaker = who
      lines = more
      index = 0
      done = false
      begin()
    },
    dispose: () => (off(), el.remove()),
  }
}
