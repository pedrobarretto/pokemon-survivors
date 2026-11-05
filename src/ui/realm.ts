import { track } from '../analytics'
import { effectIn } from '../data/arenaEffects'
import { lookIn, parseLook, type Look } from '../data/cosmetics'
import { PLAYABLE } from '../data/hatchlings'
import { BASE_GRID, BASE_ROOM, LANDING, REALM_ROOMS, isTownRoomId, type Door, type Point, type Rect, type Spot, type SpotKind } from '../data/realmMap'
import type { BaseExterior, BaseLayout } from '../data/secretBases'
import { footprint } from '../data/furniture'
import { FURNITURE_GAMES, isMinigameId, isTableGame } from '../data/minigames'
import { baseTableId } from '../net/realmTables'
import { chooseGame } from '../realm/games/registry'
import { playSfx } from '../engine/audio'
import { joystick, type Input, type Stick } from '../engine/input'
import type { Vec } from '../engine/math'
import { isSupporterTier } from '../game/supporters'
import { t } from '../i18n'
import {
  CITY_IDS,
  REALM,
  REALM_CITIES,
  REALM_EMOTES,
  REALM_LINES,
  baseOwner,
  baseRoom,
  type Avatar,
  type CityId,
  type PartyMode,
  type PartyView,
  type RealmEmote,
  type RealmLine,
  type RealmRefusal,
  type RealmServerMessage,
  type RoomKey,
} from '../net/realm'
import { REPORT_REASONS, type BaseView, type ReportReason } from '../net/realmApi'
import { fetchBase, fetchCities, fetchFriends, isFailure, reportTrainer } from '../realm/api'
import type { RealmClient } from '../realm/client'
import { createWalker, place, pushSample, report, sampleAt, snap, walk, type Ground, type Track } from '../realm/interp'
import { baseSolids, drawBaseRoom } from '../render/base'
import { drawJoystick } from '../render/joystick'
import { drawTownGround, drawTownOverhead, labelTop, townPieces } from '../render/realmArt'
import { GROVE_HOST } from '../render/realmLayout'
import { drawEmoteBubble, drawTrainer, emoting, headOf, realmIconUrl, type TrainerView } from '../render/realmScene'
import { loadSpecies, portraitUrl } from '../render/sprites'
import { titleChip } from './arenaTitle'
import { openBaseBoard } from './baseBoard'
import { openBaseEditor } from './baseEditor'
import { openCarpentry } from './carpentry'
import { dialogue, type Speaker } from './dialogue'
import { h, later } from './dom'
import { supporterBadgeIcon } from './profile'
import type { Screen } from './screens'
import { toast } from './toasts'
import { uiZoom } from './uiScale'

/**
 * The Poké Realm's screen (`net/realm.ts`): the city picker, then the town
 * drawn on the game's canvas (`scene`, called by the shell's frame instead
 * of the lobby's meadow) with the HTML over it: name plates, quick-chat
 * bubbles, the talk wheel and the emote bar, the party, a trainer's card
 * (invite, mute, report), the spot prompt (portals, the board, the bases,
 * Bibarel's carpentry), the labels floating over the room's spots and doors
 * as the trainer comes near (so the town explains itself), the grove's host
 * and its first-visit talk, and the connection's state.
 *
 * The player's own trainer walks here (keys, the drag stick or a tap, like
 * the lobby's partner) and is reported to the relay (`realm/interp.ts`);
 * everyone else draws interpolated behind. Nothing here touches `src/game`.
 */

/** What the shell gives the realm. */
export type RealmDeps = {
  client: RealmClient
  /** CSS px per world px of the game's canvas. */
  scale: () => number
  /** The signed-in player's @handle (the base the trail's door opens). */
  handle: string
  /** Back to the lobby (the client already left). */
  back: () => void
  /**
   * At a portal (the leader, or alone): makes a co-op room (an Arena one for
   * `arena`) through the co-op flow and joins it; the code, or null when it
   * failed. `show` then puts the room up (after the party heard the code).
   */
  openRoom: (mode: PartyMode) => Promise<string | null>
  showRoom: () => void
  /** A party member follows the leader into `code`. */
  joinRoom: (mode: PartyMode, code: string) => void
}

/** The screen, plus the canvas pass the shell calls every menu frame in the meadow's place. */
export type RealmScreen = Screen & { scene: (ctx: CanvasRenderingContext2D, dt: number, w: number, h: number) => void }

/* ---------------- Muted trainers (this device) ---------------- */

const MUTED = 'ps:realmMuted'

const readMuted = (): Set<string> => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(MUTED) ?? '[]')
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

const keepMuted = (muted: ReadonlySet<string>) => {
  try {
    localStorage.setItem(MUTED, JSON.stringify([...muted]))
  } catch {
    // Storage blocked: muted for this visit.
  }
}

/* ---------------- Seen (the lobby tile's NOVO tag) ---------------- */

const SEEN = 'ps:realmSeen'

export const realmSeen = () => {
  try {
    return localStorage.getItem(SEEN) !== null
  } catch {
    return true
  }
}

const markRealmSeen = () => {
  try {
    localStorage.setItem(SEEN, '1')
  } catch {
    // The tag just shows again next time.
  }
}

/* ---------------- The grove's host ---------------- */

const GROVE_SEEN = 'ps:groveSeen'

/** Whether this device heard Sudowoodo's first-visit talk about secret bases. */
const groveSeen = () => {
  try {
    return localStorage.getItem(GROVE_SEEN) !== null
  } catch {
    return true
  }
}

const markGroveSeen = () => {
  try {
    localStorage.setItem(GROVE_SEEN, '1')
  } catch {
    // It explains again next time.
  }
}

/** Sudowoodo talking (SpriteCollab draws it with one face: its portrait). */
const hostSpeaker = (): Speaker => ({
  name: t().realm.spots.host,
  color: '#7a8a2e',
  portrait: () => h('img', { src: portraitUrl(GROVE_HOST.dex), alt: '', width: 40, height: 40 }),
})

/* ---------------- Rooms ---------------- */

/** A trainer's species: its partner's first form (as the lobby's stage shows it). */
const dexOf = (partner: string) => (Object.hasOwn(PLAYABLE, partner) ? PLAYABLE[partner as keyof typeof PLAYABLE].line[0].dex : 25)

/** A base's way out: its door tile on the bottom row, back to the trail by the bases. */
const BASE_EXIT: Rect = { x: Math.floor(BASE_GRID.cols / 2) * BASE_GRID.tile, y: BASE_ROOM.h - 6, w: BASE_GRID.tile, h: 6 }

const trailBy = (kind: SpotKind) => {
  const spot = REALM_ROOMS.trail.spots.find((s) => s.kind === kind)
  return spot ? { x: spot.at.x, y: spot.at.y + 24 } : REALM_ROOMS.trail.spawn
}

/** A room's walkable ground (a base's from its layout, once it loaded). */
const groundOf = (room: RoomKey, base: BaseView | null): Ground =>
  isTownRoomId(room) ? REALM_ROOMS[room] : { w: BASE_ROOM.w, h: BASE_ROOM.h, solid: base ? baseSolids(base.layout) : [] }

const doorsOf = (room: RoomKey): readonly Door[] => (isTownRoomId(room) ? REALM_ROOMS[room].doors : [{ at: BASE_EXIT, to: 'trail', spawn: trailBy('myBase') }])

/**
 * A base's game spots: every piece of its layout that plays mini games
 * (`FURNITURE_GAMES`), reached from in front of it; a table's id is its tile's.
 */
export const gameSpots = (layout: BaseLayout): Spot[] =>
  layout.items.flatMap((p) => {
    const games = FURNITURE_GAMES[p.id]
    if (!games) return []
    const [w, hh] = footprint(p.id, p.turned)
    const at = { x: (p.x + w / 2) * BASE_GRID.tile, y: (p.y + hh) * BASE_GRID.tile + 6 }
    const table = games.some((g) => isTableGame(g))
    return [{ kind: table ? 'gameTable' : 'cabinet', at, reach: 22, games, ...(table ? { id: baseTableId(p.x, p.y) } : {}) } satisfies Spot]
  })

/** A room's spots: a town room's, or the game spots of a base (once its layout loaded). */
const spotsOf = (room: RoomKey, base: BaseView | null = null): readonly Spot[] => (isTownRoomId(room) ? REALM_ROOMS[room].spots : base ? gameSpots(base.layout) : [])

const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h

/** Labels show over spots and doors this close (world px) to the trainer. */
const LABEL_NEAR = 220
/** How far down (CSS px) a label's bottom stays at least, so the top bar never hides it. */
const LABEL_FLOOR = 84

/** A label over a spot or a door: its text, where it stands, and the spot (null for a door), which the prompt replaces when in reach. */
type Label = { text: string; at: Point; spot: Spot | null }

/** Spots of a kind standing side by side (the pier's fishing places): one label names them all. */
const sideBySide = (a: Spot, b: Spot) => a.kind === b.kind && Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y) < 40

/**
 * A room's labels: every spot but the benches (one for spots side by side) (`realm.spots`) and every door
 * (the room it leads to, an arrow toward the edge it's on), anchored a little
 * inside the room so an edge door's label shows.
 */
const labelsOf = (room: RoomKey): Label[] => {
  const m = t().realm
  const { w, h: hgt } = isTownRoomId(room) ? REALM_ROOMS[room] : BASE_ROOM
  const spots = spotsOf(room)
    .filter((s, i, all) => s.kind !== 'bench' && !all.slice(0, i).some((o) => sideBySide(o, s)))
    .map((s) => ({ text: m.spots[s.kind], at: s.at, spot: s }))
  const doors = doorsOf(room).map((d) => {
    const name = m.rooms[d.to]
    const cx = d.at.x + d.at.w / 2
    const cy = d.at.y + d.at.h / 2
    const text = d.at.x <= 0 ? `← ${name}` : d.at.x + d.at.w >= w ? `${name} →` : d.at.y + d.at.h >= hgt ? `↓ ${name}` : name
    return { text, at: { x: Math.min(Math.max(cx, 32), w - 32), y: Math.min(cy, hgt - 8) }, spot: null }
  })
  return [...spots, ...doors]
}

/** A press that travels less than this (CSS px) is a tap. */
const TAP_SLOP = 12
/** How long a quick-chat line shows over a head (s). */
const SAID_SECONDS = 4.5
/** Taps this close (world px) to a trainer's body pick them. */
const PICK = 12

/** A trainer of the room as the screen keeps them. */
type Trainer = TrainerView & {
  av: Avatar
  track: Track
  /** The line (or brag) over the head, since when. */
  said: { at: number } | null
  plate: HTMLElement
  bubble: HTMLElement
}

/** What a session did, summed into one `realm_session` event when it ends. */
type Session = { city: CityId; started: number; rooms: Set<string>; lines: number; emotes: number; party: boolean; portal: PartyMode | null }

/**
 * Opens the realm: the city picker, or `city` straight away (a link, a
 * friend's city, the dev hooks). The client connects as a city is picked.
 */
export const openRealm = (root: HTMLElement, input: Input, deps: RealmDeps, city: CityId | null): RealmScreen => {
  markRealmSeen()
  const m = () => t().realm
  const { client } = deps
  const el = h('div', { class: 'screen realm' })
  root.append(el)

  let disposed = false
  let picker: HTMLElement | null = null
  let town: ReturnType<typeof buildTown> | null = null
  let session: Session | null = null
  let sub: Screen | null = null

  /** Ends the session's analytics once (on leaving, a refusal or a portal). */
  const endSession = () => {
    const s = session
    session = null
    if (!s) return
    track('realm_session', {
      city: s.city,
      seconds: Math.round((performance.now() - s.started) / 1000),
      rooms: s.rooms.size,
      lines: s.lines,
      emotes: s.emotes,
      party: s.party ? 1 : 0,
      portal: s.portal ?? 'none',
    })
  }

  const leave = () => {
    endSession()
    client.leave()
    deps.back()
  }

  /* ---------- The city picker ---------- */

  const showPicker = (note: string | null = null) => {
    town?.dispose()
    town = null
    endSession()
    client.leave()
    const list = h('div', { class: 'realm-cities' })
    const friends = h('div', { class: 'realm-friends' })
    const enter = (id: CityId) => (playSfx('select'), showTown(id))
    const rows = CITY_IDS.map((id) => {
      const count = h('small', {}, '…')
      const b = h('button', { class: 'realm-city box', type: 'button', onclick: () => enter(id) }, h('b', {}, REALM_CITIES[id].name), count)
      list.append(b)
      return { id, b, count }
    })
    const back = h('button', { class: 'realm-back box', type: 'button', onclick: () => (playSfx('select'), leave()) }, `← ${m().cities.back}`)
    picker = h(
      'div',
      { class: 'realm-picker box' },
      h('h2', {}, m().name),
      h('p', { class: 'realm-picker-title' }, m().cities.title),
      h('small', { class: 'realm-picker-hint' }, m().cities.hint),
      ...(note ? [h('p', { class: 'realm-note' }, note)] : []),
      list,
      h('h3', {}, m().cities.friends),
      friends,
      back,
    )
    el.replaceChildren(picker)
    later(() => rows[0]?.b.focus())
    void fetchCities().then((got) => {
      if (disposed || !picker) return
      if (!got) return void list.before(h('p', { class: 'realm-note' }, m().cities.offline))
      for (const r of rows) {
        const n = got.cities[r.id] ?? 0
        const full = n >= REALM.cityCap
        r.count.textContent = full ? m().cities.full : m().cities.trainers(n)
        r.b.classList.toggle('full', full)
        r.b.toggleAttribute('disabled', full)
      }
    })
    void fetchFriends().then((got) => {
      if (disposed || !picker) return
      const walking = got?.friends ?? []
      friends.replaceChildren(
        ...(walking.length === 0
          ? [h('small', {}, m().cities.noFriends)]
          : walking.map((f) => h('button', { class: 'realm-friend box', type: 'button', onclick: () => enter(f.city) }, h('b', {}, m().cities.joinFriend(f.handle)), h('small', {}, REALM_CITIES[f.city].name)))),
      )
    })
  }

  const showTown = (id: CityId) => {
    picker = null
    town?.dispose()
    session = { city: id, started: performance.now(), rooms: new Set([LANDING]), lines: 0, emotes: 0, party: false, portal: null }
    town = buildTown(id)
    client.join(id, LANDING)
  }

  /* ---------- The town ---------- */

  const buildTown = (city: CityId) => {
    const where = h('span', { class: 'realm-where' })
    const count = h('small', { class: 'realm-count' })
    const decorate = h(
      'button',
      {
        class: 'realm-decorate box hidden',
        type: 'button',
        onclick: () =>
          openSub((r) =>
            openBaseEditor(r, input, {
              close: closeSub,
              saved: (v) => {
                exterior = v.layout.exterior
                if (room === baseRoom(deps.handle)) base = v
              },
            }),
          ),
      },
      '✎',
    )
    const status = h('div', { class: 'realm-status box hidden' })
    const partyBar = h('div', { class: 'realm-party box hidden' })
    const layer = h('div', { class: 'realm-layer', 'aria-hidden': 'true' })
    const signs = h('div', { class: 'realm-signs', 'aria-hidden': 'true' })
    const useLabel = h('span', {})
    const useButton = h('button', { class: 'realm-use box hidden', type: 'button', onclick: () => useSpot() }, useLabel, h('span', { class: 'key-hint' }, 'E'))
    const wheel = h('div', { class: 'realm-wheel box hidden' })
    const emotes = h('div', { class: 'realm-emotes box hidden' })
    const card = h('div', { class: 'realm-card box hidden' })
    const invite = h('div', { class: 'realm-invite box hidden' })
    const talkButton = h('button', { class: 'realm-talk box', type: 'button', 'aria-label': m().talk, onclick: () => toggle(wheel) }, h('img', { src: realmIconUrl('talk'), alt: '' }), h('span', { class: 'key-hint' }, 'T'))
    const emoteButton = h('button', { class: 'realm-emote box', type: 'button', 'aria-label': m().emote, onclick: () => toggle(emotes) }, h('img', { src: realmIconUrl('heart'), alt: '' }), h('span', { class: 'key-hint' }, 'Y'))
    const leaveButton = h('button', { class: 'realm-leave box', type: 'button', onclick: () => (playSfx('select'), showPicker()) }, `← ${m().leave}`)
    el.replaceChildren(
      signs,
      layer,
      h('div', { class: 'realm-top' }, leaveButton, h('div', { class: 'realm-title box' }, where, count), decorate),
      status,
      partyBar,
      useButton,
      h('div', { class: 'realm-actions' }, talkButton, emoteButton),
      wheel,
      emotes,
      card,
      invite,
    )

    const muted = readMuted()
    const trainers = new Map<number, Trainer>()
    /** Every handle met in this city by avatar id (a party member in another room keeps a name). */
    const names = new Map<number, string>()
    const walker = createWalker(REALM_ROOMS[LANDING].spawn.x, REALM_ROOMS[LANDING].spawn.y)
    let you: number | null = null
    let me: Avatar | null = null
    let room: RoomKey | null = null
    let base: BaseView | null = null
    /** The exterior the player's own base wears (the grove's entrance draws it), the cave until their base is known. */
    let exterior: BaseExterior = 'cave'
    /** The room's labels, their elements in `signs`. */
    let labels: (Label & { el: HTMLElement })[] = []
    let party: PartyView | null = null
    const invites: number[] = []
    let going = false
    let drag: { id: number; origin: Vec; stick: Stick | null; mouse: boolean } | null = null
    let tap: Vec | null = null
    let near: Spot | null = null
    let cam = { x: 0, y: 0 }
    let clock = 0

    void fetchBase(deps.handle).then((v) => {
      if (!disposed && !isFailure(v)) exterior = v.layout.exterior
    })

    /* Wheel and emote bar */
    for (const line of REALM_LINES) {
      wheel.append(h('button', { class: 'realm-line', type: 'button', onclick: () => say(line) }, m().lines[line]))
    }
    const emoteButtons = REALM_EMOTES.map((id) => {
      const b = h('button', { class: `realm-emote-pick ${id}`, type: 'button', title: m().emotes[id], 'aria-label': m().emotes[id], onclick: () => emote(id) }, h('img', { src: realmIconUrl(id), alt: '' }))
      emotes.append(b)
      return { id, b }
    })

    function toggle(panel: HTMLElement) {
      const open = panel.classList.contains('hidden')
      for (const p of [wheel, emotes, card]) p.classList.add('hidden')
      panel.classList.toggle('hidden', !open)
      playSfx('move')
    }

    function say(line: RealmLine) {
      client.send({ t: 'say', line })
      if (session) session.lines++
      wheel.classList.add('hidden')
    }

    function emote(id: RealmEmote) {
      client.send({ t: 'emote', emote: id })
      if (session) session.emotes++
      emotes.classList.add('hidden')
    }

    /* Trainers */
    const plateOf = (av: Avatar, look: Look) => {
      const plate = effectIn('plate', look.plate)?.plate
      const tier = isSupporterTier(av.supporter) ? av.supporter : null
      const el = h(
        'div',
        { class: plate ? 'realm-plate plated' : 'realm-plate', style: plate ? `--plate-fill:${plate.fill};--plate-edge:${plate.edge};--plate-light:${plate.light}` : '' },
        ...(tier ? [h('img', { class: 'realm-badge', src: supporterBadgeIcon(tier), alt: '' })] : []),
        h('b', {}, `@${av.handle}`),
        titleChip(look.title),
      )
      return el
    }

    const addTrainer = (av: Avatar) => {
      removeTrainer(av.id)
      const look = lookIn(parseLook(av.look), 'realm')
      const dex = dexOf(av.partner)
      void loadSpecies(dex, av.shiny).catch(() => {})
      const tr: Trainer = {
        av,
        dex,
        shiny: av.shiny,
        look,
        x: av.x,
        y: av.y,
        facing: av.facing,
        moving: av.moving,
        emote: null,
        track: [],
        said: null,
        plate: plateOf(av, look),
        bubble: h('div', { class: 'realm-said hidden' }),
      }
      pushSample(tr.track, { at: performance.now() - REALM.interpDelayMs, x: av.x, y: av.y, facing: av.facing, moving: av.moving })
      layer.append(tr.plate, tr.bubble)
      trainers.set(av.id, tr)
      names.set(av.id, av.handle)
      if (av.id === you) me = av
    }

    function removeTrainer(id: number) {
      const tr = trainers.get(id)
      if (!tr) return
      tr.plate.remove()
      tr.bubble.remove()
      trainers.delete(id)
      if (card.dataset.id === String(id)) card.classList.add('hidden')
    }

    const enterRoom = (key: RoomKey, avatars: readonly Avatar[]) => {
      for (const id of [...trainers.keys()]) removeTrainer(id)
      room = key
      going = false
      base = null
      session?.rooms.add(key)
      for (const av of avatars) addTrainer(av)
      const mine = avatars.find((a) => a.id === you)
      if (mine) place(walker, mine.x, mine.y)
      const owner = baseOwner(key)
      const own = owner === deps.handle.toLowerCase()
      decorate.classList.toggle('hidden', !own)
      if (owner)
        void fetchBase(owner).then((v) => {
          if (disposed || room !== key || isFailure(v)) return
          base = v
          if (own) exterior = v.layout.exterior
        })
      labels = labelsOf(key).map((l) => ({ ...l, el: h('div', { class: 'realm-sign' }, l.text) }))
      signs.replaceChildren(...labels.map((l) => l.el))
      // The first time in the grove, its host comes over to explain what a secret base is.
      if (key === 'trail' && !groveSeen()) later(() => !disposed && room === 'trail' && !sub && hostTalk(true))
      where.textContent = `${REALM_CITIES[city].name} · ${owner ? m().base(owner) : isTownRoomId(key) ? m().rooms[key] : key}`
    }

    /* The relay's messages */
    const onMessage = (msg: RealmServerMessage) => {
      const now = performance.now()
      switch (msg.t) {
        case 'welcome':
          you = msg.you
          return enterRoom(msg.room, msg.avatars)
        case 'room':
          return enterRoom(msg.room, msg.avatars)
        case 'join':
          return addTrainer(msg.avatar)
        case 'gone':
          return removeTrainer(msg.id)
        case 'moves':
          for (const [id, x, y, facing, moving] of msg.rows) {
            const tr = id === you ? null : trainers.get(id)
            if (tr) pushSample(tr.track, { at: now, x, y, facing, moving: moving === 1 })
          }
          return
        case 'snap':
          return snap(walker, msg.x, msg.y, now)
        case 'said': {
          const tr = trainers.get(msg.id)
          if (!tr || muted.has(tr.av.handle)) return
          tr.said = { at: clock }
          tr.bubble.textContent = m().lines[msg.line]
          return
        }
        case 'bragged': {
          const tr = trainers.get(msg.id)
          if (!tr || muted.has(tr.av.handle) || !isMinigameId(msg.game)) return
          const feats: Readonly<Record<string, string>> = t().minigames.feats[msg.game]
          const text = feats[msg.feat]
          if (!text) return
          tr.said = { at: clock }
          tr.bubble.textContent = text
          return
        }
        case 'acted': {
          const tr = trainers.get(msg.id)
          if (tr) tr.av = { ...tr.av, act: msg.act }
          return
        }
        // The tables of the room: the table games' screens read them (`realm/games`).
        case 'tables':
        case 'table':
          return
        case 'emoted': {
          const tr = trainers.get(msg.id)
          if (tr && !muted.has(tr.av.handle)) tr.emote = { id: msg.emote, at: clock }
          return
        }
        case 'invited': {
          const tr = trainers.get(msg.from)
          // A muted trainer's invite is turned down without a word.
          if (tr && muted.has(tr.av.handle)) return client.send({ t: 'answer', from: msg.from, yes: false })
          invites.push(msg.from)
          return showInvite()
        }
        case 'party':
          party = msg.party
          if (party && party.members.length > 1 && session) session.party = true
          return showParty()
        case 'partyGo':
          if (!party || party.leader === you) return
          if (session) session.portal = msg.mode
          toast(root, m().party.follow(msg.mode), 3000, 'realmParty')
          endSession()
          client.leave()
          return deps.joinRoom(msg.mode, msg.code)
        case 'refused':
          return refused(msg.why)
        case 'pong':
          return
      }
    }
    const offMessages = client.onMessage(onMessage)

    const refused = (why: RealmRefusal) => {
      // Seated, a refused `go` leaves the trainer where it stands.
      if (client.status().kind === 'open') {
        going = false
        return void toast(root, m().refusals[why], 3200, 'realmRefused')
      }
      if (why === 'full' || why === 'city' || why === 'afk') return showPicker(m().refusals[why])
      status.textContent = m().refusals[why]
      status.classList.remove('hidden')
      status.append(h('button', { class: 'box', type: 'button', onclick: () => showPicker() }, m().cities.back))
    }

    /* Party */
    const handleOf = (id: number) => names.get(id) ?? (id === you ? deps.handle : '?')

    function showParty() {
      const members = party && party.members.length > 1 ? party.members : null
      partyBar.classList.toggle('hidden', !members)
      if (!members || !party) return
      const lead = party.leader
      partyBar.replaceChildren(
        h('b', {}, m().party.title),
        ...members.map((id) => h('span', { class: id === lead ? 'realm-member leader' : 'realm-member' }, id === lead ? `★ @${handleOf(id)}` : `@${handleOf(id)}`)),
        h('button', { class: 'realm-party-leave', type: 'button', onclick: () => client.send({ t: 'leaveParty' }) }, m().party.leave),
      )
    }

    function showInvite() {
      const from = invites[0]
      invite.classList.toggle('hidden', from === undefined)
      if (from === undefined) return
      const answer = (yes: boolean) => {
        client.send({ t: 'answer', from, yes })
        invites.shift()
        showInvite()
      }
      invite.replaceChildren(
        h('p', {}, m().party.invited(handleOf(from))),
        h('button', { class: 'box', type: 'button', onclick: () => answer(true) }, m().party.accept),
        h('button', { class: 'box', type: 'button', onclick: () => answer(false) }, m().party.decline),
      )
    }

    /* A trainer's card */
    const openCard = (tr: Trainer) => {
      const handle = tr.av.handle
      const isMuted = muted.has(handle)
      const inParty = party?.members.includes(tr.av.id) ?? false
      const full = (party?.members.length ?? 1) >= REALM.partyCap
      const leading = !party || party.leader === you
      const reasons = h('div', { class: 'realm-reasons hidden' })
      reasons.append(
        h('b', {}, m().trainer.reportTitle(handle)),
        ...REPORT_REASONS.map((r) => h('button', { class: 'box', type: 'button', onclick: () => sendReport(handle, r) }, m().trainer.reasons[r])),
      )
      card.dataset.id = String(tr.av.id)
      card.replaceChildren(
        h('div', { class: 'realm-card-head' }, tr.plate.cloneNode(true)),
        ...(inParty || !leading
          ? []
          : [
              h(
                'button',
                {
                  class: 'box',
                  type: 'button',
                  disabled: full,
                  onclick: () => {
                    client.send({ t: 'invite', id: tr.av.id })
                    toast(root, m().party.sent(handle), 2200, 'realmInvite')
                    card.classList.add('hidden')
                  },
                },
                full ? m().party.full : m().party.invite,
              ),
            ]),
        h(
          'button',
          {
            class: 'box',
            type: 'button',
            onclick: () => {
              if (isMuted) muted.delete(handle)
              else muted.add(handle)
              keepMuted(muted)
              if (!isMuted) Object.assign(tr, { said: null, emote: null })
              card.classList.add('hidden')
            },
          },
          isMuted ? m().trainer.unmute : m().trainer.mute,
        ),
        h('button', { class: 'box', type: 'button', onclick: () => reasons.classList.toggle('hidden') }, m().trainer.report),
        reasons,
        h('button', { class: 'realm-card-close', type: 'button', 'aria-label': m().trainer.close, onclick: () => card.classList.add('hidden') }, '×'),
      )
      for (const p of [wheel, emotes]) p.classList.add('hidden')
      card.classList.remove('hidden')
      playSfx('select')
    }

    const sendReport = (handle: string, reason: ReportReason) => {
      card.classList.add('hidden')
      void reportTrainer({ handle, reason, city }).then((ok) => toast(root, ok ? m().trainer.reported : m().trainer.reportFailed, 2600, 'realmReport'))
    }

    /* Spots */
    function useSpot() {
      const spot = near
      if (!spot || !room) return
      playSfx('select')
      switch (spot.kind) {
        case 'coopPortal':
        case 'arenaPortal':
          return portal(spot.kind === 'coopPortal' ? 'coop' : 'arena')
        case 'board':
          return openSub((r) => boardSheet(r, closeSub))
        case 'bases':
          return openSub((r) => openBaseBoard(r, input, { visit: (owner) => (closeSub(), go(baseRoom(owner), BASE_ROOM.spawn)), close: closeSub, city }))
        case 'myBase':
          return go(baseRoom(deps.handle), BASE_ROOM.spawn)
        case 'carpenter':
          return openSub((r) => openCarpentry(r, input, { close: closeSub, signIn: null }))
        case 'host':
          return hostTalk(!groveSeen())
        case 'counter':
          return void toast(root, m().counter, 2600, 'realmSpot')
        case 'pool':
          return void toast(root, m().pool, 2600, 'realmSpot')
        case 'bench':
          place(walker, spot.at.x, spot.at.y + 6)
          walker.facing = 0
          return
        case 'fishing':
        case 'gameTable':
        case 'cabinet':
          return playAt(spot)
      }
    }

    /** Opens a spot's mini games (`spot.games`; a fishing spot fishes): a table's against the bot until the relay's tables come. */
    function playAt(spot: Spot) {
      const games = spot.kind === 'fishing' ? ['fishing' as const] : (spot.games ?? []).filter(isMinigameId)
      if (games.length === 0) return
      // A fishing spot stands the trainer at the edge, facing the water, so the room sees them fish there.
      if (spot.kind === 'fishing') {
        place(walker, spot.at.x, spot.at.y)
        walker.facing = spot.face ?? walker.facing
      }
      openSub((r) =>
        chooseGame(r, games, {
          partner: me?.partner ?? 'pikachu',
          shiny: me?.shiny ?? false,
          realm: { act: (act) => client.send({ t: 'act', act }), brag: (game, feat) => client.send({ t: 'brag', game, feat }) },
          close: closeSub,
          table: spot.id ? { id: spot.id, source: null } : null,
          you: you ?? 0,
        }),
      )
    }

    /** Sudowoodo talks: all about secret bases the first time (`first`), else a line of its hellos. */
    function hostTalk(first: boolean) {
      const g = m().grove
      const lines = first ? g.first : [g.hello[Math.floor(Math.random() * g.hello.length)]!]
      openSub((r) =>
        dialogue(r, input, {
          speaker: hostSpeaker(),
          lines: lines.map((text) => ({ text })),
          onDone: () =>
            later(() => {
              markGroveSeen()
              closeSub()
            }),
        }),
      )
    }

    const portal = async (mode: PartyMode) => {
      if (party && party.members.length > 1 && party.leader !== you) return void toast(root, m().party.onlyLeader, 2600, 'realmParty')
      if (going) return
      going = true
      toast(root, m().party.going, 2000, 'realmParty')
      const code = await deps.openRoom(mode)
      going = false
      if (disposed) return
      if (!code) return void toast(root, m().party.failed, 3000, 'realmParty')
      if (party && party.members.length > 1) client.send({ t: 'partyGo', mode, code })
      if (session) session.portal = mode
      endSession()
      // Give the relay a moment to pass the code on before the socket goes.
      setTimeout(() => client.leave(), 400)
      deps.showRoom()
    }

    /** Through a door or into a base: the trainer stands at the other side at once; the relay's `room` brings who's there. */
    function go(to: RoomKey, at: Vec) {
      if (going || to === room) return
      going = true
      client.send({ t: 'go', room: to, x: Math.round(at.x), y: Math.round(at.y) })
    }

    /* Input */
    const onDown = (e: PointerEvent) => {
      if (sub || (e.pointerType === 'mouse' && e.button !== 0)) return
      if (!(e.target instanceof Element) || e.target.closest('button, a, .box')) return
      for (const p of [wheel, emotes, card]) p.classList.add('hidden')
      drag = { id: e.pointerId, origin: { x: e.clientX, y: e.clientY }, stick: null, mouse: e.pointerType === 'mouse' }
    }
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const at = { x: e.clientX, y: e.clientY }
      if (drag.stick || Math.hypot(at.x - drag.origin.x, at.y - drag.origin.y) >= TAP_SLOP) drag.stick = joystick(drag.stick?.origin ?? drag.origin, at)
    }
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      if (!drag.stick && e.type === 'pointerup') tap = drag.origin
      drag = null
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    const onKey = (key: string) => {
      if (sub) return
      if (key === 'Escape') {
        const open = [wheel, emotes, card].find((p) => !p.classList.contains('hidden'))
        return open ? open.classList.add('hidden') : showPicker()
      }
      if (key === 'KeyE' || key === 'Enter') return useSpot()
      if (key === 'KeyT') return toggle(wheel)
      if (key === 'KeyY') return toggle(emotes)
      const n = Number(/^Digit(\d)$/.exec(key)?.[1] ?? NaN)
      if (n >= 1 && n <= 9) emote(REALM_EMOTES[n - 1]!)
    }
    const offKeys = input.onKey(onKey)

    /** The movement keys held (WASD and the arrows), normalized. */
    const held = (): Vec => {
      const k = (a: string, b: string) => (input.isHeld(a) || input.isHeld(b) ? 1 : 0)
      const x = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft')
      const y = k('KeyS', 'ArrowDown') - k('KeyW', 'ArrowUp')
      const len = Math.hypot(x, y)
      return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 }
    }

    /** The trainer under a tap (world px), the nearest body within reach. */
    const pickAt = (x: number, y: number): Trainer | null => {
      let best: Trainer | null = null
      let d = PICK
      for (const tr of trainers.values()) {
        if (tr.av.id === you) continue
        const dd = Math.hypot(tr.x - x, tr.y - headOf(tr) / 2 - y)
        if (dd < d) {
          d = dd
          best = tr
        }
      }
      return best
    }

    /* The frame */
    const scene = (ctx: CanvasRenderingContext2D, dt: number, w: number, hgt: number) => {
      client.frame()
      clock += dt
      sub?.tick?.(dt)
      const now = performance.now()
      const st = client.status()
      status.classList.toggle('hidden', st.kind === 'open' || st.kind === 'idle')
      if (st.kind === 'connecting' || st.kind === 'retrying') status.textContent = st.kind === 'connecting' ? m().status.connecting : m().status.retrying
      if (st.kind === 'refused' && status.childElementCount === 0) refused(st.why)
      const seated = st.kind === 'open' && room !== null
      const ground = room ? groundOf(room, base) : REALM_ROOMS[LANDING]
      const scale = deps.scale()

      if (seated && room && !sub) {
        const move = drag?.stick?.vec ?? held()
        if (tap) {
          const at = { x: cam.x + tap.x / scale, y: cam.y + tap.y / scale }
          const who = pickAt(at.x, at.y)
          if (who) openCard(who)
          else walker.target = at
          tap = null
        }
        if (!going) walk(walker, move, dt, ground)
        const sent = report(walker, now)
        if (sent) client.send({ t: 'move', ...sent })
        const door = going ? null : doorsOf(room).find((d) => inRect(d.at, walker.x, walker.y))
        if (door) go(door.to, door.spawn)
      }

      // The camera keeps the trainer in the middle, clamped to the room (a small room sits centered).
      const cx = ground.w <= w ? (ground.w - w) / 2 : Math.min(Math.max(walker.x - w / 2, 0), ground.w - w)
      const cy = ground.h <= hgt ? (ground.h - hgt) / 2 : Math.min(Math.max(walker.y - hgt / 2, 0), ground.h - hgt)
      cam = { x: Math.round(cx), y: Math.round(cy) }

      ctx.fillStyle = '#101820'
      ctx.fillRect(0, 0, w, hgt)
      if (!room) return
      const town = isTownRoomId(room) ? room : null
      if (town) drawTownGround(ctx, town, cam.x, cam.y, w, hgt, clock, exterior)
      else if (base) drawBaseRoom(ctx, base, cam.x, cam.y, clock)

      // Everyone where they stand now: the others behind, the trainer as walked.
      const views: TrainerView[] = []
      for (const tr of trainers.values()) {
        tr.act = tr.av.act
        if (tr.av.id === you) Object.assign(tr, { x: walker.x, y: walker.y, facing: walker.facing, moving: walker.moving })
        else {
          const at = sampleAt(tr.track, now)
          if (at) Object.assign(tr, at)
        }
        views.push(tr)
      }
      const pieces = [...(town ? townPieces(town, exterior) : []).map((p) => ({ y: p.y, draw: () => p.draw(ctx, cam.x, cam.y, clock) })), ...views.map((v) => ({ y: v.y, draw: () => drawTrainer(ctx, v, cam.x, cam.y, clock) }))]
      pieces.sort((a, b) => a.y - b.y)
      for (const p of pieces) p.draw()
      if (town) drawTownOverhead(ctx, town, cam.x, cam.y, w, hgt, clock)
      for (const v of views) drawEmoteBubble(ctx, v, cam.x, cam.y, clock)
      if (drag?.stick) drawJoystick(ctx, drag.stick, scale)

      // The HTML over the canvas: plates and lines over heads, the spot's prompt.
      const zoom = uiZoom()
      const toUi = (x: number, y: number) => `translate(${Math.round(((x - cam.x) * scale) / zoom)}px, ${Math.round(((y - cam.y) * scale) / zoom)}px)`
      for (const tr of trainers.values()) {
        // The plate under the feet, the head kept for emotes and lines.
        tr.plate.style.transform = `${toUi(tr.x, tr.y + 4)} translate(-50%, 0)`
        const saying = tr.said !== null && clock - tr.said.at < SAID_SECONDS
        tr.bubble.classList.toggle('hidden', !saying)
        if (saying) tr.bubble.style.transform = `${toUi(tr.x, tr.y - headOf(tr) - (emoting(tr, clock) ? 16 : 2))} translate(-50%, -100%)`
      }
      const n = trainers.size
      const here = m().status.here(n)
      if (count.textContent !== here) count.textContent = here
      const lookEmote = me?.look.emote !== undefined
      for (const b of emoteButtons) if (b.id === 'look') b.b.classList.toggle('hidden', !lookEmote)

      near = seated ? (spotsOf(room, base).find((s) => Math.hypot(s.at.x - walker.x, s.at.y - walker.y) <= s.reach) ?? null) : null
      /** A label (`el`) over `at`, as a transform: floating over the piece it names, kept below the top bar and inside the screen's sides. */
      const pin = (at: Point, el: HTMLElement) => {
        const y = town ? labelTop(town, at, exterior) : at.y - 30
        const half = el.offsetWidth / 2 + 4
        const x = Math.min(Math.max(Math.round(((at.x - cam.x) * scale) / zoom), half), (w * scale) / zoom - half)
        return `translate(${Math.round(x)}px, ${Math.max(LABEL_FLOOR, Math.round(((y - cam.y) * scale) / zoom))}px) translate(-50%, -100%)`
      }
      useButton.classList.toggle('hidden', !near || sub !== null)
      if (near) {
        const label = m().spots[near.kind]
        if (useLabel.textContent !== label) useLabel.textContent = label
        useButton.style.transform = pin(near.at, useButton)
      }
      // The labels of what's around: the near spot's is its prompt instead.
      for (const l of labels) {
        const shown = seated && sub === null && !(l.spot && near && (l.spot === near || sideBySide(l.spot, near))) && Math.hypot(l.at.x - walker.x, l.at.y - walker.y) <= LABEL_NEAR
        l.el.classList.toggle('shown', shown)
        if (shown) l.el.style.transform = pin(l.at, l.el)
      }
    }

    const dispose = () => {
      offMessages()
      offKeys()
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    return { scene, dispose }
  }

  /* ---------- Sheets over the town ---------- */

  function openSub(make: (root: HTMLElement) => Screen) {
    sub?.dispose()
    sub = make(root)
  }

  function closeSub() {
    sub?.dispose()
    sub = null
  }

  const boardSheet = (r: HTMLElement, close: () => void): Screen => {
    const b = m().board
    const sheet = h(
      'div',
      { class: 'screen realm-sheet-screen' },
      h('div', { class: 'realm-board box' }, h('h2', {}, b.title), ...b.lines.map((line) => h('p', {}, line)), h('button', { class: 'box', type: 'button', onclick: close }, m().trainer.close)),
    )
    r.append(sheet)
    const off = input.onKey((key) => (key === 'Escape' || key === 'Enter' ? close() : undefined))
    return { el: sheet, dispose: () => (off(), sheet.remove()) }
  }

  if (city) showTown(city)
  else showPicker()

  return {
    el,
    dim: 0,
    scene: (ctx, dt, w, hgt) => {
      if (town) return town.scene(ctx, dt, w, hgt)
      // The picker sits over the plaza, quiet, the client not yet in a city.
      ctx.fillStyle = '#101820'
      ctx.fillRect(0, 0, w, hgt)
      drawTownGround(ctx, LANDING, Math.round((REALM_ROOMS[LANDING].w - w) / 2), Math.round((REALM_ROOMS[LANDING].h - hgt) / 2), w, hgt, performance.now() / 1000)
      ctx.fillStyle = 'rgba(16,24,48,0.45)'
      ctx.fillRect(0, 0, w, hgt)
    },
    dispose: () => {
      disposed = true
      closeSub()
      town?.dispose()
      endSession()
      client.leave()
      el.remove()
    },
  }
}
