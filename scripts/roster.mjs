// Builds the wild horde roster: every species of the National Dex that can roam the wild,
// checked against the PMD SpriteCollab tracker (normal and shiny Walk/Idle/Hurt must exist)
// and filled with official names, types, base stats and capture rates from PokeAPI.
// Writes src/data/roster.generated.json, which src/data/roster.ts turns into enemies, and
// src/data/nationalDex.generated.json: the species SpriteCollab hasn't drawn yet, which the
// Pokédex shows as a thank-you to its artists (src/data/nationalDex.ts).
// Usage: npm run roster && npm run assets
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BOSSES, COMPANIONS, CRITTERS, HIDDEN_DWELLERS, PLACE_BOSSES, STARTERS, TRAITS, pad } from './dex.mjs'
import { NATIONAL_LAST, nationalSpecies } from './pokeapi.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const OUT = join(ROOT, 'src/data/roster.generated.json')
const NATIONAL = join(ROOT, 'src/data/nationalDex.generated.json')
const TRACKER = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/tracker.json'
const SPRITES = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite'

/**
 * Species that never roam the horde, though they could: their look is one of many forms
 * (Unown's 28 letters, Castform's weather), or they're kept special (the supporters'
 * Pumpkaboo). Everything else regular with full sheets is wild, but the starters' lines
 * (the player's partners), the wave bosses, the trait species hand-tuned in
 * src/data/enemies.ts and the map's and places' own Pokémon (`scripts/dex.mjs`).
 */
const KEPT_OUT = [201, 351]

/**
 * Most bytes one species' Walk, Idle and Hurt sheets may decode to (RGBA, 8 directions):
 * Wailord's, the heaviest the horde had. A new species heavier than that would raise what one
 * stage can hold on a phone, so it stays out (`src/render/spriteNeeds.ts` streams per stage).
 */
const HEAVY = 4.8 * 1048576

const ANIMS = ['Walk', 'Idle', 'Hurt']

/** Types the game knows (`POKE_TYPES` in src/data/types.ts); species with any other type are left out. */
const GAME_TYPES = new Set(
  (await readFile(join(ROOT, 'src/data/types.ts'), 'utf8')).match(/POKE_TYPES = \[([^\]]*)\]/)[1].match(/[a-z]+/g),
)

/** Ids `src/data/enemies.ts` defines by hand (Beldum in Deoxys's domain, Audino…): a roster entry would be shadowed by them. */
const HAND_IDS = new Set(
  [...(await readFile(join(ROOT, 'src/data/enemies.ts'), 'utf8')).matchAll(/^ {2}(\w+): \{ dex:/gm)].map(([, id]) => id),
)

const json = async (url) => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url).catch((error) => ({ ok: false, status: error.message }))
    if (res.ok) return res.json()
    if (attempt >= 4) throw new Error(`${res.status} ${url}`)
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
  }
}

/** Whether SpriteCollab has every anim we draw for the species' normal form. */
const drawn = (tracker, dex) => ANIMS.every((a) => a in (tracker[pad(dex)]?.sprite_files ?? {}))

/** Every anim we draw exists in the normal and the shiny (`0000/0001`) form. */
const brokenSprites = (tracker, dex) => {
  const node = tracker[pad(dex)]
  const shiny = node?.subgroups?.['0000']?.subgroups?.['0001']
  const missing = (n) => ANIMS.filter((a) => !(a in (n?.sprite_files ?? {})))
  const problems = [...missing(node).map((a) => a), ...missing(shiny).map((a) => `shiny ${a}`)]
  return problems.length > 0 ? problems.join(', ') : null
}

/** Decoded bytes of a species' Walk, Idle and Hurt sheets, from its AnimData.xml (a CopyOf shares its source's sheet). */
const sheetBytes = async (dex) => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${SPRITES}/${pad(dex)}/AnimData.xml`).catch(() => null)
    if (res?.ok) {
      const xml = await res.text()
      const anims = Object.fromEntries(
        [...xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)].map(([, body]) => {
          const tag = (name) => body.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]
          return [tag('Name'), { copyOf: tag('CopyOf'), w: Number(tag('FrameWidth')), h: Number(tag('FrameHeight')), frames: [...body.matchAll(/<Duration>/g)].length }]
        }),
      )
      const resolve = (name) => (anims[name]?.copyOf ? resolve(anims[name].copyOf) : name)
      return [...new Set(ANIMS.map(resolve))].reduce((sum, name) => sum + (anims[name] ? anims[name].w * anims[name].frames * anims[name].h * 8 * 4 : 0), 0)
    }
    if (attempt >= 4) throw new Error(`AnimData.xml of #${dex}`)
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
  }
}

/** `Mr. Mime` → `mrMime`, `Farfetch’d` → `farfetchd`, `Flabébé` → `flabebe`, `Jangmo-o` → `jangmoO`. */
const idOf = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’.]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('')

const reserved = new Set([...STARTERS, ...BOSSES, ...TRAITS, ...CRITTERS, ...PLACE_BOSSES, ...HIDDEN_DWELLERS, ...COMPANIONS, ...KEPT_OUT])
const [tracker, national, previous] = await Promise.all([json(TRACKER), nationalSpecies(), readFile(OUT, 'utf8').then(JSON.parse)])
const known = new Set(Object.values(previous).map((s) => s.dex))

const candidates = [...national.values()].filter((s) => {
  if (s.kind !== 'regular' || reserved.has(s.dex)) return false
  if (HAND_IDS.has(idOf(s.name))) return false
  const unknown = s.types.filter((t) => !GAME_TYPES.has(t))
  if (unknown.length > 0) return console.warn(`#${s.dex} ${s.name}: dropped, the game has no ${unknown.join('/')} type`), false
  const broken = brokenSprites(tracker, s.dex)
  if (broken) return console.warn(`#${s.dex} ${s.name}: dropped, missing ${broken}`), false
  return true
})

// Only species new to the horde are weighed: the ones it had stay whatever their size.
const fresh = candidates.filter((s) => !known.has(s.dex))
const bytes = new Map()
for (let i = 0; i < fresh.length; i += 16) {
  const batch = fresh.slice(i, i + 16)
  const sizes = await Promise.all(batch.map((s) => sheetBytes(s.dex)))
  batch.forEach((s, j) => bytes.set(s.dex, sizes[j]))
}
const found = candidates.filter((s) => {
  const size = bytes.get(s.dex) ?? 0
  if (size > HEAVY) return console.warn(`#${s.dex} ${s.name}: dropped, its sheets decode to ${(size / 1048576).toFixed(1)} MB`), false
  return true
})

const ids = found.map((s) => idOf(s.name))
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
if (dupes.length > 0) throw new Error(`Duplicate ids: ${dupes.join(', ')}`)
const lost = [...known].filter((dex) => !found.some((s) => s.dex === dex))
if (lost.length > 0) console.warn(`Left the horde: ${lost.join(', ')}`)

const entry = ({ dex, name, types, stats, capture }) => ({ dex, name, types, stats, capture })
await writeFile(OUT, JSON.stringify(Object.fromEntries(found.map((s, i) => [ids[i], entry(s)])), null, 2) + '\n')
console.log(`Wrote ${found.length} species to ${OUT} (${found.filter((s) => !known.has(s.dex)).length} new)`)

const sheetless = [...national.values()].filter((s) => !drawn(tracker, s.dex))
const mythical = [...national.values()].filter((s) => s.kind === 'mythical').map((s) => s.dex)
await writeFile(NATIONAL, JSON.stringify({ last: NATIONAL_LAST, mythical, sheetless: Object.fromEntries(sheetless.map((s) => [s.dex, s.name])) }, null, 2) + '\n')
console.log(`Wrote ${sheetless.length} species still to be drawn to ${NATIONAL}`)
