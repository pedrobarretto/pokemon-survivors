import type { GiftContent } from './gifts'
import { isRecord, wholeNumber } from './parse'
import { parseDisplayName, parseHandle } from './ranking'

/**
 * Invites: every link the game shares carries the sharer's handle
 * (`?ref=handle`), and a profile link (`?u=handle`) counts too. The first
 * handle a device lands with is kept (first touch), never the player's own,
 * so the sign up can credit whoever brought them. The API decides whether
 * an invite counts and what it pays (`canRefer`, `creditDue`,
 * `milestonesReached`), sent as Mystery Gifts (`gifts.ts`). Pure.
 */

/** Query parameter of the inviter's handle on a shared link. */
export const REF_PARAM = 'ref'

/** The handle a landing brings: `?ref=` first, else the profile it opens (`?u=`). Null when neither is a valid handle. */
export const landingRef = (params: URLSearchParams, profileParam: string) => parseHandle(params.get(REF_PARAM)) ?? parseHandle(params.get(profileParam))

/** The ref to keep: the stored one stays (first touch); a landing never stores the player's own handle. */
export const firstTouch = (stored: string | null, landed: string | null, own: string | null) => stored ?? (landed !== null && landed !== own ? landed : null)

/* ---------------- Rewards (the API counts them) ---------------- */

export const REFERRAL = {
  /**
   * Runs the friend must finish before the invite counts for whoever brought
   * them. A run counts as soon as it's reported, unless its check failed
   * (like the boards), and only if it lasted `minSeconds`.
   */
  runs: 3,
  /**
   * Seconds a run must last, in the game and on the API's clock (start to
   * report), to count: an alt account can't farm invites with runs that end
   * at once.
   */
  minSeconds: 60,
  /** How old an account may be for its sign up to credit an invite. */
  newAccountHours: 48,
} as const

/** What the API knows of a sign up that brings an inviter's handle. */
export type SignUp = {
  userId: string
  /** The inviter's user id, null when nobody has that handle. */
  referrer: string | null
  /** Hours since the account first reached the API. */
  ageHours: number
  /** Whether the account already stored a save (it isn't new to the game). */
  hasSave: boolean
  /** Who already got the credit for this account, if anyone. */
  referredBy: string | null
}

/** An invite counts only for a new account (no save yet, created lately, not credited before), and never for oneself. */
export const canRefer = (s: SignUp) =>
  s.referrer !== null && s.referrer !== s.userId && s.referredBy === null && !s.hasSave && s.ageHours <= REFERRAL.newAccountHours

/** Whether a friend's finished runs now credit their inviter (once). */
export const creditDue = (runs: number, credited: boolean) => !credited && runs >= REFERRAL.runs

/** The newcomer's gift on signing up with an invite: a Friendship Egg. */
export const WELCOME_GIFT: GiftContent = { kind: 'egg', tier: 'friend' }

/** What whoever brings friends earns, by how many have counted, in order (the invite screen shows the ladder). */
export const FRIEND_MILESTONES = [
  { friends: 1, gifts: [{ kind: 'egg', tier: 'friend' }] },
  { friends: 3, gifts: [{ kind: 'title', title: 'ambassador' }, { kind: 'style', style: { slot: 'frame', id: 'ambassador' } }] },
  { friends: 5, gifts: [{ kind: 'egg', tier: 'ultra' }] },
  // Gifts only ever add at the end of a milestone: each one's key is its index (`friends:10:1`), so whoever passed it gets the new ones.
  {
    friends: 10,
    gifts: [
      { kind: 'shinyHatch', family: 'dratini' },
      { kind: 'title', title: 'friendLegend' },
      { kind: 'style', style: { slot: 'background', id: 'friendship' } },
    ],
  },
] as const satisfies readonly { friends: number; gifts: readonly GiftContent[] }[]

export type FriendMilestone = (typeof FRIEND_MILESTONES)[number]

/**
 * The milestones `friends` friends have reached. The API sends each one's
 * gifts under a key per milestone, so sending them all again is harmless and
 * a milestone added later reaches whoever already passed it.
 */
export const milestonesReached = (friends: number): readonly FriendMilestone[] => FRIEND_MILESTONES.filter((m) => m.friends <= friends)

/** The next milestone to reach, null past the last. */
export const nextMilestone = (friends: number): FriendMilestone | null => FRIEND_MILESTONES.find((m) => m.friends > friends) ?? null

/* ---------------- Asking at the right moment ---------------- */

/** A finished run, as the results judge whether to ask for an invite. */
export type RunMoment = {
  won: boolean
  /** Seconds survived, and the player's best before this run (0 before any). */
  time: number
  bestBefore: number
  /** The local day now, and the day the results last asked (null never). */
  day: string
  askedOn: string | null
}

/**
 * Whether the results ask the player to invite a friend: after a win or a
 * new personal best (the first run's doesn't count: every first run is one),
 * at most once a day, so it rides a high and never nags.
 */
export const inviteMomentDue = (r: RunMoment) => r.askedOn !== r.day && (r.won || (r.bestBefore > 0 && r.time > r.bestBefore))

/* ---------------- The inviter's view ---------------- */

/** A friend who signed up with the player's link: their runs so far and whether they counted. */
export type InvitedFriend = { handle: string | null; name: string; runs: number; counted: boolean }

/** Friends listed at most. */
export const MAX_INVITED = 50

/** The friends of `GET /invites`, dropping anything malformed. Null when it isn't a list. */
export const parseInvites = (v: unknown): InvitedFriend[] | null => {
  if (!isRecord(v) || !Array.isArray(v.friends)) return null
  return v.friends.slice(0, MAX_INVITED).flatMap((f: unknown) =>
    isRecord(f) ? [{ handle: parseHandle(f.handle), name: parseDisplayName(f.name) ?? '', runs: wholeNumber(f.runs, REFERRAL.runs), counted: f.counted === true }] : [],
  )
}
