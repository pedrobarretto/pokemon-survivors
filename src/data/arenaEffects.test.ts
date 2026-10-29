import { describe, expect, it } from 'vitest'
import { bodyOf } from './bodies'
import { ARENA_EFFECTS, FOLLOWER_DEX, type ArenaEffectDef } from './arenaEffects'
import emotes from './emotes.generated.json'
import sprites from './sprites.generated.json'
import { STARTERS } from './starters'
import { VERSUS_PICKS } from './versus'

const defs: ArenaEffectDef[] = Object.values(ARENA_EFFECTS)

describe('the Arena effects', () => {
  it('give every Pokémon of the roster, at every stage, an animation for every emote', () => {
    const has = emotes as Record<string, Record<string, unknown>>
    for (const pick of VERSUS_PICKS) {
      for (const stage of STARTERS[pick].line) {
        for (const def of defs) {
          if (def.slot !== 'emote') continue
          expect(def.anims.some((a) => has[String(stage.dex)]?.[a] !== undefined), `${def.anims} for #${stage.dex}`).toBe(true)
        }
      }
    }
  })

  it('draw every follower from sheets the game ships', () => {
    for (const dex of FOLLOWER_DEX) {
      expect(Object.hasOwn(sprites, String(dex)), `#${dex}`).toBe(true)
      expect(bodyOf(dex).bodyH).toBeLessThan(40)
    }
  })
})
