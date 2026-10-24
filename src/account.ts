import type { Clerk } from '@clerk/clerk-js'
import { loadClerkUIScript } from '@clerk/shared/loadClerkJsScript'
import type { ClerkUIConstructor } from '@clerk/shared/types'
import { track } from './analytics'
import { readToken } from './clerkClock'
import { applyGift, giftToOpen, parseGift, type Gift, type GiftOutcome } from './game/gifts'
import { parseSaveData, type Save } from './game/meta'
import { isRecord } from './game/parse'
import type { ProfileName } from './game/ranking'
import { brasiliaDay } from './game/day'
import { gameGifts as madeByGame, isGameGift } from './game/gameGifts'
import { donateFrom } from './game/festival'
import { loadSave, today, writeSave } from './ui/save'
import { timeoutSignal } from './net/timeout'

/**
 * Optional player accounts (Google or Discord through Clerk). Playing as a guest stays
 * the default: the save lives in `localStorage` either way, and an account
 * only mirrors it to the API (`server/`), merging saves with `applyPush`
 * (`game/sync.ts`). Clerk is loaded only when the player signs in, or on
 * boot for a device that already did, so guests never download it.
 *
 * Each sync also lists the Mystery Gifts waiting in the account (`GET /gifts`,
 * opened from the lobby: `openGift`), beside the ones the game makes (its
 * own, and others' sources such as the Festival da Praça's, `addGameGifts`)
 * and, on a device's first sync, the invite it landed with (`POST /referral`).
 * A Discord account connected to the player's (`linkDiscord`, or signing in
 * with Discord) is reported to the API (`POST /discord/link`), which puts
 * them in the community server with their supporter role.
 *
 * It syncs at boot, after a run, from the account screen and whenever the
 * game comes back to the foreground (`startAccount`), and tells the shell
 * when a sync brought another device's progress (`onSaveSynced`).
 *
 * Nothing here may block the game: offline, a missing API or a Clerk outage
 * just leave the save local and the sync status `offline`.
 */

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
/** Base URL of the API (`server/`), without a trailing slash. */
export const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

/** Without both keys the account button doesn't show and the game is guest only. */
export const accountsEnabled = Boolean(PUBLISHABLE_KEY && API_URL)

/** Query parameter of the page Google (or Discord) sends the player back to after signing in. */
const CALLBACK = 'login'

/** Query parameter of the page Discord sends the player back to after connecting it to their account. */
const DISCORD_CALLBACK = 'discord'

const TIMEOUT_MS = 12_000

/** Coming back to the game syncs again once this long (ms) has passed since the last sync began. */
const RESUME_GAP_MS = 30_000

/** True while the page is the one Google or Discord sent the player back to: boot skips the "press start" intro. */
export const backFromSignIn = () => accountsEnabled && (new URLSearchParams(location.search).has(CALLBACK) || new URLSearchParams(location.search).has(DISCORD_CALLBACK))

export type SyncStatus = 'syncing' | 'synced' | 'offline'

/**
 * `failed`: the last sign in didn't go through. `handle`: the player's public
 * handle, null before they pick one, undefined until the API said.
 * `discord`: the username of the Discord account connected to theirs, null
 * when none is, undefined until Clerk said; `discordFailed`: connecting one
 * just didn't go through (cancelled, or it belongs to another account).
 */
export type AccountState =
  | { kind: 'guest'; failed?: boolean }
  | { kind: 'busy' }
  | { kind: 'signedIn'; name: string; sync: SyncStatus; handle: string | null | undefined; discord: string | null | undefined; discordFailed?: boolean }

/* ---------------- Device link ---------------- */

const LINK_KEY = 'ps:account'

/**
 * This device's account: who signed in, the revision of the account's save it
 * last got (null until its first sync), which pushes build on, the public
 * handle and the Discord username the API last heard of (see `AccountState`).
 * `name` is the profile's display name once there is one. `discordAccount`:
 * the id of the Clerk connection that username came from, which tells a
 * Discord account connected or removed since (Clerk may leave its username empty).
 */
type Link = { userId: string; name: string; revision: number | null; handle?: string | null; discord?: string | null; discordAccount?: string | null }

const readLink = (): Link | null => {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(LINK_KEY) ?? 'null')
    if (!isRecord(data) || typeof data.userId !== 'string') return null
    return {
      userId: data.userId,
      name: typeof data.name === 'string' ? data.name : '',
      revision: typeof data.revision === 'number' ? data.revision : null,
      handle: typeof data.handle === 'string' || data.handle === null ? data.handle : undefined,
      discord: typeof data.discord === 'string' || data.discord === null ? data.discord : undefined,
      discordAccount: typeof data.discordAccount === 'string' || data.discordAccount === null ? data.discordAccount : undefined,
    }
  } catch {
    return null
  }
}

const writeLink = (link: Link | null) => {
  try {
    if (link) localStorage.setItem(LINK_KEY, JSON.stringify(link))
    else localStorage.removeItem(LINK_KEY)
  } catch {
    // Storage blocked: the device just syncs as a fresh sign in next time.
  }
}

/* ---------------- Invite ---------------- */

const REF_KEY = 'ps:ref'

/** The first inviter's handle this device landed with (`captureRef` in `ranking.ts`), for the first sign in to credit. */
export const storedRef = () => {
  try {
    return localStorage.getItem(REF_KEY)
  } catch {
    return null
  }
}

export const storeRef = (handle: string) => {
  try {
    localStorage.setItem(REF_KEY, handle)
  } catch {
    // Storage blocked: the invite just isn't remembered.
  }
}

/* ---------------- State ---------------- */

let state: AccountState = { kind: 'guest' }
const listeners = new Set<(s: AccountState) => void>()

export const accountState = () => state

/** The signed-in player's user id, from this device's link (null for guests). */
export const accountUserId = () => readLink()?.userId ?? null

/** This device's public handle, known from its link even before Clerk loads (null for guests or before one is picked). */
export const accountHandle = () => {
  const s = state
  return s.kind === 'signedIn' && s.handle ? s.handle : (readLink()?.handle ?? null)
}

/** Calls `fn` on every change of the account state. Returns the unsubscribe. */
export const onAccountChange = (fn: (s: AccountState) => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

const setState = (next: AccountState) => {
  state = next
  listeners.forEach((fn) => fn(state))
}

const setSync = (sync: SyncStatus) => state.kind === 'signedIn' && setState({ ...state, sync })

const savedListeners = new Set<() => void>()

/** Calls `fn` whenever a sync changed the local save (another device's progress came in), for the screens to show it. Returns the unsubscribe. */
export const onSaveSynced = (fn: () => void) => {
  savedListeners.add(fn)
  return () => void savedListeners.delete(fn)
}

/** Writes `save` as if a sync brought it from another device (the dev helpers stage one with it). */
export const stageSyncedSave = (save: Save) => {
  writeSave(save)
  savedListeners.forEach((fn) => fn())
}

/* ---------------- Clerk ---------------- */

const withTimeout = <T>(promise: Promise<T>) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))])

let clerk: Promise<Clerk> | null = null

declare global {
  interface Window {
    /** Set by Clerk's UI script (`loadClerkUIScript`). */
    __internal_ClerkUICtor?: ClerkUIConstructor
  }
}

/**
 * Clerk's prebuilt UI, from Clerk's CDN like their React SDK does. The game
 * draws its own screens; it's here for the modals Clerk opens itself, such as
 * the reverification before linking Discord. It loads beside Clerk, never
 * blocking it, and a failed load (a blocker, a dropped connection) is tried
 * once more: Clerk takes this promise once, so a later retry couldn't reach
 * it. If both fail, only Clerk's modals are out (`isClerkLoadFailure` in
 * `analytics.ts` keeps it out of the error reports).
 */
const loadClerkUI = (): Promise<ClerkUIConstructor> => {
  const once = () => loadClerkUIScript({ publishableKey: PUBLISHABLE_KEY! }).then(() => window.__internal_ClerkUICtor ?? Promise.reject(new Error('no Clerk UI')))
  return once().catch(once)
}

/** Clerk, loaded on first use (its own chunk). A failed load can be retried. */
const loadClerk = () =>
  (clerk ??= withTimeout(
    import('@clerk/clerk-js').then(async ({ Clerk }) => {
      const instance = new Clerk(PUBLISHABLE_KEY!)
      await instance.load({ ui: { ClerkUI: loadClerkUI() } })
      return instance
    }),
  ).catch((err: unknown) => {
    clerk = null
    throw err
  }))

/** What the account screen calls the player: their first name, else their email's name. */
const displayName = (c: Clerk) => c.user?.firstName || c.user?.fullName || c.user?.primaryEmailAddress?.emailAddress.split('@')[0] || ''

const pageUrl = () => `${location.origin}${location.pathname}`

/** Dev builds: `localStorage['ps:devToken']` stands in for Clerk's token, against a local API that accepts it. */
const devToken = () => (import.meta.env.DEV ? localStorage.getItem('ps:devToken') : null)

/** How far Clerk's clock runs ahead of this device's (seconds), as the tokens tell (`readToken`). */
let clerkOffset: number | null = null

/** Whether a token is spent by Clerk's clock, learning that clock from it. */
const spent = (token: string) => {
  const read = readToken(token, clerkOffset, Date.now() / 1000)
  clerkOffset = read.offset
  return read.spent
}

/**
 * The session's token for the API (dev builds: `devToken`). Clerk's cache is
 * fooled by a device clock running behind (`clerkClock.ts`), so a token spent
 * by Clerk's clock is fetched again, past the cache.
 */
const apiToken = async (c: Clerk) => {
  const dev = devToken()
  if (dev) return dev
  const cached = await c.session?.getToken()
  if (!cached || !spent(cached)) return cached ?? null
  const fresh = await c.session?.getToken({ skipCache: true })
  if (fresh) spent(fresh)
  return fresh ?? null
}

/** The signed-in player's session token for the API, or null for guests and when Clerk can't load. Never throws. */
export const sessionToken = async () => {
  if (!accountsEnabled || !readLink()) return null
  // Dev builds against a local API: no Clerk needed for the stand-in token.
  const dev = devToken()
  if (dev) return dev
  try {
    return await apiToken(await loadClerk())
  } catch {
    return null
  }
}

/* ---------------- Sync ---------------- */

/** The API's answer to a push: what the account stores now. */
const parsePushed = (body: unknown) =>
  isRecord(body) && typeof body.revision === 'number' && isRecord(body.save)
    ? { save: parseSaveData(body.save), revision: body.revision, merged: body.merged === true }
    : null

/**
 * Sends the local save on top of the revision this device last got and keeps
 * what the account stored. If the save changed locally while the request was
 * out (a purchase, a hatch), the local one stays: it already builds on what
 * was sent when the account took it as is, and otherwise the next push merges.
 */
const push = async (c: Clerk, link: Link) => {
  const token = await apiToken(c)
  if (!token) throw new Error('no session')
  const sent = JSON.stringify(loadSave())
  const res = await fetch(`${API_URL}/save`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ save: JSON.parse(sent), base: link.revision }),
    signal: timeoutSignal(TIMEOUT_MS),
  })
  const pushed = res.ok ? parsePushed(await res.json()) : null
  if (!pushed) throw new Error(`push failed: ${res.status}`)
  const unchanged = JSON.stringify(loadSave()) === sent
  if (unchanged) writeSave(pushed.save)
  if (unchanged || !pushed.merged) writeLink({ ...link, revision: pushed.revision })
  if (unchanged && JSON.stringify(pushed.save) !== sent) savedListeners.forEach((fn) => fn())
}

/** Makes this device the signed-in user's, keeping its revision and profile if it was theirs already. */
const relink = (c: Clerk, user: NonNullable<Clerk['user']>) => {
  const was = readLink()
  const same = was?.userId === user.id
  const name = same && was.handle ? was.name : displayName(c)
  if (!same) setInbox([])
  writeLink({ userId: user.id, name, revision: same ? was.revision : null, handle: same ? was.handle : undefined, discord: same ? was.discord : undefined, discordAccount: same ? was.discordAccount : undefined })
  setState({ kind: 'signedIn', name, sync: 'syncing', handle: same ? was.handle : undefined, discord: same ? was.discord : undefined })
}

/** Keeps a profile (or its absence) in the link and the state; a profile's name replaces Google's. */
const setProfile = (profile: ProfileName | null) => {
  const saved = readLink()
  if (!saved) return
  const name = profile?.name ?? saved.name
  writeLink({ ...saved, name, handle: profile?.handle ?? null })
  if (state.kind === 'signedIn') setState({ ...state, name, handle: profile?.handle ?? null })
}

/** Asks the API for the player's profile once per device link (`handle` undefined). A failure just asks again next sync. */
const loadProfile = async (token: string) => {
  if (readLink()?.handle !== undefined) return
  try {
    const res = await fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${token}` }, signal: timeoutSignal(TIMEOUT_MS) })
    const body: unknown = res.ok ? await res.json() : null
    if (!isRecord(body)) throw new Error(`profile failed: ${res.status}`)
    const p = body.profile
    setProfile(isRecord(p) && typeof p.handle === 'string' && typeof p.name === 'string' ? { handle: p.handle, name: p.name } : null)
  } catch (err) {
    console.warn('profile failed', err)
  }
}

/** What saving a profile came to: `taken` brings a free handle to suggest (null if none). */
export type ProfileSaved = { ok: true } | { ok: false; reason: 'taken'; suggestion: string | null } | { ok: false; reason: 'invalid' | 'offline' }

/** Sets the player's public handle and display name (`PUT /me`). Never throws. */
export const saveProfile = async (profile: ProfileName): Promise<ProfileSaved> => {
  const token = await sessionToken()
  if (!token) return { ok: false, reason: 'offline' }
  try {
    const res = await fetch(`${API_URL}/me`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
      signal: timeoutSignal(TIMEOUT_MS),
    })
    const body: unknown = await res.json().catch(() => null)
    if (res.status === 409) return { ok: false, reason: 'taken', suggestion: isRecord(body) && typeof body.suggestion === 'string' ? body.suggestion : null }
    if (res.status === 400) return { ok: false, reason: 'invalid' }
    if (!res.ok) return { ok: false, reason: 'offline' }
    setProfile(profile)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'offline' }
  }
}

/** The name Google gave the account, to suggest a handle and display name from. */
export const accountRealName = async () => {
  try {
    const c = await loadClerk()
    return c.user?.fullName || displayName(c)
  } catch {
    return readLink()?.name ?? ''
  }
}

/** Links this device to the signed-in user and syncs. */
const link = (c: Clerk) => {
  if (!c.user) return setState({ kind: 'guest' })
  relink(c, c.user)
  return syncSave()
}

/**
 * A device's first sync for an account brings the invite it landed with,
 * before the save goes up: the API counts it only for an account with no
 * save yet (`canRefer`). Any answer is final; no connection tries next time.
 */
const sendReferral = async (token: string) => {
  const ref = storedRef()
  if (!ref || readLink()?.revision !== null) return
  try {
    const res = await fetch(`${API_URL}/referral`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref }),
      signal: timeoutSignal(TIMEOUT_MS),
    })
    const body: unknown = res.ok ? await res.json() : null
    if (isRecord(body) && body.referred === true) track('ref_signup', { ref })
  } catch (err) {
    console.warn('referral failed', err)
  }
}

/* ---------------- Discord ---------------- */

/** The Discord account connected to the Clerk user, once its connection finished, or null. */
const discordOf = (user: NonNullable<Clerk['user']>) =>
  user.externalAccounts.find((a) => a.provider === 'discord' && a.verification?.status === 'verified') ?? null

/** Keeps the Discord username (or its absence) and the Clerk connection it came from in the link and the state. */
const setDiscord = (discord: string | null, account: string | null, failed = false) => {
  const saved = readLink()
  if (saved) writeLink({ ...saved, discord, discordAccount: account })
  if (state.kind === 'signedIn') setState({ ...state, discord, discordFailed: failed })
}

/**
 * Tells the API about a change of the player's Discord account (connected in
 * the game, by signing in with Discord, or removed in Clerk's account page):
 * a new one gets linked (`POST`, which joins the server and answers the
 * username, asked of Discord itself), a removed one forgotten (`DELETE`).
 * A failure leaves the link as it was, to try again next sync.
 */
const syncDiscord = async (c: Clerk, token: string) => {
  if (!c.user) return
  const account = discordOf(c.user)
  const known = readLink()?.discordAccount
  if ((account?.id ?? null) === known) return
  if (!account && known === undefined) return setDiscord(null, null)
  try {
    const res = await fetch(`${API_URL}/discord/link`, { method: account ? 'POST' : 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: timeoutSignal(TIMEOUT_MS) })
    if (!res.ok) throw new Error(`discord link failed: ${res.status}`)
    const body: unknown = await res.json()
    const username = isRecord(body) && typeof body.username === 'string' && body.username ? body.username : account ? account.username || 'Discord' : null
    setDiscord(username, account?.id ?? null)
  } catch (err) {
    console.warn('discord link failed', err)
  }
}

/**
 * "Link Discord": connects a Discord account to the signed-in player's
 * (Clerk's `createExternalAccount`) and leaves for Discord, which sends them
 * back to `?discord`, where the next sync links it. A guest signs in with
 * Discord instead, which creates the account and connects it at once.
 * Resolves false when it couldn't leave.
 */
export const linkDiscord = async (): Promise<boolean> => {
  const failed = () => {
    if (state.kind === 'signedIn') setState({ ...state, discordFailed: true })
    return false
  }
  try {
    const c = await loadClerk()
    if (!c.user) {
      await signIn('discord')
      return true
    }
    // Connected already (the API didn't take it yet): linking is a sync away.
    if (discordOf(c.user)) {
      const token = await apiToken(c)
      if (token) await syncDiscord(c, token)
      return state.kind === 'signedIn' && state.discord ? true : failed()
    }
    const redirectUrl = `${pageUrl()}?${DISCORD_CALLBACK}`
    // A connection left halfway (cancelled on Discord) is retried rather than added again.
    const unfinished = c.user.externalAccounts.find((a) => a.provider === 'discord' && a.verification?.status !== 'verified')
    const account = await (unfinished ? unfinished.reauthorize({ redirectUrl }) : c.user.createExternalAccount({ strategy: 'oauth_discord', redirectUrl })).catch(
      (err: unknown) => {
        if (!needsReverification(err)) throw err
        // Connecting an account is a sensitive action: Clerk's own modal confirms it's them (a code by email), then it goes on.
        c.__internal_openReverification({ afterVerification: () => void linkDiscord(), afterVerificationCancelled: failed })
        return null
      },
    )
    if (!account) return true
    const to = account.verification?.externalVerificationRedirectURL
    if (!to) throw new Error('no redirect')
    location.assign(to.href)
    return true
  } catch (err) {
    console.warn('discord link failed', err)
    return failed()
  }
}

/** Whether Clerk refused an action until the player proves it's them again (`session_reverification_required`). */
const needsReverification = (err: unknown) =>
  isRecord(err) && Array.isArray(err.errors) && err.errors.some((e: unknown) => isRecord(e) && e.code === 'session_reverification_required')

/** Back from Discord (`?discord`): cleans the URL and syncs now, which links the account; a connection that didn't finish says so. */
const finishDiscord = async () => {
  history.replaceState(null, '', pageUrl())
  await syncSave()
  try {
    const c = await loadClerk()
    if (c.user && !discordOf(c.user) && c.user.externalAccounts.some((a) => a.provider === 'discord')) setDiscord(null, null, true)
  } catch {
    // Offline: the next sync tries again.
  }
}

/* ---------------- Mystery Gifts ---------------- */

/**
 * The account's unopened gifts, oldest first, as the last sync listed them.
 * They wait in the API's inbox until the player opens them from the lobby's
 * gift box (`openGift`), so a gift that arrives mid-run waits for the lobby
 * and a reload loses nothing.
 */
let inbox: Gift[] = []

const inboxListeners = new Set<(gifts: readonly Gift[]) => void>()

/** More sources of game-made gifts (`addGameGifts`): the Festival da Praça's (`festival.ts`). */
const gameGiftSources: Array<() => readonly Gift[]> = []

/**
 * Gifts the game makes itself, for guests too: the Noite das Bruxas candy
 * jar's rewards and the Kecleon Shop's loyalty card and Department Store
 * (`game/gameGifts.ts`), worked out from the save, so they never touch the
 * API, and those of the sources added with `addGameGifts`.
 */
const gameGifts = () => [...madeByGame(loadSave(), brasiliaDay(today())), ...gameGiftSources.flatMap((source) => source())]

/**
 * Adds a source of game-made gifts (ids `isGameGift` knows, never claimed in
 * the API) to the gift box. It's asked whenever the box is; call
 * `refreshInbox` when what it gives changes.
 */
export const addGameGifts = (source: () => readonly Gift[]) => {
  gameGiftSources.push(source)
  refreshInbox()
}

/** Tells the gift box's listeners that what waits changed (a game-made source has new gifts). */
export const refreshInbox = () => setInbox(inbox)

/** The gifts waiting to be opened: the account's, then the game's own. */
export const giftInbox = (): readonly Gift[] => [...inbox, ...gameGifts()]

const setInbox = (gifts: Gift[]) => {
  inbox = gifts
  const waiting = giftInbox()
  inboxListeners.forEach((fn) => fn(waiting))
}

/** The gift to open next (`giftToOpen`). */
export const nextGift = () => giftToOpen(loadSave(), giftInbox())

/** Calls `fn` whenever the gifts waiting to be opened change. Returns the unsubscribe. */
export const onInbox = (fn: (gifts: readonly Gift[]) => void) => {
  inboxListeners.add(fn)
  return () => void inboxListeners.delete(fn)
}

/** Marks gifts claimed in the API. Failing is harmless: the save keeps their ids, and the next sync claims them again. */
const claimGifts = async (ids: readonly string[], token?: string | null) => {
  const auth = token ?? (await sessionToken())
  if (!auth || ids.length === 0) return
  await fetch(`${API_URL}/gifts/claim`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
    signal: timeoutSignal(TIMEOUT_MS),
  }).catch(() => {})
}

/**
 * Opens the waiting gift `id`: applies it to the save (`applyGift`), takes it
 * out of the inbox and marks it claimed (an API gift). A gift the save
 * already has just leaves; one that can't land yet (an egg with the
 * incubator full) stays. Null for an id that isn't waiting.
 */
export const openGift = (id: string): GiftOutcome | null => {
  const gift = giftInbox().find((g) => g.id === id)
  if (!gift) return null
  const out = applyGift(loadSave(), gift)
  if (out.status === 'wait') return out
  if (out.status === 'applied') writeSave(out.save)
  setInbox(inbox.filter((g) => g.id !== id))
  // The game's own gifts aren't the API's to claim.
  if (!isGameGift(id)) void claimGifts([id])
  if (out.status === 'applied') void syncSave()
  return out
}

/** Puts gifts in the inbox as if a sync listed them (the dev helpers stage gifts with it). */
export const stageGifts = (gifts: readonly Gift[]) => setInbox([...inbox.filter((g) => !gifts.some((n) => n.id === g.id)), ...gifts])

/**
 * Lists the account's unclaimed gifts into the inbox. The ones the save
 * already applied (their claim failed) are claimed again instead; a kind
 * this build doesn't know stays in the API for a newer one. Never throws.
 */
const fetchGifts = async (token: string) => {
  try {
    const res = await fetch(`${API_URL}/gifts`, { headers: { Authorization: `Bearer ${token}` }, signal: timeoutSignal(TIMEOUT_MS) })
    const body: unknown = res.ok ? await res.json() : null
    if (!isRecord(body) || !Array.isArray(body.gifts)) return
    const gifts = body.gifts.flatMap((g: unknown) => parseGift(g) ?? [])
    const applied = loadSave().gifts
    await claimGifts(gifts.filter((g) => applied.includes(g.id)).map((g) => g.id), token)
    // Staged ones (dev) stay; the API's list replaces the rest.
    setInbox([...gifts.filter((g) => !applied.includes(g.id)), ...inbox.filter((g) => g.id.startsWith('dev-'))])
  } catch (err) {
    console.warn('gifts failed', err)
  }
}

let syncing = false
let again = false
/** When the last sync began (`performance.now()`), for `RESUME_GAP_MS`. */
let lastSync = -Infinity

/**
 * Pushes the local save to the account, when signed in (end of a run, boot,
 * the account screen). Calls during a sync queue one more. Never throws. A
 * banned account's push answers 403: the save just stays on the device, as
 * offline, until the next sync asks again.
 */
export const syncSave = async () => {
  if (syncing) return void (again = true)
  syncing = true
  do {
    again = false
    lastSync = performance.now()
    const saved = readLink()
    if (!accountsEnabled || !saved) break
    setSync('syncing')
    try {
      const c = await loadClerk()
      // Clerk's session rules: signed out elsewhere goes back to guest, another user takes the device.
      if (!c.user) {
        writeLink(null)
        setInbox([])
        setState({ kind: 'guest' })
        break
      }
      if (c.user.id !== saved.userId) relink(c, c.user)
      const token = await apiToken(c)
      if (token) await sendReferral(token)
      await push(c, readLink() ?? saved)
      setSync('synced')
      if (token) {
        await loadProfile(token)
        await syncDiscord(c, token)
        await fetchGifts(token)
      }
    } catch (err) {
      console.warn('account sync failed', err)
      setSync('offline')
    }
  } while (again)
  syncing = false
}

/** Resolves once no sync is running, after asking for one (a sync already running only queues another). */
const synced = async () => {
  await syncSave()
  while (syncing) await new Promise((resolve) => setTimeout(resolve, 200))
}

/**
 * What a festival donation came to: the API's refusal (`DonateError` in
 * `server/src/festival.ts`: `closed`, `profile`, `runs`, `cap`, `funds`,
 * `nosave`, `stale`, or `rate` past its limit), `guest` without an account,
 * `offline` when it couldn't ask. `held`: it waits for the admin before
 * counting; `today`: ₽ given today, the cap's count.
 */
export type FestivalDonation = { ok: true; held: boolean; today: number } | { ok: false; error: string }

/** One `POST /festival/donate` on top of this device's revision; keeps the save it brings back. */
const donateOnce = async (amount: number): Promise<FestivalDonation> => {
  const link = readLink()
  const token = await sessionToken()
  if (!link || !token) return { ok: false, error: 'offline' }
  const before = JSON.stringify(loadSave())
  const res = await fetch(`${API_URL}/festival/donate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, base: link.revision }),
    signal: timeoutSignal(TIMEOUT_MS),
  })
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) return { ok: false, error: res.status === 429 ? 'rate' : isRecord(body) && typeof body.error === 'string' ? body.error : 'offline' }
  const done = parsePushed(body)
  if (!done || !isRecord(body)) return { ok: false, error: 'offline' }
  // The stored save was this device's as of `base`: kept as is, unless the save changed meanwhile, which then takes the same donation.
  writeSave(JSON.stringify(loadSave()) === before ? done.save : donateFrom(loadSave(), amount))
  writeLink({ ...(readLink() ?? link), revision: done.revision })
  savedListeners.forEach((fn) => fn())
  return { ok: true, held: body.held === true, today: typeof body.today === 'number' ? body.today : 0 }
}

/**
 * Puts `amount` ₽ in the Festival da Praça's pot (`POST /festival/donate`).
 * Only the API takes ₽, from the save it stores, so this syncs first (₽ that
 * never synced can't go) and once more if another device pushed in between
 * (`stale`). The API's answer becomes the local save. Never throws.
 */
export const donateToFestival = async (amount: number): Promise<FestivalDonation> => {
  if (!accountsEnabled || !readLink()) return { ok: false, error: 'guest' }
  try {
    await synced()
    const first = await donateOnce(amount)
    if (first.ok || first.error !== 'stale') return first
    await synced()
    return await donateOnce(amount)
  } catch (err) {
    console.warn('festival donation failed', err)
    return { ok: false, error: 'offline' }
  }
}

/* ---------------- Sign in and out ---------------- */

/**
 * "Sign in with Google" (or Discord): leaves for the provider and comes back
 * to this page (`?login`), where `startAccount` finishes it. Already signed
 * in to Clerk (another tab), it just links this device.
 */
export const signIn = async (provider: 'google' | 'discord' = 'google') => {
  setState({ kind: 'busy' })
  try {
    const c = await loadClerk()
    if (c.user) return await link(c)
    if (!c.client) throw new Error('no client')
    // Both back to `?login`, so the device always gets linked, however Clerk finishes.
    const back = `${pageUrl()}?${CALLBACK}`
    await c.client.signIn.authenticateWithRedirect({ strategy: `oauth_${provider}`, redirectUrl: back, redirectUrlComplete: back })
  } catch (err) {
    console.warn('sign in failed', err)
    setState({ kind: 'guest', failed: true })
  }
}

/** Signs out of the account. The progress stays on this device, playing as a guest. */
export const signOut = async () => {
  setState({ kind: 'busy' })
  writeLink(null)
  setInbox([])
  try {
    await (await loadClerk()).signOut()
  } catch (err) {
    console.warn('sign out failed', err)
  }
  setState({ kind: 'guest' })
}

/**
 * Where the callback sends a sign in that needs more than Google (Clerk
 * Protect's bot check, a sign up missing a field, a code by email): the
 * matching page of Clerk's Account Portal, which finishes it and comes back.
 */
const portalSteps = (portal: string) => ({
  signInUrl: `${portal}/sign-in`,
  signUpUrl: `${portal}/sign-up`,
  firstFactorUrl: `${portal}/sign-in/factor-one`,
  secondFactorUrl: `${portal}/sign-in/factor-two`,
  resetPasswordUrl: `${portal}/sign-in/reset-password`,
  signInProtectCheckUrl: `${portal}/sign-in/protect-check`,
  continueSignUpUrl: `${portal}/sign-up/continue`,
  verifyEmailAddressUrl: `${portal}/sign-up/verify-email-address`,
  verifyPhoneNumberUrl: `${portal}/sign-up/verify-phone-number`,
  signUpProtectCheckUrl: `${portal}/sign-up/protect-check`,
})

/**
 * True when a new Google account comes back to a sign up stuck at Protect's
 * bot check past its deadline (5 minutes). An attempt that never finished
 * keeps that sign up on the client, Clerk doesn't reissue its check, and the
 * callback sends every new attempt to it before creating a fresh sign up.
 */
const staleSignUp = (c: Clerk) => {
  const expiresAt = c.client?.signUp.protectCheck?.expiresAt
  return expiresAt !== undefined && expiresAt < Date.now() && c.client?.signIn.firstFactorVerification.status === 'transferable'
}

/** Turns the sign in Google just finished into a new sign up: done, it signs in; otherwise the callback takes it on (a fresh check, a missing step). */
const freshSignUp = async (c: Clerk, callback: () => Promise<unknown>) => {
  if (!c.client) return
  const signUp = await withTimeout(c.client.signUp.create({ transfer: true }))
  if (signUp.createdSessionId) await c.setActive({ session: signUp.createdSessionId })
  else await callback()
}

/** Back from Google: completes the sign in (or sign up), cleans the URL and links the device. */
const finishSignIn = async () => {
  setState({ kind: 'busy' })
  const home = pageUrl()
  let leaving = false
  try {
    const c = await loadClerk()
    const portal = new URL(c.buildSignInUrl()).origin
    // Pages of this site just replace the URL; the Account Portal is left for, and sends the player back to `?login`.
    const navigate = async (to: string) => {
      const url = new URL(to, location.href)
      if (url.origin === location.origin) return history.replaceState(null, '', url)
      url.searchParams.set('redirect_url', `${home}?${CALLBACK}`)
      leaving = true
      location.assign(url)
    }
    const callback = () =>
      withTimeout(c.handleRedirectCallback({ ...portalSteps(portal), signInForceRedirectUrl: home, signUpForceRedirectUrl: home }, navigate)).catch((err: unknown) =>
        console.warn('sign in callback', err),
      )
    // Whatever the callback says, a session in place means the player is in (back from the portal, it already is).
    if (!c.user) {
      if (staleSignUp(c)) await freshSignUp(c, callback)
      else await callback()
    }
    if (leaving) return
    if (!c.user) throw new Error('not signed in')
    await link(c)
  } catch (err) {
    console.warn('sign in failed', err)
    setState({ kind: 'guest', failed: true })
  } finally {
    if (!leaving && location.search.includes(CALLBACK)) history.replaceState(null, '', home)
  }
}

/**
 * Syncs when the game comes back to the foreground (another tab, an app
 * switch, a PWA reopened from the background), so progress made on another
 * device shows up without a reload. Signed in only, at most once per
 * `RESUME_GAP_MS`, and only while `allowed` (the shell holds it off during a run,
 * which syncs when it ends).
 */
const syncOnResume = (allowed: () => boolean) => {
  // The page just loaded: boot's own sync (or the sign in) goes first.
  lastSync = performance.now()
  const resume = () => {
    if (document.visibilityState !== 'visible' || !readLink() || !allowed() || performance.now() - lastSync < RESUME_GAP_MS) return
    void syncSave()
  }
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('pageshow', (e) => e.persisted && resume())
  window.addEventListener('focus', resume)
}

/**
 * Boot: finishes a sign in coming back from Google or Discord, or, on a
 * device that signed in before, shows the account right away and syncs once
 * Clerk has loaded in the background (after the game's own assets). Back
 * from connecting Discord, it syncs at once. From then on, coming back to the
 * game syncs too, while `allowed` (`syncOnResume`).
 */
export const startAccount = (allowed: () => boolean) => {
  if (!accountsEnabled) return
  syncOnResume(allowed)
  if (new URLSearchParams(location.search).has(CALLBACK)) return void finishSignIn()
  const saved = readLink()
  if (!saved) return
  setState({ kind: 'signedIn', name: saved.name, sync: 'syncing', handle: saved.handle, discord: saved.discord })
  if (new URLSearchParams(location.search).has(DISCORD_CALLBACK)) return void finishDiscord()
  setTimeout(() => void syncSave(), 3000)
}
