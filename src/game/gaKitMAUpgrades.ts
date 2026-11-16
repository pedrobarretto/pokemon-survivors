import type { UpgradeStep } from './moves'

/**
 * The level-up steps of the Mega families' signatures (`gaKitMAMoves.ts`):
 * plain stat steps, with forks at Lv 4 and Lv 7. Data only, so the words
 * (`i18n/gaMegaFamiliesA.ts`) are built from the same numbers in every language.
 */
export const GA_KIT_MA_UPGRADES = {
  cometPunch: [
    { damage: 1 }, { amount: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['hunter'] }, { stats: { cooldown: -0.12 }, mods: ['drain'] }] },
    { damage: 1 }, { area: 0.15 },
    { fork: [{ stats: { amount: 1 }, mods: ['echo'] }, { stats: { damage: 2 }, mods: ['burstOnKill'] }] },
    { damage: 2 },
  ],
  stormThrow: [
    { damage: 2 }, { area: 0.15 },
    { fork: [{ stats: { damage: 3 }, mods: ['execute'] }, { stats: { cooldown: -0.15 }, mods: ['burstOnKill'] }] },
    { damage: 2 }, { cooldown: -0.12 },
    { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['cruel'] }] },
    { damage: 3 },
  ],
  airCutter: [
    { damage: 2 }, { pierce: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['boomerang'] }, { stats: { amount: 1 }, mods: ['split'] }] },
    { damage: 2 }, { cooldown: -0.1 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { pierce: 2 }, mods: ['trail'] }] },
    { damage: 3 },
  ],
  drillRun: [
    { damage: 1 }, { area: 0.15 },
    { fork: [{ stats: { damage: 2 }, mods: ['execute'] }, { stats: { cooldown: -0.15 }, mods: ['trail'] }] },
    { damage: 1 }, { cooldown: -0.12 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['burstOnKill'] }] },
    { damage: 2 },
  ],
  hyperVoice: [
    { damage: 2 }, { area: 0.15 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.15 }, mods: ['echo'] }] },
    { damage: 2 }, { cooldown: -0.12 },
    { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { area: 0.2 }, mods: ['drain'] }] },
    { damage: 3 },
  ],
} as const satisfies Record<string, readonly UpgradeStep[]>

export type GaKitMAMoveId = keyof typeof GA_KIT_MA_UPGRADES
