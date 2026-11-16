import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { playSfx } from '../engine/audio'
import { canPurify, pickShadow, purify, purifySteps } from '../game/shadow'
import { formatNumber, t } from '../i18n'
import { h, rich } from './dom'
import { loadSave, updateSave } from './save'
import { toast } from './toasts'

/**
 * The partner select's Shadow row (`game/shadow.ts`), for a Pokémon the
 * player owns as a Shadow: a Normal / Shadow (or Purified) pick, the heart
 * gauge the runs' steps fill, and the Purify button once it's full. Null for
 * any other Pokémon. `changed` repaints the hero (the pedestal's aura, the row).
 */
/** Purifying is for good: the first tap asks (the note shows), the second purifies. */
const purifyButton = (label: string, note: string, run: () => void) => {
  let asked = false
  const button: HTMLButtonElement = h('button', {
    class: 'btn shadow-purify',
    type: 'button',
    onclick: () => {
      if (asked) return run()
      asked = true
      button.textContent = `${label}?`
      button.title = note
      button.after(h('small', { class: 'shadow-keep' }, note))
    },
  }, label)
  return button
}

export const shadowRow = (id: PlayableId, changed: () => void): HTMLElement | null => {
  const e = loadSave().shadows[id]
  if (!e) return null
  const m = t().rocket.shadow
  const set = (pick: boolean) => {
    if (pick === e.pick) return
    updateSave((s) => ({ ...s, shadows: pickShadow(s.shadows, id, pick) }))
    playSfx(pick ? 'shiny' : 'move')
    changed()
  }
  const option = (value: boolean, label: string) =>
    h('button', { class: value === e.pick ? 'shiny-option selected' : 'shiny-option', type: 'button', role: 'radio', 'aria-checked': String(value === e.pick), onclick: () => set(value) }, label)
  const left = Math.max(0, purifySteps(id) - e.steps)
  const ready = canPurify(loadSave().shadows, id)
  const doPurify = () => {
    updateSave((s) => ({ ...s, shadows: purify(s.shadows, id) }))
    playSfx('evolve')
    toast(document.body, m.purified(PLAYABLE[id].name), 3200, 'shadow')
    changed()
  }
  return h(
    'div',
    { class: `shadow-row${e.purified ? ' purified' : ''}` },
    h('div', { class: 'shiny-picker shadow-picker', role: 'radiogroup', 'aria-label': m.shadowForm }, option(false, m.normal), option(true, e.purified ? m.purifiedForm : m.shadowForm)),
    h('p', { class: 'shadow-note' }, e.purified ? m.purifiedEffect : m.effect),
    !e.purified &&
      (ready
        ? h('div', { class: 'shadow-ready' }, h('span', {}, rich(m.ready)), purifyButton(m.purify, m.keepNote, doPurify))
        : h('div', { class: 'shadow-gauge', title: m.walking }, h('i', { style: `width:${Math.round((e.steps / purifySteps(id)) * 100)}%` }), h('span', {}, m.gauge(formatNumber(left))))),
  )
}
