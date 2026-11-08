import { describe, expect, it } from 'vitest'
import { guessLayout, printedOn } from './keyLayout'

const azerty = guessLayout('fr-FR')

describe('printedOn', () => {
  it('names AZERTY movement keys as printed', () => {
    expect(['KeyW', 'KeyA', 'KeyS', 'KeyD'].map((code) => printedOn(azerty, code) ?? code)).toEqual(['Z', 'Q', 'KeyS', 'KeyD'])
  })

  it('follows a layout the browser reports', () => {
    expect(printedOn(new Map([['KeyZ', 'y']]), 'KeyZ')).toBe('Y')
  })

  it('keeps the code name for what a label cannot show', () => {
    const layout = new Map([
      ['KeyA', 'ㄇ'],
      ['KeyB', 'ф'],
      ['BracketLeft', 'Dead'],
      ['Digit1', '&'],
    ])
    expect(['KeyA', 'KeyB', 'BracketLeft', 'Digit1'].map((code) => printedOn(layout, code))).toEqual([null, null, null, null])
  })

  it('drops accents from capitals', () => {
    expect(printedOn(new Map([['Quote', 'ù']]), 'Quote')).toBe('U')
  })
})

describe('guessLayout', () => {
  it('assumes AZERTY only where French keyboards are', () => {
    expect(['fr', 'fr-FR', 'fr-BE'].map((l) => printedOn(guessLayout(l), 'KeyW'))).toEqual(['Z', 'Z', 'Z'])
    expect(['fr-CA', 'fr-CH', 'en-US', 'pt-BR'].map((l) => printedOn(guessLayout(l), 'KeyW'))).toEqual([null, null, null, null])
  })
})
