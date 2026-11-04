import { apiCall } from '../api'
import { CITY_IDS, type CityId } from '../net/realm'
import type { BaseList, BaseSave, BaseView, FurnitureBought, FurnitureBuy, RealmCities, RealmFriends, RealmMe, RealmReport } from '../net/realmApi'
import type { BaseLayout } from '../data/secretBases'
import { FURNITURE_IDS, type FurnitureCounts } from '../data/furniture'
import { LEGEND_IDS } from '../data/legends'
import { DEMO_BASES } from './demoBases'

/**
 * The Poké Realm's calls to the API (`net/realmApi.ts` lists the routes). The
 * realm needs an account, so these are only made signed in; every call fails
 * soft (`null`, or an `error`) like `gems.ts`'s, never blocking the game.
 *
 * `ps.realm('fake')` makes every call answer made-up data from `fake` (a
 * base, owned furniture, busy cities, two friends), so the realm's screens
 * work without an API.
 *
 * CONTRACT (realm/integration): the API PR fills the real calls and the
 * answers' parsing; the client and base PRs only import these functions.
 */

export type Failure = { error: string; status: number }

type Fake = { me: RealmMe; bases: Map<string, BaseView> }

let fake: Fake | null = null

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
  fake = on ? { me: { handle, furniture: fakeFurniture(), base: fakeBase(handle) }, bases: new Map(bases.map((b) => [b.handle, b])) } : null
}

export const realmFaked = () => fake !== null

const failed = (status: number, body: unknown): Failure => ({ status, error: typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? body.error : 'offline' })

export const fetchMe = async (): Promise<RealmMe | Failure> => {
  if (fake) return fake.me
  const { status, body } = await apiCall('/realm/me', { auth: true })
  return status === 200 ? (body as RealmMe) : failed(status, body)
}

export const fetchCities = async (): Promise<RealmCities | null> => {
  if (fake) return { cities: Object.fromEntries(CITY_IDS.map((id, i) => [id, (i * 7) % 41])) as Partial<Record<CityId, number>>, at: Date.now() }
  const { status, body } = await apiCall('/realm/cities')
  return status === 200 ? (body as RealmCities) : null
}

export const fetchFriends = async (): Promise<RealmFriends | null> => {
  if (fake) return { friends: [{ handle: 'misty', city: 'cerulean' }, { handle: 'brock', city: 'pewter' }] }
  const { status, body } = await apiCall('/realm/friends', { auth: true })
  return status === 200 ? (body as RealmFriends) : null
}

export const fetchBase = async (handle: string): Promise<BaseView | Failure> => {
  if (fake) return (handle === fake.me.handle ? fake.me.base : fake.bases.get(handle)) ?? { error: 'missing', status: 404 }
  const { status, body } = await apiCall(`/realm/base/${encodeURIComponent(handle)}`, { auth: true })
  return status === 200 ? (body as BaseView) : failed(status, body)
}

export const saveBase = async (save: BaseSave): Promise<BaseView | Failure> => {
  if (fake) {
    const base: BaseView = { ...(fake.me.base ?? fakeBase(fake.me.handle)), layout: save.layout, visibility: save.visibility, updatedAt: Date.now() }
    fake.me = { ...fake.me, base }
    return base
  }
  const { status, body } = await apiCall('/realm/base', { method: 'PUT', body: save, auth: true })
  return status === 200 ? (body as { base: BaseView }).base : failed(status, body)
}

export const listBases = async (sort: 'top' | 'new' | 'friends'): Promise<BaseList | null> => {
  if (fake) return { bases: [...fake.bases.values()].map((b) => ({ handle: b.handle, partner: b.partner, shiny: b.shiny, exterior: b.layout.exterior, visits: b.visits, likes: b.likes, items: b.layout.items.length })) }
  const { status, body } = await apiCall(`/realm/bases?sort=${sort}`, { auth: true })
  return status === 200 ? (body as BaseList) : null
}

export const likeBase = async (handle: string): Promise<{ likes: number } | Failure> => {
  if (fake) return { likes: 4 }
  const { status, body } = await apiCall(`/realm/base/${encodeURIComponent(handle)}/like`, { method: 'POST', auth: true })
  return status === 200 ? (body as { likes: number }) : failed(status, body)
}

export const buyFurniture = async (buy: FurnitureBuy): Promise<FurnitureBought | Failure> => {
  if (fake) {
    const furniture = { ...fake.me.furniture, [buy.id]: (fake.me.furniture[buy.id] ?? 0) + 1 }
    fake.me = { ...fake.me, furniture }
    return buy.pay === 'gems' ? { furniture, pay: 'gems', balance: 1000 } : { furniture, pay: 'coins', save: null, revision: buy.base + 1 }
  }
  const { status, body } = await apiCall('/realm/furniture/buy', { method: 'POST', body: buy, auth: true })
  return status === 200 ? (body as FurnitureBought) : failed(status, body)
}

export const reportTrainer = async (report: RealmReport): Promise<boolean> => {
  if (fake) return true
  const { status } = await apiCall('/realm/report', { method: 'POST', body: report, auth: true })
  return status === 200
}

export const isFailure = (v: unknown): v is Failure => typeof v === 'object' && v !== null && 'error' in v && 'status' in v
