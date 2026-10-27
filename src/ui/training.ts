import { playSfx } from '../engine/audio'
import { ABILITIES } from '../data/abilities'
import { ENEMIES } from '../data/enemies'
import { evolutionOf, evolvedFrom } from '../data/evolutions'
import { PLAYABLE } from '../data/hatchlings'
import { ITEM_IDS, ITEMS, type ItemDef, type ItemId } from '../data/items'
import { TRAINING, TRAINING_TARGETS, type TrainingTarget } from '../data/training'
import type { PokeType } from '../data/types'
import { abilitySet } from '../game/abilities'
import { formAt } from '../game/branch'
import { MAX_ITEMS, MAX_MOVES } from '../game/leveling'
import { branchAt, forkAt, maxMoveLevel, MOVES, type MoveId } from '../game/moves'
import { localPlayer } from '../game/players'
import { resolveSpecial } from '../game/special'
import { shownLegends } from '../game/festival'
import { brasiliaDay } from '../game/day'
import {
  createMeter,
  METER,
  MOVE_SHELVES,
  moveBlock,
  readMeter,
  sampleMeter,
  setAbility,
  setFork,
  setForm,
  setItem,
  setMove,
  shelfMoves,
  trainingForms,
  type DpsMeter,
  type MoveShelf,
} from '../game/training'
import type { DamageSource, Game } from '../game/types'
import { formatNumber, t } from '../i18n'
import { abilityIcon } from '../render/abilityArt'
import { itemIcon, moveIcon } from '../render/art'
import { portraitUrl } from '../render/sprites'
import { specialIcon } from '../render/specialFx'
import { h, setText } from './dom'
import { today } from './save'
import { holdMoveCard, hoverMoveCard, moveCard } from './moveCard'
import { typeBadge, type Screen } from './screens'

/**
 * The Dojo's panel, over a training run (`game/training.ts`): the damage meter
 * on top, then four tabs to set the run as the player likes (moves with their
 * levels and forks, held items, the form and ability, the dummies), and the
 * build's buttons. The moves tab has three shelves: the family's own moves,
 * every TM and the legendaries' capstones. Every change goes straight into the
 * running game, so the moves play out on the dummies at once. The panel slides
 * to the right on wide screens and up from the bottom on a phone held upright,
 * and folds down to the meter alone to see the whole field; the camera keeps
 * the player in the middle of the field it leaves open (`actions.lens`).
 */

type Tab = 'moves' | 'items' | 'form' | 'targets'
/** What a tab lays out (`h` children: a part a tab doesn't have is null or false). */
type Part = Node | null | false
const TABS: readonly Tab[] = ['moves', 'items', 'form', 'targets']

export type TrainingActions = {
  /** Brings `count` dummies of `target` (the shell loads the species' sprites first). */
  dummies: (target: TrainingTarget, count: number) => void
  /** Saves what the player carries now as the family's build. */
  save: () => void
  /** Drops the family's saved build; null when none is saved. */
  clear: (() => void) | null
  /** Leaves the Dojo, back to the lobby. */
  leave: () => void
  /** Where the player should stand on screen: the middle of the field the panel leaves open, from the screen's center (CSS px). */
  lens: (x: number, y: number) => void
}

/** The damage source's name and icon: a move, the special or the ability. */
const sourceView = (g: Game, source: DamageSource) => {
  const p = localPlayer(g)
  if (source === 'special') {
    const special = resolveSpecial(p.starter, p.stage, p.mega.active > 0 ? p.mega.stone : null, p.branch)
    return { name: special.tier.name, icon: specialIcon(special.id) }
  }
  if (source === 'ability') return { name: p.ability.id ? ABILITIES[p.ability.id].name : t().training.ability, icon: p.ability.id ? abilityIcon(p.ability.id) : '' }
  return { name: MOVES[source].name, icon: moveIcon(source) }
}

const whole = (n: number) => formatNumber(Math.round(n))

/** A − n + stepper: `set` gets the next level (0 forgets), the label says where it stands. */
const stepper = (level: number, max: number, set: (level: number) => void, labelOf: (level: number) => string) =>
  h(
    'div',
    { class: 'dojo-step' },
    h('button', { class: 'dojo-step-btn', type: 'button', 'aria-label': '−', disabled: level <= 0, onclick: () => set(level - 1) }, '−'),
    h('span', { class: 'dojo-step-level' }, labelOf(level)),
    h('button', { class: 'dojo-step-btn', type: 'button', 'aria-label': '+', disabled: level >= max, onclick: () => set(level + 1) }, '+'),
  )

export const trainingPanel = (root: HTMLElement, g: Game, actions: TrainingActions): Screen & { refresh: (clear: (() => void) | null) => void } => {
  const m = () => t().training
  let tab: Tab = 'moves'
  let shelf: MoveShelf = 'family'
  const legends = shownLegends(brasiliaDay(today()))
  // A phone held upright opens on the field: the panel folds to the meter until asked for.
  let folded = matchMedia('(orientation: portrait) and (max-width: 700px)').matches
  let meter: DpsMeter = createMeter(g.now)
  let count: number = TRAINING.counts[0]
  let shownAt = -Infinity
  let clear = actions.clear

  const me = () => localPlayer(g)

  /* ---------- The meter ---------- */

  const dpsEl = h('b', { class: 'dojo-dps-value' }, '0')
  const averageEl = h('span', {}, '')
  const totalEl = h('span', {}, '')
  const sourcesEl = h('div', { class: 'dojo-sources' })
  const meterEl = h(
    'section',
    { class: 'dojo-meter', 'aria-live': 'off' },
    h('div', { class: 'dojo-dps' }, h('span', { class: 'dojo-dps-label' }, m().dps), dpsEl, h('small', {}, m().dpsHint(METER.window))),
    h('div', { class: 'dojo-meter-row' }, averageEl, totalEl),
    sourcesEl,
  )

  const paintMeter = () => {
    const r = readMeter(meter)
    setText(dpsEl, whole(r.dps))
    setText(averageEl, `${m().average}: ${whole(r.average)}`)
    setText(totalEl, `${m().total}: ${whole(r.total)}`)
    const top = r.bySource[0]?.dps ?? 0
    sourcesEl.replaceChildren(
      ...(r.bySource.length === 0
        ? [h('p', { class: 'dojo-empty' }, m().noDamage)]
        : r.bySource.slice(0, MAX_MOVES + 2).map(({ source, dps }) => {
            const v = sourceView(g, source)
            return h(
              'div',
              { class: 'dojo-source', style: `--share:${top > 0 ? dps / top : 0}` },
              v.icon ? h('img', { src: v.icon, alt: '' }) : h('span'),
              h('span', { class: 'dojo-source-name' }, v.name),
              h('span', { class: 'dojo-source-dps' }, whole(dps)),
            )
          })),
    )
  }

  /* ---------- The tabs ---------- */

  const changed = () => {
    playSfx('move')
    render()
  }

  const movesTab = (): Part[] => {
    const p = me()
    const owned = (id: MoveId) => p.moves.find((x) => x.id === id)
    const rows = shelfMoves(shelf, p.starter, p.branch, legends).map((id) => {
      const o = owned(id)
      const level = o?.level ?? 0
      const max = maxMoveLevel(id)
      const base = evolvedFrom(id)?.from
      const set = (lv: number) => {
        if (!setMove(g, id, lv)) return void playSfx('denied')
        changed()
      }
      // A new move needs a free slot (unless it takes its base's or evolution's), and a run teaches one manual and one legendary move.
      const blocked = o ? null : moveBlock(g, id)
      const forks = o
        ? [4, 7].flatMap((at) => {
            const fork = forkAt(id, at)
            const text = t().moves[id].upgrades[at - 2]
            if (!fork || level < at || typeof text !== 'object') return []
            const pick = branchAt(o.path ?? 0, at - 2)
            return [
              h(
                'div',
                { class: 'dojo-fork' },
                h('span', { class: 'dojo-fork-at' }, m().forkAt(at)),
                ...([0, 1] as const).map((b) =>
                  h(
                    'button',
                    { class: pick === b ? 'dojo-chip on' : 'dojo-chip', type: 'button', title: text.fork[b].desc, onclick: () => (setFork(g, id, at, b), changed()) },
                    `${b === 0 ? 'A' : 'B'} · ${text.fork[b].name}`,
                  ),
                ),
              ),
            ]
          })
        : []
      const icon = h('img', { class: 'dojo-row-icon', src: moveIcon(id), alt: '' })
      hoverMoveCard(icon, () => moveCard(g, id, { level: Math.max(1, level), path: o?.path ?? 0 }))
      const row = h(
        'div',
        { class: ['dojo-row', o && 'on', base && 'evolved'].filter(Boolean).join(' ') },
        icon,
        h(
          'div',
          { class: 'dojo-row-body' },
          h('div', { class: 'dojo-row-name' }, MOVES[id].name, typeBadge(MOVES[id].type)),
          base && h('small', { class: 'dojo-row-note' }, m().evolvedFrom(MOVES[base].name, evolutionOf(base) ? ITEMS[evolutionOf(base)!.item].name : '')),
          ...forks,
        ),
        blocked
          ? h('small', { class: 'dojo-row-full' }, { full: m().movesFull, manual: m().manualFull, legendary: m().legendaryFull }[blocked])
          : o
            ? stepper(level, max, set, (lv) => (lv === 0 ? m().forget : m().level(lv)))
            : h('button', { class: 'dojo-learn', type: 'button', onclick: () => set(1) }, m().learn),
      )
      holdMoveCard(row, () => moveCard(g, id, { level: Math.max(1, level), path: o?.path ?? 0 }))
      return row
    })
    return [
      h(
        'div',
        { class: 'dojo-shelves', role: 'tablist' },
        ...MOVE_SHELVES.map((k) => h('button', { class: k === shelf ? 'dojo-chip on' : 'dojo-chip', type: 'button', role: 'tab', 'aria-selected': String(k === shelf), onclick: () => ((shelf = k), (body.scrollTop = 0), changed()) }, m().shelves[k])),
        h('span', { class: 'dojo-slots' }, m().slots(p.moves.length, MAX_MOVES)),
      ),
      shelf !== 'family' && h('p', { class: 'dojo-shelf-note' }, m().shelfNote[shelf]),
      ...rows,
    ]
  }

  const itemsTab = (): Part[] => {
    const p = me()
    // Type items only for the types the family's moves (and the TMs carried) have, as the level-ups offer them.
    const types = new Set<PokeType>([...shelfMoves('family', p.starter, p.branch, legends), ...p.moves.map((o) => o.id)].map((id) => MOVES[id].type))
    const full = p.items.length >= MAX_ITEMS
    const rows = ITEM_IDS.filter((id) => {
      const def: ItemDef = ITEMS[id]
      return !def.boosts || types.has(def.boosts)
    }).map((id: ItemId) => {
      const o = p.items.find((i) => i.id === id)
      const level = o?.level ?? 0
      const set = (lv: number) => {
        if (!setItem(g, id, lv)) return void playSfx('denied')
        changed()
      }
      return h(
        'div',
        { class: o ? 'dojo-row on' : 'dojo-row' },
        h('img', { class: 'dojo-row-icon', src: itemIcon(id), alt: '' }),
        h('div', { class: 'dojo-row-body' }, h('div', { class: 'dojo-row-name' }, ITEMS[id].name), h('small', { class: 'dojo-row-note' }, t().items[id])),
        !o && full
          ? h('small', { class: 'dojo-row-full' }, m().itemsFull)
          : o
            ? stepper(level, ITEMS[id].levels.length, set, (lv) => (lv === 0 ? m().remove : m().level(lv)))
            : h('button', { class: 'dojo-learn', type: 'button', onclick: () => set(1) }, m().hold),
      )
    })
    return [h('p', { class: 'dojo-slots' }, m().slots(p.items.length, MAX_ITEMS)), ...rows]
  }

  const formTab = (): Part[] => {
    const p = me()
    const forms = trainingForms(p.starter).map((f) => {
      const form = formAt(p.starter, f.branch, f.stage)
      const on = p.stage === f.stage && (f.branch === null || p.branch === f.branch)
      return h(
        'button',
        { class: on ? 'dojo-form on' : 'dojo-form', type: 'button', onclick: () => (setForm(g, f.stage, f.branch), changed()) },
        h('img', { src: portraitUrl(form.dex, p.shiny), alt: '' }),
        h('span', {}, form.name),
      )
    })
    const set = abilitySet(p.starter, p.branch)
    const abilities =
      p.stage === 0 && PLAYABLE[p.starter].line.length > 1
        ? [h('p', { class: 'dojo-empty' }, m().abilityLater)]
        : [
            h('button', { class: p.ability.id === null ? 'dojo-chip on' : 'dojo-chip', type: 'button', onclick: () => (setAbility(g, null), changed()) }, m().noAbility),
            ...set.map((id) =>
              h(
                'button',
                { class: p.ability.id === id ? 'dojo-chip dojo-ability on' : 'dojo-chip dojo-ability', type: 'button', title: t().abilities[id], onclick: () => (setAbility(g, id), changed()) },
                h('img', { src: abilityIcon(id), alt: '' }),
                ABILITIES[id].name,
              ),
            ),
          ]
    const ability = p.ability.id
    return [
      h('h3', { class: 'dojo-label' }, m().form),
      h('div', { class: 'dojo-forms' }, ...forms),
      h('h3', { class: 'dojo-label' }, m().ability),
      h('div', { class: 'dojo-chips' }, ...abilities),
      ability && h('p', { class: 'dojo-row-note' }, t().abilities[ability]),
    ]
  }

  const targetsTab = (): Part[] => {
    const target = g.training?.target ?? TRAINING.target
    return [
      h('h3', { class: 'dojo-label' }, m().count),
      h(
        'div',
        { class: 'dojo-chips' },
        ...TRAINING.counts.map((n) =>
          h('button', { class: n === count ? 'dojo-chip on' : 'dojo-chip', type: 'button', onclick: () => ((count = n), actions.dummies(target, n), changed()) }, m().countOf(n)),
        ),
      ),
      h('h3', { class: 'dojo-label' }, m().target),
      h(
        'div',
        { class: 'dojo-targets' },
        ...TRAINING_TARGETS.map((id) => {
          const def = ENEMIES[id]
          return h(
            'button',
            { class: id === target ? 'dojo-target on' : 'dojo-target', type: 'button', onclick: () => (actions.dummies(id, count), changed()) },
            h('img', { src: portraitUrl(def.dex), alt: '' }),
            h('span', { class: 'dojo-target-name' }, def.name, 'boss' in def && h('em', {}, m().boss)),
            h('span', { class: 'types' }, ...def.types.map(typeBadge)),
          )
        }),
      ),
    ]
  }

  const TAB_VIEWS = { moves: movesTab, items: itemsTab, form: formTab, targets: targetsTab } as const satisfies Record<Tab, () => Part[]>

  /* ---------- The frame ---------- */

  const tabButtons = TABS.map((k) => h('button', { class: 'shop-tab', type: 'button', onclick: () => ((tab = k), playSfx('move'), render()) }, t().training.tabs[k]))
  const body = h('div', { class: 'dojo-body' })
  const head = h('div', { class: 'dojo-who' })
  const saveBtn = h('button', { class: 'btn dojo-save', type: 'button', onclick: () => actions.save() }, m().save)
  const clearBtn = h('button', { class: 'btn dojo-clear', type: 'button', onclick: () => clear?.() }, m().clear)
  const foldBtn = h('button', { class: 'btn dojo-fold', type: 'button', onclick: () => ((folded = !folded), playSfx('move'), render()) })
  const el = h(
    'aside',
    { class: 'dojo-panel box', 'aria-label': m().title },
    h(
      'div',
      { class: 'dojo-head' },
      head,
      h('button', { class: 'btn dojo-reset', type: 'button', onclick: () => ((meter = createMeter(g.now)), (me().damageByMove = {}), playSfx('move'), paintMeter()) }, m().reset),
      foldBtn,
    ),
    meterEl,
    h('div', { class: 'shop-tabs dojo-tabs' }, ...tabButtons),
    body,
    h('div', { class: 'dojo-actions' }, saveBtn, clearBtn, h('button', { class: 'btn dojo-leave', type: 'button', onclick: () => actions.leave() }, m().leave)),
  )

  /** Rebuilds the panel around what the player carries now (the meter keeps going). */
  function render() {
    const p = me()
    const form = formAt(p.starter, p.branch, p.stage)
    head.replaceChildren(h('img', { src: portraitUrl(form.dex, p.shiny), alt: '' }), h('b', {}, form.name), h('small', {}, m().title))
    TABS.forEach((k, i) => tabButtons[i]!.classList.toggle('on', k === tab))
    const scroll = body.scrollTop
    body.replaceChildren(...TAB_VIEWS[tab]().filter((n) => n instanceof Node))
    body.scrollTop = scroll
    requestAnimationFrame(aimLens)
    clearBtn.hidden = clear === null
    el.classList.toggle('folded', folded)
    setText(foldBtn, folded ? m().show : m().hide)
    // A press leaves the focus on its button, and Space or Enter would press it again instead of firing the special.
    if (document.activeElement instanceof HTMLElement && el.contains(document.activeElement)) document.activeElement.blur()
  }

  /** Tells the shell the middle of the widest field around the panel (its layout box, so the slide-in doesn't count). */
  function aimLens() {
    if (!el.isConnected) return
    const w = root.clientWidth
    const hh = root.clientHeight
    const left = el.offsetLeft
    const top = el.offsetTop
    const right = left + el.offsetWidth
    const bottom = top + el.offsetHeight
    const open = [
      { x: left / 2, y: hh / 2, area: left * hh },
      { x: (right + w) / 2, y: hh / 2, area: (w - right) * hh },
      { x: w / 2, y: top / 2, area: top * w },
      { x: w / 2, y: (bottom + hh) / 2, area: (hh - bottom) * w },
    ].reduce((a, b) => (b.area > a.area ? b : a))
    actions.lens(open.x - w / 2, open.y - hh / 2)
  }

  root.append(el)
  render()
  paintMeter()
  addEventListener('resize', aimLens)

  return {
    el,
    tick: () => {
      sampleMeter(meter, g.now, me().damageByMove)
      if (g.now - shownAt < METER.every) return
      shownAt = g.now
      paintMeter()
    },
    refresh: (next) => {
      clear = next
      render()
    },
    dispose: () => {
      removeEventListener('resize', aimLens)
      el.remove()
    },
  }
}
