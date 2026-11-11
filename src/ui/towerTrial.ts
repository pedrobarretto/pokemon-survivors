import { playSfx } from '../engine/audio'
import { TRIALS, type TrialDef } from '../data/legendPaths'
import type { Game } from '../game/types'
import { formatNumber, t } from '../i18n'
import { h, setText } from './dom'
import { trialLoadout } from './legendPaths'
import type { Screen } from './screens'

/**
 * A Torre trial's screen over the Dojo (`game/towerTrial.ts`): the trial's
 * name and goal, the clock and how far the goal is, a "ready" before the
 * clock starts, and the result with its buttons. The shell banks a win.
 */

export type TrialHudActions = {
  /** The trial just ended (once): `won` or not. */
  ended: (won: boolean) => void
  /** Plays the trial again. */
  retry: () => void
  /** Back to the Dojo and the Torre's sheet. */
  back: () => void
}

const goalLine = (def: TrialDef) => {
  const g = t().paths.tower.goal
  return def.goal.kind === 'damage' ? g.damage(formatNumber(def.goal.need), def.time) : def.goal.kind === 'hits' ? g.hits(formatNumber(def.goal.need), def.time) : g.knockouts(formatNumber(def.goal.need), def.time)
}

export const trialHud = (root: HTMLElement, g: Game, actions: TrialHudActions): Screen => {
  const m = t().paths.tower
  const trial = g.training?.trial
  if (!trial) throw new Error('trialHud: no trial on this run')
  const def: TrialDef = TRIALS[trial.id]
  const clock = h('b', { class: 'trial-clock arc-outline' })
  const count = h('span', { class: 'trial-count' })
  const fill = h('i')
  const ready = h('div', { class: 'trial-ready arc-outline' })
  const result = h('div', { class: 'trial-result hidden' })
  const el = h(
    'div',
    { class: 'trial-hud' },
    h(
      'div',
      { class: `trial-card arc-card trial-${trial.id}` },
      h('div', { class: 'trial-top' }, h('b', { class: 'trial-name' }, m.floors[trial.id].name), clock),
      h('p', { class: 'trial-goal' }, goalLine(def)),
      h('div', { class: 'trial-progress' }, h('span', { class: 'path-bar' }, fill), count),
      h('p', { class: 'trial-load' }, trialLoadout(def)),
    ),
    ready,
    result,
  )
  let ended = false
  let lastSecond = -1
  const finish = (won: boolean) => {
    ended = true
    playSfx(won ? 'levelUp' : 'denied')
    actions.ended(won)
    result.replaceChildren(
      h('b', { class: 'arc-outline trial-result-title' }, won ? m.won : m.lost),
      h(
        'div',
        { class: 'trial-result-actions' },
        !won && h('button', { class: 'arc-btn arc-btn-small trial-retry', type: 'button', onclick: () => (playSfx('select'), actions.retry()) }, h('span', { class: 'arc-outline' }, m.retry)),
        h('button', { class: 'arc-btn arc-btn-small trial-back', type: 'button', onclick: () => (playSfx('select'), actions.back()) }, h('span', { class: 'arc-outline' }, m.back)),
      ),
    )
    result.classList.remove('hidden')
  }
  const tick = () => {
    const now = g.training?.trial
    if (!now) return
    setText(clock, m.timeLeft(String(Math.ceil(now.left))))
    setText(count, m.progress(formatNumber(Math.min(def.goal.need, Math.round(now.progress))), formatNumber(def.goal.need)))
    fill.style.width = `${Math.round(Math.min(1, now.progress / def.goal.need) * 100)}%`
    const waiting = now.wait > 0
    ready.classList.toggle('hidden', !waiting)
    if (waiting) {
      const s = Math.ceil(now.wait)
      if (s !== lastSecond) {
        lastSecond = s
        playSfx('tick')
        setText(ready, String(s))
      }
    }
    clock.classList.toggle('low', !waiting && now.left <= 5)
    if (!ended && now.result !== null) finish(now.result === 'won')
  }
  root.append(el)
  tick()
  return { el, tick, dispose: () => el.remove(), dim: 0 }
}
