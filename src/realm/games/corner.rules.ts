/**
 * The Rocket Game Corner's rules (`MINIGAMES.slots`, `MINIGAMES.sweep`):
 * pure and import-free, shared by the API, which rolls every spin and deals
 * every board, and the client, which only draws what the API answered.
 *
 * Tokens: bought only with ₽ (`CORNER.packs`, a Brasília day's cap), never
 * with gems or money, and won at the slots and at Koffing Sweep. The prize
 * counter (`data/rocketCorner.ts`) is where they go: the player picks the
 * prize, and luck only gets them there sooner.
 *
 * Both games play as long as the player likes. The slots keep a house edge
 * (`slotsReturn`, tested under 1), so spinning on only ever spends tokens on
 * average and needs no cap. Koffing Sweep costs nothing to deal and pays the
 * player's skill, so its pay falls off through the day instead of stopping
 * (`sweepCredit`): full, then half, then free play, where boards still deal
 * and the level still moves but nothing pays.
 */

export const CORNER = {
  /** Token packs at the counter: tokens for ₽. */
  packs: [
    { tokens: 50, price: 1000 },
    { tokens: 250, price: 5000 },
    { tokens: 1000, price: 20000 },
  ],
  /** Tokens a Brasília day may buy (₽100k: a hoard spends over days, a day's runs rarely reach it). */
  buyDaily: 5000,
  /** Koffing Sweep's day, in tokens paid: in full up to `full`, at half up to `half`, then free play. */
  sweepDay: { full: 1500, half: 2250 },
} as const

/* ---------------- The slots ---------------- */

/** The reels' symbols, best first: Team Rocket's seven, the four Poké Balls, an Oran Berry and Magikarp. */
export const SYMBOLS = ['seven', 'master', 'ultra', 'great', 'poke', 'oran', 'magikarp'] as const
export type SlotSymbol = (typeof SYMBOLS)[number]

/** Each reel's strip, top to bottom (the same three reels): what stops on the line is one of these. */
export const STRIP: readonly SlotSymbol[] = [
  'poke', 'oran', 'great', 'magikarp', 'poke', 'ultra', 'oran', 'poke', 'seven', 'magikarp', 'great', 'oran',
  'poke', 'master', 'magikarp', 'great', 'oran', 'poke', 'ultra', 'magikarp', 'oran', 'great', 'poke', 'magikarp',
]

/** What three of a symbol on a line pay, per token bet on it. */
export const PAYS: Readonly<Record<SlotSymbol, number>> = { seven: 300, master: 200, ultra: 80, great: 28, poke: 10, oran: 14, magikarp: 7 }

/** An Oran Berry on the left reel's square of a line pays this alone (the classic cherry). */
export const ORAN_LEFT = 2

/** Bet 1 plays the middle line; 2 adds the top and the bottom; 3 the two diagonals too. */
export const BETS = [1, 2, 3] as const
export type Bet = (typeof BETS)[number]

/** The lines a bet plays, as the row (0 top, 1 middle, 2 bottom) each reel's square sits on. */
export const LINES: Readonly<Record<Bet, readonly (readonly [number, number, number])[]>> = {
  1: [[1, 1, 1]],
  2: [[1, 1, 1], [0, 0, 0], [2, 2, 2]],
  3: [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]],
}

/** What a spin costs: a token per line, so a bet of 3 plays five lines for 5. */
export const spinCost = (bet: Bet) => LINES[bet].length

export const isBet = (v: unknown): v is Bet => v === 1 || v === 2 || v === 3

/** The symbol at `row` (0..2) of a reel stopped at `stop` (the middle row's index in `STRIP`). */
export const symbolAt = (stop: number, row: number): SlotSymbol => STRIP[(((stop + row - 1) % STRIP.length) + STRIP.length) % STRIP.length]!

/** A line that paid: which (its index in `LINES[bet]`), the symbol and the tokens. */
export type LineWin = { line: number; symbol: SlotSymbol; tokens: number }

/** What three reel stops pay for `bet`: each line's three of a kind, or an Oran Berry on its left square. */
export const spinWins = (stops: readonly [number, number, number], bet: Bet): LineWin[] => {
  const wins: LineWin[] = []
  LINES[bet].forEach((rows, line) => {
    const [a, b, c] = rows.map((row, reel) => symbolAt(stops[reel]!, row))
    if (a === b && b === c) wins.push({ line, symbol: a!, tokens: PAYS[a!] })
    else if (a === 'oran') wins.push({ line, symbol: 'oran', tokens: ORAN_LEFT })
  })
  return wins
}

/** A spin's three stops from three uniform draws in [0, 1) (the API's dice). */
export const spinStops = (dice: () => number): [number, number, number] => [0, 1, 2].map(() => Math.floor(dice() * STRIP.length) % STRIP.length) as [number, number, number]

/** The slots' expected return per token bet, worked out over every stop: what a long day of spins gives back. */
export const slotsReturn = (bet: Bet) => {
  const n = STRIP.length
  let paid = 0
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) for (const w of spinWins([a, b, c], bet)) paid += w.tokens
  return paid / (n * n * n) / spinCost(bet)
}

/* ---------------- Koffing Sweep ---------------- */

/**
 * Koffing Sweep, a hidden-grid deduction puzzle: a 5 × 5 board of face-down
 * tiles, each a coin pile (1, 2 or 3) or a Koffing. Each row and column says
 * how many coins it holds and how many Koffing hide in it. Flip tiles to add
 * their coins to the round's pot; a Koffing blows the pot away. Flip every
 * 2 and 3 to clear the board (a bonus, and the next level); stop any time to
 * bank the pot. Each level hides more Koffing and richer piles, and pays its
 * pot times the level.
 */
export const SWEEP = {
  size: 5,
  levels: [
    { koffing: 5, twos: 3, threes: 1 },
    { koffing: 6, twos: 3, threes: 2 },
    { koffing: 7, twos: 4, threes: 2 },
    { koffing: 8, twos: 4, threes: 3 },
    { koffing: 9, twos: 5, threes: 3 },
  ],
  /** Clearing a board pays this many tokens times its level on top of the pot. */
  clearBonus: 8,
} as const

/** A tile: 0 a Koffing, else its coins. */
export type Tile = 0 | 1 | 2 | 3

export type SweepLevel = 1 | 2 | 3 | 4 | 5

export const clampLevel = (n: number): SweepLevel => Math.max(1, Math.min(SWEEP.levels.length, Math.floor(n))) as SweepLevel

/** Deals a level's board from uniform draws in [0, 1): its Koffing and piles shuffled in among 1s. */
export const dealBoard = (level: SweepLevel, dice: () => number): Tile[] => {
  const { koffing, twos, threes } = SWEEP.levels[level - 1]!
  const n = SWEEP.size * SWEEP.size
  const tiles: Tile[] = [...Array<Tile>(koffing).fill(0), ...Array<Tile>(twos).fill(2), ...Array<Tile>(threes).fill(3)]
  while (tiles.length < n) tiles.push(1)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(dice() * (i + 1)) % (i + 1)
    const t = tiles[i]!
    tiles[i] = tiles[j]!
    tiles[j] = t
  }
  return tiles
}

/** A row's or a column's hint: the coins it holds and its Koffing. */
export type Hint = { coins: number; koffing: number }

/** Every row's hint, then every column's. */
export const hintsOf = (board: readonly Tile[]): { rows: Hint[]; cols: Hint[] } => {
  const s = SWEEP.size
  const hint = (cells: number[]): Hint => ({ coins: cells.reduce((a, i) => a + board[i]!, 0), koffing: cells.filter((i) => board[i] === 0).length })
  const idx = Array.from({ length: s }, (_, k) => k)
  return { rows: idx.map((r) => hint(idx.map((c) => r * s + c))), cols: idx.map((c) => hint(idx.map((r) => r * s + c))) }
}

/** Whether every 2 and 3 of `board` is face up among `flipped`. */
export const cleared = (board: readonly Tile[], flipped: readonly number[]) => board.every((t, i) => t < 2 || flipped.includes(i))

/** The pot so far: the coins of the tiles flipped. */
export const potOf = (board: readonly Tile[], flipped: readonly number[]) => flipped.reduce((sum, i) => sum + (board[i] ?? 0), 0)

/** What a round banks: its pot times its level, plus the bonus when the board was cleared. */
export const sweepPay = (pot: number, level: SweepLevel, clear: boolean) => pot * level + (clear ? SWEEP.clearBonus * level : 0)

/** The next round's level: up after a clear, down to how many tiles it lived through after a Koffing, the same after banking. */
export const nextLevel = (level: SweepLevel, outcome: 'clear' | 'koffing' | 'bank', flips: number): SweepLevel =>
  outcome === 'clear' ? clampLevel(level + 1) : outcome === 'koffing' ? clampLevel(Math.min(level, flips)) : level

/** A round as its player sees it: the hints, what's face up and the pot (the API never sends the face-down tiles). */
export type SweepView = { level: SweepLevel; hints: { rows: Hint[]; cols: Hint[] }; flipped: readonly { at: number; tile: Tile }[]; pot: number; over: 'clear' | 'koffing' | 'bank' | null }

/** The view of a round of `board` with `flipped` face up; once it's over, every tile shows. */
export const sweepView = (level: SweepLevel, board: readonly Tile[], flipped: readonly number[], over: SweepView['over']): SweepView => ({
  level,
  hints: hintsOf(board),
  flipped: (over ? board.map((_, i) => i) : flipped).map((at) => ({ at, tile: board[at]! })),
  pot: over === 'koffing' ? 0 : potOf(board, flipped),
  over,
})

/* ---------------- The day ---------------- */

/** What Koffing Sweep's pay rate is with `won` tokens already paid today: 1 in full, 0.5 at half, 0 in free play. */
export const sweepRate = (won: number): 1 | 0.5 | 0 => (won < CORNER.sweepDay.full ? 1 : won < CORNER.sweepDay.half ? 0.5 : 0)

/** What a board's pay `tokens` comes to with `won` already paid today: the full part, then half of the rest, up to the day's end. */
export const sweepCredit = (tokens: number, won: number) => {
  const { full, half } = CORNER.sweepDay
  const whole = Math.max(0, Math.min(tokens, full - won))
  const halved = Math.max(0, Math.min(Math.floor((tokens - whole) / 2), half - Math.max(won, full)))
  return whole + halved
}

/** Whether a pack can be bought with `bought` tokens bought today. */
export const canBuy = (pack: number, bought: number) => {
  const p = CORNER.packs[pack]
  return p !== undefined && bought + p.tokens <= CORNER.buyDaily
}
