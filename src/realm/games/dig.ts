import { DIG_FOSSIL_FAMILIES, DIG_HALVES, DIG_TREASURES, GALAR_PAIRS, type DigGroup, type DigTreasureId, type FossilFamily, type GalarHalf } from '../../data/digTreasures'
import { HATCHLINGS, PLAYABLE, type PlayableId } from '../../data/hatchlings'
import { BAG_ITEMS, EVO_ITEMS } from '../../data/shop'
import { playCry, playSfx } from '../../engine/audio'
import { formatPokeDollars, t } from '../../i18n'
import type { DigEnd, DigReward, DigState, DigWallView } from '../../net/realmApi'
import { cryUrl, drawPokemon, fitSprites, loadSpecies, portraitUrl, sprites } from '../../render/sprites'
import { h, rich } from '../../ui/dom'
import { loadSave } from '../../ui/save'
import { isFailure, type Failure } from '../api'
import { fetchDig, hitDig, landDigGifts, startWall, stopDig } from '../digApi'
import { pieceName } from '../furniture'
import { arcadeSize, burst, drawCentered, drawFx, drawText, image, plate, shakeOffset, stepFx, textWidth, type Particle, type Popup } from './arcadeKit'
import { DIG, DIG_VEINS, digGroupOdds, digPowers, digVein, shapeOf, toolArea, toolCrack, wallPrice, type DigTool } from './dig.rules'
import type { GameInput, GameRun, SoloCtx, SoloGame } from './frame'
import { callout, gameSheet, sheetTitle, speech } from './gameSheet'

/**
 * The Escavação (`MINIGAMES.dig`): one wall at a time, broken open cell by
 * cell before its crack meter fills and the wall comes down on what wasn't
 * finished. The API builds the wall and answers every hit (`digApi.ts`,
 * `dig.rules.ts`); this only draws what it's told, a step ahead of the answer
 * so a hit always feels instant. Numbers and art are drawn on the canvas; every
 * word lives in the kit's sheet over it (`gameSheet.ts`), since the in-world
 * font can't write them. The entry docks beside or under the tunnel, which is
 * drawn in the part of the canvas the sheet leaves free.
 *
 * Touch: tap a tool, then tap the wall (a finger shows where it will land and
 * lets go to hit). Keys: 1 and 2 pick a tool, arrows move the cursor, Space hits.
 */

const SIZES = { tall: { w: 176, h: 256 }, wide: { w: 300, h: 160 } } as const

/** Seconds each beat of the wall's end lasts. */
const TIMES = { collapse: 2.1, stopped: 0.9, reveal: 1.6, meltan: 3.2, fossilGlow: 1.3, fossil: 3.8 } as const

/** Meltan (the legend paths' Mystery Box): its dex, and when in the box's reveal it climbs out. */
const MELTAN_DEX = 808
const MELTAN_PEEK = 0.45

type Rect = { x: number; y: number; w: number; h: number }

type Layout = { grid: { x: number; y: number }; meter: Rect; tray: Rect; pick: Rect; hammer: Rect; stop: Rect }

const layoutOf = (size: { w: number; h: number }): Layout =>
  size.h > size.w
    ? { grid: { x: 5, y: 22 }, meter: { x: 5, y: 5, w: 166, h: 13 }, tray: { x: 5, y: 146, w: 166, h: 26 }, pick: { x: 5, y: 176, w: 62, h: 74 }, hammer: { x: 70, y: 176, w: 62, h: 74 }, stop: { x: 136, y: 176, w: 35, h: 74 } }
    : { grid: { x: 6, y: 21 }, meter: { x: 6, y: 5, w: 165, h: 13 }, tray: { x: 177, y: 72, w: 116, h: 26 }, pick: { x: 177, y: 5, w: 56, h: 63 }, hammer: { x: 237, y: 5, w: 56, h: 63 }, stop: { x: 177, y: 102, w: 116, h: 53 } }

const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h

const GRID_W = DIG.cols * DIG.cell
const GRID_H = DIG.rows * DIG.cell

/** The dust of each layer's rock, top to bottom. */
const DUST: Record<number, readonly string[]> = {
  0: ['#a89070', '#c8b090', '#685038'],
  1: ['#a06838', '#c08848', '#704020'],
  2: ['#9098a0', '#b8c0c8', '#606870'],
  3: ['#5868a0', '#7888b8', '#384060'],
}

const GOLD_DUST = ['#f8d868', '#fff0b0', '#c89830'] as const

const texPath = (name: string) => `realm/dig/${name}`

/** Which texture a layer shows: on a golden wall the top layer is the gold-veined sandstone. */
const texOf = (depth: number, golden: boolean) => (depth <= 1 ? (golden ? 'gold' : 'dirt') : depth === 2 ? 'rock' : 'hard')

/** A treasure's art laid out on its cells' block at its scale; cached once the image is in. */
const blocks = new Map<DigTreasureId, HTMLCanvasElement>()
const blockOf = (id: DigTreasureId): HTMLCanvasElement | null => {
  const hit = blocks.get(id)
  if (hit) return hit
  const def = DIG_TREASURES[id]
  const img = image(def.art)
  if (!img) return null
  const shape = shapeOf(id)
  const c = document.createElement('canvas')
  c.width = shape.cols * DIG.cell
  c.height = shape.rows * DIG.cell
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.drawImage(img, shape.ox, shape.oy, shape.w, shape.h)
  blocks.set(id, c)
  return c
}

/** A treasure's name: official item names stay in English, furniture is the player's language. */
const treasureName = (id: DigTreasureId): string => {
  const def = DIG_TREASURES[id]
  const prize = def.prize
  if (prize.kind === 'furniture') return pieceName(prize.piece)
  if (prize.kind === 'bag') return BAG_ITEMS[prize.item].name
  if (prize.kind === 'stone') return EVO_ITEMS[prize.item].name
  return def.name
}

const SIZE = () => arcadeSize(SIZES.tall, SIZES.wide)

let shown: { w: number; h: number } = SIZE()

/** A soft-edged crack piece: pixel steps away from a point. */
type Seg = { x0: number; y0: number; x1: number; y1: number }

type Phase = 'load' | 'ready' | 'busy' | 'dig' | 'confirm' | 'hold' | 'reveal' | 'fossil' | 'summary'

const start = (ctx: SoloCtx): GameRun => {
  const size = shown
  const layout = layoutOf(size)
  const { grid } = layout
  const m = () => t().minigames.dig
  // The entry keeps the tunnel's arch in view: 140 columns beside it, 120 rows above it.
  const sheet = gameSheet(ctx.stage, size, { x: 140, y: 120 })

  let phase: Phase = 'load'
  let phaseT = 0
  let clock = 0
  let disposed = false
  let view: DigState | null = null
  let wall: DigWallView | null = null
  let left: number[] = []
  let crack = 0
  let seq = 0
  let tool: DigTool = 'pick'
  /** Hits this client made but the API hasn't answered yet (the visible wall is a step ahead of them). */
  const queue: { seq: number; tool: DigTool; cell: number }[] = []
  let sending = false
  let end: DigEnd | null = null
  const tiles = new Map<number, { t: number; id: DigTreasureId; col: number; row: number }>()
  const seen = new Set<number>()
  const freed: number[] = []
  /** Treasures known by id so far (for the tray), by index in the wall. */
  const found = new Map<number, DigTreasureId>()
  let cursor: number | null = null
  let shake = 0
  let shakePower = 1
  let flash = 0
  const parts: Particle[] = []
  const pops: Popup[] = []
  const glints: { x: number; y: number; age: number }[] = []
  /** Cells that just took a hit: how long ago, for the little jolt. */
  const jolts = new Map<number, number>()
  const swings: { tool: DigTool; x: number; y: number; age: number }[] = []
  /** How long the golden wall's headline stays up (s). */
  let goldenBanner = 0
  let cracks: Seg[] = []
  let crackDirty = true
  let wallDirty = true
  let revealAt = 0
  let fossilOn: FossilFamily | null = null
  let fresh: Set<number> = new Set()

  const wallLayer = document.createElement('canvas')
  wallLayer.width = GRID_W
  wallLayer.height = GRID_H
  const crackLayer = document.createElement('canvas')
  crackLayer.width = GRID_W
  crackLayer.height = GRID_H

  const go = (next: Phase) => {
    phase = next
    phaseT = 0
  }

  const say = sheet.show
  const quiet = () => sheet.hide()

  const trouble = (error: string) => {
    go('ready')
    const text = error === 'cap' ? m().cap : error === 'funds' ? m().funds : error === 'profile' ? m().profile : m().failed
    say('card', [h('p', { class: 'mg-lead' }, text)], [{ label: m().retry, run: load, primary: true }])
  }

  const art = (id: DigTreasureId) => `${import.meta.env.BASE_URL}assets/${DIG_TREASURES[id].art}.png`

  /** Why a price can't be paid now, or null: the day's cap or too few ₽. */
  const blocked = (price: number | null, wallOpen: boolean) => {
    if (wallOpen) return null
    if (price === null) return m().cap
    if (price > loadSave().wallet) return m().funds
    return null
  }

  const groupIcon: Record<DigGroup, DigTreasureId> = { coins: 'nugget', bag: 'luckyEgg', stone: 'fireStone', furniture: 'digCrystals', fossil: 'skullFossil', legend: 'mysteryBox' }

  /** What the walking partner does for the dig, from its first form's types (the API rechecks it). */
  const partnerLine = () => {
    if (!Object.hasOwn(PLAYABLE, ctx.partner)) return false
    const form = PLAYABLE[ctx.partner as PlayableId]
    const powers = digPowers(form.line[0].types)
    const words = [powers.bigHammer && m().powers.bigHammer, powers.hold > 0 && m().powers.hold, powers.reveal && m().powers.reveal, powers.deepPick && m().powers.deepPick].filter((w): w is string => typeof w === 'string')
    return h('li', { class: 'dig-partner' }, h('img', { src: portraitUrl(form.line[0].dex), alt: '', width: 28, height: 28 }), h('span', {}, words.length > 0 ? m().partnerLine(form.name, words.join(', ')) : m().partnerNone(form.name)))
  }

  /** The entry: the keeper's word, the week's vein, the partner's help, the fossil guarantee and the wall to buy; the odds a tap away. */
  const oddsPanel = () => {
    if (!view) return
    const v = view
    const week = digVein(v.week)
    const price = wallPrice(v.used)
    const open = v.open !== null
    const stop = blocked(price, open)
    const owned = DIG_FAMILIES - v.lacking.length
    const due = v.lacking.length > 0 && v.dry >= DIG.fossilGuarantee
    const label = open ? m().resume : price === 0 ? m().free : m().paid(formatPokeDollars(price ?? DIG.price))
    const fossil = v.lacking.length === 0 ? m().fossilsDone : due ? m().fossilDue : m().fossilProgress(v.dry, DIG.fossilGuarantee, owned, DIG_FAMILIES)
    say(
      'dock',
      [
        speech(portraitUrl(530), rich(open ? m().keeperOpen : m().keeper)),
        sheetTitle(m().veins[week.vein], m().veinKicker),
        h('p', { class: 'dig-vein' }, rich(m().veinNote[week.vein])),
        h('button', { class: 'btn mg-link', type: 'button', onclick: () => (playSfx('select'), oddsSheet()) }, h('img', { src: art(groupIcon[DIG_VEINS[week.vein].group]), alt: '', width: 24, height: 24 }), m().oddsOpen),
        h(
          'ul',
          { class: 'mg-facts' },
          partnerLine(),
          h('li', { class: due ? 'hot' : '' }, h('img', { src: art('skullFossil'), alt: '', width: 28, height: 28 }), h('span', {}, fossil)),
          labLine(v.held),
        ),
        h('button', { class: 'btn mg-link', type: 'button', onclick: () => (playSfx('select'), labSheet()) }, h('img', { src: art('fossilizedBird'), alt: '', width: 24, height: 24 }), m().lab.open),
        stop ? callout(stop) : false,
      ],
      [
        ...(stop ? [] : [{ label, note: open ? m().resumeNote : m().today(v.used, DIG.dailyCap), run: startWallNow, primary: true }]),
      ],
    )
  }

  /** The Galar halves waiting in the lab, as a fact on the entry (none: nothing to tell). */
  const labLine = (held: readonly GalarHalf[]) =>
    held.length > 0 && h('li', { class: 'dig-lab-line' }, h('img', { src: art(DIG_HALVES[held[0]!]), alt: '', width: 28, height: 28 }), h('span', {}, m().lab.waiting(held.map((half) => treasureName(DIG_HALVES[half])).join(', '))))

  /**
   * The fossil lab: Galar's halves (the ones waiting bright, the rest dim),
   * then each pair with the Pokémon it restores, and why Fish and Dino don't fit.
   */
  const labSheet = () => {
    if (!view) return
    const held = view.held
    const lacking = view.lacking
    const half = (which: GalarHalf) =>
      h('li', { class: held.includes(which) ? 'held' : '' }, h('img', { src: art(DIG_HALVES[which]), alt: '', width: 40, height: 40 }), h('span', {}, treasureName(DIG_HALVES[which])))
    say(
      'card',
      [
        sheetTitle(m().lab.title, m().lab.kicker),
        h('p', { class: 'mg-note' }, rich(m().lab.note)),
        h('div', { class: 'dig-lab-halves' }, h('b', {}, m().lab.tops), h('ul', {}, half('bird'), half('fish')), h('b', {}, m().lab.bottoms), h('ul', {}, half('drake'), half('dino'))),
        h(
          'ul',
          { class: 'dig-lab-pairs' },
          ...GALAR_PAIRS.map((p) => {
            const own = !lacking.includes(p.family)
            return h(
              'li',
              { class: own ? 'owned' : '' },
              h('img', { src: art(DIG_HALVES[p.top]), alt: treasureName(DIG_HALVES[p.top]), width: 28, height: 28 }),
              h('span', { class: 'dig-lab-plus' }, '+'),
              h('img', { src: art(DIG_HALVES[p.bottom]), alt: treasureName(DIG_HALVES[p.bottom]), width: 28, height: 28 }),
              h('span', { class: 'dig-lab-plus' }, '='),
              h('img', { class: 'dig-lab-mon', src: portraitUrl(HATCHLINGS[p.family].line[0].dex), alt: '', width: 32, height: 32 }),
              h('span', {}, HATCHLINGS[p.family].name, own ? h('small', {}, ` ${m().lab.owned}`) : false),
            )
          }),
        ),
        h('p', { class: 'mg-note' }, m().lab.arctovish),
        held.length === 0 ? h('p', { class: 'mg-note' }, m().lab.empty) : false,
      ],
      [],
      { label: m().back, run: oddsPanel },
    )
  }

  /** The halves a stored one still needs: the other side of each lacked pair it's in. */
  const halfNeeds = (which: GalarHalf) => {
    const lacking = view?.lacking ?? []
    const names = GALAR_PAIRS.flatMap((p) => (lacking.includes(p.family) && (p.top === which || p.bottom === which) ? [treasureName(DIG_HALVES[p.top === which ? p.bottom : p.top])] : []))
    return names.length > 0 ? names.reduce((a, b) => m().or(a, b)) : ''
  }

  /** The family a prize brings to life on screen: a whole fossil's, or the one a half completed. */
  const familyOf = (r: DigReward): FossilFamily | null => (r.prize.kind === 'fossil' ? r.prize.family : r.prize.kind === 'half' ? (r.restored ?? null) : null)

  /** The week's odds, as the sheet of the vein: a tile a group, the golden wall's chance, and what the numbers mean. */
  const oddsSheet = () => {
    if (!view) return
    const week = digVein(view.week)
    say(
      'card',
      [
        sheetTitle(m().veins[week.vein], m().veinKicker),
        h(
          'ul',
          { class: 'dig-odds' },
          ...digGroupOdds(view.week).map((g) =>
            h('li', { class: g.group === DIG_VEINS[week.vein].group ? 'boost' : '' }, h('img', { src: art(groupIcon[g.group]), alt: '', width: 32, height: 32 }), h('b', {}, m().pct(g.share)), h('span', {}, m().groups[g.group])),
          ),
          h('li', { class: 'golden' }, h('img', { src: art('nugget'), alt: '', width: 32, height: 32 }), h('b', {}, m().oneIn(Math.round(1 / DIG.golden.chance))), h('span', {}, m().golden)),
        ),
        h('p', { class: 'mg-note' }, m().oddsNote),
      ],
      [],
      { label: m().back, run: oddsPanel },
    )
  }

  const load = async () => {
    go('load')
    quiet()
    const got = await fetchDig()
    if (disposed) return
    if (isFailure(got)) return trouble(got.error)
    view = got
    wall = null
    oddsPanel()
    go('ready')
  }

  /** Paints the rock and treasures that didn't change into the wall layer (see `wallDirty`). */
  const paintWall = () => {
    if (!wall) return
    const g = wallLayer.getContext('2d')!
    g.imageSmoothingEnabled = false
    g.clearRect(0, 0, GRID_W, GRID_H)
    const golden = wall.golden
    const cell = DIG.cell
    /** An image still on its way: the wall is painted again next frame until everything is in. */
    let missing = false
    for (let r = 0; r < DIG.rows; r++) {
      for (let c = 0; c < DIG.cols; c++) {
        const i = r * DIG.cols + c
        const x = c * cell
        const y = r * cell
        const depth = left[i] ?? 0
        if (depth <= 0) {
          g.fillStyle = '#1c1612'
          g.fillRect(x, y, cell, cell)
          g.fillStyle = 'rgba(70,52,38,0.5)'
          if ((c * 7 + r * 13) % 5 === 0) g.fillRect(x + 4, y + 9, 2, 1)
          if ((c * 3 + r * 5) % 7 === 0) g.fillRect(x + 9, y + 4, 1, 2)
          const tile = tiles.get(i)
          if (tile) {
            const b = blockOf(tile.id)
            if (b) g.drawImage(b, tile.col * cell, tile.row * cell, cell, cell, x, y, cell, cell)
            else missing = true
          }
          continue
        }
        const tex = image(texPath(texOf(depth, golden)))
        if (tex) g.drawImage(tex, x, y, cell, cell, x, y, cell, cell)
        else {
          missing = true
          g.fillStyle = depth === 1 ? '#8a5a30' : depth === 2 ? '#808890' : '#384060'
          g.fillRect(x, y, cell, cell)
        }
        if (golden) {
          g.fillStyle = 'rgba(255,196,64,0.3)'
          g.fillRect(x, y, cell, cell)
        }
        // A bevel on every stone, so the grid reads even inside one patch of rock.
        g.fillStyle = 'rgba(255,255,255,0.1)'
        g.fillRect(x, y, cell, 1)
        g.fillRect(x, y, 1, cell)
        g.fillStyle = 'rgba(0,0,0,0.22)'
        g.fillRect(x, y + cell - 1, cell, 1)
        g.fillRect(x + cell - 1, y, 1, cell)
        // A cell's edge shows the layers it's cut through: a dark lip on the side a deeper neighbor rises.
        const lip = (dx: number, dy: number, rect: readonly [number, number, number, number]) => {
          const nc = c + dx
          const nr = r + dy
          if (nc < 0 || nr < 0 || nc >= DIG.cols || nr >= DIG.rows) return
          const near = left[nr * DIG.cols + nc] ?? 0
          if (near < depth) {
            g.fillStyle = 'rgba(0,0,0,0.42)'
            g.fillRect(x + rect[0], y + rect[1], rect[2], rect[3])
          }
        }
        lip(1, 0, [cell - 1, 0, 1, cell])
        lip(0, 1, [0, cell - 1, cell, 1])
        lip(-1, 0, [0, 0, 1, cell])
        lip(0, -1, [0, 0, cell, 1])
      }
    }
    wallDirty = missing
  }

  /** Draws new crack segments onto the crack layer. */
  const paintCracks = () => {
    if (!crackDirty) return
    const g = crackLayer.getContext('2d')!
    for (const s of cracks) {
      const dx = s.x1 - s.x0
      const dy = s.y1 - s.y0
      const steps = Math.max(Math.abs(dx), Math.abs(dy), 1)
      for (let k = 0; k <= steps; k++) {
        const x = Math.round(s.x0 + (dx * k) / steps)
        const y = Math.round(s.y0 + (dy * k) / steps)
        g.fillStyle = '#100c08'
        g.fillRect(x, y, 1, 1)
        g.fillStyle = 'rgba(232,212,180,0.55)'
        g.fillRect(x + 1, y, 1, 1)
      }
    }
    cracks = []
    crackDirty = false
  }

  /** New crack lines from a hit: their number and length grow with the tool and how close the wall is. */
  const addCracks = (cx: number, cy: number, tool0: DigTool, wallCap: number) => {
    const share = Math.min(1, crack / wallCap)
    const lines = (tool0 === 'hammer' ? 2 : 1) + (share > 0.6 ? 1 : 0)
    for (let n = 0; n < lines; n++) {
      let a = Math.random() * Math.PI * 2
      let x = cx
      let y = cy
      const length = (tool0 === 'hammer' ? 10 : 6) + share * 16
      const steps = Math.ceil(length / 5)
      for (let k = 0; k < steps; k++) {
        a += (Math.random() - 0.5) * 1
        const nx = x + Math.cos(a) * 5
        const ny = y + Math.sin(a) * 5
        cracks.push({ x0: x, y0: y, x1: nx, y1: ny })
        x = nx
        y = ny
      }
    }
    crackDirty = true
  }

  const centerOf = (i: number) => ({ x: grid.x + (i % DIG.cols) * DIG.cell + DIG.cell / 2, y: grid.y + Math.floor(i / DIG.cols) * DIG.cell + DIG.cell / 2 })

  /** Applies an answer's cells: tiles for what's dug through, the treasures it finished. */
  const absorb = (cells: readonly DigWallView['tiles'][number][], ids: readonly number[]) => {
    let changed = false
    for (const c of cells) {
      left[c.i] = c.left
      if (c.tile) {
        tiles.set(c.i, c.tile)
        found.set(c.tile.t, c.tile.id)
        if (!seen.has(c.tile.t)) {
          seen.add(c.tile.t)
          const at = centerOf(c.i)
          glints.push({ x: at.x, y: at.y, age: 0 })
          playSfx('digGlint')
        }
      }
      changed = true
    }
    for (const id of ids) {
      if (freed.includes(id)) continue
      freed.push(id)
      const tid = found.get(id)
      if (tid) {
        playSfx(DIG_TREASURES[tid].group === 'fossil' || DIG_TREASURES[tid].group === 'stone' ? 'shiny' : 'pickup')
        burst(parts, layout.tray.x + 12 + (freed.length - 1) * 22, layout.tray.y + 13, ['#f8d030', '#ffffff', '#78e080'], 10, 40, 0)
      }
    }
    if (changed) wallDirty = true
  }

  const endWall = (e: DigEnd) => {
    end = e
    // Prizes land on the save now; a fossil plays its scene only if it truly is new to this save.
    const landed = landDigGifts(e.gifts)
    const repeats = new Set(landed.flatMap((l) => (l.gift.content.kind === 'family' && l.duplicate ? [l.gift.content.family] : [])))
    fresh = new Set(
      e.kept.flatMap((r, i) => {
        const family = familyOf(r)
        return family !== null && !r.repeat && !repeats.has(family) ? [i] : []
      }),
    )
    if (e.kept.some((r) => r.id === 'digFossilDisplay' || r.prize.kind === 'stone' || r.prize.kind === 'fossil' || r.restored !== undefined)) ctx.brag('fossilOrStone')
    go('hold')
    quiet()
    if (e.outcome === 'collapse') {
      flash = 0.18
      shake = TIMES.collapse
      shakePower = 7
      playSfx('digCollapse')
      for (let k = 0; k < 40; k++) spawnRubble()
    } else playSfx('digFree')
    wallDirty = true
  }

  const spawnRubble = () => {
    const x = grid.x + Math.random() * GRID_W
    const palette = wall?.golden ? GOLD_DUST : DUST[1 + Math.floor(Math.random() * 3)]!
    parts.push({ x, y: grid.y - 4 - Math.random() * 30, vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 80, life: 1 + Math.random() * 0.8, age: 0, color: palette[Math.floor(Math.random() * palette.length)]!, size: Math.random() < 0.5 ? 3 : 2, g: 260 })
  }

  /** Sends queued hits, one at a time, in order; a network failure retries the same number (the API answers the repeat with the stored result). */
  const pump = async () => {
    if (sending || !wall) return
    sending = true
    let tries = 0
    while (queue.length > 0 && !disposed) {
      const hit = queue[0]!
      const got: Awaited<ReturnType<typeof hitDig>> = await hitDig(wall, hit.seq, hit.tool, hit.cell)
      if (disposed) return
      if (isFailure(got)) {
        if (got.error === 'offline' && tries < 4) {
          tries++
          await new Promise((res) => setTimeout(res, 800))
          continue
        }
        // The wall didn't take that hit: reload it from the API, so what's drawn is the truth.
        sending = false
        return reconcile(got)
      }
      tries = 0
      queue.shift()
      absorb(got.cells, got.freed)
      // With nothing else in flight the API's crack is the truth, whatever this device predicted.
      if (queue.length === 0) crack = got.crack
      if (got.end) {
        sending = false
        return endWall(got.end)
      }
    }
    sending = false
  }

  const reconcile = async (failure: Failure) => {
    queue.length = 0
    if (failure.error === 'profile' || failure.error === 'banned') return trouble(failure.error)
    const fresh0 = await fetchDig()
    if (disposed) return
    if (isFailure(fresh0)) return trouble(fresh0.error)
    view = fresh0
    if (fresh0.open && wall && fresh0.open.id === wall.id) {
      restore(fresh0.open)
      go('dig')
      quiet()
    } else {
      wall = null
      oddsPanel()
      go('ready')
    }
  }

  const reset = () => {
    tiles.clear()
    seen.clear()
    found.clear()
    freed.length = 0
    queue.length = 0
    end = null
    shake = 0
    flash = 0
    wallDirty = true
    crackDirty = false
    cracks = []
    crackLayer.getContext('2d')!.clearRect(0, 0, GRID_W, GRID_H)
  }

  /** Puts a wall as the API has it on screen (a new one or one left open). */
  const restore = (w: DigWallView) => {
    wall = w
    reset()
    left = [...w.left]
    crack = w.crack
    seq = w.seq
    for (const c of w.tiles) {
      if (c.tile) {
        tiles.set(c.i, c.tile)
        found.set(c.tile.t, c.tile.id)
        seen.add(c.tile.t)
      }
    }
    freed.push(...w.freed)
    if (crack > 0) {
      const cuts = Math.round(crack / 2)
      for (let n = 0; n < cuts; n++) addCracks(Math.random() * GRID_W, Math.random() * GRID_H, Math.random() < 0.3 ? 'hammer' : 'pick', w.cap)
    }
  }

  const startWallNow = async () => {
    if (!view) return
    go('busy')
    quiet()
    const got = await startWall(view.used, ctx.partner, view.open !== null)
    if (disposed) return
    if (isFailure(got)) return trouble(got.error)
    view = { ...view, used: got.used, open: got.wall }
    restore(got.wall)
    playSfx('coin')
    go('dig')
    if (got.wall.golden) {
      playSfx('legendary')
      ctx.brag('golden')
      flash = 0.22
      goldenBanner = 1.5
      say('banner', [h('h3', { class: 'mg-banner-title gold' }, m().goldenStart)])
    }
  }

  /** The local step of a hit (sent to the API right after), or nothing if it would do nothing. */
  const swing = (cell: number) => {
    if (!wall || phase !== 'dig' || crack >= wall.cap) return
    const powers = wall.powers
    const area = toolArea(tool, cell, powers)
    if (!area.some((i) => (left[i] ?? 0) > 0)) return
    const bite = tool === 'pick' && powers.deepPick ? 2 : 1
    for (const i of area) {
      if ((left[i] ?? 0) <= 0) continue
      const before = left[i]!
      left[i] = Math.max(0, before - bite)
      jolts.set(i, 0)
      const c = centerOf(i)
      const palette = wall.golden && before === 1 ? GOLD_DUST : DUST[before] ?? DUST[0]!
      burst(parts, c.x, c.y, palette, tool === 'hammer' ? 5 : 9, 50 + before * 12, 200)
    }
    wallDirty = true
    crack = Math.min(wall.cap, crack + toolCrack(tool, powers))
    const center = centerOf(cell)
    addCracks(center.x - grid.x, center.y - grid.y, tool, wall.cap)
    if (tool === 'hammer') {
      shake = 0.22
      shakePower = 3.5 + (powers.bigHammer ? 1.5 : 0)
      burst(parts, center.x, center.y, DUST[0]!, 18, 90, 120)
      playSfx('digHammer')
    } else {
      shake = 0.12
      shakePower = 1.5
      playSfx('digPick')
    }
    swings.push({ tool, x: center.x, y: center.y, age: 0 })
    seq += 1
    queue.push({ seq, tool, cell })
    if (crack / wall.cap > 0.75) playSfx('digRumble', 300)
    void pump()
  }

  const cellAt = (px: number, py: number): number | null => {
    const c = Math.floor((px - grid.x) / DIG.cell)
    const r = Math.floor((py - grid.y) / DIG.cell)
    return c >= 0 && r >= 0 && c < DIG.cols && r < DIG.rows ? r * DIG.cols + c : null
  }

  const stopAsk = () => {
    if (!wall) return
    const safe = freed.length
    go('confirm')
    say('card', [sheetTitle(m().stopTitle), h('p', { class: 'mg-lead' }, m().stopNote(safe))], [{ label: m().stopYes, run: stopNow }, { label: m().stopNo, run: resumeDig, primary: true }])
  }

  const resumeDig = () => {
    quiet()
    go('dig')
  }

  const stopNow = async () => {
    if (!wall) return
    quiet()
    go('busy')
    while (queue.length > 0 && !disposed) await new Promise((res) => setTimeout(res, 120))
    if (disposed) return
    const got = await stopDig(wall)
    if (disposed) return
    if (isFailure(got)) return trouble(got.error)
    endWall(got)
  }

  const startReveal = () => {
    revealAt = 0
    if (!end || end.kept.length === 0) return showSummary()
    go('reveal')
    announce()
  }

  /** What the banner says under a prize's name. */
  const rewardNote = (r: DigReward) => {
    if (r.repeat) return m().repeat(formatPokeDollars(r.coins))
    if (r.coins > 0) return `+${formatPokeDollars(r.coins)}`
    const prize = r.prize
    if (prize.kind === 'half') {
      const pair = GALAR_PAIRS.find((p) => p.family === r.restored)
      if (pair) return m().halfRestored(treasureName(DIG_HALVES[pair.top === prize.half ? pair.bottom : pair.top]))
      return m().halfStored(halfNeeds(prize.half))
    }
    return prize.kind === 'furniture' ? m().furnitureNote : prize.kind === 'bag' ? m().bagNote : prize.kind === 'stone' ? m().stoneNote : prize.kind === 'legend' ? t().paths.meltan.found : m().fossilNote
  }

  const announce = () => {
    if (!end) return
    const r = end.kept[revealAt]
    if (!r) return showSummary()
    const def = DIG_TREASURES[r.id]
    say(
      'banner',
      [
        h('h3', { class: 'mg-banner-title' }, treasureName(r.id)),
        h('p', {}, rewardNote(r)),
      ],
    )
    playSfx(r.prize.kind === 'coins' ? 'coin' : r.prize.kind === 'fossil' || r.restored !== undefined ? 'shiny' : r.prize.kind === 'legend' && !r.repeat ? 'legendary' : def.group === 'stone' ? 'evolve' : def.group === 'furniture' ? 'unlock' : 'item')
    if (r.prize.kind === 'legend' && !r.repeat) {
      playCry(cryUrl(MELTAN_DEX), 0.6)
      void loadSpecies(MELTAN_DEX).catch(() => {})
    }
  }

  /** Whether the prize on show is Meltan's Mystery Box opened for the first time: Meltan climbs out of it, and the reveal holds longer. */
  const meltanOut = () => {
    const r = end?.kept[revealAt]
    return r !== undefined && r.prize.kind === 'legend' && !r.repeat
  }

  const nextReveal = () => {
    if (!end) return
    const r = end.kept[revealAt]
    const family = r ? familyOf(r) : null
    if (family !== null && fresh.has(revealAt)) {
      fossilOn = family
      go('fossil')
      quiet()
      void loadSpecies(HATCHLINGS[family].line[0].dex).catch(() => {})
      return
    }
    revealAt++
    if (!end.kept[revealAt]) return showSummary()
    phaseT = 0
    announce()
  }

  const fossilDone = () => {
    if (!end) return
    fossilOn = null
    revealAt++
    if (!end.kept[revealAt]) return showSummary()
    go('reveal')
    announce()
  }

  const showSummary = async () => {
    if (!end) return
    const e = end
    go('summary')
    // The wall's over: a fresh look at the day's walls for the next pick.
    const v = await fetchDig()
    if (disposed) return
    if (!isFailure(v)) view = v
    const coins = e.kept.reduce((sum, r) => sum + r.coins, 0)
    const stopReason = view ? blocked(wallPrice(view.used), false) : null
    const price = view ? wallPrice(view.used) : null
    const headline = e.outcome === 'collapse' ? (e.kept.length > 0 ? m().collapsedKept : m().collapsedNothing) : e.kept.length > 0 ? m().leftWith : m().leftNothing
    say(
      'card',
      [
        sheetTitle(headline),
        e.kept.length > 0 ? h('ul', { class: 'dig-loot' }, ...e.kept.map((r) => h('li', {}, h('img', { src: art(r.id), alt: '', width: 32, height: 32 }), h('span', {}, r.restored ? `${treasureName(r.id)} → ${HATCHLINGS[r.restored].name}` : treasureName(r.id))))) : false,
        coins > 0 ? h('p', { class: 'dig-coins' }, m().coinsTotal(formatPokeDollars(coins))) : false,
        e.buried.length > 0 ? h('div', { class: 'dig-buried' }, h('span', {}, m().buried), h('span', {}, ...e.buried.map((b) => h('img', { src: art(b.id), alt: treasureName(b.id), title: treasureName(b.id), width: 24, height: 24 })))) : false,
        stopReason ? callout(stopReason) : false,
      ],
      [
        ...(stopReason ? [] : [{ label: price === 0 ? m().free : m().paid(formatPokeDollars(price ?? DIG.price)), note: m().today(view?.used ?? 0, DIG.dailyCap), run: () => oddsAgain(), primary: true }]),
        { label: m().close, run: closeWall },
      ],
    )
  }

  const oddsAgain = () => {
    wall = null
    oddsPanel()
    go('ready')
  }

  const closeWall = () => {
    wall = null
    oddsPanel()
    go('ready')
  }

  const step = (dt: number, input: GameInput) => {
    clock += dt
    phaseT += dt
    if (shake > 0) shake = Math.max(0, shake - dt)
    if (flash > 0) flash = Math.max(0, flash - dt)
    stepFx(parts, pops, dt)
    for (const [i, age] of jolts) age > 0.18 ? jolts.delete(i) : jolts.set(i, age + dt)
    for (let k = swings.length - 1; k >= 0; k--) {
      const s = swings[k]!
      s.age += dt
      if (s.age > 0.18) swings.splice(k, 1)
    }
    for (let k = glints.length - 1; k >= 0; k--) {
      const s = glints[k]!
      s.age += dt
      if (s.age > 0.9) glints.splice(k, 1)
    }

    const px = input.pointer.x
    const py = input.pointer.y
    const onGrid = cellAt(px, py)
    if (goldenBanner > 0) {
      goldenBanner -= dt
      if (goldenBanner <= 0 && phase === 'dig') quiet()
    }
    switch (phase) {
      case 'dig': {
        if (input.pressed('Digit1') || input.pressed('KeyQ')) tool = 'pick'
        if (input.pressed('Digit2') || input.pressed('KeyE')) tool = 'hammer'
        if (input.pressed('Escape') || input.pressed('KeyX')) stopAsk()
        if (input.pointer.pressed) {
          if (inside(layout.pick, px, py)) (playSfx('move'), (tool = 'pick'))
          else if (inside(layout.hammer, px, py)) (playSfx('move'), (tool = 'hammer'))
          else if (inside(layout.stop, px, py)) stopAsk()
        }
        cursor = onGrid
        if (input.pointer.released && onGrid !== null) swing(onGrid)
        const move = (dx: number, dy: number) => {
          const at = cursor ?? cellIndexOr(0)
          const c = Math.min(DIG.cols - 1, Math.max(0, (at % DIG.cols) + dx))
          const r = Math.min(DIG.rows - 1, Math.max(0, Math.floor(at / DIG.cols) + dy))
          keyCursor = r * DIG.cols + c
        }
        if (input.pressed('ArrowLeft') || input.pressed('KeyA')) move(-1, 0)
        if (input.pressed('ArrowRight') || input.pressed('KeyD')) move(1, 0)
        if (input.pressed('ArrowUp') || input.pressed('KeyW')) move(0, -1)
        if (input.pressed('ArrowDown') || input.pressed('KeyS')) move(0, 1)
        if (keyCursor !== null) cursor = keyCursor
        if ((input.pressed('Space') || input.pressed('Enter')) && cursor !== null) swing(cursor)
        break
      }
      case 'hold': {
        if (end?.outcome === 'collapse' && phaseT < 1.0 && Math.random() < dt * 80) spawnRubble()
        const time = end?.outcome === 'collapse' ? TIMES.collapse : TIMES.stopped
        if (phaseT >= time) startReveal()
        break
      }
      case 'reveal':
        if ((input.pointer.pressed && phaseT > 0.35) || input.pressed('Space') || input.pressed('Enter') || phaseT >= (meltanOut() ? TIMES.meltan : TIMES.reveal)) nextReveal()
        break
      case 'fossil':
        if (phaseT >= TIMES.fossilGlow && phaseT - dt < TIMES.fossilGlow && fossilOn) {
          flash = 0.3
          playCry(cryUrl(HATCHLINGS[fossilOn].line[0].dex), 0.3)
          playSfx('levelUp')
          say('banner', [h('h3', { class: 'mg-banner-title' }, m().restored(HATCHLINGS[fossilOn].name)), h('p', {}, m().restoredNote)])
        }
        if ((input.pointer.pressed && phaseT > TIMES.fossilGlow) || phaseT >= TIMES.fossil) fossilDone()
        break
      default:
        break
    }
  }

  let keyCursor: number | null = null
  const cellIndexOr = (fallback: number) => cursor ?? keyCursor ?? fallback

  /* ------- Drawing ------- */

  const drawFrame = (g: CanvasRenderingContext2D) => {
    // The timber frame around the wall.
    const fx = grid.x - 4
    const fy = grid.y - 4
    const fw = GRID_W + 8
    const fh = GRID_H + 8
    g.fillStyle = '#2a1a10'
    g.fillRect(fx - 1, fy - 1, fw + 2, fh + 2)
    g.fillStyle = '#6a4a28'
    g.fillRect(fx, fy, fw, 3)
    g.fillRect(fx, fy, 3, fh)
    g.fillRect(fx + fw - 3, fy, 3, fh)
    g.fillRect(fx, fy + fh - 3, fw, 3)
    g.fillStyle = '#9a6a38'
    g.fillRect(fx, fy, fw, 1)
    g.fillRect(fx, fy, 1, fh)
  }

  const drawMeter = (g: CanvasRenderingContext2D) => {
    if (!wall) return
    const { meter } = layout
    const share = Math.min(1, crack / wall.cap)
    const preview = tool ? Math.min(1, (crack + toolCrack(tool, wall.powers)) / wall.cap) : share
    g.fillStyle = '#20140c'
    g.fillRect(meter.x, meter.y, meter.w, meter.h)
    g.fillStyle = '#4a3a2a'
    g.fillRect(meter.x + 1, meter.y + 1, meter.w - 2, meter.h - 2)
    const inner = meter.w - 2
    const fill = Math.round(inner * share)
    const ghost = Math.round(inner * preview)
    const color = share > 0.85 ? (Math.floor(clock * 8) % 2 === 0 ? '#ff4830' : '#c83020') : share > 0.6 ? '#f89030' : '#f8d030'
    if (ghost > fill) {
      g.fillStyle = 'rgba(255,255,255,0.28)'
      g.fillRect(meter.x + 1 + fill, meter.y + 1, ghost - fill, meter.h - 2)
    }
    g.fillStyle = color
    g.fillRect(meter.x + 1, meter.y + 1, fill, meter.h - 2)
    g.fillStyle = 'rgba(255,255,255,0.35)'
    g.fillRect(meter.x + 1, meter.y + 1, fill, 2)
    // Stone-chip ticks so the bar reads as cracks accumulating.
    g.fillStyle = '#20140c'
    for (let x = meter.x + 8; x < meter.x + meter.w; x += 8) g.fillRect(x, meter.y + 1, 1, meter.h - 2)
    const leftUnits = String(Math.max(0, wall.cap - crack))
    const labelW = textWidth(leftUnits) + 6
    plate(g, meter.x + meter.w - labelW - 1, meter.y + 2, labelW, meter.h - 4)
    drawText(g, leftUnits, meter.x + meter.w - 4, meter.y + 3, '#ffffff', 'right')
  }

  const toolButton = (g: CanvasRenderingContext2D, rect: Rect, which: DigTool, label: string) => {
    if (!wall) return
    const on = tool === which
    g.fillStyle = '#20140c'
    g.fillRect(rect.x, rect.y, rect.w, rect.h)
    g.fillStyle = on ? '#f8d030' : '#7a5a38'
    g.fillRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2)
    g.fillStyle = on ? '#fff0a0' : '#9a7a48'
    g.fillRect(rect.x + 1, rect.y + 1, rect.w - 2, 2)
    const img = image(`realm/dig/${which}`)
    if (img) g.drawImage(img, Math.round(rect.x + rect.w / 2 - img.width / 2), rect.y + 5)
    const cost = `+${toolCrack(which, wall.powers)}`
    plate(g, rect.x + 3, rect.y + rect.h - 13, rect.w - 6, 10)
    drawText(g, label, rect.x + 6, rect.y + rect.h - 11, '#ffffff')
    drawText(g, cost, rect.x + rect.w - 6, rect.y + rect.h - 11, on ? '#f8d030' : '#d8c8a0', 'right')
  }

  /** Exits the wall: a little door with an arrow. */
  const drawStop = (g: CanvasRenderingContext2D, r: Rect) => {
    g.fillStyle = '#20140c'
    g.fillRect(r.x, r.y, r.w, r.h)
    g.fillStyle = '#6a4a30'
    g.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2)
    g.fillStyle = '#8a6a40'
    g.fillRect(r.x + 1, r.y + 1, r.w - 2, 2)
    // A doorway with an arrow walking out of it.
    const cx = Math.round(r.x + r.w / 2)
    const cy = Math.round(r.y + r.h / 2)
    g.fillStyle = '#20140c'
    g.fillRect(cx - 9, cy - 11, 12, 22)
    g.fillStyle = '#e8d8b0'
    g.fillRect(cx - 8, cy - 10, 10, 20)
    g.fillStyle = '#20140c'
    g.fillRect(cx - 6, cy - 8, 8, 16)
    g.fillStyle = '#f8d030'
    g.fillRect(cx - 4, cy - 1, 9, 2)
    for (let k = 0; k < 4; k++) g.fillRect(cx + 5 + k, cy - 3 + k, 1, 6 - k * 2 + 1)
  }

  const drawTray = (g: CanvasRenderingContext2D) => {
    const { tray } = layout
    g.fillStyle = '#20140c'
    g.fillRect(tray.x, tray.y, tray.w, tray.h)
    g.fillStyle = '#3a2a1a'
    g.fillRect(tray.x + 1, tray.y + 1, tray.w - 2, tray.h - 2)
    freed.forEach((t0, k) => {
      const id = found.get(t0)
      if (!id) return
      const img = image(DIG_TREASURES[id].art)
      if (!img) return
      const icon = Math.min(22, Math.max(img.width, img.height))
      const k0 = icon / Math.max(img.width, img.height)
      const w = Math.round(img.width * k0)
      const hh = Math.round(img.height * k0)
      g.drawImage(img, tray.x + 3 + k * 23, tray.y + Math.round((tray.h - hh) / 2), w, hh)
    })
  }

  const drawGlint = (g: CanvasRenderingContext2D, x: number, y: number, age: number) => {
    const k = Math.min(1, age / 0.9)
    const size = Math.round(6 * (1 - Math.abs(k - 0.35)))
    if (size <= 0) return
    g.fillStyle = k < 0.5 ? '#ffffff' : '#fff0a0'
    g.fillRect(Math.round(x) - size, Math.round(y), size * 2 + 1, 1)
    g.fillRect(Math.round(x), Math.round(y) - size, 1, size * 2 + 1)
    g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3)
  }

  const drawAim = (g: CanvasRenderingContext2D) => {
    if (cursor === null || !wall || phase !== 'dig') return
    const area = toolArea(tool, cursor, wall.powers)
    for (const i of area) {
      const c = i % DIG.cols
      const r = Math.floor(i / DIG.cols)
      const x = grid.x + c * DIG.cell
      const y = grid.y + r * DIG.cell
      const empty = (left[i] ?? 0) <= 0
      g.fillStyle = i === cursor ? 'rgba(255,255,255,0.5)' : empty ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.32)'
      g.fillRect(x, y, DIG.cell, 1)
      g.fillRect(x, y + DIG.cell - 1, DIG.cell, 1)
      g.fillRect(x, y, 1, DIG.cell)
      g.fillRect(x + DIG.cell - 1, y, 1, DIG.cell)
    }
  }

  const drawSwing = (g: CanvasRenderingContext2D, s: { tool: DigTool; x: number; y: number; age: number }) => {
    const img = image(`realm/dig/${s.tool}`)
    if (!img) return
    const k = 1 - Math.min(1, s.age / 0.1)
    const scale = 0.7
    const w = Math.round(img.width * scale)
    const hh = Math.round(img.height * scale)
    g.drawImage(img, Math.round(s.x - w / 2 + 6 * k), Math.round(s.y - hh - 2 - 10 * k), w, hh)
  }

  const drawBuried = (g: CanvasRenderingContext2D) => {
    if (!end) return
    const k = Math.min(1, phaseT / 0.5)
    for (const b of end.buried) {
      const block = blockOf(b.id)
      if (!block) continue
      const x = grid.x + b.x * DIG.cell
      const y = grid.y + b.y * DIG.cell
      g.globalAlpha = k
      g.filter = 'grayscale(0.85) brightness(0.65)'
      g.drawImage(block, x, y)
      g.filter = 'none'
      g.globalAlpha = 1
      // A rubble mark across it.
      g.fillStyle = 'rgba(232,80,64,0.85)'
      const w = block.width
      const hh = block.height
      for (let d = 0; d < w; d += 2) {
        g.fillRect(x + d, y + Math.round((d / w) * hh), 1, 2)
        g.fillRect(x + w - d, y + Math.round((d / w) * hh), 1, 2)
      }
    }
    for (const b of end.treasures) {
      const dugOut = !end.buried.some((o) => o.x === b.x && o.y === b.y)
      if (!dugOut) continue
      const block = blockOf(b.id)
      if (block) g.drawImage(block, grid.x + b.x * DIG.cell, grid.y + b.y * DIG.cell)
    }
  }

  /** Shining dots streaming out from a point along radial spokes: hard-edged, so it stays pixel art. */
  const drawRays = (g: CanvasRenderingContext2D, cx: number, cy: number, colorA: string, colorB: string) => {
    const spokes = 14
    for (let k = 0; k < spokes; k++) {
      const a = (k / spokes) * Math.PI * 2 + clock * 0.35
      g.fillStyle = k % 2 === 0 ? colorA : colorB
      for (let d = 0; d < 7; d++) {
        const r = 22 + ((clock * 34 + d * 16) % 90)
        const size = r < 60 ? 2 : 1
        g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), size, size)
      }
    }
  }

  /** The dark curtain the end beats play over (the wall still dimly behind). */
  const drawScrim = (g: CanvasRenderingContext2D, amount: number) => {
    g.fillStyle = `rgba(12,10,16,${amount})`
    g.fillRect(0, 0, size.w, size.h)
  }

  const drawReveal = (g: CanvasRenderingContext2D) => {
    if (!end) return
    const r = end.kept[revealAt]
    if (!r) return
    const def = DIG_TREASURES[r.id]
    const cx = size.w / 2
    const cy = size.h > size.w ? 92 : 62
    drawRays(g, cx, cy, def.group === 'fossil' ? '#f8d868' : def.group === 'stone' ? '#c0a8ff' : '#f8d868', '#ffffff')
    const img = image(def.art)
    if (img) {
      // Whole-pixel steps only: a treasure pops in and settles at its biggest clean size.
      const pop = Math.min(1, phaseT / 0.22)
      const settled = Math.min(5, Math.max(1, Math.floor(72 / Math.max(img.width, img.height))))
      const k0 = pop < 1 ? settled + 1 : settled
      const w = img.width * k0
      const hh = img.height * k0
      g.imageSmoothingEnabled = false
      // Meltan climbs out from behind the box's lid, in whole-pixel steps, and stays perched on it.
      const meltan = meltanOut() ? sprites(MELTAN_DEX) : null
      if (meltan && meltan.variant !== undefined && phaseT > MELTAN_PEEK) {
        const up = Math.min(1, (phaseT - MELTAN_PEEK) / 0.3)
        const fit = fitSprites(meltan, 40)
        const lid = Math.round(cy - hh / 2)
        g.save()
        g.translate(Math.round(cx), lid + 6)
        g.scale(2, 2)
        drawPokemon(g, fit, 'Idle', 0, clock, 0, Math.round(fit.bodyH * (1 - up)))
        g.restore()
        if (phaseT - MELTAN_PEEK < 0.05) burst(parts, cx, lid, ['#f8d050', '#ffffff', '#b0b0c0'], 18, 70, -30)
      }
      g.drawImage(img, Math.round(cx - w / 2), Math.round(cy - hh / 2), w, hh)
    }
    drawDots(g, cx, cy, end.kept.length, revealAt)
  }

  /** The reveal's progress pips, one per prize. */
  const drawDots = (g: CanvasRenderingContext2D, cx: number, cy: number, n: number, at: number) => {
    const y = cy + 44
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * 8
      g.fillStyle = i <= at ? '#f8d030' : 'rgba(255,255,255,0.3)'
      g.fillRect(Math.round(x) - 2, y, 4, 4)
    }
  }

  const drawFossil = (g: CanvasRenderingContext2D) => {
    if (!fossilOn || !end) return
    const r = end.kept[revealAt]
    if (!r) return
    const glow = phaseT < TIMES.fossilGlow
    const cx = size.w / 2
    const cy = size.h > size.w ? 96 : 66
    const img = image(DIG_TREASURES[r.id].art)
    if (glow) {
      const pulse = 0.5 + 0.5 * Math.sin(clock * 18)
      for (let ring = 3; ring > 0; ring--) {
        g.fillStyle = `rgba(160,220,255,${0.08 * ring * pulse})`
        const rr = 16 + ring * 12 + pulse * 6
        for (let a = 0; a < Math.PI * 2; a += 0.12) g.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 2, 2)
      }
      if (img) drawCentered(g, img, cx, cy)
      for (let k = 0; k < 2; k++) if (Math.random() < 0.35) burst(parts, cx + (Math.random() - 0.5) * 24, cy + (Math.random() - 0.5) * 24, ['#c8f0ff', '#ffffff'], 2, 35, -40)
      return
    }
    const dex = HATCHLINGS[fossilOn].line[0].dex
    const s = sprites(dex)
    drawRays(g, cx, cy, '#a8e8ff', '#ffffff')
    if (s.variant !== undefined) {
      const fit = fitSprites(s, 56)
      // Doubled by a whole step, so the restored Pokémon fills the scene.
      g.save()
      g.translate(Math.round(cx), Math.round(cy + fit.bodyH / 2 + 6))
      g.scale(2, 2)
      g.imageSmoothingEnabled = false
      drawPokemon(g, fit, 'Idle', 0, clock, 0, 0)
      g.restore()
    }
  }

  const draw = (g: CanvasRenderingContext2D) => {
    g.fillStyle = '#1a1208'
    g.fillRect(0, 0, size.w, size.h)
    sheet.track()
    const tunnel = image('realm/dig/tunnel')
    if (tunnel && wall) {
      // Behind a wall, doubled and dim: only a hint of the mine around it.
      g.globalAlpha = 0.28
      g.drawImage(tunnel, Math.round(size.w / 2 - tunnel.width), Math.round(size.h / 2 - tunnel.height), tunnel.width * 2, tunnel.height * 2)
      g.globalAlpha = 1
    } else if (tunnel) {
      // At the entrance, life-size in whatever the sheet leaves free, so the arch shows whole and never under the words.
      const free = sheet.free()
      g.drawImage(tunnel, Math.round(free.x + free.w / 2 - tunnel.width / 2), Math.round(free.y + free.h / 2 - tunnel.height / 2))
    }
    if (!wall && phase !== 'hold') return

    if (wallDirty) paintWall()
    paintCracks()
    drawFrame(g)
    const offset = shake > 0 ? shakeOffset(shake, shakePower) : { x: 0, y: 0 }
    const wx = grid.x + offset.x
    const wy = grid.y + offset.y
    g.drawImage(wallLayer, wx, wy)
    g.drawImage(crackLayer, wx, wy)
    // Dug-out cells stay clean of the cracks running over the rock around them.
    for (let r = 0; r < DIG.rows; r++) {
      for (let c = 0; c < DIG.cols; c++) {
        if ((left[r * DIG.cols + c] ?? 1) <= 0) g.drawImage(wallLayer, c * DIG.cell, r * DIG.cell, DIG.cell, DIG.cell, wx + c * DIG.cell, wy + r * DIG.cell, DIG.cell, DIG.cell)
      }
    }
    if (wall?.hint) {
      const { i, id, col, row } = wall.hint
      const c = i % DIG.cols
      const r = Math.floor(i / DIG.cols)
      if ((left[i] ?? 0) > 0) {
        const block = blockOf(id)
        if (block) {
          g.globalAlpha = 0.6 + 0.3 * Math.sin(clock * 5)
          g.drawImage(block, col * DIG.cell, row * DIG.cell, DIG.cell, DIG.cell, wx + c * DIG.cell, wy + r * DIG.cell, DIG.cell, DIG.cell)
          g.globalAlpha = 1
        }
        g.fillStyle = 'rgba(200,120,248,0.8)'
        const x = wx + c * DIG.cell
        const y = wy + r * DIG.cell
        g.fillRect(x, y, DIG.cell, 1)
        g.fillRect(x, y + DIG.cell - 1, DIG.cell, 1)
        g.fillRect(x, y, 1, DIG.cell)
        g.fillRect(x + DIG.cell - 1, y, 1, DIG.cell)
      }
    }
    // A cell that just took a hit flashes as its layer goes.
    for (const [i, age] of jolts) {
      g.fillStyle = `rgba(255,255,255,${0.4 * (1 - age / 0.18)})`
      g.fillRect(wx + (i % DIG.cols) * DIG.cell, wy + Math.floor(i / DIG.cols) * DIG.cell, DIG.cell, DIG.cell)
    }
    if (phase === 'hold') drawBuried(g)
    drawAim(g)
    for (const s of swings) drawSwing(g, s)
    for (const s of glints) drawGlint(g, s.x, s.y, s.age)
    if (wall?.golden && phase === 'dig') {
      const sparkle = Math.floor(clock * 6) % 4
      for (let k = 0; k < 3; k++) {
        const seedX = (sparkle * 53 + k * 89) % DIG.cols
        const seedY = (sparkle * 31 + k * 41) % DIG.rows
        const i = seedY * DIG.cols + seedX
        if ((left[i] ?? 0) > 0) drawGlint(g, wx + seedX * DIG.cell + 7, wy + seedY * DIG.cell + 7, 0.35)
      }
    }
    drawFx(g, parts, pops)

    // The HUD stays still under the shake.
    drawMeter(g)
    if (phase === 'dig' || phase === 'confirm') {
      toolButton(g, layout.pick, 'pick', '1')
      toolButton(g, layout.hammer, 'hammer', '2')
      drawStop(g, layout.stop)
      drawTray(g)
    }
    if (phase === 'reveal' || phase === 'fossil' || phase === 'summary') drawScrim(g, 0.78)
    if (phase === 'reveal') drawReveal(g)
    if (phase === 'fossil') drawFossil(g)
    if (phase === 'hold' || phase === 'reveal' || phase === 'fossil') drawFx(g, parts, pops)
    if (flash > 0) {
      g.fillStyle = `rgba(255,255,255,${Math.min(1, flash * 5)})`
      g.fillRect(0, 0, size.w, size.h)
    }
  }

  for (const name of ['dirt', 'rock', 'hard', 'gold', 'tunnel', 'pick', 'hammer']) image(`realm/dig/${name}`)
  void load()

  return {
    step,
    draw,
    over: () => null,
    dispose: () => {
      disposed = true
      sheet.dispose()
    },
  }
}

/** How many fossil families there are (the lacked list's largest size). */
const DIG_FAMILIES = DIG_FOSSIL_FAMILIES.length

/** The Escavação; its canvas fits the way the phone is held. */
export const dig: SoloGame = {
  get size() {
    return (shown = SIZE())
  },
  start,
}
