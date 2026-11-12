import type { BranchDef } from './branches'
import { line2, line3, type HatchlingDef } from './playableLines'

/**
 * The wave's five hook families, each with something no other family has
 * (`game/gaHookRules.ts` has the numbers, `game/gaHookSystem.ts` runs them on
 * `Player.kitH`, their signatures are `game/gaHookMoves.ts` and their words
 * `i18n/gaHook.ts`). No egg brings them: Scatterbug (the Safari's meadow),
 * Minior (its ridge, by night) and Tyrogue (its ridge) come from the Safari,
 * Plusle and Minun from the Rocket Game Corner's counter.
 *
 * - Scatterbug's line sheds powder; Vivillon's wings wear the pattern of the
 *   player's region, read on the device (`src/vivillonRegion.ts`): a look only,
 *   the shell's, never the simulation's.
 * - Minior's Meteor shell breaks below half HP into a faster, harder Core and
 *   closes again (Shields Down); the Core's color comes from the run's seed
 *   (`render/gaHookFx.ts`, `coreForm`).
 * - Tyrogue evolves by the build (`fighterBranch`): Hitmonlee, Hitmonchan or
 *   Hitmontop, its three branches (`GA_BRANCHES_HOOK`), never a pick.
 * - Plusle and Minun each play alone; on one co-op team they link (`coop.ts`).
 */
export const GA_FAMILIES_HOOK = {
  scatterbug: {
    name: 'Scatterbug', color: '#e86890', egg: 'found', stats: { speed: 2, maxHp: -5 }, signature: 'bugBuzz',
    learnset: [['bugBuzz', 'pinMissile', 'bugBite', 'quickAttack'], ['roost', 'electroweb', 'toxicSpikes'], ['gust', 'leafBlade', 'psybeam', 'solarBeam']],
    line: line3(['Scatterbug', 664, ['bug']], ['Spewpa', 665, ['bug']], ['Vivillon', 666, ['bug', 'flying']], [
      { maxHp: 30, armor: 1, might: 0.06, speed: -3 },
      { maxHp: 40, might: 0.24, speed: 5, area: 0.08 },
    ]),
  },
  minior: {
    name: 'Minior', color: '#b88858', egg: 'found', stats: { maxHp: 30, might: 0.14, area: 0.06 }, signature: 'powerGem',
    learnset: [['powerGem', 'rockTomb', 'stealthRock', 'acrobatics', 'rollout', 'gust', 'selfDestruct', 'futureSight', 'psyshock']],
    line: [{ name: 'Minior', dex: 774, types: ['rock', 'flying'], bonus: {} }],
  },
  tyrogue: {
    name: 'Tyrogue', color: '#c89878', egg: 'found', stats: { maxHp: 5, speed: 2 }, signature: 'fakeOut',
    learnset: [['fakeOut', 'machPunch', 'lowKick', 'quickAttack'], ['focusPunch', 'suckerPunch', 'rockTomb', 'uTurn']],
    line: line2(['Tyrogue', 236, ['fighting']], ['Hitmonlee', 106, ['fighting']], { maxHp: 40, might: 0.26, speed: 4 }),
  },
  plusle: {
    name: 'Plusle', color: '#e85048', egg: 'found', stats: { speed: 5, might: 0.08, maxHp: -10 }, signature: 'voltSwitch',
    learnset: [['voltSwitch', 'electroBall', 'shockWave', 'nuzzle', 'thunder', 'quickAttack', 'disarmingVoice', 'swift', 'uTurn']],
    line: [{ name: 'Plusle', dex: 311, types: ['electric'], bonus: {} }],
  },
  minun: {
    name: 'Minun', color: '#4878e0', egg: 'found', stats: { speed: 4, maxHp: 10, regen: 0.2, might: 0.02 }, signature: 'eerieImpulse',
    learnset: [['eerieImpulse', 'electroBall', 'chargeBeam', 'electroweb', 'thunder', 'quickAttack', 'disarmingVoice', 'roost', 'swift']],
    line: [{ name: 'Minun', dex: 312, types: ['electric'], bonus: {} }],
  },
} as const satisfies Record<string, HatchlingDef>

export const GA_FAMILIES_HOOK_ABILITIES = {
  scatterbug: ['swarm', 'keenEye', 'effectSpore'],
  minior: ['shellArmor', 'sturdy', 'speedBoost'],
  tyrogue: ['guts', 'steadfast', 'vitalSpirit'],
  plusle: ['static', 'lightningRod', 'cuteCharm'],
  minun: ['static', 'voltAbsorb', 'cuteCharm'],
} as const

/**
 * Tyrogue at Lv 20: where the build sends it (`fighterBranch`), never drawn
 * nor picked, and never an item's (`ruledBranch` in `game/gaHookSystem.ts`).
 */
export const GA_BRANCHES_HOOK = {
  hitmonlee: {
    line: 'tyrogue', stage: 1, name: 'Hitmonlee', dex: 106, types: ['fighting'],
    bonus: { maxHp: 40, might: 0.26, speed: 4 },
    moves: ['jumpKick', 'bounce'],
  },
  hitmonchan: {
    line: 'tyrogue', stage: 1, name: 'Hitmonchan', dex: 107, types: ['fighting'],
    bonus: { maxHp: 55, armor: 1, might: 0.2 },
    moves: ['thunderPunch', 'icePunch', 'cometPunch'],
  },
  hitmontop: {
    line: 'tyrogue', stage: 1, name: 'Hitmontop', dex: 237, types: ['fighting'],
    bonus: { maxHp: 50, might: 0.22, speed: 3, area: 0.06 },
    moves: ['tripleKick', 'rapidSpin', 'gyroBall'],
  },
} as const satisfies Record<string, BranchDef>

export const GA_BRANCHES_HOOK_ABILITIES = {
  hitmonlee: ['reckless', 'unburden', 'steadfast'],
  hitmonchan: ['ironFist', 'innerFocus', 'steadfast'],
  hitmontop: ['intimidate', 'technician', 'steadfast'],
} as const

/** The batch's families, for the draws that must keep their old picks (the Desafio do dia, the determinism runs). */
export const GA_FAMILY_HOOK_IDS = Object.keys(GA_FAMILIES_HOOK) as ReadonlyArray<keyof typeof GA_FAMILIES_HOOK>
