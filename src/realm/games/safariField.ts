import type { SafariHabitat } from '../../data/safari'
import { MAP_H, MAP_W, PLAZA, TILE } from '../../data/safariMaps'
import { joystick, type Stick } from '../../engine/input'
import { dir8, type Dir8 } from '../../engine/math'
import { blitEllipse } from '../../engine/pixelart'
import { drawJoystick } from '../../render/joystick'
import { drawPokemon, loadSpecies, loadedSprites, sprites } from '../../render/sprites'
import { playSfx } from '../../engine/audio'
import { burst, drawFx, image, stepFx, type Particle, type Popup } from './arcadeKit'
import type { GameInput } from './frame'
import type { SafariDaypart } from './safari.rules'
import { GRASS_CELL, GRASS_VARIANTS, LIGHTS, bakeGrass, bakeGround, waterTiles, type SafariTheme } from './safariArt'
import { behindPlaza, moveWalker, tallTileAt, type SafariWorld } from './safariWorld'

/**
 * The Zona Safári's map scene: the partner walks a preserve (`safariWorld.ts`),
 * the grass closing over its feet and parting as it passes, and every new tall
 * tile may set something off. When that happens is the client's to decide and
 * changes nothing: the API answers with the next encounter in line.
 *
 * A few Pokémon wander in the open (`setWanderers`). Those of the session
 * (`slot` set) can be sneaked up on: walking slowly (Shift, the sneak toggle
 * or a light push on the stick) keeps them calm unless they see you coming,
 * and touching one from behind meets it (`stalk`); running near one, or
 * moving where it's looking, scares it off into the grass. At dusk and at
 * night the map takes the hour's light (`LIGHTS`): one flat wash, lantern
 * pools on the plaza and fireflies.
 */

/** px/s at a full push. */
const SPEED = 74

/** Tall tiles that must pass after an encounter before another can start, and the chance per tile after that. */
const GRACE = 7
const CHANCE = 0.07

/** How many px up the grass covers a walker's body. */
const COVER = 11

/** The Ranger of the booth: the Safari's keeper in the Realm too. */
const RANGER_DEX = 115

const BOARD_REACH = 34

/**
 * The arch's threshold, in its art's pixels: the opening between the posts, from
 * the dirt down. It's ground, so it's laid under the walkers (`drawThreshold`) and
 * only the rest of the art stands at the gate's depth.
 */
const THRESHOLD = { x: 33, y: 80, w: 45, h: 24 } as const

/** How much of a session's wanderer the grass hides. */
const WANDERER_COVER = 5

/** How strongly the partner shows through a tall piece of the plaza when it's behind one. */
const SEE_THROUGH = 0.55

/** Art of a prop kind, by file; null until it loaded. */
const artOf = (habitat: SafariHabitat, kind: string): HTMLImageElement | null => image(kind === 'kiosk' || kind === 'board' ? `safari/${kind}` : kind === 'gate' ? 'realm/safari-gate' : `safari/${habitat}-${kind}`)

/**
 * A Pokémon in the open: where it stands and wanders, which way it looks, and
 * how it feels about the partner. `slot`: the session's wanderer it is (null:
 * only a glimpse of the week's residents, never met). `doubt` fills while it
 * sees the partner moving and bolts it when full; `mark` is the "?" or "!".
 */
type Resident = {
  dex: number
  slot: number | null
  x: number
  y: number
  homeX: number
  homeY: number
  dir: Dir8
  walk: number
  pause: number
  away: number
  hiddenFor: number
  doubt: number
  mark: '?' | '!' | null
  markAt: number
}

/** A glimpse flees when the partner comes this close, and comes back after a while. */
const RESIDENT_WARY = 54
const RESIDENT_BACK = 9

/** A wanderer of the session: it hears a run this far off, sees a step this far ahead, and is met when touched from this close. */
const SNEAK = { hear: 74, see: 58, touch: 15, back: 12, doubt: 0.75, cone: 0.34 } as const

/** How fast sneaking walks, as a share of a full push; a push on the stick lighter than `stick` sneaks too. */
const SNEAK_SPEED = 0.42
const SNEAK_STICK = 0.55

/** What the map gave away this step: a rustle in the grass, or a wanderer touched from behind. */
export type FieldEvent = { kind: 'rustle' } | { kind: 'stalk'; slot: number } | null

/** The way a PMD direction faces, as a unit vector. */
const facing = (d: Dir8) => {
  const a = ((2 - d + 8) % 8) * (Math.PI / 4)
  return { x: Math.cos(a), y: Math.sin(a) }
}

/** The "?" and "!" over a wanderer, 3×7 px with a dark edge. */
const MARKS = { '?': ['.ww.', 'w..w', '...w', '..w.', '..w.', '....', '..w.'], '!': ['.w.', '.w.', '.w.', '.w.', '.w.', '...', '.w.'] } as const

export type Field = ReturnType<typeof createField>

export const createField = (opts: { habitat: SafariHabitat; world: SafariWorld; theme: SafariTheme; dex: number; shiny: boolean; mapSeed: number; residents: readonly number[]; daypart: SafariDaypart }) => {
  const { habitat, world, theme, dex, shiny, mapSeed } = opts
  let light = LIGHTS[opts.daypart]
  /** The sneak toggle (touch's way); Shift and a light push sneak too. */
  let sneakOn = false
  let sneaking = false
  const fieldW = (MAP_W - 1) * TILE
  const fieldH = (MAP_H - 1) * TILE

  const player = { x: PLAZA.spawn.x * TILE, y: PLAZA.spawn.y * TILE, dir: 4 as Dir8, moving: false }
  const out = { x: 0, y: 0 }
  let ground: HTMLCanvasElement | null = null
  let grass: HTMLCanvasElement | null = null
  const water = theme.water ? waterTiles(world) : new Int16Array(0)
  /** When each tall tile was last walked through (s on the clock), for its rustle. */
  const rustled = new Float32Array((MAP_W - 1) * (MAP_H - 1)).fill(-9)
  let lastTile = -1
  let grace = GRACE
  let clock = 0
  let shake = 0
  /** Where a finger holds the stick, in CSS px of the canvas. */
  let stick: Stick | null = null
  const parts: Particle[] = []
  const pops: Popup[] = []
  /** Set while the "!" and the shaking grass play. */
  let alertAt = -1

  /** Screen-space motes: a fixed pool, so the sky never allocates. */
  const motes = Array.from({ length: 22 }, (_, i) => ({ x: (i * 97) % 400, y: (i * 61) % 400, p: i * 1.7 }))

  /** Tall tiles clear of the forest's edge and the plaza, where someone in the open can be seen and reached. */
  const open = (() => {
    const inner = Array.from(world.tallList).filter((tile) => {
      const tx = tile % (MAP_W - 1)
      const ty = (tile - tx) / (MAP_W - 1)
      return ty >= 6 && ty <= PLAZA.gate.y - 4 && tx >= 4 && tx <= MAP_W - 6
    })
    return inner.length >= 8 ? inner : Array.from(world.tallList)
  })()

  /** A resident's home: a tall tile picked by its place among `n`, so a slot keeps its spot across a reload. */
  const homeOf = (i: number, n: number) => {
    const tile = open[Math.floor((i + 0.5) * (open.length / n))]!
    const tx = tile % (MAP_W - 1)
    const ty = (tile - tx) / (MAP_W - 1)
    return { x: tx * TILE + 8, y: ty * TILE + 8 }
  }

  const resident = (dexNo: number, slot: number | null, home: { x: number; y: number }, i: number): Resident => ({
    dex: dexNo,
    slot,
    x: home.x,
    y: home.y,
    homeX: home.x,
    homeY: home.y,
    dir: ((i * 3) % 8) as Dir8,
    walk: 0,
    pause: 1 + i * 0.7,
    away: 0,
    hiddenFor: 0,
    doubt: 0,
    mark: null,
    markAt: 0,
  })

  /** A few of the week's species out in the open: only a glimpse until a session puts its wanderers there (`setWanderers`). */
  let residents: Resident[] = opts.residents.map((r, i) => resident(r, null, homeOf(i, opts.residents.length), i))
  for (const r of residents) void loadSpecies(r.dex).catch(() => {})
  /** Set when a wanderer was touched from behind: the "!" plays over it. */
  let stalked: Resident | null = null

  /** Everything that stands, back to front; the walkers are merged in as it's drawn. */
  const standing = [
    ...[...world.props].sort((a, b) => a.y - b.y).map((p, i) => ({ kind: p.kind, x: p.x, y: p.y, flip: (i & 1) === 1 })),
    { kind: 'kiosk', x: PLAZA.kiosk.x * TILE, y: PLAZA.kiosk.y * TILE, flip: false },
    { kind: 'board', x: PLAZA.board.x * TILE, y: PLAZA.board.y * TILE, flip: false },
    { kind: 'gate', x: PLAZA.gate.x * TILE, y: PLAZA.gate.y * TILE, flip: false },
  ].sort((a, b) => a.y - b.y)
  const ranger = { x: PLAZA.ranger.x * TILE, y: PLAZA.ranger.y * TILE }

  void loadSpecies(dex, shiny).catch(() => {})
  void loadSpecies(RANGER_DEX).catch(() => {})

  /** Bakes the map once its atlases have loaded; safe to call every frame until then. */
  const ensureBaked = () => {
    if (ground) return
    const path = image(`safari/tiles-${habitat}-path`)
    const block = image(`safari/tiles-${habitat}-block`)
    if (!path || !block) return
    ground = bakeGround(world, theme, path, block, mapSeed)
    grass = bakeGrass(theme)
  }

  const nearBoard = () => Math.hypot(player.x - PLAZA.board.x * TILE, player.y - PLAZA.board.y * TILE - 8) < BOARD_REACH

  const stepMotes = (dt: number) => {
    for (const m of motes) {
      m.p += dt
      if (theme.motes.drift === 'fall') m.y += 14 * dt
      else if (theme.motes.drift === 'rise') m.y -= 7 * dt
      else if (theme.motes.drift === 'dust') m.x += 22 * dt
      else m.x += Math.sin(m.p * 0.9) * 8 * dt
      m.x = ((m.x % 400) + 400) % 400
      m.y = ((m.y % 400) + 400) % 400
    }
  }

  /** A glimpse: it bolts as soon as the partner comes near, whatever the pace. */
  const stepGlimpse = (r: Resident, dx: number, dy: number, dist: number) => {
    if (r.away <= 0 && dist < RESIDENT_WARY) {
      r.away = 0.7
      r.dir = dir8(dx, dy)
    }
  }

  /**
   * A wanderer of the session: a run within earshot bolts it at once; a step
   * where it's looking fills its doubt ("?") until it bolts ("!"); standing
   * still lets it settle. Touched from behind before that, it's met.
   */
  const stepWanderer = (r: Resident, dt: number, dx: number, dy: number, dist: number): boolean => {
    if (r.away > 0) return false
    const moving = player.moving
    const look = facing(r.dir)
    const seen = dist > 0 && (-dx * look.x - dy * look.y) / dist > SNEAK.cone
    if (moving && !sneaking && dist < SNEAK.hear) r.doubt = SNEAK.doubt
    else if (moving && seen && dist < SNEAK.see) {
      r.doubt += dt
      r.dir = dir8(-dx, -dy)
      if (r.mark !== '?') {
        r.mark = '?'
        r.markAt = clock
      }
    } else r.doubt = Math.max(0, r.doubt - dt * 0.6)
    if (r.doubt <= 0.05 && r.mark === '?') r.mark = null
    if (r.doubt >= SNEAK.doubt) {
      r.away = 0.7
      r.dir = dir8(dx, dy)
      r.mark = '!'
      r.markAt = clock
      r.doubt = 0
      playSfx('safariFlee', 60)
      return false
    }
    // Close enough, unseen: met.
    if (!seen && dist < SNEAK.touch) {
      r.mark = '!'
      r.markAt = clock
      stalked = r
      return true
    }
    return false
  }

  /** Steps everyone in the open; the slot of a wanderer touched from behind, or -1. */
  const stepResidents = (dt: number, walking: boolean): number => {
    let met = -1
    for (const r of residents) {
      if (r === stalked) continue
      if (r.hiddenFor > 0) {
        r.hiddenFor -= dt
        if (r.hiddenFor <= 0) {
          r.x = r.homeX
          r.y = r.homeY
          r.away = 0
          r.mark = null
        }
        continue
      }
      const dx = r.x - player.x
      const dy = r.y - player.y
      const dist = Math.hypot(dx, dy)
      if (r.slot === null) stepGlimpse(r, dx, dy, dist)
      else if (walking && met < 0 && stepWanderer(r, dt, dx, dy, dist)) {
        met = r.slot
        continue
      }
      if (r.away > 0) {
        const step = 120 * dt
        r.x += (dx / (dist || 1)) * step
        r.y += (dy / (dist || 1)) * step
        r.away -= dt
        if (r.away <= 0) r.hiddenFor = r.slot === null ? RESIDENT_BACK : SNEAK.back
        continue
      }
      if (r.mark === '?') continue
      if (r.pause > 0) {
        r.pause -= dt
        // Looking about while it rests.
        if (r.slot !== null && Math.floor((clock + r.dex) / 1.6) !== Math.floor((clock + r.dex - dt) / 1.6)) r.dir = (((r.dir + (r.dex % 2 === 0 ? 2 : 6)) % 8) as Dir8)
        continue
      }
      const hx = r.homeX + Math.sin(clock * 0.8 + r.dex) * 18
      const hy = r.homeY + Math.cos(clock * 0.6 + r.dex) * 10
      const mx = hx - r.x
      const my = hy - r.y
      const len = Math.hypot(mx, my) || 1
      r.dir = dir8(mx, my)
      r.x += (mx / len) * 20 * dt
      r.y += (my / len) * 20 * dt
      // The grass it walks through stirs, which is how it's spotted.
      const tile = tallTileAt(world, r.x, r.y)
      if (r.slot !== null && tile >= 0 && clock - rustled[tile]! > 0.6) rustled[tile] = clock
      r.walk += dt
      if (r.walk > 1.4) {
        r.walk = 0
        r.pause = 1.5 + (r.dex % 5) * 0.4
      }
    }
    return met
  }

  /** Steps the map. `walking`: whether the player may move. What the grass or a wanderer gave away this step, if anything. */
  const step = (dt: number, input: GameInput, walking: boolean, cssScale: number): FieldEvent => {
    clock += dt
    if (shake > 0) shake -= dt
    stepFx(parts, pops, dt)
    stepMotes(dt)
    const met = stepResidents(dt, walking)
    ensureBaked()
    player.moving = false
    if (met >= 0) {
      stick = null
      return { kind: 'stalk', slot: met }
    }
    if (!walking) {
      stick = null
      return null
    }

    // The pointer, in CSS px of the canvas: a floating stick.
    const p = input.pointer
    if (p.down) {
      const at = { x: p.x * cssScale, y: p.y * cssScale }
      if (input.pointer.pressed || !stick) stick = joystick(at, at)
      else stick = joystick(stick.origin, at)
    } else stick = null

    let mx = 0
    let my = 0
    if (stick) {
      mx = stick.vec.x
      my = stick.vec.y
    }
    if (input.held('ArrowLeft') || input.held('KeyA')) mx -= 1
    if (input.held('ArrowRight') || input.held('KeyD')) mx += 1
    if (input.held('ArrowUp') || input.held('KeyW')) my -= 1
    if (input.held('ArrowDown') || input.held('KeyS')) my += 1
    const len = Math.hypot(mx, my)
    if (len < 0.05) {
      sneaking = sneakOn || input.held('ShiftLeft') || input.held('ShiftRight')
      return null
    }
    // A light push on the stick, Shift or the toggle: a sneak's pace.
    sneaking = sneakOn || input.held('ShiftLeft') || input.held('ShiftRight') || (stick !== null && len < SNEAK_STICK)
    if (len > 1 || sneaking) {
      mx /= len
      my /= len
    }
    const pace = sneaking ? SPEED * SNEAK_SPEED : SPEED
    player.dir = dir8(mx, my)
    player.moving = true
    moveWalker(world, player.x, player.y, mx * pace * dt, my * pace * dt, out)
    player.x = out.x
    player.y = out.y
    const tile = tallTileAt(world, player.x, player.y)
    if (tile === lastTile) return null
    lastTile = tile
    if (tile < 0) return null
    rustled[tile] = clock
    // Sneaking parts the grass quietly.
    if (!sneaking) playSfx('rustle', 90)
    burst(parts, player.x, player.y - 8, [theme.tall[2], theme.tall[3], theme.tip], sneaking ? 1 : 3, 26, 110)
    if (grace > 0) grace -= 1
    return grace === 0 && Math.random() < CHANCE ? { kind: 'rustle' } : null
  }

  /** Starts the "!" over the partner, and every nearby tile rustling hard. */
  const alert = () => {
    alertAt = clock
    shake = 0.35
    const tile = tallTileAt(world, player.x, player.y)
    if (tile >= 0) rustled[tile] = clock
  }

  /** Back to walking after an encounter: a few tiles' peace. */
  const resume = () => {
    alertAt = -1
    grace = GRACE
    if (stalked) residents = residents.filter((r) => r !== stalked)
    stalked = null
  }

  /**
   * Who's in the open now: the session's wanderers (by slot, a fixed spot
   * each) or, with none given, the week's glimpses. One already out keeps
   * where it is.
   */
  const setWanderers = (list: readonly { slot: number; dex: number }[] | null) => {
    if (!list) {
      residents = opts.residents.map((r, i) => resident(r, null, homeOf(i, opts.residents.length), i))
      return
    }
    const kept = residents
    // The one just met stays under its "!" until the battle takes over (`resume` lets it go).
    residents = [...(stalked ? [stalked] : []), ...list.map((w) => kept.find((r) => r.slot === w.slot && r.dex === w.dex) ?? resident(w.dex, w.slot, homeOf(w.slot, 8), w.slot)).filter((r) => r !== stalked)]
    for (const r of residents) void loadSpecies(r.dex).catch(() => {})
  }

  const drawGrass = (g: CanvasRenderingContext2D, camX: number, camY: number, W: number, H: number) => {
    if (!grass) return
    const { w, h } = GRASS_CELL
    const list = world.tallList
    const tilesW = MAP_W - 1
    for (let n = 0; n < list.length; n++) {
      const i = list[n]!
      const tx = i % tilesW
      const ty = (i - tx) / tilesW
      const sx = tx * TILE - camX - 2
      const sy = ty * TILE - camY + TILE - h
      if (sx > W || sx + w < 0 || sy > H || sy + h < 0) continue
      const wave = Math.sin(clock * 1.6 + tx * 0.42 + ty * 0.27)
      const since = clock - rustled[i]!
      const jolt = since < 0.5 ? Math.round(Math.sin(since * 38) * 1.4) : 0
      const frame = since < 0.5 ? (Math.floor(since * 16) % 2) * 2 : wave > 0.55 ? 2 : wave < -0.55 ? 0 : 1
      g.drawImage(grass, frame * w, ((tx * 3 + ty * 5) % GRASS_VARIANTS) * h, w, h, sx + jolt, sy + ((tx * 7 + ty * 13) % 3), w, h)
    }
  }

  /** Redraws the grass over a walker's lower body, `COVER` px of it, whichever row its feet are in. */
  const coverFeet = (g: CanvasRenderingContext2D, x: number, y: number, camX: number, camY: number, cover: number = COVER) => {
    if (!grass || tallTileAt(world, x, y) < 0) return
    const top = Math.round(y - camY - cover)
    const bottom = Math.round(y - camY + 3)
    g.save()
    g.beginPath()
    g.rect(Math.round(x - camX - 26), top, 52, bottom - top)
    g.clip()
    const tilesW = MAP_W - 1
    const ftx = Math.floor(x / TILE)
    const fty = Math.floor(y / TILE)
    for (let ty = fty - 1; ty <= fty + 1; ty++) {
      for (let tx = ftx - 2; tx <= ftx + 2; tx++) {
        if (tx < 0 || ty < 0 || tx >= tilesW || ty >= MAP_H - 1) continue
        const i = ty * tilesW + tx
        if (world.tall[i] !== 1) continue
        const since = clock - rustled[i]!
        const wave = Math.sin(clock * 1.6 + tx * 0.42 + ty * 0.27)
        const frame = since < 0.5 ? (Math.floor(since * 16) % 2) * 2 : wave > 0.55 ? 2 : wave < -0.55 ? 0 : 1
        g.drawImage(grass, frame * GRASS_CELL.w, ((tx * 3 + ty * 5) % GRASS_VARIANTS) * GRASS_CELL.h, GRASS_CELL.w, GRASS_CELL.h, tx * TILE - camX - 2, ty * TILE - camY + TILE - GRASS_CELL.h + ((tx * 7 + ty * 13) % 3), GRASS_CELL.w, GRASS_CELL.h)
      }
    }
    g.restore()
  }

  const drawWalker = (g: CanvasRenderingContext2D, x: number, y: number, camX: number, camY: number) => {
    const inGrass = tallTileAt(world, x, y) >= 0
    const px = Math.round(x - camX)
    const py = Math.round(y - camY)
    if (!inGrass) blitEllipse(g, 8, 3, 'rgba(16,24,16,0.32)', px, py)
    // A sneak's steps play at half pace.
    drawPokemon(g, sprites(dex, shiny), player.moving ? 'Walk' : 'Idle', player.dir, sneaking && player.moving ? clock * 0.5 : clock, px, py)
  }

  const drawRanger = (g: CanvasRenderingContext2D, camX: number, camY: number) => {
    if (!loadedSprites(RANGER_DEX)) return
    const s = sprites(RANGER_DEX)
    const px = Math.round(ranger.x - camX)
    const py = Math.round(ranger.y - camY)
    blitEllipse(g, 11, 4, 'rgba(16,24,16,0.32)', px, py)
    drawPokemon(g, s, 'Idle', 0, clock, px, py)
  }

  /** One span of the low wooden fence, drawn in the habitat's planks: a post and two rails. */
  const drawFence = (g: CanvasRenderingContext2D, x: number, y: number) => {
    const [light, dark] = theme.planks
    g.fillStyle = dark
    g.fillRect(x - 8, y - 13, 16, 2)
    g.fillRect(x - 8, y - 7, 16, 2)
    g.fillRect(x - 2, y - 18, 4, 18)
    g.fillStyle = light
    g.fillRect(x - 8, y - 14, 16, 1)
    g.fillRect(x - 8, y - 8, 16, 1)
    g.fillRect(x - 1, y - 18, 2, 17)
  }

  /** Draws one standing thing with its base at (x, y); anything taller just rises above it. */
  const drawStanding = (g: CanvasRenderingContext2D, kind: string, x: number, y: number, camX: number, camY: number, W: number, H: number, flip: boolean) => {
    if (kind === 'blocker') return
    if (kind === 'fence') return drawFence(g, Math.round(x - camX), Math.round(y - camY))
    const art = artOf(habitat, kind)
    if (!art) return
    const sx = Math.round(x - art.width / 2 - camX)
    const sy = Math.round(y - art.height - camY + 4)
    if (sx > W || sx + art.width < 0 || sy > H || sy + art.height < 0) return
    if (kind.startsWith('tree')) blitEllipse(g, 14, 5, 'rgba(16,24,16,0.28)', Math.round(x - camX), Math.round(y - camY))
    if (kind === 'gate') {
      // All of it but the threshold: what's above it, and either side of the opening.
      const { x: left, y: top, w, h } = THRESHOLD
      const right = left + w
      g.drawImage(art, 0, 0, art.width, top, sx, sy, art.width, top)
      g.drawImage(art, 0, top, left, h, sx, sy + top, left, h)
      g.drawImage(art, right, top, art.width - right, h, sx + right, sy + top, art.width - right, h)
      return
    }
    if (flip) {
      g.save()
      g.translate(sx + art.width, sy)
      g.scale(-1, 1)
      g.drawImage(art, 0, 0)
      g.restore()
    } else g.drawImage(art, sx, sy)
  }

  /** Lays the arch's threshold on the ground, under anyone walking over it. */
  const drawThreshold = (g: CanvasRenderingContext2D, camX: number, camY: number) => {
    const art = artOf(habitat, 'gate')
    if (!art) return
    const { x, y, w, h } = THRESHOLD
    g.drawImage(art, x, y, w, h, Math.round(PLAZA.gate.x * TILE - art.width / 2 - camX) + x, Math.round(PLAZA.gate.y * TILE - art.height - camY + 4) + y, w, h)
  }

  /** The map at the current moment. `drawn` holds the camera, so a transition can keep drawing it. */
  const draw = (g: CanvasRenderingContext2D, W: number, H: number, cssScale: number, bottomInset = 0) => {
    if (!ground) {
      g.fillStyle = theme.shade
      g.fillRect(0, 0, W, H)
      return
    }
    const camX = Math.max(0, Math.min(fieldW - W, Math.round(player.x - W / 2))) + (shake > 0 ? Math.round(Math.sin(clock * 70) * 2) : 0)
    // What the box and the buttons cover counts as below the map: the partner stays in the part that shows.
    const camY = Math.max(0, Math.min(fieldH - H + bottomInset, Math.round(player.y - (H - bottomInset) * 0.58)))
    lastCam.x = camX
    lastCam.y = camY
    g.fillStyle = theme.shade
    g.fillRect(0, 0, W, H)
    g.drawImage(ground, camX, camY, Math.min(W, fieldW), Math.min(H, fieldH - camY), 0, 0, Math.min(W, fieldW), Math.min(H, fieldH - camY))

    // The water's glints.
    if (water.length > 0) {
      g.fillStyle = theme.glint
      for (let i = 0; i < water.length; i += 2) {
        const sx = water[i]! - camX
        const sy = water[i + 1]! - camY
        if (sx < -16 || sx > W || sy < -16 || sy > H) continue
        const beat = Math.sin(clock * 1.3 + water[i]! * 0.13 + water[i + 1]! * 0.21)
        if (beat > 0.55) g.fillRect(sx + 5, sy + 5 + Math.round(beat * 3), 4, 1)
        if (beat < -0.65) g.fillRect(sx + 11, sy + 11, 3, 1)
      }
    }

    drawThreshold(g, camX, camY)
    drawGrass(g, camX, camY, W, H)

    // Everything that stands, back to front, the walkers merged in.
    let playerDone = false
    let rangerDone = false
    const py = player.y
    for (let s = 0; s < standing.length; s++) {
      const p = standing[s]!
      if (!rangerDone && ranger.y <= p.y) {
        drawRanger(g, camX, camY)
        rangerDone = true
      }
      if (!playerDone && py <= p.y) {
        drawWalker(g, player.x, py, camX, camY)
        playerDone = true
      }
      drawStanding(g, p.kind, p.x, p.y, camX, camY, W, H, p.flip)
    }
    if (!rangerDone) drawRanger(g, camX, camY)
    if (!playerDone) drawWalker(g, player.x, py, camX, camY)
    if (behindPlaza(player.x, py)) drawPokemon(g, sprites(dex, shiny), player.moving ? 'Walk' : 'Idle', player.dir, clock, Math.round(player.x - camX), Math.round(py - camY), { alpha: SEE_THROUGH })

    for (const r of residents) {
      // Asked every frame, on screen or not, so the sweep never drops its sheets (and asks again if it did);
      // drawn only once they're in, never as a dust puff in the grass.
      const resident = sprites(r.dex)
      if (r.hiddenFor > 0 || !loadedSprites(r.dex)) continue
      const sx = Math.round(r.x - camX)
      const sy = Math.round(r.y - camY)
      if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 50) continue
      // Bolting, it dives into the grass: it sinks out of sight rather than fading.
      const sink = r.away > 0 ? Math.round((1 - r.away / 0.7) * 14) : 0
      if (sink > 0) {
        g.save()
        g.beginPath()
        g.rect(sx - 40, sy - 80, 80, 80)
        g.clip()
      }
      drawPokemon(g, resident, (r.pause > 0 || r.mark === '?') && r.away <= 0 ? 'Idle' : 'Walk', r.dir, clock * (r.away > 0 ? 2.5 : 1), sx, sy + sink)
      if (sink > 0) g.restore()
      // A wanderer of the session stands taller in the grass than a glimpse: there to be found.
      coverFeet(g, r.x, r.y, camX, camY, r.slot === null ? COVER : WANDERER_COVER)
      if (r.mark && clock - r.markAt < (r.mark === '!' ? 0.8 : 99)) drawMark(g, r.mark, sx, sy - Math.max(22, Math.round(resident.bodyH)) - 8)
    }

    coverFeet(g, player.x, player.y, camX, camY)

    g.save()
    g.translate(-camX, -camY)
    drawFx(g, parts, pops)
    g.restore()

    // Motes in screen space, a pixel or two each.
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i]!
      const sx = Math.round(m.x) % W
      const sy = Math.round(m.y) % H
      g.fillStyle = i % 3 === 0 ? theme.motes.alt : theme.motes.color
      if (Math.sin(m.p * 3) > -0.4) g.fillRect(sx, sy, i % 4 === 0 ? 2 : 1, 1)
    }

    if (light) drawLight(g, W, H, camX, camY)

    if (alertAt >= 0) drawAlert(g, Math.round(player.x - camX), Math.round(player.y - camY))
    if (stick) drawJoystick(g, stick, cssScale)
  }

  /** A "?" or "!" over a wanderer, in white with a dark edge. */
  const drawMark = (g: CanvasRenderingContext2D, mark: '?' | '!', x: number, y: number) => {
    const rows = MARKS[mark]
    const w = rows[0]!.length
    g.fillStyle = '#283040'
    for (let ry = 0; ry < rows.length; ry++)
      for (let rx = 0; rx < w; rx++) if (rows[ry]![rx] === 'w') g.fillRect(x - Math.floor(w / 2) + rx - 1, y + ry - 1, 3, 3)
    g.fillStyle = mark === '!' ? '#ff6060' : '#ffffff'
    for (let ry = 0; ry < rows.length; ry++)
      for (let rx = 0; rx < w; rx++) if (rows[ry]![rx] === 'w') g.fillRect(x - Math.floor(w / 2) + rx, y + ry, 1, 1)
  }

  /** Where the camera stood last frame (dev's `peek`). */
  const lastCam = { x: 0, y: 0 }

  /** Fireflies over the grass at dusk and night: a fixed pool drifting in screen space. */
  const flies = Array.from({ length: 16 }, (_, i) => ({ x: (i * 131) % 400, y: (i * 89) % 400, p: i * 2.3 }))

  /**
   * The hour's light: the whole map multiplied by one flat color (every pixel
   * keeps its edge), warm pools under the plaza's lanterns, the lanterns lit,
   * and fireflies, which stay bright.
   */
  const drawLight = (g: CanvasRenderingContext2D, W: number, H: number, camX: number, camY: number) => {
    const L = light!
    g.save()
    g.globalCompositeOperation = 'multiply'
    g.fillStyle = L.wash
    g.fillRect(0, 0, W, H)
    g.restore()
    if (L.lamps) {
      const gate = artOf(habitat, 'gate')
      // The booth's own lantern by its door (in its art at 72, 62), and two hung from the arch's beam.
      const lamps = [
        { x: PLAZA.kiosk.x * TILE + 18, y: PLAZA.kiosk.y * TILE - 33, floor: PLAZA.kiosk.y * TILE + 5, hung: false },
        ...(gate ? [-1, 1].map((side) => ({ x: PLAZA.gate.x * TILE + side * 30, y: PLAZA.gate.y * TILE - gate.height + 40, floor: PLAZA.gate.y * TILE + 2, hung: true })) : []),
      ]
      g.save()
      g.globalCompositeOperation = 'lighter'
      for (const lamp of lamps) {
        const lx = Math.round(lamp.x - camX)
        blitEllipse(g, 15, 5, '#2a1c08', lx, Math.round(lamp.floor - camY))
        blitEllipse(g, 8, 3, '#3a280c', lx, Math.round(lamp.floor - camY))
        blitEllipse(g, 6, 6, '#3a2a10', lx, Math.round(lamp.y - camY))
      }
      g.restore()
      for (const lamp of lamps) if (lamp.hung) drawLantern(g, Math.round(lamp.x - camX), Math.round(lamp.y - camY))
    }
    if (L.fireflies) {
      for (let i = 0; i < flies.length; i++) {
        const f = flies[i]!
        const glow = Math.sin(clock * 2 + f.p)
        if (glow < 0) continue
        const sx = Math.round(f.x + Math.sin(clock * 0.4 + f.p) * 14) % W
        const sy = Math.round(f.y + Math.cos(clock * 0.5 + f.p) * 9) % H
        g.fillStyle = glow > 0.7 ? '#f8ffa8' : '#c0e870'
        g.fillRect(sx, sy, 1, 1)
        if (glow > 0.9) {
          g.fillStyle = '#6c8838'
          g.fillRect(sx - 1, sy, 1, 1)
          g.fillRect(sx + 1, sy, 1, 1)
          g.fillRect(sx, sy - 1, 1, 1)
          g.fillRect(sx, sy + 1, 1, 1)
        }
      }
    }
  }

  /** A paper lantern hung from the arch's beam: a cord, a dark cap and a warm glowing body. */
  const drawLantern = (g: CanvasRenderingContext2D, x: number, y: number) => {
    g.fillStyle = '#2a1c10'
    g.fillRect(x, y - 8, 1, 4)
    g.fillRect(x - 2, y - 4, 5, 1)
    g.fillRect(x - 2, y + 3, 5, 1)
    g.fillStyle = '#f0a040'
    g.fillRect(x - 2, y - 3, 5, 6)
    g.fillStyle = '#ffe890'
    g.fillRect(x - 1, y - 2, 2, 4)
  }

  /** The "!" popping out over the partner's head. */
  const drawAlert = (g: CanvasRenderingContext2D, x: number, y: number) => {
    const k = Math.min(1, (clock - alertAt) / 0.12)
    const top = y - 46 - Math.round(4 * k)
    g.fillStyle = '#283040'
    g.fillRect(x - 3, top - 1, 6, 12)
    g.fillRect(x - 3, top + 12, 6, 6)
    g.fillStyle = '#ffffff'
    g.fillRect(x - 2, top, 4, 10)
    g.fillRect(x - 2, top + 13, 4, 4)
  }

  return {
    player,
    step,
    draw,
    alert,
    resume,
    nearBoard,
    setWanderers,
    /** The sneak toggle's state, and whether the partner is sneaking now. */
    setSneak: (on: boolean) => {
      sneakOn = on
    },
    sneaking: () => sneaking,
    /** Dev: who's in the open and how each feels, for `ps.safari('phase')`. */
    peek: () => residents.map((r) => ({ cam: `${lastCam.x},${lastCam.y}`, slot: r.slot, dex: r.dex, dir: r.dir, doubt: Math.round(r.doubt * 100) / 100, away: r.away > 0, hidden: r.hiddenFor > 0, mark: r.mark, x: Math.round(r.x), y: Math.round(r.y), px: Math.round(player.x), py: Math.round(player.y), loaded: loadedSprites(r.dex) !== null, dist: Math.round(Math.hypot(r.x - player.x, r.y - player.y)) })),
    /** Dev: sets the partner just behind the first wanderer (or in front of it, where it looks), facing it, and holds it still a while. */
    sneakUp: (front = false) => {
      const r = residents.find((x) => x.slot !== null && x.hiddenFor <= 0)
      if (!r) return
      const look = facing(r.dir)
      const side = front ? -1 : 1
      player.x = r.x - look.x * 26 * side
      player.y = r.y - look.y * 26 * side
      player.dir = dir8(look.x * side, look.y * side)
      r.pause = 6
      r.doubt = 0
      r.mark = null
    },
    /** The time of day the map is lit for. */
    setDaypart: (part: SafariDaypart) => {
      light = LIGHTS[part]
    },
    /** Puts the partner at a spot (a new session's start). */
    place: (x: number, y: number, dir: Dir8) => {
      player.x = x
      player.y = y
      player.dir = dir
    },
    release: () => {
      if (ground) {
        ground.width = 0
        ground = null
      }
      if (grass) grass.width = 0
      grass = null
    },
  }
}
