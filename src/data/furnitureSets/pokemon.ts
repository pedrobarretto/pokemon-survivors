import type { FurnitureDef } from '../furniture'

/**
 * The Pokémon collections (`trainer`, `center`, `gallery`): starter beds,
 * Poké Ball pieces, the Pokémon Center's and Mart's, and framed paintings
 * (legends across the sky, tributes to the games' covers). A Pokémon's
 * likeness in any of them comes from its SpriteCollab art, never generated.
 * Spread into `FURNITURE`; names in i18n `furniture.names`.
 */
export const POKEMON_FURNITURE = {} as const satisfies Record<string, FurnitureDef>
