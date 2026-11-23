import { describe, expect, it } from 'vitest'
import { hourAt, hourPay, nextHour, REALM_EVENTS, REALM_HOUR_MS } from './realmEvents'

const at = (iso: string) => Date.parse(iso)

describe('the Hora do Realm', () => {
  it('runs for its window and not outside it', () => {
    expect(hourAt(at('2026-11-10T12:00:00Z'))).not.toBeNull()
    expect(hourAt(at('2026-11-10T12:14:59Z'))).not.toBeNull()
    expect(hourAt(at('2026-11-10T12:15:00Z'))).toBeNull()
    expect(hourAt(at('2026-11-10T11:59:59Z'))).toBeNull()
  })

  it('says the next window, crossing midnight', () => {
    const late = nextHour(at('2026-11-10T22:00:00Z'))
    expect(late.start).toBe(at('2026-11-11T00:00:00Z'))
    expect(late.end - late.start).toBe(REALM_HOUR_MS)
    const running = nextHour(at('2026-11-10T20:05:00Z'))
    expect(running.start).toBe(at('2026-11-10T20:00:00Z'))
  })

  it('rotates the kinds, so the same hour changes from day to day', () => {
    const kinds = ['10', '11', '12'].map((d) => hourAt(at(`2026-11-${d}T12:00:00Z`))!.kind)
    expect(new Set(kinds).size).toBe(Object.keys(REALM_EVENTS).length)
  })

  it('pays double only for the running hour’s games', () => {
    const now = at('2026-11-10T12:05:00Z')
    const { kind } = hourAt(now)!
    const game = REALM_EVENTS[kind].games[0]!
    expect(hourPay(game, now)).toBe(2)
    expect(hourPay('fishing', at('2026-11-10T13:00:00Z'))).toBe(1)
  })
})
