// PokeAPI's data as its CSV dumps (github.com/PokeAPI/pokeapi, data/v2/csv): one download per
// table instead of two REST calls per species, shared by the roster and the National Dex scripts.

const CSV = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv'

/** The last species of the National Dex. */
export const NATIONAL_LAST = 1025

/** English, in `pokemon_species_names.csv`. */
const ENGLISH = '9'

const STAT_KEYS = { hp: 'hp', attack: 'attack', defense: 'defense', 'special-attack': 'spAttack', 'special-defense': 'spDefense', speed: 'speed' }

/** Ultra Beasts, which PokeAPI doesn't flag as legendary: Nihilego to Blacephalon. */
export const ULTRA_BEASTS = [793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806]
/** Paradox Pokémon: the ancient and future ones of Paldea, Kitakami and Area Zero. */
export const PARADOX = [984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995, 1005, 1006, 1007, 1008, 1009, 1010, 1020, 1021, 1022, 1023]

/** Rows of a CSV as objects keyed by its header (quoted fields may hold commas). */
const parseCsv = (text) => {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') row.push(field), (field = '')
    else if (c === '\n') row.push(field.replace(/\r$/, '')), rows.push(row), (row = []), (field = '')
    else field += c
  }
  if (field || row.length) row.push(field), rows.push(row)
  const [head, ...body] = rows
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((k, i) => [k, r[i] ?? ''])))
}

const csv = async (table) => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${CSV}/${table}.csv`).catch((error) => ({ ok: false, status: error.message }))
    if (res.ok) return parseCsv(await res.text())
    if (attempt >= 4) throw new Error(`${res.status} ${table}.csv`)
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
  }
}

/**
 * Every species of the National Dex by number: its English name, types (the
 * default form's, newest generation), base stats, capture rate and what kind
 * of species it is (`legendary`, `mythical`, `ultraBeast`, `paradox` or `regular`).
 */
export const nationalSpecies = async () => {
  const [species, names, types, typeNames, stats, statNames] = await Promise.all(
    ['pokemon_species', 'pokemon_species_names', 'pokemon_types', 'types', 'pokemon_stats', 'stats'].map(csv),
  )
  const typeOf = new Map(typeNames.map((t) => [t.id, t.identifier]))
  const statOf = new Map(statNames.map((s) => [s.id, STAT_KEYS[s.identifier]]))
  const english = new Map(names.filter((n) => n.local_language_id === ENGLISH).map((n) => [Number(n.pokemon_species_id), n.name]))
  const typesOf = new Map()
  for (const t of [...types].sort((a, b) => Number(a.slot) - Number(b.slot))) {
    const id = Number(t.pokemon_id)
    typesOf.set(id, [...(typesOf.get(id) ?? []), typeOf.get(t.type_id)])
  }
  const statsOf = new Map()
  for (const s of stats) {
    const key = statOf.get(s.stat_id)
    if (!key) continue
    const id = Number(s.pokemon_id)
    statsOf.set(id, { ...statsOf.get(id), [key]: Number(s.base_stat) })
  }
  const kindOf = (s, dex) =>
    s.is_mythical === '1' ? 'mythical' : s.is_legendary === '1' ? 'legendary' : ULTRA_BEASTS.includes(dex) ? 'ultraBeast' : PARADOX.includes(dex) ? 'paradox' : 'regular'
  return new Map(
    species
      .map((s) => Number(s.id))
      .filter((dex) => dex >= 1 && dex <= NATIONAL_LAST)
      .sort((a, b) => a - b)
      .map((dex) => {
        const s = species.find((row) => Number(row.id) === dex)
        const { hp, attack, defense, spAttack, spDefense, speed } = statsOf.get(dex)
        return [
          dex,
          {
            dex,
            name: english.get(dex) ?? s.identifier,
            types: typesOf.get(dex),
            stats: { hp, attack, defense, spAttack, spDefense, speed },
            capture: Number(s.capture_rate),
            kind: kindOf(s, dex),
          },
        ]
      }),
  )
}
