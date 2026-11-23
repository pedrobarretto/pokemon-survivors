import { spendFromSave, stageGifts } from '../account'
import { apiCall } from '../api'
import { HATCHLING_IDS, PLAYABLE, type HatchlingId, type PlayableId } from '../data/hatchlings'
import { DEX_GIFT, HABITAT_REWARDS, SAFARI_HABITAT_IDS, SAFARI_ONLY, dexRewardKey, habitatDone, habitatResidents, isSafariHabitat, lackingFamilies, markLacking, openGated, safariEntry, sessionPool, type SafariHabitat } from '../data/safari'
import { isCaptured } from '../game/capture'
import { brasiliaDay, weekStart } from '../game/day'
import { parseGift, type Gift } from '../game/gifts'
import { isRecord } from '../game/parse'
import type { SafariActed, SafariContest, SafariEncounterView, SafariSession, SafariStarted, SafariState, SafariWanderer } from '../net/realmApi'
import { loadSave } from '../ui/save'
import { fakeBoardScore, fakeGameDeeds, realmFaked, type Failure } from './api'
import { safariDeeds } from './gameDeeds'
import {
  CONTEST,
  SAFARI,
  applyAction,
  bestCatch,
  daypartOf,
  encountersLeft,
  guaranteedEntry,
  habitatOfWeek,
  isContestDay,
  localHour,
  nextInGrass,
  pickVisible,
  rollQueue,
  sessionPrice,
  startRun,
  wanderersOf,
  type SafariAction,
  type SafariCatch,
  type SafariDaypart,
  type SafariMode,
  type SafariRun,
  type SafariTurn,
} from './games/safari.rules'

/**
 * The Zona Safári's calls (`net/realmApi.ts` lists the routes). Fail soft and
 * parse every answer, like `realm/clawApi.ts`. Under `ps.realm('fake')` they
 * answer from an in-memory Safari that runs the same rules the API does.
 */

type FakeSafari = {
  used: number
  contestUsed: number
  contestBest: number | null
  dry: number
  run: SafariRun<HatchlingId> | null
  id: string
  week: string
  habitat: SafariHabitat
  daypart: SafariDaypart
  turn: number
  plays: number
  fresh: boolean
  forceCatch: boolean
  forceFlee: boolean
  dex: Record<SafariHabitat, HatchlingId[]>
  /** The habitats whose gifts went out (completed for good). */
  done: SafariHabitat[]
  /** Dev: the habitat instead of the week's, the time of day instead of the clock's, the next encounter's family and whether it's shiny, and whether the contest runs. */
  stagedHabitat: SafariHabitat | null
  stagedDaypart: SafariDaypart | null
  stagedNext: HatchlingId | null
  stagedShiny: boolean
  stagedContest: boolean | null
}

const thisWeek = () => weekStart(brasiliaDay(new Date()))

const emptyDex = () => Object.fromEntries(SAFARI_HABITAT_IDS.map((h) => [h, [] as HatchlingId[]])) as Record<SafariHabitat, HatchlingId[]>

const fake: FakeSafari = {
  used: 0,
  contestUsed: 0,
  contestBest: null,
  dry: 0,
  run: null,
  id: '',
  week: '',
  habitat: SAFARI_HABITAT_IDS[0]!,
  daypart: 'day',
  turn: 0,
  plays: 0,
  fresh: false,
  forceCatch: false,
  forceFlee: false,
  dex: emptyDex(),
  done: [],
  stagedHabitat: null,
  stagedDaypart: null,
  stagedNext: null,
  stagedShiny: false,
  stagedContest: null,
}

/** This device's offset from UTC in minutes east (what the API reads the hour from). */
export const clockOffset = () => -new Date().getTimezoneOffset()

/** The time of day here and now, as the API will take it. */
export const localDaypart = (): SafariDaypart => (realmFaked() && fake.stagedDaypart) || daypartOf(localHour(Date.now(), clockOffset()))

/**
 * Dev (`ps.safari`): the sessions without a new family (`sure`: as many as the
 * guarantee takes), the sessions used today, whether every ball holds, whether
 * whatever it faces flees, the habitat, the time of day, the next encounter
 * (and if shiny), whether the contest runs, and Pokédex entries (`dex`: a
 * habitat filled but for one, or emptied).
 */
export const stageSafari = (opts: {
  sure?: boolean
  dry?: number
  used?: number
  catches?: boolean
  flees?: boolean
  habitat?: SafariHabitat | null
  daypart?: SafariDaypart | null
  next?: HatchlingId | null
  shiny?: boolean
  contest?: boolean | null
  dex?: { habitat: SafariHabitat; fill: 'almost' | 'half' | 'empty' | 'all' }
  /** Habitats marked completed before (as if their gifts went out under fewer residents). */
  done?: readonly SafariHabitat[]
}) => {
  if (opts.sure) fake.dry = SAFARI.guarantee
  if (opts.dry !== undefined) fake.dry = opts.dry
  if (opts.used !== undefined) {
    fake.used = opts.used
    fake.contestUsed = 0
  }
  if (opts.catches !== undefined) fake.forceCatch = opts.catches
  if (opts.flees !== undefined) fake.forceFlee = opts.flees
  if (opts.habitat !== undefined) fake.stagedHabitat = opts.habitat
  if (opts.daypart !== undefined) fake.stagedDaypart = opts.daypart
  if (opts.next !== undefined) fake.stagedNext = opts.next
  if (opts.shiny !== undefined) fake.stagedShiny = opts.shiny
  if (opts.contest !== undefined) fake.stagedContest = opts.contest
  if (opts.dex) {
    const all = habitatResidents(opts.dex.habitat).map((e) => e.family)
    fake.dex[opts.dex.habitat] = opts.dex.fill === 'empty' ? [] : opts.dex.fill === 'all' ? all : opts.dex.fill === 'half' ? all.filter((_, i) => i % 3 !== 1) : all.slice(0, -1)
    if (opts.dex.fill !== 'all') fake.done = fake.done.filter((h) => h !== opts.dex?.habitat)
  }
  if (opts.done) fake.done = [...new Set([...fake.done, ...opts.done])]
  return { dry: fake.dry, used: fake.used, catches: fake.forceCatch, flees: fake.forceFlee, habitat: fake.stagedHabitat, daypart: fake.stagedDaypart, next: fake.stagedNext, shiny: fake.stagedShiny, contest: fake.stagedContest }
}

/** The habitat a fake session plays. */
const fakeHabitat = (week: string): SafariHabitat => fake.stagedHabitat ?? habitatOfWeek(week, SAFARI_HABITAT_IDS)

const fakeContestDay = () => fake.stagedContest ?? isContestDay(brasiliaDay(new Date()))

const partnerTypes = (partner: PlayableId | null): readonly string[] => (partner ? PLAYABLE[partner].line[0].types : [])

const fakePartner = (): PlayableId | null => {
  const { partner } = loadSave()
  return Object.hasOwn(PLAYABLE, partner) ? partner : null
}

/** The gated families this device's save opened (Phione once Manaphy hatched). */
export const savedOpen = () => {
  const { legends } = loadSave()
  return openGated((legend) => isCaptured(legends, legend))
}

const fakeLacking = () => lackingFamilies(loadSave().hatched, [], savedOpen())

const fakeView = (): SafariSession | null => {
  const run = fake.run
  if (!run) return null
  const e = run.encounter
  return {
    id: fake.id,
    week: fake.week,
    habitat: fake.habitat,
    mode: run.mode,
    daypart: fake.daypart,
    balls: run.balls,
    berries: run.berries,
    left: encountersLeft(run),
    sureNext: run.queue[nextInGrass(run)]?.sure ?? false,
    wanderers: wanderersOf(run),
    chain: run.chain,
    encounter: e && { family: e.family, shiny: e.shiny, calm: e.calm, sure: e.sure, level: e.level, mood: e.mood, moodTurns: e.moodTurns, chain: e.chain, stalked: e.stalked },
    catches: [...run.catches],
    over: run.over,
    turn: fake.turn,
  }
}

const failed = (status: number, body: unknown): Failure => ({ status, error: isRecord(body) && typeof body.error === 'string' ? body.error : 'offline' })

const count = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null)

const isHatchling = (v: unknown): v is HatchlingId => typeof v === 'string' && (HATCHLING_IDS as readonly string[]).includes(v)

const isPlayable = (v: unknown): v is PlayableId => typeof v === 'string' && Object.hasOwn(PLAYABLE, v)

const isDaypart = (v: unknown): v is SafariDaypart => v === 'dawn' || v === 'day' || v === 'dusk' || v === 'night'

const parseEncounter = (v: unknown): SafariEncounterView | null => {
  if (!isRecord(v) || !isHatchling(v.family) || typeof v.shiny !== 'boolean' || typeof v.sure !== 'boolean') return null
  const calm = count(v.calm)
  if (calm === null) return null
  const mood = v.mood === 'angry' || v.mood === 'eating' ? v.mood : null
  return { family: v.family, shiny: v.shiny, calm, sure: v.sure, level: count(v.level) ?? 1, mood, moodTurns: mood ? (count(v.moodTurns) ?? 0) : 0, chain: count(v.chain) ?? 1, stalked: v.stalked === true }
}

const parseCatch = (c: unknown): SafariCatch<HatchlingId>[] => (isRecord(c) && isHatchling(c.family) && typeof c.shiny === 'boolean' ? [{ family: c.family, shiny: c.shiny, level: count(c.level) ?? 0, score: count(c.score) ?? 0 }] : [])

const parseWanderer = (w: unknown): SafariWanderer[] => {
  if (!isRecord(w) || !isHatchling(w.family)) return []
  const slot = count(w.slot)
  return slot === null ? [] : [{ slot, family: w.family }]
}

const parseSession = (v: unknown): SafariSession | null => {
  if (!isRecord(v) || typeof v.id !== 'string' || typeof v.week !== 'string' || !isSafariHabitat(v.habitat) || !Array.isArray(v.catches) || typeof v.over !== 'boolean' || typeof v.sureNext !== 'boolean') return null
  const balls = count(v.balls)
  const berries = count(v.berries)
  const turn = count(v.turn)
  const left = count(v.left)
  const encounter = v.encounter === null ? null : parseEncounter(v.encounter)
  if (balls === null || berries === null || turn === null || left === null || (v.encounter !== null && !encounter)) return null
  const chainN = isRecord(v.chain) ? count(v.chain.n) : null
  const chain = isRecord(v.chain) && isHatchling(v.chain.family) && chainN !== null ? { family: v.chain.family, n: chainN } : null
  return {
    id: v.id,
    week: v.week,
    habitat: v.habitat,
    mode: v.mode === 'contest' ? 'contest' : 'safari',
    daypart: isDaypart(v.daypart) ? v.daypart : 'day',
    balls,
    berries,
    left,
    sureNext: v.sureNext,
    wanderers: Array.isArray(v.wanderers) ? v.wanderers.flatMap(parseWanderer) : [],
    chain,
    encounter,
    catches: v.catches.flatMap(parseCatch),
    over: v.over,
    turn,
  }
}

const parseContest = (v: unknown): SafariContest => {
  if (!isRecord(v)) return { open: false, left: 0, best: null }
  return { open: v.open === true, left: count(v.left) ?? 0, best: count(v.best) }
}

const parseDex = (v: unknown): Record<SafariHabitat, HatchlingId[]> => {
  const dex = emptyDex()
  if (!isRecord(v)) return dex
  for (const h of SAFARI_HABITAT_IDS) {
    const list = v[h]
    if (Array.isArray(list)) dex[h] = list.filter(isHatchling)
  }
  return dex
}

const parseState = (v: unknown): SafariState | null => {
  if (!isRecord(v) || typeof v.week !== 'string' || !isSafariHabitat(v.habitat) || typeof v.sure !== 'boolean') return null
  const used = count(v.used)
  const dry = count(v.dry)
  const open = v.open === null ? null : parseSession(v.open)
  if (used === null || dry === null || (v.open !== null && !open)) return null
  const done = Array.isArray(v.done) ? v.done.filter(isSafariHabitat) : []
  return { week: v.week, habitat: v.habitat, used, dry, sure: v.sure, partner: isPlayable(v.partner) ? v.partner : null, open, contest: parseContest(v.contest), dex: parseDex(v.dex), done }
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
      return isHatchling(v.family) && typeof v.shiny === 'boolean' && typeof v.sure === 'boolean'
        ? { kind: 'appear', family: v.family, shiny: v.shiny, sure: v.sure, level: count(v.level) ?? 1, chain: count(v.chain) ?? 1, stalked: v.stalked === true }
        : null
    case 'ball': {
      const shakes = count(v.shakes)
      return shakes !== null && isHatchling(v.family) && typeof v.shiny === 'boolean' && typeof v.caught === 'boolean' && typeof v.fled === 'boolean'
        ? { kind: 'ball', family: v.family, shiny: v.shiny, shakes, caught: v.caught, fled: v.fled, score: count(v.score) ?? 0 }
        : null
    }
    case 'berry': {
      const calm = count(v.calm)
      return calm !== null && typeof v.fled === 'boolean' ? { kind: 'berry', calm, fled: v.fled } : null
    }
    case 'rock':
    case 'bait': {
      const turns = count(v.turns)
      return turns !== null && typeof v.fled === 'boolean' ? { kind: v.kind, turns, fled: v.fled } : null
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

const fakeContest = (): SafariContest => {
  const open = fakeContestDay()
  return { open, left: open ? Math.max(0, CONTEST.entries - fake.contestUsed) : 0, best: fake.contestBest }
}

/** The Safari as this account sees it. */
export const fetchSafari = async (): Promise<SafariState | Failure> => {
  if (realmFaked()) {
    const week = fake.run ? fake.week : thisWeek()
    return {
      week,
      habitat: fake.run ? fake.habitat : fakeHabitat(week),
      used: fake.used,
      dry: fake.dry,
      sure: fake.dry >= SAFARI.guarantee && fakeLacking().length > 0,
      partner: fakePartner(),
      open: fakeView(),
      contest: fakeContest(),
      dex: { ...fake.dex },
      done: [...fake.done],
    }
  }
  const { status, body } = await apiCall('/realm/safari', { auth: true })
  return (status === 200 ? parseState(body) : null) ?? failed(status, body)
}

/**
 * Starts a session: a regular one or a contest entry, with this device's UTC
 * offset (who's about follows the player's hour). A free one is a plain call;
 * a paid one spends from the stored save (`spendFromSave`: synced first, the
 * save that comes back kept). `used`: the sessions this device knows of
 * today, which pick the way.
 */
export const startSafari = async (used: number, mode: SafariMode = 'safari'): Promise<SafariStarted | Failure> => {
  const price = mode === 'contest' ? 0 : sessionPrice(used)
  if (price === null) return { status: 403, error: 'cap' }
  const offset = clockOffset()
  if (realmFaked()) {
    if (!fake.run) {
      if (mode === 'contest' && fakeContest().left === 0) return { status: 403, error: fakeContestDay() ? 'cap' : 'closed' }
      const week = thisWeek()
      const sure = mode === 'safari' && fake.dry >= SAFARI.guarantee ? guaranteedEntry(fakeLacking(), SAFARI_ONLY, Math.random) : null
      if (mode === 'contest') fake.contestUsed += 1
      else fake.used += 1
      fake.plays += 1
      fake.fresh = false
      fake.turn = 0
      fake.id = `fake-${fake.plays}`
      fake.week = week
      fake.habitat = fakeHabitat(week)
      fake.daypart = localDaypart()
      const { hatched } = loadSave()
      const pool = markLacking(sessionPool(mode, fake.habitat, fake.daypart, fake.week || thisWeek(), savedOpen()), (id) => hatched[id] === undefined)
      const queue = rollQueue(pool, partnerTypes(fakePartner()), Math.random, sure)
      fake.run = startRun(queue, pickVisible(queue, Math.random), mode)
    }
    return { session: fakeView()!, used: fake.used }
  }
  if (price > 0) {
    const done = await spendFromSave('/realm/safari/start', { mode, offset }, price)
    return done.ok ? (parseStarted(done.body) ?? failed(0, null)) : { status: 0, error: done.error }
  }
  const { status, body } = await apiCall('/realm/safari/start', { method: 'POST', body: { mode, offset }, auth: true })
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

/** Faked: what the API does with a catch's habitat Pokédex, its gifts staged in the gift box as the API would send them. */
const fakeDex = (family: HatchlingId) => {
  const habitat = fake.habitat
  const list = fake.dex[habitat]
  if (!habitatResidents(habitat).some((e) => e.family === family) || list.includes(family)) return
  list.push(family)
  if (!habitatDone(habitat, list, fake.done) || fake.done.includes(habitat)) return
  fake.done = [...fake.done, habitat]
  stageGifts(fakeRewards(habitat))
}

/** A habitat's gifts as the API sends them (`server/src/safari.ts`), under dev ids. */
export const fakeRewards = (habitat: SafariHabitat): Gift[] => [
  { id: `dev-safariDex:${habitat}`, content: DEX_GIFT, reason: { kind: 'safariDex', habitat } },
  ...HABITAT_REWARDS[habitat].map((content, i): Gift => ({ id: `dev-${dexRewardKey(habitat, i)}`, content, reason: { kind: 'safariDex', habitat } })),
]

/** One action on the session: the API's dice (faked, the same rules here). */
export const actSafari = async (session: SafariSession, action: SafariAction): Promise<SafariActed | Failure> => {
  if (realmFaked()) {
    const run = fake.run
    if (!run) return { status: 404, error: 'missing' }
    // A staged encounter takes the place of the next one met (`ps.safari('meet', id)`).
    const staged = fake.stagedNext
    const slot = action.kind === 'grass' ? nextInGrass(run) : action.kind === 'stalk' ? action.slot : -1
    const queued = slot >= 0 && staged ? { ...run, queue: run.queue.map((s, i) => (i === slot ? { ...s, family: staged, rarity: safariEntry(staged).rarity, level: SAFARI.levelBase[safariEntry(staged).rarity] + (s.level - SAFARI.levelBase[s.rarity]) } : s)) } : run
    if (slot >= 0) fake.stagedNext = null
    const shinyRoll = fake.stagedShiny && slot >= 0 ? () => 0 : Math.random
    if (slot >= 0) fake.stagedShiny = false
    const got = applyAction(queued, action, action.kind === 'grass' || action.kind === 'stalk' ? shinyRoll : action.kind !== 'ball' ? Math.random : fake.forceCatch ? allHold : fake.forceFlee ? breaksAndFlees() : Math.random)
    if (!got) return { status: 409, error: 'illegal' }
    fake.run = got.run
    fake.turn += 1
    let gift: Gift | null = null
    const contest = got.run.mode === 'contest'
    if (got.turn.kind === 'ball' && got.turn.caught) {
      if (!contest) {
        gift = devGift(fake.turn, got.turn.family, got.turn.shiny)
        if (loadSave().hatched[got.turn.family] === undefined) fake.fresh = true
      }
      fakeDex(got.turn.family)
      fakeGameDeeds(safariDeeds(true, got.turn.shiny))
    }
    if (got.run.over && contest) {
      const best = bestCatch(got.run.catches)
      if (best) {
        fake.contestBest = Math.max(fake.contestBest ?? 0, best.score)
        fakeBoardScore('safari', best.score)
        const had = loadSave().hatched[best.family]
        if (best.shiny ? had?.shiny !== true : had === undefined) gift = devGift(fake.turn, best.family, best.shiny)
      }
    }
    const view = fakeView()!
    if (got.run.over) {
      if (!contest) fake.dry = fake.fresh ? 0 : fake.dry + 1
      fake.run = null
    }
    return { turn: got.turn, gift, session: view }
  }
  const { status, body } = await apiCall('/realm/safari/act', { method: 'POST', body: { id: session.id, turn: session.turn, action: action.kind, ...(action.kind === 'stalk' ? { slot: action.slot } : {}) }, auth: true })
  return (status === 200 ? parseActed(body) : null) ?? failed(status, body)
}
