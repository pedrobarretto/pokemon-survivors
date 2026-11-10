/**
 * The Poké Realm's Estampas, Club Penguin style: a book of small feats, some
 * of them hidden until earned. Import-free, like `net/realm.ts`: the realm
 * relay reads the deeds.
 *
 * Everything runs on one pipeline. A **deed** is something a trainer did,
 * seen by someone who isn't the trainer's device:
 * - the relay reports what happens in the town (`POST /realm/deeds`,
 *   `net/realmRelay.ts`): rooms, seats, talk, company, parties, tables;
 * - the API adds what it sees itself: a claimed mini game and its feats, a
 *   like, a saved base.
 *
 * The API keeps each account's count per deed, and a stamp is a condition over
 * those counts (`realm/stamps.ts`). The day's Recados (`realm/errands.ts`) read
 * the same deeds. Earning a stamp changes nothing in `src/game`: no
 * `RULES_VERSION`, replays or hashes.
 *
 * The game's loyalty card already says "stamps" (`game/loyalty.ts`): these are
 * `realmStamps`, "Estampas" to players. Names and descriptions live in i18n
 * `realm.stamps`, keyed by these ids. A hidden stamp shows neither until earned.
 */

const ROOMS = ['plaza', 'pier', 'cafe', 'trail', 'arcade'] as const
/** Every town bench, as `<room>:<index of its spot in REALM_ROOMS>` (`realmStamps.test.ts` holds them to the map). */
const BENCHES = ['plaza:3', 'plaza:4', 'pier:1', 'cafe:1', 'cafe:2', 'trail:4', 'trail:5', 'arcade:5'] as const
/** `REALM_EMOTES` less `look`, which only some trainers have. */
const EMOTES = ['wave', 'heart', 'laugh', 'music', 'sleep', 'angry', 'question', 'exclaim'] as const
const GAMES = ['fishing', 'berryCatch', 'whackDiglett', 'claw', 'safari', 'dig', 'fourInRow', 'typeDuel'] as const
/** `<game>:<feat>` of `MINIGAMES` (held to it by `realmStamps.test.ts`). */
const FEATS = [
  'fishing:feebas',
  'fishing:shinyGyarados',
  'fishing:bigHaul',
  'fishing:wishiwashi',
  'berryCatch:flawless',
  'berryCatch:goldRush',
  'berryCatch:combo50',
  'whackDiglett:combo30',
  'whackDiglett:dugtrio',
  'claw:plush',
  'safari:caught',
  'safari:shiny',
  'dig:golden',
  'dig:fossilOrStone',
  'typeDuel:perfectDuel',
] as const
/** The kinds of Hora do Realm (`data/realmEvents.ts`). */
const EVENT_KINDS = ['tide', 'storm', 'tables'] as const

/** Everything a trainer can be seen doing. Who reports each is in the comments. */
const DEED_LIST = [
  /* The relay. */
  ...ROOMS.map((r) => `room:${r}` as const),
  ...BENCHES.map((b) => `bench:${b}` as const),
  ...EMOTES.map((e) => `emote:${e}` as const),
  /** Sat on anything (a bench, a sofa, a bed). */
  'sit',
  /** Said any quick-chat line. */
  'say',
  /** The sleep emote while sitting on a town bench. */
  'napBench',
  /** Inside the pier's lagoon (`pool` spot). */
  'lagoon',
  /** In the town between 3:00 and 3:59, Brasília time. */
  'owl',
  /** A minute in a room with at least one other trainer (reported once per `DEED_COOLDOWN_MS`). */
  'company',
  /** In a room with `CROWD` trainers or more, this one included. */
  'crowd',
  /** In a room with someone whose partner is the same species. */
  'twin',
  'party',
  'portal',
  /** Walked into someone else's base. */
  'base:visit',
  /** In its own base while someone else came in. */
  'base:host',
  /** Finished a table game against a person, and won one. */
  'table:human',
  'table:win',
  /** In the right room during a Hora do Realm: its kind, and any. */
  ...EVENT_KINDS.map((k) => `event:${k}` as const),
  'event',
  /* The API. */
  ...GAMES.map((g) => `game:${g}` as const),
  ...FEATS.map((f) => `feat:${f}` as const),
  /** Liked someone's base. */
  'like',
  /** Saved a base holding `FURNISHED` pieces or more. */
  'furnish',
  /** Finished all of a day's Recados. */
  'errands:all',
] as const

export type Deed = (typeof DEED_LIST)[number]

const DEEDS: ReadonlySet<string> = new Set(DEED_LIST)

export const isDeed = (v: unknown): v is Deed => typeof v === 'string' && DEEDS.has(v)

/** A room this full is a crowd (`crowd`). */
export const CROWD = 5

/** Pieces in a base that make it furnished (`furnish`). */
export const FURNISHED = 10

/** The relay reports the same deed of the same trainer at most this often, so walking in circles doesn't count up. */
export const DEED_COOLDOWN_MS = 60_000

export type StampTier = 'easy' | 'medium' | 'hard' | 'extreme'

export type StampGroup = 'town' | 'social' | 'bases' | 'games' | 'events'

/** A deed done `at` times (one without it), or every deed of a list at least once. */
export type StampCondition = { deed: Deed; at?: number } | { all: readonly Deed[] }

export type StampDef = { group: StampGroup; tier: StampTier; when: StampCondition; hidden?: true }

const every = <T extends string, P extends string>(prefix: P, ids: readonly T[]) => ids.map((id) => `${prefix}:${id}` as const)

/** The book, in the order it shows. */
export const STAMPS = {
  /* The town. */
  firstSteps: { group: 'town', tier: 'easy', when: { deed: 'room:plaza' } },
  tourist: { group: 'town', tier: 'easy', when: { all: every('room', ROOMS) } },
  errandRunner: { group: 'town', tier: 'easy', when: { deed: 'errands:all' } },
  reliable: { group: 'town', tier: 'medium', when: { deed: 'errands:all', at: 7 } },
  dependable: { group: 'town', tier: 'hard', when: { deed: 'errands:all', at: 30 } },
  benchWarmer: { group: 'town', tier: 'medium', when: { all: every('bench', BENCHES) }, hidden: true },
  catNap: { group: 'town', tier: 'easy', when: { deed: 'napBench' }, hidden: true },
  wetFeet: { group: 'town', tier: 'easy', when: { deed: 'lagoon' }, hidden: true },
  nightOwl: { group: 'town', tier: 'medium', when: { deed: 'owl' }, hidden: true },

  /* Other trainers. */
  hello: { group: 'social', tier: 'easy', when: { deed: 'say' } },
  expressive: { group: 'social', tier: 'medium', when: { all: every('emote', EMOTES) } },
  goodCompany: { group: 'social', tier: 'easy', when: { deed: 'company' } },
  regular: { group: 'social', tier: 'medium', when: { deed: 'company', at: 30 } },
  townFixture: { group: 'social', tier: 'hard', when: { deed: 'company', at: 200 } },
  partyStarter: { group: 'social', tier: 'medium', when: { deed: 'party' } },
  portalHopper: { group: 'social', tier: 'medium', when: { deed: 'portal' } },
  crowded: { group: 'social', tier: 'hard', when: { deed: 'crowd' }, hidden: true },
  twins: { group: 'social', tier: 'hard', when: { deed: 'twin' }, hidden: true },

  /* Secret bases. */
  neighbor: { group: 'bases', tier: 'easy', when: { deed: 'base:visit' } },
  wanderer: { group: 'bases', tier: 'medium', when: { deed: 'base:visit', at: 15 } },
  fanMail: { group: 'bases', tier: 'easy', when: { deed: 'like' } },
  decorator: { group: 'bases', tier: 'medium', when: { deed: 'furnish' } },
  host: { group: 'bases', tier: 'medium', when: { deed: 'base:host' } },
  openHouse: { group: 'bases', tier: 'hard', when: { deed: 'base:host', at: 10 }, hidden: true },

  /* Mini games. */
  goneFishing: { group: 'games', tier: 'easy', when: { deed: 'game:fishing' } },
  oldSalt: { group: 'games', tier: 'medium', when: { deed: 'game:fishing', at: 25 } },
  arcadeRat: { group: 'games', tier: 'easy', when: { all: ['game:berryCatch', 'game:whackDiglett'] } },
  tableTalk: { group: 'games', tier: 'easy', when: { deed: 'table:human' } },
  tableChampion: { group: 'games', tier: 'hard', when: { deed: 'table:win', at: 10 } },
  bigHaul: { group: 'games', tier: 'hard', when: { deed: 'feat:fishing:bigHaul' } },
  flawless: { group: 'games', tier: 'hard', when: { deed: 'feat:berryCatch:flawless' } },
  dugtrioDay: { group: 'games', tier: 'medium', when: { deed: 'feat:whackDiglett:dugtrio' }, hidden: true },
  ugliestFish: { group: 'games', tier: 'hard', when: { deed: 'feat:fishing:feebas' }, hidden: true },
  redTide: { group: 'games', tier: 'extreme', when: { deed: 'feat:fishing:shinyGyarados' }, hidden: true },
  perfectDuel: { group: 'games', tier: 'hard', when: { deed: 'feat:typeDuel:perfectDuel' }, hidden: true },

  /* The Hora do Realm. */
  highTide: { group: 'events', tier: 'easy', when: { deed: 'event:tide' } },
  stormChaser: { group: 'events', tier: 'easy', when: { deed: 'event:storm' } },
  tableNight: { group: 'events', tier: 'easy', when: { deed: 'event:tables' } },
  everyHour: { group: 'events', tier: 'medium', when: { all: every('event', EVENT_KINDS) } },
  neverMissed: { group: 'events', tier: 'extreme', when: { deed: 'event', at: 25 } },
} as const satisfies Record<string, StampDef>

export type StampId = keyof typeof STAMPS

export const STAMP_IDS = Object.keys(STAMPS) as StampId[]

export const isStampId = (v: unknown): v is StampId => typeof v === 'string' && Object.hasOwn(STAMPS, v)

/** A milestone's reward: a furniture id (`source: 'trophy'`, never sold), or a title or frame the API gives as a gift (once, with the gift id `realmStamps:<at>`). */
export type StampReward = { kind: 'furniture'; id: string } | { kind: 'title'; id: string } | { kind: 'frame'; id: string }

/** What a number of stamps brings, like the loyalty card's milestones. */
export const STAMP_MILESTONES = [
  { at: 5, reward: { kind: 'furniture', id: 'stampDesk' } },
  { at: 12, reward: { kind: 'frame', id: 'stampFrame' } },
  { at: 20, reward: { kind: 'furniture', id: 'stampCabinet' } },
  { at: 30, reward: { kind: 'title', id: 'stampCollector' } },
  { at: 38, reward: { kind: 'furniture', id: 'goldenStampPress' } },
] as const satisfies readonly { at: number; reward: StampReward }[]
