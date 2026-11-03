import { accountState } from '../account'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { formatTime } from '../engine/math'
import { HATCHLING_IDS, PLAYABLE, type PlayableId } from '../data/hatchlings'
import { REGIONS } from '../data/starters'
import { shownLegends } from '../game/festival'
import { dailyChallenge } from '../game/challenge'
import { brasiliaDay, previousDay, type DayKey } from '../game/day'
import { DIFFICULTY_IDS, type Difficulty } from '../game/difficulty'
import { pumpkinRow } from '../game/halloween'
import { BOARD_PERIODS, isPlayable, RUN_MODES, runMode, type Board, type BoardEntry, type BoardPeriod, type RunMode } from '../game/ranking'
import { fetchBoard, fetchChallengeBoard, fetchCoopBoard, fetchCoopChallengeBoard, type BoardFilter, type RankOutcome } from '../ranking'
import { dailyCoopChallenge, TEAM_SIZE_KEYS, TEAM_SIZES, type CoopBoard, type CoopBoardEntry, type CoopChallengeBoard, type TeamSize } from '../game/coopBoard'
import { formatDay, t } from '../i18n'
import { BAG_ITEMS, parseBagItems } from '../game/bag'
import { coopIcon, flagIcon } from '../render/art'
import { jackIcon } from '../render/halloweenArt'
import { today } from './save'
import { h, later, rich } from './dom'
import { profileScreen, runForm, runPortrait, supporterBadges } from './profile'
import { reportDialog } from './report'
import { shopIcon } from './shopIcons'
import { hint, menu, type Screen } from './screens'

const step = <T>(list: readonly T[], at: T, by: number) => list[(list.indexOf(at) + by + list.length) % list.length]!

/** The Bag items a run took, as overlapping icons (none from an older API or run). */
export const runBag = (bag: unknown) => {
  const items = parseBagItems(bag)
  if (items.length === 0) return null
  const label = t().ranking.bag(items.map((id) => BAG_ITEMS[id].name).join(', '))
  return h('span', { class: 'rank-bag', role: 'img', 'aria-label': label, title: label }, ...items.map((id) => shopIcon(id)))
}

/**
 * One player's line: position, Pokémon, name (with their supporter badge) and
 * handle, the Bag items the run took, time. During the Noite das Bruxas, a jack-o'-lantern supporter's
 * line glows like a candle, with a jack-o'-lantern on its edge (`pumpkinRow`).
 */
const entryRow = (e: BoardEntry, me: boolean) => {
  const lit = e.supporter != null && pumpkinRow(e.supporterSince, today())
  return h(
    'button',
    { class: `rank-row${me ? ' me' : ''}${e.rank <= 3 ? ` top${e.rank}` : ''}${lit ? ' pumpkin' : ''}` },
    h('span', { class: 'rank-pos' }, `#${e.rank}`),
    h('img', { src: runPortrait(e), alt: runForm(e).name, title: runForm(e).name }),
    h('span', { class: 'rank-who' }, h('b', {}, e.name, ...supporterBadges(e.supporter, e.supporterSince, e.og)), h('small', {}, `@${e.handle}`, me && ` · ${t().ranking.you}`)),
    runBag(e.bag) ?? h('span', {}),
    h('span', { class: 'rank-time' }, h('b', {}, formatTime(e.time)), h('small', {}, t().ranking.outcomes[e.outcome])),
    lit && h('img', { class: 'rank-jack', src: jackIcon(), alt: '' }),
  )
}

/** A row with its report flag beside it (signed in, someone else's run), or the row alone. */
const entryLine = (row: HTMLElement, e: BoardEntry, report: ((e: BoardEntry) => void) | null) =>
  report
    ? h(
        'div',
        { class: 'rank-line' },
        row,
        h('button', { class: 'rank-flag', type: 'button', 'aria-label': t().report.flag(e.handle), title: t().report.flag(e.handle), onclick: () => (playSfx('select'), report(e)) }, h('img', { src: flagIcon(), alt: '' })),
      )
    : row

/** The Pokémon filter: every starter by region, then the egg families; the legends on the Legend mode's board. */
const pokemonSelect = (mode: RunMode, value: PlayableId | null, onPick: (id: PlayableId | null) => void) => {
  const m = t().ranking
  const option = (id: PlayableId) => h('option', { value: id, selected: id === value }, PLAYABLE[id].name)
  const groups =
    mode === 'legend'
      ? [h('optgroup', { label: m.legendGroup }, ...shownLegends(brasiliaDay(today())).map(option))]
      : [...REGIONS.map((r) => h('optgroup', { label: r.name }, ...r.starters.map(option))), h('optgroup', { label: m.eggGroup }, ...HATCHLING_IDS.map(option))]
  const select = h('select', { class: 'rank-select', 'aria-label': m.pokemon }, h('option', { value: '' }, m.allPokemon), ...groups)
  select.addEventListener('change', () => {
    // Back to the game's keys: the arrows move through the board again.
    select.blur()
    onPick(isPlayable(select.value) ? select.value : null)
  })
  return select
}

/**
 * A co-op team's line: position, each member (their Pokémon's portrait, name
 * with their supporter badge, @handle) and the time with the outcome. The
 * members wrap in a grid (two a line on a phone held upright, a Squad in two
 * lines). With `open`, each member is a button that opens their profile (the
 * screen's menu binds the clicks: `members` are its stops); without, the line
 * only shows (the challenge screen's preview).
 */
export const teamRow = (e: CoopBoardEntry, me: boolean, interactive: boolean) => {
  const m = t().ranking
  const members = e.members.map((x) =>
    h(
      interactive ? 'button' : 'span',
      { class: 'rank-member', ...(interactive && { type: 'button' }) },
      h('img', { src: runPortrait(x), alt: runForm(x).name, title: runForm(x).name }),
      h('span', { class: 'rank-who' }, h('b', {}, x.name, ...supporterBadges(x.supporter, null, x.og)), h('small', {}, `@${x.handle}`)),
    ),
  )
  const el = h(
    'div',
    { class: `rank-row rank-team${me ? ' me' : ''}${e.rank <= 3 ? ` top${e.rank}` : ''}`, role: 'group', 'aria-label': m.team(e.members.map((x) => x.name).join(', ')) },
    h('span', { class: 'rank-pos' }, `#${e.rank}`),
    h('span', { class: `rank-members n${e.members.length}` }, ...members),
    h('span', { class: 'rank-time' }, h('b', {}, formatTime(e.time)), h('small', {}, me ? `${m.coopOutcomes[e.outcome]} · ${m.you}` : m.coopOutcomes[e.outcome])),
  )
  return { el, members }
}

/** A board tab: a difficulty's boards, or the Desafio do dia's. */
type Tab = Difficulty | 'challenge'

const TABS: readonly Tab[] = [...DIFFICULTY_IDS, 'challenge']

const CHALLENGE_DAYS = ['today', 'yesterday'] as const

type ChallengeDay = (typeof CHALLENGE_DAYS)[number]

/** The boards' sides: the regular runs, the Legend mode's, and the co-op teams'. */
type Side = RunMode | 'coop'

const SIDES: readonly Side[] = [...RUN_MODES, 'coop']

/** The challenge has no Legend mode: its sides are the solo one and the co-op one. */
const CHALLENGE_SIDES: readonly Side[] = ['standard', 'coop']

/** The Brasília day a challenge tab shows (on the missions' clock, like the challenge screen). */
const challengeDay = (d: ChallengeDay): DayKey => {
  const now = brasiliaDay(today())
  return d === 'today' ? now : previousDay(now)
}

/** The board on screen: a solo one (or the challenge's) or a co-op one (or the Desafio co-op's). */
type Shown = { kind: 'solo'; board: Board } | { kind: 'coop'; board: CoopBoard | CoopChallengeBoard }

/**
 * The boards: one per difficulty, each by day, week and all time, every player
 * once with their best run, for the regular runs or the Legend mode's (a
 * mode toggle, M), and the Desafio do dia's, today's and yesterday's,
 * every player once with their official attempt. The Co-op side (the mode
 * toggle's third) has the same tabs for teams, by size (Duplas, Trios,
 * Squads, T): every team once with its best run, and the Desafio co-op do
 * dia's. Filters by Pokémon (not the challenge's: it's one Pokémon, nor
 * co-op's) and by friends (who the player follows, plus them). The player's
 * own line stays in sight below the top when they're further down. A row (a
 * team's member) opens that trainer's profile over the board; signed in, the
 * flag beside someone else's solo row reports that run (`reportDialog`).
 *
 * Keys: ↑/↓ rows and buttons, ←/→ period (or day), Q/E board, M mode, T team size, F friends, Enter
 * opens, Esc goes back. `onClose` runs after the key dispatch.
 * `challenge` opens on the challenge's tab, `mode` on that mode's boards, `coop` on the co-op side at that team size.
 */
export const rankingScreen = (
  root: HTMLElement,
  input: Input,
  onClose: () => void,
  opts: { difficulty?: Difficulty; mode?: RunMode; challenge?: boolean; coop?: { size: TeamSize } } = {},
): Screen => {
  const signedIn = () => accountState().kind === 'signedIn'
  const filter: BoardFilter = { mode: opts.mode ?? 'standard', difficulty: opts.difficulty ?? 'normal', period: 'day', starter: null, friends: false }
  let tab: Tab = opts.challenge ? 'challenge' : filter.difficulty
  let day: ChallengeDay = 'today'
  let coop = opts.coop !== undefined
  let size: TeamSize = opts.coop?.size ?? 2
  /** Players (or teams) on the challenge board shown. */
  let total = 0
  const el = h('div', { class: 'screen dim rank-screen' })
  let nav: ReturnType<typeof menu> | null = null
  /** The menu's stops, for keeping the cursor in view. */
  let stops: HTMLElement[] = []
  /** A profile open over the board. */
  let sub: Screen | null = null
  /** The board on screen: loading, unreachable, or the answer. */
  let board: Shown | 'loading' | 'offline' = 'loading'
  let request = 0
  let closed = false
  let opening = true

  /** The side on screen (the challenge's solo board for the Legend mode's, which has none). */
  const side = (): Side => (coop ? 'coop' : tab === 'challenge' ? 'standard' : filter.mode)

  const openProfile = (handle: string) => {
    nav?.off()
    el.classList.add('hidden')
    sub = profileScreen(root, input, handle, () => {
      sub = null
      el.classList.remove('hidden')
      // Following someone there changes the friends board.
      void load()
    })
  }

  /** The report dialog over the board, about `e`'s run on the board shown. */
  const openReport = (e: BoardEntry) => {
    nav?.off()
    el.classList.add('hidden')
    const difficulty = tab === 'challenge' ? dailyChallenge(challengeDay(day)).difficulty : filter.difficulty
    const run = e.run ? { id: e.run, pokemon: runForm(e).name, time: e.time, difficulty } : null
    sub = reportDialog(root, input, { handle: e.handle, name: e.name, run }, () => {
      sub = null
      el.classList.remove('hidden')
      render()
    })
  }

  const myHandle = () => {
    const s = accountState()
    return s.kind === 'signedIn' ? s.handle : null
  }

  /** The solo board's lines: each row (with its report flag), the player's own below the top. */
  const soloLines = (b: Board, rows: { el: HTMLElement; handle: string }[]) => {
    const mine = b.me
    const report = signedIn() ? openReport : null
    const top = b.entries.map((e) => {
      const me = e.handle === mine?.handle || e.handle === myHandle()
      const row = entryRow(e, me)
      rows.push({ el: row, handle: e.handle })
      return entryLine(row, e, me ? null : report)
    })
    const below = mine && !b.entries.some((e) => e.handle === mine.handle) ? entryRow(mine, true) : null
    if (below) rows.push({ el: below, handle: mine!.handle })
    return { top, below }
  }

  /** The co-op board's lines: a team each, its members the menu's stops; the player's best team below the top. */
  const teamLines = (b: CoopBoard | CoopChallengeBoard, rows: { el: HTMLElement; handle: string }[]) => {
    const mine = b.me
    const handle = myHandle()
    const line = (e: CoopBoardEntry, me: boolean) => {
      const row = teamRow(e, me, true)
      row.members.forEach((el, i) => rows.push({ el, handle: e.members[i]!.handle }))
      return row.el
    }
    const top = b.entries.map((e) => line(e, e.run === mine?.run || e.members.some((x) => x.handle === handle)))
    const below = mine && !b.entries.some((e) => e.run === mine.run) ? line(mine, true) : null
    return { top, below }
  }

  const render = () => {
    const m = t().ranking
    const button = (label: string, selected: boolean, onclick: () => void) => h('button', { class: selected ? 'region-tab rank-tab selected' : 'region-tab rank-tab', onclick }, label)
    const onChallenge = tab === 'challenge'
    const boards = TABS.map((d) => button(d === 'challenge' ? m.challengeTab : t().difficulty.names[d], d === tab, () => setTab(d)))
    const periods = onChallenge
      ? CHALLENGE_DAYS.map((d) => button(m.days[d], d === day, () => setDay(d)))
      : BOARD_PERIODS.map((p) => button(m.periods[p], p === filter.period, () => set({ period: p })))
    const scope = [button(m.everyone, !filter.friends, () => set({ friends: false })), button(m.friends, filter.friends, () => set({ friends: true }))]
    const sides = (onChallenge ? CHALLENGE_SIDES : SIDES).map((s) => button(s === 'coop' ? m.coop : m.modes[s], s === side(), () => setSide(s)))
    const sizes = TEAM_SIZES.map((n) => button(m.sizes[TEAM_SIZE_KEYS[n]], n === size, () => setSize(n)))
    const solo = onChallenge && !coop ? dailyChallenge(challengeDay(day)) : null
    const team = onChallenge && coop ? dailyCoopChallenge(challengeDay(day)) : null

    const rows: { el: HTMLElement; handle: string }[] = []
    const status = (text: string, cls = '') => h('p', { class: `rank-status ${cls}` }, text)
    let list: Node[]
    if (filter.friends && !signedIn()) list = [status(m.friendsGuest)]
    else if (board === 'loading') list = [status(m.loading, 'blink')]
    else if (board === 'offline') list = [status(m.offline)]
    else {
      const { top, below } = board.kind === 'solo' ? soloLines(board.board, rows) : teamLines(board.board, rows)
      const empty = filter.friends ? m.emptyFriends : coop ? (onChallenge ? m.coopChallengeEmpty : m.coopEmpty) : onChallenge ? m.challengeEmpty : m.empty
      list = top.length === 0 && !below ? [status(empty)] : [...top, ...(below ? [h('div', { class: 'rank-gap', 'aria-hidden': 'true' }, '⋮'), below] : [])]
    }

    const handle = myHandle()
    const actions = [
      ...rows.map((r) => () => openProfile(r.handle)),
      ...(board === 'offline' ? [() => void load()] : []),
      ...(handle ? [() => openProfile(handle)] : []),
      close,
    ]
    const footer = [
      ...(board === 'offline' ? [h('button', { class: 'btn' }, m.retry)] : []),
      ...(handle ? [h('button', { class: 'btn' }, m.myProfile)] : []),
      h('button', { class: 'btn' }, m.back),
    ]
    stops = [...rows.map((r) => r.el), ...footer]
    // Keep the cursor on the player's own row, else the top, across reloads.
    const meAt = rows.findIndex((r) => r.handle === handle)
    nav?.off()
    nav = menu(input, stops, (i) => (playSfx('select'), later(actions[i]!)), { initial: Math.max(0, meAt) })

    const resets = coop ? (onChallenge ? m.coopChallengeResets : m.coopResets) : onChallenge ? m.challengeResets : filter.period !== 'all' ? m.resets : null
    el.replaceChildren(
      h(
        'div',
        { class: opening ? 'dialog box pop rank' : 'dialog box rank' },
        h('div', { class: 'dialog-title' }, m.title),
        h('div', { class: 'region-tabs rank-tabs', role: 'tablist' }, ...boards),
        h('div', { class: 'region-tabs rank-tabs rank-modes', role: 'tablist' }, ...sides),
        h(
          'div',
          { class: 'rank-filters' },
          h('div', { class: 'region-tabs rank-tabs', role: 'tablist' }, ...periods),
          h('div', { class: 'region-tabs rank-tabs', role: 'tablist' }, ...scope),
          coop ? h('div', { class: 'region-tabs rank-tabs rank-sizes', role: 'tablist' }, ...sizes) : !onChallenge && pokemonSelect(filter.mode, filter.starter, (starter) => set({ starter })),
        ),
        solo &&
          h(
            'p',
            { class: 'rank-challenge' },
            h('img', { src: runPortrait({ starter: solo.starter, stage: 0 }), alt: '' }),
            m.challengeHead(formatDay(solo.day), PLAYABLE[solo.starter].name, t().difficulty.names[solo.difficulty], total),
          ),
        team && h('p', { class: 'rank-challenge' }, h('img', { src: coopIcon(), alt: '' }), m.coopChallengeHead(formatDay(team.day), t().difficulty.names[team.difficulty], total)),
        h('div', { class: 'rank-list' }, ...list),
        resets && h('p', { class: 'rank-resets' }, resets),
        h('div', { class: 'buttons' }, ...footer),
        hint(coop ? (onChallenge ? m.coopChallengeHint : m.coopHint) : onChallenge ? m.challengeHint : m.hintKeys, m.hintTouch),
      ),
    )
    opening = false
    stops[nav.index]?.scrollIntoView({ block: 'nearest' })
  }

  const load = async () => {
    const id = ++request
    board = 'loading'
    render()
    if (filter.friends && !signedIn()) return
    const next = await fetchShown()
    if (id !== request || closed) return
    board = next ?? 'offline'
    total = next && 'total' in next.board ? next.board.total : 0
    render()
  }

  /** The board the tabs and filters point at, from the API (null: out of reach). */
  const fetchShown = async (): Promise<Shown | null> => {
    const onChallenge = tab === 'challenge'
    if (coop) {
      const b = onChallenge
        ? await fetchCoopChallengeBoard(challengeDay(day), size, filter.friends)
        : await fetchCoopBoard({ size, difficulty: filter.difficulty, period: filter.period, friends: filter.friends })
      return b && { kind: 'coop', board: b }
    }
    const b = onChallenge ? await fetchChallengeBoard(challengeDay(day), filter.friends) : await fetchBoard(filter)
    return b && { kind: 'solo', board: b }
  }

  const setTab = (next: Tab) => {
    if (next === tab) return
    tab = next
    if (next !== 'challenge') filter.difficulty = next
    playSfx('move')
    void load()
  }

  const setDay = (next: ChallengeDay) => {
    if (next === day) return
    day = next
    playSfx('move')
    void load()
  }

  const set = (change: Partial<BoardFilter>) => {
    const next = { ...filter, ...change }
    if (next.mode === filter.mode && next.difficulty === filter.difficulty && next.period === filter.period && next.starter === filter.starter && next.friends === filter.friends) return
    Object.assign(filter, next)
    playSfx('move')
    void load()
  }

  /** The regular boards, the Legend mode's (a Pokémon filter of the other side goes) or co-op's. */
  const setSide = (next: Side) => {
    if (next === side()) return
    coop = next === 'coop'
    if (next !== 'coop') {
      filter.mode = next
      filter.starter = filter.starter && runMode(filter.starter) === next ? filter.starter : null
    }
    playSfx('move')
    void load()
  }

  const setSize = (next: TeamSize) => {
    if (next === size) return
    size = next
    playSfx('move')
    void load()
  }

  const offKeys = input.onKey((key) => {
    if (sub || closed) return
    if (key === 'Escape' || key === 'Backspace') return close()
    if (key === 'ArrowLeft' || key === 'KeyA' || key === 'ArrowRight' || key === 'KeyD') {
      const by = key === 'ArrowLeft' || key === 'KeyA' ? -1 : 1
      return tab === 'challenge' ? setDay(step(CHALLENGE_DAYS, day, by)) : set({ period: step<BoardPeriod>(BOARD_PERIODS, filter.period, by) })
    }
    if (key === 'KeyQ' || key === 'PageUp') return setTab(step(TABS, tab, -1))
    if (key === 'KeyE' || key === 'PageDown') return setTab(step(TABS, tab, 1))
    if (key === 'KeyF') return set({ friends: !filter.friends })
    if (key === 'KeyM') return setSide(step(tab === 'challenge' ? CHALLENGE_SIDES : SIDES, side(), 1))
    if (key === 'KeyT' && coop) return setSize(step(TEAM_SIZES, size, 1))
    // `menu` moved the cursor: keep it in view in the scrolling list.
    if (nav) stops[nav.index]?.scrollIntoView({ block: 'nearest' })
  })

  const dispose = () => {
    request++
    sub?.dispose()
    nav?.off()
    offKeys()
    el.remove()
  }

  function close() {
    if (closed) return
    closed = true
    playSfx('select')
    dispose()
    later(onClose)
  }

  root.append(el)
  void load()
  return { el, dispose, dim: 0.5 }
}

/** What the results screen says about the ranking, by what became of the run. */
const outcomeLine = (o: RankOutcome) => {
  const m = t().ranking
  if (o.kind !== 'ranked') return h('span', {}, m[o.kind])
  const places = BOARD_PERIODS.flatMap((p) => {
    const rank = o.ranks[p]
    return rank === null ? [] : [h('span', { class: 'rank-place' }, h('b', {}, `#${rank}`), ` ${m.place[p]}`)]
  })
  return places.length > 0 ? h('span', { class: 'rank-places' }, ...places) : h('span', {}, m.noHandle)
}

/** A challenge run's line: its place on the day's board, or that it was practice. */
const challengeLine = (o: RankOutcome) => {
  const m = t().ranking
  const place = o.kind === 'ranked' ? o.challenge : null
  if (!place) return null
  if (place.official) return place.rank === null ? h('span', {}, m.challengeSent) : rich(m.challengePlace(formatDay(place.day), place.rank, place.total), { class: 'rank-challenge-place' })
  return h('span', {}, place.rank === null ? m.challengePractice : m.challengePracticePlace(place.rank, place.total))
}

/**
 * The results screen's ranking line: the player's position today, this week
 * and all time on the run's difficulty (and mode: a legend's run is on the Legend boards) once the API answers, or why the run
 * isn't there (guest, offline, no profile yet). A challenge run adds its
 * place on the day's challenge board (or that it was practice, or local
 * practice for a guest). Null without a ranking.
 */
export const rankPanel = (outcome: Promise<RankOutcome> | null, challenge = false, mode: RunMode = 'standard') => {
  const m = t().ranking
  const line = h('span', {}, outcome ? m.sending : m.guest)
  const extra = h('span', { class: 'rank-panel-challenge' }, challenge && !outcome ? m.challengeGuest : '')
  const title = mode === 'legend' ? `${m.title} · ${m.modes.legend}` : m.title
  const el = h('div', { class: 'rank-panel' }, h('b', { class: 'rank-panel-title' }, title), line, challenge && extra)
  void outcome?.then((o) => {
    line.replaceChildren(outcomeLine(o))
    if (challenge) extra.replaceChildren(challengeLine(o) ?? '')
  })
  return el
}
