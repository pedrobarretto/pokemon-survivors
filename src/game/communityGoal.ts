import { HALLOWEEN } from '../data/halloween'
import { LEGEND_IDS, LEGENDS, type LegendDef } from '../data/legends'
import { isRecord, wholeNumber } from './parse'

/**
 * Meta da comunidade (`HALLOWEEN.community`): the API sums every account's
 * candy jar (`GET /candy-goal`), and reaching the goal opens Mega Darkrai for
 * everyone. The form only changes what the screen shows (the legend's look
 * and name, never its types or stats), so the simulation runs the same
 * locked or open: a co-op team where one player saw the goal reached and
 * another didn't yet stays in step, and the server's re-simulation needn't
 * know. The shell opens it (`src/candyGoal.ts`) once the API says so.
 */

/** Where the goal stands: the candies counted, the goal and whether they reached it. */
export type CandyGoal = { candies: number; goal: number; reached: boolean }

/** The goal at `candies` counted. */
export const candyGoalAt = (candies: number): CandyGoal => ({ candies, goal: HALLOWEEN.community.goal, reached: candies >= HALLOWEEN.community.goal })

/** `GET /candy-goal`'s answer (only its `candies` are trusted; the goal is ours), or null when it isn't one. */
export const parseCandyGoal = (v: unknown): CandyGoal | null => (isRecord(v) && typeof v.candies === 'number' ? candyGoalAt(wholeNumber(v.candies)) : null)

/** The awakened forms behind the goal (`LegendDef.form.community`), by species. */
const COMMUNITY_FORMS = LEGEND_IDS.flatMap((id) => {
  const def: LegendDef = LEGENDS[id]
  return def.form?.community ? [{ dex: def.line[0].dex, key: def.form.key }] : []
})

let open = false

/** Opens the forms behind the goal (the goal reached), or closes them again (the dev console). */
export const setCommunityOpen = (on: boolean) => {
  open = on
}

export const communityOpen = () => open

/** Whether a legend's awakened form still waits on the goal: until it opens, the legend keeps its own name. */
export const formLocked = (form: LegendDef['form'] | null) => form?.community === true && !open

/** Whether the sheets and cry of `dex`'s `form` still wait on the goal: until it opens, they draw (and sound) as the species' own. */
export const sheetsLocked = (dex: number, form: string) => !open && COMMUNITY_FORMS.some((f) => f.dex === dex && f.key === form)
