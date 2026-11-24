import { assetUrl } from '../../assets'
import { SAFARI_HABITAT_IDS, type SafariHabitat } from '../../data/safari'
import { LOCALES, formatDecimal, formatPokeDollars, locale, t } from '../../i18n'
import { closeIcon } from '../../render/art'
import { h } from '../../ui/dom'
import { CONTEST, SAFARI, type SafariRarity } from './safari.rules'
import { ICONS } from './safariArt'
import { SAFARI_PLANS, chainOdds, planChance } from './safariOdds'

/**
 * The Zona Safári's guide: chapters on the notice board's frame (`safari.ts`
 * renders it into the board), each a looping clip of the game itself and a
 * few short lines, the numbers read from the rules (`SAFARI`, `CONTEST`) and
 * worked out by `safariOdds.ts`, never written down. The clips are the game's
 * canvas alone, so they hold no words and serve every language; they're
 * recorded from the dev build (`ps.safari`, see the PR that added them) into
 * `public/assets/safari/guide/` as lossless animated WebP at the art's own
 * pixels, and blown up here by whole steps.
 */

export const GUIDE_CHAPTERS = ['session', 'meet', 'ball', 'items', 'plan', 'odds', 'shiny', 'sure', 'contest'] as const

export type GuideChapter = (typeof GUIDE_CHAPTERS)[number]

/** The clips each chapter plays, by file name under `safari/guide/`. */
const CLIPS: Partial<Record<GuideChapter, readonly string[]>> = {
  session: ['walk'],
  meet: ['meet', 'sneak'],
  ball: ['catch'],
  items: ['berry', 'rock', 'bait'],
  shiny: ['shiny'],
}

const RARITIES: readonly SafariRarity[] = ['common', 'rare', 'ultra', 'special']

/** What the guide reads of the running Safári: this week's habitat, the guarantee's count (null without an account's state) and a way to the board's Agora tab. */
export type GuideCtx = { habitat: SafariHabitat; sureLeft: number | null; showBoard: () => void }

const SEEN = 'ps:safariGuide'

/** Whether this device has opened the guide (the header's chip wears NOVO until then). */
export const guideSeen = () => {
  try {
    return localStorage.getItem(SEEN) !== null
  } catch {
    return true
  }
}

export const markGuideSeen = () => {
  try {
    localStorage.setItem(SEEN, '1')
  } catch {
    // A private window keeps the NOVO tag: nothing else hangs on it.
  }
}

const percent = (x: number, sign = false) =>
  new Intl.NumberFormat(LOCALES[locale()].tag, { style: 'percent', maximumFractionDigits: 0, signDisplay: sign ? 'exceptZero' : 'auto' }).format(x)

const times = (x: number) => `×${formatDecimal(x, 2)}`

const table = (head: readonly string[], rows: readonly (readonly (string | HTMLElement)[])[], cls = '') =>
  h(
    'table',
    { class: `szg-table ${cls}` },
    h('thead', {}, h('tr', {}, ...head.map((c) => h('th', {}, c)))),
    h('tbody', {}, ...rows.map((row) => h('tr', {}, ...row.map((c, i) => (i === 0 ? h('th', { scope: 'row' }, c) : h('td', {}, c)))))),
  )

/** A row's label with its icon. */
const labelled = (src: string, text: string) => h('span', { class: 'szg-label' }, h('img', { src, alt: '', width: 16, height: 16 }), text)

/** A chapter's body: its lines, tables and buttons. */
const body = (chapter: GuideChapter, ctx: GuideCtx): (HTMLElement | false)[] => {
  const w = t().minigames.safari
  const g = w.guide
  const p = (text: string) => h('p', {}, text)
  switch (chapter) {
    case 'session': {
      // The habitats in their weekly turn, from this week's.
      const from = SAFARI_HABITAT_IDS.indexOf(ctx.habitat)
      const places = SAFARI_HABITAT_IDS.map((_, i) => w.habitats[SAFARI_HABITAT_IDS[(from + i) % SAFARI_HABITAT_IDS.length]!].name).join(', ')
      return [p(g.session.free(SAFARI.free, formatPokeDollars(SAFARI.price), SAFARI.dailyCap)), p(g.session.pouch(SAFARI.balls, SAFARI.berries, SAFARI.encounters)), p(g.session.ends(w.end)), p(g.session.week(places))]
    }
    case 'meet':
      return [p(g.meet.grass), p(g.meet.queue), p(g.meet.run), p(g.meet.sneak(SAFARI.visible, w.sneak)), p(g.meet.seen), h('p', { class: 'szg-aside' }, g.meet.keys(w.sneak))]
    case 'ball':
      return [
        p(g.ball.shakes),
        table(
          [g.ball.rarity, g.ball.catch, g.ball.flee, g.ball.level],
          RARITIES.map((r) => [w.tiers[r], percent(SAFARI.catchChance[r]), percent(SAFARI.fleeChance[r]), `${SAFARI.levelBase[r]}–${SAFARI.levelBase[r] + SAFARI.levelSpread - 1}`]),
        ),
        h('p', { class: 'szg-aside' }, g.ball.board(w.tabs.seen)),
      ]
    case 'items': {
      const { angry, eating } = SAFARI.mood
      return [
        table(
          [g.items.item, g.items.catch, g.items.flee, g.items.lasts],
          [
            [labelled(assetUrl('safari/berry.png'), g.items.berry), percent(SAFARI.calmCatch, true), percent(-SAFARI.calmFlee, true), g.items.berryLasts(SAFARI.maxCalm)],
            [labelled(ICONS.rock(), g.items.rock), times(angry.catch), times(angry.flee), g.items.moodLasts(angry.turns.min, angry.turns.max)],
            [labelled(ICONS.bait(), g.items.bait), times(eating.catch), times(eating.flee), g.items.moodLasts(eating.turns.min, eating.turns.max)],
          ],
        ),
        p(g.items.turn),
        p(g.items.stock(SAFARI.berries)),
        h('p', { class: 'szg-aside' }, g.items.panel(w.moodLabel.angry, w.moodLabel.eating)),
      ]
    }
    case 'plan': {
      const chances = SAFARI_PLANS.map((plan) => RARITIES.map((r) => planChance(r, plan)))
      const best = RARITIES.map((_, col) => Math.max(...chances.map((row) => row[col]!)))
      return [
        p(g.plan.intro(SAFARI.balls)),
        table(
          ['', ...RARITIES.map((r) => w.tiers[r])],
          SAFARI_PLANS.map((plan, i) => [g.plan.plans[plan], ...chances[i]!.map((c, col) => (c === best[col] ? h('b', { class: 'szg-best', title: g.plan.best }, `★ ${percent(c)}`) : percent(c)))]),
          'szg-plans',
        ),
        p(g.plan.bait),
        p(g.plan.berries),
        p(g.plan.rock),
      ]
    }
    case 'odds':
      return [
        p(g.odds.board(w.tabs.seen)),
        p(g.odds.partner(formatDecimal(SAFARI.partnerBoost, 2))),
        p(g.odds.lacking(formatDecimal(SAFARI.lackingBoost, 2))),
        p(g.odds.hour),
        p(g.odds.repeat(percent(SAFARI.repeat))),
        h('button', { class: 'arc-btn arc-btn-small szg-board', type: 'button', onclick: ctx.showBoard }, h('span', { class: 'arc-outline' }, g.odds.open)),
      ]
    case 'shiny': {
      const odds = chainOdds()
      return [
        p(g.shiny.odds(odds[0]!.oneIn)),
        p(g.shiny.chain),
        table(
          [g.shiny.inRow, g.shiny.chance],
          odds.map((o, i) => [i === odds.length - 1 ? g.shiny.more(o.n) : String(o.n), g.shiny.oneIn(o.oneIn)]),
          'szg-narrow',
        ),
        h('p', { class: 'szg-aside' }, g.shiny.chip),
      ]
    }
    case 'sure':
      return [
        p(g.sure.sure(SAFARI.guarantee)),
        ctx.sureLeft !== null && h('p', { class: 'szg-now' }, g.sure.left(ctx.sureLeft)),
        p(g.sure.contest),
        p(g.sure.dex(w.tabs.dex)),
        p(g.sure.repeat),
      ]
    case 'contest':
      return [
        p(w.contest.blurb),
        p(g.contest.score(CONTEST.perLevel, CONTEST.shiny)),
        table([g.ball.rarity, g.contest.points], RARITIES.map((r) => [w.tiers[r], String(CONTEST.points[r])]), 'szg-narrow'),
        p(w.contest.entry),
        p(w.contest.keep),
        p(w.contest.prizes),
      ]
  }
}

/**
 * The guide's frame at `chapter`: the chapters as chips, the clips, the body
 * and a step back and forth. `go` turns the page (the caller re-renders),
 * `close` puts the board away.
 */
export const guideFrame = (chapter: GuideChapter, ctx: GuideCtx, go: (next: GuideChapter) => void, close: () => void): HTMLElement => {
  const w = t().minigames.safari
  const g = w.guide
  const i = GUIDE_CHAPTERS.indexOf(chapter)
  const title = (c: GuideChapter) => g[c].title
  const clips = CLIPS[chapter] ?? []
  const step = (by: number) => go(GUIDE_CHAPTERS[(i + by + GUIDE_CHAPTERS.length) % GUIDE_CHAPTERS.length]!)
  const nav = h(
    'nav',
    { class: 'szg-chapters', role: 'tablist' },
    ...GUIDE_CHAPTERS.map((c, j) =>
      h('button', { type: 'button', role: 'tab', class: c === chapter ? 'sz-on' : '', 'aria-selected': String(c === chapter), 'aria-label': title(c), title: title(c), onclick: () => go(c) }, String(j + 1)),
    ),
  )
  return h(
    'div',
    { class: 'sz-board-frame szg-frame' },
    h('header', { class: 'mg-title' }, h('span', { class: 'mg-kicker' }, g.kicker), h('h3', {}, title(chapter)), nav),
    h(
      'div',
      { class: 'sz-notes szg-body' },
      clips.length > 0 &&
        h(
          'div',
          { class: `szg-clips szg-clips-${clips.length}` },
          ...clips.map((clip) => h('img', { class: 'szg-clip', src: assetUrl(`safari/guide/${clip}.webp`), alt: g.clip, loading: 'lazy', decoding: 'async' })),
        ),
      ...body(chapter, ctx),
    ),
    h(
      'footer',
      { class: 'szg-steps' },
      h('button', { class: 'arc-btn arc-btn-small sz-ghost', type: 'button', onclick: () => step(-1) }, h('span', { class: 'arc-outline' }, g.prev)),
      h('small', {}, g.page(i + 1, GUIDE_CHAPTERS.length)),
      h('button', { class: 'arc-btn arc-btn-small', type: 'button', onclick: () => step(1) }, h('span', { class: 'arc-outline' }, g.next)),
    ),
    h('button', { class: 'arc-icon-btn sz-board-close', type: 'button', 'aria-label': w.ok, title: w.ok, onclick: close }, h('img', { src: closeIcon(), alt: '' })),
  )
}
