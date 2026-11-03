import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { ABILITIES, BRANCH_ABILITIES, isHidden, type AbilityId, type AbilitySet } from '../data/abilities'
import { BRANCHES, type BranchDef, type BranchId } from '../data/branches'
import { EVO_ITEMS } from '../data/shop'
import { evoItemFor } from '../game/evoItems'
import { TYPE_COLORS } from '../data/types'
import { playerForm } from '../game/branch'
import { MOVES } from '../game/moves'
import { resolveSpecial } from '../game/special'
import type { StatDelta } from '../game/stats'
import type { Game, Offer } from '../game/types'
import { weatherHere } from '../game/weather'
import { abilityIcon } from '../render/abilityArt'
import { moveIcon, sparkleIcon } from '../render/art'
import { specialIcon } from '../render/specialFx'
import { portraitUrl } from '../render/sprites'
import { t } from '../i18n'
import { h } from './dom'
import { shopIcon } from './shopIcons'
import { hint, menu, typeBadge, type Screen } from './screens'
import { localPlayer } from '../game/players'
import { buildTag, followsBuild } from './buildMark'

/**
 * The two picks evolutions bring (`game/game.ts`): where a branching
 * evolution goes, and the ability the first evolution awakens. Both show the
 * options as cards that land one after the other (portraits come out of a
 * silhouette, ability cards flip over), and both go through `onChoose` like a
 * level-up pick, so the replay records them as `offer` events.
 */

/** Taps this soon after the cards land are ignored, so a thumb still on the joystick can't pick. */
const GUARD_MS = 650
/** The picked card's flourish before the screen closes. */
const PICK_MS = 380

/** Up to three stat changes of a branch, the ones that tell the branches apart most. */
const statLines = (d: StatDelta) => {
  const s = t().stats
  const pct = (v: number) => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`
  const lines: Array<readonly [number, string]> = [
    [Math.abs(d.might ?? 0) * 200, `${s.damage} ${pct(d.might ?? 0)}`],
    [Math.abs(d.maxHp ?? 0) / 2, `${s.hp} +${d.maxHp ?? 0}`],
    [Math.abs(d.armor ?? 0) * 15, `${s.defense} +${d.armor ?? 0}`],
    [Math.abs(d.speed ?? 0) * 3, `${s.speed} +${d.speed ?? 0}`],
    [Math.abs(d.regen ?? 0) * 40, `${s.regen} +${(d.regen ?? 0).toLocaleString()}/s`],
    [Math.abs(d.cooldown ?? 0) * 300, `${s.cooldown} ${pct(d.cooldown ?? 0)}`],
    [Math.abs(d.area ?? 0) * 150, `${s.area} ${pct(d.area ?? 0)}`],
  ]
  return lines.filter(([w]) => w > 0).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, text]) => text)
}

/** A row of ability names, the Hidden one marked. */
export const abilityChips = (set: AbilitySet) =>
  h(
    'div',
    { class: 'ability-chips' },
    ...set.map((id, i) =>
      h('span', { class: isHidden(set, i) ? 'ability-chip hidden-ability' : 'ability-chip' }, h('img', { src: abilityIcon(id), alt: '' }), ABILITIES[id].name),
    ),
  )

/** Keyboard (arrows both ways, 1-3, Enter), pointer and the guard, shared by both picks. */
const pickNav = (input: Input, cards: HTMLElement[], onPick: (i: number) => void) => {
  const openedAt = performance.now()
  let done = false
  const nav = menu(input, cards, (i) => {
    if (done || performance.now() - openedAt < GUARD_MS) return
    done = true
    playSfx('select')
    cards[i]!.classList.add('picked')
    cards.forEach((c, j) => j !== i && c.classList.add('passed'))
    setTimeout(() => onPick(i), PICK_MS)
  }, { horizontal: true })
  // Stacked cards on a phone held upright: up and down move too.
  const off = input.onKey((key) => {
    if (key === 'ArrowUp' || key === 'KeyW') nav.focus(nav.index - 1)
    else if (key === 'ArrowDown' || key === 'KeyS') nav.focus(nav.index + 1)
  })
  return () => (nav.off(), off())
}

/* ---------------- Branching evolution ---------------- */

const branchCard = (g: Game, offer: Extract<Offer, { kind: 'form' }>, i: number) => {
  const m = t()
  const def: BranchDef = BRANCHES[offer.id]
  const special = resolveSpecial(localPlayer(g).starter, def.stage, null, offer.id)
  const own: Partial<Record<BranchId, AbilitySet>> = BRANCH_ABILITIES
  const abilities = own[offer.id]
  const item = offer.favor === 'item' ? evoItemFor(offer.id) : null
  const favor =
    offer.favor === 'weather' ? m.world.weather[weatherHere(g)]
    : offer.favor === 'biome' ? m.world.biomes[g.biome.id]
    : null
  const [main, second] = def.types
  const card = h(
    'button',
    {
      class: favor || item ? 'evo-card favored' : 'evo-card',
      type: 'button',
      style: `--type:${TYPE_COLORS[main ?? 'normal']};--type2:${TYPE_COLORS[second ?? main ?? 'normal']};--i:${i}`,
    },
    h('span', { class: 'offer-key' }, i + 1),
    favor && h('span', { class: 'evo-card-favor' }, h('img', { src: sparkleIcon(), alt: '' }), m.branch.favored(favor)),
    item && h('span', { class: 'evo-card-favor item' }, shopIcon(item), m.branch.unlocked(EVO_ITEMS[item].name)),
    h('div', { class: 'evo-card-art' }, h('img', { class: 'evo-card-portrait', src: portraitUrl(def.dex, localPlayer(g).shiny), alt: '' })),
    h('div', { class: 'evo-card-name' }, def.name, followsBuild(g, offer) && buildTag()),
    h('div', { class: 'types' }, ...def.types.map(typeBadge)),
    h('div', { class: 'evo-card-stats' }, ...statLines(def.bonus).map((line) => h('span', {}, line))),
    h(
      'dl',
      { class: 'evo-card-facts' },
      h('div', {}, h('dt', {}, m.branch.special), h('dd', {}, h('img', { src: specialIcon(special.id), alt: '' }), special.tier.name)),
      h('div', {}, h('dt', {}, m.branch.moves), h('dd', { class: 'evo-card-moves' }, ...def.moves.map((id) => h('img', { src: moveIcon(id), alt: MOVES[id].name, title: MOVES[id].name })))),
      abilities && h('div', {}, h('dt', {}, m.branch.abilities), h('dd', {}, abilityChips(abilities))),
    ),
  )
  return card
}

/** Where a branching evolution goes: a card per option, with what it changes. */
export const branchPick = (root: HTMLElement, input: Input, g: Game, onChoose: (offer: Offer) => void): Screen => {
  const m = t()
  const cards = localPlayer(g).offers.map((offer, i) => (offer.kind === 'form' ? branchCard(g, offer, i) : h('span')))
  const off = pickNav(input, cards, (i) => {
    const offer = localPlayer(g).offers[i]
    if (offer) onChoose(offer)
  })
  const el = h(
    'div',
    { class: 'screen dim evo-pick' },
    h('div', { class: 'evo-pick-head' }, h('div', { class: 'evo-pick-title' }, m.branch.title(playerForm(g).name)), h('p', { class: 'evo-pick-sub' }, m.branch.subtitle)),
    h('div', { class: 'evo-cards' }, ...cards),
    hint(m.levelUp.sideHintKeys, m.levelUp.hintTouch),
  )
  // Rows of up to four: stones can open more ways than fit on one row.
  el.style.setProperty('--count', String(Math.min(cards.length, 4)))
  root.append(el)
  playSfx('evolve')
  return { el, dispose: () => (off(), el.remove()) }
}

/* ---------------- Ability ---------------- */

const abilityCard = (id: AbilityId, hidden: boolean, i: number, build: boolean) => {
  const m = t()
  return h(
    'button',
    { class: hidden ? 'ability-card hidden-ability' : 'ability-card', type: 'button', style: `--i:${i}` },
    h('span', { class: 'offer-key' }, i + 1),
    hidden && h('span', { class: 'ability-card-ribbon' }, h('img', { src: sparkleIcon(), alt: '' }), m.ability.hiddenLong),
    h('div', { class: 'ability-card-icon' }, h('img', { src: abilityIcon(id), alt: '' })),
    h('div', { class: 'ability-card-text' }, h('div', { class: 'ability-card-name' }, ABILITIES[id].name, build && buildTag()), h('p', { class: 'ability-card-desc' }, m.abilities[id])),
  )
}

/** The ability the first evolution awakens: three cards, the Hidden one in its own frame. */
export const abilityPick = (root: HTMLElement, input: Input, g: Game, onChoose: (offer: Offer) => void): Screen => {
  const m = t()
  const cards = localPlayer(g).offers.map((offer, i) => (offer.kind === 'ability' ? abilityCard(offer.id, offer.hidden, i, followsBuild(g, offer)) : h('span')))
  const off = pickNav(input, cards, (i) => {
    const offer = localPlayer(g).offers[i]
    if (offer) onChoose(offer)
  })
  const form = playerForm(g)
  const el = h(
    'div',
    { class: 'screen dim ability-pick' },
    h(
      'div',
      { class: 'evo-pick-head' },
      h('img', { class: 'ability-pick-portrait', src: portraitUrl(form.dex, localPlayer(g).shiny), alt: '' }),
      h('div', {}, h('div', { class: 'evo-pick-title' }, m.ability.title(form.name)), h('p', { class: 'evo-pick-sub' }, m.ability.subtitle)),
    ),
    h('div', { class: 'ability-cards' }, ...cards),
    hint(m.levelUp.sideHintKeys, m.levelUp.hintTouch),
  )
  root.append(el)
  playSfx('unlock')
  return { el, dispose: () => (off(), el.remove()) }
}
