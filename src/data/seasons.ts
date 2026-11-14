/**
 * The run boards' seasons. Import-free: the API reads it too. `day` is the
 * Brasília day a season opens and `start` the moment it opens, in UTC (set to
 * the update's deploy, so the morning's runs on the old version stay on Era 1):
 * runs started before it stay on the Era 1 board for good. `challengeDay` is
 * the first Desafio do dia drawn from the new pool (`game/challenge.ts`), the
 * day after the deploy, so no day changes its challenge halfway through.
 */
export const SEASON_ONE = { day: '2026-11-16', start: '2026-11-16T15:00:00Z', challengeDay: '2026-11-17' } as const
