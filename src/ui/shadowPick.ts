import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { canPurify, pickShadow, purify, purifySteps } from '../game/shadow'
import { formatNumber, t } from '../i18n'
import { h, rich } from './dom'
import { loadSave, updateSave } from './save'
import { confirmDialog, type Screen } from './screens'
import { toast } from './toasts'

/**
 * Purifying is for good (only the Game Corner's Shadow Serum undoes it), so it
 * asks first: a dialog naming the Pokémon, Cancel focused. `answer` gets true
 * for Purify; the caller disposes the dialog.
 */
export const purifyDialog = (root: HTMLElement, input: Input, id: PlayableId, answer: (yes: boolean) => void): Screen => {
  const m = t().rocket.shadow
  const name = PLAYABLE[id].name
  return confirmDialog(root, input, m.confirmTitle(name), answer, { yes: m.purify, no: m.cancel, note: m.confirmText(name), class: 'shadow-confirm' })
}

/**
 * The partner select's Shadow row (`game/shadow.ts`), for a Pokémon the
 * player owns as a Shadow: a Normal / Shadow (or Purified) pick, the heart
 * gauge the runs' steps fill, and the Purify button once it's full, which
 * goes through `ask` (the select opens `purifyDialog`, and runs the purify on
 * a yes). Null for any other Pokémon. `changed` repaints the hero (the
 * pedestal's aura, the row).
 */
export const shadowRow = (id: PlayableId, changed: () => void, ask: (purify: () => void) => void): HTMLElement | null => {
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
        ? h('div', { class: 'shadow-ready' }, h('span', {}, rich(m.ready)), h('button', { class: 'btn shadow-purify', type: 'button', onclick: () => ask(doPurify) }, m.purify))
        : h('div', { class: 'shadow-gauge', title: m.walking }, h('i', { style: `width:${Math.round((e.steps / purifySteps(id)) * 100)}%` }), h('span', {}, m.gauge(formatNumber(left))))),
  )
}
