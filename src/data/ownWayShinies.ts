import { MELTAN, ZYGARDE } from './legendPaths'
import { DIANCIE } from './mythicals'

/**
 * The legends whose shiny comes their own way, since they're never fought
 * shiny: one in how many shiny Zygarde Cores, Mystery Boxes and pink diamonds
 * bring it (`ZYGARDE.shinyCore`, `MELTAN.boxShiny`, `DIANCIE.jewelShiny`), for
 * the words that tell it (the game's screens and the site). Kept out of the
 * simulation's modules: only what's shown reads it.
 */
export const OWN_WAY_SHINIES = {
  zygarde: Math.round(1 / ZYGARDE.shinyCore),
  meltan: Math.round(1 / MELTAN.boxShiny),
  diancie: Math.round(1 / DIANCIE.jewelShiny),
} as const

export type OwnWayShiny = keyof typeof OWN_WAY_SHINIES

export const isOwnWayShiny = (id: string): id is OwnWayShiny => Object.hasOwn(OWN_WAY_SHINIES, id)
