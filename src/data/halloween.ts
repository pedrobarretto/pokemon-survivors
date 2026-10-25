import type { EnemyId } from './enemies'

/**
 * Noite das Bruxas: the Halloween event of 2026. For its Brasília days
 * (`from` to `to`, both included) every run is haunted (`game/halloween.ts`):
 * a ghost joins each stage of the cast, Ghost-type foes carry candies and
 * jack-o'-lanterns stand among the breakables. The candies fill a jar that
 * pays the event's rewards, and the lobby dresses for the night. Days are
 * `YYYY-MM-DD` keys, like `game/day.ts`'s.
 */
export const HALLOWEEN = {
  /** The lobby counts down to the night from this day. */
  teaser: '2026-10-21',
  from: '2026-10-24',
  to: '2026-11-02',
  /**
   * The Surto do dia of each event day, instead of the drawn one: a ghost a
   * day, Gastly on the 31st, Litwick's candles for the Día de Muertos and
   * Duskull, the Requiem Pokémon, for Finados. Every one is an outbreak
   * species (`OUTBREAK_SPECIES`); a day left out keeps the drawn outbreak.
   */
  outbreaks: {
    '2026-10-24': 'shuppet',
    '2026-10-25': 'phantump',
    '2026-10-26': 'sinistea',
    '2026-10-27': 'drowzee',
    '2026-10-28': 'honedge',
    '2026-10-29': 'dreepy',
    '2026-10-30': 'cubone',
    '2026-10-31': 'gastly',
    '2026-11-01': 'litwick',
    '2026-11-02': 'duskull',
  } as const satisfies Readonly<Record<string, EnemyId>>,
  /** The ghost that haunts each stage (one per `STAGES` entry), of a tier the stage draws. */
  haunts: ['shedinja', 'duskull', 'shuppet', 'lampent', 'sableye', 'misdreavus', 'banette', 'gengar'] as const satisfies readonly EnemyId[],
  /**
   * The night's bosses: in a haunted run each regular wave boss slot (named
   * by the boss it stands in for, Onix's at 2:30 and Snorlax's at 5:00) takes
   * one of its ghosts instead, drawn from the run's seed (`withHaunts`), so
   * every run meets another pair. Each pool's ghosts wear their slot's stats
   * (`ENEMIES`), so no draw is easier than another; each brings its own patterns
   * (`BOSS_PATTERNS`). The legendaries keep their slots.
   */
  bosses: {
    onix: ['mimikyuBoss', 'banetteBoss', 'sableyeBoss', 'drifblimBoss', 'mismagiusBoss', 'houndoomBoss'],
    snorlax: ['gengarBoss', 'chandelureBoss', 'gourgeistBoss', 'trevenantBoss', 'honchkrowBoss', 'dusknoirBoss'],
  } as const satisfies Partial<Record<EnemyId, readonly EnemyId[]>>,
  /**
   * Meta da comunidade: every account's jar summed by the API, each counting
   * up to `cap` (a jar far past the rest is a script's), toward `goal`.
   * Reaching it opens Mega Darkrai for everyone (`game/communityGoal.ts`).
   */
  community: { goal: 15_000_000, cap: 20_000 },
  /** Caça aos Fantasmas: candies each night boss's first defeat pays into the jar (`recordHunt`); beating them all pays `HUNT_REWARDS`. */
  hunt: { candies: 25 },
  candy: {
    /** Odds a fainted Ghost-type regular drops a candy. */
    ghost: 0.07,
    /** Candies a Ghost-type elite or a shiny drops. */
    elite: 2,
    shiny: 5,
    /** Candies every boss and Alpha drops, Ghost or not. */
    boss: 10,
  },
  pumpkin: {
    /** Share of the breakables that are jack-o'-lanterns. */
    share: 0.35,
    /** Odds a cracked jack-o'-lantern is a treat (candies) rather than a trick (a ring of ghosts). */
    treat: 0.7,
    /** Candies a treat spills, and the one a trick still leaves. */
    treatCandies: 4,
    trickCandies: 1,
    /** How many ghosts a trick sends, and how far from the player (world px) they ring in. */
    trickGhosts: 8,
    trickRadius: 120,
  },
} as const

/** Every night boss (`HALLOWEEN.bosses`), in pool order: the Caça aos Fantasmas checklist. */
export const NIGHT_BOSSES: readonly EnemyId[] = Object.values(HALLOWEEN.bosses).flat()

/** Whether `id` is one of the night bosses. */
export const isNightBoss = (id: unknown): id is EnemyId => NIGHT_BOSSES.some((b) => b === id)
