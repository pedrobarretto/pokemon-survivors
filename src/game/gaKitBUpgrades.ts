import type { UpgradeStep } from './moves'

/**
 * The level-up steps of the second batch's signatures (`gaKitBMoves.ts`):
 * plain stat steps, with forks at Lv 4 and Lv 7. Data only, so the words
 * (`i18n/gaFamiliesB.ts`) are built from the same numbers in every language.
 */
export const GA_KIT_B_UPGRADES = {
  ironTail: [
    { damage: 2 }, { area: 0.15 },
    { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15 }, mods: ['echo'] }] },
    { damage: 2 }, { cooldown: -0.12 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['trail'] }] },
    { damage: 3 },
  ],
  eggBomb: [
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { area: 0.2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15 }, mods: ['drain'] }] },
    { damage: 2 }, { area: 0.15 },
    { fork: [{ stats: { damage: 3 }, mods: ['echo'] }, { stats: { amount: 1 }, mods: ['trail'] }] },
    { damage: 3 },
  ],
  auraSphere: [
    { damage: 2 }, { pierce: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['split'] }, { stats: { cooldown: -0.12 }, mods: ['burstOnKill'] }] },
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['bounce'] }] },
    { damage: 3 },
  ],
  acrobatics: [
    { damage: 2 }, { cooldown: -0.1 },
    { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.1 }, mods: ['arc'] }] },
    { damage: 2 }, { area: 0.2 },
    { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
    { damage: 3 },
  ],
  shadowPunch: [
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.12 }, mods: ['bounce'] }] },
    { damage: 2 }, { cooldown: -0.1 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { amount: 1 }, mods: ['burstOnKill'] }] },
    { damage: 3 },
  ],
  saltCure: [
    { damage: 1 }, { amount: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.12 }, mods: ['split'] }] },
    { damage: 2 }, { pierce: 1 },
    { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { amount: 1 }, mods: ['trail'] }] },
    { damage: 2 },
  ],
  psychoCut: [
    { damage: 2 }, { pierce: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.12 }, mods: ['boomerang'] }] },
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { damage: 3 }, mods: ['execute'] }, { stats: { area: 0.2 }, mods: ['split'] }] },
    { damage: 3 },
  ],
  poisonFang: [
    { damage: 2 }, { area: 0.2 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.12 }, mods: ['drain'] }] },
    { damage: 2 }, { cooldown: -0.1 },
    { fork: [{ stats: { damage: 3 }, mods: ['execute'] }, { stats: { area: 0.2 }, mods: ['burstOnKill'] }] },
    { damage: 3 },
  ],
  icePunch: [
    { damage: 2 }, { area: 0.2 },
    { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15 }, mods: ['cruel'] }] },
    { damage: 3 }, { cooldown: -0.12 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
    { damage: 3 },
  ],
  spark: [
    { damage: 2 }, { cooldown: -0.1 },
    { fork: [{ stats: { damage: 2 }, mods: ['arc'] }, { stats: { cooldown: -0.1 }, mods: ['burstOnKill'] }] },
    { damage: 2 }, { area: 0.2 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
    { damage: 3 },
  ],
  lunge: [
    { damage: 2 }, { cooldown: -0.1 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.1 }, mods: ['burstOnKill'] }] },
    { damage: 2 }, { area: 0.2 },
    { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['trail'] }] },
    { damage: 3 },
  ],
  electroShot: [
    { damage: 3 }, { area: 0.15 },
    { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.2 }, mods: ['arc'] }] },
    { damage: 3 }, { cooldown: -0.2 },
    { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
    { damage: 4 },
  ],
  tropKick: [
    { damage: 2 }, { area: 0.2 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.12 }, mods: ['trail'] }] },
    { damage: 2 }, { cooldown: -0.1 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['burstOnKill'] }] },
    { damage: 3 },
  ],
  powerTrip: [
    { damage: 2 }, { cooldown: -0.1 },
    { fork: [{ stats: { damage: 2 }, mods: ['execute'] }, { stats: { area: 0.2 }, mods: ['drain'] }] },
    { damage: 2 }, { area: 0.15 },
    { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { cooldown: -0.15 }, mods: ['echo'] }] },
    { damage: 3 },
  ],
  hammerArm: [
    { damage: 3 }, { area: 0.15 },
    { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.2 }, mods: ['echo'] }] },
    { damage: 3 }, { cooldown: -0.15 },
    { fork: [{ stats: { damage: 5 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['trail'] }] },
    { damage: 4 },
  ],
} as const satisfies Record<string, readonly UpgradeStep[]>

export type GaKitBMoveId = keyof typeof GA_KIT_B_UPGRADES
