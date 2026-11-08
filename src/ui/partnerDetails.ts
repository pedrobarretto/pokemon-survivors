import { playSfx } from '../engine/audio'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import type { PlayableDef } from '../data/starters'
import { TYPE_COLORS } from '../data/types'
import { MEGA, MEGAS, megasOf, type MegaId } from '../data/megas'
import { ABILITIES, BRANCH_ABILITIES, FAMILY_ABILITIES, isHidden, type AbilityId, type AbilitySet } from '../data/abilities'
import { BRANCHES, branchesAt, branchesOf, type BranchId } from '../data/branches'
import { abilityIcon } from '../render/abilityArt'
import { abilityChips } from './abilityPick'
import { unlockedAt } from '../game/learnsets'
import { branchNeeds } from '../game/evoItems'
import { EVO_ITEMS } from '../data/shop'
import { starterStats } from '../game/leveling'
import { MOVES, type MoveDef, type MoveId } from '../game/moves'
import { resolveSpecial } from '../game/special'
import { megaIcon } from '../render/megaFx'
import { moveIcon, sparkleIcon } from '../render/art'
import { specialIcon } from '../render/specialFx'
import { portraitUrl } from '../render/sprites'
import { t } from '../i18n'
import { boundLabel, glyphText, printedKeys } from './inputLabels'
import { h } from './dom'
import { tabStrip } from './shell'
import { STAT_BARS, statRatio } from './statBars'
import { typeBadge } from './screens'

/**
 * What the partner select shows about a playable Pokémon: stat bars, the
 * evolution line, the Normal/Shiny pick, and the details sheet with
 * everything else (all stats, the special, every move, the Megas).
 */

const moveRow = (id: MoveId, signature: boolean) => {
  const def: MoveDef = MOVES[id]
  return h(
    'div',
    { class: signature ? 'move-row signature' : 'move-row' },
    h('img', { src: moveIcon(id), alt: '' }),
    h('div', { class: 'move-text' }, h('div', { class: 'move-name' }, def.name, signature && h('span', { class: 'tag tag-new' }, t().title.signature)), h('div', { class: 'move-desc' }, t().moves[id].description)),
    typeBadge(def.type),
  )
}

/** The manual special (Space / round button): base move, upgraded (or swapped, for Aegislash) at the final stage. */
const specialRow = (id: PlayableId) => {
  const first = resolveSpecial(id, 0)
  const lastStage = PLAYABLE[id].line.length - 1
  const last = resolveSpecial(id, lastStage)
  // A family that branches at its final stage ends on the branch's special.
  const ends = [...new Map(branchesAt(id, lastStage).map((b) => resolveSpecial(id, lastStage, null, b)).map((r) => [r.id, r])).values()]
  if (ends.length > 1) {
    const names = ends.length > 2 ? '?' : ends.map((r) => r.tier.name).join(' / ')
    return h(
      'div',
      { class: 'move-row signature' },
      h('img', { src: specialIcon(first.id), alt: '' }),
      h('div', { class: 'move-text' }, h('div', { class: 'move-name' }, `${first.tier.name} → ${names}`), h('div', { class: 'move-desc' }, `${t().specials[first.id]} ${t().branch.specialNote}`)),
      typeBadge(first.def.type),
    )
  }
  const desc = first.id === last.id ? t().specials[first.id] : `${t().specials[first.id]} ${last.tier.name}: ${t().specials[last.id]}`
  return h(
    'div',
    { class: 'move-row signature' },
    h('img', { src: specialIcon(first.id), alt: '' }),
    h('div', { class: 'move-text' }, h('div', { class: 'move-name' }, `${first.tier.name} → ${last.tier.name}`), h('div', { class: 'move-desc' }, desc)),
    typeBadge(first.def.type),
  )
}

/** A learnset stage's header: its portraits, its name and when it comes (from the start, or the level it evolves at). */
const stageHead = (dex: readonly number[], name: string, when: string, cls = 'learn-stage') =>
  h(
    'div',
    { class: cls },
    h('span', { class: 'learn-portraits' }, ...dex.map((n) => h('img', { src: portraitUrl(n), alt: '' }))),
    h('b', {}, name),
    h('span', { class: 'learn-when' }, when),
  )

/**
 * The moves tab: the learnset stage by stage, what the family starts with and
 * then what each evolution unlocks. A branching evolution shows the moves
 * every branch learns, then each branch's own.
 */
const learnStages = (id: PlayableId) => {
  const s: PlayableDef = PLAYABLE[id]
  const rows = (moves: readonly MoveId[]) => h('div', { class: 'move-list' }, ...moves.map((mv) => moveRow(mv, mv === s.signature)))
  return s.line.flatMap((st, i) => {
    const level = i === 0 ? t().partner.learnStart : t().level(s.line[i - 1]!.evolveAt!)
    // A step that needs an item (Porygon2's Up-Grade) names it beside the level.
    const when = st.item ? `${level} · ${t().branch.needs(EVO_ITEMS[st.item].name)}` : level
    const branches = branchesAt(id, i)
    if (branches.length === 0) return [stageHead([st.dex], st.name, when), rows(unlockedAt(id, null, i))]
    const names = branches.map((b) => BRANCHES[b].name)
    const shared = unlockedAt(id, null, i)
    return [
      stageHead(
        branches.slice(0, 4).map((b) => BRANCHES[b].dex),
        branches.length > 2 ? t().branch.choose(branches.length) : names.join(' / '),
        when,
      ),
      ...(shared.length > 0 ? [rows(shared)] : []),
      ...branches.flatMap((b) => {
        const item = branchNeeds(b)
        return [stageHead([BRANCHES[b].dex], BRANCHES[b].name, item ? t().branch.needs(EVO_ITEMS[item].name) : '', 'learn-stage learn-branch'), rows(unlockedAt(id, b, i).filter((mv) => !shared.includes(mv)))]
      }),
    ]
  })
}

/** How a branching family evolves, before the abilities' note (empty for the others): Eevee's draw, or the paths items open. */
const branchNote = (id: PlayableId) => {
  const branches = branchesOf(id)
  if (branches.length === 0) return ''
  return `${branches.filter((b) => branchNeeds(b) === null).length > 1 ? t().branch.noteDraw : t().branch.noteItems} `
}

/** One of a line's Mega Evolutions: how it's earned, how long it lasts, its ability and what it does. */
const megaRow = (id: MegaId) => {
  const def = MEGAS[id]
  return h(
    'div',
    { class: 'move-row signature' },
    h('img', { src: megaIcon(), alt: '' }),
    h(
      'div',
      { class: 'move-text' },
      h('div', { class: 'move-name' }, `${def.name} · ${def.ability}`),
      h('div', { class: 'move-desc' }, `${t().mega.how(def.stone, MEGA.duration, MEGA.recharge)} ${t().mega.effects[id]}`),
    ),
  )
}

/** One of a family's abilities: icon, name (the Hidden one tagged) and what it does. */
const abilityRow = (id: AbilityId, hidden: boolean) =>
  h(
    'div',
    { class: hidden ? 'move-row ability-row hidden-ability' : 'move-row ability-row' },
    h('img', { src: abilityIcon(id), alt: '' }),
    h(
      'div',
      { class: 'move-text' },
      h('div', { class: 'move-name' }, ABILITIES[id].name, hidden && h('span', { class: 'tag tag-hidden' }, t().ability.hidden)),
      h('div', { class: 'move-desc' }, t().abilities[id]),
    ),
  )

/**
 * The abilities a family picks from at its first evolution. A family whose
 * first evolution branches (Eevee) gets them from the branch: a line of chips per branch.
 */
const abilityRows = (id: PlayableId) => {
  const own: Partial<Record<BranchId, AbilitySet>> = BRANCH_ABILITIES
  const branched = branchesOf(id).filter((b) => own[b] !== undefined)
  if (branched.length === 0) {
    const set: AbilitySet = FAMILY_ABILITIES[id]
    return set.map((ability, i) => abilityRow(ability, isHidden(set, i)))
  }
  return branched.map((b) =>
    h('div', { class: 'branch-abilities' }, h('img', { src: portraitUrl(BRANCHES[b].dex), alt: '' }), h('b', {}, BRANCHES[b].name), abilityChips(own[b]!)),
  )
}

/** Base (first stage) and evolved (final stage) bars of the first `count` stats (four on the partner panel, all of them in the details). */
export const statBars = (id: PlayableId, count: number = STAT_BARS.length) => {
  const m = t()
  const base = starterStats(id, 0)
  const final = starterStats(id, PLAYABLE[id].line.length - 1)
  return h(
    'div',
    { class: 'stat-bars' },
    ...STAT_BARS.slice(0, count).map((b) =>
      h(
        'div',
        { class: 'stat-bar' },
        h('span', { class: 'stat-label' }, m.stats[b.label]),
        h(
          'div',
          { class: 'bar' },
          h('div', { class: 'bar-final', style: `width:${statRatio(b.get(final), b.min, b.max) * 100}%` }),
          h('div', { class: 'bar-base', style: `width:${statRatio(b.get(base), b.min, b.max) * 100}%` }),
        ),
        h('b', {}, b.fmt(b.get(base))),
      ),
    ),
  )
}

/** The "base / evolved" key of the stat bars. */
const legend = () => {
  const m = t().title
  return h('span', { class: 'legend' }, h('i', { class: 'legend-base' }), `${m.legendBase} `, h('i', { class: 'legend-final' }), m.legendFinal)
}

/** The evolution line: a portrait per stage and the level between them; tapping a stage previews it (`onStage`). */
export const evoLine = (id: PlayableId, stage: number, onStage: (stage: number) => void) => {
  const s: PlayableDef = PLAYABLE[id]
  return h(
    'div',
    { class: 'evo-line' },
    ...s.line.flatMap((st, i) => {
      const branches = branchesAt(id, i)
      const names = branches.map((b) => BRANCHES[b].name)
      return [
        i > 0 && h('span', { class: 'evo-arrow' }, t().level(s.line[i - 1]!.evolveAt!), h('br'), '▶'),
        branches.length > 0
          ? // A branching evolution: every way it can go, picked in the run.
            h(
              'button',
              { class: i === stage ? 'evo-stage evo-branches selected' : 'evo-stage evo-branches', type: 'button', onclick: () => onStage(i), title: names.join(' / ') },
              h('span', { class: 'evo-branch-grid', style: `--n:${Math.min(4, branches.length)}` }, ...branches.map((b) => h('img', { src: portraitUrl(BRANCHES[b].dex), alt: BRANCHES[b].name }))),
              h('span', { class: 'evo-name' }, branches.length > 2 ? t().branch.choose(branches.length) : names.join(' / ')),
            )
          : h(
              'button',
              { class: i === stage ? 'evo-stage selected' : 'evo-stage', type: 'button', onclick: () => onStage(i), title: st.name },
              h('img', { src: portraitUrl(st.dex), alt: st.name }),
              h('span', { class: 'evo-name' }, st.name),
              h('span', { class: 'evo-types' }, ...st.types.map((type) => h('i', { style: `--type:${TYPE_COLORS[type]}`, title: type }))),
            ),
      ]
    }),
  )
}

/**
 * Normal / Shiny, for a Pokémon whose shiny the player owns (rolled once, a
 * ticket or a shiny hatch; `Z` flips it). The screen saves the pick right
 * away, so the next run plays it.
 */
export const shinyPicker = (shiny: boolean, set: (shiny: boolean) => void) => {
  const m = t().title
  const option = (value: boolean, label: Node | string) =>
    h('button', { class: value === shiny ? 'shiny-option selected' : 'shiny-option', type: 'button', role: 'radio', 'aria-checked': String(value === shiny), onclick: () => set(value) }, label)
  return h(
    'div',
    { class: 'shiny-picker', role: 'radiogroup', 'aria-label': m.shinyPick },
    option(false, m.normal),
    option(true, h('span', {}, h('img', { src: sparkleIcon(), alt: '' }), m.shiny)),
    h('span', { class: 'key-hint' }, printedKeys('Z')),
  )
}

const section = (label: string, aside?: Node | string) => h('div', { class: 'inspect-section' }, label, aside && h('span', { class: 'legend' }, aside))

type SheetTab = 'status' | 'moves' | 'mega'

type SheetOpts = {
  id: PlayableId
  stage: number
  shiny: boolean
  /** A stage tapped in the sheet's evolution line: the partner panel previews it too. */
  onStage: (stage: number) => void
  /** The sheet's own start button: the screen's start, already colored for the difficulty (`go`). */
  go: HTMLButtonElement
  onClose: () => void
}

/**
 * Everything the old inspect panel had, on demand: a bottom sheet on phones,
 * a dialog on wider screens (CSS decides), with Status / Moves / Mega tabs
 * (no Mega tab for lines without one) and a start button of its own.
 * `onKey` takes the screen's keys while it's open and says whether it used
 * them: Esc/Backspace close, ← → Tab Q E switch tabs, ↑ ↓ scroll, Enter starts.
 */
export const detailsSheet = (opts: SheetOpts) => {
  const m = t()
  const { id, shiny, go } = opts
  let stage = opts.stage
  const megas = megasOf(id)
  const tabs: readonly SheetTab[] = megas.length > 0 ? ['status', 'moves', 'mega'] : ['status', 'moves']
  let tab = 0

  const head = h('div', { class: 'partner-sheet-id' })
  const body = h('div', { class: 'partner-sheet-body' })
  const strip = tabStrip(
    tabs.map((k) => m.partner.tabs[k]),
    tab,
    (i) => setTab(i),
  )
  strip.el.classList.add('partner-sheet-tabs')

  const render = () => {
    const form = PLAYABLE[id].line[stage]!
    head.replaceChildren(
      h('img', { class: 'partner-sheet-portrait', src: portraitUrl(form.dex, shiny), alt: '' }),
      h('div', {}, h('div', { class: 'partner-sheet-name' }, form.name), h('div', { class: 'types' }, ...form.types.map(typeBadge))),
    )
    const k = tabs[tab]!
    body.replaceChildren(
      ...(k === 'status'
        ? [
            section(m.title.statsSection, legend()),
            statBars(id),
            section(m.title.evolution),
            evoLine(id, stage, (i) => {
              stage = i
              playSfx('move')
              opts.onStage(i)
              render()
            }),
            section(m.title.special, h('span', {}, ...glyphText(boundLabel('special')))),
            specialRow(id),
            section(branchesOf(id).some((b) => b in BRANCH_ABILITIES) ? m.ability.sectionBranch : m.ability.section),
            h('div', { class: 'move-list' }, ...abilityRows(id)),
            h('p', { class: 'ability-note' }, `${branchNote(id)}${m.ability.note}`),
          ]
        : k === 'moves'
          ? [section(m.title.moves), h('p', { class: 'learn-note' }, m.partner.learnNote), ...learnStages(id)]
          : [section(megas.length > 1 ? m.mega.sectionTwo : m.mega.section, h('span', {}, ...glyphText(boundLabel('mega')))), ...megas.map(megaRow)]),
    )
    body.scrollTop = 0
  }

  const setTab = (i: number) => {
    const next = (i + tabs.length) % tabs.length
    if (next === tab) return
    tab = next
    playSfx('move')
    strip.set(tab)
    render()
  }

  const close = h(
    'button',
    { class: 'shell-btn shell-icon box partner-sheet-close', type: 'button', 'aria-label': m.partner.close, title: m.partner.close, onclick: () => opts.onClose() },
    h('span', { 'aria-hidden': 'true' }, '✕'),
    h('span', { class: 'key-hint' }, 'ESC'),
  )

  const sheet = h(
    'section',
    { class: 'partner-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': PLAYABLE[id].name },
    h('div', { class: 'partner-sheet-grip', 'aria-hidden': 'true' }),
    h('div', { class: 'partner-sheet-head' }, head, close),
    strip.el,
    body,
    go,
  )
  sheet.style.setProperty('--accent', PLAYABLE[id].color)
  // The scrim closes it; taps inside the sheet stay inside.
  const el = h('div', { class: 'partner-sheet-scrim', onclick: (e: Event) => e.target === e.currentTarget && opts.onClose() }, sheet)
  render()

  const onKey = (key: string) => {
    if (key === 'Escape' || key === 'Backspace') opts.onClose()
    else if (key === 'ArrowLeft' || key === 'KeyA' || key === 'KeyQ') setTab(tab - 1)
    else if (key === 'ArrowRight' || key === 'KeyD' || key === 'KeyE' || key === 'Tab') setTab(tab + 1)
    else if (key === 'ArrowUp' || key === 'KeyW') body.scrollBy({ top: -48 })
    else if (key === 'ArrowDown' || key === 'KeyS') body.scrollBy({ top: 48 })
    else if (key === 'Enter' || key === 'Space') go.click()
    else return false
    return true
  }

  return { el, onKey, go }
}
