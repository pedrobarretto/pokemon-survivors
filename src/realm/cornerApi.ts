import { spendFromSave, stageGifts } from '../account'
import { apiCall } from '../api'
import { CORNER_PRIZES, prizeOnce, ROCKET_FRAME, ROCKET_TITLE, type CornerPrizeId } from '../data/rocketCorner'
import { parseGift, type Gift, type GiftContent } from '../game/gifts'
import { isRecord } from '../game/parse'
import type { CornerBought, CornerRedeemed, CornerSpun, CornerState, CornerSweep, CornerSwept } from '../net/realmApi'
import { realmFaked, type Failure } from './api'
import {
  CORNER, canBuy, cappedWin, clampLevel, cleared, dealBoard, nextLevel, potOf, spinCost, spinStops, spinWins, sweepPay, sweepView, type Bet, type Hint, type SweepLevel, type Tile,
} from './games/corner.rules'

/**
 * The Rocket Game Corner's calls (`net/realmApi.ts` lists the routes). Fail
 * soft and parse every answer, like `realm/api.ts`. Under `ps.realm('fake')`
 * they answer from an in-memory corner that runs the same rules the API does.
 */

type FakeCorner = {
  tokens: number
  bought: number
  won: number
  spins: number
  rounds: number
  level: SweepLevel
  board: { id: string; level: SweepLevel; tiles: Tile[]; flipped: number[] } | null
  taken: CornerPrizeId[]
  n: number
}

const fake: FakeCorner = { tokens: 1200, bought: 0, won: 0, spins: 0, rounds: 0, level: 1, board: null, taken: [], n: 0 }

/** Dev (`ps.corner('tokens', n)`): sets the faked tokens; returns the faked corner. */
export const stageCorner = (tokens?: number, level?: number) => {
  if (tokens !== undefined) fake.tokens = Math.max(0, Math.floor(tokens))
  if (level !== undefined) fake.level = clampLevel(level)
  return { ...fake }
}

const failed = (status: number, body: unknown): Failure => ({ status, error: isRecord(body) && typeof body.error === 'string' ? body.error : 'offline' })

const count = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null)

const isTile = (v: unknown): v is Tile => v === 0 || v === 1 || v === 2 || v === 3

const parseHint = (v: unknown): Hint | null => {
  if (!isRecord(v)) return null
  const coins = count(v.coins)
  const koffing = count(v.koffing)
  return coins !== null && koffing !== null ? { coins, koffing } : null
}

const parseSweep = (v: unknown): CornerSweep | null => {
  if (!isRecord(v) || typeof v.id !== 'string' || !isRecord(v.hints) || !Array.isArray(v.hints.rows) || !Array.isArray(v.hints.cols) || !Array.isArray(v.flipped)) return null
  const rows = v.hints.rows.map(parseHint)
  const cols = v.hints.cols.map(parseHint)
  const flipped = v.flipped.flatMap((f) => (isRecord(f) && count(f.at) !== null && isTile(f.tile) ? [{ at: f.at as number, tile: f.tile }] : []))
  const level = count(v.level)
  const pot = count(v.pot)
  const over = v.over === 'clear' || v.over === 'koffing' || v.over === 'bank' ? v.over : null
  if (rows.some((h) => !h) || cols.some((h) => !h) || level === null || pot === null || flipped.length !== v.flipped.length) return null
  return { id: v.id, level: clampLevel(level), hints: { rows: rows as Hint[], cols: cols as Hint[] }, flipped, pot, over }
}

const parseState = (v: unknown): CornerState | null => {
  if (!isRecord(v)) return null
  const tokens = count(v.tokens)
  const bought = count(v.bought)
  const won = count(v.won)
  const spins = count(v.spins)
  const rounds = count(v.rounds)
  const level = count(v.level)
  const sweep = v.sweep === null || v.sweep === undefined ? null : parseSweep(v.sweep)
  if (tokens === null || bought === null || won === null || spins === null || rounds === null || level === null || (v.sweep && !sweep)) return null
  const taken = Array.isArray(v.taken) ? v.taken.filter((p): p is string => typeof p === 'string') : []
  return { tokens, bought, won, spins, rounds, level, sweep, taken }
}

const parseSpun = (v: unknown): CornerSpun | null => {
  if (!isRecord(v) || !Array.isArray(v.stops) || v.stops.length !== 3) return null
  const stops = v.stops.map(count)
  const paid = count(v.paid)
  const tokens = count(v.tokens)
  const won = count(v.won)
  const spins = count(v.spins)
  if (stops.some((s) => s === null) || paid === null || tokens === null || won === null || spins === null) return null
  return { stops: stops as [number, number, number], paid, tokens, won, spins }
}

const parseSwept = (v: unknown): CornerSwept | null => {
  if (!isRecord(v)) return null
  const sweep = parseSweep(v.sweep)
  const paid = count(v.paid)
  const tokens = count(v.tokens)
  const won = count(v.won)
  const rounds = count(v.rounds)
  const level = count(v.level)
  return sweep && paid !== null && tokens !== null && won !== null && rounds !== null && level !== null ? { sweep, paid, tokens, won, rounds, level } : null
}

/* ---------------- The fake corner ---------------- */

const fakeState = (): CornerState => ({
  tokens: fake.tokens,
  bought: fake.bought,
  won: fake.won,
  spins: fake.spins,
  rounds: fake.rounds,
  level: fake.level,
  sweep: fake.board ? { id: fake.board.id, ...sweepView(fake.board.level, fake.board.tiles, fake.board.flipped, null) } : null,
  taken: [...fake.taken],
})

const fakeSwept = (sweep: CornerSweep, paid: number): CornerSwept => ({ sweep, paid, tokens: fake.tokens, won: fake.won, rounds: fake.rounds, level: fake.level })

/** Ends the fake board as the API would. */
const fakeFinish = (outcome: 'clear' | 'koffing' | 'bank'): CornerSwept => {
  const b = fake.board!
  const pay = outcome === 'koffing' ? 0 : cappedWin(sweepPay(potOf(b.tiles, b.flipped), b.level, outcome === 'clear'), fake.won)
  fake.tokens += pay
  fake.won += pay
  fake.level = nextLevel(b.level, outcome, b.flipped.length)
  fake.board = null
  return fakeSwept({ id: b.id, ...sweepView(b.level, b.tiles, b.flipped, outcome) }, pay)
}

/* ---------------- The calls ---------------- */

/** The corner as this account sees it. */
export const fetchCorner = async (): Promise<CornerState | Failure> => {
  if (realmFaked()) return fakeState()
  const { status, body } = await apiCall('/realm/corner', { auth: true })
  return (status === 200 ? parseState(body) : null) ?? failed(status, body)
}

/** Buys a pack of tokens for ₽ (`spendFromSave`: synced first, the save that comes back kept). */
export const buyTokens = async (pack: number): Promise<CornerBought | Failure> => {
  const p = CORNER.packs[pack]
  if (!p) return { status: 400, error: 'pack' }
  if (realmFaked()) {
    if (!canBuy(pack, fake.bought)) return { status: 403, error: 'cap' }
    fake.tokens += p.tokens
    fake.bought += p.tokens
    return { tokens: fake.tokens, bought: fake.bought }
  }
  const done = await spendFromSave('/realm/corner/buy', { pack }, p.price)
  if (!done.ok) return { status: 0, error: done.error }
  const tokens = count(done.body.tokens)
  const bought = count(done.body.bought)
  return tokens !== null && bought !== null ? { tokens, bought } : failed(0, null)
}

/** A spin: the API rolls the reels (faked, the same rules here with the page's dice). */
export const spinSlots = async (bet: Bet): Promise<CornerSpun | Failure> => {
  if (realmFaked()) {
    if (fake.spins >= CORNER.spinsDaily) return { status: 403, error: 'cap' }
    if (fake.tokens < spinCost(bet)) return { status: 403, error: 'tokens' }
    const stops = spinStops(Math.random)
    const paid = cappedWin(spinWins(stops, bet).reduce((a, w) => a + w.tokens, 0), fake.won)
    fake.tokens += paid - spinCost(bet)
    fake.won += paid
    fake.spins += 1
    return { stops, paid, tokens: fake.tokens, won: fake.won, spins: fake.spins }
  }
  const { status, body } = await apiCall('/realm/corner/spin', { method: 'POST', body: { bet, nonce: crypto.randomUUID() }, auth: true })
  return (status === 200 ? parseSpun(body) : null) ?? failed(status, body)
}

/** Deals a Koffing Sweep board (or gets the open one back). */
export const dealSweep = async (): Promise<CornerSwept | Failure> => {
  if (realmFaked()) {
    if (!fake.board) {
      if (fake.rounds >= CORNER.roundsDaily) return { status: 403, error: 'cap' }
      fake.rounds += 1
      fake.n += 1
      fake.board = { id: `fake-sweep-${fake.n}`, level: fake.level, tiles: dealBoard(fake.level, Math.random), flipped: [] }
    }
    const b = fake.board
    return fakeSwept({ id: b.id, ...sweepView(b.level, b.tiles, b.flipped, null) }, 0)
  }
  const { status, body } = await apiCall('/realm/corner/sweep/start', { method: 'POST', body: {}, auth: true })
  return (status === 200 ? parseSwept(body) : null) ?? failed(status, body)
}

/** Flips a tile of the board. */
export const flipTile = async (id: string, at: number): Promise<CornerSwept | Failure> => {
  if (realmFaked()) {
    const b = fake.board
    if (!b || b.id !== id) return { status: 404, error: 'missing' }
    if (!b.flipped.includes(at)) b.flipped.push(at)
    if (b.tiles[at] === 0) return fakeFinish('koffing')
    if (cleared(b.tiles, b.flipped)) return fakeFinish('clear')
    return fakeSwept({ id: b.id, ...sweepView(b.level, b.tiles, b.flipped, null) }, 0)
  }
  const { status, body } = await apiCall('/realm/corner/sweep/flip', { method: 'POST', body: { id, at }, auth: true })
  return (status === 200 ? parseSwept(body) : null) ?? failed(status, body)
}

/** Banks the board's pot. */
export const bankSweep = async (id: string): Promise<CornerSwept | Failure> => {
  if (realmFaked()) return fake.board?.id === id ? fakeFinish('bank') : { status: 404, error: 'missing' }
  const { status, body } = await apiCall('/realm/corner/sweep/bank', { method: 'POST', body: { id }, auth: true })
  return (status === 200 ? parseSwept(body) : null) ?? failed(status, body)
}

const fakeContent = (prize: CornerPrizeId): GiftContent => {
  const def = CORNER_PRIZES[prize]
  switch (def.kind) {
    case 'family': return { kind: 'family', family: def.family }
    case 'shadow': return { kind: 'shadow', family: def.family }
    case 'bag': return { kind: 'bag', item: def.item, count: def.count }
    case 'title': return { kind: 'title', title: ROCKET_TITLE }
    case 'frame': return { kind: 'style', style: { slot: 'frame', id: ROCKET_FRAME } }
  }
}

/** Trades tokens for a prize; its gift goes into the inbox at once (opened from the lobby's gift box, like any). */
export const redeemPrize = async (prize: CornerPrizeId): Promise<CornerRedeemed | Failure> => {
  if (realmFaked()) {
    const def = CORNER_PRIZES[prize]
    if (prizeOnce(prize) && fake.taken.includes(prize)) return { status: 403, error: 'owned' }
    if (fake.tokens < def.price) return { status: 403, error: 'tokens' }
    fake.tokens -= def.price
    fake.taken.push(prize)
    fake.n += 1
    const gift: Gift = { id: `dev-corner-${fake.n}-${prize}`, content: fakeContent(prize), reason: { kind: 'rocket' } }
    stageGifts([gift])
    return { tokens: fake.tokens, gift }
  }
  const { status, body } = await apiCall('/realm/corner/redeem', { method: 'POST', body: { prize }, auth: true })
  if (status !== 200 || !isRecord(body)) return failed(status, body)
  const tokens = count(body.tokens)
  const gift = body.gift === null ? null : parseGift(body.gift)
  if (tokens === null) return failed(status, body)
  if (gift) stageGifts([gift])
  return { tokens, gift }
}
