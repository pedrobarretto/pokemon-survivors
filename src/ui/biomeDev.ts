import { BIOME_IDS, type BiomeId } from '../data/biomes'
import { biomeAt, sampleBiome } from '../game/biomeMap'
import { localPlayer } from '../game/players'
import { clearSpot } from '../game/terrain'
import type { Game } from '../game/types'

/** One letter per biome on `ps.biomes()`'s map. */
const LETTER: Record<BiomeId, string> = { meadow: '.', forest: 'f', beach: 'b', cave: 'c', plant: 'p', desert: 'd', snow: 's', volcano: 'v', tower: 't' }

/** How deep (px past its border) `ps.biome` sets the player down in a region. */
const DEEP = 160

/**
 * Dev console helpers for the biome map (`game/biomeMap.ts`): `ps.biome('volcano')`
 * walks the player to the nearest spot well inside a region of that biome
 * (the banner and music follow on the next tick); `ps.biomes()` prints the
 * map around the player, `ps.biomes(8000, 160)` a wider one.
 */
export const biomeDevTools = (game: () => Game | undefined) => ({
  biome: (id: BiomeId) => {
    const g = game()
    if (!g) return console.warn('ps: start a run first')
    if (!BIOME_IDS.includes(id)) return console.warn(`ps.biome: one of ${BIOME_IDS.join(', ')}`)
    const p = localPlayer(g)
    for (let r = 0; r <= 24000; r += 160) {
      const n = Math.max(1, Math.round((r * Math.PI * 2) / 160))
      for (let k = 0; k < n; k++) {
        const x = p.x + Math.cos((k / n) * Math.PI * 2) * r
        const y = p.y + Math.sin((k / n) * Math.PI * 2) * r
        const s = sampleBiome(g.terrain.seed, x, y)
        if (s.a !== id || s.t < DEEP) continue
        const at = clearSpot(g, { x, y }, p.radius + 2)
        p.x = at.x
        p.y = at.y
        return { x: Math.round(at.x), y: Math.round(at.y), away: r }
      }
    }
    return console.warn(`ps.biome: no ${id} within 24000 px`)
  },
  biomes: (radius = 4000, step = 100) => {
    const g = game()
    if (!g) return console.warn('ps: start a run first')
    const p = localPlayer(g)
    const rows: string[] = []
    for (let y = p.y - radius; y <= p.y + radius; y += step * 2) {
      let row = ''
      for (let x = p.x - radius; x <= p.x + radius; x += step) row += Math.abs(x - p.x) < step / 2 && Math.abs(y - p.y) < step ? '@' : LETTER[biomeAt(g.terrain.seed, x, y)]
      rows.push(row)
    }
    console.log(`${rows.join('\n')}\n${BIOME_IDS.map((b) => `${LETTER[b]} ${b}`).join(' · ')} · @ you (${step} px a letter)`)
    return localPlayer(g).biome
  },
})
