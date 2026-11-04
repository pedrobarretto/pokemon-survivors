import { spendFromSave } from '../account'
import { apiCall } from '../api'
import { CITY_IDS, isCityId, type CityId } from '../net/realm'
import type { BaseCard, BaseList, BaseSave, BaseView, FurnitureBought, FurnitureBuy, RealmCities, RealmFriends, RealmMe, RealmReport } from '../net/realmApi'
import { BASE_EXTERIORS, EMPTY_BASE, isBaseExterior, isBaseVisibility, parseLayout, type LayoutError } from '../data/secretBases'
import { FURNITURE, FURNITURE_IDS, isFurnitureId, type FurnitureCounts, type FurnitureId } from '../data/furniture'
import { isRecord } from '../game/parse'

/**
 * The Poké Realm's calls to the API (`net/realmApi.ts` lists the routes). The
 * realm needs an account, so these are only made signed in; every call fails
 * soft (`null`, or an `error`) like `gems.ts`'s, never blocking the game.
 * Every answer is parsed, never trusted as is.
 *
 * `ps.realm('fake')` makes every call answer made-up data from `fake` (a
 * base, owned furniture, busy cities, two friends), so the realm's screens
 * work without an API.
 */

/** Why a call didn't go: the API's `error` (`offline` when it couldn't ask), its status, and for a refused layout which piece (`LayoutError`). */
export type Failure = { error: string; status: number; item?: number }

type Fake = { me: RealmMe; bases: Map<string, BaseView> }

let fake: Fake | null = null

const fakeFurniture = (): FurnitureCounts => Object.fromEntries(FURNITURE_IDS.filter((_, i) => i % 2 === 0).map((id) => [id, 2]))

const fakeBase = (handle: string): BaseView => ({
  handle,
  partner: 'charmander',
  shiny: false,
  layout: EMPTY_BASE,
  visibility: 'public',
  visits: 12,
  likes: 3,
  liked: false,
  updatedAt: Date.now(),
})

/** Dev: every call answers made-up data (on), or the API again (off). */
export const fakeRealm = (on: boolean, handle = 'ash') => {
  fake = on ? { me: { handle, furniture: fakeFurniture(), base: fakeBase(handle) }, bases: new Map([['misty', fakeBase('misty')]]) } : null
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

const parseFriends = (v: unknown): RealmFriends | null => {
  if (!isRecord(v) || !Array.isArray(v.friends)) return null
  return {
    friends: v.friends.flatMap((f): { handle: string; city: CityId }[] => (isRecord(f) && typeof f.handle === 'string' && isCityId(f.city) ? [{ handle: f.handle, city: f.city }] : [])),
  }
}

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

export const fetchFriends = async (): Promise<RealmFriends | null> => {
  if (fake) return { friends: [{ handle: 'misty', city: 'cerulean' }, { handle: 'brock', city: 'pewter' }] }
  const { status, body } = await apiCall('/realm/friends', { auth: true })
  return status === 200 ? parseFriends(body) : null
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

export const isFailure = (v: unknown): v is Failure => typeof v === 'object' && v !== null && 'error' in v && 'status' in v
