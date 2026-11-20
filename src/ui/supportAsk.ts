import { track } from '../analytics'
import { GEM_PATREON } from '../data/gems'
import { PATREON_URL } from '../data/supporters'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { isSupporter } from '../game/supporters'
import { formatNumber, t } from '../i18n'
import { heartIcon } from '../render/art'
import { knownTier } from '../supporters'
import { h, later } from './dom'
import { deviceVisits } from './install'
import { loadSave } from './save'
import { supportPageUrl } from './supportLink'
import { hint, menu, type Screen } from './screens'
import { reachedMilestones, SUPPORT_MILESTONES, supportAskDue, type SupportMilestone } from './supportAskRules'

/** The milestones this device was already asked about. */
const ASKED = 'ps:supportAsk'

const readAsked = (): SupportMilestone[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(ASKED) ?? '[]')
    return Array.isArray(v) ? SUPPORT_MILESTONES.filter((m) => v.includes(m)) : []
  } catch {
    // Storage blocked: never asked, and never marked either, so it never asks (`supportAskDue` needs visits, which need storage).
    return []
  }
}

const writeAsked = (asked: readonly SupportMilestone[]) => {
  try {
    localStorage.setItem(ASKED, JSON.stringify(asked))
  } catch {}
}

/** What the save says now: its runs, whether any Pokémon beat Mewtwo on Nightmare, and the device's visits. */
const progress = () => {
  const save = loadSave()
  return { runs: save.achievements.lifetime.runs, nightmare: Object.values(save.clears).includes('nightmare'), sessions: deviceVisits(), supporter: isSupporter(save) || knownTier(save) !== null }
}

/**
 * Whether the lobby asks for support by itself now (`supportAskDue`), and at
 * which milestone. Asking marks every milestone reached by then, so it asks
 * once per device per milestone.
 */
export const takeSupportAsk = (): SupportMilestone | null => {
  const p = progress()
  const asked = readAsked()
  const due = supportAskDue({ ...p, asked })
  if (due) writeAsked([...new Set([...asked, ...reachedMilestones(p)])])
  return due
}

/** Dev (`ps.supportAsk('reset')`): forgets which milestones were asked about. */
export const forgetSupportAsk = () => writeAsked([])

/**
 * The lobby's ask at a milestone (`takeSupportAsk`): the game is one
 * person's, free and without ads; Patreon (monthly, its gems a month from
 * `GEM_PATREON`), a one-time donation (`/apoie/`) or Agora não. Esc and
 * Backspace say not now too. `onClose` runs after the key dispatch.
 */
export const supportAskScreen = (root: HTMLElement, input: Input, milestone: SupportMilestone, onClose: () => void): Screen => {
  const w = t().support.ask
  const patreon = h('button', { class: 'btn confirm' }, w.patreon)
  const donate = h('button', { class: 'btn confirm' }, w.donate)
  const no = h('button', { class: 'btn' }, w.later)
  const el = h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'dialog box pop account support-ask' },
      h('div', { class: 'dialog-title' }, w.title[milestone]),
      h('img', { class: 'support-ask-icon', src: heartIcon(), alt: '' }),
      h('p', { class: 'account-line' }, w.body),
      h('p', { class: 'account-line support-ask-perks' }, w.perks(formatNumber(Math.max(...Object.values(GEM_PATREON))))),
      h('div', { class: 'buttons account-buttons support-ask-buttons' }, patreon, donate, no),
      hint(t().account.hintKeys, t().account.hintTouch),
    ),
  )
  let closed = false
  const choose = (choice: 'patreon' | 'donate' | 'later') => {
    if (closed) return
    track('support_ask', { milestone, choice })
    // Straight from the press: a new tab opens only for a user gesture.
    if (choice === 'patreon') window.open(PATREON_URL, '_blank', 'noopener')
    if (choice === 'donate') window.open(supportPageUrl('ask'), '_blank', 'noopener')
    playSfx('select')
    dispose()
    later(onClose)
  }
  const nav = menu(input, [patreon, donate, no], (i) => choose(i === 0 ? 'patreon' : i === 1 ? 'donate' : 'later'))
  const offKeys = input.onKey((key) => (key === 'Escape' || key === 'Backspace') && choose('later'))
  function dispose() {
    closed = true
    nav.off()
    offKeys()
    el.remove()
  }
  root.append(el)
  return { el, dispose }
}
