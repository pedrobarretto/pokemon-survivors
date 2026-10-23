import { describe, expect, it } from 'vitest'
import { androidMajor, parseCrumb, toMb, type Crumb } from './crumb'

describe('toMb', () => {
  it('rounds bytes to a tenth of a MB', () => {
    expect(toMb(0)).toBe(0)
    expect(toMb(512 * 512 * 4)).toBe(1)
    expect(toMb(1_100_000)).toBe(1)
    expect(toMb(1_200_000)).toBe(1.1)
  })
})

describe('parseCrumb', () => {
  const crumb: Crumb = {
    sheetMb: 41.3,
    peakSheetMb: 58.9,
    sheets: 37,
    canvasMb: 22.4,
    peakCanvasMb: 30.1,
    canvases: 312,
    peakCanvases: 401,
    quality: 'lean',
    moment: 'boss',
    momentAt: 300,
  }

  it('reads back what the watch stored', () => {
    expect(parseCrumb(JSON.parse(JSON.stringify(crumb)))).toEqual(crumb)
  })

  it('makes do with an old or tampered one', () => {
    expect(parseCrumb(null)).toBeNull()
    expect(parseCrumb('boss')).toBeNull()
    expect(parseCrumb({ sheetMb: -4, canvases: 'many', quality: 'ultra', moment: 'dance', momentAt: 12 })).toEqual({
      sheetMb: 0,
      peakSheetMb: 0,
      sheets: 0,
      canvasMb: 0,
      peakCanvasMb: 0,
      canvases: 0,
      peakCanvases: 0,
      quality: 'full',
      moment: null,
      momentAt: null,
    })
  })
})

describe('androidMajor', () => {
  it("takes Android's major version from Client Hints", () => {
    expect(androidMajor('Android', '14.0.0')).toBe(14)
    expect(androidMajor('Android', '')).toBeNull()
  })

  it('is null off Android', () => {
    expect(androidMajor('Windows', '15.0.0')).toBeNull()
    expect(androidMajor(undefined, undefined)).toBeNull()
  })
})
