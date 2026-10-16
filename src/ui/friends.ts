import { accountState } from '../account'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { parseHandlePrefix, type Friend, type FriendList, type PlayerMatch } from '../game/ranking'
import { t } from '../i18n'
import { send } from '../net/client'
import { isOnline, onPresence } from '../net/presence'
import { inviteFriend, onRoom, room } from '../net/room'
import { dropFriend, fetchFriends, searchPlayers, setFollow } from '../ranking'
import { h, later } from './dom'
import { titleBadge } from './missions'
import { hint, menu, type Screen } from './screens'
import { toast } from './toasts'

/**
 * Friends: mutual follows (following someone sends a request, following back
 * accepts). Tabs for friends (online first, invite into the room), requests
 * both ways and a search by username. Guests are asked to sign in.
 */

type Tab = 'friends' | 'requests' | 'add'

const TABS: readonly Tab[] = ['friends', 'requests', 'add']

export type FriendsActions = {
  /** Opens a profile over the friends screen; `back` returns here. */
  profile: (handle: string, back: () => void) => Screen
  /** Opens the account dialog (guests). */
  signIn: () => void
  close: () => void
}

type Action = { label: string; run: () => void; primary?: boolean }

export const friendsScreen = (root: HTMLElement, input: Input, actions: FriendsActions, initial: Tab = 'friends'): Screen => {
  const el = h('div', { class: 'screen dim' })
  let tab: Tab = initial
  let list: FriendList | null = null
  let failed = false
  let matches: PlayerMatch[] | null = null
  let query = ''
  /** Handles this screen sent a request to (search results show it right away). */
  const requested = new Set<string>()
  let nav: ReturnType<typeof menu> | null = null
  let sub: Screen | null = null
  let closed = false
  // Built once: the search field keeps its focus and caret while results come and go around it.
  const search = h('input', { class: 'field-input', type: 'text', maxlength: 20, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'search' })
  const results = h('div', { class: 'friend-results' })
  search.addEventListener('input', () => {
    query = search.value
    void runSearch()
  })
  // Inside the field the game's keys are off (see `createInput`), so Esc is caught here.
  search.addEventListener('keydown', (e) => e.key === 'Escape' && close())

  const load = async () => {
    failed = false
    const next = await fetchFriends()
    if (closed) return
    list = next
    failed = next === null
    render()
  }

  const afterChange = () => {
    // Presence reloads the mutual set, so a new friend shows online at once.
    send({ t: 'friends' })
    void load()
  }

  const follow = async (f: Friend | PlayerMatch, accept: boolean) => {
    const done = await setFollow(f.handle, true)
    if (!done || closed) return
    playSfx('unlock')
    requested.add(f.handle)
    toast(root, accept ? t().friends.nowFriends(f.name) : t().friends.added(f.name), 2600)
    afterChange()
  }

  const drop = async (f: Friend, how: 'decline' | 'unfriend' | 'cancel') => {
    const ok = how === 'cancel' ? (await setFollow(f.handle, false)) !== null : await dropFriend(f.handle, how)
    if (!ok || closed) return
    playSfx('select')
    afterChange()
  }

  const openProfile = (handle: string) => {
    nav?.off()
    el.classList.add('hidden')
    sub = actions.profile(handle, () => {
      sub = null
      el.classList.remove('hidden')
      void load()
    })
  }

  const row = (f: Friend | PlayerMatch, extra: Node | null, rowActions: Action[]) =>
    h(
      'div',
      { class: 'friend-row' },
      h('div', { class: 'friend-id' }, h('b', {}, f.name), h('span', { class: 'profile-handle' }, `@${f.handle}`), extra),
      h('div', { class: 'friend-actions' }, ...rowActions.map((a) => h('button', { class: a.primary ? 'btn small confirm' : 'btn small', 'data-action': '' }, a.label))),
    )

  const render = () => {
    const m = t().friends
    const r = room()
    const actionsOf: Action[] = []
    const add = (list: Action[]) => (actionsOf.push(...list), list)
    let body: Node[]
    if (accountState().kind !== 'signedIn') {
      body = [h('p', { class: 'profile-note' }, m.guest)]
      add([{ label: m.signIn, run: actions.signIn, primary: true }])
    } else if (failed) {
      body = [h('p', { class: 'profile-note' }, m.unavailable)]
    } else if (!list) {
      body = [h('p', { class: 'profile-note blink' }, t().profile.loading)]
    } else if (tab === 'friends') {
      const sorted = [...list.friends].sort((a, b) => Number(isOnline(b.handle)) - Number(isOnline(a.handle)) || a.name.localeCompare(b.name))
      body = sorted.length === 0
        ? [h('p', { class: 'profile-note' }, m.empty)]
        : sorted.map((f) => {
            const online = isOnline(f.handle)
            const rowActions = add([
              ...(online && r ? [{ label: m.invite, primary: true, run: () => (inviteFriend(f.handle), toast(root, m.invited(f.name), 2000)) }] : []),
              { label: m.profile, run: () => openProfile(f.handle) },
              { label: m.remove, run: () => void drop(f, 'unfriend') },
            ])
            return row(f, h('span', { class: online ? 'presence online' : 'presence' }, online ? m.online : m.offline), rowActions)
          })
    } else if (tab === 'requests') {
      const incoming = list.incoming.map((f) => row(f, titleBadge(f.title), add([{ label: m.accept, primary: true, run: () => void follow(f, true) }, { label: m.decline, run: () => void drop(f, 'decline') }])))
      const outgoing = list.outgoing.map((f) => row(f, null, add([{ label: m.cancel, run: () => void drop(f, 'cancel') }])))
      body = [
        ...(incoming.length > 0 ? incoming : [h('p', { class: 'profile-note' }, m.noRequests)]),
        ...(outgoing.length > 0 ? [h('h3', { class: 'friends-subtitle' }, m.sent), ...outgoing] : []),
      ]
    } else {
      search.placeholder = m.search
      fillResults(list, add)
      body = [h('label', { class: 'field' }, h('span', { class: 'field-box' }, h('span', { class: 'field-prefix' }, '@'), search)), results]
    }

    const tabButtons = TABS.map((id) => {
      const count = id === 'requests' ? (list?.incoming.length ?? 0) : 0
      return h('button', { class: id === tab ? 'tab picked' : 'tab', type: 'button', onclick: () => switchTab(id) }, m.tabs[id], count > 0 && h('span', { class: 'tab-count' }, count))
    })
    const back = h('button', { class: 'btn' }, m.back)
    const dialog = h(
      'div',
      { class: 'dialog box friends' },
      h('div', { class: 'dialog-title' }, m.title),
      accountState().kind === 'signedIn' && h('div', { class: 'tabs' }, ...tabButtons),
      h('div', { class: 'friend-list' }, ...body),
      h('div', { class: 'buttons' }, back),
      hint(m.hintKeys, m.hintTouch),
    )
    el.replaceChildren(dialog)
    bindNav(actionsOf)
  }

  /** The search results (with their Add buttons) for the matches so far. */
  const fillResults = (friends: FriendList, add: (a: Action[]) => Action[]) => {
    const m = t().friends
    const known = new Set([...friends.friends, ...friends.outgoing].map((f) => f.handle))
    const incoming = new Set(friends.incoming.map((f) => f.handle))
    const rows = (matches ?? []).map((p) =>
      row(p, null, known.has(p.handle) || requested.has(p.handle) ? [] : add([{ label: m.add, primary: true, run: () => void follow(p, incoming.has(p.handle)) }])),
    )
    results.replaceChildren(...(matches === null ? [h('p', { class: 'profile-note small' }, m.searchHint)] : rows.length > 0 ? rows : [h('p', { class: 'profile-note small' }, m.noMatches)]))
  }

  /** Keys and pointer over every row button, then Back. */
  const bindNav = (rowActions: readonly Action[]) => {
    const all = [...el.querySelectorAll<HTMLElement>('[data-action]'), el.querySelector<HTMLElement>('.friends > .buttons .btn')!]
    const runs = [...rowActions.map((a) => a.run), close]
    const at = Math.min(nav?.index ?? 0, all.length - 1)
    nav?.off()
    nav = menu(input, all, (i) => (playSfx('select'), later(runs[i]!)), { initial: at })
  }

  /** Search results change in place, so typing never loses the field. */
  const showResults = () => {
    if (tab !== 'add' || !list || !results.isConnected) return render()
    const acts: Action[] = []
    fillResults(list, (a) => (acts.push(...a), a))
    bindNav(acts)
  }

  let searchId = 0
  const runSearch = async () => {
    const prefix = parseHandlePrefix(query)
    const id = ++searchId
    if (!prefix) {
      matches = null
      return showResults()
    }
    const found = await searchPlayers(prefix)
    if (id !== searchId || closed) return
    matches = found ?? []
    showResults()
  }

  const switchTab = (next: Tab) => {
    if (next === tab) return
    playSfx('move')
    tab = next
    render()
  }

  const close = () => {
    if (closed) return
    closed = true
    dispose()
    later(actions.close)
  }

  render()
  void load()
  const offPresence = onPresence(() => tab === 'friends' && !sub && render())
  const offRoom = onRoom((e) => e.t === 'room' && render())
  const offKeys = input.onKey((k) => {
    if (sub) return
    if (k === 'Escape' || k === 'Backspace') close()
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'KeyQ' || k === 'KeyE') {
      const dir = k === 'ArrowLeft' || k === 'KeyQ' ? -1 : 1
      switchTab(TABS[(TABS.indexOf(tab) + dir + TABS.length) % TABS.length]!)
    }
  })
  root.append(el)
  const dispose = () => (sub?.dispose(), nav?.off(), offPresence(), offRoom(), offKeys(), el.remove())
  return { el, dispose: () => ((closed = true), dispose()) }
}
