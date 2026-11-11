import type { HatchlingDef } from './playableLines'

/**
 * The Rocket Game Corner's four prize families (`data/rocketCorner.ts`): no egg
 * brings them (`egg: 'found'`), only the prize counter does, as a family gift.
 * Each plays a mechanic of its own on `Player.rocket` (`game/rocketKitRules.ts`,
 * run by `game/rocketKitSystem.ts`), their signatures live in
 * `game/rocketKitMoves.ts` and their words in `i18n/rocket/families.ts`.
 *
 * - Ditto copies the foe it Transforms into: its look, its type (Ditto's moves
 *   of that type hit harder) and a stat from what kind of foe it was.
 * - Absol senses disaster: it marks the toughest foe in view with an Omen, and
 *   a doomed foe that falls takes the ones around it down with it.
 * - Gimmighoul gathers coins: the ₽ it picks up in a run feed Make It Rain and,
 *   at 999, evolve it into Gholdengo (it never evolves by level).
 * - Mawile's jaws face backward: Vise Grip and its Deceiver bite whatever comes
 *   at it from behind.
 */
export const ROCKET_FAMILIES = {
  ditto: {
    name: 'Ditto', color: '#c0a0e0', egg: 'found', stats: { maxHp: 10, might: -0.04, cooldown: -0.03 }, signature: 'transform',
    learnset: [['transform', 'lastResort', 'selfDestruct', 'ember', 'waterGun', 'vineWhip', 'electroBall', 'iceShard', 'psyshock', 'sludgeBomb']],
    line: [{ name: 'Ditto', dex: 132, types: ['normal'], bonus: {} }],
  },
  absol: {
    name: 'Absol', color: '#e8e8f0', egg: 'found', stats: { might: 0.08, maxHp: -10, speed: 3 }, signature: 'razorWind',
    learnset: [['razorWind', 'nightSlash', 'suckerPunch', 'bite', 'futureSight', 'psyshock', 'willOWisp', 'pinMissile', 'perishSong']],
    line: [{ name: 'Absol', dex: 359, types: ['dark'], bonus: {} }],
  },
  gimmighoul: {
    name: 'Gimmighoul', color: '#e8c050', egg: 'found', stats: { speed: 4, maxHp: -10, area: 0.04 }, signature: 'makeItRain',
    learnset: [
      ['makeItRain', 'spiritShackle', 'shadowClaw', 'venoshock'],
      ['shockWave', 'thunder', 'sludgeBomb', 'roost', 'flameWheel'],
    ],
    // Gimmighoul never evolves by level: 999 coins do it, at its next level-up (`rocketEvolves`). Lv 999 is the level cap, never reached first.
    line: [
      { name: 'Gimmighoul', dex: 10263, types: ['ghost'], evolveAt: 999, bonus: {} },
      { name: 'Gholdengo', dex: 1000, types: ['steel', 'ghost'], bonus: { maxHp: 40, might: 0.24, area: 0.08 } },
    ],
  },
  mawile: {
    name: 'Mawile', color: '#f0d0a0', egg: 'found', stats: { maxHp: 15, speed: -3, armor: 1 }, signature: 'viseGrip',
    learnset: [['viseGrip', 'playRough', 'ironDefense', 'moonblast', 'suckerPunch', 'fireFang', 'toxicSpikes', 'venoshock', 'solarBeam']],
    line: [{ name: 'Mawile', dex: 303, types: ['steel', 'fairy'], bonus: {} }],
  },
} as const satisfies Record<string, HatchlingDef>

export type RocketFamilyId = keyof typeof ROCKET_FAMILIES

export const ROCKET_FAMILY_IDS = Object.keys(ROCKET_FAMILIES) as RocketFamilyId[]

export const isRocketFamily = (id: string): id is RocketFamilyId => Object.hasOwn(ROCKET_FAMILIES, id)

export const ROCKET_FAMILY_ABILITIES = {
  ditto: ['protean', 'adaptability', 'moody'],
  absol: ['pressure', 'sniper', 'magicBounce'],
  gimmighoul: ['pickup', 'magician', 'magicGuard'],
  mawile: ['intimidate', 'sheerForce', 'hugePower'],
} as const
