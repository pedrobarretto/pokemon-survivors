import { describe, expect, it } from 'vitest'
import { BUG_REPORT, parseBugReport } from './bugReport'

describe('parseBugReport', () => {
  it('tidies the text and refuses one too short or too long', () => {
    expect(parseBugReport({ text: '  The game​   froze\r\n\r\n\r\n\r\nat 7:00  ' })?.text).toBe('The game froze\n\nat 7:00')
    expect(parseBugReport({ text: 'bug' })).toBeNull()
    expect(parseBugReport({ text: 'x'.repeat(BUG_REPORT.text.max + 1) })).toBeNull()
    expect(parseBugReport({ tech: {} })).toBeNull()
  })

  it('rebuilds the technical info: unknown fields dropped, strings clipped, odd numbers null', () => {
    const tech = parseBugReport({
      text: 'It closed by itself',
      tech: { userAgent: 'u'.repeat(1000), dpr: Infinity, memory: -4, cores: 8, save: { coins: 9e9 }, standalone: 'yes', run: { partner: 'pichu', time: 431.7, level: -2 } },
    })?.tech
    expect(tech).not.toHaveProperty('save')
    expect([...tech!.userAgent].length).toBe(400)
    expect(tech).toMatchObject({ dpr: 1, memory: null, cores: 8, standalone: false, run: { partner: 'pichu', time: 431, level: 0, form: '' } })
  })

  it('keeps the newest errors only, and drops ones without a message', () => {
    const errors = Array.from({ length: 8 }, (_, i) => ({ kind: 'rejection', message: `boom ${i}`, stack: 's'.repeat(5000) }))
    const tech = parseBugReport({ text: 'Errors everywhere', tech: { errors: [...errors, { message: '' }, 'nope'] } })!.tech!
    expect(tech.errors.map((e) => e.message)).toEqual(['boom 5', 'boom 6', 'boom 7'])
    expect(tech.errors[0]!.stack.length).toBe(BUG_REPORT.stack)
  })

  it('rebuilds the load figures of a run and the device, now and at a crash', () => {
    const perf = { canvases: 412.6, canvasMb: 38.456, peakCanvases: -3, peakCanvasMb: 'lots', frameMs: Infinity }
    const run = { projectiles: 1e9, wave: 'boss', boss: 'onix‮', place: 'rift:kyogre' }
    const tech = parseBugReport({ text: 'It closed by itself', tech: { perf, run, crash: { perf, run } } })!.tech!
    const parsed = { canvases: 412, canvasMb: 38.46, peakCanvases: 0, peakCanvasMb: 0, frameMs: null, wiped: 0, refused: 0 }
    expect(tech.perf).toEqual(parsed)
    expect(tech.crash?.perf).toEqual(parsed)
    expect(tech.run).toMatchObject({ projectiles: 100_000, wave: 'boss', boss: 'onix', place: 'rift:kyogre' })
    expect(parseBugReport({ text: 'Older client', tech: { crash: {} } })!.tech).toMatchObject({ perf: null, crash: { perf: null } })
  })

  it('drops a tech that is not an object', () => {
    expect(parseBugReport({ text: 'No tech here', tech: 'lots' })).toEqual({ text: 'No tech here', tech: null })
  })
})
