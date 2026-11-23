import type { UpgradeStep } from './moves'

/**
 * The level-up steps of the Safári and Game Corner wave's signatures
 * (`scKitMoves.ts`): plain stat steps, with forks at Lv 4 and Lv 7. Data
 * only, so the words (`i18n/scFamilies.ts`) are built from the same numbers in
 * every language.
 */
export const SC_KIT_UPGRADES = {
  sludge: [
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.15 }, mods: ['drain'] }] },
    { damage: 2 }, { area: 0.2 },
    { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { amount: 1 }, mods: ['trail'] }] },
    { damage: 3 },
  ],
  furyAttack: [
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['execute'] }, { stats: { cooldown: -0.12 }, mods: ['arc'] }] },
    { damage: 2 }, { area: 0.2 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { amount: 1 }, mods: ['burstOnKill'] }] },
    { damage: 3 },
  ],
  moonlight: [
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['drain'] }, { stats: { cooldown: -0.15 }, mods: ['burstOnKill'] }] },
    { damage: 2 }, { area: 0.2 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { amount: 1 }, mods: ['echo'] }] },
    { damage: 3 },
  ],
  dive: [
    { damage: 2 }, { area: 0.15 },
    { fork: [{ stats: { damage: 2 }, mods: ['drain'] }, { stats: { cooldown: -0.15 }, mods: ['trail'] }] },
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { damage: 3 }, mods: ['cruel'] }, { stats: { area: 0.2 }, mods: ['burstOnKill'] }] },
    { damage: 3 },
  ],
} as const satisfies Record<string, readonly UpgradeStep[]>

export type ScKitMoveId = keyof typeof SC_KIT_UPGRADES
