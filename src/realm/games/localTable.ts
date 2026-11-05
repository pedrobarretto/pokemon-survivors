import { TABLE, type TableGame, type TableMatch, type TableView } from '../../net/realmTables'
import type { TableSource } from './frame'

/** How long the bot thinks before its move (ms): long enough to read the board. */
const BOT_THINK_MS = 700

/** A seed from a number, mixed (the rules' randomness comes only from seeds). */
const mix = (n: number) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  return Math.imul(x, 0xc2b2ae35) >>> 0
}

/**
 * A table on this device: the player in seat 0 against the game's bot in
 * the others, through the same rules the relay runs (`TableGame`). The
 * player's avatar id is `you` (seat 0), the bots' are negative. A match
 * starts at once; after it, `ready` starts the next (the bot is always
 * ready). Its clock is the frame's `now` (ms), so it needs no timers.
 */
export const localTable = (id: string, gameId: string, game: TableGame, you: number, seed: number): TableSource => {
  const seats = Array.from({ length: game.seats }, (_, i) => (i === 0 ? you : -i))
  let round = 0
  let match: TableMatch = game.start(mix(seed))
  let waitingSince = 0
  let botAt: number | null = null
  let now = 0
  const view = (): TableView => {
    const result = match.result()
    const pending = match.pending()
    return {
      id,
      game: gameId,
      seats,
      phase: result ? 'over' : 'playing',
      view: match.view(0),
      pending,
      leftMs: pending.length > 0 ? Math.max(0, TABLE.turnMs - (now - waitingSince)) : null,
      result,
      ready: result ? seats.slice(1) : [],
    }
  }
  let current: TableView | null = null
  const refresh = () => {
    current = view()
  }
  return {
    vs: 'bot',
    table: () => current,
    seat: () => 0,
    play: (move) => {
      if (match.play(0, move)) {
        waitingSince = now
        refresh()
      }
    },
    ready: () => {
      if (!match.result()) return
      round++
      match = game.start(mix(seed + round))
      waitingSince = now
      refresh()
    },
    frame: (at) => {
      if (now === 0) waitingSince = at
      now = at
      const pending = match.pending()
      const bot = pending.find((s) => s !== 0)
      if (bot === undefined) botAt = null
      else if (botAt === null) botAt = now + BOT_THINK_MS
      else if (now >= botAt) {
        botAt = null
        if (match.play(bot, match.bot(bot, mix(seed + round * 997 + Math.floor(now))))) waitingSince = now
      }
      if (pending.includes(0) && now - waitingSince > TABLE.turnMs) match.forfeit(0)
      refresh()
    },
    leave: () => {},
  }
}
