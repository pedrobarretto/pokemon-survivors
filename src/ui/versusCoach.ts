import { VERSUS } from '../data/versus'
import type { Game, Player } from '../game/types'
import { goalOpen, rivalTeam } from '../game/versusRules'
import { healing, LOW_HP, objectiveOf, standsIn } from '../render/versusGuide'
import { t } from '../i18n'
import { h, rich } from './dom'
import type { Action } from '../engine/bindings'
import { rivalsInReach } from '../game/versusKit'

/**
 * The Arena's coach: one short line under the score saying what to do now
 * (farm, carry the Energy to a rival goal, stay in it, go heal, take the
 * objective, the kit's keys and how to lock a target...), so a first match teaches the mode as it plays. `coachTip`
 * picks the line (pure); `createCoach` holds it on screen without flicker.
 * After a few matches on this device (`ps:arenaMatches`) the basics go quiet.
 */

export type CoachTip = 'locked' | 'channel' | 'lowHp' | 'defend' | 'grass' | 'full' | 'zapdos' | 'drednaw' | 'stretch' | 'kit' | 'aim' | 'carry' | 'farm'

/** Most urgent first: a more urgent line replaces the one shown at once. */
const ORDER: readonly CoachTip[] = ['locked', 'channel', 'lowHp', 'defend', 'grass', 'full', 'zapdos', 'drednaw', 'stretch', 'kit', 'aim', 'carry', 'farm']

/** What a new player needs and a veteran doesn't. */
const BASICS: ReadonlySet<CoachTip> = new Set<CoachTip>(['farm', 'carry', 'channel', 'grass', 'kit', 'aim'])

/** The opening seconds the kit's line shows in (match seconds). */
const KIT_SECONDS = 20

/** The line for `me` now, most urgent first; null on the bench or when nothing needs saying. `quiet`: the basics left out. */
export const coachTip = (g: Game, me: Player, quiet = false): CoachTip | null => {
  const s = g.versus
  const v = me.versus
  if (!s || !v || me.hp <= 0 || g.phase !== 'playing') return null
  const tips: CoachTip[] = []
  if (me.hp / me.stats.maxHp < LOW_HP && !healing(g, me)) tips.push('lowHp')
  if (v.energy > 0) {
    const rival = rivalTeam(v.team)
    const inside = s.goals.find((goal) => goal.team === rival && !goal.broken && standsIn(me, goal.x, goal.y, goal.r))
    if (inside && !goalOpen(s, inside)) tips.push('locked')
    else if (inside) tips.push('channel')
  }
  const mine = v.team
  if (g.players.some((p) => p.versus && p.versus.team !== mine && p.hp > 0 && p.versus.goal >= 0 && p.versus.channel > 0 && s.goals[p.versus.goal]?.team === mine)) tips.push('defend')
  // In tall grass: what it does, the first times (a basic).
  if (v.grass >= 0) tips.push('grass')
  if (v.energy >= VERSUS.energy.cap) tips.push('full')
  const objective = objectiveOf(g)
  if (objective?.kind === 'zapdos') tips.push('zapdos')
  else if (objective) tips.push('drednaw')
  else if (s.stretch) tips.push('stretch')
  // The kit: its controls in the opening seconds, then how to lock once a rival is in reach and nothing is locked.
  if (g.time < KIT_SECONDS) tips.push('kit')
  else if (v.lock < 0 && rivalsInReach(g, me).length > 0) tips.push('aim')
  tips.push(v.energy > 0 ? 'carry' : 'farm')
  for (const tip of ORDER) if (tips.includes(tip) && !(quiet && BASICS.has(tip))) return tip
  return null
}

const MATCHES_KEY = 'ps:arenaMatches'
/** Matches after which the basics go quiet. */
const QUIET_AFTER = 3

/** Matches this device has finished in the Arena. */
export const arenaMatches = () => {
  try {
    return Number(localStorage.getItem(MATCHES_KEY)) || 0
  } catch {
    return 0
  }
}

/** Counts a finished match (the end screen calls it once per match). */
export const countArenaMatch = () => {
  try {
    localStorage.setItem(MATCHES_KEY, String(arenaMatches() + 1))
  } catch {
    // Storage blocked: every match coaches.
  }
}

/** A line stays at least this long before a calmer one replaces it (s); a wanted line waits this long before it shows. */
const HOLD = 2.4
const SETTLE = 0.35
/** How long a line can stay before it fades (s): a state that lasts (an objective up, carrying across the map) is said once. */
const TTL: Record<CoachTip, number> = { lowHp: 8, locked: 6, channel: 30, defend: 6, grass: 5, full: 8, zapdos: 7, drednaw: 7, stretch: 6, kit: KIT_SECONDS, aim: 6, carry: 10, farm: 12 }

/** Whether this device plays by touch: the kit's lines name the buttons instead of the keys. */
const touch = () => window.matchMedia?.('(pointer: coarse)').matches === true

/** A tip's line, the kit's with the keys bound now (`keyOf`). */
const lineOf = (tip: CoachTip, keyOf: (action: Action) => string) => {
  const c = t().versus.coach
  if (tip === 'kit') return touch() ? c.kitTouch : c.kit(keyOf('move1'), keyOf('move2'), keyOf('unite'))
  if (tip === 'aim') return touch() ? c.aimTouch : c.aim(keyOf('target'))
  return c[tip]
}
/** A faded line comes back only after it stopped being wanted this long (s). */
const REST = 4

/** The coach's line under the score. `update` every frame with this player on the draw copy; `keyOf` names an action's key. */
export const createCoach = (keyOf: (action: Action) => string) => {
  const quiet = arenaMatches() >= QUIET_AFTER
  const text = h('span', { class: 'vs-coach-text' })
  const el = h('div', { class: 'vs-coach hidden', role: 'status' }, text)
  let shown: CoachTip | null = null
  let shownAt = 0
  let wanted: CoachTip | null = null
  let wantedAt = 0
  /** When each faded line was last wanted (it rests until `REST` after). */
  const spent = new Map<CoachTip, number>()

  const show = (tip: CoachTip | null, now: number) => {
    shown = tip
    shownAt = now
    el.classList.toggle('hidden', tip === null)
    if (tip === null) return
    text.replaceChildren(rich(lineOf(tip, keyOf)))
    el.dataset.tip = tip
    el.classList.remove('in')
    void el.offsetWidth
    el.classList.add('in')
  }

  const update = (g: Game, me: Player) => {
    const now = performance.now() / 1000
    let tip = coachTip(g, me, quiet)
    // A faded line rests while it's still wanted.
    for (const [k, at] of spent) {
      if (k === tip) spent.set(k, now)
      else if (now - at > REST) spent.delete(k)
    }
    if (tip && spent.has(tip)) tip = null
    if (tip !== wanted) {
      wanted = tip
      wantedAt = now
    }
    // On the bench the knockout overlay speaks: the line goes at once.
    if (me.hp <= 0) {
      wanted = null
      if (shown) show(null, now)
      return
    }
    if (shown && now - shownAt > TTL[shown]) {
      spent.set(shown, now)
      return show(null, now)
    }
    if (wanted === shown || now - wantedAt < SETTLE) return
    const urgent = wanted !== null && (shown === null || ORDER.indexOf(wanted) < ORDER.indexOf(shown))
    if (urgent || now - shownAt >= HOLD) show(wanted, now)
  }

  return { el, update }
}
