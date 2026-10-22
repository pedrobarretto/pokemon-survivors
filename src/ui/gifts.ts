import { HATCHLINGS } from '../data/hatchlings'
import { BAG_ITEMS } from '../data/shop'
import { giftInbox, nextGift, openGift } from '../account'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import type { Hatch } from '../game/eggs'
import type { Gift, StyleRef } from '../game/gifts'
import { companionForm } from '../game/supporters'
import { formatDay, formatPokeDollars, t } from '../i18n'
import { bagIcon, coinIcon, eggIcon, giftIcon, medalIcon, ribbonIcon, sparkleIcon } from '../render/art'
import { styleThumb } from '../render/card'
import { frameIcon, wallpaperUrl } from '../render/cosmetics'
import { portraitUrl } from '../render/sprites'
import { h, later, rich } from './dom'
import { hint, menu, type Screen } from './screens'

const styleIcons = new Map<string, string>()

/** A style as a small picture: the frame's ball (or rings), a corner of the sky, the wallpaper's tile. */
export const styleIcon = (style: StyleRef) => {
  const key = `${style.slot}:${style.id}`
  let url = styleIcons.get(key)
  if (!url) {
    url = style.slot === 'frame' ? frameIcon(style.id) : style.slot === 'background' ? styleThumb(null, style.id, 14, 14).toDataURL() : wallpaperUrl(style.id)
    styleIcons.set(key, url)
  }
  return url
}

/** What a gift brought: an icon and a line of light markup. The admin's desk previews gifts with it too. */
export const contentLine = (gift: Pick<Gift, 'content'>): { src: string; text: string } => {
  const m = t().gifts
  const c = gift.content
  switch (c.kind) {
    case 'egg':
      return { src: eggIcon(c.tier), text: m.egg(t().eggs.tiers[c.tier]) }
    case 'coins':
      return { src: coinIcon(2), text: m.coins(formatPokeDollars(c.amount)) }
    case 'title':
      return { src: medalIcon('gold'), text: m.newTitle(t().achievements.titles[c.title]) }
    case 'style': {
      const names: Readonly<Record<string, string>> = t().mart.styles[c.style.slot]
      return { src: styleIcon(c.style), text: m.style(names[c.style.id] ?? c.style.id) }
    }
    case 'shinyHatch':
      return { src: portraitUrl(HATCHLINGS[c.family].line[0].dex, true), text: m.shinyHatch(HATCHLINGS[c.family].name) }
    case 'ribbon':
      return { src: ribbonIcon(c.ribbon.tier), text: m.ribbon(t().ribbons.names[c.ribbon.tier]) }
    case 'shinyPick':
      return { src: sparkleIcon(), text: m.shinyPick }
    case 'companion': {
      const form = companionForm(c.id)
      return { src: portraitUrl(form.dex), text: m.companion(form.name) }
    }
    case 'bag':
      return { src: bagIcon(c.item), text: m.bag(c.count, BAG_ITEMS[c.item].name) }
  }
}

/** Why it came: an invite, friends brought, a donation, the admin's present, joining the Discord, the Noite das Bruxas candy jar, its Caça aos Fantasmas or its supporters' gift, the Kecleon Shop, a Festival da Praça's pot or its Mecenas, or a day of the challenge (the place is in the ribbon). */
export const reasonLine = (gift: Gift) => {
  const c = gift.content
  if (c.kind === 'ribbon') return t().gifts.ribbonWhy(formatDay(c.ribbon.day), c.ribbon.rank, c.ribbon.total)
  const r = gift.reason
  if (!r) return null
  switch (r.kind) {
    case 'welcome':
      return t().gifts.welcome(r.from)
    case 'friends':
      return t().gifts.friends(r.count)
    case 'support':
      return t().gifts.support(r.tier)
    case 'staff':
      return t().gifts.staff(r.from)
    case 'discord':
      return t().gifts.discord
    case 'halloween':
      return t().gifts.halloween
    case 'halloweenSupport':
      return t().gifts.halloweenSupport
    case 'ghostHunt':
      return t().gifts.ghostHunt
    case 'loyalty':
      return t().gifts.loyalty(r.stamps)
    case 'tycoon':
      return t().gifts.tycoon
    case 'festival':
      return t().gifts.festival(t().festival.names[r.festival], formatPokeDollars(r.pot))
    case 'patron':
      return t().gifts.patron(t().festival.names[r.festival])
  }
}

/** How long the box shakes before it bursts open, in ms (`.gift-big.opening` in the CSS). */
const OPENING_MS = 700

type Action = { label: string; run: () => void }

export type GiftScreenActions = {
  /** A shiny hatch came out: play its scene (this screen is gone by then). */
  hatch: (hatch: Hatch) => void
  /** A shiny ticket came out and the player wants to pick now: the Hall's shiny picker. */
  pick: () => void
  /** Back to the lobby. */
  close: () => void
}

/**
 * Presente Misterioso: the lobby's gift box opens the waiting gifts one at a
 * time (`nextGift`). The closed box says why it came; a tap or Abrir shakes
 * it open (`openGift` lands it in the save) and shows what it brought. A
 * shiny hatch goes straight to its hatching scene, a shiny ticket offers its
 * picker, and Próximo opens the next. An egg with the incubator full waits
 * in the box. Esc or Backspace go back to the lobby, except while it opens.
 */
export const giftScreen = (root: HTMLElement, input: Input, actions: GiftScreenActions): Screen => {
  const el = h('div', { class: 'screen dim' })
  let nav: ReturnType<typeof menu> | null = null
  let timer = 0
  let busy = false
  let closed = false

  const show = (gift: Gift, body: readonly (HTMLElement | false)[], buttons: readonly Action[], opening = true) => {
    const m = t().gifts
    const why = reasonLine(gift)
    const els = buttons.map((a) => h('button', { class: 'btn' }, a.label))
    nav?.off()
    nav = menu(input, els, (i) => (playSfx('select'), later(buttons[i]!.run)), { horizontal: true })
    el.replaceChildren(
      h(
        'div',
        { class: opening ? 'dialog box pop gift-dialog' : 'dialog box gift-dialog' },
        why && h('small', { class: 'gift-why' }, why),
        h('div', { class: 'dialog-title' }, m.title),
        ...body,
        h('div', { class: 'buttons' }, ...els),
        hint(m.hintKeys, m.hintTouch),
      ),
    )
  }

  /** The next gift's closed box, or the lobby when none waits. */
  const closedBox = () => {
    const m = t().gifts
    const next = nextGift()
    if (!next) return close()
    const more = giftInbox().length - 1
    const box = h('button', { class: 'gift-big', type: 'button', 'aria-label': m.open }, h('img', { src: giftIcon(), alt: '' }))
    if (next.blocked) return show(next.gift, [box, h('p', { class: 'gift-note' }, m.full)], [{ label: m.ok, run: close }])
    box.addEventListener('click', () => open(next.gift, box))
    show(next.gift, [box, h('p', { class: 'gift-note' }, m.tapToOpen), more > 0 && h('small', { class: 'gift-more' }, m.more(more))], [
      { label: m.open, run: () => open(next.gift, box) },
      { label: m.later, run: close },
    ])
  }

  /** Shakes the box, then lands the gift and shows what came out. */
  const open = (gift: Gift, box: HTMLElement) => {
    if (busy) return
    busy = true
    nav?.off()
    box.classList.add('opening')
    playSfx('item')
    timer = window.setTimeout(() => {
      busy = false
      reveal(gift)
    }, OPENING_MS)
  }

  const reveal = (gift: Gift) => {
    const m = t().gifts
    const out = openGift(gift.id)
    if (!out || out.status === 'claimed') return closedBox()
    if (out.status === 'wait') return closedBox()
    if (out.hatch) {
      const hatch = out.hatch
      dispose()
      return later(() => actions.hatch(hatch))
    }
    playSfx('unlock')
    const line = contentLine(gift)
    const left = giftInbox().length
    const prize = h('div', { class: 'gift-prize' }, h('span', { class: 'gift-burst', 'aria-hidden': 'true' }), h('img', { src: line.src, alt: '' }))
    const buttons: Action[] = [
      ...(gift.content.kind === 'shinyPick' ? [{ label: m.pickNow, run: () => (dispose(), later(actions.pick)) }] : []),
      left > 0 ? { label: m.next(left), run: closedBox } : { label: m.ok, run: close },
    ]
    show(gift, [prize, rich(line.text, { class: 'gift-note' })], buttons, false)
  }

  const offKeys = input.onKey((key) => (key === 'Escape' || key === 'Backspace') && !busy && close())

  const dispose = () => {
    closed = true
    window.clearTimeout(timer)
    nav?.off()
    offKeys()
    el.remove()
  }

  const close = () => {
    if (closed) return
    playSfx('select')
    dispose()
    later(actions.close)
  }

  root.append(el)
  closedBox()
  return { el, dispose }
}
