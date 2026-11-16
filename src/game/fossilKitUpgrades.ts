import type { UpgradeStep } from './moves'

/**
 * The level-up steps of the fossil families' signatures (`fossilKitMoves.ts`):
 * plain stat steps, with forks at Lv 4 and Lv 7. Data only, so the words
 * (`i18n/gaFossils.ts`) are built from the same numbers in every language.
 */
export const FOSSIL_KIT_UPGRADES = {
  wingAttack: [
    { damage: 2 }, { area: 0.15 },
    { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.12 }, mods: ['echo'] }] },
    { damage: 2 }, { cooldown: -0.1 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['trail'] }] },
    { damage: 3 },
  ],
  spikeCannon: [
    { damage: 1 }, { amount: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['split'] }, { stats: { cooldown: -0.12 }, mods: ['bounce'] }] },
    { damage: 2 }, { pierce: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { amount: 1 }, mods: ['burstOnKill'] }] },
    { damage: 2 },
  ],
  ingrain: [
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['drain'] }, { stats: { cooldown: -0.15 }, mods: ['cruel'] }] },
    { damage: 2 }, { area: 0.2 },
    { fork: [{ stats: { damage: 3 }, mods: ['execute'] }, { stats: { amount: 1 }, mods: ['trail'] }] },
    { damage: 3 },
  ],
  crushClaw: [
    { damage: 2 }, { area: 0.15 },
    { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.12 }, mods: ['echo'] }] },
    { damage: 2 }, { cooldown: -0.1 },
    { fork: [{ stats: { damage: 4 }, mods: ['execute'] }, { stats: { area: 0.2 }, mods: ['burstOnKill'] }] },
    { damage: 3 },
  ],
  boltBeak: [
    { damage: 2 }, { cooldown: -0.1 },
    { fork: [{ stats: { damage: 2 }, mods: ['arc'] }, { stats: { cooldown: -0.1 }, mods: ['burstOnKill'] }] },
    { damage: 3 }, { area: 0.2 },
    { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['trail'] }] },
    { damage: 3 },
  ],
  icicleCrash: [
    { damage: 2 }, { amount: 1 },
    { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15 }, mods: ['split'] }] },
    { damage: 2 }, { area: 0.2 },
    { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { amount: 1 }, mods: ['echo'] }] },
    { damage: 3 },
  ],
  fishiousRend: [
    { damage: 2 }, { cooldown: -0.1 },
    { fork: [{ stats: { damage: 2 }, mods: ['drain'] }, { stats: { cooldown: -0.1 }, mods: ['burstOnKill'] }] },
    { damage: 3 }, { area: 0.2 },
    { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
    { damage: 3 },
  ],
} as const satisfies Record<string, readonly UpgradeStep[]>

export type FossilKitMoveId = keyof typeof FOSSIL_KIT_UPGRADES
