import { describe, expect, it } from 'vitest'
import { cpuBetween, parseProcStat } from '../src/hostCpu'

const stat = (cpu: string) => `${cpu}\ncpu0 1 2 3 4 5 6 7 8 0 0\nintr 123\n`

describe('host cpu', () => {
  it('reads the aggregate line, idle with iowait', () => {
    expect(parseProcStat(stat('cpu  100 0 50 800 20 0 10 20 0 0'))).toEqual({ total: 1000, idle: 820, iowait: 20, steal: 20 })
    expect(parseProcStat('intr 1')).toBeNull()
  })

  it('splits the time between two readings', () => {
    const a = parseProcStat(stat('cpu  100 0 50 800 20 0 10 20 0 0'))!
    const b = parseProcStat(stat('cpu  400 0 150 1200 40 0 10 200 0 0'))!
    // 1000 jiffies: 420 idle (400 + 20 iowait), 180 steal.
    expect(cpuBetween(a, b)).toEqual({ busyPct: 58, stealPct: 18, iowaitPct: 2 })
    expect(cpuBetween(b, b)).toBeNull()
  })
})
