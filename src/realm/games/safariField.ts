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
import { GRASS_CELL, GRASS_VARIANTS, bakeGrass, bakeGround, waterTiles, type SafariTheme } from './safariArt'
import { moveWalker, tallTileAt, type Placed, type SafariWorld } from './safariWorld'

/**
 * The Zona Safári's map scene: the partner walks a preserve (`safariWorld.ts`),
 * the grass closing over its feet and parting as it passes, and every new tall
 * tile may set something off. When that happens is the client's to decide and
 * changes nothing: the API answers with the next encounter in line.
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

/** Art of a prop kind, by file; null until it loaded. */
const artOf = (habitat: SafariHabitat, kind: string): HTMLImageElement | null => image(kind === 'kiosk' || kind === 'board' ? `safari/${kind}` : kind === 'gate' ? 'realm/safari-gate' : `safari/${habitat}-${kind}`)

/** A resident glimpsed in the grass: where it stands and wanders, and whether it's bolting off. */
type Resident = { dex: number; x: number; y: number; homeX: number; homeY: number; dir: Dir8; walk: number; pause: number; away: number; hiddenFor: number }

/** Residents flee when the partner comes this close, and come back after a while. */
const RESIDENT_WARY = 54
const RESIDENT_BACK = 9

export type Field = ReturnType<typeof createField>

export const createField = (opts: { habitat: SafariHabitat; world: SafariWorld; theme: SafariTheme; dex: number; shiny: boolean; mapSeed: number; residents: readonly number[] }) => {
  const { habitat, world, theme, dex, shiny, mapSeed } = opts
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

  /** A few of the week's species out in the open: only a glimpse, they bolt before they can be reached. */
  const residents: Resident[] = opts.residents.map((resident, i) => {
    const tile = world.tallList[Math.floor((i + 0.5) * (world.tallList.length / opts.residents.length))]!
    const tx = tile % (MAP_W - 1)
    const ty = (tile - tx) / (MAP_W - 1)
    const homeX = tx * TILE + 8
    const homeY = ty * TILE + 8
    return { dex: resident, x: homeX, y: homeY, homeX, homeY, dir: 0, walk: 0, pause: 1 + i * 0.7, away: 0, hiddenFor: 0 }
  })
  for (const r of residents) void loadSpecies(r.dex).catch(() => {})

  /** Everything that stands, back to front; the walkers are merged in as it's drawn. */
  const standing: Placed[] = [...world.props].sort((a, b) => a.y - b.y)
  const statics = [
    { kind: 'kiosk', x: PLAZA.kiosk.x * TILE, y: PLAZA.kiosk.y * TILE },
    { kind: 'board', x: PLAZA.board.x * TILE, y: PLAZA.board.y * TILE },
    { kind: 'gate', x: PLAZA.gate.x * TILE, y: PLAZA.gate.y * TILE },
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

  const stepResidents = (dt: number) => {
    for (const r of residents) {
      if (r.hiddenFor > 0) {
        r.hiddenFor -= dt
        if (r.hiddenFor <= 0) {
          r.x = r.homeX
          r.y = r.homeY
          r.away = 0
        }
        continue
      }
      const dx = r.x - player.x
      const dy = r.y - player.y
      const dist = Math.hypot(dx, dy)
      if (r.away <= 0 && dist < RESIDENT_WARY) {
        r.away = 0.7
        r.dir = dir8(dx, dy)
      }
      if (r.away > 0) {
        const step = 120 * dt
        r.x += (dx / (dist || 1)) * step
        r.y += (dy / (dist || 1)) * step
        r.away -= dt
        if (r.away <= 0) r.hiddenFor = RESIDENT_BACK
        continue
      }
      if (r.pause > 0) {
        r.pause -= dt
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
      r.walk += dt
      if (r.walk > 1.4) {
        r.walk = 0
        r.pause = 1.5 + (r.dex % 5) * 0.4
      }
    }
  }

  /** Steps the map. `walking`: whether the player may move. True when the grass gave something away this step. */
  const step = (dt: number, input: GameInput, walking: boolean, cssScale: number): boolean => {
    clock += dt
    if (shake > 0) shake -= dt
    stepFx(parts, pops, dt)
    stepMotes(dt)
    stepResidents(dt)
    ensureBaked()
    player.moving = false
    if (!walking) {
      stick = null
      return false
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
    if (len < 0.05) return false
    if (len > 1) {
      mx /= len
      my /= len
    }
    player.dir = dir8(mx, my)
    player.moving = true
    moveWalker(world, player.x, player.y, mx * SPEED * dt, my * SPEED * dt, out)
    player.x = out.x
    player.y = out.y
    const tile = tallTileAt(world, player.x, player.y)
    if (tile === lastTile) return false
    lastTile = tile
    if (tile < 0) return false
    rustled[tile] = clock
    playSfx('rustle', 90)
    burst(parts, player.x, player.y - 8, [theme.tall[2], theme.tall[3], theme.tip], 3, 26, 110)
    if (grace > 0) grace -= 1
    return grace === 0 && Math.random() < CHANCE
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
  const coverFeet = (g: CanvasRenderingContext2D, x: number, y: number, camX: number, camY: number) => {
    if (!grass || tallTileAt(world, x, y) < 0) return
    const top = Math.round(y - camY - COVER)
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
    drawPokemon(g, sprites(dex, shiny), player.moving ? 'Walk' : 'Idle', player.dir, clock, px, py)
  }

  const drawRanger = (g: CanvasRenderingContext2D, camX: number, camY: number) => {
    const s = loadedSprites(RANGER_DEX)
    if (!s) return
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
    if (flip) {
      g.save()
      g.translate(sx + art.width, sy)
      g.scale(-1, 1)
      g.drawImage(art, 0, 0)
      g.restore()
    } else g.drawImage(art, sx, sy)
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

    drawGrass(g, camX, camY, W, H)

    // Everything that stands, back to front, the walkers merged in.
    let playerDone = false
    let rangerDone = false
    let staticI = 0
    const py = player.y
    const staticsUpTo = (limit: number) => {
      while (staticI < statics.length && statics[staticI]!.y <= limit) {
        const it = statics[staticI]!
        drawStanding(g, it.kind, it.x, it.y, camX, camY, W, H, false)
        staticI++
      }
    }
    for (let s = 0; s < standing.length; s++) {
      const p = standing[s]!
      staticsUpTo(p.y)
      if (!rangerDone && ranger.y <= p.y) {
        drawRanger(g, camX, camY)
        rangerDone = true
      }
      if (!playerDone && py <= p.y) {
        drawWalker(g, player.x, py, camX, camY)
        playerDone = true
      }
      drawStanding(g, p.kind, p.x, p.y, camX, camY, W, H, (s & 1) === 1)
    }
    staticsUpTo(Infinity)
    if (!rangerDone) drawRanger(g, camX, camY)
    if (!playerDone) drawWalker(g, player.x, py, camX, camY)

    for (const r of residents) {
      if (r.hiddenFor > 0) continue
      const resident = loadedSprites(r.dex)
      if (!resident) continue
      const sx = Math.round(r.x - camX)
      const sy = Math.round(r.y - camY)
      if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 50) continue
      drawPokemon(g, resident, r.pause > 0 && r.away <= 0 ? 'Idle' : 'Walk', r.dir, clock * (r.away > 0 ? 2.5 : 1), sx, sy, { alpha: r.away > 0 ? Math.max(0.3, r.away / 0.7) : 1 })
      coverFeet(g, r.x, r.y, camX, camY)
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

    if (alertAt >= 0) drawAlert(g, Math.round(player.x - camX), Math.round(player.y - camY))
    if (stick) drawJoystick(g, stick, cssScale)
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
