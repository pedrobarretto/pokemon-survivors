import { ULTRA_BEASTS, type UltraBeast } from '../data/ultraBeasts'
import { addDays, brasiliaDay, dayNumber, previousDay, weekStart, type DayKey } from './day'

/**
 * The Ultra Beast of the week: the same for everyone, walking `ULTRA_BEASTS`
 * in order, one Brasília week (Monday to Sunday) each, so every beast comes
 * back every ten weeks and nobody has to set it by hand. Its Ultra Wormhole
 * comes more often that week (`WORMHOLE.weekly`). It's a run input
 * (`ReplayStart.ultra`): the API deals it with a ranked run's token and fails
 * a replay whose beast isn't the one of the week it started in, or the day
 * before (`ultraFits`), like the outbreak. Pure.
 */

/** Weeks since the epoch's first Monday (1970-01-05), the index the rotation walks. */
const weekIndex = (day: DayKey) => Math.floor((dayNumber(weekStart(day)) - 4) / 7)

/** The beast of the week `day` falls in. */
export const ultraOfWeek = (day: DayKey): UltraBeast => {
  const n = ULTRA_BEASTS.length
  return ULTRA_BEASTS[((weekIndex(day) % n) + n) % n]!
}

/** This week's beast, for a run starting at `now`. */
export const ultraAt = (now: Date) => ultraOfWeek(brasiliaDay(now))

/** The last day (Sunday) the beast of `day`'s week holds. */
export const ultraWeekEnd = (day: DayKey): DayKey => addDays(weekStart(day), 6)

/** Whether a run that started at `startedAt` may have played `ultra` as its beast of the week: that day's, or the day before's (the menus picked it just before midnight). None at all is no advantage. */
export const ultraFits = (ultra: UltraBeast | null | undefined, startedAt: Date) => {
  if (ultra == null) return true
  const day = brasiliaDay(startedAt)
  return ultra === ultraOfWeek(day) || ultra === ultraOfWeek(previousDay(day))
}
