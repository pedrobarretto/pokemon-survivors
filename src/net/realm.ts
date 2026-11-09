/**
 * The Poké Realm's wire protocol, shared by the game and the realm relay
 * (`relay/src/realm.ts`, hosted by the VPS relays, `relay/node`). The realm is
 * the online town: trainers walk around as their partner Pokémon wearing their
 * look, say quick-chat lines, play emotes, visit secret bases and gather a
 * party for co-op or the Arena.
 *
 * It is NOT lockstep and never simulates: each client walks its own Pokémon
 * (predicted on its screen) and reports where it is a few times a second; the
 * relay checks the step against the room's bounds and a speed limit, and
 * batches everyone's positions out per room (`REALM.moveHz`). Other trainers
 * draw interpolated, `REALM.interpDelayMs` behind. Nothing here ever reaches
 * `src/game`, so the realm never touches `RULES_VERSION`, replays or hashes.
 *
 * Identity is the API's, never the client's word: at `hello` the relay checks
 * the Clerk token and asks the API (`POST /realm/identity`, signed) for the
 * account's handle, partner and vouched look (`RealmIdentity`). A realm
 * requires an account with a @handle.
 *
 * Talk is quick chat only: line ids (`REALM_LINES`), never text, so nothing
 * typed ever reaches another player. The game draws each line in the
 * reader's own language.
 *
 * Furniture (`data/furnitureUse.ts`): a trainer sits on a bench, a sofa or a
 * bed (`perch`: the relay checks the seat and that it's free, then shows it
 * sitting, `acted` with a `PerchAct`), and in a base switches lights and plays
 * music on a jukebox (`use`: the room's `furniture` state, kept while anyone
 * is in it).
 *
 * Mini games (`data/minigames.ts`): a trainer busy at one shows it (`act`,
 * `RealmAct`) and brags about its feats (`brag`, ids only, checked by the
 * relay); the table games' seats and moves go through here too (`sit`,
 * `play`, …; the tables' own types are `net/realmTables.ts`).
 *
 * This file must import nothing but `net/realmTables.ts` (import-free too): the relay bundles it alone.
 */

import type { TableView } from './realmTables'
import type { WireLook } from './protocol'

/** Bumped with any incompatible change; a client and relay of different versions refuse each other. */
export const REALM_PROTOCOL = 1

/** The realm's numbers. */
export const REALM = {
  /** Trainers in one city at most; the directory says `full` past it. */
  cityCap: 40,
  /** How often a client reports its position while it moves, and the relay broadcasts each room's (Hz). */
  moveHz: 6,
  /** How far behind the newest position other trainers draw, so interpolation always has two points (ms). */
  interpDelayMs: 250,
  /** World px a second a trainer may walk (the relay allows `speedSlack` more for jitter, and snaps a step past it back). */
  speed: 90,
  speedSlack: 1.5,
  /** A trainer silent this long (no message at all) is dropped. Clients send `ping` while idle. */
  idleDropMs: 30_000,
  /** A trainer who doesn't move or talk this long is kicked as AFK (back to the city picker). */
  afkMs: 15 * 60_000,
  /** Quick-chat lines a trainer may say in any `talkWindowMs`, and emotes the same. */
  talkBurst: 3,
  talkWindowMs: 5_000,
  /** Furniture uses (sitting down, a light, the music) a trainer may make in any `useWindowMs`. */
  useBurst: 4,
  useWindowMs: 4_000,
  /** How far (px) from a base piece's footprint a trainer may use it. */
  useReach: 30,
  /** A party's size (a co-op room's `MAX_PLAYERS`). */
  partyCap: 4,
  /** A party invite waits this long for an answer; a base invite to the same friend goes out again only after it. */
  inviteMs: 30_000,
} as const

/**
 * The relays the realm runs on (the game's `RelayHome`s that are VPS relays;
 * repeated here because this file imports nothing). Cloudflare doesn't host
 * the realm: a city full of walkers never sleeps, which would keep a Durable
 * Object billed all day, and presence tolerates the VPS's distance.
 */
export type RealmHome = 'sa'

/**
 * The cities: each is one instance of the whole town (its rooms) with up to
 * `REALM.cityCap` trainers, named after a Pokémon town (official English
 * names, every language). `home`: the relay that hosts it. A new city is an
 * entry here; order is the way in's (`firstOpenCity`, the first with room) and
 * the list's. Few on purpose: the realm feels alive when trainers land together.
 */
export const REALM_CITIES = {
  pallet: { home: 'sa', name: 'Pallet Town' },
  cerulean: { home: 'sa', name: 'Cerulean City' },
  goldenrod: { home: 'sa', name: 'Goldenrod City' },
  jubilife: { home: 'sa', name: 'Jubilife City' },
} as const satisfies Record<string, { home: RealmHome; name: string }>

export type CityId = keyof typeof REALM_CITIES

export const CITY_IDS = Object.keys(REALM_CITIES) as CityId[]

export const isCityId = (v: unknown): v is CityId => typeof v === 'string' && Object.hasOwn(REALM_CITIES, v)

/**
 * A room inside a city. A town room is an entry of `REALM_ROOMS`
 * (`data/realmMap.ts`); a secret base is `base:<owner handle>` (lowercase),
 * its bounds `BASE_ROOM` there. A trainer is in one room at a time and only
 * sees that room's trainers.
 */
export type RoomKey = string

export const BASE_PREFIX = 'base:'

/** The owner handle of a base room's key, or null for a town room. */
export const baseOwner = (room: RoomKey): string | null => (room.startsWith(BASE_PREFIX) ? room.slice(BASE_PREFIX.length) : null)

export const baseRoom = (handle: string): RoomKey => `${BASE_PREFIX}${handle.toLowerCase()}`

/** The 8 facings, as the sprites' rows (0 = down, clockwise like `Dir8`). */
export type Facing = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

/** The quick-chat lines (ids; each language's words live in i18n `realm.lines`). */
export const REALM_LINES = [
  'hello',
  'bye',
  'thanks',
  'yes',
  'no',
  'lol',
  'nice',
  'cute',
  'followMe',
  'coop',
  'arena',
  'party',
  'niceBase',
  'brb',
  'gg',
  'oops',
] as const

export type RealmLine = (typeof REALM_LINES)[number]

export const isRealmLine = (v: unknown): v is RealmLine => typeof v === 'string' && (REALM_LINES as readonly string[]).includes(v)

/**
 * The free emotes everyone has (PMD-style bubbles over the head, drawn by the
 * game), plus `look`: the emote cosmetic of the trainer's vouched look, when it
 * has one (the gem shop's emotes show in the realm too, `SLOT_MODES`).
 */
export const REALM_EMOTES = ['wave', 'heart', 'laugh', 'music', 'sleep', 'angry', 'question', 'exclaim', 'look'] as const

export type RealmEmote = (typeof REALM_EMOTES)[number]

export const isRealmEmote = (v: unknown): v is RealmEmote => typeof v === 'string' && (REALM_EMOTES as readonly string[]).includes(v)

/**
 * What a trainer is busy at, for the others to draw (a rod in the water, the
 * glow of a cabinet, sitting at a table); null when just walking around.
 * A client says these itself (`act`).
 */
export const BUSY_ACTS = ['fishing', 'arcade', 'table'] as const

export type BusyAct = (typeof BUSY_ACTS)[number]

export const isBusyAct = (v: unknown): v is BusyAct => typeof v === 'string' && (BUSY_ACTS as readonly string[]).includes(v)

/**
 * How a trainer sits on a piece of furniture (`perch`), the poses of
 * `data/furnitureUse.ts`'s `SEAT_POSES` (repeated here: this file imports
 * nothing): on a chair or a bench, tucked into a bed, soaking in a tub. Only
 * the relay sets these, once it seated the trainer.
 */
export const PERCH_ACTS = ['sit', 'lie', 'soak'] as const

export type PerchAct = (typeof PERCH_ACTS)[number]

export const isPerchAct = (v: unknown): v is PerchAct => typeof v === 'string' && (PERCH_ACTS as readonly string[]).includes(v)

/** What a trainer is doing, as the room sees it (`Avatar.act`). */
export const REALM_ACTS = [...BUSY_ACTS, ...PERCH_ACTS] as const

export type RealmAct = (typeof REALM_ACTS)[number]

export const isRealmAct = (v: unknown): v is RealmAct => isBusyAct(v) || isPerchAct(v)

/**
 * A piece of furniture to use (`perch`, `use`): a town room's spot (its index
 * in the room's `spots`, a bench), or a base's piece as placed (its id, top
 * left tile and turn, `Placed`; the relay can't see a base's layout, so it
 * checks the piece against the catalog and the trainer's reach, and the room's
 * clients only draw what their own copy of the layout holds).
 */
export type PieceRef = { spot: number } | { id: string; x: number; y: number; turned: boolean }

/** A base room's furniture state while anyone is in it: the pieces lit (`pieceKey`s), and the music piece playing and its track (`JUKEBOX`'s index). */
export type RoomFurniture = { lit: readonly string[]; music: { piece: string; track: number } | null }

/** Where a party is headed when its leader walks into a portal. */
export type PartyMode = 'coop' | 'arena'

/**
 * Who a trainer is, as the API vouches for them (`POST /realm/identity`):
 * never what the client says. `look` is the cosmetic look (slot to id plus
 * `skins`, a `WireLook`; the game's `parseLook` reads it), `partner` the save's partner (a `PlayableId`)
 * and whether it's shiny, `supporter` the tier for the badge, if any, `stamps`
 * how many Estampas it earned (`data/realmStamps.ts`; an API from before them: 0).
 */
export type RealmIdentity = {
  userId: string
  handle: string
  partner: string
  shiny: boolean
  look: WireLook
  supporter: string | null
  stamps: number
}

/** A trainer as others see them: `id` is per city and connection (never the user id), the rest their identity. */
export type Avatar = {
  id: number
  handle: string
  partner: string
  shiny: boolean
  look: WireLook
  supporter: string | null
  stamps: number
  x: number
  y: number
  facing: Facing
  moving: boolean
  act: RealmAct | null
}

/** One trainer's position in a `moves` batch: `[id, x, y, facing, moving (0/1)]`, whole px. */
export type MoveRow = readonly [id: number, x: number, y: number, facing: Facing, moving: 0 | 1]

/* ---------------- Client → relay ---------------- */

export type RealmClientMessage =
  /** The first message: the protocol, the city, a Clerk session token and the room to land in (a town room, or a base the trainer may enter). */
  | { t: 'hello'; v: number; city: CityId; token: string; room: RoomKey }
  /** Where the trainer stands now (sent at most `REALM.moveHz` while moving, once when it stops). */
  | { t: 'move'; x: number; y: number; facing: Facing; moving: boolean }
  /** Through a door or into a base: lands at `x`, `y` of the new room (the client knows the door's spawn). */
  | { t: 'go'; room: RoomKey; x: number; y: number }
  | { t: 'say'; line: RealmLine }
  | { t: 'emote'; emote: RealmEmote }
  /** Party: invite a trainer (by avatar id, same room), answer an invite, leave, or (leader) send everyone to a room. */
  | { t: 'invite'; id: number }
  | { t: 'answer'; from: number; yes: boolean }
  | { t: 'leaveParty' }
  /** The leader made a co-op or Arena room (`code`, through the co-op relay as usual) and takes the party there. */
  | { t: 'partyGo'; mode: PartyMode; code: string }
  /** Keeps an idle connection alive (and measures the round trip: echoed as `pong`). */
  | { t: 'ping'; at: number }
  /** What the trainer is busy at now (null: done). */
  | { t: 'act'; act: BusyAct | null }
  /** Sits on seat `seat` of a piece within reach (`PieceRef`), if it's free. Any step stands the trainer up. */
  | { t: 'perch'; piece: PieceRef; seat: number }
  /** Uses a base's piece within reach: a light goes on or off, a music piece plays its next track (the last one stops it). */
  | { t: 'use'; piece: PieceRef }
  /** A mini game's feat to tell the room about (`game`, `feat`: ids of `data/minigames.ts`, the relay drops unknown ones); the talk burst limit applies. */
  | { t: 'brag'; game: string; feat: string }
  /** Sits at a table of the room (`table`: its id), choosing its game if the table is free; stands up from any other first. */
  | { t: 'sit'; table: string; game: string }
  | { t: 'stand' }
  /** A move at the table the trainer sits at (the game's rules parse it). */
  | { t: 'play'; move: unknown }
  /** After a match: ready for another. */
  | { t: 'ready' }
  /** Invites a mutual friend (`handle`, wherever on this relay) to the inviter's base; the relay never says whether it reached them. */
  | { t: 'baseInvite'; handle: string }

/* ---------------- Relay → client ---------------- */

/** Why the relay won't seat a trainer, or sends one away. */
export type RealmRefusal =
  | 'version'
  | 'signIn'
  | 'profile'
  | 'full'
  | 'city'
  | 'room'
  | 'private'
  | 'elsewhere'
  | 'afk'
  | 'banned'
  | 'busy'
  /** The room asked for holds its cap (`roomCap`, `data/realmMap.ts`): a `go` stays, a hello lands in the landing. */
  | 'roomFull'

export type PartyView = { leader: number; members: readonly number[] }

export type RealmServerMessage =
  /** Seated: your avatar id, the room you're in and everyone in it (you included). */
  | { t: 'welcome'; you: number; room: RoomKey; avatars: readonly Avatar[] }
  /** Your own room changed (after `go`): the new room's trainers. */
  | { t: 'room'; room: RoomKey; avatars: readonly Avatar[] }
  | { t: 'join'; avatar: Avatar }
  | { t: 'gone'; id: number }
  /** The room's positions since the last batch (only trainers who moved). */
  | { t: 'moves'; rows: readonly MoveRow[] }
  /** Your own step was refused (too fast, out of bounds): stand here. */
  | { t: 'snap'; x: number; y: number }
  | { t: 'said'; id: number; line: RealmLine }
  | { t: 'emoted'; id: number; emote: RealmEmote }
  | { t: 'invited'; from: number }
  | { t: 'party'; party: PartyView | null }
  | { t: 'partyGo'; mode: PartyMode; code: string }
  | { t: 'pong'; at: number }
  /** What a trainer does now; sitting down (a `PerchAct`), it's moved onto the seat at once: `at`. */
  | { t: 'acted'; id: number; act: RealmAct | null; at?: readonly [x: number, y: number, facing: Facing] }
  /** A base room's lights and music (after `welcome` and `room` into a base, and on every change). */
  | { t: 'furniture'; state: RoomFurniture }
  | { t: 'bragged'; id: number; game: string; feat: string }
  /** Every table of the room in use, as this trainer sees them (after `welcome` and `room`), and one table's change (all seats free: it's gone). */
  | { t: 'tables'; tables: readonly TableView[] }
  | { t: 'table'; table: TableView }
  /** A mutual friend invites you to their base (`city`: where it is), answered by walking there or not. */
  | { t: 'baseInvited'; from: string; city: CityId }
  /** A trainer of the room just earned stamps (`data/realmStamps.ts` ids), for everyone there to see. */
  | { t: 'stamped'; id: number; stamps: readonly string[] }
  /** Your errands now finished, waiting at the board (`realm/errands.ts` ids). */
  | { t: 'errands'; done: readonly string[] }
  /**
   * Sent away (or never seated): why. The socket closes after it, but for a
   * `go` the relay turned down (`private`, `room`: no such base, `busy`: the
   * API didn't answer, `roomFull`), which leaves the trainer where it stands,
   * and a `roomFull` right after a `welcome` (seated in the landing instead).
   */
  | { t: 'refused'; why: RealmRefusal }

/** Limits on what a client may send. */
export const REALM_LIMITS = {
  /** Any client message, in UTF-16 code units. */
  message: 4096,
  token: 4096,
  /** A room key, and a handle in one. */
  room: 48,
  /** Co-op room codes (`ROOM_CODE_LENGTH` in `net/protocol.ts`). */
  code: 5,
} as const

/** The WebSocket path of a city on its relay: `GET /realm/<city>/ws`. */
export const realmPath = (city: CityId) => `/realm/${city}/ws`
