import { range, weightedPick, type Rng } from '../engine/rng'
import { BIOMES, FIRST_WEATHER, WEATHER_IDS, WEATHER_SPELL, type BiomeId, type WeatherId } from '../data/biomes'
import { PLAYABLE } from '../data/hatchlings'
import type { PokeType } from '../data/types'
import { WEATHER, WEATHER_CHIP } from '../data/weather'
import type { HazardVisual } from '../data/bosses'
import { killEnemy } from './combat'
import { burst, floatText } from './effects'
import { inPlay } from './players'
import type { Game } from './types'

/**
 * Weather in play. `since` is the game time it started (`prev` fades out meanwhile);
 * it changes again at `next`. `chip` counts towards the next sandstorm/snow tick.
 */
export type WeatherState = { id: WeatherId; prev: WeatherId; since: number; next: number; chip: number }

export const createWeather = (): WeatherState => ({ id: 'clear', prev: 'clear', since: -Infinity, next: FIRST_WEATHER, chip: 0 })

/** Damage multiplier the weather gives an attack of one type (1 when it doesn't care). */
export const weatherBoost = (weather: WeatherId, type: PokeType) => WEATHER[weather].power?.[type] ?? 1

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
  judgment: ['normal'],
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

/** The weather where the player stands: a rift arena is outside it, so always clear skies. */
export const weatherHere = (g: Game): WeatherId => (g.rift.arena ? 'clear' : g.weather.id)

/** Starts a weather spell now (also the dev console's `ps.weather`). */
export const setWeather = (g: Game, id: WeatherId) => {
  const prev = g.weather.id
  g.weather = { id, prev, since: g.time, next: g.time + range(g.rng, WEATHER_SPELL.min, WEATHER_SPELL.max), chip: 0 }
  if (id !== prev) g.events.push({ kind: 'weather', weather: id, prev })
}

/** Sandstorm and snow wear: a slice of max HP every few seconds to everyone who isn't immune. */
const chip = (g: Game) => {
  const color = WEATHER[g.weather.id].color
  for (const p of g.players) {
    if (!inPlay(p) || !weatherChips(g.weather.id, PLAYABLE[p.starter].line[p.stage]!.types)) continue
    const floor = p.stats.maxHp * WEATHER_CHIP.playerFloor
    const dmg = Math.min(Math.round(p.stats.maxHp * WEATHER_CHIP.player) || 1, Math.floor(p.hp - floor))
    if (dmg > 0) {
      p.hp -= dmg
      floatText(g, p.x, p.y - 28, String(dmg), color, true)
    }
  }
  for (const e of g.enemies) {
    if (e.dying >= 0 || !weatherChips(g.weather.id, e.types)) continue
    // No damage numbers: on a full horde they'd bury the screen. A puff of weather says it instead.
    burst(g, e.x, e.y - e.radius, { colors: [color, '#ffffff'], count: 1, speed: 30, ttl: 0.3 })
    e.hp -= Math.max(1, Math.round(e.maxHp * (e.boss ? WEATHER_CHIP.boss : WEATHER_CHIP.enemy)))
    if (e.hp <= 0) killEnemy(g, e)
  }
}

/** Rolls a new spell when the current one runs out and applies the weather's wear. */
export const updateWeather = (g: Game, dt: number) => {
  const w = g.weather
  if (g.time >= w.next) setWeather(g, rollWeather(g.rng, g.biome.id, w.id))
  if (WEATHER[g.weather.id].chip === undefined) return
  g.weather.chip += dt
  if (g.weather.chip < WEATHER_CHIP.every) return
  g.weather.chip -= WEATHER_CHIP.every
  chip(g)
}
