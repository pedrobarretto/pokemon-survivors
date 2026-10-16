import { describe, expect, it } from 'vitest'
import { PLAYABLE } from '../data/hatchlings'
import { MEGA, MEGA_IDS, MEGA_LINES, MEGAS, megasOf, type MegaDef } from '../data/megas'
import manifest from '../data/sprites.generated.json'
import { createGame, step } from './game'
import { recomputeStats } from './leveling'
import { createMegaState, dropMegaStones, grantStone, isFinalStage, megaPhase, tickMega } from './mega'
import { updatePickups } from './pickups'
import { resolveSpecial, SPECIALS } from './special'

const DT = 1 / 60
const MANIFEST: Record<string, { anims: unknown; formCries?: string[] }> = manifest

describe('mega data', () => {
  it('gives every Mega its own cry and a special stronger than its final stage', () => {
    for (const id of MEGA_IDS) {
      const def: MegaDef = MEGAS[id]
      const final = PLAYABLE[def.line].line.at(-1)!
      expect(MANIFEST[String(final.dex)]?.formCries, def.name).toContain(def.form)
      expect(SPECIALS[def.special].final.damage, def.name).toBeGreaterThan(resolveSpecial(def.line, PLAYABLE[def.line].line.length - 1).tier.damage)
    }
  })

  it('tells apart the forms and stones of a line with two Megas', () => {
    for (const line of MEGA_LINES) {
      const defs = megasOf(line).map((id): MegaDef => MEGAS[id])
      expect(new Set(defs.map((d) => d.form)).size).toBe(defs.length)
      expect(new Set(defs.map((d) => d.stone)).size).toBe(defs.length)
    }
    expect(megasOf('charmander')).toEqual(['charizardX', 'charizardY'])
    expect(megasOf('squirtle')).toEqual(['blastoise'])
    expect(megasOf('cyndaquil')).toEqual([])
  })

  it('swaps the special only in Mega form, for the Mega of the stone held', () => {
    expect(resolveSpecial('charmander', 2, 'charizardX').id).toBe('dragonFlare')
    expect(resolveSpecial('charmander', 2, 'charizardY').id).toBe('heatWave')
    expect(resolveSpecial('charmander', 2).id).toBe('blastBurn')
  })
})

describe('mega timers', () => {
  it('waits for the stone, then for the final stage', () => {
    const s = createMegaState()
    expect(megaPhase(s, true)).toBe('none')
    s.stone = 'charizardX'
    expect(megaPhase(s, false)).toBe('locked')
    expect(megaPhase(s, true)).toBe('ready')
    s.intro = 0.5
    expect(megaPhase(s, true)).toBe('active')
  })

  it('lasts its duration, then recharges before it is ready again', () => {
    const s = { ...createMegaState(), stone: 'charizardX' as const, active: MEGA.duration }
    let end = 0
    for (let t = 0; t < MEGA.duration + 0.5; t += DT) end += Number(tickMega(s, DT) === 'end')
    expect(end).toBe(1)
    expect(megaPhase(s, true)).toBe('charging')
    let ready = 0
    for (let t = 0; t < MEGA.recharge; t += DT) ready += Number(tickMega(s, DT) === 'ready')
    expect(ready).toBe(1)
    expect(megaPhase(s, true)).toBe('ready')
  })

  it('knows a 2-stage line is final one evolution earlier', () => {
    expect(isFinalStage('riolu', 1)).toBe(true)
    expect(isFinalStage('charmander', 1)).toBe(false)
  })
})

describe('mega evolution', () => {
  const ready = () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1)
    g.player.stage = 2
    recomputeStats(g)
    grantStone(g, 'charizardX')
    return g
  }

  it('holds the world through the transformation, then adds the Mega stats until it ends', () => {
    const g = ready()
    const might = g.player.stats.might
    step(g, { move: { x: 0, y: 0 }, special: false, mega: true }, DT)
    const time = g.time
    for (let t = 0; t < MEGA.intro - DT; t += DT) step(g, { move: { x: 0, y: 0 }, special: false }, DT)
    expect(g.time).toBe(time)
    step(g, { move: { x: 0, y: 0 }, special: false }, DT)
    expect(g.player.mega.active).toBe(MEGA.duration)
    expect(g.player.stats.might).toBeCloseTo(might + MEGAS.charizardX.stats.might)
    g.player.mega.active = DT / 2
    step(g, { move: { x: 0, y: 0 }, special: false }, DT)
    expect(g.player.stats.might).toBeCloseTo(might)
    expect(g.player.mega.charge).toBe(MEGA.recharge)
  })

  it('only takes a stone of its own line', () => {
    const g = createGame('cyndaquil', { w: 480, h: 270 }, 1)
    grantStone(g, 'charizardX')
    expect(g.player.mega.stone).toBeNull()
  })

  it('lets a line with two Megas keep the stone it touches; the other crumbles', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1)
    g.player.stats.magnet = 500
    dropMegaStones(g, g.player.x, g.player.y + 6)
    const stones = () => g.pickups.filter((k) => k.kind === 'megaStone')
    expect(stones()).toHaveLength(2)
    updatePickups(g, DT)
    expect(stones().every((k) => !k.attracted)).toBe(true)
    g.player.x = stones()[1]!.x
    updatePickups(g, DT)
    expect(g.player.mega.stone).toBe('charizardY')
    expect(stones()).toHaveLength(0)
  })
})
