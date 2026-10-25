import { range, weightedPick, type Rng } from '../engine/rng'
import { BIOMES, FIRST_WEATHER, WEATHER_IDS, WEATHER_SPELL, type BiomeId, type WeatherId } from '../data/biomes'
import type { PokeType } from '../data/types'
import { WEATHER, WEATHER_CHIP } from '../data/weather'
import { domainOf } from '../data/domains'
import type { HazardVisual } from '../data/bosses'
import { abilityImmune } from './abilities'
import { playerForm } from './branch'
import { killEnemy } from './combat'
import { burst, floatText } from './effects'
import type { Game } from './types'
import { roomOf } from './room'
import * as dm from '../engine/dmath'

/**
 * Weather in play. `since` is the game time it started (`prev` fades out meanwhile);
 * it changes again at `next`. `chip` counts towards the next sandstorm/snow tick.
 * `held`: a move called this spell (Rain Dance, Sunny Day) over the scheduled
 * one, which waits with the seconds it had left and comes back when the call ends.
 */
export type WeatherState = { id: WeatherId; prev: WeatherId; since: number; next: number; chip: number; held: { id: WeatherId; left: number } | null }

export const createWeather = (): WeatherState => ({ id: 'clear', prev: 'clear', since: -Infinity, next: FIRST_WEATHER, chip: 0, held: null })

/** Damage multiplier the weather gives an attack of one type (1 when it doesn't care). */
export const weatherBoost = (weather: WeatherId, type: PokeType) => WEATHER[weather].power?.[type] ?? 1

/** The weather's edge on the player's attacks: whole, or the share a legendary's domain leaves it (`LegendDomain.weatherShare`). */
export const playerWeatherBoost = (g: Game, type: PokeType) => {
  const boost = weatherBoost(weatherHere(g), type)
  const legend = g.rift.arena?.domain?.legend
  const share = (legend && domainOf(legend)?.weatherShare) ?? 1
  return 1 + (boost - 1) * share
}

/** Same for an attacker of several types (an enemy body hits with all of its types). */
export const weatherPower = (weather: WeatherId, types: readonly PokeType[]) =>
  types.reduce((m, type) => m * weatherBoost(weather, type), 1)

/** True when the weather wears down a Pokémon of these types (sandstorm and snow spare their own types). */
export const weatherChips = (weather: WeatherId, types: readonly PokeType[]) => {
  const chip = WEATHER[weather].chip
  return chip !== undefined && !types.some((type) => chip.immune.includes(type))
}

/** The typing of a boss hazard, so the weather can boost or weaken it like any attack. */
export const HAZARD_TYPES: Record<HazardVisual, readonly PokeType[]> = {
  rock: ['rock'],
  slam: ['normal'],
  thunder: ['electric'],
  ice: ['ice'],
  fire: ['fire'],
  psychic: ['psychic'],
  water: ['water'],
  dragon: ['dragon'],
  steel: ['steel'],
  aero: ['flying'],
  grass: ['grass'],
  shadow: ['ghost'],
  judgment: ['normal'],
  poison: ['poison'],
  // The horde's spit (`spitters.ts`).
  fireball: ['fire'],
  bubble: ['water'],
  sludge: ['poison'],
  spark: ['electric'],
  seed: ['grass'],
  orb: ['normal'],
  // The Eon duo's Mist Ball and Luster Purge.
  mist: ['psychic'],
  luster: ['psychic'],
}

/** Rolls the next weather spell from the biome's odds, never repeating `current`. */
export const rollWeather = (rng: Rng, biome: BiomeId, current: WeatherId): WeatherId => {
  const odds: Partial<Record<WeatherId, number>> = BIOMES[biome].weather
  const entries = WEATHER_IDS.flatMap((id) => (id !== current && (odds[id] ?? 0) > 0 ? [[id, odds[id]!] as const] : []))
  return entries.length > 0 ? weightedPick(rng, entries) : 'clear'
}

/** Can this weather happen in the biome? */
export const weatherFits = (biome: BiomeId, weather: WeatherId) => {
  const odds: Partial<Record<WeatherId, number>> = BIOMES[biome].weather
  return weather === 'clear' || (odds[weather] ?? 0) > 0
}

/** The weather where the player stands: a room is outside it, under clear skies or its own (a legendary's domain). */
export const weatherHere = (g: Game): WeatherId => {
  const room = roomOf(g)
  return room ? (room.weather ?? 'clear') : g.weather.id
}

/** Starts a weather spell now (also the dev console's `ps.weather`). It drops a move's call: the schedule takes over again. */
export const setWeather = (g: Game, id: WeatherId) => {
  const prev = g.weather.id
  g.weather = { id, prev, since: g.time, next: g.time + range(g.rng, WEATHER_SPELL.min, WEATHER_SPELL.max), chip: 0, held: null }
  if (id !== prev) g.events.push({ kind: 'weather', weather: id, prev })
}

/**
 * The sky after a move calls `id` for `seconds` at `time` (pure). The
 * scheduled spell waits in `held` with the time it had left (a spell that was
 * `id` already gives way to a fresh roll after the call). Calling again
 * extends the call; another move's call keeps what the first one interrupted.
 * Null when the sky can't be called: an omen holds it (`next` is Infinity).
 */
export const calledWeather = (w: WeatherState, id: WeatherId, seconds: number, time: number): WeatherState | null => {
  if (w.next === Infinity) return null
  const held = w.held ?? { id: w.id, left: w.id === id ? 0 : Math.max(0, w.next - time) }
  const same = w.id === id
  return { id, prev: same ? w.prev : w.id, since: same ? w.since : time, next: same && w.held ? Math.max(w.next, time + seconds) : time + seconds, chip: same ? w.chip : 0, held }
}

/** When a move's call ends at `time`: the weather it held comes back for the time it had left, if it still fits the biome (`fits`). Null: roll a new one. */
export const releasedWeather = (w: WeatherState, time: number, fits: (id: WeatherId) => boolean): WeatherState | null => {
  const held = w.held
  if (!held || held.left <= 0 || !fits(held.id)) return null
  const same = held.id === w.id
  return { id: held.id, prev: same ? w.prev : w.id, since: same ? w.since : time, next: time + held.left, chip: same ? w.chip : 0, held: null }
}

/**
 * A move calls `id` for `seconds` (Rain Dance, Sunny Day). The weather lives
 * outside, so a room (a rift arena, a place) keeps its own; an omen's sky
 * holds. True when the call took.
 */
export const callWeather = (g: Game, id: WeatherId, seconds: number) => {
  if (roomOf(g)) return false
  const called = calledWeather(g.weather, id, seconds, g.time)
  if (!called) return false
  const prev = g.weather.id
  g.weather = called
  if (id !== prev) g.events.push({ kind: 'weather', weather: id, prev })
  return true
}

/** The weather's wear on the acting player, unless they're immune; it never takes them under `WEATHER_CHIP.playerFloor`. */
const chipPlayer = (g: Game, color: string) => {
  const p = g.player
  if (!weatherChips(g.weather.id, playerForm(g).types) || abilityImmune(g, 'chip')) return
  const floor = p.stats.maxHp * WEATHER_CHIP.playerFloor
  const dmg = Math.min(dm.round(p.stats.maxHp * WEATHER_CHIP.player) || 1, Math.floor(p.hp - floor))
  if (dmg > 0) {
    p.hp -= dmg
    floatText(g, p.x, p.y - 28, String(dmg), color, true)
  }
}

/** Sandstorm and snow wear: a slice of max HP every few seconds to everyone who isn't immune (by type, or by ability: Sand Veil, Magic Guard). */
const chip = (g: Game) => {
  const color = WEATHER[g.weather.id].color
  const before = g.player
  for (const p of g.players) {
    g.player = p
    chipPlayer(g, color)
  }
  g.player = before
  for (const e of g.enemies) {
    if (e.dying >= 0 || !weatherChips(g.weather.id, e.types)) continue
    // No damage numbers: on a full horde they'd bury the screen. A puff of weather says it instead.
    burst(g, e.x, e.y - e.radius, { colors: [color, '#ffffff'], count: 1, speed: 30, ttl: 0.3 })
    e.hp -= Math.max(1, dm.round(e.maxHp * (e.boss ? WEATHER_CHIP.boss : WEATHER_CHIP.enemy)))
    if (e.hp <= 0) killEnemy(g, e)
  }
}

/** Rolls a new spell when the current one runs out and applies the weather's wear. */
export const updateWeather = (g: Game, dt: number) => {
  const w = g.weather
  if (g.time >= w.next) {
    // A move's call ends: the spell it held comes back, else the schedule rolls.
    const back = w.held && releasedWeather(w, g.time, (id) => weatherFits(g.biome.id, id))
    if (back) {
      g.weather = back
      if (back.id !== w.id) g.events.push({ kind: 'weather', weather: back.id, prev: w.id })
    } else setWeather(g, rollWeather(g.rng, g.biome.id, w.id))
  }
  if (WEATHER[g.weather.id].chip === undefined) return
  g.weather.chip += dt
  if (g.weather.chip < WEATHER_CHIP.every) return
  g.weather.chip -= WEATHER_CHIP.every
  chip(g)
}
