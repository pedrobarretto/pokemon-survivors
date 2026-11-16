import { BOARD_SIZE, type Board, type BoardEntry } from '../../src/game/ranking'

/** A whole ranked board: every player's line in order, and whose each is (`users[i]` holds `entries[i]`). */
export type RankedBoard = { entries: readonly BoardEntry[]; users: readonly string[] }

/**
 * A board as the API answers it, cut from the whole ranked one: the top, the
 * viewer's own line and how many it holds. With `follows` (who the viewer
 * follows), only the viewer and them, ranked among themselves, as the
 * friends boards rank them in SQL.
 */
export const boardFrom = (ranked: RankedBoard, viewer: string | null, follows: ReadonlySet<string> | null = null): Board => {
  const all = ranked.entries.map((e, i) => ({ e, user: ranked.users[i]! }))
  const lines = follows === null ? all : all.filter((l) => l.user === viewer || follows.has(l.user)).map((l, i) => ({ ...l, e: { ...l.e, rank: i + 1 } }))
  const mine = viewer === null ? undefined : lines.find((l) => l.user === viewer)
  return { entries: lines.slice(0, BOARD_SIZE).map((l) => l.e), me: mine?.e ?? null, total: lines.length }
}

/** How long a frozen board is served before it's read again (a run an admin took off, a ban or a new handle shows by then). */
const FRESH_MS = 10 * 60_000

/** Boards kept at most (the oldest kept goes first): the Era 1 boards of every mode and difficulty, and the Pokémon ones asked lately. */
const KEPT = 96

/**
 * A cache for boards that no longer take runs (Era 1's: every run started
 * before Temporada 1), so a whole ranking is read once per `FRESH_MS` instead
 * of on every visit. Once stale, a board keeps being served while one read
 * refreshes it in the background; only the first visit after a boot waits.
 * A failed read is forgotten, so the next visit tries again.
 */
export const frozenBoards = <Q>(keyOf: (query: Q) => string, read: (query: Q) => Promise<RankedBoard>, now = Date.now) => {
  const kept = new Map<string, { at: number; board: Promise<RankedBoard> }>()

  const keep = (key: string, board: Promise<RankedBoard>) => {
    kept.delete(key)
    kept.set(key, { at: now(), board })
    if (kept.size > KEPT) kept.delete(kept.keys().next().value!)
  }

  return (query: Q): Promise<RankedBoard> => {
    const key = keyOf(query)
    const hit = kept.get(key)
    if (hit && now() - hit.at < FRESH_MS) return hit.board
    const fresh = read(query)
    if (hit) {
      // Serve the stale board; one refresh at a time.
      hit.at = now()
      fresh.then(() => keep(key, fresh), () => {})
      return hit.board
    }
    keep(key, fresh)
    fresh.catch(() => kept.get(key)?.board === fresh && kept.delete(key))
    return fresh
  }
}
