import { describe, expect, it, vi } from 'vitest'
import { createRng, rngFrom } from '../engine/rng'
import { forkDriver, scenarios, startScenario, tickScenario, type Driver, type Scenario } from '../determinism/scenario'
import { deflate, decodeSnapshot, inflate, restore, snapshot, stateHash } from './snapshot'
import { diffGames, diffStates } from './stateDiff'
import { RULES_VERSION } from './replay'
import { enterDomain } from './domain'
import { gainXp } from './leveling'
import { maxMoveLevel } from './moves'
import { enterPlace } from './placeInterior'
import { spawnWaveBoss } from './spawner'
import { featureAt } from './terrain'
import type { Attack, Game } from './types'

/** The nearest tunnel on the run's map. */
const tunnelNear = (g: Game) => {
  for (let r = 2; r < 40; r++) {
    for (let cx = -r; cx <= r; cx++) {
      for (const cy of [-r, r]) {
        const lm = featureAt(g.terrain.seed, cx, cy)?.landmark
        if (lm?.id === 'tunnel') return lm
      }
    }
  }
  throw new Error('no tunnel')
}

/**
 * Arrays a run shares with module tables, harmlessly: a foe's `types` (its
 * species'), a hitbox's `bonus` (`NO_BONUS`, a move's table, a mod's entries),
 * a domain transform's `spare` circles (`data/domains`, where two phases'
 * transforms may share them). The original shares them with hitboxes, foes and
 * transforms made after a snapshot; a copy restored in another module graph
 * shares its own. Nothing reads them by identity.
 */
const TABLE_ALIASES: ReadonlySet<string> = new Set(['types', 'bonus', 'spare'])

/** A game's snapshot bytes with `TABLE_ALIASES` unshared (each its own array of its own entries), so two runs compare byte for byte otherwise. */
const unsharedBytes = (g: Game) => {
  const clone: unknown = restore(snapshot(g))
  const seen = new Set<object>()
  const walk = (v: unknown) => {
    if (typeof v !== 'object' || v === null || seen.has(v)) return
    seen.add(v)
    if (v instanceof Map) return v.forEach(walk)
    if (v instanceof Set) return v.forEach(walk)
    if (Array.isArray(v)) return v.forEach(walk)
    const o = v as Record<string, unknown>
    for (const k of Object.keys(o)) {
      if (TABLE_ALIASES.has(k) && Array.isArray(o[k])) o[k] = (o[k] as unknown[]).map((x) => (typeof x === 'object' && x !== null ? { ...x } : x))
      walk(o[k])
    }
  }
  walk(clone)
  return snapshot(clone as Game)
}

/** Ticks the restored copy and the original play on after a checkpoint. */
const AFTER = 240

/**
 * The moments worth a checkpoint besides random ticks: a pick waiting, an
 * evolution (a legend's awakening), a rift (a domain's act), a place, a
 * tunnel, a route's fork on the map, a wave legendary's scene, a boss, a Mega,
 * a called sky, endless mode.
 */
const moments = (g: Game): string[] => [
  ...(g.phase !== 'playing' ? [g.phase] : []),
  ...(g.player.evolution?.awakening ? ['awakening'] : []),
  ...(g.rift.arena ? [g.rift.arena.domain ? `domain:${g.rift.arena.domain.act}` : 'arena'] : []),
  ...(g.place.inside ? [`place:${g.place.inside.id}`] : []),
  ...(g.player.landmark.transit ? ['tunnel'] : []),
  ...(g.route.fork ? [g.route.fork.chosen < 0 ? 'fork' : 'forkTaken'] : []),
  ...(g.legendScene ? [`legendScene:${g.legendScene.kind}`] : []),
  ...(g.bossId !== null ? ['boss'] : []),
  ...(g.player.mega.active > 0 ? ['mega'] : []),
  ...(g.weather.held ? ['weatherCall'] : []),
  ...(g.endless ? ['endless'] : []),
]

/**
 * Plays `s` for `ticks`, and at each checkpoint restores a copy from a
 * snapshot that plays on `AFTER` ticks beside the original. Returns how many
 * checkpoints it made and the moments they covered.
 */
const proveRestores = (s: Scenario, ticks: number, every: number, stage?: (g: Game) => void) => {
  const d = startScenario(s)
  stage?.(d.g)
  const pick = createRng(s.seed)
  const covered = new Set<string>()
  let next = Math.floor(pick() * every)
  let checkpoints = 0
  const check = (at: Driver) => {
    const bytes = snapshot(at.g)
    const copy = forkDriver(at, restore(bytes))
    expect(snapshot(copy.g)).toEqual(bytes)
    // The acting player is one of the team, not a copy of it.
    expect(copy.g.player).toBe(copy.g.players[0])
    for (let i = 0; i < AFTER; i++) {
      tickScenario(at)
      tickScenario(copy)
    }
    expect(stateHash(copy.g), `${s.starter} diverged after a restore at ${at.tick - AFTER}`).toBe(stateHash(at.g))
    // Byte for byte, but for the module tables the original shares (`TABLE_ALIASES`).
    expect(diffGames(at.g, copy.g)).toEqual([])
    expect(unsharedBytes(copy.g)).toEqual(unsharedBytes(at.g))
    checkpoints++
  }
  while (d.tick < ticks && tickScenario(d)) {
    const fresh = moments(d.g).filter((m) => !covered.has(m))
    if (d.tick < next && fresh.length === 0) continue
    for (const m of moments(d.g)) covered.add(m)
    check(d)
    next = d.tick + Math.floor(pick() * every)
  }
  return { checkpoints, covered }
}

describe('snapshot and restore', () => {
  it('restore a run that plays on exactly like the uninterrupted one', () => {
    const covered = new Set<string>()
    let checkpoints = 0
    for (const s of scenarios(4, 9)) {
      const r = proveRestores(s, 60 * 60 * 7, 1500)
      checkpoints += r.checkpoints
      for (const m of r.covered) covered.add(m)
    }
    expect(checkpoints).toBeGreaterThan(20)
    // A legend's awakening, a whole domain, the places and a route's fork come up along the way (`moments`); a tunnel has its own case below.
    expect([...covered].sort()).toEqual(expect.arrayContaining(['awakening', 'boss', 'domain:battle', 'domain:capture', 'domain:crossing', 'evolving', 'fork', 'levelup', 'place:cave', 'place:graveyard']))
  }, 120_000)

  it.each([
    { name: 'the cave', s: { seed: 61, starter: 'pidgey' }, stage: (g: Game) => enterPlace(g, 'cave', g.player.x, g.player.y), covers: 'place:cave' },
    { name: 'the graveyard, haunted', s: { seed: 62, starter: 'gastly', halloween: true }, stage: (g: Game) => enterPlace(g, 'graveyard', g.player.x, g.player.y), covers: 'place:graveyard' },
    { name: 'the sky', s: { seed: 63, starter: 'pidgey' }, stage: (g: Game) => enterPlace(g, 'sky', g.player.x, g.player.y), covers: 'place:sky' },
    { name: "Dialga's domain", s: { seed: 64, starter: 'charmander' }, stage: (g: Game) => enterDomain(g, 'dialga', g.player.x, g.player.y), covers: 'domain:crossing' },
    { name: 'a tunnel', s: { seed: 65, starter: 'squirtle' }, stage: (g: Game) => {
      const lm = tunnelNear(g)
      Object.assign(g.player, lm.mouths[0])
      g.player.landmark.entering = { cell: lm.cell, mouth: 0, t: 0.39 }
    }, covers: 'tunnel' },
    { name: "Mewtwo's entrance on the map", s: { seed: 66, starter: 'gible' }, stage: (g: Game) => {
      spawnWaveBoss(g, 'mewtwo', g.time, true)
    }, covers: 'legendScene:entrance' },
    { name: "a legend's awakening, with a full Bag", s: { seed: 67, starter: 'kyogre', bag: ['rareCandy', 'luckyEgg', 'xAttack', 'maxRevive'] }, stage: (g: Game) => {
      gainXp(g, 4000)
    }, covers: 'awakening' },
    { name: 'shop TMs calling the sky, armed TMs and Bottle Caps', s: { seed: 68, starter: 'riolu', tms: ['payDay', 'thief'], caps: 3 }, stage: (g: Game) => {
      g.player.moves.push(...(['rainDance', 'swordsDance', 'thief', 'fly'] as const).map((id) => ({ id, level: maxMoveLevel(id), cooldown: 0, path: 0 })))
    }, covers: 'weatherCall' },
  ] as const)('restore inside $name and play on exactly the same', ({ s, stage, covers }) => {
    const r = proveRestores({ difficulty: 'normal', maxRanks: true, ...s }, 60 * 50, 240, stage)
    expect(r.checkpoints).toBeGreaterThan(5)
    expect([...r.covered]).toContain(covers)
  }, 60_000)

  it('restore in a fresh module context, with nothing carried over by module state', async () => {
    const [s] = scenarios(1, 5)
    const d = startScenario(s!)
    while (d.tick < 60 * 60 * 2 && tickScenario(d));
    const bytes = snapshot(d.g)
    const saved = { tick: d.tick, angle: d.angle, bot: { ...d.bot.state } }
    for (let i = 0; i < 600; i++) tickScenario(d)

    // Another module graph (as a fresh tab would load), after it played a different run first.
    vi.resetModules()
    const fresh = {
      snapshot: await import('./snapshot'),
      scenario: await import('../determinism/scenario'),
      rng: await import('../engine/rng'),
    }
    const other = fresh.scenario.startScenario(scenarios(1, 6)[0]!)
    while (other.tick < 60 * 60 && fresh.scenario.tickScenario(other));
    const copy: Driver = { ...saved, g: fresh.snapshot.restore(bytes), bot: fresh.rng.rngFrom(saved.bot), over: false }
    for (let i = 0; i < 600; i++) fresh.scenario.tickScenario(copy)
    expect(fresh.snapshot.stateHash(copy.g)).toBe(stateHash(d.g))
    // Byte for byte, once the module tables the original shares are unshared (`TABLE_ALIASES`): foes and hitboxes made
    // before the snapshot share their species' and moves' tables with later ones in the original, the copy its own.
    expect(diffGames(d.g, copy.g)).toEqual([])
    expect(unsharedBytes(copy.g)).toEqual(unsharedBytes(d.g))
  }, 60_000)

  it('play a run the same in a fresh module context as in one that played other runs before', async () => {
    const [s, before] = scenarios(2, 21)
    const used = startScenario(before!)
    while (used.tick < 60 * 60 * 2 && tickScenario(used));
    const here = startScenario(s!)
    while (here.tick < 60 * 60 && tickScenario(here));
    vi.resetModules()
    const fresh = { snapshot: await import('./snapshot'), scenario: await import('../determinism/scenario') }
    const there = fresh.scenario.startScenario(s!)
    while (there.tick < 60 * 60 && fresh.scenario.tickScenario(there));
    expect(fresh.snapshot.stateHash(there.g)).toBe(stateHash(here.g))
  }, 60_000)

  it('keep shared objects shared, and cycles', () => {
    const g = startScenario(scenarios(1)[0]!).g
    const foe = { id: 1, hp: 3 }
    const hits = new Map([[1, 0.5]])
    const loop: Record<string, unknown> = { name: 'loop' }
    loop.self = loop
    const extra = { foe, again: foe, hits, hits2: hits, loop }
    const back = restore(snapshot({ ...g, extra } as Game)) as Game & { extra: typeof extra }
    expect(back.extra.again).toBe(back.extra.foe)
    expect(back.extra.hits2).toBe(back.extra.hits)
    expect(back.extra.loop.self).toBe(back.extra.loop)
  })

  it('keep what JSON loses: -0, NaN, Infinity, undefined beside missing, Map and Set order', () => {
    const g = startScenario(scenarios(1)[0]!).g
    const extra = {
      numbers: [-0, NaN, Infinity, -Infinity, 0.1 + 0.2, 2 ** 40, -(2 ** 31), 2 ** 31, 223, 224, -1],
      gaps: [{ a: 1, b: undefined }, { a: 1 }],
      map: new Map<unknown, unknown>([['z', 1], [3, 'x'], ['a', 2]]),
      set: new Set(['b', 'a', 'c']),
    }
    const back = (restore(snapshot({ ...g, extra } as Game)) as Game & { extra: typeof extra }).extra
    expect(back.numbers).toEqual(extra.numbers)
    expect(Object.is(back.numbers[0], -0)).toBe(true)
    expect('b' in back.gaps[0]!).toBe(true)
    expect('b' in back.gaps[1]!).toBe(false)
    expect([...back.map]).toEqual([...extra.map])
    expect([...back.set]).toEqual([...extra.set])
  })

  it('carry the rng as its state and rebind it', () => {
    const g = startScenario(scenarios(1)[0]!).g
    const back = restore(snapshot(g))
    expect(back.rng.state).toEqual(g.rng.state)
    expect([back.rng(), back.rng()]).toEqual([g.rng(), g.rng()])
    expect(back.rng.state).not.toBe(g.rng.state)
  })

  it('give the same bytes and hash for the same state, and another hash for any change', () => {
    const d = startScenario(scenarios(1, 3)[0]!)
    for (let i = 0; i < 3000; i++) tickScenario(d)
    const bytes = snapshot(d.g)
    const copy = restore(bytes)
    expect(snapshot(copy)).toEqual(bytes)
    expect(stateHash(copy)).toBe(stateHash(d.g))
    const e = copy.enemies.find((x) => x.dying < 0)!
    e.x += Math.abs(e.x) * Number.EPSILON || Number.MIN_VALUE
    expect(stateHash(copy)).not.toBe(stateHash(d.g))
    copy.rng()
    const rngOnly = restore(bytes)
    rngOnly.rng()
    expect(stateHash(rngOnly)).not.toBe(stateHash(d.g))
  })

  it('leave the caches out and rebuild them', () => {
    const d = startScenario(scenarios(1, 4)[0]!)
    for (let i = 0; i < 3000; i++) tickScenario(d)
    expect(d.g.terrain.cells.size).toBeGreaterThan(0)
    const back = restore(snapshot(d.g))
    expect(back.terrain.cells.size).toBe(0)
    expect(back.grid.cell).toBe(d.g.grid.cell)
    expect(back.grid.used.length).toBeGreaterThan(0)
  })

  it('name where an unsupported value sits', () => {
    const g = startScenario(scenarios(1)[0]!).g
    const attack = { motion: { kind: 'static' }, onHit: () => 1 } as unknown as Attack
    expect(() => snapshot({ ...g, attacks: [attack] })).toThrow('snapshot: a function at attacks[0].onHit')
    expect(() => stateHash({ ...g, attacks: [attack] })).toThrow('snapshot: a function at attacks[0].onHit')
    expect(() => snapshot({ ...g, attacks: [new Float32Array(2)] as unknown as Attack[] })).toThrow('an instance of Float32Array at attacks[0]')
  })

  it('refuse a snapshot of other rules, and read its header', () => {
    const g = startScenario(scenarios(1)[0]!).g
    const bytes = snapshot(g)
    expect(decodeSnapshot(bytes)).toMatchObject({ format: 1, rules: RULES_VERSION })
    const other = bytes.slice()
    // The rules version is the varint after 'P', 'S' and the format.
    other[3] = RULES_VERSION + 1
    expect(() => restore(other)).toThrow(`snapshot: rules ${RULES_VERSION + 1}`)
    expect(() => restore(bytes.slice(0, bytes.length - 3))).toThrow('cut short')
  })

  it('deflate and inflate back to the same bytes', async () => {
    const d = startScenario(scenarios(1, 8)[0]!)
    for (let i = 0; i < 3000; i++) tickScenario(d)
    const bytes = snapshot(d.g)
    const small = await deflate(bytes)
    expect(small.length).toBeLessThan(bytes.length * 0.7)
    expect(await inflate(small)).toEqual(bytes)
  })
})

describe('rngFrom', () => {
  it('draws mulberry32 as before: the run seeds keep their sequences', () => {
    const rng = createRng(7)
    expect([rng(), rng(), rng()]).toEqual([0.011704753153026104, 0.06195825757458806, 0.97690763277933])
    const again = rngFrom({ ...rng.state })
    expect(again()).toBe(rng())
  })
})

describe('diffStates', () => {
  it('names what differs, matching things by id', () => {
    const a = { time: 1, enemies: [{ id: 4, x: 1 }, { id: 9, x: 2 }], seen: new Set([1]), hits: new Map([[1, 2]]) }
    const b = { time: 1, enemies: [{ id: 9, x: 2.0000000000000004 }], seen: new Set([1, 2]), hits: new Map([[1, 3]]), extra: true }
    expect(diffStates(a, b)).toEqual([
      'enemies.length: 2 ≠ 1',
      'enemies#4: only on the left: {"id":4,"x":1}',
      'enemies#9.x: 2 ≠ 2.0000000000000004 (bits 4000000000000000 ≠ 4000000000000001, Δ 4.44e-16)',
      'seen{2}: only on the right',
      'hits<1>: 2 ≠ 3 (bits 4000000000000000 ≠ 4008000000000000, Δ 1.00)',
      'extra: only on the right: true',
    ])
    expect(diffStates(a, structuredClone(a))).toEqual([])
  })
})
