import { landGifts, spendFromSave } from '../account'
import { apiCall } from '../api'
import { DIG_FOSSIL_FAMILIES, DIG_TREASURES, type DigPrize, type FossilFamily } from '../data/digTreasures'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { brasiliaDay, weekStart } from '../game/day'
import { parseGift, type Gift, type GiftContent } from '../game/gifts'
import { isRecord } from '../game/parse'
import type { DigEnd, DigGift, DigHitAnswer, DigReward, DigStarted, DigState, DigWallView } from '../net/realmApi'
import { addFakePiece, fakeGameDeeds, realmFaked, type Failure } from './api'
import { digDeeds } from './gameDeeds'
import { buildWall, DIG, digPowers, fossilStreak, hitWall, NO_POWERS, sortOut, startProgress, tileAt, treasureFree, wallPrice, type DigPowers, type DigProgress, type DigTool, type DigWall } from './games/dig.rules'

/**
 * The Escavação's calls (`net/realmApi.ts` lists the routes). Fail soft and
 * parse every answer, like `realm/api.ts`. Under `ps.realm('fake')` they answer
 * from an in-memory mine that runs the same rules the API does; `stageDig` (`ps.dig`) sets it up.
 */

type FakeWall = { id: string; week: string; wall: DigWall; powers: DigPowers; progress: DigProgress; seq: number; answers: DigHitAnswer[]; lacking: FossilFamily[] }

const fake = {
  used: 0,
  dry: 0,
  lacking: [...DIG_FOSSIL_FAMILIES] as FossilFamily[],
  open: null as FakeWall | null,
  plays: 0,
  /** What the next wall is forced to be (`ps.dig`). */
  force: {} as { golden?: boolean; fossil?: FossilFamily; box?: boolean; diamond?: boolean },
  /** Dev: the next wall is one layer deep and holds far more crack, to stage a whole dig (`ps.dig('soft')`). */
  soft: false,
  /** Dev: whose powers the next wall gets, whatever the partner is (`ps.dig('partner', id)`). */
  partner: null as string | null,
}

const thisWeek = () => weekStart(brasiliaDay(new Date()))

/** Dev (`ps.dig`): forces the next faked wall, the walls used today, the dry streak and the fossils lacked. */
export const stageDig = (patch: { golden?: boolean; fossil?: FossilFamily | null; box?: boolean; diamond?: boolean; used?: number; dry?: number; lacking?: readonly FossilFamily[]; partner?: string | null; soft?: boolean }) => {
  if (patch.golden !== undefined) fake.force.golden = patch.golden
  if (patch.box !== undefined) fake.force.box = patch.box
  if (patch.diamond !== undefined) fake.force.diamond = patch.diamond
  if (patch.fossil !== undefined) {
    if (patch.fossil === null) delete fake.force.fossil
    else fake.force.fossil = patch.fossil
  }
  if (patch.used !== undefined) fake.used = patch.used
  if (patch.dry !== undefined) fake.dry = patch.dry
  if (patch.lacking !== undefined) fake.lacking = [...patch.lacking]
  if (patch.partner !== undefined) fake.partner = patch.partner
  if (patch.soft !== undefined) fake.soft = patch.soft
  return { used: fake.used, dry: fake.dry, lacking: fake.lacking, force: fake.force, open: fake.open !== null }
}

/** Dev: where the open faked wall hides things and how many layers are left, for staging screenshots. */
export const peekFakeWall = () => (fake.open ? { treasures: fake.open.wall.treasures, left: fake.open.progress.left } : null)

/** Dev: fills the open wall's crack to one hit short, and moves the seq along so the next hit brings it down. */
export const crackFakeWall = () => {
  if (!fake.open) return false
  fake.open.progress = { ...fake.open.progress, crack: Math.max(0, fake.open.wall.cap - 1) }
  return true
}

const count = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null)

const failed = (status: number, body: unknown): Failure => ({ status, error: isRecord(body) && typeof body.error === 'string' ? body.error : 'offline' })

const failedAs = (error: string): Failure => ({ status: 0, error })

const asView = (v: unknown): DigWallView | null => {
  if (!isRecord(v) || typeof v.id !== 'string' || typeof v.week !== 'string' || typeof v.golden !== 'boolean' || typeof v.pattern !== 'string' || !isRecord(v.powers) || !Array.isArray(v.depths) || !Array.isArray(v.left) || !Array.isArray(v.tiles) || !Array.isArray(v.freed)) return null
  const cap = count(v.cap)
  const crack = count(v.crack)
  const seq = count(v.seq)
  if (cap === null || crack === null || seq === null) return null
  // Trusted shape from the API (the same types); a wrong build refuses on `id`/numbers above.
  return v as DigWallView
}

const parseState = (v: unknown): DigState | null => {
  if (!isRecord(v) || typeof v.week !== 'string' || !Array.isArray(v.lacking)) return null
  const used = count(v.used)
  const dry = count(v.dry)
  if (used === null || dry === null) return null
  const open = v.open === null ? null : asView(v.open)
  if (v.open !== null && !open) return null
  return { week: v.week, used, dry, lacking: v.lacking.filter((f): f is string => typeof f === 'string'), open }
}

const parseStarted = (v: unknown): DigStarted | null => {
  if (!isRecord(v)) return null
  const wall = asView(v.wall)
  const used = count(v.used)
  return wall && used !== null ? { wall, used } : null
}

const parseAnswer = (v: unknown): DigHitAnswer | null => (isRecord(v) && count(v.seq) !== null && Array.isArray(v.cells) && count(v.crack) !== null && Array.isArray(v.freed) ? (v as DigHitAnswer) : null)

const parseEnd = (v: unknown): DigEnd | null => (isRecord(v) && (v.outcome === 'collapse' || v.outcome === 'stopped') && Array.isArray(v.kept) && Array.isArray(v.buried) && Array.isArray(v.treasures) && Array.isArray(v.gifts) ? (v as DigEnd) : null)

/** The mine as this account sees it. */
export const fetchDig = async (): Promise<DigState | Failure> => {
  if (realmFaked()) return { week: fake.open?.week ?? thisWeek(), used: fake.used, dry: fake.dry, lacking: fake.lacking, open: fake.open ? viewOf(fake.open) : null }
  const { status, body } = await apiCall('/realm/dig', { auth: true })
  return (status === 200 ? parseState(body) : null) ?? failed(status, body)
}

const viewOf = (w: FakeWall): DigWallView => ({
  id: w.id,
  week: w.week,
  golden: w.wall.golden,
  pattern: w.wall.pattern,
  cap: w.wall.cap,
  powers: w.powers,
  hint: w.wall.hint,
  depths: w.wall.depths,
  left: w.progress.left,
  crack: w.progress.crack,
  seq: w.seq,
  tiles: w.progress.left.flatMap((left, i) => {
    if (left !== 0) return []
    const tile = tileAt(w.wall, i)
    return tile ? [{ i, left: 0, tile }] : []
  }),
  freed: w.wall.treasures.flatMap((_, t) => (treasureFree(w.wall, w.progress.left, t) ? [t] : [])),
})

const fakePartnerPowers = (partner: string): DigPowers => (Object.hasOwn(PLAYABLE, partner) ? digPowers(PLAYABLE[partner as PlayableId].line[0].types) : NO_POWERS)

/** Dig a wall. A free one is a plain call; a paid one spends from the stored save (`spendFromSave`). `used`: today's walls this device knows of, which pick the way; `resuming` a wall left open costs nothing and spends nothing. */
export const startWall = async (used: number, partner: string, resuming: boolean): Promise<DigStarted | Failure> => {
  const price = resuming ? 0 : wallPrice(used)
  if (price === null) return { status: 403, error: 'cap' }
  if (realmFaked()) {
    if (!fake.open) {
      fake.used += 1
      fake.plays += 1
      const week = thisWeek()
      const powers = fakePartnerPowers(fake.partner ?? partner)
      const { box, diamond, ...force } = fake.force
      const built = buildWall(1000 + fake.plays * 37 + (Date.now() & 0xffff), { week, powers, lacking: fake.lacking, due: fake.dry >= DIG.fossilGuarantee && fake.lacking.length > 0, box: box === true, diamond: diamond === true, force: Object.keys(force).length > 0 ? force : undefined })
      const wall = fake.soft ? { ...built, depths: built.depths.map(() => 1), cap: built.cap + 200 } : built
      fake.soft = false
      fake.force = {}
      fake.open = { id: `fake-${fake.plays}`, week, wall, powers, progress: startProgress(wall), seq: 0, answers: [], lacking: [...fake.lacking] }
    }
    return { wall: viewOf(fake.open), used: fake.used }
  }
  if (price > 0) {
    const done = await spendFromSave('/realm/dig/start', { partner }, price)
    return done.ok ? (parseStarted(done.body) ?? failed(0, null)) : failedAs(done.error)
  }
  const { status, body } = await apiCall('/realm/dig/start', { method: 'POST', body: { partner }, auth: true })
  return (status === 200 ? parseStarted(body) : null) ?? failed(status, body)
}

/** Fake payout: the rules' end, gifts made up here with fake ids. */
const fakeFinish = (w: FakeWall, outcome: DigEnd['outcome']): DigEnd => {
  const sorted = sortOut(w.wall, w.progress.left)
  const still = new Set(fake.lacking)
  const gifts: DigGift[] = []
  const rewards = sorted.kept.map((t, i): DigReward => {
    const prize: DigPrize = DIG_TREASURES[t.id].prize
    const content = (c: GiftContent | null) => {
      if (c) gifts.push({ id: `fake-dig-${w.id}-${i}`, content: c, reason: { kind: 'season', way: 'dig' }, at: new Date().toISOString() })
    }
    if (prize.kind === 'furniture') {
      addFakePiece(prize.piece)
      return { id: t.id, prize, repeat: false, coins: 0 }
    }
    if (prize.kind === 'legend') {
      content({ kind: 'legend', legend: prize.legend })
      return { id: t.id, prize, repeat: false, coins: 0 }
    }
    if (prize.kind === 'fossil') {
      const fresh = still.delete(prize.family)
      content(fresh ? { kind: 'family', family: prize.family } : { kind: 'coins', amount: 800 })
      return { id: t.id, prize, repeat: !fresh, coins: fresh ? 0 : 800 }
    }
    content(prize.kind === 'coins' ? { kind: 'coins', amount: prize.amount } : prize.kind === 'bag' ? { kind: 'bag', item: prize.item, count: 1 } : { kind: 'evoItem', item: prize.item })
    return { id: t.id, prize, repeat: false, coins: prize.kind === 'coins' ? prize.amount : 0 }
  })
  fake.lacking = fake.lacking.filter((f) => still.has(f))
  fake.dry = fossilStreak(fake.dry, w.wall, w.progress.left, w.lacking)
  fake.open = null
  fakeGameDeeds(digDeeds(w.wall.golden, sorted.kept.map((t) => t.id)))
  return { outcome, kept: rewards, buried: sorted.buried, treasures: w.wall.treasures, gifts, dry: fake.dry }
}

/** One numbered hit. A repeat of a number the API answered returns the stored answer. */
export const hitDig = async (wall: DigWallView, seq: number, tool: DigTool, cell: number): Promise<DigHitAnswer | Failure> => {
  if (realmFaked()) {
    const w = fake.open
    if (!w || w.id !== wall.id) return { status: 404, error: 'missing' }
    if (seq <= w.seq) return w.answers[seq - 1] ?? { status: 409, error: 'seq' }
    if (seq !== w.seq + 1) return { status: 409, error: 'seq' }
    const hit = hitWall(w.wall, w.progress, tool, cell, w.powers)
    if (!hit) return { status: 409, error: 'empty' }
    w.progress = hit.progress
    w.seq = seq
    const end = hit.collapsed ? fakeFinish(w, 'collapse') : null
    const answer: DigHitAnswer = { seq, cells: hit.cells, crack: hit.progress.crack, freed: hit.freed, end }
    w.answers.push(answer)
    return answer
  }
  const { status, body } = await apiCall('/realm/dig/hit', { method: 'POST', body: { id: wall.id, seq, tool, cell }, auth: true })
  return (status === 200 ? parseAnswer(body) : null) ?? failed(status, body)
}

/** Leaves with what's dug out. */
export const stopDig = async (wall: DigWallView): Promise<DigEnd | Failure> => {
  if (realmFaked()) {
    if (!fake.open || fake.open.id !== wall.id) return { status: 404, error: 'missing' }
    return fakeFinish(fake.open, 'stopped')
  }
  const { status, body } = await apiCall('/realm/dig/stop', { method: 'POST', body: { id: wall.id }, auth: true })
  const end = status === 200 && isRecord(body) ? parseEnd(body.end) : null
  return end ?? failed(status, body)
}

/** Lands a wall's gifts on the save at once (the ones the save can't take yet wait in the gift box). `fake` ids are never the API's to claim. */
export const landDigGifts = (gifts: readonly DigGift[]): { gift: Gift; duplicate: boolean }[] => {
  const parsed = gifts.flatMap((g) => parseGift(g) ?? [])
  return landGifts(parsed, realmFaked() ? 'local' : 'claim').map(({ gift, hatch }) => ({ gift, duplicate: hatch?.duplicate === true }))
}
