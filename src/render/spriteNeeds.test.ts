import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { ENEMIES } from '../data/enemies'
import { EVENTS, STAGES, stageStart } from '../data/waves'
import { enterDomain, jumpToAct } from '../game/domain'
import { createGame, step } from '../game/game'
import { drawRoster } from '../game/roster'
import { bossForms, castNeeds, dueNeeds, playerForms } from './spriteNeeds'

const roster = drawRoster(createRng(42))
const needs = castNeeds(roster)
const poolDex = (stage: number) => roster.stages[stage]!.map(([id]) => ENEMIES[id].dex)

describe('dueNeeds', () => {
  it('holds the stage playing and the next one, not the rest of the run', () => {
    const due = dueNeeds(needs, 0)
    for (const dex of [...poolDex(0), ...poolDex(1)]) expect(due).toContain(dex)
    for (const dex of due) expect(needs.some((n) => n.dex === dex && n.from <= STAGES[1]!.until)).toBe(true)
    expect(due.length).toBeLessThan(new Set(needs.map((n) => n.dex)).size / 2)
  })

  it("lets a past stage's horde go and brings a boss a stage early", () => {
    const at = stageStart(4)
    const due = dueNeeds(needs, at)
    const past = [...new Set(needs.map((n) => n.dex))].filter((dex) => needs.every((n) => n.dex !== dex || n.until <= at))
    expect(past.length).toBeGreaterThan(0)
    for (const dex of past) expect(due).not.toContain(dex)
    const boss = EVENTS.findIndex((e) => e.kind === 'boss' && e.at >= STAGES[4]!.until && e.at < STAGES[5]!.until)
    const id = roster.events[boss]
    expect(id && due.includes(ENEMIES[id].dex)).toBe(true)
  })

  it('lists the soonest first, each species once', () => {
    const due = dueNeeds(needs, 0)
    expect(new Set(due).size).toBe(due.length)
    const opening = [...new Set(poolDex(0))]
    expect(due.slice(0, opening.length).sort()).toEqual(opening.sort())
  })
})

const VIEW = { w: 480, h: 270 }

describe('playerForms', () => {
  it("wants a Mega's sheets only with the stone in hand at the final stage", () => {
    const g = createGame('charmander', VIEW, 1)
    expect(playerForms(g)).toEqual([])
    g.player.mega.stone = 'charizardX'
    expect(playerForms(g)).toEqual([])
    g.player.stage = 2
    expect(playerForms(g)).toEqual([{ dex: 6, shiny: false, form: 'megaX' }])
  })

  it("wants a legend's awakened form from its first awakening on, in its colors", () => {
    const g = createGame('kyogre', VIEW, 1)
    g.player.shiny = true
    expect(playerForms(g)).toEqual([])
    g.player.legend!.awakened = 1
    expect(playerForms(g)).toEqual([{ dex: 382, shiny: true, form: 'primal' }])
  })
})

describe('bossForms', () => {
  it("wants a rift legendary's Mega from the phase before it, not at the crossing", () => {
    const g = createGame('charmander', VIEW, 1)
    enterDomain(g, 'latias', g.player.x, g.player.y)
    expect(bossForms(g)).toEqual([])
    jumpToAct(g, 'battle')
    step(g, { move: { x: 0, y: 0 }, special: false }, 1 / 60)
    const fights = g.enemies.filter((e) => e.fight)
    expect(fights.map((e) => e.kind).sort()).toEqual(['latias', 'latios'])
    expect(bossForms(g)).toEqual([])
    for (const e of fights) e.fight!.phase = 1
    expect(bossForms(g).map((v) => `${v.dex}:${v.form}`).sort()).toEqual(['380:mega', '381:mega'])
  })
})
