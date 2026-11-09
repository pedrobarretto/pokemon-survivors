import type { TransactionSql } from 'postgres'
import { COMPANY_PAY, type MinigameId } from '../../src/data/minigames'
import { hourPay } from '../../src/data/realmEvents'
import { STAMP_MILESTONES, isDeed, type Deed, type StampId } from '../../src/data/realmStamps'
import type { DayKey } from '../../src/game/day'
import type { GiftContent } from '../../src/game/gifts'
import { isRecord } from '../../src/game/parse'
import type { RealmBook } from '../../src/net/realmApi'
import { DEEDS_MAX } from '../../src/net/realmRelay'
import { ERRANDS_BONUS, drawErrands, type Errand } from '../../src/realm/errands'
import type { Walking } from '../../src/realm/friends'
import { milestonesReached, newStamps, type DeedCounts } from '../../src/realm/stamps'
import type { Sql } from './db'
import { sendGift } from './gifts'

/**
 * The Poké Realm's Estampas and Recados on the API (`data/realmStamps.ts`,
 * `realm/stamps.ts`, `realm/errands.ts`). Everything an account does arrives
 * here as deeds, from the relay's reports or from the API's own routes, and
 * `applyDeeds` is the one way in: it counts them, moves the day's errands,
 * grants the stamps and milestones they reach, all behind the account's row
 * lock, so one account's deeds take turns and the same deed in parallel can't
 * grant anything twice.
 */

type Q = Sql | TransactionSql

/** A deed entry as the API trusts it (`parseDeedsReport`): one more of a known deed for an account. */
export type DeedEntry = { userId: string; deed: Deed }

/** What a batch of deeds earned an account. */
export type Earned = { stamps: StampId[]; errands: string[] }

export const NOTHING: Earned = { stamps: [], errands: [] }

const USER_ID_LEN = 128

/** `POST /realm/deeds`'s body, or null when it's malformed or too long; deeds this API doesn't know are dropped. */
export const parseDeedsReport = (v: unknown): DeedEntry[] | null => {
  if (!isRecord(v) || !Array.isArray(v.deeds) || v.deeds.length > DEEDS_MAX) return null
  return v.deeds.flatMap((d: unknown) => (isRecord(d) && typeof d.userId === 'string' && d.userId.length > 0 && d.userId.length <= USER_ID_LEN && isDeed(d.deed) ? [{ userId: d.userId, deed: d.deed }] : []))
}

/** The entries per account, each deed counted. */
export const groupDeeds = (entries: readonly DeedEntry[]): Map<string, Map<Deed, number>> => {
  const out = new Map<string, Map<Deed, number>>()
  for (const { userId, deed } of entries) {
    const mine = out.get(userId) ?? new Map<Deed, number>()
    mine.set(deed, (mine.get(deed) ?? 0) + 1)
    out.set(userId, mine)
  }
  return out
}

/** `POST /realm/errands/claim`'s body, or null. */
export const parseErrandClaim = (v: unknown): { id: string } | null => (isRecord(v) && typeof v.id === 'string' && v.id.length > 0 && v.id.length <= 64 ? { id: v.id } : null)

/**
 * The day's errands after `deeds`: each one's progress (`after`, never past
 * its target), the ids finished just now, and whether this batch finished the
 * whole day's list (true only on the batch that does: progress never goes
 * back, so it's once a day).
 */
export const errandsAfter = (errands: readonly Errand[], before: readonly number[], deeds: ReadonlyMap<Deed, number>) => {
  const after = errands.map((e, i) => Math.max(before[i]!, Math.min(e.target, before[i]! + (deeds.get(e.deed) ?? 0))))
  const allDone = (progress: readonly number[]) => errands.every((e, i) => progress[i]! >= e.target)
  return { after, finished: errands.filter((e, i) => before[i]! < e.target && after[i]! >= e.target).map((e) => e.id), all: !allDone(before) && allDone(after) }
}

/** Whether the trainer walking as `handle` has someone else in its room, by the relays' latest word. */
export const hasCompany = (where: ReadonlyMap<string, Walking>, handle: string): boolean => {
  const me = handle.toLowerCase()
  const here = where.get(me)
  if (!here?.room) return false
  return [...where].some(([h, w]) => h !== me && w.city === here.city && w.room === here.room)
}

/** What a mini game pays before the daily caps: its price, more with company (`COMPANY_PAY`) and during its Hora do Realm (`hourPay`). */
export const claimPay = (coins: number, game: MinigameId, company: boolean, now: number): number => Math.floor(coins * (company ? COMPANY_PAY : 1) * hourPay(game, now))

/** What a milestone gives as a gift, its id being `key`; null for furniture. */
const milestoneGift = (reward: (typeof STAMP_MILESTONES)[number]['reward']): GiftContent | null => {
  if (reward.kind === 'title') return { kind: 'title', title: reward.id }
  return reward.kind === 'frame' ? { kind: 'style', style: { slot: 'frame', id: reward.id } } : null
}

/** Pays one milestone, once: the ledger row decides, then the furniture (source `game`) or the gift (id `realmStamps:<at>`). */
const payMilestone = async (tx: TransactionSql, userId: string, m: (typeof STAMP_MILESTONES)[number]) => {
  const [landed] = await tx`insert into realm_stamp_milestones (user_id, at) values (${userId}, ${m.at}) on conflict do nothing returning at`
  if (!landed) return
  const gift = milestoneGift(m.reward)
  if (gift) await sendGift(tx, userId, gift, null, `realmStamps:${m.at}`)
  else await tx`insert into furniture_owned (user_id, furniture, source, count) values (${userId}, ${m.reward.id}, 'game', 1) on conflict (user_id, furniture, source) do nothing`
  console.log(`realm: ${userId} reached ${m.at} stamps (${m.reward.kind} ${m.reward.id})`)
}

/**
 * Applies `deeds` to `userId` inside a transaction, behind its row lock: the
 * day's errands first (finishing the list is a deed of its own), then the
 * counts, then the stamps they reach and the milestones those reach. What it
 * earned; nothing for an account that doesn't exist (a dev relay's guest).
 */
export const applyDeeds = async (tx: TransactionSql, userId: string, deeds: ReadonlyMap<Deed, number>, day: DayKey): Promise<Earned> => {
  const [user] = await tx`select id from users where id = ${userId} for update`
  if (!user) return NOTHING

  const errands = drawErrands(day)
  const rows = await tx<{ errand: string; progress: number }[]>`select errand, progress from realm_errand_days where user_id = ${userId} and day = ${day}::date`
  const before = errands.map((e) => rows.find((r) => r.errand === e.id)?.progress ?? 0)
  const { after, finished, all } = errandsAfter(errands, before, deeds)
  for (const [i, e] of errands.entries()) {
    if (after[i] === before[i]) continue
    await tx`
      insert into realm_errand_days (user_id, day, errand, progress) values (${userId}, ${day}::date, ${e.id}, ${after[i]!})
      on conflict (user_id, day, errand) do update set progress = excluded.progress`
  }

  const counted = all ? new Map(deeds).set('errands:all', (deeds.get('errands:all') ?? 0) + 1) : deeds
  await tx`
    insert into realm_deeds (user_id, deed, count)
    select ${userId}, d, n from unnest(${[...counted.keys()]}::text[], ${[...counted.values()]}::int[]) as t(d, n)
    on conflict (user_id, deed) do update set count = realm_deeds.count + excluded.count`

  const counts: DeedCounts = Object.fromEntries((await tx<{ deed: string; count: number }[]>`select deed, count from realm_deeds where user_id = ${userId}`).flatMap((r) => (isDeed(r.deed) ? [[r.deed, r.count] as const] : [])))
  const owned = new Set((await tx<{ stamp: string }[]>`select stamp from realm_stamps where user_id = ${userId}`).map((r) => r.stamp))
  const fresh = newStamps(counts, owned)
  if (fresh.length > 0) await tx`insert into realm_stamps (user_id, stamp) select ${userId}, unnest(${fresh}::text[]) on conflict do nothing`

  const due = milestonesReached(owned.size + fresh.length)
  if (due.length > 0) {
    const paid = new Set((await tx<{ at: number }[]>`select at from realm_stamp_milestones where user_id = ${userId}`).map((r) => r.at))
    for (const m of due) if (!paid.has(m.at)) await payMilestone(tx, userId, m)
  }
  return { stamps: fresh, errands: finished }
}

/** `GET /realm/book`: the account's Estampas, its deed counts, the milestones paid and the Brasília `day`'s Recados. */
export const bookOf = async (q: Q, userId: string, day: DayKey): Promise<RealmBook> => {
  const stamps = await q<{ stamp: string; at: Date }[]>`select stamp, at from realm_stamps where user_id = ${userId} order by at, stamp`
  const counts = await q<{ deed: string; count: number }[]>`select deed, count from realm_deeds where user_id = ${userId}`
  const milestones = await q<{ at: number }[]>`select at from realm_stamp_milestones where user_id = ${userId} order by at`
  const rows = await q<{ errand: string; progress: number; claimed_at: Date | null }[]>`select errand, progress, claimed_at from realm_errand_days where user_id = ${userId} and day = ${day}::date`
  return {
    stamps: stamps.map((s) => ({ id: s.stamp, at: s.at.getTime() })),
    counts: Object.fromEntries(counts.map((c) => [c.deed, c.count])),
    milestones: milestones.map((m) => m.at),
    errands: drawErrands(day).map(({ id, deed, target, reward }) => {
      const row = rows.find((r) => r.errand === id)
      return { id, deed, target, reward, progress: row?.progress ?? 0, claimed: Boolean(row?.claimed_at) }
    }),
    day,
  }
}

export type ErrandOutcome = { ok: true; coins: number; book: RealmBook } | { ok: false; error: 'unfinished' | 'claimed' }

/**
 * Collects a finished errand of the Brasília `day` (the caller holds the
 * account's row lock): its reward, and `ERRANDS_BONUS` with the last of the
 * three. An id that isn't one of the day's reads as unfinished (a screen left
 * open past midnight). The ₽ goes to the wallet on the device, like a run's.
 */
export const collectErrand = async (tx: TransactionSql, userId: string, id: string, day: DayKey): Promise<ErrandOutcome> => {
  const errands = drawErrands(day)
  const errand = errands.find((e) => e.id === id)
  if (!errand) return { ok: false, error: 'unfinished' }
  const rows = await tx<{ errand: string; progress: number; claimed_at: Date | null }[]>`select errand, progress, claimed_at from realm_errand_days where user_id = ${userId} and day = ${day}::date`
  const row = rows.find((r) => r.errand === id)
  if (row?.claimed_at) return { ok: false, error: 'claimed' }
  if (!row || row.progress < errand.target) return { ok: false, error: 'unfinished' }
  await tx`update realm_errand_days set claimed_at = now() where user_id = ${userId} and day = ${day}::date and errand = ${id}`
  const last = errands.every((e) => e.id === id || rows.some((r) => r.errand === e.id && r.claimed_at))
  return { ok: true, coins: errand.reward + (last ? ERRANDS_BONUS : 0), book: await bookOf(tx, userId, day) }
}
