import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { BRANCHES, branchesOf, type BranchId } from '../data/branches'
import { EVOLUTIONS } from '../data/evolutions'
import { PLAYABLE, PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import type { PlayableDef } from '../data/starters'
import type { PokeType } from '../data/types'
import { FRESH_WEIGHT, runLearnset, unlockedAt } from './learnsets'
import { draftOffers, offerPool } from './leveling'
import { isLegendary, MOVE_IDS, MOVES, type MoveId } from './moves'
import { isDuo } from './duoRules'
import { isTmMove } from './tmMoves'
import { isShopTmMove } from './shopTmMoves'
import { SIGNATURE_MOVES } from './signatureMoves'
import { EGG_MOVE_2_IDS } from './eggMoves2'
import { EGG_MOVE_3_IDS } from './eggMoves3'
import { SKETCH_MOVE_IDS } from './sketch'
import { SEASON_ONE_EGG_MOVE_IDS } from './seasonOneEggMoves'
import { SEASON_ONE_KIT_MOVE_IDS } from './seasonOneKitMoves'
import { REGIONAL_MOVE_IDS } from './regionalMoves'

/** The egg families' signature moves (the starters' are `SIGNATURE_MOVES`). */
const EGG_SIGNATURES: readonly MoveId[] = [
  'dreamEater', 'forcePalm', 'dig', 'twister', 'sandTomb', 'meteorMash', 'zenHeadbutt', 'foulPlay', 'bodySlam', 'dynamicPunch', 'rollout',
  'iceBall', 'furyCutter', 'sacredSword', 'dragonDarts', 'snarl', 'gigaImpact', 'flail', 'boneRush', 'metronome', 'echoedVoice', 'curse',
]
const SIGNATURES = new Set<MoveId>([...(Object.keys(SIGNATURE_MOVES) as MoveId[]), ...EGG_SIGNATURES, ...EGG_MOVE_2_IDS, ...EGG_MOVE_3_IDS, ...SKETCH_MOVE_IDS, ...SEASON_ONE_EGG_MOVE_IDS, ...SEASON_ONE_KIT_MOVE_IDS, ...REGIONAL_MOVE_IDS])

type Role = 'shot' | 'homing' | 'boomerang' | 'aura' | 'wave' | 'strike' | 'arc' | 'counter' | 'charge' | 'sky' | 'chain' | 'cone' | 'beam' | 'field' | 'dash' | 'roll' | 'support' | 'random'

/** How each learnable move plays, to tell a family's own-type moves apart. */
const ROLE: Record<string, Role> = {
  leechSeed: 'support', rapidSpin: 'support', petalDance: 'aura', eruption: 'sky', thrash: 'strike', doubleKick: 'arc', mudShot: 'shot',
  woodHammer: 'strike', drillPeck: 'beam', leafTornado: 'field', flameCharge: 'dash', needleArm: 'support', psybeam: 'beam',
  darkestLariat: 'aura', sparklingAria: 'support', snipeShot: 'shot', flowerTrick: 'homing', aquaStep: 'dash',
  ember: 'shot', fireSpin: 'aura', waterGun: 'shot', whirlpool: 'aura', razorLeaf: 'boomerang', vineWhip: 'arc', swift: 'homing',
  thunder: 'sky', sludgeBomb: 'field', dreamEater: 'support', forcePalm: 'strike', dig: 'dash', twister: 'field', sandTomb: 'aura',
  meteorMash: 'sky', zenHeadbutt: 'dash', foulPlay: 'strike', bodySlam: 'dash', dynamicPunch: 'strike', rollout: 'roll', iceBall: 'roll',
  furyCutter: 'strike', sacredSword: 'arc', dragonDarts: 'homing', snarl: 'chain', gigaImpact: 'dash', flail: 'aura', boneRush: 'strike',
  metronome: 'random', echoedVoice: 'wave', curse: 'support', gust: 'aura', machPunch: 'strike', flashCannon: 'shot', spiritShackle: 'shot',
  waterShuriken: 'homing', crunch: 'strike', pyroBall: 'shot', psyshock: 'boomerang', earthquake: 'aura', drumBeating: 'wave',
  disarmingVoice: 'wave', torchSong: 'wave', leafBlade: 'aura', razorShell: 'arc', quickAttack: 'dash', shockWave: 'chain', hex: 'chain',
  toxicSpikes: 'field', willOWisp: 'field', iceShard: 'shot', rockTomb: 'sky', pinMissile: 'homing', dragonBreath: 'cone',
  flameWheel: 'field', solarBeam: 'beam', brine: 'shot', electroBall: 'shot', venoshock: 'homing', selfDestruct: 'dash', roost: 'support',
  focusPunch: 'charge', gyroBall: 'aura', suckerPunch: 'counter', futureSight: 'sky', bonemerang: 'boomerang', stealthRock: 'field',
  uTurn: 'dash', dragonTail: 'arc', sheerCold: 'aura',
  flareBlitz: 'field', dazzlingGleam: 'aura', powderSnow: 'field', electroweb: 'chain', corrosiveGas: 'field', magicCoat: 'support', appleAcid: 'field', icicleSpear: 'cone', headSmash: 'dash', ironDefense: 'support', dualWingbeat: 'strike', bite: 'strike', auroraVeil: 'field',
  braveBird: 'dash', weatherBall: 'shot', accelerock: 'dash', zapCannon: 'shot', aerialAce: 'strike', crossPoison: 'arc', bubbleBeam: 'beam', rockBlast: 'shot', cottonSpore: 'field', wildCharge: 'dash', playRough: 'aura', spore: 'support', waterfall: 'beam', lastResort: 'strike',
  metalClaw: 'strike', shellSideArm: 'shot', obstruct: 'support', meteorAssault: 'dash', chloroblast: 'aura', poisonSting: 'aura', toxic: 'field', ragingBull: 'dash', bitterMalice: 'sky',
  crossChop: 'arc', nightSlash: 'arc', dragonPulse: 'wave', waterPulse: 'shot', populationBomb: 'support', jetPunch: 'dash', auraWheel: 'shot', discharge: 'aura', forecast: 'shot', firePunch: 'strike', xScissor: 'arc', shadowClaw: 'arc', orderUp: 'wave',
  sketch: 'random', fieryDance: 'aura', overdrive: 'wave', gigatonHammer: 'strike', bitterBlade: 'arc', leechLife: 'strike', fireFang: 'strike', furySwipes: 'strike', heavySlam: 'dash', bulldoze: 'wave', perishSong: 'support', chargeBeam: 'beam', moonblast: 'shot', frostBreath: 'cone', avalanche: 'field',
}
/** The roles that count as a family's utility move: around it, on the ground, a dash or a heal/guard. */
const UTILITY = new Set<Role>(['aura', 'field', 'dash', 'support'])

/** The most families one shared move may appear in: about a fifth of them. */
const MAX_FAMILIES = Math.round(PLAYABLE_IDS.length / 5)

const EVOLVED = new Set<MoveId>(EVOLUTIONS.map((e) => e.to))
/** Every move a family may learn: all but the evolved ones and the capstones (legendary and duo moves). */
const LEARNABLE = MOVE_IDS.filter((id) => !EVOLVED.has(id) && !isLegendary(id) && !isDuo(id) && !isTmMove(id) && !isShopTmMove(id))

/** Each way a family's run can end: the plain line, or one per branch. */
const endings = (id: PlayableId): ReadonlyArray<BranchId | null> => {
  const branches = branchesOf(id)
  return branches.length > 0 ? branches : [null]
}

/** The family's types along an ending: the line's stages up to the branch, then the branch's. */
const typesOf = (id: PlayableId, branch: BranchId | null) => {
  const line = PLAYABLE[id].line
  const upTo = branch ? BRANCHES[branch].stage : line.length
  return new Set<PokeType>([...line.slice(0, upTo).flatMap((s) => s.types), ...(branch ? BRANCHES[branch].types : [])])
}

/** How many families can learn each move (a branching family counts once). */
const familiesPerMove = () => {
  const count = new Map<MoveId, number>()
  for (const id of PLAYABLE_IDS) {
    const all = new Set(endings(id).flatMap((b) => runLearnset(id, b)))
    for (const m of all) count.set(m, (count.get(m) ?? 0) + 1)
  }
  return count
}

describe('learnsets by stage', () => {
  it('have a list per stage, the signature in the first, no repeats and no evolved moves', () => {
    for (const id of PLAYABLE_IDS) {
      const s: PlayableDef = PLAYABLE[id]
      expect([id, s.learnset.length]).toEqual([id, s.line.length])
      expect([id, s.learnset[0].includes(s.signature)]).toEqual([id, true])
      // The opening draft offers three moves of the first stage.
      expect([id, s.learnset[0].length >= 4]).toEqual([id, true])
      for (const b of endings(id)) {
        const flat = [...s.learnset.flat(), ...(b ? BRANCHES[b].moves : [])]
        expect([id, b, flat.length]).toEqual([id, b, new Set(flat).size])
        for (const m of flat) expect([id, m, EVOLVED.has(m)]).toEqual([id, m, false])
      }
    }
  })

  it('end with more moves than slots: 10+ for three stages, 9+ for two', () => {
    for (const id of PLAYABLE_IDS) {
      const need = PLAYABLE[id].line.length === 3 ? 10 : 9
      for (const b of endings(id)) {
        const size = runLearnset(id, b).length
        expect([id, b, size >= need]).toEqual([id, b, true])
      }
    }
  })

  it('mix three own-type moves that play two ways, two coverage moves and a utility one', () => {
    for (const id of PLAYABLE_IDS)
      for (const b of endings(id)) {
        const pool = runLearnset(id, b)
        const types = typesOf(id, b)
        const own = pool.filter((m) => types.has(MOVES[m].type))
        expect([id, b, own.length >= 3, new Set(own.map((m) => ROLE[m])).size >= 2]).toEqual([id, b, true, true])
        expect([id, b, pool.filter((m) => !types.has(MOVES[m].type)).length >= 2]).toEqual([id, b, true])
        expect([id, b, pool.some((m) => UTILITY.has(ROLE[m]!))]).toEqual([id, b, true])
      }
  })

  it('keep signatures to their family (two at most, where the games share them)', () => {
    const count = familiesPerMove()
    for (const m of SIGNATURES) expect([m, (count.get(m) ?? 0) <= 2]).toEqual([m, true])
  })

  it('spread the shared moves: none in more than a fifth of the families, none left out', () => {
    const count = familiesPerMove()
    for (const m of LEARNABLE) {
      expect([m, ROLE[m] !== undefined]).toEqual([m, true])
      expect([m, (count.get(m) ?? 0) >= 1]).toEqual([m, true])
      if (!SIGNATURES.has(m)) expect([m, (count.get(m) ?? 0) <= MAX_FAMILIES]).toEqual([m, true])
    }
  })
})

describe('runLearnset', () => {
  it('learns each stage list as the line evolves', () => {
    expect(runLearnset('charmander', null, 0)).toEqual(PLAYABLE.charmander.learnset[0])
    expect(runLearnset('charmander', null, 0)).not.toContain('dragonTail')
    expect(runLearnset('charmander', null, 1)).toContain('dragonTail')
    expect(runLearnset('charmander', null)).toEqual(PLAYABLE.charmander.learnset.flat())
  })

  it("adds a branch's moves from the stage it takes over", () => {
    expect(runLearnset('ralts', 'gallade', 1)).not.toContain('sacredSword')
    expect(unlockedAt('ralts', 'gallade', 2)).toContain('sacredSword')
    expect(runLearnset('ralts', 'gallade', 2)).toContain('sacredSword')
    expect(runLearnset('ralts', 'gardevoir', 2)).not.toContain('sacredSword')
    // A move the line already learned isn't "new" again in the branch.
    for (const m of unlockedAt('eevee', 'vaporeon', 1)) expect(runLearnset('eevee', 'vaporeon', 0)).not.toContain(m)
  })
})

describe('level-up offers by stage', () => {
  it('only offer the moves of the stages reached', () => {
    const moves = (stage: number) => offerPool({ starter: 'charmander', moves: [], items: [], stage }).flatMap(([o]) => (o.kind === 'move' ? [o.id] : []))
    expect(moves(0)).not.toContain('dragonTail')
    expect(moves(1)).toContain('dragonTail')
    expect(moves(1)).not.toContain('roost')
  })

  it('weigh the moves an evolution just unlocked double while they are fresh', () => {
    const weight = (fresh: boolean, id: MoveId) =>
      offerPool({ starter: 'charmander', moves: [], items: [], stage: 1, fresh }).find(([o]) => o.kind === 'move' && o.id === id)?.[1]
    expect(weight(true, 'dragonTail')).toBe(FRESH_WEIGHT)
    expect(weight(false, 'dragonTail')).toBe(1)
    expect(weight(true, 'fireSpin')).toBe(1)
  })

  it('draft the second move from the first stage only', () => {
    const first: readonly MoveId[] = PLAYABLE.bulbasaur.learnset[0]
    for (let seed = 1; seed < 20; seed++)
      for (const o of draftOffers({ starter: 'bulbasaur', moves: [{ id: 'leechSeed', level: 1, cooldown: 0 }], items: [] }, createRng(seed)))
        expect(o.kind === 'move' && first.includes(o.id)).toBe(true)
  })
})
