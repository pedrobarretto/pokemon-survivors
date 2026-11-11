import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { formatTime } from '../engine/math'
import { ENEMIES } from '../data/enemies'
import { RUSH, RUSH_ORDER } from '../data/rush'
import { DIFFICULTY_IDS, type Difficulty } from '../game/difficulty'
import type { RushBest } from '../game/questSave'
import type { Game } from '../game/types'
import { t } from '../i18n'
import { moveIcon } from '../render/art'
import { portraitUrl } from '../render/sprites'
import { h, later, rich } from './dom'
import { lobbySheet } from './lobbySheet'
import { menu, type Screen } from './screens'

/**
 * Hoopa's Rings on screen (`game/rush.ts`): the banner on the partner
 * select's Lendários tab that opens them, the sheet to pick the rush's level,
 * the HUD pill while it runs and the end screen.
 */

/** The legends Hoopa's rings can bring from a save's captures, in their order. */
export const rushPool = (captured: readonly string[]) => RUSH_ORDER.filter((id) => captured.includes(id))

/** The banner atop the Lendários tab: Hoopa's ring, the name and a line (or how many captures it still needs). */
export const rushBanner = (captured: number, onOpen: () => void) => {
  const m = t().quests.rush
  const open = captured >= RUSH.min
  const el = h(
    'button',
    { class: open ? 'arc-card rush-banner' : 'arc-card rush-banner locked', type: 'button', onclick: () => (open ? (playSfx('select'), onOpen()) : playSfx('denied')) },
    h('img', { class: 'rush-banner-icon', src: moveIcon('hyperspaceFury'), alt: '' }),
    h('span', { class: 'rush-banner-text' }, h('b', { class: 'arc-outline' }, m.title), h('small', {}, open ? m.open : m.locked(captured, RUSH.min))),
    h('img', { class: 'rush-banner-hoopa', src: portraitUrl(ENEMIES.hoopa.dex, false), alt: '' }),
  )
  return el
}

/** The sheet picking the rush's level: each with its rings, who comes and the best time. */
export const openRushSheet = (root: HTMLElement, input: Input, opts: { captured: readonly string[]; best: RushBest; start: (difficulty: Difficulty) => void; close: () => void }): Screen => {
  const m = t().quests.rush
  const pool = rushPool(opts.captured)
  const entries = DIFFICULTY_IDS.map((difficulty) => {
    const legends = Math.min(pool.length, RUSH.rings[difficulty])
    const best = opts.best[difficulty]
    return {
      icon: h('img', { class: `rush-level-icon ${difficulty}`, src: moveIcon('hyperspaceFury'), alt: '' }),
      label: m.level(t().difficulty.names[difficulty], legends + 1),
      sub: `${m.lineup(legends, pool.length)} · ${best !== undefined ? m.best(formatTime(Math.round(best))) : m.never}`,
      extra: best !== undefined ? h('span', { class: 'rush-cleared', 'aria-hidden': 'true' }, '✓') : null,
      run: () => opts.start(difficulty),
    }
  })
  const sheet = lobbySheet(root, input, { title: m.title, entries, close: opts.close })
  sheet.el.querySelector('.lobby-sheet-head')?.after(h('p', { class: 'rush-sheet-blurb' }, m.blurb))
  return sheet
}

/** The HUD pill's text while a rush runs: the ring and the clock. */
export const rushPill = (g: Pick<Game, 'rush' | 'time'>) => {
  const r = g.rush
  if (!r || r.stage === 'cleared') return null
  return t().quests.rush.hud(Math.min(r.ring + 1, r.lineup.length), r.lineup.length, formatTime(Math.floor(g.time)))
}

/** The line a ring opening brings. */
export const rushRingLine = (ring: number, rings: number, legend: string) => (legend === 'hoopa' ? t().quests.rush.hoopa : t().quests.rush.ring(ring + 1, rings, ENEMIES[legend as keyof typeof ENEMIES]?.name ?? legend))

/**
 * The rush's end: won (the time, a record, Hoopa caught on the first clear)
 * or lost (the ring reached). Try again or leave.
 */
export const rushEnd = (root: HTMLElement, input: Input, g: Game, opts: { record: boolean; caught: boolean; again: () => void; leave: () => void }): Screen => {
  const m = t().quests.rush
  const r = g.rush!
  const won = g.phase === 'victory'
  const again = h('button', { class: 'btn' }, m.again)
  const leave = h('button', { class: 'btn' }, m.leave)
  const nav = menu(input, [again, leave], (i) => later(i === 0 ? opts.again : opts.leave), { horizontal: true })
  const el = h(
    'div',
    { class: 'screen dim rush-end' },
    h(
      'div',
      { class: 'dialog box pop wide' },
      h('img', { class: 'rush-end-hoopa', src: portraitUrl(ENEMIES.hoopa.dex, false), alt: '' }),
      h('div', { class: 'dialog-title' }, won ? m.won : m.lost),
      h('p', { class: 'rush-end-line' }, won ? m.time(formatTime(Math.round(g.time))) : m.reached(Math.min(r.ring + 1, r.lineup.length), r.lineup.length)),
      won && opts.record && h('p', { class: 'rush-end-record' }, m.record),
      won && opts.caught && h('p', { class: 'rush-end-line' }, rich(m.hoopaCaught)),
      h('div', { class: 'row' }, again, leave),
    ),
  )
  playSfx(won ? 'levelUp' : 'gameOver')
  root.append(el)
  return { el, dispose: () => (nav.off(), el.remove()) }
}
