import { ENEMIES } from '../data/enemies'
import { PLAYABLE } from '../data/hatchlings'
import { MEOWTH_DEX } from './mapEventRules'
import { present } from './players'
import type { Game } from './types'

/** Sightings checked per second: often enough to catch a swarm crossing the screen. */
const CHECKS_PER_SECOND = 4

const onScreen = (g: Game, x: number, y: number) =>
  g.players.some((p) => present(p) && x >= p.screen.x && x <= p.screen.x + g.view.w && y >= p.screen.y && y <= p.screen.y + g.view.h)

/**
 * Logs every species on screen into the run's Pokédex log: wild Pokémon, the
 * fleeing Meowth and each player's own form, which also counts as caught (it's
 * theirs, like an evolution on the handhelds). In co-op the shell banks only
 * its own player's forms as caught (`ownForms`); a teammate's count as seen.
 */
export const updateSightings = (g: Game, dt: number) => {
  if (Math.floor(g.time * CHECKS_PER_SECOND) === Math.floor((g.time - dt) * CHECKS_PER_SECOND)) return
  const seen = g.dexLog.seen
  for (const p of g.players) {
    if (!present(p)) continue
    const form = PLAYABLE[p.starter].line[p.stage]!.dex
    seen.add(form)
    g.dexLog.own.set(form, p.shiny)
  }
  for (const e of g.enemies) if (e.dying < 0 && onScreen(g, e.x, e.y)) seen.add(ENEMIES[e.kind].dex)
  for (const ev of g.mapEvents.list) if (ev.kind === 'meowth' && ev.gone < 0 && onScreen(g, ev.x, ev.y)) seen.add(MEOWTH_DEX)
}
