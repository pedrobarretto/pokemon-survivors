import { line3, type HatchlingDef } from './playableLines'
import type { GA_FAMILY_HOOK_IDS } from './gaFamiliesHook'

type GaHookFamilyId = (typeof GA_FAMILY_HOOK_IDS)[number]

/**
 * The families the Safári and the Game Corner wave brings, none from an egg
 * (`egg: 'found'`): the Rocket Game Corner's three Celadon prizes
 * (`data/rocketCorner.ts`: both Nidoran lines and Cleffa's) and Phione, who
 * lives in the Zona Safári's cove once its account owns Manaphy
 * (`SAFARI_GATED` in `data/safari.ts`). Each plays a mechanic of its own on
 * `Player.kitSC` (`game/scKitRules.ts` has the numbers, `game/scKitSystem.ts`
 * runs them), its signature lives in `game/scKitMoves.ts` and its words in
 * `i18n/scFamilies.ts`.
 *
 * - Nidoran♀'s barbs (Poison Point): a ring of poison quills now and then,
 *   sooner after a hit taken; Nidoqueen guards harder for every poisoned foe
 *   around her.
 * - Nidoran♂'s horn: it lowers its horn and charges through the horde,
 *   poisoning what it runs through; Nidoking's charge ends in a quake.
 * - Cleffa's moon: time and KOs wax a moon over its head, and the full moon
 *   lights the field (moonbeams fall, Fairy moves grow, Moonlight heals).
 * - Phione's warm current: walking fills the current, bubbles circle it, and
 *   standing still lets them burst in a splash that heals it.
 */
export const SC_FAMILIES = {
  nidoranF: {
    name: 'Nidoran♀', color: '#88a8e0', egg: 'found', stats: { maxHp: 10, armor: 1, speed: -1 }, signature: 'sludge',
    learnset: [['sludge', 'poisonSting', 'doubleKick', 'bite', 'toxicSpikes'], ['poisonFang', 'crunch', 'venoshock'], ['heavySlam', 'bodySlam', 'earthquake', 'iceShard', 'thunder']],
    line: line3(['Nidoran♀', 29, ['poison']], ['Nidorina', 30, ['poison']], ['Nidoqueen', 31, ['poison', 'ground']], [
      { maxHp: 25, armor: 1, might: 0.08 },
      { maxHp: 60, armor: 1, might: 0.2 },
    ]),
  },
  nidoranM: {
    name: 'Nidoran♂', color: '#b878c8', egg: 'found', stats: { might: 0.06, speed: 2, maxHp: -5 }, signature: 'furyAttack',
    learnset: [['furyAttack', 'hornAttack', 'poisonSting', 'doubleKick'], ['poisonJab', 'hornDrill', 'toxicSpikes'], ['earthquake', 'thunder', 'focusPunch', 'iceShard', 'crunch']],
    line: line3(['Nidoran♂', 32, ['poison']], ['Nidorino', 33, ['poison']], ['Nidoking', 34, ['poison', 'ground']], [
      { maxHp: 20, might: 0.1, speed: 1 },
      { maxHp: 50, might: 0.26, speed: 1 },
    ]),
  },
  cleffa: {
    name: 'Cleffa', color: '#f8b8c8', egg: 'found', stats: { maxHp: 5, regen: 0.15, might: -0.04 }, signature: 'moonlight',
    learnset: [['moonlight', 'disarmingVoice', 'sing', 'swift'], ['moonblast', 'dazzlingGleam', 'psyshock'], ['meteorMash', 'thunder', 'iceShard', 'ember']],
    line: line3(['Cleffa', 173, ['fairy']], ['Clefairy', 35, ['fairy']], ['Clefable', 36, ['fairy']], [
      { maxHp: 25, might: 0.1, regen: 0.1 },
      { maxHp: 55, might: 0.24, regen: 0.2 },
    ]),
  },
  phione: {
    name: 'Phione', color: '#78c8e8', egg: 'found', stats: { maxHp: 30, might: 0.14, speed: 3, regen: 0.2 }, signature: 'dive',
    learnset: [['dive', 'waterPulse', 'bubbleBeam', 'whirlpool', 'brine', 'psyshock', 'iceShard', 'swift', 'disarmingVoice']],
    line: [{ name: 'Phione', dex: 489, types: ['water'], bonus: {} }],
  },
} as const satisfies Record<string, HatchlingDef>

export type ScFamilyId = keyof typeof SC_FAMILIES

export const SC_FAMILY_IDS = Object.keys(SC_FAMILIES) as ScFamilyId[]

/** The Game Corner's new prize families (`CORNER_PRIZES`), beside Team Rocket's four: this wave's and the hook families' Plusle and Minun (`data/gaFamiliesHook.ts`). */
export const CORNER_FAMILY_IDS = ['nidoranF', 'nidoranM', 'cleffa', 'plusle', 'minun'] as const satisfies readonly (ScFamilyId | GaHookFamilyId)[]

export type CornerFamilyId = (typeof CORNER_FAMILY_IDS)[number]

export const SC_FAMILY_ABILITIES = {
  nidoranF: ['poisonPoint', 'hustle', 'sheerForce'],
  nidoranM: ['poisonPoint', 'hustle', 'sheerForce'],
  cleffa: ['cuteCharm', 'magicGuard', 'unaware'],
  phione: ['hydration', 'swiftSwim', 'rainDish'],
} as const
