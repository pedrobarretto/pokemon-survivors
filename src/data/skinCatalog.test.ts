import { describe, expect, it } from 'vitest'
import { cosmeticPrice } from './cosmetics'
import { PLAYABLE } from './hatchlings'
import { SKIN_BUNDLES, SKIN_IDS, SKINS } from './skinCatalog'

/** Each source's variants (`src/data/skins/<id>.json`), by id. */
const sources = Object.fromEntries(
  Object.entries(import.meta.glob<Record<string, unknown>>('./skins/*.json', { eager: true, import: 'variants' })).map(([path, variants]) => [path.slice('./skins/'.length, -'.json'.length), variants]),
)
const baked = new Set(Object.keys(import.meta.glob('../../public/assets/skins/**/*.png')).map((p) => p.slice('../../public/assets/skins/'.length)))

describe('the skins catalog', () => {
  it('lists every skin source, with the stages its variants cover', () => {
    expect(SKIN_IDS.slice().sort()).toEqual(Object.keys(sources).sort())
    for (const id of SKIN_IDS) expect([...SKINS[id].dexes].sort(), id).toEqual(Object.keys(sources[id] ?? {}).map(Number).sort())
  })

  it('has baked sheets, normal and shiny, for every stage it covers', () => {
    for (const id of SKIN_IDS)
      for (const dex of SKINS[id].dexes)
        for (const dir of ['', 'shiny/'])
          for (const anim of ['Walk', 'Idle', 'Hurt']) expect(baked, `${id} ${dex} ${dir}${anim}`).toContain(`${id}/${dex}/${dir}${anim}.png`)
  })

  it("covers only its line's own stages", () => {
    for (const id of SKIN_IDS) {
      const stages: readonly number[] = PLAYABLE[SKINS[id].line].line.map((st) => st.dex)
      for (const dex of SKINS[id].dexes) expect(stages, id).toContain(dex)
    }
  })

  it('prices skins and bundles as launched', () => {
    expect(cosmeticPrice('charmanderSuit')).toBe(1200)
    expect(cosmeticPrice('gengarSuit')).toBe(750)
    expect(cosmeticPrice('bulbasaurAutumn')).toBe(550)
    expect(cosmeticPrice('phantumpWinter')).toBe(400)
    expect(SKIN_BUNDLES.bulbasaurSeasons.items).toEqual(['bulbasaurSakura', 'bulbasaurAutumn', 'bulbasaurWinter'])
    expect(SKIN_BUNDLES.shroomishSeasons.price).toBe(900)
    expect(SKIN_BUNDLES.winterLaunch.items).toHaveLength(9)
  })
})
