import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import type { Vec } from '../engine/math'
import { TYPE_COLORS } from '../data/types'
import { VERSUS_KIT } from '../data/versus'
import type { SeatEntry } from '../coop/driver'
import { MOVES, moveStats } from '../game/moves'
import { gameSpecial, specialReady } from '../game/special'
import type { Game, OwnedMove, Player } from '../game/types'
import { inGrass } from '../game/versusGrass'
import { PRIORITIES, type Cast, type Skill } from '../game/versusKit'
import { t } from '../i18n'
import { moveIcon } from '../render/art'
import type { ArenaOverlay } from '../render/arenaAim'
import { specialIcon } from '../render/specialFx'
import { castAlong, cycleTarget, pickAt, pressCast, targetToward } from './arenaAim'
import { h, setStyle, setText } from './dom'
import { boundLabel, setGlyphText } from './inputLabels'
import { settings } from './settings'

/**
 * The Arena's controls (the kit: `game/versusKit.ts`), everything a match
 * plays with besides the stick:
 * - keys (Q, E, R by default, rebindable: `engine/bindings.ts`) cast Move 1,
 *   Move 2 and the Unite Move at once, aimed by the setting (`arenaAim.ts`);
 *   Tab switches targets;
 * - the mouse: a click on a Pokémon locks it (on the ground lets go), and
 *   the cursor is where a manual cast goes;
 * - touch: a tap on a Pokémon locks it; the right-thumb cluster (basic
 *   attack, Move 1, Move 2, Unite) casts on a tap, aims on a drag (shown in
 *   the world, `render/arenaAim.ts`), and cancels when the thumb slides back
 *   onto its button or the touch is lost; a tap on the basic attack switches targets;
 * - a pad: R, ZR, ZL cast; the right stick aims while tilted and a flick of
 *   it switches targets (its click too).
 * Each button and the desktop's key badges show the cooldown. Casts wait in
 * `take` for the frame's `driver.advance`; the lock and the priority go out
 * as entries at once (`send`). Reads the draw copy, so it aims at what the
 * screen shows.
 */

/** A drag past this (CSS px) aims; one this long reaches the whole way. */
const DRAG_START = 14
const MAX_DRAG = 84
/** A touch that moves less than this (CSS px) and lifts within `TAP_MS` is a tap. */
const TAP_SLOP = 12
const TAP_MS = 350
/** The right stick past this tilt counts as a flick (it must come back under `FLICK_REST` before the next). */
const FLICK = 0.7
const FLICK_REST = 0.3

type Slot = 'basic' | Skill
const SLOTS: readonly Slot[] = ['basic', 0, 1, 2]
const ACTIONS = { 0: 'move1', 1: 'move2', 2: 'unite' } as const satisfies Record<Skill, string>
const SKILL_KEYS: Record<string, Skill> = { KeyQ: 0, KeyE: 1, KeyR: 2 }

type Drag = { skill: Skill; id: number; ox: number; oy: number; dx: number; dy: number; aiming: boolean; cancel: boolean; radius: number }

/**
 * `send` takes the kit's entries (the lock, the priority); `blocked` says a
 * menu is up (the keys and the cluster rest).
 */
export const createArenaControls = (root: HTMLElement, input: Input, canvas: HTMLCanvasElement, send: (e: SeatEntry) => void, blocked: () => boolean) => {
  const m = t().versus.kit
  let game: Game | null = null
  let me: Player | null = null
  let queued: Cast[] = []
  let lock = -1
  let sentPrio = -1
  /** The mouse over the canvas (client px), null elsewhere or on touch. */
  let mouse: Vec | null = null
  let drag: Drag | null = null
  let flicked = false
  /** Touches on the canvas that may be taps: where and when each went down, and how far it strayed. */
  const taps = new Map<number, { x: number; y: number; at: number; far: boolean }>()

  const live = () => game !== null && me !== null && game.phase === 'playing' && me.hp > 0 && !blocked()

  /** A client px point in world px, through the drawn camera. */
  const toWorld = (x: number, y: number): Vec => {
    const r = canvas.getBoundingClientRect()
    const k = canvas.width / Math.max(1, r.width)
    return { x: game!.camera.x + (x - r.left) * k, y: game!.camera.y + (y - r.top) * k }
  }

  const owned = (skill: Skill): OwnedMove | undefined => me?.moves[skill + 1]

  /** Whether `skill` would cast now, as the screen shows it. */
  const ready = (skill: Skill) => {
    if (!me) return false
    if (skill === 2) return specialReady(me.special) || me.special.window > 0
    const o = owned(skill)
    return o !== undefined && o.cooldown <= 0 && !inGrass(me)
  }

  const queue = (cast: Cast) => {
    if (!ready(cast.skill)) return playSfx('denied', 120)
    queued = [...queued.filter((c) => c.skill !== cast.skill), cast]
  }

  const setLock = (id: number) => {
    if (id === lock) return
    lock = id
    send({ kind: 'lock', target: id })
    if (id >= 0) playSfx('move', 0)
  }

  /** A press with no aim of its own (a key, a pad button, a tap): the pad's right stick if tilted, else the setting's aim. */
  const press = (skill: Skill) => {
    if (!live()) return
    const g = game!
    const self = me!
    const stick = input.readAim()
    if (stick) return queue(castAlong(self, skill, stick.x, stick.y, Math.hypot(stick.x, stick.y)))
    const s = settings()
    const cursor = mouse ? toWorld(mouse.x, mouse.y) : null
    queue(pressCast(g, self, skill, s.aimAssist, lock, s.targetPriority, cursor))
  }

  const cycle = () => {
    if (!live()) return
    setLock(cycleTarget(game!, me!, lock))
  }

  const offKeys = input.onKey((key) => {
    const skill = SKILL_KEYS[key]
    if (skill !== undefined) press(skill)
    else if (key === 'Tab') cycle()
  })

  /* ---------- The mouse and taps on the world ---------- */

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') mouse = e.target === canvas ? { x: e.clientX, y: e.clientY } : null
    const tap = taps.get(e.pointerId)
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_SLOP) tap.far = true
  }
  // Before the canvas hears it (window, capture): a mouse click in a match locks instead of steering the stick.
  const onDown = (e: PointerEvent) => {
    if (e.target !== canvas || !live()) return
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return
      e.stopPropagation()
      setLock(pickAt(game!, me!, toWorld(e.clientX, e.clientY))?.id ?? -1)
      return
    }
    taps.set(e.pointerId, { x: e.clientX, y: e.clientY, at: performance.now(), far: false })
  }
  // A touch that stayed put: a tap on a Pokémon locks it (one on the ground was the stick's).
  const onUp = (e: PointerEvent) => {
    const tap = taps.get(e.pointerId)
    taps.delete(e.pointerId)
    if (!tap || tap.far || performance.now() - tap.at > TAP_MS || !live()) return
    const hit = pickAt(game!, me!, toWorld(e.clientX, e.clientY))
    if (hit) setLock(hit.id)
  }
  const onCancel = (e: PointerEvent) => taps.delete(e.pointerId)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerdown', onDown, true)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)

  /* ---------- The touch cluster and the key badges ---------- */

  type View = { el: HTMLElement; icon: HTMLImageElement; time: HTMLElement; tag: HTMLElement; shown: string }
  const view = (el: HTMLElement, extra: HTMLElement[] = []): View => {
    const icon = h('img', { alt: '' })
    const time = h('span', { class: 'kit-time' })
    const tag = h('span', { class: 'kit-tag hidden' })
    el.append(icon, time, tag, ...extra)
    return { el, icon, time, tag, shown: '' }
  }

  const names = { basic: m.basic, 0: m.move1, 1: m.move2, 2: m.unite } as const satisfies Record<Slot, string>
  const keys = new Map<Skill, HTMLElement>()
  const buttons = new Map<Slot, View>()
  const badges = new Map<Slot, View>()

  for (const slot of SLOTS) {
    const cls = slot === 'basic' ? 'basic' : `skill s${slot}`
    const button = view(h('button', { class: `special kit-btn kit-${slot === 'basic' ? 'basic' : ACTIONS[slot]} ${cls}`, type: 'button', 'aria-label': names[slot] }))
    buttons.set(slot, button)
    const key = h('span', { class: 'special-key' })
    if (slot !== 'basic') keys.set(slot, key)
    const badge = view(h('div', { class: `special special-badge kit-badge ${cls}`, title: names[slot] }), [slot === 'basic' ? h('span', { class: 'special-key' }, m.auto) : key])
    badges.set(slot, badge)
    button.el.addEventListener('contextmenu', (e) => e.preventDefault())
    button.el.addEventListener('pointerdown', (e) => {
      // Claimed: the floating joystick (pointerdown anywhere) never sees it.
      e.preventDefault()
      e.stopPropagation()
      if (slot === 'basic') return cycle()
      if (!live()) return
      const r = button.el.getBoundingClientRect()
      drag = { skill: slot, id: e.pointerId, ox: r.left + r.width / 2, oy: r.top + r.height / 2, dx: 0, dy: 0, aiming: false, cancel: false, radius: r.width / 2 }
      try {
        button.el.setPointerCapture(e.pointerId)
      } catch {
        // A synthetic pointer: the window still hears its end.
      }
    })
  }

  const dragMove = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return
    drag.dx = e.clientX - drag.ox
    drag.dy = e.clientY - drag.oy
    const len = Math.hypot(drag.dx, drag.dy)
    if (!drag.aiming && len > Math.max(DRAG_START, drag.radius * 0.6)) drag.aiming = true
    // Back on its button: let go to cancel.
    if (drag.aiming) drag.cancel = len < drag.radius
  }
  const dragEnd = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return
    const d = drag
    drag = null
    if (!d.aiming) return press(d.skill)
    if (d.cancel || !live()) return playSfx('move', 0)
    queue(castAlong(me!, d.skill, d.dx, d.dy, Math.hypot(d.dx, d.dy) / MAX_DRAG))
  }
  const dragLost = (e: PointerEvent) => {
    if (drag?.id === e.pointerId) drag = null
  }
  window.addEventListener('pointermove', dragMove)
  window.addEventListener('pointerup', dragEnd)
  window.addEventListener('pointercancel', dragLost)

  const cluster = h('div', { class: 'arena-kit' }, ...SLOTS.map((s) => buttons.get(s)!.el))
  const bar = h('div', { class: 'arena-keys' }, ...SLOTS.map((s) => badges.get(s)!.el))
  root.append(cluster, bar)
  // The run's own special, Mega and lunge controls give way to the kit (`style.css`).
  document.documentElement.dataset.arena = ''

  /** Paints one slot on both its button and its badge: icon, type color, cooldown fill, seconds left, and what holds it. */
  const paint = (slot: Slot, look: string, icon: string, color: string, fill: number, left: number, state: 'ready' | 'wait' | 'held' | 'empty', tag: string) => {
    for (const v of [buttons.get(slot)!, badges.get(slot)!]) {
      if (v.shown !== look) {
        v.shown = look
        v.icon.setAttribute('src', icon)
        v.icon.classList.toggle('hidden', icon === '')
        setStyle(v.el, '--type', color)
      }
      setStyle(v.el, '--fill', fill.toFixed(3))
      setText(v.time, left > 0.5 ? String(Math.ceil(left)) : '')
      setText(v.tag, tag)
      v.tag.classList.toggle('hidden', tag === '')
      v.el.classList.toggle('ready', state === 'ready')
      v.el.classList.toggle('held', state === 'held')
      v.el.classList.toggle('empty', state === 'empty')
    }
  }

  const paintMove = (slot: Slot, o: OwnedMove | undefined, grass: boolean, learnAt: number) => {
    const self = me!
    if (!o) return paint(slot, 'empty', '', '#606878', 0, 0, 'empty', learnAt > 1 ? m.learnAt(learnAt) : '')
    const total = moveStats(o.id, o.level, self.stats, o.path).cooldown
    const fill = slot === 'basic' ? 1 - Math.max(0, o.cooldown) / Math.max(0.01, total) : 1 - o.cooldown / Math.max(0.01, total)
    const state = grass ? 'held' : slot === 'basic' || o.cooldown <= 0 ? 'ready' : 'wait'
    paint(slot, o.id, moveIcon(o.id), TYPE_COLORS[MOVES[o.id].type], Math.min(1, fill), slot === 'basic' ? 0 : o.cooldown, state, grass ? m.grass : '')
  }

  /** Every frame, with this player on the draw copy: the buttons, the lock kept in step, the priority sent when it changes, the right stick. */
  const frame = (g: Game, self: Player) => {
    game = g
    me = self
    const grass = inGrass(self)
    paintMove('basic', self.moves[0], grass, 1)
    paintMove(0, self.moves[1], grass, 1)
    paintMove(1, self.moves[2], grass, VERSUS_KIT.secondMove)
    const sp = self.special
    const r = gameSpecial(g)
    const fill = sp.total > 0 ? 1 - sp.cooldown / sp.total : 1
    paint(2, r.id, specialIcon(r.id), TYPE_COLORS[r.def.type], fill, sp.cooldown, specialReady(sp) || sp.window > 0 ? 'ready' : 'wait', '')
    for (const [skill, el] of keys) setGlyphText(el, boundLabel(ACTIONS[skill]))
    for (const v of buttons.values()) v.el.classList.toggle('aiming', drag !== null && v === buttons.get(drag.skill))
    const hide = self.hp <= 0 || g.phase !== 'playing' || blocked()
    cluster.classList.toggle('hidden', hide)
    bar.classList.toggle('hidden', hide)
    if (hide) drag = null
    // A lock on something gone (knocked out, its body back on a pad with a new id) lets go.
    if (lock >= 0 && !g.enemies.some((e) => e.id === lock && e.dying < 0)) setLock(-1)
    const prio = Math.max(0, PRIORITIES.indexOf(settings().targetPriority))
    if (prio !== sentPrio) {
      sentPrio = prio
      send({ kind: 'prio', prio })
    }
    const stick = input.readAim()
    const tilt = stick ? Math.hypot(stick.x, stick.y) : 0
    if (stick && tilt > FLICK && !flicked && live()) {
      flicked = true
      const id = targetToward(g, self, stick.x, stick.y)
      if (id >= 0) setLock(id)
    } else if (tilt < FLICK_REST) flicked = false
  }

  /** The casts queued since the last frame (for `driver.advance`). */
  const take = (): readonly Cast[] => {
    const out = queued
    queued = []
    return out
  }

  const overlay = (): ArenaOverlay => ({
    aim: drag?.aiming ? { skill: drag.skill, dx: drag.dx, dy: drag.dy, share: Math.min(1, Math.hypot(drag.dx, drag.dy) / MAX_DRAG), cancel: drag.cancel } : null,
    lock,
  })

  const dispose = () => {
    offKeys()
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerdown', onDown, true)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('pointermove', dragMove)
    window.removeEventListener('pointerup', dragEnd)
    window.removeEventListener('pointercancel', dragLost)
    cluster.remove()
    bar.remove()
    delete document.documentElement.dataset.arena
  }

  return { frame, take, overlay, dispose }
}

export type ArenaControls = ReturnType<typeof createArenaControls>
