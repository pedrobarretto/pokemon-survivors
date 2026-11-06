import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { isTownRoomId } from '../data/realmMap'
import { t } from '../i18n'
import { REALM, REALM_CITIES, baseOwner, type CityId, type RoomKey } from '../net/realm'
import type { RealmFriend } from '../net/realmApi'
import { fetchFriends, setShowWhere } from '../realm/api'
import { h } from './dom'
import type { Screen } from './screens'
import { toast } from './toasts'

/**
 * "Amigos no Realm" (`realm/friends.ts` decides who sees what): the players
 * the trainer follows, mutual friends walking the realm on top with their
 * city and room, then those hiding where they are, those elsewhere in the
 * game, offline, and the follows not returned. "Ir até" walks to a friend's
 * room (or, when it's full, to their city); "Convidar para minha base" sends
 * a quick invite through the relay. The toggle is the realm's "show where I
 * am" setting. Opened over the town, and from the city picker (no invites
 * there). Asks the API again every `POLL_MS` while open.
 */

/** How often the open panel asks again (the API allows 12 a minute). */
const POLL_MS = 20_000

export type FriendsPanelDeps = {
  /** The player's own @handle (their base reads "Sua base"). */
  handle: string
  /** Where the player walks now; null on the city picker. */
  here: () => { city: CityId; room: RoomKey | null } | null
  /** Walks to `room` of `city` (null: the city's landing). */
  go: (city: CityId, room: RoomKey | null) => void
  /** Invites a friend to the player's base; null off a city. Resolves once it went or was refused (a toast says which). */
  invite: ((handle: string) => Promise<void>) | null
  close: () => void
}

/** A room as the panel names it: a town room, someone's base (the player's own as theirs), or nothing from an older relay. */
export const roomName = (room: RoomKey | null, own: string): string | null => {
  const m = t().realm
  if (!room) return null
  const owner = baseOwner(room)
  if (owner !== null) return owner === own.toLowerCase() ? m.friends.yourBase : m.base(owner)
  return isTownRoomId(room) ? m.rooms[room] : null
}

export const openRealmFriends = (root: HTMLElement, input: Input, deps: FriendsPanelDeps): Screen => {
  const m = () => t().realm.friends
  const list = h('div', { class: 'realm-pal-list' }, h('small', {}, '…'))
  const toggle = h('button', { class: 'realm-pal-where box', type: 'button' })
  const hint = h('small', { class: 'realm-pal-hint' }, m().showWhereHint)
  const close = h('button', { class: 'realm-pal-close', type: 'button', 'aria-label': t().realm.trainer.close, onclick: () => deps.close() }, '×')
  const sheet = h(
    'div',
    { class: 'screen realm-sheet-screen' },
    h('div', { class: 'realm-board realm-pals box' }, close, h('h2', {}, m().title), toggle, hint, list, h('button', { class: 'box', type: 'button', onclick: () => deps.close() }, t().realm.trainer.close)),
  )
  root.append(sheet)

  let disposed = false
  let showWhere = true
  /** Friends invited from this panel, until when the relay would drop another (`REALM.inviteMs`). */
  const invitedUntil = new Map<string, number>()

  const renderToggle = () => {
    toggle.textContent = m().showWhere(showWhere)
    toggle.classList.toggle('on', showWhere)
  }
  toggle.onclick = () => {
    const next = !showWhere
    toggle.disabled = true
    void setShowWhere(next).then((ok) => {
      toggle.disabled = false
      if (disposed) return
      if (ok) showWhere = next
      else toast(root, m().failed, 2600, 'realmFriends')
      renderToggle()
    })
  }
  renderToggle()

  /** What a friend in the realm can be walked to: a button, or a note when there's nowhere to go. */
  const goAction = (f: Extract<RealmFriend, { state: 'realm' }>): HTMLElement => {
    const here = deps.here()
    const inCity = here?.city === f.city
    if (inCity && f.room !== null && here.room === f.room) return h('small', { class: 'realm-pal-note' }, m().here)
    if (f.full === 'city' && !inCity) return h('button', { class: 'box', type: 'button', disabled: true }, m().cityFull)
    if (f.full === 'room')
      return inCity
        ? h('button', { class: 'box', type: 'button', disabled: true }, m().roomFull)
        : h('button', { class: 'box', type: 'button', onclick: () => (playSfx('select'), deps.go(f.city, null)) }, `${m().roomFull} · ${m().goCity}`)
    return h('button', { class: 'box realm-pal-go', type: 'button', onclick: () => (playSfx('select'), deps.go(f.city, f.room)) }, m().go)
  }

  const inviteAction = (f: RealmFriend): HTMLElement[] => {
    const invite = deps.invite
    if (!invite || (f.state !== 'realm' && f.state !== 'hidden')) return []
    // Already in the player's own base: nothing to invite them to.
    if (f.state === 'realm' && f.room !== null && baseOwner(f.room) === deps.handle.toLowerCase()) return []
    const b = h('button', { class: 'box', type: 'button', disabled: (invitedUntil.get(f.handle) ?? 0) > performance.now() }, m().invite)
    b.onclick = () => {
      playSfx('select')
      b.disabled = true
      void invite(f.handle).then(() => invitedUntil.set(f.handle, performance.now() + REALM.inviteMs))
    }
    return [b]
  }

  const subtitle = (f: RealmFriend) => {
    switch (f.state) {
      case 'realm': {
        const room = roomName(f.room, deps.handle)
        return room ? `${REALM_CITIES[f.city].name} · ${room}` : REALM_CITIES[f.city].name
      }
      case 'game':
        return m().activity[f.activity]
      default:
        return m().states[f.state]
    }
  }

  const row = (f: RealmFriend) =>
    h(
      'div',
      { class: `realm-pal box is-${f.state}` },
      h('span', { class: 'realm-pal-dot', 'aria-hidden': 'true' }),
      h('div', { class: 'realm-pal-who' }, h('b', {}, `@${f.handle}`), h('small', {}, subtitle(f))),
      h('div', { class: 'realm-pal-acts' }, ...(f.state === 'realm' ? [goAction(f)] : []), ...inviteAction(f)),
    )

  const load = async () => {
    const got = await fetchFriends()
    if (disposed) return
    if (!got) {
      if (list.querySelector('.realm-pal') === null) list.replaceChildren(h('small', {}, m().failed))
      return
    }
    showWhere = got.showWhere
    renderToggle()
    list.replaceChildren(...(got.friends.length === 0 ? [h('small', {}, m().empty)] : got.friends.map(row)))
  }
  void load()
  const poll = setInterval(() => void load(), POLL_MS)

  const off = input.onKey((key) => (key === 'Escape' ? deps.close() : undefined))
  return {
    el: sheet,
    dispose: () => {
      disposed = true
      clearInterval(poll)
      off()
      sheet.remove()
    },
  }
}
