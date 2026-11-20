import { lookNudge } from '../arena/gemShop'
import type { CosmeticId } from '../data/cosmetics'
import { playSfx } from '../engine/audio'
import type { GemsStatus, RunGems } from '../game/gems'
import { fetchGems, gemsEnabled, gemsFaked, gemsSignedIn, knownGems, livePromo, onGems, ownedSet, promoDay, promoLeft } from '../gems'
import { formatNumber, t } from '../i18n'
import { gemIconUrl } from '../render/gemArt'
import { h, later } from './dom'

/* The gem shop's light side, for the lobby, the partner select and the results: the shop itself (`ui/gemShop.ts`) is in the Boutique's and the Arena's chunks. */

/** A cosmetic's name in the language shown. */
export const itemName = (id: CosmeticId) => {
  const names: Record<string, string> = { ...t().wearables, ...t().arenaEffects, ...t().skins }
  return names[id] ?? id
}

/** "1.250" with the gem beside it. */
export const gemAmount = (n: number, cls = '') => h('span', { class: `gem-amount ${cls}` }, h('img', { class: 'gem-icon', src: gemIconUrl(), alt: '' }), formatNumber(n))

/* ---------------- Promotions ---------------- */

/** The running promotion's tag ("+50% Black Friday"; `short`: "+50%"), or null when none runs. */
export const promoTag = (short = false, cls = '') => {
  const promo = livePromo()
  if (!promo) return null
  const m = t().gems.promo
  const pct = formatNumber(promo.extra)
  return h('em', { class: `gem-promo-tag ${cls}` }, short ? `+${pct}%` : m.tag(pct, m.names[promo.name]))
}

/** How long the running promotion has left, as a line ("Termina em 2 d 5 h"), or null. */
export const promoLeftText = () => {
  const promo = livePromo()
  if (!promo) return null
  const { days, hours } = promoLeft(promo)
  return t().gems.promo.left(days, hours)
}

/** The lobby's line for the Boutique while a promotion runs ("+50% de gemas nos pacotes · Termina em 2 d"), or null. */
export const promoLobbyLine = () => {
  const promo = livePromo()
  return promo ? `${t().gems.promo.lobby(formatNumber(promo.extra))} · ${promoLeftText()}` : null
}

/* ---------------- The free gems' nudge ---------------- */

/** The balance the Boutique last opened on (this device): the chip's glow waits for the balance to grow past it. */
const LOOKED_KEY = 'ps:gemsLooked'

const lookedAt = () => {
  try {
    const v = Number(localStorage.getItem(LOOKED_KEY))
    return localStorage.getItem(LOOKED_KEY) === null || !Number.isFinite(v) ? -Infinity : v
  } catch {
    return -Infinity
  }
}

/** The Boutique opened (or its balance changed while open): the chip stops glowing until the balance grows again. */
export const markGemsLooked = (s: GemsStatus | null = knownGems()) => {
  if (!s) return
  try {
    localStorage.setItem(LOOKED_KEY, String(s.balance))
  } catch {
    // Storage blocked: the glow just shows again next time.
  }
}

/** What the account's balance buys now (`lookNudge`), or null for a guest. */
const nudgeOf = (s: GemsStatus | null) => (s ? lookNudge(promoDay(), ownedSet(s), s.balance) : null)

/** Whether the chip glows: the balance covers an item the account lacks, and grew since the Boutique last opened. */
const chipGlows = (s: GemsStatus | null) => s !== null && s.balance > lookedAt() && nudgeOf(s)?.kind === 'covers'

/* ---------------- The chip ---------------- */

/**
 * The balance as a chip (the gem and the number; a dash before the API
 * answers), following every change. `open` takes the player to the Loja.
 * It wears the running promotion's tag ("+50%"), and glows softly while the
 * balance covers an item the account lacks, until the Boutique opens
 * (`chipGlows`). Null in a build without the API.
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
    chip.classList.toggle('glow', !guest && chipGlows(s))
    chip.querySelector('.gem-promo-tag')?.remove()
    const promo = promoTag(true, 'chip')
    if (promo) chip.append(promo)
    chip.setAttribute('aria-label', promo ? `${label} · ${promoLobbyLine()}` : label)
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

/* ---------------- The results' line ---------------- */

/**
 * The results' gem line, for a signed-in player: empty until the run's
 * report answers (`gems`, never waited on), then "+15 gemas · saldo 115"
 * and what the balance buys now with a button to it in the Boutique
 * (`open`, with the item), or how many gems the next look is away. Nothing
 * shows when the report brought no gems (a guest, a short run, the day's
 * gems taken already). The balance it reads is the report's; the chip
 * catches up with a fetch.
 */
export const runGemsLine = (gems: Promise<RunGems | null>, open: (id: CosmeticId) => void) => {
  const el = h('div', { class: 'result-gems', role: 'status', hidden: true })
  void gems.then(async (got) => {
    if (!got || !gemsSignedIn()) return
    // What the account owns: the device's mirror, or the API's answer when there's none yet.
    const was = knownGems() ?? (await fetchGems())
    if (!was || !el.isConnected) return
    const m = t().gems.run
    const nudge = lookNudge(promoDay(), ownedSet(was), got.balance)
    const earned = h('b', {}, h('img', { class: 'gem-icon', src: gemIconUrl(), alt: '' }), m.earned(formatNumber(got.earned), formatNumber(got.balance)))
    const rest =
      nudge?.kind === 'covers'
        ? [h('span', {}, ` — ${m.covers(itemName(nudge.id))}`), h('button', { class: 'btn small result-gems-go', type: 'button', onclick: () => (playSfx('select'), later(() => open(nudge.id))) }, m.see)]
        : nudge?.kind === 'short'
          ? [h('span', {}, ` · ${m.short(formatNumber(nudge.missing), nudge.first)}`)]
          : []
    el.replaceChildren(h('p', { class: 'result-gems-text' }, earned, ...rest))
    el.hidden = false
    el.classList.add('pop')
    if (was.balance !== got.balance) void fetchGems()
  })
  return el
}
