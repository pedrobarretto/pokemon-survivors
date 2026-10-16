import { formatTime } from '../engine/math'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { canEvolve, EVOLUTIONS, evolutionOf, evolvedFrom, type MoveEvolution } from '../data/evolutions'
import { ENEMIES } from '../data/enemies'
import { ITEMS } from '../data/items'
import { PLAYABLE } from '../data/hatchlings'
import { TYPE_COLORS, type PokeType } from '../data/types'
import { maxMoveLevel, MOVES, type MoveDef, type MoveId } from '../game/moves'
import { playerDex } from '../game/game'
import type { Difficulty } from '../game/difficulty'
import { toSteps } from '../game/eggs'
import { overtime } from '../game/endless'
import { runEarnings } from '../game/meta'
import { resolveSpecial } from '../game/special'
import { statSheet, type SheetStat } from '../game/statSheet'
import type { DamageSource, Game, Offer } from '../game/types'
import { berryIcon, coinIcon, eggIcon, itemIcon, moveIcon, sparkleIcon } from '../render/art'
import { specialIcon } from '../render/specialFx'
import { portraitUrl, sprites } from '../render/sprites'
import { formatNumber, formatPokeDollars, locale, t } from '../i18n'
import { ROUTES } from '../site/routes'
import { h, later } from './dom'

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

/** Hint that swaps between keyboard and touch wording (see `.keys-only` / `.touch-only` in CSS). */
export const hint = (keys: string, touch: string) =>
  h('p', { class: 'hint' }, h('span', { class: 'keys-only' }, keys), h('span', { class: 'touch-only' }, touch))

/**
 * Shared keyboard/pointer navigation for a list of buttons.
 * Arrows move the cursor, Enter/Space activate, digits pick directly.
 */
export const menu = (input: Input, buttons: HTMLElement[], activate: (i: number) => void, opts: { horizontal?: boolean; initial?: number } = {}) => {
  let index = opts.initial ?? 0
  const openedAt = performance.now()
  const focus = (i: number, sound = true) => {
    index = (i + buttons.length) % buttons.length
    buttons.forEach((b, j) => b.classList.toggle('selected', j === index))
    if (sound) playSfx('move')
  }
  buttons.forEach((b, i) => {
    b.addEventListener('pointerenter', () => i !== index && focus(i))
    b.addEventListener('click', () => performance.now() - openedAt > TAP_GUARD_MS && activate(i))
  })
  focus(index, false)
  const prev = opts.horizontal ? ['ArrowLeft', 'KeyA'] : ['ArrowUp', 'KeyW']
  const next = opts.horizontal ? ['ArrowRight', 'KeyD'] : ['ArrowDown', 'KeyS']
  const off = input.onKey((key) => {
    if (prev.includes(key)) focus(index - 1)
    else if (next.includes(key)) focus(index + 1)
    else if (key === 'Enter' || key === 'Space') activate(index)
    else if (/^Digit[1-9]$/.test(key)) {
      const i = Number(key.slice(5)) - 1
      if (i < buttons.length) activate(i)
    }
  })
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

/** Recipes an offer takes part in, flagged ready if picking it completes the pair. */
const offerRecipes = (g: Game, offer: Offer) => {
  const p = g.player
  switch (offer.kind) {
    case 'move': {
      const evo = evolutionOf(offer.id)
      return evo ? [evoRecipe(evo, canEvolve(evo, { moves: [{ ...offer, cooldown: 0 }], items: p.items }))] : []
    }
    case 'item': {
      const learnset: readonly MoveId[] = PLAYABLE[g.starter].learnset
      return EVOLUTIONS.filter((e) => e.item === offer.id && learnset.includes(e.from)).map((e) =>
        evoRecipe(e, canEvolve(e, { moves: p.moves, items: [offer] })),
      )
    }
    default:
      return []
  }
}

const offerView = (g: Game, offer: Offer) => {
  const m = t()
  switch (offer.kind) {
    case 'move': {
      const def: MoveDef = MOVES[offer.id]
      const text = m.moves[offer.id]
      const isNew = offer.level === 1
      return {
        icon: moveIcon(offer.id),
        name: def.name,
        tag: isNew ? m.new : offer.level === maxMoveLevel(offer.id) ? m.max : m.level(offer.level),
        isNew,
        desc: isNew ? text.description : text.upgrades[offer.level - 2]!,
        type: def.type,
      }
    }
    case 'item': {
      const isNew = offer.level === 1
      return { icon: itemIcon(offer.id), name: ITEMS[offer.id].name, tag: isNew ? m.new : m.level(offer.level), isNew, desc: m.items[offer.id], type: null }
    }
    case 'berry':
      return { icon: berryIcon(), name: 'Oran Berry', tag: '', isNew: false, desc: m.levelUp.berry(PLAYABLE[g.starter].name), type: null }
    case 'evolution': {
      const to: MoveDef = MOVES[offer.to]
      const desc = m.levelUp.evolves(MOVES[offer.from].name, m.moves[offer.to].description)
      return { icon: moveIcon(offer.to), name: to.name, tag: m.levelUp.evolution, isNew: true, desc, type: to.type }
    }
  }
}

/** Poké Mart charges offered under the level-up choices (only shown when owned). */
type LevelUpExtras = { reroll: () => void; skip: () => void }

export const levelUp = (root: HTMLElement, input: Input, g: Game, onChoose: (offer: Offer) => void, extras?: LevelUpExtras): Screen => {
  const m = t().levelUp
  const name = PLAYABLE[g.starter].line[g.player.stage]!.name
  const buttons = g.offers.map((offer, i) => {
    const v = offerView(g, offer)
    const recipes = offerRecipes(g, offer)
    return h(
      'button',
      { class: offer.kind === 'evolution' ? 'offer offer-evo' : 'offer' },
      h('span', { class: 'offer-key' }, i + 1),
      h('div', { class: 'offer-icon' }, h('img', { src: v.icon, alt: '' })),
      h(
        'div',
        { class: 'offer-body' },
        h('div', { class: 'offer-name' }, v.name, v.tag && h('span', { class: v.isNew ? 'tag tag-new' : 'tag' }, v.tag)),
        h('div', { class: 'offer-desc' }, v.desc),
        recipes.length > 0 && h('div', { class: 'evo-recipes' }, ...recipes),
      ),
      v.type && typeBadge(v.type),
    )
  })

  const actions = extras
    ? [
        g.rerolls > 0 && ([h('button', { class: 'btn' }, m.reroll(g.rerolls)), extras.reroll] as const),
        g.skips > 0 && ([h('button', { class: 'btn' }, m.skip(g.skips)), extras.skip] as const),
      ].filter((a) => a !== false)
    : []

  let done = false
  // Space also fires the special attack: ignore presses that were meant for the fight.
  const openedAt = performance.now()
  const nav = menu(input, [...buttons, ...actions.map(([b]) => b)], (i) => {
    if (done || performance.now() - openedAt < 400) return
    done = true
    playSfx('select')
    const offer = g.offers[i]
    if (offer) onChoose(offer)
    else actions[i - buttons.length]?.[1]()
  })

  const el = h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'dialog box pop' },
      h('div', { class: 'dialog-title' }, m.title(name, g.player.level - g.pendingLevelUps + 1)),
      h('div', { class: 'offers' }, ...buttons),
      actions.length > 0 && h('div', { class: 'buttons' }, ...actions.map(([b]) => b)),
      hint(m.hintKeys, m.hintTouch),
    ),
  )
  root.append(el)
  return { el, dispose: () => (nav.off(), el.remove()) }
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
    ...statSheet(g.player.stats, g.player.items).flatMap((r) => [
      r.stat === 'typeDamage' ? h('span', { class: 'stat-name' }, m.typeDamage, typeBadge(r.type)) : h('span', { class: 'stat-name' }, m.stats[r.stat]),
      h('b', {}, r.stat === 'typeDamage' ? pct(r.value) : SHEET_FORMAT[r.stat](r.value)),
      r.cards > 0 ? h('span', { class: 'stat-cards', title: m.cardsHint }, `×${r.cards}`) : h('span', { class: 'stat-cards none' }, '·'),
    ]),
  )
}

/** Paired item hint for a loadout move: shows what it needs and whether it is ready. */
const loadoutHint = (g: Game, id: MoveId) => {
  if (evolvedFrom(id)) return h('span', { class: 'tag tag-new' }, '★ EVO')
  const evo = evolutionOf(id)
  if (!evo) return null
  const ready = canEvolve(evo, g.player)
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
    ...g.player.moves.map((m) =>
      h(
        'div',
        { class: 'loadout-row' },
        h('img', { src: moveIcon(m.id), alt: '' }),
        MOVES[m.id].name,
        loadoutHint(g, m.id),
        !evolvedFrom(m.id) && levelTag(m.level, maxMoveLevel(m.id)),
      ),
    ),
  )

const itemList = (g: Game) =>
  h(
    'div',
    { class: 'loadout-list' },
    ...g.player.items.map((i) =>
      h('div', { class: 'loadout-row' }, h('img', { src: itemIcon(i.id), alt: '' }), ITEMS[i.id].name, levelTag(i.level, ITEMS[i.id].levels.length)),
    ),
    g.player.items.length === 0 && h('p', { class: 'loadout-empty' }, t().pause.noItems),
  )

const pauseSection = (title: string, body: HTMLElement) => h('section', { class: 'pause-section' }, h('h3', { class: 'pause-head' }, title), body)

/**
 * `settings` opens the settings screen on top (see `openSettings`) and must
 * call `back` once it closes; the pause menu hides meanwhile, then redraws
 * itself, in the new language if it changed.
 */
type PauseActions = { resume: () => void; quit: () => void; settings: (back: () => void) => Screen }

export const pauseMenu = (root: HTMLElement, input: Input, g: Game, actions: PauseActions): Screen => {
  const el = h('div', { class: 'screen dim pause-screen' })
  let nav: ReturnType<typeof menu> | null = null
  let settings: Screen | null = null

  const openSettings = () => {
    if (settings) return
    nav?.off()
    el.classList.add('hidden')
    settings = actions.settings(() => {
      settings = null
      el.classList.remove('hidden')
      render(1, false)
    })
  }

  /** `opening` plays the pop-in; redraws after closing the settings don't. */
  const render = (focus: number, opening: boolean) => {
    const m = t().pause
    const resume = h('button', { class: 'btn' }, m.resume)
    const settingsButton = h('button', { class: 'btn' }, m.settings)
    const quit = h('button', { class: 'btn' }, m.quit)
    nav?.off()
    nav = menu(input, [resume, settingsButton, quit], (i) => {
      if (i === 0) actions.resume()
      // Open after this key dispatch, or the settings would receive the same Enter.
      if (i === 1) later(openSettings)
      if (i === 2) actions.quit()
    }, { initial: focus })
    el.replaceChildren(
      h(
        'div',
        { class: opening ? 'dialog box pop wide pause' : 'dialog box wide pause' },
        h('div', { class: 'dialog-title' }, m.title),
        difficultyTag(g.difficulty),
        h(
          'div',
          { class: 'pause-body' },
          h(
            'div',
            { class: 'pause-grid' },
            pauseSection(m.statsTitle, statTable(g)),
            h('div', { class: 'pause-column' }, pauseSection(m.movesTitle, moveList(g)), pauseSection(m.itemsTitle, itemList(g))),
          ),
          h('p', { class: 'evo-legend' }, m.evoLegend),
        ),
        h('div', { class: 'buttons' }, resume, settingsButton, quit),
      ),
    )
  }

  render(0, true)
  // Esc inside the settings only closes them.
  const offEsc = input.onKey((k) => k === 'Escape' && !settings && actions.resume())
  root.append(el)
  return { el, dispose: () => (settings?.dispose(), nav?.off(), offEsc(), el.remove()) }
}

/* ---------------- Results ---------------- */

/** Icon, name and type for a results-screen damage row (and the run's share card). */
export const damageSource = (g: Game, id: DamageSource) => {
  if (id !== 'special') return { icon: moveIcon(id), name: MOVES[id].name, type: MOVES[id].type }
  const r = resolveSpecial(g.starter, g.player.stage)
  return { icon: specialIcon(r.id), name: r.tier.name, type: r.def.type }
}

/** What the incubator made of the run: ₽ paid for eggs that didn't fit, and eggs now ready to hatch. */
export type ResultEggs = { refund: number; ready: number }

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

const NO_EXTRAS: ResultsExtras = { badge: null, report: null, medals: [], eggs: { refund: 0, ready: 0 }, news: { species: 0, shinies: 0 }, ranking: null, share: null }

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
    eggs.refund > 0 && h('span', { class: 'news-chip' }, h('img', { src: coinIcon(1), alt: '' }), e.full(formatPokeDollars(eggs.refund))),
    ...medals,
  ].filter((chip) => chip instanceof HTMLElement)
  return chips.length > 0 ? h('div', { class: 'result-news' }, ...chips) : null
}

/**
 * End of run. On a victory, `onContinue` adds the endless-mode button (first);
 * a run that ends in endless mode shows its overtime, rift legendaries and Arceus.
 * The steps walked and eggs found feed the incubator (`extras.eggs`), and
 * `extras.news` adds a one-line Pokédex summary when the run found something new.
 * A victory also links the support page, under the buttons (only then, so it never nags).
 */
export const results = (
  root: HTMLElement,
  input: Input,
  g: Game,
  onRetry: () => void,
  onMenu: () => void,
  onContinue?: () => void,
  extras: ResultsExtras = NO_EXTRAS,
): Screen => {
  const m = t().results
  const e = t().eggs
  const r = t().rifts
  const victory = g.phase === 'victory'
  const name = PLAYABLE[g.starter].line[g.player.stage]!.name
  const entries = (Object.entries(g.damageByMove) as Array<[DamageSource, number]>).sort((a, b) => b[1] - a[1])
  const top = entries[0]?.[1] ?? 1
  const earned = runEarnings(g)
  const extra = overtime(g.time)
  const reaperDefeats = g.endless?.reaperDefeats ?? 0
  const legends = g.rift.cleared
  const retry = h('button', { class: 'btn' }, m.retry)
  const back = h('button', { class: 'btn' }, m.change)
  const goOn = victory && onContinue ? h('button', { class: 'btn' }, r.continue) : null
  const ranking = extras.ranking
  const boards = ranking ? h('button', { class: 'btn' }, t().ranking.open) : null
  const share = extras.share ? h('button', { class: extras.share.glow ? 'btn share-button glow' : 'btn share-button' }, h('img', { src: sparkleIcon(), alt: '' }), t().share.button) : null
  /** The boards or the share preview, open over the results. */
  let sub: Screen | null = null
  /** Hides the results under `open`'s screen until it closes, then comes back on the same button. */
  const openSub = (open: ((back: () => void) => Screen) | undefined, button: HTMLButtonElement) => {
    if (!open) return
    nav.off()
    el.classList.add('hidden')
    sub = open(() => {
      sub = null
      el.classList.remove('hidden')
      nav = bindNav(buttons.indexOf(button))
    })
  }
  const buttons = [goOn, retry, back, share, boards].filter((b) => b !== null)
  const actions = [
    goOn && onContinue,
    onRetry,
    onMenu,
    share && (() => later(() => openSub(extras.share?.open, share))),
    boards && (() => later(() => openSub(ranking?.open, boards))),
  ].filter((a) => typeof a === 'function')
  const bindNav = (initial = 0) => menu(input, buttons, (i) => actions[i]?.(), { horizontal: true, initial })
  let nav = bindNav()

  const el = h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'dialog box pop wide' },
      h(
        'div',
        { class: 'portrait-wrap' },
        h('img', { class: 'result-portrait', src: sprites(playerDex(g), g.player.shiny).portrait.src, alt: '' }),
        g.player.shiny && h('img', { class: 'shiny-badge', src: sparkleIcon(), alt: 'Shiny' }),
      ),
      h('div', { class: 'dialog-title' }, victory ? m.victory : g.endless ? r.endlessOver(name) : m.fainted(name)),
      extras.badge,
      g.player.shiny && h('div', { class: 'tag tag-shiny' }, m.shiny(name)),
      reaperDefeats > 0 && h('div', { class: 'tag tag-shiny' }, r.reaperDefeated(reaperDefeats)),
      h(
        'div',
        { class: 'result-stats' },
        h('div', {}, h('span', {}, t().difficulty.label), h('b', {}, difficultyTag(g.difficulty))),
        h('div', {}, h('span', {}, m.time), h('b', {}, formatTime(g.time))),
        extra > 0 && h('div', {}, h('span', {}, r.overtime), h('b', {}, `+${formatTime(extra)}`)),
        h('div', {}, h('span', {}, m.level), h('b', {}, g.player.level)),
        h('div', {}, h('span', {}, m.kills), h('b', {}, g.kills)),
        legends.length > 0 &&
          h('div', {}, h('span', {}, r.legends), h('b', { class: 'result-legends' }, ...legends.map((id) => h('img', { src: portraitUrl(ENEMIES[id].dex), alt: ENEMIES[id].name, title: ENEMIES[id].name })))),
        h('div', {}, h('span', {}, e.steps), h('b', {}, formatNumber(toSteps(g.player.walked)))),
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
      h(
        'div',
        { class: 'damage-list' },
        ...entries.map(([id, dmg]) => {
          const src = damageSource(g, id)
          return h(
            'div',
            { class: 'damage-row' },
            h('img', { src: src.icon, alt: '' }),
            h('span', { class: 'damage-name' }, src.name),
            h('div', { class: 'damage-bar' }, h('div', { style: `width:${(dmg / top) * 100}%;--type:${TYPE_COLORS[src.type]}` })),
            h('b', {}, formatNumber(dmg)),
          )
        }),
      ),
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
