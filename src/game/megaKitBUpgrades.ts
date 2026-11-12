import type { UpgradeStep } from './moves'

/**
 * The level-up steps of the Mega families' signatures (`megaKitBMoves.ts`):
 * plain stat steps, with forks at Lv 4 and Lv 7. Data only, so the words
 * (`i18n/megaFamiliesB.ts`) are built from the same numbers in every language.
 */
export const MEGA_KIT_B_UPGRADES = {
  highJumpKick: [
    { damage: 3 }, { area: 0.15 },
    { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15 }, mods: ['echo'] }] },
    { damage: 3 }, { cooldown: -0.12 },
    { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['execute'] }] },
    { damage: 4 },
  ],
  magnitude: [
    { damage: 2 }, { area: 0.12 },
    { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15 }, mods: ['echo'] }] },
    { damage: 2 }, { area: 0.12 },
    { fork: [{ stats: { damage: 4 }, mods: ['cruel'] }, { stats: { area: 0.2 }, mods: ['vortex'] }] },
    { damage: 3 },
  ],
  dizzyPunch: [
    { damage: 2 }, { cooldown: -0.1 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
    { damage: 2 }, { area: 0.15 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { cooldown: -0.12 }, mods: ['echo'] }] },
    { damage: 3 },
  ],
  fairyWind: [
    { damage: 1 }, { amount: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['drain'] }, { stats: { cooldown: -0.12 }, mods: ['split'] }] },
    { damage: 2 }, { pierce: 1 },
    { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { amount: 1 }, mods: ['seek'] }] },
    { damage: 2 },
  ],
  venomDrench: [
    { damage: 2 }, { speed: 30 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.12 }, mods: ['split'] }] },
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { speed: 40 }, mods: ['bounce'] }] },
    { damage: 3 },
  ],
} as const satisfies Record<string, readonly UpgradeStep[]>
