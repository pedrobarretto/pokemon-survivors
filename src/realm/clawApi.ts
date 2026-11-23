import { spendFromSave } from '../account'
import { apiCall } from '../api'
import { PLUSH_POOL, isPlushFamily, plushPiece, type PlushFamily } from '../data/plushes'
import { brasiliaDay, weekStart } from '../game/day'
import { isRecord } from '../game/parse'
import type { ClawDropped, ClawInserted, ClawPlay, ClawState } from '../net/realmApi'
import { addFakePiece, fakeGameDeeds, realmFaked, type Failure } from './api'
import { clawDeeds } from './gameDeeds'
import { CLAW, creditPrice, pitLayout, resolveDrop, weeklyPrizes, type PitPoint } from './games/claw.rules'

/**
 * The Máquina de Pelúcias' calls (`net/realmApi.ts` lists the routes). Fail
 * soft and parse every answer, like `realm/api.ts`. Under `ps.realm('fake')`
 * they answer from an in-memory machine that runs the same rules the API does.
 */

type FakeClaw = { used: number; misses: Map<PlushFamily, number>; open: ClawPlay | null; plays: number }

const fake: FakeClaw = { used: 0, misses: new Map(), open: null, plays: 0 }

const thisWeek = () => weekStart(brasiliaDay(new Date()))

const prizesOf = (week: string) => weeklyPrizes(week, PLUSH_POOL)

const fakeMisses = (prizes: readonly PlushFamily[]) => prizes.map((f) => fake.misses.get(f) ?? 0)

/** Dev (`ps.claw`): sets the faked misses on the week's plush at `index` (one short of sure without `misses`) and the credits used today. */
export const stageClaw = (index = 0, misses: number = CLAW.guarantee - 1, used?: number) => {
  const prizes = prizesOf(thisWeek())
  const family = prizes[index]
  if (family) fake.misses.set(family, misses)
  if (used !== undefined) fake.used = used
  return { prizes, misses: fakeMisses(prizes), used: fake.used }
}

const count = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null)

const failed = (status: number, body: unknown): Failure => ({ status, error: isRecord(body) && typeof body.error === 'string' ? body.error : 'offline' })

const parsePlay = (v: unknown): ClawPlay | null =>
  isRecord(v) && typeof v.id === 'string' && typeof v.week === 'string' && typeof v.seed === 'number' && Number.isSafeInteger(v.seed) ? { id: v.id, week: v.week, seed: v.seed } : null

const parseState = (v: unknown): ClawState | null => {
  if (!isRecord(v) || typeof v.week !== 'string' || !Array.isArray(v.prizes) || !Array.isArray(v.misses) || !v.prizes.every(isPlushFamily)) return null
  const misses = v.misses.map(count)
  const used = count(v.used)
  if (used === null || misses.length !== v.prizes.length || misses.some((m) => m === null)) return null
  const open = v.open === null ? null : parsePlay(v.open)
  return v.open !== null && !open ? null : { week: v.week, prizes: v.prizes, misses: misses.filter((m) => m !== null), used, open }
}

const parseInserted = (v: unknown): ClawInserted | null => {
  if (!isRecord(v)) return null
  const play = parsePlay(v.play)
  const used = count(v.used)
  return play && used !== null ? { play, used } : null
}

const parseDropped = (v: unknown): ClawDropped | null => {
  if (!isRecord(v) || !isPlushFamily(v.family) || typeof v.won !== 'boolean' || typeof v.grip !== 'number' || !Array.isArray(v.misses)) return null
  const target = count(v.target)
  const misses = v.misses.map(count)
  if (target === null || misses.some((m) => m === null)) return null
  return { target, grip: v.grip, won: v.won, family: v.family, misses: misses.filter((m) => m !== null) }
}

/** The machine as this account sees it. */
export const fetchClaw = async (): Promise<ClawState | Failure> => {
  if (realmFaked()) {
    const week = fake.open?.week ?? thisWeek()
    const prizes = prizesOf(week)
    return { week, prizes, misses: fakeMisses(prizes), used: fake.used, open: fake.open }
  }
  const { status, body } = await apiCall('/realm/claw', { auth: true })
  return (status === 200 ? parseState(body) : null) ?? failed(status, body)
}

/**
 * Puts a credit in. A free one is a plain call; a paid one spends from the
 * stored save (`spendFromSave`: synced first, the save that comes back kept).
 * `used`: the credits this device knows of today, which pick the way.
 */
export const insertCredit = async (used: number): Promise<ClawInserted | Failure> => {
  const price = creditPrice(used)
  if (price === null) return { status: 403, error: 'cap' }
  if (realmFaked()) {
    fake.used += 1
    fake.plays += 1
    fake.open = fake.open ?? { id: `fake-${fake.plays}`, seed: 1000 + fake.plays * 37, week: thisWeek() }
    return { play: fake.open, used: fake.used }
  }
  if (price > 0) {
    const done = await spendFromSave('/realm/claw/insert', {}, price)
    return done.ok ? (parseInserted(done.body) ?? failed(0, null)) : { status: 0, error: done.error }
  }
  const { status, body } = await apiCall('/realm/claw/insert', { method: 'POST', body: {}, auth: true })
  return (status === 200 ? parseInserted(body) : null) ?? failed(status, body)
}

/** Drops the claw at `at`: the API's decision (faked, the same rules here). */
export const dropClaw = async (play: ClawPlay, at: PitPoint): Promise<ClawDropped | Failure> => {
  if (realmFaked()) {
    const prizes = prizesOf(play.week)
    const misses = fakeMisses(prizes)
    const { target, grip, won } = resolveDrop(at, pitLayout(play.week, misses, play.seed), misses)
    const family = prizes[target]!
    fake.misses.set(family, won ? 0 : (misses[target] ?? 0) + 1)
    fake.open = null
    if (won) addFakePiece(plushPiece(family))
    fakeGameDeeds(clawDeeds(won, misses[target] ?? 0))
    return { target, grip, won, family, misses: fakeMisses(prizes) }
  }
  const { status, body } = await apiCall('/realm/claw/drop', { method: 'POST', body: { id: play.id, x: at.x, y: at.y }, auth: true })
  return (status === 200 ? parseDropped(body) : null) ?? failed(status, body)
}
