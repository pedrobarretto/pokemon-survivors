/**
 * The Poké Realm's mini games, Club Penguin style: what each is, where it's
 * played, what it pays and the trophies it gives. Import-free, like
 * `net/realm.ts` and `data/realmMap.ts`: the realm relay and the API read it
 * too (the relay checks brags against `feats`, the API caps the pay).
 *
 * Two kinds:
 * - `solo`: runs on the player's device alone (`realm/games/frame.ts` hosts
 *   it), opened from a spot in a town room or a piece of furniture in a base.
 *   Others only see the trainer busy at it (`RealmAct`) and its brags.
 * - `table`: turn-based, 2 seats, played at a table through the realm relay,
 *   which holds the board and checks every move with the game's pure rules
 *   (`net/realmTables.ts`, `realm/games/tables.ts`), so anyone in the room can
 *   watch. Sitting alone, the same rules play a bot on the device.
 *
 * Mini games never touch `src/game`: no `RULES_VERSION`, replays or hashes.
 *
 * Pay is ₽, through `POST /realm/game/claim` (`net/realmApi.ts`): the API
 * answers what a finished game is worth today under the caps and the client
 * adds it to the wallet the way a run's ₽ lands (runs are trusted the same
 * way). `pay` per game and `MINIGAME_DAILY` across all of them, per Brasília
 * day. Trophies (`trophies`) are furniture the API grants on its own word
 * from the stats it keeps (`furniture_owned`, source `game`): never sold,
 * never tradable (`source: 'trophy'` in `data/furniture.ts`).
 *
 * Names, descriptions and the feats' words live in i18n `minigames`, keyed by
 * these ids. A new game is an entry here, its i18n, its module in
 * `realm/games/` and a line in `realm/games/registry.ts`.
 */

/** How a solo game pays: `perPoint` ₽ per point of score, at most `perPlay` a game; `daily` the game's cap a day. */
export type SoloPay = { perPoint: number; perPlay: number; daily: number }

/** How a table game pays a win, a draw and a loss against a person; against the bot, `BOT_PAY` of it. `daily` the game's cap a day. */
export type TablePay = { win: number; draw: number; loss: number; daily: number }

/**
 * A trophy: the furniture piece (an id in `data/furniture.ts`, `source:
 * 'trophy'`) and when the API grants it: a stat reaching a number (`plays`
 * finished games, `wins` at a table, `best` the best solo score) or a feat
 * claimed once (`feat`, one of the game's `feats`).
 */
export type Trophy = { furniture: string; after: { stat: 'plays' | 'wins' | 'best'; at: number } | { feat: string } }

/** The town rooms a game can stand in (a `TownRoomId`, `data/realmMap.ts`, kept as a string so this file imports nothing); `null`: only in bases. */
type Where = 'plaza' | 'pier' | 'cafe' | 'trail' | 'arcade' | null

type SoloDef = {
  kind: 'solo'
  where: Where
  pay: SoloPay
  /** A score past this is refused as made up; a game shorter than `minMs` pays nothing. */
  maxScore: number
  minMs: number
  /** The moments a trainer can brag about (the relay broadcasts them, the game names them in i18n) and claim for trophies. */
  feats: readonly string[]
  trophies: readonly Trophy[]
}

type TableDef = {
  kind: 'table'
  where: Where
  seats: 2
  pay: TablePay
  minMs: number
  feats: readonly string[]
  trophies: readonly Trophy[]
}

export type MinigameDef = SoloDef | TableDef

/**
 * The games. Numbers are a first rough pass (tune from play): a game pays
 * like a few minutes of a run, the caps keep a day of mini games below a
 * good run's ₽.
 */
export const MINIGAMES = {
  /**
   * Fishing off the pier (`realm/games/fishing.ts`): cast, wait for the bite,
   * reel. Feats: a Feebas, the shiny Gyarados, a round of 300 points
   * (`BIG_HAUL`). Trophies: the rod rack after 20 rounds, the golden Magikarp
   * plaque for a round of 400, the shiny Gyarados trophy for hooking it.
   */
  fishing: {
    kind: 'solo',
    where: 'pier',
    pay: { perPoint: 1, perPlay: 250, daily: 800 },
    maxScore: 2000,
    minMs: 30_000,
    feats: ['feebas', 'shinyGyarados', 'bigHaul'],
    trophies: [
      { furniture: 'fishingRodRack', after: { stat: 'plays', at: 20 } },
      { furniture: 'goldenMagikarpPlaque', after: { stat: 'best', at: 400 } },
      { furniture: 'shinyGyaradosTrophy', after: { feat: 'shinyGyarados' } },
    ],
  },
  /**
   * Berry Rain at the arcade's cabinets (`realm/games/berryCatch.ts`): catch
   * falling berries, keep clear of Voltorb, 90 s. A good round scores 1500–
   * 3000 (berries 5–15, the golden one 50, times a combo up to ×4).
   */
  berryCatch: {
    kind: 'solo',
    where: 'arcade',
    pay: { perPoint: 0.1, perPlay: 200, daily: 600 },
    maxScore: 9000,
    minMs: 20_000,
    feats: ['flawless', 'goldRush', 'combo50'],
    trophies: [{ furniture: 'berryBasket', after: { stat: 'best', at: 2500 } }],
  },
  /**
   * Whack-a-Diglett at the arcade's cabinets (`realm/games/whackDiglett.ts`):
   * 60 s of pop-ups. A good round scores 1500–3000 (a Diglett 10, a Dugtrio
   * 40, times a combo up to ×5; a Voltorb costs 50).
   */
  whackDiglett: {
    kind: 'solo',
    where: 'arcade',
    pay: { perPoint: 0.1, perPlay: 200, daily: 600 },
    maxScore: 9000,
    minMs: 20_000,
    feats: ['combo30', 'dugtrio'],
    trophies: [{ furniture: 'goldenMallet', after: { stat: 'best', at: 2500 } }],
  },
  /** Four in a row with Poké Balls and Great Balls (agent B), at the café's tables and a base's game table. */
  fourInRow: {
    kind: 'table',
    where: 'cafe',
    seats: 2,
    pay: { win: 150, draw: 60, loss: 30, daily: 600 },
    minMs: 20_000,
    feats: [],
    trophies: [
      { furniture: 'fourInRowCup', after: { stat: 'wins', at: 10 } },
      { furniture: 'fourInRowGiant', after: { stat: 'wins', at: 50 } },
    ],
  },
  /** The type duel (agent C): Fire, Water and Grass cards with a power, played at once. */
  typeDuel: {
    kind: 'table',
    where: 'cafe',
    seats: 2,
    pay: { win: 150, draw: 60, loss: 30, daily: 600 },
    /**
     * A best of three duels. The quickest 2–0 (3 rounds a duel, every card
     * played the instant it can be) measured 15.8 s against the bot; a fast
     * real player's 2–0 takes 20 s and more, most matches 30–90 s.
     */
    minMs: 15_000,
    /** `perfectDuel`: the match won without the rival banking a single card in any duel. */
    feats: ['perfectDuel'],
    trophies: [
      { furniture: 'duelCup', after: { stat: 'wins', at: 10 } },
      { furniture: 'perfectDuelPennant', after: { feat: 'perfectDuel' } },
    ],
  },
} as const satisfies Record<string, MinigameDef>

export type MinigameId = keyof typeof MINIGAMES

export const MINIGAME_IDS = Object.keys(MINIGAMES) as MinigameId[]

export type SoloGameId = { [K in MinigameId]: (typeof MINIGAMES)[K]['kind'] extends 'solo' ? K : never }[MinigameId]

export type TableGameId = { [K in MinigameId]: (typeof MINIGAMES)[K]['kind'] extends 'table' ? K : never }[MinigameId]

export const isMinigameId = (v: unknown): v is MinigameId => typeof v === 'string' && Object.hasOwn(MINIGAMES, v)

export const isSoloGame = (id: MinigameId): id is SoloGameId => MINIGAMES[id].kind === 'solo'

export const isTableGame = (id: MinigameId): id is TableGameId => MINIGAMES[id].kind === 'table'

/** Whether `feat` is one of `game`'s feats (what the relay lets a trainer brag about). */
export const isFeat = (game: unknown, feat: unknown): boolean =>
  isMinigameId(game) && typeof feat === 'string' && (MINIGAMES[game].feats as readonly string[]).includes(feat)

/** ₽ all mini games together pay an account in a Brasília day. */
export const MINIGAME_DAILY = 2000

/** A table game against the bot pays this share of the same result against a person. */
export const BOT_PAY = 0.5

/** A game played with another trainer in the room pays this much more, before the caps. The API reads the room from the relays' presence reports, never the client. */
export const COMPANY_PAY = 1.25

/** How a finished game ended, as the client claims it: a solo score, or a table result and against whom. */
export type GameOutcome = { score: number } | { result: 'win' | 'draw' | 'loss'; vs: 'human' | 'bot' }

/**
 * What a finished game is worth before the daily caps (whole ₽), or null
 * when the outcome doesn't fit the game (a score past `maxScore`, a table
 * result for a solo game) or it ended too quickly (`ms` under `minMs`).
 */
export const coinsFor = (game: MinigameId, outcome: GameOutcome, ms: number): number | null => {
  const def: MinigameDef = MINIGAMES[game]
  if (!Number.isFinite(ms) || ms < def.minMs) return null
  if (def.kind === 'solo') {
    if (!('score' in outcome) || !Number.isFinite(outcome.score) || outcome.score < 0 || outcome.score > def.maxScore) return null
    return Math.min(def.pay.perPlay, Math.floor(outcome.score * def.pay.perPoint))
  }
  if (!('result' in outcome)) return null
  const base = def.pay[outcome.result]
  return Math.floor(outcome.vs === 'bot' ? base * BOT_PAY : base)
}

/** What the caps leave of `coins`: the game's `daily` minus what it paid today, and `MINIGAME_DAILY` minus what all paid. */
export const capped = (game: MinigameId, coins: number, paidGame: number, paidAll: number): number =>
  Math.max(0, Math.min(coins, MINIGAMES[game].pay.daily - paidGame, MINIGAME_DAILY - paidAll))

/** A game's running stats, as the API keeps them per account (what trophies count from). */
export type GameStats = { plays: number; wins: number; best: number; feats: readonly string[] }

/** The trophies of `game` that `stats` has earned (furniture ids), in the table's order. */
export const trophiesEarned = (game: MinigameId, stats: GameStats): string[] =>
  (MINIGAMES[game].trophies as readonly Trophy[]).filter((t) => ('feat' in t.after ? stats.feats.includes(t.after.feat) : stats[t.after.stat] >= t.after.at)).map((t) => t.furniture)

/**
 * The furniture that plays mini games in a base (walk up to it, press E or
 * tap): a piece id to the games it offers (one opens at once, more ask which).
 * `realm/games/registry.ts` opens them; `ui/realm.ts` makes the base's spots
 * from the layout (`gameSpots`).
 */
export const FURNITURE_GAMES: Readonly<Record<string, readonly MinigameId[]>> = {
  arcadeCabinet: ['berryCatch', 'whackDiglett'],
  arcadeCabinetTeal: ['berryCatch', 'whackDiglett'],
  gameTable: ['fourInRow', 'typeDuel'],
}
