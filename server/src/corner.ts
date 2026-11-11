import { randomInt } from 'node:crypto'
import type { TransactionSql } from 'postgres'
import { CORNER_PRIZES, isCornerPrize, prizeOnce, ROCKET_FRAME, ROCKET_TITLE, type CornerPrizeId } from '../../src/data/rocketCorner'
import { brasiliaDay, type DayKey } from '../../src/game/day'
import { donateFrom } from '../../src/game/festival'
import type { Gift, GiftContent } from '../../src/game/gifts'
import { parseSaveData, type Save } from '../../src/game/meta'
import { isRecord } from '../../src/game/parse'
import type { CornerBought, CornerRedeemed, CornerSpun, CornerState, CornerSweep, CornerSwept } from '../../src/net/realmApi'
import {
  CORNER, canBuy, cappedWin, clampLevel, cleared, dealBoard, isBet, nextLevel, potOf, spinCost, spinStops, spinWins, sweepPay, sweepView,
  type Bet, type SweepLevel, type Tile,
} from '../../src/realm/games/corner.rules'
import type { Sql } from './db'
import { sendGift } from './gifts'
import { rateLimiter } from './rateLimit'

/**
 * The Rocket Game Corner's API side: the server holds the tokens and rolls
 * everything. Tokens come in only for ₽ out of the stored save (like the
 * claw's credits, moved to `spent` so a merge never refunds them), spins are
 * rolled here from the OS's generator, Koffing Sweep boards are dealt and kept
 * here (a client learns a tile only when it flips it), and prizes go out as
 * gifts. Every count resets on a new Brasília day (`corner_wallets.day`).
 */

type Q = Sql | TransactionSql

/** Enough for a quick hand at the slots, not a script's. */
const LIMIT = { n: 90, ms: 60_000 } as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const roll = () => randomInt(0, 2 ** 32) / 2 ** 32

/** `POST /realm/corner/buy`'s body: the pack and the save revision it spends from. */
export const parseCornerBuy = (v: unknown): { pack: number; base: number } | null =>
  isRecord(v) && typeof v.pack === 'number' && Number.isSafeInteger(v.pack) && typeof v.base === 'number' && Number.isSafeInteger(v.base) ? { pack: v.pack, base: v.base } : null

/** `POST /realm/corner/spin`'s body: the bet and the client's nonce for the spin (a retry sends it again). */
export const parseCornerSpin = (v: unknown): { bet: Bet; nonce: string } | null =>
  isRecord(v) && isBet(v.bet) && typeof v.nonce === 'string' && UUID.test(v.nonce) ? { bet: v.bet, nonce: v.nonce } : null

/** `POST /realm/corner/sweep/flip`'s body: the board and the tile (0..24). */
export const parseCornerFlip = (v: unknown): { id: string; at: number } | null =>
  isRecord(v) && typeof v.id === 'string' && UUID.test(v.id) && typeof v.at === 'number' && Number.isSafeInteger(v.at) && v.at >= 0 && v.at < 25 ? { id: v.id, at: v.at } : null

/** `POST /realm/corner/sweep/bank`'s body. */
export const parseCornerBank = (v: unknown): { id: string } | null => (isRecord(v) && typeof v.id === 'string' && UUID.test(v.id) ? { id: v.id } : null)

/** `POST /realm/corner/redeem`'s body. */
export const parseCornerRedeem = (v: unknown): { prize: CornerPrizeId } | null => (isRecord(v) && isCornerPrize(v.prize) ? { prize: v.prize } : null)

type WalletRow = { tokens: number; day: Date | string; bought: number; won: number; spins: number; rounds: number; level: number; last_nonce: string | null; last_spin: unknown }

type SweepRow = { id: string; level: number; board: Tile[]; flipped: number[]; outcome: 'clear' | 'koffing' | 'bank' | null; paid: number }

/** A `date` column as a day key, whichever way the driver brought it. */
const dayOf = (v: Date | string): DayKey => (typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10)) as DayKey

/** The wallet's counts as of `day`: yesterday's spins and buys don't count today. */
const fresh = (w: WalletRow, day: DayKey): WalletRow => (dayOf(w.day) === day ? w : { ...w, day, bought: 0, won: 0, spins: 0, rounds: 0 })

const viewOf = (row: SweepRow): CornerSweep => ({ id: row.id, ...sweepView(clampLevel(row.level), row.board, row.flipped, row.outcome) })

export type CornerRefusal = 'profile' | 'banned' | 'cap' | 'funds' | 'nosave' | 'stale' | 'tokens' | 'owned' | 'missing'

type Out<T> = ({ ok: true } & T) | { ok: false; error: CornerRefusal }

export const cornerStore = (sql: Sql, deps: { closed: (q: Q, userId: string) => Promise<boolean>; now?: () => Date; dice?: () => number }) => {
  const now = deps.now ?? (() => new Date())
  const dice = deps.dice ?? roll
  const limit = rateLimiter(LIMIT.n, LIMIT.ms)
  const today = () => brasiliaDay(now())

  /** Who may play now: a @handle and no ban. Locks the account, so its calls take turns. */
  const gate = async (tx: TransactionSql, userId: string): Promise<'profile' | 'banned' | null> => {
    const [user] = await tx<{ handle: string | null }[]>`select handle from users where id = ${userId} for update`
    if (!user?.handle) return 'profile'
    return (await deps.closed(tx, userId)) ? 'banned' : null
  }

  /** The account's wallet (made on first use), its counts as of today. */
  const walletOf = async (q: Q, userId: string): Promise<WalletRow> => {
    await q`insert into corner_wallets (user_id, day) values (${userId}, ${today()}::date) on conflict (user_id) do nothing`
    const [w] = await q<WalletRow[]>`select tokens, day, bought, won, spins, rounds, level, last_nonce, last_spin from corner_wallets where user_id = ${userId}`
    return fresh(w!, today())
  }

  const saveWallet = (q: Q, userId: string, w: WalletRow) =>
    q`update corner_wallets set tokens = ${w.tokens}, day = ${dayOf(w.day)}::date, bought = ${w.bought}, won = ${w.won}, spins = ${w.spins}, rounds = ${w.rounds}, level = ${w.level},
      last_nonce = ${w.last_nonce}, last_spin = ${w.last_spin === null ? null : q.json(w.last_spin as CornerSpun)} where user_id = ${userId}`

  const openSweep = async (q: Q, userId: string) => (await q<SweepRow[]>`select id, level, board, flipped, outcome, paid from corner_sweeps where user_id = ${userId} and finished_at is null`)[0] ?? null

  const takenOf = async (q: Q, userId: string) => (await q<{ prize: string }[]>`select distinct prize from corner_redemptions where user_id = ${userId}`).map((r) => r.prize)

  /** Ends a board: pays it (under the day's cap) and moves the level. */
  const finish = async (tx: TransactionSql, userId: string, w: WalletRow, row: SweepRow, outcome: 'clear' | 'koffing' | 'bank') => {
    const level = clampLevel(row.level)
    const pay = outcome === 'koffing' ? 0 : cappedWin(sweepPay(potOf(row.board, row.flipped), level, outcome === 'clear'), w.won)
    const next: WalletRow = { ...w, tokens: w.tokens + pay, won: w.won + pay, level: nextLevel(level, outcome, row.flipped.length) }
    await saveWallet(tx, userId, next)
    const [done] = await tx<SweepRow[]>`
      update corner_sweeps set flipped = ${tx.json(row.flipped)}, outcome = ${outcome}, paid = ${pay}, finished_at = now()
      where id = ${row.id}::uuid returning id, level, board, flipped, outcome, paid`
    return { sweep: viewOf(done!), paid: pay, wallet: next }
  }

  const swept = (r: { sweep: CornerSweep; paid: number; wallet: WalletRow }): CornerSwept => ({ sweep: r.sweep, paid: r.paid, tokens: r.wallet.tokens, won: r.wallet.won, rounds: r.wallet.rounds, level: r.wallet.level })

  return {
    /** Counts a call against the account's limit; false past it (a script's, never a player's). */
    take: (userId: string) => limit.take([userId], now().getTime()),

    /** `GET /realm/corner`: null without a @handle. */
    state: async (userId: string): Promise<CornerState | null> => {
      const [user] = await sql<{ handle: string | null }[]>`select handle from users where id = ${userId}`
      if (!user?.handle) return null
      const w = await walletOf(sql, userId)
      const open = await openSweep(sql, userId)
      return { tokens: w.tokens, bought: w.bought, won: w.won, spins: w.spins, rounds: w.rounds, level: w.level, sweep: open ? viewOf(open) : null, taken: await takenOf(sql, userId) }
    },

    /** `POST /realm/corner/buy`: a pack of tokens for ₽ out of the stored save at revision `base`, under the day's cap. */
    buy: (userId: string, pack: number, base: number): Promise<Out<CornerBought & { paid: { save: Save; revision: number } }>> =>
      sql.begin(async (tx) => {
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const w = await walletOf(tx, userId)
        const p = CORNER.packs[pack]
        if (!p || !canBuy(pack, w.bought)) return { ok: false, error: 'cap' }
        const [row] = await tx<{ data: unknown; revision: number }[]>`select data, revision from saves where user_id = ${userId} for update`
        if (!row) return { ok: false, error: 'nosave' }
        if (base !== row.revision) return { ok: false, error: 'stale' }
        const save = parseSaveData(row.data)
        if (save.wallet < p.price) return { ok: false, error: 'funds' }
        const next = donateFrom(save, p.price)
        const revision = row.revision + 1
        await tx`update saves set version = ${next.version}, revision = ${revision}, data = ${tx.json(next)}, updated_at = now() where user_id = ${userId}`
        const after: WalletRow = { ...w, tokens: w.tokens + p.tokens, bought: w.bought + p.tokens }
        await saveWallet(tx, userId, after)
        return { ok: true, tokens: after.tokens, bought: after.bought, paid: { save: next, revision } }
      }),

    /** `POST /realm/corner/spin`: rolls the reels and pays (past the day's cap a spin still spins, for nothing). The same nonce answers the same. */
    spin: (userId: string, bet: Bet, nonce: string): Promise<Out<{ spun: CornerSpun }>> =>
      sql.begin(async (tx) => {
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const w = await walletOf(tx, userId)
        if (w.last_nonce === nonce && isRecord(w.last_spin)) return { ok: true, spun: w.last_spin as CornerSpun }
        if (w.spins >= CORNER.spinsDaily) return { ok: false, error: 'cap' }
        const cost = spinCost(bet)
        if (w.tokens < cost) return { ok: false, error: 'tokens' }
        const stops = spinStops(dice)
        const paid = cappedWin(spinWins(stops, bet).reduce((a, x) => a + x.tokens, 0), w.won)
        const tokens = w.tokens - cost + paid
        const spun: CornerSpun = { stops, paid, tokens, won: w.won + paid, spins: w.spins + 1 }
        await saveWallet(tx, userId, { ...w, tokens, won: spun.won, spins: spun.spins, last_nonce: nonce, last_spin: spun })
        return { ok: true, spun }
      }),

    /** `POST /realm/corner/sweep/start`: deals a board at the account's level (the open one comes back). */
    deal: (userId: string): Promise<Out<{ swept: CornerSwept }>> =>
      sql.begin(async (tx) => {
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const w = await walletOf(tx, userId)
        const open = await openSweep(tx, userId)
        if (open) return { ok: true, swept: swept({ sweep: viewOf(open), paid: 0, wallet: w }) }
        if (w.rounds >= CORNER.roundsDaily) return { ok: false, error: 'cap' }
        const level: SweepLevel = clampLevel(w.level)
        const board = dealBoard(level, dice)
        const [row] = await tx<SweepRow[]>`
          insert into corner_sweeps (user_id, day, level, board) values (${userId}, ${today()}::date, ${level}, ${tx.json(board)})
          returning id, level, board, flipped, outcome, paid`
        const next = { ...w, rounds: w.rounds + 1 }
        await saveWallet(tx, userId, next)
        return { ok: true, swept: swept({ sweep: viewOf(row!), paid: 0, wallet: next }) }
      }),

    /** `POST /realm/corner/sweep/flip`: turns a tile; a Koffing ends the round with nothing, the last 2 or 3 clears it. */
    flip: (userId: string, id: string, at: number): Promise<Out<{ swept: CornerSwept }>> =>
      sql.begin(async (tx) => {
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const w = await walletOf(tx, userId)
        const [row] = await tx<SweepRow[]>`select id, level, board, flipped, outcome, paid from corner_sweeps where id = ${id}::uuid and user_id = ${userId}`
        if (!row) return { ok: false, error: 'missing' }
        if (row.outcome || row.flipped.includes(at)) return { ok: true, swept: swept({ sweep: viewOf(row), paid: row.paid, wallet: w }) }
        const flipped = [...row.flipped, at]
        const tile = row.board[at]
        if (tile === 0) return { ok: true, swept: swept(await finish(tx, userId, w, { ...row, flipped }, 'koffing')) }
        if (cleared(row.board, flipped)) return { ok: true, swept: swept(await finish(tx, userId, w, { ...row, flipped }, 'clear')) }
        const [next] = await tx<SweepRow[]>`update corner_sweeps set flipped = ${tx.json(flipped)} where id = ${row.id}::uuid returning id, level, board, flipped, outcome, paid`
        return { ok: true, swept: swept({ sweep: viewOf(next!), paid: 0, wallet: w }) }
      }),

    /** `POST /realm/corner/sweep/bank`: ends the round, paying the pot. */
    bank: (userId: string, id: string): Promise<Out<{ swept: CornerSwept }>> =>
      sql.begin(async (tx) => {
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const w = await walletOf(tx, userId)
        const [row] = await tx<SweepRow[]>`select id, level, board, flipped, outcome, paid from corner_sweeps where id = ${id}::uuid and user_id = ${userId}`
        if (!row) return { ok: false, error: 'missing' }
        if (row.outcome) return { ok: true, swept: swept({ sweep: viewOf(row), paid: row.paid, wallet: w }) }
        return { ok: true, swept: swept(await finish(tx, userId, w, row, 'bank')) }
      }),

    /** `POST /realm/corner/redeem`: takes the tokens and sends the prize as a gift (a once-only prize, only once). */
    redeem: (userId: string, prize: CornerPrizeId): Promise<Out<CornerRedeemed>> =>
      sql.begin(async (tx) => {
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const w = await walletOf(tx, userId)
        const def = CORNER_PRIZES[prize]
        if (prizeOnce(prize) && (await takenOf(tx, userId)).includes(prize)) return { ok: false, error: 'owned' }
        if (w.tokens < def.price) return { ok: false, error: 'tokens' }
        const content: GiftContent =
          def.kind === 'family' ? { kind: 'family', family: def.family }
          : def.kind === 'shadow' ? { kind: 'shadow', family: def.family }
          : def.kind === 'bag' ? { kind: 'bag', item: def.item, count: def.count }
          : def.kind === 'title' ? { kind: 'title', title: ROCKET_TITLE }
          : { kind: 'style', style: { slot: 'frame', id: ROCKET_FRAME } }
        const [taken] = await tx<{ id: string }[]>`insert into corner_redemptions (user_id, prize, price) values (${userId}, ${prize}, ${def.price}) returning id`
        const key = `corner:${taken!.id}`
        await sendGift(tx, userId, content, { kind: 'rocket' }, key)
        const [g] = await tx<{ id: string }[]>`select id from gifts where user_id = ${userId} and key = ${key}`
        const after = { ...w, tokens: w.tokens - def.price }
        await saveWallet(tx, userId, after)
        console.log(`corner: ${userId} redeemed ${prize}`)
        const gift: Gift | null = g ? { id: g.id, content, reason: { kind: 'rocket' } } : null
        return { ok: true, tokens: after.tokens, gift }
      }),
  }
}

export type CornerStore = ReturnType<typeof cornerStore>
