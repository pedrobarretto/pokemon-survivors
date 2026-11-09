import { REALM_EVENTS, type RealmEventKind } from '../data/realmEvents'
import { isTownRoomId, type TownRoomId } from '../data/realmMap'
import type { RoomKey } from '../net/realm'
import { t } from '../i18n'
import { clockOf, hourNotice, type HourNotice } from '../realm/hours'
import { hourIconUrl } from '../render/realmHourIcons'
import { h } from './dom'

/**
 * The Hora do Realm's words on screen: the city's banner, with the countdown
 * and a shortcut that walks the trainer to the right room, and the small
 * countdown on the lobby's way in. Both tick once a second off the wall
 * clock: nothing runs per frame.
 */

const nameOf = (kind: RealmEventKind) => t().realm.hours.names[kind]

const clockLine = (n: HourNotice) => (n.on ? t().realm.hours.ends(clockOf(n.left)) : t().realm.hours.starts(clockOf(n.left)))

/** The city's banner. `go` walks the trainer toward the hour's room. */
export const realmHourBar = (go: (to: TownRoomId) => void) => {
  const icon = h('img', { class: 'realm-hour-icon', alt: '' })
  const name = h('b', {})
  const perk = h('small', {})
  const clock = h('span', { class: 'realm-hour-clock' })
  const button = h('button', { class: 'realm-hour-go box', type: 'button' })
  let to: TownRoomId | null = null
  button.addEventListener('click', () => to && go(to))
  const el = h('div', { class: 'realm-hour box hidden', role: 'status' }, icon, h('div', { class: 'realm-hour-text' }, name, perk), clock, button)
  /** Paints `n` for a trainer standing in `room`; text only changes when it does. */
  const show = (n: HourNotice | null, room: RoomKey | null) => {
    el.classList.toggle('hidden', n === null)
    if (!n) return
    const words = t().realm
    const target = REALM_EVENTS[n.hour.kind].room
    const here = room !== null && isTownRoomId(room) && room === target
    to = target
    el.classList.toggle('on', n.on)
    el.dataset.kind = n.hour.kind
    const src = hourIconUrl(n.hour.kind)
    if (icon.getAttribute('src') !== src) icon.setAttribute('src', src)
    const title = `${nameOf(n.hour.kind)} · ${words.rooms[target]}`
    if (name.textContent !== title) name.textContent = title
    const perkLine = words.hours.perks[n.hour.kind]
    if (perk.textContent !== perkLine) perk.textContent = perkLine
    clock.textContent = clockLine(n)
    button.classList.toggle('hidden', here)
    if (button.textContent !== words.hours.go) button.textContent = words.hours.go
  }
  return { el, show }
}

/** How many idle ticks a tag waits for its element to reach the page before it stops. */
const GRACE_TICKS = 5

/**
 * The lobby's countdown on a way into the Realm, during an hour and in the 30
 * minutes before it: the hour's name and clock when `long` (the wide screens'
 * card), the clock alone on a tile. Stops once `el` leaves the page.
 */
export const realmHourTag = (el: HTMLElement, long: boolean) => {
  const tag = h('em', { class: 'lobby-realm-hour hidden' })
  el.append(tag)
  let waited = 0
  let id = 0
  const tick = () => {
    if (!el.isConnected && ++waited > GRACE_TICKS) return clearInterval(id)
    const n = hourNotice(Date.now())
    tag.classList.toggle('hidden', n === null)
    tag.classList.toggle('on', n?.on ?? false)
    if (!n) return
    const text = long ? `${nameOf(n.hour.kind)} ${clockOf(n.left)}` : clockOf(n.left)
    if (tag.textContent !== text) tag.textContent = text
    tag.title = `${nameOf(n.hour.kind)} · ${clockLine(n)}`
  }
  tick()
  id = window.setInterval(tick, 1000)
}
