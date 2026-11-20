import type { EnemyId } from '../data/enemies'
import type { RiftLegend } from '../data/rifts'
import { bossWaveAt, EVENTS, RUN_LENGTH, TRIO_IDS, TRIOS, type TrioId } from '../data/waves'
import { startEndless } from './endless'
import { pickLegend } from './rift'
import { teamLegendIds } from './legend'
import { domainOf } from '../data/domains'
import { enterDomain, jumpToAct } from './domain'
import { enterArena } from './riftArena'
import { openPortal, startOmen } from './riftPortal'
import { withTrio } from './roster'
import { spawnWaveBoss } from './spawner'
import type { Game } from './types'
import { phasesOf } from './bossFight'
import { killEnemy } from './combat'

/**
 * Dev-console shortcuts for staging bosses, rifts and the endless mode
 * (`ps.trio()`, `ps.boss()`, `ps.bossHp()`, `ps.ult()`, `ps.defeat()`, `ps.rift()`, `ps.omen()`, `ps.riftAct()`, `ps.portal()`, `ps.victory()`, `ps.endless()`, `ps.reaper()`).
 * Wired in `main.ts` for dev builds only.
 */
export const riftDevTools = (game: () => Game | undefined) => {
  const playing = (fn: (g: Game) => void) => () => {
    const g = game()
    if (g) fn(g)
  }
  /** Skips the regular timeline to `minute`, past every wave event (Mewtwo included). */
  const skipTo = (g: Game, minute: number) => {
    g.time = minute * 60
    g.nextEvent = EVENTS.length
  }
  return {
    /** Swaps the run's legendary trio for the upcoming trio slots (`ps.trio('beasts')`); returns its members. */
    trio: (id: TrioId) => {
      const g = game()
      if (!g || !TRIO_IDS.includes(id)) return `Trios: ${TRIO_IDS.join(', ')}`
      g.roster = withTrio(g.roster, id)
      return TRIOS[id]
    },
    /** Brings a boss in now, with its wave entrance (`ps.boss('entei')`); an earlier wave's boss flees as it would. */
    boss: (enemy: EnemyId) => playing((g) => spawnWaveBoss(g, enemy, bossWaveAt(enemy) ?? g.time))(),
    /** Sets the boss with the HP bar to `share` of its HP (`ps.bossHp(0.35)`): its enrage and later phases unlock at once. */
    bossHp: (share: number) =>
      playing((g) => {
        const boss = g.enemies.find((e) => e.id === g.bossId)
        if (boss) boss.hp = Math.max(1, boss.maxHp * share)
      })(),
    /** Brings the HP bar boss's ultimate now (`ps.ult()`), at the top of its current phase's. */
    ult: playing((g) => {
      const fight = g.enemies.find((e) => e.id === g.bossId)?.fight
      if (fight && !fight.ult) fight.ultLeft = 0
    }),
    /** Knocks out the boss with the HP bar (`ps.defeat()`): past its phases, so a wave legendary's capture plays. */
    defeat: playing((g) => {
      const boss = g.enemies.find((e) => e.id === g.bossId)
      if (!boss) return
      const phases = phasesOf(boss.kind)
      if (boss.fight && phases) Object.assign(boss.fight, { phase: phases.length - 1, shift: 0 })
      killEnemy(g, boss)
    }),
    /** Steps straight into a rift (a random legendary, or the one given): a domain's crossing, or the old arena. */
    rift: (legend?: RiftLegend) =>
      playing((g) => {
        const id = legend ?? pickLegend(g.rng, g.rift.met, teamLegendIds(g))
        if (domainOf(id)) enterDomain(g, id, g.player.x, g.player.y)
        else enterArena(g, id, g.player.x, g.player.y)
      })(),
    /** Starts a rift's omen now (its weather, then its portal 20 s later). */
    omen: (legend?: RiftLegend) => playing((g) => startOmen(g, legend))(),
    /** In a domain, jumps to an act: `ps.riftAct('encounter')`, `ps.riftAct('battle', 2)` for the top of phase 2, or `ps.riftAct('capture')`. */
    riftAct: (act: 'encounter' | 'battle' | 'capture', phase?: number) => playing((g) => jumpToAct(g, act, phase))(),
    /** In a pair's battle (Latias and Latios), knocks one out now (`ps.knockOut('latios')`; Latias without an argument): the other enrages and counts down to its revival. */
    knockOut: (who?: EnemyId) =>
      playing((g) => {
        const e = g.enemies.find((k) => k.fight && k.fight.link >= 0 && (who === undefined || k.kind === who))
        if (e) e.hp = 1
      })(),
    /** Opens a portal right next to the player. */
    portal: (legend?: RiftLegend) => playing((g) => openPortal(g, legend ?? pickLegend(g.rng, g.rift.met, teamLegendIds(g)), { x: g.player.x + 48, y: g.player.y }))(),
    /** Ends the run as if Mewtwo just fell: the victory screen with the endless offer. */
    victory: playing((g) => {
      skipTo(g, RUN_LENGTH / 60)
      g.phase = 'victory'
      g.events.push({ kind: 'victory' })
    }),
    /** Jumps into endless mode at `minute` (default 19:30, half a minute before Arceus). */
    endless: (minute = 19.5) =>
      playing((g) => {
        skipTo(g, minute)
        g.endless = startEndless(RUN_LENGTH + 20)
        g.phase = 'playing'
      })(),
    /** Calls Arceus now (endless mode only). */
    reaper: playing((g) => {
      if (g.endless) g.endless.reaperAt = g.time
    }),
  }
}
