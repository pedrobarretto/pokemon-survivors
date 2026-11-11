import { CAVE, GRAVEYARD, HIDDEN_PLACE_IDS, isHiddenPlace, PLACE_IDS, type PlaceId } from '../data/places'
import { HIDEOUT } from '../data/rocketHideout'
import { descendHideout, stageLair } from './hideout'
import { descendCave } from './cave'
import { openHidden } from './hidden'
import { openEntrance } from './placeEntrance'
import { enterPlace } from './placeInterior'
import type { Game } from './types'

/**
 * Dev-console shortcuts for staging places (`ps.place()`, `ps.enter()`,
 * `ps.floor()`, `ps.spirits()`) and hidden zones (`ps.hidden()`,
 * `ps.hiddenRoll()`, `ps.sparkle()`). Wired in `main.ts` for dev builds only.
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
          if (inside?.id === 'hideout' && inside.state.floor < HIDEOUT.floors) descendHideout(g, inside)
          else if (inside?.id !== 'cave' || inside.state.floor >= CAVE.floors) break
          else descendCave(g, inside)
        }
        const inside = g.place.inside
        return inside?.id === 'cave' || inside?.id === 'hideout' ? inside.state.floor : 'ps: not in the cave or the Hideout'
      }),
    /**
     * The Rocket Hideout: `ps.hideout()` steps in, `ps.hideout('lair')` straight into the boss's room (Giovanni, then Persian),
     * `ps.hideout('persian')` or `ps.hideout('mewtwo')` that boss's fight now; `ps.bossHp(0.35)` then reaches Mewtwo's last phase.
     */
    hideout: (to?: 'lair' | 'persian' | 'mewtwo') =>
      playing((g) => {
        if (g.place.inside?.id !== 'hideout') enterPlace(g, 'hideout', Math.round(g.player.x), Math.round(g.player.y))
        const inside = g.place.inside
        if (inside?.id !== 'hideout') return 'ps: no Hideout'
        if (to) while (inside.state.floor < HIDEOUT.floors) descendHideout(g, inside)
        if (to === 'persian' || to === 'mewtwo') stageLair(g, inside, to === 'mewtwo' ? 'shadowMewtwo' : 'giovanniPersian')
        inside.intro = 0
        return inside.state.stage ?? `B${inside.state.floor + 1}F`
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
    /** In a hidden zone, makes a spot sparkle now (its sure shiny pops out `HIDDEN.sparkle.warn` s later), whatever this visit rolled. */
    sparkle: () =>
      playing((g) => {
        const inside = g.place.inside
        if (inside?.id !== 'grotto' && inside?.id !== 'underground') return 'ps: not in a hidden zone'
        const sp = inside.state.dwellers.sparkle
        if (sp.id !== null) return 'ps: the sparkle came out already this visit'
        sp.at = inside.age
        return sp
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
