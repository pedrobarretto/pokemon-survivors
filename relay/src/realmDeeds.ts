import { REALM_ROOMS, type Spot } from '../../src/data/realmMap'
import { REALM_EVENTS, hourAt } from '../../src/data/realmEvents'
import { CROWD, DEED_COOLDOWN_MS, type Deed } from '../../src/data/realmStamps'
import type { RoomKey } from '../../src/net/realm'
import { DEEDS_EVERY_MS, DEEDS_MAX, type DeedsReport } from '../../src/net/realmRelay'
import type { City, Trainer } from './realm'

/**
 * What the realm relay sees trainers do (`data/realmStamps.ts`), pure like
 * `realm.ts`. A deed is noted as it happens (`noteDeed`, from `realm.ts` and
 * `realmTables.ts`) or found on a scan of who stands where (`watchDeeds`), and
 * goes out in the next report (`takeReport`). A report that fails is dropped,
 * never sent again: the API counts each entry once more, and the next time the
 * trainer does it counts anyway. Nothing here can stop a trainer walking.
 */

/** A minute in a room with someone is one `company`. */
const COMPANY_MS = 60_000

export type DeedLog = {
  /** `<user> <deed>` → when it may be noted again. Forgotten once past (`takeReport`), so a reconnect doesn't reset it. */
  until: Map<string, number>
  queue: { userId: string; deed: Deed }[]
  /** When the next report is due, and the ask out for one, if any (one at a time). */
  at: number
  ask: number | null
}

export const createDeedLog = (now: number): DeedLog => ({ until: new Map(), queue: [], at: now + DEEDS_EVERY_MS, ask: null })

/** Notes a deed of an account, at most once per `DEED_COOLDOWN_MS` (or until `until`, for one that counts per window). */
export const noteDeed = (log: DeedLog, userId: string, deed: Deed, now: number, until = now + DEED_COOLDOWN_MS) => {
  const key = `${userId} ${deed}`
  if ((log.until.get(key) ?? 0) > now || log.queue.length >= DEEDS_MAX) return
  log.until.set(key, until)
  log.queue.push({ userId, deed })
}

const POOL = (REALM_ROOMS.pier.spots as readonly Spot[]).find((s) => s.kind === 'pool')

const inLagoon = (t: Trainer) => t.room === 'pier' && POOL !== undefined && Math.hypot(POOL.at.x - t.x, POOL.at.y - t.y) <= POOL.reach

/** 3:00 to 3:59 in Brasília (UTC-3 all year), 06:00 UTC. */
const owlHour = (now: number) => new Date(now).getUTCHours() === 6

/**
 * The deeds that come from standing somewhere: company (a minute in the same
 * room with someone, `t.company` holding since when), a crowd, a twin, the
 * lagoon, the small hours, and being in the room of a Hora do Realm (once a
 * window: `event` at 25 means 25 hours, not one long stay).
 */
export const watchDeeds = (cities: Iterable<City>, log: DeedLog, now: number) => {
  const hour = hourAt(now)
  const owl = owlHour(now)
  for (const city of cities) {
    const rooms = new Map<RoomKey, Trainer[]>()
    for (const t of city.trainers.values()) rooms.set(t.room, [...(rooms.get(t.room) ?? []), t])
    for (const [room, here] of rooms) {
      for (const t of here) {
        const note = (deed: Deed, until?: number) => noteDeed(log, t.identity.userId, deed, now, until)
        if (here.length < 2) t.company = null
        else if (t.company === null) t.company = now
        else if (now - t.company >= COMPANY_MS) {
          t.company = now
          note('company')
        }
        if (here.length >= CROWD) note('crowd')
        if (here.some((o) => o !== t && o.identity.partner === t.identity.partner)) note('twin')
        if (inLagoon(t)) note('lagoon')
        if (owl) note('owl')
        if (hour && room === REALM_EVENTS[hour.kind].room) {
          note(`event:${hour.kind}`, hour.end)
          note('event', hour.end)
        }
      }
    }
  }
}

/**
 * The report due now, or null: none while one is out, and none with nothing to
 * say and nobody walking (with someone walking an empty one still goes: the
 * answer brings what the API saw on its own, `DeedsAnswer`).
 */
export const takeReport = (log: DeedLog, anyone: boolean, ask: number, now: number): DeedsReport | null => {
  for (const [key, until] of log.until) if (until <= now) log.until.delete(key)
  if (log.ask !== null || (log.queue.length === 0 && !anyone)) return null
  log.ask = ask
  return { deeds: log.queue.splice(0) }
}
