import { dir8, type Vec } from '../engine/math'
import { createRng } from '../engine/rng'
import { createGrid } from '../engine/spatial'
import { bodyOf } from '../data/bodies'
import type { EnemyId } from '../data/enemies'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { BAG_ITEMS } from './bag'
import { updateAttacks } from './attacks'
import { createBiome, updateBiome } from './biomes'
import { healPlayer } from './combat'
import { createDexLog } from './dex'
import { DEFAULT_DIFFICULTY, type Difficulty } from './difficulty'
import { updateBosses, updateHazards } from './bosses'
import { updateConsumables } from './consumables'
import { updateEffects } from './effects'
import { updateEndless } from './endlessSystem'
import { rebuildGrid, updateEnemies } from './enemies'
import { COOP } from '../data/coop'
import { checkWipe, createCoop, updateRevives } from './coop'
import { actAs, followPlayers, inPlay, present } from './players'
import { applyOffer, loadout, pendingEvolution, recomputeStats, rollOffers, xpFor } from './leveling'
import { createMapEvents, updateMapEvents } from './mapEvents'
import { createMegaState, updateMega, updateMegaIntro } from './mega'
import { NO_RANKS, runCharges, type Ranks } from './meta'
import type { MegaState } from './mega'
import { isManual, MOVES, moveStats } from './moves'
import { createSpecialState, specialBusy, specialSpeedFactor, updateSpecial } from './special'
import { updatePickups } from './pickups'
import { rollShiny, SHINY_ODDS, shinyBoost } from './shiny'
import { updateProps } from './props'
import { withOutbreak } from './outbreak'
import { createTerrain, groundAt, playerWaterPace, updateTerrain } from './terrain'
import { drawRoster, type Roster } from './roster'
import { createRiftState } from './rift'
import { updateArena } from './riftArena'
import { updateRiftPortal } from './riftPortal'
import { updateSightings } from './sightings'
import { updateSpawner } from './spawner'
import { updateStatuses } from './statusSystem'
import { createTally } from './tally'
import { createWeather, updateWeather } from './weather'
import { updateTraits } from './traitSystem'
import { BASE_STATS } from './stats'
import { TERRAIN } from '../data/terrain'
import type { Game, Offer, Player } from './types'
import * as dm from '../engine/dmath'

export const EVOLUTION_TIME = 4.6

/** The dex number of a player's current form (the acting player by default). */
export const playerDex = (g: Game, p: Player = g.player) => PLAYABLE[p.starter].line[p.stage]!.dex

/** What the save brings into a run besides the Poké Mart ranks. */
export type RunOptions = {
  /** Picked on the starter select screen; Normal when omitted. */
  difficulty?: Difficulty
  /** The run plays shiny from the start (a shiny hatch, or the shiny starter picked): the whole run uses its shiny form. */
  shiny?: boolean
  /** The player never had an egg, so the first egg roll can't miss (`rollEgg`). */
  luckyEgg?: boolean
  /** The day's outbreak species (`game/outbreak.ts`), put in every stage of the roster (`withOutbreak`, which a roster drawn ahead may already have). */
  outbreak?: EnemyId | null
  /** Bag items the run uses (`game/bag.ts`): a Lure doubles wild shinies, an Incense egg drops. */
  lure?: boolean
  incense?: boolean
}

/** One player's side of a run: their Pokémon, its hatched shininess and their Poké Mart ranks. */
export type PlayerSetup = { starter: PlayableId; ranks: Ranks; shiny: boolean }

const bodyRadius = (dex: number) => Math.max(6, Math.round(bodyOf(dex).bodyW * 0.3))

const createPlayer = (slot: number, setup: PlayerSetup, lucky: boolean, x: number, view: Game['view']): Player => {
  const def = PLAYABLE[setup.starter]
  return {
    slot,
    starter: setup.starter,
    ranks: setup.ranks,
    x, y: 0,
    facing: { x: 1, y: 0 },
    vx: 0, vy: 0,
    dir: 0,
    moving: false,
    hp: 0,
    level: 1,
    xp: 0,
    xpNext: xpFor(1),
    iframes: 0,
    hurt: 0,
    stage: 0,
    moves: [{ id: def.signature, level: 1, cooldown: 0.4 }],
    items: [],
    stats: BASE_STATS,
    radius: bodyRadius(def.line[0].dex),
    animTime: 0,
    shiny: lucky || setup.shiny,
    luckyShiny: lucky,
    walked: 0,
    special: createSpecialState(),
    mega: createMegaState() satisfies MegaState,
    ...runCharges(setup.ranks),
    pendingLevelUps: 0,
    offers: [],
    round: 0,
    evolution: null,
    damageByMove: {},
    down: null,
    gone: false,
    away: false,
    screen: { x: x - view.w / 2, y: -view.h / 2 },
  }
}

/**
 * A fresh run for a team (one player solo, up to four in co-op), standing
 * side by side. Each player rolls their shiny in slot order, then the run
 * draws its wild cast unless the shell drew it ahead (`drawRoster`).
 */
const createRun = (view: Game['view'], seed: number, setups: readonly PlayerSetup[], coop: boolean, roster: Roster | undefined, options: Omit<RunOptions, 'shiny'>): Game => {
  const rng = createRng(seed)
  const lucky = setups.map(() => rollShiny(rng, SHINY_ODDS.player))
  const players = setups.map((setup, slot) => createPlayer(slot, setup, lucky[slot]!, (slot - (setups.length - 1) / 2) * COOP.spacing, view))
  const g: Game = {
    difficulty: options.difficulty ?? DEFAULT_DIFFICULTY,
    rng,
    time: 0,
    phase: 'playing',
    nextId: 1,
    players,
    player: players[0]!,
    coop: coop ? createCoop() : null,
    enemies: [],
    attacks: [],
    hazards: [],
    pickups: [],
    particles: [],
    texts: [],
    grid: createGrid(32),
    view,
    camera: { x: -view.w / 2, y: -view.h / 2 },
    shake: 0,
    hitstop: 0,
    kills: 0,
    coins: 0,
    roster: withOutbreak(roster ?? drawRoster(rng), options.outbreak ?? null),
    spawnBudget: 0,
    nextEvent: 0,
    bossId: null,
    props: [],
    brokenProps: new Set(),
    terrain: createTerrain(seed),
    buffs: [],
    mapEvents: createMapEvents(),
    revives: 0,
    flash: 0,
    biome: createBiome(),
    weather: createWeather(),
    traits: { seen: new Set(), nextIntro: 0 },
    rift: createRiftState(),
    endless: null,
    tally: createTally(),
    eggs: { found: [], lucky: options.luckyEgg === true, boost: options.incense ? BAG_ITEMS.incense.boost : 1 },
    outbreak: options.outbreak ?? null,
    // The team's best Shiny Charm counts (solo, the player's).
    shinyBoost: shinyBoost(Math.max(...setups.map((s) => s.ranks.shinyCharm)), options.lure === true),
    dexLog: createDexLog(),
    // Only a lucky roll is news: a shiny picked (or hatched) is shiny every run.
    events: players.flatMap((p, slot) => (lucky[slot] && !setups[slot]!.shiny ? [{ kind: 'shinyPlayer' as const, slot: p.slot }] : [])),
  }
  for (const p of players) {
    actAs(g, p, () => recomputeStats(g))
    p.hp = p.stats.maxHp
  }
  return g
}

/**
 * A fresh solo run. Pass `roster` when the shell drew it ahead of time to
 * preload its sprites (see `drawRoster`); otherwise it's drawn from the run's rng.
 */
export const createGame = (
  starter: PlayableId,
  view: Game['view'],
  seed = Date.now(),
  ranks: Ranks = NO_RANKS,
  roster?: Roster,
  options: RunOptions = {},
): Game => createRun(view, seed, [{ starter, ranks, shiny: options.shiny === true }], false, roster, options)

/**
 * A fresh co-op run for `setups` (by slot). No lucky first egg, outbreak or
 * Bag items: each player's save (and clock) could disagree on them.
 */
export const createCoopGame = (view: Game['view'], seed: number, setups: readonly PlayerSetup[], difficulty: Difficulty, roster?: Roster): Game =>
  createRun(view, seed, setups, true, roster, { difficulty })

/**
 * Per-tick player input, as plain data so the simulation stays DOM-free. `mega`
 * presses the Mega button and `lunge` fires the manual moves (Quick Attack).
 */
export type StepInput = { move: Vec; special: boolean; mega?: boolean; lunge?: boolean }

const updatePlayer = (g: Game, input: Vec, dt: number) => {
  const p = g.player
  const slow = specialSpeedFactor(g)
  const moving = slow > 0 && Math.abs(input.x) + Math.abs(input.y) > 0.05
  // A speed factor of 0 means the special is dashing the player around.
  p.moving = moving || slow === 0
  const ground = groundAt(g, p.x, p.y)
  const pace = p.stats.speed * slow * (ground === 'water' ? playerWaterPace(g) : 1)
  const vx = moving ? input.x * pace : 0
  const vy = moving ? input.y * pace : 0
  // On ice the player's speed only slowly follows the stick, so they slide.
  const ice = ground === 'ice' && slow > 0
  if (ice) {
    const grip = 1 - dm.exp(-TERRAIN.iceGrip * dt)
    p.vx += (vx - p.vx) * grip
    p.vy += (vy - p.vy) * grip
  } else {
    p.vx = vx
    p.vy = vy
  }
  if (moving || (ice && Math.abs(p.vx) + Math.abs(p.vy) > 1)) {
    const dx = p.vx * dt
    const dy = p.vy * dt
    p.x += dx
    p.y += dy
    p.walked += dm.hypot(dx, dy)
  }
  if (moving) {
    const len = dm.hypot(input.x, input.y)
    p.facing = { x: input.x / len, y: input.y / len }
    p.dir = dir8(input.x, input.y)
  }
  p.animTime += dt
  p.iframes = Math.max(0, p.iframes - dt)
  p.hurt = Math.max(0, p.hurt - dt)
  healPlayer(g, p.stats.regen * dt)
}

/**
 * Casts every move whose cooldown ran out. A manual move instead waits,
 * recharged, for a `press`, and holds it while the special moves the player.
 */
const updateMoves = (g: Game, press: boolean, dt: number) => {
  for (const owned of g.player.moves) {
    if (isManual(owned.id)) {
      owned.cooldown = Math.max(0, owned.cooldown - dt)
      if (!press || owned.cooldown > 0 || specialBusy(g.player.special)) continue
    } else {
      owned.cooldown -= dt
      if (owned.cooldown > 0) continue
    }
    const s = moveStats(owned.id, owned.level, g.player.stats)
    MOVES[owned.id].fire(g, s)
    owned.cooldown += s.cooldown
  }
}

/** Draws a fresh set of level-up offers for the acting player. */
const rollPick = (g: Game) => {
  const p = g.player
  p.offers = rollOffers(loadout(g), g.rng, 3)
  p.round++
  g.events.push({ kind: 'levelup' })
}

/**
 * After level-ups resolve: open the next level-up, start the evolutions, or
 * resume. In co-op the whole team picks at once (each player their own
 * offers) and the world waits for everyone, or for the timer.
 */
const advancePhase = (g: Game) => {
  const picking = g.players.filter((p) => present(p) && p.pendingLevelUps > 0)
  if (picking.length > 0) {
    if (g.coop && g.phase !== 'levelup') g.coop.pickLeft = COOP.pickTime
    g.phase = 'levelup'
    for (const p of picking) if (p.offers.length === 0) actAs(g, p, () => rollPick(g))
    return
  }
  let evolving = false
  for (const p of g.players) {
    if (!present(p)) continue
    const evo = pendingEvolution(g, p)
    if (!evo) continue
    evolving = true
    p.evolution = { ...evo, t: 0 }
    actAs(g, p, () => g.events.push({ kind: 'evolve', ...evo }))
  }
  g.phase = evolving ? 'evolving' : 'playing'
}

/** A player takes one of their offers (the acting player by default). */
export const chooseOffer = (g: Game, offer: Offer, p: Player = g.player) => {
  if (g.phase !== 'levelup' || p.pendingLevelUps <= 0 || !p.offers.includes(offer)) return
  actAs(g, p, () => applyOffer(g, offer))
  p.pendingLevelUps--
  p.offers = []
  advancePhase(g)
}

/** Co-op: a player picks offer `index` of level-up `round`; a pick quoting an older round (the timer already chose) is dropped. */
export const pickOffer = (g: Game, p: Player, index: number, round: number) => {
  const offer = p.offers[index]
  if (offer && round === p.round) chooseOffer(g, offer, p)
}

/** Spends a Poké Mart reroll: draws a fresh set of level-up offers. */
export const rerollOffers = (g: Game, p: Player = g.player) => {
  if (g.phase !== 'levelup' || p.rerolls <= 0 || p.pendingLevelUps <= 0) return
  p.rerolls--
  actAs(g, p, () => {
    p.offers = rollOffers(loadout(g), g.rng, 3)
    p.round++
  })
}

/** Spends a Poké Mart skip: discards this level-up without picking anything. */
export const skipLevelUp = (g: Game, p: Player = g.player) => {
  if (g.phase !== 'levelup' || p.skips <= 0 || p.pendingLevelUps <= 0) return
  p.skips--
  p.pendingLevelUps--
  p.offers = []
  advancePhase(g)
}

/** Co-op level-up timer: when it runs out, everyone still picking takes their first offer. */
const tickPicks = (g: Game, dt: number) => {
  const coop = g.coop
  if (!coop) return
  coop.pickLeft -= dt
  if (coop.pickLeft > 0) return
  coop.pickLeft = COOP.pickTime
  for (const p of g.players) {
    const first = p.offers[0]
    if (present(p) && p.pendingLevelUps > 0 && first) chooseOffer(g, first, p)
  }
}

const finishEvolution = (g: Game, p: Player) => {
  const evo = p.evolution!
  p.stage++
  p.radius = bodyRadius(evo.to)
  recomputeStats(g)
  healPlayer(g, p.stats.maxHp * 0.5)
  p.evolution = null
  g.events.push({ kind: 'evolved', to: evo.to })
}

/** Plays every evolution under way; the run resumes when the last one lands. */
const updateEvolution = (g: Game, dt: number) => {
  let busy = false
  for (const p of g.players) {
    const evo = p.evolution
    if (!evo) continue
    evo.t += dt
    if (evo.t < EVOLUTION_TIME) busy = true
    else actAs(g, p, () => finishEvolution(g, p))
  }
  if (!busy) advancePhase(g)
}

/** Any player's Mega Evolution holds the world while it plays. True while one still is. */
const updateMegaIntros = (g: Game, dt: number) => {
  let busy = false
  for (const p of g.players) {
    if (inPlay(p) && p.mega.intro > 0) busy = actAs(g, p, () => updateMegaIntro(g, dt)) || busy
  }
  return busy
}

const STILL: StepInput = { move: { x: 0, y: 0 }, special: false }

/** One fixed-timestep simulation tick of a solo run. */
export const step = (g: Game, input: StepInput, dt: number) => stepTeam(g, [input], dt)

/**
 * One fixed-timestep simulation tick, with each player's input by slot.
 * Per-player systems (walking, the Mega form, the special, moves) run for
 * each player in play in slot order; world systems run once for everyone.
 */
export const stepTeam = (g: Game, inputs: readonly StepInput[], dt: number) => {
  if (g.phase === 'evolving') return updateEvolution(g, dt)
  if (g.phase === 'levelup') return tickPicks(g, dt)
  if (g.phase !== 'playing') return
  if (updateMegaIntros(g, dt)) return
  if (g.hitstop > 0) {
    g.hitstop -= dt
    return
  }

  g.time += dt
  // Inside a rift arena the horde and the map wait outside: no spawns, props,
  // map events, weather or biome changes. A biome change that came due meanwhile
  // plays on the way out.
  const inArena = g.rift.arena !== null
  if (!inArena) {
    updateBiome(g)
    updateWeather(g, dt)
  }
  for (const p of g.players) {
    if (!inPlay(p)) continue
    const input = inputs[p.slot] ?? STILL
    actAs(g, p, () => {
      updatePlayer(g, p.away ? STILL.move : input.move, dt)
      updateMega(g, input.mega === true, dt)
      updateSpecial(g, input.special, dt)
    })
  }
  if (!inArena) updateSpawner(g, dt)
  rebuildGrid(g)
  updateEnemies(g, dt)
  updateBosses(g, dt)
  updateHazards(g, dt)
  updateStatuses(g, dt)
  updateRiftPortal(g, dt)
  updateArena(g, dt)
  updateEndless(g)
  rebuildGrid(g)
  updateTraits(g, dt)
  for (const p of g.players) {
    if (inPlay(p)) actAs(g, p, () => updateMoves(g, inputs[p.slot]?.lunge === true, dt))
  }
  updateAttacks(g, dt)
  updateTerrain(g, dt)
  if (!inArena) {
    updateProps(g, dt)
    updateMapEvents(g, dt)
  }
  updatePickups(g, dt)
  updateConsumables(g, dt)
  updateEffects(g, dt)
  if (g.coop) {
    updateRevives(g, dt)
    checkWipe(g)
  }

  followPlayers(g)
  updateSightings(g, dt)

  if (g.phase === 'playing' && g.players.some((p) => present(p) && p.pendingLevelUps > 0)) advancePhase(g)
}
