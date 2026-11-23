import { era1Awards, era1Due, era1Gifts, type Era1Standing } from '../../src/game/era1'
import type { Sql } from './db'
import { sendGift } from './gifts'

/** How often the Era 1 job looks (and on boot): cheap, and a board an admin cleaned since gets its new top. */
const EVERY_MS = 6 * 3600_000

/**
 * The Era 1 Hall da Fama's rewards (`game/era1.ts`): once they're due
 * (`era1Due`, a day after Temporada 1 opens), ranks every main Era 1 board
 * from the API's own tables, as the boards list them (`era1Standings` of the
 * solo and co-op stores: a handle, never banned, no failed or unlisted run),
 * and sends each rewarded player their best tier's gifts (`era1Gifts`). Each
 * gift's key is the tier and slot (`era1:champion:0`), so running it again on
 * every tick and every instance sends nothing twice, and a player a cleaned
 * board moves up gets theirs on the next tick. Nothing is ever taken back.
 */
export const createEra1Rewards = (sql: Sql, sources: readonly { era1Standings: () => Promise<Era1Standing[]> }[]) => {
  /** Sends the rewards now, whatever the clock. How many gifts landed. */
  const award = async () => {
    const standings = (await Promise.all(sources.map((s) => s.era1Standings()))).flat()
    const awards = era1Awards(standings)
    return sql.begin(async (tx) => {
      let sent = 0
      for (const [userId, a] of awards) {
        for (const g of era1Gifts(a)) if (await sendGift(tx, userId, g.content, g.reason, g.key)) sent++
      }
      return sent
    })
  }

  const tick = async (now = Date.now()) => {
    if (!era1Due(now)) return
    try {
      const sent = await award()
      if (sent > 0) console.log(`era 1 hall: ${sent} gifts sent`)
    } catch (err) {
      console.error('era 1 rewards failed', err)
    }
  }

  return {
    award,
    tick,
    /** Runs `tick` now and every `EVERY_MS`, without keeping the process alive. */
    start: () => {
      void tick()
      setInterval(() => void tick(), EVERY_MS).unref()
    },
  }
}
