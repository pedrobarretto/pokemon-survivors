import { dir8, type Vec } from '../engine/math'
import { createRng } from '../engine/rng'
import { createGrid } from '../engine/spatial'
import { bodyOf } from '../data/bodies'
import { isLegend } from '../data/legends'
import type { EnemyId } from '../data/enemies'
import { isHidden } from '../data/abilities'
import { branchesAt } from '../data/branches'
import type { EvoItemId } from '../data/shop'
import type { EvolutionStage } from '../data/starters'
import { runBoost } from './evoItems'
import { evolutionFreed, missingEvoItems, runEvoItems, stepOpen } from './evoGate'
import { PLAYABLE, type PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import { abilityImmune, abilityLuck, abilitySet, createAbilityState, grantAbility, updateAbility } from './abilities'
import { BAG_ITEMS, type BagItem } from './bag'
import { branchContext, evolutionOffers, playerForm } from './branch'
import { createAlphaClock, updateAlphas } from './alphas'
import { updateAttacks } from './attacks'
import { createBiome, updateBiome } from './biomes'
import { createRoute, updateRoute } from './route'
import { healPlayer } from './combat'
import { createDexLog } from './dex'
import { FRESH_LEVELUPS } from './learnsets'
import { DEFAULT_DIFFICULTY, type Difficulty } from './difficulty'
import { updateBosses, updateHazards } from './bosses'
import { createWorldHazards, updateWorldHazards } from './hazards'
import { updateConsumables } from './consumables'
import { burst, shakeScreen, updateEffects } from './effects'
import { updateEndless } from './endlessSystem'
import { blastHorde, rebuildGrid, updateEnemies } from './enemies'
import {
  applyOffer, branchOffers, draftOffers, loadout, nothingToChoose, offerSubject, pendingEvolution, recomputeStats, rollOffers, shinyOfferOdds, xpFor,
  type RollOptions,
} from './leveling'
import { createMapEvents, updateMapEvents } from './mapEvents'
import { createCurseState } from './curses'
import { curseCast, decideCurse, updateCurses } from './curseSystem'
import { updateDuos } from './duoMoves'
import { recipeOf } from './duoRules'
import { createMegaState, updateMega, updateMegaIntro } from './mega'
import { NO_RANKS, runCharges, type Ranks } from './meta'
import { afterCast as afterModCast, echoStats, hasMod, MOD } from './mods'
import { forkAt, isManual, MOVES, moveStats, type CastStats, type MoveDef, type MoveId } from './moves'
import { afterCast, updateMoveKit } from './moveHooks'
import { updateSignatures } from './signatures'
import { createTmState, pickTm } from './tms'
import { updateVerbEvolved } from './verbEvolutions'
import { updateLegendary } from './legendary'
import { createSpecialState, specialBusy, specialSpeedFactor, updateSpecial } from './special'
import { AWAKENING, avoidLegend, createLegendState, formAfter, pendingAwakening, updateLegend } from './legend'
import { decidePokeball, updatePickups } from './pickups'
import { rollShiny, SHINY_ODDS, shinyBoost } from './shiny'
import { updateProps } from './props'
import { withHoney, withOutbreak } from './outbreak'
import { withHaunts } from './halloween'
import { createTerrain, groundAt, playerWaterPace, updateTerrain } from './terrain'
import { createLandmarkState, createPlayerLandmarks, updateLandmarks, updateTunnel } from './landmarks'
import { drawRoster, type Roster } from './roster'
import { clockRuns, createRiftState } from './rift'
import { createPlaceState } from './place'
import { updatePlaceEntrance } from './placeEntrance'
import { updatePlace, updatePlaceFall, updatePlaceIntro } from './placeInterior'
import { roomOf } from './room'
import { SKY } from '../data/places'
import { updateArena, updateArenaFall } from './riftArena'
import { domainCamera, updateDomainScene } from './domain'
import { isAsleep, tickSleep } from './playerSleep'
import { updateLegendScene } from './legendScene'
import { updateRiftPortal } from './riftPortal'
import { updateSightings } from './sightings'
import { updateSpawner } from './spawner'
import { createTension } from './tension'
import { updateStatuses } from './statusSystem'
import { createTally } from './tally'
import { updateShopTms } from './shopTmSystem'
import { createWeather, updateWeather } from './weather'
import { updateTraits } from './traitSystem'
import { BASE_STATS } from './stats'
import { TERRAIN } from '../data/terrain'
import { actAs, eachPlayer, followPlayers, inPlay, phaseOf, setPhase } from './players'
import { createCoopState, createRecord, updateCoop } from './coop'
import { COOP } from '../data/coop'
import type { Game, Offer, OwnedMove, Player } from './types'
import * as dm from '../engine/dmath'

export const EVOLUTION_TIME = 4.6

export const playerDex = (g: Game) => playerForm(g).dex

/** Widest hitbox a legend gets, in px: Lugia's wings span 79 px; capped at a Charizard's (body 27 px), so a big legend isn't a bigger target for the horde and the bosses. */
export const LEGEND_RADIUS = 8

/** The player's hitbox from its sprite's body (data, so every device agrees); a legend's is capped (`LEGEND_RADIUS`). */
const playerRadius = (dex: number, legend: boolean) => {
  const r = Math.max(6, dm.round(bodyOf(dex).bodyW * 0.3))
  return legend ? Math.min(LEGEND_RADIUS, r) : r
}

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
  /** Noite das Bruxas (`game/halloween.ts`): a ghost in every stage of the roster and the night bosses (`withHaunts`, which a roster drawn ahead may already have), candies and jack-o'-lanterns. */
  halloween?: boolean
  /** Bag items the run uses (`game/bag.ts`), each doing its `BAG_ITEMS` effect. */
  bag?: readonly BagItem[]
  /** TMs armed at the shop (`game/tmShelf.ts`): the run's first TM discs and lessons teach them, in order (`tms.ts`). */
  tms?: readonly MoveId[]
  /** Evolution items owned (`game/evoItems.ts`): they unlock their branches (`evolutionOffers`). */
  evo?: readonly EvoItemId[]
  /** The Pokémon's Bottle Cap level (`runBoost`). */
  caps?: number
  /** Opens the run on the opening draft (`draftOffers`): three moves of the learnset to pick the second move from. */
  draft?: boolean
}

/**
 * One player's side of a run: their Pokémon, Poké Mart ranks, whether it plays
 * shiny from the start (`RunOptions.shiny`) and what their save brings along
 * (Bag items, armed TMs, evolution items, Bottle Caps; `RunOptions`).
 */
export type PlayerSetup = {
  starter: PlayableId
  ranks: Ranks
  shiny: boolean
  bag?: readonly BagItem[]
  tms?: readonly MoveId[]
  evo?: readonly EvoItemId[]
  caps?: number
}

/**
 * A fresh player at `slot` standing at (x, 0), before `recomputeStats` builds
 * their stats. `lucky`: their 1/64 shiny roll hit.
 */
export const createPlayer = (slot: number, setup: PlayerSetup, lucky: boolean, x: number, view: Game['view']): Player => {
  const def = PLAYABLE[setup.starter]
  const bag = setup.bag ?? []
  return {
    slot,
    starter: setup.starter,
    ranks: setup.ranks,
    phase: 'playing',
    screen: { x: x - view.w / 2, y: -view.h / 2 },
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
    moves: [{ id: def.signature, level: 1, cooldown: 0.4, path: 0 }],
    items: [],
    stats: BASE_STATS,
    radius: playerRadius(def.line[0].dex, isLegend(setup.starter)),
    animTime: 0,
    shiny: lucky || setup.shiny,
    luckyShiny: lucky,
    walked: 0,
    still: 0,
    guard: null,
    hidden: null,
    ward: null,
    drain: { left: 0, at: 0 },
    rooted: 0,
    asleep: 0,
    moveBuffs: [],
    special: createSpecialState(),
    mega: createMegaState(),
    ...runCharges(setup.ranks),
    banished: new Set(),
    castMods: 0,
    damageByMove: {},
    pendingLevelUps: 0,
    freshMoves: 0,
    offers: [],
    evolution: null,
    branch: null,
    ability: createAbilityState(),
    curses: createCurseState(),
    revives: 0,
    buffs: [],
    tm: createTmState(setup.tms),
    prize: null,
    bag,
    maxRevive: bag.includes('maxRevive'),
    everstone: bag.includes('everstone'),
    evoItems: setup.evo ?? [],
    evoFound: [],
    evoHeld: false,
    boost: runBoost(setup.caps ?? 0, bag),
    legend: createLegendState(setup.starter),
    wings: {},
    landmark: createPlayerLandmarks(),
    round: 0,
    pickLeft: COOP.pick.time,
    away: false,
    gone: false,
    revive: 0,
    record: createRecord(),
    hits: [],
  }
}

/**
 * A fresh run for `setups` by slot (one solo), standing side by side. Each
 * player rolls their 1/64 shiny in slot order, then the run draws its wild
 * cast unless the shell drew it ahead (`drawRoster`). The team's best Shiny
 * Charm counts (solo, the player's).
 */
const createRun = (view: Game['view'], seed: number, setups: readonly PlayerSetup[], roster: Roster | undefined, options: RunOptions, coop: boolean): Game => {
  const bag = options.bag ?? []
  const rng = createRng(seed)
  const lucky = setups.map(() => rollShiny(rng, SHINY_ODDS.player))
  const players = setups.map((setup, slot) => createPlayer(slot, setup, lucky[slot]!, coop ? (slot - (setups.length - 1) / 2) * COOP.spacing : 0, view))
  const player = players[0]!
  const starter = player.starter
  const g: Game = {
    difficulty: options.difficulty ?? DEFAULT_DIFFICULTY,
    rng,
    time: 0,
    phase: 'playing',
    nextId: 1,
    players,
    player,
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
    hitstopRest: 0,
    kills: 0,
    coins: 0,
    // A legend never meets itself among the bosses (`avoidLegend`), nor the outbreak's basic in its horde (`LEGEND_HORDE`).
    roster: avoidLegend(
      withHoney(
        withOutbreak(withHaunts(roster ?? drawRoster(rng), options.halloween === true, seed, isLegend(starter)), isLegend(starter) ? null : (options.outbreak ?? null)),
        isLegend(starter) ? null : (options.outbreak ?? null),
        bag.includes('honey') ? BAG_ITEMS.honey.effect.outbreakWeight : 1,
      ),
      starter,
    ),
    spawnBudget: 0,
    nextEvent: 0,
    bossId: null,
    props: [],
    brokenProps: new Set(),
    terrain: createTerrain(seed),
    mapEvents: createMapEvents(),
    flash: 0,
    biome: createBiome(),
    route: createRoute(seed),
    weather: createWeather(),
    traits: { seen: new Set(), nextIntro: 0 },
    rift: createRiftState(),
    place: createPlaceState(),
    landmarks: createLandmarkState(),
    tutors: 0,
    endless: null,
    tally: createTally(),
    eggs: { found: [], lucky: options.luckyEgg === true, boost: bag.includes('incense') ? BAG_ITEMS.incense.effect.eggOdds : 1 },
    outbreak: options.outbreak ?? null,
    halloween: options.halloween === true,
    candies: 0,
    shinyBoost: shinyBoost(Math.max(...setups.map((s) => s.ranks.shinyCharm)), bag.includes('lure')),
    dexLog: createDexLog(),
    // Only a lucky roll is news: a shiny picked (or hatched) is shiny every run. Co-op players see `Player.luckyShiny`.
    events: !coop && lucky[0] && !options.shiny ? [{ kind: 'shinyPlayer' }] : [],
    tension: createTension(),
    alphas: createAlphaClock(options.difficulty ?? DEFAULT_DIFFICULTY),
    worldHazards: createWorldHazards(),
    now: 0,
    legendScene: null,
    coop: coop ? createCoopState(players.length) : null,
  }
  for (const p of players) {
    g.player = p
    recomputeStats(g)
    p.hp = p.stats.maxHp
    // A Rare Candy starts the run a few levels up: their level-ups come right after the opening draft.
    if (p.bag.includes('rareCandy')) {
      p.level = BAG_ITEMS.rareCandy.effect.startLevel
      p.xpNext = xpFor(p.level)
      p.pendingLevelUps = p.level - 1
    }
  }
  // The opening draft: everyone picks their second move at once.
  for (const p of players) {
    g.player = p
    if (options.draft) {
      p.pendingLevelUps++
      p.offers = draftOffers(loadout(g), g.rng)
      setPhase(g, 'levelup')
    } else if (p.pendingLevelUps > 0) advancePhase(g)
  }
  g.player = player
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
): Game => {
  const setup: PlayerSetup = { starter, ranks, shiny: options.shiny === true, bag: options.bag ?? [], tms: options.tms, evo: options.evo, caps: options.caps }
  return createRun(view, seed, [setup], roster, options, false)
}

/**
 * What a player brings into a co-op run: their Pokémon (a starter or a hatched
 * family: the Legend mode stays solo), Poké Mart ranks, whether it plays shiny,
 * and the name the team sees. Nothing else from the save comes along (`createCoopGame`).
 */
export type CoopLoadout = { starter: (typeof PLAYABLE_IDS)[number]; ranks: Ranks; shiny: boolean; name: string }

/** A co-op run's settings, the same on every client: the difficulty, the opening draft (on by default), the simulated view and a roster drawn ahead. */
export type CoopOptions = { difficulty?: Difficulty; draft?: boolean; view?: Game['view']; roster?: Roster }

/**
 * A fresh co-op run for 1 to `COOP.maxPlayers` loadouts (by slot). Every
 * client that calls it with the same seed, loadouts and options gets the same
 * game, so nothing here reads a save, the day or the clock: co-op plays the
 * normal mode (`COOP_LOCKS` in `data/coop.ts`) — no outbreak, Noite das Bruxas,
 * Bag, armed TMs, evolution items or Bottle Caps, no lucky first egg, and the
 * roster from the run's rng (or `options.roster`, drawn the same way).
 */
export const createCoopGame = (seed: number, loadouts: readonly CoopLoadout[], options: CoopOptions = {}): Game => {
  if (loadouts.length < 1 || loadouts.length > COOP.maxPlayers) throw new RangeError(`co-op takes 1 to ${COOP.maxPlayers} players, got ${loadouts.length}`)
  const setups: PlayerSetup[] = loadouts.map(({ starter, ranks, shiny }) => ({ starter, ranks, shiny }))
  const view = { ...(options.view ?? COOP.view) }
  const g = createRun(view, seed, setups, options.roster, { difficulty: options.difficulty, draft: options.draft ?? true }, true)
  g.coop!.names = loadouts.map((l) => l.name)
  return g
}

/**
 * Whether the level-up on screen is the opening draft: the run's clock only
 * starts once it's picked. The draft is the first of the run's level-ups
 * (a Rare Candy's come after it, at the same 0:00).
 */
export const drafting = (g: Game) => phaseOf(g) === 'levelup' && g.time === 0 && g.player.pendingLevelUps === g.player.level

/** How a player rolls their level-up cards: rarity on, with their Shiny Charm's odds and the luck of their ability (Jirachi's Serene Grace). */
const rolling = (g: Game): RollOptions => {
  const luck = abilityLuck(g)
  return { shiny: shinyOfferOdds(g.player.ranks.shinyCharm) * luck.shiny, rare: luck.rare }
}

/**
 * Per-tick player input, as plain data so the simulation stays DOM-free. `mega`
 * presses the Mega button and `lunge` fires the manual moves (Quick Attack).
 */
export type StepInput = { move: Vec; special: boolean; mega?: boolean; lunge?: boolean }

/** A player with no input this tick: stands still, presses nothing. */
const STILL: StepInput = { move: { x: 0, y: 0 }, special: false }

/**
 * The walking part of a player's tick: the acting player's velocity from the
 * stick (water, ice, the special's pace, a root) and the step it takes. Returns
 * whether the stick moved them. Exported for co-op's own-movement prediction,
 * which runs it on a draw-only copy of the player (`coop/predict.ts`).
 */
export const walkPlayer = (g: Game, input: Vec, dt: number) => {
  const p = g.player
  const slow = specialSpeedFactor(g)
  // Rooted (Giga Impact's recharge): the stick does nothing until it wears off.
  p.rooted = Math.max(0, p.rooted - dt)
  const moving = slow > 0 && p.rooted <= 0 && Math.abs(input.x) + Math.abs(input.y) > 0.05
  // A speed factor of 0 means the special is dashing the player around.
  p.moving = moving || slow === 0
  const ground = groundAt(g, p.x, p.y)
  const tailwind = g.place.inside?.id === 'sky' ? SKY.tailwind : 1
  const pace = p.stats.speed * slow * tailwind * (ground === 'water' ? playerWaterPace(g) : 1)
  const vx = moving ? input.x * pace : 0
  const vy = moving ? input.y * pace : 0
  // On ice the player's speed only slowly follows the stick, so they slide.
  const ice = ground === 'ice' && slow > 0 && !abilityImmune(g, 'terrain')
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
  return moving
}

/** Walks the acting player with the stick `input`. */
const updatePlayer = (g: Game, input: Vec, dt: number) => {
  const p = g.player
  const moving = walkPlayer(g, input, dt)
  if (moving) {
    const len = dm.hypot(input.x, input.y)
    p.facing = { x: input.x / len, y: input.y / len }
    p.dir = dir8(input.x, input.y)
  }
  p.still = p.moving ? 0 : p.still + dt
  p.animTime += dt
  p.iframes = Math.max(0, p.iframes - dt)
  p.hurt = Math.max(0, p.hurt - dt)
  healPlayer(g, p.stats.regen * dt)
}

/** Fires a move with its fork mods stamped on what it spawns (`mods.ts`); an Echo schedules its re-cast. */
const castMove = (g: Game, owned: OwnedMove, s: CastStats) => {
  const from = g.attacks.length
  g.player.castMods = s.mods
  const def: MoveDef = MOVES[owned.id]
  def.fire(g, s, owned)
  g.player.castMods = 0
  afterModCast(g, from, s)
  if (hasMod(s.mods, 'echo')) owned.echo = MOD.echo.delay
}

/**
 * Casts every move of the acting player whose cooldown ran out. A manual move
 * instead waits, recharged, for a `press`, and holds it while the special
 * moves the player.
 */
const updateMoves = (g: Game, press: boolean, dt: number) => {
  const p = g.player
  for (const owned of p.moves) {
    if (owned.echo !== undefined && owned.echo > 0) {
      owned.echo -= dt
      if (owned.echo <= 0) castMove(g, owned, echoStats(moveStats(owned.id, owned.level, p.stats, owned.path)))
    }
    if (isManual(owned.id)) {
      owned.cooldown = Math.max(0, owned.cooldown - dt)
      if (!press || owned.cooldown > 0 || specialBusy(p.special)) continue
    } else {
      owned.cooldown -= dt
      if (owned.cooldown > 0) continue
    }
    const s = moveStats(owned.id, owned.level, p.stats, owned.path)
    castMove(g, owned, s)
    owned.cooldown += s.cooldown
    afterCast(g, owned)
    curseCast(g)
  }
}

/**
 * After the acting player's level-ups resolve: open their next level-up, ask
 * where a branching evolution goes, start an evolution, or resume. Exported
 * for the dev console.
 */
export const advancePhase = (g: Game): void => {
  const p = g.player
  p.prize = null
  if (p.pendingLevelUps > 0) {
    p.offers = rollOffers(loadout(g), g.rng, 3, rolling(g))
    setPhase(g, 'levelup')
    g.events.push({ kind: 'levelup' })
    return
  }
  if (pendingAwakening(g) > 0) return startAwakening(g)
  // Held in its first form by an Everstone (or a one-stage family), the Pokémon still picks its Ability when it would have evolved.
  if (abilityDueInForm(g)) return offerAbilities(g)
  if (!pendingEvolution(g)) {
    setPhase(g, 'playing')
    return
  }
  const branches = p.branch === null ? branchesAt(p.starter, p.stage + 1) : []
  if (branches.length > 0) {
    const offers = evolutionOffers(g.rng, branches, branchContext(g), runEvoItems(g))
    if (offers.length === 0) return holdEvolution(g)
    p.evoHeld = false
    // A single way to go (no items, or a held one's first): it evolves without asking.
    if (offers.length === 1) {
      p.branch = offers[0]!.id
      return startEvolution(g)
    }
    p.offers = offers.map(({ id, favor }) => ({ kind: 'form', id, favor }))
    setPhase(g, 'branch')
    g.events.push({ kind: 'branchChoice' })
    return
  }
  // A line step that names an item (Porygon2's Up-Grade) waits for it, like a closed branch.
  if (!stepOpen(g)) return holdEvolution(g)
  p.evoHeld = false
  startEvolution(g)
}

/** The level a one-stage family (Smeargle) picks its Ability at: where the others first evolve. */
const SOLO_ABILITY_LEVEL = 12

/**
 * The acting player's Ability pick is due without an evolution: an Everstone
 * run, or one held for an item, reached its first evolution's level, or a
 * one-stage family reached `SOLO_ABILITY_LEVEL`, without an Ability yet.
 */
const abilityDueInForm = (g: Game) => {
  const p = g.player
  if (p.ability.id !== null || p.legend) return false
  const line: readonly EvolutionStage[] = PLAYABLE[p.starter].line
  if (line.length === 1) return p.level >= SOLO_ABILITY_LEVEL
  const first = line[0]!
  return (p.everstone || p.evoHeld) && first.evolveAt !== undefined && p.level >= first.evolveAt
}

/**
 * The acting player's evolution is due but none of its branches is open
 * (Scyther, Charcadet without an item), or its line step needs an item they
 * lack (Porygon without the Up-Grade): the Pokémon stays in its form, as
 * strong as with an Everstone, picks its Ability there, and goes on once an
 * item turns up (`evolutionFreed`, checked every tick).
 */
const holdEvolution = (g: Game) => {
  const p = g.player
  if (!p.evoHeld) {
    p.evoHeld = true
    recomputeStats(g)
    g.events.push({ kind: 'evoHeld', items: missingEvoItems(g) })
  }
  if (abilityDueInForm(g)) return offerAbilities(g)
  setPhase(g, 'playing')
}

const startEvolution = (g: Game) => {
  const evo = pendingEvolution(g)
  if (!evo) return advancePhase(g)
  g.player.evolution = { ...evo, t: 0 }
  setPhase(g, 'evolving')
  g.events.push({ kind: 'evolve', ...evo })
}

/** The acting player's legend awakens: the evolution's scene, on the same species (in its new form, where it takes one). */
const startAwakening = (g: Game): void => {
  const p = g.player
  const s = p.legend
  const n = pendingAwakening(g)
  if (!s || n === 0) return advancePhase(g)
  const dex = playerDex(g)
  const form = formAfter(s.id, n)?.key
  p.evolution = { from: dex, to: dex, t: 0, awakening: n, ...(form && { form }) }
  setPhase(g, 'evolving')
  g.events.push({ kind: 'awaken', legend: s.id, n })
}

/**
 * The acting player's awakening lands: its stats, a heal, an Esquecer charge
 * and an aura burst that throws the horde back; the first one opens the
 * Ability pick.
 */
const awaken = (g: Game, n: number): void => {
  const p = g.player
  const s = p.legend
  if (!s) return advancePhase(g)
  s.awakened = n
  recomputeStats(g)
  healPlayer(g, p.stats.maxHp * AWAKENING.heal)
  p.banishes++
  blastHorde(g, AWAKENING.push)
  const color = PLAYABLE[p.starter].color
  burst(g, p.x, p.y - 12, { colors: [color, '#ffffff', '#f8e8a0'], count: 80, speed: 190, ttl: 0.9, size: 2, drag: 3 })
  shakeScreen(g, 8)
  g.flash = Math.max(g.flash, 0.4)
  p.evolution = null
  g.events.push({ kind: 'awakened', legend: s.id, n, form: formAfter(s.id, n)?.key ?? null })
  if (p.ability.id === null) offerAbilities(g)
  else advancePhase(g)
}

/** After the first evolution: the abilities to pick from (Honedge's lone Stance Change is just granted). Exported for the dev console. */
export const offerAbilities = (g: Game) => {
  const p = g.player
  const set = abilitySet(p.starter, p.branch)
  if (set.length === 1) {
    grantAbility(g, set[0])
    recomputeStats(g)
    return advancePhase(g)
  }
  p.offers = set.map((id, i) => ({ kind: 'ability', id, hidden: isHidden(set, i) }))
  setPhase(g, 'ability')
}

/** Whether the cards on a player's screen are a fork's two branches (picked from a move card that reached one). */
export const choosingBranch = (g: Game, p: Player = g.player) => p.offers.some((o) => o.kind === 'branch')

/** The acting player's pick (`chooseOffer`). */
const pickOffer = (g: Game, offer: Offer) => {
  const p = g.player
  const phase = phaseOf(g)
  if (phase === 'branch' && offer.kind === 'form') {
    p.branch = offer.id
    return startEvolution(g)
  }
  if (phase === 'ability' && offer.kind === 'ability') {
    grantAbility(g, offer.id)
    recomputeStats(g)
    return advancePhase(g)
  }
  // A TM's screen: learn, forget a move for it, or pass (`tms.ts`).
  if (phase === 'tm') {
    if (pickTm(g, offer)) advancePhase(g)
    return
  }
  if (phase === 'curse' && offer.kind === 'curse') {
    decideCurse(g, offer.id, offer.take)
    return advancePhase(g)
  }
  if (phase === 'pokeball') {
    decidePokeball(g, offer)
    return advancePhase(g)
  }
  if (phase !== 'levelup' || offer.kind === 'form' || offer.kind === 'ability' || offer.kind === 'curse' || offer.kind === 'tm' || offer.kind === 'forget' || offer.kind === 'pass') return
  if (offer.kind === 'move' && forkAt(offer.id, offer.level)) {
    p.offers = branchOffers(offer)
    return
  }
  applyOffer(g, offer)
  if ('rarity' in offer && offer.rarity === 'shiny') {
    p.offers = rollOffers(loadout(g), g.rng, 3, rolling(g))
    g.events.push({ kind: 'shinyOffer' })
    return
  }
  p.pendingLevelUps--
  p.freshMoves = Math.max(0, p.freshMoves - 1)
  advancePhase(g)
}

/**
 * A player's pick from their `offers` (the acting player's by default): a
 * level-up upgrade, where a branching evolution goes, the ability, whether to
 * take a chest's cursed item or a Poké Ball's new move or item, or a TM's
 * choice. Replays reach it through the `offer` event.
 * A move card that reaches a fork opens its two branches instead (picked the
 * same way); a shiny card is a free pick, so a fresh set of cards follows
 * without using the level-up up.
 */
export const chooseOffer = (g: Game, offer: Offer, p: Player = g.player) => {
  const before = actAs(g, p)
  pickOffer(g, offer)
  actAs(g, before)
}

/**
 * Takes a player's level-ups with nothing to choose (`nothingToChoose`: only
 * the Oran Berry), one after another, so no screen opens for them. The shell
 * calls it, and `record` notes each pick first: a replay makes them as
 * `offer` events, like a tap. Returns how many it took.
 */
export const takeBerryLevelUps = (g: Game, record: (index: number) => void, p: Player = g.player) => {
  let taken = 0
  while (phaseOf(g, p) === 'levelup' && nothingToChoose(p.offers)) {
    record(0)
    chooseOffer(g, p.offers[0]!, p)
    taken++
  }
  return taken
}

/** Spends a player's Poké Mart reroll: draws a fresh set of level-up offers (a fresh draft at the start). */
export const rerollOffers = (g: Game, p: Player = g.player) => {
  if (phaseOf(g, p) !== 'levelup' || p.rerolls <= 0 || choosingBranch(g, p)) return
  const before = actAs(g, p)
  p.rerolls--
  p.offers = drafting(g) ? draftOffers(loadout(g), g.rng) : rollOffers(loadout(g), g.rng, 3, rolling(g))
  actAs(g, before)
}

/** Whether a card can be forgotten: moves, items and duo fusions can, berries, evolutions and fork branches can't. */
export const canBanish = (offer: Offer) => offer.kind === 'move' || offer.kind === 'item' || offer.kind === 'duo'

/**
 * Spends a player's Esquecer charge on their card at `index`: its move, item
 * or duo recipe (both its outcomes) never comes back to them this run, and that slot alone is drawn again
 * (from the learnset's new moves during the opening draft). The slot changes
 * in place, so the shell keeps the screen and redraws just that card.
 */
export const banishOffer = (g: Game, index: number, p: Player = g.player) => {
  const offer = p.offers[index]
  if (phaseOf(g, p) !== 'levelup' || p.banishes <= 0 || !offer || !canBanish(offer)) return
  const id = offerSubject(offer)
  if (id === null) return
  const before = actAs(g, p)
  p.banishes--
  p.banished.add(id)
  const recipe = offer.kind === 'duo' ? recipeOf(offer.to) : undefined
  if (recipe) p.banished.add(recipe.to)
  const shown = p.offers.filter((_, i) => i !== index)
  const ids = new Set(shown.map(offerSubject))
  const fresh = drafting(g)
    ? draftOffers({ ...loadout(g), banished: new Set([...p.banished, ...shown.flatMap((o) => (o.kind === 'move' ? [o.id] : []))]) }, g.rng, 1)
    : rollOffers(loadout(g), g.rng, 1, { ...rolling(g), shown })
  const next = fresh.find((o) => !ids.has(offerSubject(o))) ?? { kind: 'berry' }
  p.offers[index] = next
  g.events.push({ kind: 'banish' })
  actAs(g, before)
}

/** Spends a player's Poké Mart skip: discards this level-up without picking anything. */
export const skipLevelUp = (g: Game, p: Player = g.player) => {
  if (phaseOf(g, p) !== 'levelup' || p.skips <= 0 || choosingBranch(g, p)) return
  const before = actAs(g, p)
  p.skips--
  p.pendingLevelUps--
  p.freshMoves = Math.max(0, p.freshMoves - 1)
  advancePhase(g)
  actAs(g, before)
}

/** Plays the acting player's evolution, if one is under way; at its end the new form lands and their next pick (or play) follows. Co-op's lockstep driver plays each player's. */
export const updateEvolution = (g: Game, dt: number) => {
  const p = g.player
  const evo = p.evolution
  if (!evo) return
  evo.t += dt
  if (evo.t < EVOLUTION_TIME) return
  if (evo.awakening) return awaken(g, evo.awakening)
  p.stage++
  p.radius = playerRadius(evo.to, false)
  recomputeStats(g)
  healPlayer(g, p.stats.maxHp * 0.5)
  // Every evolution earns an Esquecer charge (`banishOffer`), and the moves it unlocks come up more for a while.
  p.banishes++
  p.freshMoves = FRESH_LEVELUPS
  p.evolution = null
  g.events.push({ kind: 'evolved', to: evo.to })
  if (p.ability.id === null) offerAbilities(g)
  else advancePhase(g)
}

/** Any player's Mega Evolution holds the world while it plays. True while one still does. */
const updateMegaIntros = (g: Game, dt: number) => {
  const before = g.player
  let busy = false
  for (const p of g.players) {
    g.player = p
    if (updateMegaIntro(g, dt)) busy = true
  }
  g.player = before
  return busy
}

/**
 * The first half of a player's tick: walking (or a tunnel carrying them),
 * cursed items, a legend's presence, the Mega form, the ability and the special.
 */
const stepPlayer = (g: Game, input: StepInput, dt: number) => {
  // Asleep (Dark Void): the stick and the buttons do nothing until they wake.
  const asleep = isAsleep(g.player)
  tickSleep(g.player, dt)
  // Under a tunnel's ridge the player is carried through instead of walking.
  if (!updateTunnel(g, dt)) updatePlayer(g, asleep ? STILL.move : input.move, dt)
  updateCurses(g)
  if (updateLegend(g)) recomputeStats(g)
  updateMega(g, !asleep && input.mega === true, dt)
  if (updateAbility(g, dt)) recomputeStats(g)
  updateSpecial(g, !asleep && input.special, dt)
}

/** A player's moves: their kit's running state, signatures, shop TMs, legendary move, the casts and duo moves. */
const stepMoves = (g: Game, input: StepInput, dt: number) => {
  updateMoveKit(g, dt)
  updateSignatures(g, dt)
  updateShopTms(g, dt)
  updateLegendary(g)
  // Asleep (Dark Void), no move is cast: their cooldowns wait until the player wakes.
  if (isAsleep(g.player)) return
  updateMoves(g, input.lunge === true, dt)
  updateDuos(g, dt)
}

/**
 * World seconds after a hitstop ends in which a new one is dropped: a volley
 * of impacts (Sky Uppercut's fists, a chain of landings, a special cast again
 * and again) freezes the screen once instead of in a stutter. The hits keep
 * their shake and dust.
 */
export const HITSTOP_REST = 1

/**
 * A hitstop running counts down and says whether it holds the tick there:
 * in solo it freezes the whole world; in co-op never, since it would hold
 * every teammate for one player's hit (and pull their predicted sprites
 * back), so it only counts down while the team plays on. Co-op's prediction
 * ghost (`coop/predict.ts`) asks the same, so it plays through one too.
 * One that starts within `HITSTOP_REST` of the last one's end never holds.
 */
export const hitstopHolds = (g: Game, dt: number) => {
  if (g.hitstopRest > 0) {
    g.hitstopRest = Math.max(0, g.hitstopRest - dt)
    g.hitstop = 0
    return false
  }
  if (g.hitstop <= 0) return false
  g.hitstop -= dt
  if (g.hitstop <= 0) g.hitstopRest = HITSTOP_REST
  return g.coop === null
}

/** One fixed-timestep simulation tick of a solo run. */
export const step = (g: Game, input: StepInput, dt: number) => stepTeam(g, [input], dt)

/**
 * One fixed-timestep simulation tick with each player's input by slot (a
 * missing one stands still). Per-player systems run as each player in slot
 * order (`actAs`); world systems run once for everyone.
 */
export const stepTeam = (g: Game, inputs: readonly StepInput[], dt: number) => {
  if (g.phase === 'evolving') {
    const before = g.player
    for (const p of g.players) {
      g.player = p
      updateEvolution(g, dt)
    }
    g.player = before
    return
  }
  if (g.phase !== 'playing') return
  // A Mega Evolution plays with the world held still (solo; in co-op the player
  // transforms wrapped in light while the team plays on), and so does a dungeon floor's title card.
  if (updateMegaIntros(g, dt) && g.coop === null) return
  if (updatePlaceIntro(g, dt)) return
  // So does the rift throwing a fainted player back out, or a rescue out of a place, a domain's encounter and capture scenes and a wave legendary's.
  if (updateArenaFall(g, dt)) return
  if (updateDomainScene(g, dt)) return
  if (updateLegendScene(g, dt)) return
  if (updatePlaceFall(g, dt)) return
  if (hitstopHolds(g, dt)) return

  // The run clock stops inside a rift (`clockRuns`); `now` never does.
  g.now += dt
  if (clockRuns(g)) g.time += dt
  // Inside a room (a rift arena, a place) the horde and the map wait outside:
  // no regular spawns, props, map events, weather or biome changes. A biome
  // change that came due meanwhile plays on the way out.
  const inArena = roomOf(g) !== null
  updateRoute(g, dt)
  if (!inArena) {
    updateBiome(g)
    updateWeather(g, dt)
  }
  const actor = g.player
  for (const p of g.players) {
    if (g.coop !== null && !inPlay(p)) continue
    g.player = p
    stepPlayer(g, inputs[p.slot] ?? STILL, dt)
  }
  g.player = actor
  if (!inArena) updateSpawner(g, dt)
  rebuildGrid(g)
  updateAlphas(g, dt)
  updateEnemies(g, dt)
  updateBosses(g, dt)
  updateWorldHazards(g, dt)
  updateHazards(g, dt)
  updateStatuses(g, dt)
  updateRiftPortal(g, dt)
  updateArena(g, dt)
  updatePlaceEntrance(g, dt)
  updatePlace(g, dt)
  eachPlayer(g, updateLandmarks, dt)
  updateEndless(g)
  rebuildGrid(g)
  updateTraits(g, dt)
  for (const p of g.players) {
    if (g.coop !== null && !inPlay(p)) continue
    g.player = p
    stepMoves(g, inputs[p.slot] ?? STILL, dt)
  }
  g.player = actor
  updateAttacks(g, dt)
  updateVerbEvolved(g, dt)
  updateTerrain(g, dt)
  // Checked again: the player may have stepped into a room this very tick.
  if (!roomOf(g)) {
    updateProps(g, dt)
    updateMapEvents(g, dt)
  }
  updatePickups(g, dt)
  updateConsumables(g, dt)
  updateEffects(g, dt)
  if (g.coop !== null) updateCoop(g, dt)

  // In a legendary's domain the camera looks ahead and frames the fight (`domainCamera`); elsewhere it sits on the player.
  followPlayers(g, dt, domainCamera)
  updateSightings(g, dt)

  // Level-ups earned this tick, or a held evolution whose item was just found, open everyone's next pick at once
  // (in co-op alongside a screen a pickup opened this tick, so nobody waits in turn).
  if (g.coop !== null) return openPendingPicks(g)
  if (g.phase !== 'playing') return
  for (const p of g.players) {
    g.player = p
    if (p.pendingLevelUps > 0 || evolutionFreed(g)) advancePhase(g)
  }
  g.player = actor
}

/**
 * Co-op: opens the pending level-ups (or a held evolution an item just freed,
 * `evolutionFreed`) of every player not on a screen (nor evolving, nor gone),
 * all at once. The lockstep driver also calls it while the team waits, so a
 * level-up never queues behind a teammate's pick.
 */
export const openPendingPicks = (g: Game) => {
  if (g.phase === 'gameover' || g.phase === 'victory' || g.phase === 'paused') return
  const actor = g.player
  for (const p of g.players) {
    if (p.gone || p.phase !== 'playing') continue
    g.player = p
    if (p.pendingLevelUps > 0 || evolutionFreed(g)) advancePhase(g)
  }
  g.player = actor
}
