import { accountHandle } from '../account'
import { arenaSignedIn, deviceArenaHistory, fetchArenaBoard, fetchArenaHistory, fetchArenaMe } from '../arenaApi'
import { divisionProgress, ladder, mergeHistory, record, timeLeft } from '../arena/history'
import { ARENA_RANKED, type TierId } from '../data/arenaRanked'
import { VERSUS, VERSUS_FORMATS, VERSUS_KIT } from '../data/versus'
import type { ArenaFormat } from '../data/arenaFormats'
import { playSfx } from '../engine/audio'
import { formatTime } from '../engine/math'
import type { Input } from '../engine/input'
import { matchesToRanked, mayQueue, queueHold, seasonAt, seasonById, tierOf, type ArenaHistoryEntry, type ArenaLeaderboardRow, type ArenaProfile, type FairPlayView, type Season, type TierView } from '../game/arenaRank'
import { formatNumber, locale, LOCALES, t } from '../i18n'
import { arenaIconUrl, tierBallUrl } from '../render/arenaArt'
import { gemIconUrl, slotIconUrl } from '../render/gemArt'
import type { VersusPick } from '../data/versus'
import { gemChip, lockerTab, shopTab, type GemTab, type GemTabsContext } from './gemShop'
import { onGems } from '../gems'
import { portraitUrl } from '../render/sprites'
import { firstForm, teamColor } from './arena'
import { h, later } from './dom'
import { boundKey } from './inputLabels'
import { hint, type Screen } from './screens'
import { titleChip } from './arenaTitle'
import { localLook } from '../render/looks'

/** Seconds away in a row that cost Fair Play's AFK (an away second counts `awayWeight`). */
const AWAY_AFTER = Math.round(ARENA_RANKED.fairPlay.afkAfter / ARENA_RANKED.fairPlay.awayWeight)

/**
 * The Arena's hub: the competitive side of the Arena in seven tabs. Perfil
 * (tier badge, RP to the next division, the season's totals and most played
 * Pokémon, Fair Play and the protection meter), Loja and Visual (the gem
 * shop and the look worn in matches, `ui/gemShop.ts`; the gem chip in the
 * title opens Loja), Temporada (the season's
 * number and time left, the ladder with each tier's title, how the reset
 * works), Ranking (the season's board, this
 * player's row pinned when it's off the page), Histórico (the API's matches
 * merged with the device's practice, tagged Treino) and Regras (ranked in
 * plain words, its numbers from `ARENA_RANKED`). Before season 1 both
 * Perfil and Temporada say it's the pre-season (ranked matches kept unrated),
 * and a Fair Play penalty this device hasn't shown yet is told on top of
 * every tab ("Você saiu de uma partida"). A guest sees the device's
 * history and a way to sign in. Opened from the Arena screen and the
 * lobby's Stadium (`showArenaHub(tab)` in `main.ts`). ← → switch tabs, ↑ ↓
 * scroll, Enter presses the tab's button, Esc goes back.
 */

export const ARENA_HUB_TABS = ['profile', 'shop', 'locker', 'season', 'ranking', 'history', 'rules'] as const
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

/** Each tab's icon (`render/arenaArt.ts`; the gem tabs', `render/gemArt.ts`). */
const TAB_ICONS = {
  profile: () => arenaIconUrl('tabProfile'),
  shop: gemIconUrl,
  locker: () => slotIconUrl('head'),
  season: () => arenaIconUrl('tabSeason'),
  ranking: () => arenaIconUrl('tabRanking'),
  history: () => arenaIconUrl('tabHistory'),
  rules: () => arenaIconUrl('tabRules'),
} as const satisfies Record<ArenaHubTab, () => string>

/** The tier above `view`'s division: the next division's, or the next tier's III. */
const nextName = (view: TierView) => (view.next === null ? null : tierName(tierOf(view.next)))

const PAGE = 20

/** A match's moment, short: day, month and time in this language. */
const when = (ms: number) => new Date(ms).toLocaleString(LOCALES[locale()].tag, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

let staged: boolean | null = null

/** Dev (`ps.arena('season', …)`): the screens act as in the pre-season (true) or in a season (false) whatever the date; null goes back to the clock. */
export const stagePreseason = (on: boolean | null) => {
  staged = on
}

/** Whether it's still the pre-season: before season 1 starts, ranked matches are stored unrated. */
export const preseason = (now = Date.now()) => staged ?? seasonAt(now) === null

/** When season 1 starts, in this player's own time and language ("02/11, 00:00"). */
export const season1Date = () => when(seasonById(1).startMs)

/** The newest Fair Play penalty this device told (ms), so the hub tells each one once. */
const SEEN_KEY = 'ps:fairPlaySeen'

const seenPenalty = () => {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0
  } catch {
    return 0
  }
}

const markPenaltySeen = (at: number) => {
  try {
    localStorage.setItem(SEEN_KEY, String(at))
  } catch {
    // Storage blocked: told again next time.
  }
}

/** A bar of `value` out of `max`, in the color its level calls for. */
const meter = (value: number, max: number, level: 'good' | 'warn' | 'bad' | 'gold') =>
  h('div', { class: `arena-hub-bar meter ${level}`, role: 'img', 'aria-label': `${value}/${max}` }, h('i', { style: `width:${Math.round((Math.max(0, Math.min(max, value)) / max) * 100)}%` }))

/**
 * `signIn`: the way to an account (null in a build without accounts: the hub shows the device's history alone).
 * `pick`: the Arena's Pokémon, the gem tabs' preview (Visual changes it with `keepPick`). `checkout`: the ref the page came
 * back from a gem pack's checkout with (`?gems=<ref>`), so the Loja opens on that pack's return.
 */
export type ArenaHubActions = { back: () => void; signIn: (() => void) | null; pick: VersusPick; keepPick: (id: VersusPick) => void; checkout?: string }

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
    h('button', { class: `shell-tab arena-hub-tab ${id}`, type: 'button', role: 'tab', 'aria-label': m.tabs[id], onclick: () => switchTab(id) }, h('img', { class: 'arena-hub-tab-icon', src: TAB_ICONS[id](), alt: '' }), h('span', {}, m.tabs[id])),
  )

  // The gem tabs keep their pages (and previews) across tab switches; made the first time they show.
  let pick = actions.pick
  const gemCtx: GemTabsContext = {
    root,
    input,
    signIn: actions.signIn,
    pick: () => pick,
    setPick: (id) => ((pick = id), actions.keepPick(id)),
    goTab: (id) => switchTab(id),
  }
  const gemTabs: { shop?: GemTab; locker?: GemTab } = {}
  const gemTab = (id: 'shop' | 'locker') => (gemTabs[id] ??= id === 'shop' ? shopTab(gemCtx, actions.checkout ?? null) : lockerTab(gemCtx))
  const chip = gemChip(() => switchTab('shop'))

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

  /** Before season 1: what the pre-season is, and that this player's ranked matches so far weren't lost. */
  const preseasonCard = (played: number) =>
    preseason()
      ? h(
          'div',
          { class: 'arena-hub-card arena-hub-preseason' },
          h('img', { src: arenaIconUrl('tabSeason'), alt: '' }),
          h('div', {}, h('b', {}, m.profile.preseason.title), h('p', {}, m.profile.preseason.text(season1Date())), played > 0 ? h('p', {}, m.profile.preseason.played(played)) : null),
        )
      : null

  /** Fair Play: the score on its bar, what it lets this player do now, what moves it and the latest penalties. */
  const fairPlayCard = (fp: FairPlayView) => {
    const F = ARENA_RANKED.fairPlay
    const f = m.profile.fairPlay
    const hold = queueHold(fp.score)
    const ranked = mayQueue('ranked', fp.score)
    const level = ranked ? 'good' : hold > 0 ? 'bad' : 'warn'
    return h(
      'div',
      { class: `arena-hub-card arena-hub-meter fair ${level}` },
      h('div', { class: 'arena-hub-meter-head' }, h('b', {}, f.title), h('b', { class: 'arena-hub-meter-value' }, `${fp.score}/${F.max}`)),
      meter(fp.score, F.max, level),
      h('p', { class: 'arena-hub-meter-status' }, ranked ? f.ok : f.noRanked(F.rankedMin, matchesToRanked(fp.score))),
      hold > 0 ? h('p', { class: 'arena-hub-meter-status' }, f.held(hold)) : null,
      h('p', { class: 'arena-hub-meter-explain' }, f.explain({ left: -F.left, afk: -F.afk, afkAfter: F.afkAfter, awayAfter: AWAY_AFTER, finish: F.finish })),
      ...fp.penalties.slice(0, 3).map((p) => h('p', { class: 'arena-hub-penalty' }, h('span', {}, f.penalty(f.penalties[p.conduct], p.change)), h('small', {}, when(p.at)))),
    )
  }

  /** The protection meter: full, the next ranked loss costs no RP. */
  const protectionCard = (value: number) => {
    const P = ARENA_RANKED.protection
    const ready = value >= P.max
    return h(
      'div',
      { class: `arena-hub-card arena-hub-meter shield${ready ? ' ready' : ''}` },
      h('div', { class: 'arena-hub-meter-head' }, h('b', {}, m.profile.protection.title), h('b', { class: 'arena-hub-meter-value' }, `${Math.min(value, P.max)}/${P.max}`)),
      meter(value, P.max, 'gold'),
      h('p', { class: 'arena-hub-meter-status' }, ready ? m.profile.protection.ready : m.profile.protection.filling),
    )
  }

  /** Fair Play penalties newer than the last this device told, newest first (each told once: seen as it's shown). */
  const notice = h('div', { class: 'arena-hub-notice', role: 'status', hidden: true })
  const tellPenalties = (fp: FairPlayView) => {
    const seen = seenPenalty()
    const fresh = fp.penalties.filter((p) => p.at > seen)
    if (fresh.length === 0) return
    const f = m.profile.fairPlay
    notice.replaceChildren(
      ...fresh.slice(0, 2).map((p) => h('p', {}, h('b', {}, f.penalty(f.penalties[p.conduct], p.change)), h('small', {}, when(p.at)))),
      h('p', { class: 'arena-hub-notice-score' }, `${f.title}: ${fp.score}/${ARENA_RANKED.fairPlay.max}`),
    )
    notice.hidden = false
    markPenaltySeen(Math.max(...fresh.map((p) => p.at)))
  }

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
          titleChip(localLook().title),
          h('span', { class: 'arena-hub-rp' }, m.rp(p.rating.rp), h('small', {}, p.place ? m.profile.place(p.place) : m.profile.unplaced)),
          next ? h('div', { class: 'arena-hub-bar' }, h('i', { style: `width:${Math.round((prog.done / prog.of) * 100)}%` })) : null,
          h('small', {}, next ? m.profile.toNext(prog.of - prog.done, next) : m.profile.top),
        ),
      ),
      preseasonCard(p.preseason),
      h('div', { class: 'arena-hub-meters' }, fairPlayCard(p.fairPlay), protectionCard(p.rating.protection)),
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
      preseasonCard(profile !== 'loading' && profile ? profile.preseason : 0),
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
        h('span', { class: 'arena-hub-match-top' }, h('em', { class: `arena-hub-kind ${e.kind}` }, m.history.kinds[e.kind]), e.format === 'quick' ? h('em', { class: 'arena-hub-kind quick' }, t().versus.formats.quick.size) : null, h('b', {}, m.history.outcomes[e.outcome])),
        h('small', {}, `${when(e.at)} · ${m.history.line(e.kos, e.scored)}`),
      ),
      h(
        'span',
        { class: 'arena-hub-match-end' },
        h('span', { class: 'arena-hub-score' }, h('b', {}, String(mine)), '×', String(theirs)),
        e.protected
          ? h('b', { class: 'arena-hub-delta shield' }, m.history.protected)
          : h('b', { class: `arena-hub-delta${e.rp === null ? ' none' : e.rp >= 0 ? ' up' : ' down'}` }, e.rp === null ? '—' : m.delta(e.rp)),
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
    const F = r.fairPlay
    const surrenderClock = (f: ArenaFormat) => formatTime(VERSUS_FORMATS[f].length * (1 - VERSUS.surrender.from))
    const items = m.rules.items({
      win: r.rp.win,
      loss: r.rp.loss,
      perf: r.rp.perfMax,
      casual: r.queue.botsAfter.casual,
      ranked: r.queue.botsAfter.ranked,
      humans: r.queue.minHumansRanked,
      days: r.season.days,
      fair: { max: F.max, left: -F.left, afk: -F.afk, afkAfter: F.afkAfter, awayAfter: AWAY_AFTER, finish: F.finish, rankedMin: F.rankedMin, holdBelow: F.holdBelow },
      season1: season1Date(),
      surrender: { standard: surrenderClock('standard'), quick: surrenderClock('quick') },
    })
    const keys = {
      move1: boundKey('move1'),
      move2: boundKey('move2'),
      unite: boundKey('unite'),
      target: boundKey('target'),
      chat: boundKey('chat'),
      ping: boundKey('ping'),
      board: boundKey('board'),
      second: VERSUS_KIT.secondMove,
      evo: { standard: VERSUS_FORMATS.standard.evolveAt, quick: VERSUS_FORMATS.quick.evolveAt },
    }
    return [
      h('b', { class: 'arena-hub-rules-title' }, m.controls.title),
      h('ol', { class: 'arena-hub-rules' }, ...m.controls.items(keys).map((text) => h('li', {}, text))),
      h('b', { class: 'arena-hub-rules-title' }, m.rules.title),
      h('ol', { class: 'arena-hub-rules' }, ...items.map((text) => h('li', {}, text))),
    ]
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
    body.dataset.tab = current
    if (current === 'shop' || current === 'locker') {
      const page = gemTab(current)
      if (body.firstChild !== page.el || body.childNodes.length !== 1) body.replaceChildren(page.el)
      page.enter()
      return
    }
    const content = { profile: profileTab, season: seasonTab, ranking: rankingTab, history: historyTab, rules: rulesTab }[current]()
    body.replaceChildren(...content.filter((c): c is HTMLElement => c !== null))
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
    void fetchArenaMe().then((p) => {
      profile = p
      if (p && !gone) tellPenalties(p.fairPlay)
      paint()
    })
    void fetchArenaHistory(null, PAGE).then((api) => ((history = { api, more: (api?.length ?? 0) >= PAGE }), paint()))
  }

  const backButton = h('button', { class: 'btn small arena-back', type: 'button', onclick: () => (playSfx('select'), later(actions.back)) }, t().versus.back)
  const el = h(
    'div',
    { class: 'screen dim arena-hub-screen' },
    h(
      'div',
      { class: 'dialog box pop arena-hub' },
      h('div', { class: 'dialog-title arena-hub-title' }, headBadge, h('span', {}, m.title), chip, seasonChip),
      h('nav', { class: 'shell-tabs arena-hub-tabs', role: 'tablist' }, ...tabs),
      notice,
      body,
      h('div', { class: 'arena-foot' }, backButton, hint(m.hintKeys, m.hintTouch)),
    ),
  )

  const off = input.onKey((key) => {
    // A gem tab's sheet or dialog has the keys meanwhile.
    if (gemTabs.shop?.busy() || gemTabs.locker?.busy()) return
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
  // The profile shows the title the account wears (`localLook`), which the gems' answer can bring after it painted.
  let title = localLook().title
  const offGems = onGems(() => {
    if (localLook().title === title) return
    title = localLook().title
    if (current === 'profile') paint()
  })
  return {
    el,
    dim: 0.55,
    dispose: () => {
      gone = true
      off()
      offGems()
      gemTabs.shop?.dispose()
      gemTabs.locker?.dispose()
      el.remove()
    },
  }
}

/** "5d 3h", "2h 40min": what's left until `until`. */
const countdown = (now: number, until: number) => {
  const left = timeLeft(now, until)
  return t().versus.hub.season.left(left.days, left.hours, left.minutes)
}
