import { spendFromSave } from '../account'
import { apiCall } from '../api'
import { HATCHLING_IDS, PLAYABLE, type HatchlingId, type PlayableId } from '../data/hatchlings'
import { SAFARI_HABITAT_IDS, SAFARI_ONLY, habitatPool, isSafariHabitat, lackingFamilies, safariEntry, type SafariHabitat } from '../data/safari'
import { brasiliaDay, weekStart } from '../game/day'
import { parseGift, type Gift } from '../game/gifts'
import { isRecord } from '../game/parse'
import type { SafariActed, SafariEncounterView, SafariSession, SafariStarted, SafariState } from '../net/realmApi'
import { loadSave } from '../ui/save'
import { realmFaked, type Failure } from './api'
import { SAFARI, applyAction, encountersLeft, guaranteedEntry, habitatOfWeek, rollQueue, sessionPrice, startRun, type SafariAction, type SafariRun, type SafariTurn } from './games/safari.rules'

/**
 * The Zona Safári's calls (`net/realmApi.ts` lists the routes). Fail soft and
 * parse every answer, like `realm/clawApi.ts`. Under `ps.realm('fake')` they
 * answer from an in-memory Safari that runs the same rules the API does.
 */

type FakeSafari = {
  used: number
  dry: number
  run: SafariRun<HatchlingId> | null
  id: string
  week: string
  habitat: SafariHabitat
  turn: number
  plays: number
  fresh: boolean
  forceCatch: boolean
  forceFlee: boolean
  /** Dev: the habitat instead of the week's, the next encounter's family and whether it's shiny. */
  stagedHabitat: SafariHabitat | null
  stagedNext: HatchlingId | null
  stagedShiny: boolean
}

const thisWeek = () => weekStart(brasiliaDay(new Date()))

const fake: FakeSafari = { used: 0, dry: 0, run: null, id: '', week: '', habitat: SAFARI_HABITAT_IDS[0]!, turn: 0, plays: 0, fresh: false, forceCatch: false, forceFlee: false, stagedHabitat: null, stagedNext: null, stagedShiny: false }

/**
 * Dev (`ps.safari`): the sessions without a new family (`sure`: as many as the
 * guarantee takes), the sessions used today, whether every ball holds, whether
 * whatever it faces flees, the habitat and the next encounter (and if shiny).
 */
export const stageSafari = (opts: { sure?: boolean; dry?: number; used?: number; catches?: boolean; flees?: boolean; habitat?: SafariHabitat | null; next?: HatchlingId | null; shiny?: boolean }) => {
  if (opts.sure) fake.dry = SAFARI.guarantee
  if (opts.dry !== undefined) fake.dry = opts.dry
  if (opts.used !== undefined) fake.used = opts.used
  if (opts.catches !== undefined) fake.forceCatch = opts.catches
  if (opts.flees !== undefined) fake.forceFlee = opts.flees
  if (opts.habitat !== undefined) fake.stagedHabitat = opts.habitat
  if (opts.next !== undefined) fake.stagedNext = opts.next
  if (opts.shiny !== undefined) fake.stagedShiny = opts.shiny
  return { dry: fake.dry, used: fake.used, catches: fake.forceCatch, flees: fake.forceFlee, habitat: fake.stagedHabitat, next: fake.stagedNext, shiny: fake.stagedShiny }
}

/** The habitat a fake session plays. */
const fakeHabitat = (week: string): SafariHabitat => fake.stagedHabitat ?? habitatOfWeek(week, SAFARI_HABITAT_IDS)

const partnerTypes = (partner: PlayableId | null): readonly string[] => (partner ? PLAYABLE[partner].line[0].types : [])

const fakePartner = (): PlayableId | null => {
  const { partner } = loadSave()
  return Object.hasOwn(PLAYABLE, partner) ? partner : null
}

const fakeLacking = () => lackingFamilies(loadSave().hatched, [])

const fakeView = (): SafariSession | null => {
  const run = fake.run
  if (!run) return null
  return {
    id: fake.id,
    week: fake.week,
    habitat: fake.habitat,
    balls: run.balls,
    berries: run.berries,
    left: encountersLeft(run),
    sureNext: run.queue[run.met]?.sure ?? false,
    encounter: run.encounter && { family: run.encounter.family, shiny: run.encounter.shiny, calm: run.encounter.calm, sure: run.encounter.sure },
    catches: [...run.catches],
    over: run.over,
    turn: fake.turn,
  }
}

const failed = (status: number, body: unknown): Failure => ({ status, error: isRecord(body) && typeof body.error === 'string' ? body.error : 'offline' })

const count = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null)

const isHatchling = (v: unknown): v is HatchlingId => typeof v === 'string' && (HATCHLING_IDS as readonly string[]).includes(v)

const isPlayable = (v: unknown): v is PlayableId => typeof v === 'string' && Object.hasOwn(PLAYABLE, v)

const parseEncounter = (v: unknown): SafariEncounterView | null => {
  if (!isRecord(v) || !isHatchling(v.family) || typeof v.shiny !== 'boolean' || typeof v.sure !== 'boolean') return null
  const calm = count(v.calm)
  return calm !== null ? { family: v.family, shiny: v.shiny, calm, sure: v.sure } : null
}

const parseSession = (v: unknown): SafariSession | null => {
  if (!isRecord(v) || typeof v.id !== 'string' || typeof v.week !== 'string' || !isSafariHabitat(v.habitat) || !Array.isArray(v.catches) || typeof v.over !== 'boolean' || typeof v.sureNext !== 'boolean') return null
  const balls = count(v.balls)
  const berries = count(v.berries)
  const turn = count(v.turn)
  const left = count(v.left)
  const encounter = v.encounter === null ? null : parseEncounter(v.encounter)
  if (balls === null || berries === null || turn === null || left === null || (v.encounter !== null && !encounter)) return null
  const catches = v.catches.flatMap((c: unknown) => (isRecord(c) && isHatchling(c.family) && typeof c.shiny === 'boolean' ? [{ family: c.family, shiny: c.shiny }] : []))
  return { id: v.id, week: v.week, habitat: v.habitat, balls, berries, left, sureNext: v.sureNext, encounter, catches, over: v.over, turn }
}

const parseState = (v: unknown): SafariState | null => {
  if (!isRecord(v) || typeof v.week !== 'string' || !isSafariHabitat(v.habitat) || typeof v.sure !== 'boolean') return null
  const used = count(v.used)
  const dry = count(v.dry)
  const open = v.open === null ? null : parseSession(v.open)
  if (used === null || dry === null || (v.open !== null && !open)) return null
  return { week: v.week, habitat: v.habitat, used, dry, sure: v.sure, partner: isPlayable(v.partner) ? v.partner : null, open }
}

const parseStarted = (v: unknown): SafariStarted | null => {
  if (!isRecord(v)) return null
  const session = parseSession(v.session)
  const used = count(v.used)
  return session && used !== null ? { session, used } : null
}

const parseTurn = (v: unknown): SafariTurn<HatchlingId> | null => {
  if (!isRecord(v)) return null
  switch (v.kind) {
    case 'appear':
      return isHatchling(v.family) && typeof v.shiny === 'boolean' && typeof v.sure === 'boolean' ? { kind: 'appear', family: v.family, shiny: v.shiny, sure: v.sure } : null
    case 'ball': {
      const shakes = count(v.shakes)
      return shakes !== null && isHatchling(v.family) && typeof v.shiny === 'boolean' && typeof v.caught === 'boolean' && typeof v.fled === 'boolean' ? { kind: 'ball', family: v.family, shiny: v.shiny, shakes, caught: v.caught, fled: v.fled } : null
    }
    case 'berry': {
      const calm = count(v.calm)
      return calm !== null && typeof v.fled === 'boolean' ? { kind: 'berry', calm, fled: v.fled } : null
    }
    case 'left':
      return { kind: 'left' }
    case 'finished':
      return { kind: 'finished' }
    default:
      return null
  }
}

const parseActed = (v: unknown): SafariActed | null => {
  if (!isRecord(v)) return null
  const turn = parseTurn(v.turn)
  const session = parseSession(v.session)
  const gift: Gift | null = v.gift === null || v.gift === undefined ? null : parseGift(v.gift)
  return turn && session ? { turn, gift, session } : null
}

/** The Safari as this account sees it. */
export const fetchSafari = async (): Promise<SafariState | Failure> => {
  if (realmFaked()) {
    const week = fake.run ? fake.week : thisWeek()
    return { week, habitat: fake.run ? fake.habitat : fakeHabitat(week), used: fake.used, dry: fake.dry, sure: fake.dry >= SAFARI.guarantee && fakeLacking().length > 0, partner: fakePartner(), open: fakeView() }
  }
  const { status, body } = await apiCall('/realm/safari', { auth: true })
  return (status === 200 ? parseState(body) : null) ?? failed(status, body)
}

/**
 * Starts a session. A free one is a plain call; a paid one spends from the
 * stored save (`spendFromSave`: synced first, the save that comes back kept).
 * `used`: the sessions this device knows of today, which pick the way.
 */
export const startSafari = async (used: number): Promise<SafariStarted | Failure> => {
  const price = sessionPrice(used)
  if (price === null) return { status: 403, error: 'cap' }
  if (realmFaked()) {
    if (!fake.run) {
      const week = thisWeek()
      const sure = fake.dry >= SAFARI.guarantee ? guaranteedEntry(fakeLacking(), SAFARI_ONLY, Math.random) : null
      fake.used += 1
      fake.plays += 1
      fake.fresh = false
      fake.turn = 0
      fake.id = `fake-${fake.plays}`
      fake.week = week
      fake.habitat = fakeHabitat(week)
      fake.run = startRun(rollQueue(habitatPool(fake.habitat), partnerTypes(fakePartner()), Math.random, sure))
    }
    return { session: fakeView()!, used: fake.used }
  }
  if (price > 0) {
    const done = await spendFromSave('/realm/safari/start', {}, price)
    return done.ok ? (parseStarted(done.body) ?? failed(0, null)) : { status: 0, error: done.error }
  }
  const { status, body } = await apiCall('/realm/safari/start', { method: 'POST', body: {}, auth: true })
  return (status === 200 ? parseStarted(body) : null) ?? failed(status, body)
}

const devGift = (n: number, family: HatchlingId, shiny: boolean): Gift => ({ id: `dev-safari-${fake.id}-${n}`, content: shiny ? { kind: 'shinyHatch', family } : { kind: 'family', family }, reason: { kind: 'season', way: 'safari' } })

/** A forced catch's dice: every shake holds. */
const allHold = () => 0

/** A forced flee's dice: the ball breaks out on its first shake, then it runs. */
const breaksAndFlees = () => {
  let first = true
  return () => (first ? ((first = false), 0.99) : 0)
}

/** One action on the session: the API's dice (faked, the same rules here). */
export const actSafari = async (session: SafariSession, action: SafariAction): Promise<SafariActed | Failure> => {
  if (realmFaked()) {
    const run = fake.run
    if (!run) return { status: 404, error: 'missing' }
    // A staged encounter takes the place of the next one in line (`ps.safari('meet', id)`).
    const staged = fake.stagedNext
    const queued = action.kind === 'grass' && staged ? { ...run, queue: run.queue.map((slot, i) => (i === run.met ? { family: staged, rarity: safariEntry(staged).rarity, shiny: fake.stagedShiny, sure: slot.sure } : slot)) } : run
    if (action.kind === 'grass') fake.stagedNext = null
    const got = applyAction(queued, action, action.kind !== 'ball' ? Math.random : fake.forceCatch ? allHold : fake.forceFlee ? breaksAndFlees() : Math.random)
    if (!got) return { status: 409, error: 'illegal' }
    fake.run = got.run
    fake.turn += 1
    let gift: Gift | null = null
    if (got.turn.kind === 'ball' && got.turn.caught) {
      gift = devGift(fake.turn, got.turn.family, got.turn.shiny)
      if (loadSave().hatched[got.turn.family] === undefined) fake.fresh = true
    }
    const view = fakeView()!
    if (got.run.over) {
      fake.dry = fake.fresh ? 0 : fake.dry + 1
      fake.run = null
    }
    return { turn: got.turn, gift, session: view }
  }
  const { status, body } = await apiCall('/realm/safari/act', { method: 'POST', body: { id: session.id, turn: session.turn, action: action.kind }, auth: true })
  return (status === 200 ? parseActed(body) : null) ?? failed(status, body)
}
