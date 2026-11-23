import { accountHandle, accountUserId } from './account'
import { apiCall } from './api'
import { isRecord } from './game/parse'
import {
  CREATOR_STATUSES,
  normalizeCreatorUrl,
  parseCreatorDesk,
  parseCreatorRequest,
  parseCreatorStatus,
  reviewed,
  type CreatorDesk,
  type CreatorDeskEntry,
  type CreatorLink,
  type CreatorLinksError,
  type CreatorRequest,
  type CreatorReview,
  type CreatorStatus,
} from './net/creatorTag'

/**
 * The game's side of the content creator's tag (`net/creatorTag.ts`): the
 * player's own request (`GET`/`POST /creator`, kept for the page so the
 * Trainer Card draws it without asking again) and the admin desk's queue
 * (`/admin/creators`). Dev builds can fake both (`devCreator`, `ps.creator`):
 * the in-page Realm's own trainer wears the faked tag too (`realmShell.ts`).
 */

/** What the API said about the signed-in account's request, per account; undefined until it said. */
let mine: { userId: string; request: CreatorRequest | null } | null = null

/** Dev: the faked own request (null: none) and desk; undefined while the API answers. */
let fake: { request: CreatorRequest | null; desk: CreatorDesk } | undefined

/** The account's request as last heard this page (null: none or not asked yet). */
export const knownCreator = (): CreatorRequest | null => (fake ? fake.request : mine && mine.userId === accountUserId() ? mine.request : null)

/** The account's approved links, for its own screens (the Realm's trainer, the Trainer Card), or null. */
export const ownCreatorLinks = (): CreatorLink[] | null => {
  const r = knownCreator()
  return r?.status === 'approved' ? r.links : null
}

/** The account's request (null: none), or `offline` when the API can't be reached. */
export const fetchMyCreator = async (): Promise<CreatorRequest | null | 'offline'> => {
  if (fake) return fake.request
  const userId = accountUserId()
  if (!userId) return 'offline'
  const { status, body } = await apiCall('/creator', { auth: true })
  if (status !== 200 || !isRecord(body)) return 'offline'
  const request = parseCreatorStatus(body.request)
  mine = { userId, request }
  return request
}

/** Why a request didn't go: the links' own errors, or the API's (`profile`, `banned`, `open`), or `offline`. */
export type CreatorSendError = CreatorLinksError | { error: 'profile' | 'banned' | 'open' | 'offline' }

/** Sends the links as typed (checked here first, then again by the API). */
export const sendCreatorRequest = async (raw: readonly string[]): Promise<{ ok: true; request: CreatorRequest } | ({ ok: false } & CreatorSendError)> => {
  const parsed = parseCreatorRequest(raw)
  if (!parsed.ok) return parsed
  if (fake) {
    const request: CreatorRequest = { status: 'pending', links: parsed.links, at: new Date().toISOString(), reviewedAt: null }
    fake.request = request
    fake.desk.pending = [...fake.desk.pending.filter((e) => e.userId !== 'dev-you'), { ...request, userId: 'dev-you', handle: accountHandle() ?? 'you', name: null, reviewedBy: null }]
    return { ok: true, request }
  }
  const userId = accountUserId()
  const { status, body } = await apiCall('/creator', { method: 'POST', body: { links: raw }, auth: true })
  const request = status === 200 && isRecord(body) ? parseCreatorStatus(body.request) : null
  if (request && userId) {
    mine = { userId, request }
    return { ok: true, request }
  }
  const error = isRecord(body) ? body.error : null
  if (error === 'profile' || error === 'banned' || error === 'open') return { ok: false, error }
  if (error === 'invalid' && isRecord(body) && typeof body.index === 'number') return { ok: false, error, index: body.index }
  return { ok: false, error: error === 'empty' || error === 'many' ? error : 'offline' }
}

/** The admin's queue, or null when the API can't be reached (or says no). */
export const fetchCreatorDesk = async (): Promise<CreatorDesk | null> => {
  if (fake) return fake.desk
  const { status, body } = await apiCall('/admin/creators', { auth: true })
  return status === 200 ? parseCreatorDesk(body) : null
}

/** Approves, rejects or revokes a request: its new status, `state` (it moved on meanwhile), `unknown`, or null when it didn't go. */
export const reviewCreator = async (userId: string, action: CreatorReview): Promise<CreatorStatus | 'state' | 'unknown' | null> => {
  if (fake) return fakeReview(fake, userId, action)
  const { status, body } = await apiCall(`/admin/creators/${encodeURIComponent(userId)}/${action}`, { method: 'POST', auth: true })
  if (status === 404) return 'unknown'
  if (status === 409) return 'state'
  return status === 200 && isRecord(body) ? (CREATOR_STATUSES.find((s) => s === body.status) ?? null) : null
}

/* ---------------- Dev ---------------- */

const fakeReview = (f: NonNullable<typeof fake>, userId: string, action: CreatorReview) => {
  const all = [...f.desk.pending, ...f.desk.approved]
  const entry = all.find((e) => e.userId === userId)
  if (!entry) return 'unknown'
  const next = reviewed(entry.status, action)
  if (!next) return 'state'
  const moved: CreatorDeskEntry = { ...entry, status: next, reviewedAt: new Date().toISOString(), reviewedBy: accountHandle() ?? 'admin' }
  f.desk = { pending: f.desk.pending.filter((e) => e.userId !== userId), approved: next === 'approved' ? [moved, ...f.desk.approved] : f.desk.approved.filter((e) => e.userId !== userId) }
  if (userId === 'dev-you' && f.request) f.request = { ...f.request, status: next, reviewedAt: moved.reviewedAt }
  return next
}

const link = (url: string): CreatorLink => normalizeCreatorUrl(url) ?? { platform: 'twitch', url: 'https://twitch.tv/dev' }

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()

/** A made-up queue for the desk: three waiting, two approved. */
const fakeDesk = (): CreatorDesk => ({
  pending: [
    { userId: 'dev-ana', handle: 'anaplays', name: 'Ana Plays', status: 'pending', links: [link('twitch.tv/anaplays'), link('youtube.com/@AnaPlaysBR')], at: daysAgo(2), reviewedAt: null, reviewedBy: null },
    { userId: 'dev-kai', handle: 'kaistream', name: 'Kai', status: 'pending', links: [link('kick.com/kaistream')], at: daysAgo(1), reviewedAt: null, reviewedBy: null },
    { userId: 'dev-mei', handle: 'meimei', name: '小美', status: 'pending', links: [link('tiktok.com/@meimei.survivors')], at: daysAgo(0.2), reviewedAt: null, reviewedBy: null },
  ],
  approved: [
    { userId: 'dev-weplay', handle: 'weplayz', name: 'WePlay Z', status: 'approved', links: [link('youtube.com/@WePlay-Z')], at: daysAgo(9), reviewedAt: daysAgo(8), reviewedBy: 'pedro' },
    { userId: 'dev-bird', handle: 'birdseye', name: 'BirdseyeGaming', status: 'approved', links: [link('tiktok.com/@birdseyegames')], at: daysAgo(12), reviewedAt: daysAgo(11), reviewedBy: 'pedro' },
  ],
})

/** Dev: whether `devCreator` fakes the API now. */
export const creatorFaked = () => fake !== undefined

/**
 * Dev (`ps.creator`): fakes the account's request in a state (`'none'`,
 * `'pending'`, `'approved'`, `'rejected'`, `'revoked'`) and the desk's queue,
 * or `'off'` to ask the API again. Returns the faked request.
 */
export const devCreator = (state: CreatorStatus | 'none' | 'off') => {
  if (state === 'off') {
    fake = undefined
    return 'creator: the API again'
  }
  const links = [link(`twitch.tv/${accountHandle() ?? 'you'}`), link(`youtube.com/@${accountHandle() ?? 'you'}`)]
  const request: CreatorRequest | null = state === 'none' ? null : { status: state, links, at: daysAgo(1), reviewedAt: state === 'pending' ? null : daysAgo(0.5) }
  fake = { request, desk: fake?.desk ?? fakeDesk() }
  return request
}
