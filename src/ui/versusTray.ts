import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { TYPE_COLORS } from '../data/types'
import { VERSUS } from '../data/versus'
import { onScreen } from '../game/lockstep'
import type { Game, Offer, Player } from '../game/types'
import { t } from '../i18n'
import { h, setStyle } from './dom'
import { offerView } from './screens'

/**
 * Versus's pick cards, never modal: a level-up, where an evolution
 * branches or the Ability wait `VERSUS.pickTime` while the Pokémon plays on
 * (`inPlay`), so they sit in a compact tray (a strip at the bottom of a phone
 * held upright, a column at the side elsewhere) the player taps, or picks
 * with 1–4, still moving. Its bar drains to the auto-pick. The pick goes out
 * as co-op's (`pick`: the team layer's, with the screen's round).
 */
export const createVersusTray = (root: HTMLElement, input: Input, pick: (offer: Offer) => void, busy: () => boolean = () => false) => {
  const title = h('b', { class: 'vs-tray-title' })
  const fill = h('i', { class: 'vs-tray-fill' })
  const cards = h('div', { class: 'vs-tray-cards' })
  const el = h(
    'div',
    { class: 'vs-tray box hidden', role: 'group' },
    h('div', { class: 'vs-tray-head' }, title, h('small', {}, t().versus.tray.auto)),
    h('div', { class: 'vs-tray-bar' }, fill),
    cards,
  )
  root.append(el)
  /** The screen shown: its phase and cards (a new set rebuilds it). */
  let shown: { phase: string; offers: readonly Offer[] } | null = null
  let offers: readonly Offer[] = []
  /** A pick on its way: the tray stays shut until the run moves the screen on. */
  let sent = false

  const choose = (i: number) => {
    const offer = offers[i]
    if (!offer || sent) return
    sent = true
    playSfx('select', 0)
    el.classList.add('hidden')
    pick(offer)
  }

  const off = input.onKey((key) => {
    const n = key.startsWith('Digit') ? Number(key.slice(5)) : NaN
    // The quick chat's or the ping wheel's numbers while one is open (`versusTalk.ts`).
    if (n >= 1 && n <= 4 && !el.classList.contains('hidden') && !busy()) choose(n - 1)
  })

  const build = (g: Game, me: Player) => {
    const m = t().versus.tray
    offers = me.offers
    // The kit's own screens (`game/versusPacing.ts`): Move 2, then a move of the new form taking Move 1's or Move 2's place.
    const learn = me.phase === 'levelup' ? (me.versus?.learn ?? 0) : 0
    title.textContent =
      me.phase === 'branch' ? m.branch
      : me.phase === 'ability' ? m.ability
      : learn > 0 && me.moves.length <= learn ? m.second
      : learn > 0 ? m.upgrade(learn)
      : me.level <= 1 ? m.first
      : m.levelup(me.level)
    cards.replaceChildren(
      ...me.offers.map((offer, i) => {
        const v = offerView(g, offer)
        const card = h(
          'button',
          { class: `vs-card${offer.kind === 'evolution' || offer.kind === 'form' ? ' evo' : ''}`, type: 'button', style: v.type ? `--type:${TYPE_COLORS[v.type]}` : '' },
          h('span', { class: 'vs-card-key' }, String(i + 1)),
          h('img', { src: v.icon, alt: '' }),
          h('span', { class: 'vs-card-text' }, h('span', { class: 'vs-card-name' }, v.name), v.tag ? h('em', { class: v.isNew ? 'vs-card-tag new' : 'vs-card-tag' }, v.tag) : null),
        )
        // pointerdown, not click: it lands on the first touch, with the other thumb still on the stick.
        card.addEventListener('pointerdown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          choose(i)
        })
        return card
      }),
    )
  }

  /**
   * Every frame, with this player on the draw copy: shows their pick screen's
   * cards while one is up (`held`: a pick of theirs is on its way) and drains its clock.
   */
  const update = (g: Game, me: Player, held: boolean) => {
    const open = onScreen(me) && me.offers.length > 0 && !held && g.phase === 'playing' && me.hp > 0
    if (!open) {
      if (!held) sent = false
      shown = null
      el.classList.add('hidden')
      return
    }
    if (shown?.phase !== me.phase || shown.offers !== me.offers) {
      shown = { phase: me.phase, offers: me.offers }
      sent = false
      build(g, me)
      playSfx('levelUp', 0)
      el.classList.remove('hidden')
      // Restart the slide-in.
      el.classList.remove('in')
      void el.offsetWidth
      el.classList.add('in')
    }
    if (sent) return
    el.classList.remove('hidden')
    setStyle(fill, 'width', `${Math.max(0, Math.min(1, me.pickLeft / VERSUS.pickTime)) * 100}%`)
  }

  return { el, update, dispose: () => (off(), el.remove()) }
}

export type VersusTray = ReturnType<typeof createVersusTray>
