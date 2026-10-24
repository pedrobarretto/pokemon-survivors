/**
 * The whole machine's CPU, from `/proc/stat` (not namespaced: a container
 * reads the host's): how busy every core was between two readings, how much
 * of it went to other virtual machines on the same host (steal) and to disk
 * waits. The relay shares its VPS with other apps, and its frame timers are
 * only as punctual as the cores they get, so `relay.stats` logs it beside the
 * event loop's lateness.
 */

/** The aggregate `cpu` line's jiffies: everything, idle (with iowait), iowait and steal. */
export type CpuTimes = { total: number; idle: number; iowait: number; steal: number }

/** The `cpu` line of `/proc/stat` (user nice system idle iowait irq softirq steal …), or null when there isn't one. */
export const parseProcStat = (text: string): CpuTimes | null => {
  const line = /^cpu\s+(.+)$/m.exec(text)?.[1]
  if (!line) return null
  const v = line.trim().split(/\s+/).map(Number)
  if (v.length < 8 || v.some((n) => !Number.isFinite(n))) return null
  // guest and guest_nice (9th, 10th) are already counted in user and nice.
  const [user, nice, system, idle, iowait, irq, softirq, steal] = v as [number, number, number, number, number, number, number, number]
  return { total: user + nice + system + idle + iowait + irq + softirq + steal, idle: idle + iowait, iowait, steal }
}

/** Shares of the time between `a` and `b` (%, a tenth): busy (steal included), steal and iowait. Null without time between them. */
export const cpuBetween = (a: CpuTimes, b: CpuTimes) => {
  const dt = b.total - a.total
  if (dt <= 0) return null
  const pct = (v: number) => Math.round((v / dt) * 1000) / 10
  return { busyPct: pct(dt - (b.idle - a.idle)), stealPct: pct(b.steal - a.steal), iowaitPct: pct(b.iowait - a.iowait) }
}
