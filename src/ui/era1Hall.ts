import { SEASON_ONE } from '../data/seasons'
import type { CoopBoard, CoopBoardEntry } from '../game/coopBoard'
import { ERA1, era1Closed, era1Places, type Era1Tier } from '../game/era1'
import type { Board, BoardEntry } from '../game/ranking'
import { formatDay, t } from '../i18n'
import { styleThumb } from '../render/card'
import { ERA1_MARKS, frameArtUrl } from '../render/cosmetics'
import { h, rich } from './dom'
import { runForm, runPortrait, supporterBadges } from './profile'
import { today } from './save'

/**
 * The Era 1 Hall da Fama (the Ranking's `era1` period, `ui/ranking.ts`): the
 * runs from before Temporada 1 on a stage of their own. A banner says
 * whether Era 1 has closed, the podium stands the top 3 up (the #1 crowned),
 * a strip shows what the top earns (the frames as they look), and the rest
 * follow in big lines. Each place the board rewards (`era1Places`) wears its
 * tag. Every trainer is a stop of the screen's menu (`lines`).
 */

/** A stop of the menu: the element and whose profile it opens. */
type Line = { el: HTMLElement; handle: string }

/** A run's time with hours once it's that long (`7:58:20`), else as the boards write it (`42:10`). */
const hallTime = (seconds: number) => {
  const s = Math.floor(seconds)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return s >= 3600 ? `${Math.floor(s / 3600)}:${mm}:${ss}` : `${mm}:${ss}`
}

/** The tag a place wears when the board rewards it: the Champion's crown or the Legend's coin. */
const tag = (tier: Era1Tier) =>
  h('span', { class: `era-tag ${tier}` }, h('img', { src: frameArtUrl(tier === 'champion' ? ERA1_MARKS.ruby : ERA1_MARKS.coin), alt: '' }), t().ranking.hall.tags[tier])

/** A prize as it looks: the frame on its sky, with the title it comes with. */
const prize = (tier: Era1Tier) => {
  const thumb = tier === 'champion' ? styleThumb('era1Champion', 'era1Champion', 54, 68) : styleThumb('era1', 'night', 54, 68)
  thumb.classList.add('era-prize-card')
  return h('figure', { class: `era-prize ${tier}` }, thumb, h('figcaption', {}, t().achievements.titles[tier === 'champion' ? 'era1Champion' : 'era1Legend']))
}

/** The banner: the crest and the name, and whether Era 1 closed (or when it will). */
const banner = () => {
  const m = t().ranking.hall
  const date = formatDay(SEASON_ONE.day)
  return h(
    'header',
    { class: 'era-head' },
    h('img', { class: 'era-crest', src: frameArtUrl(ERA1_MARKS.hall), alt: '' }),
    h('span', { class: 'era-kicker' }, m.kicker),
    h('b', { class: 'arc-outline era-name' }, t().ranking.periods.era1),
    h('p', { class: 'era-note' }, era1Closed(today().getTime()) ? m.closed(date) : m.open(date)),
  )
}

/** What the board's top earns, the frames shown as they look, and how far down it goes on a thin board. */
const prizes = (coop: boolean, cut: number) => {
  const m = t().ranking.hall
  const full = coop ? ERA1.coopTop : ERA1.top
  return h(
    'div',
    { class: 'era-prizes' },
    ...(coop ? [prize('hall')] : [prize('champion'), prize('hall')]),
    h('div', { class: 'era-prize-text' }, rich(coop ? m.coopReward(full) : m.reward(full)), cut < full && h('small', {}, m.thin(cut))),
  )
}

/** A trainer on the podium: medal, Pokémon, name, handle, time and the tag of what the place earns. */
const soloStep = (e: BoardEntry, me: boolean, cut: number) =>
  h(
    'button',
    { class: `era-step p${e.rank}${me ? ' me' : ''}`, type: 'button' },
    e.rank === 1 && h('img', { class: 'era-crown', src: frameArtUrl(ERA1_MARKS.champion), alt: '' }),
    h('span', { class: 'era-mon' }, h('img', { src: runPortrait(e), alt: runForm(e).name, title: runForm(e).name })),
    h('span', { class: 'era-medal' }, String(e.rank)),
    h('b', { class: 'era-who' }, h('span', {}, e.name), ...supporterBadges(e.supporter, e.supporterSince, e.og)),
    h('small', { class: 'era-handle' }, `@${e.handle}`),
    h('span', { class: 'era-time' }, hallTime(e.time)),
    e.rank <= cut && tag(e.rank === 1 ? 'champion' : 'hall'),
  )

/** A trainer below the podium: place, Pokémon, name and handle, time, and the tag when the place earns one. */
const soloRow = (e: BoardEntry, me: boolean, cut: number) =>
  h(
    'button',
    { class: `era-row${me ? ' me' : ''}${e.rank <= cut ? ' earned' : ''}`, type: 'button' },
    h('span', { class: 'era-pos' }, String(e.rank)),
    h('img', { src: runPortrait(e), alt: runForm(e).name, title: runForm(e).name }),
    h('span', { class: 'era-row-who' }, h('b', {}, h('span', {}, e.name), ...supporterBadges(e.supporter, e.supporterSince, e.og)), h('small', {}, `@${e.handle}`)),
    e.rank <= cut ? tag('hall') : h('span', { class: 'era-slot' }),
    h('span', { class: 'era-time' }, hallTime(e.time)),
  )

/** The solo Hall: header, podium and lines, the player's own below the top when they're further down. */
export const soloHall = (b: Board, myHandle: string | null) => {
  const cut = era1Places(b.total ?? 0)
  const lines: Line[] = []
  const isMe = (e: BoardEntry) => e.handle === b.me?.handle || e.handle === myHandle
  const podium = b.entries.slice(0, 3)
  const steps = podium.map((e) => {
    const el = soloStep(e, isMe(e), cut)
    lines.push({ el, handle: e.handle })
    return el
  })
  const rows = b.entries.slice(3).map((e) => {
    const el = soloRow(e, isMe(e), cut)
    lines.push({ el, handle: e.handle })
    return el
  })
  const mine = b.me && !b.entries.some((e) => e.handle === b.me!.handle) ? soloRow(b.me, true, cut) : null
  if (mine) lines.push({ el: mine, handle: b.me!.handle })
  const nodes: Node[] = [
    banner(),
    ...(steps.length > 0 ? [h('div', { class: `era-podium n${steps.length}` }, ...steps)] : []),
    prizes(false, cut),
    ...rows,
    ...(mine ? [h('div', { class: 'rank-gap', 'aria-hidden': 'true' }, '⋮'), mine] : []),
  ]
  return { nodes, lines, empty: b.entries.length === 0 }
}

/**
 * The co-op Hall: the same header and a podium of teams (each member a stop,
 * their Pokémon side by side), then the other teams as the boards draw them
 * (`teamRow`, passed in: it lives with the boards).
 */
export const coopHall = (b: CoopBoard, myHandle: string | null, teamRow: (e: CoopBoardEntry, me: boolean, interactive: boolean) => { el: HTMLElement; members: HTMLElement[] }) => {
  const cut = era1Places(b.total ?? 0, true)
  const lines: Line[] = []
  const isMe = (e: CoopBoardEntry) => e.run === b.me?.run || e.members.some((x) => x.handle === myHandle)
  const steps = b.entries.slice(0, 3).map((e) => {
    const members = e.members.map((x) => {
      const el = h('button', { class: 'era-member', type: 'button' }, h('img', { src: runPortrait(x), alt: runForm(x).name, title: runForm(x).name }), h('small', {}, x.name))
      lines.push({ el, handle: x.handle })
      return el
    })
    return h(
      'div',
      { class: `era-step team p${e.rank}${isMe(e) ? ' me' : ''}` },
      h('span', { class: 'era-team' }, ...members),
      h('span', { class: 'era-medal' }, String(e.rank)),
      h('span', { class: 'era-time' }, hallTime(e.time)),
      e.rank <= cut && tag('hall'),
    )
  })
  const rows = b.entries.slice(3).map((e) => {
    const row = teamRow(e, isMe(e), true)
    row.members.forEach((el, i) => lines.push({ el, handle: e.members[i]!.handle }))
    return row.el
  })
  const nodes: Node[] = [banner(), ...(steps.length > 0 ? [h('div', { class: `era-podium teams n${steps.length}` }, ...steps)] : []), prizes(true, cut), ...rows]
  return { nodes, lines, empty: b.entries.length === 0 }
}
