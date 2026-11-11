import { isTeraType, RAID_BOSSES, type RaidBoss, type RaidStars, type TeraType } from './data/tera'
import { POKE_TYPES } from './data/types'
import { brasiliaDay, isDayKey } from './game/day'
import { localPlayer } from './game/players'
import { dropBossShards } from './game/tera'
import { enterRaid, openDen, raidOfDay } from './game/teraRaid'
import type { Game } from './game/types'

/**
 * Dev: `ps.tera(...)` (documented atop `devTera` in `main.ts`). Writes the
 * running game directly: never in a ranked run's path (a dev build only).
 */
export const devTera = async (g: Game | undefined, press: () => void, cmd?: string, a?: unknown, b?: unknown, c?: unknown) => {
  if (cmd === 'lab') {
    const { openTeraLab } = await import('./teraLab')
    return openTeraLab((a ?? {}) as Parameters<typeof openTeraLab>[0])
  }
  if (cmd === 'day') {
    const day = isDayKey(a) ? a : brasiliaDay(new Date())
    return { day, ...raidOfDay(day) }
  }
  if (!g) return 'Start a run first: ps.startRun(\'charmander\')'
  const p = localPlayer(g)
  const s = p.tera
  if (isTeraType(cmd)) {
    s.type = cmd
    s.orb = 1
    return s
  }
  switch (cmd) {
    case 'now': {
      s.type = isTeraType(a) ? a : (s.type ?? 'water')
      s.orb = 1
      press()
      return s
    }
    case 'orb':
      s.orb = typeof a === 'number' ? Math.max(0, Math.min(1, a)) : 1
      return s
    case 'shards':
      return dropBossShards(g, p.x + 40, p.y, POKE_TYPES[Math.floor(Math.random() * POKE_TYPES.length)]!)
    case 'raid':
    case 'enter': {
      const boss = (RAID_BOSSES as readonly string[]).includes(String(a)) || a === 'terapagos' ? (a as RaidBoss) : null
      const day = raidOfDay(brasiliaDay(new Date()))
      const raid = boss ? { boss, tera: isTeraType(b) ? (b as TeraType) : day.tera, stars: (typeof c === 'number' && c >= 3 && c <= 7 ? c : day.stars) as RaidStars } : day
      g.raid.den = null
      const den = openDen(g, raid, { x: Math.round(p.x + 60), y: Math.round(p.y) })
      if (cmd === 'enter') {
        g.raid.den = null
        enterRaid(g, den)
      }
      return den
    }
    case 'shield': {
      const arena = g.raid.arena
      if (!arena) return 'Not in a raid'
      arena.shield.hp = 0.1
      return arena.shield
    }
  }
  return s
}
