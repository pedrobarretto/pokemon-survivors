/**
 * The lobby's ask for support at a milestone (`ui/supportAsk.ts`): once per
 * device per milestone, from what the save already counts. Pure, so the rules
 * are tested apart from the screen.
 */

/** The milestones, in the order they're asked about. */
export const SUPPORT_MILESTONES = ['runs25', 'nightmare', 'runs100'] as const

export type SupportMilestone = (typeof SUPPORT_MILESTONES)[number]

export const SUPPORT_ASK = {
  /** Runs that make `runs25` and `runs100`. */
  runs: { runs25: 25, runs100: 100 },
  /** Visits to the game (`countVisit`) before it may ask at all: never in the first sessions. */
  sessions: 3,
} as const

/** What the ask reads: the save's lifetime runs, whether Mewtwo fell on Nightmare, the device's visits. */
export type AskProgress = { runs: number; nightmare: boolean; sessions: number }

/** The milestones `p` has reached. */
export const reachedMilestones = (p: AskProgress): SupportMilestone[] =>
  SUPPORT_MILESTONES.filter((m) => (m === 'nightmare' ? p.nightmare : p.runs >= SUPPORT_ASK.runs[m]))

/**
 * The milestone to ask about now, or null: past the first sessions, for
 * anyone not supporting yet, the first reached milestone this device hasn't
 * been asked about. Asking marks every milestone reached by then
 * (`reachedMilestones`), so a player who passed several asks once, and again
 * only at the next one.
 */
export const supportAskDue = (p: AskProgress & { supporter: boolean; asked: readonly SupportMilestone[] }): SupportMilestone | null => {
  if (p.supporter || p.sessions < SUPPORT_ASK.sessions) return null
  return reachedMilestones(p).find((m) => !p.asked.includes(m)) ?? null
}
