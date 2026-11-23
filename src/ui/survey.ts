import { track } from '../analytics'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { dayKey } from '../game/missions'
import { DIFFICULTY_IDS, type Difficulty } from '../game/difficulty'
import { closeIcon, pokeballIcon } from '../render/art'
import {
  DESIGN_ASPECT_PAIRS,
  DESIGN_RATINGS,
  DESIGN_SURVEY,
  SURVEY,
  SURVEY_ANSWERS,
  daysBetween,
  designSurveyDue,
  seenOn,
  toggleAspect,
  type DesignAspect,
  type DesignRating,
  type DesignSeen,
  type SurveyAnswer,
} from '../data/survey'
import { t } from '../i18n'
import { h, later } from './dom'
import { loadSave, today } from './save'
import { difficultyTag, hint, type Screen } from './screens'
import { segmented } from './shell'
import { nearestInDirection, type Direction } from './spatial'
import { toast } from './toasts'

/** The lobby's surveys. */
export type SurveyId = 'difficulty' | 'design'

/** Where a device stands with a survey: `answered`, closed unanswered (`dismissed`) or told not to ask again (`declined`). */
type Status = 'new' | 'dismissed' | 'declined' | 'answered'

/** One survey's standing on this device, under its own key. */
const statusOf = (id: string) => {
  const key = `ps:survey:${id}`
  return {
    get: (): Status => {
      try {
        const v = localStorage.getItem(key)
        return v === 'answered' || v === 'dismissed' || v === 'declined' ? v : 'new'
      } catch {
        // Nowhere to remember a "not now": better never to ask than to ask every time.
        return 'answered'
      }
    },
    set: (s: Exclude<Status, 'new'>) => {
      try {
        localStorage.setItem(key, s)
      } catch {}
    },
    forget: () => {
      try {
        localStorage.removeItem(key)
      } catch {}
    },
  }
}

const difficultyStatus = statusOf(SURVEY.id)
const designStatus = statusOf(DESIGN_SURVEY.id)

/** Forgets this device's answer (dev tools), so the lobby asks again. */
export const forgetSurvey = difficultyStatus.forget

const runsPlayed = () => loadSave().achievements.lifetime.runs

/** Whether the lobby shows the survey's button: a player with a few runs (`SURVEY.minRuns`) who hasn't answered. */
const surveyWaiting = () => difficultyStatus.get() !== 'answered' && runsPlayed() >= SURVEY.minRuns

/** When this device first saw the new design and on how many days since. */
const SEEN_KEY = `ps:survey:${DESIGN_SURVEY.id}:seen`

const isSeen = (v: unknown): v is DesignSeen => {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return typeof s.first === 'string' && typeof s.last === 'string' && typeof s.days === 'number' && typeof s.runs === 'number'
}

const readSeen = (): DesignSeen | null => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null')
    return isSeen(v) ? v : null
  } catch {
    return null
  }
}

const writeSeen = (seen: DesignSeen) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
  } catch {}
}

/** The new lobby opened: counts the day for the design survey (`designSurveyDue`). */
export const noteDesignSeen = () => {
  const seen = readSeen()
  const next = seenOn(seen, dayKey(today()), runsPlayed())
  if (next !== seen) writeSeen(next)
}

/** Forgets the design survey's answer and first sight (dev tools). */
export const forgetDesignSurvey = () => {
  designStatus.forget()
  try {
    localStorage.removeItem(SEEN_KEY)
  } catch {}
}

/** Meets the design survey's thresholds as if the player had lived with it (dev tools), so the next page load asks by itself. */
export const stageDesignSurveyDue = () => {
  designStatus.forget()
  const day = dayKey(today())
  writeSeen({ first: day, last: day, days: DESIGN_SURVEY.minDays, runs: runsPlayed() - DESIGN_SURVEY.minRuns })
}

const designSurveyWaiting = () => {
  const status = designStatus.get()
  return (status === 'new' || status === 'dismissed') && designSurveyDue(readSeen(), runsPlayed())
}

/** The survey the top bar's one clipboard stands for: the design's while it waits, as it can be sent away for good. */
export const waitingSurvey = (): SurveyId | null => (designSurveyWaiting() ? 'design' : surveyWaiting() ? 'difficulty' : null)

export const surveyLabel = (survey: SurveyId) => (survey === 'design' ? t().designSurvey.open : t().survey.open)

let offered = false
let designOffered = false

/** The survey the lobby should open by itself, if any: decided once, at its first build of the page load, so two never ask in one session. */
export const takeSurveyOffer = (): SurveyId | null => {
  if (offered) return null
  offered = true
  if (difficultyStatus.get() === 'new' && surveyWaiting()) return 'difficulty'
  if (designStatus.get() !== 'new' || !designSurveyWaiting()) return null
  designOffered = true
  return 'design'
}

/** Whether the design survey opened by itself on this page load: nothing else asks after it. */
export const designSurveyOffered = () => designOffered

/**
 * The difficulty survey, over the lobby: how Normal, Difícil and Pesadelo
 * feel (Fácil, Médio, Difícil or Não sei). ↑ ↓ move between the levels and the
 * buttons, ← → pick the answer. Enviar, once all three are in, sends them
 * (`survey_difficulty`) and thanks the player; Agora não, Esc or Backspace
 * close it unanswered, and the lobby's clipboard keeps asking. `onClose`
 * runs after the key dispatch.
 */
export const surveyScreen = (root: HTMLElement, input: Input, onClose: () => void): Screen => {
  const m = t().survey
  const answers: Partial<Record<Difficulty, SurveyAnswer>> = {}
  const complete = (a: Partial<Record<Difficulty, SurveyAnswer>>): a is Record<Difficulty, SurveyAnswer> => DIFFICULTY_IDS.every((d) => a[d])

  const rows = DIFFICULTY_IDS.map((d, i) => {
    const seg = segmented(
      SURVEY_ANSWERS.map((id) => ({ id, label: m.answers[id] })),
      null,
      (id) => (focus(i, false), answer(d, id)),
    )
    const el = h('div', { class: 'survey-row', role: 'group', 'aria-label': t().difficulty.names[d] }, difficultyTag(d), seg.el)
    return { d, el, seg }
  })
  const send = h('button', { class: 'btn confirm', type: 'button', onclick: () => submit() }, m.send)
  const skip = h('button', { class: 'btn', type: 'button', onclick: () => close() }, m.later)
  const buttons = [send, skip]

  /** The highlighted row: a level's, or `rows.length` for the buttons (`button` picks which). */
  let row = 0
  let button = 0
  const paint = () => {
    rows.forEach((r, i) => r.el.classList.toggle('selected', i === row))
    buttons.forEach((b, i) => b.classList.toggle('selected', row === rows.length && i === button))
    send.disabled = !complete(answers)
  }
  const focus = (i: number, sound = true) => {
    const next = Math.max(0, Math.min(rows.length, i))
    if (next !== row && sound) playSfx('move')
    row = next
    paint()
  }

  const answer = (d: Difficulty, id: SurveyAnswer) => {
    playSfx('move')
    answers[d] = id
    rows.find((r) => r.d === d)?.seg.set(id)
    paint()
  }

  /** ← → on a level: the next answer along, from the first (→) or the last (←) while it has none. */
  const step = (dir: -1 | 1) => {
    const r = rows[row]
    if (!r) {
      playSfx('move')
      button = (button + 1) % buttons.length
      return paint()
    }
    const at = answers[r.d]
    const i = at ? (SURVEY_ANSWERS.indexOf(at) + dir + SURVEY_ANSWERS.length) % SURVEY_ANSWERS.length : dir > 0 ? 0 : SURVEY_ANSWERS.length - 1
    answer(r.d, SURVEY_ANSWERS[i]!)
  }

  const submit = () => {
    if (!complete(answers)) return focus(DIFFICULTY_IDS.findIndex((d) => !answers[d]))
    const { runs, wins } = loadSave().achievements.lifetime
    track('survey_difficulty', { ...answers, runs, wins })
    difficultyStatus.set('answered')
    toast(root, m.thanks)
    close()
  }

  const el = h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'dialog box pop survey' },
      h('div', { class: 'dialog-title' }, m.title),
      h('p', { class: 'survey-question' }, m.question),
      h('div', { class: 'survey-rows' }, ...rows.map((r) => r.el)),
      h('div', { class: 'buttons' }, ...buttons),
      hint(m.hintKeys, m.hintTouch),
    ),
  )

  const offKeys = input.onKey((key) => {
    if (key === 'Escape' || key === 'Backspace') return close()
    if (key === 'ArrowUp' || key === 'KeyW') return focus(row - 1)
    if (key === 'ArrowDown' || key === 'KeyS') return focus(row + 1)
    if (key === 'ArrowLeft' || key === 'KeyA') return step(-1)
    if (key === 'ArrowRight' || key === 'KeyD') return step(1)
    if (key !== 'Enter' && key !== 'Space') return
    // Enter on a level moves on to the next one; on the buttons it presses the highlighted one.
    if (row < rows.length) return focus(row + 1)
    if (button === 0) submit()
    else close()
  })

  let closed = false
  const dispose = () => {
    closed = true
    offKeys()
    el.remove()
  }
  const close = () => {
    if (closed) return
    if (difficultyStatus.get() === 'new') difficultyStatus.set('dismissed')
    playSfx('select')
    dispose()
    later(onClose)
  }

  paint()
  root.append(el)
  return { el, dispose, dim: 0.5 }
}

const STEPS: Partial<Record<string, Direction>> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' }

/**
 * The survey on the redesign, over the lobby: a rating on five Poké Balls and
 * at most two taps on what stands out, in one small sticker. Arrows move
 * between all of it by where it is on screen, Enter presses. Enviar, once
 * rated, sends it (`survey_design`) and thanks the player. Agora não, the ✕,
 * Esc or Backspace close it unanswered and the lobby's clipboard keeps asking;
 * opened again, Agora não becomes Não perguntar mais, which sends it away for
 * good. `onClose` runs after the key dispatch.
 */
export const designSurveyScreen = (root: HTMLElement, input: Input, onClose: () => void): Screen => {
  const m = t().designSurvey
  const asked = designStatus.get() === 'dismissed'
  let rating: DesignRating | null = null
  let aspects: readonly DesignAspect[] = []

  const balls = DESIGN_RATINGS.map((n) =>
    h(
      'button',
      { class: 'design-ball', type: 'button', 'aria-label': `${n}/5: ${m.ratings[n]}`, onclick: () => rate(n) },
      h('img', { src: pokeballIcon(), alt: '' }),
    ),
  )
  const word = h('p', { class: 'design-word' })
  const chips = DESIGN_ASPECT_PAIRS.flat().map((aspect) => ({
    aspect,
    el: h('button', { class: 'arc-chip design-aspect', type: 'button', onclick: () => toggle(aspect) }, m.aspects[aspect]),
  }))
  const send = h('button', { class: 'btn confirm', type: 'button', onclick: () => submit() }, m.send)
  const skip = h('button', { class: 'btn', type: 'button', onclick: () => (asked ? decline() : close()) }, asked ? m.never : m.later)
  const closeButton = h(
    'button',
    { class: 'arc-icon-btn', type: 'button', 'aria-label': m.close, title: m.close, onclick: () => close() },
    h('img', { class: 'ink-icon', src: closeIcon(), alt: '' }),
  )

  const targets = [closeButton, ...balls, ...chips.map((c) => c.el), send, skip]
  /** The highlighted control: the middle ball at first, so the scale starts unbiased. */
  let at = targets.indexOf(balls[2]!)

  const paint = () => {
    targets.forEach((el, i) => el.classList.toggle('arc-cursor', i === at))
    balls.forEach((el, i) => {
      el.classList.toggle('on', rating !== null && i < rating)
      el.setAttribute('aria-pressed', String(rating === DESIGN_RATINGS[i]))
    })
    chips.forEach(({ aspect, el }) => {
      el.classList.toggle('on', aspects.includes(aspect))
      el.setAttribute('aria-pressed', String(aspects.includes(aspect)))
    })
    word.textContent = rating === null ? m.pickRating : m.ratings[rating]
    word.classList.toggle('picked', rating !== null)
    send.disabled = rating === null
  }

  const rate = (n: DesignRating) => {
    playSfx('move')
    rating = n
    at = targets.indexOf(balls[n - 1]!)
    paint()
  }
  const toggle = (aspect: DesignAspect) => {
    playSfx('move')
    aspects = toggleAspect(aspects, aspect)
    at = targets.findIndex((el) => el === chips.find((c) => c.aspect === aspect)?.el)
    paint()
  }

  const submit = () => {
    if (rating === null) {
      at = targets.indexOf(balls[2]!)
      return paint()
    }
    const seen = readSeen()
    track('survey_design', {
      rating,
      aspects: [...aspects],
      runs: runsPlayed(),
      days: seen ? daysBetween(seen.first, dayKey(today())) : 0,
      returning: seen !== null && seen.runs >= DESIGN_SURVEY.returningRuns,
    })
    designStatus.set('answered')
    toast(root, m.thanks)
    close()
  }

  const decline = () => {
    designStatus.set('declined')
    close()
  }

  const el = h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'dialog arc-card pop design-survey', role: 'dialog', 'aria-label': m.title },
      h('header', { class: 'design-head' }, h('h2', {}, m.title), closeButton),
      h('p', { class: 'design-question' }, m.question),
      h('div', { class: 'design-balls', role: 'group', 'aria-label': m.question }, ...balls),
      word,
      h('p', { class: 'design-question' }, m.aspectsQuestion),
      h('div', { class: 'design-aspects', role: 'group', 'aria-label': m.aspectsQuestion }, ...chips.map((c) => c.el)),
      h('div', { class: 'buttons' }, send, skip),
      hint(m.hintKeys, m.hintTouch),
    ),
  )

  const offKeys = input.onKey((key) => {
    if (key === 'Escape' || key === 'Backspace') return close()
    const dir = STEPS[key]
    if (dir) {
      const next = nearestInDirection(targets.map((target) => target.getBoundingClientRect()), at, dir)
      if (next < 0) return
      playSfx('move')
      at = next
      return paint()
    }
    if (key === 'Enter' || key === 'Space') targets[at]?.click()
  })

  let closed = false
  const dispose = () => {
    closed = true
    offKeys()
    el.remove()
  }
  const close = () => {
    if (closed) return
    if (designStatus.get() === 'new') designStatus.set('dismissed')
    playSfx('select')
    dispose()
    later(onClose)
  }

  paint()
  root.append(el)
  return { el, dispose, dim: 0.5 }
}
