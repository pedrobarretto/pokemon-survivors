import { accountState, accountsEnabled, API_URL } from './account'
import { apiCall } from './api'
import { parseBoard, parseHistory, parseHistoryEntry, parseProfile, pushHistory } from './arena/history'
import { fakeBoard, fakeHistory, fakeProfile, type FakeScenario } from './arena/fakes'
import type { ArenaHistoryEntry, ArenaLeaderboardRow, ArenaProfile, ArenaResult } from './game/arenaRank'

/**
 * The Arena's ranking through the API (`server/`): the signed-in player's
 * standing (`GET /arena/me`), their history (`GET /arena/history`), a
 * season's board (`GET /arena/leaderboard`), and a quick match against bots
 * reported as practice (`POST /arena/practice`). Like `ranking.ts`, nothing
 * here blocks the game: every read fails soft (null) and the screens say the
 * ranking is out of reach. The device keeps its own history of quick
 * matches too (`ps:arenaHistory`), so guests have one.
 *
 * `ps.arena('fake')` makes every read answer made-up data (`arena/fakes.ts`)
 * and the hub act as signed in, for screenshots; `ps.arena('fake', s)`
 * stages a Fair Play and protection scenario (`FakeScenario`).
 */

/** Boards read from the API; a profile and history need an account too. */
export const arenaApiEnabled = Boolean(API_URL)

let faked = false
let scenario: FakeScenario = 'fine'

/** Dev: every read answers fake data (on, in `as`'s Fair Play and protection), or the API again (off). */
export const fakeArena = (on: boolean, as: FakeScenario = scenario) => {
  faked = on
  scenario = as
}

export const arenaFaked = () => faked

/** Whether the hub reads this player's own standing: signed in (or faking it). */
export const arenaSignedIn = () => faked || (accountsEnabled && accountState().kind === 'signedIn')

/** `GET /arena/me`: null for a guest, offline, or an API that doesn't serve it. */
export const fetchArenaMe = async (): Promise<ArenaProfile | null> => {
  if (faked) return fakeProfile(scenario)
  if (!arenaSignedIn()) return null
  const res = await apiCall('/arena/me', { auth: true })
  return res.status === 200 ? parseProfile(res.body) : null
}

/** One page of this player's history, newest first, older than `before` (ms); null when it can't be read. */
export const fetchArenaHistory = async (before: number | null = null, limit = 20): Promise<ArenaHistoryEntry[] | null> => {
  if (faked) return fakeHistory().filter((e) => before === null || e.at < before).slice(0, limit)
  if (!arenaSignedIn()) return null
  const res = await apiCall(`/arena/history?limit=${limit}${before === null ? '' : `&before=${before}`}`, { auth: true })
  return res.status === 200 ? parseHistory(res.body) : null
}

/** Season `season`'s board, best first; null when it can't be read. */
export const fetchArenaBoard = async (season: number, limit = 50): Promise<ArenaLeaderboardRow[] | null> => {
  if (faked) return fakeBoard()
  if (!arenaApiEnabled) return null
  const res = await apiCall(`/arena/leaderboard?season=${season}&limit=${limit}`)
  return res.status === 200 ? parseBoard(res.body) : null
}

/** Reports a quick match against bots as practice (signed in only; never rated). True when the API took it. */
export const postPractice = async (result: ArenaResult, slot: number) => {
  if (faked || !arenaSignedIn()) return false
  const res = await apiCall('/arena/practice', { method: 'POST', body: { result, slot }, auth: true })
  return res.status >= 200 && res.status < 300
}

/* ---------------- The device's history ---------------- */

const HISTORY_KEY = 'ps:arenaHistory'

/** The matches this device kept (its quick matches against bots), newest first. */
export const deviceArenaHistory = (): ArenaHistoryEntry[] => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.flatMap((e) => parseHistoryEntry(e) ?? []) : []
  } catch {
    return []
  }
}

/** Keeps a match in the device's history (the last 30). */
export const keepArenaMatch = (entry: ArenaHistoryEntry) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(pushHistory(deviceArenaHistory(), entry)))
  } catch {
    // Storage blocked: the match isn't remembered.
  }
}

/* ---------------- RP after a ranked match ---------------- */

/** What a rated match did: the RP it moved, whether the protection meter took its loss, and where the player stands now. */
export type RpChange = { rp: number; protected: boolean; profile: ArenaProfile | null }

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

/**
 * The RP a ranked match that ended at `endedAt` (ms) moved, once the API has
 * rated it (the relay reports the match a moment after its end): asks the
 * history a few times, backing off. Null when it never shows up.
 */
export const awaitRpChange = async (endedAt: number): Promise<RpChange | null> => {
  if (faked) {
    await wait(1600)
    // A full meter (`ps.arena('fake', 'full')`) shows a protected loss.
    return scenario === 'full' ? { rp: 0, protected: true, profile: fakeProfile('fine') } : { rp: 27, protected: false, profile: fakeProfile(scenario) }
  }
  for (const ms of [2500, 3500, 5000, 8000, 12000]) {
    await wait(ms)
    const recent = await fetchArenaHistory(null, 5)
    const rated = recent?.find((e) => e.kind === 'ranked' && e.rp !== null && e.at >= endedAt - 2 * 60_000)
    if (rated) return { rp: rated.rp ?? 0, protected: rated.protected, profile: await fetchArenaMe() }
  }
  return null
}
