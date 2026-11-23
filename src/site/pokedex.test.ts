import { describe, expect, it } from 'vitest'
import manifest from '../data/sprites.generated.json'
import { ENEMIES, type EnemyId } from '../data/enemies'
import { GAME_SPECIES } from '../data/species'
import { RUN_LENGTH } from '../data/waves'
import { DEX_REGIONS, dexRegionOf } from '../data/nationalDex'
import { dexGoal } from '../game/dexRegions'
import { REGIONAL_DEX } from '../data/regionalForms'
import { appearances, clock, dexTotals, gameDex, pokedex, regionCounts, regionOf } from './pokedex'
import { CHANGELOG } from './changelog'

/** The static pages' copy and `llms.txt`, which state the Pokédex's numbers in words. */
const STATIC_COPY: Record<string, string> = import.meta.glob(['/index.html', '/en/index.html', '/es/index.html', '/fr/index.html', '/zh-tw/index.html', '/public/llms.txt'], { query: '?raw', import: 'default', eager: true })

describe('pokedex', () => {
  it("keeps the in-game Pokédex to exactly the species the save may hold (`GAME_SPECIES`), gift-only companions out", () => {
    expect(new Set(gameDex().map((e) => e.dex))).toEqual(GAME_SPECIES)
  })

  it("counts each region the way its title does, so the game and the site show the same numbers (Kanto: 151 in the game, Mew left out)", () => {
    for (const region of DEX_REGIONS) {
      const c = regionCounts(region)
      expect(c.goal).toBe(dexGoal(region).length)
      expect(c.inGame).toBeLessThanOrEqual(c.total)
    }
    expect(regionCounts('kanto')).toMatchObject({ inGame: 151, total: 151, goal: 150, left: ['Mew'] })
  })

  it("counts the in-game Pokédex's species and forms apart, and only the species a run fights as defeatable", () => {
    const entries = gameDex()
    const totals = dexTotals(entries)
    // Every regional form is a card of its own, and so is Eternal Floette, filed after Floette in Kalos.
    expect(totals.forms).toBe(REGIONAL_DEX.length + 1)
    expect(dexRegionOf(entries.find((e) => e.name === 'Eternal Floette')?.dex ?? 0)).toBe('kalos')
    const never = entries.filter((e) => e.source.kind === 'gift' || e.source.kind === 'path' || (e.source.kind === 'starter' && e.source.wild === undefined))
    expect(totals.defeatable).toBe(entries.length - never.length)
  })

  it("states the Pokédex's numbers in its copy: the static pages, llms.txt and the update that brought it", () => {
    const { entries, species, forms, defeatable } = dexTotals()
    const update = CHANGELOG.flatMap((u) => u.changes.flatMap((c) => c.notes)).find((n) => n.en.includes('in-game Pokédex is now the National one'))
    const copies = [
      ...Object.entries(STATIC_COPY),
      ...(['pt', 'en', 'es'] as const).map((l) => [`changelog ${l}`, update?.[l] ?? ''] as const),
    ]
    expect(Object.keys(STATIC_COPY)).toHaveLength(6)
    for (const [where, text] of copies) {
      expect(text, where).toContain(String(species))
      expect(text, where).toContain(`${forms} `)
    }
    for (const [where, text] of copies.slice(0, 6)) {
      expect(text, where).toContain(String(entries))
      expect(text, where).toContain(String(defeatable))
    }
  })

  const entries = pokedex()

  it('lists every species the game loads exactly once, with unique anchors', () => {
    expect(entries.map((e) => e.dex).sort((a, b) => a - b)).toEqual(Object.keys(manifest).map(Number).sort((a, b) => a - b))
    expect(new Set(entries.map((e) => e.slug)).size).toBe(entries.length)
  })

  it('gives legendaries, bosses and regular enemies their role (a boss a family plays as is listed as that family)', () => {
    const role = (name: string) => entries.find((e) => e.name === name)?.role
    expect([role('Charizard'), role('Rattata'), role('Spiritomb'), role('Mewtwo')]).toEqual(['starter', 'enemy', 'egg', 'legendary'])
  })
})

describe('regionOf', () => {
  it('puts a regional form in the region of the form', () => {
    expect(regionOf(10162).name).toBe('Galar')
  })

  it('maps national dex numbers to the generation they debuted in', () => {
    expect([1, 151, 152, 386, 387, 809, 810, 906].map((dex) => regionOf(dex).name)).toEqual([
      'Kanto', 'Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Alola', 'Galar', 'Paldea',
    ])
  })
})

describe('appearances', () => {
  const ids = Object.keys(ENEMIES) as EnemyId[]

  it('merges spawn-pool windows into ordered, non-overlapping spans inside the run', () => {
    for (const id of ids) {
      const windows = appearances(id).flatMap((a) => (a.kind === 'horde' ? [a] : []))
      windows.forEach((w, i) => {
        expect(w.from).toBeLessThan(w.until)
        expect(w.until).toBeLessThanOrEqual(RUN_LENGTH)
        if (i > 0) expect(w.from).toBeGreaterThan(windows[i - 1]!.until)
      })
    }
  })

  it("places every Pokémon somewhere in the run, bosses as boss events, trio slots, night boss slots, rifts (an event's too), Tera Raids, the reaper, a place's boss or Regigigas's temple", () => {
    for (const id of ids) {
      const found = appearances(id)
      expect(found.length).toBeGreaterThan(0)
      if ('boss' in ENEMIES[id]) expect(found.some((a) => a.kind === 'boss' || a.kind === 'trio' || a.kind === 'rift' || a.kind === 'eventRift' || a.kind === 'wormhole' || a.kind === 'raid' || a.kind === 'reaper' || a.kind === 'temple' || (a.kind === 'place' && a.boss) || a.kind === 'night' || a.kind === 'roam' || a.kind === 'duel' || a.kind === 'rush' || a.kind === 'storm' || a.kind === 'maskRaid')).toBe(true)
    }
  })
})

describe('clock', () => {
  it('formats run time like the HUD', () => {
    expect([0, 75, 150, 900].map(clock)).toEqual(['0:00', '1:15', '2:30', '15:00'])
  })
})
