import { formatTime } from '../engine/math'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { canEvolve, EVOLUTIONS, evolutionOf, evolvedFrom, type MoveEvolution } from '../data/evolutions'
import { ENEMIES } from '../data/enemies'
import { ITEMS } from '../data/items'
import { PLAYABLE } from '../data/hatchlings'
import { TYPE_COLORS, type PokeType } from '../data/types'
import { forkAt, isLegendary, maxMoveLevel, MOVES, moveStats, withBranch, type MoveDef, type MoveId } from '../game/moves'
import { canBanish, drafting, playerDex } from '../game/game'
import { rarityOf } from '../game/leveling'
import { fusable, isDuo, reachableDuos, readyDuos, type DuoRecipe } from '../game/duoRules'
import { CURSES } from '../data/curses'
import { modsOf, type ModId } from '../game/mods'
import { playerForm } from '../game/branch'
import { runLearnset, unlockedAt } from '../game/learnsets'
import { ABILITIES, isHidden } from '../data/abilities'
import { abilitySet } from '../game/abilities'
import { heldMega } from '../game/mega'
import { megaIcon } from '../render/megaFx'
import { BRANCHES } from '../data/branches'
import { legendSignature } from '../data/legends'
import { abilityIcon } from '../render/abilityArt'
import type { Difficulty } from '../game/difficulty'
import { EGGS, refundOf, toSteps } from '../game/eggs'
import { overtime } from '../game/endless'
import { runEarnings, type ConvertedEggs } from '../game/meta'
import { resolveSpecial } from '../game/special'
import { statSheet, type SheetStat } from '../game/statSheet'
import type { DamageSource, Game, Offer } from '../game/types'
import { berryIcon, coinIcon, curseIcon, eggIcon, itemIcon, moveIcon, sparkleIcon } from '../render/art'
import { modIcon } from '../render/modFx'
import { specialIcon } from '../render/specialFx'
import { portraitUrl, sprites } from '../render/sprites'
import { placeIcon } from '../render/places'
import { formatNumber, formatPokeDollars, locale, t } from '../i18n'
import { ROUTES } from '../site/routes'
import { treatIcon } from '../render/halloweenArt'
import { h, later } from './dom'
import { boundPadHint, glyphText } from './inputLabels'
import { pressGuard } from './pressGuard'
import { holdMoveCard, hoverMoveCard, moveCard, withMoveCard } from './moveCard'
import { actAs, localPlayer } from '../game/players'
import { crossings } from '../game/terrain'
import { MAP_ARCHETYPES, type MapArchetypeId } from '../data/mapArchetypes'
import { deathCause } from './deathCause'
import { teamBuilds } from './teamHud'

export type Screen = {
  el: HTMLElement
  tick?: (t: number) => void
  dispose: () => void
  /** How much the attract-mode meadow behind the screen is darkened (0..1, default 0.35). */
  dim?: number
}

export const typeBadge = (type: PokeType) => h('span', { class: 'type-badge', style: `--type:${TYPE_COLORS[type]}` }, type.toUpperCase())

/** The level a run is played on, as a colored chip (pause menu, results). */
export const difficultyTag = (d: Difficulty) => h('span', { class: `difficulty-tag ${d}` }, t().difficulty.names[d])

/** Taps this soon after a menu opens are ignored: a thumb still steering the joystick shouldn't pick an upgrade. */
const TAP_GUARD_MS = 350
/** How long after Enter or Space a keyboard-made click (Space clicks on keyup) still counts as that same press. */
const KEY_CLICK_MS = 1000

/**
 * Hint that swaps between keyboard, gamepad and touch wording (see `.keys-only`,
 * `.pad-only` and `.touch-only` in CSS). The gamepad's is the keyboard's with
 * the pad's buttons (`boundPadHint`).
 */
export const hint = (keys: string, touch: string) =>
  h(
    'p',
    { class: 'hint' },
    h('span', { class: 'keys-only' }, ...glyphText(keys)),
    h('span', { class: 'pad-only' }, ...glyphText(boundPadHint(keys))),
    h('span', { class: 'touch-only' }, touch),
  )

/**
 * Shared keyboard/pointer navigation for a list of buttons.
 * Arrows move the cursor, Enter/Space activate, digits pick directly.
 * `guard` (ms) makes a menu that opens mid-fight ignore picks at first:
 * taps and clicks for that long, keys and pad buttons until they pause
 * (`pressGuard`). `space: false` leaves Space out (Enter, a tap or pad A
 * still pick): the run's special key never lands on a screen the run opened
 * on its own. `off` stops it whole, keys and pointer: a screen that binds
 * its buttons again (back from a screen on top) doesn't stack a second click.
 */
export const menu = (input: Input, buttons: HTMLElement[], activate: (i: number) => void, opts: { horizontal?: boolean; initial?: number; guard?: number; space?: boolean } = {}) => {
  let index = opts.initial ?? 0
  const openedAt = performance.now()
  const takes = pressGuard(opts.guard ?? 0)
  const tapGuard = Math.max(TAP_GUARD_MS, opts.guard ?? 0)
  const focus = (i: number, sound = true) => {
    index = (i + buttons.length) % buttons.length
    buttons.forEach((b, j) => b.classList.toggle('selected', j === index))
    if (sound) playSfx('move')
  }
  const pointer = new AbortController()
  // A button that holds the page's focus (clicked during the tap guard, say) also takes the browser's own click
  // for Enter or Space: one press would pick twice (two runs started at once, a pick screen left behind).
  // The keys are this menu's to handle, so the click they make (`detail` 0) is dropped.
  let keyedAt = -Infinity
  buttons.forEach((b, i) => {
    b.addEventListener('pointerenter', () => i !== index && focus(i), { signal: pointer.signal })
    b.addEventListener(
      'click',
      (e) => (e.detail > 0 || performance.now() - keyedAt > KEY_CLICK_MS) && performance.now() - openedAt > tapGuard && activate(i),
      { signal: pointer.signal },
    )
  })
  focus(index, false)
  const prev = opts.horizontal ? ['ArrowLeft', 'KeyA'] : ['ArrowUp', 'KeyW']
  const next = opts.horizontal ? ['ArrowRight', 'KeyD'] : ['ArrowDown', 'KeyS']
  const offKeys = input.onKey((key) => {
    if (key === 'Enter' || key === 'Space') keyedAt = performance.now()
    if (prev.includes(key)) focus(index - 1)
    else if (next.includes(key)) focus(index + 1)
    else if (key === 'Enter' || (key === 'Space' && opts.space !== false)) {
      if (takes(performance.now() - openedAt)) activate(index)
    } else if (/^Digit[1-9]$/.test(key)) {
      const i = Number(key.slice(5)) - 1
      if (i < buttons.length && takes(performance.now() - openedAt)) activate(i)
    }
  })
  const off = () => {
    offKeys()
    pointer.abort()
  }
  return { off, focus, get index() { return index } }
}

/* ---------------- Level up ---------------- */

/** "Ember + Charcoal → Flamethrower" chip. `ready` lights it up when the evolution is available. */
const evoRecipe = (evo: MoveEvolution, ready: boolean) =>
  h(
    'span',
    { class: ready ? 'evo-recipe ready' : 'evo-recipe', title: `${MOVES[evo.from].name} + ${ITEMS[evo.item].name} → ${MOVES[evo.to].name}` },
    h('img', { src: moveIcon(evo.from), alt: '' }),
    '+',
    h('img', { src: itemIcon(evo.item), alt: '' }),
    '→',
    h('img', { src: moveIcon(evo.to), alt: '' }),
    ready && h('b', {}, t().levelUp.ready),
  )

/** "Ember + Razor Leaf → Fire Pledge" chip of a fusion on the table. */
const duoChip = (from: readonly [MoveId, MoveId], to: MoveId) =>
  h(
    'span',
    { class: 'evo-recipe duo-recipe ready', title: `${MOVES[from[0]].name} + ${MOVES[from[1]].name} → ${MOVES[to].name}` },
    h('img', { src: moveIcon(from[0]), alt: '' }),
    '+',
    h('img', { src: moveIcon(from[1]), alt: '' }),
    '→',
    h('img', { src: moveIcon(to), alt: '' }),
  )

/** "FIRE + GRASS → Fire Pledge" chip of a recipe, by type. `state` lights it up when ready, or marks the one fused. */
const recipeChip = (r: DuoRecipe, state: 'ready' | 'done' | null, to: MoveId = r.to) => {
  const m = t()
  return h(
    'span',
    { class: `duo-type-recipe${state ? ` ${state}` : ''}`, title: `${m.types[r.types[0]]} + ${m.types[r.types[1]]} → ${MOVES[to].name}` },
    typeBadge(r.types[0]),
    '+',
    typeBadge(r.types[1]),
    '→',
    h('img', { src: moveIcon(to), alt: '' }),
    // Only the one on the table (or fused) spells its name: the rest stay compact.
    state && h('span', { class: 'duo-type-name' }, MOVES[to].name),
    state && h('b', {}, state === 'ready' ? m.levelUp.ready : m.duo.done),
  )
}

/** Recipes an offer takes part in, flagged ready if picking it completes the pair. */
const offerRecipes = (g: Game, offer: Offer) => {
  const p = localPlayer(g)
  switch (offer.kind) {
    case 'move': {
      const evo = evolutionOf(offer.id)
      const evos = evo ? [evoRecipe(evo, canEvolve(evo, { moves: [{ ...offer, cooldown: 0 }], items: p.items }))] : []
      // Reaching max level makes it a duo ingredient: the fusions it would open show up.
      if (offer.level < maxMoveLevel(offer.id) || isDuo(offer.id)) return evos
      const moves = [...p.moves.filter((o) => o.id !== offer.id), { id: offer.id, level: offer.level, cooldown: 0 }]
      const duos = readyDuos(moves, legendSignature(p.starter), p.banished).filter((d) => d.from.includes(offer.id) && !readyDuos(p.moves, legendSignature(p.starter), p.banished).some((r) => r.to === d.to))
      return [...evos, ...duos.map((d) => duoChip(d.from, d.to))]
    }
    case 'duo':
      return [duoChip(offer.from, offer.to)]
    case 'item': {
      const learnset = runLearnset(localPlayer(g).starter, localPlayer(g).branch)
      return EVOLUTIONS.filter((e) => e.item === offer.id && learnset.includes(e.from)).map((e) =>
        evoRecipe(e, canEvolve(e, { moves: p.moves, items: [offer] })),
      )
    }
    default:
      return []
  }
}

/** The texts of the upgrade step to `level`: a line, or a fork's two branches. */
const stepText = (id: MoveId, level: number) => t().moves[id].upgrades[level - 2]

/** One line of a plain step (a fork's own line is its branches' hint). */
const stepLine = (id: MoveId, level: number) => {
  const text = stepText(id, level)
  if (text === undefined) return ''
  return typeof text === 'string' ? text : t().levelUp.forkHint(text.fork[0].name, text.fork[1].name)
}

const offerView = (g: Game, offer: Offer) => {
  const m = t()
  const rare = rarityOf(offer) === 'rare'
  switch (offer.kind) {
    case 'move': {
      const def: MoveDef = MOVES[offer.id]
      const isNew = offer.level === 1 || (rare && offer.level === 2)
      const first = isNew ? m.moves[offer.id].description : stepLine(offer.id, rare ? offer.level - 1 : offer.level)
      return {
        icon: moveIcon(offer.id),
        name: def.name,
        tag: `${evolvedFrom(offer.id) || isLegendary(offer.id) ? '★ ' : isDuo(offer.id) ? '✦ ' : ''}${isNew && !rare ? m.new : offer.level === maxMoveLevel(offer.id) ? m.max : m.level(offer.level)}`,
        isNew,
        desc: rare ? `${first} · ${stepLine(offer.id, offer.level)}` : first,
        type: def.type,
        fork: forkAt(offer.id, offer.level) !== null,
        mods: NO_MODS,
      }
    }
    case 'branch': {
      const def: MoveDef = MOVES[offer.id]
      const text = stepText(offer.id, offer.level)
      const branch = typeof text === 'object' ? text.fork[offer.branch] : null
      const mods = forkAt(offer.id, offer.level)?.[offer.branch].mods ?? NO_MODS
      return { icon: moveIcon(offer.id), name: branch?.name ?? def.name, tag: '', isNew: false, desc: branch?.desc ?? '', type: def.type, fork: false, mods }
    }
    case 'item': {
      const isNew = offer.level === 1
      // A rare card stacks two levels of the item.
      const desc = rare ? `${m.items[offer.id]} x2` : m.items[offer.id]
      return { icon: itemIcon(offer.id), name: ITEMS[offer.id].name, tag: isNew && !rare ? m.new : m.level(offer.level), isNew, desc, type: null, fork: false, mods: NO_MODS }
    }
    case 'berry':
      return { icon: berryIcon(), name: 'Oran Berry', tag: '', isNew: false, desc: m.levelUp.berry(PLAYABLE[localPlayer(g).starter].name), type: null, fork: false, mods: NO_MODS }
    case 'evolution': {
      const to: MoveDef = MOVES[offer.to]
      const desc = m.levelUp.evolves(MOVES[offer.from].name, m.moves[offer.to].description)
      return { icon: moveIcon(offer.to), name: to.name, tag: m.levelUp.evolution, isNew: true, desc, type: to.type, fork: false, mods: NO_MODS }
    }
    case 'duo': {
      const to: MoveDef = MOVES[offer.to]
      // The recipe chip under it shows the two moves it spends.
      return { icon: moveIcon(offer.to), name: to.name, tag: m.duo.tag, isNew: true, desc: m.moves[offer.to].description, type: to.type, fork: false, mods: NO_MODS }
    }
    // Cursed items, branches and abilities have screens of their own (`ui/cursePick.ts`, `ui/abilityPick.ts`); this is their plain row.
    case 'curse':
      return { icon: curseIcon(offer.id), name: CURSES[offer.id].name, tag: offer.take ? m.curse.take : m.curse.leave, isNew: false, desc: m.curses[offer.id].upside, type: null, fork: false, mods: NO_MODS }
    // Branches and abilities have screens of their own (`ui/abilityPick.ts`); this is their plain row.
    case 'form': {
      const b = BRANCHES[offer.id]
      return { icon: portraitUrl(b.dex), name: b.name, tag: '', isNew: false, desc: m.branch.subtitle, type: b.types[0] ?? null, fork: false, mods: NO_MODS }
    }
    case 'ability':
      return { icon: abilityIcon(offer.id), name: ABILITIES[offer.id].name, tag: offer.hidden ? m.ability.hidden : '', isNew: offer.hidden, desc: m.abilities[offer.id], type: null, fork: false, mods: NO_MODS }
    // TM picks have their own screen too (`ui/tmPick.ts`).
    case 'tm':
    case 'forget': {
      const def: MoveDef = MOVES[offer.id]
      return { icon: moveIcon(offer.id), name: def.name, tag: m.tm.tag, isNew: offer.kind === 'tm', desc: m.moves[offer.id].description, type: def.type, fork: false, mods: NO_MODS }
    }
    case 'pass':
      return { icon: berryIcon(), name: m.tm.pass, tag: '', isNew: false, desc: '', type: null, fork: false, mods: NO_MODS }
  }
}

/**
 * The move card behind a level-up card: the level it grants, compared with the
 * level the player has (along the branches taken, plus the one a fork card adds).
 * An evolution or a duo shows the new move at level 1.
 */
const offerCard = (g: Game, offer: Offer) => {
  switch (offer.kind) {
    case 'move':
    case 'branch': {
      const owned = localPlayer(g).moves.find((m) => m.id === offer.id)
      const path = offer.kind === 'branch' ? withBranch(owned?.path ?? 0, offer.level, offer.branch) : owned?.path
      return moveCard(g, offer.id, { level: offer.level, from: owned?.level, path })
    }
    case 'evolution':
    case 'duo':
      return moveCard(g, offer.to, { level: 1 })
    default:
      return null
  }
}

const NO_MODS: readonly ModId[] = []

/** Twinkles scattered over a shiny card's frame, as [left %, top %, delay s] (CSS animates them). */
const SPARKLES = [
  [6, 12, 0],
  [88, 8, 0.5],
  [95, 68, 1.1],
  [32, 82, 0.8],
  [62, 4, 1.5],
] as const

/** Fills a level-up card (a persistent button, so a forgotten card's slot keeps its place in the menu). */
const fillCard = (g: Game, button: HTMLElement, offer: Offer, i: number) => {
  const m = t().levelUp
  const v = offerView(g, offer)
  const recipes = offerRecipes(g, offer)
  const rarity = rarityOf(offer)
  // A move the evolution just unlocked, while it still comes up more often: tagged with the form that learns it.
  const fresh =
    offer.kind === 'move' && localPlayer(g).freshMoves > 0 && !localPlayer(g).moves.some((m) => m.id === offer.id) && unlockedAt(localPlayer(g).starter, localPlayer(g).branch, localPlayer(g).stage).includes(offer.id)
  const classes = [
    'offer',
    offer.kind === 'evolution' && 'offer-evo',
    // An evolved move's level-up shows in gold, a notch under an evolution.
    offer.kind === 'move' && (evolvedFrom(offer.id) || isDuo(offer.id)) && 'offer-star',
    offer.kind === 'duo' && 'offer-duo',
    offer.kind === 'branch' && `offer-branch branch-${offer.branch === 0 ? 'a' : 'b'}`,
    v.fork && 'offer-fork',
    rarity && `offer-${rarity}`,
    !canBanish(offer) && 'offer-keep',
    fresh && 'offer-fresh',
  ]
  button.className = classes.filter(Boolean).join(' ')
  button.style.setProperty('--i', String(i))
  // A duo card wears both ingredients' type colors.
  if (offer.kind === 'duo') {
    button.style.setProperty('--duo-a', TYPE_COLORS[MOVES[offer.from[0]].type])
    button.style.setProperty('--duo-b', TYPE_COLORS[MOVES[offer.from[1]].type])
  }
  const icon = h(
    'div',
    { class: 'offer-icon' },
    h('img', { src: v.icon, alt: '' }),
    v.mods.length > 0 && h('span', { class: 'offer-mods' }, ...v.mods.map((id) => h('img', { src: modIcon(id), alt: '' }))),
  )
  // The mouse opens the move card over the icon only, so it doesn't cover the other choices (a finger holds the whole card, see `levelUp`).
  const card = offerCard(g, offer)
  if (card) hoverMoveCard(icon, () => card)
  // `h` drops the parts a card doesn't have; the button takes what's left.
  const parts = h(
    'div',
    {},
    h('span', { class: 'offer-key' }, offer.kind === 'branch' ? (offer.branch === 0 ? 'A' : 'B') : i + 1),
    icon,
    h(
      'div',
      { class: 'offer-body' },
      h(
        'div',
        { class: 'offer-name' },
        v.name,
        v.tag && h('span', { class: v.isNew ? 'tag tag-new' : 'tag' }, v.tag),
        v.fork && h('span', { class: 'tag tag-fork' }, m.forkTag),
        fresh && h('span', { class: 'tag tag-fresh' }, m.freshTag(playerForm(g).name)),
        rarity && h('span', { class: `tag tag-${rarity}` }, rarity === 'rare' ? m.rare : m.shiny),
      ),
      h('div', { class: 'offer-desc' }, v.desc),
      rarity === 'shiny' && h('div', { class: 'offer-note' }, m.shinyNote),
      offer.kind === 'duo' && h('div', { class: 'offer-note duo-note' }, t().duo.frees),
      recipes.length > 0 && h('div', { class: 'evo-recipes' }, ...recipes),
    ),
    v.type && typeBadge(v.type),
    (rarity || offer.kind === 'duo') && h('span', { class: 'offer-shine', 'aria-hidden': 'true' }),
    rarity === 'shiny' &&
      h(
        'span',
        { class: 'offer-sparkles', 'aria-hidden': 'true' },
        ...SPARKLES.map(([x, y, delay]) => h('img', { src: sparkleIcon(), alt: '', style: `left:${x}%;top:${y}%;animation-delay:${delay}s` })),
      ),
  )
  button.replaceChildren(...parts.childNodes)
}

/** A level-up card on its own, shown rather than picked (a Poké Ball's new move or item); holding it opens the move card. */
export const offerTile = (g: Game, offer: Offer) => {
  const tile = h('div', {})
  fillCard(g, tile, offer, 0)
  holdMoveCard(tile, () => offerCard(g, offer))
  return tile
}

/**
 * What the level-up screen can do besides picking: the Poké Mart charges and
 * Esquecer (`banish` forgets the card at an index; the run redraws that slot in place).
 */
type LevelUpExtras = { reroll: () => void; skip: () => void; banish: (index: number) => void }

/**
 * The level-up screen, in three guises: the opening draft (the move after the
 * signature), a fork (a move card split into its two branches, A and B) and a
 * regular level-up, where Esquecer turns the next pick into forgetting a card:
 * it flies off and its slot is drawn again.
 */
export const levelUp = (root: HTMLElement, input: Input, g: Game, onChoose: (offer: Offer) => void, extras?: LevelUpExtras): Screen => {
  const m = t().levelUp
  const name = playerForm(g).name
  const fork = localPlayer(g).offers.find((o) => o.kind === 'branch')
  const buttons = localPlayer(g).offers.map((offer, i) => {
    const button = h('button', {})
    fillCard(g, button, offer, i)
    // Read at hold time: Esquecer redraws a slot with another offer, and a pick (another finger, the keyboard) empties them.
    holdMoveCard(button, () => {
      const offer = localPlayer(g).offers[i]
      return offer ? offerCard(g, offer) : null
    })
    return button
  })

  const charge = (left: number, label: string, cls = 'btn') => (extras && !fork && left > 0 ? h('button', { class: cls }, label) : null)
  const reroll = charge(localPlayer(g).rerolls, m.reroll(localPlayer(g).rerolls))
  const skip = charge(localPlayer(g).skips, m.skip(localPlayer(g).skips))
  const banish = charge(localPlayer(g).banishes, m.banish(localPlayer(g).banishes), 'btn btn-banish')
  const actions = [reroll, skip, banish].filter((b) => b !== null)

  const offersEl = h('div', { class: fork ? 'offers branches' : 'offers' }, ...buttons)
  const hintEl = h('div', { class: 'hint-slot' }, hint(fork ? m.pairHintKeys : m.hintKeys, m.hintTouch))
  let banishing = false
  const setBanishing = (on: boolean) => {
    banishing = on
    offersEl.classList.toggle('banishing', on)
    banish?.classList.toggle('active', on)
    if (banish) banish.textContent = on ? m.banishCancel : m.banish(localPlayer(g).banishes)
    hintEl.replaceChildren(on ? hint(m.banishHintKeys, m.banishHintTouch) : hint(m.hintKeys, m.hintTouch))
  }

  /** The card at `i` flies off as a ghost while its slot fills with the card drawn in its place. */
  const forget = (i: number) => {
    const button = buttons[i]!
    const ghost = button.cloneNode(true) as HTMLElement
    ghost.classList.add('offer-ghost')
    ghost.classList.remove('selected')
    Object.assign(ghost.style, { top: `${button.offsetTop}px`, left: `${button.offsetLeft}px`, width: `${button.offsetWidth}px`, height: `${button.offsetHeight}px` })
    offersEl.append(ghost)
    ghost.addEventListener('animationend', () => ghost.remove())
    extras?.banish(i)
    fillCard(g, button, localPlayer(g).offers[i]!, i)
    button.classList.add('offer-redrawn', 'selected')
    playSfx('escaped')
    setBanishing(false)
    if (localPlayer(g).banishes <= 0) banish?.remove()
  }

  let done = false
  // Space also fires the special attack: ignore presses that were meant for the fight.
  const openedAt = performance.now()
  const nav = menu(input, [...buttons, ...actions], (i) => {
    if (done || performance.now() - openedAt < 400) return
    const offer = localPlayer(g).offers[i]
    const action = actions[i - buttons.length]
    if (banishing && offer) return canBanish(offer) ? forget(i) : playSfx('denied')
    if (action && action === banish) {
      playSfx('move')
      return setBanishing(!banishing)
    }
    done = true
    playSfx('select')
    if (offer) onChoose(offer)
    else if (action === reroll) extras?.reroll()
    else if (action === skip) extras?.skip()
  })
  const offEscape = input.onKey((key) => {
    if (key === 'Escape' && banishing) setBanishing(false)
    // A fork's two paths sit side by side (stacked only on a phone held upright): left and right move too.
    else if (fork && (key === 'ArrowLeft' || key === 'KeyA')) nav.focus(nav.index - 1)
    else if (fork && (key === 'ArrowRight' || key === 'KeyD')) nav.focus(nav.index + 1)
  })

  const me = localPlayer(g)
  const title = fork ? m.forkTitle(MOVES[fork.id].name, fork.level) : drafting(g) ? m.draftTitle(name) : me.prize ? m.prize[me.prize] : m.title(name, me.level - me.pendingLevelUps + 1)
  const el = h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: fork ? 'dialog box pop levelup fork' : 'dialog box pop levelup' },
      h('div', { class: 'dialog-title' }, title),
      offersEl,
      actions.length > 0 && h('div', { class: 'buttons' }, ...actions),
      hintEl,
    ),
  )
  root.append(el)
  return { el, dispose: () => (nav.off(), offEscape(), el.remove()) }
}

/* ---------------- Pause ---------------- */

const mult = (v: number) => `x${v.toFixed(2)}`
const pct = (v: number) => `${v < 0 ? '' : '+'}${Math.round(v * 100)}%`
const plus = (v: number) => `+${v}`
const whole = (v: number) => `${Math.round(v)}`

/** How each stat reads on the pause sheet. */
const SHEET_FORMAT = {
  maxHp: whole,
  might: mult,
  cooldown: mult,
  area: mult,
  duration: mult,
  amount: plus,
  speed: whole,
  armor: (v) => `${Number(v.toFixed(1))}`,
  regen: (v) => `${v.toFixed(1)}/s`,
  magnet: whole,
  growth: mult,
  greed: mult,
  projectileSpeed: mult,
  statusChance: pct,
  statusDamage: pct,
  damageTaken: mult,
  comboMoves: plus,
  specialRecharge: (v) => `${v.toFixed(2)}s`,
} satisfies Record<SheetStat, (v: number) => string>

/** The stat table: name, current value and how many upgrade cards fed it. */
const statTable = (g: Game) => {
  const m = t().pause
  return h(
    'div',
    { class: 'stat-table' },
    h('span', { class: 'stat-cards-head', title: m.cardsHint }, m.cards),
    ...statSheet(localPlayer(g).stats, localPlayer(g).items).flatMap((r) => [
      r.stat === 'typeDamage' ? h('span', { class: 'stat-name' }, m.typeDamage, typeBadge(r.type)) : h('span', { class: 'stat-name' }, m.stats[r.stat]),
      h('b', {}, r.stat === 'typeDamage' ? pct(r.value) : SHEET_FORMAT[r.stat](r.value)),
      r.cards > 0 ? h('span', { class: 'stat-cards', title: m.cardsHint }, `×${r.cards}`) : h('span', { class: 'stat-cards none' }, '·'),
    ]),
  )
}

/** Paired item hint for a loadout move: shows what it needs and whether it is ready. */
const loadoutHint = (g: Game, id: MoveId) => {
  if (evolvedFrom(id)) return h('span', { class: 'tag tag-new' }, '★ EVO')
  if (isDuo(id)) return h('span', { class: 'tag tag-duo' }, '✦ DUO')
  // A legendary's move never evolves: a gold star says where it came from.
  if (isLegendary(id)) return h('span', { class: 'tag tag-legendary' }, '★')
  const evo = evolutionOf(id)
  if (!evo) return null
  const ready = canEvolve(evo, localPlayer(g))
  return h(
    'span',
    { class: ready ? 'evo-pair ready' : 'evo-pair', title: `${ITEMS[evo.item].name} → ${MOVES[evo.to].name}` },
    h('img', { src: itemIcon(evo.item), alt: ITEMS[evo.item].name }),
    ready && '!',
  )
}

const levelTag = (level: number, max: number) => h('span', { class: level >= max ? 'tag tag-max' : 'tag' }, level >= max ? t().max : t().level(level))

const moveList = (g: Game) =>
  h(
    'div',
    { class: 'loadout-list' },
    ...localPlayer(g).moves.map((m) => {
      const row = h(
        'div',
        { class: 'loadout-row' },
        h('img', { src: moveIcon(m.id), alt: '' }),
        MOVES[m.id].name,
        // The mods of the fork branches taken.
        ...modsOf(moveStats(m.id, m.level, localPlayer(g).stats, m.path).mods).map((id) => h('img', { class: 'loadout-mod', src: modIcon(id), alt: '' })),
        loadoutHint(g, m.id),
        levelTag(m.level, maxMoveLevel(m.id)),
      )
      withMoveCard(row, () => moveCard(g, m.id, { level: m.level, path: m.path, describe: true }))
      return row
    }),
  )

const itemList = (g: Game) =>
  h(
    'div',
    { class: 'loadout-list' },
    ...localPlayer(g).items.map((i) =>
      h('div', { class: 'loadout-row' }, h('img', { src: itemIcon(i.id), alt: '' }), ITEMS[i.id].name, levelTag(i.level, ITEMS[i.id].levels.length)),
    ),
    ...localPlayer(g).curses.held.map((id) =>
      h('div', { class: 'loadout-row cursed', title: t().curses[id].downside }, h('img', { src: curseIcon(id), alt: '' }), CURSES[id].name, h('span', { class: 'tag tag-curse' }, t().curse.label)),
    ),
    localPlayer(g).items.length === 0 && localPlayer(g).curses.held.length === 0 && h('p', { class: 'loadout-empty' }, t().pause.noItems),
  )

const pauseSection = (title: string, body: HTMLElement) => h('section', { class: 'pause-section' }, h('h3', { class: 'pause-head' }, title), body)

/**
 * The duo recipes this run can make (both types among the moves it can learn
 * or holds), lit when ready; once one is fused, just that one, marked done.
 */
const duoPanel = (g: Game) => {
  const m = t().duo
  const p = localPlayer(g)
  const owned = p.moves.find((o) => isDuo(o.id))
  const types = new Set<PokeType>([...runLearnset(localPlayer(g).starter, localPlayer(g).branch), ...p.moves.map((o) => o.id)].map((id) => MOVES[id].type))
  const ready = readyDuos(p.moves, legendSignature(p.starter), p.banished)
  const recipes = reachableDuos(types)
  if (recipes.length === 0 && !owned) return null
  const chips = owned
    ? recipes.filter((r) => r.to === owned.id || ('alt' in r && r.alt === owned.id)).map((r) => recipeChip(r, 'done', owned.id))
    : recipes.map((r) => {
        const fused = ready.find((d) => d.to === r.to || ('alt' in r && d.to === r.alt))
        return recipeChip(r, fused ? 'ready' : null, fused?.to)
      })
  const half = p.moves.filter(fusable).length > 0
  return h(
    'div',
    { class: 'duo-panel' },
    h('div', { class: 'duo-recipes' }, h('span', { class: 'duo-panel-title' }, h('img', { src: sparkleIcon(), alt: '' }), m.title), ...chips),
    !owned && h('p', { class: half ? 'duo-legend near' : 'duo-legend' }, m.legend),
  )
}

/** The ability in play for the pause menu: the one picked (its Hidden tag too), the Mega's while that lasts, or when it comes. */
/** What a map archetype is good for: the types its terrain rewards ("Bom para", when it has any) and a line (the run's sign, the pause menu). */
export const mapGoodFor = (id: MapArchetypeId) => {
  const types = MAP_ARCHETYPES[id].goodFor
  return h(
    'div',
    { class: 'map-good' },
    types.length > 0 && h('span', { class: 'map-good-label' }, t().maps.goodFor),
    ...types.map(typeBadge),
    h('span', { class: 'map-good-tip' }, t().maps.tips[id]),
  )
}

/** The pause menu's map row: the run's map archetype, what it's good for and how the local player's types cross it. */
const mapPanel = (g: Game) => {
  const m = t().maps
  const id = g.terrain.archetype
  const before = actAs(g, localPlayer(g))
  const ways = crossings(g)
  actAs(g, before)
  return h(
    'div',
    { class: 'pause-map' },
    h('b', {}, h('small', {}, m.label), m.names[id]),
    mapGoodFor(id),
    h('span', { class: 'pause-map-ways' }, ways.length > 0 ? ways.map((w) => m.crossings[w]).join(' ') : m.noCrossing),
  )
}

const abilityPanel = (g: Game) => {
  const m = t().ability
  const mega = localPlayer(g).mega.active > 0 ? heldMega(g) : null
  const id = localPlayer(g).ability.id
  const row = (cls: string, icon: string, name: Node | string, text: string) =>
    h('div', { class: `pause-ability ${cls}` }, h('img', { src: icon, alt: '' }), h('div', {}, h('b', {}, h('small', {}, m.label), name), h('span', {}, text)))
  if (mega) return row('mega', megaIcon(), mega.ability, m.megaNote)
  if (!id) return row('pending', sparkleIcon(), '—', m.pending)
  const set = abilitySet(localPlayer(g).starter, localPlayer(g).branch)
  const hidden = isHidden(set, set.indexOf(id))
  return row(hidden ? 'hidden-ability' : '', abilityIcon(id), h('span', {}, ABILITIES[id].name, hidden && h('span', { class: 'tag tag-hidden' }, m.hidden)), t().abilities[id])
}

/**
 * `settings` opens the settings screen on top (see `openSettings`) and
 * `report` the bug report form (null: no API to send it to); each must call
 * `back` once it closes. The pause menu hides meanwhile, then redraws
 * itself, in the new language if it changed.
 */
/**
 * Yes/no dialog over a screen (the mart's purchases, co-op's "Sair da partida").
 * Defaults to "no" so a stray Enter is harmless; Esc or Backspace answer no.
 * `opts`: other button labels, a class for the backdrop (`shop-confirm`).
 */
export const confirmDialog = (
  root: HTMLElement,
  input: Input,
  text: string,
  onAnswer: (yes: boolean) => void,
  opts: { yes?: string; no?: string; class?: string } = {},
): Screen => {
  const yes = h('button', { class: 'btn' }, opts.yes ?? t().mart.yes)
  const no = h('button', { class: 'btn' }, opts.no ?? t().mart.no)
  const nav = menu(input, [yes, no], (i) => onAnswer(i === 0), { horizontal: true, initial: 1 })
  const offEsc = input.onKey((k) => (k === 'Escape' || k === 'Backspace') && onAnswer(false))
  const el = h('div', { class: opts.class ? `screen dim ${opts.class}` : 'screen dim' }, h('div', { class: 'dialog box pop' }, h('div', { class: 'dialog-title' }, text), h('div', { class: 'buttons' }, yes, no)))
  root.append(el)
  return { el, dispose: () => (nav.off(), offEsc(), el.remove()) }
}

/**
 * What the pause menu does. `coop`: it's co-op's menu instead, over a run
 * that goes on: no pause in its title, a sound switch (`sound` toggles it and
 * says whether it's on now), and leaving asks first.
 */
type PauseActions = {
  resume: () => void
  quit: () => void
  settings: (back: () => void) => Screen
  report: ((back: () => void) => Screen) | null
  coop?: { sound: () => boolean; soundOn: boolean }
}

export const pauseMenu = (root: HTMLElement, input: Input, g: Game, actions: PauseActions): Screen => {
  const el = h('div', { class: 'screen dim pause-screen' })
  let nav: ReturnType<typeof menu> | null = null
  /** The screen open on top (settings, the bug report). */
  let sub: Screen | null = null

  /**
   * Hides the menu under `open`'s screen and redraws it when that one closes.
   * Both ends run after a key dispatch (`later`), when the menu may be gone
   * already (the run resumed, the game ended it): a disposed menu (`el` out of
   * the page, as `openSettings` checks too) opens nothing and binds no keys,
   * or its Quit and Resume would keep listening over the run.
   */
  const openSub = (open: (back: () => void) => Screen, focus: number) => {
    if (sub || !el.isConnected) return
    nav?.off()
    el.classList.add('hidden')
    sub = open(() => {
      sub = null
      if (!el.isConnected) return
      el.classList.remove('hidden')
      render(focus, false)
    })
  }

  const coop = actions.coop
  let soundOn = coop?.soundOn ?? true
  /** Co-op: "Sair da partida?" first; no keeps the menu where it was. */
  const confirmLeave = (focus: number) => {
    const m = t().team.menu
    openSub((back) => {
      const dialog = confirmDialog(root, input, m.confirm, (yes) => (dialog.dispose(), yes ? actions.quit() : back()), { yes: m.yes, no: m.no })
      return dialog
    }, focus)
  }

  /** `opening` plays the pop-in; redraws after closing the settings don't. */
  const render = (focus: number, opening: boolean) => {
    const m = t().pause
    const cm = t().team.menu
    const resume = h('button', { class: 'btn' }, m.resume)
    const sound = coop && h('button', { class: 'btn' }, cm.sound(soundOn))
    const settingsButton = h('button', { class: 'btn' }, m.settings)
    const report = actions.report
    const reportButton = report && h('button', { class: 'btn' }, m.reportBug)
    const quit = h('button', { class: 'btn' }, coop ? cm.leave : m.quit)
    const buttons = [resume, ...(sound ? [sound] : []), settingsButton, ...(reportButton ? [reportButton] : []), quit]
    // Co-op: the teammates' builds, to read and coordinate while the run goes on.
    const builds = coop && teamBuilds(g, localPlayer(g))
    nav?.off()
    nav = menu(input, buttons, (i) => {
      const pressed = buttons[i]
      if (pressed === resume) actions.resume()
      if (sound && pressed === sound && coop) {
        soundOn = coop.sound()
        sound.textContent = cm.sound(soundOn)
      }
      // Open after this key dispatch, or the new screen would receive the same Enter (or Space).
      if (pressed === settingsButton) later(() => openSub(actions.settings, i))
      if (pressed === reportButton && report) later(() => openSub(report, i))
      // Quitting opens the partner select, which would take that same press as its pick and start the run again.
      if (pressed === quit) later(coop ? () => confirmLeave(i) : actions.quit)
    }, { initial: focus })
    el.replaceChildren(
      h(
        'div',
        { class: opening ? 'dialog box pop wide pause' : 'dialog box wide pause' },
        h('div', { class: 'dialog-title' }, coop ? cm.title : m.title),
        coop && h('p', { class: 'pause-note' }, cm.note),
        difficultyTag(g.difficulty),
        abilityPanel(g),
        mapPanel(g),
        h(
          'div',
          { class: 'pause-body' },
          h(
            'div',
            { class: 'pause-grid' },
            pauseSection(m.statsTitle, statTable(g)),
            h('div', { class: 'pause-column' }, pauseSection(m.movesTitle, moveList(g)), pauseSection(m.itemsTitle, itemList(g))),
          ),
          pauseSection(m.damageTitle, damagePanel(g)),
          builds && pauseSection(cm.builds, builds),
          duoPanel(g),
          h('p', { class: 'evo-legend' }, m.evoLegend),
          hint(m.cardHintKeys, m.cardHintTouch),
        ),
        h('div', { class: 'buttons' }, ...buttons),
      ),
    )
  }

  render(0, true)
  // Esc inside the settings (or the report) only closes them.
  const offEsc = input.onKey((k) => k === 'Escape' && !sub && actions.resume())
  root.append(el)
  return { el, dispose: () => (sub?.dispose(), nav?.off(), offEsc(), el.remove()) }
}

/* ---------------- Results ---------------- */

/** How long the results ignore confirms after a faint or a victory (`menu`'s `guard`). */
const RESULTS_GUARD_MS = 900

/** Icon, name and type for a results-screen damage row (and the run's share card). */
export const damageSource = (g: Game, id: DamageSource) => {
  if (id === 'ability') {
    const ability = localPlayer(g).ability.id
    const type = playerForm(g).types[0] ?? 'normal'
    return ability ? { icon: abilityIcon(ability), name: ABILITIES[ability].name, type } : { icon: sparkleIcon(), name: t().ability.results, type }
  }
  if (id !== 'special') return { icon: moveIcon(id), name: MOVES[id].name, type: MOVES[id].type }
  const r = resolveSpecial(localPlayer(g).starter, localPlayer(g).stage, null, localPlayer(g).branch)
  return { icon: specialIcon(r.id), name: r.tier.name, type: r.def.type }
}

/** The player's damage by move, most first. */
const damageEntries = (g: Game) => (Object.entries(localPlayer(g).damageByMove) as Array<[DamageSource, number]>).sort((a, b) => b[1] - a[1])

/**
 * The run's damage by move, most first, each with a bar against the top one
 * (results, pause). `seconds` adds each move's average DPS over that long.
 */
const damageList = (g: Game, seconds: number | null = null) => {
  const entries = damageEntries(g)
  const top = entries[0]?.[1] ?? 1
  return h(
    'div',
    { class: seconds === null ? 'damage-list' : 'damage-list with-dps' },
    ...entries.map(([id, dmg]) => {
      const src = damageSource(g, id)
      return h(
        'div',
        { class: 'damage-row' },
        h('img', { src: src.icon, alt: '' }),
        h('span', { class: 'damage-name' }, src.name),
        h('div', { class: 'damage-bar' }, h('div', { style: `width:${(dmg / top) * 100}%;--type:${TYPE_COLORS[src.type]}` })),
        h('b', {}, formatNumber(dmg)),
        seconds !== null && h('span', { class: 'damage-dps' }, `${formatNumber(Math.round(dmg / seconds))}/s`),
      )
    }),
  )
}

/**
 * The run so far on the pause sheet: the total, the damage by move and each
 * one's DPS. The state has no time a move was learned, so the DPS is over the
 * time played (`g.now`, rifts included), and the note says so.
 */
const damagePanel = (g: Game) => {
  const m = t().pause
  const total = damageEntries(g).reduce((sum, [, dmg]) => sum + dmg, 0)
  if (total === 0) return h('p', { class: 'loadout-empty' }, m.damageEmpty)
  const seconds = Math.max(1, g.now)
  return h(
    'div',
    { class: 'pause-damage' },
    h('p', { class: 'damage-total' }, m.damageTotal(formatNumber(total), formatNumber(Math.round(total / seconds)))),
    damageList(g, seconds),
    h('p', { class: 'damage-note' }, m.damageNote(formatTime(seconds))),
  )
}

/** What the incubator made of the run: eggs paid in ₽ because they didn't fit (found or rewards), and eggs now ready to hatch. */
export type ResultEggs = { converted: ConvertedEggs; ready: number }

/** One line per reason eggs were paid in ₽ instead of incubated, with their count and amount. */
export const convertedEggLines = ({ full, cap }: ConvertedEggs): string[] => [
  ...(full.length > 0 ? [t().eggs.full(full.length, formatPokeDollars(refundOf(full)))] : []),
  ...(cap.length > 0 ? [t().eggs.capped(cap.length, formatPokeDollars(refundOf(cap)), EGGS.perRun)] : []),
]

/** What the run added to the Pokédex (`dexNews`). */
type DexNews = { species: number; shinies: number }

/** The run's ranking line (`rankPanel`) and the boards, opened over the results until `back`. */
type ResultsRanking = { panel: HTMLElement; open: (back: () => void) => Screen }

/** The share preview of the run's card, opened over the results until `back`; `glow` when the run is worth showing off. */
type ResultsShare = { open: (back: () => void) => Screen; glow: boolean }

/**
 * What the shell adds to the results: the equipped title, the missions the run
 * moved and the medals it earned (built by `ui/missions.ts`), the incubator,
 * the Pokédex news and the ranking.
 */
type ResultsExtras = {
  badge: HTMLElement | null
  report: HTMLElement | null
  medals: readonly HTMLElement[]
  eggs: ResultEggs
  news: DexNews
  ranking: ResultsRanking | null
  share: ResultsShare | null
  /** A victory's thanks to the supporters (`creditsLine`), above the support link. */
  credits?: HTMLElement | null
}

const NO_EXTRAS: ResultsExtras = { badge: null, report: null, medals: [], eggs: { converted: { full: [], cap: [] }, ready: 0 }, news: { species: 0, shinies: 0 }, ranking: null, share: null }

/**
 * Everything new a run brought, as one wrapping line of chips under the stats
 * (Pokédex, eggs, medals), so the results stay short on a phone held upright.
 */
const runNews = ({ eggs, news, medals }: ResultsExtras) => {
  const m = t().results
  const e = t().eggs
  const chips = [
    (news.species > 0 || news.shinies > 0) &&
      h(
        'span',
        { class: 'news-chip dex-news' },
        h('b', {}, 'POKéDEX'),
        [news.species > 0 && m.dexSpecies(news.species), news.shinies > 0 && m.dexShinies(news.shinies)].filter(Boolean).join(' · '),
        news.shinies > 0 && h('img', { src: sparkleIcon(), alt: '' }),
      ),
    eggs.ready > 0 && h('span', { class: 'news-chip egg-ready' }, h('img', { src: eggIcon('common'), alt: '' }), e.readyBadge(eggs.ready)),
    ...convertedEggLines(eggs.converted).map((line) => h('span', { class: 'news-chip' }, h('img', { src: coinIcon(1), alt: '' }), line)),
    ...medals,
  ].filter((chip) => chip instanceof HTMLElement)
  return chips.length > 0 ? h('div', { class: 'result-news' }, ...chips) : null
}

/**
 * End of run. On a victory, `onContinue` adds the endless-mode button (first);
 * a run that ends in endless mode shows its overtime, rift legendaries and Arceus.
 * The steps walked and eggs found feed the incubator (`extras.eggs`), and
 * `extras.news` adds a one-line Pokédex summary when the run found something new.
 * A victory also links the support page, under the buttons (only then, so it never nags); a faint
 * says what landed the last hit (`deathCause`).
 * `onLobby` goes straight home (Trocar Pokémon opens the partner select instead).
 */
export const results = (
  root: HTMLElement,
  input: Input,
  g: Game,
  onRetry: () => void,
  onMenu: () => void,
  onLobby: () => void,
  onContinue?: () => void,
  extras: ResultsExtras = NO_EXTRAS,
): Screen => {
  const m = t().results
  const e = t().eggs
  const r = t().rifts
  const victory = g.phase === 'victory'
  const name = playerForm(g).name
  const earned = runEarnings(g)
  const extra = overtime(g.time)
  const reaperDefeats = g.endless?.reaperDefeats ?? 0
  const legends = g.rift.cleared
  const retry = h('button', { class: 'btn' }, m.retry)
  const back = h('button', { class: 'btn' }, m.change)
  const lobby = h('button', { class: 'btn' }, m.lobby)
  const goOn = victory && onContinue ? h('button', { class: 'btn' }, r.continue) : null
  const ranking = extras.ranking
  const boards = ranking ? h('button', { class: 'btn' }, t().ranking.open) : null
  const share = extras.share ? h('button', { class: extras.share.glow ? 'btn share-button glow' : 'btn share-button' }, h('img', { src: sparkleIcon(), alt: '' }), t().share.button) : null
  /** The boards or the share preview, open over the results. */
  let sub: Screen | null = null
  /**
   * Hides the results under `open`'s screen until it closes, then comes back
   * on the same button. Once the results are disposed (Retry, endless mode)
   * nothing opens or binds again, as in the pause menu: their keys would play
   * Retry or Menu over the next run.
   */
  const openSub = (open: ((back: () => void) => Screen) | undefined, button: HTMLButtonElement) => {
    if (!open || sub || !el.isConnected) return
    nav.off()
    el.classList.add('hidden')
    sub = open(() => {
      sub = null
      if (!el.isConnected) return
      el.classList.remove('hidden')
      nav = bindNav(buttons.indexOf(button))
    })
  }
  const buttons = [goOn, retry, back, lobby, share, boards].filter((b) => b !== null)
  const actions = [
    goOn && onContinue,
    onRetry,
    onMenu,
    onLobby,
    share && (() => openSub(extras.share?.open, share)),
    boards && (() => openSub(ranking?.open, boards)),
  ].filter((a) => typeof a === 'function')
  // Every button acts after the key dispatch: the screen it opens (Menu's partner select) would take the same press as its own.
  // Space is the special: pressed every second or so while it recharges, it picked Retry (or Continue) the moment the run ended,
  // so the results never showed and the run "restarted". Enter, a tap or pad A pick here.
  const bindNav = (initial = 0, guard = 0) => menu(input, buttons, (i) => later(() => actions[i]?.()), { horizontal: true, initial, guard, space: false })
  // The run ends mid-fight: pad A, still being pressed for the special, would pick the focused button (Retry).
  let nav = bindNav(0, RESULTS_GUARD_MS)

  const el = h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'dialog box pop wide' },
      h(
        'div',
        { class: 'portrait-wrap' },
        h('img', { class: 'result-portrait', src: sprites(playerDex(g), localPlayer(g).shiny).portrait, alt: '' }),
        localPlayer(g).shiny && h('img', { class: 'shiny-badge', src: sparkleIcon(), alt: 'Shiny' }),
      ),
      h('div', { class: 'dialog-title' }, victory ? m.victory : g.endless ? r.endlessOver(name) : m.fainted(name)),
      extras.badge,
      localPlayer(g).shiny && h('div', { class: 'tag tag-shiny' }, m.shiny(name)),
      reaperDefeats > 0 && h('div', { class: 'tag tag-shiny' }, r.reaperDefeated(reaperDefeats)),
      g.phase === 'gameover' && deathCause(localPlayer(g)),
      h(
        'div',
        { class: 'result-stats' },
        h('div', {}, h('span', {}, t().difficulty.label), h('b', {}, difficultyTag(g.difficulty))),
        h('div', {}, h('span', {}, m.time), h('b', {}, formatTime(g.time))),
        extra > 0 && h('div', {}, h('span', {}, r.overtime), h('b', {}, `+${formatTime(extra)}`)),
        h('div', {}, h('span', {}, m.level), h('b', {}, localPlayer(g).level)),
        h('div', {}, h('span', {}, m.kills), h('b', {}, g.kills)),
        g.halloween && h('div', { class: 'result-treats' }, h('span', {}, t().halloween.candies), h('b', {}, h('img', { src: treatIcon(), alt: '' }), `+${formatNumber(g.candies)}`)),
        legends.length > 0 &&
          h('div', {}, h('span', {}, r.legends), h('b', { class: 'result-legends' }, ...legends.map((id) => h('img', { src: portraitUrl(ENEMIES[id].dex), alt: ENEMIES[id].name, title: ENEMIES[id].name })))),
        g.place.cleared.length > 0 &&
          h('div', {}, h('span', {}, t().places.results), h('b', { class: 'result-legends' }, ...g.place.cleared.map((id) => h('img', { src: placeIcon(id), alt: t().places.names[id], title: t().places.names[id] })))),
        h('div', {}, h('span', {}, e.steps), h('b', {}, formatNumber(toSteps(localPlayer(g).walked)))),
        g.eggs.found.length > 0 &&
          h('div', {}, h('span', {}, e.eggs), h('b', { class: 'result-legends' }, ...g.eggs.found.map((egg) => h('img', { src: eggIcon(egg.tier), alt: e.tiers[egg.tier], title: e.tiers[egg.tier] })))),
      ),
      runNews(extras),
      ranking?.panel,
      goOn && h('p', { class: 'endless-hint' }, r.continueHint),
      h(
        'div',
        { class: 'earnings' },
        h('img', { src: coinIcon(2), alt: '' }),
        h('b', {}, `+${formatPokeDollars(earned.total)}`),
        h('span', {}, m.earnings(formatPokeDollars(earned.coins), formatPokeDollars(earned.bonus))),
      ),
      extras.report,
      damageList(g),
      h('div', { class: 'buttons result-buttons' }, ...buttons),
      victory && extras.credits,
      victory && h('a', { class: 'support-link result-support', href: ROUTES.support[locale()], target: '_blank', rel: 'noopener' }, `♥ ${m.support}`),
    ),
  )
  root.append(el)
  return { el, dispose: () => (sub?.dispose(), nav.off(), el.remove()) }
}

/* ---------------- Text box & flash (toasts and banners: `toasts.ts`) ---------------- */

/** Bottom dialog box, Pokémon style. Returns a disposer. */
export const textBox = (root: HTMLElement, text: string) => {
  const el = h('div', { class: 'textbox box' }, h('p', {}, text))
  root.append(el)
  return () => el.remove()
}

/** Full-screen white flash that fades out by itself. */
export const flashScreen = (root: HTMLElement) => {
  const el = h('div', { class: 'screen-flash' })
  root.append(el)
  setTimeout(() => el.remove(), 1000)
}
