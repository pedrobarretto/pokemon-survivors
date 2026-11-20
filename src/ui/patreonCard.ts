import { track } from '../analytics'
import { GEM_PATREON } from '../data/gems'
import { PATREON_TIERS, PATREON_URL } from '../data/supporters'
import { playSfx } from '../engine/audio'
import { SUPPORTER_TIERS, type SupporterTier } from '../game/supporters'
import { formatNumber, locale, LOCALES, t } from '../i18n'
import { gemIconUrl } from '../render/gemArt'
import { knownStatus, linkPatreon } from '../supporters'
import { h, later } from './dom'

/** A tier's monthly price, whole dollars in the player's language (`US$ 5`). */
const usd = (tier: SupporterTier) =>
  new Intl.NumberFormat(LOCALES[locale()].tag, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(PATREON_TIERS[tier] / 100)

const openPatreon = (action: 'join' | 'manage') => {
  playSfx('select')
  track('patreon_card', { action })
  window.open(PATREON_URL, '_blank', 'noopener')
}

/**
 * The gem shop's Patreon card, a row across the packs' grid: each tier's
 * price and gems a month (`PATREON_TIERS`, `GEM_PATREON`) and the main perks,
 * with Patreon's page and, signed in, the Hall's Patreon link (`linkPatreon`,
 * which comes back with `?patreon=linked`); a guest's link asks to sign in.
 * A player whose linked Patreon has an active pledge (`SupporterStatus.pledge`)
 * sees their own tier and its gems instead. Rebuilt with the grid on every paint.
 */
export const patreonCard = (o: { signedIn: boolean; signIn: (() => void) | null; offline: (text: string) => void }) => {
  const w = t().support.card
  const status = o.signedIn ? knownStatus() : null
  const pledge = status?.pledge ?? null
  const head = h('span', { class: 'patreon-card-head' }, h('img', { src: gemIconUrl(), alt: '' }), h('b', {}, w.title))
  if (pledge)
    return h(
      'div',
      { class: 'gem-pack patreon-card mine' },
      head,
      h('span', { class: 'patreon-card-mine' }, h('b', {}, w.yours(w.names[pledge])), h('small', {}, w.yoursGems(formatNumber(GEM_PATREON[pledge])))),
      h('span', { class: 'patreon-card-actions' }, h('button', { class: 'btn', type: 'button', onclick: () => openPatreon('manage') }, w.manage)),
    )
  const link = () => {
    if (!o.signedIn) return o.signIn?.()
    playSfx('select')
    track('patreon_card', { action: 'link' })
    later(() => void linkPatreon().then((ok) => ok || o.offline(w.offline)))
  }
  return h(
    'div',
    { class: 'gem-pack patreon-card' },
    head,
    h(
      'span',
      { class: 'patreon-card-tiers' },
      ...SUPPORTER_TIERS.map((tier) =>
        h('span', { class: `patreon-card-tier ${tier}` }, h('b', {}, w.names[tier]), h('small', {}, w.price(usd(tier))), h('em', {}, w.perMonth(formatNumber(GEM_PATREON[tier])))),
      ),
    ),
    h('small', { class: 'patreon-card-perks' }, w.perks),
    h(
      'span',
      { class: 'patreon-card-actions' },
      h('button', { class: 'btn confirm', type: 'button', onclick: () => openPatreon('join') }, w.join),
      // Linking needs an account; a linked one without an active pledge only has the page to go to.
      status?.patreon === true ? null : h('button', { class: 'btn', type: 'button', onclick: link }, w.link),
    ),
  )
}
