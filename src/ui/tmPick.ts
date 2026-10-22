import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { ENEMIES } from '../data/enemies'
import { BOSS_TMS, LEGENDARY_TMS } from '../data/tms'
import { TYPE_COLORS } from '../data/types'
import { playerForm } from '../game/branch'
import { isManual, maxMoveLevel, MOVES, type MoveDef, type MoveId } from '../game/moves'
import type { TmSource } from '../game/tmRules'
import type { Game, Offer } from '../game/types'
import { formatPokeDollars, t } from '../i18n'
import { moveIcon, toIconUrl } from '../render/art'
import { tmDisc } from '../render/tmArt'
import { h } from './dom'
import { stepGrid } from './gridNav'
import { hint, menu, typeBadge, type Screen } from './screens'
import { localPlayer } from '../game/players'

/**
 * The TM screen (`Phase` 'tm', `game/tms.ts`): a disc's or a Move Tutor's
 * cards and "pass"; with every slot taken, the moves to forget for it and
 * "don't learn". Forgetting plays the handhelds' "1, 2 and… Poof!" before
 * the pick goes through `onChoose` (a level-up's path, so the replay records
 * it as an `offer` event). The simulation waits on the screen meanwhile.
 */

/** Taps this soon after the screen opens are ignored (a thumb still on the joystick). */
const GUARD_MS = 400
/** Beats of the forgetting: "1, 2 and…", the dots, "Poof!", what was forgotten, what was learned. */
const POOF_BEATS = [520, 520, 560, 700, 900] as const

/** The disc's icon in a type color (gold rim for a legendary TM). */
export const tmDiscIcon = (color: string, gold = false) => toIconUrl(`tm:${color}:${gold}`, () => tmDisc(color, gold))

const tmLine = (id: MoveId, level: number) => {
  const text = t().moves[id].upgrades[level - 2]
  if (text === undefined) return ''
  return typeof text === 'string' ? text : t().levelUp.forkHint(text.fork[0].name, text.fork[1].name)
}

/** The enemy whose TM in `table` teaches `move`, if any. */
const ownerOf = (table: Partial<Record<string, MoveId>>, move: MoveId) => {
  const owner = Object.entries(table).find(([, id]) => id === move)?.[0]
  return owner && owner in ENEMIES ? ENEMIES[owner as keyof typeof ENEMIES] : undefined
}

/**
 * Who left the disc, for the title: the boss or the legendary whose TM it is.
 * A legendary TM is named after its move, not the last rift cleared: a pair's
 * rift (Latias and Latios) clears both and leaves Latias's Mist Ball.
 */
const titleOf = (source: TmSource, move: MoveId) => {
  const m = t().tm
  if (source === 'tutor') return m.titleTutor
  const owner = ownerOf(source === 'legendary' ? LEGENDARY_TMS : BOSS_TMS, move)
  if (!owner) return m.titleFound
  return source === 'legendary' ? m.titleLegendary(owner.name) : m.titleBoss(owner.name)
}

const tmCard = (g: Game, offer: Extract<Offer, { kind: 'tm' }>, i: number) => {
  const m = t()
  const def: MoveDef = MOVES[offer.id]
  const isNew = offer.level === 1
  const broke = offer.price > g.coins
  const tag = isNew ? m.new : offer.level === maxMoveLevel(offer.id) ? m.max : m.level(offer.level)
  return h(
    'button',
    { class: ['offer', 'tm-card', offer.source === 'legendary' && 'tm-gold', broke && 'tm-broke'].filter(Boolean).join(' '), style: `--type:${TYPE_COLORS[def.type]};--i:${i}` },
    h('span', { class: 'offer-key' }, i + 1),
    h('div', { class: 'offer-icon tm-icon' }, h('img', { src: moveIcon(offer.id), alt: '' })),
    h(
      'div',
      { class: 'offer-body' },
      h('div', { class: 'offer-name' }, def.name, h('span', { class: isNew ? 'tag tag-new' : 'tag' }, tag), offer.source !== 'tutor' && h('span', { class: 'tag tag-tm' }, m.tm.tag)),
      h('div', { class: 'offer-desc' }, isNew ? m.moves[offer.id].description : tmLine(offer.id, offer.level)),
    ),
    typeBadge(def.type),
    offer.source === 'tutor' && h('span', { class: broke ? 'tm-price broke' : 'tm-price' }, offer.price === 0 ? m.tm.free : broke ? m.tm.broke : formatPokeDollars(offer.price)),
  )
}

const forgetCard = (g: Game, offer: Extract<Offer, { kind: 'forget' }>, i: number) => {
  const owned = localPlayer(g).moves.find((mv) => mv.id === offer.id)
  const def: MoveDef = MOVES[offer.id]
  return h(
    'button',
    { class: 'tm-forget-move', style: `--type:${TYPE_COLORS[def.type]};--i:${i}` },
    h('span', { class: 'offer-key' }, i + 1),
    h('img', { src: moveIcon(offer.id), alt: '' }),
    h('span', { class: 'tm-forget-name' }, def.name, h('small', {}, t().level(owned?.level ?? 1))),
    typeBadge(def.type),
  )
}

/** The "1, 2 and… Poof!" moment, then `done()`. */
const poof = (stage: HTMLElement, g: Game, offer: Extract<Offer, { kind: 'forget' }>, done: () => void) => {
  const m = t().tm
  const who = playerForm(g).name
  const old = MOVES[offer.id].name
  const learned = MOVES[offer.tm.id].name
  const line = h('p', { class: 'tm-poof-line' }, m.poof[0] ?? '')
  const chip = h('div', { class: 'tm-poof-chip' }, h('img', { src: moveIcon(offer.id), alt: '' }), h('span', {}, old))
  const smoke = h('div', { class: 'tm-poof-smoke', 'aria-hidden': 'true' }, ...Array.from({ length: 10 }, (_, i) => h('i', { style: `--a:${i * 36}deg;--d:${i % 2 ? 26 : 38}px` })))
  stage.replaceChildren(h('div', { class: 'tm-poof' }, chip, smoke, line))
  const beats: Array<() => void> = [
    () => (line.textContent = m.poof[1] ?? ''),
    () => {
      line.textContent = m.poof[2] ?? ''
      chip.classList.add('gone')
      smoke.classList.add('on')
      playSfx('escaped')
    },
    () => (line.textContent = m.forgot(who, old)),
    () => {
      line.textContent = m.andLearned(who, learned)
      chip.replaceChildren(h('img', { src: moveIcon(offer.tm.id), alt: '' }), h('span', {}, learned))
      chip.classList.remove('gone')
      chip.classList.add('learned')
      smoke.classList.remove('on')
      playSfx('unlock')
    },
    done,
  ]
  let at = 0
  const timers = POOF_BEATS.map((ms, i) => {
    at += ms
    return window.setTimeout(beats[i]!, at)
  })
  return () => timers.forEach((id) => clearTimeout(id))
}

/** The TM screen for the offers on the table (cards and "pass", or the moves to forget and "keep"). */
export const tmPick = (root: HTMLElement, input: Input, g: Game, onChoose: (offer: Offer) => void): Screen => {
  const m = t().tm
  const forgetting = localPlayer(g).offers.some((o) => o.kind === 'forget')
  const first = localPlayer(g).offers.find((o): o is Extract<Offer, { kind: 'tm' | 'forget' }> => o.kind === 'tm' || o.kind === 'forget')
  const tm = first?.kind === 'forget' ? first.tm : first
  const source: TmSource = tm?.source ?? 'boss'
  const who = playerForm(g).name
  const buttons = localPlayer(g).offers.map((offer, i) => {
    if (offer.kind === 'tm') return tmCard(g, offer, i)
    if (offer.kind === 'forget') return forgetCard(g, offer, i)
    return h('button', { class: 'btn tm-pass' }, forgetting && tm ? m.keep(MOVES[tm.id].name) : source === 'tutor' ? m.passTutor : m.pass)
  })
  const cards = buttons.filter((_, i) => localPlayer(g).offers[i]?.kind !== 'pass')
  const pass = buttons.find((_, i) => localPlayer(g).offers[i]?.kind === 'pass')
  const color = source === 'tutor' ? '#3868b8' : tm ? TYPE_COLORS[MOVES[tm.id].type] : '#78c0f8'
  const sub =
    forgetting && tm ? (isManual(tm.id) && localPlayer(g).moves.some((mv) => isManual(mv.id)) ? m.forgetManual : m.forgetFull(who))
    : source === 'tutor' ? m.subTutor(tm?.price === 0)
    : source === 'legendary' ? m.subLegendary
    : m.subBoss
  const title = forgetting && tm ? m.forgetTitle(who, MOVES[tm.id].name) : tm ? titleOf(source, tm.id) : m.titleFound

  const grid = h('div', { class: forgetting ? 'tm-forget' : 'offers tm-offers' }, ...cards)
  const stage = h(
    'div',
    { class: 'tm-stage' },
    h(
      'div',
      { class: 'tm-head' },
      h('img', { class: 'tm-head-disc', src: forgetting && tm ? moveIcon(tm.id) : tmDiscIcon(source === 'tutor' ? '#78c0f8' : color, source === 'legendary'), alt: '' }),
      h('div', {}, h('div', { class: 'dialog-title' }, title), h('p', { class: 'tm-sub' }, sub)),
    ),
    source === 'tutor' && !forgetting && h('p', { class: 'tm-wallet' }, m.wallet(formatPokeDollars(g.coins))),
    grid,
    pass && h('div', { class: 'buttons' }, pass),
    hint(m.hintKeys, m.hintTouch),
  )

  let done = false
  let stopPoof: (() => void) | null = null
  const openedAt = performance.now()
  const nav = menu(input, buttons, (i) => {
    const offer = localPlayer(g).offers[i]
    if (done || !offer || performance.now() - openedAt < GUARD_MS) return
    if ((offer.kind === 'tm' && offer.price > g.coins) || (offer.kind === 'forget' && offer.tm.price > g.coins)) return playSfx('denied')
    done = true
    playSfx('select')
    if (offer.kind === 'forget') {
      stopPoof = poof(stage, g, offer, () => onChoose(offer))
      return
    }
    onChoose(offer)
  }, { horizontal: forgetting })
  // The moves to forget sit in a grid (two columns, one on a phone held upright): ← → walk it, ↑ ↓ move a row, and the last row leads to "keep".
  const off = input.onKey((key) => {
    if (!forgetting) return
    const up = key === 'ArrowUp' || key === 'KeyW'
    if (!up && key !== 'ArrowDown' && key !== 'KeyS') return
    const keep = cards.length
    if (nav.index === keep) return up && nav.focus(keep - 1)
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length
    const to = stepGrid(nav.index, up ? 'up' : 'down', cols, cards.length)
    if (to === 'below') nav.focus(keep)
    else if (to !== 'above') nav.focus(to)
  })

  const el = h(
    'div',
    { class: 'screen dim' },
    h('div', { class: ['dialog', 'box', 'pop', 'tm-pick', `tm-${source}`, forgetting && 'tm-forgetting'].filter(Boolean).join(' '), style: `--type:${color}` }, stage),
  )
  root.append(el)
  if (!forgetting) playSfx(source === 'legendary' ? 'legendary' : 'unlock')
  return { el, dispose: () => (nav.off(), off(), stopPoof?.(), el.remove()) }
}
