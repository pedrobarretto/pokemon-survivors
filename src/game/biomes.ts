import { BIOME_MAP, type BiomeId } from '../data/biomes'
import { sampleBiome } from './biomeMap'
import { actAs, anchorPlayer } from './players'
import { weatherFits } from './weather'
import type { Game, Player } from './types'

/**
 * Where each player is: the biome of the map (`game/biomeMap.ts`) under
 * their feet, held on `Player.biome`. It decides their music and banner (the
 * shell's), the horde's lean around them (`leanPick`) and, for the team's
 * lead, the sky (`leadBiome`, `weather.ts`).
 */

/** Seconds after the lead enters a biome before weather that doesn't belong there clears up (lets the banner breathe). */
const WEATHER_GRACE = 5

/** Moves player `p` into biome `id` now: their banner (an event of theirs), and the lead's weather clears if it doesn't fit there. */
export const enterBiome = (g: Game, p: Player, id: BiomeId) => {
  if (id === p.biome) return
  const lead = anchorPlayer(g, 0) === p
  p.biome = id
  const before = actAs(g, p)
  g.events.push({ kind: 'biome', biome: id })
  actAs(g, before)
  // A move's call (Rain Dance, Sunny Day) holds its sky over any biome; what it held is checked when it ends.
  if (lead && !g.weather.held && !weatherFits(id, g.weather.id)) g.weather.next = Math.min(g.weather.next, g.time + WEATHER_GRACE)
}

/**
 * Follows every player across the map: a biome counts as entered once they
 * stand `BIOME_MAP.enter` px past its border, so walking along the line never
 * flickers. The caller skips it inside a room (a rift, a place), whose spots
 * aren't map spots: the biome left outside holds until the way back.
 */
export const updateBiomes = (g: Game) => {
  for (const p of g.players) {
    const s = sampleBiome(g.terrain.seed, p.x, p.y)
    if (s.a !== p.biome && s.t >= BIOME_MAP.enter) enterBiome(g, p, s.a)
  }
}
