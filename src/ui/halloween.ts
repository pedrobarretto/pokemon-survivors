import { accountState, giftInbox } from '../account'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { SPECIAL_COMPANIONS } from '../data/companions'
import { HALLOWEEN, NIGHT_BOSSES } from '../data/halloween'
import { ENEMIES } from '../data/enemies'
import { HATCHLINGS } from '../data/hatchlings'
import type { GiftContent } from '../game/gifts'
import { brasiliaDay } from '../game/day'
import {
  candiesLeft, daysToHalloween, HALLOWEEN_CALENDAR, HALLOWEEN_REWARDS, halloweenDaysLeft, halloweenGiftId, huntDone, huntGiftId, HUNT_REWARDS, isHalloweenGift, nextHalloweenReward, pumpkinOfferOpen,
} from '../game/halloween'
import { savedSupporterTier } from '../game/trainer'
import { formatDay, formatNumber, t } from '../i18n'
import { jackIcon, pumpkinHeartIcon, treatIcon } from '../render/halloweenArt'
import { eggIcon } from '../render/art'
import { portraitUrl } from '../render/sprites'
import { h, later, rich } from './dom'
import { contentLine } from './gifts'
import { loadSave, today } from './save'
import { hint, menu, type Screen } from './screens'
import { railTile } from './shell'

/**
 * Noite das Bruxas in the lobby (`game/halloween.ts`): the Hoje card, from
 * the countdown (`HALLOWEEN.teaser`) to the event's last day, and the event
 * screen it opens: the candy jar and its rewards, the Caça aos Fantasmas
 * checklist, the haunted outbreaks' calendar and how to fill the jar.
 */

/** Where the event stands today: counting down, on, or neither (no card). */
const standing = () => {
  const day = brasiliaDay(today())
  const countdown = daysToHalloween(day)
  const left = halloweenDaysLeft(day)
  return { day, countdown, left }
}

/** Whether the lobby shows the event's card today. */
export const halloweenCardShows = () => {
  const s = standing()
  return s.countdown !== null || s.left !== null
}

/** The jar's fill toward its next reward, 0..1 (full once every reward is reached). */
const jarFill = (candies: number) => {
  const next = nextHalloweenReward(candies)
  if (!next) return 1
  const prev = [...HALLOWEEN_REWARDS].reverse().find((r) => r.candies <= candies)?.candies ?? 0
  return (candies - prev) / Math.max(1, next.candies - prev)
}

/**
 * The Hoje card: a jack-o'-lantern over the candies in the jar and how far
 * the next reward is, with the days left; before the night, the countdown.
 * Once the jar paid every reward, the candies left to spend at Duskull's stall.
 */
export const halloweenCard = () => fillHalloweenCard(h('button', { class: 'lobby-card box halloween', type: 'button' }))

/** Lays the Hoje card out again from the save, in place (the lobby keeps the same button: buying at the stall changes what it shows). */
export const fillHalloweenCard = (el: HTMLElement) => {
  const m = t().halloween
  const s = standing()
  const jar = loadSave().halloween
  const candies = jar.candies
  const next = nextHalloweenReward(candies)
  const label = h('small', { class: 'lobby-card-label' }, h('span', {}, m.card), s.left !== null && h('em', { class: 'lobby-badge halloween-left' }, m.daysLeftShort(s.left)))
  const row =
    s.countdown !== null
      ? h('span', { class: 'lobby-card-row' }, h('img', { class: 'lobby-jack', src: jackIcon(), alt: '' }), h('b', {}, m.countdown(s.countdown)))
      : h(
          'span',
          { class: 'lobby-card-row' },
          h('img', { class: 'lobby-jack', src: jackIcon(), alt: '' }),
          h('span', { class: 'lobby-progress halloween-jar' }, h('span', { style: `width:${Math.round(jarFill(candies) * 100)}%` })),
          h('b', {}, next ? `${formatNumber(candies)}/${formatNumber(next.candies)}` : formatNumber(candiesLeft(jar))),
          h('img', { class: 'lobby-treat', src: treatIcon(), alt: '' }),
        )
  el.replaceChildren(label, row)
  const count = next ? m.jarCount(formatNumber(candies)) : m.toSpend(formatNumber(candiesLeft(jar)))
  el.setAttribute('aria-label', `${m.name}: ${s.countdown !== null ? m.countdown(s.countdown) : count.replaceAll('*', '')}`)
  return el
}

/** The Hoje card as a rail tile (phones held upright): the jack-o'-lantern, with the days left on its corner once the night is on. */
export const halloweenTile = () => {
  const m = t().halloween
  const s = standing()
  const aria = `${m.name}: ${s.countdown !== null ? m.countdown(s.countdown) : s.left !== null ? m.daysLeftShort(s.left) : ''}`
  const days = s.left !== null && h('em', { class: 'lobby-badge rail-days' }, t().home.rail.days(s.left))
  return railTile('halloween', h('img', { class: 'lobby-jack', src: jackIcon(), alt: '' }), t().home.rail.halloween, aria, days)
}

/** A reward's short name, for its tile: the style's, the egg's, the title's or the shiny's. */
const rewardName = (content: GiftContent) => {
  switch (content.kind) {
    case 'style': {
      const names: Readonly<Record<string, string>> = t().mart.styles[content.style.slot]
      return names[content.style.id] ?? content.style.id
    }
    case 'egg':
      return t().eggs.tiers[content.tier]
    case 'title':
      return t().achievements.titles[content.title]
    case 'shinyHatch':
      return t().halloween.shinyOf(HATCHLINGS[content.family].name)
    default:
      return contentLine({ content }).text
  }
}

/** A reward as a tile: what it brings, and whether it came (✓), waits in the gift box (gift `id`) or is still `ahead` (what it takes). */
const rewardTile = (content: GiftContent, id: string, ahead: string, waiting: readonly string[], applied: readonly string[]) => {
  const m = t().halloween
  const state = applied.includes(id) ? 'done' : waiting.includes(id) ? 'ready' : 'locked'
  return h(
    'li',
    { class: `halloween-reward ${state}` },
    h('img', { class: 'halloween-reward-icon', src: contentLine({ content }).src, alt: '' }),
    h('b', { class: 'halloween-reward-name' }, rewardName(content)),
    h('small', { class: 'halloween-reward-at' }, state === 'done' ? `✓ ${m.received}` : state === 'ready' ? m.inGiftBox : ahead),
  )
}

/** The jar's reward `index` as a tile: ahead, at how many candies. */
const jarTile = (index: number, waiting: readonly string[], applied: readonly string[]) => {
  const m = t().halloween
  const r = HALLOWEEN_REWARDS[index]!
  return rewardTile(r.content, halloweenGiftId(index), r.candies === 0 ? m.forJoining : m.at(formatNumber(r.candies)), waiting, applied)
}

/**
 * The Caça aos Fantasmas: every night boss's portrait, a silhouette until
 * beaten in a haunted run, how many fell, what each first defeat pays and
 * the rewards for beating them all.
 */
const huntBox = (save: ReturnType<typeof loadSave>, waiting: readonly string[]) => {
  const m = t().halloween
  const hunted = save.halloween.hunted
  const count = m.huntCount(hunted.length, NIGHT_BOSSES.length)
  const ghosts = NIGHT_BOSSES.map((id) => {
    const def = ENEMIES[id]
    const got = hunted.includes(id)
    return h('li', { class: `halloween-ghost${got ? ' hunted' : ''}`, title: got ? def.name : '?' }, h('img', { src: portraitUrl(def.dex), alt: got ? def.name : '?' }))
  })
  return h(
    'section',
    { class: 'halloween-hunt-box' },
    h('div', { class: 'halloween-hunt-head' }, h('small', { class: 'halloween-section' }, m.hunt), h('b', {}, count)),
    h('p', { class: 'halloween-hunt-blurb' }, rich(huntDone(save.halloween) ? m.huntDone : m.huntBlurb(HALLOWEEN.hunt.candies))),
    h('ul', { class: 'halloween-hunt' }, ...ghosts),
    h('ul', { class: 'halloween-rewards hunt' }, ...HUNT_REWARDS.map((content, i) => rewardTile(content, huntGiftId(i), count, waiting, save.gifts))),
  )
}

export type HalloweenScreenActions = {
  /** Opens the gift box (the jar's rewards wait there). */
  gifts: () => void
  /** Opens the Hall da Fama, to become a supporter (and earn the jack-o'-lantern badge). */
  support: () => void
  /** Back to the lobby. */
  close: () => void
}

/**
 * The event screen, over the lobby: dates and days left (or the countdown),
 * what the night does to runs, the candy jar with its rewards, the Caça aos
 * Fantasmas, the haunted outbreaks day by day, and the supporters' jack-o'-lantern badge
 * and Pumpkaboo while becoming one still earns them. Abrir presentes goes to the gift box
 * when a reward waits there; Apoiar to the Hall da Fama. Esc or Backspace
 * close it.
 */
export const halloweenScreen = (root: HTMLElement, input: Input, actions: HalloweenScreenActions): Screen => {
  const m = t().halloween
  const s = standing()
  const save = loadSave()
  const candies = save.halloween.candies
  const waiting = giftInbox().flatMap((g) => (isHalloweenGift(g.id) ? [g.id] : []))
  const next = nextHalloweenReward(candies)

  const status = s.countdown !== null ? m.countdown(s.countdown) : s.left !== null ? m.daysLeft(s.left) : m.over
  const calendar = HALLOWEEN_CALENDAR.map(({ day, outbreak }) => {
    const def = ENEMIES[outbreak]
    const when = day < s.day ? 'past' : day === s.day ? 'today' : 'ahead'
    return h(
      'li',
      { class: `halloween-day ${when}`, title: `${formatDay(day)} · ${def.name}` },
      h('img', { src: portraitUrl(def.dex), alt: def.name }),
      h('small', {}, when === 'today' ? m.today : formatDay(day)),
    )
  })
  const how = [
    [treatIcon(), m.howGhosts],
    [portraitUrl(ENEMIES.gengar.dex), m.howBosses],
    [jackIcon(), m.howPumpkins],
    [eggIcon('haunted'), m.howEgg],
  ] as const

  // A supporter already wears the badge (from the first day on); anyone else is offered it.
  const supporter = accountState().kind === 'signedIn' && savedSupporterTier(save) !== null
  const offer = pumpkinOfferOpen(s.day)
  const pitch = offer && !supporter
  const badge =
    offer &&
    h(
      'p',
      { class: 'halloween-supporter' },
      h('img', { src: pumpkinHeartIcon(supporter ? (savedSupporterTier(save) ?? 'supporter') : 'supporter'), alt: '' }),
      h('img', { class: 'halloween-pumpkaboo', src: portraitUrl(SPECIAL_COMPANIONS.pumpkaboo.dex), alt: SPECIAL_COMPANIONS.pumpkaboo.name }),
      rich(supporter ? m.supportYes : m.supportNo(formatDay(HALLOWEEN.to))),
    )

  const buttons = [
    ...(waiting.length > 0 ? [h('button', { class: 'btn confirm' }, m.openGifts(waiting.length))] : []),
    ...(pitch ? [h('button', { class: 'btn' }, m.support)] : []),
    h('button', { class: 'btn' }, m.close),
  ]
  const runs = [...(waiting.length > 0 ? [() => (dispose(), later(actions.gifts))] : []), ...(pitch ? [() => (dispose(), later(actions.support))] : []), close]
  const nav = menu(input, buttons, (i) => (playSfx('select'), later(runs[i]!)), { horizontal: true })

  const el = h(
    'div',
    { class: 'screen dim halloween-screen' },
    h(
      'div',
      { class: 'dialog box pop halloween-dialog' },
      h('div', { class: 'halloween-head' }, h('img', { src: jackIcon(), alt: '' }), h('div', { class: 'dialog-title' }, m.name), h('img', { src: jackIcon(), alt: '' })),
      h('p', { class: 'halloween-dates' }, h('small', {}, m.dates(formatDay(HALLOWEEN.from), formatDay(HALLOWEEN.to))), h('b', {}, status)),
      h('p', { class: 'halloween-blurb' }, m.blurb),
      h('ul', { class: 'halloween-how' }, ...how.map(([src, text]) => h('li', {}, h('img', { src, alt: '' }), rich(text)))),
      h(
        'section',
        { class: 'halloween-jar-box' },
        h(
          'div',
          { class: 'halloween-jar-head' },
          h('img', { src: treatIcon(), alt: '' }),
          rich(m.jarCount(formatNumber(candies))),
          next && h('small', {}, m.jarNext(formatNumber(next.candies - candies))),
        ),
        h('span', { class: 'lobby-progress halloween-jar' }, h('span', { style: `width:${Math.round(jarFill(candies) * 100)}%` })),
        candies > 0 && h('p', { class: 'halloween-spend' }, h('img', { src: eggIcon('haunted'), alt: '' }), rich(m.toSpend(formatNumber(candiesLeft(save.halloween))))),
        h('ul', { class: 'halloween-rewards' }, ...HALLOWEEN_REWARDS.map((_, i) => jarTile(i, waiting, save.gifts))),
      ),
      huntBox(save, waiting),
      h('section', { class: 'halloween-calendar-box' }, h('small', { class: 'halloween-section' }, m.calendar), h('ul', { class: 'halloween-calendar' }, ...calendar)),
      badge,
      h('div', { class: 'buttons' }, ...buttons),
      hint(m.hintKeys, m.hintTouch),
    ),
  )

  const offKeys = input.onKey((key) => (key === 'Escape' || key === 'Backspace') && close())
  let closed = false

  function dispose() {
    closed = true
    nav.off()
    offKeys()
    el.remove()
  }

  function close() {
    if (closed) return
    playSfx('select')
    dispose()
    later(actions.close)
  }

  root.append(el)
  return { el, dispose, dim: 0.5 }
}
