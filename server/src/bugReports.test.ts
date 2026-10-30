import { describe, expect, it } from 'vitest'
import { parseBugReport } from '../../src/game/bugReport'
import { bugThread, deviceHint } from './bugReports'

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; 23049PCD8G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'

describe('deviceHint', () => {
  it('names the system and the browser', () => {
    expect(deviceHint(ANDROID)).toBe('Android · Chrome')
    expect(deviceHint('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari')
    expect(deviceHint('')).toBe('unknown device')
  })
})

describe('bugThread', () => {
  const report = (text: string, tech: unknown = { userAgent: ANDROID }) => parseBugReport({ text, tech })!

  it('titles the thread by the first line and the device, and tags it', () => {
    const t = bugThread(report('Closes by itself\nevery run, around minute 7', { userAgent: ANDROID, crash: { at: 'x' } }), 'a guest')
    expect(t.name).toBe('💥 Closes by itself · Android · Chrome')
    expect(t.tags).toEqual(['Open', 'Mobile', 'Crash'])
    expect(t.messages[0]).toContain('> every run, around minute 7')
  })

  it('keeps every message under Discord’s limit and code blocks closed, whatever the player typed', () => {
    const text = `@everyone \`\`\` ${'long words\n'.repeat(85)}`
    const t = bugThread(report(text, { userAgent: ANDROID, errors: [{ message: '```'.repeat(200), stack: 'at x\n'.repeat(400) }] }), '@ash')
    for (const m of t.messages) {
      expect(m.length).toBeLessThanOrEqual(2000)
      expect((m.match(/```/g) ?? []).length % 2).toBe(0)
    }
    expect(t.messages).toHaveLength(2)
    expect(t.name.length).toBeLessThanOrEqual(100)
  })

  it('shows the load at the crash: canvas memory, frame pace and what was on the field', () => {
    const perf = { canvases: 412, canvasMb: 38.5, peakCanvases: 530, peakCanvasMb: 51.2, frameMs: 17.1 }
    const run = { partner: 'pichu', enemies: 240, projectiles: 85, wave: 'boss', boss: 'onix', place: '' }
    const t = bugThread(report('Closed in the boss fight', { userAgent: ANDROID, perf, crash: { at: 'x', run, perf } }), 'a guest')
    expect(t.messages[0]).toContain('canvas: 412 (38.5 MB, peak 51.2 MB / 530) · frame 17.1 ms')
    expect(t.messages[0]).toContain('240 enemies · 85 projectiles · wave boss · boss onix')
    expect(t.messages[0]).toContain('  then canvas: 412')
    const wiped = bugThread(report('Screen went black', { userAgent: ANDROID, perf: { ...perf, wiped: 2, refused: 0 } }), 'a guest')
    expect(wiped.messages[0]).toContain('frame 17.1 ms · wiped 2×')
    expect(wiped.messages[0]).not.toContain('refused')
  })

  it('says what the player plays with, pads included, and nothing for clients older than the field', () => {
    const pad = bugThread(report('Keeps walking', { userAgent: ANDROID, input: { last: 'keyboard', pads: ['Xbox Wireless Controller'] } }), 'a guest')
    expect(pad.messages[0]).toContain('input: keyboard (Xbox Wireless Controller)')
    expect(bugThread(report('Keeps walking'), 'a guest').messages[0]).not.toContain('input:')
  })

  it('moves the technical info to a message of its own rather than cut the player’s words', () => {
    const run = { partner: 'p'.repeat(40), form: 'f'.repeat(40), boss: 'b'.repeat(40), place: 'q'.repeat(40) }
    const tech = { userAgent: ANDROID.repeat(3), view: 'v'.repeat(60), perf: {}, run, crash: { at: 'x', run, perf: {} } }
    const t = bugThread(report('x'.repeat(1000), tech), 'a guest')
    expect(t.messages[0]).toContain('x'.repeat(999))
    expect(t.messages[1]).toMatch(/^```\nversion:/)
  })

  it('says when the report came without technical info', () => {
    const t = bugThread(report('Something broke', null), 'a guest')
    expect(t.tags).toEqual(['Open'])
    expect(t.messages).toEqual([expect.stringContaining('without technical info')])
  })
})
