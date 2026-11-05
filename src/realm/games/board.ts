import { MINIGAMES, type MinigameId } from '../../data/minigames'
import { playSfx } from '../../engine/audio'
import { addDays } from '../../game/day'
import { LOCALES, locale, t } from '../../i18n'
import { h } from '../../ui/dom'
import type { Screen } from '../../ui/screens'
import { fetchGameBoard } from '../api'
import { GAME_BOARD_PERIODS, type GameBoard, type GameBoardEntry, type GameBoardPeriod } from '../boards'

/**
 * The mini games' Placar (`realm/boards.ts`): a sheet over whatever is on
 * screen (the realm, a game's frame, its end sheet) with a tab per game when
 * it shows more than one (a cabinet's, the arcade's prizes counter), Hoje
 * and Semana, the top three on a podium, the rest of the top 20 and the
 * player's own line highlighted (under the list when it's further down).
 * While it's open it takes the keys, so Esc closes it and not the game
 * behind.
 */

/** Which game and period it opens on, a line under the tabs (`note`: the prizes counter's word) and what closing does. */
export type BoardOpts = { game?: MinigameId; period?: GameBoardPeriod; note?: string; close: () => void }

/** A line's score as the board says it: points for a solo game, wins at a table. */
const scoreText = (game: MinigameId, score: number) => (MINIGAMES[game].kind === 'solo' ? t().minigames.board.points(score) : t().minigames.board.wins(score))

/** A period's dates, as the sheet's caption says them (the week from its Monday to its Sunday). */
const periodCaption = (board: GameBoard) => {
  const b = t().minigames.board
  if (board.period === 'day') return b.dayCaption
  // The keys are calendar days: format them at noon UTC so no time zone moves them.
  const f = new Intl.DateTimeFormat(LOCALES[locale()].tag, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const at = (day: string) => f.format(new Date(`${day}T12:00:00Z`))
  return b.weekCaption(at(board.start), at(addDays(board.start, 6)))
}

const podium = (board: GameBoard, me: string | null) => {
  // Second, first, third: the leader stands in the middle, highest.
  const order = [1, 0, 2].flatMap((i) => (board.entries[i] ? [board.entries[i]] : []))
  return h(
    'ol',
    { class: 'mgb-podium' },
    ...order.map((e) =>
      h(
        'li',
        { class: `mgb-step mgb-step-${e.rank}${e.handle === me ? ' mgb-me' : ''}` },
        h('span', { class: 'mgb-medal', 'aria-label': `#${e.rank}` }, e.rank),
        h('b', { class: 'mgb-handle' }, `@${e.handle}`),
        h('span', { class: 'mgb-score' }, scoreText(board.game, e.score)),
      ),
    ),
  )
}

const line = (game: MinigameId, e: GameBoardEntry, me: boolean, below = false) =>
  h('li', { class: `mgb-line${me ? ' mgb-me' : ''}${below ? ' mgb-below' : ''}` }, h('span', { class: 'mgb-rank' }, e.rank), h('span', { class: 'mgb-handle' }, `@${e.handle}`), h('b', { class: 'mgb-score' }, scoreText(game, e.score)))

/** The board's body: the podium, the rest of the top and the player's own line when it's below. */
const boardBody = (board: GameBoard) => {
  const b = t().minigames.board
  const me = board.me?.handle ?? null
  if (board.entries.length === 0) return [h('p', { class: 'mgb-empty' }, b.empty)]
  const rest = board.entries.slice(3)
  const below = board.me && board.me.rank > board.entries.length ? board.me : null
  return [
    podium(board, me),
    h(
      'ol',
      { class: 'mgb-list' },
      ...rest.map((e) => line(board.game, e, e.handle === me)),
      ...(below ? [h('li', { class: 'mgb-gap', 'aria-hidden': 'true' }, '⋯'), line(board.game, below, true, true)] : []),
    ),
  ]
}

/** Opens the Placar of `games` (on `opts.game`, else the first) over `root`. */
export const openGameBoard = (root: HTMLElement, games: readonly MinigameId[], opts: BoardOpts): Screen => {
  const b = t().minigames.board
  let game = opts.game && games.includes(opts.game) ? opts.game : games[0]!
  let period: GameBoardPeriod = opts.period ?? 'day'
  /** Which load is the latest, so a slow answer for a tab left behind never lands. */
  let asked = 0
  let gone = false

  const gameTabs = h('div', { class: 'mgb-tabs mgb-games', role: 'tablist' })
  const periodTabs = h('div', { class: 'mgb-tabs', role: 'tablist' })
  const caption = h('p', { class: 'mgb-caption' })
  const note = h('p', { class: 'mgb-note' })
  const body = h('div', { class: 'mgb-body' })

  const tab = (label: string, on: boolean, pick: () => void) =>
    h('button', { class: on ? 'mgb-tab box on' : 'mgb-tab box', type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false', onclick: () => (playSfx('select'), pick()) }, label)

  const render = () => {
    // One game: its name, no tabs.
    gameTabs.replaceChildren(
      ...(games.length > 1 ? games.map((g) => tab(t().minigames.games[g].name, g === game, () => ((game = g), load()))) : [h('strong', { class: 'mgb-game' }, t().minigames.games[game].name)]),
    )
    periodTabs.replaceChildren(...GAME_BOARD_PERIODS.map((p) => tab(b.periods[p], p === period, () => ((period = p), load()))))
  }

  const load = async () => {
    const n = ++asked
    render()
    caption.textContent = ''
    body.replaceChildren(h('p', { class: 'mgb-empty' }, b.loading))
    const board = await fetchGameBoard(game, period)
    if (gone || n !== asked) return
    if (!board) return void body.replaceChildren(h('p', { class: 'mgb-empty' }, b.offline))
    caption.textContent = board.total > 0 ? `${periodCaption(board)} · ${b.total(board.total)}` : periodCaption(board)
    // A table counts only wins against people: say so, the bot's matches pay but don't rank.
    const said = [opts.note, MINIGAMES[game].kind === 'table' ? b.tableNote : undefined].filter((x) => x !== undefined).join(' ')
    note.textContent = said
    note.classList.toggle('hidden', said === '')
    body.replaceChildren(...boardBody(board))
  }

  const close = () => {
    if (gone) return
    gone = true
    window.removeEventListener('keydown', onKey, true)
    el.remove()
    opts.close()
  }
  // Captured on the window, before the game's frame or the realm see it: the keys are the sheet's while it's open.
  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation()
    if (e.code === 'Escape') {
      e.preventDefault()
      close()
    }
  }
  window.addEventListener('keydown', onKey, true)

  const el = h(
    'div',
    { class: 'screen mgb-screen', onclick: (e: Event) => e.target === e.currentTarget && close() },
    h(
      'div',
      { class: 'mgb-sheet box', role: 'dialog', 'aria-label': b.title },
      h('header', { class: 'mgb-head' }, h('h3', {}, b.title), h('button', { class: 'mgb-close box', type: 'button', 'aria-label': t().minigames.close, onclick: close }, '×')),
      h('div', { class: 'mgb-bar' }, gameTabs, periodTabs),
      caption,
      note,
      body,
    ),
  )
  root.append(el)
  void load()
  return { el, dispose: close }
}
