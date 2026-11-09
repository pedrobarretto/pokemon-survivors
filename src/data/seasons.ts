/**
 * The run boards' seasons. Import-free: the API reads it too. `day` is the
 * Brasília day a season opens and `start` that midnight in UTC: runs started
 * before it stay on the Era 1 board for good.
 */
export const SEASON_ONE = { day: '2026-11-16', start: '2026-11-16T03:00:00Z' } as const
