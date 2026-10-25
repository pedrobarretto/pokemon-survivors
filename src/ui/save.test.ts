import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, parseSettings } from './save'

describe('parseSettings', () => {
  it('uses the defaults when nothing is stored or the JSON is broken', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('{oops')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('[1,2]')).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid fields and replaces only the bad ones', () => {
    const stored = JSON.stringify({ musicVolume: 0.3, sfxVolume: 'loud', damageNumbers: false, screenShake: 0 })
    expect(parseSettings(stored)).toEqual({ ...DEFAULT_SETTINGS, musicVolume: 0.3, damageNumbers: 'off' })
  })

  it('reads the damage numbers mode, and maps the old on/off flag to reduced/off', () => {
    expect(parseSettings(JSON.stringify({ damageNumbers: 'all' })).damageNumbers).toBe('all')
    expect(parseSettings(JSON.stringify({ damageNumbers: true })).damageNumbers).toBe('reduced')
    expect(parseSettings(JSON.stringify({ damageNumbers: 'lots' })).damageNumbers).toBe(DEFAULT_SETTINGS.damageNumbers)
  })

  it('reads the joystick mode, floating unless it says fixed', () => {
    expect(parseSettings(JSON.stringify({ joystick: 'fixed' })).joystick).toBe('fixed')
    expect(parseSettings(JSON.stringify({ joystick: 'left' })).joystick).toBe('floating')
  })

  it('reads the flashes mode, normal unless it says reduced', () => {
    expect(parseSettings(JSON.stringify({ flashes: 'reduced' })).flashes).toBe('reduced')
    expect(parseSettings(JSON.stringify({ flashes: false })).flashes).toBe('normal')
  })

  it('reads the mini map mode, square unless it says round or off', () => {
    expect(parseSettings(JSON.stringify({ minimap: 'round' })).minimap).toBe('round')
    expect(parseSettings(JSON.stringify({ minimap: 'off' })).minimap).toBe('off')
    expect(parseSettings(JSON.stringify({ minimap: true })).minimap).toBe('square')
  })

  it('clamps volumes to 0..1', () => {
    expect(parseSettings(JSON.stringify({ musicVolume: 4, sfxVolume: -1 }))).toMatchObject({ musicVolume: 1, sfxVolume: 0 })
  })

  it('clamps move opacities to 0.1..1, so a move never vanishes outright', () => {
    expect(parseSettings(JSON.stringify({ attackOpacity: 0, teamAttackOpacity: 3 }))).toMatchObject({ attackOpacity: 0.1, teamAttackOpacity: 1 })
    expect(parseSettings(JSON.stringify({ attackOpacity: 'faint' })).attackOpacity).toBe(1)
  })

  it('falls back to the given defaults (the legacy mute flag)', () => {
    expect(parseSettings(null, { ...DEFAULT_SETTINGS, muted: true }).muted).toBe(true)
    expect(parseSettings(JSON.stringify({ muted: false }), { ...DEFAULT_SETTINGS, muted: true }).muted).toBe(false)
  })
})
