import { accountHandle } from '../account'
import { arenaSignedIn, deviceArenaHistory, fetchArenaBoard, fetchArenaHistory, fetchArenaMe } from '../arenaApi'
import { divisionProgress, ladder, mergeHistory, record, timeLeft } from '../arena/history'
import { ARENA_RANKED, type TierId } from '../data/arenaRanked'
import { VERSUS } from '../data/versus'
import { playSfx } from '../engine/audio'
import { formatTime } from '../engine/math'
import type { Input } from '../engine/input'
import { seasonAt, seasonById, tierOf, type ArenaHistoryEntry, type ArenaLeaderboardRow, type ArenaProfile, type Season, type TierView } from '../game/arenaRank'
import { formatNumber, locale, LOCALES, t } from '../i18n'
import { arenaIconUrl, tierBallUrl, type ArenaIcon } from '../render/arenaArt'
import { portraitUrl } from '../render/sprites'
import { firstForm, teamColor } from './arena'
import { h, later } from './dom'
import { hint, type Screen } from './screens'

/**
 * The Arena's hub: the competitive side of the Arena in five tabs. Perfil
 * (tier badge, RP to the next division, the season's totals and most played
 * Pokémon), Temporada (the season's number and time left, the ladder with
 * each tier's title, how the reset works), Ranking (the season's board, this
 * player's row pinned when it's off the page), Histórico (the API's matches
 * merged with the device's practice, tagged Treino) and Regras (ranked in
 * plain words, its numbers from `ARENA_RANKED`). A guest sees the device's
 * history and a way to sign in. Opened from the Arena screen and the
 * lobby's Stadium (`showArenaHub(tab)` in `main.ts`). ← → switch tabs, ↑ ↓
 * scroll, Enter presses the tab's button, Esc goes back.
 */

export const ARENA_HUB_TABS = ['profile', 'season', 'ranking', 'history', 'rules'] as const
export type ArenaHubTab = (typeof ARENA_HUB_TABS)[number]
export const isArenaHubTab = (x: unknown): x is ArenaHubTab => typeof x === 'string' && (ARENA_HUB_TABS as readonly string[]).includes(x)

/** The tiers' names: the balls' official ones, in every language. */
const TIER_NAMES = { poke: 'Poké Ball', great: 'Great Ball', ultra: 'Ultra Ball', master: 'Master Ball' } as const satisfies Record<TierId, string>
const ROMAN = { 1: 'I', 2: 'II', 3: 'III' } as const

/** "Great Ball II", "Master Ball". */
export const tierName = (view: Pick<TierView, 'tier' | 'division'>) => `${TIER_NAMES[view.tier]}${view.division ? ` ${ROMAN[view.division]}` : ''}`

/** A tier's badge: its official ball with the division (III, II, I) on a plate under it, named for screen readers. */
export const tierBadge = (view: Pick<TierView, 'tier' | 'division'>, cls = '') =>
  h(
    'span',
    { class: `tier-badge ${cls}`, role: 'img', 'aria-label': tierName(view), title: tierName(view) },
    h('img', { src: tierBallUrl(view.tier), alt: '' }),
    view.division ? h('b', { class: 'tier-badge-division' }, ROMAN[view.division]) : null,
  )

/** Each tab's icon (`render/arenaArt.ts`). */
const TAB_ICONS = { profile: 'tabProfile', season: 'tabSeason', ranking: 'tabRanking', history: 'tabHistory', rules: 'tabRules' } as const satisfies Record<ArenaHubTab, ArenaIcon>

/** The tier above `view`'s division: the next division's, or the next tier's III. */
const nextName = (view: TierView) => (view.next === null ? null : tierName(tierOf(view.next)))

const PAGE = 20

/** A match's moment, short: day, month and time in this language. */
const when = (ms: number) => new Date(ms).toLocaleString(LOCALES[locale()].tag, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** `signIn`: the way to an account (null in a build without accounts: the hub shows the device's history alone). */
export type ArenaHubActions = { back: () => void; signIn: (() => void) | null }

export const arenaHub = (root: HTMLElement, input: Input, tab: ArenaHubTab, actions: ArenaHubActions): Screen => {
  const m = t().versus.hub
  const signedIn = arenaSignedIn()
  let current = tab
  let gone = false

  // What the tabs read, each asked once and kept for the screen's life.
  let profile: ArenaProfile | null | 'loading' = signedIn ? 'loading' : null
  const device = deviceArenaHistory()
  let history: { api: ArenaHistoryEntry[] | null; more: boolean } | 'loading' = signedIn ? 'loading' : { api: null, more: false }
  let board: ArenaLeaderboardRow[] | null | 'loading' | 'idle' = 'idle'

  const season = (): Season => (profile !== 'loading' && profile?.season) || seasonAt(Date.now()) || seasonById(1)

  const body = h('div', { class: 'arena-hub-body', tabIndex: -1 })
  const seasonChip = h('span', { class: 'arena-hub-season' })
  const headBadge = h('span', { class: 'arena-hub-badge' })
  const tabs = ARENA_HUB_TABS.map((id) =>
    h('button', { class: 'shell-tab arena-hub-tab', type: 'button', role: 'tab', onclick: () => switchTab(id) }, h('img', { class: 'arena-hub-tab-icon', src: arenaIconUrl(TAB_ICONS[id]), alt: '' }), h('span', {}, m.tabs[id])),
  )

  /** The button Enter presses on the tab shown (sign in, load more), if any. */
  let primary: HTMLButtonElement | null = null

  const signInCard = () => {
    const signIn = actions.signIn
    if (!signIn) return null
    const button = h('button', { class: 'btn confirm', type: 'button', onclick: () => (playSfx('select'), later(signIn)) }, m.signIn.button)
    primary = button
    return h('div', { class: 'arena-hub-card arena-hub-cta' }, h('img', { src: tierBallUrl('master'), alt: '' }), h('div', {}, h('b', {}, m.signIn.title), h('p', {}, m.signIn.text)), button)
  }

  const deviceCard = () => {
    const practice = device.filter((e) => e.kind === 'practice')
    const r = record(practice)
    return h('div', { class: 'arena-hub-card arena-hub-device' }, h('b', {}, m.profile.device), h('span', {}, m.profile.deviceLine(r.matches, r.wins)))
  }

  const note = (text: string, cls = '') => h('p', { class: `arena-hub-note ${cls}` }, text)

  const profileTab = () => {
    if (!signedIn) return [signInCard(), deviceCard()]
    if (profile === 'loading') return [note(m.loading, 'blink')]
    if (!profile) return [note(m.offline), deviceCard()]
    const p = profile
    const view = p.tier
    const prog = divisionProgress(p.rating.rp)
    const next = nextName(view)
    const tot = p.totals
    const rate = tot.matches > 0 ? Math.round((tot.wins / tot.matches) * 100) : 0
    const stat = (label: string, value: string) => h('div', { class: 'arena-hub-stat' }, h('b', {}, value), h('small', {}, label))
    return [
      h(
        'div',
        { class: `arena-hub-standing tier-${view.tier}` },
        tierBadge(view, 'big'),
        h(
          'div',
          { class: 'arena-hub-standing-text' },
          h('b', { class: 'arena-hub-tier' }, tierName(view)),
          h('span', { class: 'arena-hub-rp' }, m.rp(p.rating.rp), h('small', {}, p.place ? m.profile.place(p.place) : m.profile.unplaced)),
          next ? h('div', { class: 'arena-hub-bar' }, h('i', { style: `width:${Math.round((prog.done / prog.of) * 100)}%` })) : null,
          h('small', {}, next ? m.profile.toNext(prog.of - prog.done, next) : m.profile.top),
        ),
      ),
      h(
        'div',
        { class: 'arena-hub-stats' },
        stat(m.profile.totals.matches, formatNumber(tot.matches)),
        stat(m.profile.totals.wins, formatNumber(tot.wins)),
        stat(m.profile.totals.losses, formatNumber(tot.losses)),
        stat(m.profile.totals.draws, formatNumber(tot.draws)),
        stat(m.profile.totals.winRate, `${rate}%`),
        stat(m.profile.totals.kos, formatNumber(tot.kos)),
        stat(m.profile.totals.scored, formatNumber(tot.scored)),
      ),
      tot.matches === 0
        ? note(m.profile.none)
        : h(
            'div',
            { class: 'arena-hub-favs' },
            h('span', { class: 'field-label' }, m.profile.favorites),
            h(
              'div',
              { class: 'arena-hub-fav-list' },
              ...p.favorites.map((f) =>
                h('div', { class: 'arena-hub-fav' }, h('img', { src: portraitUrl(firstForm(f.starter).dex), alt: '' }), h('span', {}, h('b', {}, firstForm(f.starter).name), h('small', {}, m.profile.favorite(f.matches, f.wins)))),
              ),
            ),
          ),
      deviceCard(),
    ]
  }

  const seasonTab = () => {
    const s = season()
    const now = Date.now()
    const mine = profile !== 'loading' && profile ? profile.tier.tier : null
    return [
      h(
        'div',
        { class: 'arena-hub-season-head' },
        h('b', {}, m.season.title(s.id)),
        h('span', {}, now < s.startMs ? m.season.starts(countdown(now, s.startMs)) : m.season.ends(countdown(now, s.endMs))),
      ),
      h('span', { class: 'field-label' }, m.season.ladder),
      h(
        'ol',
        { class: 'arena-hub-ladder' },
        ...ladder()
          .reverse()
          .map((rung) =>
            h(
              'li',
              { class: `arena-hub-rung tier-${rung.tier}${rung.tier === mine ? ' mine' : ''}` },
              h('img', { src: tierBallUrl(rung.tier), alt: '' }),
              h('span', { class: 'arena-hub-rung-text' }, h('b', {}, TIER_NAMES[rung.tier]), h('small', {}, m.season.range(rung.from, rung.to))),
              h('span', { class: 'arena-hub-reward' }, m.season.reward(m.season.rewards[rung.tier])),
              rung.tier === mine ? h('em', { class: 'arena-hub-you' }, m.season.you) : null,
            ),
          ),
      ),
      note(m.season.divisions),
      note(m.season.reset(ARENA_RANKED.season.days)),
    ]
  }

  const boardRow = (r: ArenaLeaderboardRow, me: boolean, pinned = false) =>
    h(
      'div',
      { class: `arena-hub-row${me ? ' me' : ''}${pinned ? ' pinned' : ''}${r.place <= 3 ? ` top${r.place}` : ''}` },
      h('span', { class: 'arena-hub-place' }, `#${r.place}`),
      tierBadge(r.tier),
      r.favorite ? h('img', { class: 'arena-hub-face', src: portraitUrl(firstForm(r.favorite).dex), alt: firstForm(r.favorite).name }) : h('span', { class: 'arena-hub-face' }),
      h('span', { class: 'arena-hub-who' }, h('b', {}, r.name), r.handle ? h('small', {}, `@${r.handle}`, me ? ` · ${m.ranking.you}` : '') : null),
      h('span', { class: 'arena-hub-record' }, m.ranking.record(r.wins, r.matches)),
      h('b', { class: 'arena-hub-points' }, m.rp(r.rp)),
    )

  const rankingTab = () => {
    if (board === 'idle') loadBoard()
    const s = season()
    const head = h('div', { class: 'arena-hub-season-head' }, h('b', {}, m.ranking.title(s.id)))
    if (board === 'loading' || board === 'idle') return [head, note(m.loading, 'blink')]
    if (!board) return [head, note(m.offline)]
    if (board.length === 0) return [head, note(m.ranking.empty)]
    const handle = accountHandle()
    const rows = board.map((r) => boardRow(r, handle !== null && r.handle === handle))
    const p = profile !== 'loading' ? profile : null
    // This player's row when they're placed off this page: pinned under it.
    const pinned =
      p?.place && !board.some((r) => r.place === p.place)
        ? boardRow({ place: p.place, handle: handle ?? '', name: handle ? `@${handle}` : t().versus.you, rp: p.rating.rp, tier: p.tier, wins: p.totals.wins, matches: p.totals.matches, favorite: p.favorites[0]?.starter ?? null }, true, true)
        : null
    return [head, h('div', { class: 'arena-hub-board' }, ...rows), pinned]
  }

  const matchRow = (e: ArenaHistoryEntry) => {
    const mine = e.score[e.team]
    const theirs = e.score[e.team === 0 ? 1 : 0]
    return h(
      'div',
      { class: `arena-hub-match ${e.outcome}`, style: `--team:${teamColor(e.team)}` },
      h('img', { class: 'arena-hub-face', src: portraitUrl(firstForm(e.starter).dex), alt: firstForm(e.starter).name }),
      h(
        'span',
        { class: 'arena-hub-match-text' },
        h('span', { class: 'arena-hub-match-top' }, h('em', { class: `arena-hub-kind ${e.kind}` }, m.history.kinds[e.kind]), h('b', {}, m.history.outcomes[e.outcome])),
        h('small', {}, `${when(e.at)} · ${m.history.line(e.kos, e.scored)}`),
      ),
      h(
        'span',
        { class: 'arena-hub-match-end' },
        h('span', { class: 'arena-hub-score' }, h('b', {}, String(mine)), '×', String(theirs)),
        h('b', { class: `arena-hub-delta${e.rp === null ? ' none' : e.rp >= 0 ? ' up' : ' down'}` }, e.rp === null ? '—' : m.delta(e.rp)),
      ),
    )
  }

  const historyTab = () => {
    if (history === 'loading') return [note(m.loading, 'blink')]
    const list = mergeHistory(history.api, device)
    const offline = signedIn && history.api === null
    const more = history.more ? h('button', { class: 'btn small arena-hub-more', type: 'button', onclick: () => loadMore() }, m.history.more) : null
    primary = more ?? (signedIn ? null : primary)
    return [
      ...(signedIn ? [] : [signInCard(), note(m.history.device)]),
      ...(offline ? [note(m.offline)] : []),
      list.length === 0 ? note(m.history.empty) : h('div', { class: 'arena-hub-matches' }, ...list.map(matchRow)),
      more,
    ]
  }

  const rulesTab = () => {
    const r = ARENA_RANKED
    const items = m.rules.items({ win: r.rp.win, loss: r.rp.loss, perf: r.rp.perfMax, casual: r.queue.botsAfter.casual, ranked: r.queue.botsAfter.ranked, humans: r.queue.minHumansRanked, days: r.season.days, surrender: formatTime(VERSUS.length - VERSUS.surrender.from) })
    return [h('b', { class: 'arena-hub-rules-title' }, m.rules.title), h('ol', { class: 'arena-hub-rules' }, ...items.map((text) => h('li', {}, text)))]
  }

  const paint = () => {
    if (gone) return
    primary = null
    tabs.forEach((b, i) => {
      const on = ARENA_HUB_TABS[i] === current
      b.classList.toggle('on', on)
      b.setAttribute('aria-selected', String(on))
    })
    const s = season()
    const now = Date.now()
    seasonChip.textContent = `${m.season.title(s.id)} · ${now < s.startMs ? m.season.starts(countdown(now, s.startMs)) : m.season.ends(countdown(now, s.endMs))}`
    headBadge.replaceChildren(profile && profile !== 'loading' ? tierBadge(profile.tier) : h('img', { src: tierBallUrl('ultra'), alt: '' }))
    const scroll = body.scrollTop
    const content = { profile: profileTab, season: seasonTab, ranking: rankingTab, history: historyTab, rules: rulesTab }[current]()
    body.replaceChildren(...content.filter((c): c is HTMLElement => c !== null))
    body.dataset.tab = current
    body.scrollTop = scroll
  }

  const switchTab = (id: ArenaHubTab) => {
    if (id === current) return
    playSfx('move')
    current = id
    body.scrollTop = 0
    paint()
  }

  const loadBoard = () => {
    board = 'loading'
    void fetchArenaBoard(season().id).then((rows) => ((board = rows), paint()))
  }

  const loadMore = () => {
    if (history === 'loading' || !history.api) return
    const api = history.api
    const oldest = api[api.length - 1]?.at ?? null
    playSfx('select')
    void fetchArenaHistory(oldest, PAGE).then((page) => {
      if (history === 'loading' || !page) return
      history = { api: [...api, ...page.filter((e) => !api.some((a) => a.id === e.id))], more: page.length >= PAGE }
      paint()
    })
  }

  if (signedIn) {
    void fetchArenaMe().then((p) => ((profile = p), paint()))
    void fetchArenaHistory(null, PAGE).then((api) => ((history = { api, more: (api?.length ?? 0) >= PAGE }), paint()))
  }

  const backButton = h('button', { class: 'btn small arena-back', type: 'button', onclick: () => (playSfx('select'), later(actions.back)) }, t().versus.back)
  const el = h(
    'div',
    { class: 'screen dim arena-hub-screen' },
    h(
      'div',
      { class: 'dialog box pop arena-hub' },
      h('div', { class: 'dialog-title arena-hub-title' }, headBadge, h('span', {}, m.title), seasonChip),
      h('nav', { class: 'shell-tabs arena-hub-tabs', role: 'tablist' }, ...tabs),
      body,
      h('div', { class: 'arena-foot' }, backButton, hint(m.hintKeys, m.hintTouch)),
    ),
  )

  const off = input.onKey((key) => {
    const at = ARENA_HUB_TABS.indexOf(current)
    if (key === 'ArrowLeft' || key === 'ArrowRight') switchTab(ARENA_HUB_TABS[(at + (key === 'ArrowLeft' ? -1 : 1) + ARENA_HUB_TABS.length) % ARENA_HUB_TABS.length]!)
    else if (key === 'ArrowUp' || key === 'ArrowDown') body.scrollBy({ top: key === 'ArrowUp' ? -80 : 80 })
    else if (key === 'Enter') primary?.click()
    else if (key === 'Escape' || key === 'Backspace') {
      playSfx('select')
      later(actions.back)
    }
  })

  root.append(el)
  paint()
  return {
    el,
    dim: 0.55,
    dispose: () => {
      gone = true
      off()
      el.remove()
    },
  }
}

/** "5d 3h", "2h 40min": what's left until `until`. */
const countdown = (now: number, until: number) => {
  const left = timeLeft(now, until)
  return t().versus.hub.season.left(left.days, left.hours, left.minutes)
}
