import type { CosmeticId } from '../data/cosmetics'
import { playSfx } from '../engine/audio'
import type { GemsStatus } from '../game/gems'
import { fetchGems, gemsEnabled, gemsFaked, gemsSignedIn, knownGems, onGems } from '../gems'
import { formatNumber, t } from '../i18n'
import { gemIconUrl } from '../render/gemArt'
import { h, later } from './dom'

/* The gem shop's light side, for the lobby and the partner select: the shop itself (`ui/gemShop.ts`) is in the Boutique's and the Arena's chunks. */

/** A cosmetic's name in the language shown. */
export const itemName = (id: CosmeticId) => {
  const names: Record<string, string> = { ...t().wearables, ...t().arenaEffects, ...t().skins }
  return names[id] ?? id
}

/** "1.250" with the gem beside it. */
export const gemAmount = (n: number, cls = '') => h('span', { class: `gem-amount ${cls}` }, h('img', { class: 'gem-icon', src: gemIconUrl(), alt: '' }), formatNumber(n))

/**
 * The balance as a chip (the gem and the number; a dash before the API
 * answers), following every change. `open` takes the player to the Loja.
 * Null in a build without the API.
 */
export const gemChip = (open: () => void) => {
  if (!gemsEnabled && !gemsFaked()) return null
  const count = h('span', { class: 'gem-chip-count' })
  const chip = h('button', { class: 'gem-chip', type: 'button', onclick: () => (playSfx('select'), later(open)) }, h('img', { class: 'gem-icon', src: gemIconUrl(), alt: '' }), count)
  // A guest has no balance: the chip is just the gem, the way to the shop.
  const paint = (s: GemsStatus | null) => {
    const guest = !gemsSignedIn()
    const text = s ? formatNumber(s.balance) : '—'
    const label = guest ? t().gems.chipGuest : t().gems.chip(text)
    count.textContent = guest ? '' : text
    chip.classList.toggle('bare', guest)
    chip.setAttribute('aria-label', label)
    chip.title = label
  }
  paint(knownGems())
  // It follows the balance while it's on the page; once it leaves, it stops listening.
  let shown = false
  const off = onGems((s) => {
    shown ||= chip.isConnected
    if (shown && !chip.isConnected) off()
    else paint(s)
  })
  if (gemsSignedIn()) void fetchGems()
  return chip
}
