import type { UpgradeStep } from './moves'

/**
 * The level-up steps of the hook families' moves (`gaHookMoves.ts`): plain
 * stat steps, with forks at Lv 4 and Lv 7. Data only, so the words
 * (`i18n/gaHook.ts`) are built from the same numbers in every language.
 */
export const GA_HOOK_UPGRADES = {
  bugBuzz: [
    { damage: 2 }, { area: 0.15 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.15 }, mods: ['echo'] }] },
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { area: 0.2 }, mods: ['drain'] }] },
    { damage: 3 },
  ],
  powerGem: [
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['split'] }, { stats: { cooldown: -0.12 }, mods: ['bounce'] }] },
    { damage: 2 }, { pierce: 1 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { amount: 1 }, mods: ['burstOnKill'] }] },
    { damage: 3 },
  ],
  fakeOut: [
    { damage: 2 }, { cooldown: -0.1 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { damage: 3 }, mods: ['execute'] }, { stats: { cooldown: -0.12 }, mods: ['echo'] }] },
    { damage: 3 },
  ],
  highJumpKick: [
    { damage: 3 }, { area: 0.15 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { cooldown: -0.15 }, mods: ['burstOnKill'] }] },
    { damage: 3 }, { cooldown: -0.12 },
    { fork: [{ stats: { damage: 4 }, mods: ['execute'] }, { stats: { area: 0.2 }, mods: ['trail'] }] },
    { damage: 4 },
  ],
  tripleKick: [
    { damage: 2 }, { area: 0.12 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.12 }, mods: ['drain'] }] },
    { damage: 2 }, { area: 0.12 },
    { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.12 }, mods: ['echo'] }] },
    { damage: 3 },
  ],
  voltSwitch: [
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['arc'] }, { stats: { cooldown: -0.12 }, mods: ['bounce'] }] },
    { damage: 2 }, { pierce: 1 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { amount: 1 }, mods: ['split'] }] },
    { damage: 3 },
  ],
  eerieImpulse: [
    { damage: 1 }, { area: 0.15 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.15 }, mods: ['drain'] }] },
    { damage: 2 }, { area: 0.15 },
    { fork: [{ stats: { damage: 3 }, mods: ['echo'] }, { stats: { area: 0.2 }, mods: ['trail'] }] },
    { damage: 2 },
  ],
} as const satisfies Record<string, readonly UpgradeStep[]>

export type GaHookMoveId = keyof typeof GA_HOOK_UPGRADES
