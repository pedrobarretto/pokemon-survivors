import { readFileSync } from 'node:fs'
import { loadavg } from 'node:os'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import { configFrom } from './config'
import { cpuBetween, parseProcStat } from './hostCpu'
import { jsonLog, startRelay } from './server'

/**
 * A VPS relay's process (the container Dokploy runs). SIGTERM (a deploy,
 * `docker stop`) stops it gracefully: players are told to reconnect at once
 * and resume, and the new container takes over. An uncaught error ends the
 * process and Docker restarts it; either way the rooms come back from the
 * `/data` volume.
 */

/** How often a `relay.stats` line goes to the logs. */
const STATS_MS = 60_000

const relay = await startRelay(configFrom(process.env))

// The event loop's lateness is the frame timers' lateness: the number to watch on a shared VPS.
const loop = monitorEventLoopDelay({ resolution: 5 })
loop.enable()
const readHost = () => {
  try {
    return parseProcStat(readFileSync('/proc/stat', 'utf8'))
  } catch {
    return null
  }
}

let cpu = process.cpuUsage()
let host = readHost()
const stats = setInterval(() => {
  const used = process.cpuUsage(cpu)
  cpu = process.cpuUsage()
  const was = host
  host = readHost()
  const machine = was && host ? cpuBetween(was, host) : null
  const loopP99Ms = +(loop.percentile(99) / 1e6).toFixed(2)
  // This minute's load decides whether the relay takes new rooms until the next one (`capacity.ts`).
  relay.setLoad({ loopP99Ms, hostBusyPct: machine?.busyPct ?? null })
  jsonLog('relay.stats', {
    ...relay.counts(),
    full: relay.full(),
    loopP50Ms: +(loop.percentile(50) / 1e6).toFixed(2),
    loopP99Ms,
    loopMaxMs: +(loop.max / 1e6).toFixed(2),
    cpuPct: +(((used.user + used.system) / 1000 / STATS_MS) * 100).toFixed(1),
    rssMb: Math.round(process.memoryUsage().rss / 1e6),
    // The whole VPS (every core, other apps too): the frame timers starve when it's full.
    hostBusyPct: machine?.busyPct ?? null,
    hostStealPct: machine?.stealPct ?? null,
    hostIowaitPct: machine?.iowaitPct ?? null,
    load1: +loadavg()[0]!.toFixed(2),
  })
  loop.reset()
}, STATS_MS)

let stopping = false
const stop = (signal: string) => {
  if (stopping) return
  stopping = true
  jsonLog('relay.stopping', { signal })
  clearInterval(stats)
  void relay.close().finally(() => process.exit(0))
}
process.on('SIGTERM', () => stop('SIGTERM'))
process.on('SIGINT', () => stop('SIGINT'))
process.on('uncaughtException', (err) => {
  jsonLog('relay.crash', { error: err.stack ?? err.message })
  process.exit(1)
})
