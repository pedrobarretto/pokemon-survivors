import { accountState, accountsEnabled, accountUserId, API_URL } from './account'
import { track } from './analytics'
import { apiCall } from './api'
import { equip, ownedOnly, sameLook } from './arena/gemShop'
import { ARENA_COSMETICS, COSMETIC_IDS, COSMETIC_SLOTS, cosmeticPrice, isCosmeticId, parseLook, slotOf, type ArenaLook, type CosmeticId } from './data/arenaCosmetics'
import { isGemPackId, packGems, type GemCurrency, type GemMethod, type GemPackId } from './data/gems'
import { isGemReason, type GemBuyResponse, type GemCheckoutRequest, type GemLedgerEntry, type GemsStatus } from './game/gems'
import { isRecord } from './game/parse'
import { setLocalLook } from './render/arenaLooks'
import type { WireLook } from './net/protocol'

/**
 * The Arena's gem shop through the API (`server/`): the balance, what the
 * account owns and its equipped look (`GET /gems`), a pack's checkout
 * (`POST /gems/checkout`, then Stripe or AbacatePay, back on `/?gems=<ref>`),
 * a cosmetic bought (`POST /gems/buy`), the look saved (`PUT /gems/look`)
 * and the receipts (`GET /gems/ledger`). The shop needs an account; nothing
 * here ever blocks a guest's game: every call fails soft.
 *
 * The device mirrors the account's last answer and look (`ps:gems`, by
 * account), so the gem chip has a number and the look rides into matches
 * offline; a look changed offline waits there (`pending`) and goes up with
 * the next answer.
 *
 * `ps.gems('fake')` makes every call answer made-up data (and the shop act
 * as signed in), a checkout included: it comes back in the page, no money
 * moving (`fakeGems`, `stageCheckout`).
 */

/** The shop reads gems from the API: a build with one. */
export const gemsEnabled = Boolean(API_URL)

/* ---------------- Fakes ---------------- */

type Fake = { status: GemsStatus; landing: { gems: number; at: number } | 'never' | null; ledger: GemLedgerEntry[] }

let fake: Fake | null = null

const fakeStatus = (balance: number): GemsStatus => {
  const owned = COSMETIC_IDS.filter((_, i) => i % 3 === 1)
  return { balance, owned, look: owned.reduce<ArenaLook>(equip, {}) }
}

/** Dev: every call answers made-up data, starting at `balance` gems with a third of the catalog owned (on), or the API again (off). */
export const fakeGems = (on: boolean, balance = 1250) => {
  fake = on ? { status: fakeStatus(balance), landing: null, ledger: [{ amount: 550, reason: 'pack', ref: 'bag', at: Date.now() - 86_400_000 }] } : null
  notify()
}

export const gemsFaked = () => fake !== null

/** Dev, faking: sets the balance, or owns `ids` (the whole catalog without them). */
export const stageGems = (patch: { balance?: number; own?: readonly CosmeticId[] | 'all' }) => {
  if (!fake) fakeGems(true)
  const f = fake!
  const owned = patch.own === 'all' ? COSMETIC_IDS : patch.own ? [...new Set([...f.status.owned, ...patch.own])] : f.status.owned
  f.status = { ...f.status, balance: patch.balance ?? f.status.balance, owned }
  remember(f.status)
}

/**
 * Dev, faking: a checkout of `pack` came back. Its gems land a moment after
 * the return (`never`: they don't, the wait runs out). Returns the `?gems=`
 * ref the return screen reads.
 */
export const stageCheckout = (pack: GemPackId | 'never') => {
  if (!fake) fakeGems(true)
  fake!.landing = pack === 'never' ? 'never' : { gems: packGems(pack), at: Date.now() + 2500 }
  keepPending({ pack: pack === 'never' ? 'pouch' : pack, before: fake!.status.balance })
  return `dev-${pack}`
}

/* ---------------- The device's mirror ---------------- */

const MIRROR_KEY = 'ps:gems'

/** What the device keeps, by account: the last answer, and whether `look` is a change the API hasn't taken yet. */
type Mirror = { user: string; status: GemsStatus; pending: boolean }

const parseStatus = (v: unknown): GemsStatus | null => {
  if (!isRecord(v) || typeof v.balance !== 'number' || !Number.isFinite(v.balance) || !Array.isArray(v.owned)) return null
  return { balance: v.balance, owned: v.owned.filter(isCosmeticId), look: parseLook(v.look) }
}

const readMirror = (): Mirror | null => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(MIRROR_KEY) ?? 'null')
    if (!isRecord(raw) || typeof raw.user !== 'string') return null
    const status = parseStatus(raw.status)
    return status ? { user: raw.user, status, pending: raw.pending === true } : null
  } catch {
    return null
  }
}

const writeMirror = (m: Mirror) => {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(m))
  } catch {
    // Storage blocked: the look lasts this page.
  }
}

let mirror: Mirror | null = readMirror()

const listeners = new Set<(s: GemsStatus | null) => void>()

/** Tells the listeners, and keeps the hub's own look (`localLook`: its profile shows the title) on what the account wears. */
const notify = () => {
  const s = knownGems()
  setLocalLook(s ? ownedOnly(s.look, ownedSet(s)) : {})
  for (const fn of listeners) fn(s)
}

/** Calls `fn` with the account's gems whenever they change (a fetch, a buy, a look). Returns the unsubscribe. */
export const onGems = (fn: (s: GemsStatus | null) => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** Whether the shop is open to this player: signed in (or faking it). */
export const gemsSignedIn = () => fake !== null || (accountsEnabled && accountState().kind === 'signedIn')

/** The account's gems as last known (the API's last answer, or the device's mirror of it), or null: a guest, another account's mirror, never asked. */
export const knownGems = (): GemsStatus | null => {
  if (fake) return fake.status
  if (!gemsSignedIn()) return null
  const user = accountUserId()
  return mirror && mirror.user === user ? mirror.status : null
}

const remember = (status: GemsStatus, pending = false) => {
  if (!fake) {
    const user = accountUserId()
    if (user) writeMirror((mirror = { user, status, pending }))
  }
  notify()
}

/** Free cosmetics (price 0) every account owns, as the API counts them. */
const FREE = COSMETIC_IDS.filter((id) => cosmeticPrice(id) === 0)

/** What the player owns, the free ones included. */
export const ownedSet = (s: GemsStatus | null): ReadonlySet<CosmeticId> => new Set([...(s?.owned ?? []), ...FREE])

/**
 * The look this player brings into an Arena match (its loadout's `look`):
 * the account's, owned items only; nothing for a guest. The relay plays the
 * API's in a queue match, and the shell draws whichever comes back.
 */
export const equippedLook = (): WireLook => {
  const s = knownGems()
  const out: Record<string, string> = {}
  if (!s) return out
  const look = ownedOnly(s.look, ownedSet(s))
  for (const slot of COSMETIC_SLOTS) {
    const id = look[slot]
    if (id) out[slot] = id
  }
  return out
}

/* ---------------- The API ---------------- */

/** `GET /gems`: the account's gems now (and a look changed offline goes up), or null when they can't be read. */
export const fetchGems = async (): Promise<GemsStatus | null> => {
  if (fake) {
    const land = fake.landing
    if (land && land !== 'never' && Date.now() >= land.at) {
      fake.status = { ...fake.status, balance: fake.status.balance + land.gems }
      fake.ledger.unshift({ amount: land.gems, reason: 'pack', ref: 'dev', at: Date.now() })
      fake.landing = null
    }
    notify()
    return fake.status
  }
  if (!gemsSignedIn()) return null
  const res = await apiCall('/gems', { auth: true })
  const status = res.status === 200 ? parseStatus(res.body) : null
  if (!status) return null
  const was = knownGems()
  if (mirror?.pending && was && mirror.user === accountUserId()) {
    remember({ ...status, look: was.look }, true)
    void saveLook(was.look)
  } else remember(status)
  return knownGems()
}

export type CheckoutOpened = { ok: true; url: string } | { ok: false; why: 'busy' | 'banned' | 'offline' }

const PENDING_KEY = 'ps:gemsCheckout'

/** The checkout this device opened last: its pack and the balance before, so the return can tell the gems landed. */
type PendingCheckout = { pack: GemPackId; before: number; at: number }

const keepPending = (p: Omit<PendingCheckout, 'at'>) => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ ...p, at: Date.now() }))
  } catch {
    // Storage blocked: the return compares with the mirror's balance.
  }
}

const dropPending = () => {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    // Storage blocked: nothing was kept.
  }
}

const readPending = (): PendingCheckout | null => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null')
    return isRecord(raw) && typeof raw.before === 'number' && isGemPackId(raw.pack) && typeof raw.at === 'number' ? { pack: raw.pack, before: raw.before, at: raw.at } : null
  } catch {
    return null
  }
}

/**
 * `POST /gems/checkout`: opens a pack's checkout and says where to send the
 * player (Stripe Checkout for `card`, AbacatePay for `pix`). Faking, the
 * checkout "comes back" at once in the page (`?gems=dev-<pack>`).
 */
export const openCheckout = async (pack: GemPackId, method: GemMethod, currency: GemCurrency): Promise<CheckoutOpened> => {
  const before = knownGems()?.balance ?? 0
  if (fake) {
    track('gems_checkout', { pack, method, currency })
    return { ok: true, url: `?gems=${stageCheckout(pack)}` }
  }
  const body: GemCheckoutRequest = { pack, method, currency }
  const res = await apiCall('/gems/checkout', { method: 'POST', body, auth: true })
  if (res.status === 429) return { ok: false, why: 'busy' }
  if (res.status === 403) return { ok: false, why: 'banned' }
  const url = isRecord(res.body) && typeof res.body.url === 'string' ? res.body.url : null
  if (res.status !== 200 || !url) return { ok: false, why: 'offline' }
  keepPending({ pack, before })
  track('gems_checkout', { pack, method, currency })
  return { ok: true, url }
}

export type Bought = { ok: true; status: GemsStatus } | { ok: false; why: 'gems' | 'owned' | 'unsold' | 'busy' | 'banned' | 'offline' }

/** A `POST /gems/buy` answer, or null. */
const parseBought = (v: unknown): GemBuyResponse | null =>
  isRecord(v) && typeof v.balance === 'number' && Array.isArray(v.owned) ? { balance: v.balance, owned: v.owned.filter(isCosmeticId) } : null

/**
 * `POST /gems/buy`: buys a cosmetic with gems. As the API answers: `gems`
 * (402) short of them, `owned` (409) it was already, `unsold` (404) not on
 * sale today, `busy` (429) too many in a row, `banned` (403).
 */
export const buyCosmetic = async (id: CosmeticId): Promise<Bought> => {
  const price = cosmeticPrice(id) ?? 0
  const bought = () => track('cosmetic_buy', { id, slot: slotOf(id), rarity: ARENA_COSMETICS[id].rarity, price })
  if (fake) {
    const s = fake.status
    if (s.owned.includes(id)) return { ok: false, why: 'owned' }
    if (s.balance < price) return { ok: false, why: 'gems' }
    fake.status = { ...s, balance: s.balance - price, owned: [...s.owned, id] }
    fake.ledger.unshift({ amount: -price, reason: 'buy', ref: id, at: Date.now() })
    bought()
    notify()
    return { ok: true, status: fake.status }
  }
  const res = await apiCall('/gems/buy', { method: 'POST', body: { id }, auth: true })
  if (res.status === 402) return { ok: false, why: 'gems' }
  if (res.status === 409) {
    void fetchGems()
    return { ok: false, why: 'owned' }
  }
  if (res.status === 404) return { ok: false, why: 'unsold' }
  if (res.status === 429) return { ok: false, why: 'busy' }
  if (res.status === 403) return { ok: false, why: 'banned' }
  const body = res.status === 200 ? parseBought(res.body) : null
  const was = knownGems()
  if (!body || !was) return { ok: false, why: 'offline' }
  bought()
  remember({ ...was, ...body }, mirror?.pending ?? false)
  return { ok: true, status: knownGems()! }
}

/**
 * Wears `look`: on the device at once (the next match brings it, online or
 * not), then `PUT /gems/look`, whose answer (owned items only) is kept.
 * Offline, it waits on the device and goes up with the next `fetchGems`.
 * True when the API took it.
 */
export const saveLook = async (look: ArenaLook): Promise<boolean> => {
  const was = knownGems()
  if (!was) return false
  if (fake) {
    fake.status = { ...fake.status, look }
    notify()
    return true
  }
  remember({ ...was, look }, true)
  const res = await apiCall('/gems/look', { method: 'PUT', body: { look }, auth: true })
  if (res.status !== 200 || !isRecord(res.body)) return false
  const now = knownGems()
  // A newer change went up meanwhile: its own answer settles it.
  if (!now || !sameLook(now.look, look)) return true
  remember({ ...now, look: parseLook(res.body.look) })
  return true
}

/** A receipt from the API; a reason this build doesn't know reads as a grant. */
const parseReceipt = (v: unknown): GemLedgerEntry | null =>
  isRecord(v) && typeof v.amount === 'number' && typeof v.at === 'number' ? { amount: v.amount, reason: isGemReason(v.reason) ? v.reason : 'grant', ref: typeof v.ref === 'string' ? v.ref : '', at: v.at } : null

/** `GET /gems/ledger`: the account's last 50 receipts, newest first; null when they can't be read. */
export const fetchReceipts = async (): Promise<GemLedgerEntry[] | null> => {
  if (fake) return [...fake.ledger]
  if (!gemsSignedIn()) return null
  const res = await apiCall('/gems/ledger', { auth: true })
  return res.status === 200 && Array.isArray(res.body) ? res.body.flatMap((e) => parseReceipt(e) ?? []) : null
}

/* ---------------- The checkout's return ---------------- */

const RETURN_PARAM = 'gems'

/** The `?gems=<ref>` a checkout came back with (taken off the address, so a reload doesn't wait again), or null. */
export const takeCheckoutReturn = (): string | null => {
  const url = new URL(location.href)
  const ref = url.searchParams.get(RETURN_PARAM)
  if (ref === null) return null
  url.searchParams.delete(RETURN_PARAM)
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
  return ref || null
}

/** How long a return waits for its gems before saying they're on their way (a Pix or a slow webhook can take longer). */
const RETURN_WAIT = { ms: 60_000, fakeMs: 7000 }

export type CheckoutLanded = { outcome: 'ok'; gems: number; balance: number } | { outcome: 'timeout' }

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

/**
 * After a checkout came back: asks `GET /gems` (backing off) until the
 * balance grows past the one before it (the pending checkout's, else the
 * mirror's, else the first answer), or the wait runs out. `alive` false
 * stops it (the screen went).
 */
export const awaitCheckout = async (alive: () => boolean): Promise<CheckoutLanded> => {
  const started = Date.now()
  const pending = readPending()
  const limit = started + (fake ? RETURN_WAIT.fakeMs : RETURN_WAIT.ms)
  let before = pending && started - pending.at < 86_400_000 ? pending.before : (knownGems()?.balance ?? null)
  const report = (landed: CheckoutLanded) => {
    track('gems_return', { outcome: landed.outcome, gems: landed.outcome === 'ok' ? landed.gems : 0, seconds: Math.round((Date.now() - started) / 1000) })
    if (landed.outcome === 'ok') dropPending()
    return landed
  }
  for (let step = 0; Date.now() < limit && alive(); step++) {
    const s = await fetchGems()
    if (s && before === null) before = s.balance
    else if (s && before !== null && s.balance > before) return report({ outcome: 'ok', gems: s.balance - before, balance: s.balance })
    await wait(Math.min(1200 + step * 600, 5000))
  }
  return report({ outcome: 'timeout' })
}

// The hub's profile shows the device's mirror of the look from its first paint.
notify()
