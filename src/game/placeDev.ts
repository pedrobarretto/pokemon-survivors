import { CAVE, GRAVEYARD, HIDDEN_PLACE_IDS, isHiddenPlace, PLACE_IDS, type PlaceId } from '../data/places'
import { descendCave } from './cave'
import { openHidden } from './hidden'
import { openEntrance } from './placeEntrance'
import { enterPlace } from './placeInterior'
import type { Game } from './types'

/**
 * Dev-console shortcuts for staging places (`ps.place()`, `ps.enter()`,
 * `ps.floor()`, `ps.spirits()`) and hidden zones (`ps.hidden()`,
 * `ps.hiddenRoll()`, `ps.dweller()`). Wired in `main.ts` for dev builds only.
 */
export const placeDevTools = (game: () => Game | undefined) => {
  const playing = (fn: (g: Game) => unknown) => {
    const g = game()
    return g ? fn(g) : 'ps: start a run first'
  }
  const known = (id: PlaceId | undefined) => id === undefined || PLACE_IDS.includes(id)
  return {
    /** Opens a place's entrance 70 px to the right of the player (`ps.place('graveyard')`; the director's pick without an argument). */
    place: (id?: PlaceId) =>
      known(id) ? playing((g) => openEntrance(g, id, { x: Math.round(g.player.x + 70), y: Math.round(g.player.y) })) : `Places: ${PLACE_IDS.join(', ')}`,
    /** Steps straight into a place (`ps.enter('sky')` works for any Pokémon). */
    enter: (id: PlaceId) => (known(id) ? playing((g) => enterPlace(g, id, Math.round(g.player.x), Math.round(g.player.y))) : `Places: ${PLACE_IDS.join(', ')}`),
    /** In the cave, takes the stairs now (`ps.floor()`), as many times as given; the last floor is the treasure chamber. */
    floor: (times = 1) =>
      playing((g) => {
        for (let i = 0; i < times; i++) {
          const inside = g.place.inside
          if (inside?.id !== 'cave' || inside.state.floor >= CAVE.floors) break
          descendCave(g, inside)
        }
        return g.place.inside?.id === 'cave' ? g.place.inside.state.floor : 'ps: not in the cave'
      }),
    /** Opens a hidden zone's entrance 70 px to the right of the player, unannounced (`ps.hidden('underground')`; the biome's pick without an argument); `found` marks it found at once. */
    hidden: (id?: PlaceId, found = false) => {
      if (id !== undefined && !isHiddenPlace(id)) return `Hidden zones: ${HIDDEN_PLACE_IDS.join(', ')}`
      return playing((g) => {
        const ent = openHidden(g, id, { x: Math.round(g.player.x + 70), y: Math.round(g.player.y) })
        if (ent && found) ent.foundAt = g.now
        return ent
      })
    },
    /** The run's hidden zone roll: when it's due (null: none, or it opened); `ps.hiddenRoll(20)` makes it due 20 s from now, so the director opens it on its own. */
    hiddenRoll: (inSeconds?: number) =>
      playing((g) => {
        if (inSeconds !== undefined) g.place.hiddenAt = g.time + inSeconds
        return { dueAt: g.place.hiddenAt, now: g.time, entrance: g.place.entrance }
      }),
    /** In a hidden zone, brings its rare dweller out now (Shaymin, Diancie), whatever this visit rolled. */
    dweller: () =>
      playing((g) => {
        const inside = g.place.inside
        if (inside?.id !== 'grotto' && inside?.id !== 'underground') return 'ps: not in a hidden zone'
        const rare = inside.state.dwellers.rare
        if (rare.id !== null) return 'ps: the rare dweller came out already this visit'
        rare.at = inside.age
        return rare
      }),
    /** In the graveyard, sets the keystone's spirits (one short of waking Spiritomb by default). */
    spirits: (n = GRAVEYARD.spirits - 1) =>
      playing((g) => {
        const inside = g.place.inside
        if (inside?.id !== 'graveyard') return 'ps: not in the graveyard'
        inside.state.spirits = Math.min(GRAVEYARD.spirits, n)
        if (inside.state.spirits >= GRAVEYARD.spirits) inside.state.wakeAt = inside.age
        return inside.state.spirits
      }),
  }
}
