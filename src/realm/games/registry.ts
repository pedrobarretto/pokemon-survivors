import { hasBoard, isSoloGame, type MinigameId, type SoloGameId, type TableGameId } from '../../data/minigames'
import { playSfx } from '../../engine/audio'
import { t } from '../../i18n'
import { h } from '../../ui/dom'
import type { Screen } from '../../ui/screens'
import { openSoloGame, openTableGame, type FrameOpts, type SoloGame, type TableSource, type TableUi } from './frame'
import { openGameBoard } from './board'
import { localTable } from './localTable'
import { TABLE_GAMES } from './tables'

/**
 * Where each mini game's screen lives, loaded on first use so the realm's
 * bundle doesn't carry every game. A new game is a line here (and its entry
 * in `data/minigames.ts`).
 */
const SOLO: Record<SoloGameId, () => Promise<SoloGame>> = {
  fishing: () => import('./fishing').then((m) => m.fishing),
  berryCatch: () => import('./berryCatch').then((m) => m.berryCatch),
  whackDiglett: () => import('./whackDiglett').then((m) => m.whackDiglett),
  claw: () => import('./claw').then((m) => m.claw),
  dig: () => import('./dig').then((m) => m.dig),
}

const TABLES: Record<TableGameId, () => Promise<TableUi>> = {
  fourInRow: () => import('./fourInRow').then((m) => m.fourInRow),
  typeDuel: () => import('./typeDuel').then((m) => m.typeDuel),
}

/**
 * How a table game gets its table: the realm relay's (sat at by id, with
 * others) when the realm hands one in (made once the game is known, as a
 * cabinet's sheet may ask which), else a match against the bot here.
 */
export type TableOpen = { id: string; source: ((game: TableGameId) => TableSource) | null }

export type OpenGameOpts = FrameOpts & {
  /** For a table game: the table (null: a match against the bot on a table of its own). */
  table: TableOpen | null
  /** The player's avatar id (the local table seats it), 0 outside the realm. */
  you: number
}

/** Opens a game's screen (its module loads first); resolves to the screen. */
export const openGame = async (root: HTMLElement, game: MinigameId, opts: OpenGameOpts): Promise<Screen> => {
  if (isSoloGame(game)) return openSoloGame(root, game, await SOLO[game](), opts)
  const table = opts.table
  const source = table?.source?.(game) ?? localTable(table?.id ?? 'solo', game, TABLE_GAMES[game], opts.you, Date.now())
  return openTableGame(root, game, await TABLES[game](), source, opts)
}

/**
 * Opens one of `games`: at once when it's one, else a small sheet asking
 * which (a cabinet's games), each with its Placar beside it. Returns the
 * screen (the sheet, then the game).
 */
export const chooseGame = (root: HTMLElement, games: readonly MinigameId[], opts: OpenGameOpts): Screen => {
  let current: Screen | null = null
  let gone = false
  const open = (game: MinigameId) => {
    current?.dispose()
    current = null
    playSfx('select')
    void openGame(root, game, opts).then((s) => {
      if (gone) s.dispose()
      else current = s
    })
  }
  if (games.length === 1) {
    open(games[0]!)
    return { el: h('div'), dispose: () => ((gone = true), current?.dispose()) }
  }
  const m = t().minigames
  const close = () => {
    if (gone) return
    gone = true
    sheet.remove()
    current?.dispose()
    opts.close()
  }
  const sheet = h(
    'div',
    { class: 'screen minigame-choose' },
    h(
      'div',
      { class: 'minigame-sheet box' },
      h('h3', {}, m.choose),
      ...games.map((g) =>
        h(
          'div',
          { class: 'minigame-choice' },
          h('button', { class: 'box', type: 'button', onclick: () => (sheet.remove(), open(g)) }, h('strong', {}, m.games[g].name), h('span', {}, m.games[g].blurb)),
          hasBoard(g) && h('button', { class: 'box minigame-choice-board', type: 'button', onclick: () => (playSfx('select'), openGameBoard(root, games.filter(hasBoard), { game: g, close: () => {} })) }, m.board.open),
        ),
      ),
      h('button', { class: 'box', type: 'button', onclick: close }, m.close),
    ),
  )
  root.append(sheet)
  return { el: sheet, dispose: close }
}
