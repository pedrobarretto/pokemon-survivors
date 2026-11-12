import type { BranchDef } from './branches'
import { line2, type HatchlingDef } from './playableLines'

/**
 * The big update's Mega families, each brought in for the Mega Evolution
 * SpriteCollab draws for it (`data/megas.ts`), and each Safari-only
 * (`egg: 'found'`, in its habitat's `only`, `data/safari.ts`). Each plays a
 * mechanic of its own on `Player.megaB` (`game/megaKitBRules.ts`, run by
 * `game/megaKitBSystem.ts`), with a signature in `game/megaKitBMoves.ts` and
 * its words in `i18n/megaFamiliesB.ts`.
 *
 * - Meditite's High Jump Kick leaps onto a foe; each landing builds Pure Power,
 *   and one that lands on nothing crashes, as in the games.
 * - Numel's humps erupt on a clock, throwing more lava bombs the more HP it has.
 * - Buneary bounces away from a foe about to touch it, and counters with its
 *   next Dizzy Punch.
 * - Flabébé plants a garden: blossoms that heal and fire petals. It grows into
 *   the Eternal Flower's Floette (the Mega's) or, with a Shiny Stone, Florges.
 * - Skrelp's venom hits harder and splashes wider the farther it flies.
 */
export const MEGA_FAMILIES_B = {
  meditite: {
    name: 'Meditite', color: '#7898c8', egg: 'found', stats: { might: 0.06, speed: 3, maxHp: -5 }, signature: 'highJumpKick',
    learnset: [['highJumpKick', 'machPunch', 'psyshock', 'zenHeadbutt'], ['futureSight', 'doubleKick', 'firePunch', 'thunderPunch', 'icePunch']],
    line: line2(['Meditite', 307, ['fighting', 'psychic']], ['Medicham', 308, ['fighting', 'psychic']], { maxHp: 40, might: 0.24, speed: 3 }),
  },
  numel: {
    name: 'Numel', color: '#e0b860', egg: 'found', stats: { maxHp: 20, armor: 1, speed: -5 }, signature: 'magnitude',
    learnset: [['magnitude', 'ember', 'flameCharge', 'rockTomb'], ['earthquake', 'fireSpin', 'stealthRock', 'flashCannon', 'bulldoze']],
    line: line2(['Numel', 322, ['fire', 'ground']], ['Camerupt', 323, ['fire', 'ground']], { maxHp: 65, armor: 1, might: 0.22, area: 0.08 }),
  },
  buneary: {
    name: 'Buneary', color: '#b08860', egg: 'found', stats: { speed: 6, maxHp: -10 }, signature: 'dizzyPunch',
    learnset: [['dizzyPunch', 'quickAttack', 'bounce', 'disarmingVoice'], ['lastResort', 'swift', 'icePunch', 'thunderPunch', 'uTurn']],
    line: line2(['Buneary', 427, ['normal']], ['Lopunny', 428, ['normal']], { maxHp: 40, speed: 5, might: 0.22 }),
  },
  flabebe: {
    name: 'Flabébé', color: '#e05868', egg: 'found', stats: { maxHp: -10, regen: 0.2, area: 0.04 }, signature: 'fairyWind',
    learnset: [['fairyWind', 'disarmingVoice', 'razorLeaf', 'leechSeed'], ['moonblast', 'dazzlingGleam', 'petalDance', 'solarBeam', 'psyshock']],
    line: line2(['Flabébé', 669, ['fairy']], ['Eternal Floette', 10061, ['fairy']], { maxHp: 40, might: 0.24, regen: 0.3 }),
  },
  skrelp: {
    name: 'Skrelp', color: '#a89868', egg: 'found', stats: { might: 0.04, maxHp: -5, statusChance: 0.03 }, signature: 'venomDrench',
    learnset: [['venomDrench', 'waterGun', 'toxicSpikes', 'waterPulse'], ['dragonPulse', 'sludgeBomb', 'dragonTail', 'thunder', 'hex']],
    line: line2(['Skrelp', 690, ['poison', 'water']], ['Dragalge', 691, ['poison', 'dragon']], { maxHp: 45, might: 0.26, statusDamage: 0.12 }),
  },
} as const satisfies Record<string, HatchlingDef>

export const MEGA_FAMILIES_B_ABILITIES = {
  meditite: ['hugePower', 'innerFocus', 'steadfast'],
  numel: ['angerPoint', 'flameBody', 'sturdy'],
  buneary: ['cuteCharm', 'quickFeet', 'unburden'],
  flabebe: ['naturalCure', 'leafGuard', 'pastelVeil'],
  skrelp: ['poisonPoint', 'poisonTouch', 'adaptability'],
} as const

/**
 * Flabébé at Lv 20: the Eternal Flower's Floette, the line's own form and the
 * one that Mega Evolves (`MEGA_BRANCH`), or Florges, which a Shiny Stone opens
 * (`EVO_ITEMS`) and whose garden is bigger and heals more.
 */
export const MEGA_BRANCHES_B = {
  floetteEternal: {
    line: 'flabebe', stage: 1, free: true, name: 'Eternal Floette', dex: 10061, types: ['fairy'],
    bonus: { maxHp: 40, might: 0.24, regen: 0.3 },
    moves: [],
  },
  florges: {
    line: 'flabebe', stage: 1, name: 'Florges', dex: 671, types: ['fairy'],
    bonus: { maxHp: 65, regen: 0.6, might: 0.16, area: 0.08 },
    moves: ['magicCoat', 'leafBlade'],
  },
} as const satisfies Record<string, BranchDef>

export const MEGA_BRANCHES_B_ABILITIES = {
  florges: ['naturalCure', 'pastelVeil', 'regenerator'],
} as const

/** The batch's families, for the draws that must keep their old picks (the Desafio do dia, the determinism runs). */
export const MEGA_FAMILY_B_IDS = Object.keys(MEGA_FAMILIES_B) as ReadonlyArray<keyof typeof MEGA_FAMILIES_B>
