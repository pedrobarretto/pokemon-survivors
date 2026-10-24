import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { pickAlpha, spawnAlpha } from './alphas'
import { chooseOffer, step } from './game'
import { gainXp, recomputeStats } from './leveling'
import { grantStone } from './mega'
import { NO_RANKS } from './meta'
import { withBranch } from './moves'
import { OUTBREAK_SPECIES } from './outbreak'
import { moveOf, recordEvent, recordStep, resimulate, RULES_VERSION, startGame, startRecording, TICK, type Replay, type ReplayStart } from './replay'
import { enterPlace } from './placeInterior'
import { enterArena } from './riftArena'
import { spawnWaveBoss } from './spawner'
import { EVENTS } from '../data/waves'
import type { Game } from './types'

/**
 * The guard for missed `RULES_VERSION` bumps. A few short scripted runs are
 * recorded, re-simulated from their replays and boiled down to a digest of how
 * they played and where they ended. The digests are pinned per
 * `RULES_VERSION`: when the simulation changes (the same inputs play out
 * otherwise), a digest moves, and the fix is to bump `RULES_VERSION` and pin
 * the new ones, so the API never judges an older game's replays with new
 * rules. Refactors and presentation keep every digest.
 */

const START: ReplayStart = { seed: 11, starter: 'squirtle', difficulty: 'normal', ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak: null, halloween: false, bag: [], view: { w: 480, h: 270 } }

/** A run set up by hand before its first tick (the same on the recording and the re-simulation). */
type Scenario = { start: ReplayStart; seconds: number; stage: (g: Game) => void }

const SCENARIOS = {
  /** Many level-ups in a row, each card picked by the script, and a screen rotation. */
  levelUps: { start: START, seconds: 45, stage: (g) => gainXp(g, 600) },
  /** Charizard with the Charizardite Y, pressing the Mega button: the transformation, Drought and the Mega's special. */
  mega: {
    start: { ...START, starter: 'charmander' },
    seconds: 30,
    stage: (g) => {
      g.player.stage = 2
      recomputeStats(g)
      grantStone(g, 'charizardY')
    },
  },
  /**
   * A fall in a rift arena with a Revive held: the rift throws the player out
   * and keeps the Revive (PR #94), then the Nightmare horde of minute 10 spends
   * it and lands the faint.
   */
  riftFall: {
    start: { ...START, difficulty: 'nightmare', starter: 'charmander' },
    seconds: 40,
    stage: (g) => {
      g.time = 600
      g.nextEvent = 99
      g.player.revives = 1
      enterArena(g, 'groudon', g.player.x, g.player.y)
      g.player.hp = 1
    },
  },
  /** Nightmare at 6:00: an Alpha charging in, the world's next attack due, and levels and Revives so the run lasts a while. */
  alphaHazards: {
    start: { ...START, difficulty: 'nightmare', starter: 'treecko' },
    seconds: 12,
    stage: (g) => {
      g.time = 360
      g.nextEvent = 99
      g.worldHazards.charge = 0.99
      g.player.revives = 3
      gainXp(g, 1500)
      spawnAlpha(g, pickAlpha(g.rng, g.roster.stages[0]!)!, g.player.x + 120, g.player.y)
    },
  },
  /** A haunted run (Noite das Bruxas) at 4:59: the 5:00 slot brings the night boss the seed drew, and its fight plays out. */
  nightBoss: {
    start: { ...START, halloween: true, starter: 'gastly' },
    seconds: 30,
    stage: (g) => {
      g.time = 299
      g.nextEvent = EVENTS.findIndex((e) => e.kind === 'boss' && 'enemy' in e && e.enemy === 'snorlax')
      g.player.revives = 2
      gainXp(g, 1200)
    },
  },
  /** Four Bag items on Nightmare at 6:00 with the day's outbreak: a Rare Candy's level-ups, X Attack, Honey's swarm and a Max Revive that saves the first faint. */
  bag: {
    start: { ...START, difficulty: 'nightmare', outbreak: OUTBREAK_SPECIES[0]!, bag: ['rareCandy', 'honey', 'xAttack', 'maxRevive'] },
    seconds: 20,
    stage: (g) => {
      g.time = 360
      g.nextEvent = 99
      g.player.revives = 2
      g.player.hp = 1
    },
  },
  /**
   * The Kecleon Shop's run inputs on Nightmare at 6:00: an Everstone and three
   * Bottle Caps (+24% to every stat, no evolution, the Ability pick at Lv 16),
   * an armed TM, and the shop-exclusive TMs learned (Pay Day's coins, Thief on
   * an Alpha, Protect's bubble, Hyper Beam).
   */
  shop: {
    start: { ...START, difficulty: 'nightmare', starter: 'charmander', bag: ['everstone'], tms: ['iceBeam'], evo: ['fireStone'], caps: 3 },
    seconds: 25,
    stage: (g) => {
      g.time = 360
      g.nextEvent = 99
      g.player.revives = 2
      gainXp(g, 1500)
      g.player.moves.push(
        { id: 'payDay', level: 5, cooldown: 0.2, path: 0 },
        { id: 'thief', level: 5, cooldown: 0.4, path: 0 },
        { id: 'protect', level: 3, cooldown: 0.6, path: 0 },
        { id: 'hyperBeam', level: 3, cooldown: 0.8, path: 0 },
      )
      spawnAlpha(g, pickAlpha(g.rng, g.roster.stages[0]!)!, g.player.x + 60, g.player.y)
    },
  },
  /**
   * The shop-exclusive TMs' second batch at 2:30: Rain Dance's rain over the
   * run's sky (Soothing Rain) and Sunny Day's sun called over it, Swords
   * Dance's stacks, Drain Punch, Thunder Wave's paralysis and Fly's take-offs
   * and landings, against the horde and an Alpha.
   */
  shopTms2: {
    start: { ...START, starter: 'pichu' },
    seconds: 25,
    stage: (g) => {
      g.time = 150
      g.nextEvent = 99
      g.player.revives = 2
      gainXp(g, 1200)
      g.player.moves.push(
        { id: 'rainDance', level: 5, cooldown: 0.2, path: withBranch(0, 4, 1) },
        { id: 'sunnyDay', level: 4, cooldown: 12, path: withBranch(0, 4, 1) },
        { id: 'swordsDance', level: 5, cooldown: 0.4, path: 0 },
        { id: 'drainPunch', level: 4, cooldown: 0.6, path: withBranch(0, 4, 1) },
        { id: 'thunderWave', level: 5, cooldown: 0.8, path: 0 },
        { id: 'fly', level: 5, cooldown: 1, path: 0 },
      )
      spawnAlpha(g, pickAlpha(g.rng, g.roster.stages[0]!)!, g.player.x - 70, g.player.y)
    },
  },
  /**
   * Evolution items as keys (`evoGate.ts`): Scyther levelled past its
   * evolution with no item waits in its form, an Everstone's 15% stronger,
   * while a wave boss falls next to it and rolls its item drop; a Metal Coat
   * lying close by, as a boss leaves one, lets it evolve on the spot.
   */
  evoGate: {
    start: { ...START, starter: 'scyther' },
    seconds: 20,
    stage: (g) => {
      g.time = 240
      g.nextEvent = 99
      g.player.revives = 2
      gainXp(g, 2500)
      const boss = spawnWaveBoss(g, 'onix', g.time)
      Object.assign(boss, { x: g.player.x + 30, y: g.player.y, hp: 1 })
      g.pickups.push({ id: g.nextId++, x: g.player.x - 20, y: g.player.y, vx: 0, vy: 0, attracted: false, age: 0, kind: 'evoItem', item: 'metalCoat' })
    },
  },
  /**
   * A line step that needs its item (`EvolutionStage.item`): Porygon past
   * Lv 28 with neither item holds its form, 15% stronger, while a wave boss
   * falls next to it and rolls its drop (only the Up-Grade can come); an
   * Up-Grade close by evolves it to Porygon2, which holds again for the
   * Dubious Disc lying a little farther, then evolves into Porygon-Z.
   */
  porygonGate: {
    start: { ...START, starter: 'porygon' },
    seconds: 25,
    stage: (g) => {
      g.time = 240
      g.nextEvent = 99
      g.player.revives = 2
      gainXp(g, 6000)
      const boss = spawnWaveBoss(g, 'onix', g.time)
      Object.assign(boss, { x: g.player.x + 30, y: g.player.y, hp: 1 })
      g.pickups.push({ id: g.nextId++, x: g.player.x - 20, y: g.player.y, vx: 0, vy: 0, attracted: false, age: 0, kind: 'evoItem', item: 'upgrade' })
      g.pickups.push({ id: g.nextId++, x: g.player.x, y: g.player.y + 26, vx: 0, vy: 0, attracted: false, age: 0, kind: 'evoItem', item: 'dubiousDisc' })
    },
  },
  /** Smeargle's Sketch at Lv 5 with a wave boss close by and the horde around: it paints off the boss first, then off whoever is nearest. */
  sketch: {
    start: { ...START, starter: 'smeargle' },
    seconds: 20,
    stage: (g) => {
      g.time = 150
      g.nextEvent = 99
      g.player.revives = 2
      for (const m of g.player.moves) if (m.id === 'sketch') m.level = 5
      const boss = spawnWaveBoss(g, 'onix', g.time)
      Object.assign(boss, { x: g.player.x + 60, y: g.player.y })
    },
  },
  /** Kyogre on Nightmare at 3:00, a few levels in: the Legend mode's own horde (`LEGEND_HORDE`) and Pressure. */
  legend: {
    start: { ...START, difficulty: 'nightmare', starter: 'kyogre' },
    seconds: 20,
    stage: (g) => {
      g.time = 180
      g.nextEvent = 99
      gainXp(g, 800)
    },
  },
  /** Zapdos arriving at 5:00 a few levels in: a wave legendary's entrance (its HP, its shiny roll), then its first phase against the player. */
  waveLegend: {
    start: { ...START, starter: 'pichu' },
    seconds: 25,
    stage: (g) => {
      g.time = 300
      g.nextEvent = 99
      g.player.revives = 2
      gainXp(g, 1200)
      const boss = spawnWaveBoss(g, 'zapdos', g.time)
      Object.assign(boss, { x: g.player.x + 90, y: g.player.y })
    },
  },
  /** Down in the cave with Protect's echo fork (its bubbles overlap): walking the rooms through the corridor mouths (`MOUTH` in `dungeon.ts`). */
  cave: {
    start: { ...START, starter: 'charmander' },
    seconds: 30,
    stage: (g) => {
      g.time = 240
      g.nextEvent = 99
      g.player.revives = 2
      gainXp(g, 600)
      g.player.moves.push({ id: 'protect', level: 4, cooldown: 0, path: withBranch(0, 4, 1) })
      enterPlace(g, 'cave', g.player.x, g.player.y)
    },
  },
} as const satisfies Record<string, Scenario>

type ScenarioId = keyof typeof SCENARIOS

/**
 * Digests of each scenario's ending, by the `RULES_VERSION` they were taken
 * under. When the version moves, replace the entry with the new digests the
 * failing test prints.
 */
const PINNED: Partial<Record<number, Record<ScenarioId, string>>> = {
  38: {
    levelUps: '2998·50·13·8c971102',
    mega: '1900·33·2·1fa9caeb',
    riftFall: '711·0·1·74733b0f',
    alphaHazards: '1002·6·19·93ff9daa',
    nightBoss: '2093·39·17·136a154c',
    bag: '1077·9·3·d13820e7',
    shop: '1537·54·19·e383bce0',
    shopTms2: '1787·47·17·3cba2f20',
    evoGate: '1487·55·24·ea1fa054',
    porygonGate: '2074·67·37·ffe05090',
    sketch: '1210·20·2·e776249d',
    legend: '1100·51·14·cdbdb688',
    waveLegend: '1998·14·17·1fa0f40a',
    cave: '2204·14·12·a14b60da',
  },
}

/** Phases that wait on a pick, made by the script like a player's tap. */
const PICKS: ReadonlySet<Game['phase']> = new Set(['levelup', 'branch', 'ability', 'tm', 'curse', 'pokeball'])

/** What a run looks like at a moment: the clock, the player, every enemy and pickup, bit for bit. */
const snapshot = (g: Game): Array<number | string> => {
  const p = g.player
  const values: Array<number | string> = [g.phase, g.time, g.kills, g.coins, g.player.revives, p.level, p.xp, p.hp, p.x, p.y, p.stage, g.enemies.length, g.pickups.length]
  for (const e of g.enemies) values.push(e.kind, e.x, e.y, e.hp)
  for (const k of g.pickups) values.push(k.kind, k.x, k.y)
  return values
}

/** Ticks between the snapshots of a recording's trail: a change that moves the run for a while and then settles still shows. */
const TRAIL_EVERY = 30

/**
 * Plays a scenario with a scripted player, recording it: the stick wanders
 * through the 32 directions at full speed, the special every 4 s, the Mega
 * button and the lunge on their own beats, a card at every pick and a
 * rotation at 10 s. All from a seeded rng, so the replay is the same every
 * time. `trail` is a snapshot every `TRAIL_EVERY` ticks.
 */
const record = ({ start, seconds, stage }: Scenario) => {
  const view = { ...start.view }
  const g = startGame(start, view)
  stage(g)
  const end = g.time + seconds
  const rec = startRecording(start)
  const bot = createRng(5)
  const trail: Array<number | string> = []
  let dir = 0
  while (g.time < end && g.phase !== 'gameover' && g.phase !== 'victory') {
    if (PICKS.has(g.phase)) {
      const i = Math.floor(bot() * g.player.offers.length)
      recordEvent(rec, ['offer', i])
      chooseOffer(g, g.player.offers[i]!)
      continue
    }
    if (rec.tick % TRAIL_EVERY === 0) trail.push(...snapshot(g))
    if (rec.tick === 600) Object.assign(view, { w: 300, h: 520 })
    dir = (dir + Math.floor(bot() * 3) + 31) % 32
    const special = rec.tick % 240 === 0
    const mega = rec.tick % 400 === 100
    const lunge = rec.tick % 120 === 60
    if (special) recordEvent(rec, ['special'])
    if (mega) recordEvent(rec, ['mega'])
    if (lunge) recordEvent(rec, ['lunge'])
    step(g, { move: recordStep(rec, view, moveOf(1 + 6 * 32 + dir)), special, mega, lunge }, TICK)
  }
  return { live: g, trail, replay: JSON.parse(JSON.stringify(rec.replay)) as Replay }
}

/** FNV-1a over the bytes of each number's float64 bits and of each string's char codes: the same on every engine. */
const fnv = (values: ReadonlyArray<number | string>) => {
  const view = new DataView(new ArrayBuffer(8))
  let h = 0x811c9dc5
  const byte = (b: number) => (h = Math.imul(h ^ b, 0x01000193) >>> 0)
  for (const v of values) {
    if (typeof v === 'string') for (let i = 0; i < v.length; i++) byte(v.charCodeAt(i) & 0xff)
    else {
      view.setFloat64(0, v)
      for (let i = 0; i < 8; i++) byte(view.getUint8(i))
    }
  }
  return h.toString(16).padStart(8, '0')
}

/** Where a run ended, the rng's next draw included (taken last, so it changes nothing). */
const endOf = (g: Game) => [...snapshot(g), g.rng()]

/**
 * Plays a scenario and re-simulates its replay from a freshly staged start.
 * `digest` is `ticks·kills·level·hash`: the readable part says what moved at
 * a glance, the hash covers the recording's trail and where the replay ended.
 */
const ending = (scenario: Scenario) => {
  const { live, trail, replay } = record(scenario)
  const g = startGame(replay.start)
  scenario.stage(g)
  resimulate(replay, g)
  const end = endOf(g)
  const ticks = replay.moves.reduce((sum, n, i) => (i % 2 === 1 ? sum + n : sum), 0)
  return { live, sameEnd: fnv(endOf(live)) === fnv(end), digest: `${ticks}·${g.kills}·${g.player.level}·${fnv([...trail, ...end])}` }
}

describe(`the simulation under RULES_VERSION ${RULES_VERSION}`, () => {
  const endings = Object.fromEntries(Object.entries(SCENARIOS).map(([id, s]) => [id, ending(s)])) as Record<ScenarioId, ReturnType<typeof ending>>

  it('plays each scenario through what it covers, and its replay lands on the same ending', () => {
    const { levelUps, mega, riftFall, alphaHazards, bag, shopTms2, evoGate, porygonGate, sketch } = endings
    expect(levelUps.live.player.level).toBeGreaterThan(10)
    expect(mega.live.player.mega.count).toBe(1)
    expect(riftFall.live.events.map((e) => e.kind)).toEqual(expect.arrayContaining(['riftFall', 'riftExit', 'revive', 'gameover']))
    expect(alphaHazards.live.worldHazards.fired).toBeGreaterThan(0)
    expect(alphaHazards.live.events.some((e) => e.kind === 'alpha' && e.moment === 'charge')).toBe(true)
    expect(bag.live.events.some((e) => e.kind === 'maxRevive')).toBe(true)
    expect(shopTms2.live.weather.held).not.toBeNull()
    expect(shopTms2.live.player.moves.find((m) => m.id === 'swordsDance')?.stacks).toBeGreaterThan(1)
    expect([evoGate.live.player.stage, evoGate.live.player.evoFound.length, evoGate.live.player.evoHeld]).toEqual([1, 1, false])
    expect([porygonGate.live.player.stage, porygonGate.live.player.evoFound.toSorted(), porygonGate.live.player.evoHeld]).toEqual([2, ['dubiousDisc', 'upgrade'], false])
    expect(sketch.live.player.moves.find((m) => m.id === 'sketch')?.sketch).toBeDefined()
    expect(sketch.live.kills).toBeGreaterThan(0)
    for (const e of Object.values(endings)) expect(e.sameEnd).toBe(true)
  })

  it('ends every scenario where it did when RULES_VERSION was pinned (else bump RULES_VERSION)', () => {
    const got = Object.fromEntries(Object.entries(endings).map(([id, e]) => [id, e.digest])) as Record<ScenarioId, string>
    const pinned = PINNED[RULES_VERSION]
    const table = JSON.stringify(got, null, 2)
    if (!pinned) expect.fail(`No digests pinned for RULES_VERSION ${RULES_VERSION}: in src/game/rulesGuard.test.ts, set PINNED to { ${RULES_VERSION}: ${table} }`)
    const moved = (Object.keys(got) as ScenarioId[]).filter((id) => got[id] !== pinned[id])
    if (moved.length > 0) {
      expect.fail(
        `The simulation changed (${moved.join(', ')}) but RULES_VERSION is still ${RULES_VERSION}. ` +
          `The API would judge older games' replays with the new rules. Bump RULES_VERSION in src/game/replay.ts, ` +
          `then pin the new digests in src/game/rulesGuard.test.ts: PINNED = { ${RULES_VERSION + 1}: ${table} }`,
      )
    }
  })
})
