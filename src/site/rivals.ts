import { COOP } from '../data/coop'
import { HATCHLING_IDS } from '../data/hatchlings'
import { REGULAR_LEGENDS } from '../data/legends'
import { STARTER_IDS } from '../data/starters'
import { RUN_LENGTH } from '../data/waves'
import { MAX_MOVES } from '../game/leveling'
import { LOCALE_IDS } from '../i18n'

/**
 * The other Pokémon survivors-likes people (and AI chats) mix us up with, for
 * the comparison page (`ROUTES.compare`) and the list of games like Vampire
 * Survivors (`ROUTES.alternatives`). Their facts are copy in `src/i18n/site`
 * (`compare`, `alternatives`), checked by hand against their own sites and
 * source on `RIVALS_CHECKED`: recheck them and move the date when either page changes.
 */
export const RIVALS_CHECKED = '2026-10-28'

type Rival = { name: string; url: string; maker: string }

export const RIVALS = {
  pokesurvivor: { name: 'PokéSurvivor', url: 'https://pokesurvivor.com/', maker: 'JPTER78' },
  burst: {
    name: 'Pokémon Survivor Burst',
    url: 'https://www.pokecommunity.com/threads/pok%C3%A9mon-survivor-burst-multi-languages.543514/',
    maker: 'ClessioTV',
  },
  pokerogue: { name: 'PokeRogue', url: 'https://pokerogue.net/', maker: 'pagefaultgames' },
} as const satisfies Record<string, Rival>

export type RivalId = keyof typeof RIVALS

/** Our side of the comparison, from the game's data, so the copy follows the game. */
export const OURS = {
  starters: STARTER_IDS.length,
  eggs: HATCHLING_IDS.length,
  legends: REGULAR_LEGENDS.length,
  players: COOP.maxPlayers,
  moves: MAX_MOVES,
  minutes: RUN_LENGTH / 60,
  languages: LOCALE_IDS.length,
} as const

export type OurFacts = typeof OURS
