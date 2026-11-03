import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { BIOME_IDS, BIOMES } from '../data/biomes'
import { rollWeather, weatherBoost, weatherChips, weatherFits, weatherPower } from './weather'

describe('weather damage multiplier', () => {
  it('sun boosts Fire and weakens Water; rain does the opposite', () => {
    expect(weatherBoost('sun', 'fire')).toBe(1.5)
    expect(weatherBoost('sun', 'water')).toBe(0.75)
    expect(weatherBoost('rain', 'water')).toBe(1.5)
    expect(weatherBoost('rain', 'fire')).toBe(0.75)
  })

  it('leaves other types and calm weather alone', () => {
    expect(weatherBoost('sun', 'grass')).toBe(1)
    expect(weatherBoost('clear', 'fire')).toBe(1)
    expect(weatherBoost('sand', 'water')).toBe(1)
    expect(weatherPower('rain', [])).toBe(1)
  })

  it('counts every type of a dual-typed attacker', () => {
    expect(weatherPower('sun', ['fire', 'flying'])).toBe(1.5)
  })
})

describe('weatherChips', () => {
  it('sandstorm spares Rock, Ground and Steel', () => {
    expect(weatherChips('sand', ['fire'])).toBe(true)
    expect(weatherChips('sand', ['rock', 'ground'])).toBe(false)
    expect(weatherChips('sand', ['bug', 'steel'])).toBe(false)
  })

  it('snow spares only Ice', () => {
    expect(weatherChips('snow', ['water'])).toBe(true)
    expect(weatherChips('snow', ['ice', 'flying'])).toBe(false)
  })

  it('other weather never wears anyone down', () => {
    expect(weatherChips('sun', ['grass'])).toBe(false)
    expect(weatherChips('fog', ['normal'])).toBe(false)
  })
})

describe('rollWeather', () => {
  it('only rolls weather the biome allows, and never the current one', () => {
    const rng = createRng(7)
    for (const biome of BIOME_IDS) {
      for (let i = 0; i < 200; i++) {
        const next = rollWeather(rng, biome, 'clear')
        expect(next).not.toBe('clear')
        expect(weatherFits(biome, next), `${biome}: ${next}`).toBe(true)
      }
    }
  })

  it('every weather can happen somewhere', () => {
    const possible = new Set(Object.values(BIOMES).flatMap((b) => Object.keys(b.weather)))
    for (const id of ['sun', 'rain', 'sand', 'snow', 'fog']) expect(possible.has(id), id).toBe(true)
  })
})
