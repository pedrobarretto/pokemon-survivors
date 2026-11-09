import { clamp, dir8, retain, type Dir8, type Vec } from '../engine/math'
import { blitEllipse } from '../engine/pixelart'
import { chance, createRng, pick, range, type Rng } from '../engine/rng'
import { ENEMIES } from '../data/enemies'
import { STARTER_IDS, starterDex } from '../data/starters'
import { CARPENTER, TAILOR } from '../data/visitors'
import { createCompanion, drawCompanion, stepCompanion, type CompanionView } from './companion'
import { drawSparkles, shadow } from './draw'
import { drawPokemon, hasShiny, loadedSprites, loadSpecies, type Dex } from './sprites'
import { drawGround } from './world'
import { drawMeadowJacks, drawMeadowNight } from './halloweenArt'
import {
  celebratePlaza,
  createPlaza,
  drawPlazaDusk,
  drawPlazaGround,
  drawPlazaOverhead,
  drawPlazaParty,
  greetKeepers,
  greetShopkeeper,
  KECLEON_DEX,
  lotFrame,
  lotSpot,
  plazaFrame,
  plazaPieces,
  pushOut,
  revealKeeper,
  shopSpot,
  stepPlaza,
  type Piece,
  type Plaza,
} from './plaza'
import { createDojo, dojoFrame, dojoPieces, drawDojoGround, greetSensei, pushOutDojo, SENSEI, senseiSpot, stepDojo, type Dojo } from './dojo'
import {
  createStadium,
  drawStadiumGround,
  greetJudge,
  judgeSpot,
  JUDGE,
  pushOutStadium,
  stadiumFrame,
  stadiumPieces,
  stepStadium,
  type Stadium,
} from './stadium'

/**
 * The top-down meadow behind the menus and under a trip: the partner's home,
 * under a camera that stands still, with wild Pokémon strolling around (and,
 * rarely, a shiny). East of home stands the Kecleon plaza (`render/plaza.ts`),
 * the town square around the shop, with Leavanny's Boutique on its north-west,
 * west of it the Dojo (`render/dojo.ts`), Machoke's training hall, and south of
 * it the Estádio (`render/stadium.ts`), the Arena's, Ninjask judging at its
 * gate. The lobby itself stands on the side-view stage (`render/lobbyStage.ts`);
 * a trip (`visitPlaza`) pans this camera to a place or back home, the partner
 * hopping along. Pure presentation: it only reads sprites that are already
 * loaded, and the cries it wants played wait in `cries` for the shell.
 */

type Wanderer = {
  dex: Dex
  shiny: boolean
  x: number
  y: number
  vx: number
  vy: number
  dir: Dir8
  /** Seconds left in the current stroll or rest. */
  timer: number
  /** Animation offset, so neighbours don't step in lockstep. */
  phase: number
  bornAt: number
  id: number
}

/** The lobby's partner: `home` at the meadow's middle, `trip` while it hops along a camera trip (`visitPlaza`) and `shop` while it stands at a counter. */
export type Partner = {
  dex: Dex
  shiny: boolean
  state: 'home' | 'trip' | 'shop'
  x: number
  y: number
  dir: Dir8
  moving: boolean
  /** Scene time of its last hop. */
  hopAt: number
}

/** Where the camera rests: the partner's home, the Kecleon plaza (the shop, or Leavanny's Boutique on its north-west), the Dojo or the Estádio. */
export type Place = 'home' | 'plaza' | 'boutique' | 'carpentry' | 'dojo' | 'stadium'

/** A camera trip to a place, eased over `time` seconds, the partner hopping from `from` to its spot there. */
type Trip = { to: Place; t: number; time: number; cam: Vec; from: Vec }

export type TitleScene = {
  rng: Rng
  time: number
  cam: Vec
  /** The lobby's resting view center, world px: the partner's home, a fixed place in the meadow. */
  home: Vec
  /** Where the camera rests, and the trip under way to the other place. */
  rest: Place
  trip: Trip | null
  /** False until the first step snaps the camera onto its rest (the view's size wasn't known before). */
  placed: boolean
  /** The Kecleon plaza, east of home. */
  plaza: Plaza
  /** The Dojo, west of home. */
  dojo: Dojo
  /** The Estádio, south of home. */
  stadium: Stadium
  wanderers: Wanderer[]
  nextSpawn: number
  /** Species whose shiny form is loading for the next shiny roll. */
  nextShiny: Dex | null
  spawned: number
  partner: Partner | null
  /** The supporter's companion (`render/companion.ts`), trotting after the partner on a trip. */
  companion: CompanionView | null
  /** Cries for the shell to play (a shopkeeper's hello), drained every frame. */
  cries: Dex[]
  /** Dust where the partner landed, by scene time. */
  puffs: { x: number; y: number; at: number }[]
  /** The Noite das Bruxas (set by the shell): night falls, jack-o'-lanterns light the meadow and ghosts roam it. */
  haunted: boolean
}

/** Every species that may roam: wild Pokémon and the starter lines (evolutions show up once a run has loaded them). */
const POOL: readonly Dex[] = [
  // Kecleon keeps the shop and Ninjask judges the Estádio: a wild one would pass for a third shopkeeper or a second judge.
  ...Object.values(ENEMIES).flatMap((e) => ('boss' in e || e.dex === KECLEON_DEX || e.dex === JUDGE.dex ? [] : [e.dex])),
  ...STARTER_IDS.flatMap(starterDex),
]

/** The ghosts among them, who take over the meadow on the Noite das Bruxas. */
const GHOSTS: readonly Dex[] = Object.values(ENEMIES).flatMap((e) => (!('boss' in e) && e.types.some((t) => t === 'ghost') ? [e.dex] : []))
/** Share of a haunted meadow's newcomers that are ghosts, when any is loaded. */
const HAUNTED_SHARE = 0.65

/** Off-screen band (world px) where wanderers enter; past it they're recycled. */
const MARGIN = 40
/** How far outside the view (world px) newcomers appear. */
const ENTRY = 16
const SHINY_CHANCE = 1 / 40
/** While the scene is this young, newcomers fade in on screen instead of walking in from an edge. */
const FILL_TIME = 3
const FADE_IN = 0.6
const SPEED = { min: 12, max: 22 }

const HOP = { time: 0.3, height: 5 }
const PUFF_TIME = 0.35

/** One wanderer per this many square world px, so phones get a smaller crowd. */
const population = (w: number, h: number) => clamp(Math.round((w * h) / 9000), 5, 18)

export const createTitleScene = (seed: number): TitleScene => {
  const rng = createRng(seed)
  // Every visit starts somewhere else in the infinite meadow.
  const home = { x: Math.floor(rng() * 8192), y: Math.floor(rng() * 8192) }
  return {
    rng,
    time: 0,
    cam: { ...home },
    home,
    rest: 'home',
    trip: null,
    placed: false,
    plaza: createPlaza(home),
    dojo: createDojo(home),
    stadium: createStadium(home),
    wanderers: [],
    nextSpawn: 0,
    nextShiny: null,
    spawned: 0,
    partner: null,
    companion: null,
    cries: [],
    puffs: [],
    haunted: false,
  }
}

/** The lobby's partner takes its place at home, with the supporter's companion if one walks along (`null`: the lobby closed, both are gone). */
export const meetPartner = (s: TitleScene, partner: { dex: Dex; shiny: boolean } | null, companion: CompanionView | null = null) => {
  // A new lobby starts at home: any trip it didn't finish is called off.
  if (partner) {
    s.trip = null
    s.rest = 'home'
  }
  s.companion = partner && companion
  s.partner = partner && { ...partner, state: 'home', x: s.home.x, y: s.home.y, dir: 0, moving: false, hopAt: -1 }
}

/**
 * The camera's top-left resting at `place` for a `w`×`h` view, on whole
 * world pixels: a rest that drifts below a pixel shows on the pixel-art
 * meadow as the whole scene ticking a pixel at a time.
 */
const restCam = (s: TitleScene, place: Place, w: number, h: number): Vec =>
  place === 'plaza' ? plazaFrame(s.plaza, w, h)
  : place === 'boutique' ? lotFrame(s.plaza, 'boutique', w, h)
  : place === 'carpentry' ? lotFrame(s.plaza, 'carpentry', w, h)
  : place === 'dojo' ? dojoFrame(s.dojo, w, h)
  : place === 'stadium' ? stadiumFrame(s.stadium, w, h)
  : { x: Math.round(s.home.x - w / 2), y: Math.round(s.home.y - h / 2) }

const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2)

/** Where the partner ends a trip to `place`: the shop's counter, before Leavanny, before Machoke, before Ninjask, or home. */
const tripGoal = (s: TitleScene, place: Place) =>
  place === 'plaza' ? shopSpot(s.plaza)
  : place === 'boutique' ? lotSpot(s.plaza, 'boutique')
  : place === 'carpentry' ? lotSpot(s.plaza, 'carpentry')
  : place === 'dojo' ? senseiSpot(s.dojo)
  : place === 'stadium' ? judgeSpot(s.stadium)
  : s.home

/**
 * Starts a trip of the camera to `to` (the Kecleon plaza or home), eased
 * over about a second (shorter when it's close); the partner hops along to
 * its spot there. `instant` lands at once (a deep link).
 */
export const visitPlaza = (s: TitleScene, to: Place, w: number, h: number, instant = false) => {
  const p = s.partner
  if (p) {
    if (p.state === 'home') s.puffs.push({ x: p.x, y: p.y, at: s.time })
    p.state = 'trip'
  }
  const end = restCam(s, to, w, h)
  const time = instant ? 0 : clamp(Math.hypot(end.x - s.cam.x, end.y - s.cam.y) / 450, 0.45, 1.1)
  s.trip = { to, t: 0, time, cam: { ...s.cam }, from: p ? { x: p.x, y: p.y } : { ...s.cam } }
  if (instant) stepTrip(s, s.trip, 0, w, h)
}

/** Where the scene is: resting at a place, or on its way (`moving`). */
export const sceneAt = (s: TitleScene): Place | 'moving' => (s.trip ? 'moving' : s.rest)

/** Lands a trip: the camera rests there, and at the plaza the shopkeepers greet the partner. */
const arrive = (s: TitleScene, to: Place) => {
  s.trip = null
  s.rest = to
  const p = s.partner
  if (p) {
    p.moving = false
    p.state = to === 'home' ? 'home' : 'shop'
    if (to !== 'home') p.dir = 4
  }
  if (to === 'dojo') {
    greetSensei(s.dojo, s.time)
    cry(s, SENSEI.dex)
  }
  if (to === 'stadium') {
    greetJudge(s.stadium, s.time)
    cry(s, JUDGE.dex)
  }
  if (to === 'boutique') {
    greetShopkeeper(s.plaza, 'boutique', s.time)
    cry(s, TAILOR.dex)
  }
  if (to === 'carpentry') {
    greetShopkeeper(s.plaza, 'carpentry', s.time)
    cry(s, CARPENTER.dex)
  }
  // A camouflaged Kecleon keeps still and quiet until it's talked to (`revealShopkeeper`).
  if (to === 'plaza' && !s.plaza.hidden) {
    greetKeepers(s.plaza, s.time)
    cry(s, KECLEON_DEX)
  }
}

const cry = (s: TitleScene, dex: Dex) => s.cries.push(dex)

/** The camouflaged Kecleon pops out with a cry (the 1-in-20 easter egg's "Surpresa!"). */
export const revealShopkeeper = (s: TitleScene) => {
  revealKeeper(s.plaza, s.time)
  cry(s, KECLEON_DEX)
}

/** The shop grew to `level`: the new building stands at once, dust and sparkles fly and Kecleon cries out. */
export const celebrateShop = (s: TitleScene, level: Plaza['level']) => {
  celebratePlaza(s.plaza, level, s.time)
  cry(s, KECLEON_DEX)
}

/** Advances a trip: the camera eases along, the partner hops from where it was to its spot. */
const stepTrip = (s: TitleScene, trip: Trip, dt: number, w: number, h: number) => {
  trip.t = Math.min(trip.time, trip.t + dt)
  const k = trip.time > 0 ? easeInOut(trip.t / trip.time) : 1
  const end = restCam(s, trip.to, w, h)
  s.cam.x = trip.cam.x + (end.x - trip.cam.x) * k
  s.cam.y = trip.cam.y + (end.y - trip.cam.y) * k
  const p = s.partner
  if (p) {
    const goal = tripGoal(s, trip.to)
    p.x = trip.from.x + (goal.x - trip.from.x) * k
    p.y = trip.from.y + (goal.y - trip.from.y) * k
    if (Math.hypot(goal.x - trip.from.x, goal.y - trip.from.y) > 1) p.dir = dir8(goal.x - trip.from.x, goal.y - trip.from.y)
    p.moving = true
    // Hop after hop, a puff of dust at each take-off.
    if (s.time - p.hopAt >= HOP.time + 0.05 && trip.t < trip.time) {
      p.hopAt = s.time
      s.puffs.push({ x: p.x, y: p.y, at: s.time })
    }
  }
  if (trip.t >= trip.time) arrive(s, trip.to)
}

/** Starts a stroll along one of the 8 sprite directions (towards `target` if given) or a short rest. */
const nextLeg = (rng: Rng, w: Wanderer, target?: Vec) => {
  if (!target && chance(rng, 0.35)) {
    w.vx = 0
    w.vy = 0
    w.timer = range(rng, 1, 3)
    return
  }
  const angle = target ? Math.atan2(target.y - w.y, target.x - w.x) : rng() * Math.PI * 2
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
  const speed = range(rng, SPEED.min, SPEED.max)
  w.vx = Math.cos(snapped) * speed
  w.vy = Math.sin(snapped) * speed
  w.dir = dir8(w.vx, w.vy)
  w.timer = range(rng, 2, 5)
}

/** Loaded species to pick from, plus a shiny form warmed up in the background for the next shiny roll. */
const pickSpecies = (s: TitleScene) => {
  const ready = POOL.filter((dex) => loadedSprites(dex))
  if (ready.length === 0) return null
  if (s.nextShiny === null) {
    const candidates = ready.filter(hasShiny)
    if (candidates.length > 0) {
      s.nextShiny = pick(s.rng, candidates)
      void loadSpecies(s.nextShiny, true).catch(() => {})
    }
  }
  if (s.nextShiny !== null && loadedSprites(s.nextShiny, true) && chance(s.rng, SHINY_CHANCE)) {
    const dex = s.nextShiny
    s.nextShiny = null
    return { dex, shiny: true }
  }
  const ghosts = s.haunted ? ready.filter((dex) => GHOSTS.includes(dex)) : []
  return { dex: pick(s.rng, ghosts.length > 0 && chance(s.rng, HAUNTED_SHARE) ? ghosts : ready), shiny: false }
}

/** Whether feet at (x, y) are within a `w`×`h` view at `cam`, give or take the off-screen band. */
const near = (x: number, y: number, cam: Vec, w: number, h: number) => x > cam.x - MARGIN && x < cam.x + w + MARGIN && y > cam.y - MARGIN && y < cam.y + h + MARGIN

/** Whether newcomers fade in on screen instead of walking in: while the scene is young, and on a trip (into where it's going). */
const filling = (s: TitleScene) => s.time < FILL_TIME || s.trip !== null

const spawn = (s: TitleScene, w: number, h: number) => {
  const species = pickSpecies(s)
  if (!species) return
  const { rng } = s
  // On a trip, the crowd gathers where the camera is going, so it doesn't land on an empty meadow.
  const cam = s.trip ? restCam(s, s.trip.to, w, h) : s.cam
  const inside = { x: cam.x + range(rng, 0.15, 0.85) * w, y: cam.y + range(rng, 0.15, 0.85) * h }
  const wanderer: Wanderer = {
    ...species,
    x: inside.x,
    y: inside.y,
    vx: 0,
    vy: 0,
    dir: 0,
    timer: 0,
    phase: rng() * 10,
    bornAt: s.time,
    id: s.spawned++,
  }
  if (filling(s)) {
    wanderer.dir = pick(rng, [0, 1, 2, 6, 7] as const)
    nextLeg(rng, wanderer)
  } else {
    // Enter from an edge, mostly a side one, heading into the view.
    const side = rng()
    const along = { x: cam.x + rng() * w, y: cam.y + rng() * h }
    const at =
      side < 0.35 ? { x: cam.x + w + ENTRY, y: along.y }
      : side < 0.5 ? { x: along.x, y: cam.y - ENTRY }
      : side < 0.65 ? { x: along.x, y: cam.y + h + ENTRY }
      : { x: cam.x - ENTRY, y: along.y }
    wanderer.x = at.x
    wanderer.y = at.y
    nextLeg(rng, wanderer, inside)
  }
  s.wanderers.push(wanderer)
}

/** Advances the camera, the partner and every wanderer by `dt` seconds for a `w`×`h` view. */
export const stepTitleScene = (s: TitleScene, dt: number, w: number, h: number) => {
  s.time += dt
  const p = s.partner
  if (!s.placed) {
    s.placed = true
    Object.assign(s.cam, restCam(s, s.rest, w, h))
  }
  // On a trip the camera eases there; else it rests.
  if (s.trip) stepTrip(s, s.trip, dt, w, h)
  else {
    const rest = restCam(s, s.rest, w, h)
    const k = Math.min(1, dt * 3)
    s.cam.x += (rest.x - s.cam.x) * k
    s.cam.y += (rest.y - s.cam.y) * k
  }
  stepPlaza(s.plaza, p && p.state !== 'home' ? p : null)
  stepDojo(s.dojo, p && p.state !== 'home' ? p : null)
  stepStadium(s.stadium, p && p.state !== 'home' ? p : null)
  // The companion waits with the partner at home and follows it on a trip.
  const c = s.companion
  if (c && p && p.state === 'home') Object.assign(c, createCompanion(c.dex, c.shiny, p, c.sparkles))
  else if (c && p) stepCompanion(c, p, dt)
  const { cam, rng } = s
  for (const wd of s.wanderers) {
    if ((wd.timer -= dt) <= 0) nextLeg(rng, wd)
    wd.x += wd.vx * dt
    wd.y += wd.vy * dt
    pushOut(s.plaza, wd)
    pushOutDojo(s.dojo, wd)
    pushOutStadium(s.stadium, wd)
  }
  const ahead = s.trip && restCam(s, s.trip.to, w, h)
  retain(s.wanderers, (wd) => near(wd.x, wd.y, cam, w, h) || (ahead !== null && near(wd.x, wd.y, ahead, w, h)))
  retain(s.puffs, (puff) => s.time - puff.at < PUFF_TIME)
  if (s.wanderers.length < population(w, h) && s.time >= s.nextSpawn) {
    spawn(s, w, h)
    s.nextSpawn = s.time + (filling(s) ? 0.08 : range(rng, 0.4, 1.4))
  }
}

/** Height (px) of a hop `since` seconds in, `count` hops long; 0 outside it. */
const hopHeight = (since: number, count = 1, height = HOP.height) =>
  since < 0 || since >= HOP.time * count ? 0 : Math.round(Math.sin((Math.PI * (since % HOP.time)) / HOP.time) * height)

const drawPuffs = (ctx: CanvasRenderingContext2D, s: TitleScene, camX: number, camY: number) => {
  for (const puff of s.puffs) {
    const k = (s.time - puff.at) / PUFF_TIME
    ctx.globalAlpha = 0.8 * (1 - k)
    for (const side of [-1, 1]) blitEllipse(ctx, 3, 2, '#f0f0e0', Math.round(puff.x - camX + side * (4 + k * 10)), Math.round(puff.y - camY - k * 3))
  }
  ctx.globalAlpha = 1
}

/** What the draw sorts by feet besides the wanderers, reused every frame. */
const pending: Piece[] = []
const byFeet = (a: { y: number }, b: { y: number }) => a.y - b.y

/** Draws the meadow, its wanderers and the partner, back to front, snapped to the world pixel grid. */
export const drawTitleScene = (ctx: CanvasRenderingContext2D, s: TitleScene, w: number, h: number) => {
  const camX = Math.round(s.cam.x)
  const camY = Math.round(s.cam.y)
  drawGround(ctx, camX, camY, w, h)
  drawPlazaGround(ctx, s.plaza, camX, camY, w, h)
  drawDojoGround(ctx, s.dojo, camX, camY, w, h)
  drawStadiumGround(ctx, s.stadium, camX, camY, w, h)
  if (s.haunted) drawMeadowJacks(ctx, camX, camY, w, h, s.time)
  drawPuffs(ctx, s, camX, camY)
  const p = s.partner
  const c = p && s.companion
  const drawPartner = () => {
    const sprite = p && loadedSprites(p.dex, p.shiny)
    if (!p || !sprite) return
    const x = Math.round(p.x) - camX
    const y = Math.round(p.y) - camY
    shadow(ctx, x, y, sprite.bodyW)
    drawPokemon(ctx, sprite, p.moving ? 'Walk' : 'Idle', p.dir, s.time, x, y - hopHeight(s.time - p.hopAt))
  }
  const drawFollower = () => {
    const sprite = c && loadedSprites(c.dex, c.shiny)
    if (!c || !sprite) return
    shadow(ctx, Math.round(c.x) - camX, Math.round(c.y) - camY, sprite.bodyW)
    ctx.save()
    ctx.translate(-camX, -camY)
    drawCompanion(ctx, c, s.time)
    ctx.restore()
  }
  // The partner, its companion and the plaza's pieces, back to front, slot in among the wanderers by their feet.
  pending.length = 0
  if (p) pending.push({ y: p.y, draw: drawPartner })
  if (c) pending.push({ y: c.y, draw: drawFollower })
  for (const piece of plazaPieces(s.plaza)) pending.push(piece)
  for (const piece of dojoPieces(s.dojo)) pending.push(piece)
  for (const piece of stadiumPieces(s.stadium)) pending.push(piece)
  pending.sort(byFeet)
  let next = 0
  const flush = (y: number) => {
    while (next < pending.length && y > pending[next]!.y) pending[next++]!.draw(ctx, camX, camY, s.time)
  }
  s.wanderers.sort(byFeet)
  for (const wd of s.wanderers) {
    flush(wd.y)
    const sprite = loadedSprites(wd.dex, wd.shiny)
    if (!sprite) continue
    const x = Math.round(wd.x) - camX
    const y = Math.round(wd.y) - camY
    const alpha = Math.min(1, (s.time - wd.bornAt) / FADE_IN)
    shadow(ctx, x, y, sprite.bodyW)
    drawPokemon(ctx, sprite, wd.vx === 0 && wd.vy === 0 ? 'Idle' : 'Walk', wd.dir, s.time + wd.phase, x, y, { alpha })
    if (wd.shiny) drawSparkles(ctx, x, y - sprite.bodyH / 2, Math.max(sprite.bodyW, sprite.bodyH), s.time - wd.bornAt, wd.id)
  }
  flush(Infinity)
  drawPlazaOverhead(ctx, s.plaza, camX, camY)
  drawPlazaParty(ctx, s.plaza, camX, camY, s.time)
  drawPlazaDusk(ctx, s.plaza, camX, camY, w, h, s.time)
  if (s.haunted) drawMeadowNight(ctx, camX, camY, w, h, s.time)
}
