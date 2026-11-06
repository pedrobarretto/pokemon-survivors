import { accountHandle, accountsEnabled, accountState, signIn } from '../account'
import { track } from '../analytics'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { formatTime } from '../engine/math'
import { dayKey } from '../game/missions'
import { FRIEND_MILESTONES, inviteMomentDue, nextMilestone, REFERRAL, type InvitedFriend } from '../game/referral'
import { formatNumber, t } from '../i18n'
import { eggIcon } from '../render/art'
import { fetchInvites, gameUrl } from '../ranking'
import { h, later, rich } from './dom'
import { contentLine } from './gifts'
import { profileEditor } from './profile'
import { today } from './save'
import { hint, menu, type Screen } from './screens'
import { toast } from './toasts'

/**
 * Convide amigos: the player's invite link (`?ref=handle`), what each
 * milestone of friends brought pays (`FRIEND_MILESTONES`), how an invite
 * counts and the friends who came, with their runs so far. The lobby's card
 * shows the way to the next milestone from the same list.
 */

let invites: { handle: string; list: Promise<InvitedFriend[] | null> } | null = null

/** The player's invited friends, asked once per page (`fresh` asks again). Null offline, for a guest or before a handle. */
export const loadInvites = (fresh = false) => {
  const handle = accountState().kind === 'signedIn' ? accountHandle() : null
  if (!handle) return Promise.resolve(null)
  if (fresh || invites?.handle !== handle) invites = { handle, list: fetchInvites() }
  return invites.list
}

/** How many friends counted, out of a list from `loadInvites`. */
export const countedFriends = (friends: readonly InvitedFriend[] | null) => friends?.filter((f) => f.counted).length ?? 0

/**
 * The lobby's line for the invites (card and tile): how many friends counted
 * toward the next milestone, or the friends still playing their first runs
 * before any counted (`short`: the count alone, for the phone's tile). Null
 * while there's nothing to show past `cardFirst`.
 */
export const invitesLine = (friends: readonly InvitedFriend[] | null) => {
  const m = t().invites
  const counted = countedFriends(friends)
  const pending = (friends?.length ?? 0) - counted
  if (counted === 0) return pending > 0 ? { text: m.cardPending(pending), next: nextMilestone(0), short: null } : null
  const next = nextMilestone(counted)
  return { text: next ? m.cardNext(counted, next.friends) : m.cardAll(counted), next, short: next ? `${formatNumber(counted)}/${formatNumber(next.friends)}` : null }
}

/** The link without its scheme, as it reads on screen. */
const shownUrl = (url: string) => url.replace(/^https?:\/\//, '')

/** Phones and tablets share through the system sheet; computers copy. */
const sheet = () => typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches

/** Sends the link out with `text` before it: the share sheet on phones, the clipboard elsewhere. */
const shareLink = async (root: HTMLElement, url: string, text = t().invites.shareText) => {
  const m = t().invites
  try {
    if (sheet()) {
      await navigator.share({ text: `${text} ${url}` })
      return track('share', { kind: 'invite', method: 'share' })
    }
    await navigator.clipboard.writeText(`${text} ${url}`)
    toast(root, m.copied, 2600)
    track('share', { kind: 'invite', method: 'copy' })
  } catch {
    // Share sheet dismissed, or no clipboard: nothing to undo.
  }
}

/** One step of the reward ladder: its icon, how many friends and what it pays, ticked once reached. */
const milestoneRow = (milestone: (typeof FRIEND_MILESTONES)[number], friends: number) => {
  const m = t().invites
  const reached = friends >= milestone.friends
  return h(
    'li',
    { class: reached ? 'invite-step reached' : 'invite-step' },
    h('img', { src: contentLine({ content: milestone.gifts[0] }).src, alt: '' }),
    h('span', { class: 'invite-step-text' }, h('b', {}, m.milestone(milestone.friends)), h('span', {}, m.reward[milestone.friends])),
    h('em', {}, reached ? '✓' : `${formatNumber(Math.min(friends, milestone.friends))}/${formatNumber(milestone.friends)}`),
  )
}

const friendRow = (f: InvitedFriend) => {
  const m = t().invites
  return h(
    'li',
    { class: f.counted ? 'invite-friend counted' : 'invite-friend' },
    h('span', { class: 'invite-friend-name' }, f.name || (f.handle ? `@${f.handle}` : '?'), f.name && f.handle ? h('small', {}, ` @${f.handle}`) : null),
    h('em', {}, f.counted ? m.counted : m.runs(f.runs, REFERRAL.runs)),
  )
}

const section = (title: string, ...body: Node[]) => h('section', { class: 'invite-section' }, h('h3', {}, title), ...body)

/**
 * The Convide amigos screen. A guest gets the way in (sign in), a player
 * without a handle the way to make one; then the link to share and the list
 * of friends. Back, Esc or Backspace close it and call `onClose` after the
 * key dispatch.
 */
export const invitesScreen = (root: HTMLElement, input: Input, onClose: () => void): Screen => {
  const el = h('div', { class: 'screen dim profile-screen invites-screen' })
  let nav: ReturnType<typeof menu> | null = null
  /** The profile editor, open over this screen. */
  let sub: Screen | null = null
  let friends: InvitedFriend[] | null | 'loading' = 'loading'
  let closed = false

  type Action = { label: string; run: () => void }

  const render = (opening = false) => {
    const m = t().invites
    const s = accountState()
    const handle = s.kind === 'signedIn' ? accountHandle() : null
    const url = handle ? gameUrl(handle) : null
    const list = Array.isArray(friends) ? friends : null
    const count = countedFriends(list)

    const actions: Action[] = [
      ...(url ? [{ label: sheet() ? m.share : m.copy, run: () => void shareLink(root, url) }] : []),
      ...(s.kind === 'guest' ? [{ label: m.signIn, run: () => void signIn() }] : []),
      ...(s.kind === 'signedIn' && !handle ? [{ label: m.createProfile, run: openEditor }] : []),
      { label: m.back, run: close },
    ]

    const head = url
      ? section(m.link, h('button', { class: 'invite-link', type: 'button', onclick: () => void shareLink(root, url) }, h('img', { src: eggIcon('friend'), alt: '' }), h('b', {}, shownUrl(url))))
      : h('p', { class: 'invite-gate' }, h('img', { src: eggIcon('friend'), alt: '' }), h('span', {}, s.kind === 'signedIn' ? m.noHandle : m.guest))

    const people = !handle
      ? null
      : section(
          m.friends,
          friends === 'loading'
            ? h('p', { class: 'invite-note blink' }, m.loading)
            : !list
              ? h('p', { class: 'invite-note' }, m.offline)
              : list.length === 0
                ? h('p', { class: 'invite-note' }, m.noFriends)
                : h('ul', { class: 'invite-friends' }, ...list.map(friendRow)),
        )

    const buttons = actions.map((a) => h('button', { class: 'btn' }, a.label))
    nav?.off()
    nav = menu(input, buttons, (i) => (playSfx('select'), later(actions[i]!.run)), { horizontal: true })
    el.replaceChildren(
      h(
        'div',
        { class: opening ? 'dialog box pop profile invites' : 'dialog box profile invites' },
        h('div', { class: 'dialog-title' }, m.title),
        h(
          'div',
          { class: 'invite-body' },
          head,
          section(m.rewards, h('ol', { class: 'invite-ladder' }, ...FRIEND_MILESTONES.map((ms) => milestoneRow(ms, count)))),
          section(m.how, h('ol', { class: 'invite-how' }, ...m.steps.map((step) => h('li', {}, rich(step)))), h('p', { class: 'invite-tip' }, m.tip)),
          people,
        ),
        h('div', { class: 'buttons' }, ...buttons),
        hint(m.hintKeys, m.hintTouch),
      ),
    )
  }

  const load = async () => {
    friends = 'loading'
    render(true)
    const list = await loadInvites(true)
    if (closed) return
    friends = list
    render()
  }

  const openEditor = () => {
    nav?.off()
    el.classList.add('hidden')
    sub = profileEditor(root, input, () => {
      sub = null
      el.classList.remove('hidden')
      void load()
    })
  }

  const offKeys = input.onKey((key) => !sub && (key === 'Escape' || key === 'Backspace') && close())

  const dispose = () => {
    sub?.dispose()
    nav?.off()
    offKeys()
    el.remove()
  }

  function close() {
    if (closed) return
    closed = true
    playSfx('select')
    dispose()
    later(onClose)
  }

  root.append(el)
  void load()
  return { el, dispose, dim: 0.5 }
}

/* ---------------- The results' nudge ---------------- */

/** The local day the results last asked for an invite (`inviteMomentDue`). */
const ASKED = 'ps:inviteAsked'

const askedOn = () => {
  try {
    return localStorage.getItem(ASKED)
  } catch {
    // Nowhere to remember it: better never to ask than to ask every run.
    return dayKey(today())
  }
}

/** The results' invite, built by `resultsInvite`: its card, its button and what pressing it does (`open` shows a screen over the results). */
export type ResultsInvite = { card: HTMLElement; button: HTMLButtonElement; press: (open: (screen: (back: () => void) => Screen) => void) => void }

/**
 * The results' invite after a win or a new best (`inviteMomentDue`, once a
 * day): what the friend gets and, signed in, the way to the next milestone.
 * Its button shares the link with the run's time as a dare; a guest or a
 * player without a handle gets the Convide amigos screen instead (sign in,
 * make a profile). Null when it isn't the moment; asking marks the day.
 */
export const resultsInvite = (root: HTMLElement, input: Input, run: { won: boolean; time: number; bestBefore: number }): ResultsInvite | null => {
  const day = dayKey(today())
  if (!accountsEnabled || !inviteMomentDue({ ...run, day, askedOn: askedOn() })) return null
  try {
    localStorage.setItem(ASKED, day)
  } catch {}
  const m = t().invites
  const progress = h('small', { class: 'result-invite-next' })
  const button = h('button', { class: 'btn result-invite-button' }, m.endButton)
  const card = h(
    'div',
    { class: 'result-invite' },
    h('img', { src: eggIcon('friend'), alt: '' }),
    h('span', { class: 'result-invite-text' }, rich(run.won ? m.endWin : m.endBest), progress),
    button,
  )
  void loadInvites().then((list) => {
    if (!list) return
    const counted = countedFriends(list)
    const next = nextMilestone(counted)
    if (next) progress.textContent = m.endNext(counted, next.friends, m.reward[next.friends])
  })
  const press: ResultsInvite['press'] = (open) => {
    const handle = accountState().kind === 'signedIn' ? accountHandle() : null
    if (handle) return void shareLink(root, gameUrl(handle), m.dareText(formatTime(run.time)))
    open((back) => invitesScreen(root, input, back))
  }
  return { card, button, press }
}
