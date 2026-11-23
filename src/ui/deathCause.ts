import { ENEMIES } from '../data/enemies'
import type { Harm } from '../game/harm'
import type { Player } from '../game/types'
import { formatNumber, t, type Messages } from '../i18n'
import { h } from './dom'

type CauseText = Messages['results']['cause']

/**
 * A hit in words: "Arceus's Judgment" (a named attack), "Alpha Gengar (contact)",
 * "World attack (shot)", "Lava". Pokémon and move names stay in English (the data's).
 */
export const harmLabel = (hit: Harm, s: CauseText): string => {
  const kind = s.hits[hit.hit]
  const name = hit.foe === null ? null : ENEMIES[hit.foe].name
  const who = name !== null ? (hit.alpha ? s.alpha(name) : name) : hit.world ? s.world : null
  if (who === null) return kind.charAt(0).toLocaleUpperCase() + kind.slice(1)
  return hit.move !== null ? s.move(who, hit.move) : s.kind(who, kind)
}

/** The hits before the one that fainted `p`, in words ("Antes: Rattata 12 · Lava 30"), or null when it was the only one. */
export const hitsBefore = (p: Player) => {
  const s = t().results.cause
  const before = p.hits.slice(0, -1).map((x) => `${harmLabel(x, s)} ${formatNumber(x.dmg)}`)
  return before.length > 0 ? s.before(before.join(' · ')) : null
}

/**
 * The end screen's cause of `p`'s faint: the hit that fainted them (who, with
 * what, how hard) and, smaller, the ones just before it (`Player.hits`).
 * `compact` leaves those out (the solo results show them under Detalhes, `hitsBefore`).
 */
export const deathCause = (p: Player, compact = false) => {
  const s = t().results.cause
  const last = p.hits.at(-1)
  const before = compact ? null : hitsBefore(p)
  return h(
    'div',
    { class: compact ? 'death-cause compact' : 'death-cause' },
    h('small', {}, s.title),
    h('b', {}, last ? harmLabel(last, s) : s.unknown),
    last && h('span', { class: 'death-dmg' }, s.damage(formatNumber(last.dmg))),
    before && h('small', { class: 'death-before' }, before),
  )
}
