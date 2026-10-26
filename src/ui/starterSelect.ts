import { blitCentered, context2d } from '../engine/pixelart'
import { playCry, playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { HATCHLING_IDS, HATCHLINGS, isHatchling, isStarter, PLAYABLE, type HatchlingId, type PlayableId } from '../data/hatchlings'
import { REGIONS, type StarterId } from '../data/starters'
import { TYPE_COLORS } from '../data/types'
import { megasOf } from '../data/megas'
import { bodyOf } from '../data/bodies'
import { DIFFICULTY_IDS, type Difficulty } from '../game/difficulty'
import { incubatorSlots, isReady } from '../game/eggs'
import { isLegend, legendEvent, legendFestival, LEGENDS, REGULAR_LEGENDS, type LegendId } from '../data/legends'
import { HALLOWEEN } from '../data/halloween'
import { brasiliaDay } from '../game/day'
import { claimOpen, festivalById, festivalEnd, shownLegends } from '../game/festival'
import { halloweenStanding } from '../game/halloween'
import { festivalIcon } from './festival'
import { eventLegendIcon } from '../render/halloweenArt'
import { ABILITIES } from '../data/abilities'
import { canPlay, capturedCount, isCaptured, legendSource, winsNeeded } from '../game/capture'
import { armBlock, armedItems, armItem, BAG_ITEM_IDS, bagCount, type BagItem } from '../game/bag'
import { SHOP_LEVELS } from '../data/shop'
import { capLevel } from '../game/evoItems'
import { MOVES } from '../game/moves'
import { armedTms, armTm, tmLimit, type ShelfTm } from '../game/tmShelf'
import { ownsShiny, pickShinyForm, playsShiny } from '../game/shinyPicks'
import { dieIcon, eggIcon, moveIcon, PICKUPS, sparkleIcon, trophyIcon } from '../render/art'
import { capPips, shopIcon } from './shopIcons'
import { cryUrl, drawPokemon, loadedSprites, loadSpecies, portraitUrl, walkSheet } from '../render/sprites'
import { formatDay, formatPokeDollarsShort, t } from '../i18n'
import { h, later, rich } from './dom'
import { loadSave, today, updateSave } from './save'
import { typeBadge, type Screen } from './screens'
import { actionBar, backButton, gearButton, segmented, shellScreen, topBar, walletChip } from './shell'
import { detailsSheet, evoLine, shinyPicker, statBars } from './partnerDetails'
import { stepGrid, type Step } from './gridNav'

/**
 * Phones held upright get the transposed roster (a row per region, three
 * named cells each). Keep in sync with the partner select's media queries
 * in style.css: arrows read it to know which way is a row.
 */
const PHONE = '(orientation: portrait) and (max-width: 700px)'

/** The 27 starters, region by region (Grass, Fire, Water each): the roster's DOM order. */
const STARTER_IDS: readonly StarterId[] = REGIONS.flatMap((r) => r.starters)

/** The three types a region's trio covers, in roster order (the desktop rows). */
const ROW_TYPES = STARTER_IDS.slice(0, 3).map((id) => PLAYABLE[id].line[0].types[0]!)

/** Keys that flip the first bag items (the rest are a tap or click away). */
const BAG_KEYS: Partial<Record<BagItem, string>> = { lure: 'KeyC', incense: 'KeyV' }

/** How many hatched families the desktop's "Hatched" teaser row shows before "+n". */
const TEASER = 7

/** The roster's tabs, in Tab / E order: the starters, the egg families and the legends (Legend mode). */
const TABS = ['starters', 'eggs', 'legends'] as const

type Tab = (typeof TABS)[number]

const tabOf = (id: PlayableId): Tab => (isHatchling(id) ? 'eggs' : isLegend(id) ? 'legends' : 'starters')

type SelectActions = {
  pick: (id: PlayableId) => void
  back: () => void
  /** The Poké Mart; co-op has none (the Bag stays home). */
  mart?: () => void
  settings: () => void
  incubator: () => void
}

/**
 * The partner select: the roster (Starters: 9 regions × Grass/Fire/Water,
 * Eggs: the hatched families, the rest still in their egg, or Legendaries:
 * the legends captured for the Legend mode, the rest a silhouette with their
 * wins so far and where to beat them), the selected
 * partner's panel, the details sheet behind its button, and one action bar
 * (Bag, difficulty, Start, colored by the difficulty).
 *
 * Keyboard: arrows move in the grid (↓ past the starters' last row reaches the eggs, then the legends), Tab/E and Q switch tabs,
 * 1-9 jump to a region, R picks a random unlocked Pokémon from the shown tab, I opens the details, Z flips Normal/Shiny,
 * X cycles the difficulty, C and V arm a Lure and an Incense, O opens the incubator, L the Poké Mart, Enter starts,
 * Esc/Backspace go back.
 * Pointer: a tap selects; only Start starts (a second tap on the selected cell started runs players only meant to pick).
 * Selecting an unlocked Pokémon makes it the lobby's partner (`save.partner`) right away, so Back shows it there.
 * `selected` reads the selected Pokémon, so a rebuilt screen (language switch, back from a sub-screen) keeps it.
 * `coop`: picking the Pokémon for a co-op room, which plays the normal mode (`COOP_LOCKS`): no
 * Lendários tab, no Bag, TMs or Bottle Caps, no Poké Mart, and the host sets the difficulty, so the
 * bar is just "Escolher". `dojo`: picking who trains at the Dojo, the same plain bar ("Treinar").
 */
export const starterSelect = (root: HTMLElement, input: Input, actions: SelectActions, initial: PlayableId = 'charmander', opts: { coop?: boolean; dojo?: boolean } = {}): Screen & { selected: () => PlayableId } => {
  const m = t()
  /** Co-op and the Dojo only pick a Pokémon: no Legend mode, Bag, difficulty or Poké Mart, and the partner stays. */
  const plain = opts.coop === true || opts.dojo === true
  const pickLabel = opts.dojo ? m.training.pickGo : m.coop.lobby.pick
  const save = loadSave()
  const unlocked = (id: PlayableId) => canPlay(save, id)
  /** The save with the Normal/Shiny picks made on this screen; any shiny owned (rolled once, a ticket, a shiny hatch) can be picked. */
  let forms = save
  const canPick = (id: PlayableId) => ownsShiny(save, id)
  const shinyOf = (id: PlayableId) => playsShiny(forms, id)

  /** Co-op leaves the Legend mode home: no Lendários tab, and a legend partner opens on the starters. */
  const tabs: readonly Tab[] = plain ? TABS.filter((k) => k !== 'legends') : TABS
  let tab: Tab = tabs.includes(tabOf(initial)) ? tabOf(initial) : 'starters'
  /** Each tab remembers its own cursor, so switching back lands where it was. */
  const firstHatched = HATCHLING_IDS.find((id) => save.hatched[id]) ?? HATCHLING_IDS[0]!
  // A festival legend stays out of the tab until its festival is announced (`legendShown`).
  const legendIds = shownLegends(brasiliaDay(today()))
  const firstCaptured = legendIds.find((id) => isCaptured(save.legends, id)) ?? REGULAR_LEGENDS[0]
  const cursor: { starters: StarterId; eggs: HatchlingId; legends: LegendId } = {
    starters: isStarter(initial) ? initial : 'charmander',
    eggs: isHatchling(initial) ? initial : firstHatched,
    legends: isLegend(initial) ? initial : firstCaptured,
  }
  const current = (): PlayableId => cursor[tab]
  let stage = 0
  let picked = false
  let cryTimer = 0
  let difficulty: Difficulty = save.difficulty
  let bag = save.bag
  let sheet: ReturnType<typeof detailsSheet> | null = null

  /* ---------- Roster ---------- */


  const cellPortrait = (id: PlayableId) => h('img', { class: 'partner-cell-portrait', src: portraitUrl(PLAYABLE[id].line[0].dex, shinyOf(id)), alt: '' })
  /** A family still in its egg (a legend not captured yet): its first stage's silhouette at 2× (a big legend's at 1×), centered on the body (`bodyOf`) and cropped by the cell like a portrait. */
  const cellSilhouette = (id: HatchlingId | LegendId) => {
    const dex = PLAYABLE[id].line[0].dex
    const sheet = walkSheet(dex)
    if (!sheet) return isHatchling(id) ? h('img', { class: 'partner-cell-egg', src: eggIcon(HATCHLINGS[id].egg), alt: '' }) : h('span', { class: 'partner-cell-silhouette' })
    const { bodyH, footY } = bodyOf(dex)
    // A big legend (Lugia's 79 px wings) stays at 1×, or the cell would only show a black blob.
    const scale = isLegend(id) && bodyH > 26 ? 1 : 2
    return h(
      'span',
      { class: 'partner-cell-silhouette' },
      h('i', { style: `width:${sheet.fw}px;height:${sheet.fh}px;background-image:url(${sheet.url});transform:translateY(${((bodyH - 2 * footY) * scale) / 2}px) scale(${scale})` }),
    )
  }
  const shinyTag = () => h('img', { class: 'partner-cell-shiny', src: sparkleIcon(), alt: 'Shiny' })
  /** A legend's event badge: Darkrai's Noite das Bruxas 2026, Cresselia's Festival das Lanternas 2026; null for a regular one. */
  const legendBadge = (id: LegendId) => {
    const f = festivalById(legendFestival(id) ?? '')
    if (f) return { src: festivalIcon(f.id), text: `${m.festival.names[f.id]} ${f.start.slice(0, 4)}` }
    return legendEvent(id) ? { src: eventLegendIcon(), text: m.legend.event.badge } : null
  }
  const eventTag = (id: LegendId) => {
    const badge = legendBadge(id)
    return badge && h('img', { class: 'partner-cell-event', src: badge.src, alt: badge.text, title: badge.text })
  }
  /**
   * Where a legend's event stands today: coming, on (until its last day), or
   * over. A festival legend's is on until its milestone gifts can no longer be opened.
   */
  const eventStanding = (id: LegendId) => {
    const day = brasiliaDay(today())
    const f = festivalById(legendFestival(id) ?? '')
    if (f) return day < f.start ? 'before' : claimOpen(f, day) ? 'on' : 'after'
    return legendEvent(id) ? halloweenStanding(day) : null
  }
  /** What the locked card says of the legend's event: Darkrai's dates, or the festival pot that brings Cresselia. */
  const eventText = (id: LegendId, standing: 'before' | 'on' | 'after') => {
    const f = festivalById(legendFestival(id) ?? '')
    const milestone = f?.milestones.find((ms) => ms.reward.kind === 'legend' && ms.reward.legend === id)
    if (f && milestone) {
      const name = m.festival.names[f.id]
      return standing === 'after' ? m.legend.festival.gone(name) : m.legend.festival.prize(name, formatPokeDollarsShort(milestone.pot), formatDay(f.start), formatDay(festivalEnd(f)))
    }
    const ev = m.legend.event
    return standing === 'before' ? ev.soon(formatDay(HALLOWEEN.from), formatDay(HALLOWEEN.to)) : standing === 'on' ? ev.live(formatDay(HALLOWEEN.to)) : ev.gone
  }
  const eventLine = (id: LegendId, withText: boolean) => {
    const badge = legendBadge(id)
    const standing = eventStanding(id)
    if (!badge || !standing) return null
    return h('p', { class: 'partner-legend-event' }, h('img', { src: badge.src, alt: '' }), h('b', {}, badge.text), ...(withText ? [' · ', rich(eventText(id, standing))] : []))
  }
  /** What a family's clear says (`game/clears.ts`): the hardest difficulty it beat Mewtwo on. */
  const clearText = (id: PlayableId) => {
    const level = save.clears[id]
    return level ? m.dex.clearedOn(m.difficulty.names[level]) : null
  }
  /** The trophy in a cleared family's corner, in the metal of its hardest clear. */
  const clearTag = (id: PlayableId) => {
    const level = save.clears[id]
    return level ? h('img', { class: 'partner-cell-clear', src: trophyIcon(level), alt: clearText(id) ?? '' }) : null
  }
  /** A Pokémon's Bottle Caps (`game/evoItems.ts`) as pips at the cell's foot, when it has any. */
  const capTag = (id: PlayableId) => (!plain && capLevel(save.caps, id) > 0 ? capPips(capLevel(save.caps, id)) : null)
  const cellTitle = (id: PlayableId, name: string) => [name, clearText(id)].filter((s) => s !== null).join(' · ')

  const cells = new Map<PlayableId, HTMLElement>()
  const starterCell = (id: StarterId) => {
    const el = h(
      'button',
      { class: 'partner-cell', type: 'button', title: cellTitle(id, PLAYABLE[id].name), style: `--t:${PLAYABLE[id].color}`, onclick: () => select(id) },
      cellPortrait(id),
      h('span', { class: 'partner-cell-name' }, PLAYABLE[id].name),
      shinyOf(id) && shinyTag(),
      clearTag(id),
      capTag(id),
    )
    cells.set(id, el)
    return el
  }
  const eggCell = (id: HatchlingId) => {
    const open = unlocked(id)
    const el = h(
      'button',
      {
        class: open ? 'partner-cell egg' : 'partner-cell egg locked',
        type: 'button',
        title: cellTitle(id, open ? PLAYABLE[id].name : m.eggs.locked),
        style: `--t:${open ? PLAYABLE[id].color : '#8890b0'}`,
        onclick: () => select(id),
      },
      open ? cellPortrait(id) : cellSilhouette(id),
      shinyOf(id) && shinyTag(),
      clearTag(id),
      capTag(id),
    )
    cells.set(id, el)
    return el
  }

  /** A legend: its portrait once captured, else its silhouette with the wins it has toward capturing it. */
  const legendCell = (id: LegendId) => {
    const open = unlocked(id)
    const name = PLAYABLE[id].name
    const wins = `${Math.min(save.legends[id] ?? 0, winsNeeded(id))}/${winsNeeded(id)}`
    const el = h(
      'button',
      {
        class: open ? 'partner-cell legend' : 'partner-cell legend locked',
        type: 'button',
        title: open ? cellTitle(id, name) : legendFestival(id) ? name : `${name} · ${m.legend.wins(wins)}`,
        style: `--t:${open ? PLAYABLE[id].color : '#8890b0'}`,
        onclick: () => select(id),
      },
      open ? cellPortrait(id) : cellSilhouette(id),
      !open && !legendFestival(id) && h('b', { class: 'partner-cell-count' }, wins),
      eventTag(id),
      shinyOf(id) && shinyTag(),
      clearTag(id),
      capTag(id),
    )
    cells.set(id, el)
    return el
  }

  const owned = HATCHLING_IDS.filter((id) => save.hatched[id])
  const tabButtons = {
    starters: h('button', { class: 'partner-tab', type: 'button', role: 'tab', onclick: () => setTab('starters') }, m.partner.starters, h('small', {}, `${STARTER_IDS.length}`)),
    eggs: h('button', { class: 'partner-tab', type: 'button', role: 'tab', onclick: () => setTab('eggs') }, m.eggs.tab, h('small', {}, `${owned.length}/${HATCHLING_IDS.length}`)),
    legends: h('button', { class: 'partner-tab', type: 'button', role: 'tab', onclick: () => setTab('legends') }, m.legend.tab, h('small', {}, `${capturedCount(save.legends, legendIds)}/${legendIds.length}`)),
  } satisfies Record<Tab, HTMLElement>

  const starterGrid = h(
    'div',
    { class: 'partner-grid' },
    h('div', { class: 'partner-types', 'aria-hidden': 'true' }, h('span'), ...ROW_TYPES.map((type) => h('i', { style: `--t:${TYPE_COLORS[type]}`, title: type.toUpperCase() }))),
    ...REGIONS.map((r) =>
      h('div', { class: 'partner-region' }, h('small', { class: 'partner-reg', title: r.name }, h('span', { class: 'short' }, r.name.slice(0, 3)), h('span', { class: 'long' }, r.name)), ...r.starters.map(starterCell)),
    ),
  )

  /** The teaser's portraits, so a Normal/Shiny pick repaints them too. */
  const teaserPortraits = new Map<PlayableId, HTMLImageElement>()
  const teaserPortrait = (id: PlayableId) => {
    const img = h('img', { src: portraitUrl(PLAYABLE[id].line[0].dex, shinyOf(id)), alt: '' })
    teaserPortraits.set(id, img)
    return img
  }
  /** Desktop only: the hatched families under the grid, a shortcut into the Eggs tab. */
  const teaser = h(
    'div',
    { class: 'partner-teaser' },
    h('small', { class: 'partner-teaser-label' }, m.partner.hatched),
    ...(owned.length > 0
      ? owned.slice(0, TEASER).map((id) =>
          h('button', { class: 'partner-teaser-cell', type: 'button', title: PLAYABLE[id].name, onclick: () => (setTab('eggs'), select(id)) }, teaserPortrait(id)),
        )
      : [h('span', { class: 'partner-teaser-empty' }, m.partner.noneHatched)]),
    h('button', { class: 'partner-teaser-more', type: 'button', onclick: () => setTab('eggs') }, owned.length > TEASER ? `+${owned.length - TEASER} ▸` : '▸'),
  )

  const eggGrid = h('div', { class: 'partner-egg-grid' }, ...HATCHLING_IDS.map(eggCell))
  const ready = save.eggs.filter(isReady).length
  const openIncubator = () => (playSfx('select'), later(actions.incubator))
  const eggsPane = h(
    'div',
    { class: 'partner-eggs' },
    eggGrid,
    h(
      'button',
      { class: 'incubator-entry box', type: 'button', onclick: openIncubator },
      h('img', { src: eggIcon('common'), alt: '' }),
      h('span', {}, m.eggs.incubator(save.eggs.length, incubatorSlots(save))),
      ready > 0 && h('b', { class: 'blink' }, m.eggs.readyBadge(ready)),
      h('span', { class: 'key-hint' }, 'O'),
    ),
  )

  /** Lendários: every legend, captured or not, and what the mode is about. ↑ ↓ read the column count from the grid. */
  const legendGrid = h('div', { class: 'partner-egg-grid partner-legend-grid' }, ...legendIds.map(legendCell))
  const legendsPane = h('div', { class: 'partner-legends' }, legendGrid, h('p', { class: 'partner-legend-note' }, rich(m.legend.selectNote)))

  const randomButton = h(
    'button',
    { class: 'partner-random', type: 'button', title: m.partner.randomHint, 'aria-label': m.partner.randomHint, onclick: () => pickRandom() },
    h('img', { src: dieIcon(), alt: '' }),
    h('span', { class: 'partner-random-label' }, m.partner.random),
    h('span', { class: 'key-hint' }, 'R'),
  )

  const roster = h(
    'section',
    { class: 'partner-roster box' },
    h('div', { class: 'partner-tabs', role: 'tablist' }, ...tabs.map((k) => tabButtons[k]), h('span', { class: 'key-hint' }, 'TAB'), randomButton),
    h('div', { class: 'partner-pane starters' }, starterGrid, teaser),
    eggsPane,
    !plain && legendsPane,
  )

  /* ---------- Partner panel ---------- */

  const sprite = h('canvas', { width: 72, height: 72, class: 'partner-sprite' })
  const hero = h('section', { class: 'partner-hero box' })

  const renderHero = () => {
    const id = current()
    const open = unlocked(id)
    const form = PLAYABLE[id].line[stage]!
    void loadSpecies(form.dex, shinyOf(id)).catch(() => {})
    hero.style.setProperty('--accent', open ? PLAYABLE[id].color : '#8890b0')
    const level = save.clears[id]
    const pedestal = h('div', { class: 'partner-pedestal' }, sprite)
    if (isLegend(id) && !open) {
      const need = winsNeeded(id)
      // Once its event is over, an event legend can't be caught: only the line saying it's gone stays.
      const over = eventStanding(id) === 'after'
      // A festival legend is never fought: no wins to count, only its festival's line.
      const gift = legendFestival(id) !== null
      hero.replaceChildren(
        h(
          'div',
          { class: 'partner-hero-top' },
          pedestal,
          h(
            'div',
            { class: 'partner-id' },
            h('small', { class: 'partner-dex' }, `#${String(form.dex).padStart(3, '0')}`),
            h('h3', { class: 'partner-name' }, form.name),
            !gift && h('p', { class: 'partner-legend-wins' }, m.legend.wins(`${Math.min(save.legends[id] ?? 0, need)}/${need}`)),
            !over && !gift && h('p', { class: 'partner-blurb locked-blurb' }, rich(m.legend.where[legendSource(id)])),
            eventLine(id, true),
          ),
        ),
        ...(over || gift ? [] : [h('p', { class: 'partner-blurb partner-intro' }, m.legend.rule(need), ' ', m.legend.shinyRule)]),
      )
      return
    }
    if (isHatchling(id) && !open) {
      const tier = HATCHLINGS[id].egg
      hero.replaceChildren(
        h(
          'div',
          { class: 'partner-hero-top' },
          pedestal,
          h(
            'div',
            { class: 'partner-id' },
            h('h3', { class: 'partner-name' }, m.eggs.locked),
            h('p', { class: 'partner-blurb locked-blurb' }, h('img', { src: eggIcon(tier), alt: '' }), rich(tier === 'friend' ? m.eggs.friendBlurb : tier === 'haunted' ? m.eggs.hauntedBlurb : tier === 'kecleon' ? m.eggs.kecleonBlurb : m.eggs.lockedBlurb(m.eggs.tiers[tier]))),
          ),
        ),
        h('p', { class: 'partner-blurb partner-intro' }, m.eggs.intro),
      )
      return
    }
    const onStage = (i: number) => {
      if (i === stage) return
      stage = i
      playSfx('move')
      renderHero()
    }
    /** The way into the details: the wide panel's button at the bottom, and the compact panel's (phones, landscape) beside the shiny pick. */
    const more = (compact: boolean) =>
      h(
        'button',
        { class: compact ? 'partner-more compact' : 'partner-more', type: 'button', onclick: () => openDetails() },
        compact ? m.partner.detailsShort : m.partner.details(megasOf(id).length > 0),
        ' ▸',
        !compact && h('span', { class: 'key-hint' }, 'I'),
      )
    hero.replaceChildren(
      h(
        'div',
        { class: 'partner-hero-top' },
        pedestal,
        h(
          'div',
          { class: 'partner-id' },
          h('small', { class: 'partner-dex' }, `#${String(form.dex).padStart(3, '0')}`),
          h('h3', { class: 'partner-name' }, form.name),
          h('div', { class: 'types' }, ...form.types.map(typeBadge)),
          level && h('p', { class: 'partner-clear' }, h('img', { src: trophyIcon(level), alt: '' }), m.dex.clearedOn(m.difficulty.names[level])),
          isLegend(id) && h('p', { class: 'partner-legend-mode' }, m.legend.mode, ' · ', `${m.legend.innate}: ${ABILITIES[LEGENDS[id].innate.ability].name}`),
          isLegend(id) && eventLine(id, false),
          h('p', { class: 'partner-blurb' }, m.blurbs[id]),
          h('div', { class: 'partner-hero-actions' }, canPick(id) && shinyPicker(shinyOf(id), setShiny), more(true)),
        ),
      ),
      h('div', { class: 'partner-stats' }, statBars(id, 4)),
      h('div', { class: 'partner-evo' }, evoLine(id, stage, onStage)),
      more(false),
    )
  }

  /* ---------- Action bar ---------- */

  const blurb = h('p', { class: 'partner-blurb-line' })
  const go = h('button', { class: 'partner-go', type: 'button', onclick: () => confirm() }, h('span', { class: 'partner-go-label' }), h('span', { class: 'key-hint' }, 'ENTER'))
  /** Start buttons on screen (the bar's, and the open sheet's): they follow the difficulty's color. */
  const goButtons = () => [go, ...(sheet ? [sheet.go] : [])]
  const paintGo = () =>
    goButtons().forEach((b) => {
      DIFFICULTY_IDS.forEach((d) => b.classList.toggle(d, d === difficulty))
      b.classList.toggle('locked', !unlocked(current()))
    })

  const seg = segmented(
    DIFFICULTY_IDS.map((id) => ({ id, label: m.difficulty.names[id] })),
    difficulty,
    (id) => setDifficulty(id),
  )
  DIFFICULTY_IDS.forEach((id, i) => seg.el.children[i]!.classList.add(id))
  seg.el.setAttribute('role', 'radiogroup')
  seg.el.setAttribute('aria-label', m.difficulty.label)

  /** Picks a level, saved right away so the next run (and the next visit) plays it. */
  const setDifficulty = (id: Difficulty) => {
    if (id === difficulty) return
    difficulty = id
    playSfx('move')
    updateSave((s) => ({ ...s, difficulty: id }))
    seg.set(id)
    blurb.textContent = m.difficulty.blurbs[id]
    paintGo()
  }

  const slots = BAG_ITEM_IDS.map((id) => {
    const key = BAG_KEYS[id]
    return h(
      'button',
      { class: 'partner-slot', type: 'button', role: 'switch', title: m.bag.descriptions[id], onclick: () => toggleBag(id) },
      shopIcon(id),
      h('em', {}),
      key && h('span', { class: 'key-hint' }, key.slice(3)),
    )
  })
  /** The TMs owned at the shop, armed or not for the next runs (`game/tmShelf.ts`), like the Bag's slots. */
  let tms = save.tms
  const tmLimitNow = () => tmLimit(loadSave().shop.level)
  const tmLabel = h('small', { class: 'partner-bag-label' })
  const tmSlots = h('div', { class: 'partner-tms' })
  const renderTms = () => {
    const armed = armedTms(tms, tmLimitNow())
    tmSlots.replaceChildren(
      tmLabel,
      ...tms.owned.map((id) =>
        h(
          'button',
          { class: armed.includes(id) ? 'partner-slot tm on' : 'partner-slot tm', type: 'button', role: 'switch', 'aria-checked': String(armed.includes(id)), 'aria-label': m.bag.tmToggle(MOVES[id].name), title: m.bag.tmToggle(MOVES[id].name), onclick: () => toggleTm(id) },
          h('img', { src: moveIcon(id), alt: '' }),
        ),
      ),
    )
    tmLabel.textContent = `${m.bag.tmsLabel} ${m.bag.armed(armed.length, tmLimitNow())}`
    tmSlots.classList.toggle('hidden', tms.owned.length === 0)
  }
  /** Arms or disarms an owned TM; past the limit, the oldest armed one makes room. */
  const toggleTm = (id: ShelfTm) => {
    const on = !armedTms(tms, tmLimitNow()).includes(id)
    tms = armTm(tms, id, on, tmLimitNow())
    updateSave((s) => ({ ...s, tms: armTm(s.tms, id, on, tmLimitNow()) }))
    playSfx(on ? 'shiny' : 'move')
    blurb.textContent = on ? `${MOVES[id].name}: ${m.shop.tms.text}` : m.difficulty.blurbs[difficulty]
    renderTms()
  }

  /** Different items a run may take: the shop's level says (`SHOP_LEVELS`). */
  const bagLimit = () => SHOP_LEVELS[loadSave().shop.level].bagSlots
  const bagLabel = h('small', { class: 'partner-bag-label' })
  /** Shows the items the player has (or the first two, empty, when the Bag is), and how many are armed of the limit. */
  const renderBag = () => {
    const held = BAG_ITEM_IDS.filter((id) => bagCount(bag, id) > 0)
    const shown = held.length > 0 ? held : BAG_ITEM_IDS.slice(0, 2)
    BAG_ITEM_IDS.forEach((id, i) => {
      const n = bagCount(bag, id)
      const slot = slots[i]!
      slot.classList.toggle('hidden', !shown.includes(id))
      slot.classList.toggle('empty', n === 0)
      slot.classList.toggle('on', bag.armed[id])
      slot.setAttribute('aria-checked', String(bag.armed[id]))
      slot.setAttribute('aria-label', m.bag.toggle(m.bag.descriptions[id], n))
      slot.querySelector('em')!.textContent = `${n}`
    })
    bagLabel.textContent = `${m.bag.label} ${m.bag.armed(armedItems(bag).length, bagLimit())}`
  }
  /**
   * Arms or disarms a bag item for the next run (the run uses it up as it
   * starts), up to the shop level's limit of different items; the line under
   * the difficulty says what it does, or why it can't.
   */
  const toggleBag = (id: BagItem) => {
    const on = !bag.armed[id]
    const block = on ? armBlock(bag, id, bagLimit()) : null
    if (block) {
      if (block === 'full') blurb.textContent = m.bag.full(bagLimit())
      return playSfx('denied')
    }
    bag = armItem(bag, id, on, bagLimit())
    updateSave((s) => ({ ...s, bag: armItem(s.bag, id, on, bagLimit()) }))
    playSfx(on ? 'shiny' : 'move')
    blurb.textContent = on ? m.bag.descriptions[id] : m.difficulty.blurbs[difficulty]
    renderBag()
  renderTms()
  }

  const bar = plain
    ? actionBar(go)
    : actionBar(
        h('div', { class: 'partner-bag' }, bagLabel, ...slots, tmSlots),
        h('div', { class: 'partner-diff' }, h('div', { class: 'partner-diff-row' }, seg.el, h('span', { class: 'key-hint' }, 'X')), blurb),
        go,
      )
  bar.classList.add('partner-bar')
  if (plain) bar.classList.add('coop')

  /* ---------- State ---------- */

  const renderGo = () => {
    const id = current()
    go.querySelector('.partner-go-label')!.textContent = unlocked(id) ? `${plain ? pickLabel : m.partner.start} ▶` : isLegend(id) ? m.legend.lockedButton : m.eggs.lockedButton
    paintGo()
  }

  const render = () => {
    for (const k of TABS) {
      tabButtons[k].classList.toggle('on', k === tab)
      tabButtons[k].setAttribute('aria-selected', String(k === tab))
    }
    roster.classList.toggle('eggs', tab === 'eggs')
    roster.classList.toggle('legends', tab === 'legends')
    cells.forEach((c, id) => c.classList.toggle('selected', id === current()))
    randomButton.disabled = randomPool().length === 0
    renderHero()
    renderGo()
  }

  /** Keeps the selected cell in sight inside its scrolling roster. */
  const reveal = () => cells.get(current())?.scrollIntoView({ block: 'nearest', inline: 'nearest' })

  /** Selects a Pokémon (switching to its tab), with a step sound and, once it settles, its cry. */
  const select = (id: PlayableId) => {
    if (id === current()) return
    if (isHatchling(id)) cursor.eggs = id
    else if (isLegend(id)) cursor.legends = id
    else cursor.starters = id
    tab = tabOf(id)
    stage = 0
    if (!plain && unlocked(id)) updateSave((s) => ({ ...s, partner: id }))
    render()
    reveal()
    playSfx('move')
    clearTimeout(cryTimer)
    if (!unlocked(id)) return
    cryTimer = window.setTimeout(() => playCry(cryUrl(PLAYABLE[id].line[0].dex), 0.25), 260)
  }

  /** The unlocked Pokémon of the shown tab, but the selected one: what Random draws from. */
  const randomPool = (): readonly PlayableId[] => {
    const shown: readonly PlayableId[] = tab === 'eggs' ? HATCHLING_IDS : tab === 'legends' ? legendIds : STARTER_IDS
    return shown.filter((id) => id !== current() && unlocked(id))
  }

  /** Random: selects one of the tab's unlocked Pokémon (never the one already selected); it doesn't start the run. */
  const pickRandom = () => {
    const pool = randomPool()
    if (pool.length === 0) return playSfx('denied')
    select(pool[Math.floor(Math.random() * pool.length)]!)
  }

  const setTab = (next: Tab) => {
    if (next === tab) return
    select(cursor[next])
  }

  /** Picks Normal or Shiny for the selected Pokémon, saved for its next run. */
  function setShiny(shiny: boolean) {
    const id = current()
    if (!canPick(id) || shinyOf(id) === shiny) return
    forms = pickShinyForm(forms, id, shiny)
    updateSave((s) => pickShinyForm(s, id, shiny))
    playSfx(shiny ? 'shiny' : 'move')
    const cell = cells.get(id)!
    const portrait = portraitUrl(PLAYABLE[id].line[0].dex, shiny)
    cell.querySelector<HTMLImageElement>('.partner-cell-portrait')!.src = portrait
    const teased = teaserPortraits.get(id)
    if (teased) teased.src = portrait
    cell.querySelector('.partner-cell-shiny')?.remove()
    if (shiny) cell.append(shinyTag())
    renderHero()
  }

  /** An arrow: a step in the shown grid (the starters' columns are regions on wide screens, rows on phones). */
  const step = (dir: Step) => {
    if (tab === 'eggs') {
      const cols = getComputedStyle(eggGrid).gridTemplateColumns.split(' ').length || 1
      const next = stepGrid(HATCHLING_IDS.indexOf(cursor.eggs), dir, cols, HATCHLING_IDS.length)
      if (next === 'above') return setTab('starters')
      if (next === 'below') return tabs.includes('legends') ? setTab('legends') : undefined
      return select(HATCHLING_IDS[next]!)
    }
    if (tab === 'legends') {
      const cols = getComputedStyle(legendGrid).gridTemplateColumns.split(' ').length || 1
      const next = stepGrid(legendIds.indexOf(cursor.legends), dir, cols, legendIds.length)
      if (next === 'above') return setTab('eggs')
      if (next !== 'below') select(legendIds[next]!)
      return
    }
    const i = STARTER_IDS.indexOf(cursor.starters)
    const [region, type] = [Math.floor(i / 3), i % 3]
    const phone = matchMedia(PHONE).matches
    const next = phone ? stepGrid(i, dir, 3, STARTER_IDS.length) : stepGrid(type * REGIONS.length + region, dir, REGIONS.length, STARTER_IDS.length)
    if (next === 'below') return setTab('eggs')
    if (next === 'above') return
    select(phone ? STARTER_IDS[next]! : STARTER_IDS[(next % REGIONS.length) * 3 + Math.floor(next / REGIONS.length)]!)
  }

  const confirm = () => {
    if (picked) return
    const id = current()
    if (!unlocked(id)) return playSfx('denied')
    picked = true
    clearTimeout(cryTimer)
    playSfx('select')
    playCry(cryUrl(PLAYABLE[id].line[0].dex))
    actions.pick(id)
  }

  const closeDetails = () => {
    if (!sheet) return
    sheet.el.remove()
    sheet = null
    playSfx('move')
  }

  function openDetails() {
    const id = current()
    if (sheet || !unlocked(id)) return
    playSfx('select')
    sheet = detailsSheet({
      id,
      stage,
      shiny: shinyOf(id),
      go: h('button', { class: 'partner-go', type: 'button', onclick: () => confirm() }, plain ? pickLabel : m.partner.startWith(PLAYABLE[id].name)),
      onStage: (i) => ((stage = i), renderHero()),
      onClose: closeDetails,
    })
    el.append(sheet.el)
    paintGo()
  }

  /** Leaves for another screen after this press is done. */
  const leave = (fn: () => void) => (playSfx('select'), later(fn))
  const mart = plain ? undefined : actions.mart
  const back = () => (playSfx('move'), later(actions.back))

  const off = input.onKey((key) => {
    if (sheet?.onKey(key)) return
    if (key === 'KeyX' && !plain) return setDifficulty(DIFFICULTY_IDS[(DIFFICULTY_IDS.indexOf(difficulty) + 1) % DIFFICULTY_IDS.length]!)
    if (key === 'KeyZ') return setShiny(!shinyOf(current()))
    const item = plain ? undefined : BAG_ITEM_IDS.find((i) => BAG_KEYS[i] === key)
    if (item) return toggleBag(item)
    if (sheet) return
    if (key === 'ArrowLeft' || key === 'KeyA') step('left')
    else if (key === 'ArrowRight' || key === 'KeyD') step('right')
    else if (key === 'ArrowUp' || key === 'KeyW') step('up')
    else if (key === 'ArrowDown' || key === 'KeyS') step('down')
    else if (key === 'Tab' || key === 'KeyE' || key === 'PageDown') setTab(tabs[(tabs.indexOf(tab) + 1) % tabs.length]!)
    else if (key === 'KeyQ' || key === 'PageUp') setTab(tabs[(tabs.indexOf(tab) + tabs.length - 1) % tabs.length]!)
    else if (/^Digit[1-9]$/.test(key)) select(STARTER_IDS[(Number(key.slice(5)) - 1) * 3 + (STARTER_IDS.indexOf(cursor.starters) % 3)]!)
    else if (key === 'KeyR') pickRandom()
    else if (key === 'KeyI') openDetails()
    else if (key === 'KeyO') openIncubator()
    else if (key === 'KeyL' && mart) leave(mart)
    else if (key === 'Escape' || key === 'Backspace') back()
    else if (key === 'Enter' || key === 'Space') confirm()
  })
  /** Tab switches the roster's tabs here, not the browser's focus. */
  const holdTab = (e: KeyboardEvent) => e.code === 'Tab' && e.preventDefault()
  window.addEventListener('keydown', holdTab)

  const el = shellScreen({
    class: 'partner-screen',
    top: topBar({
      left: backButton(back),
      title: h('span', {}, h('span', { class: 'partner-title-long' }, m.partner.title), h('span', { class: 'partner-title-short' }, m.partner.titleShort)),
      right: [mart && walletChip(save.wallet, { label: m.mart.open, onClick: () => leave(mart), key: 'L' }), gearButton(() => leave(actions.settings))],
    }),
    body: [h('div', { class: 'partner-layout' }, hero, roster)],
    bottom: bar,
  })
  root.append(el)
  blurb.textContent = m.difficulty.blurbs[difficulty]
  renderBag()
  renderTms()
  render()
  requestAnimationFrame(reveal)

  /** Draws the selected Pokémon idling on its pedestal: a bobbing Poké Ball while it loads, a dark silhouette while still in its egg. */
  const tick = (time: number) => {
    const id = current()
    const dex = PLAYABLE[id].line[stage]!.dex
    const locked = !unlocked(id)
    const ctx = context2d(sprite)
    ctx.clearRect(0, 0, sprite.width, sprite.height)
    const s = (shinyOf(id) && loadedSprites(dex, true)) || loadedSprites(dex)
    if (s) drawPokemon(ctx, s, 'Idle', 0, locked ? 0 : time, sprite.width / 2, sprite.height - 6, { tint: locked ? { color: '#283048', amount: 1 } : undefined })
    else blitCentered(ctx, PICKUPS.pokeball(), sprite.width / 2, sprite.height / 2 + Math.round(Math.sin(time * 6) * 2))
  }

  return { el, tick, selected: current, dispose: () => (off(), clearTimeout(cryTimer), window.removeEventListener('keydown', holdTab), el.remove()) }
}
