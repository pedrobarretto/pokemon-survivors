/** Import-free, so `data/enemies.ts` can spread it without a cycle (`data/rocketHideout.ts` has the rest). */

/** The lair's bosses as foes (`ENEMIES` spreads them): Giovanni's Persian, then Shadow Mewtwo (drawn in SpriteCollab's Shadow sheets, `phases` with `form`). */
export const HIDEOUT_BOSSES = {
  giovanniPersian: { dex: 53, name: 'Persian', types: ['normal'], hp: 1500, speed: 64, damage: 20, xp: 0, mass: 24, boss: true },
  shadowMewtwo: { dex: 150, name: 'Mewtwo', types: ['psychic'], hp: 3600, speed: 58, damage: 28, xp: 0, mass: 40, boss: true },
} as const

export type HideoutBoss = keyof typeof HIDEOUT_BOSSES
