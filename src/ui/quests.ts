import type { Sfx } from '../engine/audio'
import { formatTime } from '../engine/math'
import { ENEMIES } from '../data/enemies'
import { duelTest } from '../game/duels'
import type { Game, GameEvent } from '../game/types'
import { t } from '../i18n'

/**
 * The open map's legends in words (`game/roamers.ts`, `game/duels.ts`): the
 * news each of their moments brings (a roamer sighted or gone, a Sword
 * waiting, the duel's test, its end) and the HUD pill while one is about.
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
    switch (e.moment) {
      case 'sighted':
        return { line: m.roam.sighted(name, pct(e.left)), ms: 4200, sfx: 'legendary', cry: dex }
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
  if (d && (d.stage === 'dueling' || d.stage === 'waiting')) {
    const name = ENEMIES[d.sword].name
    const time = formatTime(Math.ceil(Math.max(0, d.left)))
    if (d.stage === 'waiting') return { text: m.duel.hudWaiting(name, time), urgent: d.left < 8 }
    const test = duelTest(d.sword)
    const text = test.kind === 'endure' ? m.duel.hudEndure(name, time) : test.kind === 'power' ? m.duel.hudPower(name, time) : m.duel.hudSpeed(d.marks, test.marks, time)
    return { text, urgent: d.left < 8 }
  }
  const r = g.quests.roam
  if (r && r.body >= 0 && g.time >= r.hidden) return { text: m.roam.hud(ENEMIES[r.legend].name, pct(r.left)), urgent: false }
  return null
}
