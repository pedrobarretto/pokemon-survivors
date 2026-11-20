import { STARTER_IDS } from '../data/starters'
import { REGULAR_LEGENDS } from '../data/legends'
import { NO_RANKS, UPGRADE_IDS, UPGRADES, type Ranks } from '../game/meta'
import { onScreen, type PickScreen } from '../game/lockstep'
import { inPlay, localPlayer } from '../game/players'
import { TICK } from '../game/replay'
import type { Game, Player } from '../game/types'
import { createCoopClient, type CoopClient, type CoopDeps } from './client'
import type { CoopPick } from './start'

/**
 * A headless co-op player on the real client: it joins a room, plays the
 * run (kites the horde in wide circles, takes cards after a human-ish beat,
 * presses its special now and then, votes against the endless mode) and
 * lets the soak (`scripts/coop/soak.mjs`) and the dev console (`ps.coop`)
 * stage trouble. The same code runs in Node and in a browser tab.
 */

export type Bot = {
  client: CoopClient
  /** One frame of real time (`dt` s): decides, samples the stick, runs the client. */
  frame: (dt: number) => number
  /** The bot's own player in its own simulation, or null outside a run. */
  me: () => Player | null
  game: () => Game | null
  /** Picks every pending screen at once with rounds old and new, duplicates, nonsense: none of it may break the run. */
  storm: (n: number) => void
  /** Stops kiting and walks into the horde: it ends the run soon (the soak's way to a natural end on time). */
  surrender: () => void
}

/** Half of every Poké Mart rank: a fresh save's bot falls in a few minutes, a maxed one outlives a surrender. */
const VETERAN: Ranks = UPGRADE_IDS.reduce((r, id) => ({ ...r, [id]: Math.ceil(UPGRADES[id].maxRank / 2) }), NO_RANKS)

/**
 * A bot's Pokémon, by its number (a spread of species and sizes). In a Legend
 * room (`legend`) it plays a legend too, its regular one as the `partner`, and
 * claims that legend as captured: only a relay with guests and no API keeps a
 * guest's claim (the dev relay); anywhere else the seat plays the partner.
 */
export const botPick = (n: number, legend = false): CoopPick => {
  const partner = STARTER_IDS[(n * 7 + 3) % STARTER_IDS.length]!
  const pick: CoopPick = { starter: partner, ranks: VETERAN, shiny: n % 5 === 0 }
  if (!legend) return pick
  const id = REGULAR_LEGENDS[(n * 5 + 15) % REGULAR_LEGENDS.length]!
  return { ...pick, starter: id, partner, legends: [id] }
}

export const createBot = (deps: CoopDeps, opts: { seed: number; vote?: boolean }): Bot => {
  const client = createCoopClient(deps)
  let rand = opts.seed >>> 0 || 1
  const random = () => ((rand = Math.imul(rand ^ (rand >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 2 ** 32
  let acc = 0
  let stick = { x: 0, y: 0 }
  let steerIn = 0
  let pickAt: { round: number; at: number } | null = null
  let specialIn = 3 + random() * 5
  let angle = random() * Math.PI * 2
  let surrendered = false

  const game = () => client.state().runner?.game ?? null
  const me = () => {
    const g = game()
    return g ? localPlayer(g) : null
  }

  /** Where to walk: away from the foes closest by and around them (kiting), wandering when none are near. */
  const steer = (g: Game, p: Player) => {
    angle += 0.25 * (0.5 + random())
    let fx = 0
    let fy = 0
    for (const e of g.enemies) {
      const dx = p.x - e.x
      const dy = p.y - e.y
      const d = Math.hypot(dx, dy)
      if (d > 150 || d < 0.5) continue
      const w = ((150 - d) / 150) * (e.boss ? 3 : 1)
      fx += (dx / d) * w
      fy += (dy / d) * w
    }
    for (const hz of g.hazards) {
      const dx = p.x - hz.x
      const dy = p.y - hz.y
      const d = Math.hypot(dx, dy)
      if (d < 60 && d > 0.5) {
        fx += (dx / d) * 2
        fy += (dy / d) * 2
      }
    }
    const f = Math.hypot(fx, fy)
    let x = Math.cos(angle) * 0.3
    let y = Math.sin(angle) * 0.3
    if (f > 0.05) {
      // Flee, and circle around the pack instead of running into the next one.
      x += fx / f - (fy / f) * 0.7
      y += fy / f + (fx / f) * 0.7
    }
    // A fainted teammate within reach: go get them up.
    for (const q of g.players) {
      if (q === p || q.gone || q.hp > 0) continue
      const dx = q.x - p.x
      const dy = q.y - p.y
      const d = Math.hypot(dx, dy)
      if (d < 260 && d > 4) {
        x = dx / d
        y = dy / d
      }
    }
    const len = Math.hypot(x, y) || 1
    return { x: x / len, y: y / len }
  }

  /** Toward the nearest foe (a boss first): how a surrendering bot meets its end. */
  const charge = (g: Game, p: Player) => {
    let best: { x: number; y: number } | null = null
    let bestD = Infinity
    for (const e of g.enemies) {
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2 - (e.boss ? 1e6 : 0)
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    if (!best) return { x: 0, y: 0 }
    const dx = best.x - p.x
    const dy = best.y - p.y
    const len = Math.hypot(dx, dy) || 1
    return { x: dx / len, y: dy / len }
  }

  const decide = (g: Game, now: number, dt: number) => {
    const p = localPlayer(g)
    steerIn -= dt
    if (steerIn <= 0) {
      steerIn = 0.15 + random() * 0.2
      stick = surrendered ? charge(g, p) : inPlay(p) ? steer(g, p) : p.hp <= 0 ? { x: 0, y: 0 } : stick
    }
    if (onScreen(p) && p.offers.length > 0) {
      if (!pickAt || pickAt.round !== p.round) pickAt = { round: p.round, at: now + 300 + random() * 1700 }
      else if (now >= pickAt.at) {
        client.input({ k: 'pick', screen: p.phase as PickScreen, round: p.round, index: Math.floor(random() * p.offers.length) })
        pickAt = { round: p.round, at: Infinity }
      }
    }
    const vote = g.coop?.vote
    if (vote && vote.outcome === 'open' && vote.votes[p.slot] === null && random() < 0.02) client.input({ k: 'endless', vote: opts.vote ?? false })
    specialIn -= dt
    if (specialIn <= 0 && g.phase === 'playing') {
      specialIn = 4 + random() * 6
      client.input({ k: 'special', sample: client.state().sample })
    }
  }

  const frame = (dt: number) => {
    const g = game()
    const st = client.state()
    if (g && st.status.kind === 'playing' && !st.hidden) {
      decide(g, deps.now(), dt)
      acc += dt
      while (acc >= TICK) {
        acc -= TICK
        client.stick(stick)
      }
    }
    const ran = client.frame(dt)
    // Bots play no sounds: the events go.
    const r = client.state().runner
    if (r) r.events.length = r.actors.length = 0
    return ran
  }

  const storm = (n: number) => {
    const p = me()
    if (!p) return
    const screens: PickScreen[] = ['levelup', 'branch', 'ability', 'curse', 'tm', 'pokeball']
    for (let i = 0; i < n; i++) {
      const round = Math.max(0, p.round + Math.floor(random() * 5) - 3)
      const pick = random()
      if (pick < 0.6) client.input({ k: 'pick', screen: screens[Math.floor(random() * screens.length)]!, round, index: Math.floor(random() * 6) })
      else if (pick < 0.8) client.input({ k: 'reroll', round })
      else client.input({ k: 'banish', round, index: Math.floor(random() * 4) })
    }
  }

  return { client, frame, me, game, storm, surrender: () => void (surrendered = true) }
}
