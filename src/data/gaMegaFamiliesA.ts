import { line2, type HatchlingDef } from './playableLines'

/**
 * The Grande Atualização's first Mega families, each brought in for its Mega
 * Evolution (`data/megas.ts`) and each a Safari-only family (`egg: 'found'`, in
 * its habitat's `only` in `data/safari.ts`). Their mechanics live on
 * `Player.kitMA` (`game/gaKitMARules.ts` has the numbers, `gaKitMASystem.ts`
 * runs them), their signatures in `game/gaKitMAMoves.ts` and their words in
 * `i18n/gaMegaFamiliesA.ts`.
 *
 * - Kangaskhan's baby hops out of the pouch to punch whatever its mother hits
 *   (Parental Bond), harder as it grows up through the run.
 * - Pinsir's horns snap shut in front on their own rhythm: what they catch is
 *   clamped, and a weak foe is cut in two.
 * - Skarmory sheds razor feathers as it goes: the ground behind it cuts.
 * - Drilbur digs: Drill Run goes under the horde and leaves holes that trip
 *   it; Excadrill's tunnels cave in behind it.
 * - Drampa's Berserk: the lower its HP, the harder it hits, and it roars as
 *   it falls under half.
 *
 * The one-stage families start strong (as Lapras and Heracross do) and grow
 * through their mechanic and their nine moves instead of an evolution.
 */
export const GA_MEGA_FAMILIES_A = {
  kangaskhan: {
    name: 'Kangaskhan', color: '#b08c58', egg: 'found', stats: { maxHp: 45, might: 0.14, armor: 1, speed: -2 }, signature: 'cometPunch',
    learnset: [['cometPunch', 'bodySlam', 'quickAttack', 'suckerPunch', 'crunch', 'machPunch', 'focusPunch', 'earthquake', 'rockTomb']],
    line: [{ name: 'Kangaskhan', dex: 115, types: ['normal'], bonus: {} }],
  },
  pinsir: {
    name: 'Pinsir', color: '#a89880', egg: 'found', stats: { maxHp: 25, might: 0.2, speed: -1 }, signature: 'stormThrow',
    learnset: [['stormThrow', 'xScissor', 'pinMissile', 'uTurn', 'focusPunch', 'rockTomb', 'earthquake', 'crunch', 'quickAttack']],
    line: [{ name: 'Pinsir', dex: 127, types: ['bug'], bonus: {} }],
  },
  skarmory: {
    name: 'Skarmory', color: '#8898b8', egg: 'found', stats: { maxHp: 30, armor: 2, might: 0.1, speed: 2 }, signature: 'airCutter',
    learnset: [['airCutter', 'steelWing', 'flashCannon', 'drillPeck', 'roost', 'rockTomb', 'stealthRock', 'quickAttack', 'gyroBall']],
    line: [{ name: 'Skarmory', dex: 227, types: ['steel', 'flying'], bonus: {} }],
  },
  drilbur: {
    name: 'Drilbur', color: '#787070', egg: 'found', stats: { speed: 2, might: 0.04, maxHp: -5 }, signature: 'drillRun',
    learnset: [['drillRun', 'rapidSpin', 'metalClaw', 'rockTomb', 'bulldoze'], ['earthquake', 'highHorsepower', 'flashCannon', 'aerialAce', 'stealthRock']],
    line: line2(['Drilbur', 529, ['ground']], ['Excadrill', 530, ['ground', 'steel']], { maxHp: 40, might: 0.26, armor: 1 }),
  },
  drampa: {
    name: 'Drampa', color: '#e8e8e0', egg: 'found', stats: { maxHp: 40, might: 0.12, area: 0.06, speed: -3 }, signature: 'hyperVoice',
    learnset: [['hyperVoice', 'dragonBreath', 'dragonPulse', 'dragonTail', 'twister', 'psyshock', 'swift', 'thunder', 'roost']],
    line: [{ name: 'Drampa', dex: 780, types: ['normal', 'dragon'], bonus: {} }],
  },
} as const satisfies Record<string, HatchlingDef>

export type GaMegaFamilyAId = keyof typeof GA_MEGA_FAMILIES_A

export const GA_MEGA_FAMILY_A_IDS = Object.keys(GA_MEGA_FAMILIES_A) as GaMegaFamilyAId[]

export const GA_MEGA_FAMILIES_A_ABILITIES = {
  kangaskhan: ['innerFocus', 'ironFist', 'pickup'],
  pinsir: ['moldBreaker', 'moxie', 'hustle'],
  skarmory: ['keenEye', 'sturdy', 'weakArmor'],
  drilbur: ['sandRush', 'moldBreaker', 'sandVeil'],
  drampa: ['cloudNine', 'angerPoint', 'sheerForce'],
} as const
