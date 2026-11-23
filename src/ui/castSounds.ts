import type { Sfx } from '../engine/audio'
import type { MoveId } from '../game/moves'

/**
 * The sound of a move's `cast` event (`GameEvent`), with the gap that keeps a
 * fast move from turning into noise. Moves without an entry stay silent: their
 * hits already sound.
 */
const CAST_SOUNDS: Partial<Record<MoveId, readonly [Sfx, number]>> = {
  // Ponyta's gallop batch (`game/gallopMoves.ts`).
  highHorsepower: ['rumble', 300],
  headlongRush: ['rockBurst', 300],
  lowKick: ['trip', 250],
  axeKick: ['axe', 250],
  hornDrill: ['drill', 300],
  hyperDrill: ['drill', 250],
  morningSun: ['heal', 600],
  revivalBlessing: ['wish', 600],
  bounce: ['leap', 300],
  skyDrop: ['dive', 300],
  dreamEater: ['hypnosis', 300],
  dig: ['dig', 200],
  twister: ['whoosh', 400],
  sandTomb: ['sand', 400],
  bodySlam: ['leap', 200],
  dynamicPunch: ['windup', 300],
  rollout: ['roll', 400],
  sacredSword: ['shing', 200],
  dragonDarts: ['zip', 250],
  snarl: ['growl', 300],
  gigaImpact: ['charge', 300],
  metronome: ['metronome', 300],
  sketch: ['whoosh', 300],
  echoedVoice: ['echo', 250],
  curse: ['curse', 400],
  fieryDance: ['flameDance', 300],
  overdrive: ['riff', 400],
  gigatonHammer: ['gigaton', 200],
  bitterBlade: ['soulSlash', 200],
  heavySlam: ['thud', 250],
  bulldoze: ['rumble', 350],
  perishSong: ['perish', 800],
  chargeBeam: ['zap', 200],
  moonblast: ['moonChime', 250],
  frostBreath: ['frost', 250],
  avalanche: ['avalanche', 300],
  braveBird: ['dive', 300],
  weatherBall: ['lob', 200],
  accelerock: ['rockDash', 120],
  zapCannon: ['zapOrb', 400],
  aerialAce: ['windCut', 200],
  crossPoison: ['venomCross', 200],
  bubbleBeam: ['bubbles', 250],
  rockBlast: ['rockBurst', 250],
  cottonSpore: ['cotton', 400],
  wildCharge: ['sparkRun', 400],
  playRough: ['brawl', 250],
  spore: ['sporePuff', 400],
  waterfall: ['geyser', 300],
  lastResort: ['starFall', 300],
}

export const castSound = (move: MoveId) => CAST_SOUNDS[move] ?? null
