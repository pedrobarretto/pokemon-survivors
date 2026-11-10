import { STAMP_IDS, STAMP_MILESTONES, STAMPS, isStampId, type StampGroup, type StampId, type StampTier } from '../data/realmStamps'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { locale, LOCALES, t } from '../i18n'
import type { RealmBook } from '../net/realmApi'
import { fetchBook } from '../realm/api'
import { stampProgress } from '../realm/stamps'
import { iconCanvas, stampArtReady, stampCanvas, type RewardIcon, type StampLook } from '../render/stampArt'
import { h, later } from './dom'
import type { Screen } from './screens'
import './realmBook.css'

/**
 * The Livro de Estampas (`data/realmStamps.ts`, Club Penguin's stamp book): a
 * page per group with a stamp on it for each of its stamps, in color once
 * earned, a silhouette until then, and a "?" for a hidden one, which never
 * shows a name, a description or progress before it's earned. Picking a stamp
 * or a milestone on the track (5 ticks over a 0-to-40 bar) shows it in the
 * detail. Two pages side by side on wide screens, one under the other on a
 * phone held upright. Q E (or ← →) turn the page, the arrows move the pick,
 * Esc closes. Opens over the town's HUD or the Trainer Card.
 */

const GROUPS = ['town', 'social', 'bases', 'games', 'events'] as const satisfies readonly StampGroup[]

/** An icon for each tab. */
const TAB_ICON: Record<StampGroup, StampId> = { town: 'firstSteps', social: 'hello', bases: 'neighbor', games: 'goneFishing', events: 'highTide' }

/** Of a stamp, what's shown on the page. */
export const stampLook = (id: StampId, earned: ReadonlySet<string>): StampLook => (earned.has(id) ? 'earned' : 'hidden' in STAMPS[id] ? 'hidden' : 'locked')

const stampsOf = (group: StampGroup) => STAMP_IDS.filter((id) => STAMPS[id].group === group)

/** The stamps seen so far (this device): newer ones wear a NOVO on the page and light the HUD's button. */
const SEEN = 'ps:stampsSeen'

const seenAt = () => {
  try {
    return Number(localStorage.getItem(SEEN) ?? 0) || 0
  } catch {
    return 0
  }
}

const markSeen = (at: number) => {
  try {
    if (at > seenAt()) localStorage.setItem(SEEN, String(at))
  } catch {
    // It says NOVO again next time.
  }
}

/** Whether `book` holds a stamp this device hasn't shown yet. */
export const hasUnseenStamps = (book: RealmBook | null) => book !== null && book.stamps.some((s) => s.at > seenAt())

/** What the detail shows. */
type Pick = { stamp: StampId } | { at: number }

export type RealmBookOpts = {
  close: () => void
  /** Open on this stamp's page, picked (a notice's Ver no livro). */
  focus?: StampId
  /** The book was read: the HUD's button stops glowing. */
  read?: () => void
}

const dateOf = (at: number) => new Date(at).toLocaleDateString(LOCALES[locale()].tag, { day: '2-digit', month: '2-digit', year: 'numeric' })

export const openRealmBook = (root: HTMLElement, input: Input, opts: RealmBookOpts): Screen => {
  const m = () => t().realm.stamps
  const el = h('div', { class: 'screen rbook-screen' })
  const back = h('button', { class: 'rbook-back', type: 'button', 'aria-label': t().mart.back, onclick: () => close() }, '◀', h('span', {}, ` ${t().mart.back}`))
  const title = h('h2', {}, m().title)
  const count = h('span', { class: 'rbook-count' })
  const track = h('div', { class: 'rbook-track' })
  const tabs = h('nav', { class: 'rbook-tabs', role: 'tablist', 'aria-label': m().title })
  const page = h('section', { class: 'rbook-page rbook-left' })
  const detail = h('section', { class: 'rbook-page rbook-right', 'aria-live': 'polite' })
  const hint = h('p', { class: 'rbook-hint keys-only' }, m().keys)
  const spread = h('div', { class: 'rbook-spread' }, page, detail)
  const book = h('div', { class: 'rbook' }, h('header', { class: 'rbook-top' }, back, title, count), track, tabs, spread, hint)
  el.append(book)
  root.append(el)

  let data: RealmBook | null = null
  let earned: ReadonlyMap<string, number> = new Map()
  let group: StampGroup = opts.focus ? STAMPS[opts.focus].group : 'town'
  let picked: Pick | null = opts.focus ? { stamp: opts.focus } : null
  let closed = false

  const close = () => {
    if (closed) return
    closed = true
    playSfx('select')
    later(opts.close)
  }

  const earnedCount = () => earned.size
  const earnedSet = () => new Set(earned.keys())

  /* ---------- The track of milestones ---------- */

  const renderTrack = () => {
    const n = earnedCount()
    const total = STAMP_IDS.length
    count.textContent = `${n}/${total}`
    track.replaceChildren(
      h('div', { class: 'rbook-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': n }, h('span', { style: `width:${(n / total) * 100}%` })),
      ...STAMP_MILESTONES.map((ms) => {
        const reached = n >= ms.at
        const paid = data?.milestones.includes(ms.at) ?? false
        const on = picked !== null && 'at' in picked && picked.at === ms.at
        return h(
          'button',
          {
            class: `rbook-tick${reached ? ' reached' : ''}${paid ? ' paid' : ''}${on ? ' on' : ''}`,
            type: 'button',
            style: `left:${(ms.at / total) * 100}%`,
            'aria-label': m().milestones.at(ms.at),
            title: m().milestones.at(ms.at),
            onclick: () => pick({ at: ms.at }),
          },
          iconCanvas(ms.reward.id, !reached),
        )
      }),
    )
  }

  /* ---------- The pages ---------- */

  const renderTabs = () =>
    tabs.replaceChildren(
      ...GROUPS.map((g) => {
        const ids = stampsOf(g)
        const done = ids.filter((id) => earned.has(id)).length
        const name = m().groups[g]
        return h(
          'button',
          { class: `rbook-tab ${g}${g === group ? ' on' : ''}`, type: 'button', role: 'tab', 'aria-selected': g === group ? 'true' : 'false', 'aria-label': `${name}: ${done}/${ids.length}`, title: name, onclick: () => turnTo(g) },
          iconCanvas(TAB_ICON[g]),
          h('span', { class: 'rbook-tab-name' }, name),
          h('small', {}, `${done}/${ids.length}`),
        )
      }),
    )

  const renderPage = () => {
    const ids = stampsOf(group)
    const held = earnedSet()
    const seen = seenAt()
    page.replaceChildren(
      h('h3', {}, m().groups[group], h('small', {}, `${ids.filter((id) => held.has(id)).length}/${ids.length}`)),
      h(
        'div',
        { class: 'rbook-grid' },
        ...ids.map((id) => {
          const look = stampLook(id, held)
          const fresh = look === 'earned' && (earned.get(id) ?? 0) > seen
          const on = picked !== null && 'stamp' in picked && picked.stamp === id
          const name = look === 'hidden' ? m().hiddenName : m().list[id].name
          return h(
            'button',
            { class: `rbook-stamp ${look === 'hidden' ? 'secret' : look}${on ? ' on' : ''}`, type: 'button', 'aria-label': name, 'aria-pressed': on ? 'true' : 'false', onclick: () => pick({ stamp: id }) },
            stampCanvas(id, look),
            fresh ? h('em', { class: 'rbook-new' }, m().fresh) : null,
          )
        }),
      ),
    )
  }

  const tierChip = (tier: StampTier) => h('span', { class: `rbook-tier ${tier}` }, m().tiers[tier])

  /** The detail of a stamp: its picture and, earned or visible, its name, description and progress. */
  const stampDetail = (id: StampId) => {
    const look = stampLook(id, earnedSet())
    const at = earned.get(id)
    const def = STAMPS[id]
    if (look === 'hidden') return [h('div', { class: 'rbook-big' }, stampCanvas(id, 'hidden')), h('h3', {}, m().hiddenName), h('p', { class: 'rbook-desc' }, m().hiddenDesc)]
    const { name, desc } = m().list[id]
    const { done, of } = stampProgress(id, data?.counts ?? {})
    return [
      h('div', { class: 'rbook-big' }, stampCanvas(id, look)),
      h('h3', {}, name),
      h('div', { class: 'rbook-tags' }, tierChip(def.tier), 'hidden' in def ? h('span', { class: 'rbook-tier secret' }, m().secret) : null),
      h('p', { class: 'rbook-desc' }, desc),
      look === 'earned' && at !== undefined
        ? h('p', { class: 'rbook-earned' }, m().earned(dateOf(at)))
        : of > 1
          ? h('div', { class: 'rbook-prog', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': of, 'aria-valuenow': done }, h('i', {}, h('span', { style: `width:${(done / of) * 100}%` })), h('small', {}, `${done}/${of}`))
          : h('p', { class: 'rbook-earned todo' }, m().notYet),
    ]
  }

  const milestoneDetail = (at: number) => {
    const ms = STAMP_MILESTONES.find((x) => x.at === at)
    if (!ms) return []
    const n = earnedCount()
    const paid = data?.milestones.includes(at) ?? false
    const reward = ms.reward.id satisfies RewardIcon
    return [
      h('div', { class: 'rbook-big reward' }, iconCanvas(reward, n < at)),
      h('h3', {}, m().milestones.rewards[reward]),
      h('div', { class: 'rbook-tags' }, h('span', { class: 'rbook-tier reward' }, m().milestones.kinds[ms.reward.kind])),
      h('p', { class: 'rbook-desc' }, m().milestones.at(at)),
      h('p', { class: `rbook-earned${paid ? '' : ' todo'}` }, paid ? m().milestones.paid : n >= at ? m().milestones.ready : m().milestones.left(at - n)),
    ]
  }

  const renderDetail = () => {
    const p = picked
    if (p === null) return detail.replaceChildren(h('p', { class: 'rbook-pick' }, m().pick))
    detail.replaceChildren(...('stamp' in p ? stampDetail(p.stamp) : milestoneDetail(p.at)))
  }

  /* ---------- Moving around ---------- */

  const render = () => {
    renderTrack()
    renderTabs()
    renderPage()
    renderDetail()
  }

  function pick(p: Pick) {
    picked = p
    playSfx('move')
    renderTrack()
    renderPage()
    renderDetail()
  }

  function turnTo(g: StampGroup) {
    if (g === group) return
    group = g
    picked = { stamp: stampsOf(g)[0]! }
    playSfx('move')
    render()
    page.scrollTop = 0
  }

  const turn = (delta: number) => turnTo(GROUPS[(GROUPS.indexOf(group) + delta + GROUPS.length) % GROUPS.length]!)

  /** How many stamps fit across the grid as drawn now (for ↑ ↓). */
  const columns = () => {
    const rows = [...page.querySelectorAll<HTMLElement>('.rbook-stamp')]
    const top = rows[0]?.offsetTop
    return Math.max(1, rows.filter((b) => b.offsetTop === top).length)
  }

  /** The arrows move the pick across the page: a stamp to the side, or up and down a row. */
  const movePick = (dx: number, dy: number) => {
    const ids = stampsOf(group)
    const at = picked !== null && 'stamp' in picked ? ids.indexOf(picked.stamp) : 0
    const next = at + dx + dy * columns()
    if (next < 0 || next >= ids.length) return
    pick({ stamp: ids[next]! })
    page.querySelectorAll<HTMLElement>('.rbook-stamp')[next]?.focus()
  }

  const off = input.onKey((key) => {
    if (key === 'Escape' || key === 'Backspace') return close()
    if (key === 'KeyQ') return turn(-1)
    if (key === 'KeyE') return turn(1)
    if (key === 'ArrowLeft') return movePick(-1, 0)
    if (key === 'ArrowRight') return movePick(1, 0)
    if (key === 'ArrowUp') return movePick(0, -1)
    if (key === 'ArrowDown') return movePick(0, 1)
  })

  /* ---------- Loading ---------- */

  const load = async () => {
    spread.classList.add('loading')
    detail.replaceChildren(h('p', { class: 'rbook-pick' }, m().loading))
    const [got] = await Promise.all([fetchBook(), stampArtReady()])
    if (closed) return
    spread.classList.remove('loading')
    if (!got) return showFailed()
    data = got
    earned = new Map(got.stamps.flatMap((s) => (isStampId(s.id) ? [[s.id, s.at] as const] : [])))
    picked ??= { stamp: stampsOf(group)[0]! }
    render()
    // What's on the page now counts as seen, once this visit's NOVO tags have been drawn.
    markSeen(Math.max(0, ...got.stamps.map((s) => s.at)))
    opts.read?.()
  }

  const showFailed = () =>
    detail.replaceChildren(h('p', { class: 'rbook-pick' }, m().failed), h('button', { class: 'rbook-retry', type: 'button', onclick: () => void load() }, m().retry))

  renderTabs()
  void load()

  return {
    el,
    dispose: () => {
      closed = true
      off()
      el.remove()
    },
  }
}
