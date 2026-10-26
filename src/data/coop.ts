/**
 * Co-op numbers (`game/coop.ts`). A team of `n` active players (not away, not
 * gone) faces a denser, tougher horde and tougher bosses; every Exp. Candy
 * reaches the whole team (split so levels keep a solo pace) and ₽ are worth a
 * bit more, since the team's total is split at the end. Scalings read
 * 1 + per·(n − 1), so a team of one plays like solo. Tuned with headless bot
 * runs (see the PR that brought them).
 */
export const COOP = {
  /** Players in a run, at most. */
  maxPlayers: 4,
  /** Px between teammates at the start. */
  spacing: 34,
  /**
   * The world's view for the simulation (spawn ring, despawns, what's on a
   * screen): every client must simulate the same, whatever its window; the
   * shell draws its own camera. The union of what a desktop (480×270 to
   * 480×300) and a phone held either way (about 234×507 and 507×234 world px)
   * draw, so nothing spawns or vanishes in sight on any of them.
   */
  view: { w: 480, h: 512 },
  /** How far from a player (px) a shiny pops in to be seen on every screen: within a phone's half width held upright. */
  inSight: 100,
  scale: {
    /** Regular spawn rate. */
    spawn: 0.5,
    /** Regular horde cap. */
    cap: 0.4,
    /** Regular enemy HP. */
    hp: 0.25,
    /** Boss, Alpha, rift legendary and Arceus HP: everyone hits it at once. */
    bossHp: 0.75,
    /** Exp. Candy reaching each player is divided by this. */
    xp: 0.55,
    /** ₽ collected (the team's total is divided by the players at the end). */
    coins: 0.4,
  },
  revive: {
    /** Seconds a teammate must stand next to a fainted player. */
    time: 3,
    /** How close (px, body to Poké Ball) counts as next to them. */
    radius: 26,
    /** Share of max HP they get back up with. */
    hp: 0.4,
    /** Seconds of invulnerability after getting up (and after coming back from away). */
    iframes: 2,
    /** Progress lost per second while nobody stands there. */
    decay: 1.5,
  },
  pick: {
    /** Seconds a player's pick screen waits before it picks for them. */
    time: 15,
    /** A pick that opens another screen (a fork's branches, the next level-up) gives at least this long for it. */
    next: 8,
    /** Screens picked for a player in one go before giving up (a guard: every pick ends in a few). */
    chain: 64,
  },
  /** Seconds the endless vote stays open on the victory screen. */
  voteTime: 20,
  away: {
    /**
     * Seconds an away player still standing holds the world for the team (a
     * locked phone, a dropped connection). Past that they stop holding it and
     * count as down for the wipe, so a teammate who fainted isn't left
     * waiting forever.
     */
    hold: 75,
  },
} as const

/**
 * What the co-op beta leaves out (Pedro, 2026-10-21: the normal mode only, as
 * stable as it gets; each can be switched on once a bot soak goes through it).
 * This is the one list of them.
 *
 * Never in co-op, by construction (`createCoopGame` reads no save, day or
 * clock): the Legend mode (`CoopLoadout.starter` is a starter or a hatched
 * family), the Poké Mart's Bag, armed TMs, owned evolution items and Bottle
 * Caps (Kecleon's shop), the day's outbreak, the Noite das Bruxas (ghosts,
 * night bosses, candies, jack-o'-lanterns) and the lucky first egg. The run's
 * roster is drawn from its own rng. Ranking, the Desafio do dia, companions
 * and the server's replay checks are the shell's to skip.
 *
 * Switched off in the simulation while `g.coop !== null` (`coopLocked`):
 * - `places`: no place entrance opens (cave, graveyard, sky, nor the hidden zones; `updatePlaceEntrance`).
 * - `landmarks`: landmarks are scenery only: no names, treasures or tunnels (`updateLandmarks`).
 * - `domains`: an epic rift's legendary is fought in its old arena
 *   (`data/arenas.ts`), not its domain (`riftDomain`): no omen sky or weather,
 *   no tear, no crossing.
 */
export const COOP_LOCKS = { places: true, landmarks: true, domains: true } as const

/** Whether co-op leaves `what` out of this run (`COOP_LOCKS`); never solo. */
export const coopLocked = (g: { coop: object | null }, what: keyof typeof COOP_LOCKS) => g.coop !== null && COOP_LOCKS[what]
