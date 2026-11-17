import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { GUIDE } from '../data/guide'
import type { InputKind } from '../game/bugReport'
import type { TutorialRun } from '../game/tutorial'
import type { Game, Phase } from '../game/types'
import { t } from '../i18n'
import { dialogue, emotionUrl, type DialogueLine } from './dialogue'
import { h } from './dom'
import { boundMoveKeys } from './inputLabels'
import { guideSpeaker } from './visitors'
import './tutorialCoach.css'

/**
 * Rotom's coach over the training run (`game/tutorial.ts`): a slim dialogue
 * box at the top, under the boss bar, that never takes presses from the game
 * (`dialogue`'s passive mode) and says the line for the lesson under way, the
 * moment it changes. Over a level-up's or a Poké Ball's screen the box steps
 * aside and a one-line note sits under that screen's title instead, so the
 * cards stay in full view. Its Pular button skips; the last line's button
 * finishes. While it's up the HUD drops what the lessons don't use (the clock,
 * the counters, the minimap) and the run's toasts go to the bottom.
 */

export type TutorialCoach = { dispose: () => void }

type Line = DialogueLine & { key: string }

/** How to move with the input at hand: keys (the bound ones), a finger or a stick. */
const moveLine = (kind: InputKind | null) => {
  const m = t().tutorial
  if (kind === 'gamepad') return m.movePad
  if (kind === 'touch' || (kind === null && matchMedia('(pointer: coarse)').matches)) return m.moveTouch
  return m.moveKeys(boundMoveKeys())
}

/** Rotom's line for the lesson as the game stands: a pick's note, the hurt warning while it holds, else the step's. */
const lineFor = (tut: TutorialRun, phase: Phase, picks: number, kind: InputKind | null): Line => {
  const m = t().tutorial
  if (phase === 'levelup') return picks === 0 ? { key: 'pick', text: m.pick, emotion: 'Inspired' } : { key: 'pickAgain', text: m.pickAgain, emotion: 'Happy' }
  if (phase === 'pokeball') return { key: 'ballPick', text: m.ballPick, emotion: 'Happy' }
  if (tut.ouch > 0 && tut.step !== 'end') return { key: 'hurt', text: m.hurt, emotion: 'Surprised' }
  switch (tut.step) {
    case 'move':
      return { key: `move-${kind}`, text: moveLine(kind), emotion: 'Happy' }
    case 'fight':
      return { key: 'fight', text: m.fight, emotion: 'Inspired' }
    case 'xp':
      return { key: 'xp', text: m.xp, emotion: 'Joyous' }
    case 'wave':
      return { key: 'wave', text: m.wave, emotion: 'Surprised' }
    case 'ball':
      return { key: 'ball', text: m.ball, emotion: 'Joyous' }
    case 'boss':
      return { key: 'boss', text: m.boss, emotion: 'Angry' }
    case 'end':
      return { key: 'end', text: m.end, emotion: 'Joyous' }
  }
}

/** Phases with a pick screen the coach puts its note on. */
const NOTED: readonly Phase[] = ['levelup', 'pokeball']

/**
 * Opens the coach over `g`'s training run in `root` (the shell's `#ui`).
 * `skip` and `finish` are the shell's: either ends the run.
 */
export const tutorialCoach = (root: HTMLElement, input: Input, g: Game, opts: { skip: () => void; finish: () => void }): TutorialCoach => {
  const m = t().tutorial
  let shown = ''
  let picks = 0
  let phase: Phase = g.phase
  let over = false

  const box = dialogue(root, input, { speaker: guideSpeaker(), lines: [{ text: '' }], onDone: () => {}, className: 'tutorial-coach', passive: true })
  const skip = h('button', { class: 'btn tut-skip', type: 'button', 'aria-label': m.skipLabel }, `${m.skip} »`)
  const go = h('button', { class: 'btn btn-primary tut-go hidden', type: 'button' }, m.go)
  const dialog = box.el.querySelector<HTMLElement>('.dialogue')!
  dialog.append(h('div', { class: 'tut-actions' }, skip, go))
  // The box's own tap only finishes the typing: the buttons are the coach's.
  for (const b of [skip, go]) b.addEventListener('click', (e) => e.stopPropagation())
  skip.addEventListener('click', () => {
    if (over) return
    over = true
    playSfx('select')
    opts.skip()
  })
  const finish = () => {
    if (over) return
    over = true
    playSfx('select')
    opts.finish()
  }
  go.addEventListener('click', finish)
  // The last line waits for a press: Enter, or the special's button (Space, A on a gamepad).
  const offKey = input.onKey((key) => {
    if (g.training?.tutorial?.step === 'end' && g.phase === 'playing' && (key === 'Enter' || key === 'Space')) finish()
  })

  const hud = () => root.querySelector<HTMLElement>(':scope > .hud')
  root.classList.add('tutorial-run')

  /** A note under the open pick screen's title (once per screen). */
  const note = (line: Line) => {
    const dialog = root.querySelector<HTMLElement>(':scope > .screen .dialog')
    const title = dialog?.querySelector(':scope > .dialog-title')
    if (!dialog || !title || dialog.querySelector(':scope > .tut-note')) return
    title.after(
      h(
        'div',
        { class: 'tut-note pop', role: 'note' },
        h('img', { class: 'tut-note-face', src: emotionUrl(GUIDE.dex, line.emotion ?? 'Normal'), alt: GUIDE.name, width: 40, height: 40 }),
        h('span', {}, line.text),
      ),
    )
  }

  let raf = 0
  const frame = () => {
    raf = requestAnimationFrame(frame)
    const tut = g.training?.tutorial
    if (!tut) return
    hud()?.classList.add('tutorial')
    // A level-up screen closed: the next one gets the shorter note.
    if (phase === 'levelup' && g.phase !== 'levelup') picks++
    phase = g.phase
    const line = lineFor(tut, phase, picks, input.lastKind())
    const noted = NOTED.includes(phase)
    box.el.classList.toggle('hidden', phase !== 'playing')
    go.classList.toggle('hidden', tut.step !== 'end')
    skip.classList.toggle('hidden', tut.step === 'end')
    if (noted) note(line)
    else if (line.key !== shown && phase === 'playing') {
      shown = line.key
      box.say([line])
    }
    box.tick?.(performance.now() / 1000)
  }
  raf = requestAnimationFrame(frame)

  return {
    dispose: () => {
      cancelAnimationFrame(raf)
      offKey()
      box.dispose()
      root.classList.remove('tutorial-run')
      hud()?.classList.remove('tutorial')
    },
  }
}
