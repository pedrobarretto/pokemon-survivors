import { spendFromSave } from '../account'
import { apiCall } from '../api'
import { CITY_IDS, isCityId } from '../net/realm'
import type { BaseCard, BaseList, BaseSave, BaseView, FurnitureBought, FurnitureBuy, GameClaim, GameClaimed, RealmCities, RealmFriend, RealmFriends, RealmMe, RealmReport } from '../net/realmApi'
import type { PresenceReport } from '../net/realmRelay'
import { ACTIVITIES } from '../game/friends'
import { ROOM_CAP } from '../data/realmMap'
import { friendsFrom, parseReportRoom, type Followed, type HeldPresence } from './friends'
import { MINIGAME_DAILY, capped, coinsFor, trophiesEarned, type GameStats, type MinigameId } from '../data/minigames'
import { BASE_EXTERIORS, isBaseExterior, isBaseVisibility, parseLayout, type BaseLayout, type LayoutError } from '../data/secretBases'
import { FURNITURE, FURNITURE_IDS, isFurnitureId, type FurnitureCounts, type FurnitureId } from '../data/furniture'
import { LEGEND_IDS } from '../data/legends'
import { isRecord } from '../game/parse'
import { DEMO_BASES } from './demoBases'

/**
 * The Poké Realm's calls to the API (`net/realmApi.ts` lists the routes). The
 * realm needs an account, so these are only made signed in; every call fails
 * soft (`null`, or an `error`) like `gems.ts`'s, never blocking the game.
 * Every answer is parsed, never trusted as is.
 *
 * `ps.realm('fake')` makes every call answer made-up data from `fake` (a
 * base, owned furniture, busy cities, a few friends: `FAKE_FOLLOWED`), so the
 * realm's screens work without an API.
 */

/** Why a call didn't go: the API's `error` (`offline` when it couldn't ask), its status, and for a refused layout which piece (`LayoutError`). */
export type Failure = { error: string; status: number; item?: number }

type Fake = { me: RealmMe; bases: Map<string, BaseView>; games: { day: Partial<Record<MinigameId, number>>; stats: Partial<Record<MinigameId, GameStats>> }; showWhere: boolean }

let fake: Fake | null = null

/**
 * The faked friends: the players followed, before the privacy rules. Misty,
 * Brock and Dawn are the in-page realm's bots (`fakeFriendsFrom` says where
 * they walk; Dawn hides it), May walks a full arcade in Vermilion, Tracey is
 * in a run, Red offline and Leon doesn't follow back.
 */
const FAKE_FOLLOWED: readonly Omit<Followed, 'walking'>[] = [
  { handle: 'misty', name: 'Misty', followsBack: true, appearOffline: false, showWhere: true, activity: null, ago: null },
  { handle: 'brock', name: 'Brock', followsBack: true, appearOffline: false, showWhere: true, activity: null, ago: null },
  { handle: 'dawn', name: 'Dawn', followsBack: true, appearOffline: false, showWhere: false, activity: null, ago: null },
  { handle: 'may', name: 'May', followsBack: true, appearOffline: false, showWhere: true, activity: null, ago: null },
  { handle: 'tracey', name: 'Tracey', followsBack: true, appearOffline: false, showWhere: true, activity: 'run', ago: 1000 },
  { handle: 'red', name: 'Red', followsBack: true, appearOffline: false, showWhere: true, activity: null, ago: null },
  { handle: 'leon', name: 'Leon', followsBack: false, appearOffline: false, showWhere: true, activity: 'lobby', ago: 1000 },
]

/** Where the faked friends walk outside the in-page realm: May in a Vermilion arcade at its cap. */
const fakeElsewhere = (at: number): PresenceReport => {
  const crowd = Array.from({ length: ROOM_CAP.town - 1 }, (_, i) => `trainer${i}`)
  return { home: 'sa', at, cities: { vermilion: ['may', ...crowd] }, rooms: { vermilion: ['arcade', ...crowd.map(() => 'arcade')] } }
}

/** Where the bots of the in-page realm walk (its presence report), when one runs; set by `realmShell.ts`. */
let fakeHere: (() => PresenceReport | null) | null = null

export const fakeFriendsFrom = (fn: (() => PresenceReport | null) | null) => {
  fakeHere = fn
}

/** Without an in-page realm: Misty in Pallet's café, Brock and Dawn in Brock's base. */
const fakeDefault = (at: number): PresenceReport => ({ home: 'sa', at, cities: { pallet: ['misty', 'brock', 'dawn'] }, rooms: { pallet: ['cafe', 'base:brock', 'base:brock'] } })

/** Two of every piece on sale, and the dolls of half the legends (the ones `DEMO_BASES.mine` sets out among them). */
const fakeFurniture = (): FurnitureCounts =>
  Object.fromEntries(FURNITURE_IDS.flatMap((id) => (!id.startsWith('doll:') ? [[id, 2]] : LEGEND_IDS.findIndex((l) => `doll:${l}` === id) % 2 === 0 ? [[id, 1]] : [])))

const fakeBase = (handle: string, layout: BaseLayout = DEMO_BASES.mine, partner = 'charmander', visits = 12, likes = 3): BaseView => ({
  handle,
  partner,
  shiny: false,
  layout,
  visibility: 'public',
  visits,
  likes,
  liked: false,
  updatedAt: Date.now(),
})

/** Dev: every call answers made-up data (on), or the API again (off). */
export const fakeRealm = (on: boolean, handle = 'ash') => {
  const bases = [fakeBase('misty', DEMO_BASES.misty, 'squirtle', 87, 24), fakeBase('brock', DEMO_BASES.brock, 'geodude', 41, 9)]
  fake = on ? { me: { handle, furniture: fakeFurniture(), base: fakeBase(handle) }, bases: new Map(bases.map((b) => [b.handle, b])), games: { day: {}, stats: {} }, showWhere: true } : null
}

export const realmFaked = () => fake !== null

/* ---------------- Parsing the answers ---------------- */

const count = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null)

const failed = (status: number, body: unknown): Failure => {
  const error = isRecord(body) ? body.error : null
  // A refused layout says why as a `LayoutError`: `{ error: { error, item? } }`.
  if (isRecord(error) && typeof error.error === 'string') return { status, error: error.error, ...(typeof error.item === 'number' ? { item: error.item } : {}) }
  return { status, error: typeof error === 'string' ? error : 'offline' }
}

/** Furniture counts: known pieces with a whole positive count. */
export const parseFurnitureCounts = (v: unknown): FurnitureCounts => {
  if (!isRecord(v)) return {}
  const counts: Partial<Record<FurnitureId, number>> = {}
  for (const [id, n] of Object.entries(v)) {
    const c = count(n)
    if (isFurnitureId(id) && c) counts[id] = c
  }
  return counts
}

export const parseBaseView = (v: unknown): BaseView | null => {
  if (!isRecord(v) || typeof v.handle !== 'string' || typeof v.partner !== 'string' || !isBaseVisibility(v.visibility) || typeof v.updatedAt !== 'number') return null
  const visits = count(v.visits)
  const likes = count(v.likes)
  if (visits === null || likes === null) return null
  return { handle: v.handle, partner: v.partner, shiny: v.shiny === true, layout: parseLayout(v.layout), visibility: v.visibility, visits, likes, liked: v.liked === true, updatedAt: v.updatedAt }
}

const parseCard = (v: unknown): BaseCard | null => {
  if (!isRecord(v) || typeof v.handle !== 'string' || typeof v.partner !== 'string') return null
  const visits = count(v.visits)
  const likes = count(v.likes)
  const items = count(v.items)
  if (visits === null || likes === null || items === null) return null
  return { handle: v.handle, partner: v.partner, shiny: v.shiny === true, exterior: isBaseExterior(v.exterior) ? v.exterior : BASE_EXTERIORS[0], visits, likes, items }
}

const parseMe = (v: unknown): RealmMe | null => {
  if (!isRecord(v) || typeof v.handle !== 'string') return null
  const base = v.base === null ? null : parseBaseView(v.base)
  return v.base !== null && base === null ? null : { handle: v.handle, furniture: parseFurnitureCounts(v.furniture), base }
}

const parseCities = (v: unknown): RealmCities | null => {
  if (!isRecord(v) || !isRecord(v.cities) || typeof v.at !== 'number') return null
  const counts = v.cities
  const cities = CITY_IDS.flatMap((id) => {
    const n = count(counts[id])
    return n === null ? [] : [[id, n] as const]
  })
  return { cities: Object.fromEntries(cities), at: v.at }
}

const parseFriend = (f: unknown): RealmFriend | null => {
  if (!isRecord(f) || typeof f.handle !== 'string' || typeof f.name !== 'string') return null
  const who = { handle: f.handle, name: f.name }
  switch (f.state) {
    case 'realm': {
      if (!isCityId(f.city)) return null
      const full = f.full === 'city' || f.full === 'room' ? f.full : null
      return { ...who, state: 'realm', city: f.city, room: parseReportRoom(f.room), full }
    }
    case 'game': {
      const activity = ACTIVITIES.find((a) => a === f.activity)
      return activity ? { ...who, state: 'game', activity } : null
    }
    case 'hidden':
    case 'offline':
    case 'pending':
      return { ...who, state: f.state }
    default:
      return null
  }
}

export const parseRealmFriends = (v: unknown): RealmFriends | null =>
  isRecord(v) && Array.isArray(v.friends) ? { friends: v.friends.flatMap((f) => parseFriend(f) ?? []), showWhere: v.showWhere !== false } : null

const parseBought = (v: unknown): FurnitureBought | null => {
  if (!isRecord(v)) return null
  const furniture = parseFurnitureCounts(v.furniture)
  if (v.pay === 'gems') return typeof v.balance === 'number' ? { furniture, pay: 'gems', balance: v.balance } : null
  return v.pay === 'coins' && typeof v.revision === 'number' && isRecord(v.save) ? { furniture, pay: 'coins', save: v.save, revision: v.revision } : null
}

/* ---------------- The calls ---------------- */

export const fetchMe = async (): Promise<RealmMe | Failure> => {
  if (fake) return fake.me
  const { status, body } = await apiCall('/realm/me', { auth: true })
  return (status === 200 ? parseMe(body) : null) ?? failed(status, body)
}

export const fetchCities = async (): Promise<RealmCities | null> => {
  if (fake) return { cities: Object.fromEntries(CITY_IDS.map((id, i) => [id, (i * 7) % 41])), at: Date.now() }
  const { status, body } = await apiCall('/realm/cities')
  return status === 200 ? parseCities(body) : null
}

/** The players followed and where each is, as far as they let the player see (`realm/friends.ts`), or null (offline, or asked too often). */
export const fetchFriends = async (): Promise<RealmFriends | null> => {
  if (fake) {
    const at = Date.now()
    const held: HeldPresence[] = [fakeHere?.() ?? fakeDefault(at), fakeElsewhere(at)].map((report) => ({ report, at }))
    return { friends: friendsFrom(FAKE_FOLLOWED, held, at), showWhere: fake.showWhere }
  }
  const { status, body } = await apiCall('/realm/friends', { auth: true })
  return status === 200 ? parseRealmFriends(body) : null
}

/** Turns "Mostrar onde estou para amigos" on or off. Whether it went through. */
export const setShowWhere = async (showWhere: boolean): Promise<boolean> => {
  if (fake) {
    fake.showWhere = showWhere
    return true
  }
  return (await apiCall('/realm/settings', { method: 'PUT', body: { showWhere }, auth: true })).status === 200
}

export const fetchBase = async (handle: string): Promise<BaseView | Failure> => {
  if (fake) return (handle === fake.me.handle ? fake.me.base : fake.bases.get(handle)) ?? { error: 'missing', status: 404 }
  const { status, body } = await apiCall(`/realm/base/${encodeURIComponent(handle)}`, { auth: true })
  return (status === 200 ? parseBaseView(body) : null) ?? failed(status, body)
}

/** Saves the player's base. A refusal of the layout (400) carries `checkLayout`'s `error` and the piece (`item`). */
export const saveBase = async (save: BaseSave): Promise<BaseView | Failure> => {
  if (fake) {
    const base: BaseView = { ...(fake.me.base ?? fakeBase(fake.me.handle)), layout: save.layout, visibility: save.visibility, updatedAt: Date.now() }
    fake.me = { ...fake.me, base }
    return base
  }
  const { status, body } = await apiCall('/realm/base', { method: 'PUT', body: save, auth: true })
  return (status === 200 && isRecord(body) ? parseBaseView(body.base) : null) ?? failed(status, body)
}

/** A `saveBase` failure as `checkLayout`'s `LayoutError` (the editor highlights its piece), or null when it wasn't the layout. */
export const layoutError = (f: Failure): LayoutError | null => {
  if (f.status !== 400) return null
  if (f.error === 'style' || f.error === 'tooMany') return { error: f.error }
  const kinds = ['unknown', 'kind', 'owned', 'bounds', 'overlap', 'support', 'door'] as const
  const kind = kinds.find((k) => k === f.error)
  return kind && f.item !== undefined ? { error: kind, item: f.item } : null
}

export const listBases = async (sort: 'top' | 'new' | 'friends'): Promise<BaseList | null> => {
  if (fake) return { bases: [...fake.bases.values()].map((b) => ({ handle: b.handle, partner: b.partner, shiny: b.shiny, exterior: b.layout.exterior, visits: b.visits, likes: b.likes, items: b.layout.items.length })) }
  const { status, body } = await apiCall(`/realm/bases?sort=${sort}`, { auth: true })
  return status === 200 && isRecord(body) && Array.isArray(body.bases) ? { bases: body.bases.flatMap((b) => parseCard(b) ?? []) } : null
}

export const likeBase = async (handle: string): Promise<{ likes: number } | Failure> => {
  if (fake) return { likes: 4 }
  const { status, body } = await apiCall(`/realm/base/${encodeURIComponent(handle)}/like`, { method: 'POST', auth: true })
  const likes = status === 200 && isRecord(body) ? count(body.likes) : null
  return likes !== null ? { likes } : failed(status, body)
}

/**
 * Buys one piece as `buy` says. A ₽ purchase must carry the save revision
 * it spends from: `buyWithCoins` does that (and keeps the save that comes
 * back); this is the bare call.
 */
export const buyFurniture = async (buy: FurnitureBuy): Promise<FurnitureBought | Failure> => {
  if (fake) {
    const furniture = { ...fake.me.furniture, [buy.id]: (fake.me.furniture[buy.id] ?? 0) + 1 }
    fake.me = { ...fake.me, furniture }
    return buy.pay === 'gems' ? { furniture, pay: 'gems', balance: 1000 } : { furniture, pay: 'coins', save: null, revision: buy.base + 1 }
  }
  const { status, body } = await apiCall('/realm/furniture/buy', { method: 'POST', body: buy, auth: true })
  return (status === 200 ? parseBought(body) : null) ?? failed(status, body)
}

/**
 * Buys one piece with ₽ out of the stored save, the way the Festival's
 * donations spend (`spendFromSave`: it syncs first, sends the device's
 * revision, retries once on `stale` and keeps the save that comes back). The
 * new counts, or why it didn't go (`funds`, `nosave`, `guest`, `offline`…).
 */
export const buyWithCoins = async (id: FurnitureId): Promise<{ furniture: FurnitureCounts } | Failure> => {
  const price = FURNITURE[id].price
  const coins = price && 'coins' in price ? price.coins : null
  if (coins === null) return { error: 'not sold', status: 404 }
  if (fake) {
    const bought = await buyFurniture({ id, pay: 'coins', base: 0 })
    return isFailure(bought) ? bought : { furniture: bought.furniture }
  }
  const done = await spendFromSave('/realm/furniture/buy', { id, pay: 'coins' }, coins)
  return done.ok ? { furniture: parseFurnitureCounts(done.body.furniture) } : { error: done.error, status: 0 }
}

export const reportTrainer = async (report: RealmReport): Promise<boolean> => {
  if (fake) return true
  const { status } = await apiCall('/realm/report', { method: 'POST', body: report, auth: true })
  return status === 200
}

/**
 * Claims a finished mini game's ₽ and trophies (`POST /realm/game/claim`).
 * Faking, it prices and caps it here the way the API does, from a day kept
 * in memory. The caller adds `coins` to the wallet.
 */
export const claimGame = async (claim: GameClaim): Promise<GameClaimed | Failure> => {
  if (fake) {
    const g = fake.games
    const coins = coinsFor(claim.game, claim.outcome, claim.ms)
    if (coins === null) return { error: 'outcome', status: 400 }
    const paidAll = Object.values(g.day).reduce((a, b) => a + (b ?? 0), 0)
    const paid = capped(claim.game, coins, g.day[claim.game] ?? 0, paidAll)
    g.day[claim.game] = (g.day[claim.game] ?? 0) + paid
    const was = g.stats[claim.game] ?? { plays: 0, wins: 0, best: 0, feats: [] }
    const o = claim.outcome
    const stats: GameStats = {
      plays: was.plays + 1,
      wins: was.wins + ('result' in o && o.result === 'win' ? 1 : 0),
      best: Math.max(was.best, 'score' in o ? o.score : 0),
      feats: [...new Set([...was.feats, ...claim.feats])],
    }
    g.stats[claim.game] = stats
    const before = new Set(trophiesEarned(claim.game, was))
    const trophies = trophiesEarned(claim.game, stats).filter((id): id is FurnitureId => !before.has(id) && isFurnitureId(id))
    if (trophies.length > 0) fake.me = { ...fake.me, furniture: { ...fake.me.furniture, ...Object.fromEntries(trophies.map((id) => [id, (fake?.me.furniture[id] ?? 0) + 1])) } }
    return { coins: paid, today: Math.min(MINIGAME_DAILY, paidAll + paid), trophies, furniture: trophies.length > 0 ? fake.me.furniture : null }
  }
  const { status, body } = await apiCall('/realm/game/claim', { method: 'POST', body: claim, auth: true })
  if (status !== 200 || !isRecord(body)) return failed(status, body)
  const coins = count(body.coins)
  const today = count(body.today)
  if (coins === null || today === null) return failed(0, null)
  return {
    coins,
    today,
    trophies: Array.isArray(body.trophies) ? body.trophies.filter(isFurnitureId) : [],
    furniture: isRecord(body.furniture) ? parseFurnitureCounts(body.furniture) : null,
  }
}

export const isFailure = (v: unknown): v is Failure => typeof v === 'object' && v !== null && 'error' in v && 'status' in v
