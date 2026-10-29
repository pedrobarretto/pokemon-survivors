import { describe, expect, it } from 'vitest'
import { VALE, VERSUS } from '../data/versus'
import { createVersusGame } from '../game/versus'
import { guideTarget } from '../render/versusGuide'
import { coachTip } from './versusCoach'

const match = () => {
  const g = createVersusGame(3, [{ starter: 'charmander', name: 'ash', team: 0 }])
  const me = g.players[0]!
  // Off the spawn pad, in the jungle, away from every goal.
  me.x = -200
  me.y = 60
  // Past the opening seconds, whose line is the kit's.
  g.time = 30
  return { g, me }
}

describe('coachTip', () => {
  it('opens with the kit, then says how to lock once a rival is in reach', () => {
    const { g, me } = match()
    g.time = 2
    expect(coachTip(g, me)).toBe('kit')
    g.time = 30
    const rival = g.players.find((p) => p.versus!.team === 1)!
    rival.x = me.x + 60
    rival.y = me.y
    g.enemies.find((e) => e.id === rival.versus!.avatar)!.x = rival.x
    g.enemies.find((e) => e.id === rival.versus!.avatar)!.y = rival.y
    expect(coachTip(g, me)).toBe('aim')
    me.versus!.lock = rival.versus!.avatar
    expect(coachTip(g, me)).toBe('farm')
  })

  it('walks a new player from farming to carrying to scoring', () => {
    const { g, me } = match()
    expect(coachTip(g, me)).toBe('farm')
    me.versus!.energy = 8
    expect(coachTip(g, me)).toBe('carry')
    const lane = g.versus!.goals.find((goal) => goal.team === 1 && !goal.base)!
    me.x = lane.x
    me.y = lane.y
    expect(coachTip(g, me)).toBe('channel')
  })

  it('says the base goal is locked until a lane goal falls', () => {
    const { g, me } = match()
    me.versus!.energy = 8
    const base = g.versus!.goals.find((goal) => goal.team === 1 && goal.base)!
    me.x = base.x
    me.y = base.y
    expect(coachTip(g, me)).toBe('locked')
  })

  it('sends a hurt player home, but not one already healing there', () => {
    const { g, me } = match()
    me.hp = me.stats.maxHp * 0.1
    expect(coachTip(g, me)).toBe('lowHp')
    expect(guideTarget(g, me)?.kind).toBe('heal')
    me.x = VALE.spawn[0].x
    me.y = VALE.spawn[0].y
    expect(coachTip(g, me)).not.toBe('lowHp')
  })

  it('leaves the basics out once quiet, and says nothing on the bench', () => {
    const { g, me } = match()
    expect(coachTip(g, me, true)).toBeNull()
    me.versus!.energy = VERSUS.energy.cap
    expect(coachTip(g, me, true)).toBe('full')
    me.hp = 0
    expect(coachTip(g, me)).toBeNull()
  })
})

describe('guideTarget', () => {
  it('points a carrier to the nearest rival goal that takes scores', () => {
    const { g, me } = match()
    expect(guideTarget(g, me)).toBeNull()
    me.versus!.energy = 5
    me.y = 200
    const target = guideTarget(g, me)
    expect(target?.kind).toBe('goal')
    expect(target && target.kind === 'goal' && target.goal).toMatchObject({ team: 1, base: false, y: 290 })
  })
})
