/**
 * The player survey the lobby asks (`ui/survey.ts`): how each difficulty
 * feels. Answers go to analytics as `survey_difficulty`. A new question gets
 * a new `id`, so devices that answered the old one are asked again.
 */
export const SURVEY = {
  id: 'difficulty-2026-10',
  /** Runs played before the lobby asks: a brand new player can't judge the difficulty yet. */
  minRuns: 3,
} as const

export const SURVEY_ANSWERS = ['easy', 'medium', 'hard', 'unsure'] as const

export type SurveyAnswer = (typeof SURVEY_ANSWERS)[number]

/**
 * The second survey: what players think of the redesign, once they've lived
 * with it. The answer goes to analytics as `survey_design`. Tune the waits here.
 */
export const DESIGN_SURVEY = {
  id: 'design-2026-11',
  /** Different days the device has opened the new lobby before it asks. */
  minDays: 2,
  /** Runs played since the new lobby was first seen before it asks. */
  minRuns: 3,
  /** Runs already banked when the new lobby was first seen that make a player `returning`: a new device's first run comes before its first lobby, so 1 can't tell. */
  returningRuns: 3,
  /** How many of `DESIGN_ASPECTS` one answer may hold. */
  maxAspects: 2,
} as const

export const DESIGN_RATINGS = [1, 2, 3, 4, 5] as const

export type DesignRating = (typeof DESIGN_RATINGS)[number]

/** What stands out, in opposite pairs: the two sides of a pair can't both be picked. */
export const DESIGN_ASPECT_PAIRS = [
  ['easyToFind', 'hardToFind'],
  ['niceLook', 'badLook'],
  ['readable', 'hardToRead'],
] as const

export const DESIGN_ASPECTS = DESIGN_ASPECT_PAIRS.flat()

export type DesignAspect = (typeof DESIGN_ASPECTS)[number]

/** The answer after a tap on `aspect`: off if it was on; on, in place of its opposite, and past the limit the oldest pick goes. */
export const toggleAspect = (picked: readonly DesignAspect[], aspect: DesignAspect): DesignAspect[] => {
  if (picked.includes(aspect)) return picked.filter((a) => a !== aspect)
  const pair = DESIGN_ASPECT_PAIRS.find((p) => p.some((a) => a === aspect))
  const kept = picked.filter((a) => !pair?.some((p) => p === a))
  return [...kept, aspect].slice(-DESIGN_SURVEY.maxAspects)
}

/** What a device remembers of the new design: the day and the runs it was first seen with, and the different days it's been seen on. */
export type DesignSeen = { first: string; last: string; days: number; runs: number }

/** `seen` after the new lobby opens on `day` (a local `YYYY-MM-DD`) with `runs` banked. */
export const seenOn = (seen: DesignSeen | null, day: string, runs: number): DesignSeen => {
  if (!seen) return { first: day, last: day, days: 1, runs }
  return day === seen.last ? seen : { ...seen, last: day, days: seen.days + 1 }
}

/** Whether a player has lived with the new design for long enough to be asked about it. */
export const designSurveyDue = (seen: DesignSeen | null, runs: number) =>
  seen !== null && seen.days >= DESIGN_SURVEY.minDays && runs - seen.runs >= DESIGN_SURVEY.minRuns

/** Whole days from one `YYYY-MM-DD` to another. */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
