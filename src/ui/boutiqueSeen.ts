import { t } from '../i18n'
import { h } from './dom'

/* The Boutique's light side, for the lobby's ways in: its sheet (`boutique.ts`) is a chunk of its own. */

/** Set once the player first opens the Boutique on this device: its NOVO tags (the Kecleon shop's button, the Trainer Card's row) and Leavanny's long hello go for good. */
const SEEN = 'ps:boutiqueSeen'

export const boutiqueSeen = () => {
  try {
    return localStorage.getItem(SEEN) !== null
  } catch {
    return true
  }
}

export const markBoutiqueSeen = () => {
  try {
    localStorage.setItem(SEEN, '1')
  } catch {
    // Private modes may refuse: the tags and the long hello just show again next time.
  }
}

/** A NOVO tag for the Boutique's ways in, until it's first opened (null after). */
export const boutiqueFresh = () => (boutiqueSeen() ? null : h('em', { class: 'lobby-new boutique-new' }, t().coop.fresh))

export const BOUTIQUE_TABS = ['shop', 'skins', 'locker'] as const
export type BoutiqueTab = (typeof BOUTIQUE_TABS)[number]
