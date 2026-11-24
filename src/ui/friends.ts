import { accountHandle, accountState, accountsEnabled } from '../account'
import { askSignIn } from './account'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { parseHandlePrefix, type CoopInvite, type FriendList, type FriendPresence, type PlayerMatch } from '../game/friends'
import type { ProfileName } from '../game/ranking'
import { t } from '../i18n'
import { declineRequest, fetchFriends, follow, inviteFriend, onPresence, presenceView, searchPlayers, setAppearOffline, unfollow, unfriend } from '../net/friends'
import { coopIcon } from '../render/art'
import { h, later, rich } from './dom'
import { profileEditor } from './profile'
import { confirmDialog, hint, menu, type Screen } from './screens'
import { toast } from './toasts'

/**
 * Amigos: friends are mutual follows (following someone sends a request,
 * following back accepts it). Three tabs: the friends with their presence
 * (from the heartbeats, `net/friends.ts`) and, from a co-op room, an invite
 * each; the requests both ways; and a search by @handle. Guests get the way
 * in (sign in), a player without a handle the profile editor. Every call
 * fails soft: the API may not have these endpoints yet, and the screen says
 * so without holding anything up.
 */

type Tab = 'friends' | 'requests' | 'add'

const TABS: readonly Tab[] = ['friends', 'requests', 'add']

/** One button on a row (or the footer), in the arrows' tour. */
type Action = { label: string; run: () => void; primary?: boolean }

/** The room to invite friends into (a co-op room the player is in), or null: no invite buttons. */
export type FriendsOptions = { room: () => string | null; onClose: () => void }

/** Online first, then by name. */
const byPresence = (seen: (handle: string) => FriendPresence | undefined) => (a: ProfileName, b: ProfileName) =>
  Number(seen(b.handle)?.online ?? false) - Number(seen(a.handle)?.online ?? false) || a.name.localeCompare(b.name)

export const friendsScreen = (root: HTMLElement, input: Input, opts: FriendsOptions, initial: Tab = 'friends'): Screen => {
  const el = h('div', { class: 'screen dim profile-screen friends-screen' })
  let tab: Tab = initial
  /** The lists from `/friends`: null offline (or before the API has them), `loading` at first. */
  let list: FriendList | null | 'loading' = 'loading'
  let matches: PlayerMatch[] | 'limit' | null = null
  let query = ''
  let nav: ReturnType<typeof menu> | null = null
  /** The profile editor, a confirmation or the sign-in choice, open over this screen. */
  let sub: Screen | null = null
  let closed = false
  /** The footer's buttons as the last `render` made them: they come after the rows in the arrows' tour. */
  let footerActions: Action[] = []

  // Built once: the search field keeps its focus and caret while results come and go around it.
  const search = h('input', { class: 'field-input', type: 'text', maxlength: 20, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'search' })
  const results = h('div', { class: 'friend-results' })
  search.addEventListener('input', () => {
    query = search.value
    void runSearch()
  })
  // Inside the field the game's keys are off (`createInput`), so Esc is caught here.
  search.addEventListener('keydown', (e) => e.key === 'Escape' && close())

  const presenceOf = (handle: string) => presenceView()?.friends.find((f) => f.handle === handle)

  const load = async () => {
    const next = await fetchFriends()
    if (closed) return
    list = next
    render()
  }

  /** Whatever a row did, the lists come back fresh. */
  const after = (message: string | null) => {
    if (closed) return
    if (message) toast(root, message, 2600)
    void load()
  }

  const add = async (p: ProfileName) => {
    const res = await follow(p.handle)
    if (!res.ok) return after(res.reason === 'limit' ? t().friends.limit : t().friends.failed)
    playSfx('unlock')
    matches = Array.isArray(matches) ? matches.map((m) => (m.handle === p.handle ? { ...m, relation: res.friend ? 'friend' : 'following' } : m)) : matches
    after(res.friend ? t().friends.nowFriends(p.name) : t().friends.added(p.name))
  }

  const drop = async (p: ProfileName, how: 'decline' | 'cancel' | 'unfriend') => {
    const ok = how === 'decline' ? await declineRequest(p.handle) : how === 'cancel' ? await unfollow(p.handle) : await unfriend(p.handle)
    playSfx(ok ? 'select' : 'denied')
    after(ok ? null : t().friends.failed)
  }

  const invite = async (p: ProfileName, room: string) => {
    const res = await inviteFriend(p.handle, room)
    if (closed) return
    const m = t().friends
    playSfx(res.ok ? 'unlock' : 'denied')
    toast(root, res.ok ? m.invited(p.name) : m.inviteFailed[res.reason], 2600)
  }

  /** Opens `open` over this screen (its keys off meanwhile); it comes back here. */
  const over = (open: (back: () => void) => Screen) => {
    nav?.off()
    el.classList.add('hidden')
    sub = open(() => {
      sub?.dispose()
      sub = null
      el.classList.remove('hidden')
      render()
    })
  }

  /** The ways to sign in over this screen (`askSignIn`), which stays in view; once in, the lists load. */
  const askAccount = () => {
    nav?.off()
    sub = askSignIn(root, input, { why: t().account.ask.why.friends, place: { to: 'friends' }, back: () => ((sub = null), render()), done: () => ((sub = null), render(), void load()) })
  }

  const confirmUnfriend = (p: ProfileName) =>
    over((back) => confirmDialog(root, input, t().friends.removeConfirm(p.name), (yes) => (back(), yes && void drop(p, 'unfriend')), { yes: t().friends.remove, no: t().friends.cancel }))

  const row = (p: ProfileName, extra: Node | null, actions: Action[], all: Action[]) => {
    all.push(...actions)
    return h(
      'div',
      { class: 'friend-row' },
      h('div', { class: 'friend-id' }, h('b', {}, p.name), h('span', { class: 'friend-handle' }, `@${p.handle}`), extra),
      h('div', { class: 'friend-actions' }, ...actions.map((a) => h('button', { class: a.primary ? 'btn small confirm' : 'btn small', 'data-action': '' }, a.label))),
    )
  }

  const presenceChip = (handle: string) => {
    const p = presenceOf(handle)
    const kind = p?.online ? (p.activity ?? 'lobby') : 'offline'
    return h('span', { class: `friend-presence ${kind}` }, t().friends.presence[kind])
  }

  const note = (text: string, extra = '') => h('p', { class: `invite-note ${extra}`.trim() }, text)

  const friendsTab = (l: FriendList, all: Action[]) => {
    const m = t().friends
    const room = opts.room()
    if (l.friends.length === 0) return [note(m.empty)]
    return [...l.friends].sort(byPresence(presenceOf)).map((f) =>
      row(f, presenceChip(f.handle), [...(room ? [{ label: m.invite, primary: true, run: () => void invite(f, room) }] : []), { label: m.remove, run: () => confirmUnfriend(f) }], all),
    )
  }

  const requestsTab = (l: FriendList, all: Action[]) => {
    const m = t().friends
    const incoming = l.incoming.map((f) => row(f, null, [{ label: m.accept, primary: true, run: () => void add(f) }, { label: m.decline, run: () => void drop(f, 'decline') }], all))
    const outgoing = l.outgoing.map((f) => row(f, null, [{ label: m.cancel, run: () => void drop(f, 'cancel') }], all))
    return [...(incoming.length > 0 ? incoming : [note(m.noRequests)]), ...(outgoing.length > 0 ? [h('h3', { class: 'friends-subtitle' }, m.sent), ...outgoing] : [])]
  }

  /** The search results with their buttons, in place: typing never loses the field. */
  const fillResults = (all: Action[]) => {
    const m = t().friends
    const rows =
      matches === null
        ? [note(m.searchHint, 'small')]
        : matches === 'limit'
          ? [note(m.limit, 'small')]
          : matches.length === 0
            ? [note(m.noMatches, 'small')]
            : matches.map((p) =>
                p.relation === 'none' || p.relation === 'follower'
                  ? row(p, p.relation === 'follower' ? h('span', { class: 'friend-presence' }, m.relation.follower) : null, [{ label: p.relation === 'follower' ? m.accept : m.add, primary: true, run: () => void add(p) }], all)
                  : row(p, h('span', { class: 'friend-presence' }, m.relation[p.relation]), [], all),
              )
    results.replaceChildren(...rows)
  }

  const addTab = (all: Action[]) => {
    search.placeholder = t().friends.search
    fillResults(all)
    return [h('label', { class: 'field' }, h('span', { class: 'field-box' }, h('span', { class: 'field-prefix' }, '@'), search)), results]
  }

  /** The arrows over every row's buttons and the footer's. */
  const bindNav = (actions: readonly Action[]) => {
    const buttons = [...el.querySelectorAll<HTMLElement>('[data-action]')]
    const at = Math.min(nav?.index ?? 0, buttons.length - 1)
    nav?.off()
    nav = menu(input, buttons, (i) => (playSfx('select'), later(actions[i]!.run)), { initial: Math.max(0, at) })
  }

  const render = () => {
    if (closed || sub) return
    const m = t().friends
    const s = accountState()
    const handle = s.kind === 'signedIn' ? accountHandle() : null
    const all: Action[] = []
    let body: Node[]
    if (s.kind !== 'signedIn') body = [h('p', { class: 'invite-gate' }, m.guest)]
    else if (!handle) body = [h('p', { class: 'invite-gate' }, m.noHandle)]
    else if (list === 'loading') body = [note(m.loading, 'blink')]
    else if (!list) body = [note(m.unavailable)]
    else body = tab === 'friends' ? friendsTab(list, all) : tab === 'requests' ? requestsTab(list, all) : addTab(all)

    const view = presenceView()
    const footer: Action[] = [
      ...(s.kind !== 'signedIn' && accountsEnabled ? [{ label: m.signIn, primary: true, run: askAccount }] : []),
      ...(s.kind === 'signedIn' && !handle ? [{ label: m.createProfile, primary: true, run: () => over((back) => profileEditor(root, input, () => (back(), void load()))) }] : []),
      ...(handle && view ? [{ label: m.appearOffline(view.appearOffline), run: () => void setAppearOffline(!view.appearOffline).then(render) }] : []),
      { label: m.back, run: close },
    ]
    all.push(...footer)
    footerActions = footer
    const incoming = list && list !== 'loading' ? list.incoming.length : 0
    const tabs =
      handle && list && list !== 'loading'
        ? h(
            'div',
            { class: 'shell-tabs friends-tabs', role: 'tablist' },
            ...TABS.map((id) =>
              h(
                'button',
                { class: id === tab ? 'shell-tab on' : 'shell-tab', type: 'button', role: 'tab', 'aria-selected': String(id === tab), onclick: () => switchTab(id) },
                m.tabs[id],
                id === 'requests' && incoming > 0 ? h('em', { class: 'lobby-badge' }, String(incoming)) : null,
              ),
            ),
          )
        : null
    el.replaceChildren(
      h(
        'div',
        { class: 'dialog box profile friends' },
        h('div', { class: 'dialog-title' }, m.title),
        tabs,
        h('div', { class: 'friend-list invite-body' }, ...body),
        h('div', { class: 'buttons' }, ...footer.map((a) => h('button', { class: a.primary ? 'btn confirm' : 'btn', 'data-action': '' }, a.label))),
        hint(m.hintKeys, m.hintTouch),
      ),
    )
    bindNav(all)
    if (tab === 'add' && list && list !== 'loading') requestAnimationFrame(() => document.activeElement === document.body && matchMedia('(pointer: fine)').matches && search.focus())
  }

  let searchId = 0
  const runSearch = async () => {
    const prefix = parseHandlePrefix(query)
    const id = ++searchId
    matches = prefix ? matches : null
    if (prefix) {
      const found = await searchPlayers(prefix)
      if (id !== searchId || closed) return
      matches = found === 'limit' ? 'limit' : (found ?? [])
    }
    if (!results.isConnected) return render()
    const rows: Action[] = []
    fillResults(rows)
    bindNav([...rows, ...footerActions])
  }

  const switchTab = (next: Tab) => {
    if (next === tab) return
    playSfx('move')
    tab = next
    render()
  }

  function close() {
    if (closed) return
    closed = true
    playSfx('select')
    dispose()
    later(opts.onClose)
  }

  const offPresence = onPresence(() => tab === 'friends' && render())
  const offKeys = input.onKey((k) => {
    if (sub) return
    if (k === 'Escape' || k === 'Backspace') return close()
    if (k === 'KeyQ' || k === 'KeyE' || k === 'Tab' || k === 'ArrowLeft' || k === 'ArrowRight') {
      const dir = k === 'KeyQ' || k === 'ArrowLeft' ? -1 : 1
      switchTab(TABS[(TABS.indexOf(tab) + dir + TABS.length) % TABS.length]!)
    }
  })
  const dispose = () => (sub?.dispose(), nav?.off(), offPresence(), offKeys(), el.remove())
  root.append(el)
  render()
  if (accountState().kind === 'signedIn' && accountHandle()) void load()
  else list = null
  return { el, dispose: () => ((closed = true), dispose()), dim: 0.5 }
}

/**
 * A friend's invite into their co-op room, over whatever screen is up
 * outside a run: who, Entrar and Agora não. It goes away by itself when the
 * invite expires. `join` and `later` both dismiss it (the shell tells the API).
 */
export const inviteBanner = (root: HTMLElement, invite: CoopInvite, actions: { join: () => void; later: () => void }) => {
  const m = t().friends
  let done = false
  const finish = (fn: () => void) => () => {
    if (done) return
    done = true
    clearTimeout(timer)
    playSfx('select')
    el.remove()
    later(fn)
  }
  const el = h(
    'div',
    { class: 'coop-invite box pop', role: 'alert' },
    h('img', { class: 'coop-invite-icon', src: coopIcon(), alt: '' }),
    rich(m.inviteBanner(invite.from.name), { class: 'coop-invite-text' }),
    h('div', { class: 'coop-invite-buttons' }, h('button', { class: 'btn small confirm', type: 'button', onclick: finish(actions.join) }, m.inviteJoin), h('button', { class: 'btn small', type: 'button', onclick: finish(actions.later) }, m.inviteLater)),
  )
  const timer = setTimeout(() => !done && ((done = true), el.remove()), Math.max(0, Date.parse(invite.expiresAt) - Date.now()))
  playSfx('unlock')
  root.append(el)
  return { el, dispose: () => ((done = true), clearTimeout(timer), el.remove()) }
}
