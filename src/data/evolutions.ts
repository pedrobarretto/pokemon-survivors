import { isLegendary, maxMoveLevel, MOVES, type MoveDef, type MoveId } from '../game/moves'
import type { OwnedItem, OwnedMove } from '../game/types'
import type { ItemId } from './items'
import { SIGNATURE_MOVES } from '../game/signatureMoves'
import { EGG_MOVE_2_IDS } from '../game/eggMoves2'
import { EGG_MOVE_3_IDS } from '../game/eggMoves3'
import { SKETCH_MOVE_IDS } from '../game/sketch'
import { SEASON_ONE_EGG_MOVE_IDS } from '../game/seasonOneEggMoves'
import { SEASON_ONE_KIT_MOVE_IDS } from '../game/seasonOneKitMoves'
import { GA_KIT_B_MOVE_IDS } from '../game/gaKitBMoves'
import { GA_KIT_A_MOVE_IDS } from '../game/gaKitAMoves'
import { REGIONAL_MOVE_IDS } from '../game/regionalMoves'
import { isTmMove } from '../game/tmMoves'
import { isShopTmMove } from '../game/shopTmMoves'

/**
 * Move evolutions, Vampire Survivors style: a move at max level plus its paired
 * held item evolves into a stronger move that takes over the same slot.
 */
export type MoveEvolution = { from: MoveId; item: ItemId; to: MoveId }

export const EVOLUTIONS = [
  { from: 'ember', item: 'charcoal', to: 'flamethrower' },
  { from: 'fireSpin', item: 'charcoal', to: 'fireBlast' },
  { from: 'waterGun', item: 'mysticWater', to: 'hydroPump' },
  { from: 'whirlpool', item: 'mysticWater', to: 'surf' },
  { from: 'razorLeaf', item: 'miracleSeed', to: 'leafStorm' },
  { from: 'vineWhip', item: 'miracleSeed', to: 'powerWhip' },
  { from: 'swift', item: 'silkScarf', to: 'triAttack' },
  { from: 'thunder', item: 'magnet', to: 'wildboltStorm' },
  { from: 'sludgeBomb', item: 'poisonBarb', to: 'gunkShot' },
  { from: 'gust', item: 'sharpBeak', to: 'hurricane' },
  { from: 'quickAttack', item: 'silkScarf', to: 'extremeSpeed' },
  { from: 'shockWave', item: 'magnet', to: 'thunderbolt' },
  { from: 'toxicSpikes', item: 'poisonBarb', to: 'barbBarrage' },
  { from: 'willOWisp', item: 'charcoal', to: 'inferno' },
  { from: 'iceShard', item: 'neverMeltIce', to: 'blizzard' },
  { from: 'rockTomb', item: 'hardStone', to: 'stoneEdge' },
  { from: 'pinMissile', item: 'silverPowder', to: 'megahorn' },
  { from: 'dragonBreath', item: 'dragonFang', to: 'outrage' },
  { from: 'crunch', item: 'blackGlasses', to: 'jawLock' },
  { from: 'machPunch', item: 'blackBelt', to: 'superpower' },
  { from: 'earthquake', item: 'softSand', to: 'fissure' },
  { from: 'psyshock', item: 'twistedSpoon', to: 'extrasensory' },
  { from: 'flashCannon', item: 'metalCoat', to: 'steelBeam' },
  { from: 'hex', item: 'spellTag', to: 'infernalParade' },
  { from: 'spiritShackle', item: 'spellTag', to: 'phantomForce' },
  { from: 'disarmingVoice', item: 'fairyFeather', to: 'alluringVoice' },
  // Cross-type pairs with generic items, so no type item evolves more than two moves.
  { from: 'waterShuriken', item: 'quickClaw', to: 'aquaCutter' },
  { from: 'razorShell', item: 'kingsRock', to: 'liquidation' },
  { from: 'pyroBall', item: 'muscleBand', to: 'searingShot' },
  { from: 'torchSong', item: 'metronome', to: 'burningJealousy' },
  { from: 'drumBeating', item: 'leftovers', to: 'gigaDrain' },
  { from: 'leafBlade', item: 'wideLens', to: 'trailblaze' },
  // The verb moves: a new form each, with a generic item or a type item's second pair.
  { from: 'flameWheel', item: 'lightClay', to: 'ragingFury' },
  { from: 'solarBeam', item: 'powerHerb', to: 'seedFlare' },
  { from: 'brine', item: 'loadedDice', to: 'waterSpout' },
  { from: 'electroBall', item: 'choiceScarf', to: 'electroDrift' },
  { from: 'venoshock', item: 'toxicOrb', to: 'sludgeWave' },
  { from: 'selfDestruct', item: 'assaultVest', to: 'explosion' },
  { from: 'roost', item: 'leftovers', to: 'oblivionWing' },
  { from: 'focusPunch', item: 'blackBelt', to: 'skyUppercut' },
  { from: 'gyroBall', item: 'metalCoat', to: 'gearGrind' },
  { from: 'suckerPunch', item: 'blackGlasses', to: 'kowtowCleave' },
  { from: 'futureSight', item: 'twistedSpoon', to: 'hyperspaceHole' },
  { from: 'bonemerang', item: 'softSand', to: 'thousandArrows' },
  { from: 'stealthRock', item: 'hardStone', to: 'stoneAxe' },
  { from: 'uTurn', item: 'quickClaw', to: 'firstImpression' },
  { from: 'dragonTail', item: 'dragonFang', to: 'breakingSwipe' },
  { from: 'sheerCold', item: 'neverMeltIce', to: 'glacialLance' },
] as const satisfies readonly MoveEvolution[]

/** The egg families' first batch of signature moves (#106, inline in `MOVES`). */
const EGG_SIGNATURES: readonly MoveId[] = [
  'dreamEater', 'forcePalm', 'dig', 'twister', 'sandTomb', 'meteorMash', 'zenHeadbutt', 'foulPlay', 'bodySlam', 'dynamicPunch', 'rollout',
  'iceBall', 'furyCutter', 'sacredSword', 'dragonDarts', 'snarl', 'gigaImpact', 'flail', 'boneRush', 'metronome', 'echoedVoice', 'curse',
]

/**
 * Moves that never evolve by design: signatures and TM moves (the shop's too) grow through their forks, and
 * legendary and duo moves are capstones. Read at call time, since `MOVES` and
 * the signature tables aren't built yet when this module loads (it imports
 * back from `moves.ts`).
 */
export const neverEvolves = (id: MoveId) => {
  const def: MoveDef = MOVES[id]
  const eggs: readonly MoveId[] = [...EGG_SIGNATURES, ...EGG_MOVE_2_IDS, ...EGG_MOVE_3_IDS, ...SKETCH_MOVE_IDS, ...SEASON_ONE_EGG_MOVE_IDS, ...SEASON_ONE_KIT_MOVE_IDS, ...GA_KIT_B_MOVE_IDS, ...GA_KIT_A_MOVE_IDS, ...REGIONAL_MOVE_IDS]
  const signature = id in SIGNATURE_MOVES || eggs.includes(id)
  return signature || isTmMove(id) || isShopTmMove(id) || isLegendary(id) || def.duo === true
}

/** The evolution a base move can go through, if any. */
export const evolutionOf = (move: MoveId): MoveEvolution | undefined => EVOLUTIONS.find((e) => e.from === move)

/** The evolution that produced `move`, if it is an evolved move. */
export const evolvedFrom = (move: MoveId): MoveEvolution | undefined => EVOLUTIONS.find((e) => e.to === move)

type Owned = { moves: readonly OwnedMove[]; items: readonly OwnedItem[] }

/** True when the base move is at max level and its paired item is held. */
export const canEvolve = (evo: MoveEvolution, { moves, items }: Owned) =>
  moves.some((m) => m.id === evo.from && m.level >= maxMoveLevel(evo.from)) && items.some((i) => i.id === evo.item)

/** Evolutions the player can take right now. */
export const readyEvolutions = (owned: Owned): MoveEvolution[] => EVOLUTIONS.filter((e) => canEvolve(e, owned))
