import type { Sfx } from '../engine/audio'
import { formatTime } from '../engine/math'
import { ENEMIES } from '../data/enemies'
import { isForceLegend, type SwordId } from '../data/legends'
import { duelTest } from '../game/duels'
import type { Game, GameEvent } from '../game/types'
import { t } from '../i18n'
import { leafIcon, swordIcon } from '../render/quests'
import { h, setText } from './dom'

/**
 * The open map's legends in words (`game/roamers.ts`, `game/duels.ts`): the
 * news each of their moments brings (a roamer sighted or gone, a Sword
 * waiting, the duel's test, its end), the HUD pill while one is about, and
 * the duel's card while one is on (`createDuelCard`).
 */

type QuestEvent = Extract<GameEvent, { kind: 'roam' | 'duel' }>

/** What the shell shows and plays for a moment: a line for the news (none for a quiet one), a sound, a cry. */
export type QuestNews = { line: string | null; ms: number; sfx: Sfx | null; cry: number | null }

const pct = (share: number) => Math.max(1, Math.round(share * 100))

export const questNews = (e: QuestEvent): QuestNews => {
  const m = t().quests
  if (e.kind === 'roam') {
    const name = ENEMIES[e.legend].name
    const dex = ENEMIES[e.legend].dex
    const f = isForceLegend(e.legend) ? e.legend : null
    switch (e.moment) {
      case 'sighted':
        // A Force's first visit plays its entrance, cry and card included: its line only.
        return f ? { line: t().regisForces.force.sighted[f](pct(e.left)), ms: 4600, sfx: null, cry: null } : { line: m.roam.sighted(name, pct(e.left)), ms: 4200, sfx: 'legendary', cry: dex }
      case 'rage': {
        const line = f ? t().regisForces.phases[f][Math.max(0, Math.min(1, e.phase - 1))] : undefined
        return { line: line ?? null, ms: 3800, sfx: 'boss', cry: dex }
      }
      case 'fled':
        return { line: m.roam.fled(name, pct(e.left)), ms: 3600, sfx: 'escaped', cry: null }
      case 'wiped':
        return { line: m.roam.wiped, ms: 2400, sfx: 'hypnosis', cry: null }
      case 'caught':
        return { line: null, ms: 0, sfx: null, cry: null }
    }
  }
  const name = ENEMIES[e.sword].name
  const test = duelTest(e.sword)
  switch (e.moment) {
    case 'waiting':
      return { line: m.duel.waiting(name, m.duel.tests[test.kind]), ms: 5000, sfx: 'legendary', cry: ENEMIES[e.sword].dex }
    case 'began': {
      const line = test.kind === 'endure' ? m.duel.began.endure(name, Math.round(test.floor * 100)) : test.kind === 'power' ? m.duel.began.power(name) : m.duel.began.speed(name, test.marks)
      return { line, ms: 4000, sfx: 'boss', cry: ENEMIES[e.sword].dex }
    }
    case 'mark':
      return { line: null, ms: 0, sfx: 'pickup', cry: null }
    case 'passed':
      return { line: m.duel.passed(name), ms: 3000, sfx: 'levelUp', cry: ENEMIES[e.sword].dex }
    case 'failed':
      return { line: m.duel.failed(name), ms: 4000, sfx: 'escaped', cry: null }
    case 'left':
      return { line: m.duel.left(name), ms: 3000, sfx: null, cry: null }
  }
}

/** The HUD pill's text while a duel is on or a Sword waits, or a roamer is about; null otherwise. */
export const questPill = (g: Pick<Game, 'quests' | 'time'>): { text: string; urgent: boolean } | null => {
  const m = t().quests
  const d = g.quests.duel
  // A duel on shows its own card instead.
  if (d?.stage === 'dueling') return null
  if (d?.stage === 'waiting') return { text: m.duel.hudWaiting(ENEMIES[d.sword].name, formatTime(Math.ceil(Math.max(0, d.left)))), urgent: d.left < 8 }
  const r = g.quests.roam
  if (r && r.body >= 0 && g.time >= r.hidden) return { text: m.roam.hud(ENEMIES[r.legend].name, pct(r.left)), urgent: false }
  return null
}

/** Seconds left under which the duel's clock turns red and pulses. */
const URGENT = 8

/**
 * The duel's card under the boss bar while a Sword tests the player: the
 * test's name in the Sword's color, what passes it, and its clock draining;
 * Cobalion's adds the player's HP against the line it mustn't fall under,
 * Virizion's the leaves stepped on so far.
 */
export const createDuelCard = () => {
  const icon = h('img', { class: 'duel-icon', alt: '' })
  const test = h('span', { class: 'duel-test' })
  const goal = h('div', { class: 'duel-goal' })
  const fill = h('i', { class: 'duel-fill' })
  const clock = h('span', { class: 'duel-clock' })
  const hpFill = h('i', { class: 'duel-hp-fill' })
  const hpShare = h('span', { class: 'duel-clock' })
  const hp = h('div', { class: 'duel-row' }, h('span', { class: 'duel-tag' }, 'HP'), h('div', { class: 'duel-hp' }, hpFill, h('i', { class: 'duel-floor' })), hpShare)
  const leaves = h('div', { class: 'duel-leaves' })
  const el = h('div', { class: 'duel-card box hidden' }, h('div', { class: 'duel-head' }, icon, test), goal, h('div', { class: 'duel-row' }, h('div', { class: 'duel-bar' }, fill), clock), hp, leaves)
  let shown: SwordId | null = null
  let leafKey = ''
  const update = (g: Game) => {
    const d = g.quests.duel
    const on = d?.stage === 'dueling'
    el.classList.toggle('hidden', !on)
    if (!d || !on) return (shown = null)
    const m = t().quests.duel
    const spec = duelTest(d.sword)
    if (shown !== d.sword) {
      shown = d.sword
      el.dataset.sword = d.sword
      icon.src = swordIcon(d.sword)
      setText(test, m.tests[spec.kind])
      hp.classList.toggle('hidden', spec.kind !== 'endure')
      leaves.classList.toggle('hidden', spec.kind !== 'speed')
      if (spec.kind === 'endure') hp.style.setProperty('--floor', `${spec.floor * 100}%`)
      leafKey = ''
    }
    const left = Math.max(0, d.left)
    fill.style.width = `${(left / spec.time) * 100}%`
    setText(clock, formatTime(Math.ceil(left)))
    el.classList.toggle('urgent', left < URGENT)
    if (spec.kind === 'endure') {
      const p = g.player
      const share = Math.max(0, p.hp / p.stats.maxHp)
      hpFill.style.width = `${share * 100}%`
      setText(hpShare, `${Math.round(share * 100)}%`)
      hp.classList.toggle('low', share < spec.floor + 0.12)
      setText(goal, m.goal.endure(Math.round(spec.floor * 100)))
    } else if (spec.kind === 'power') setText(goal, m.goal.power)
    else {
      setText(goal, m.goal.speed(d.marks, spec.marks))
      const key = `${d.marks}/${spec.marks}`
      if (key !== leafKey) {
        leafKey = key
        leaves.replaceChildren(...Array.from({ length: spec.marks }, (_, i) => h('img', { class: i < d.marks ? 'got' : '', src: leafIcon(i < d.marks), alt: '' })))
      }
    }
  }
  return { el, update }
}
