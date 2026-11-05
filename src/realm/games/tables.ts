import type { TableGameId } from '../../data/minigames'
import { tableGame, type TableGame } from '../../net/realmTables'
import { fourInRowRules } from './fourInRow.rules'
import { typeDuelRules } from './typeDuel.rules'

/**
 * Every table game's rules, as the tables host them: the realm relay
 * (`relay/src/realm.ts`) and the local table (`localTable.ts`) start matches
 * from here. Rules files import only `net/realmTables.ts`, so the relay's
 * bundle stays free of the game.
 */
export const TABLE_GAMES: Record<TableGameId, TableGame> = {
  fourInRow: tableGame(fourInRowRules),
  typeDuel: tableGame(typeDuelRules),
}
