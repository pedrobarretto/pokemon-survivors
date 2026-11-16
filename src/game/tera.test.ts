import { describe, expect, it } from 'vitest'
import { TERA } from '../data/tera'
import { createGame } from './game'
import { collectShard, dropShard, teraGuard, teraPhase, teraPower, updateTera, updateTeraIntro } from './tera'
import { gameSpecial } from './special'
import type { Game } from './types'

const DT = 1 / 60

/** A fresh Charmander run past its opening draft, with `type` as its Tera type and the orb full. */
const ready = (type: Parameters<typeof collectShard>[1] = 'water') => {
  const g = createGame('charmander', { w: 480, h: 270 }, 7)
  g.player.phase = 'playing'
  g.phase = 'playing'
  g.player.tera.type = type
  g.player.tera.orb = 1
  return g
}

/** Presses TERA and plays the transformation through. */
const terastallize = (g: Game) => {
  updateTera(g, true, DT)
  while (updateTeraIntro(g, DT));
}

describe('Terastal', () => {
  it('needs a Tera type and a full orb, and holds the world through the transformation', () => {
    const g = ready()
    g.player.tera.orb = 0.5
    updateTera(g, true, DT)
    expect(g.player.tera.intro).toBe(0)
    g.player.tera.orb = 1
    g.player.tera.type = null
    updateTera(g, true, DT)
    expect(teraPhase(g.player.tera)).toBe('none')
    g.player.tera.type = 'water'
    updateTera(g, true, DT)
    expect(g.player.tera.intro).toBeCloseTo(TERA.intro)
    while (updateTeraIntro(g, DT));
    expect([g.player.tera.active, g.player.tera.form, g.player.tera.orb, g.player.tera.count]).toEqual([TERA.duration, 'water', 0, 1])
  })

  it('powers the Tera type: Tera STAB on one of its own types, a weaker boost on another, Stellar once per type', () => {
    const fire = ready('fire')
    terastallize(fire)
    expect([teraPower(fire, 'fire'), teraPower(fire, 'water')]).toEqual([TERA.stab, 1])
    const water = ready('water')
    terastallize(water)
    expect(teraPower(water, 'water')).toBe(TERA.power)
    const stellar = ready('stellar')
    terastallize(stellar)
    expect([teraPower(stellar, 'fire'), teraPower(stellar, 'fire'), teraPower(stellar, 'ice')]).toEqual([TERA.stellarFirst, TERA.stellarRest, TERA.stellarFirst])
  })

  it('defends as the Tera type while it lasts, Stellar as the Pokémon itself', () => {
    const g = ready('water')
    expect(teraGuard(g, ['electric'])).toBe(1)
    terastallize(g)
    expect(teraGuard(g, ['electric'])).toBeGreaterThan(1)
    expect(teraGuard(g, ['fire'])).toBeLessThan(1)
    expect(teraGuard(g, [])).toBe(1)
    const s = ready('stellar')
    terastallize(s)
    expect(teraGuard(s, ['water'])).toBe(1)
  })

  it("turns the special to the Tera type's while it lasts, and gives it back after", () => {
    const g = ready('water')
    const own = gameSpecial(g).def.type
    terastallize(g)
    expect([own, gameSpecial(g).def.type]).toEqual(['fire', 'water'])
    for (let t = 0; t < TERA.duration + 1; t += DT) updateTera(g, false, DT)
    expect([g.player.tera.form, gameSpecial(g).def.type]).toEqual([null, 'fire'])
  })

  it('never starts during a Mega Evolution', () => {
    const g = ready()
    g.player.mega.active = 5
    updateTera(g, true, DT)
    expect(g.player.tera.intro).toBe(0)
  })

  it('sets the Tera type from the shard touched, and the rest of its choice crumbles', () => {
    const g = ready('fire')
    g.pickups.length = 0
    dropShard(g, 0, 0, 'ice', 99)
    dropShard(g, 30, 0, 'grass', 99)
    dropShard(g, 60, 0, 'rock', 100)
    collectShard(g, 'ice', 99)
    expect(g.player.tera.type).toBe('ice')
    expect(g.pickups.map((k) => (k.kind === 'teraShard' ? `${k.tera}:${k.age < 0 ? 'gone' : 'here'}` : ''))).toEqual(['ice:here', 'grass:gone', 'rock:here'])
  })

  it('fills the orb with time even with no KO', () => {
    const g = ready('fire')
    g.player.tera.orb = 0
    for (let t = 0; t < TERA.orbTime + 1; t += DT) updateTera(g, false, DT)
    expect(g.player.tera.orb).toBe(1)
  })
})
