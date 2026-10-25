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
import { fetchBoard, fetchChallengeBoard, type BoardFilter, type RankOutcome } from '../ranking'
import { formatDay, t } from '../i18n'
import { BAG_ITEMS, parseBagItems } from '../game/bag'
import { flagIcon } from '../render/art'
import { jackIcon } from '../render/halloweenArt'
import { today } from './save'
import { h, later, rich } from './dom'
import { profileScreen, runForm, runPortrait, supporterBadge } from './profile'
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
    h('span', { class: 'rank-who' }, h('b', {}, e.name, supporterBadge(e.supporter, e.supporterSince)), h('small', {}, `@${e.handle}`, me && ` · ${t().ranking.you}`)),
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

/** A board tab: a difficulty's boards, or the Desafio do dia's. */
type Tab = Difficulty | 'challenge'

const TABS: readonly Tab[] = [...DIFFICULTY_IDS, 'challenge']

const CHALLENGE_DAYS = ['today', 'yesterday'] as const

type ChallengeDay = (typeof CHALLENGE_DAYS)[number]

/** The Brasília day a challenge tab shows (on the missions' clock, like the challenge screen). */
const challengeDay = (d: ChallengeDay): DayKey => {
  const now = brasiliaDay(today())
  return d === 'today' ? now : previousDay(now)
}

/**
 * The boards: one per difficulty, each by day, week and all time, every player
 * once with their best run, for the regular runs or the Legend mode's (a
 * mode toggle, M), and the Desafio do dia's, today's and yesterday's,
 * every player once with their official attempt. Filters by Pokémon (not the
 * challenge's: it's one Pokémon) and by friends (who the player follows, plus
 * them). The player's own line stays in sight below the top when they're
 * further down. A row opens that trainer's profile over the board; signed
 * in, the flag beside someone else's row reports that run (`reportDialog`).
 *
 * Keys: ↑/↓ rows and buttons, ←/→ period (or day), Q/E board, M mode, F friends, Enter
 * opens, Esc goes back. `onClose` runs after the key dispatch.
 * `challenge` opens on the challenge's tab, `mode` on that mode's boards.
 */
export const rankingScreen = (root: HTMLElement, input: Input, onClose: () => void, opts: { difficulty?: Difficulty; mode?: RunMode; challenge?: boolean } = {}): Screen => {
  const signedIn = () => accountState().kind === 'signedIn'
  const filter: BoardFilter = { mode: opts.mode ?? 'standard', difficulty: opts.difficulty ?? 'normal', period: 'day', starter: null, friends: false }
  let tab: Tab = opts.challenge ? 'challenge' : filter.difficulty
  let day: ChallengeDay = 'today'
  /** Players on the challenge board shown. */
  let total = 0
  const el = h('div', { class: 'screen dim rank-screen' })
  let nav: ReturnType<typeof menu> | null = null
  /** A profile open over the board. */
  let sub: Screen | null = null
  /** The board on screen: loading, unreachable, or the answer. */
  let board: Board | 'loading' | 'offline' = 'loading'
  let request = 0
  let closed = false
  let opening = true

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

  const render = () => {
    const m = t().ranking
    const button = (label: string, selected: boolean, onclick: () => void) => h('button', { class: selected ? 'region-tab rank-tab selected' : 'region-tab rank-tab', onclick }, label)
    const onChallenge = tab === 'challenge'
    const boards = TABS.map((d) => button(d === 'challenge' ? m.challengeTab : t().difficulty.names[d], d === tab, () => setTab(d)))
    const periods = onChallenge
      ? CHALLENGE_DAYS.map((d) => button(m.days[d], d === day, () => setDay(d)))
      : BOARD_PERIODS.map((p) => button(m.periods[p], p === filter.period, () => set({ period: p })))
    const scope = [button(m.everyone, !filter.friends, () => set({ friends: false })), button(m.friends, filter.friends, () => set({ friends: true }))]
    const modes = RUN_MODES.map((mode) => button(m.modes[mode], mode === filter.mode, () => setMode(mode)))
    const shown = onChallenge ? dailyChallenge(challengeDay(day)) : null

    const rows: { el: HTMLElement; handle: string }[] = []
    const status = (text: string, cls = '') => h('p', { class: `rank-status ${cls}` }, text)
    let list: Node[]
    if (filter.friends && !signedIn()) list = [status(m.friendsGuest)]
    else if (board === 'loading') list = [status(m.loading, 'blink')]
    else if (board === 'offline') list = [status(m.offline)]
    else {
      const mine = board.me
      const report = signedIn() ? openReport : null
      const top = board.entries.map((e) => {
        const me = e.handle === mine?.handle || e.handle === myHandle()
        const row = entryRow(e, me)
        return { el: row, line: entryLine(row, e, me ? null : report), handle: e.handle }
      })
      const below = mine && !board.entries.some((e) => e.handle === mine.handle) ? [{ el: entryRow(mine, true), handle: mine.handle }] : []
      rows.push(...top, ...below)
      list =
        rows.length === 0
          ? [status(filter.friends ? m.emptyFriends : onChallenge ? m.challengeEmpty : m.empty)]
          : [...top.map((r) => r.line), ...(below.length > 0 ? [h('div', { class: 'rank-gap', 'aria-hidden': 'true' }, '⋮'), below[0]!.el] : [])]
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
    const buttons = [...rows.map((r) => r.el), ...footer]
    // Keep the cursor on the player's own row, else the top, across reloads.
    const meAt = rows.findIndex((r) => r.handle === handle)
    nav?.off()
    nav = menu(input, buttons, (i) => (playSfx('select'), later(actions[i]!)), { initial: Math.max(0, meAt) })

    el.replaceChildren(
      h(
        'div',
        { class: opening ? 'dialog box pop rank' : 'dialog box rank' },
        h('div', { class: 'dialog-title' }, m.title),
        h('div', { class: 'region-tabs rank-tabs', role: 'tablist' }, ...boards),
        !onChallenge && h('div', { class: 'region-tabs rank-tabs rank-modes', role: 'tablist' }, ...modes),
        h(
          'div',
          { class: 'rank-filters' },
          h('div', { class: 'region-tabs rank-tabs', role: 'tablist' }, ...periods),
          h('div', { class: 'region-tabs rank-tabs', role: 'tablist' }, ...scope),
          !onChallenge && pokemonSelect(filter.mode, filter.starter, (starter) => set({ starter })),
        ),
        shown &&
          h(
            'p',
            { class: 'rank-challenge' },
            h('img', { src: runPortrait({ starter: shown.starter, stage: 0 }), alt: '' }),
            m.challengeHead(formatDay(shown.day), PLAYABLE[shown.starter].name, t().difficulty.names[shown.difficulty], total),
          ),
        h('div', { class: 'rank-list' }, ...list),
        onChallenge ? h('p', { class: 'rank-resets' }, m.challengeResets) : filter.period !== 'all' && h('p', { class: 'rank-resets' }, m.resets),
        h('div', { class: 'buttons' }, ...footer),
        hint(onChallenge ? m.challengeHint : m.hintKeys, m.hintTouch),
      ),
    )
    opening = false
    buttons[nav.index]?.scrollIntoView({ block: 'nearest' })
  }

  const load = async () => {
    const id = ++request
    board = 'loading'
    render()
    if (filter.friends && !signedIn()) return
    const challenge = tab === 'challenge' ? await fetchChallengeBoard(challengeDay(day), filter.friends) : null
    const next = tab === 'challenge' ? challenge : await fetchBoard(filter)
    if (id !== request || closed) return
    board = next ?? 'offline'
    total = challenge?.total ?? 0
    render()
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

  /** The regular boards or the Legend mode's; a Pokémon filter of the other side goes. */
  const setMode = (mode: RunMode) => set({ mode, starter: filter.starter && runMode(filter.starter) === mode ? filter.starter : null })

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
    if (key === 'KeyM' && tab !== 'challenge') return setMode(filter.mode === 'legend' ? 'standard' : 'legend')
    // `menu` moved the cursor: keep it in view in the scrolling list.
    if (nav) el.querySelectorAll('.rank-row, .buttons .btn')[nav.index]?.scrollIntoView({ block: 'nearest' })
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
