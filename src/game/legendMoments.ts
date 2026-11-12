import { REGIGIGAS } from '../data/legendPaths'
import type { Game } from './types'

/**
 * The legend moments a run can bring onto the open map, each on a schedule of
 * its own: a rift's omen, portal and room (the Ultra Wormhole's too), a Tera
 * den and its raid, a Sword of Justice waiting in its circle or dueling, a
 * lake legend visiting, Regigigas's temple rising or waking, and Zeraora's
 * storm gathering or fighting. Several fall
 * around 8:00, so each waits while another is under way (`momentBusy`)
 * instead of stacking on the same screen.
 */
export type LegendMoment = 'rift' | 'raid' | 'duel' | 'roam' | 'temple' | 'storm'

const UNDER_WAY: Record<LegendMoment, (g: Game) => boolean> = {
  rift: (g) => g.rift.omen !== null || g.rift.portal !== null || g.rift.arena !== null,
  raid: (g) => g.raid.den !== null || g.raid.arena !== null,
  duel: (g) => g.quests.duel?.stage === 'waiting' || g.quests.duel?.stage === 'dueling',
  roam: (g) => g.quests.roam !== null && g.quests.roam.body !== -1,
  // Asleep, the temple can stand all run: only its rise and its waking hold the others (the giant, once out, is a boss fight).
  temple: (g) => g.mapEvents.list.some((ev) => ev.kind === 'regiTemple' && !ev.state.out && (ev.age < REGIGIGAS.rise || ev.state.waking >= 0)),
  storm: (g) => g.quests.storm?.stage === 'gathering' || g.quests.storm?.stage === 'fight',
}

const MOMENTS = Object.keys(UNDER_WAY) as LegendMoment[]

/**
 * Whether a legend moment other than `self` is under way, so `self` should
 * wait. `ignore` leaves some out: a rift or a den keeps its slot through a
 * lake legend's visit, which just flees.
 */
export const momentBusy = (g: Game, self: LegendMoment, ignore: readonly LegendMoment[] = []) =>
  MOMENTS.some((m) => m !== self && !ignore.includes(m) && UNDER_WAY[m](g))
